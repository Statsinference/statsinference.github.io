from pathlib import Path
import json, re
P=Path.cwd()
d=json.loads((P/'data/results.json').read_text())
assert len(d['suites'])==1
# Preserve every existing Mediation number; add source-reported domain summaries.
d['release_id']='six-domains-2026-11-15'
def row(group, method, vals, *, se=False, digits=None):
    bias,var,rmse,length,cov,t=vals
    r=dict(group=group,method=method,family='classical' if method in ['RF','RF trim','RF-DR-DiD','RF-Proximal-Bootstrap'] else 'pfn',status='reported',bias=bias,variance=var,rmse=rmse,length=length,coverage=None if cov is None else cov/100,time_s=t)
    if se:r.update(reported_se=var,variance=round(var**2,12),variance_is_approximate=True,variance_basis='square_of_rounded_reported_se')
    if digits is not None:r['time_digits']=digits
    return r
def source(title,file,date=None,loc=''):
    s={'title':title,'file':file,'verification':'Values transcribed from the user-supplied source; models were not rerun by the website.','locators':{'summary':loc}}
    if date:s['date']=date
    return s
paired_variance='Variance ≈ (rounded reported SE)². The original SE is retained. SE is the square root of weighted mean within-mechanism sampling variance from two tables per mechanism, not cross-task error variance or bootstrap SD.'
aggregation='Equal DGP-configuration weights within each split, then equal mechanism and replicate weights. Aggregates are copied from Tables 2–3, not recomputed from rounded subgroup rows.'
for domain,target,values in [
 ('ate','Population ATE = E[Y(1) − Y(0)]',[
  ('ID','CausalPFN',[.0091,.1069,.1211,.2861,76.83,.836]),('ID','RF',[-.0133,.1351,.1446,.6852,98.66,130.278]),
  ('OOD','CausalPFN',[.0207,.0629,.0700,.1719,78.61,.878]),('OOD','RF',[-.0275,.108,.1197,.6746,98.60,144.089])]),
 ('cate','Fixed-query CATE(x) = E[Y(1) − Y(0) | X = x]',[
  ('ID','CausalPFN',[.0086,.2401,.3216,6.4158,100,.168]),('ID','RF',[-.0342,.475,.6314,1.7332,90.68,55.783]),
  ('OOD','CausalPFN',[.0322,.1261,.194,3.929,100,.215]),('OOD','RF',[.042,.3244,.3474,.9778,89.44,69.712])])]:
    s={'id':domain+'-causalpfn-collected-dgps','domain':domain,'label':'CausalPFN / RF · collected DGPs','target':target,'sample_size':500,'nominal_coverage':.95,'source':source('ATE and CATE Evaluation — Using Our Collected DGPs as ID','ATE_CATE_Report.pdf',loc='Page 1, Tables 2–3; definitions on page 2; timing on page 4'),
       'sample_design':'1,000 tables per split, 500 mechanisms and two independent tables per mechanism; n = 500. ATE and CATE reuse the same observed tables. All evaluations succeeded.',
       'aggregation':aggregation,'variance_note':paired_variance,'variance_kind':'within_mechanism_sampling','metric_scale':'original outcome/effect units','split_label':'Operational ID / OOD',
       'split_definition':'ID = ten collected reference configurations; OOD = three additional structural shifts. These are operational labels, not established membership in the checkpoint pretraining distribution. S01/S02 share source papers with ID configurations.',
       'hardware':'CausalPFN: one NVIDIA L40 per persistent worker (four workers). RF: 64 single-thread CPU processes on a server reporting 224 cores.',
       'timing_scope':'Warm per-table point-plus-interval latency including preprocessing, auxiliary fits, RF fits and B=100 bootstrap; excluding loading, warm-up, data generation, disk I/O and queue waiting. No matched-hardware speedup is established.',
       'comparison_note':'Official frozen CausalPFN checkpoint with native interval APIs vs RF. ATE RF = two-fold AIPW; CATE RF = T-learner. Whole-row RF bootstrap B=100. Native intervals are reported without post-hoc recalibration.',
       'coverage_note':'Nominal coverage 95%. CausalPFN ATE undercoverage and wide, 100%-coverage CATE intervals are retained as reported.',
       'generator_scope':'Thirteen low-dimensional, declared literature-DGP adaptations; original units, no scale standardization.',
       'table_note':'Original units · Variance ≈ reported SE² (within-mechanism) · Weighted by DGP · Times use different CPU/GPU hardware; no matched-hardware speedup.',
       'rows':[row(g,m,v,se=True) for g,m,v in values]}
    d['suites'].append(s)
