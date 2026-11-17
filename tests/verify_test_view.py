"""Browser regression for the shared Test leaderboard and comparison charts.

CI defaults to the deployed site. Set ARENA_TEST_URL=local for a self-contained
preview; no source data is changed, regenerated, or recomputed.
"""
from pathlib import Path
import base64
import csv
import hashlib
import json
import math
import os
import re
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification'
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('ARENA_TEST_URL', 'https://statsinference.github.io/')
LOCAL = BASE == 'local'
SHA = os.environ.get('GITHUB_SHA', 'details-and-log-charts')
KEYS = ['bias', 'variance', 'rmse', 'length', 'coverage', 'time_s']
HEADINGS = ['Rank', 'Method', 'Bias', 'Variance', 'RMSE', 'Mean interval length', 'Coverage', 'Time (s)']
DOMAINS = ['ate', 'cate', 'mediation', 'iv', 'proximal', 'did_sc',
           'nonparametric_regression', 'quantile', 'semi_supervised', 'missing_data']
COMING_SOON = set(DOMAINS[-4:])
EXPECTED = {
    'ate': [[.0119,.0097,.1114,.2599,.7763,1.089],[-.0167,.0137,.1284,.5897,.9675,90.490]],
    'cate': [[.0143,.0480,.2966,5.8471,1.,.219],[-.0139,.1560,.5522,1.2689,.8484,55.501]],
    'mediation': [[.0219,.3303,.5891,1.2654,.973,1.5],[-.1098,4.0148,2.0533,4.3238,.949,439.39]],
    'iv': [[.012,.072,.268,.875,.9565,.366],[.022,.099,.316,1.111,.9025,179.9]],
    'proximal': [[.0219,.0146,.1229,.4447,.965,.997],[.0161,.6718,.8196,.8475,.9735,80.873]],
    'did_sc': [[.001012,.018648,.136526,.466152,.9485,.135786],[-.014595,.083437,.289151,.826107,.9565,89.779984]]
}


def data_hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (ROOT / 'data').glob('*.json')}


SOURCE_HASHES = data_hashes()

if not LOCAL:
    # Wait for Pages to deploy these exact files. Cache-busting prevents an old
    # deployment from accidentally passing against different local sources.
    paths = ['index.html', 'assets/test-view.js', 'assets/test-view.css',
             'assets/test-references.js', 'assets/comparison-charts.js',
             'assets/comparison-charts.css', 'assets/domain-illustrations.js',
             'assets/arena-overview.js', 'assets/arena-overview.css',
             'data/results.json', 'data/mediation-fivefold.json',
             'data/iv-v03.json', 'data/unified-test-2026-11-16.json', 'data/dgp-overview.json']
    for attempt in range(40):
        try:
            if all(urllib.request.urlopen(BASE + path + '?verify=' + SHA + '-' + str(attempt), timeout=15).read()
                   == (ROOT / path).read_bytes() for path in paths):
                break
        except Exception:
            pass
        time.sleep(5)
    else:
        raise AssertionError('Expected website release did not deploy')


def load(page, fragment=''):
    if not LOCAL:
        page.goto(BASE + '?verify=' + SHA + ('#' + fragment if fragment else ''),
                  wait_until='networkidle', timeout=60000)
    else:
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        html = re.sub(r'<link[^>]*href="https://fonts[^>]*>', '', html)
        html = re.sub(r'<link rel="stylesheet" href="(assets/[^"?]+)[^"]*">',
                      lambda m: '<style>' + (ROOT / m.group(1)).read_text(encoding='utf-8') + '</style>', html)
        html = re.sub(r'<script src="(assets/[^"?]+)[^"]*"></script>',
                      lambda m: '<script>' + (ROOT / m.group(1)).read_text(encoding='utf-8') + '</script>', html)
        html = html.replace('assets/statsarena-logo.webp',
                            'data:image/webp;base64,' + base64.b64encode((ROOT / 'assets/statsarena-logo.webp').read_bytes()).decode())
        data = {str(p.relative_to(ROOT)).replace('\\', '/'): json.loads(p.read_text(encoding='utf-8'))
                for p in (ROOT / 'data').glob('*.json')}
        preload = '<script>const localData=' + json.dumps(data) + ';window.fetch=url=>Promise.resolve(new Response(JSON.stringify(localData[String(url).split("?")[0]]),{status:200}));</script>'
        page.set_content(html.replace('</head>', preload + '</head>'), wait_until='load')
    page.wait_for_function("document.body.dataset.testView==='ready'", timeout=30000)
    if LOCAL and fragment:
        page.evaluate('(h)=>{location.hash=h;readHash();render();}', fragment)


