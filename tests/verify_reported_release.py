"""Verify six source-reported domains and deployed UI; never execute DGPs."""
from pathlib import Path
import json
import os
import time
import urllib.request
from playwright.sync_api import sync_playwright

out = Path('verification'); out.mkdir(exist_ok=True)
expected = json.loads(Path('data/results.json').read_text())
html = Path('index.html').read_text()
assert 'Core Contributors' not in html and 'id="contributors"' not in html
assert expected['release_id'] == 'six-domains-2026-11-15'
by = {s['domain']: s for s in expected['suites']}
assert set(by) == {'ate','cate','mediation','iv','proximal','did_sc'}
assert sum(len(s['rows']) for s in by.values()) == 32
assert len(by['mediation']['dgp_results']) == 13
assert by['mediation']['timing_comparisons'][0]['scope'] == 'previous_model_and_test_set'
for s in by.values():
    for r in s['rows']:
        if r.get('variance_is_approximate'):
            assert abs(r['variance'] - r['reported_se']**2) < 1e-10
        if r.get('status') == 'not_reported':
            assert all(r[k] is None for k in ['bias','variance','rmse','length','coverage','time_s'])
iv = {(r['group'],r['method']): r for r in by['iv']['rows']}
assert [iv[('OOD','RF')][k] for k in ['bias','variance','rmse','length','coverage','time_s']] == [-6.12,150000,382,240000,0.602,8.27]
assert by['proximal']['normalized'] is True
assert all(r['variance'] is None and r['time_s'] is None for r in by['proximal']['rows'] if r['group']=='OOD')
assert len(by['proximal']['dgp_results']) == 8 and len(by['proximal']['raw_dgp_results']) == 8
assert by['did_sc']['variance_kind'] == 'cross_task_error'
assert by['ate']['variance_kind'] == 'within_mechanism_sampling'
base = 'https://statsinference.github.io/'
for attempt in range(36):
    try:
        token = f"{os.environ.get('GITHUB_SHA','')}-{attempt}"
        req = urllib.request.Request(base + '?verify=' + token, headers={'Cache-Control':'no-cache'})
        live_html = urllib.request.urlopen(req,timeout=15).read().decode()
        req = urllib.request.Request(base + 'data/results.json?verify=' + token, headers={'Cache-Control':'no-cache'})
        live_data = json.load(urllib.request.urlopen(req,timeout=15))
        if 'Core Contributors' not in live_html and live_data == expected:
            break
    except Exception:
        pass
    time.sleep(5)
else:
    raise AssertionError('The expected release did not become publicly available')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width':1440,'height':1100})
    errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
    response = page.goto(base+'?verify='+token,wait_until='networkidle',timeout=60000)
    assert response.status == 200
    assert page.title() == 'Statistical Inference Arena'
    assert page.locator('#contributors').count() == 0
    assert page.locator('#tabs [data-t]').count() == 10
    assert json.loads(page.evaluate('JSON.stringify(DATA)')) == expected
    for domain,count in [('mediation',4),('ate',4),('cate',4),('iv',6),('proximal',4),('did_sc',10)]:
        page.locator(f'[data-t="{domain}"]').click()
        assert page.locator('#tbody tr').count() == count, domain
        table = page.locator('#tbody').inner_text()
        if domain == 'mediation':
            assert '95.39%' in table and '97.90%' in table
            assert page.locator('.timing-table tbody tr').count() == 3
            assert '182.175' not in table
        if domain == 'iv':
            for text in ['−6.12','1.5×10⁵','382','2.4×10⁵','60.2%']:
                assert text in table, text
        if domain == 'ate':
            assert '76.83%' in table and '78.61%' in table
        if domain == 'cate':
            assert '6.4158' in table and '3.9290' in table
        if domain == 'proximal':
            assert 'Norm. Variance' in page.locator('#thead').inner_text()
            assert 'NORMALIZED' in page.locator('#table-note').inner_text()
        if domain == 'did_sc':
            assert '0.0475' in table and 'PS/OR-DR S2' in table
        page.locator('#table').screenshot(path=str(out/(domain+'-table.png')))
    for domain in ['nonparametric_regression','quantile','semi_supervised','missing_data']:
        page.locator(f'[data-t="{domain}"]').click()
        assert page.locator('#tbody .row-reported').count() == 0
        assert page.locator('#report-details').is_hidden()
    page.locator('[data-t="iv"]').click()
    page.locator('[data-split="ID"]').click(); assert page.locator('#tbody tr').count() == 3
    page.locator('[data-fam="classical"]').click(); assert page.locator('#tbody tr').count() == 2
    page.locator('[data-split="both"]').click(); assert page.locator('#tbody tr').count() == 4
    page.locator('[data-fam="all"]').click(); page.locator('#q').fill('trim'); assert page.locator('#tbody tr').count() == 2
    page.locator('#q').fill(''); page.locator('[data-sort="bias"]').click()
    with page.expect_download() as info:
        page.locator('#export-btn').click()
    csv = Path(info.value.path()).read_text()
    assert 'variance_kind' in csv and '150000' in csv and 'timing_scope' in csv
    mobile = browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.goto(base+'?verify='+token,wait_until='networkidle',timeout=60000)
    mobile.locator('#menu-btn').click(); mobile.locator('[data-t="iv"]').click()
    assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth')
    mobile.screenshot(path=str(out/'mobile.png'),full_page=True)
    assert not errors, errors
    report={'status':'passed','url':base,'commit':os.environ.get('GITHUB_SHA'),'published_domains':6,'summary_rows':32,'contributors_removed':True,'javascript_errors':errors,'source_metrics_checked':True,'mobile_overflow':False,'csv_protocol_metadata':True}
    (out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
    browser.close()
