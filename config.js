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