def headers(page):
    # Compare the labels, not the sort-arrow glyph.
    return [re.sub(r'\s*[↑↓↕]\s*$', '', h).strip()
            for h in page.locator('#leaderboard thead th').all_inner_texts()]


def assert_at_most_four_decimals(text):
    """Check user-visible numbers while allowing scientific notation."""
    for token in re.findall(r'(?<![\w.])[-+]?(?:\d+\.\d+|\d+)(?:[eE][-+]?\d+)?', text):
        mantissa = re.split(r'[eE]', token)[0]
        if '.' in mantissa:
            assert len(mantissa.split('.')[1]) <= 4, (token, text)


def assert_axis_labels_do_not_overlap(host):
    boxes = host.locator('.chart-axis-title, .chart-tick').evaluate_all('''nodes => nodes.map(n => {
        const r=n.getBoundingClientRect();
        return {kind:n.classList.contains('chart-axis-title')?'title':'tick',
                text:n.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};
    })''')
    assert len([b for b in boxes if b['kind'] == 'title']) == 2
    assert len([b for b in boxes if b['kind'] == 'tick']) == 10
    for title in (b for b in boxes if b['kind'] == 'title'):
        for tick in (b for b in boxes if b['kind'] == 'tick'):
            overlap_x = min(title['right'], tick['right']) - max(title['left'], tick['left'])
            overlap_y = min(title['bottom'], tick['bottom']) - max(title['top'], tick['top'])
            assert not (overlap_x > 1 and overlap_y > 1), (title, tick)



def assert_guidance_inside_plot(host, chart_id, nominal):
    """Guides must track their axes without hiding data or each other."""
    svg = host.locator('svg')
    groups = svg.locator('.chart-guidance')
    assert groups.count() == 2
    xguide = svg.locator('.chart-guidance[data-axis="x"]')
    yguide = svg.locator('.chart-guidance[data-axis="y"]')
    assert xguide.count() == yguide.count() == 1
    assert xguide.get_attribute('data-direction') == 'left'
    if chart_id == 'rmse-time-chart':
        assert 'shorter time' in xguide.text_content().lower()
        assert 'lower rmse' in yguide.text_content().lower()
        assert yguide.get_attribute('data-direction') == 'down'
    else:
        assert 'shorter ci' in xguide.text_content().lower()
        assert str(round(nominal * 100)) + '%' in yguide.text_content()
        line_y = float(svg.locator('.chart-reference').get_attribute('y1'))
        guide_y = float(yguide.get_attribute('data-y'))
        assert yguide.get_attribute('data-direction') == ('up' if guide_y > line_y else 'down')
    for group in (xguide, yguide):
        arrow = group.locator('path.chart-guidance-arrow')
        assert arrow.count() == 1
        b = arrow.bounding_box()
        assert arrow.is_visible() and b and b['width'] > 1 and b['height'] > 1
        label = group.locator('text.chart-guidance-text')
        assert label.count() == 1 and label.text_content().strip()
        text_box = label.bounding_box()
        assert text_box and text_box['width'] > 1 and text_box['height'] > 1
        ox = min(b['x']+b['width'],text_box['x']+text_box['width']) - max(b['x'],text_box['x'])
        oy = min(b['y']+b['height'],text_box['y']+text_box['height']) - max(b['y'],text_box['y'])
        assert not (ox > .5 and oy > .5), (chart_id, group.get_attribute('data-axis'), b, text_box)
    plot = svg.evaluate('''svg => {
        const vals=['data-plot-left','data-plot-top','data-plot-width','data-plot-height'].map(a=>Number(svg.getAttribute(a)));
        if (vals.some(v=>!Number.isFinite(v))) return null;
        const [x,y,w,h]=vals, ctm=svg.getScreenCTM();
        if (!ctm) return null;
        const a=new DOMPoint(x,y).matrixTransform(ctm), b=new DOMPoint(x+w,y+h).matrixTransform(ctm);
        return {left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),
                top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
    }''')
    assert plot
    # These bounds use SVG user coordinates and verify the guides are near
    # their corresponding axes, not just anywhere inside the plot.
    left = float(svg.get_attribute('data-plot-left'))
    top = float(svg.get_attribute('data-plot-top'))
    height = float(svg.get_attribute('data-plot-height'))
    xedge = float(xguide.get_attribute('data-y')) + float(xguide.get_attribute('data-height'))
    yedge = float(yguide.get_attribute('data-x'))
    assert 0 <= top+height-xedge <= 81
    assert 0 <= yedge-left <= 53
    boxes = []
    for group in (xguide, yguide):
        box = group.bounding_box()
        assert box, chart_id
        boxes.append(box)
        assert box['x'] >= plot['left'] - 1 and box['y'] >= plot['top'] - 1
        assert box['x'] + box['width'] <= plot['right'] + 1
        assert box['y'] + box['height'] <= plot['bottom'] + 1
        for marker in svg.locator('.chart-point .chart-marker').all():
            dot = marker.bounding_box()
            assert dot
            ox = min(box['x']+box['width'],dot['x']+dot['width'])-max(box['x'],dot['x'])
            oy = min(box['y']+box['height'],dot['y']+dot['height'])-max(box['y'],dot['y'])
            assert not (ox > 0 and oy > 0), (chart_id, box, dot)
        if chart_id == 'coverage-length-chart':
            line = svg.locator('.chart-reference').bounding_box()
            assert line and not (box['y'] < line['y'] < box['y'] + box['height'])
    a, b = boxes
    ox = min(a['x']+a['width'], b['x']+b['width']) - max(a['x'],b['x'])
    oy = min(a['y']+a['height'], b['y']+b['height']) - max(a['y'],b['y'])
    assert not (ox > 0 and oy > 0), (chart_id, a, b)
    assert_centered_guides_when_clear(svg, xguide, yguide, chart_id)


