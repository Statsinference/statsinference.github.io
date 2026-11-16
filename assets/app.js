'use strict';
// Presentation only. No evaluation scores are invented or derived here.
const DOMAINS = [
 {id:'ate',name:'ATE',short:'Average treatment effects',desc:'Point estimates and confidence intervals for average treatment effects.'},
 {id:'cate',name:'CATE',short:'Conditional treatment effects',desc:'Inference for conditional treatment effects at specified covariate queries.'},
 {id:'mediation',name:'Mediation',short:'Direct and indirect effects',desc:'Statistical inference for explicitly defined direct, indirect, and mediation targets.'},
 {id:'iv',name:'Instrumental Variables',short:'IV inference',desc:'Inference with instrumental variables under each task’s stated identification assumptions.'},
 {id:'proximal',name:'Proximal Causal Inference',short:'Proxy-based inference',desc:'Causal inference with proxy variables under each task’s stated assumptions.'},
 {id:'did_sc',name:'DiD / Synthetic Control',short:'Panel and policy effects',desc:'Inference for difference-in-differences and synthetic-control targets.'},
 {id:'nonparametric_regression',name:'Nonparametric Regression',short:'Regression function inference',desc:'Point estimates and confidence intervals for specified regression-function queries.'},
 {id:'quantile',name:'Quantile Inference',short:'Quantiles and distributions',desc:'Inference for explicitly specified quantile and distributional targets.'},
 {id:'semi_supervised',name:'Semi-Supervised Inference',short:'Labeled and unlabeled data',desc:'Statistical inference using labeled and unlabeled observations.'},
 {id:'missing_data',name:'Missing Data',short:'Partially observed data',desc:'Inference under each task’s declared observation and missingness mechanisms.'}
];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>typeof v==='number'&&Number.isFinite(v);
const KNOWN=new Set(DOMAINS.map(d=>d.id)),GROUPS=['ID','OOD'];
const COLS=[{k:'group',label:'Group'},{k:'method',label:'Method'},{k:'bias',label:'Bias',hint:'Signed bias. Sorting uses absolute bias; zero is the reference.'},{k:'variance',label:'Variance',hint:'Source-specific variance definition; see the evaluation note. This is not always within-mechanism sampling variance.'},{k:'rmse',label:'RMSE',hint:'Lower is better for the same target and evaluation suite.'},{k:'length',label:'Length',hint:'Mean confidence interval length. Interpret jointly with coverage.'},{k:'coverage',label:'Coverage',hint:'Compare with the nominal level; higher is not automatically better.'},{k:'time_s',label:'Time (s)',hint:'Reported runtime per table. Check hardware and timing scope.'}];
let DATA={schema_version:1,suites:[]},task='mediation',split='both',family='all',query='',suiteId='',sortKey='rmse',sortDir=1,loadError='';
function validate(data){
 if(data?.schema_version!==1||!Array.isArray(data.suites))throw Error('Unsupported results schema');
 const ids=new Set();
 for(const s of data.suites){
  if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||!KNOWN.has(s.domain)||!Array.isArray(s.rows))throw Error('Invalid evaluation suite');
  ids.add(s.id);if(s.rows.length&&(typeof s.target!=='string'||!s.target.trim()))throw Error('A published suite requires an estimand');
  if(s.nominal_coverage!=null&&(!number(s.nominal_coverage)||s.nominal_coverage<=0||s.nominal_coverage>=1))throw Error('Invalid nominal coverage');
  const keys=new Set();
  for(const r of s.rows){
   if(!r||!GROUPS.includes(r.group)||!['pfn','classical'].includes(r.family)||typeof r.method!=='string'||!r.method.trim())throw Error('Invalid result row');
   const key=JSON.stringify([r.group,r.method_id||r.method]);if(keys.has(key))throw Error('Duplicate method and split');keys.add(key);
   if(r.status==='not_reported'&&COLS.slice(2).some(c=>r[c.k]!=null))throw Error('Unreported row must not contain metrics');
   for(const {k} of COLS.slice(2)){const v=r[k];if(v==null)continue;if(!number(v)||(k!=='bias'&&v<0)||(k==='coverage'&&v>1))throw Error('Invalid metric: '+k);}
  }
 }
 return data;
}
const suites=()=>DATA.suites.filter(s=>s.domain===task),current=()=>suites().find(s=>s.id===suiteId)||suites()[0]||null;
const groups=()=>split==='both'?GROUPS:[split];
function rows(useSplit=true){return (current()?.rows||[]).filter(r=>(family==='all'||r.family===family)&&(!query||(r.method+' '+(r.org||'')).toLowerCase().includes(query))&&(!useSplit||split==='both'||r.group===split));}
function fmt(n,signed=false){if(!number(n))return '—';const a=Math.abs(n),v=a!==0&&(a>=10000||a<.0001)?a.toExponential(2):a>=100?a.toLocaleString('en-US',{maximumFractionDigits:3}):a.toFixed(3);return (n<0?'−':signed&&n>0?'+':'')+v;}
const metric=(r,k)=>{
 if(!number(r[k]))return '—';
 if(r.display&&typeof r.display[k]==='string')return esc(r.display[k]);
 if(k==='coverage')return (r[k]*100).toFixed(2)+'%';
 const v=r[k],a=Math.abs(v),digits=k==='time_s'?(r.time_digits??3):k==='variance'?5:4;
 const text=a!==0&&(a>=10000||a<.0001)?a.toExponential(2):a.toFixed(digits);
 return (k==='variance'&&r.variance_is_approximate?'≈':'')+(v<0?'−':k==='bias'&&v>0?'+':'')+text;
};
const pill=f=>`<span class="fam ${f}">${f==='pfn'?'PFN':'Classical'}</span>`;
function compare(a,b,key=sortKey,dir=sortDir){let av=a[key],bv=b[key];if(key==='method')return String(av).localeCompare(String(bv))*dir;if(!number(av))return number(bv)?1:0;if(!number(bv))return -1;if(key==='bias'){av=Math.abs(av);bv=Math.abs(bv);}return (av-bv)*dir;}
const ICONS={ranking:'<path d="M5 18V12m7 6V6m7 12V3M3 21h18"/>',shift:'<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',runtime:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',coverage:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>'};
function empty(kind,title,detail){return `<div class="card-empty"><span class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind]}</svg></span><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;}
function renderTop(){const rr=rows().filter(r=>number(r.rmse));if(!rr.length){$('#top10').innerHTML=empty('ranking','The first results are on their way.','Method rankings will appear here when results are published.');return;}
 $('#top10').innerHTML=groups().map(g=>{const list=rr.filter(r=>r.group===g).sort((a,b)=>compare(a,b,'rmse',1)).slice(0,10);return `<div class="split-title">${g}</div>`+(list.length?list.map((r,i)=>`<div class="top-row"><span class="rank">${list.length>1?String(i+1).padStart(2,'0'):'—'}</span><span>${esc(r.method)}${pill(r.family)}</span><span class="num">${metric(r,'rmse')}</span></div>`).join(''):'<div class="split-title">No published results for this split.</div>');}).join('');}
function renderComparison(){const by=new Map();for(const r of rows(false)){const key=r.method_id||r.method;if(!by.has(key))by.set(key,{name:r.method});by.get(key)[r.group]=r;}
 if(!by.size){$('#h2h-list').innerHTML=empty('shift','Beyond the training distribution.','ID and OOD comparisons will appear side by side.');return;}
 $('#h2h-list').innerHTML='<div class="comparison-row"><span>Method</span><span class="num">ID RMSE</span><span class="num">OOD RMSE</span></div>'+[...by.values()].map(r=>`<div class="comparison-row"><span>${esc(r.name)}</span><span class="num" style="color:var(--pfn)">${r.ID?metric(r.ID,'rmse'):'—'}</span><span class="num" style="color:var(--classical)">${r.OOD?metric(r.OOD,'rmse'):'—'}</span></div>`).join('');}
function scatter(selector,xkey,ykey,xlabel,ylabel,isCoverage=false){const rr=rows().filter(r=>number(r[xkey])&&number(r[ykey]));
 if(!rr.length){$(selector).innerHTML=isCoverage?empty('coverage','Confidence, with context.','Coverage and interval length will be displayed together.'):empty('runtime','Precision meets efficiency.','Reported RMSE and runtime will appear here.');return;}
 const W=520,H=240,L=64,R=20,T=22,B=42,xmax=Math.max(...rr.map(r=>r[xkey]),1e-9)*1.14,ymax=isCoverage?1:Math.max(...rr.map(r=>r[ykey]),1e-9)*1.14;
 const X=v=>L+v/xmax*(W-L-R),Y=v=>H-B-v/ymax*(H-T-B);
 let svg=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ylabel+' versus '+xlabel)}">`;
 for(let i=0;i<=4;i++){const x=xmax*i/4,y=ymax*i/4;svg+=`<line class="gridl" x1="${L}" x2="${W-R}" y1="${Y(y)}" y2="${Y(y)}"/><text x="${L-7}" y="${Y(y)+4}" text-anchor="end">${isCoverage?Math.round(y*100)+'%':fmt(y)}</text><text x="${X(x)}" y="${H-B+16}" text-anchor="middle">${fmt(x)}</text>`;}
 svg+=`<line class="axis" x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}"/><text x="${(L+W-R)/2}" y="${H-4}" text-anchor="middle">${esc(xlabel)}</text><text transform="translate(12 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle">${esc(ylabel)}</text>`;
 const nominal=current()?.nominal_coverage;if(isCoverage&&number(nominal))svg+=`<line x1="${L}" x2="${W-R}" y1="${Y(nominal)}" y2="${Y(nominal)}" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${W-R}" y="${Y(nominal)-7}" text-anchor="end">Nominal ${(100*nominal).toFixed(0)}%</text>`;
 for(const r of rr){const x=X(r[xkey]),y=Y(r[ykey]),color=`var(--${r.family==='pfn'?'pfn':'classical'})`,title=esc(`${r.method} · ${r.group}: ${xlabel} ${fmt(r[xkey])}; ${ylabel} ${metric(r,ykey)}`);svg+=r.group==='ID'?`<circle cx="${x}" cy="${y}" r="5" fill="${color}"><title>${title}</title></circle>`:`<path d="M${x} ${y-6}l6 6-6 6-6-6z" fill="${color}"><title>${title}</title></path>`;}
 $(selector).innerHTML=svg+'</svg>';}
