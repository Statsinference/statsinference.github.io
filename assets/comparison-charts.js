"use strict";
/* Read the current Test view only. No new fetch, aggregation, or changes to leaderboard state. */
(() => {
  const section = document.getElementById('methodology');
  const table = document.getElementById('leaderboard-wrap');
  if (!section || !table || typeof visibleRows !== 'function') return;
  const NS = 'http://www.w3.org/2000/svg';
  const charts = [
    {id:'rmse-time-chart', x:'time_s', y:'rmse', xLabel:'Time (s, log scale)', yLabel:'RMSE (log scale)', xDetail:'Time', yDetail:'RMSE', title:'RMSE vs Time'},
    {id:'coverage-length-chart', x:'length', y:'coverage', xLabel:'Mean interval length (log scale)', yLabel:'Coverage (%, log scale)', xDetail:'Mean interval length', yDetail:'Coverage', title:'Coverage vs Mean Interval Length'}
  ];
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const familyClass = row => ['pfn','classical'].includes(row.family) ? row.family : 'other';
  const methodName = row => row.family === 'classical' ? 'Baseline' : row.method;
  let activeTip = null;
  function closeTip() {
    if (!activeTip) return;
    activeTip.tooltip.hidden = true;
    activeTip.point.setAttribute('aria-expanded', 'false');
    activeTip = null;
  }
  function formatNumber(value) {
    const magnitude = Math.abs(value);
    if (magnitude !== 0 && (magnitude < 0.0001 || magnitude >= 10000000)) {
      return value.toExponential(3).replace(/(\.\d*?[1-9])0+e/, '$1e').replace(/\.0+e/, 'e');
    }
    return String(Number(value.toFixed(4)));
  }
  function detailValue(row, key, suite) {
    const value = key === 'coverage' ? Number((row[key] * 100).toPrecision(12)) : row[key];
    const display = formatNumber(value);
    const wasRounded = Math.abs(Number(display) - value) > Math.max(1e-12, Math.abs(value) * 1e-12);
    const approximate = row.approximate_metrics?.includes(key) || wasRounded ? '≈' : '';
    const unit = key === 'coverage' ? '%' : key === 'time_s' ? ' s' : suite.metric_scale === 'normalized' ? ' (normalized by outcome SD)' : suite.metric_scale === 'original' ? ' (original units)' : '';
    return approximate + display + unit;
  }
  function showTip(host, tooltip, point, cx, cy, pinned = false) {
    if (activeTip && activeTip.point !== point) closeTip();
    activeTip = {host, tooltip, point, pinned};
    tooltip.hidden = false;
    point.setAttribute('aria-expanded', 'true');
    // Keep the card inside the chart at both narrow and wide screen widths.
    const available = host.clientWidth;
    const maxLeft = Math.max(4, available - tooltip.offsetWidth - 4);
    const idealLeft = Math.max(4, Math.min(cx - tooltip.offsetWidth/2, maxLeft));
    const above = cy - tooltip.offsetHeight - 12;
    const below = cy + 12;
    const maxTop = Math.max(4, (host.clientHeight || 310) - tooltip.offsetHeight - 4);
    const clampY = v => Math.max(4, Math.min(v, maxTop));
    const positions = [idealLeft, 4, maxLeft].flatMap(left => [above, below, maxTop].map(top => ({left, top:clampY(top)})));
    const bounds = host._guidanceBounds;
    const intersects = p => bounds && p.left < bounds.right + 4 && p.left + tooltip.offsetWidth > bounds.left - 4 && p.top < bounds.bottom + 4 && p.top + tooltip.offsetHeight > bounds.top - 4;
    const chosen = positions.find(p => !intersects(p)) || positions[0];
    const {left, top} = chosen;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  // Pick an in-plot area away from every marker and the nominal-coverage line.
  function drawGuidance(svg, host, box, plotW, plotH, positions, nominalY, nominal, width) {
    let w = Math.min(148, Math.max(96, plotW - 12));
    let h = 42;
    const candidatesFor = (w, h) => {
      const candidates = [];
      for (let iy = 0; iy <= 10; iy++) {
        for (let ix = 10; ix >= 0; ix--) {
          const x = box.left + 4 + Math.max(0, plotW - w - 8) * ix / 10;
          const y = box.top + 4 + Math.max(0, plotH - h - 8) * iy / 10;
          const collidesPoint = positions.some(p => p.x >= x - 10 && p.x <= x + w + 10 && p.y >= y - 10 && p.y <= y + h + 10);
          const collidesTarget = nominalY != null && nominalY >= y - 4 && nominalY <= y + h + 4;
          const distance = Math.min(...positions.map(p => Math.hypot(p.x - (x + w/2), p.y - (y + h/2))));
          candidates.push({x,y,collidesPoint,collidesTarget,distance});
        }
      }
      return candidates;
    };
    let candidates = candidatesFor(w, h);
    let valid = candidates.filter(p => !p.collidesPoint && !p.collidesTarget);
    let compact = false;
    if (!valid.length && w > 96) {
      w = 96; h = 38; compact = true;
      candidates = candidatesFor(w, h);
      valid = candidates.filter(p => !p.collidesPoint && !p.collidesTarget);
    }
    // On unusually dense plots retain the reference line and minimize marker
    // overlap; data markers are rendered after this soft background.
    const pool = valid.length ? valid : candidates.filter(p => !p.collidesTarget);
    const place = (pool.length ? pool : candidates).sort((a,b) => Number(a.collidesPoint)-Number(b.collidesPoint) || b.distance-a.distance)[0];
    const group = svgElement('g', {class:'chart-guidance' + (compact ? ' compact' : ''), 'data-x':place.x, 'data-y':place.y, 'data-width':w, 'data-height':h, 'aria-hidden':'true'});
    group.append(svgElement('rect', {x:place.x,y:place.y,width:w,height:h,rx:6,class:'chart-guidance-background'}));
    // One horizontal and one vertical arrow make the two directions explicit.
    const ax = place.x + 8, ay = place.y + 12;
    group.append(svgElement('path', {d:`M ${ax+12} ${ay} H ${ax} M ${ax+4} ${ay-4} L ${ax} ${ay} L ${ax+4} ${ay+4}`,class:'chart-guidance-arrow'}));
    group.append(svgElement('text', {x:place.x+25,y:place.y+15,class:'chart-guidance-text'}, nominalY == null ? 'Shorter time' : 'Shorter interval'));
    const bx = place.x + 14, by = place.y + 30;
    const up = nominalY != null && place.y > nominalY;
    const dy = up ? -1 : 1;
    group.append(svgElement('path', {d:`M ${bx} ${by-5*dy} V ${by+5*dy} M ${bx-4} ${by+1*dy} L ${bx} ${by+5*dy} L ${bx+4} ${by+1*dy}`,class:'chart-guidance-arrow'}));
    group.append(svgElement('text', {x:place.x+25,y:place.y+34,class:'chart-guidance-text'}, nominalY == null ? 'Lower RMSE' : `Toward ${formatNumber(nominal)}%`));
    svg.append(group);
    const scale = host.clientWidth / width;
    host._guidanceBounds = {left:place.x*scale,top:place.y*scale,right:(place.x+w)*scale,bottom:(place.y+h)*scale};
  }
  document.addEventListener('pointerdown', event => {
    if (activeTip && !activeTip.point.contains(event.target)) closeTip();
  });
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeTip();
  });
  function svgElement(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  // Positive values only: spacing is proportional to log10(value), not value.
  // Include any positive reference value, then add modest breathing room.
  function logAxis(values, upperLimit = Infinity) {
    const logs = values.map(Math.log10);
    const low = Math.min(...logs), high = Math.max(...logs);
    const padding = Math.max((high-low)*0.12, 0.035);
    let min = Math.max(low-padding, Math.log10(Number.MIN_VALUE));
    let max = Math.min(high+padding, Math.log10(Math.min(upperLimit, Number.MAX_VALUE)));
    if (!(max > min)) min = max - 0.07;
    const ticks = Array.from({length:5}, (_,i) => 10 ** (min + (max-min)*i/4));
    return {min,max,ticks};
  }
  function tick(value) {
    return formatNumber(value);
  }
  function renderChart(config) {
    const host = document.getElementById(config.id);
    if (!host) return;
    const suite = current();
    const candidates = visibleRows();
    const usable = row => numeric(row[config.x]) && numeric(row[config.y]) && (config.y !== 'coverage' || row.coverage <= 1);
    const rows = candidates.filter(row => usable(row) && row[config.x] > 0 && row[config.y] > 0);
    const nonpositive = candidates.filter(row => usable(row) && (row[config.x] <= 0 || row[config.y] <= 0)).length;
    const unavailable = candidates.length - rows.length - nonpositive;
    if (activeTip?.host === host) closeTip();
    host._guidanceBounds = null;
    host.replaceChildren();
    host.dataset.domain = suite?.domain || task;
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'chart-empty';
      empty.textContent = loadError ? 'Results unavailable' : !loaded ? 'Loading results…' : !suite ? 'Results not yet published' : !candidates.length ? 'No methods match the filters.' : nonpositive ? 'No positive values available for a logarithmic chart.' : 'Results not available for this chart.';
      host.append(empty);
      if (nonpositive || unavailable) {
        const note = document.createElement('p');
        note.className = 'chart-note';
        note.textContent = `${nonpositive} nonpositive and ${unavailable} missing or invalid result(s) omitted.`;
        host.append(note);
      }
      return;
    }
    const width = Math.max(240, Math.round(host.getBoundingClientRect().width));
    const height = 270;
    const xAxis = logAxis(rows.map(row => row[config.x]));
    const yValue = row => config.y === 'coverage' ? row.coverage * 100 : row[config.y];
    const nominal = config.y === 'coverage' && numeric(suite.nominal_coverage) && suite.nominal_coverage > 0 && suite.nominal_coverage <= 1 ? suite.nominal_coverage * 100 : config.y === 'coverage' ? 95 : null;
    const yAxis = logAxis([...rows.map(yValue), ...(nominal ? [nominal] : [])], config.y === 'coverage' ? 100 : Infinity);
    // Reserve space using the widest formatted tick, so numbers never run
    // into the rotated y-axis title, including scientific notation.
    const maxTickChars = Math.max(...yAxis.ticks.map(value => tick(value).length));
    const box = {left:Math.max(78, Math.ceil(40 + maxTickChars * 6.5)), right:18, top:24, bottom:48};
    const plotW = width - box.left - box.right;
    const plotH = height - box.top - box.bottom;
    const x = value => box.left + (Math.log10(value) - xAxis.min) / (xAxis.max-xAxis.min) * plotW;
    const y = value => box.top + (1 - (Math.log10(value) - yAxis.min) / (yAxis.max-yAxis.min)) * plotH;
    const svg = svgElement('svg', {viewBox:`0 0 ${width} ${height}`, role:'group', 'aria-labelledby':config.id+'-title', 'aria-describedby':config.id+'-desc', 'data-domain':suite.domain, 'data-plot-left':box.left, 'data-plot-top':box.top, 'data-plot-width':plotW, 'data-plot-height':plotH});
    svg.append(svgElement('title', {id:config.id+'-title'}, config.title));
    const guidanceDescription = config.y === 'coverage' ? `Shorter intervals are preferred, and coverage should be closer to ${formatNumber(nominal)} percent.` : 'Shorter time and lower RMSE are preferred.';
    svg.append(svgElement('desc', {id:config.id+'-desc'}, `${document.getElementById('hero-title').textContent}. Results for ${rows.map(methodName).join(' and ')}. Both axes use a logarithmic scale. ${guidanceDescription}`));
    for (const value of yAxis.ticks) {
      svg.append(svgElement('line',{x1:box.left,y1:y(value),x2:width-box.right,y2:y(value),class:'chart-grid'}));
      svg.append(svgElement('text',{x:box.left-10,y:y(value)+3.5,'text-anchor':'end',class:'chart-tick'},tick(value)));
    }
    for (const value of xAxis.ticks) {
      svg.append(svgElement('line',{x1:x(value),y1:height-box.bottom,x2:x(value),y2:height-box.bottom+5,class:'chart-axis'}));
      svg.append(svgElement('text',{x:x(value),y:height-box.bottom+20,'text-anchor':'middle',class:'chart-tick'},tick(value)));
    }
    svg.append(svgElement('path',{d:`M ${box.left} ${box.top} V ${height-box.bottom} H ${width-box.right}`,fill:'none',class:'chart-axis'}));
    svg.append(svgElement('text',{x:box.left+plotW/2,y:height-8,'text-anchor':'middle',class:'chart-axis-title'},config.xLabel));
    svg.append(svgElement('text',{transform:`translate(12 ${box.top+plotH/2}) rotate(-90)`,'text-anchor':'middle',class:'chart-axis-title'},config.yLabel));
    if (config.y === 'coverage') {
      if (nominal > 0 && nominal <= 100) {
        svg.append(svgElement('line',{x1:box.left,y1:y(nominal),x2:width-box.right,y2:y(nominal),class:'chart-reference','data-value':nominal}));
        svg.append(svgElement('text',{x:width-box.right,y:y(nominal)-6,'text-anchor':'end',class:'chart-reference-label'},tick(nominal)+'%'));
      }
    }
    drawGuidance(svg, host, box, plotW, plotH,
      rows.map(row => ({x:x(row[config.x]), y:y(yValue(row))})),
      nominal == null ? null : y(nominal), nominal, width);
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    const tooltip = document.createElement('div');
    tooltip.id = config.id + '-tooltip';
    tooltip.className = 'chart-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    for (const row of rows) {
      const cx = x(row[config.x]), cy = y(yValue(row));
      const label = `${methodName(row)}${row.configuration ? ', '+row.configuration : ''}. ${config.xDetail}: ${detailValue(row,config.x,suite)}. ${config.yDetail}: ${detailValue(row,config.y,suite)}.`;
      const point = svgElement('g',{class:'chart-point '+familyClass(row),tabindex:0,role:'button','aria-label':label,'aria-controls':tooltip.id,'aria-expanded':'false','data-method':methodName(row),'data-x':row[config.x],'data-y':yValue(row),transform:`translate(${cx} ${cy})`});
      function populateTooltip() {
        const title = document.createElement('strong');
        title.className = 'chart-tooltip-title'; title.textContent = methodName(row);
        const description = document.createElement('div');
        description.className = 'chart-tooltip-configuration'; description.textContent = row.configuration || '';
        const xline = document.createElement('div');
        xline.className = 'chart-tooltip-row'; xline.textContent = `${config.xDetail}: ${detailValue(row,config.x,suite)}`;
        const yline = document.createElement('div');
        yline.className = 'chart-tooltip-row'; yline.textContent = `${config.yDetail}: ${detailValue(row,config.y,suite)}`;
        tooltip.replaceChildren(...(row.configuration ? [title, description, xline, yline] : [title, xline, yline]));
      }
      function show(pinned = false) {
        populateTooltip();
        const scale = host.clientWidth / width;
        showTip(host, tooltip, point, cx * scale, cy * scale, pinned);
      }
      function toggle() {
        if (activeTip?.point === point && activeTip.pinned) closeTip();
        else show(true);
      }
      point.addEventListener('pointerenter', () => show(activeTip?.point === point && activeTip.pinned));
      point.addEventListener('pointerleave', () => {
        if (activeTip?.point === point && !activeTip.pinned && document.activeElement !== point) closeTip();
      });
      point.addEventListener('focus', () => show(activeTip?.point === point && activeTip.pinned));
      point.addEventListener('blur', () => { if (activeTip?.point === point && !activeTip.pinned) closeTip(); });
      point.addEventListener('click', toggle);
      point.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
      });
      point.append(svgElement('circle',{r:9,class:'chart-focus-ring'}));
      point.append(row.family === 'classical' ? svgElement('path',{d:'M 0 -6 L 6 0 L 0 6 L -6 0 Z',class:'chart-marker'}) : svgElement('circle',{r:5.5,class:'chart-marker'}));
      svg.append(point);
      const item = document.createElement('span');item.className='chart-legend-item';
      const marker = document.createElement('i');marker.className='chart-legend-marker '+familyClass(row);marker.setAttribute('aria-hidden','true');
      item.append(marker,document.createTextNode(methodName(row)));legend.append(item);
    }
    host.append(svg,legend,tooltip);
    if (nonpositive || unavailable) {
      const note = document.createElement('p');
      note.className = 'chart-note';
      note.textContent = `${nonpositive} nonpositive and ${unavailable} missing or invalid result(s) omitted.`;
      host.append(note);
    }
  }
  let frame = 0;
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame=0;charts.forEach(renderChart); });
  }
  // Existing render calls replace the table on data load, domain selection, filters and sorting.
  new MutationObserver(schedule).observe(table,{childList:true});
  if (typeof ResizeObserver === 'function') {
    let lastWidth=0;
    new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;schedule();}}).observe(section);
  } else window.addEventListener('resize',schedule);
  schedule();
})();

