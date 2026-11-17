'use strict';
// These are reviewed estimand types of the current published evaluation suites.
// CATE occurs in two areas. IV LATE is confirmed by the project owner; the
// original IV result file does not itself specify the target.
(function () {
  const host = document.getElementById('arena-overview-stats');
  if (!host) return;
  const set = (key, value) => {
    const node = host.querySelector('[data-overview-stat="' + key + '"]');
    if (node) node.textContent = String(value);
  };
  const update = () => {
    const api = window.ArenaTestView;
    set('domains', document.querySelectorAll('#tabs [data-t]').length || '—');
    if (!api || document.body.dataset.testView !== 'ready') return;
    const error = document.getElementById('release-description');
    if (error && !error.hidden) {
      for (const key of ['estimand-types', 'metrics']) set(key, '—');
      return;
    }
    const metrics = Array.isArray(api.metrics) ? api.metrics : [];
    const firstByDomain = new Map();
    for (const suite of api.getSuites()) {
      if (!firstByDomain.has(suite.domain)) firstByDomain.set(suite.domain, suite);
    }
    // Only specifically reviewed suite/domain combinations are included;
    // future suites are not assigned an estimand by a name-based guess.
    const reviewed = {
      ate: {'ate-fixed-collection-report': 'ATE'},
      cate: {'cate-fixed-collection-report': 'CATE'},
      mediation: {'mediation-fivefold-2026-11-16': 'NIE1'},
      iv: {'iv-v03-test': 'LATE'},
      proximal: {'proximal-unified-2026-11-16-normalized': 'CATE'},
      did_sc: {'did-test-2026-11-16': 'ATT'}
    };
    const estimands = new Set();
    for (const suite of firstByDomain.values()) {
      const key = reviewed[suite.domain]?.[suite.id];
      if (!key) continue;
      const reported = (suite.rows || []).some(row =>
        metrics.some(metric => typeof row[metric] === 'number' && Number.isFinite(row[metric]))
      );
      if (reported) estimands.add(key);
    }
    set('estimand-types', estimands.size);
    set('metrics', metrics.length);
  };
  const observer = new MutationObserver(update);
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-test-view'] });
  update();

  // Public, aggregate-only snapshot; the private registry is never fetched
  // from the client. Keep the date visible; no automatic freshness is assumed.
  fetch('data/dgp-overview.json', { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Registry summary unavailable');
      return response.json();
    })
    .then(summary => {
      if (summary.schema_version !== 1 || !Number.isSafeInteger(summary.registered_dgps) || summary.registered_dgps < 0 ||
          typeof summary.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(summary.as_of)) {
        throw new Error('Invalid registry summary');
      }
      set('registered-dgps', summary.registered_dgps);
      const label = host.querySelector('[data-dgp-snapshot]');
      if (label) label.textContent = 'Catalog records, pending review · as of ' + summary.as_of;
    })
    .catch(() => {
      set('registered-dgps', '—');
      const label = host.querySelector('[data-dgp-snapshot]');
      if (label) label.textContent = 'Catalog snapshot unavailable';
    });
})();
