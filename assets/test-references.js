'use strict';
// Reuse the previously published method references, independently of presentation.
const METHOD_REFERENCES=Object.freeze([
 {id:'causalpfn',domains:['ate','cate'],names:['CausalPFN'],paper:{url:'https://proceedings.neurips.cc/paper_files/paper/2025/hash/e3d3db07c1bfb63e1d0b998996de1d12-Abstract-Conference.html',title:'CausalPFN: Amortized Causal Effect Estimation via In-Context Learning',citation:'Balazadeh Meresht et al. (2025). Advances in Neural Information Processing Systems 38.'},huggingface:{url:'https://huggingface.co/fuyao11/CausalPFN-ATE-CATE',title:'fuyao11/CausalPFN-ATE-CATE'}},
 {id:'proximalfm',domains:['proximal'],names:['ProximalFM'],paper:{url:'https://arxiv.org/abs/2610.08078v2',title:'ProximalFM: Amortized Proximal Causal Inference under Hidden Confounding',citation:'Muller et al. (2026). arXiv:2610.08078v2.'},huggingface:{url:'https://huggingface.co/christophemuller/ProximalFM',title:'christophemuller/ProximalFM'}},
 {id:'medipfn',domains:['mediation'],names:['MediPFN'],paper:{url:'https://arxiv.org/abs/2611.13219',title:'MediPFN (arXiv:2611.13219)'},huggingface:{url:'https://huggingface.co/shibo769/MediPFN',title:'shibo769/MediPFN'},source:'The released model card identifies arXiv:2611.13219; evaluation uses a separate five-fold wrapper.'},
 {id:'iv-pfn-v03',domains:['iv'],names:['PFN','IV-PFN'],huggingface:{url:'https://huggingface.co/Brownight/tabpfn-iv-adapter-v0.3',title:'Brownight/tabpfn-iv-adapter-v0.3'}},
 {id:'pfn-did',domains:['did_sc'],names:['PFN-DiD'],huggingface:{url:'https://huggingface.co/lisuo/PFN-DiD/tree/b7ab973ce6142e3bf34e11aa6db66b3bc5fc5c6a',title:'lisuo/PFN-DiD — pinned evaluated checkpoint',citation:'Checkpoint linked in PFN-DiD test.pdf; revision b7ab973ce6142e3bf34e11aa6db66b3bc5fc5c6a; training seed 20261112, step 8500.'}},
 {id:'did-directatt',domains:['did_sc'],names:['DirectATT S1','DirectATT S2','DirectATT']},
 {id:'did-ps-or-dr',domains:['did_sc'],names:['PS/OR-DR S1','PS/OR-DR S2','PS/OR-DR']}
]);
(function(){
 function safeURL(value,kind){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;if(kind==='huggingface'&&(u.hostname!=='huggingface.co'||u.pathname.split('/').filter(Boolean).length<2))return null;return u.href;}catch(_){return null;}}
 function primary(ref){if(!ref)return null;const p=safeURL(ref.paper?.url,'paper');if(p)return {...ref.paper,url:p,label:'Paper'};const h=safeURL(ref.huggingface?.url,'huggingface');return h?{...ref.huggingface,url:h,label:'Hugging Face'}:null;}
 function lookup(domain,row){return row?.family==='pfn'?METHOD_REFERENCES.find(r=>r.domains.includes(domain)&&r.names.includes(row.source_method||row.method))||null:null;}
 window.ArenaMethodReferences=Object.freeze({lookup,primary,safeURL});
})();

