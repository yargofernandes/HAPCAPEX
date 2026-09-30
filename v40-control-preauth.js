/* HAPCAPEX V40.0.121 — Pre-auth guard do Controle de Capex
   - preserva as validações de sessão/perfil existentes;
   - libera o Gerencial para perfil Visualizador em modo estritamente somente leitura;
   - mantém CAPEX, Base O.I., Base Consumo e Transferências restritos ao Administrador;
   - visualizador entra diretamente no Gerencial e não recebe ações de correção/edição.
*/
(()=>{'use strict';
if(window.HAP_CONTROL_PREAUTH_V40?.bootstrapped)return;
const VERSION='40.0.121';

function load(flag,needle,src,key){
  if(window[flag])return;
  window[flag]=true;
  const ex=[...document.querySelectorAll('script[src]')].find(s=>String(s.getAttribute('src')||'').includes(needle));
  if(ex)return;
  const sc=document.createElement('script');
  sc.src=src;sc.async=false;sc.dataset[key]='1';
  sc.onerror=()=>{window[flag]=false;console.error('[HAPCAPEX '+VERSION+'] Falha ao carregar '+needle)};
  document.head.appendChild(sc);
}

load('__HAP_V40049_TRANSFER_SAP_LOADER__','v40-transfer-sap-values.js','./v40-transfer-sap-values.js?v=40.0.49','hapV40049TransferSap');
load('__HAP_V40050_CAPEX_FILTERS_LOADER__','v40-capex-column-filters.js','./v40-capex-column-filters.js?v=40.0.50','hapV40050CapexFilters');
const old=[...document.querySelectorAll('script[src]')].find(s=>String(s.getAttribute('src')||'').includes('v40-table-totals.js'));
if(old)old.remove();
load('__HAP_V40051_TABLE_TOTALS_LOADER__','v40-table-totals.js','./v40-table-totals.js?v=40.0.51','hapV40051TableTotals');
load('__HAP_V40052_PACKAGE_KPI_LOADER__','v40-package-aporte-kpi.js','./v40-package-aporte-kpi.js?v=40.0.52','hapV40052PackageKpi');
load('__HAP_V40053_KPI_ONLY_LOADER__','v40-aporte-kpi-only.js','./v40-aporte-kpi-only.js?v=40.0.53','hapV40053KpiOnly');
load('__HAP_V40054_CONTING_SEM_CURVA_LOADER__','v40-contingenciamento-sem-curva.js','./v40-contingenciamento-sem-curva.js?v=40.0.54','hapV40054ContingSemCurva');
load('__HAP_V40056_CONTING_RPC_ROUTER_LOADER__','v40-contingenciamento-rpc-router.js','./v40-contingenciamento-rpc-router.js?v=40.0.56','hapV40056ContingRpcRouter');
load('__HAP_V40055_CONTING_EXCEPTION_LOADER__','v40-contingenciamento-excecao.js','./v40-contingenciamento-excecao.js?v=40.0.55','hapV40055ContingException');

const original=window.loadRoleAndData;
if(typeof original!=='function'){
  console.error('[HAPCAPEX '+VERSION+'] loadRoleAndData indisponível');
  window.HAP_CONTROL_PREAUTH_V40={version:VERSION,bootstrapped:false,error:'loadRoleAndData indisponível'};
  return;
}

async function readOwnProfile(){
  const uid=state?.session?.user?.id;
  if(!uid)return{profile:null,error:new Error('Sessão inválida.')};
  const{data,error}=await sb.from('profiles')
    .select('id,email,full_name,role,is_active,must_change_password,deleted_at')
    .eq('id',uid).single();
  return{profile:data||null,error:error||null};
}

function isViewer(){
  try{return state?.role==='viewer';}catch(_){return false;}
}

function managerialNavOnly(){
  let active=true;
  try{active=state?.tab==='gerencial';}catch(_){}
  return `<div style="display:flex;gap:6px;"><span class="nav-pill ${active?'active':''}" onclick="switchTab('gerencial')">GERENCIAL</span></div>`;
}

function installViewerStyle(){
  if(document.getElementById('hap-v40121-viewer-gerencial-style'))return;
  const style=document.createElement('style');
  style.id='hap-v40121-viewer-gerencial-style';
  style.textContent=`
    body.hap-v40121-viewer-gerencial .v4071-edit{display:none!important}
  `;
  (document.head||document.documentElement).appendChild(style);
}

function enforceViewerReadOnlyUi(){
  if(!isViewer())return;
  installViewerStyle();
  document.body?.classList?.add('hap-v40121-viewer-gerencial');
  document.querySelectorAll('.role-badge').forEach(el=>{
    if(String(el.textContent||'').trim().toLowerCase()==='admin')el.textContent='Visualizador';
  });
  document.querySelectorAll('[data-v4071-edit-oi]').forEach(el=>{
    el.hidden=true;
    el.setAttribute('aria-hidden','true');
    el.setAttribute('tabindex','-1');
  });
}

function installViewerNavigationGuards(){
  if(!isViewer())return;
  installViewerStyle();
  document.body?.classList?.add('hap-v40121-viewer-gerencial');

  const currentNav=window.navHtml;
  if(typeof currentNav==='function'&&!currentNav.__hapV40121ViewerNav){
    const wrappedNav=function(){
      if(isViewer())return managerialNavOnly();
      return currentNav.apply(this,arguments);
    };
    wrappedNav.__hapV40121ViewerNav=true;
    wrappedNav.__hapV40121Original=currentNav;
    navHtml=window.navHtml=wrappedNav;
  }

  const currentSwitch=window.switchTab;
  if(typeof currentSwitch==='function'&&!currentSwitch.__hapV40121ViewerSwitch){
    const wrappedSwitch=function(tab){
      if(isViewer()&&String(tab||'')!=='gerencial'){
        state.tab='gerencial';
        const manager=window.HAP_V4071_CONTROL_MANAGERIAL;
        if(typeof manager?.loadManagerialTab==='function')return manager.loadManagerialTab();
        return window.refreshCurrent?.();
      }
      return currentSwitch.apply(this,arguments);
    };
    wrappedSwitch.__hapV40121ViewerSwitch=true;
    wrappedSwitch.__hapV40121Original=currentSwitch;
    switchTab=window.switchTab=wrappedSwitch;
  }
}

async function waitForManagerial(timeoutMs=6000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const manager=window.HAP_V4071_CONTROL_MANAGERIAL;
    if(typeof manager?.loadManagerialTab==='function')return manager;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  return null;
}

let viewerObserver=null;
function ensureViewerObserver(){
  if(viewerObserver||typeof MutationObserver!=='function')return;
  viewerObserver=new MutationObserver(()=>enforceViewerReadOnlyUi());
  const root=document.body||document.documentElement;
  if(root)viewerObserver.observe(root,{childList:true,subtree:true});
}

async function openViewerManagerial(profile){
  state.role='viewer';
  state.fullName=profile.full_name||profile.email||state.session?.user?.email||'';
  state.tab='gerencial';
  installViewerNavigationGuards();
  ensureViewerObserver();

  const manager=await waitForManagerial();
  if(!manager)throw new Error('Módulo Gerencial indisponível. Atualize a página e tente novamente.');
  await manager.loadManagerialTab();
  enforceViewerReadOnlyUi();
}

const guarded=async function(...args){
  const uid=state?.session?.user?.id;
  if(!uid)return original.apply(this,args);
  try{
    const{profile,error}=await readOwnProfile();
    if(error||!profile){
      if(typeof renderLogin==='function'){
        renderLogin('Não foi possível validar seu perfil. Atualize a página e tente novamente.');
        return;
      }
      throw error||new Error('Perfil não encontrado.');
    }
    if(!profile.is_active||profile.deleted_at){
      try{await sb.auth.signOut({scope:'local'})}catch(_){try{await sb.auth.signOut()}catch(_){}}
      if(typeof renderLogin==='function')renderLogin('Esta conta não possui acesso ativo ao HAPCAPEX.');
      return;
    }
    if(profile.must_change_password){
      state.role=profile.role;
      state.fullName=profile.full_name||profile.email||state.session?.user?.email||'';
      window.HAP_V40_PENDING_PASSWORD_PROFILE=profile;
      window.dispatchEvent(new CustomEvent('hapcapex:v40:password-required',{detail:{userId:uid}}));
      return;
    }
    if(profile.role==='viewer'){
      await openViewerManagerial(profile);
      return;
    }
    return original.apply(this,args);
  }catch(error){
    console.error('[HAPCAPEX '+VERSION+'] Falha no pre-auth guard',error);
    if(typeof renderLogin==='function'){
      renderLogin('Não foi possível validar o acesso com segurança. Atualize a página e tente novamente.');
      return;
    }
    throw error;
  }
};

guarded.__hapV40121PreAuth=true;
guarded.__hapOriginal=original;
loadRoleAndData=window.loadRoleAndData=guarded;
window.HAP_CONTROL_PREAUTH_V40={
  version:VERSION,
  bootstrapped:true,
  viewerManagerial:true,
  get original(){return original},
  enforceViewerReadOnlyUi
};
})();
