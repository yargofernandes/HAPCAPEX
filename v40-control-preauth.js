/* HAPCAPEX V40.0.131 — Gerencial Viewer + relatórios operacionais
   - preserva a correção V40.0.122 do Gerencial para Visualizador;
   - adiciona total dinâmico explícito à coluna Valor em Transferências;
   - adiciona exportação Excel completa/filtrada na Base Consumo;
   - adiciona exportação Excel completa/filtrada em Transferências.
*/
(()=>{'use strict';
if(window.HAP_CONTROL_PREAUTH_V40?.bootstrapped)return;
const VERSION='40.0.131';

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

load('__HAP_V40049_TRANSFER_SAP_LOADER__','v40-transfer-sap-values.js','./v40-transfer-sap-values.js?v=40.0.135','hapV40049TransferSap');
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

/* V40.0.131 — Totais/exportações + estabilização de wrappers do Controle de CAPEX. */
(()=>{'use strict';
if(window.__HAP_V40123_CONTROL_REPORTS__)return;
window.__HAP_V40123_CONTROL_REPORTS__=true;
const VERSION='40.0.131';
const CONSUMO_ID='control-consumo';
const TRANSFER_ID='control-transfer';
const PAGE=1000;
const CONCURRENCY=8;
let consumoCache=null;
let consumoLoading=null;

function getClient(){
  try{if(typeof sb!=='undefined'&&sb?.from)return sb;}catch(_){}
  return window.sb?.from?window.sb:null;
}
function getState(){try{return typeof state!=='undefined'?state:null;}catch(_){return null;}}
function getXf(){return window.HAP_XF||null;}
function brlValue(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});}
function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();}
function sum(rows,key){return (rows||[]).reduce((s,r)=>{const v=Number(r?.[key]);return s+(Number.isFinite(v)?v:0);},0);}
function nowStamp(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function generatedAt(){return new Date().toLocaleString('pt-BR');}
function parseDateCell(value){
  const m=String(value||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return value||'';
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
}
function filterSummary(){
  const chips=[...document.querySelectorAll('.hap-xf-toolbar-summary .hap-xf-chip')]
    .map(el=>String(el.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  return chips.length?chips.join(' | '):'Sem filtros';
}
function isFiltered(id){
  try{return !!getXf()?.hasActive?.(id);}catch(_){return false;}
}
function applyFilters(id,rows){
  try{return getXf()?.apply?[...getXf().apply(id,rows)]:[...(rows||[])];}
  catch(error){console.warn(`[HAPCAPEX ${VERSION}] Falha ao aplicar filtros na exportação.`,error);return [...(rows||[])];}
}
function currentToolbar(){
  const table=document.querySelector('.table-card table');
  const card=table?.closest?.('.table-card');
  if(card?.previousElementSibling?.classList?.contains('toolbar'))return card.previousElementSibling;
  return document.querySelector('.toolbar');
}
function ensureExportButton(kind){
  const st=getState();
  const expected=kind==='consumo'?'base_consumo':'transferencias';
  if(String(st?.tab||'')!==expected)return null;
  const toolbar=currentToolbar();
  if(!toolbar)return null;
  const id=kind==='consumo'?'v40123-export-consumo':'v40123-export-transfer';
  let btn=document.getElementById(id);
  if(btn)return btn;
  btn=document.createElement('button');
  btn.type='button';btn.id=id;btn.className='btn btn-secondary';
  btn.textContent='↓ Exportar Excel';
  btn.title='Sem filtros, exporta o relatório completo. Com filtros, exporta somente o resultado filtrado.';
  btn.addEventListener('click',()=>void exportReport(kind,btn));
  const clear=[...toolbar.querySelectorAll('button')].find(b=>String(b.textContent||'').trim().toLocaleLowerCase('pt-BR')==='limpar filtros');
  if(clear)toolbar.insertBefore(btn,clear);else toolbar.appendChild(btn);
  return btn;
}

async function loadConsumoAll(force=false){
  if(force)consumoCache=null;
  if(consumoCache)return consumoCache;
  if(consumoLoading)return consumoLoading;
  const client=getClient();
  if(!client)throw new Error('Supabase indisponível.');
  consumoLoading=(async()=>{
    const cols='id,ordem_interna,descricao,categoria_valor,categoria_resumo,montante,data_lancamento,fornecedor,fornecedor_nome,oi_nao_encontrada';
    const make=(count=false)=>client.from('vw_controle_base_consumo').select(cols,count?{count:'exact'}:undefined)
      .order('data_lancamento',{ascending:false}).order('id',{ascending:true});
    const first=await make(true).range(0,PAGE-1);
    if(first.error)throw first.error;
    const rows=[...(first.data||[])];
    const total=Number(first.count??rows.length);
    if(total>rows.length){
      const pages=Math.ceil(total/PAGE);
      for(let p=1;p<pages;p+=CONCURRENCY){
        const jobs=[];
        for(let n=p;n<Math.min(p+CONCURRENCY,pages);n++){
          const from=n*PAGE,to=Math.min(total-1,from+PAGE-1);
          jobs.push(make(false).range(from,to));
        }
        const batch=await Promise.all(jobs);
        for(const result of batch){if(result.error)throw result.error;rows.push(...(result.data||[]));}
      }
    }
    if(Number.isFinite(total)&&rows.length!==total)throw new Error(`Base Consumo incompleta: ${rows.length} de ${total} linhas.`);
    consumoCache=rows;
    return rows;
  })().finally(()=>{consumoLoading=null;});
  return consumoLoading;
}

async function getTransferAll(){
  const st=getState();
  if(Array.isArray(st?.transferRows)&&st.transferRows.length)return [...st.transferRows];
  if(typeof window.fetchAllRows==='function'){
    const result=await window.fetchAllRows('vw_controle_transferencias','data',false);
    if(result?.error)throw result.error;
    return result?.data||[];
  }
  const client=getClient();
  if(!client)throw new Error('Supabase indisponível.');
  const {data,error}=await client.from('vw_controle_transferencias').select('*').order('data',{ascending:false});
  if(error)throw error;
  return data||[];
}

function setCols(ws,widths){ws['!cols']=widths.map(w=>({wch:w}));}
function formatCol(ws,colIndex,format){
  if(!ws?.['!ref'])return;
  const range=XLSX.utils.decode_range(ws['!ref']);
  for(let r=1;r<=range.e.r;r++){
    const addr=XLSX.utils.encode_cell({r,c:colIndex});
    if(ws[addr])ws[addr].z=format;
  }
}
function finishSheet(ws,{moneyCols=[],dateCols=[],widths=[]}={}){
  if(ws?.['!ref'])ws['!autofilter']={ref:ws['!ref']};
  moneyCols.forEach(c=>formatCol(ws,c,'R$ #,##0.00;[Red]-R$ #,##0.00'));
  dateCols.forEach(c=>formatCol(ws,c,'dd/mm/yyyy'));
  if(widths.length)setCols(ws,widths);
}
function summarySheet(rows){
  const ws=XLSX.utils.aoa_to_sheet(rows);
  setCols(ws,[32,72]);
  return ws;
}
function writeWorkbook(wb,name){
  if(!window.XLSX?.writeFile)throw new Error('Biblioteca de Excel indisponível. Atualize a página e tente novamente.');
  XLSX.writeFile(wb,name,{compression:true});
}

function buildConsumoWorkbook(rows,filtered,filters){
  const realized=(rows||[]).filter(r=>norm(r?.categoria_resumo)==='REALIZADO');
  const committed=(rows||[]).filter(r=>norm(r?.categoria_resumo)==='COMPROMISSADO');
  const vReal=sum(realized,'montante'),vComp=sum(committed,'montante');
  const wb=XLSX.utils.book_new();
  const resumo=summarySheet([
    ['Relatório','Base Consumo'],
    ['Gerado em',generatedAt()],
    ['Escopo',filtered?'Resultado filtrado':'Relatório completo'],
    ['Filtros / ordenação',filters],
    ['Lançamentos',rows.length],
    ['Realizado',vReal],
    ['Compromissado pendente',vComp],
    ['Compromissado total (Realizado + Compromissado)',vReal+vComp],
    ['Montante total',sum(rows,'montante')]
  ]);
  ['B6','B7','B8','B9'].forEach(a=>{if(resumo[a])resumo[a].z='R$ #,##0.00;[Red]-R$ #,##0.00';});
  XLSX.utils.book_append_sheet(wb,resumo,'Resumo');
  const data=(rows||[]).map(r=>({
    'OI':r.ordem_interna||'',
    'Descrição':r.descricao||'',
    'Categoria':r.categoria_valor||'',
    'Resumo':r.categoria_resumo||'',
    'Montante':Number(r.montante||0),
    'Data':parseDateCell(r.data_lancamento),
    'Fornecedor':r.fornecedor_nome||r.fornecedor||'',
    'Código Fornecedor':r.fornecedor||'',
    'OI não encontrada':r.oi_nao_encontrada?'Sim':'Não'
  }));
  const ws=XLSX.utils.json_to_sheet(data,{cellDates:true});
  finishSheet(ws,{moneyCols:[4],dateCols:[5],widths:[13,46,22,18,16,13,38,19,18]});
  XLSX.utils.book_append_sheet(wb,ws,'Base Consumo');
  return wb;
}
function buildTransferWorkbook(rows,filtered,filters){
  const wb=XLSX.utils.book_new();
  const resumo=summarySheet([
    ['Relatório','Transferências'],
    ['Gerado em',generatedAt()],
    ['Escopo',filtered?'Resultado filtrado':'Relatório completo'],
    ['Filtros / ordenação',filters],
    ['Transferências',rows.length],
    ['Valor total transferido',sum(rows,'valor')]
  ]);
  if(resumo['B6'])resumo['B6'].z='R$ #,##0.00;[Red]-R$ #,##0.00';
  XLSX.utils.book_append_sheet(wb,resumo,'Resumo');
  const data=(rows||[]).map(r=>({
    'Nº documento':r.numero_documento||'',
    'OI origem':r.oi_origem||'',
    'Obra origem':r.obra_origem_nome||'',
    'OI destino':r.oi_destino||'',
    'Obra destino':r.obra_destino_nome||'',
    'Valor':Number(r.valor||0),
    'Data':parseDateCell(r.data),
    'Justificativa':r.justificativa||'',
    'Entre pacotes diferentes':r.autorizado_diferenca?'Sim':'Não'
  }));
  const ws=XLSX.utils.json_to_sheet(data,{cellDates:true});
  finishSheet(ws,{moneyCols:[5],dateCols:[6],widths:[17,13,42,13,42,16,13,52,23]});
  XLSX.utils.book_append_sheet(wb,ws,'Transferências');
  return wb;
}

async function exportReport(kind,btn){
  if(!window.XLSX)throw new Error('Biblioteca XLSX não carregada.');
  const old=btn?.textContent||'↓ Exportar Excel';
  if(btn){btn.disabled=true;btn.textContent='Gerando Excel…';}
  try{
    if(kind==='consumo'){
      const all=await loadConsumoAll();
      const rows=applyFilters(CONSUMO_ID,all);
      const filtered=isFiltered(CONSUMO_ID)||rows.length!==all.length;
      const wb=buildConsumoWorkbook(rows,filtered,filterSummary());
      writeWorkbook(wb,`HAPCAPEX_Base_Consumo_${nowStamp()}_${filtered?'FILTRADO':'COMPLETO'}.xlsx`);
    }else{
      const all=await getTransferAll();
      const rows=applyFilters(TRANSFER_ID,all);
      const filtered=isFiltered(TRANSFER_ID)||rows.length!==all.length;
      const wb=buildTransferWorkbook(rows,filtered,filterSummary());
      writeWorkbook(wb,`HAPCAPEX_Transferencias_${nowStamp()}_${filtered?'FILTRADO':'COMPLETO'}.xlsx`);
    }
  }catch(error){
    console.error(`[HAPCAPEX ${VERSION}] Falha ao exportar ${kind}.`,error);
    alert('Não foi possível gerar o Excel: '+(error?.message||String(error)));
  }finally{
    if(kind==='consumo')consumoCache=null;
    if(btn){btn.disabled=false;btn.textContent=old;}
  }
}

function transferVisibleRows(){
  const st=getState();
  const base=Array.isArray(st?.transferRows)?st.transferRows:[];
  return applyFilters(TRANSFER_ID,base);
}
function decorateTransferTotal(){
  const st=getState();
  if(String(st?.tab||'')!=='transferencias')return;
  const rows=transferVisibleRows();
  const total=sum(rows,'valor');
  const active=isFiltered(TRANSFER_ID);
  const cards=[...document.querySelectorAll('.kpi-card')];
  const totalCard=cards.find(c=>norm(c.querySelector('.label')?.textContent)==='TOTAL TRANSFERIDO');
  const qtyCard=cards.find(c=>norm(c.querySelector('.label')?.textContent)==='QTDE DE TRANSFERENCIAS');
  if(totalCard?.querySelector('.value'))totalCard.querySelector('.value').textContent=brlValue(total);
  if(qtyCard?.querySelector('.value'))qtyCard.querySelector('.value').textContent=rows.length.toLocaleString('pt-BR');
  const card=document.querySelector('.table-card');
  if(!card)return;
  let bar=card.nextElementSibling;
  if(!bar?.matches?.('[data-v40123-transfer-total]')){
    bar=document.createElement('div');
    bar.dataset.v40123TransferTotal='1';
    bar.style.cssText='display:flex;justify-content:flex-end;gap:10px;align-items:center;margin-top:8px;padding:7px 10px;font-size:12px;color:var(--texto-suave);';
    card.insertAdjacentElement('afterend',bar);
  }
  bar.innerHTML=`<span>${rows.length.toLocaleString('pt-BR')} transferência${rows.length===1?'':'s'}</span><strong style="color:var(--azul);">${active?'Total Valor filtrado':'Total Valor'}: ${brlValue(total)}</strong>`;
}

function decorateCurrent(){
  const tab=String(getState()?.tab||'');
  if(tab==='base_consumo')ensureExportButton('consumo');
  if(tab==='transferencias'){
    ensureExportButton('transfer');
    decorateTransferTotal();
  }
}

/* V40.0.131
   Vários módulos do Controle envolvem as mesmas funções em wrappers e alguns deles
   tentam se reinstalar por alguns segundos. Verificar apenas o wrapper externo fazia
   dois módulos alternarem wrappers indefinidamente, aumentando a pilha até causar
   "Maximum call stack size exceeded". Procura a marca em toda a cadeia já instalada. */
function wrapperChainHas(fn,marker,maxDepth=512){
  let current=fn;
  const seen=new Set();
  for(let depth=0;typeof current==='function'&&depth<maxDepth&&!seen.has(current);depth++){
    try{if(current[marker])return true;}catch(_){}
    seen.add(current);
    let next=null;
    try{
      for(const key of Object.getOwnPropertyNames(current)){
        if(!/original/i.test(key))continue;
        const descriptor=Object.getOwnPropertyDescriptor(current,key);
        if(descriptor&&typeof descriptor.value==='function'){
          next=descriptor.value;
          break;
        }
      }
    }catch(_){}
    current=next;
  }
  return false;
}

function wrapRender(name,kind){
  const current=window[name];
  if(typeof current!=='function')return false;
  if(wrapperChainHas(current,'__hapV40123Reports'))return true;
  const wrapped=function(){
    const result=current.apply(this,arguments);
    queueMicrotask(()=>{
      try{
        if(kind==='consumo')ensureExportButton('consumo');
        else{ensureExportButton('transfer');decorateTransferTotal();}
      }catch(error){console.warn(`[HAPCAPEX ${VERSION}] Falha ao decorar ${kind}.`,error);}
    });
    return result;
  };
  wrapped.__hapV40123Reports=true;
  wrapped.__hapV40123Original=current;
  window[name]=wrapped;
  try{if(name==='renderBaseConsumoTab')renderBaseConsumoTab=wrapped;if(name==='renderTransferenciasTab')renderTransferenciasTab=wrapped;}catch(_){}
  return true;
}
function wrapConsumoImport(){
  const current=window.importarArquivoBaseConsumo;
  if(typeof current!=='function')return false;
  if(wrapperChainHas(current,'__hapV40123ReportsCache'))return true;
  const wrapped=async function(){
    consumoCache=null;
    try{return await current.apply(this,arguments);}
    finally{consumoCache=null;}
  };
  wrapped.__hapV40123ReportsCache=true;
  wrapped.__hapV40123Original=current;
  window.importarArquivoBaseConsumo=wrapped;
  try{importarArquivoBaseConsumo=wrapped;}catch(_){}
  return true;
}
function install(){
  wrapRender('renderBaseConsumoTab','consumo');
  wrapRender('renderTransferenciasTab','transfer');
  wrapConsumoImport();
  decorateCurrent();
}

install();
let tries=0;
const timer=setInterval(()=>{install();if(++tries>300)clearInterval(timer);},100);
let obsTimer=0;
const observer=new MutationObserver(()=>{
  clearTimeout(obsTimer);
  obsTimer=setTimeout(decorateCurrent,25);
});
const root=document.body||document.documentElement;
if(root)observer.observe(root,{childList:true,subtree:true});

window.HAP_V40123_CONTROL_REPORTS={
  version:VERSION,
  exportBaseConsumo:()=>exportReport('consumo',document.getElementById('v40123-export-consumo')),
  exportTransferencias:()=>exportReport('transfer',document.getElementById('v40123-export-transfer')),
  refresh:decorateCurrent,
  invalidateConsumoCache(){consumoCache=null;},
  wrapperChainHas
};
})();
