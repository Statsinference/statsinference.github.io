'use strict';
// All domains retain their source definitions. No cross-domain metric pooling.
const baseValidate=validate;
validate=function(data){
 baseValidate(data);
 for(const s of data.suites){
  for(const key of ['dgp_results','raw_dgp_results']){
   if(s[key]!=null&&!Array.isArray(s[key]))throw Error('Invalid subgroup results');
   for(const r of s[key]||[]){
    if(!GROUPS.includes(r.group)||typeof r.dgp!=='string'||typeof r.method!=='string'||!['pfn','classical'].includes(r.family))throw Error('Invalid subgroup row');
    for(const {k} of COLS.slice(2)){const v=r[k];if(v!=null&&(!number(v)||(k!=='bias'&&v<0)||(k==='coverage'&&v>1)))throw Error('Invalid subgroup metric');}
   }
  }
  for(const r of [...s.rows,...(s.dgp_results||[]),...(s.raw_dgp_results||[])]){
   if(r.variance_is_approximate&&(!number(r.reported_se)||r.reported_se<0||r.variance_basis!=='square_of_rounded_reported_se'||!number(r.variance)||Math.abs(r.variance-r.reported_se*r.reported_se)>1e-10))throw Error('Invalid SE-squared conversion');
   if(r.display&&Object.values(r.display).some(v=>typeof v!=='string'))throw Error('Invalid source display values');
  }
  for(const t of s.timing_comparisons||[]){
   if(t.scope!=='previous_model_and_test_set'||!Array.isArray(t.rows))throw Error('Historical timing cohort must be explicit');
   for(const r of t.rows)if(!number(r.median_time_s)||r.median_time_s<=0||!number(r.median_paired_ratio)||r.median_paired_ratio<=0)throw Error('Invalid historical timing');
  }
 }
 return data;
};
function prepareMetricLabels(){
 const s=current(),norm=!!s?.normalized;
 for(const c of COLS){
  const names={bias:'Bias',variance:'Variance',rmse:'RMSE',length:'Length'};
  if(names[c.k])c.label=(norm?'Norm. ':'')+names[c.k];
  if(c.k==='variance')c.hint=s?.variance_note||'Variance definition is specific to each evaluation release.';
 }
 document.querySelector('[data-card="ranking"] h3').textContent=norm?'Methods by normalized RMSE':'Methods by RMSE';
 document.querySelector('[data-card="runtime"] h3').textContent=norm?'Normalized RMSE vs Time':'RMSE vs Time';
 document.querySelector('[data-card="coverage"] h3').textContent=norm?'Coverage vs normalized Length':'Coverage vs Length';
}
function subgroupTable(rr,useSE=false){
 const varianceKey=useSE?'reported_se':'variance';
 return '<div class="tbl-wrap" tabindex="0" role="region" aria-label="Source-reported subgroup results"><table class="detail-table"><thead><tr>'+['Split','DGP configuration','Method','Bias',useSE?'Reported SE':'Variance','RMSE','Length','Coverage','Time (s)'].map((x,i)=>`<th scope="col" class="${i>2?'r':''}">${x}</th>`).join('')+'</tr></thead><tbody>'+rr.map(r=>`<tr><td>${esc(r.group)}</td><td>${esc(r.dgp)}</td><td>${esc(r.method)}</td>${['bias',varianceKey,'rmse','length','coverage','time_s'].map(k=>`<td class="r num">${metric(r,k)}</td>`).join('')}</tr>`).join('')+'</tbody></table></div>';
}
function renderReleaseDetails(){
 const s=current(),container=$('#report-details');container.hidden=!s?.source;
 if(!s?.source){container.innerHTML='';return;}
 const filter=r=>(split==='both'||r.group===split)&&(family==='all'||r.family===family)&&(!query||(r.method+' '+r.dgp).toLowerCase().includes(query));
 const dd=(s.dgp_results||[]).filter(filter),raw=(s.raw_dgp_results||[]).filter(filter);
 const useSE=dd.some(r=>number(r.reported_se));
 const groupsHTML=dd.length?`<details><summary>Results by DGP <span class="muted">· ${dd.length} method–configuration rows</span></summary><div class="detail-inner"><p>${esc(s.dgp_note||(useSE?'Original reported SE is shown here, not Variance. Aggregates are transcribed separately, not recomputed from rounded subgroup rows.':'Source-reported subgroup metrics; aggregation is specified in the protocol below.'))}</p>${subgroupTable(dd,useSE)}</div></details>`:'';
 const rawHTML=raw.length?`<details><summary>Original-unit appendix <span class="muted">· separate from normalized rankings</span></summary><div class="detail-inner"><p>Source: page 15. Original-unit Bias, error variance, RMSE and Length are retained exactly as reported. These values are not mixed into the normalized main table or charts.</p>${subgroupTable(raw)}</div></details>`:'';
 const timing=(s.timing_comparisons||[]).map(t=>`<section class="timing-block" aria-label="Previous-run CPU comparison"><h3>${esc(t.label)}</h3><span class="scope-badge">PREVIOUS MODEL &amp; TEST SET · TIMING ONLY</span><p class="timing-note">${esc(t.note)}</p><div class="tbl-wrap" tabindex="0"><table class="timing-table"><thead><tr><th>Method</th><th>Configuration</th><th class="r">Median time / table</th><th class="r">Median paired ratio</th></tr></thead><tbody>${t.rows.map(r=>`<tr><td>${esc(r.method)}</td><td>${esc(r.configuration)}</td><td class="r num">${r.median_time_s.toFixed(3)} s</td><td class="r num">${r.median_paired_ratio.toFixed(2)}×</td></tr>`).join('')}</tbody></table></div><p class="data-footnote">${t.tables} matched tables · ${t.threads} CPU threads · ${esc(t.hardware)}. Source: ${esc(t.source_table)}. Not included in the current-run ranking or charts.</p></section>`).join('');
 const facts=[['Target',s.target],['Sampling',s.sample_design],['ID / OOD definition',s.split_definition],['Metric scale',s.metric_scale],['Aggregation',s.aggregation],['Variance / SE',s.variance_note],['Coverage',s.coverage_note],['Hardware',s.hardware],['Timing scope',s.timing_scope],['Methods & availability',s.comparison_note],['Generator scope',s.generator_scope],['Source',s.source.file],['Source location',s.source.locators?.summary],['Source status',s.source.verification]];
 const metadata=[s.source.author,s.source.date].filter(Boolean).map(esc).join(' · ');
 container.innerHTML=`<div class="section-label">SOURCE-REPORTED EVALUATION</div><h2>Results, in context.</h2><div class="release-meta"><span>${esc(s.source.title)}</span>${metadata?'<span>'+metadata+'</span>':''}<a href="data/results.json" download="statistical-inference-arena-results.json">Download reported results ↗</a></div>${groupsHTML}${rawHTML}${timing}<details><summary>Evaluation protocol &amp; source notes</summary><div class="detail-inner"><dl class="release-facts">${facts.filter(([,v])=>v!=null).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div></details>`;
}
renderResults=function(){
 prepareMetricLabels();const norm=!!current()?.normalized;
 renderTop();renderComparison();
 scatter('#pareto','time_s','rmse','Reported time / table (s)',norm?'Normalized RMSE':'RMSE');
 scatter('#coverage-chart','length','coverage',norm?'Normalized mean CI length':'Mean CI length','Coverage',true);
 renderTable();renderReleaseDetails();
};
const baseRender=render;
render=function(){
 baseRender();const s=current(),context=$('#release-context');context.hidden=!s?.source;
 context.innerHTML=s?.source?`<strong>${esc(s.label)}.</strong> ${esc(s.sample_design||'')} <a href="#report-details">Evaluation details ↘</a>`:'';
 if(s){
  $('#view-note').textContent=s.split_label||'Independent ID / OOD evaluation';
  $('#table-note').textContent=s.table_note||[s.variance_note,s.timing_scope].filter(Boolean).join(' ');
 }
 const measured=new Set((s?.rows||[]).filter(r=>number(r.rmse)).map(r=>r.method_id||r.method));
 document.querySelector('[data-card="ranking"] .card-bottom>span').textContent=measured.size===1?'One reported method · no comparative rank':'Within each test split';
 const published=new Set(DATA.suites.filter(x=>x.rows.some(r=>number(r.rmse))).map(x=>x.domain));
 if(!loadError&&published.size){$('#release-status').textContent=published.size+' DOMAINS WITH RESULTS';$('#release-description').textContent='Source-reported results · separate targets, scales and evaluation protocols.';}
 for(const b of document.querySelectorAll('[data-t]')){const yes=published.has(b.dataset.t);b.classList.toggle('has-results',yes);b.title=yes?'Reported results available':'Results not yet published';}
};
try{DATA=validate(DATA);render();}catch(e){loadError='Unable to validate source-reported results.';render();console.error(e);}