iv_vals=[('ID','PFN',[.003,.072,.267,.901,95.1,2.28]),('ID','RF',[.034,.160,.401,1.060,95.7,7.91]),('ID','RF trim',[.023,.092,.304,.969,95.7,7.62]),('OOD','PFN',[.001,.029,.170,.666,95.7,2.24]),('OOD','RF',[-6.12,150000,382,240000,60.2,8.27]),('OOD','RF trim',[-.011,.084,.290,1.278,99.3,7.65])]
iv={'id':'iv-v0.2','domain':'iv','label':'IV · v0.2 · formal results','target':'IV v0.2 target — exact estimand definition pending in the supplied results','sample_size':500,'nominal_coverage':None,
 'source':source('IV formal results v0.2','User-supplied IV results table',loc='Six ID/OOD × method rows supplied directly by the project contributor'),
 'sample_design':'1,000 tables per split; n = 500. Mechanism-level replication details were not supplied with this table.',
 'split_label':'ID / OOD (as supplied)','split_definition':'ID and OOD labels are preserved from the supplied v0.2 table; the precise split construction was not supplied.',
 'aggregation':'All values copied exactly from the supplied v0.2 table. Weighting was not specified; no recomputation or outlier removal.',
 'variance_note':'Variance is reported directly by the contributor. Whether it is within-mechanism sampling variance or cross-task error variance is not specified in the supplied table.',
 'variance_kind':'source_unspecified','metric_scale':'Source-reported units; normalization not specified',
 'coverage_note':'Observed coverage is preserved as supplied. The nominal level and interval construction were not explicitly supplied with this table.',
 'hardware':'Not specified in the supplied table','timing_scope':'Reported seconds retained. Timing boundaries and hardware remain unspecified; no speedup claim.',
 'comparison_note':'PFN, RF and RF trim remain separate methods. The RF trim rule is not supplied. The large OOD RF values are retained, not clipped or replaced.',
 'table_note':'v0.2 · n = 500 · 1,000 tables per split · Original supplied values, including OOD RF outliers · Exact target, variance definition, nominal level and timing protocol pending.',
 'rows':[row(g,m,v) for g,m,v in iv_vals]}
iv_display=[['+0.003','0.072','0.267','0.901','95.1%','2.28'],['+0.034','0.160','0.401','1.060','95.7%','7.91'],['+0.023','0.092','0.304','0.969','95.7%','7.62'],['+0.001','0.029','0.170','0.666','95.7%','2.24'],['−6.12','1.5×10⁵','382','2.4×10⁵','60.2%','8.27'],['−0.011','0.084','0.290','1.278','99.3%','7.65']]
for r,v in zip(iv['rows'],iv_display):r['display']=dict(zip(['bias','variance','rmse','length','coverage','time_s'],v))
d['suites'].append(iv)
prox={'id':'proximal-id10-v3-normalized','domain':'proximal','label':'Proximal v3 · normalized by SD(Y)','target':'One query per task: CATE(x) = E[Y(1) − Y(0) | X = x]','sample_size':500,'nominal_coverage':.95,'report_date':'2026-11-15',
 'source':source('Proximal ID10 Bootstrap Evaluation — v3','Proximal_v3report.pdf','2026-11-15','Pages 8–9 normalized metrics; page 11 pooled coverage; page 15 original-unit appendix'),
 'sample_design':'1,000 new ID10 tables and 1,000 retained OOD tables, each n = 500. All 4,000 method calls succeeded. 335 complete OOD method pairs and their historical times were reused; 1,665 pairs were newly evaluated.',
 'split_label':'ID10 / Source-OOD','split_definition':'ID10 restricts and reweights ten native activation-construction subfamilies; it is not the exact training mixture. OOD comprises Cui linear bridge, Qi quadratic and Qi trigonometric mechanisms (343/321/336 tables).',
 'aggregation':'Primary metrics normalize each task by its own observed Y sample SD before equal-table aggregation. Pooled OOD Bias/RMSE/Length come from page 9 and Coverage from page 11. Pooled OOD normalized variance and per-split time are not supplied; they are left blank, not inferred from rounded family results.',
 'variance_note':'Var((estimate − reference CATE) / SD(Y), ddof=1) across tasks. This is normalized error variance, not fixed-mechanism sampling variance and not bootstrap variance.',
 'variance_kind':'cross_task_error','metric_scale':'normalized_by_task_y_sd','normalized':True,
 'hardware':'CPU: 16 shared-resource workers; one Torch/BLAS thread per worker; RF n_jobs=1.',
 'timing_scope':'Complete point-plus-interval computation including RF B=200 refits; excluding model loading, warm-up, data/oracle generation and I/O. Historical timings are retained. Pooled ID/OOD time is not reconstructed from rounded subgroup data.',
 'comparison_note':'Frozen ProximalFM native equal-tail credible intervals vs a custom RF-Proximal-Bootstrap B=200 baseline; this is not a reproduction of published P-learner(RF).',
 'coverage_note':'Nominal 95%; all planned outputs valid. Pooled OOD coverage: ProximalFM 94.8%, RF 100%. Qi-quadratic ProximalFM coverage is 86.3%, so the pooled value does not replace family diagnostics.',
 'generator_scope':'ID reference CATE uses K=4096 paired Monte Carlo draws, with finite reference uncertainty. OOD reference CATE is analytic.',
 'table_note':'NORMALIZED: Bias, error variance, RMSE and Length use each table’s SD(Y). Coverage and time retain original units. Pooled OOD variance/time are not reported. Original-unit appendix is available below.',
 'dgp_note':'Page 8: normalized values, with OOD family counts 343/321/336. These are source-reported subgroup results, not new experiments.',
 'rows':[row('ID','ProximalFM',[.004,.048,.220,.633,93.7,1.193]),row('ID','RF-Proximal-Bootstrap',[.012,.703,.838,2.730,97.4,117.440]),row('OOD','ProximalFM',[.019,None,.123,.367,94.8,None]),row('OOD','RF-Proximal-Bootstrap',[.005,None,.377,2.115,100,None])],
 'dgp_results':[], 'raw_dgp_results':[]}
