'use strict';
// Test-only presentation; original evaluations remain unchanged in data/results.json.
const DOMAINS = [
 {id:'ate',name:'Average Treatment Effect',desc:'Point estimates and confidence intervals for average treatment effects.'},
 {id:'cate',name:'Conditional Average Treatment Effect',desc:'Inference for conditional treatment effects at specified covariate queries.'},
 {id:'mediation',name:'Causal Mediation Analysis',desc:'Statistical inference for explicitly defined direct, indirect, and mediation targets.'},
 {id:'iv',name:'Instrumental Variables',desc:'Inference with instrumental variables under each task’s stated identification assumptions.'},
 {id:'proximal',name:'Proximal Causal Inference',desc:'Causal inference with proxy variables under each task’s stated assumptions.'},
 {id:'did_sc',name:'Difference-in-Differences',desc:'Inference for difference-in-differences targets.'},
 {id:'nonparametric_regression',name:'Nonparametric Regression',desc:'Point estimates and confidence intervals for specified regression-function queries.'},
 {id:'quantile',name:'Quantile Inference',desc:'Inference for explicitly specified quantile and distributional targets.'},
 {id:'semi_supervised',name:'Semi-Supervised Inference',desc:'Statistical inference using labeled and unlabeled observations.'},
 {id:'missing_data',name:'Missing Data',desc:'Inference under each task’s declared observation and missingness mechanisms.'}
];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const METRICS=[
 {key:'bias',label:'Bias',hint:'Closer to zero',detail:'Signed estimation error. Sorting uses absolute bias.'},
 {key:'variance',label:'Variance',hint:'',detail:'Source-reported variance; not standard error.'},
 {key:'rmse',label:'RMSE',hint:'Lower is better',detail:'Root mean squared error, for this target and evaluation only.'},
 {key:'length',label:'Mean interval length',hint:'Read with coverage',detail:'Mean confidence interval length; smaller alone does not imply better inference.'},
 {key:'coverage',label:'Coverage',hint:'',detail:'Empirical coverage; higher is not automatically better. Sorting uses distance from the nominal level.'},
 {key:'time_s',label:'Inference time',hint:'Seconds per table',detail:'Reported point-plus-interval time. Hardware and timing protocols may differ.'}
];
const metricKeys=METRICS.map(m=>m.key);
let task='ate',family='all',query='',testSuites=[],loadError='',loaded=false;
let rankMetric='rmse',sortDirection=1;
const expandedMethods=new Set();
const domainSuites=()=>testSuites.filter(s=>s.domain===task);
const current=()=>domainSuites()[0]||null;
const visibleRows=()=> (current()?.rows||[]).filter(r=>(family==='all'||r.family===family)&&(!query||((r.family==='classical'?'Baseline ':'RFN ')+r.method+' '+r.configuration+' '+r.source_method).toLowerCase().includes(query)));