function renderTable(){
 $('#thead').innerHTML=COLS.map((c,i)=>`<th scope="col" class="${i>1?'r':''} ${sortKey===c.k?'sorted':''}"${c.k==='group'?'':` aria-sort="${sortKey===c.k?(sortDir===1?'ascending':'descending'):'none'}"`} title="${esc(c.hint||c.label)}">${c.k==='group'?c.label:`<button data-sort="${c.k}">${c.label}${sortKey===c.k?`<span class="arrow">${sortDir===1?'↑':'↓'}</span>`:''}</button>`}</th>`).join('');
 const rr=rows();$('#export-btn').disabled=!rr.some(r=>r.status!=='not_reported');
 $('#tbody').innerHTML=groups().map(g=>{const gr=rr.filter(r=>r.group===g).sort(compare);if(!gr.length)return `<tr class="row-pending"><td><span class="group-tag ${g.toLowerCase()}">${g}</span></td><td>${loadError?'Results unavailable':current()?'No matching published results':'Results not yet published'}</td>${COLS.slice(2).map(()=>'<td class="r num">—</td>').join('')}</tr>`;return gr.map(r=>`<tr class="${r.status==='not_reported'?'row-unreported':'row-reported'}"><td><span class="group-tag ${g.toLowerCase()}">${g}</span></td><td><span class="mname">${esc(r.method)}</span>${pill(r.family)}${r.status==='not_reported'?'<span class="org missing-result">Not reported for this run</span>':''}${r.org?`<span class="org">${esc(r.org)}</span>`:''}</td>${COLS.slice(2).map(c=>`<td class="r num"${c.k==='variance'&&r.variance_is_approximate?` title="Approximate: reported SE ${r.reported_se} squared. The source SE was rounded."`: ''}>${metric(r,c.k)}</td>`).join('')}</tr>`).join('');}).join('');}