for name,count,g,vals,raw in [
 ('ID10 aggregate',1000,'ID',[[.004,.048,.220,.633,93.7,1.193],[.012,.703,.838,2.730,97.4,117.440]],[[1.278,856.048,29.272,15.556,93.7,1.193],[2.891,4797.557,69.290,51.251,97.4,117.440]]),
 ('Cui linear bridge',343,'OOD',[[.022,.000925,.038,.221,99.7,1.183],[.013,.109,.330,1.652,100,119.644]],[[.068,.009,.119,.676,99.7,1.183],[.033,1.056,1.027,5.108,100,119.644]]),
 ('Qi quadratic',321,'OOD',[[.035,.032,.181,.385,86.3,1.175],[-.024,.137,.371,2.326,100,119.034]],[[.116,.359,.609,1.271,86.3,1.175],[-.095,1.639,1.282,7.778,100,119.034]]),
 ('Qi trigonometric',336,'OOD',[[.000361,.012,.110,.500,97.9,1.171],[.025,.180,.424,2.385,100,118.424]],[[-.000959,.080,.282,1.269,97.9,1.171],[.059,1.121,1.059,6.017,100,118.424]])]:
    for j,m in enumerate(['ProximalFM','RF-Proximal-Bootstrap']):
        for key,data in [('dgp_results',vals),('raw_dgp_results',raw)]:
            r=row(g,m,data[j]);r.update(dgp=name,tables=count);prox[key].append(r)
d['suites'].append(prox)
did={'id':'did-att-experiment3-2026-11-13','domain':'did_sc','label':'DiD · Experiment 3 · separate training seeds','target':'Population ATT in a two-period panel','sample_size':500,'nominal_coverage':.95,'report_date':'2026-11-13',
 'source':source('PFN-DiD: third experiment — Reverted DGPs, training protocol and evaluation','PFN_DiD_Experiment3_Report_2026-11-13.pdf','2026-11-13','Page 2, Tables 2–3; metric definitions on page 2; runtime on page 6'),
 'sample_design':'Each of five runs evaluated the same 1,000 ID and 1,000 OOD tables; all 10,000 estimates succeeded. One table per mechanism. S1/S2 are separate trained runs, not independent repeats or an ensemble.',
 'split_label':'ID / Source-OOD','split_definition':'Ten ID families and three source-OOD families excluded from adapter training and validation. Upstream TabPFN pretraining exposure is not established.',
 'aggregation':'Equal weight per table within each split; reported values copied from Tables 2–3. S1 and S2 remain separate, with no averaging or best-seed selection.',
 'variance_kind':'cross_task_error','metric_scale':'original effect units','variance_note':'Sample variance of cross-table ATT estimation errors, denominator M−1. It mixes sampling variation and error heterogeneity across mechanisms; with one table per mechanism it is not a within-mechanism sampling variance.',
 'hardware':'PFN: shared MTT S5000 / MUSA GPUs. RF: eight single-thread CPU workers.',
 'timing_scope':'Per-table elapsed computation including preprocessing, transfer/synchronization, nuisance folds and DR scoring or RF fitting. Excludes file reading, loading and warm-up. Different hardware/concurrency; no matched-hardware speedup.',
 'comparison_note':'DirectATT S1/S2, PS/OR-DR S1/S2 and RF-DR-DiD are separate procedures. RF uses an analytic difference-in-mean-changes path on no-X tables; no RF bootstrap was run.',
 'generator_scope':'Source mechanisms adapted to scalar two-period ATT. Some added-covariate extensions were reverted; not all original paper designs were restored.',
 'coverage_note':'Nominal 95%. DirectATT OOD undercoverage is retained; DR methods use clipped propensities and influence-function intervals. Aggregate coverage does not establish per-mechanism calibration.',
 'table_note':'Original units · Variance = cross-table error variance (not within-mechanism) · One table per mechanism · Training seeds listed separately · CPU/GPU times are not hardware-matched.',
 'rows':[]}
