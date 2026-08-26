window.CAPEX_CONFIG={supabaseUrl:'https://kuvwfyuhrnfsubkapeek.supabase.co',supabasePublishableKey:'sb_publishable_-MtsnK_nyG5ZryuLDynTdg_R8hT1s66',sessionIdleMinutes:30};

// V40.0.47 — branding HAPCAPEX + carregamento global determinístico.
// config.js é carregado nativamente pelo index.html antes do bootstrap, portanto
// esta correção não depende do service worker já estar controlando a página.
(() => {
  'use strict';

  function normalizeBranding(){
    const loginTitle=document.querySelector('#loginForm h2');
    if(loginTitle && loginTitle.textContent.trim()!=='🔐 HAPCAPEX'){
      loginTitle.textContent='🔐 HAPCAPEX';
    }

    const toolbarBrand=document.querySelector('#adminToolbar > strong');
    if(toolbarBrand && toolbarBrand.textContent.trim()!=='HAPCAPEX'){
      toolbarBrand.textContent='HAPCAPEX';
    }
  }

  function loadGlobalAdmin(){
    if(window.__HAP_GLOBAL_ADMIN_V40047__ || document.querySelector('script[data-hap-global-admin-direct]')) return;
    const script=document.createElement('script');
    script.src='./v39-global-admin.js?v=40.0.47';
    script.async=false;
    script.dataset.hapGlobalAdminDirect='1';
    document.head.appendChild(script);
  }

  normalizeBranding();
  loadGlobalAdmin();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      normalizeBranding();
      loadGlobalAdmin();
    },{once:true});
  }

  const observer=new MutationObserver(()=>normalizeBranding());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),120000);
})();

// V31 — O registro OBRAS NÃO PLANEJADAS do Supabase passa a ser a fonte autoritativa,
// inclusive quando um mês é exatamente zero. O baseline histórico continua preservado
// para as demais regras, mas deixa de preencher silenciosamente zeros do Não Planejado.
(() => {
  if (!Object.prototype.hasOwnProperty.call(window,'HAP_ORIGINAL_BASELINE')) {
    Object.defineProperty(window,'HAP_ORIGINAL_BASELINE',{
      configurable:true,
      get(){ return undefined; },
      set(value){
        if (value && typeof value === 'object') {
          const historical = { ...(value.naoPlanejado || {}) };
          value.naoPlanejadoHistoricoV30 = historical;
          value.naoPlanejado = Object.fromEntries(Object.keys(historical).map(key => [key,0]));
        }
        Object.defineProperty(window,'HAP_ORIGINAL_BASELINE',{value,writable:true,configurable:true,enumerable:true});
      }
    });
  }
  const script=document.createElement('script');
  script.id='hapcapex-v31-addon';
  script.src='v31-addon.js?v=31';
  script.async=false;
  document.head.appendChild(script);
})();

// V32 — organização e filtros inteligentes da central de notificações.
(() => {
  const script=document.createElement('script');
  script.id='hapcapex-v32-addon';
  script.src='v32-addon.js?v=32';
  script.async=false;
  document.head.appendChild(script);
})();

// V34 — estrutura geral HAPCAPEX, navegação sem flash e seletor com contraste reforçado.
(() => {
  const script=document.createElement('script');
  script.id='hapcapex-v34-module-selector';
  script.src='v34-module-selector.js?v=34';
  script.async=false;
  document.head.appendChild(script);
})();

// V40.0.57 — correção do ciclo abrir/fechar/reabrir do painel lateral da Curva.
(() => {
  if (document.querySelector('script[data-hap-v40057-curve-panel]')) return;
  const script=document.createElement('script');
  script.src='./v40-curve-panel-fix.js?v=40.0.57';
  script.async=false;
  script.dataset.hapV40057CurvePanel='1';
  document.head.appendChild(script);
})();


