"use strict";
/* Read the current Test view only. No new fetch, aggregation, or changes to leaderboard state. */
(() => {
  const section = document.getElementById('methodology');
  const table = document.getElementById('leaderboard-wrap');
  if (!section || !table || typeof visibleRows !== 'function') return;
  const NS = 'http://www.w3.org/2000/svg';
  const charts = [
    {id:'rmse-time-chart', x:'time_s', y:'rmse', xLabel:'Time (s, log scale)', yLabel:'RMSE (log scale)', title:'RMSE vs Time'},
    {id:'coverage-length-chart', x:'length', y:'coverage', xLabel:'Mean interval length (log scale)', yLabel:'Coverage (%, log scale)', title:'Coverage vs Mean Interval Length'}
  ];
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const familyClass = row => ['pfn','classical'].includes(row.family) ? row.family : 'other';
  const methodName = row => row.family === 'classical' ? 'Baseline' : row.method;
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
    if (value === 0) return '0';
    if (Math.abs(value) >= 10000 || Math.abs(value) < .001) return value.toExponential(1);
    return Number(value.toPrecision(5)).toString();
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
    const box = {left:57, right:18, top:24, bottom:48};
    const plotW = width - box.left - box.right;
    const plotH = height - box.top - box.bottom;
    const xAxis = logAxis(rows.map(row => row[config.x]));
    const yValue = row => config.y === 'coverage' ? row.coverage * 100 : row[config.y];
    const nominal = config.y === 'coverage' && numeric(suite.nominal_coverage) && suite.nominal_coverage > 0 && suite.nominal_coverage <= 1 ? suite.nominal_coverage * 100 : config.y === 'coverage' ? 95 : null;
    const yAxis = logAxis([...rows.map(yValue), ...(nominal ? [nominal] : [])], config.y === 'coverage' ? 100 : Infinity);
    const x = value => box.left + (Math.log10(value) - xAxis.min) / (xAxis.max-xAxis.min) * plotW;
    const y = value => box.top + (1 - (Math.log10(value) - yAxis.min) / (yAxis.max-yAxis.min)) * plotH;
    const svg = svgElement('svg', {viewBox:`0 0 ${width} ${height}`, role:'group', 'aria-labelledby':config.id+'-title', 'aria-describedby':config.id+'-desc', 'data-domain':suite.domain});
    svg.append(svgElement('title', {id:config.id+'-title'}, config.title));
    svg.append(svgElement('desc', {id:config.id+'-desc'}, `${document.getElementById('hero-title').textContent}. Results for ${rows.map(methodName).join(' and ')}. Both axes use a logarithmic scale.`));
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
    svg.append(svgElement('text',{transform:`translate(14 ${box.top+plotH/2}) rotate(-90)`,'text-anchor':'middle',class:'chart-axis-title'},config.yLabel));
    if (config.y === 'coverage') {
      if (nominal > 0 && nominal <= 100) {
        svg.append(svgElement('line',{x1:box.left,y1:y(nominal),x2:width-box.right,y2:y(nominal),class:'chart-reference','data-value':nominal}));
        svg.append(svgElement('text',{x:width-box.right,y:y(nominal)-6,'text-anchor':'end',class:'chart-reference-label'},tick(nominal)+'%'));
      }
    }
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    for (const row of rows) {
      const cx = x(row[config.x]), cy = y(yValue(row));
      const label = `${methodName(row)} — ${config.xLabel}: ${formatMetric(row,config.x)}; ${config.yLabel}: ${formatMetric(row,config.y)}`;
      const point = svgElement('g',{class:'chart-point '+familyClass(row),tabindex:0,role:'img','aria-label':label,'data-method':methodName(row),'data-x':row[config.x],'data-y':yValue(row),transform:`translate(${cx} ${cy})`});
      point.append(svgElement('title',{},label));
      point.append(svgElement('circle',{r:9,class:'chart-focus-ring'}));
      point.append(row.family === 'classical' ? svgElement('path',{d:'M 0 -6 L 6 0 L 0 6 L -6 0 Z',class:'chart-marker'}) : svgElement('circle',{r:5.5,class:'chart-marker'}));
      svg.append(point);
      const item = document.createElement('span');item.className='chart-legend-item';
      const marker = document.createElement('i');marker.className='chart-legend-marker '+familyClass(row);marker.setAttribute('aria-hidden','true');
      item.append(marker,document.createTextNode(methodName(row)));legend.append(item);
    }
    host.append(svg,legend);
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

