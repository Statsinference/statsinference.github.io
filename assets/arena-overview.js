'use strict';
// Distinct display labels are deduplicated across the first displayed suite in
// each area. Baseline is one display name, even when its implementation varies.
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
      for (const key of ['displayed-methods', 'metrics']) set(key, '—');
      return;
    }
    const metrics = Array.isArray(api.metrics) ? api.metrics : [];
    const firstByDomain = new Map();
    for (const suite of api.getSuites()) {
      if (!firstByDomain.has(suite.domain)) firstByDomain.set(suite.domain, suite);
    }
    const names = new Set();
    for (const suite of firstByDomain.values()) {
      for (const row of suite.rows || []) {
        if (!metrics.some(key => typeof row[key] === 'number' && Number.isFinite(row[key]))) continue;
        const label = row.family === 'classical' ? 'Baseline' : String(row.method || '').replace(/\s+S[0-9]+$/i, '').trim();
        if (label) names.add(label.replace(/\s+/g, ' ').toLowerCase());
      }
    }
    set('displayed-methods', names.size);
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
