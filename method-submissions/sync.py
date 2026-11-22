"""Register method submissions for review without fetching participant code."""
from __future__ import annotations
from html import escape
import json
import os
import re
from urllib.parse import quote, urlsplit
import urllib.request
from pathlib import Path

PRIVATE_SOURCE = 'Statsinference/Statistical-Intelligence-Arena'
PUBLIC_SOURCE = 'Statsinference/statsinference.github.io'
SOURCE = PRIVATE_SOURCE if os.environ.get('GITHUB_REPOSITORY') == PRIVATE_SOURCE else PUBLIC_SOURCE
ROOT = Path(__file__).resolve().parent
if SOURCE == PRIVATE_SOURCE:
    ROOT = ROOT.parents[1] / 'method-submissions'
DOMAINS = {'ate', 'cate', 'mediation', 'iv', 'proximal', 'did_sc', 'nonparametric_regression', 'quantile', 'semi_supervised', 'missing_data', 'unspecified'}
DOMAIN_LABELS = {
    'Average Treatment Effect': 'ate',
    'Conditional Average Treatment Effect': 'cate',
    'Causal Mediation Analysis': 'mediation',
    'Instrumental Variables': 'iv',
    'Proximal Causal Inference': 'proximal',
    'Difference-in-Differences': 'did_sc',
    'Nonparametric Regression': 'nonparametric_regression',
    'Quantile Inference': 'quantile',
    'Semi-Supervised Inference': 'semi_supervised',
    'Missing Data': 'missing_data',
}
METHOD_FORM = re.compile(
    r'\A### Method link[ \t]*\n+([^\n]+)\n+'
    r'### Research domain[ \t]*\n+([^\n]+)\n+'
    r'### Completed checklist[ \t]*\n+(.+)\Z',
    re.DOTALL,
)
URL_RE = re.compile(r'https://huggingface\.co/[A-Za-z0-9][A-Za-z0-9_-]*/[A-Za-z0-9][A-Za-z0-9._-]*(?:/tree/[A-Za-z0-9][A-Za-z0-9._-]*)?/?\Z')
RESERVED = {'spaces', 'datasets', 'organizations', 'api', 'settings', 'collections', 'join', 'login'}
MARKER = '<!-- arena-method-submission:v1 -->'
GITHUB_REPO = re.compile(r'https://github\.com/[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+/?\Z')
MEDIATION_FIELDS = {
    'Method name': 'method_name',
    'Mediation method link': 'method_url',
    'Release or commit': 'version',
    'Run instructions or analysis procedure': 'run_instructions',
    'Estimator and interval': 'estimator',
    'Training and data exposure': 'training_exposure',
    'Public development results': 'public_dev_results',
    'Official predictions': 'official_predictions_url',
}
OPTIONAL_FIELDS = {'public_dev_results', 'official_predictions_url'}