def assert_centered_guides_when_clear(svg, xguide, yguide, chart_id):
    """Test axis midpoints when clear; allow displacement to avoid collisions."""
    plot = {key: float(svg.get_attribute('data-plot-' + key)) for key in ('left','top','width','height')}
    def geometry(g):
        return {key:float(g.get_attribute('data-' + key)) for key in ('x','y','width','height')}
    current = [geometry(xguide), geometry(yguide)]
    points=[]
    for point in svg.locator('.chart-point').all():
        transform = point.get_attribute('transform')
        nums = re.findall(r'[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?', transform)
        assert len(nums) == 2, transform
        points.append((float(nums[0]), float(nums[1])))
    reference = (float(svg.locator('.chart-reference').get_attribute('y1'))
                 if chart_id == 'coverage-length-chart' else None)
    for index, axis in enumerate(('x', 'y')):
        rect = current[index].copy()
        other = current[1-index]
        plot_mid = plot['left']+plot['width']/2 if axis=='x' else plot['top']+plot['height']/2
        rect[axis] = plot_mid - rect['width' if axis=='x' else 'height']/2
        blocked = any(rect['x']-9 <= x <= rect['x']+rect['width']+9 and
                      rect['y']-9 <= y <= rect['y']+rect['height']+9 for x,y in points)
        blocked |= reference is not None and rect['y']-4 <= reference <= rect['y']+rect['height']+4
        blocked |= (rect['x'] < other['x']+other['width']+4 and rect['x']+rect['width']+4 > other['x'] and
                    rect['y'] < other['y']+other['height']+4 and rect['y']+rect['height']+4 > other['y'])
        if not blocked:
            actual_mid = current[index][axis] + current[index]['width' if axis=='x' else 'height']/2
            step = (plot['width']-rect['width']-8 if axis=='x' else plot['height']-rect['height']-8)/10
            assert abs(actual_mid-plot_mid) <= max(1,step), (chart_id, axis, current[index], plot)


def assert_navigation_groups(page):
    groups = page.locator('#tabs .domain-group')
    assert groups.count() == 2
    names = [group.locator('.domain-group-heading').text_content().strip() for group in groups.all()]
    assert names == ['Causal Inference', 'Others'], names
    for group, expected in zip(groups.all(), (DOMAINS[:6], DOMAINS[6:])):
        assert group.get_attribute('role') == 'group'
        heading = group.locator('.domain-group-heading')
        assert group.get_attribute('aria-labelledby') == heading.get_attribute('id')
        assert group.locator('[role="tab"][data-t]').evaluate_all('nodes=>nodes.map(n=>n.dataset.t)') == expected


