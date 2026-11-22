import base64
import sys
import unittest
from pathlib import Path


SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SITE / "scripts"))
from check_data_contribution import (  # noqa: E402
    ValidationError,
    check_changes,
    check_pull_request,
    read_git_markdown,
    required_sections,
    validate_markdown,
)


SIMULATED = "simulated-dgp"
REAL = "real-data"
BASE_REPO = "Statsinference/statsinference.github.io"
PATH = f"data-submissions/{SIMULATED}/submissions/teaching-case.md"
EDGES = "X -> M, M -> Y, X -> Y"


def proposal(track=SIMULATED, dag_edges=EDGES, structural_parents=EDGES):
    body = ["# A single benchmark case"]
    for heading in required_sections(track):
        section = f"## {heading}\nA short explanation with [a source](https://example.com)."
        if track == SIMULATED and heading == "DAG and identification":
            section += f"\n\n- **DAG edges.** `{dag_edges}`"
        if track == SIMULATED and heading == "Variables and data-generating process":
            section += (
                "\n\n### Structural equations\n\nM = X + E_M and Y = M + X + E_Y."
                f"\n\n- **Structural parents.** `{structural_parents}`"
            )
        body.append(section)
    return "\n\n".join(body).encode()


class MarkdownTests(unittest.TestCase):
    def test_both_tracks_and_dag_fence(self):
        for track in (SIMULATED, REAL):
            validate_markdown(proposal(track), track)
        valid = proposal().replace(
            b"## DAG and identification\nA short explanation with [a source](https://example.com).",
            b"## DAG and identification\n```mermaid\nflowchart LR\n  X --> Y\n```",
        )
        validate_markdown(valid, SIMULATED)

    def test_published_examples_and_unfilled_templates(self):
        for track in (SIMULATED, REAL):
            directory = SITE / "data-submissions" / track
            validate_markdown((directory / "EXAMPLE.md").read_bytes(), track)
            with self.assertRaises(ValidationError):
                validate_markdown((directory / "TEMPLATE.md").read_bytes(), track)

    def test_track_guides_contain_the_canonical_copyable_template(self):
        for track in (SIMULATED, REAL):
            with self.subTest(track=track):
                directory = SITE / "data-submissions" / track
                guide = (directory / "README.md").read_text(encoding="utf-8")
                template = (directory / "TEMPLATE.md").read_text(encoding="utf-8")
                self.assertEqual(guide.count("```markdown\n"), 1)
                _, _, fence_and_rest = guide.partition("```markdown\n")
                embedded, close, _ = fence_and_rest.partition("\n```\n")
                self.assertTrue(close, "The template code fence must close")
                self.assertEqual(embedded + "\n", template)
                self.assertEqual(
                    tuple(line.removeprefix("## ") for line in embedded.splitlines()
                          if line.startswith("## ")),
                    required_sections(track),
                )

    def test_empty_placeholder_wrong_track_and_duplicate_heading(self):
        unfinished = proposal().replace(b"A short explanation", b"[TODO: add this]")
        empty = proposal().replace(b"A short explanation with [a source](https://example.com).", b"<!-- blank -->")
        repeated = proposal() + b"\n\n## Research question\nAnother question."
        for raw in (unfinished, empty, repeated, proposal(REAL), b"not markdown", b"\xff"):
            with self.subTest(raw=raw[:90]), self.assertRaises(ValidationError):
                validate_markdown(raw, SIMULATED)

    def test_no_hidden_or_fenced_required_section(self):
        for opening, closing in ((b"<!-- ", b" -->"), (b"```text\n", b"\n```")):
            hidden = proposal().replace(
                b"## Materials and access\nA short explanation with [a source](https://example.com).",
                opening + b"## Materials and access\ncontent" + closing,
            )
            with self.subTest(opening=opening), self.assertRaises(ValidationError):
                validate_markdown(hidden, SIMULATED)

    def test_simulated_proposal_requires_variables_and_data_generating_process(self):
        heading = b"## Variables and data-generating process"
        raw = proposal()
        start = raw.index(heading)
        end = raw.index(b"## Data-generating process and estimand", start)
        with self.assertRaisesRegex(ValidationError, heading.decode().removeprefix("## ")):
            validate_markdown(raw[:start] + raw[end:], SIMULATED)

    def test_matching_edges_accept_reordering_and_empty_graph(self):
        validate_markdown(proposal(structural_parents="X->Y, X -> M, M   -> Y"), SIMULATED)
        validate_markdown(proposal(dag_edges="none", structural_parents="none"), SIMULATED)

    def test_matching_edges_accept_a_union_of_distinct_scenario_dags(self):
        edges = "long_variable_name -> Y, Y -> long_variable_name"
        validate_markdown(proposal(dag_edges=edges, structural_parents=edges), SIMULATED)

    def test_mismatched_edges_identify_the_missing_arrows(self):
        raw = proposal(structural_parents="Y -> X, X -> M, M -> Y")
        message = r"Missing from Structural parents: `X -> Y`.*Missing from DAG edges: `Y -> X`"
        with self.assertRaisesRegex(ValidationError, message):
            validate_markdown(raw, SIMULATED)

    def test_malformed_edges_are_rejected(self):
        for edges, message in (
            ("long variable name -> Y", "node IDs"),
            ("X <- Y", "Invalid arrow"),
            ("X -> X", "self-arrow"),
            ("X -> Y, X->Y", "repeats"),
        ):
            with self.subTest(edges=edges), self.assertRaisesRegex(ValidationError, message):
                validate_markdown(proposal(dag_edges=edges, structural_parents=edges), SIMULATED)

    def test_structural_equations_require_visible_heading_and_body(self):
        heading = b"### Structural equations"
        body = b"M = X + E_M and Y = M + X + E_Y."
        raw = proposal()
        for draft, message in (
            (raw.replace(heading, b"<!-- " + heading + b" -->"), r"Add a `### Structural equations`"),
            (raw.replace(heading, b"```md\n" + heading + b"\n```"), r"Add a `### Structural equations`"),
            (raw.replace(body, b"<!-- " + body + b" -->"), "Fill the Structural equations"),
        ):
            with self.subTest(message=message), self.assertRaisesRegex(ValidationError, message):
                validate_markdown(draft, SIMULATED)

    def test_github_math_fence_supplies_structural_equation_content(self):
        raw = proposal().replace(
            b"M = X + E_M and Y = M + X + E_Y.",
            b"```math\nM = X + E_M\nY = M + X + E_Y\n```",
        )
        validate_markdown(raw, SIMULATED)

    def test_edge_fields_must_be_visible_and_in_their_sections(self):
        raw = proposal()
        for field in ("DAG edges", "Structural parents"):
            bullet = f"- **{field}.** `{EDGES}`".encode()
            moved = raw.replace(bullet, b"") + b"\n\n" + bullet
            for draft in (moved, raw.replace(bullet, b"<!-- " + bullet + b" -->"),
                          raw.replace(bullet, b"```md\n" + bullet + b"\n```")):
                with self.subTest(field=field), self.assertRaisesRegex(ValidationError, f"Add .*{field}"):
                    validate_markdown(draft, SIMULATED)


