/* HAPCAPEX V40.0.122 — Gerencial disponível ao Visualizador sem alterar as abas existentes
   - preserva as validações de sessão/perfil existentes;
   - mantém CAPEX, Base O.I e Base Consumo disponíveis ao Visualizador conforme a governança V39.4;
   - acrescenta a aba Gerencial ao perfil Visualizador;
   - mantém Transferências/Auditoria fora da navegação do Visualizador;
   - Gerencial permanece somente leitura para Visualizador.
*/
(()=>{'use strict';
if(window.HAP_CONTROL_PREAUTH_V40?.bootstrapped)return;
const VERSION='40.0.122';

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

function managerialPill(){
  let active=false;
  try{active=state?.tab==='gerencial';}catch(_){}
  return `<span class="nav-pill ${active?'active':''}" onclick="switchTab('gerencial')">GERENCIAL</span>`;
}

function appendManagerialToViewerNav(html){
  if(!html||typeof html!=='string')return html;
  if(html.includes("switchTab('gerencial')"))return html;
  const pill=managerialPill();
  if(/<\/div>\s*$/.test(html))return html.replace(/<\/div>\s*$/,pill+'</div>');
  return `<div style="display:flex;gap:6px;">${html}${pill}</div>`;
}

function installViewerStyle(){
  if(document.getElementById('hap-v40122-viewer-gerencial-style'))return;
  const style=document.createElement('style');
  style.id='hap-v40122-viewer-gerencial-style';
  style.textContent=`
    body.hap-v40122-viewer-gerencial .v4071-edit,
    body.hap-v40122-viewer-gerencial [data-v4071-edit-oi]{display:none!important}
  `;
  (document.head||document.documentElement).appendChild(style);
}

function enforceViewerReadOnlyUi(){
  if(!isViewer())return;
  installViewerStyle();
  document.body?.classList?.add('hap-v40122-viewer-gerencial');
  document.querySelectorAll('.role-badge').forEach(el=>{
    if(String(el.textContent||'').trim().toLowerCase()==='admin')el.textContent='Visualizador';
  });
  document.querySelectorAll('[data-v4071-edit-oi]').forEach(el=>{
    el.hidden=true;
    el.setAttribute('aria-hidden','true');
    el.setAttribute('tabindex','-1');
  });
}

function installViewerGerencialNavigation(){
  const currentNav=window.navHtml;
  if(typeof currentNav!=='function'||currentNav.__hapV40122ViewerGerencialNav)return;
  const wrappedNav=function(){
    const html=currentNav.apply(this,arguments);
    if(!isViewer())return html;
    return appendManagerialToViewerNav(html);
  };
  wrappedNav.__hapV40122ViewerGerencialNav=true;
  wrappedNav.__hapV40122Original=currentNav;
  navHtml=window.navHtml=wrappedNav;
}

let viewerObserver=null;
function ensureViewerObserver(){
  if(viewerObserver||typeof MutationObserver!=='function')return;
  viewerObserver=new MutationObserver(()=>enforceViewerReadOnlyUi());
  const root=document.body||document.documentElement;
  if(root)viewerObserver.observe(root,{childList:true,subtree:true});
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
      // Instala o complemento ANTES da renderização normal do Viewer (V39.4).
      // Assim as abas já existentes permanecem e apenas GERENCIAL é acrescentada.
      installViewerGerencialNavigation();
      ensureViewerObserver();
      const result=await original.apply(this,args);
      enforceViewerReadOnlyUi();
      return result;
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

guarded.__hapV40122PreAuth=true;
guarded.__hapOriginal=original;
loadRoleAndData=window.loadRoleAndData=guarded;
window.HAP_CONTROL_PREAUTH_V40={
  version:VERSION,
  bootstrapped:true,
  viewerManagerial:true,
  viewerKeepsExistingTabs:true,
  get original(){return original},
  appendManagerialToViewerNav,
  enforceViewerReadOnlyUi
};
})();