def assert_overview(page, suites):
    area = page.locator('#arena-overview-stats')
    assert area.is_visible()
    first = {}
    for suite in suites:
        first.setdefault(suite['domain'], suite)
    def valid(row):
        return any(isinstance(row.get(k), (int, float)) and not isinstance(row.get(k), bool)
                   and math.isfinite(row[k]) for k in KEYS)
    # Source-bound categories reflect the currently displayed releases. IV's
    # LATE type is user-confirmed; its original machine-readable target is null.
    by_suite = {
        'ate-fixed-collection-report':'ATE',
        'cate-fixed-collection-report':'CATE',
        'mediation-fivefold-2026-11-16':'NIE',
        'iv-v03-test':'LATE',
        'proximal-unified-2026-11-16-normalized':'CATE',
        'did-test-2026-11-16':'ATT',
    }
    active = [suite for suite in first.values() if any(valid(row) for row in suite['rows'])]
    assert all(suite['id'] in by_suite for suite in active)
    estimands = {by_suite[suite['id']] for suite in active}
    assert estimands == {'ATE', 'CATE', 'NIE', 'LATE', 'ATT'}
    snapshot = json.loads((ROOT/'data/dgp-overview.json').read_text(encoding='utf-8'))
    assert snapshot['schema_version'] == 1
    assert isinstance(snapshot['registered_dgps'], int) and snapshot['registered_dgps'] >= 0
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', snapshot['as_of'])
    values = {
        'domains': page.locator('#tabs [data-t]').count(),
        'registered-dgps': snapshot['registered_dgps'],
        'estimand-types': len(estimands),
        'metrics': len(KEYS),
    }
    for key, expected in values.items():
        assert area.locator(f'[data-overview-stat="{key}"]').inner_text().strip() == str(expected), key
    provenance = area.locator('[data-dgp-snapshot]').text_content().lower()
    assert snapshot['as_of'] in provenance and 'pending review' in provenance


def assert_medals(page, suite, key):
    nominal = suite.get('nominal_coverage', .95)
    score = lambda r: abs(r[key]) if key == 'bias' else abs(r[key] - nominal) if key == 'coverage' else r[key]
    ordered = sorted(suite['rows'], key=score)
    rank_by_id = {}
    previous, rank = None, 0
    for i, row in enumerate(ordered):
        if i == 0 or score(row) != previous:
            rank = i + 1
        rank_by_id[row.get('source_method') or row['method']] = rank
        previous = score(row)
    names = {1:'gold', 2:'silver', 3:'bronze'}
    for row in page.locator('#leaderboard tbody tr[data-method]').all():
        rank = rank_by_id[row.get_attribute('data-method')]
        medal = row.locator('.rank-medal')
        if rank in names:
            assert medal.count() == 1
            assert medal.get_attribute('role') == 'img'
            assert medal.get_attribute('aria-label') == f'Rank {rank} ({names[rank]} medal)'
            assert 'rank-medal--' + names[rank] in medal.get_attribute('class')
        else:
            assert medal.count() == 0


def check_chart_tooltip(page, host):
    point = host.locator('.chart-point').first
    tip = host.locator('.chart-tooltip')
    assert tip.count() == 1 and tip.is_hidden()
    # Focus tests keyboard users and avoids depending on mouse position.
    point.focus()
    assert tip.is_visible() and tip.get_attribute('role') == 'tooltip'
    assert point.get_attribute('role') == 'button'
    assert point.get_attribute('aria-expanded') == 'true'
    assert point.get_attribute('aria-controls') == tip.get_attribute('id')
    assert tip.locator('.chart-tooltip-title').inner_text() == point.get_attribute('data-method')
    assert tip.locator('.chart-tooltip-row').count() == 2
    assert_at_most_four_decimals(tip.inner_text())
    assert 'original units' not in tip.inner_text().lower()
    if host.get_attribute('data-domain') == 'proximal':
        assert 'normalized by outcome sd' in tip.inner_text().lower()
    rows = tip.locator('.chart-tooltip-row').all_inner_texts()
    for text, key in zip(rows, ('data-x', 'data-y')):
        match = re.search(r'[-+]?(?:\d+\.\d+|\d+)(?:[eE][-+]?\d+)?', text)
        assert match, text
        actual, source = float(match.group()), float(point.get_attribute(key))
        assert abs(actual-source) <= max(.000051, abs(source)*.00051), (text, source)
    tip_box, host_box = tip.bounding_box(), host.bounding_box()
    assert tip_box and host_box
    assert tip_box['x'] >= host_box['x'] - 1
    assert tip_box['x'] + tip_box['width'] <= host_box['x'] + host_box['width'] + 1
    assert tip_box['y'] >= host_box['y'] - 1
    assert tip_box['y'] + tip_box['height'] <= host_box['y'] + host_box['height'] + 1
    # Escape dismisses a keyboard tooltip; clicking pins it and a second
    # activation closes it, without changing any results.
    page.keyboard.press('Escape')
    assert tip.is_hidden() and point.get_attribute('aria-expanded') == 'false'
    point.press('Enter')
    assert tip.is_visible()
    point.press('Enter')
    assert tip.is_hidden()
    page.locator('#rank-metric').focus()
    point.hover()
    assert tip.is_visible()
    page.mouse.move(0, 0)
    assert tip.is_hidden()