class PRPathTests(unittest.TestCase):
    def test_unrelated_pr_can_update_docs_and_website(self):
        guides = ("README.md", "TEMPLATE.md", "EXAMPLE.md")
        paths = [
            "index.html",
            ".github/workflows/data-contributions.yml",
            *(f"data-submissions/{SIMULATED}/{guide}" for guide in guides),
        ]
        changes = [{"filename": path, "status": "added"} for path in paths]
        self.assertFalse(check_changes(changes, lambda _: self.fail("Read unrelated file")))

    def test_single_proposal_can_be_added_or_updated(self):
        for status in ("added", "modified"):
            self.assertTrue(check_changes([{"filename": PATH, "status": status}], lambda _: proposal()))

    def test_simulated_proposal_beside_guides_requires_submissions_folder(self):
        path = "data-submissions/simulated-dgp/cate-rolling-yang-2014-gaussian-bump-v1.md"
        with self.assertRaisesRegex(ValidationError, "Use data-submissions/<track>/submissions/"):
            check_changes([{"filename": path, "status": "added"}], lambda _: self.fail("Read misplaced file"))

    def test_reject_mixed_prs_bad_paths_deletions_and_renames(self):
        candidates = [
            [{"filename": PATH, "status": "added"}, {"filename": "scripts/other.py", "status": "modified"}],
            [{"filename": PATH, "status": "removed"}],
            [{"filename": "example.md", "previous_filename": PATH, "status": "renamed"}],
            [{"filename": PATH.replace("teaching-case", "nested/teaching-case"), "status": "added"}],
            [{"filename": PATH.replace("teaching-case", "../teaching-case"), "status": "added"}],
            [{"filename": PATH.replace("simulated-dgp", "another-track"), "status": "added"}],
            [{"filename": PATH.replace(".md", ".zip"), "status": "added"}],
            [{"filename": PATH.upper(), "status": "added"}],
        ]
        for changes in candidates:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                check_changes(changes, lambda _: self.fail("Read disallowed file"))