// All pooling is explicit and approximate because its inputs are rounded report summaries.
// Mean metrics use counts. RMSE pools squared errors. Error variance includes between-group means.
function aggregateRows(rows,varianceKind){
 const n=rows.reduce((a,r)=>a+r.tables,0);
 if(!rows.length||!rows.every(r=>Number.isInteger(r.tables)&&r.tables>0))throw Error('Missing aggregation counts');
 const mean=k=>rows.every(r=>finite(r[k]))?rows.reduce((a,r)=>a+r.tables*r[k],0)/n:null;
 const out={tables:n,bias:mean('bias'),length:mean('length'),coverage:mean('coverage'),time_s:mean('time_s'),variance:null,rmse:null};
 if(rows.every(r=>finite(r.rmse)))out.rmse=Math.sqrt(rows.reduce((a,r)=>a+r.tables*r.rmse*r.rmse,0)/n);
 if(rows.every(r=>finite(r.variance))){
  if(varianceKind==='within')out.variance=mean('variance');
  else if(varianceKind==='error'&&finite(out.bias)&&n>1)out.variance=rows.reduce((a,r)=>a+(r.tables-1)*r.variance+r.tables*(r.bias-out.bias)**2,0)/(n-1);
 }
 out.approximate_metrics=metricKeys.filter(k=>finite(out[k]));
 return out;
}
function displayIdentity(domain,r){
 if(r.family==='classical')return {method:'RF + bootstrap',configuration:domain==='iv'?(r.method==='RF trim'?'Trimmed variant':'Untrimmed variant'):domain==='proximal'?'B = 200 · source configuration':domain==='ate'||domain==='cate'?'B = 100 · source configuration':''};
 if(domain==='iv')return {method:'IV-PFN',configuration:'v0.2 · source name: PFN'};
 const seed=r.method.match(/ S([12])$/);
 return {method:seed?r.method.replace(/ S[12]$/,''):r.method,configuration:seed?'Training seed '+seed[1]:''};
}
function buildTestSuites(raw,med,updates,iv){
 if(raw.schema_version!==1||!Array.isArray(raw.suites)||med.domain!=='mediation')throw Error('Invalid result data');
 if(updates?.schema_version!==1||!Array.isArray(updates.suites))throw Error('Invalid unified Test data');
 if(iv?.domain!=='iv'||iv.id!=='iv-v03-test')throw Error('Invalid IV v0.3 Test data');
 // Show one Proximal release; alternate units remain in the source archive only.
 const activeUpdates=updates.suites.filter(s=>s.domain!=='proximal'||s.metric_scale==='normalized');
 const replaced=new Set([...updates.suites.map(s=>s.domain),'iv']);
 const result=[{...med,summary_kind:'Reported pooled Test results',notes:[],derived:false},...activeUpdates,iv];
 for(const source of raw.suites){
  if(source.domain==='mediation'||replaced.has(source.domain))continue;
  const s={id:source.id,domain:source.domain,label:source.domain==='proximal'?(source.metric_scale==='normalized'?'Normalized units':'Original units'):source.label,target:source.target,sample_size:source.sample_size,tables:2000,nominal_coverage:source.nominal_coverage,metric_scale:source.metric_scale,source:source.source,variance_definition:source.variance_definition,timing:source.hardware+'. '+source.timing_scope,protocol:source.comparison_note,rows:[],notes:[],derived:true,summary_kind:'Test summary · derived from rounded source results'};
  s.aggregation='Two equally weighted 1,000-table evaluation groups are combined. Mean metrics retain each source group’s internal weighting; RMSE is the square root of the weighted mean of squared RMSEs. Values marked ≈ are reconstructed from rounded report summaries, not a new evaluation.';
  if(['ate','cate'].includes(s.domain))s.aggregation+=' Each original group retains its DGP-balanced weights; this is not a uniform weighting of all 13 configurations.';
  const methods=[...new Set(source.rows.map(r=>r.method))];
  for(const name of methods){
   const grouped=source.rows.filter(r=>r.method===name);
   const original=grouped[0];
   if(s.domain==='did_sc'&&original.family==='classical')continue;
   let components=grouped,kind=['ate','cate'].includes(s.domain)?'within':s.domain==='iv'?'unknown':'error';
   if(s.domain==='proximal'){
    components=[...grouped.filter(r=>r.group==='ID'),...(source.dgp_results||[]).filter(r=>r.method===name&&r.group==='OOD')];
    if(components.length!==4)throw Error('Incomplete Proximal strata');
   }
   const r={...displayIdentity(s.domain,original),source_method:name,family:original.family,group:'Test',status:'derived',...aggregateRows(components,kind)};
   if(s.domain==='proximal'){
    r.time_s=original.family==='pfn'?1.185:118.239;
    r.approximate_metrics=r.approximate_metrics.filter(k=>k!=='time_s');
    r.coverage=grouped.reduce((a,x)=>a+x.tables*x.coverage,0)/r.tables;
   }
   s.rows.push(r);
  }
  if(s.domain==='proximal'){
   s.aggregation='All 2,000 tasks are included. Bias, RMSE, length and error variance are reconstructed approximately from the 1,000-task reference stratum and three external strata of 343, 321 and 336 tasks. Strata are weighted by task counts; squared errors are pooled before taking a square root. Sample error variance includes between-stratum mean differences. Coverage uses the two reported complete-group rates. Full-test mean times are copied directly from page 12.';
   if(s.metric_scale==='normalized')s.notes.push('Bias, Variance, RMSE and Length are normalized by each task’s observed outcome SD. Coverage and time are not normalized.');
  }
  if(s.domain==='iv')s.notes.push('Pooled Variance is pending: v0.2 does not specify whether the supplied variances are within-mechanism or cross-table. They are preserved in the source file, not silently averaged. Both RF variants remain distinct configurations.');
  if(s.domain==='did_sc'){
   s.rows.push({method:'RF + bootstrap',source_method:'RF + bootstrap',configuration:'Not evaluated in this report',family:'classical',group:'Test',status:'not_reported',tables:2000,approximate_metrics:[],...Object.fromEntries(metricKeys.map(k=>[k,null]))});
   s.notes.push('RF + bootstrap was not run in this report. The historical RF-DR-DiD used influence-function intervals; its numbers are preserved in the source data, not relabeled as bootstrap. Training seeds remain separate; no ensemble is formed.');
  }
  result.push(s);
 }
 for(const s of result){
  if(!DOMAINS.some(d=>d.id===s.domain)||!Array.isArray(s.rows))throw Error('Invalid Test suite');
  for(const r of s.rows)for(const k of metricKeys)if(r[k]!=null&&(!finite(r[k])||(k!=='bias'&&r[k]<0)||(k==='coverage'&&r[k]>1)))throw Error('Invalid Test metric');
 }
 return result;
}
function formatMetric(r,k){
 const v=r[k];if(!finite(v))return '—';
 const approx=r.approximate_metrics?.includes(k)?'≈':'';
 if(k==='coverage')return approx+(v*100).toFixed(2)+'%';
 const a=Math.abs(v),digits=Math.min(4,r.display_precision?.[k]??current()?.display_precision?.[k]??(k==='time_s'?(current()?.domain==='mediation'?2:a<.1?4:3):4));
 const value=a!==0&&(a>=10000||a<.0001)?a.toExponential(2):a.toFixed(digits);
 return approx+(v<0?'−':k==='bias'&&v>0?'+':'')+value;
}
// These details describe the evaluated release, not a model's defaults. Where
// the submitted evaluation omits a parameter, explicitly say it is unreported.
function methodFacts(r,s){
 const baseline=r.family==='classical';
 const name=baseline?(s.id==='proximal-unified-2026-11-16-normalized'?'Random forest–based proximal baseline':'Random forest'):r.method;
 let estimator=baseline?'Random forest':r.method,folds='Not reported',bootstrap='Not reported',configuration='';
 if(['ate-fixed-collection-report','cate-fixed-collection-report'].includes(s.id)){
  if(baseline){
   estimator=s.domain==='ate'?'AIPW with treatment-stratified cross-fitting':'T-learner ensemble';
   folds='5';bootstrap='50';
   configuration='200 trees; minimum leaf size 5; n_jobs=1; scikit-learn 1.7.2; 95% percentile intervals; grouped treatment-stratified bootstrap resplits'+(s.domain==='ate'?'; propensity clipping 0.01–0.99':'; fixed CATE query');
  }else{
   estimator='CausalPFN 0.1.5; official causalpfn_v0.pt weights';
   folds='Native workflow; no additional five-fold wrapper';
   configuration='10,000 predictive draws; calibrate=False';
  }
 }else if(s.id==='mediation-fivefold-2026-11-16'){
  folds='5 treatment-stratified folds';
  if(baseline){estimator='Cross-fitted EIF for NIE';folds='5 treatment-stratified outer folds; 2 inner pseudo-label folds';bootstrap='50';configuration='Random forest classifiers/regressors: 200 trees; minimum leaf size 5; n_jobs=1; propensity clipping 0.01–0.99; scikit-learn 1.7.2; 95% percentile interval';}
  else configuration='Checkpoint trained with two folds; evaluated with five folds without recalibration';
 }else if(s.id==='iv-v03-test'){
  folds='5 (as stated in the supplied results)';
  if(baseline){estimator='Trimmed random forest + bootstrap';configuration='Bootstrap replicate count not reported';}
  else estimator='IV-PFN v0.3';
 }else if(s.id==='did-test-2026-11-16'){
  estimator='Normalized DR-DiD score';folds='5';
  if(baseline){bootstrap='50';configuration='Propensity classification and outcome-change regression forests: 200 trees; minimum leaf size 5; resampling with new splits; 95% normal interval using bootstrap standard errors';}
  else configuration='Frozen TabPFN-3.5 with residual adapters; 95% normal interval using influence-function standard errors';
 }else if(s.id==='proximal-unified-2026-11-16-normalized'){
  if(baseline){estimator='Proximal series-IV / sieve-GMM with RF nuisance models';folds='5-fold out-of-fold E[W, W² | A, X, Z] predictions';bootstrap='50';configuration='RF nuisance and W | X query models: 200 trees; minimum leaf size 5; n_jobs=1; scikit-learn 1.7.2; 20-column quadratic bridge; ridge 10⁻⁴ and instrument ridge 10⁻⁶; full-pipeline resampling; 95% percentile interval';}
  else{folds='Five-context distribution mixture; not nuisance cross-fitting';configuration='Interval: quantiles of the five-context mixture distribution';}
 }else configuration=r.configuration||'';
 return [['Method',name],['Estimator / model',estimator],['Folds / contexts',folds],['Bootstrap',bootstrap],['Configuration',configuration||'Not reported']];
}
function methodKey(r){return [current()?.id,r.family,r.source_method||r.method,r.configuration||''].join('::');}
function methodCell(r,index){
 const name=r.family==='classical'?'Baseline':r.method;
 const open=expandedMethods.has(methodKey(r));
 return `<button type="button" class="method-toggle" data-toggle-method="${index}" aria-expanded="${open}" aria-controls="method-details-${index}"><span class="mname">${esc(name)}</span><span class="method-chevron" aria-hidden="true">${open?'⌃':'⌄'}</span></button>`;
}
function methodDetails(r,index){
 const s=current(),ref=ArenaMethodReferences.lookup(task,r),facts=methodFacts(r,s).map(([label,value])=>[label,s?.domain==='iv'&&/\bnot reported\b/i.test(String(value))?'—':value]);
 const references=[];
 const paper=ref?.paper,paperURL=ArenaMethodReferences.safeURL(paper?.url,'paper');
 if(paperURL)references.push(`<div><strong>Method reference</strong> <a class="method-reference-link" href="${esc(paperURL)}" target="_blank" rel="noopener noreferrer">${esc(paper.title||'Paper')} ↗</a>${paper.citation?`<p>${esc(paper.citation)}</p>`:''}</div>`);
 // The DR-DiD paper describes the estimator, not a PFN-DiD-specific model.
 if(s.id==='did-test-2026-11-16')references.push('<div><strong>DR-DiD estimator reference</strong> <a class="method-reference-link" href="https://arxiv.org/abs/1812.01723" target="_blank" rel="noopener noreferrer">Sant’Anna and Zhao, Doubly Robust Difference-in-Differences Estimators ↗</a></div>');
 const modelURL=ArenaMethodReferences.safeURL(ref?.huggingface?.url,'huggingface');
 if(modelURL)references.push(`<div><strong>Model</strong> <a class="method-reference-link" href="${esc(modelURL)}" target="_blank" rel="noopener noreferrer">Hugging Face ↗</a></div>`);
 const referenceSection=references.length?`<div class="method-reference-links">${references.join('')}</div>`:'';
 return `<tr class="method-details-row" id="method-details-${index}"><td colspan="8"><div class="method-details"><div class="method-detail-grid">${facts.map(([label,value],i)=>`<div${i===4?' class="method-detail-extra"':''}><strong>${esc(label)}</strong><p>${esc(value)}</p></div>`).join('')}</div>${referenceSection}</div></td></tr>`;
}
// Rank within the current domain only. Missing results always sort last.
function metricScore(row,key){
 if(!finite(row[key]))return null;
 if(key==='bias')return Math.abs(row[key]);
 if(key==='coverage')return Math.abs(row[key]-(current()?.nominal_coverage??.95));
 return row[key];
}
function compareRows(a,b,key,direction=1){
 const av=metricScore(a,key),bv=metricScore(b,key);
 if(av===null)return bv===null?0:1;
 if(bv===null)return -1;
 return (av-bv)*direction;
}
function sortedRows(){return [...visibleRows()].sort((a,b)=>compareRows(a,b,rankMetric,sortDirection));}
function rankMap(){
 const ordered=[...(current()?.rows||[])].sort((a,b)=>compareRows(a,b,rankMetric));
 const ranks=new Map();let last=null,rank=0;
 ordered.forEach((row,index)=>{
  const score=metricScore(row,rankMetric);
  if(score===null){ranks.set(row,'—');return;}
  if(index===0||score!==last)rank=index+1;
  ranks.set(row,rank);last=score;
 });
 return ranks;
}
// Medals decorate the existing numeric rank under the selected metric.
// Ties, filters, missing values, and CSV rankings retain their existing semantics.
function rankDisplay(rank){
 if(!Number.isInteger(rank)||rank<1||rank>3)return esc(rank);
 const names=['gold','silver','bronze'],name=names[rank-1];
 return `<span class="rank-medal rank-medal--${name}" role="img" aria-label="Rank ${rank} (${name} medal)"><svg viewBox="0 0 24 29" width="24" height="29" aria-hidden="true" focusable="false"><path class="rank-medal-ribbon" d="M4 1h6l2 6 2-6h6l-4.2 10.1H8.2z"/><circle class="rank-medal-disc" cx="12" cy="17.5" r="8.4"/><circle class="rank-medal-ring" cx="12" cy="17.5" r="6.5"/><text x="12" y="21" text-anchor="middle">${rank}</text></svg></span>`;
}
function setRanking(key,toggle=false){
 if(!metricKeys.includes(key))return;
 sortDirection=toggle&&rankMetric===key?-sortDirection:1;
 rankMetric=key;renderMetrics();
}
function renderMetrics(){
 const s=current(),rs=sortedRows(),ranks=rankMap();
 const empty=loadError?'Results unavailable':loaded?'Coming soon':'Loading results…';
 const headers=METRICS.map(m=>{
  const active=m.key===rankMetric;
  const order=!active?'none':['bias','coverage'].includes(m.key)?'other':sortDirection===1?'ascending':'descending';
  const label=m.key==='time_s'?'Time (s)':m.label;
  return `<th scope="col" data-metric="${m.key}" class="r${active?' ranked-column':''}" aria-sort="${order}"><button type="button" data-sort="${m.key}" title="${esc(m.detail)}">${esc(label)} <span class="sort-arrow" aria-hidden="true">${active?(sortDirection===1?'↑':'↓'):'↕'}</span></button></th>`;
 }).join('');
 const body=rs.length?rs.map((r,index)=>`<tr data-method="${esc(r.source_method||r.method)}"><td class="rank-cell num">${rankDisplay(ranks.get(r))}</td><th scope="row" class="method-cell">${methodCell(r,index)}</th>${METRICS.map(m=>`<td data-metric="${m.key}" class="r num${m.key===rankMetric?' ranked-column':''}" title="${esc(r.status==='not_reported'?'Not reported':r.approximate_metrics?.includes(m.key)?'Approximate value':'Reported value')}">${formatMetric(r,m.key)}</td>`).join('')}</tr>${expandedMethods.has(methodKey(r))?methodDetails(r,index):''}`).join(''):`<tr><td colspan="8" class="empty-cell">${s&&!loadError?'No methods match the filters.':empty}</td></tr>`;
 $('#leaderboard-wrap').innerHTML=`<table id="leaderboard"><caption class="sr-only">${esc(DOMAINS.find(d=>d.id===task).name)} — Test results</caption><thead><tr><th scope="col" class="rank-cell">Rank</th><th scope="col" class="method-cell">Method</th>${headers}</tr></thead><tbody>${body}</tbody></table>`;
 $('#rank-metric').value=rankMetric;
 $('#rank-metric').title=METRICS.find(m=>m.key===rankMetric).detail;
 $('#export-btn').disabled=!rs.some(r=>r.status!=='not_reported');
 const notes=[];
 if(rs.some(r=>r.approximate_metrics?.length))notes.push('≈ Approximate value.');
 if(rs.some(r=>metricKeys.some(k=>!finite(r[k]))))notes.push('— Not reported.');
 $('#table-note').textContent=notes.join(' ');$('#table-note').hidden=!notes.length;
}
// These are the targets of the current releases, not definitions of every
// estimand that may be studied in a domain. MathML avoids a network dependency.
const potentialOutcome=(a)=>`<msup><mi>Y</mi><mrow><mo>(</mo><mn>${a}</mn><mo>)</mo></mrow></msup>`;
const meanContrast=potentialOutcome(1)+'<mo>−</mo>'+potentialOutcome(0);
const mml=(body,label)=>`<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="${esc(label)}">${body}</math>`;
const expectation=(inside)=>`<mi mathvariant="double-struck">E</mi><mo>[</mo>${inside}<mo>]</mo>`;
const targetDefinitions={
 ate:mml('<mi>ATE</mi><mo>=</mo>'+expectation(meanContrast),'ATE equals the expected difference between potential outcomes under treatment and control'),
 cate:mml('<mi>CATE</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'+expectation(meanContrast+'<mo>∣</mo><mi>X</mi><mo>=</mo><mi>x</mi>'),'CATE at x equals the expected treatment effect conditional on X equals x'),
 mediation:mml('<mi>NIE</mi><mo>=</mo>'+expectation('<mi>Y</mi><mo>(</mo><mn>1</mn><mo>,</mo><mi>M</mi><mo>(</mo><mn>1</mn><mo>)</mo><mo>)</mo><mo>−</mo><mi>Y</mi><mo>(</mo><mn>1</mn><mo>,</mo><mi>M</mi><mo>(</mo><mn>0</mn><mo>)</mo><mo>)</mo>'),'Natural indirect effect at treatment level one'),
 proximal:mml('<mi>CATE</mi><mo>(</mo><msup><mi>x</mi><mo>∗</mo></msup><mo>)</mo><mo>=</mo>'+expectation(meanContrast+'<mo>∣</mo><mi>X</mi><mo>=</mo><msup><mi>x</mi><mo>∗</mo></msup>'),'CATE at the query point x star'),
 did_sc:mml('<mi>ATT</mi><mo>=</mo>'+expectation('<msub><mi>Y</mi><mtext>post</mtext></msub><mo>(</mo><mn>1</mn><mo>)</mo><mo>−</mo><msub><mi>Y</mi><mtext>post</mtext></msub><mo>(</mo><mn>0</mn><mo>)</mo><mo>∣</mo><mi>A</mi><mo>=</mo><mn>1</mn>'),'Average treatment effect on the treated in the post period')
};
// The four future areas and IV encompass many targets. These are illustrative
// examples only; they are not assertions about the unpublished / unspecified
// evaluation targets.
const outcomeSymbol=(v,a)=>`<msup><mi>${v}</mi><mrow><mo>(</mo><mn>${a}</mn><mo>)</mo></mrow></msup>`;
const exampleTargets={
 iv:mml('<mi>LATE</mi><mo>=</mo>'+expectation(meanContrast+'<mo>∣</mo>'+outcomeSymbol('D',1)+'<mo>&gt;</mo>'+outcomeSymbol('D',0)),'Local average treatment effect among compliers'),
 nonparametric_regression:mml('<mi>m</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'+expectation('<mi>Y</mi><mo>∣</mo><mi>X</mi><mo>=</mo><mi>x</mi>'),'Example conditional mean regression function'),
 quantile:mml('<msub><mi>Q</mi><mi>τ</mi></msub><mo>(</mo><mi>Y</mi><mo>∣</mo><mi>X</mi><mo>=</mo><mi>x</mi><mo>)</mo><mo>=</mo><mi>inf</mi><mo>{</mo><mi>y</mi><mo>:</mo><mi>P</mi><mo>(</mo><mi>Y</mi><mo>≤</mo><mi>y</mi><mo>∣</mo><mi>X</mi><mo>=</mo><mi>x</mi><mo>)</mo><mo>≥</mo><mi>τ</mi><mo>}</mo>','Example conditional quantile at level tau'),
 semi_supervised:mml('<mi>μ</mi><mo>=</mo>'+expectation('<mi>Y</mi>'),'Example population outcome mean in semi-supervised inference'),
 missing_data:mml('<mi>μ</mi><mo>=</mo>'+expectation('<mi>Y</mi>'),'Example full-data population outcome mean with missing outcomes')
};
function renderDefinition(){
 const host=$('#domain-definition');if(!host)return;
 if(task==='iv')host.innerHTML=exampleTargets.iv;
 else if(targetDefinitions[task])host.innerHTML='<span>Current estimand</span> '+targetDefinitions[task];
 else if(exampleTargets[task]){
  const explanation=task==='semi_supervised'?' Uses labeled (X, Y) and unlabeled X data.':task==='missing_data'?' Full-data mean when some outcomes are unobserved.':'';
  host.innerHTML='<span>Example estimand (results coming soon)</span> '+exampleTargets[task]+esc(explanation);
 }
 else host.textContent='';
 host.hidden=!host.textContent.trim();
}
function render(){
 const d=DOMAINS.find(d=>d.id===task);
 for(const b of document.querySelectorAll('[data-t]')){const on=b.dataset.t===task;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
 for(const b of document.querySelectorAll('[data-fam]')){const on=b.dataset.fam===family;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}
 $('#main-panel').setAttribute('aria-labelledby','tab-'+task);$('#hero-title').textContent=d.name;$('#hero-sub').textContent=d.desc;renderDefinition();
 const comingSoon=loaded&&!loadError&&!current()&&['nonparametric_regression','quantile','semi_supervised','missing_data'].includes(task);
 $('#coming-soon').hidden=!comingSoon;
 document.querySelector('.test-controls').hidden=comingSoon;
 $('#table').hidden=comingSoon;
 $('#methodology').hidden=comingSoon;
 $('#release-status').textContent=loadError?'RESULTS UNAVAILABLE':loaded?'TEST RESULTS':'LOADING RESULTS';
 $('#release-description').textContent=loadError;$('#release-description').hidden=!loadError;
 $('#registry-link').href='https://github.com/Statsinference/stats-inference-arena/blob/main/dgp-submissions/registry/by-domain/'+task+'.md';
 renderMetrics();document.body.dataset.testView=loaded?'ready':'loading';
}
function readHash(){const p=new URLSearchParams(location.hash.slice(1));if(DOMAINS.some(d=>d.id===p.get('domain')))task=p.get('domain');}
function writeHash(){const p=new URLSearchParams({domain:task});try{history.replaceState(null,'','#'+p);}catch(_){}}
function chooseTask(id){if(!DOMAINS.some(d=>d.id===id))return;task=id;family='all';query='';$('#q').value='';writeHash();render();}
const domainGroups=[{id:'causal',label:'Causal Inference',domains:DOMAINS.slice(0,6)},{id:'other',label:'Others',domains:DOMAINS.slice(6)}];
$('#tabs').innerHTML=domainGroups.map(g=>`<div class="domain-group" role="group" aria-labelledby="domain-group-${g.id}"><div id="domain-group-${g.id}" class="domain-group-heading">${esc(g.label)}</div>${g.domains.map(d=>`<button class="tab" id="tab-${d.id}" data-t="${d.id}" role="tab" aria-controls="main-panel" aria-selected="false" tabindex="-1">${esc(d.name)}</button>`).join('')}</div>`).join('');
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b)chooseTask(b.dataset.t);});
$('#fam-chips').addEventListener('click',e=>{const b=e.target.closest('[data-fam]');if(b){family=b.dataset.fam;render();}});
$('#q').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();renderMetrics();});
$('#rank-metric').addEventListener('change',e=>setRanking(e.target.value));
$('#leaderboard-wrap').addEventListener('click',e=>{
 const toggle=e.target.closest('[data-toggle-method]');
 if(toggle){
  const index=Number(toggle.dataset.toggleMethod),row=sortedRows()[index];
  if(!row)return;
  const key=methodKey(row);expandedMethods.has(key)?expandedMethods.delete(key):expandedMethods.add(key);
  renderMetrics();$('#leaderboard-wrap').querySelector(`[data-toggle-method="${index}"]`)?.focus();return;
 }
 const b=e.target.closest('[data-sort]');if(b)setRanking(b.dataset.sort,true);
});
function csvCell(v){let s=String(v??'');if(typeof v==='string'&&/^[=+@\t\r-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$('#export-btn').addEventListener('click',()=>{
 const s=current();if(!s)return;const keys=['rank','domain','evaluation','method','configuration','source_method',...metricKeys,'approximate_metrics','tables','source_file','aggregation','variance_definition','timing'];
 const ranks=rankMap();
 const rr=sortedRows().map(r=>({...r,method:r.family==='classical'?'Baseline':r.method,rank:ranks.get(r),domain:task,evaluation:'Test',approximate_metrics:r.approximate_metrics.join(';'),source_file:s.source.file,aggregation:s.aggregation,variance_definition:s.variance_definition,timing:s.timing}));
 const text=[keys.join(','),...rr.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='statistical-inference-arena-'+task+'-test.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4500);}
function theme(value){document.documentElement.dataset.theme=value;$('#theme-btn').setAttribute('aria-label',value==='dark'?'Switch to light theme':'Switch to dark theme');}
$('#theme-btn').addEventListener('click',()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
window.addEventListener('hashchange',()=>{readHash();render();});
window.ArenaTestView=Object.freeze({aggregateRows,getSuites:()=>testSuites,metrics:metricKeys});
readHash();render();
Promise.all(['data/results.json','data/mediation-fivefold.json','data/unified-test-2026-11-16.json','data/iv-v03.json'].map(path=>fetch(path+'?view=iv-v03-1',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Result data request failed');return r.json();}))).then(([raw,med,updates,iv])=>{testSuites=buildTestSuites(raw,med,updates,iv);loaded=true;render();}).catch(e=>{loaded=true;loadError='Could not load Test results. Please refresh or contact the maintainers.';render();console.error(e);});
