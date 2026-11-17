'use strict';
// Counts use the first displayed suite for each area, matching the leaderboard.
// These are per-area method entries, not distinct models or datasets.
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
      for (const key of ['active-domains', 'method-entries', 'metrics']) set(key, '—');
      return;
    }
    const metrics = Array.isArray(api.metrics) ? api.metrics : [];
    const firstByDomain = new Map();
    for (const suite of api.getSuites()) {
      if (!firstByDomain.has(suite.domain)) firstByDomain.set(suite.domain, suite);
    }
    let active = 0, entries = 0;
    for (const suite of firstByDomain.values()) {
      const reported = (suite.rows || []).filter(row =>
        metrics.some(key => typeof row[key] === 'number' && Number.isFinite(row[key]))
      );
      if (reported.length) active++;
      entries += reported.length;
    }
    set('active-domains', active);
    set('method-entries', entries);
    set('metrics', metrics.length);
  };
  const observer = new MutationObserver(update);
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-test-view'] });
  update();
})();