for g,rows in [('ID',[
 ('DirectATT S1',[-.0144,.0289,.1706,.7658,97.10,.0475]),('DirectATT S2',[-.0224,.0646,.2550,1.0211,92.70,.0471]),('PS/OR-DR S1',[-.0008,.0177,.1332,.4640,95.30,.1397]),('PS/OR-DR S2',[-.0007,.0177,.1330,.4623,95.50,.1390]),('RF-DR-DiD',[-.0335,.0907,.3028,.8708,94.90,1.0596])]),('OOD',[
 ('DirectATT S1',[-.0339,.0821,.2884,.5289,74.90,.0478]),('DirectATT S2',[-.0163,.1012,.3184,.5749,75.10,.0478]),('PS/OR-DR S1',[-.0067,.0295,.1718,.5332,94.00,.1397]),('PS/OR-DR S2',[-.0057,.0294,.1715,.5315,93.80,.1398]),('RF-DR-DiD',[.0025,.0385,.1962,.6255,93.50,1.3292])])]:
    for m,v in rows:did['rows'].append(row(g,m,v,digits=4))
d['suites'].append(did)
m=d['suites'][0]
m['variance_kind']='within_mechanism_sampling';m['metric_scale']='original effect units';m['split_label']='ID / Source-OOD'
m['table_note']='Original units · Variance ≈ reported SE² (within-mechanism) · GPU warm-start time · Current-run RF metrics remain unreported; historical CPU comparison stays separate.'
(P/'data/results.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
p=P/'index.html';h=p.read_text()
h=re.sub(r'<section class="contributors".*?</section>\s*','',h,flags=re.S)
h=re.sub(r'<a href="#contributors">.*?</a>\s*','',h,flags=re.S)
h=re.sub(r'<script id="results-data" type="application/json">.*?</script>','<script id="results-data" type="application/json">{"schema_version":1,"suites":[]}</script>',h,flags=re.S)
h=h.replace('assets/app.js?v=mediation-1','assets/app.js?v=reports-2').replace('assets/release.js?v=mediation-1','assets/release.js?v=reports-2')
h=h.replace('Mediation results from the November 12, 2026 report are available. Random Forest meeting-run accuracy metrics are not reported; its earlier CPU comparison is shown separately.','Results are available in ATE, CATE, Mediation, IV, Proximal and DiD. Each release retains its source metric definitions.')
p.write_text(h)
assert 'Core Contributors' not in h and '#contributors' not in h
p=P/'assets/app.js';h=p.read_text()
h=h.replace("hint:'Within-mechanism sampling variance, not standard error.'","hint:'Source-specific variance definition; see the evaluation note. This is not always within-mechanism sampling variance.'")
h=h.replace("if(!number(r[k]))return '—';\n if(k==='coverage')", "if(!number(r[k]))return '—';\n if(r.display&&typeof r.display[k]==='string')return esc(r.display[k]);\n if(k==='coverage')")
h=h.replace("digits=k==='time_s'?3:k==='variance'?5:4", "digits=k==='time_s'?(r.time_digits??3):k==='variance'?5:4")
h=h.replace("'status','suite_id','source_date'", "'status','suite_id','source_date','variance_kind','metric_scale','nominal_coverage','timing_scope','source_file'")
h=h.replace("source_date:current()?.report_date", "source_date:current()?.report_date,variance_kind:current()?.variance_kind,metric_scale:current()?.metric_scale,nominal_coverage:current()?.nominal_coverage,timing_scope:current()?.timing_scope,source_file:current()?.source?.file")
p.write_text(h)
assert len(d['suites'])==6 and sum(len(s['rows']) for s in d['suites'])==32
print('Imported six source-reported domains; contributors removed; no raw reports or DGPs copied.')