def canonical_url(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 1024:
        return None
    value = value.strip()
    if not URL_RE.fullmatch(value) or '..' in value or value.split('/')[3].lower() in RESERVED:
        return None
    return value.rstrip('/')


def public_web_link(value: str) -> bool:
    # Links are archived as references; the intake never downloads them.
    if len(value) > 2048 or re.search(r'[\s<>\\\x00-\x1f]', value):
        return False
    try:
        parsed = urlsplit(value)
        return parsed.scheme == 'https' and bool(parsed.hostname) and parsed.username is None
    except ValueError:
        return False


def parse_method_form(body: str) -> dict | None:
    match = METHOD_FORM.fullmatch(body)
    if not match:
        return None
    url, label, checklist = (value.strip() for value in match.groups())
    domain = DOMAIN_LABELS.get(label)
    if not domain or not public_web_link(url) or not checklist or checklist == '_No response_':
        return None

    location = urlsplit(url)
    name = re.search(r'^Method name:[ \t]*(\S[^\n]*)$', checklist, re.M)
    fields = {
        'schema_version': 3,
        'domain': domain,
        'method_url': url,
        'method_name': name[1].strip() if name else location.hostname,
        'checklist_markdown': checklist,
    }
    for key, pattern in (
        ('version', r'^Version:[ \t]*(\S[^\n]*)$'),
        ('estimator', r'^## Method description[ \t]*\n+([\s\S]+?)(?=^## |\Z)'),
    ):
        if value := re.search(pattern, checklist, re.M):
            fields[key] = value[1].strip()
    if hf := canonical_url(url):
        fields['huggingface_url'] = hf
    return fields


def parse_mediation_form(body: str) -> dict | None:
    headings = '|'.join(map(re.escape, MEDIATION_FIELDS))
    sections = re.split(rf'^### ({headings})[ \t]*\n', body, flags=re.M)
    fields = {}
    for heading, block in zip(sections[1::2], sections[2::2]):
        value = block.strip()
        if value and value != '_No response_':
            fields[MEDIATION_FIELDS[heading]] = value
    for key in MEDIATION_FIELDS.values():
        if key not in OPTIONAL_FIELDS and key not in fields:
            return None
    if any(not public_web_link(fields[key]) for key in OPTIONAL_FIELDS if key in fields):
        return None
    url = fields['method_url']
    hf = canonical_url(url)
    if hf:
        fields['method_url'] = hf
        fields['huggingface_url'] = hf
    elif len(url) <= 1024 and GITHUB_REPO.fullmatch(url) and '..' not in url:
        repo = url.rstrip('/').removesuffix('.git')
        if repo.endswith(('/', '/.')):
            return None
        fields['method_url'] = repo
    elif not public_web_link(url) or 'official_predictions_url' not in fields:
        return None
    return {'schema_version': 2, 'domain': 'mediation', **fields}


def submission_fields(body: str) -> dict | None:
    if body.lstrip().startswith('### Method link\n'):
        return parse_method_form(body.lstrip())
    if MARKER not in body:
        return parse_mediation_form(body)
    match = re.search(r'^### Hugging Face model link\n+([^\n]+)\s*\n', body, re.M)
    url = canonical_url(match.group(1)) if match else None
    if not url:
        return None
    domain_match = re.search(r'^### Research domain\n+([a-z_]+)\s*\n', body, re.M)
    domain = domain_match.group(1) if domain_match else 'unspecified'
    return {'schema_version': 1, 'model': '/'.join(url.split('/')[3:5]), 'huggingface_url': url,
            'domain': domain if domain in DOMAINS else 'unspecified'}


def parse_issue(issue: dict) -> dict | None:
    """Only typed link submissions are accepted; all fields are data, never commands."""
    if issue.get('pull_request') or not str(issue.get('title', '')).startswith('[Method submission] '):
        return None
    body = issue.get('body') or ''
    if not isinstance(body, str) or len(body) > 10000:
        return None
    fields = submission_fields(body.replace('\r\n', '\n'))
    number = issue.get('number')
    author = (issue.get('user') or {}).get('login', '')
    if not fields or type(number) is not int or number < 1 or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?', author):
        return None
    dates = [issue.get(k, '') for k in ['created_at', 'updated_at']]
    if not all(isinstance(d, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', d) for d in dates):
        return None
    state = issue.get('state')
    if state not in ['open', 'closed']:
        return None
    is_test = str(issue['title']).startswith('[Method submission] [TEST] ')
    return {
        'schema_version': fields.pop('schema_version'), 'issue_number': number, **fields,
        'submitted_by': author, 'created_at': dates[0], 'updated_at': dates[1],
        'status': state, 'issue_url': f'https://github.com/{SOURCE}/issues/{number}',
        'is_test': is_test,
    }


def fetch_issues() -> list[dict]:
    """Read only the configured intake repository, following all result pages."""
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'Statistical-Inference-Arena-Submission-Archive', 'X-GitHub-Api-Version': '2022-11-28'}
    # Send credentials only to the repository running this workflow.
    if os.environ.get('GITHUB_REPOSITORY') == SOURCE and os.environ.get('GITHUB_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
    issues = []
    page = 1
    while True:
        url = f'https://api.github.com/repos/{SOURCE}/issues?state=all&sort=created&direction=asc&per_page=100&page={page}'
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
            batch = json.load(response)
        if not isinstance(batch, list):
            raise ValueError('Unexpected issue response')
        issues.extend(batch)
        if len(batch) < 100:
            return issues
        page += 1


def write_archive(issues: list[dict], root: Path = ROOT) -> int:
    records = [r for issue in issues if (r := parse_issue(issue)) is not None]
    for record in records:
        directory = root / ('checks' if record['is_test'] else 'received')
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"issue-{record['issue_number']:06d}.json"
        path.write_text(json.dumps(record, ensure_ascii=True, indent=2) + '\n', encoding='utf-8')
    received = root / 'received'
    received.mkdir(parents=True, exist_ok=True)
    # Retain previously received submissions even if their source issue is subsequently deleted.
    saved = [json.loads(p.read_text(encoding='utf-8')) for p in received.glob('issue-*.json')]
    saved.sort(key=lambda r: r['issue_number'], reverse=True)
    lines = ['# Method submissions', '', '| Method | Domain | Submitted by | Date | Status | Submission |', '| --- | --- | --- | --- | --- | --- |']
    for r in saved:
        if r['schema_version'] in (2, 3):
            # Keep submitted names and URL punctuation inside one Markdown cell.
            name = re.sub(r'([\\|\[\]`*_~])', r'\\\1', escape(' '.join(r['method_name'].split())))
            link = quote(r['method_url'], safe=':/?#@!$&*+,;=%-._~')
        else:
            name, link = r['model'], r['huggingface_url']
        lines.append(f"| [{name}]({link}) | {r['domain']} | {r['submitted_by']} | {r['created_at'][:10]} | {r['status']} | [#{r['issue_number']}]({r['issue_url']}) |")
    if not saved:
        lines += ['', 'No method submissions yet.']
    (received / 'README.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return len(records)


if __name__ == '__main__':
    count = write_archive(fetch_issues())
    print(f'Archived {count} validated submission records.')