function renderResults(){renderTop();renderComparison();scatter('#pareto','time_s','rmse','Time per table (s)','RMSE');scatter('#coverage-chart','length','coverage','Mean CI length','Coverage',true);renderTable();}
function render(){const d=DOMAINS.find(x=>x.id===task),s=current(),available=suites();
 for(const b of document.querySelectorAll('[data-t]')){const on=b.dataset.t===task;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
 for(const [attr,val] of [['split',split],['fam',family]])for(const b of document.querySelectorAll('[data-'+attr+']')){const on=b.dataset[attr]===val;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}
 $('#main-panel').setAttribute('aria-labelledby','tab-'+task);$('#hero-title').textContent=d.name;$('#hero-sub').textContent=d.desc;$('#tbl-title').textContent=d.name+' — all methods';
 $('#suite-info').innerHTML=s?`<span>Target <b>${esc(s.target)}</b></span><span>n <b>${esc(s.sample_size??'Not reported')}</b></span><span>Nominal coverage <b>${number(s.nominal_coverage)?(s.nominal_coverage*100).toFixed(0)+'%':'Not reported'}</b></span>`:'<span>Targets and evaluation protocols will accompany each release.</span>';
 $('#suite-label').hidden=!available.length;$('#suite-select').innerHTML=available.map(x=>`<option value="${esc(x.id)}" ${x.id===s?.id?'selected':''}>${esc(x.label||x.id)}</option>`).join('');
 $('#view-note').textContent=loadError||(s?'ID and OOD are reported separately.':'Results pending');
 const published=DATA.suites.some(x=>x.rows.some(r=>number(r.rmse)));$('#release-status').textContent=loadError?'RESULTS UNAVAILABLE':published?'EVALUATION RESULTS':'AWAITING FIRST RELEASE';$('#release-description').textContent=loadError|| (published?'Reported separately by domain, target and evaluation suite.':'Results will be published here. No illustrative scores.');
 $('#coverage-sub').textContent=number(s?.nominal_coverage)?'Nominal coverage '+(100*s.nominal_coverage).toFixed(0)+'%':'Coverage relative to nominal level';
 $('#table-note').textContent=s?`${s.aggregation||'Aggregation is specified in the evaluation release.'} ${s.hardware?'Hardware: '+s.hardware+'. ':''}${s.timing_scope?'Timing: '+s.timing_scope+'. ':''}Sorted within each split; coverage is not a higher-is-better score.`:'Bias is compared with zero. Coverage is compared with the nominal level. Missing metrics are shown as —.';
 $('#registry-link').href='https://github.com/Statsinference/stats-inference-arena/blob/main/dgp-submissions/registry/by-domain/'+task+'.md';renderResults();}
function writeHash(){const p=new URLSearchParams({domain:task,split});if(suiteId)p.set('suite',suiteId);try{history.replaceState(null,'','#'+p);}catch(e){/* Local preview without a browsing origin. */}}
function readHash(){const p=new URLSearchParams(location.hash.slice(1));if(KNOWN.has(p.get('domain')))task=p.get('domain');if(['both','ID','OOD'].includes(p.get('split')))split=p.get('split');suiteId=p.get('suite')||'';}
function chooseTask(id){if(!KNOWN.has(id))return;task=id;suiteId='';writeHash();render();$('#tab-'+id).scrollIntoView({block:'nearest',inline:'nearest'});}
$('#tabs').innerHTML=DOMAINS.map(d=>`<button class="tab" id="tab-${d.id}" data-t="${d.id}" role="tab" aria-controls="main-panel" aria-selected="false" tabindex="-1">${esc(d.name)}<small>${esc(d.short)}</small></button>`).join('');
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b)chooseTask(b.dataset.t);});
$('#tabs').addEventListener('keydown',e=>{const b=e.target.closest('[data-t]');if(!b)return;const n=DOMAINS.findIndex(d=>d.id===b.dataset.t);let next;if(e.key==='ArrowRight')next=(n+1)%DOMAINS.length;else if(e.key==='ArrowLeft')next=(n-1+DOMAINS.length)%DOMAINS.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=DOMAINS.length-1;else return;e.preventDefault();chooseTask(DOMAINS[next].id);$('#tab-'+DOMAINS[next].id).focus();});
$('#split-chips').addEventListener('click',e=>{const b=e.target.closest('[data-split]');if(b){split=b.dataset.split;writeHash();render();}});
$('#fam-chips').addEventListener('click',e=>{const b=e.target.closest('[data-fam]');if(b){family=b.dataset.fam;render();}});
$('#q').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();renderResults();});
$('#suite-select').addEventListener('change',e=>{suiteId=e.target.value;writeHash();render();});
$('#thead').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;const k=b.dataset.sort;if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1;}renderTable();});
function csvCell(value){const s=typeof value==='string'&&/^[=+@\t\r-]/.test(value)?"'"+value:String(value??'');return '"'+s.replace(/"/g,'""')+'"';}
$('#export-btn').addEventListener('click',()=>{
 const rr=rows();if(!rr.some(r=>r.status!=='not_reported'))return;
 const keys=[...COLS.map(c=>c.k),'reported_se','variance_is_approximate','variance_basis','status','suite_id','source_date','variance_kind','metric_scale','nominal_coverage','timing_scope','source_file'];
 const out=groups().flatMap(g=>rr.filter(r=>r.group===g).sort(compare)).map(r=>({...r,suite_id:current()?.id,source_date:current()?.report_date,variance_kind:current()?.variance_kind,metric_scale:current()?.metric_scale,nominal_coverage:current()?.nominal_coverage,timing_scope:current()?.timing_scope,source_file:current()?.source?.file}));
 const text=[keys.join(','),...out.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='statistical-inference-arena-'+task+'-'+split+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000);}
function theme(value){document.documentElement.dataset.theme=value;$('#theme-btn').setAttribute('aria-label',value==='dark'?'Switch to light theme':'Switch to dark theme');document.querySelector('meta[name="theme-color"]').content=value==='dark'?'#070c18':'#edf3fc';}
try{const saved=localStorage.getItem('statsarena-theme');if(['dark','light'].includes(saved))theme(saved);}catch(e){}
$('#theme-btn').addEventListener('click',()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';theme(value);try{localStorage.setItem('statsarena-theme',value);}catch(e){}});
$('#share-btn').addEventListener('click',async()=>{if(!/^https?:$/.test(location.protocol)){toast('Share the public website link after deployment.');return;}try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else if(navigator.clipboard){await navigator.clipboard.writeText(location.href);toast('Page link copied.');}else toast('Copy the page address to share.');}catch(e){if(e.name!=='AbortError')toast('Copy the page address to share.');}});
window.addEventListener('hashchange',()=>{readHash();render();});
try{DATA=validate(JSON.parse($('#results-data').textContent));}catch(e){loadError='Unable to load results. Please check the result file.';console.error(e);}
readHash();render();
if(/^https?:$/.test(location.protocol))fetch('data/results.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Results request failed: '+r.status);return r.json();}).then(data=>{DATA=validate(data);loadError='';render();}).catch(e=>{loadError='Result data could not be loaded. Please refresh or contact the maintainers.';render();console.error(e);});
