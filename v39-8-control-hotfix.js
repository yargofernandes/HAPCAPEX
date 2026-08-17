/* HAPCAPEX V39.8.2 — KPIs viewer nativos + diagnóstico/reinício SAP */
(() => {
  'use strict';

  const VERSION='39.8.2';
  const RPC_IMPORT='importar_base_consumo_lote';
  const SAP_BRIDGE_URL='http://127.0.0.1:17891';
  const RETRIES=3;
  const TIMEOUT_MS=30000;
  const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  let kpiPatched=false;
  let runtimePatched=false;
  let sapWatchTimer=null;
  let sapExportReadySince=0;
  let sapSendStartedAt=0;

  function currentRole(){
    try {
      if(typeof state!=='undefined' && state?.role) return String(state.role).toLowerCase();
    } catch(_){}
    const txt=String(document.querySelector('.role-badge')?.textContent||'').trim().toLowerCase();
    if(txt.includes('visualizador')||txt.includes('viewer')) return 'viewer';
    if(txt.includes('admin')) return 'admin';
    return '';
  }
  function isViewer(){ return currentRole()==='viewer'; }
  function currentExercise(){
    const values=[window.HAP_V35?.exercise,window.HAP_V37?.exercise,new Date().getFullYear()];
    for(const value of values){ const n=Number(value); if(Number.isInteger(n)&&n>=2020&&n<=2100) return n; }
    return new Date().getFullYear();
  }
  function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function money(value){
    const n=Number(value||0);
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
  }
  function isPhone(){
    const narrow=window.matchMedia?.('(max-width: 780px)').matches || window.innerWidth<=780;
    const agent=/android|iphone|ipod|mobile/i.test(navigator.userAgent||'');
    const coarse=!!window.matchMedia?.('(pointer: coarse)').matches;
    const pwa=document.body?.classList.contains('pwa-mobile');
    return !!((agent||coarse||pwa) && narrow && Math.max(window.innerWidth,window.innerHeight)<=980);
  }
  function onBaseConsumo(){
    try { if(typeof state!=='undefined' && state?.tab==='base_consumo') return true; } catch(_){}
    return String(document.querySelector('.brand-title')?.textContent||'').trim().toLowerCase()==='base consumo';
  }

  function injectStyles(){
    if(document.getElementById('hap-v3982-styles')) return;
    const style=document.createElement('style');
    style.id='hap-v3982-styles';
    style.textContent=`
      #import-status.hap-v3982-status{flex:1 0 100%;order:20;border:1px solid #c7d8ee;background:#eef4fc;color:#244b74;border-radius:8px;padding:8px 10px;font-size:10px!important;line-height:1.45;min-height:32px}
      #import-status.hap-v3982-status.busy{border-color:#9db7d5;background:#e8f0fb;color:#0d2b4e;font-weight:700}
      #import-status.hap-v3982-status.error{border-color:#e4b5b5;background:#fcebeb;color:#791f1f;font-weight:700}
      #import-status.hap-v3982-status.ok{border-color:#8fd0b2;background:#e1f5ee;color:#126b37;font-weight:700}
      .v3982-loading{display:flex;align-items:center;justify-content:center;gap:9px;padding:38px 18px;color:var(--texto-suave)}
      .v3982-spinner{width:18px;height:18px;border:2px solid var(--cinza-borda);border-top-color:var(--azul-medio);border-radius:50%;animation:v3982spin .8s linear infinite}
      @keyframes v3982spin{to{transform:rotate(360deg)}}
      .v3982-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 16px}
      .v3982-summary>div{background:var(--cinza-bg);border-radius:9px;padding:10px 11px}.v3982-summary span{display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:var(--texto-suave)}.v3982-summary strong{display:block;margin-top:4px;font-size:14px;color:var(--azul);font-variant-numeric:tabular-nums}
      .v3982-month{border:1px solid var(--cinza-borda);border-radius:10px;margin:9px 0;overflow:hidden;background:#fff}.v3982-month-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;background:var(--cinza-bg);cursor:pointer}.v3982-month-head strong{color:var(--azul)}.v3982-month-head small{color:var(--texto-suave)}.v3982-month-body{display:none;padding:0 10px 8px}.v3982-month.open .v3982-month-body{display:block}.v3982-month.open .v3982-chevron{transform:rotate(90deg)}.v3982-chevron{display:inline-block;margin-right:6px;transition:transform .15s ease}
      .v3982-row{padding:10px 2px;border-bottom:1px solid var(--cinza-borda)}.v3982-row:last-child{border-bottom:0}.v3982-row-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.v3982-row-title{font-size:12px;font-weight:700;color:var(--azul);line-height:1.35}.v3982-row-meta{font-size:10px;color:var(--texto-suave);margin-top:3px;line-height:1.4}.v3982-row-value{font-size:13px;font-weight:800;white-space:nowrap}.v3982-readonly{display:inline-flex;margin-top:6px;padding:3px 7px;border-radius:999px;background:#eef1f5;color:#5d6470;font-size:9px;font-weight:800}
      .v3982-sap-ready{border:1px solid #9db7d5!important;background:#eef4fc!important;color:#244b74!important}.v3982-sap-warn{border:1px solid #f0c98b!important;background:#fff8e6!important;color:#68480d!important}.v3982-sap-error{border:1px solid #e4b5b5!important;background:#fcebeb!important;color:#791f1f!important}
      @media(max-width:640px){.v3982-summary{grid-template-columns:1fr}.v3982-row-head{flex-direction:column}}
      body.pwa-mobile #v390-sap-btn,body.pwa-mobile [data-v390-sap-head],body.pwa-mobile [data-v390-sap-more]{display:none!important}
      @media(max-width:980px) and (pointer:coarse){#v390-sap-btn,[data-v390-sap-head],[data-v390-sap-more]{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureImportStatus(){
    if(!isViewer() || !onBaseConsumo()) return document.getElementById('import-status');
    let el=document.getElementById('import-status');
    if(el){ el.classList.add('hap-v3982-status'); return el; }
    const toolbar=document.getElementById('v390-sap-btn')?.closest('.toolbar') || [...document.querySelectorAll('.toolbar')].find(x=>x.querySelector('#search-input'));
    if(!toolbar) return null;
    el=document.createElement('div');
    el.id='import-status';
    el.className='hap-v3982-status';
    el.setAttribute('aria-live','polite');
    el.textContent='Pronto para receber a Base Consumo exportada pelo SAP.';
    toolbar.appendChild(el);
    return el;
  }
  function setImportStatus(message,type='info'){
    const el=ensureImportStatus();
    if(!el) return;
    el.textContent=String(message||'');
    el.classList.remove('busy','error','ok');
    if(type==='busy') el.classList.add('busy');
    if(type==='error') el.classList.add('error');
    if(type==='ok') el.classList.add('ok');
  }

  function monthKey(item){
    const raw=String(item?.mes||item?.data_movimento||item?.created_at||'');
    const m=raw.match(/^(\d{4})-(\d{2})/);
    return m?`${m[1]}-${m[2]}`:'sem-mes';
  }
  function monthLabel(key){
    if(key==='sem-mes') return 'Sem mês informado';
    const [y,m]=key.split('-').map(Number);
    return `${MONTHS[Math.max(1,Math.min(12,m))-1]} de ${y}`;
  }
  function groupByMonth(rows){
    const map=new Map();
    for(const row of rows||[]){ const key=monthKey(row); if(!map.has(key))map.set(key,[]); map.get(key).push(row); }
    return [...map.entries()].sort(([a],[b])=>a==='sem-mes'?1:b==='sem-mes'?-1:b.localeCompare(a));
  }
  function activeMovement(row){ return String(row?.metadata?.curva_sync_status||'').toLowerCase()!=='cancelado'; }

  async function openViewerFinancialKpi(type){
    const normalized=type==='aportes'?'aporte':'contingenciamento';
    const label=normalized==='aporte'?'Aportes Extras':'Contingenciamentos';
    const color=normalized==='aporte'?'var(--verde)':'var(--vermelho)';
    const backdrop=document.createElement('div');
    backdrop.className='modal-backdrop';
    backdrop.dataset.v3982ViewerKpi='1';
    backdrop.innerHTML=`<div class="modal-box modal-wide">
      <h2>${label} — Detalhamento</h2>
      <p class="sub">Consulta em modo somente leitura. Os lançamentos podem ser visualizados, mas alterações são exclusivas de administradores.</p>
      <div data-v3982-kpi-content><div class="v3982-loading"><span class="v3982-spinner"></span><span>Carregando lançamentos...</span></div></div>
      <div class="modal-actions"><button class="btn btn-secondary" data-v3982-close>Fechar</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-v3982-close]').onclick=()=>backdrop.remove();
    const content=backdrop.querySelector('[data-v3982-kpi-content]');
    try{
      if(typeof sb==='undefined') throw new Error('Conexão com o banco de dados indisponível.');
      const ex=currentExercise();
      const {data,error}=await sb.from('vw_controle_movimentos_capex')
        .select('id,exercicio,tipo,ordem_interna,nome,valor,mes,data_movimento,origem_registro,observacao,metadata,created_at')
        .eq('exercicio',ex).eq('tipo',normalized)
        .order('data_movimento',{ascending:false}).order('created_at',{ascending:false});
      if(error) throw error;
      if(!backdrop.isConnected) return;
      const rows=(data||[]).filter(activeMovement);
      const total=rows.reduce((s,x)=>s+Number(x.valor||0),0);
      const groups=groupByMonth(rows);
      const monthHtml=groups.map(([key,items])=>{
        const subtotal=items.reduce((s,x)=>s+Number(x.valor||0),0);
        const rowHtml=items.map(m=>{
          const mode=m.origem_registro==='curva_legacy'?'Legado':m.origem_registro==='operacional_controle'?'Operacional':m.origem_registro==='manual_historico'?'Histórico':'Registro';
          const meta=[m.ordem_interna?`OI ${esc(m.ordem_interna)}`:'',mode,m.observacao?esc(m.observacao):''].filter(Boolean).join(' · ');
          return `<div class="v3982-row"><div class="v3982-row-head"><div><div class="v3982-row-title">${esc(m.nome||'—')}</div><div class="v3982-row-meta">${meta}</div><span class="v3982-readonly">Somente leitura</span></div><div class="v3982-row-value" style="color:${color}">${money(m.valor)}</div></div></div>`;
        }).join('');
        return `<section class="v3982-month"><div class="v3982-month-head" role="button" tabindex="0" aria-expanded="false"><div><span class="v3982-chevron">▶</span><strong>${monthLabel(key)}</strong></div><div style="text-align:right"><strong style="color:${color}">${money(subtotal)}</strong><br><small>${items.length} lançamento(s)</small></div></div><div class="v3982-month-body">${rowHtml}</div></section>`;
      }).join('');
      content.innerHTML=`<div class="v3982-summary"><div><span>Total ativo</span><strong style="color:${color}">${money(total)}</strong></div><div><span>Lançamentos ativos</span><strong>${rows.length}</strong></div><div><span>Exercício</span><strong>${ex}</strong></div></div>${monthHtml||'<div class="empty-state">Nenhum lançamento ativo.</div>'}`;
      content.querySelectorAll('.v3982-month-head').forEach(head=>{
        const toggle=()=>{const group=head.closest('.v3982-month');const open=group.classList.toggle('open');head.setAttribute('aria-expanded',String(open));};
        head.onclick=toggle;
        head.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
      });
    }catch(error){
      if(!backdrop.isConnected) return;
      content.innerHTML=`<div class="error-msg"><strong>Não foi possível carregar os lançamentos.</strong><br>${esc(error?.message||error)}</div><button class="btn btn-primary" data-v3982-retry> tentar novamente </button>`;
      content.querySelector('[data-v3982-retry]').onclick=()=>{backdrop.remove();openViewerFinancialKpi(type);};
    }
  }

  function patchControlKpis(){
    if(kpiPatched || typeof window.openControlKpiPanel!=='function') return;
    const original=window.openControlKpiPanel;
    window.openControlKpiPanel=function(type,...args){
      if(isViewer() && (type==='aportes'||type==='contingenciamento')) return openViewerFinancialKpi(type);
      return original(type,...args);
    };
    window.openControlKpiPanel.__hapV3982Patched=true;
    window.openControlKpiPanel.__hapV3982Original=original;
    kpiPatched=true;
  }

  function retryable(error){
    const msg=String(error?.message||error||'').toLowerCase();
    const status=Number(error?.status||error?.statusCode||0);
    return status===0||status===408||status===429||status===502||status===503||status===504||/timeout|timed out|network|failed to fetch|fetch failed|connection|gateway|temporar/.test(msg);
  }
  function timeoutResult(ms){
    return new Promise(resolve=>setTimeout(()=>resolve({data:null,error:Object.assign(new Error('Tempo limite excedido ao enviar um lote da Base Consumo.'),{status:408,code:'HAP_TIMEOUT'})}),ms));
  }
  function patchRpc(){
    if(typeof sb==='undefined'||!sb?.rpc||sb.rpc.__hapV3982Patched) return;
    const original=(sb.rpc.__hapV398Original||sb.rpc).bind(sb);
    const wrapped=function(fn,args,options){
      if(fn!==RPC_IMPORT) return original(fn,args,options);
      return (async()=>{
        let last={data:null,error:new Error('Falha ao enviar lote da Base Consumo.')};
        for(let attempt=1;attempt<=RETRIES;attempt++){
          const result=await Promise.race([original(fn,args,options),timeoutResult(TIMEOUT_MS)]);
          last=result||last;
          if(!last?.error) return last;
          if(!retryable(last.error)||attempt===RETRIES) return last;
          setImportStatus(`Conexão instável durante a importação. Tentando novamente (${attempt+1}/${RETRIES})...`,'busy');
          await new Promise(r=>setTimeout(r,700*attempt));
        }
        return last;
      })();
    };
    wrapped.__hapV3982Patched=true;
    wrapped.__hapV398Original=original;
    sb.rpc=wrapped;
  }

  function patchImporter(){
    const fn=window.importarArquivoBaseConsumo;
    if(typeof fn!=='function'||fn.__hapV3982Patched) return;
    const original=fn;
    const wrapped=async function(file,context){
      if(isViewer()) setImportStatus('Lendo, validando e preparando a Base Consumo...','busy');
      try{
        const result=await original(file,context);
        if(isViewer()){
          if(result?.status==='confirmed') setImportStatus('Base Consumo atualizada com sucesso. CAPEX e Base O.I foram sincronizados.','ok');
          else if(result?.status==='cancelled') setImportStatus('Importação cancelada. Nenhuma nova base foi liberada.','error');
          else if(result?.status==='erro') setImportStatus(`Falha na importação: ${result?.error?.message||result?.error||'erro não identificado'}`,'error');
          else ensureImportStatus();
        }
        return result;
      }catch(error){
        if(isViewer()) setImportStatus(`Falha na importação: ${error?.message||error}`,'error');
        throw error;
      }
    };
    wrapped.__hapV3982Patched=true;
    wrapped.__hapV3982Original=original;
    window.importarArquivoBaseConsumo=wrapped;
  }

  function patchBaseConsumoRender(){
    const fn=window.renderBaseConsumoTab;
    if(typeof fn!=='function'||fn.__hapV3982Patched) return;
    const original=fn;
    const wrapped=function(...args){
      const out=original(...args);
      if(isViewer()) requestAnimationFrame(()=>ensureImportStatus());
      return out;
    };
    wrapped.__hapV3982Patched=true;
    wrapped.__hapV3982Original=original;
    window.renderBaseConsumoTab=wrapped;
  }

  async function resetSapAndImport(){
    const modal=document.getElementById('v390-sap-modal');
    const btn=modal?.querySelector('[data-v3982-reset]');
    if(btn){btn.disabled=true;btn.textContent='Reiniciando...';}
    const info=modal?.querySelector('[data-v390-auto-info]');
    try{
      setImportStatus('Cancelando a tentativa atual e reiniciando o SAP Bridge...','busy');
      const {error}=await sb.rpc('reiniciar_importacao_base_consumo_usuario');
      if(error) throw new Error(`Não foi possível cancelar a importação parcial: ${error.message}`);
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),10000);
      let response;
      try{ response=await fetch(`${SAP_BRIDGE_URL}/api/reset`,{method:'POST',cache:'no-store',signal:controller.signal}); }
      finally{ clearTimeout(timeout); }
      if(!response?.ok) throw new Error('O SAP Bridge não respondeu ao comando de reinício.');
      sapExportReadySince=0;sapSendStartedAt=0;
      setImportStatus('Processo reiniciado. Uma nova atualização pelo SAP será iniciada.','busy');
      modal?.remove();
      setTimeout(()=>{
        const sapBtn=document.getElementById('v390-sap-btn');
        sapBtn?.click();
        setTimeout(()=>document.querySelector('#v390-sap-modal [data-v390-start]')?.click(),900);
      },300);
    }catch(error){
      setImportStatus(`Não foi possível reiniciar: ${error?.message||error}`,'error');
      if(info){info.className='v390-sap-info v3982-sap-error';info.innerHTML=`<strong>Falha ao reiniciar.</strong> ${esc(error?.message||error)}`;}
      if(btn){btn.disabled=false;btn.textContent='Cancelar e reiniciar';}
    }
  }

  function decorateSapModal(){
    const modal=document.getElementById('v390-sap-modal');
    if(!modal){ sapExportReadySince=0; return false; }
    const actions=modal.querySelector('.modal-actions');
    if(actions&&!actions.querySelector('[data-v3982-reset]')){
      const button=document.createElement('button');
      button.className='btn btn-secondary';
      button.type='button';
      button.dataset.v3982Reset='1';
      button.textContent='Cancelar e reiniciar';
      button.onclick=resetSapAndImport;
      actions.insertBefore(button,actions.firstChild);
    }
    const info=modal.querySelector('[data-v390-auto-info]');
    const err=modal.querySelector('[data-v390-error]');
    const importBtn=modal.querySelector('[data-v390-import-export]');
    const exportReady=!!(importBtn && !importBtn.hidden);
    if(err?.textContent?.trim()){
      if(info){info.className='v390-sap-info v3982-sap-error';info.innerHTML='<strong>O processo encontrou um erro.</strong> Confira a mensagem abaixo. Você pode tentar novamente ou usar “Cancelar e reiniciar”.';}
      setImportStatus(`Erro no fluxo SAP: ${err.textContent.trim().replace(/\s+/g,' ')}`,'error');
    }else if(sapSendStartedAt){
      const elapsed=Math.round((Date.now()-sapSendStartedAt)/1000);
      if(info){info.className='v390-sap-info '+(elapsed>=30?'v3982-sap-warn':'v3982-sap-ready');info.innerHTML=elapsed>=30?'<strong>O envio está demorando mais que o esperado.</strong> Aguarde mais alguns segundos ou use “Cancelar e reiniciar”.':'<strong>Enviando o Excel ao HAPCAPEX...</strong> A tela mostrará o progresso da importação assim que a transferência terminar.';}
    }else if(exportReady){
      if(!sapExportReadySince) sapExportReadySince=Date.now();
      const elapsed=Math.round((Date.now()-sapExportReadySince)/1000);
      if(info){
        info.className='v390-sap-info '+(elapsed>=30?'v3982-sap-warn':'v3982-sap-ready');
        info.innerHTML=elapsed>=30
          ? '<strong>O SAP já terminou a extração.</strong> O arquivo está pronto. Clique em “Enviar Excel ao HAPCAPEX”. Se o botão não responder, use “Cancelar e reiniciar”.'
          : '<strong>Extração concluída.</strong> O SAP já terminou. Agora clique em “Enviar Excel ao HAPCAPEX” para iniciar a carga e acompanhar as linhas processadas.';
      }
    }
    return true;
  }

  function watchSapModal(){
    if(sapWatchTimer) return;
    const loop=()=>{
      const exists=decorateSapModal();
      if(exists) sapWatchTimer=setTimeout(loop,800);
      else sapWatchTimer=null;
    };
    sapWatchTimer=setTimeout(loop,80);
  }

  function removeMobileSap(){
    if(!isPhone()) return;
    document.getElementById('v390-sap-btn')?.remove();
    document.querySelectorAll('[data-v390-sap-head],[data-v390-sap-more]').forEach(el=>el.remove());
  }

  function installRuntimePatches(){
    if(runtimePatched) return;
    patchRpc();
    patchImporter();
    patchBaseConsumoRender();
    ensureImportStatus();
    runtimePatched=true;
  }

  document.addEventListener('click',event=>{
    const sapEntry=event.target.closest?.('#v390-sap-btn');
    if(sapEntry) setTimeout(watchSapModal,30);
    const send=event.target.closest?.('#v390-sap-modal [data-v390-import-export]');
    const primary=event.target.closest?.('#v390-sap-modal [data-v390-start]');
    if(send || (primary && /enviar excel/i.test(String(primary.textContent||'')))){
      sapSendStartedAt=Date.now();
      setImportStatus('Transferindo o Excel exportado pelo SAP para o HAPCAPEX...','busy');
      setTimeout(decorateSapModal,20);
    }
  },true);

  injectStyles();
  patchControlKpis();
  removeMobileSap();

  // O hotfix é carregado antes da governança V39.7. Estes disparos curtos
  // aguardam a substituição final das funções sem manter MutationObserver/loop contínuo.
  [0,80,300,900,1800].forEach(ms=>setTimeout(()=>{
    patchControlKpis();
    patchRpc();
    patchImporter();
    patchBaseConsumoRender();
    ensureImportStatus();
    removeMobileSap();
    if(document.getElementById('v390-sap-modal')) watchSapModal();
  },ms));

  window.HAP_V39_8_CONTROL_HOTFIX={
    version:VERSION,isPhone,ensureImportStatus,setImportStatus,
    openViewerFinancialKpi,decorateSapModal,resetSapAndImport,groupByMonth
  };
})();