def check_chart(page, chart_id, domain, xkey, ykey, suite):
    host = page.locator('#' + chart_id)
    page.wait_for_function('(args)=>{const h=document.getElementById(args.id);return h?.dataset.domain===args.domain && h.querySelector("svg")}',
                           arg={'id': chart_id, 'domain': domain})
    points = host.locator('.chart-point')
    expected = [r for r in suite['rows'] if isinstance(r.get(xkey), (int, float))
                and isinstance(r.get(ykey), (int, float)) and r[xkey] > 0 and r[ykey] > 0
                and (ykey != 'coverage' or r[ykey] <= 1)]
    assert points.count() == len(expected), (domain, chart_id, points.count(), len(expected))
    for point, row in zip(points.all(), expected):
        assert point.get_attribute('data-method') == ('Baseline' if row['family'] == 'classical' else row['method'])
        assert math.isclose(float(point.get_attribute('data-x')), row[xkey], rel_tol=1e-12)
        assert math.isclose(float(point.get_attribute('data-y')), row[ykey] * (100 if ykey == 'coverage' else 1), rel_tol=1e-12)
        assert point.get_attribute('aria-label') and point.get_attribute('tabindex') == '0'
    assert 'logarithmic' in host.locator('svg desc').text_content().lower()
    axes = host.locator('.chart-axis-title').all_text_contents()
    assert len(axes) == 2 and all('log scale' in a.lower() for a in axes), axes
    assert_guidance_inside_plot(host, chart_id, suite['nominal_coverage'])
    # Geometric ticks distinguish a real log axis from relabeled linear axes.
    ticks = [float(t) for t in host.locator('.chart-tick').all_text_contents()]
    for label in host.locator('.chart-tick').all_text_contents():
        assert_at_most_four_decimals(label)
    assert len(ticks) == 10, ticks
    for group in (ticks[:5], ticks[5:]):
        gaps = [math.log(group[i+1] / group[i]) for i in range(4)]
        assert max(gaps) - min(gaps) < .006, (chart_id, group)
    if ykey == 'coverage':
        assert math.isclose(float(host.locator('.chart-reference').get_attribute('data-value')),
                            100 * suite['nominal_coverage'], rel_tol=1e-12)
    assert_axis_labels_do_not_overlap(host)
    check_chart_tooltip(page, host)


