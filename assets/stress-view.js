'use strict';
// Independent exploratory suite: never merge or re-rank the official Test results.
(function(){
 const host=document.getElementById('stress-view');
 const nav=document.getElementById('benchmark-views');
 if(!host||!nav)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const suites=()=>window.ArenaTestView?.getSuites()||[];
 const numeric=value=>typeof value==='number'&&Number.isFinite(value);
 const num=value=>numeric(value)?(value<0?'−':'')+Math.abs(value).toFixed(4):'—';
 const coverage=metric=>metric&&numeric(metric.coverage)&&Number.isInteger(metric.hits)&&Number.isInteger(metric.n)?`${(100*metric.coverage).toFixed(1)}% <span class="stress-count">(${metric.hits}/${metric.n})</span>`:'—';
 const td=(metric,key)=>key==='coverage'?coverage(metric):num(metric?.[key]);
 let domain='ate', suiteId=null, rows=[], data=null, error=false, pending=true;
 let selected='test', selectedMechanism='reference', expanded=null, openCase=null;
 const allowedSources={'MediPFN':'medipfn','Linear':'linear','RF + bootstrap':'random-forest','XGB-TD':'xgboost','CatBoost-TD':'catboost'};
 function identity(row){
  // Only exact suite/source identities are mapped. Reviewed submissions are separate methods.
  if(domain!=='mediation'||suiteId!=='mediation-fivefold-2026-11-16'||row.status==='reviewed')return null;
  return allowedSources[row.source_method]||null;
 }
 function name(row){
  if(row.method==='Linear')return 'Regularized Linear';
  if(row.method==='XGB-TD')return 'XGBoost';
  if(row.method==='CatBoost-TD')return 'CatBoost';
  return row.method;
 }
 function render(){
  const active=selected==='stress';
  for(const b of nav.querySelectorAll('[data-benchmark-view]')){
   const on=b.dataset.benchmarkView===selected;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
  }
  host.hidden=!active;
  if(active){
   document.getElementById('table').hidden=true;
   document.querySelector('.test-controls').hidden=true;
   document.getElementById('methodology').hidden=true;
   document.getElementById('coming-soon').hidden=true;
  }
  if(!active)return;
  const title=domain==='mediation'?'Mediation stress test':'Stress test';
  let description='No stress-test results have been reported for this domain.';
  if(domain==='mediation'&&pending)description='Loading stress-test results…';
  else if(domain==='mediation'&&error)description='Stress-test results are temporarily unavailable.';
  else if(domain==='mediation'&&data)description=data.suite.note;
  const extra=domain==='mediation'&&data?`<p>${esc(data.suite.summaryNote)}</p><p>Nominal coverage: 95%. Coverage and interval length should be read together. This stress suite is separate from the official leaderboard.</p>`:'';
  const body=rows.length?rows.map((row,index)=>{
   const id=identity(row),metric=data&&id?data.summary[id]:null;
   const open=metric&&expanded===id;
   const method=metric?`<button class="stress-method-button" data-stress-method="${esc(id)}" aria-expanded="${open}">${esc(name(row))}<span aria-hidden="true">${open?'⌃':'⌄'}</span></button>`:esc(name(row));
   const detail=open?methodDetail(id):'';
   return `<tr><th scope="row">${method}</th><td>${td(metric,'bias')}</td><td>${td(metric,'rmse')}</td><td>${td(metric,'coverage')}</td><td>${td(metric,'meanCiLength')}</td><td>${metric?esc(metric.n):'—'}</td></tr>${detail}`;
  }).join(''):'<tr><td class="stress-empty" colspan="6">No methods available —</td></tr>';
  host.innerHTML=`<div class="stress-intro"><div><span class="stress-eyebrow">EXPLORATORY RESULTS</span><h2>${esc(title)}</h2><p>${esc(description)}</p>${extra}</div>${domain==='mediation'&&data?`<span class="stress-suite-count">${esc(data.suite.totalTables)} tables · ${esc(data.suite.caseCount)} cases</span>`:''}</div><div class="stress-table-wrap" role="region" tabindex="0" aria-label="Stress test summary"><table class="stress-table"><caption class="sr-only">Stress test summary by method</caption><thead><tr><th scope="col">Method</th><th scope="col">Bias</th><th scope="col">RMSE</th><th scope="col">95% coverage</th><th scope="col">Mean CI length</th><th scope="col">Tables</th></tr></thead><tbody>${body}</tbody></table></div><p class="stress-note">— Not reported. Select a method to explore the settings and cases.</p>`;
 }
 function methodDetail(id){
  const method=data.methods.find(m=>m.id===id);if(!method)return '';
  const options=data.mechanisms.map(m=>`<option value="${esc(m.id)}"${m.id===selectedMechanism?' selected':''}>${esc(m.label)}</option>`).join('');
  const mechanism=data.mechanisms.find(m=>m.id===selectedMechanism);
  const caseRows=data.settings.map(setting=>{
   const item=data.cases.find(c=>c.settingId===setting.id&&c.mechanismId===selectedMechanism);
   if(!item)return '';
   const metric=item.results[id],isOpen=openCase===item.id;
   return `<tr><th scope="row"><button type="button" class="stress-case-button" data-stress-case="${esc(item.id)}" aria-expanded="${isOpen}">${esc(setting.label)} <span aria-hidden="true">${isOpen?'⌃':'↗'}</span></button></th><td>${td(metric,'bias')}</td><td>${td(metric,'rmse')}</td><td>${td(metric,'coverage')}</td><td>${td(metric,'meanCiLength')}</td><td>${esc(item.n)}</td></tr>${isOpen?caseDetail(item,setting,mechanism):''}`;
  }).join('');
  return `<tr class="stress-detail-row"><td colspan="6"><div class="stress-method-detail"><div class="stress-detail-heading"><div><h3>${esc(method.label)} · settings</h3><p>Choose a mechanism, then open a setting to compare all methods in that case.</p></div><label>Mechanism <select class="stress-mechanism" aria-label="Select mechanism">${options}</select></label></div><p class="stress-mechanism-description">${esc(mechanism?.description||'')}</p><div class="stress-table-wrap"><table class="stress-table stress-cases-table"><thead><tr><th scope="col">Setting</th><th scope="col">Bias</th><th scope="col">RMSE</th><th scope="col">95% coverage</th><th scope="col">Mean CI length</th><th scope="col">Tables</th></tr></thead><tbody>${caseRows}</tbody></table></div></div></td></tr>`;
 }
 function caseDetail(item,setting,mechanism){
  const rows=data.methods.map(method=>{
   const metric=item.results[method.id];
   return `<tr><th scope="row">${esc(method.label)}</th><td>${td(metric,'bias')}</td><td>${td(metric,'rmse')}</td><td>${td(metric,'coverage')}</td><td>${td(metric,'meanCiLength')}</td><td>${esc(item.n)}</td></tr>`;
  }).join('');
  return `<tr class="stress-case-detail-row"><td colspan="6"><div class="stress-case-detail"><h4>${esc(setting.label)} · ${esc(mechanism.label)}</h4><p>${esc(setting.description)} ${esc(mechanism.description)}</p><p>Target: ${esc(data.suite.target)} · True NIE: ${num(data.suite.truth)} · Sample size: ${esc(setting.sampleSize)} · ${esc(item.n)} simulated tables</p><div class="stress-table-wrap"><table class="stress-table stress-comparison-table"><thead><tr><th scope="col">Method</th><th scope="col">Bias</th><th scope="col">RMSE</th><th scope="col">95% coverage</th><th scope="col">Mean CI length</th><th scope="col">Tables</th></tr></thead><tbody>${rows}</tbody></table></div>${caseDocumentation(item.documentation)}</div></td></tr>`;
 }
 function caseDocumentation(doc){
  if(!doc||!Array.isArray(doc.equations)||!Array.isArray(doc.variables)||!doc.dag)return '';
  const graph=caseDag(doc.dag);
  const equations=doc.equations.map(eq=>`<div class="stress-equation"><strong>${esc(eq.label)}</strong><span>${esc(eq.text)}</span></div>`).join('');
  const symbols=doc.variables.map(v=>`<tr><th scope="row">${esc(v.symbol)}</th><td>${esc(v.description)}</td></tr>`).join('');
  return `<details class="stress-documentation"><summary>Variables, structural equations and DAG</summary><div class="stress-documentation-content"><h5>DAG</h5>${graph}<p>${esc(doc.dag.note||'')}</p><h5>Variables and generation process</h5><div class="stress-equations">${equations}</div><p>${esc(doc.samplingNote||'')}</p><p>${esc(doc.generatorNote||'')}</p><h5>Symbols</h5><div class="stress-table-wrap"><table class="stress-symbols"><tbody>${symbols}</tbody></table></div></div></details>`;
 }
 function caseDag(dag){
  const paths={
   'X>A':'M 318 55 L 130 166','X>M':'M 340 66 L 340 155','X>Y':'M 362 55 L 550 166',
   'A>M':'M 129 180 L 315 180','M>Y':'M 365 180 L 551 180',
   'A>Y':'M 126 192 C 215 265, 465 265, 554 192'
  };
  const edges=Array.isArray(dag.edges)?dag.edges.map(e=>paths[`${e.from}>${e.to}`]).filter(Boolean):[];
  const extra=Array.isArray(dag.nodes)&&dag.nodes.some(n=>n.id==='X_extra');
  const base=[['X',340,42],['A',105,180],['M',340,180],['Y',575,180]];
  const edgeMarkup=edges.map(p=>`<path d="${esc(p)}" marker-end="url(#stress-dag-arrow)"/>`).join('');
  const nodeMarkup=base.map(([label,x,y])=>`<g><circle cx="${x}" cy="${y}" r="24"/><text x="${x}" y="${y+6}" text-anchor="middle">${esc(label)}</text></g>`).join('');
  const extraMarkup=extra?'<g><rect x="38" y="19" width="120" height="46" rx="20"/><text x="98" y="47" text-anchor="middle">X extra</text></g>':'';
  return `<svg class="stress-dag" viewBox="0 0 680 260" role="img" aria-label="Grouped causal diagram. X points to treatment, mediator, and outcome; treatment points to mediator and outcome; mediator points to outcome${extra?'; additional covariates are independent':''}."><defs><marker id="stress-dag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z"/></marker></defs><g class="stress-dag-edges">${edgeMarkup}</g><g class="stress-dag-nodes">${nodeMarkup}${extraMarkup}</g></svg>`;
 }
 nav.addEventListener('click',event=>{
  const b=event.target.closest('[data-benchmark-view]');if(!b)return;
  selected=b.dataset.benchmarkView;expanded=null;openCase=null;
  if(selected==='test'){
   const coming=!suites().some(s=>s.domain===domain)&&['nonparametric_regression','quantile','semi_supervised','missing_data'].includes(domain);
   document.getElementById('table').hidden=coming;
   document.querySelector('.test-controls').hidden=coming;
   document.getElementById('methodology').hidden=coming;
   document.getElementById('coming-soon').hidden=!coming;
  }
  render();
 });
 // The existing domain header link should always reveal its target leaderboard.
 document.addEventListener('click',event=>{
  if(selected==='stress'&&event.target.closest('a[href="#table"]'))nav.querySelector('[data-benchmark-view="test"]').click();
 });
 host.addEventListener('click',event=>{
  const b=event.target.closest('[data-stress-method]');
  if(b){expanded=expanded===b.dataset.stressMethod?null:b.dataset.stressMethod;openCase=null;render();host.querySelector(`[data-stress-method="${CSS.escape(b.dataset.stressMethod)}"]`)?.focus();return;}
  const c=event.target.closest('[data-stress-case]');
  if(c){openCase=openCase===c.dataset.stressCase?null:c.dataset.stressCase;render();host.querySelector(`[data-stress-case="${CSS.escape(c.dataset.stressCase)}"]`)?.focus();}
 });
 host.addEventListener('change',event=>{
  if(event.target.matches('.stress-mechanism')){selectedMechanism=event.target.value;openCase=null;render();host.querySelector('.stress-mechanism')?.focus();}
 });
 document.addEventListener('arena:domain-render',event=>{
  const info=event.detail;
  if(domain!==info.domain){expanded=null;openCase=null;selectedMechanism='reference';}
  domain=info.domain;suiteId=info.suiteId;rows=info.rows||[];
  render();
 });
 const params=new URLSearchParams(location.hash.slice(1));
 domain=params.get('domain')||'ate';
 if(params.get('view')==='stress')selected='stress';
 const initial=suites().find(s=>s.domain===domain);suiteId=initial?.id||null;rows=initial?.rows||[];
 render();
 fetch('data/mediation-stress.json',{cache:'no-cache'}).then(response=>{
  if(!response.ok)throw Error('Stress test data request failed');return response.json();
 }).then(result=>{
  if(result?.schemaVersion!==1||!Array.isArray(result.cases)||!Array.isArray(result.methods)||!Array.isArray(result.settings)||!Array.isArray(result.mechanisms))throw Error('Invalid stress test data');
  data=result;pending=false;render();
 }).catch(err=>{pending=false;error=true;console.error(err);render();});
})();
