'use strict';
// Minimal DOM harness verifies chart mathematics and exclusions without a
// browser or modifying source files. The separate browser test covers layout.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Element {
  constructor(tag='div') {
    this.tag=tag; this.children=[]; this.dataset={}; this.attrs={};
    this.textContent=''; this.className='';
  }
  setAttribute(k,v) { this.attrs[k]=String(v); }
  append(...xs) { this.children.push(...xs); }
  replaceChildren(...xs) { this.children=xs; }
  getBoundingClientRect() { return {width:600}; }
}

function draw(rows) {
  const hosts = Object.fromEntries(
    ['methodology','leaderboard-wrap','rmse-time-chart','coverage-length-chart','hero-title']
      .map(id=>[id,new Element()]));
  hosts['hero-title'].textContent='ATE';
  const ctx = {
    document: {
      getElementById:id=>hosts[id], createElementNS:(_,t)=>new Element(t),
      createElement:t=>new Element(t), createTextNode:t=>({textContent:t})
    },
    visibleRows:()=>rows, current:()=>({domain:'ate',nominal_coverage:.95}),
    task:'ate', loadError:'', loaded:true, formatMetric:(r,k)=>String(r[k]),
    MutationObserver:class { observe() {} },
    requestAnimationFrame:fn=>{fn();return 1;},
    window:{addEventListener(){}}
  };
  vm.runInNewContext(fs.readFileSync('assets/comparison-charts.js','utf8'),ctx);
  return hosts;
}

const inputs = [
  {method:'One',family:'pfn',time_s:1,rmse:.1,length:.1,coverage:.9},
  {method:'Ten',family:'pfn',time_s:10,rmse:1,length:1,coverage:.95},
  {method:'Hundred',family:'classical',time_s:100,rmse:10,length:10,coverage:1},
  {method:'Zero',family:'pfn',time_s:0,rmse:1,length:1,coverage:0},
  {method:'Missing',family:'pfn',time_s:null,rmse:1,length:null,coverage:.9}
];
const hosts = draw(inputs);
const plot = hosts['rmse-time-chart'].children[0];
const points = plot.children.filter(x=>x.attrs.class?.startsWith('chart-point'));
assert.equal(points.length,3);
const coordinates = points.map(p=>p.attrs.transform.match(/translate\(([-.\d]+) ([-.\d]+)\)/).slice(1).map(Number));
for (const axis of [0,1]) {
  const [a,b,c] = coordinates.map(p=>p[axis]);
  assert(Math.abs((b-a)-(c-b)) < 1e-8, 'each decade must have equal spacing');
}
assert(hosts['rmse-time-chart'].children.some(x=>x.className==='chart-note' && x.textContent.includes('1 nonpositive and 1 missing')));
const coverage = hosts['coverage-length-chart'].children[0];
assert(coverage.children.some(x=>x.attrs['data-value']==='95'), '95% nominal reference retained');
assert(coverage.children.some(x=>x.tag==='desc' && x.textContent.includes('logarithmic')));
assert(coverage.children.some(x=>x.tag==='text' && x.textContent.includes('Mean interval length')));
const empty = draw([{method:'Zero',family:'pfn',time_s:0,rmse:1,length:0,coverage:0}]);
assert(empty['rmse-time-chart'].children.some(x=>x.className==='chart-empty' && x.textContent.includes('No positive values')));
assert(empty['coverage-length-chart'].children.some(x=>x.className==='chart-empty' && x.textContent.includes('No positive values')));
console.log('Log axes, omitted data, coverage reference, labels and empty state: OK');