errors = []
with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_EXECUTABLE')
    browser = p.chromium.launch(**({'executable_path': exe} if exe else {}))
    page = browser.new_page(viewport={'width': 1440, 'height': 1050})
    page.on('pageerror', lambda e: errors.append(str(e)))
    load(page)
    page.evaluate('async()=>{await document.fonts.ready}')
    assert page.title() == 'Statistical Inference Arena'
    assert page.locator('#tab-ate').get_attribute('aria-selected') == 'true'
    assert page.locator('#rank-metric').input_value() == 'rmse'
    assert page.locator('#fam-chips button').all_inner_texts() == ['All methods', 'RFN', 'Baseline']
    assert page.locator('#tabs [data-t]').count() == 10
    assert_navigation_groups(page)
    suites = page.evaluate('ArenaTestView.getSuites()')
    assert len(suites) == 6
    page.wait_for_function('document.querySelector("[data-overview-stat=estimand-types]")?.textContent.trim() !== "—" && document.querySelector("[data-overview-stat=registered-dgps]")?.textContent.trim() !== "—"')
    assert_overview(page, suites)
    bronze = page.evaluate('rankDisplay(3)')
    assert 'rank-medal--bronze' in bronze and 'Rank 3 (bronze medal)' in bronze
    assert page.evaluate('rankDisplay(4)') == '4'
    assert page.evaluate('rankDisplay("—")') == '—'
    for domain, expected_values in EXPECTED.items():
        suite = next(s for s in suites if s['domain'] == domain)
        assert [[r[k] for k in KEYS] for r in suite['rows']] == expected_values, domain

    for domain in DOMAINS:
        page.locator(f'[data-t="{domain}"]').click()
        assert page.locator(f'#tab-{domain}').get_attribute('aria-selected') == 'true'
        page.wait_for_function('(domain)=>document.querySelector("#domain-illustration")?.dataset.domain===domain', arg=domain)
        assert page.locator('#domain-illustration svg').get_attribute('role') == 'img'
        assert page.locator('#domain-illustration svg desc').text_content()
        if domain in ('ate', 'cate'):
            assert 'Confounder' in page.locator('#domain-illustration').text_content()
            assert page.locator('#domain-definition').text_content().strip()
        if domain in COMING_SOON:
            assert page.locator('#coming-soon').is_visible()
            assert 'coming soon' in page.locator('#coming-soon').inner_text().lower()
            assert page.locator('#table').is_hidden()
            assert page.locator('.test-controls').is_hidden()
            assert page.locator('#methodology').is_hidden()
            continue
        suite = next(s for s in suites if s['domain'] == domain)
        assert page.locator('#coming-soon').is_hidden()
        assert page.locator('#table').is_visible()
        assert headers(page) == HEADINGS, (domain, headers(page))
        assert page.locator('#leaderboard tbody tr[data-method]').count() == 2
        assert page.locator('#leaderboard tbody .method-details-row').count() == 0
        assert page.locator('#leaderboard .mname').all_inner_texts().count('Baseline') == 1
        check_chart(page, 'rmse-time-chart', domain, 'time_s', 'rmse', suite)
        check_chart(page, 'coverage-length-chart', domain, 'length', 'coverage', suite)
        for key in KEYS:
            page.locator('#rank-metric').select_option(key)
            score = lambda r: abs(r[key]) if key == 'bias' else abs(r[key] - suite['nominal_coverage']) if key == 'coverage' else r[key]
            ordered = sorted(suite['rows'], key=score)
            rows = page.locator('#leaderboard tbody tr[data-method]')
            assert_medals(page, suite, key)
            assert [r.get_attribute('data-method') for r in rows.all()] == [r.get('source_method') or r['method'] for r in ordered], (domain, key)
            for row in rows.all():
                identity = row.get_attribute('data-method')
                formatted = page.evaluate('(id)=>{const r=current().rows.find(r=>(r.source_method||r.method)===id);return metricKeys.map(k=>formatMetric(r,k));}', identity)
                cells = row.locator('td[data-metric]').all_inner_texts()
                assert cells == formatted
                for value in cells:
                    assert_at_most_four_decimals(value)

        # Details open and close without changing metrics or ranks; details are
        # real linked metadata, not an extra method row or a duplicated score.
        page.locator('#rank-metric').select_option('rmse')
        row = page.locator('#leaderboard tbody tr[data-method]').first
        identity = row.get_attribute('data-method')
        before = row.locator('td[data-metric]').all_inner_texts()
        toggle = row.locator('.method-toggle')
        assert toggle.get_attribute('aria-expanded') == 'false'
        toggle.click()
        row = page.locator(f'#leaderboard tbody tr[data-method="{identity}"]')
        assert row.locator('.method-toggle').get_attribute('aria-expanded') == 'true'
        detail = page.locator('#' + row.locator('.method-toggle').get_attribute('aria-controls'))
        assert detail.is_visible() and detail.locator('.method-detail-grid').count() == 1
        assert detail.locator('.method-detail-grid > div > strong').all_text_contents() == [
            'Method', 'Estimator / model', 'Folds / contexts', 'Bootstrap', 'Configuration']
        assert detail.locator('.method-detail-extra').count() == 1
        assert row.locator('td[data-metric]').all_inner_texts() == before
        row.locator('.method-toggle').click()
        assert page.locator('#leaderboard tbody .method-details-row').count() == 0

    # All expanded methods share aligned detail columns; compare their actual
    # screen positions rather than only checking they have the same labels.
    page.locator('[data-t="ate"]').click()
    page.locator('.method-toggle').first.click()
    page.locator('.method-toggle').last.click()
    grids = page.locator('.method-details-row .method-detail-grid')
    assert grids.count() == 2
    columns = [grid.locator(':scope > div:not(.method-detail-extra)').all() for grid in grids.all()]
    assert all(len(row) == 4 for row in columns)
    for first, second in zip(*columns):
        a, b = first.bounding_box(), second.bounding_box()
        assert a and b and abs(a['x'] - b['x']) <= 1 and abs(a['width'] - b['width']) <= 1
    for grid in grids.all():
        extra = grid.locator('.method-detail-extra')
        assert extra.evaluate('(e)=>getComputedStyle(e).gridColumnStart') == '1'
        assert extra.evaluate('(e)=>getComputedStyle(e).gridColumnEnd') == '-1'

    # Display just NIE while retaining the treatment-1 natural indirect effect.
    page.locator('[data-t="mediation"]').click()
    mediation_math = page.locator('#domain-definition math')
    assert mediation_math.get_attribute('aria-label') == 'Natural indirect effect at treatment level one'
    assert mediation_math.locator('mi').first.text_content() == 'NIE'
    assert mediation_math.locator('msub').count() == 0
    formula = re.sub(r'\s+', '', mediation_math.text_content())
    assert 'Y(1,M(1))' in formula and 'Y(1,M(0))' in formula

    # Five baseline evaluations explicitly report 50 bootstrap replicates.
    # The IV source does not provide this number, so leave it unknown.
    for domain in EXPECTED:
        page.locator(f'[data-t="{domain}"]').click()
        page.locator('[data-fam="classical"]').click()
        toggle = page.locator('#leaderboard tbody .method-toggle')
        if toggle.get_attribute('aria-expanded') == 'false':
            toggle.click()
        detail = page.locator('#' + page.locator('#leaderboard tbody .method-toggle').get_attribute('aria-controls'))
        bootstrap = detail.locator('.method-detail-grid > div').filter(has=page.get_by_text('Bootstrap', exact=True))
        assert bootstrap.count() == 1
        value = bootstrap.locator('p').inner_text().strip()
        assert value == ('—' if domain == 'iv' else '50'), (domain, value)
        page.locator('#leaderboard tbody .method-toggle').click()
        page.locator('[data-fam="all"]').click()

    page.locator('[data-t="mediation"]').click()
    pfn_row = page.locator('#leaderboard tbody tr[data-method]').filter(has_text='MediPFN')
    pfn_row.locator('.method-toggle').click()
    pfn = page.locator('#' + page.locator('#leaderboard tbody tr[data-method]').filter(has_text='MediPFN').locator('.method-toggle').get_attribute('aria-controls'))
    refs = pfn.locator('.method-reference-links > div')
    paper = refs.filter(has_text='Method reference')
    model = refs.filter(has_text='Hugging Face')
    assert paper.count() == model.count() == 1
    assert paper.locator('strong').text_content() == 'Method reference'
    assert model.locator('strong').text_content() == 'Model'
    paper_link, model_link = paper.locator('a.method-reference-link'), model.locator('a.method-reference-link')
    assert paper_link.count() == model_link.count() == 1
    assert paper_link.get_attribute('href') == 'https://arxiv.org/abs/2611.13219'
    assert 'MediPFN' in paper_link.inner_text()
    assert model_link.get_attribute('href') == 'https://huggingface.co/shibo769/MediPFN'
    assert 'Hugging Face' in model_link.inner_text()
    for link in (paper_link, model_link):
        assert link.get_attribute('target') == '_blank'
        assert {'noopener', 'noreferrer'} <= set(link.get_attribute('rel').split())

    page.locator('[data-t="proximal"]').click()
    assert page.evaluate('current().metric_scale') == 'normalized'
    assert 'original units' not in page.locator('#main-panel').inner_text().lower()
    page.evaluate("location.hash='domain=proximal&suite=proximal-unified-2026-11-16-original';readHash();render();")
    assert page.evaluate('current().metric_scale') == 'normalized'
    assert 'original units' not in page.locator('#main-panel').inner_text().lower()

    page.locator('[data-t="iv"]').click()
    iv_target = page.locator('#domain-definition math')
    assert iv_target.get_attribute('aria-label') == 'Local average treatment effect among compliers'
    assert 'late' in iv_target.text_content().lower()
    assert 'not specified' not in page.locator('#domain-definition').inner_text().lower()
    page.locator('[data-fam="classical"]').click()
    assert page.locator('#leaderboard tbody tr[data-method]').count() == 1
    assert page.locator('#leaderboard .mname').inner_text() == 'Baseline'
    page.locator('.method-toggle').click()
    baseline_detail = page.locator('.method-details-row')
    assert baseline_detail.is_visible() and 'not reported' not in baseline_detail.inner_text().lower()
    page.locator('.method-toggle').click()
    assert_medals(page, next(s for s in suites if s['domain']=='iv'), 'rmse')
    assert page.locator('#leaderboard .rank-medal').get_attribute('aria-label') == 'Rank 2 (silver medal)'
    assert_overview(page, suites)
    page.locator('[data-fam="pfn"]').click()
    assert page.locator('#leaderboard tbody tr[data-method]').count() == 1
    assert page.locator('#leaderboard .mname').inner_text() == 'IV-PFN'
    assert_medals(page, next(s for s in suites if s['domain']=='iv'), 'rmse')
    assert page.locator('#leaderboard .rank-medal').get_attribute('aria-label') == 'Rank 1 (gold medal)'
    page.locator('.method-toggle').click()
    assert page.locator('.method-details-row').inner_text().find('v0.3') >= 0
    assert 'not reported' not in page.locator('.method-details-row').inner_text().lower()
    assert page.locator('.method-reference-link[href="https://huggingface.co/Brownight/tabpfn-iv-adapter-v0.3"]').count() == 1
    page.locator('[data-fam="all"]').click()
    page.locator('#q').fill('no-such-method')
    assert page.locator('.empty-cell').count() == 1
    page.locator('#q').fill('')
    with page.expect_download() as d:
        page.locator('#export-btn').click()
    d.value.save_as(OUT / 'iv-test.csv')
    with (OUT / 'iv-test.csv').open(encoding='utf-8', newline='') as f:
        exported = list(csv.DictReader(f))
    assert [[float(r[k]) for k in KEYS] for r in exported] == EXPECTED['iv']
    assert exported[1]['source_method'] == 'RF trim + bootstrap'
    page.locator('#theme-btn').click()
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    page.locator('#theme-btn').click()
    page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)

    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile.on('pageerror', lambda e: errors.append(str(e)))
    load(mobile, 'domain=iv')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    mobile.locator('#menu-btn').click()
    assert_navigation_groups(mobile)
    mobile.locator('[data-t="proximal"]').click()
    assert mobile.locator('#menu-btn').get_attribute('aria-expanded') == 'false'
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    mobile.wait_for_function('document.querySelector("#rmse-time-chart")?.dataset.domain==="proximal" && document.querySelector("#rmse-time-chart svg")')
    mobile.evaluate('async()=>{await document.fonts.ready}')
    for chart_id in ('rmse-time-chart', 'coverage-length-chart'):
        host = mobile.locator('#' + chart_id)
        assert_axis_labels_do_not_overlap(host)
        assert_guidance_inside_plot(host, chart_id, .95)
        point, tip = host.locator('.chart-point').first, host.locator('.chart-tooltip')
        point.tap()
        assert tip.is_visible() and point.get_attribute('aria-expanded') == 'true'
        assert_at_most_four_decimals(tip.inner_text())
        box, area = tip.bounding_box(), host.bounding_box()
        assert box['x'] >= area['x'] - 1 and box['x'] + box['width'] <= area['x'] + area['width'] + 1
        assert box['y'] >= area['y'] - 1 and box['y'] + box['height'] <= area['y'] + area['height'] + 1
        mobile.locator('#hero-title').tap()
        assert tip.is_hidden()
    mobile.locator('.method-toggle').first.click()
    assert mobile.locator('.method-details-row').count() == 1
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    mobile.screenshot(path=str(OUT / 'mobile.png'), full_page=True)

    # A 320px viewport was a known collision case: check every plotted method
    # on both charts in all six populated domains, using actual screen bounds.
    narrow = browser.new_page(viewport={'width': 320, 'height': 844})
    narrow.on('pageerror', lambda e: errors.append(str(e)))
    load(narrow)
    for domain in EXPECTED:
        if domain != 'ate':
            narrow.locator('#menu-btn').click()
            narrow.locator(f'[data-t="{domain}"]').click()
        for chart_id in ('rmse-time-chart', 'coverage-length-chart'):
            host = narrow.locator('#' + chart_id)
            narrow.wait_for_function('(a)=>{const h=document.getElementById(a.id);return h?.dataset.domain===a.domain && h.querySelector("svg .chart-guidance")}', arg={'id':chart_id,'domain':domain})
            assert_guidance_inside_plot(host, chart_id, .95)
            points = host.locator('.chart-point')
            for index in range(points.count()):
                point = points.nth(index)
                point.hover()
                tip = host.locator('.chart-tooltip')
                assert tip.is_visible(), (domain, chart_id, index)
                tooltip, area = tip.bounding_box(), host.bounding_box()
                assert tooltip and area
                assert tooltip['x'] >= area['x'] - 1 and tooltip['y'] >= area['y'] - 1
                assert tooltip['x'] + tooltip['width'] <= area['x'] + area['width'] + 1
                assert tooltip['y'] + tooltip['height'] <= area['y'] + area['height'] + 1
                for element in host.locator('svg .chart-guidance').all():
                    guide = element.bounding_box()
                    assert guide
                    ox = min(tooltip['x']+tooltip['width'],guide['x']+guide['width']) - max(tooltip['x'],guide['x'])
                    oy = min(tooltip['y']+tooltip['height'],guide['y']+guide['height']) - max(tooltip['y'],guide['y'])
                    assert not (ox > 1 and oy > 1), (domain, chart_id, index, tooltip, guide)
                narrow.mouse.move(0, 0)
                assert tip.is_hidden()

    assert not errors, errors
    assert page.evaluate('ArenaTestView.getSuites()') == suites
    assert SOURCE_HASHES == data_hashes()
    report = {'status': 'passed', 'commit': SHA, 'url': BASE, 'domains': 10,
              'populated_domains': 6, 'coming_soon_domains': sorted(COMING_SOON),
              'chart_axes': 'logarithmic', 'javascript_errors': errors, 'source_sha256': SOURCE_HASHES}
    (OUT / 'test-view-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    browser.close()