class GitHubAdapterTests(unittest.TestCase):
    def setUp(self):
        self.event = {
            "repository": {"full_name": BASE_REPO}, "number": 10,
            "pull_request": {"head": {"sha": "a" * 40, "repo": {"full_name": "contributor/fork"}}},
        }
        self.head = "a" * 40
        self.blob = "e" * 40
        self.filename = {"filename": PATH, "status": "added", "sha": self.blob}
        self.endpoints = {
            f"repos/{BASE_REPO}/pulls/10": {
                "head": {"sha": self.head}, "changed_files": 1,
            },
            f"repos/{BASE_REPO}/pulls/10/files?per_page=100&page=1": [self.filename],
            f"repos/{BASE_REPO}/git/commits/{self.head}": {"tree": {"sha": "0" * 40}},
            f"repos/{BASE_REPO}/git/blobs/{self.blob}": {
                "sha": self.blob, "encoding": "base64", "content": base64.b64encode(proposal()).decode(),
            },
        }
        for index, name in enumerate(PATH.split("/")):
            file = index == 3
            suffix = str(index) * 40
            self.endpoints[f"repos/{BASE_REPO}/git/trees/{suffix}"] = {"tree": [{
                "path": name, "type": "blob" if file else "tree", "mode": "100644" if file else "040000",
                "sha": self.blob if file else str(index + 1) * 40, "size": len(proposal()),
            }]}

    def test_fork_proposal_from_immutable_git_blob(self):
        self.assertTrue(check_pull_request(self.event, self.endpoints.__getitem__))

    def test_reject_symlink_or_mismatching_blob_without_reading_payload(self):
        leaf = self.endpoints[f"repos/{BASE_REPO}/git/trees/{'3' * 40}"]["tree"][0]
        for patch in ({"mode": "120000"}, {"sha": "c" * 40}):
            with self.subTest(patch=patch):
                previous = leaf.copy()
                leaf.update(patch)
                with self.assertRaises(ValidationError):
                    read_git_markdown(self.endpoints.__getitem__, BASE_REPO, self.head, self.filename)
                leaf.update(previous)

    def test_reject_incomplete_and_superseded_pr_listing(self):
        endpoint = self.endpoints[f"repos/{BASE_REPO}/pulls/10"]
        for mutation in ({"changed_files": 2}, {"changed_files": 3001}, {"head": {"sha": "0" * 40}}):
            with self.subTest(mutation=mutation):
                previous = endpoint.copy()
                endpoint.update(mutation)
                with self.assertRaises(ValidationError):
                    check_pull_request(self.event, self.endpoints.__getitem__)
                endpoint.update(previous)


if __name__ == "__main__":
    unittest.main()
