/* HAPCAPEX V36 — Integração Controle de Capex ↔ Curva de Capex
   Aportes Extras e Contingenciamentos com planejamento obrigatório. */
(() => {
  'use strict';

  const V36 = window.HAP_V36 = {
    version: '36.1.0',
    pending: [],
    movements: [],
    rules: [],
    loading: null
  };

  const originalRenderCapexTab = window.renderCapexTab;
  const originalOpenControlKpiPanel = window.openControlKpiPanel;
  const originalCurveFinanceTotals = window.curveFinanceTotals;

  function exercise() {
    return Number(window.HAP_V35?.exercise || 2026);
  }

  function injectStyles() {
    if (document.getElementById('hap-v36-integration-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v36-integration-styles';
    style.textContent = `
      .v36-sync-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;margin:0 0 13px;border:1px solid #f0c98b;border-radius:10px;background:#fff8ea;color:#68480d}
      .v36-sync-banner strong{display:block;color:#68480d;font-size:12px}.v36-sync-banner span{display:block;margin-top:2px;font-size:10px;line-height:1.4}
      .v36-sync-banner button{white-space:nowrap}
      .v36-status-pill{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap}
      .v36-status-pill.new{background:#e8f0fb;color:#1a4b8c}.v36-status-pill.existing{background:#e1f5ee;color:#126b37}.v36-status-pill.warn{background:#fff0c0;color:#8a6000}
      .v36-queue{display:grid;gap:8px;margin-top:12px;max-height:58vh;overflow:auto;padding-right:2px}
      .v36-queue-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid #dde3ee;border-radius:10px;padding:10px 11px;background:#fff}
      .v36-queue-main strong{display:block;color:#0d2b4e;font-size:12px}.v36-queue-main small{display:block;color:#5a6882;font-size:10px;margin-top:2px;line-height:1.4}.v36-queue-value{font-weight:800;color:#1e8a4a;font-variant-numeric:tabular-nums}
      .v36-plan-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
      .v36-plan-card{border:1px solid #dde3ee;background:#f4f6fa;border-radius:9px;padding:9px 10px}.v36-plan-card span{display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:#5a6882}.v36-plan-card strong{display:block;margin-top:4px;color:#0d2b4e;font-size:13px;overflow-wrap:anywhere}
      .v36-rule-note{font-size:10px;color:#5a6882;line-height:1.45;margin-top:5px;min-height:14px}
      .v36-confirm{display:flex;gap:8px;align-items:flex-start;margin-top:10px;padding:9px 10px;border-radius:8px;background:#eef4fc;color:#244b74;font-size:10px;line-height:1.4}.v36-confirm input{margin-top:2px}
      .v36-integrated-note{padding:9px 10px;border-radius:8px;background:#e1f5ee;color:#126b37;font-size:10px;line-height:1.45;margin-bottom:10px}
      .v36-movement-row{border:1px solid #dde3ee;border-radius:9px;padding:10px 11px;margin-top:8px;background:#fff}.v36-movement-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v36-movement-title{font-size:12px;font-weight:700;color:#0d2b4e}.v36-movement-meta{font-size:10px;color:#5a6882;margin-top:3px;line-height:1.4}.v36-movement-value{font-size:13px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}.v36-movement-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v36-movement-actions .btn{padding:6px 9px;font-size:10px}.v36-readonly{font-size:9px;font-weight:800;color:#6b7280;background:#eef1f5;border-radius:999px;padding:3px 7px}.v36-danger{color:#a52727!important;border-color:#e4b5b5!important;background:#fffafa!important}
      @media(max-width:760px){.v36-plan-summary{grid-template-columns:1fr}.v36-queue-item{grid-template-columns:1fr}.v36-sync-banner{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  async function loadIntegrationContext(force=false) {
    if (V36.loading && !force) return V36.loading;
    V36.loading = (async () => {
      const ex = exercise();
      const [movResult, ruleResult] = await Promise.all([
        sb.from('vw_controle_movimentos_capex').select('*').eq('exercicio', ex).in('tipo', ['aporte','contingenciamento']).order('data_movimento', { ascending:true }).order('created_at', { ascending:true }),
        sb.from('capex_flow_rules').select('code,name,description,default_params,sort_order,selectable').eq('selectable', true).order('sort_order', { ascending:true })
      ]);
      if (movResult.error) throw movResult.error;
      if (ruleResult.error) throw ruleResult.error;
      V36.movements = movResult.data || [];
      V36.pending = V36.movements.filter(x => x.tipo === 'aporte' && x?.metadata?.curva_sync_status === 'pendente');
      V36.rules = ruleResult.data || [];
      if (window.HAP_V35 && Array.isArray(window.HAP_V35.movements)) window.HAP_V35.movements = V36.movements;
      return V36;
    })();
    try { return await V36.loading; }
    finally { V36.loading = null; }
  }

  function decorateCapexActions() {
    const aporte = document.getElementById('aporte-btn');
    if (aporte) {
      aporte.textContent = 'Aporte extra';
      aporte.title = 'Registrar aporte e definir o planejamento correspondente na Curva de Capex.';
      aporte.onclick = () => openContributionChoiceV36();
    }
    const conting = document.getElementById('contingenciar-btn');
    if (conting) {
      conting.textContent = 'Contingenciar obra';
      conting.title = 'Contingenciar no Controle e confirmar o planejamento correspondente na Curva.';
      conting.onclick = () => openContingencyV36();
    }
  }

  window.renderCapexTab = function() {
    originalRenderCapexTab();
    injectStyles();
    decorateCapexActions();
  };

  function inferTipologia(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('visa') || n.includes('ppci') || n.includes('adequação') || n.includes('adequacao')) return 'Legalização';
    if (n.includes('hospital') || n.includes('hapfor') || n.includes('salvalus')) return 'Hospital';
    if (n.includes('tea') || n.includes('autismo')) return 'TEA';
    if (n.includes('medprev')) return 'Medprev';
    if (n.includes('coleta')) return 'Posto de Coleta';
    if (n.includes('clínica') || n.includes('clinica')) return 'Clínica';
    if (n.includes('resson')) return 'Lab / Diagnóstico';
    return 'Outros';
  }

  function ruleName(code) {
    return V36.rules.find(r => r.code === code)?.name || code || '—';
  }

  async function getOiPlanningContext(oi, fallbackName='') {
    const [{ data: preview, error: previewErr }, { data: item, error: itemErr }] = await Promise.all([
      sb.rpc('prever_sincronia_curva', { p_ordem_interna:oi }),
      sb.from('capex_items').select('id,ordem,nome,capex,inicio,fim,tipologia,flow_rule,flow_rule_params,realizado').eq('ordem', oi).is('deleted_at', null).maybeSingle()
    ]);
    if (previewErr) throw previewErr;
    if (itemErr) throw itemErr;
    if (preview && preview.sincronizavel === false) throw new Error(preview.motivo || 'Esta OI não pode ser sincronizada automaticamente com a Curva.');
    const name = item?.nome || fallbackName || preview?.nome_controle || oi;
    return {
      preview: preview || {}, item: item || null,
      exists: !!item,
      name,
      start: item?.inicio || preview?.data_inicio_controle || '',
      end: item?.fim || preview?.data_fim_controle || '',
      tipologia: item?.tipologia || inferTipologia(name),
      rule: item?.flow_rule || (/_OPER\s*$/i.test(name) ? 'oper_realized_plus_balance_dec' : 'standard_15_75_10'),
      params: item?.flow_rule_params || {}
    };
  }

  async function openContributionChoiceV36() {
    injectStyles();
    let context;
    try { context = await loadIntegrationContext(true); }
    catch (err) { alert('Não foi possível consultar a integração com a Curva: ' + err.message); return; }
    const totalPending = context.pending.reduce((s,x)=>s+Number(x.valor||0),0);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-box">
      <h2>Aporte extra</h2>
      <p class="sub">Escolha como o aporte entra no Controle. Em ambos os casos, o planejamento da Curva é confirmado antes da conclusão.</p>
      ${context.pending.length ? `<div class="v36-sync-banner"><div><strong>${context.pending.length} aporte(s) aguardando planejamento na Curva</strong><span>${brl.format(totalPending)} já registrados no Controle e ainda não aplicados à Curva.</span></div><button class="btn btn-secondary" id="v36-open-pending">Planejar agora</button></div>` : ''}
      <div class="v35-aporte-choice-grid">
        <button type="button" class="v35-aporte-choice operacional" id="v36-aporte-operacional"><span class="v35-choice-kicker">Operacional</span><strong>Dinheiro novo ainda não incorporado</strong><small>Aumenta o Montante e o Saldo da OI no Controle.</small><span class="v35-choice-effect">Controle + Curva são atualizados juntos após confirmar o planejamento.</span></button>
        <button type="button" class="v35-aporte-choice historico" id="v36-aporte-historico"><span class="v35-choice-kicker">Histórico</span><strong>Valor já incorporado à Base O.I</strong><small>Não soma o dinheiro novamente no Controle.</small><span class="v35-choice-effect">Registra o histórico e leva o aporte à Curva com o planejamento confirmado.</span></button>
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-choice-cancel">Cancelar</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v36-choice-cancel').onclick=()=>backdrop.remove();
    backdrop.querySelector('#v36-aporte-operacional').onclick=()=>{backdrop.remove();openAporteEntryV36('operacional');};
    backdrop.querySelector('#v36-aporte-historico').onclick=()=>{backdrop.remove();openAporteEntryV36('historico');};
    const pendingBtn=backdrop.querySelector('#v36-open-pending');
    if(pendingBtn) pendingBtn.onclick=()=>{backdrop.remove();openPendingQueueV36();};
  }

  async function openPendingQueueV36() {
    let context;
    try { context = await loadIntegrationContext(true); }
    catch (err) { alert('Não foi possível carregar os aportes pendentes: ' + err.message); return; }
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    const total=context.pending.reduce((s,x)=>s+Number(x.valor||0),0);
    backdrop.innerHTML=`<div class="modal-box modal-wide">
      <h2>Aportes aguardando planejamento</h2>
      <p class="sub">Cada aporte precisa ter sua obra e regra de planejamento confirmadas antes de entrar na Curva.</p>
      <div class="history-summary"><div><span>Pendentes</span><strong>${context.pending.length}</strong></div><div><span>Valor total</span><strong style="color:var(--verde)">${brl.format(total)}</strong></div><div><span>Exercício</span><strong>${exercise()}</strong></div></div>
      <div class="v36-queue">${context.pending.length ? context.pending.map(m=>`<div class="v36-queue-item"><div class="v36-queue-main"><strong>OI ${escapeHtml(m.ordem_interna)} · ${escapeHtml(m.nome||'')}</strong><small>${escapeHtml(m.mes||'')} · aporte já registrado no Controle</small></div><div style="display:flex;align-items:center;gap:10px"><span class="v36-queue-value">${brl.format(Number(m.valor||0))}</span><button class="btn btn-primary v36-plan-pending" data-id="${m.id}">Planejar</button></div></div>`).join('') : '<div class="empty-state">Nenhum aporte pendente.</div>'}</div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-queue-close">Fechar</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v36-queue-close').onclick=()=>backdrop.remove();
    backdrop.querySelectorAll('.v36-plan-pending').forEach(btn=>btn.onclick=async()=>{
      const movement=context.pending.find(x=>String(x.id)===String(btn.dataset.id));
      if(!movement)return;
      try {
        const pctx=await getOiPlanningContext(String(movement.ordem_interna),movement.nome||'');
        backdrop.remove();
        openPlanningV36({kind:'aporte',source:'pending',movement,...movement,value:Number(movement.valor||0),planningContext:pctx});
      } catch(err){alert(err.message);}
    });
  }

  function openAporteEntryV36(mode) {
    const ex=exercise();const now=new Date();const month=now.getFullYear()===ex?now.getMonth()+1:1;const defaultMonth=`${ex}-${String(month).padStart(2,'0')}`;
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box">
      <h2>${mode==='historico'?'Registrar aporte histórico':'Registrar aporte operacional'}</h2>
      <p class="sub">${mode==='historico'?'O valor já está incorporado ao Controle. Ele não será somado novamente.':'O valor ainda não está incorporado ao Controle e será acrescentado à OI.'}</p>
      <div class="v36-integrated-note"><strong>Integração V36:</strong> depois destes dados, você confirmará datas e regra da Curva. A gravação só será concluída se todas as etapas forem válidas.</div>
      <div id="v36-entry-error"></div>
      <div class="grid-2"><div class="field"><label>Exercício</label><input value="${ex}" disabled></div><div class="field"><label>Mês *</label><input type="month" id="v36-a-mes" value="${defaultMonth}" min="${ex}-01" max="${ex}-12"></div></div>
      <div class="field"><label>Ordem interna *</label><input id="v36-a-oi"><div id="v36-a-info" class="v35-origin-hint"></div></div>
      <div class="grid-2"><div class="field"><label>Valor *</label><input type="number" min="0.01" step="0.01" id="v36-a-valor"></div><div class="field"><label>Nome do aporte</label><input id="v36-a-nome"></div></div>
      <div class="field"><label>Observação</label><textarea id="v36-a-obs" rows="2"></textarea></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-a-cancel">Cancelar</button><button class="btn btn-primary" id="v36-a-next">Continuar para planejamento</button></div>
    </div>`;
    document.body.appendChild(backdrop);backdrop.querySelector('#v36-a-cancel').onclick=()=>backdrop.remove();
    let timer;
    backdrop.querySelector('#v36-a-oi').oninput=e=>{clearTimeout(timer);const oi=e.target.value.trim();const info=backdrop.querySelector('#v36-a-info');if(!oi){info.textContent='';return;}timer=setTimeout(async()=>{const{data}=await sb.rpc('buscar_obra_por_oi',{p_ordem_interna:oi});info.textContent=data?.existe?`${data.nome||'(sem nome)'} · Montante atual ${brl.format(Number(data.montante_atribuido||0))}`:'OI não encontrada no exercício atual.';info.style.color=data?.existe?'var(--texto-suave)':'var(--vermelho)';},280);};
    backdrop.querySelector('#v36-a-next').onclick=async()=>{
      const oi=backdrop.querySelector('#v36-a-oi').value.trim();const value=Number(backdrop.querySelector('#v36-a-valor').value||0);const mes=backdrop.querySelector('#v36-a-mes').value;const name=backdrop.querySelector('#v36-a-nome').value.trim();const obs=backdrop.querySelector('#v36-a-obs').value.trim();const err=backdrop.querySelector('#v36-entry-error');
      if(!oi||!mes||value<=0){err.innerHTML='<div class="error-msg">Informe OI, mês e valor maior que zero.</div>';return;}
      const next=backdrop.querySelector('#v36-a-next');next.disabled=true;next.textContent='Consultando Curva...';
      try{await loadIntegrationContext();const pctx=await getOiPlanningContext(oi,name);backdrop.remove();openPlanningV36({kind:'aporte',source:'new',mode,oi,value,mes,name,obs,planningContext:pctx});}
      catch(e){next.disabled=false;next.textContent='Continuar para planejamento';err.innerHTML=`<div class="error-msg">${escapeHtml(e.message)}</div>`;}
    };
  }

  function openContingencyV36() {
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box">
      <h2>Contingenciar obra</h2><p class="sub">O valor será retirado no Controle e na Curva na mesma confirmação.</p><div class="v36-integrated-note"><strong>Integração V36:</strong> antes de gravar, confirme também a regra que a obra passará a usar na Curva.</div><div id="v36-c-error"></div>
      <div class="field"><label>Ordem interna *</label><input id="v36-c-oi"><div id="v36-c-info" class="v35-origin-hint"></div></div>
      <div class="grid-2"><button class="btn btn-primary" id="v36-c-parcial" type="button">Parcial</button><button class="btn btn-secondary" id="v36-c-total" type="button">Total</button></div>
      <div class="field" id="v36-c-value-wrap" style="margin-top:10px"><label>Valor a contingenciar *</label><input type="number" step="0.01" min="0.01" id="v36-c-value"></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-c-cancel">Cancelar</button><button class="btn btn-primary" id="v36-c-next">Continuar para planejamento</button></div>
    </div>`;
    document.body.appendChild(backdrop);let type='parcial',controlInfo=null,timer;
    backdrop.querySelector('#v36-c-cancel').onclick=()=>backdrop.remove();
    const setType=t=>{type=t;backdrop.querySelector('#v36-c-parcial').className=`btn ${t==='parcial'?'btn-primary':'btn-secondary'}`;backdrop.querySelector('#v36-c-total').className=`btn ${t==='total'?'btn-primary':'btn-secondary'}`;backdrop.querySelector('#v36-c-value-wrap').style.display=t==='parcial'?'block':'none';};
    backdrop.querySelector('#v36-c-parcial').onclick=()=>setType('parcial');backdrop.querySelector('#v36-c-total').onclick=()=>setType('total');
    backdrop.querySelector('#v36-c-oi').oninput=e=>{clearTimeout(timer);const oi=e.target.value.trim();const info=backdrop.querySelector('#v36-c-info');if(!oi){info.textContent='';controlInfo=null;return;}timer=setTimeout(async()=>{const{data}=await sb.rpc('buscar_obra_por_oi',{p_ordem_interna:oi});controlInfo=data;info.textContent=data?.existe?`${data.nome||'(sem nome)'} · saldo disponível ${brl.format(Number(data.saldo_disponivel||0))}`:'OI não encontrada.';info.style.color=data?.existe?'var(--texto-suave)':'var(--vermelho)';},280);};
    backdrop.querySelector('#v36-c-next').onclick=async()=>{
      const oi=backdrop.querySelector('#v36-c-oi').value.trim();const err=backdrop.querySelector('#v36-c-error');let value=type==='total'?Number(controlInfo?.saldo_disponivel||0):Number(backdrop.querySelector('#v36-c-value').value||0);
      if(!oi||value<=0){err.innerHTML='<div class="error-msg">Informe a OI e um valor válido.</div>';return;}
      const next=backdrop.querySelector('#v36-c-next');next.disabled=true;next.textContent='Consultando Curva...';
      try{await loadIntegrationContext();const pctx=await getOiPlanningContext(oi,controlInfo?.nome||'');if(!pctx.exists)throw new Error('Esta OI ainda não existe na Curva de Capex. Cadastre/sincronize a obra antes de contingenciar.');const recommended=type==='total'?'contingency_full':(/HAPFOR/i.test(pctx.name)?'contingency_partial_hapfor':'contingency_partial_standard');backdrop.remove();openPlanningV36({kind:'contingenciamento',source:'new',oi,value,type,planningContext:{...pctx,recommendedRule:recommended}});}
      catch(e){next.disabled=false;next.textContent='Continuar para planejamento';err.innerHTML=`<div class="error-msg">${escapeHtml(e.message)}</div>`;}
    };
  }

  function openPlanningV36(ctx) {
    const p=ctx.planningContext;const isNew=!p.exists;const capexBefore=Number(p.item?.capex||0);const capexAfter=ctx.kind==='aporte'?capexBefore+Number(ctx.value||0):Math.max(0,capexBefore-Number(ctx.value||0));
    const selectedRule=ctx.kind==='contingenciamento'?(p.recommendedRule||p.rule):p.rule;
    const ruleOptions=V36.rules.map(r=>`<option value="${escapeHtml(r.code)}" ${r.code===selectedRule?'selected':''}>${escapeHtml(r.name)}</option>`).join('');
    const currentRule=p.item?.flow_rule||'';
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box modal-wide">
      <h2>Planejamento na Curva de Capex</h2><p class="sub">${ctx.kind==='aporte'?'Confirme como o aporte será planejado.':'Confirme como a obra ficará planejada após o contingenciamento.'}</p>
      <div class="v36-plan-summary"><div class="v36-plan-card"><span>OI</span><strong>${escapeHtml(ctx.oi||ctx.ordem_interna||ctx.movement?.ordem_interna||'')}</strong></div><div class="v36-plan-card"><span>${ctx.kind==='aporte'?'Aporte':'Contingenciamento'}</span><strong>${brl.format(Number(ctx.value||0))}</strong></div><div class="v36-plan-card"><span>CAPEX na Curva</span><strong>${brl.format(capexBefore)} → ${brl.format(capexAfter)}</strong></div></div>
      <div style="margin-bottom:10px"><span class="v36-status-pill ${isNew?'new':'existing'}">${isNew?'Nova obra na Curva':'Obra já existente na Curva'}</span>${currentRule?` <span class="v36-status-pill warn">Regra atual: ${escapeHtml(ruleName(currentRule))}</span>`:''}</div>
      ${!isNew && ctx.kind==='aporte' && /^contingency_/.test(currentRule)?'<div class="v36-sync-banner"><div><strong>Esta obra estava contingenciada.</strong><span>Revise a regra abaixo. Se o aporte representa pagamento final/pendente, confirme explicitamente como esse novo saldo deve ser planejado.</span></div></div>':''}
      <div id="v36-plan-error"></div>
      <div class="field"><label>Nome da obra na Curva *</label><input id="v36-p-name" value="${escapeHtml(p.name||'')}"></div>
      <div class="grid-2"><div class="field"><label>Data de início ${isNew?'*':''}</label><input type="date" id="v36-p-start" value="${escapeHtml(String(p.start||'').slice(0,10))}"></div><div class="field"><label>Data de término ${isNew?'*':''}</label><input type="date" id="v36-p-end" value="${escapeHtml(String(p.end||'').slice(0,10))}"></div></div>
      <div class="grid-2"><div class="field"><label>Tipologia ${isNew?'*':''}</label><input id="v36-p-type" list="v36-tipologias" value="${escapeHtml(p.tipologia||inferTipologia(p.name))}"><datalist id="v36-tipologias"><option>Hospital</option><option>TEA</option><option>Clínica</option><option>Medprev</option><option>Posto de Coleta</option><option>Lab / Diagnóstico</option><option>Legalização</option><option>Pronto Atendimento</option><option>Outros</option></datalist></div><div class="field"><label>Regra de planejamento *</label><select id="v36-p-rule">${ruleOptions}</select><div id="v36-p-rule-note" class="v36-rule-note"></div></div></div>
      <div class="field" id="v36-p-month-wrap" style="display:none"><label>Mês do pagamento único *</label><select id="v36-p-month"><option value="ago">Ago/${String(exercise()).slice(-2)}</option><option value="set">Set/${String(exercise()).slice(-2)}</option><option value="out">Out/${String(exercise()).slice(-2)}</option><option value="nov">Nov/${String(exercise()).slice(-2)}</option><option value="dez">Dez/${String(exercise()).slice(-2)}</option></select></div>
      <label class="v36-confirm"><input type="checkbox" id="v36-p-confirm"><span>Confirmo que as datas e a regra acima representam o planejamento que deve ser usado na Curva de Capex.</span></label>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-p-cancel">Voltar</button><button class="btn btn-primary" id="v36-p-save">Confirmar e aplicar</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    const ruleSelect=backdrop.querySelector('#v36-p-rule'),note=backdrop.querySelector('#v36-p-rule-note'),monthWrap=backdrop.querySelector('#v36-p-month-wrap');
    const refreshRule=()=>{const r=V36.rules.find(x=>x.code===ruleSelect.value);note.textContent=r?.description||'';monthWrap.style.display=ruleSelect.value==='single_payment'?'block':'none';if(ruleSelect.value==='single_payment'&&p.params?.month)backdrop.querySelector('#v36-p-month').value=p.params.month;};refreshRule();ruleSelect.onchange=refreshRule;
    backdrop.querySelector('#v36-p-cancel').onclick=()=>{backdrop.remove();if(ctx.source==='pending')openPendingQueueV36();};
    backdrop.querySelector('#v36-p-save').onclick=async()=>{
      const errorBox=backdrop.querySelector('#v36-plan-error');if(!backdrop.querySelector('#v36-p-confirm').checked){errorBox.innerHTML='<div class="error-msg">Confirme o planejamento antes de aplicar.</div>';return;}
      const plan={nome:backdrop.querySelector('#v36-p-name').value.trim(),inicio:backdrop.querySelector('#v36-p-start').value||null,fim:backdrop.querySelector('#v36-p-end').value||null,tipologia:backdrop.querySelector('#v36-p-type').value.trim(),flow_rule:ruleSelect.value,flow_rule_params:ruleSelect.value==='single_payment'?{month:backdrop.querySelector('#v36-p-month').value}:{}};
      const save=backdrop.querySelector('#v36-p-save');save.disabled=true;save.textContent='Aplicando...';
      try{
        let result;
        if(ctx.kind==='aporte'&&ctx.source==='pending') result=await sb.rpc('aplicar_aporte_pendente_curva',{p_movimento_id:ctx.movement.id,p_planejamento:plan});
        else if(ctx.kind==='aporte') result=await sb.rpc('registrar_aporte_integrado',{p_modo:ctx.mode,p_ordem_interna:ctx.oi,p_valor:ctx.value,p_mes:ctx.mes,p_nome:ctx.name||null,p_observacao:ctx.obs||null,p_planejamento:plan});
        else result=await sb.rpc('contingenciar_obra_integrado_v36',{p_ordem_interna:ctx.oi,p_tipo:ctx.type,p_valor:ctx.type==='parcial'?ctx.value:null,p_planejamento:plan});
        if(result.error)throw result.error;
        backdrop.remove();
        await loadIntegrationContext(true).catch(()=>{});
        await loadCurveFinanceReference();
        if(window.HAP_V35 && typeof window.HAP_V35==='object') { /* contexto V35 será recarregado pelo render seguinte quando necessário */ }
        await refreshCurrent();
        const data=result.data||{};const finalValue=data.capex_depois??data.curva_capex_depois;
        alert(`${ctx.kind==='aporte'?'Aporte':'Contingenciamento'} aplicado com sucesso no Controle e na Curva.${finalValue!==undefined?`\n\nCAPEX da obra na Curva: ${brl.format(Number(finalValue))}`:''}`);
      }catch(e){save.disabled=false;save.textContent='Confirmar e aplicar';errorBox.innerHTML=`<div class="error-msg">${escapeHtml(e.message)}</div>`;}
    };
  }

  // V36.1: KPIs financeiros do Controle passam a ignorar movimentos cancelados.
  window.curveFinanceTotals = function() {
    const source = Array.isArray(window.HAP_V35?.movements) ? window.HAP_V35.movements : null;
    if (!source) return originalCurveFinanceTotals();
    const movements = source.filter(x => x?.metadata?.curva_sync_status !== 'cancelado');
    const aportesMov = movements.filter(x => x.tipo === 'aporte');
    const contingMov = movements.filter(x => x.tipo === 'contingenciamento');
    const details = list => list.map(x => ({...x, valor:Number(x.valor||0)}));
    return {
      conting: contingMov.reduce((s,x)=>s+Number(x.valor||0),0),
      aportes: aportesMov.reduce((s,x)=>s+Number(x.valor||0),0),
      contingDetalhe: details(contingMov),
      aportesDetalhe: details(aportesMov)
    };
  };

  function movementStatus(m) {
    if (m.origem_registro === 'curva_legacy') return { label:'Legado · somente leitura', cls:'warn', editable:false };
    const st = m?.metadata?.curva_sync_status || 'registrado';
    if (st === 'pendente') return { label:'Aguardando planejamento', cls:'warn', editable:true };
    if (st === 'aplicado') return { label:'Integrado à Curva', cls:'existing', editable:true };
    return { label:'Registrado', cls:'new', editable:!!m?.metadata?.integracao_v36 };
  }

  async function refreshAfterMovementChange() {
    await loadIntegrationContext(true).catch(()=>{});
    await loadCurveFinanceReference();
    await refreshCurrent();
  }

  function openMovementEditV36(m, type) {
    const status = movementStatus(m);
    if (!status.editable) return;
    const totalConting = type === 'contingenciamento' && (m?.metadata?.tipo === 'total');
    const backdrop=document.createElement('div'); backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box">
      <h2>Editar ${type==='aporte'?'aporte extra':'contingenciamento'}</h2>
      <p class="sub">A correção será propagada automaticamente para todos os pontos afetados.</p>
      <div class="v36-plan-summary"><div class="v36-plan-card"><span>OI</span><strong>${escapeHtml(m.ordem_interna||'—')}</strong></div><div class="v36-plan-card"><span>Valor atual</span><strong>${brl.format(Number(m.valor||0))}</strong></div><div class="v36-plan-card"><span>Status</span><strong>${escapeHtml(status.label)}</strong></div></div>
      ${m?.metadata?.curva_sync_status==='aplicado'?`<div class="v36-integrated-note"><strong>Engrenagem ativa:</strong> a diferença será refletida ${m.afeta_estado_atual?'no Controle, ':''}na Curva e no fluxo financeiro da obra, mantendo o planejamento atual.</div>`:`<div class="v36-integrated-note"><strong>Ainda não aplicado à Curva:</strong> a correção altera o valor pendente e o KPI. O planejamento usará o valor corrigido.</div>`}
      <div id="v36-edit-error"></div>
      <div class="field"><label>Obra</label><input value="${escapeHtml(m.nome||'')}" disabled></div>
      <div class="field"><label>Valor ${totalConting?'(calculado pelo saldo)':'*'}</label><input type="number" min="0.01" step="0.01" id="v36-edit-value" value="${Number(m.valor||0).toFixed(2)}" ${totalConting?'disabled':''}></div>
      ${totalConting?'<div class="v36-rule-note">Contingenciamento total não aceita alteração manual do valor. Para desfazer, cancele o lançamento e refaça a operação.</div>':''}
      <div class="field"><label>Observação</label><textarea id="v36-edit-obs" rows="2">${escapeHtml(m.observacao||'')}</textarea></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-edit-close">Cancelar</button><button class="btn btn-primary" id="v36-edit-save" ${totalConting?'disabled':''}>Salvar correção</button></div>
    </div>`;
    document.body.appendChild(backdrop); backdrop.querySelector('#v36-edit-close').onclick=()=>backdrop.remove();
    const save=backdrop.querySelector('#v36-edit-save');
    if(save) save.onclick=async()=>{
      const val=Number(backdrop.querySelector('#v36-edit-value').value||0); const err=backdrop.querySelector('#v36-edit-error');
      if(val<=0){err.innerHTML='<div class="error-msg">Informe um valor maior que zero.</div>';return;}
      save.disabled=true; save.textContent='Atualizando...';
      try{
        const {data,error}=await sb.rpc('editar_movimento_financeiro_integrado_v36',{p_movimento_id:m.id,p_novo_valor:val,p_novo_mes:m.mes,p_novo_nome:m.nome,p_observacao:backdrop.querySelector('#v36-edit-obs').value.trim()||null});
        if(error) throw error; backdrop.remove(); await refreshAfterMovementChange();
        alert(`Lançamento corrigido com sucesso.

Valor anterior: ${brl.format(Number(data?.valor_anterior||m.valor||0))}
Novo valor: ${brl.format(Number(data?.valor_novo||val))}`);
      }catch(e){save.disabled=false;save.textContent='Salvar correção';err.innerHTML=`<div class="error-msg">${escapeHtml(e.message)}</div>`;}
    };
  }

  function openMovementCancelV36(m, type) {
    const status=movementStatus(m); if(!status.editable) return;
    const backdrop=document.createElement('div'); backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box">
      <h2>Cancelar ${type==='aporte'?'aporte extra':'contingenciamento'}</h2>
      <p class="sub">O registro permanecerá na auditoria, mas seu efeito financeiro será desfeito.</p>
      <div class="v36-plan-summary"><div class="v36-plan-card"><span>OI</span><strong>${escapeHtml(m.ordem_interna||'—')}</strong></div><div class="v36-plan-card"><span>Valor a desfazer</span><strong>${brl.format(Number(m.valor||0))}</strong></div><div class="v36-plan-card"><span>Status</span><strong>${escapeHtml(status.label)}</strong></div></div>
      <div class="v36-sync-banner"><div><strong>Confirmação financeira</strong><span>${m?.metadata?.curva_sync_status==='aplicado'?'O CAPEX e o fluxo da obra na Curva também serão revertidos automaticamente.':''} ${type==='contingenciamento'?'A verba retorna da contingência para a obra no Controle.':m.afeta_estado_atual?'O Montante e o Saldo da OI serão reduzidos no Controle.':'O valor histórico deixa de compor o KPI.'}</span></div></div>
      <div id="v36-cancel-error"></div><div class="field"><label>Motivo do cancelamento</label><textarea id="v36-cancel-reason" rows="2" placeholder="Ex.: valor lançado incorretamente"></textarea></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-cancel-close">Voltar</button><button class="btn btn-secondary v36-danger" id="v36-cancel-confirm">Cancelar lançamento</button></div>
    </div>`;
    document.body.appendChild(backdrop); backdrop.querySelector('#v36-cancel-close').onclick=()=>backdrop.remove();
    const confirm=backdrop.querySelector('#v36-cancel-confirm'); confirm.onclick=async()=>{
      confirm.disabled=true;confirm.textContent='Cancelando...';const err=backdrop.querySelector('#v36-cancel-error');
      try{const {data,error}=await sb.rpc('cancelar_movimento_financeiro_integrado_v36',{p_movimento_id:m.id,p_motivo:backdrop.querySelector('#v36-cancel-reason').value.trim()||null});if(error)throw error;backdrop.remove();await refreshAfterMovementChange();alert(`${type==='aporte'?'Aporte':'Contingenciamento'} cancelado com sucesso.

Valor desfeito: ${brl.format(Number(data?.valor_cancelado||m.valor||0))}`);}catch(e){confirm.disabled=false;confirm.textContent='Cancelar lançamento';err.innerHTML=`<div class="error-msg">${escapeHtml(e.message)}</div>`;}
    };
  }

  async function openMovementKpiPanelV36(type) {
    try { await loadIntegrationContext(true); } catch(e) { alert('Não foi possível carregar os lançamentos: '+e.message); return; }
    const rows=V36.movements.filter(m=>m.tipo===type && m?.metadata?.curva_sync_status!=='cancelado');
    const total=rows.reduce((s,m)=>s+Number(m.valor||0),0);
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    const title=type==='aporte'?'Aportes Extras':'Contingenciamento'; const color=type==='aporte'?'var(--verde)':'var(--vermelho)';
    backdrop.innerHTML=`<div class="modal-box modal-wide"><h2>${title} — Detalhamento</h2><p class="sub">Lançamentos do Controle são editáveis/canceláveis. Registros legados permanecem somente leitura.</p>
      <div class="history-summary"><div><span>Total ativo</span><strong style="color:${color}">${brl.format(total)}</strong></div><div><span>Lançamentos ativos</span><strong>${rows.length}</strong></div><div><span>Exercício</span><strong>${exercise()}</strong></div></div>
      <div class="history-section"><div class="history-section-title">Lançamentos</div><div id="v36-movement-list">${rows.map(m=>{const st=movementStatus(m);const mode=m.origem_registro==='curva_legacy'?'Legado':m.afeta_estado_atual?'Operacional':'Histórico';return `<div class="v36-movement-row"><div class="v36-movement-head"><div><div class="v36-movement-title">${escapeHtml(m.nome||'—')}</div><div class="v36-movement-meta">${m.ordem_interna?`OI ${escapeHtml(m.ordem_interna)} · `:''}${escapeHtml(m.mes||'')} · ${mode}</div></div><div class="v36-movement-value" style="color:${color}">${brl.format(Number(m.valor||0))}</div></div><div style="margin-top:7px"><span class="v36-status-pill ${st.cls}">${escapeHtml(st.label)}</span></div>${st.editable?`<div class="v36-movement-actions"><button class="btn btn-secondary v36-edit-mov" data-id="${m.id}">Editar</button><button class="btn btn-secondary v36-cancel-mov v36-danger" data-id="${m.id}">Cancelar</button>${type==='aporte'&&m?.metadata?.curva_sync_status==='pendente'?`<button class="btn btn-primary v36-plan-mov" data-id="${m.id}">Planejar na Curva</button>`:''}</div>`:'<div class="v36-movement-actions"><span class="v36-readonly">Somente leitura</span></div>'}</div>`;}).join('')||'<div class="empty-state">Nenhum lançamento ativo.</div>'}</div></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v36-kpi-close">Fechar</button></div></div>`;
    document.body.appendChild(backdrop);backdrop.querySelector('#v36-kpi-close').onclick=()=>backdrop.remove();
    backdrop.querySelectorAll('.v36-edit-mov').forEach(btn=>btn.onclick=()=>{const m=rows.find(x=>String(x.id)===btn.dataset.id);if(m){backdrop.remove();openMovementEditV36(m,type);}});
    backdrop.querySelectorAll('.v36-cancel-mov').forEach(btn=>btn.onclick=()=>{const m=rows.find(x=>String(x.id)===btn.dataset.id);if(m){backdrop.remove();openMovementCancelV36(m,type);}});
    backdrop.querySelectorAll('.v36-plan-mov').forEach(btn=>btn.onclick=async()=>{const m=rows.find(x=>String(x.id)===btn.dataset.id);if(!m)return;try{const pctx=await getOiPlanningContext(String(m.ordem_interna),m.nome||'');backdrop.remove();openPlanningV36({kind:'aporte',source:'pending',movement:m,...m,value:Number(m.valor||0),planningContext:pctx});}catch(e){alert(e.message);}});
  }

  window.openControlKpiPanel = function(type) {
    if (type === 'aportes') return openMovementKpiPanelV36('aporte');
    if (type === 'contingenciamento') return openMovementKpiPanelV36('contingenciamento');
    return originalOpenControlKpiPanel(type);
  };

  injectStyles();
})();
