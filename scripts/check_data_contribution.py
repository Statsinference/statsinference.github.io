"""Validate public contribution Markdown treated solely as data."""

import argparse
import base64
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


MAX_MARKDOWN_BYTES = 32_768
MAX_API_BYTES = 16 * 1024 * 1024
TRACK_SECTIONS = {
    "simulated-dgp": "Data-generating process and estimand",
    "real-data": "Target estimand and reference estimate",
}
SUBMISSION_PATH = re.compile(
    r"data-submissions/(simulated-dgp|real-data)/submissions/"
    r"[a-z0-9]+(?:-[a-z0-9]+)*\.md\Z"
)
REPOSITORY = re.compile(r"[a-zA-Z0-9-]+/[a-zA-Z0-9_.-]+\Z")
SHA = re.compile(r"[0-9a-f]{40}\Z")
PLACEHOLDER = re.compile(r"\[\s*(?:todo|tbd|replace)\b", re.I)


class ValidationError(ValueError):
    """A submission could not be verified."""


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, new_url):
        return None


def required_sections(track):
    return (
        "Research question",
        "Study design and data source",
        "DAG and identification",
        TRACK_SECTIONS[track],
        "Benchmark comparison",
        "Materials and access",
    )


def validate_markdown(raw, track):
    if len(raw) > MAX_MARKDOWN_BYTES:
        raise ValidationError("Use a Markdown summary of at most 32 KiB.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError("Save the proposal as UTF-8 Markdown.") from exc
    if any(ord(ch) < 32 and ch not in "\t\r\n" for ch in text):
        raise ValidationError("The proposal contains a non-text control character.")

    # Ignore hidden comments and headings inside fenced blocks. Fence contents can
    # still supply section text, such as a Mermaid DAG.
    text = re.sub(r"<!--.*?(?:-->|\Z)", "", text, flags=re.S)
    if PLACEHOLDER.search(text):
        raise ValidationError("Replace every [TODO: ...] placeholder before submitting.")
    lines = text.splitlines()
    first = next((line.strip() for line in lines if line.strip()), "")
    if not re.fullmatch(r"#\s+\S.*", first):
        raise ValidationError("Start the proposal with a Markdown H1 title (# Title).")

    required = required_sections(track)
    populated = dict.fromkeys(required, False)
    seen = []
    current = None
    fence = ""
    title_count = 0
    for line in lines:
        marker = re.match(r" {0,3}(`{3,}|~{3,})(.*)", line)
        if marker:
            run, suffix = marker.groups()
            if not fence:
                fence = run
                continue
            if run.startswith(fence) and not suffix.strip():
                fence = ""
                continue
        if not fence and not line.startswith(("    ", "\t")):
            heading = re.match(r" {0,3}(#{1,2})[ \t]+(.+?)\s*$", line)
            if heading:
                level, title = heading.groups()
                title = re.sub(r"\s+#+$", "", title)
                if level == "#":
                    title_count += 1
                current = title if level == "##" and title in required else None
                if current:
                    seen.append(current)
                continue
        if current and re.search(r"\w", line):
            populated[current] = True
    if fence:
        raise ValidationError("Close all fenced Markdown code or diagram blocks.")
    if title_count != 1:
        raise ValidationError("Use exactly one Markdown H1 title.")
    if seen != list(required):
        raise ValidationError("Use each of the required section headings once, in template order. "
                              "Required headings are " + ", ".join(required) + ".")
    empty_sections = [title for title in required if not populated[title]]
    if empty_sections:
        raise ValidationError("Fill the following sections. " + ", ".join(empty_sections) + ".")


def in_submission_area(path):
    parts = str(path).replace("\\", "/").lower().split("/")
    return parts[0] == "data-submissions" and "submissions" in parts[1:]


def check_changes(changes, read_markdown):
    touched = any(
        in_submission_area(file.get(field, ""))
        for file in changes
        for field in ("filename", "previous_filename")
    )
    if not touched:
        return False
    if len(changes) != 1:
        raise ValidationError("A contribution PR should add or update exactly one proposal Markdown file.")
    file = changes[0]
    filename = file.get("filename", "")
    match = SUBMISSION_PATH.fullmatch(filename)
    if not match or len(filename) > 180:
        raise ValidationError("Use data-submissions/<track>/submissions/<lowercase-kebab-case>.md.")
    if file.get("status") not in ("added", "modified") or file.get("previous_filename"):
        raise ValidationError("Add or update one proposal in place.")
    validate_markdown(read_markdown(file), match.group(1))
    return True


def get_api(token):
    opener = build_opener(NoRedirects())

    def get(path):
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "StatArena-data-check"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = Request(f"https://api.github.com/{path}", headers=headers)
        with opener.open(request, timeout=15) as response:
            data = response.read(MAX_API_BYTES + 1)
        if len(data) > MAX_API_BYTES:
            raise ValidationError("Could not inspect the full GitHub API response.")
        return json.loads(data)

    return get


def repository_name(value):
    if not isinstance(value, str) or not REPOSITORY.fullmatch(value) or value.split("/")[1] in (".", ".."):
        raise ValidationError("Could not verify the pull request repository.")
    return value


def object_sha(value):
    if not isinstance(value, str) or not SHA.fullmatch(value):
        raise ValidationError("Could not verify the immutable Git object ID.")
    return value


def read_git_markdown(api, repository, head_sha, file):
    # Walk the immutable tree so a symlink or executable cannot masquerade as a
    # Markdown blob. Paths are never passed to a shell or checked out.
    commit = api(f"repos/{repository}/git/commits/{head_sha}")
    tree_sha = object_sha(commit["tree"]["sha"])
    parts = file["filename"].split("/")
    for index, part in enumerate(parts):
        tree = api(f"repos/{repository}/git/trees/{tree_sha}")
        if tree.get("truncated"):
            raise ValidationError("Could not inspect the full Git tree.")
        entry = next((item for item in tree["tree"] if item["path"] == part), None)
        last = index == len(parts) - 1
        expected = ("blob", "100644") if last else ("tree", "040000")
        if entry is None or (entry.get("type"), entry.get("mode")) != expected:
            raise ValidationError("The proposal must be a regular Markdown file.")
        tree_sha = object_sha(entry["sha"])

    if tree_sha != object_sha(file["sha"]):
        raise ValidationError("The proposal changed during this check. Check the latest run.")
    if entry.get("size", MAX_MARKDOWN_BYTES + 1) > MAX_MARKDOWN_BYTES:
        raise ValidationError("Use a Markdown summary of at most 32 KiB.")
    blob = api(f"repos/{repository}/git/blobs/{tree_sha}")
    if blob.get("encoding") != "base64" or blob.get("sha") != tree_sha:
        raise ValidationError("Could not verify the proposal contents.")
    try:
        return base64.b64decode(re.sub(r"\s+", "", blob["content"]), validate=True)
    except ValueError as exc:
        raise ValidationError("Could not decode the proposal contents.") from exc


def check_pull_request(event, api):
    repository = repository_name(event["repository"]["full_name"])
    number = event["number"]
    if type(number) is not int or number <= 0:
        raise ValidationError("Could not verify the pull request number.")
    head = event["pull_request"]["head"]
    head_sha = object_sha(head["sha"])
    endpoint = f"repos/{repository}/pulls/{number}"
    current = api(endpoint)
    if current["head"]["sha"] != head_sha:
        raise ValidationError("A newer revision superseded this check. Check the latest run.")
    changed_count = current["changed_files"]
    if type(changed_count) is not int or not 0 <= changed_count <= 3000:
        raise ValidationError("Could not inspect every changed file in the pull request.")
    changes = []
    for page in range(1, (changed_count + 99) // 100 + 1):
        response = api(f"{endpoint}/files?per_page=100&page={page}")
        changes.extend(response)
    if len(changes) != changed_count or api(endpoint)["head"]["sha"] != head_sha:
        raise ValidationError("The list of changed files changed during this check. Check the latest run.")
    # PR head objects from external forks are addressable through the destination
    # repository, keeping API calls within the job token's repository scope.
    return check_changes(changes, lambda file: read_git_markdown(api, repository, head_sha, file))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--local-file", type=Path, help="Check a local proposal against its track template")
    parser.add_argument("--track", choices=tuple(TRACK_SECTIONS))
    args = parser.parse_args()
    try:
        if args.local_file:
            if not args.track:
                parser.error("--local-file requires --track")
            with args.local_file.open("rb") as stream:
                validate_markdown(stream.read(MAX_MARKDOWN_BYTES + 1), args.track)
            checked = True
        else:
            event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_bytes())
            checked = check_pull_request(event, get_api(os.environ.get("GH_TOKEN")))
    except (ValidationError, URLError, OSError, ValueError, KeyError, TypeError) as exc:
        message = str(exc) if isinstance(exc, ValidationError) else "Could not read the pull request or proposal."
        message = "Data contribution precheck failed. " + message
        status = 1
    else:
        message = ("Proposal path and Markdown structure passed. A maintainer still reviews the study design, "
                   "estimand, data access, and reproducibility." if checked else "No data proposal changed.")
        status = 0
    print(message, file=sys.stderr if status else sys.stdout)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(summary).open("a", encoding="utf-8") as stream:
            stream.write("### Data contribution precheck\n\n" + message + "\n")
    return status


if __name__ == "__main__":
    sys.exit(main())
