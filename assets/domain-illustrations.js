'use strict';
/* Presentational schematics only: read the selected domain; never modify evaluation data. */
(() => {
  const host = document.getElementById('domain-illustration');
  const heading = document.getElementById('hero-title');
  if (!host || !heading) return;
  const titles = Object.freeze({
    ate:'Average Treatment Effect', cate:'Conditional Average Treatment Effect',
    mediation:'Causal Mediation Analysis', iv:'Instrumental Variables', proximal:'Proximal Causal Inference',
    did_sc:'Difference-in-Differences', nonparametric_regression:'Nonparametric Regression',
    quantile:'Quantile Inference', semi_supervised:'Semi-Supervised Inference', missing_data:'Missing Data'
  });
  const descriptions = {
    ate:'Confounder X affects treatment A and outcome Y. The treatment also affects the outcome.',
    cate:'Confounder X affects treatment A and outcome Y. The treatment also affects the outcome.',
    mediation:'Treatment A affects outcome Y both directly and through mediator M. Baseline confounder X points to A, M and Y.',
    iv:'Instrument Z affects treatment A, which affects outcome Y. Unobserved U affects both A and Y.',
    proximal:'Unobserved U points to proxies Z and W, treatment A and outcome Y. Z points to A, and A points to Y.',
    did_sc:'Treated and control trends before and after treatment. The post-treatment effect is the gap between the treated outcome and its parallel-trend counterfactual.',
    nonparametric_regression:'Observations around a smooth regression curve, with the fitted value marked at a query point.',
    quantile:'A cumulative distribution curve with a probability level and its corresponding quantile.',
    semi_supervised:'Labeled data with X and Y and unlabeled data with X both feed an inference procedure.',
    missing_data:'A data table with observed X, partially missing Y, and an indicator R equal to one when Y is observed.'
  };
  // All SVG labels and paths below are fixed assets, not submission or API content.
  const text = (x,y,value,kind='label',anchor='middle') => `<text x="${x}" y="${y}" class="di-${kind}" text-anchor="${anchor}">${value}</text>`;
  const path = (d,kind='edge',arrow=true) => `<path d="${d}" class="di-${kind}"${arrow?` marker-end="url(#di-arrow-${kind==='accent'?'accent':'ink'})"`:''}/>`;
  const node = (x,y,letter,label='',latent=false,width=58) => `<g class="di-node${latent?' di-latent':''}"><rect x="${x-width/2}" y="${y-17}" width="${width}" height="34" rx="9"/>${text(x,y+7,letter,'symbol')}</g>${label?text(x,y+35,label):''}`;
  const dot = (x,y,kind='accent',r=3.5) => `<circle cx="${x}" cy="${y}" r="${r}" class="di-dot di-${kind}-fill"/>`;
  const axes = (x,y,right,top) => path(`M ${x} ${y} V ${top}`,'axis')+path(`M ${x} ${y} H ${right}`,'axis');
  const diagrams = {
    ate: () => path('M 176 45 L 110 102')+path('M 224 45 L 289 102')+path('M 123 122 H 276','accent')+
      node(200,30,'X')+text(242,34,'Confounder','label','start')+node(92,122,'A','Treatment')+node(308,122,'Y','Outcome'),
    cate: () => path('M 176 45 L 110 102')+path('M 224 45 L 289 102')+path('M 123 122 H 276','accent')+
      node(200,30,'X')+text(242,34,'Confounder','label','start')+node(92,122,'A','Treatment')+node(308,122,'Y','Outcome'),
    mediation: () => path('M 174 34 Q 94 42 62 82','guide')+path('M 200 44 V 81','guide')+
      path('M 226 34 Q 305 42 338 82','guide')+path('M 91 101 H 168','accent')+path('M 231 101 H 308','accent')+
      path('M 78 118 C 145 182, 255 182, 322 118','accent')+
      node(200,26,'X')+text(242,30,'Confounder','label','start')+
      node(60,101,'A','Treatment')+node(200,101,'M','Mediator')+node(340,101,'Y','Outcome')+
      text(129,83,'Indirect','accent-label')+text(200,181,'Direct','accent-label'),
    iv: () => path('M 240 53 L 207 103','guide')+path('M 278 52 L 329 103','guide')+
      path('M 89 123 H 169','accent')+path('M 231 123 H 311','accent')+
      node(260,35,'U','',true)+text(300,39,'Unobserved','label','start')+
      node(58,123,'Z','Instrument')+node(200,123,'A','Treatment')+node(342,123,'Y','Outcome'),
    proximal: () => path('M 175 35 L 85 59')+path('M 225 35 L 315 59')+
      path('M 189 43 L 145 113')+path('M 211 43 L 255 113')+
      path('M 77 85 L 117 115')+path('M 166 133 H 234','accent')+
      node(200,24,'U','',true)+text(240,28,'Unobserved','label','start')+
      node(56,68,'Z')+text(49,102,'Treatment')+text(49,117,'proxy')+
      node(344,68,'W')+text(351,102,'Outcome')+text(351,117,'proxy')+
      node(135,133,'A','Treatment')+node(265,133,'Y','Outcome'),
    did_sc: () => axes(43,146,282,20)+text(43,12,'Outcome','label','start')+text(291,150,'Time','label','start')+
      path('M 151 27 V 146','guide',false)+path('M 61 119 L 135 106 L 242 91','muted',false)+
      path('M 61 87 L 135 74 L 242 36','accent',false)+path('M 135 74 L 242 59','guide-accent',false)+
      [dot(61,119,'muted'),dot(135,106,'muted'),dot(242,91,'muted'),dot(61,87),dot(135,74),dot(242,36)].join('')+
      '<circle cx="242" cy="59" r="3.5" class="di-open-dot"/>'+path('M 256 38 V 57','edge',false)+
      '<path d="M 252 42 L 256 36 L 260 42 M 252 53 L 256 59 L 260 53" class="di-edge"/>'+
      text(266,51,'ATT','accent-label','start')+text(106,166,'Pre')+text(215,166,'Post')+
      path('M 297 84 H 313','accent',false)+text(321,88,'Treated','small','start')+
      path('M 297 108 H 313','guide-accent',false)+text(321,112,'Counterfactual','small','start')+
      path('M 297 132 H 313','muted',false)+text(321,136,'Control','small','start'),
    nonparametric_regression: () => {
      const points=[[48,114],[62,131],[65,100],[77,109],[89,137],[92,82],[102,111],[114,99],[121,132],[129,88],[143,111],[151,101],[160,123],[169,85],[180,114],[186,94],[201,108],[214,63],[220,97],[236,54],[245,91],[253,70],[267,42],[275,84],[284,52],[298,73],[308,36],[320,63],[330,49],[345,67]];
      return axes(39,147,367,27)+text(24,32,'y','math')+text(376,153,'x','math')+
        points.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" class="di-scatter"/>`).join('')+
        path('M 48 125 C 101 70, 148 132, 201 103 S 293 50, 346 56','accent',false)+
        path('M 225 87 V 147','guide',false)+dot(225,87)+text(225,169,'x₀','math')+text(349,47,'m(x)','math','start');
    },
    quantile: () => axes(46,147,364,22)+text(56,15,'F(y | x)','math','start')+text(374,153,'y','math')+
      path('M 52 144 C 122 144, 153 123, 192 90 S 262 32, 345 29','accent',false)+
      path('M 46 90 H 192 V 147','guide',false)+dot(192,90)+text(31,151,'0','math')+text(31,33,'1','math')+
      text(31,94,'τ','math')+text(192,170,'Qτ(x)','math'),
    semi_supervised: () => {
      let s='';
      for(const [x,w,label] of [[43,113,'Labeled'],[193,113,'Unlabeled']]){
        s+=`<rect x="${x}" y="17" width="${w}" height="105" rx="7" class="di-table-bg"/><path d="M ${x+7} 17 H ${x+w-7} Q ${x+w} 17 ${x+w} 24 V 42 H ${x} V 24 Q ${x} 17 ${x+7} 17" class="di-header-fill"/>`+
          text(x+w/2,34,label,'table-title')+path(`M ${x} 42 H ${x+w} M ${x} 68 H ${x+w} M ${x} 95 H ${x+w}`,'table-rule',false);
        if(label==='Labeled')s+=path(`M ${x+w/2} 42 V 122`,'table-rule',false)+text(x+w/4,60,'X','math')+text(x+3*w/4,60,'Y','math')+text(x+w/4,86,'…','math')+text(x+3*w/4,86,'…','math')+text(x+w/4,113,'…','math')+text(x+3*w/4,113,'…','math');
        else s+=text(x+w/2,60,'X','math')+text(x+w/2,86,'…','math')+text(x+w/2,113,'…','math');
      }
      return s+path('M 100 123 V 145 Q 100 155 111 155 H 157')+path('M 250 123 V 145 Q 250 155 239 155 H 221')+
        '<rect x="161" y="139" width="58" height="32" rx="12" class="di-inference-bg"/>'+text(190,159,'Inference','small');
    },
    missing_data: () => {
      let s='<rect x="42" y="18" width="221" height="142" rx="7" class="di-table-bg"/><path d="M 49 18 H 256 Q 263 18 263 25 V 46 H 42 V 25 Q 42 18 49 18" class="di-header-fill"/>';
      s+=path('M 115 18 V 160 M 189 18 V 160 M 42 46 H 263 M 42 74 H 263 M 42 103 H 263 M 42 132 H 263','table-rule',false);
      for(const [x,t] of [[78,'X'],[152,'Y'],[226,'R']])s+=text(x,37,t,'math');
      for(const [y,yy,r] of [[65,'y₁','1'],[94,'—','0'],[123,'y₃','1'],[151,'—','0']])s+=text(78,y,'…','math')+text(152,y,yy,'math')+text(226,y,r,'math');
      return s+'<rect x="285" y="63" width="26" height="18" rx="4" class="di-table-bg"/>'+text(298,76,'…','small')+text(321,77,'Observed','label','start')+
        '<rect x="285" y="99" width="26" height="18" rx="4" class="di-missing-cell"/>'+text(298,112,'—','small')+text(321,113,'Missing','label','start');
    }
  };
  let last = '';
  function render() {
    const domain = document.querySelector('#tabs [aria-selected="true"]')?.dataset.t;
    if (!Object.prototype.hasOwnProperty.call(diagrams,domain)) { host.hidden=true; return; }
    if (domain === last) return;
    last=domain;host.hidden=false;host.dataset.domain=domain;
    const title=document.createElement('h3');title.className='domain-figure-title';title.id='domain-figure-title';title.textContent=titles[domain];
    const graphic=document.createElementNS('http://www.w3.org/2000/svg','svg');
    graphic.setAttribute('viewBox','0 0 400 184');graphic.setAttribute('role','img');
    graphic.setAttribute('aria-labelledby','domain-figure-title domain-figure-desc');
    graphic.innerHTML=`<desc id="domain-figure-desc">${descriptions[domain]}</desc><defs>
      <marker id="di-arrow-ink" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 8 4 L 0 8 Z" class="di-ink-fill"/></marker>
      <marker id="di-arrow-accent" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 8 4 L 0 8 Z" class="di-accent-fill"/></marker>
      </defs>${diagrams[domain]()}`;
    host.replaceChildren(title,graphic);
  }
  // Domain changes already update this heading, including keyboard and URL navigation.
  new MutationObserver(render).observe(heading,{childList:true,characterData:true,subtree:true});
  render();
})();

