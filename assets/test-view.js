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
const BENCHMARK_CARDS={ate:'ate/',cate:'cate/',mediation:'mediation/',iv:'iv/',proximal:'proximal/',did_sc:'did/'};
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
let pageMode='home';
let rankMetric='rmse',sortDirection=1;
let reviewedError=false;
const expandedMethods=new Set();
const domainSuites=()=>testSuites.filter(s=>s.domain===task);
const current=()=>domainSuites()[0]||null;
const familyNames={pfn:'PFN',classical:'Baseline',other:'Other methods'};
function displayMethodName(row){
 if(row.family!=='classical')return row.method;
 const name=row.method.replace(/ \+ GMM$/,'');
 if(name==='Linear')return 'Regularized Linear';
 if(name==='CatBoost-TD')return 'CatBoost';
 if(name==='XGB-TD')return 'XGBoost';
 return name;
}
const visibleRows=()=> (current()?.rows||[]).filter(r=>(family==='all'||r.family===family)&&(!query||[familyNames[r.family],displayMethodName(r),r.method,r.configuration,r.source_method].join(' ').toLowerCase().includes(query)));

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
 if(r.family==='classical')return {method:'Random Forest',configuration:domain==='iv'?(r.method==='RF trim'?'Trimmed variant':'Untrimmed variant'):domain==='proximal'?'B = 200 · source configuration':domain==='ate'||domain==='cate'?'B = 100 · source configuration':''};
 if(domain==='iv')return {method:'IV-PFN',configuration:'v0.2 · source name: PFN'};
 const seed=r.method.match(/ S([12])$/);
 return {method:seed?r.method.replace(/ S[12]$/,''):r.method,configuration:seed?'Training seed '+seed[1]:''};
}
function reviewedMediationRows(data){
 if(data?.release!=='mediation-v1.0'||!Array.isArray(data.rows))throw Error('Unexpected reviewed release');
 const issues=new Set();
 return data.rows.map(row=>{
  const issue=row.issue_number;
  if(!Number.isSafeInteger(issue)||issue<1||issues.has(issue)||row.tables!==2000||!['pfn','other'].includes(row.family)||
   ![row.method,row.version,row.estimator].every(value=>typeof value==='string'&&value.trim())||
   !ArenaMethodReferences.safeURL(row.method_url,'method')||
   !metricKeys.every(k=>k==='time_s'&&row[k]===null||finite(row[k])&&(k==='bias'||row[k]>=0)&&(k!=='coverage'||row[k]<=1)))throw Error('Invalid reviewed method');
  issues.add(issue);
  return {...row,source_method:'Submission #'+issue,configuration:row.version,status:'reviewed',group:'Test',approximate_metrics:[]};
 });
}
function buildTestSuites(raw,med,updates,iv,reviewed){
 if(raw.schema_version!==1||!Array.isArray(raw.suites)||med.domain!=='mediation')throw Error('Invalid result data');
 if(updates?.schema_version!==1||!Array.isArray(updates.suites))throw Error('Invalid unified Test data');
 if(iv?.domain!=='iv'||iv.id!=='iv-v03-test')throw Error('Invalid IV v0.3 Test data');
 // Show one Proximal release; alternate units remain in the source archive only.
 const activeUpdates=updates.suites.filter(s=>s.domain!=='proximal'||s.metric_scale==='normalized');
 const replaced=new Set([...updates.suites.map(s=>s.domain),'iv']);
 const result=[{...med,rows:[...med.rows,...reviewed],summary_kind:'Reported pooled Test results',notes:[],derived:false},...activeUpdates,iv];
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
   s.rows.push({method:'Random Forest',source_method:'RF + bootstrap',configuration:'Not evaluated in this report',family:'classical',group:'Test',status:'not_reported',tables:2000,approximate_metrics:[],...Object.fromEntries(metricKeys.map(k=>[k,null]))});
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
// Each setting describes the evaluated release. Unreported values remain unknown.
function methodFacts(r,s){
 if(r.status==='reviewed'){
  return {
   estimator:r.estimator,
   settings:[
    ['Version',r.version],
    ['Evaluation',r.tables.toLocaleString('en-US')+' official tables'],
    ['Fitting and intervals','See the linked submission for details.']
   ]
  };
 }
 if(r.details)return r.details;
 const forest=r.method.startsWith('Random Forest');
 const level=['Confidence level','95%'];
 const percentile=['Interval construction','Bootstrap percentile'];
 const folds='5 treatment-stratified outer folds; 2 inner pseudo-label folds';
 if(['ate-fixed-collection-report','cate-fixed-collection-report'].includes(s.id)){
  if(forest)return {
   estimator:s.domain==='ate'?'AIPW with treatment-stratified cross-fitting':'T-learner ensemble',
   folds:s.domain==='ate'?'5 treatment-stratified cross-fitting folds':'5 folds for the T-learner ensemble',
   bootstrap:'50',
   settings:[
    ['Learner','Random Forest (scikit-learn 1.7.2)'],
    ['Forest settings','200 trees; minimum leaf size 5; one worker'],
    s.domain==='ate'?['Propensity clipping','[0.01, 0.99]']:['CATE query','Fixed across refits'],
    level,percentile,
    ['Bootstrap refits','50 whole-row resamples; new grouped, treatment-stratified splits']
   ]
  };
  if(r.method==='CausalPFN')return {
   estimator:'CausalPFN 0.1.5; official causalpfn_v0.pt weights',
   folds:'Native workflow; no additional five-fold wrapper',
   bootstrap:'Not used',
   settings:[['Predictive draws','10,000'],['Calibration','Disabled'],level]
  };
 }
 if(s.id==='mediation-fivefold-2026-11-16'){
  if(forest)return {
   estimator:'Cross-fitted EIF for NIE',
   folds,
   bootstrap:'50',
   settings:[
    ['Learner','Random Forest classification and regression (scikit-learn 1.7.2)'],
    ['Forest settings','200 trees; minimum leaf size 5; one worker'],
    ['Treatment propensity clipping','[0.01, 0.99]'],
    level,percentile,
    ['Bootstrap refits','50 whole-row resamples; fresh five-fold splits']
   ]
  };
  if(r.method==='MediPFN')return {
   estimator:'Cross-fitted EIF for NIE with MediPFN',
   folds,
   bootstrap:'Not used',
   settings:[
    ['Learner','Frozen TabPFN-v3 classification and regression backbones with a learned mediation adapter'],
    ['Treatment propensity clipping','[0.01, 0.99]'],
    level,
    ['Interval construction','Error-quantile head with symmetrization and independent calibration'],
    ['Calibration','The head and calibration fitted with two outer folds are reused for five-fold evaluation']
   ]
  };
 }
 if(s.id==='iv-v03-test'){
  if(forest)return {
   estimator:'Augmented inverse-probability-weighted LATE ratio with Random Forest',
   folds:'5 shared folds for the AIPW LATE ratio',
   bootstrap:'50',
   settings:[
    ['Forest settings','200 trees; minimum leaf size 5'],
    ['Instrument propensity clipping','[0.05, 0.95]; predictions from the same fit'],
    level,percentile,['Bootstrap refits','50 whole-row resamples']
   ]
  };
  if(r.method==='IV-PFN')return {
   estimator:'IV-PFN v0.3',
   folds:'5 shared folds for the AIPW LATE ratio',
   bootstrap:'Not used',
   settings:[['Model version','IV-PFN v0.3'],level,['Interval construction','Influence-function standard errors']]
  };
 }
 if(s.id==='did-test-2026-11-16'){
  if(forest)return {
   estimator:'Normalized DR-DiD score',
   folds:'5 shared folds for the normalized DR-DiD score',
   bootstrap:'50',
   settings:[
    ['Learner','Random Forest for propensity classification and untreated outcome-change regression'],
    ['Forest settings','200 trees; minimum leaf size 5'],
    level,['Interval construction','Normal interval with bootstrap standard errors'],
    ['Bootstrap refits','50 whole-row resamples with new splits']
   ]
  };
  if(r.method==='PFN-DiD')return {
   estimator:'Normalized DR-DiD score',
   folds:'5 shared folds for the normalized DR-DiD score',
   bootstrap:'Not used',
   settings:[
    ['Learner','Frozen TabPFN-3.5 with residual adapters'],
    level,['Interval construction','Normal interval with influence-function standard errors']
   ]
  };
 }
 if(s.id==='proximal-unified-2026-11-16-normalized'){
  if(forest)return {
   estimator:'Proximal series-IV / sieve-GMM with RF nuisance models',
   folds:'5-fold out-of-fold E[W, W² | A, X, Z] predictions',
   bootstrap:'50',
   settings:[
    ['Learner','Random Forest for nuisance prediction and the W | X query (scikit-learn 1.7.2)'],
    ['Forest settings','200 trees; minimum leaf size 5; one worker'],
    ['Confounding bridge','20-column quadratic bridge'],
    ['Regularization','Bridge ridge 10⁻⁴; instrument ridge 10⁻⁶'],
    level,percentile,['Bootstrap refits','50 whole-row resamples with full pipeline refits and new splits']
   ]
  };
  if(r.method==='ProximalFM')return {
   estimator:'ProximalFM with the frozen official checkpoint',
   folds:'Five 400-row contexts; distribution mixture',
   bootstrap:'Not used',
   settings:[['Point estimate','Mean of the equal-weight five-context mixture'],level,
    ['Interval construction','Quantiles of the five-context mixture distribution']]
  };
 }
 return {configuration:r.configuration};
}
function estimatorSummary(r,s,detail){
 if(r.status==='reviewed'||!detail.estimator)return detail.estimator;
 if(s.domain==='mediation'&&detail.estimator.startsWith('Cross-fitted EIF for NIE'))return 'Influence-function based estimator';
 if(s.domain==='ate')return r.method==='CausalPFN'?'CausalPFN':'AIPW';
 if(s.domain==='cate')return r.method==='CausalPFN'?'CausalPFN':'T-learner';
 if(s.domain==='did_sc')return 'Doubly robust DiD';
 if(s.domain==='proximal')return r.method==='ProximalFM'?'ProximalFM':'Proximal GMM';
 if(s.domain==='iv'&&['IV-PFN','Random Forest'].includes(r.method))return 'AIPW LATE ratio';
 return detail.estimator;
}
const estimatorDescriptions=new Map([
 ['AIPW','Augmented inverse probability weighting'],
 ['T-learner','Fixed-query T-learner ensemble'],
 ['Influence-function based estimator','Cross-fitted efficient influence function estimator for the natural indirect effect'],
 ['Doubly robust DiD','Normalized doubly robust difference-in-differences estimator'],
 ['Proximal GMM','Proximal series instrumental variables / sieve generalized method of moments'],
 ['AIPW LATE ratio','Augmented inverse probability weighted ratio for the local average treatment effect']
]);
function foldsSummary(full,index){
 const outerInner=full.match(/^(\d+) [^;]*outer folds;\s*(\d+) inner(?: pseudo-label)? folds/);
 const count=full.match(/^(\d+)\b/);
 let short=full;
 if(outerInner)short=`${outerInner[1]} outer / ${outerInner[2]} inner`;
 else if(count)short=count[1]+' folds';
 else if(full.startsWith('Five 400-row contexts'))short='5 contexts';
 else if(full.startsWith('Native workflow'))short='Native workflow';
 const tooltipId='method-folds-'+index;
 const help=short!==full?`<span class="method-fold-help"><button type="button" class="method-fold-toggle" aria-label="Fold and context details" aria-describedby="${tooltipId}">?</button><span id="${tooltipId}" class="method-fold-tooltip" role="tooltip">${esc(full)}</span></span>`:'';
 return `<p><span class="method-fold-summary">${esc(short)}</span>${help}</p>`;
}
function bootstrapSummary(detail){
 const count=String(detail.bootstrap??'').trim();
 const bootInterval=detail.settings?.some(([label,value])=>label==='Interval construction'&&/\bbootstrap\b/i.test(value));
 if(/^\d+$/.test(count)||bootInterval)return 'Used';
 return count;
}
function methodKey(r){return [current()?.id,r.family,r.source_method||r.method,r.configuration||''].join('::');}
function methodCell(r,index){
 const open=expandedMethods.has(methodKey(r));
 const sample=r.status==='partial'?`<span class="org">${r.tables.toLocaleString('en-US')} / ${current().tables.toLocaleString('en-US')} tables</span>`:'';
 return `<button type="button" class="method-toggle" data-toggle-method="${index}" aria-expanded="${open}" aria-controls="method-details-${index}"><span><span class="mname">${esc(displayMethodName(r))}</span>${sample}</span><span class="method-chevron" aria-hidden="true">${open?'⌃':'⌄'}</span></button>`;
}
function methodDetails(r,index){
 const s=current(),ref=ArenaMethodReferences.lookup(task,r),detail=methodFacts(r,s);
 const detailValue=value=>{
  const text=String(value??'').trim()||'Not reported';
  return s.domain==='iv'&&text==='Not reported'?'—':text;
 };
 const estimator=estimatorSummary(r,s,detail);
 const fact=value=>`<p>${esc(detailValue(value))}</p>`;
 const facts=[
  ['Method',fact(displayMethodName(r))],
  ['Estimator / model',fact(estimator)],
  ['Folds / contexts',foldsSummary(detailValue(detail.folds),index)],
  ['Bootstrap',fact(bootstrapSummary(detail))]
 ];
 const provided=detail.settings??r.settings;
 const settings=Array.isArray(provided)?provided.filter(row=>Array.isArray(row)&&row.length===2&&row[0]&&row[1]):[];
 if(!settings.length)settings.push(['Settings',detail.configuration]);
 const description=r.status==='reviewed'?detail.estimator:estimatorDescriptions.get(estimator)??detail.estimator;
 if(description&&description!==estimator)settings.unshift(['Estimator details',description]);
 const configId='method-config-'+index;
 const configRows=settings.map(([label,value])=>`<tr><th scope="row">${esc(label)}</th><td>${esc(detailValue(value))}</td></tr>`).join('');
 const configuration=`<div class="method-detail-extra"><strong id="${configId}">Configuration</strong><div class="method-config-box"><table class="method-settings" aria-labelledby="${configId}"><tbody>${configRows}</tbody></table></div></div>`;
 const references=[];
 if(r.status==='reviewed'){
  const url=ArenaMethodReferences.safeURL(r.method_url,'method');
  if(url)references.push(`<div><strong>Method</strong> <a class="method-reference-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Code or method card ↗</a></div>`);
  references.push(`<div><strong>Submission</strong> <a class="method-reference-link" href="https://github.com/Statsinference/Statistical-Intelligence-Arena/issues/${r.issue_number}" target="_blank" rel="noopener noreferrer">#${r.issue_number} ↗</a></div>`);
 }
 const paper=ref?.paper,paperURL=ArenaMethodReferences.safeURL(paper?.url,'paper');
 if(paperURL)references.push(`<div><strong>Method reference</strong> <a class="method-reference-link" href="${esc(paperURL)}" target="_blank" rel="noopener noreferrer">${esc(paper.title||'Paper')} ↗</a>${paper.citation?`<p>${esc(paper.citation)}</p>`:''}</div>`);
 // The DR-DiD paper describes the estimator, not a PFN-DiD-specific model.
 if(s.id==='did-test-2026-11-16')references.push('<div><strong>DR-DiD estimator reference</strong> <a class="method-reference-link" href="https://arxiv.org/abs/1812.01723" target="_blank" rel="noopener noreferrer">Sant’Anna and Zhao, Doubly Robust Difference-in-Differences Estimators ↗</a></div>');
 const modelURL=ArenaMethodReferences.safeURL(ref?.huggingface?.url,'huggingface');
 if(modelURL)references.push(`<div><strong>Model</strong> <a class="method-reference-link" href="${esc(modelURL)}" target="_blank" rel="noopener noreferrer">Hugging Face ↗</a></div>`);
 if(s.domain==='mediation')references.push('<div><strong>Benchmark</strong> <a class="method-reference-link" href="mediation/">Causal Mediation Analysis task and data →</a></div>');
 const referenceSection=references.length?`<div class="method-reference-links">${references.join('')}</div>`:'';
 return `<tr class="method-details-row" id="method-details-${index}"><td colspan="8"><div class="method-details"><div class="method-detail-grid">${facts.map(([label,body])=>`<div><strong>${esc(label)}</strong>${body}</div>`).join('')}${configuration}</div>${referenceSection}</div></td></tr>`;
}
// Rank within the current domain only. Missing results always sort last.
function metricScore(row,key){
 if(row.status==='partial'||!finite(row[key]))return null;
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
 if(task==='mediation'&&reviewedError)notes.push('Reviewed submission results are temporarily unavailable.');
 if(rs.some(r=>r.status==='partial'))notes.push('Partial evaluations appear without ranks and are omitted from the comparison charts.');
 if(rs.some(r=>r.approximate_metrics?.length))notes.push('≈ Approximate value.');
 if(rs.some(r=>metricKeys.some(k=>!finite(r[k]))))notes.push('— Not reported.');
 $('#table-note').textContent=notes.join(' ');$('#table-note').hidden=!notes.length;
}
// These are the targets of the current releases, not definitions of every
// estimand that may be studied in a domain. MathML avoids a network dependency.
const potentialOutcome=(a)=>`<msup><mi>Y</mi><mrow><mo>(</mo><mn>${a}</mn><mo>)</mo></mrow></msup>`;
const meanContrast=potentialOutcome(1)+'<mo>−</mo>'+potentialOutcome(0);
const mediatorOutcome=(a)=>`<msup><mi>M</mi><mrow><mo>(</mo><mn>${a}</mn><mo>)</mo></mrow></msup>`;
const nestedOutcome=(a)=>`<msup><mi>Y</mi><mrow><mo>(</mo><mn>1</mn><mo>,</mo>${mediatorOutcome(a)}<mo>)</mo></mrow></msup>`;
const postOutcome=(a)=>`<msup><msub><mi>Y</mi><mtext>post</mtext></msub><mrow><mo>(</mo><mn>${a}</mn><mo>)</mo></mrow></msup>`;
const mml=(body,label)=>`<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="${esc(label)}">${body}</math>`;
const expectation=(inside)=>`<mi mathvariant="double-struck">E</mi><mo>[</mo>${inside}<mo>]</mo>`;
const targetDefinitions={
 ate:mml('<mi>ATE</mi><mo>=</mo>'+expectation(meanContrast),'ATE equals the expected difference between potential outcomes under treatment and control'),
 cate:mml('<mi>CATE</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'+expectation(meanContrast+'<mo>∣</mo><mi>X</mi><mo>=</mo><mi>x</mi>'),'CATE at x equals the expected treatment effect conditional on X equals x'),
 mediation:mml('<mi>NIE</mi><mo>=</mo>'+expectation(nestedOutcome(1)+'<mo>−</mo>'+nestedOutcome(0)),'Natural indirect effect at treatment level one'),
 proximal:mml('<mi>CATE</mi><mo>(</mo><msup><mi>x</mi><mo>∗</mo></msup><mo>)</mo><mo>=</mo>'+expectation(meanContrast+'<mo>∣</mo><mi>X</mi><mo>=</mo><msup><mi>x</mi><mo>∗</mo></msup>'),'CATE at the query point x star'),
 did_sc:mml('<mi>ATT</mi><mo>=</mo>'+expectation(postOutcome(1)+'<mo>−</mo>'+postOutcome(0)+'<mo>∣</mo><mi>A</mi><mo>=</mo><mn>1</mn>'),'Average treatment effect on the treated in the post period')
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
 const domainPage=pageMode==='domain';
 $('#home').hidden=domainPage;
 $('#domain-view').hidden=!domainPage;
 const homeNav=$('#sidebar-home');
 homeNav.classList.toggle('on',!domainPage);
 if(domainPage)homeNav.removeAttribute('aria-current');
 else homeNav.setAttribute('aria-current','page');
 $('#topbar-section').textContent=domainPage?'Leaderboards':'Homepage';
 $('#topbar-context').textContent=domainPage?DOMAINS.find(d=>d.id===task).name:'StatArena';
 document.body.dataset.pageMode=pageMode;
 const d=DOMAINS.find(d=>d.id===task);
 const other=$('#fam-chips [data-fam="other"]');
 if(current()?.rows.some(r=>r.family==='other')){
  if(!other){
   const chip=document.createElement('button');
   chip.className='chip';chip.type='button';chip.dataset.fam='other';chip.textContent=familyNames.other;
   $('#fam-chips').append(chip);
  }
 }else if(other)other.remove();
 for(const b of document.querySelectorAll('[data-t]')){const on=domainPage&&b.dataset.t===task;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
 for(const b of document.querySelectorAll('[data-fam]')){const on=b.dataset.fam===family;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}
 $('#main-panel').setAttribute('aria-labelledby','tab-'+task);$('#hero-title').textContent=d.name;$('#hero-sub').textContent=d.desc;renderDefinition();
 const benchmarkCardLink=$('#benchmark-card-link');
 const benchmarkCard=BENCHMARK_CARDS[task];
 benchmarkCardLink.hidden=!benchmarkCard;
 if(benchmarkCard)benchmarkCardLink.setAttribute('href',benchmarkCard);
 else benchmarkCardLink.removeAttribute('href');
 const comingSoon=loaded&&!loadError&&!current()&&['nonparametric_regression','quantile','semi_supervised','missing_data'].includes(task);
 $('#coming-soon').hidden=!comingSoon;
 document.querySelector('.test-controls').hidden=comingSoon;
 $('#table').hidden=comingSoon;
 $('#methodology').hidden=comingSoon;
 $('#release-status').textContent=loadError?'RESULTS UNAVAILABLE':loaded?'TEST RESULTS':'LOADING RESULTS';
 $('#release-description').textContent=loadError;$('#release-description').hidden=!loadError;
 renderMetrics();document.body.dataset.testView=loaded?'ready':'loading';
}
function readHash(){
 const raw=location.hash.slice(1),p=new URLSearchParams(raw),domain=p.get('domain');
 if(DOMAINS.some(d=>d.id===domain)){task=domain;pageMode='domain';}
 else if(!raw||raw==='home'){pageMode='home';}
 else if(['methodology','table','main-panel'].includes(raw)){pageMode='domain';}
 else pageMode='home';
}
function writeHash(){const p=new URLSearchParams({domain:task});try{history.replaceState(null,'','#'+p);}catch(_){}}
function chooseTask(id){
 if(!DOMAINS.some(d=>d.id===id))return;
 task=id;pageMode='domain';family='all';query='';$('#q').value='';
 writeHash();render();window.scrollTo({top:0,behavior:'instant'});
}
$('#tabs').innerHTML=DOMAINS.map(d=>`<button class="tab" id="tab-${d.id}" data-t="${d.id}" role="tab" aria-controls="main-panel" aria-selected="false" tabindex="-1">${esc(d.name)}</button>`).join('');
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b)chooseTask(b.dataset.t);});
$('#fam-chips').addEventListener('click',e=>{const b=e.target.closest('[data-fam]');if(b){family=b.dataset.fam;render();}});
$('#q').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();renderMetrics();});
$('#rank-metric').addEventListener('change',e=>setRanking(e.target.value));
$('#leaderboard-wrap').addEventListener('click',e=>{
 const help=e.target.closest('.method-fold-help');
 for(const open of e.currentTarget.querySelectorAll('.method-fold-help.is-pinned')){
  if(open!==help)open.classList.remove('is-pinned');
 }
 if(e.target.closest('.method-fold-toggle')){
  help.removeAttribute('data-dismissed');
  help.classList.toggle('is-pinned');
  return;
 }
 const toggle=e.target.closest('[data-toggle-method]');
 if(toggle){
  const index=Number(toggle.dataset.toggleMethod),row=sortedRows()[index];
  if(!row)return;
  const key=methodKey(row);expandedMethods.has(key)?expandedMethods.delete(key):expandedMethods.add(key);
  renderMetrics();$('#leaderboard-wrap').querySelector(`[data-toggle-method="${index}"]`)?.focus();return;
 }
 const b=e.target.closest('[data-sort]');if(b)setRanking(b.dataset.sort,true);
});
$('#leaderboard-wrap').addEventListener('keydown',e=>{
 const help=e.target.closest('.method-fold-help');
 if(e.key==='Escape'&&help){
  help.classList.remove('is-pinned');
  help.setAttribute('data-dismissed','');
 }
});
$('#leaderboard-wrap').addEventListener('focusout',e=>{
 e.target.closest('.method-fold-help')?.removeAttribute('data-dismissed');
});
function csvCell(v){let s=String(v??'');if(typeof v==='string'&&/^[=+@\t\r-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$('#export-btn').addEventListener('click',()=>{
 const s=current();if(!s)return;const keys=['rank','domain','evaluation','method','configuration','source_method',...metricKeys,'approximate_metrics','tables','source_file','aggregation','variance_definition','timing','status'];
 const ranks=rankMap();
 const rr=sortedRows().map(r=>({...r,configuration:r.details?.configuration??r.configuration,rank:ranks.get(r),domain:task,evaluation:'Test',approximate_metrics:r.approximate_metrics.join(';'),source_file:r.status==='reviewed'?'https://github.com/Statsinference/Statistical-Intelligence-Arena/issues/'+r.issue_number:r.source?.file??s.source.file,aggregation:r.aggregation??s.aggregation,variance_definition:r.variance_definition??s.variance_definition,timing:r.status==='reviewed'?(finite(r.time_s)?'Mean per table; protocol in linked submission':'Not reported'):r.timing??s.timing}));
 const text=[keys.join(','),...rr.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='statarena-'+task+'-test.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4500);}
function theme(value){document.documentElement.dataset.theme=value;$('#theme-btn').setAttribute('aria-label',value==='dark'?'Switch to light theme':'Switch to dark theme');}
$('#theme-btn').addEventListener('click',()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
window.addEventListener('hashchange',()=>{
 readHash();render();
 const anchor=location.hash.slice(1);
 if(anchor==='home'||anchor.startsWith('domain='))window.scrollTo({top:0,behavior:'instant'});
 else if(['table','methodology','main-panel'].includes(anchor))
  requestAnimationFrame(()=>document.getElementById(anchor)?.scrollIntoView({block:'start'}));
});
window.ArenaTestView=Object.freeze({aggregateRows,getSuites:()=>testSuites,metrics:metricKeys});
readHash();render();
async function fetchData(path){
 const response=await fetch('data/'+path,{cache:'no-cache'});
 if(!response.ok)throw Error('Result data request failed');
 return response.json();
}
const reviewedData=fetchData('mediation-reviewed.json').then(reviewedMediationRows).catch(error=>{
 reviewedError=true;console.error(error);return [];
});
Promise.all([fetchData('results.json'),fetchData('mediation-fivefold.json'),fetchData('unified-test-2026-11-16.json'),fetchData('iv-v03.json'),reviewedData]).then(data=>{
 testSuites=buildTestSuites(...data);loaded=true;render();
}).catch(error=>{loaded=true;loadError='Could not load Test results. Please refresh or contact the maintainers.';render();console.error(error);});