// V40.0.59 — contingenciamento parcial linear + respeito às datas de replanejamento.
// Preserva o realizado até o mês de referência e consome todo o saldo residual
// linearmente apenas nos meses futuros compreendidos entre início e fim da obra.
(() => {
  'use strict';
  const RULE='contingency_partial_linear';
  const MONTHS=[
    'jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez',
    'jan27','fev27','mar27','abr27','mai27','jun27','jul27'
  ];
  const YM_TO_KEY={
    '2026-01':'jan','2026-02':'fev','2026-03':'mar','2026-04':'abr','2026-05':'mai','2026-06':'jun',
    '2026-07':'jul','2026-08':'ago','2026-09':'set','2026-10':'out','2026-11':'nov','2026-12':'dez',
    '2027-01':'jan27','2027-02':'fev27','2027-03':'mar27','2027-04':'abr27','2027-05':'mai27','2027-06':'jun27','2027-07':'jul27'
  };
  const KEY_TO_INDEX=Object.fromEntries(MONTHS.map((key,index)=>[key,index]));

  function dateToYM(value){
    const match=String(value||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2]}` : null;
  }
  function linearPartialFlow(item,data){
    const flow=Object.fromEntries(MONTHS.map(key=>[key,0]));
    const reportingKey=String(data?.reportingMonthKey||'jan');
    const reportingIndex=KEY_TO_INDEX[reportingKey] ?? 0;

    for(const key of MONTHS.slice(0,reportingIndex+1)){
      flow[key]=Number(item?.[key+'_real']||0);
    }

    const capex=Math.max(0,Number(item?.capex||0));
    const realized=MONTHS.reduce((sum,key)=>sum+Number(flow[key]||0),0);
    const residual=Math.max(0,capex-realized);
    if(residual<=0.005) return flow;

    const startKey=YM_TO_KEY[dateToYM(item?.inicio)]||null;
    const endKey=YM_TO_KEY[dateToYM(item?.fim)]||null;
    const startIndex=startKey ? KEY_TO_INDEX[startKey] : reportingIndex+1;
    const endIndex=endKey ? KEY_TO_INDEX[endKey] : startIndex;
    const firstFuture=Math.max(reportingIndex+1,startIndex);
    const activeKeys=MONTHS.slice(firstFuture,endIndex+1);
    const allocationKeys=activeKeys.length ? activeKeys : [MONTHS[Math.min(reportingIndex,MONTHS.length-1)]];

    const cents=Math.round(residual*100);
    const base=Math.floor(cents/allocationKeys.length);
    const remainder=cents-base*allocationKeys.length;
    allocationKeys.forEach((key,index)=>{
      flow[key]+=(base+(index<remainder?1:0))/100;
    });

    return flow;
  }

  function flagName(item){
    if(!item || typeof item!=='object') return;
    if(String(item._flowRule||'')===RULE && !/CONTING\.\s*PARCIAL/i.test(String(item.nome||''))){
      item.nome=String(item.nome||'').replace(/\s*-\s*CONTIN?G[^-]*$/i,'').trim()+' - CONTING. PARCIAL';
    }
  }

  function adapt(data){
    if(!data || !Array.isArray(data.obrasRaw)) return data;

    data.obrasRaw.forEach(item=>{
      // V40.0.59 — obras replanejadas manualmente devem respeitar as datas
      // aprovadas no Supabase. Não permitir que o motor legado empurre o início
      // para o último mês com algum realizado (ex.: AGO/26).
      const overrides=item?._manualOverrides && typeof item._manualOverrides==='object'
        ? item._manualOverrides : {};
      const manualReplan=Object.keys(overrides).some(key=>/replanejamento/i.test(key));
      if(manualReplan && String(item?._flowRule||'')==='standard_15_75_10'){
        item._isOriginalBaseline=true;
        item._replanRespectApprovedDates=true;
      }

      if(String(item?._flowRule||'')!==RULE) return;

      flagName(item);
      const customFlow=linearPartialFlow(item,data);

      // O Supabase continua guardando a regra gerencial nova.
      // Para o motor legado, entregamos o fluxo calculado como baseline técnico,
      // evitando qualquer retenção ou aplicação acidental do 15/75/10.
      item._persistedFlowRule=RULE;
      item._flowRuleAdapter='v40.0.58';
      item._flowRule='historical_baseline';
      item._baselineFlow=customFlow;
      item._baselineCapex=Number(item.capex||0);
      item._isOriginalBaseline=true;
    });

    return data;
  }

  let stored=window.HAP_DATA;
  if(stored) stored=adapt(stored);

  try{
    Object.defineProperty(window,'HAP_DATA',{
      configurable:true,
      enumerable:true,
      get(){ return stored; },
      set(value){ stored=adapt(value); }
    });
  }catch(_err){
    if(window.HAP_DATA) adapt(window.HAP_DATA);
  }
})();
