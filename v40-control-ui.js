/* HAPCAPEX V40.0.26 — Governança + tipologias dinâmicas
   - Nova O.I.: decisão explícita se participa da Curva (Sim/Não).
   - Edição futura da decisão de participação na Curva.
   - Nova aba OBRAS A PLANEJAR: novas O.I.s + aportes pendentes em uma única fila.
   - Exportação Excel para PMO.
   - Transferências: expandir/restaurar formulário.
   - Sem alterações experimentais de cabeçalho, scrollbar ou geometria das abas.
*/
(() => {
  'use strict';

  const VERSION = '40.0.26';
  let planningRowsV4023 = [];
  let planningSearchV4023 = '';
  let planningOriginV4023 = '';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function money(value) {
    try {
      if (typeof brl !== 'undefined' && brl?.format) return brl.format(Number(value || 0));
    } catch (_) {}
    return Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  function dateBr(value) {
    if (!value) return '—';
    const s = String(value).slice(0,10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  }

  function injectStyles() {
    if (document.getElementById('hap-v4024-control-ui')) return;
    document.getElementById('hap-v4022-control-ui')?.remove();
    const style = document.createElement('style');
    style.id = 'hap-v4024-control-ui';
    style.textContent = `
      .v4023-plan-note{border:1px solid #c7d8ee;background:#eef4fc;color:#244b74;border-radius:9px;padding:10px 11px;margin:10px 0 12px;font-size:10px;line-height:1.45}
      .nav-pill{white-space:nowrap}
      .v4023-plan-note strong{color:var(--azul)}
      .v4023-intent-box{border:1px solid var(--cinza-borda);background:#fff;border-radius:10px;padding:12px;margin:12px 0}
      .v4023-intent-box .field{margin:0}
      .v4023-intent-help{font-size:10px;color:var(--texto-suave);line-height:1.45;margin-top:6px}
      .v4023-dual-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px}
      .v4023-edit-warning{background:#fff8e6;border:1px solid #f0c98b;color:#68480d;border-radius:8px;padding:9px 10px;font-size:10px;line-height:1.45;margin:8px 0 12px}
      .v4023-plan-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--cinza-borda);border-radius:10px;padding:9px 10px;margin-bottom:12px}
      .v4023-plan-toolbar input{flex:1;min-width:260px;border:none;background:var(--cinza-bg);border-radius:8px;padding:8px 10px;font:inherit}
      .v4023-plan-toolbar select{min-width:205px;padding:8px 10px;border:1px solid var(--cinza-borda);border-radius:8px;background:#fff;font:inherit}
      .v4023-origin{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:800;white-space:nowrap}
      .v4023-origin.oi{background:#e8f0fb;color:#1a4b8c}
      .v4023-origin.aporte{background:#e1f5ee;color:#126b37}
      .v4023-plan-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      .v4023-plan-table td{vertical-align:middle}
      .v4024-import-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0 12px}
      .v4024-import-card{border:1px solid var(--cinza-borda);border-radius:9px;background:#f7f9fc;padding:9px 10px}
      .v4024-import-card span{display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:var(--texto-suave)}
      .v4024-import-card strong{display:block;margin-top:4px;color:var(--azul);font-size:13px}
      .v4024-preview-table select{min-width:155px;padding:6px;border:1px solid var(--cinza-borda);border-radius:7px;background:#fff;font:inherit;font-size:10px}
      .v4024-preview-table td{vertical-align:middle}
      .v4024-import-warning{border:1px solid #f0c98b;background:#fff8e6;color:#68480d;border-radius:8px;padding:9px 10px;font-size:10px;line-height:1.45;margin:8px 0}
      .v4024-import-ok{border:1px solid #b9dfc8;background:#eefaf3;color:#17643a;border-radius:8px;padding:9px 10px;font-size:10px;line-height:1.45;margin:8px 0}
      .v4023-transfer-modal{position:relative}
      .v4023-transfer-expand-btn{position:absolute;right:18px;top:15px;z-index:2;border:1px solid var(--cinza-borda);background:#fff;color:var(--azul-medio);border-radius:8px;padding:6px 10px;font:inherit;font-size:10px;font-weight:800;cursor:pointer}
      .v4023-transfer-modal.v4023-expanded{width:calc(100vw - 40px)!important;max-width:1600px!important;max-height:calc(100vh - 40px)!important}
      .v4023-transfer-modal.v4023-expanded #linhas-container input[id^="t-justificativa-"]{width:320px!important}
      @media(max-width:720px){
        .v4023-dual-actions{flex-direction:column-reverse}.v4023-dual-actions .btn{width:100%}
        .v4023-plan-toolbar{align-items:stretch}.v4023-plan-toolbar input,.v4023-plan-toolbar select,.v4023-plan-toolbar .btn{width:100%;min-width:0}
        .v4024-import-summary{grid-template-columns:1fr 1fr}.v4024-preview-table select{min-width:130px}
        .v4023-transfer-expand-btn{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  async function getRulesV4023() {
    const { data, error } = await sb.from('capex_flow_rules')
      .select('code,name,description,sort_order').eq('selectable', true).order('sort_order', { ascending:true });
    if (error) throw error;
    return data || [];
  }

  function populateDatalist(id, values) {
    const el = document.getElementById(id);
    if (!el || !Array.isArray(values)) return;
    el.innerHTML = values.map(v => `<option value="${esc(v)}">`).join('');
  }

  function openNovaOiV4023(prefill) {
    prefill = prefill || {};
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.v4023NovaOi = '1';
    backdrop.innerHTML = `
      <div class="modal-box modal-wide">
        <h2>Nova ordem interna</h2>
        <p class="sub">Cadastre a O.I. e defina explicitamente se ela participará da Curva de Capex.</p>
        <div id="modal-error"></div>
        <div class="grid-2">
          <div class="field"><label>Ordem interna *</label><input type="text" id="f-oi" value="${esc(prefill.ordem_interna||'')}"></div>
          <div class="field"><label>Descrição / obra *</label><input type="text" id="f-desc" value="${esc(prefill.descricao||'')}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Classificação pacote CAPEX * (col. G)</label><input type="text" id="f-pacote" list="dl-pacote"><datalist id="dl-pacote"></datalist></div>
          <div class="field"><label>Classificação HEAD operação * (col. H)</label><input type="text" id="f-head" list="dl-head"><datalist id="dl-head"></datalist></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Grupo executivo * (col. I)</label><input type="text" id="f-grupo" list="dl-grupo"><datalist id="dl-grupo"></datalist></div>
          <div class="field"><label>Detalhamento * (col. J)</label><input type="text" id="f-detalhamento" list="dl-detalhamento"><datalist id="dl-detalhamento"></datalist></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Categoria ORC * (col. K)</label><input type="text" id="f-categoria" list="dl-categoria"><datalist id="dl-categoria"></datalist></div>
          <div class="field"><label>Detalhamento ORC * (col. L)</label><input type="text" id="f-detalhamento-orc" list="dl-detalhamento-orc"><datalist id="dl-detalhamento-orc"></datalist></div>
        </div>
        <p class="sub" style="margin:4px 0 12px;">Comece a digitar para ver classificações já usadas, ou digite uma nova.</p>
        <div class="grid-2">
          <div class="field"><label>Montante atribuído</label><input type="number" step="0.01" id="f-montante" value="0"></div>
          <div class="field"><label>Valor compromissado</label><input type="number" step="0.01" id="f-compromissado" value="0"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Data de início</label><input type="date" id="f-data-inicio"></div>
          <div class="field"><label>Data de fim</label><input type="date" id="f-data-fim"></div>
        </div>

        <div class="v4023-intent-box">
          <div class="field">
            <label>Esta O.I. irá para a Curva de Capex? *</label>
            <select id="f-vai-curva">
              <option value="">Selecione...</option>
              <option value="sim">Sim — deve ser planejada na Curva</option>
              <option value="nao">Não — não participa da Curva</option>
            </select>
          </div>
          <div class="v4023-intent-help">Essa decisão pode ser alterada futuramente em <strong>Editar O.I.</strong>. O sistema nunca apaga automaticamente um planejamento que já exista na Curva.</div>
        </div>

        <div id="v4023-planning-options" hidden>
          <div class="grid-2">
            <div class="field">
              <label>Tipologia da Curva *</label>
              <select id="f-tipologia-curva"><option value="">Carregando tipologias...</option></select>
              <div style="font-size:10px;color:var(--texto-suave);margin-top:4px;">Lista central compartilhada com a Curva de Capex.</div>
            </div>
            <div class="field">
              <label>Regra de planejamento da Curva</label>
              <select id="f-flow-rule"><option value="standard_15_75_10">15 / 75 / 10</option></select>
              <div id="f-flow-rule-note" style="font-size:10px;color:var(--texto-suave);margin-top:4px;"></div>
            </div>
          </div>
          <div class="v4023-plan-note"><strong>Planejar agora:</strong> cria a obra na Curva junto com a O.I.; exige montante, início e fim.<br><strong>Planejar depois:</strong> a O.I. entra na aba <strong>Obras a Planejar</strong> para tratamento posterior/PMO.</div>
        </div>
        <p class="sub" style="margin:0 0 8px;">* obrigatório para cadastro.</p>
        <div class="v4023-dual-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn btn-secondary" id="v4023-save-later" disabled>Selecione Sim/Não</button>
          <button class="btn btn-primary" id="v4023-save-now" hidden>Criar e planejar agora</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.querySelector('#modal-cancel').onclick = close;
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    Promise.all([sb.rpc('get_classificacoes_existentes'), getRulesV4023(), loadTipologiasV4026()]).then(([classResult, rules, tipologias]) => {
      if (!classResult.error && classResult.data) {
        const d = classResult.data;
        populateDatalist('dl-grupo', d.grupo_executivo); populateDatalist('dl-categoria', d.categoria_orc);
        populateDatalist('dl-pacote', d.classificacao_pacote_capex); populateDatalist('dl-head', d.classificacao_head_operacao);
        populateDatalist('dl-detalhamento', d.detalhamento); populateDatalist('dl-detalhamento-orc', d.detalhamento_orc);
      }
      const tipoSelect = backdrop.querySelector('#f-tipologia-curva');
      if (tipoSelect) {
        tipoSelect.innerHTML = '<option value="">Selecione a tipologia</option>' + tipologias.map(t => `<option value="${esc(t.nome)}">${esc(t.emoji||'📌')} ${esc(t.nome)}</option>`).join('');
      }
      const select = backdrop.querySelector('#f-flow-rule');
      if (select && rules.length) {
        select.innerHTML = rules.map(r => `<option value="${esc(r.code)}" ${r.code==='standard_15_75_10'?'selected':''}>${esc(r.name)}</option>`).join('');
        const note = () => { const r=rules.find(x=>x.code===select.value); backdrop.querySelector('#f-flow-rule-note').textContent=r?.description||''; };
        select.onchange=note; note();
      }
    }).catch(() => {});

    const intent = backdrop.querySelector('#f-vai-curva');
    const later = backdrop.querySelector('#v4023-save-later');
    const now = backdrop.querySelector('#v4023-save-now');
    const options = backdrop.querySelector('#v4023-planning-options');
    const syncIntentUi = () => {
      const v = intent.value;
      options.hidden = v !== 'sim';
      now.hidden = v !== 'sim';
      later.disabled = !v;
      if (!v) later.textContent = 'Selecione Sim/Não';
      else if (v === 'sim') later.textContent = 'Criar e planejar depois';
      else later.textContent = 'Criar O.I. sem Curva';
    };
    intent.onchange = syncIntentUi; syncIntentUi();

    async function save(planejarAgora) {
      const errorBox = backdrop.querySelector('#modal-error');
      const escolha = intent.value;
      if (!escolha) { errorBox.innerHTML='<div class="error-msg">Informe se esta O.I. irá para a Curva de Capex.</div>'; return; }
      const vai = escolha === 'sim';
      if (planejarAgora && !vai) return;
      const payload = {
        p_ordem_interna: backdrop.querySelector('#f-oi').value.trim(), p_descricao: backdrop.querySelector('#f-desc').value.trim(),
        p_grupo_executivo: backdrop.querySelector('#f-grupo').value.trim(), p_categoria_orc: backdrop.querySelector('#f-categoria').value.trim(),
        p_classificacao_pacote_capex: backdrop.querySelector('#f-pacote').value.trim(), p_classificacao_head_operacao: backdrop.querySelector('#f-head').value.trim(),
        p_detalhamento: backdrop.querySelector('#f-detalhamento').value.trim(), p_detalhamento_orc: backdrop.querySelector('#f-detalhamento-orc').value.trim(),
        p_montante_atribuido: Number(backdrop.querySelector('#f-montante').value || 0), p_valor_compromissado: Number(backdrop.querySelector('#f-compromissado').value || 0),
        p_data_inicio: backdrop.querySelector('#f-data-inicio').value || null, p_data_fim: backdrop.querySelector('#f-data-fim').value || null,
        p_vai_para_curva: vai, p_planejar_agora: !!planejarAgora,
        p_flow_rule: backdrop.querySelector('#f-flow-rule').value || 'standard_15_75_10',
        p_tipologia_curva: backdrop.querySelector('#f-tipologia-curva')?.value || null
      };
      const labels = [['p_ordem_interna','Ordem interna'],['p_descricao','Descrição / obra'],['p_grupo_executivo','Grupo executivo'],['p_categoria_orc','Categoria ORC'],['p_classificacao_pacote_capex','Classificação pacote CAPEX'],['p_classificacao_head_operacao','Classificação HEAD operação'],['p_detalhamento','Detalhamento'],['p_detalhamento_orc','Detalhamento ORC']];
      const missing = labels.filter(([k])=>!payload[k]).map(([,v])=>v);
      if (missing.length) { errorBox.innerHTML=`<div class="error-msg">Preencha os campos obrigatórios: ${esc(missing.join(', '))}.</div>`; return; }
      if (planejarAgora && payload.p_montante_atribuido<=0) { errorBox.innerHTML='<div class="error-msg">Para planejar agora, informe Montante atribuído maior que zero.</div>'; return; }
      if (planejarAgora && (!payload.p_data_inicio || !payload.p_data_fim)) { errorBox.innerHTML='<div class="error-msg">Para planejar agora, informe as datas de início e fim.</div>'; return; }
      if (planejarAgora && !payload.p_tipologia_curva) { errorBox.innerHTML='<div class="error-msg">Para planejar agora, selecione a Tipologia da Curva.</div>'; return; }

      later.disabled=true; now.disabled=true; const active=planejarAgora?now:later; const old=active.textContent;
      active.textContent=planejarAgora?'Criando e planejando...':'Criando O.I...'; errorBox.innerHTML='';
      try {
        const { data, error } = await sb.rpc('criar_ordem_interna_integrada_v4026', payload);
        if (error) throw error;
        close(); await refreshCurrent();
        if (vai && !planejarAgora && data?.planejamento_status==='pendente') alert(`O.I. ${payload.p_ordem_interna} criada com sucesso.\n\nEla foi incluída na aba "Obras a Planejar".`);
      } catch (e) {
        later.disabled=false; now.disabled=false; active.textContent=old;
        errorBox.innerHTML=`<div class="error-msg">${esc(e?.message||String(e))}</div>`;
      }
    }
    later.onclick=()=>save(false); now.onclick=()=>save(true);
  }

  async function openPlanPendingOiV4023(oi) {
    const backdrop=document.createElement('div'); backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box"><h2>Planejar O.I. na Curva</h2><p class="sub">OI ${esc(oi)}</p><div id="v4023-plan-error"></div>
      <div id="v4023-plan-loading" class="v4023-plan-note">Carregando dados atuais da O.I...</div>
      <div id="v4023-plan-form" hidden><div class="v4023-plan-note"><strong id="v4023-plan-name"></strong><br>Montante atual: <strong id="v4023-plan-value"></strong></div>
      <div class="grid-2"><div class="field"><label>Data de início *</label><input type="date" id="v4023-plan-start"></div><div class="field"><label>Data de fim *</label><input type="date" id="v4023-plan-end"></div></div>
      <div class="grid-2"><div class="field"><label>Tipologia da Curva *</label><select id="v4023-plan-type"><option value="">Carregando...</option></select></div><div class="field"><label>Regra de planejamento *</label><select id="v4023-plan-rule"></select><div id="v4023-plan-rule-note" style="font-size:10px;color:var(--texto-suave);margin-top:4px;"></div></div></div></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v4023-plan-cancel">Cancelar</button><button class="btn btn-primary" id="v4023-plan-save" disabled>Planejar na Curva</button></div></div>`;
    document.body.appendChild(backdrop); backdrop.querySelector('#v4023-plan-cancel').onclick=()=>backdrop.remove();
    try {
      const [workResult,rules,tipologias,tipoAtualResult]=await Promise.all([sb.from('vw_controle_capex_admin').select('ordem_interna,obra,montante_atribuido,data_inicio,data_fim').eq('ordem_interna',oi).maybeSingle(),getRulesV4023(),loadTipologiasV4026(),sb.rpc('obter_tipologia_curva_oi',{p_ordem_interna:oi})]);
      if(workResult.error)throw workResult.error; if(!workResult.data)throw new Error('O.I. não encontrada no Controle.');
      const w=workResult.data; backdrop.querySelector('#v4023-plan-name').textContent=w.obra||oi; backdrop.querySelector('#v4023-plan-value').textContent=money(w.montante_atribuido||0);
      backdrop.querySelector('#v4023-plan-start').value=w.data_inicio?String(w.data_inicio).slice(0,10):''; backdrop.querySelector('#v4023-plan-end').value=w.data_fim?String(w.data_fim).slice(0,10):'';
      const tipoSel=backdrop.querySelector('#v4023-plan-type'); const inferred=inferTipoV4024({obra:w.obra,tipologia_curva:tipoAtualResult?.data||''}); tipoSel.innerHTML='<option value="">Selecione a tipologia</option>'+tipologias.map(t=>`<option value="${esc(t.nome)}" ${t.nome===inferred?'selected':''}>${esc(t.emoji||'📌')} ${esc(t.nome)}</option>`).join('');
      const sel=backdrop.querySelector('#v4023-plan-rule'); sel.innerHTML=rules.map(r=>`<option value="${esc(r.code)}" ${r.code==='standard_15_75_10'?'selected':''}>${esc(r.name)}</option>`).join('');
      const note=()=>{const r=rules.find(x=>x.code===sel.value);backdrop.querySelector('#v4023-plan-rule-note').textContent=r?.description||'';}; sel.onchange=note;note();
      backdrop.querySelector('#v4023-plan-loading').hidden=true;backdrop.querySelector('#v4023-plan-form').hidden=false;backdrop.querySelector('#v4023-plan-save').disabled=false;
    } catch(e) { backdrop.querySelector('#v4023-plan-loading').hidden=true;backdrop.querySelector('#v4023-plan-error').innerHTML=`<div class="error-msg">${esc(e?.message||String(e))}</div>`; }
    backdrop.querySelector('#v4023-plan-save').onclick=async()=>{
      const start=backdrop.querySelector('#v4023-plan-start').value||null,end=backdrop.querySelector('#v4023-plan-end').value||null,rule=backdrop.querySelector('#v4023-plan-rule').value||'standard_15_75_10',tipo=backdrop.querySelector('#v4023-plan-type').value||'',err=backdrop.querySelector('#v4023-plan-error');
      if(!start||!end){err.innerHTML='<div class="error-msg">Informe as datas de início e fim.</div>';return;}
      if(!tipo){err.innerHTML='<div class="error-msg">Selecione a Tipologia da Curva.</div>';return;}
      const btn=backdrop.querySelector('#v4023-plan-save');btn.disabled=true;btn.textContent='Planejando...';err.innerHTML='';
      try{const {error}=await sb.rpc('planejar_oi_pendente_v4026',{p_ordem_interna:oi,p_data_inicio:start,p_data_fim:end,p_flow_rule:rule,p_tipologia_curva:tipo});if(error)throw error;backdrop.remove();await refreshCurrent();}
      catch(e){btn.disabled=false;btn.textContent='Planejar na Curva';err.innerHTML=`<div class="error-msg">${esc(e?.message||String(e))}</div>`;}
    };
  }

  function enhanceTransferModalV4023() {
    const boxes=Array.from(document.querySelectorAll('.modal-backdrop .modal-box'));
    const box=boxes.reverse().find(el=>el.querySelector('h2')?.textContent?.trim()==='Nova transferência');
    if(!box||box.dataset.v4023ExpandedReady==='1')return;
    box.dataset.v4023ExpandedReady='1';box.classList.add('v4023-transfer-modal');
    const btn=document.createElement('button');btn.type='button';btn.className='v4023-transfer-expand-btn';btn.textContent='⛶ Expandir formulário';btn.title='Usar mais largura da tela para preencher as transferências';
    btn.onclick=()=>{const x=box.classList.toggle('v4023-expanded');btn.textContent=x?'↙ Restaurar tamanho':'⛶ Expandir formulário';};box.appendChild(btn);
  }

  function wrapTransferModalV4023() {
    if(window.__HAP_V4023_TRANSFER_WRAPPED__)return; const original=window.openNovaTransferenciaModal;
    if(typeof original!=='function')return; window.openNovaTransferenciaModal=function(...args){const r=original.apply(this,args);queueMicrotask(enhanceTransferModalV4023);return r;};window.__HAP_V4023_TRANSFER_WRAPPED__=true;
  }

  function enhanceEditOiV4023(backdrop,id,gov) {
    const box=backdrop?.querySelector('.modal-box'); if(!box||box.dataset.v4023Governance==='1')return;
    box.dataset.v4023Governance='1'; const actions=box.querySelector('.modal-actions'); if(!actions)return;
    const block=document.createElement('div');block.className='v4023-intent-box';block.innerHTML=`<div class="field"><label>Esta O.I. irá para a Curva de Capex?</label><select id="v4023-edit-vai-curva"><option value="" ${gov?.vai_para_curva==null?'selected':''}>Não definido (cadastro legado)</option><option value="sim" ${gov?.vai_para_curva===true?'selected':''}>Sim — deve participar da Curva</option><option value="nao" ${gov?.vai_para_curva===false?'selected':''}>Não — não participa da Curva</option></select></div><div class="v4023-intent-help">Você pode alterar essa decisão. Planejamento já existente nunca é apagado automaticamente.</div><div id="v4023-edit-curve-warning"></div>`;
    actions.before(block); const select=block.querySelector('#v4023-edit-vai-curva'),warn=block.querySelector('#v4023-edit-curve-warning');
    const updateWarn=()=>{
      if(select.value==='nao'&&Number(gov?.qtd_aportes_pendentes||0)>0) warn.innerHTML=`<div class="v4023-edit-warning"><strong>Atenção:</strong> existem ${Number(gov.qtd_aportes_pendentes)} aporte(s) aguardando planejamento. O sistema exigirá que sejam planejados ou cancelados antes de marcar “Não”.</div>`;
      else if(select.value==='nao'&&gov?.existe_na_curva) warn.innerHTML='<div class="v4023-edit-warning"><strong>Planejamento existente protegido:</strong> ao salvar “Não”, o planejamento que já existe na Curva será preservado. Apenas a decisão de governança do cadastro será alterada.</div>';
      else if(select.value==='sim'&&!gov?.existe_na_curva) warn.innerHTML='<div class="v4023-plan-note"><strong>Ao salvar:</strong> esta O.I. entrará automaticamente na aba “Obras a Planejar”.</div>';
      else warn.innerHTML='';
    };select.onchange=updateWarn;updateWarn();

    const save=box.querySelector('#modal-save'); if(!save)return;
    save.onclick=async()=>{
      const payload={p_id:id,p_descricao:box.querySelector('#e-desc').value.trim(),p_grupo_executivo:box.querySelector('#e-grupo').value.trim(),p_categoria_orc:box.querySelector('#e-categoria').value.trim(),p_classificacao_pacote_capex:box.querySelector('#e-pacote').value.trim(),p_classificacao_head_operacao:box.querySelector('#e-head').value.trim(),p_detalhamento:box.querySelector('#e-detalhamento').value.trim(),p_detalhamento_orc:box.querySelector('#e-detalhamento-orc').value.trim(),p_montante_atribuido:Number(box.querySelector('#e-montante').value||0),p_valor_compromissado:Number(box.querySelector('#e-compromissado').value||0),p_data_inicio:box.querySelector('#e-data-inicio').value||null,p_data_fim:box.querySelector('#e-data-fim').value||null,p_vai_para_curva:select.value===''?null:select.value==='sim'};
      const err=box.querySelector('#modal-error');save.disabled=true;save.textContent='Salvando...';err.innerHTML='';
      try{const {data,error}=await sb.rpc('editar_ordem_interna_integrada_v4023',payload);if(error)throw error;backdrop.remove();await refreshCurrent();if(data?.aviso)alert(data.aviso);}
      catch(e){save.disabled=false;save.textContent='Salvar alterações';err.innerHTML=`<div class="error-msg">${esc(e?.message||String(e))}</div>`;}
    };
  }

  function wrapEditOiV4023() {
    if(window.__HAP_V4023_EDIT_WRAPPED__)return; const original=window.editarOi;if(typeof original!=='function')return;
    window.editarOi=async function(id){await original(id);const boxes=Array.from(document.querySelectorAll('.modal-backdrop')).reverse();const backdrop=boxes.find(b=>b.querySelector('h2')?.textContent?.trim()==='Editar ordem interna'&&b.querySelector('#e-desc'));if(!backdrop)return;try{const {data,error}=await sb.rpc('obter_governanca_oi_v4023',{p_id:id});if(error)throw error;enhanceEditOiV4023(backdrop,id,data||{});}catch(e){const err=backdrop.querySelector('#modal-error');if(err)err.innerHTML=`<div class="error-msg">Não foi possível carregar a configuração da Curva: ${esc(e?.message||String(e))}</div>`;}};
    window.__HAP_V4023_EDIT_WRAPPED__=true;
  }

  function filteredPlanningRowsV4023() {
    const q=planningSearchV4023.trim().toLowerCase();
    return planningRowsV4023.filter(r=>{
      const text=[r.ordem_interna,r.obra,r.grupo_executivo,r.categoria_orc,r.classificacao_pacote_capex].join(' ').toLowerCase();
      const searchOk=!q||text.includes(q);
      const origin=r.qtd_aportes_pendentes>0?'aporte':'oi';
      return searchOk&&(!planningOriginV4023||planningOriginV4023===origin);
    });
  }

  function exportPlanningExcelV4023() {
    if(typeof XLSX==='undefined'){alert('Biblioteca de Excel não disponível nesta sessão.');return;}
    const rows=filteredPlanningRowsV4023(); if(!rows.length){alert('Não há obras para exportar com os filtros atuais.');return;}
    const data=rows.map(r=>({
      'Ordem Interna':r.ordem_interna,'Obra':r.obra||'','Motivo':r.qtd_aportes_pendentes>0?'Aporte extra aguardando planejamento':'Nova O.I. destinada à Curva',
      'Montante Atual':Number(r.montante_atribuido||0),'Aportes Pendentes':Number(r.valor_aportes_pendentes||0),'Qtde Aportes Pendentes':Number(r.qtd_aportes_pendentes||0),
      'Mês(es) dos Aportes':r.meses_aportes||'','Data Início (PMO)':r.data_inicio||'','Data Fim (PMO)':r.data_fim||'','Existe na Curva':r.existe_na_curva?'Sim':'Não',
      'Grupo Executivo':r.grupo_executivo||'','Categoria ORC':r.categoria_orc||'','Pacote CAPEX':r.classificacao_pacote_capex||'','Status':r.status_planejamento||'',
      'Pendente Desde':r.pendente_desde?String(r.pendente_desde).slice(0,10):''
    }));
    const totalAportes=rows.reduce((s,r)=>s+Number(r.valor_aportes_pendentes||0),0);
    const summary=[{'Indicador':'Obras pendentes','Valor':rows.length},{'Indicador':'Novas O.I.s sem aporte pendente','Valor':rows.filter(r=>Number(r.qtd_aportes_pendentes||0)===0).length},{'Indicador':'O.I.s com aporte pendente','Valor':rows.filter(r=>Number(r.qtd_aportes_pendentes||0)>0).length},{'Indicador':'Valor de aportes pendentes','Valor':totalAportes}];
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(data),ws2=XLSX.utils.json_to_sheet(summary);
    ws['!cols']=[{wch:14},{wch:42},{wch:34},{wch:18},{wch:20},{wch:20},{wch:20},{wch:14},{wch:14},{wch:16},{wch:24},{wch:22},{wch:24},{wch:34},{wch:16}];
    if(ws['!ref'])ws['!autofilter']={ref:ws['!ref']};ws2['!cols']=[{wch:32},{wch:22}];
    XLSX.utils.book_append_sheet(wb,ws,'Obras a Planejar');XLSX.utils.book_append_sheet(wb,ws2,'Resumo');
    const d=new Date(),stamp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    XLSX.writeFile(wb,`HAPCAPEX_Obras_a_Planejar_${stamp}.xlsx`);
  }


  let TIPOLOGIAS_CATALOGO_V4026=[];
  let TIPOLOGIAS_V4024=['Legalização','Hospital','TEA','Medprev','Posto de Coleta','Leitos / Virose','Pronto Atendimento','Clínica','Ag. Transfusional','Hemodinâmica','Lab / Diagnóstico','CD','Mega Unidade','Pacotes Regulatórios','Qualivida','ADM'];

  async function loadTipologiasV4026(force=false){
    if(!force&&TIPOLOGIAS_CATALOGO_V4026.length)return TIPOLOGIAS_CATALOGO_V4026;
    const {data,error}=await sb.rpc('listar_tipologias_curva_v4026');
    if(error)throw error;
    TIPOLOGIAS_CATALOGO_V4026=(Array.isArray(data)?data:[]).filter(x=>x?.nome);
    if(TIPOLOGIAS_CATALOGO_V4026.length)TIPOLOGIAS_V4024=TIPOLOGIAS_CATALOGO_V4026.map(x=>String(x.nome));
    return TIPOLOGIAS_CATALOGO_V4026;
  }
  function tipoNomePorChaveV4026(key,fallback){return TIPOLOGIAS_CATALOGO_V4026.find(x=>x.system_key===key)?.nome||fallback;}

  function normHeaderV4024(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');}
  function isoDateV4024(value){
    if(value===null||value===undefined||value==='')return null;
    if(value instanceof Date&&!Number.isNaN(value.getTime()))return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
    if(typeof value==='number'&&Number.isFinite(value)){
      const d=XLSX.SSF.parse_date_code(value); if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    const s=String(value).trim();
    let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return null;
  }
  function inferTipoV4024(r){
    if(TIPOLOGIAS_V4024.includes(r.tipologia_curva))return r.tipologia_curva;
    if(String(r.tipologia_curva||'').trim()==='Classificação')return tipoNomePorChaveV4026('legalizacao','Legalização');
    if(TIPOLOGIAS_V4024.includes(r.tipologia_atual_curva))return r.tipologia_atual_curva;
    const n=String(r.obra||'').toLowerCase();
    if(n.includes('visa')||n.includes('ppci')||n.includes('legaliza'))return tipoNomePorChaveV4026('legalizacao','Legalização');
    if(n.includes('hospital')||/\bho\b/.test(n)||n.includes('hapfor')||n.includes('salvalus'))return tipoNomePorChaveV4026('hospital','Hospital');
    if(n.includes('clínica')||n.includes('clinica'))return tipoNomePorChaveV4026('clinica','Clínica');
    if(n.includes('resson')||n.includes('diagn')||n.includes('laborat'))return tipoNomePorChaveV4026('lab_diagnostico','Lab / Diagnóstico');
    if(n.includes('tea')||n.includes('autismo'))return tipoNomePorChaveV4026('tea','TEA');
    if(n.includes('medprev'))return tipoNomePorChaveV4026('medprev','Medprev');
    if(n.includes('coleta'))return tipoNomePorChaveV4026('posto_coleta','Posto de Coleta');
    if(n.includes('hemodin'))return tipoNomePorChaveV4026('hemodinamica','Hemodinâmica');
    if(n.includes('ag.')||n.includes('transfus'))return tipoNomePorChaveV4026('ag_transfusional','Ag. Transfusional');
    if(n.includes(' cd ')||n.startsWith('cd ')||n.includes('centro de distrib'))return tipoNomePorChaveV4026('cd','CD');
    if(n.includes('adm')||n.includes('patrimônio')||n.includes('patrimonio'))return tipoNomePorChaveV4026('adm','ADM');
    return tipoNomePorChaveV4026('legalizacao','Legalização');
  }
  function defaultRuleV4024(r){return r.flow_rule_curva||(/_OPER\s*$/i.test(String(r.obra||''))?'oper_realized_plus_balance_dec':'standard_15_75_10');}

  async function parsePlanningWorkbookV4024(file){
    if(typeof XLSX==='undefined')throw new Error('Biblioteca de Excel não disponível nesta sessão.');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const sheetName=wb.SheetNames.find(n=>normHeaderV4024(n).includes('obras a planejar'))||wb.SheetNames[0];
    if(!sheetName)throw new Error('A planilha não possui abas.');
    const aoa=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:true,defval:null});
    if(!aoa.length)throw new Error('A aba de planejamento está vazia.');
    const headers=(aoa[0]||[]).map(normHeaderV4024);
    const find=(...names)=>headers.findIndex(h=>names.some(n=>h===normHeaderV4024(n)));
    const oiCol=find('Ordem Interna','OI','O.I.');
    const iniCol=find('Data Início (PMO)','Data Inicio (PMO)','Data Início','Data Inicio','Início','Inicio');
    const fimCol=find('Data Fim (PMO)','Data Fim','Fim');
    if(oiCol<0||iniCol<0||fimCol<0)throw new Error('Não encontrei as colunas Ordem Interna, Data Início (PMO) e Data Fim (PMO). Use a planilha exportada pelo HAPCAPEX.');
    const current=new Map(planningRowsV4023.map(r=>[String(r.ordem_interna).trim(),r]));
    const seen=new Set(),valid=[],missing=[],ignored=[],invalid=[];
    for(let i=1;i<aoa.length;i++){
      const row=aoa[i]||[];const oi=String(row[oiCol]??'').replace(/\.0$/,'').trim();if(!oi)continue;
      if(seen.has(oi)){invalid.push(`OI ${oi}: aparece mais de uma vez no Excel.`);continue;}seen.add(oi);
      const live=current.get(oi);if(!live){ignored.push(oi);continue;}
      const inicio=isoDateV4024(row[iniCol]),fim=isoDateV4024(row[fimCol]);
      if(!row[iniCol]&&!row[fimCol]){missing.push(oi);continue;}
      if(!inicio||!fim){invalid.push(`OI ${oi}: início e fim precisam ser datas válidas.`);continue;}
      if(fim<inicio){invalid.push(`OI ${oi}: a data de fim é anterior ao início.`);continue;}
      valid.push({oi,inicio,fim,flow_rule:defaultRuleV4024(live),tipologia:inferTipoV4024(live)});
    }
    if(invalid.length)throw new Error(invalid.join('\n'));
    if(!valid.length)throw new Error('Nenhuma obra pendente possui as duas datas preenchidas no arquivo.');
    return {sheetName,valid,missing,ignored,totalRows:seen.size};
  }

  async function openPmoPreviewV4024(parsed){
    await loadTipologiasV4026();
    const {data,error}=await sb.rpc('prever_planejamento_pmo_v4024',{p_linhas:parsed.valid});
    if(error)throw error;
    const preview=Array.isArray(data)?data:[];if(!preview.length)throw new Error('Nenhuma obra válida para pré-visualização.');
    const rules=await getRulesV4023();
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    const totalAportes=preview.reduce((s,r)=>s+Number(r.valor_aportes_pendentes||0),0);
    const totalFinal=preview.reduce((s,r)=>s+Number(r.capex_final_previsto||0),0);
    backdrop.innerHTML=`<div class="modal-box modal-wide" style="max-width:1450px">
      <h2>Confirmar planejamento recebido do PMO</h2>
      <p class="sub">Importar o Excel não altera a Curva. Confira abaixo. Somente o botão final executará a gravação em lote.</p>
      <div class="v4024-import-summary"><div class="v4024-import-card"><span>Obras prontas</span><strong>${preview.length}</strong></div><div class="v4024-import-card"><span>Sem datas completas</span><strong>${parsed.missing.length}</strong></div><div class="v4024-import-card"><span>Aportes envolvidos</span><strong>${money(totalAportes)}</strong></div><div class="v4024-import-card"><span>CAPEX final das obras</span><strong>${money(totalFinal)}</strong></div></div>
      ${parsed.missing.length?`<div class="v4024-import-warning"><strong>${parsed.missing.length} obra(s) continuam pendentes</strong> porque o PMO não preencheu início e fim: ${esc(parsed.missing.join(', '))}.</div>`:''}
      ${parsed.ignored.length?`<div class="v4024-import-warning"><strong>${parsed.ignored.length} O.I.(s) foram ignoradas</strong> porque não estão mais na fila atual: ${esc(parsed.ignored.join(', '))}.</div>`:''}
      <div class="v4024-import-ok"><strong>Operação transacional:</strong> se qualquer obra falhar na confirmação, nenhuma das obras deste lote será parcialmente enviada para a Curva.</div>
      <div class="table-card" style="max-height:56vh;overflow:auto"><table class="v4024-preview-table"><thead><tr><th>O.I.</th><th>Obra</th><th>Início</th><th>Fim</th><th>Tipologia</th><th>Regra</th><th>Curva atual</th><th>Aporte pendente</th><th>CAPEX após confirmação</th><th>Ação</th></tr></thead><tbody>${preview.map((r,i)=>`<tr data-v4024-row="${i}"><td>${esc(r.oi)}</td><td>${esc(r.obra||'—')}</td><td>${dateBr(r.inicio)}</td><td>${dateBr(r.fim)}</td><td><select class="v4024-type">${TIPOLOGIAS_V4024.map(t=>`<option value="${esc(t)}" ${t===r.tipologia?'selected':''}>${esc(t)}</option>`).join('')}</select></td><td><select class="v4024-rule">${rules.map(x=>`<option value="${esc(x.code)}" ${x.code===r.flow_rule?'selected':''}>${esc(x.name)}</option>`).join('')}</select></td><td>${r.existe_na_curva?money(r.capex_atual_curva||0):'Ainda não existe'}</td><td>${Number(r.qtd_aportes_pendentes||0)>0?`${money(r.valor_aportes_pendentes||0)}<br><small>${r.qtd_aportes_pendentes} lançamento(s)</small>`:'—'}</td><td><strong>${money(r.capex_final_previsto||0)}</strong></td><td>${esc(r.acao||'—')}</td></tr>`).join('')}</tbody></table></div>
      <div id="v4024-apply-error"></div><div class="modal-actions"><button class="btn btn-secondary" id="v4024-preview-close">Cancelar</button><button class="btn btn-primary" id="v4024-preview-apply">Confirmar envio de ${preview.length} obra(s) para a Curva</button></div>
    </div>`;
    document.body.appendChild(backdrop);backdrop.querySelector('#v4024-preview-close').onclick=()=>backdrop.remove();
    backdrop.querySelector('#v4024-preview-apply').onclick=async()=>{
      const linhas=preview.map((r,i)=>{const tr=backdrop.querySelector(`[data-v4024-row="${i}"]`);return {oi:r.oi,inicio:String(r.inicio).slice(0,10),fim:String(r.fim).slice(0,10),tipologia:tr.querySelector('.v4024-type').value,flow_rule:tr.querySelector('.v4024-rule').value};});
      const btn=backdrop.querySelector('#v4024-preview-apply'),errBox=backdrop.querySelector('#v4024-apply-error');btn.disabled=true;btn.textContent='Validando lote...';errBox.innerHTML='';
      try{
        const check=await sb.rpc('prever_planejamento_pmo_v4024',{p_linhas:linhas});if(check.error)throw check.error;
        btn.textContent='Enviando para a Curva...';const applied=await sb.rpc('aplicar_planejamento_pmo_v4024',{p_linhas:linhas});if(applied.error)throw applied.error;
        backdrop.remove();await loadPlanningTabV4023();alert(`Planejamento do PMO aplicado com sucesso.\n\n${Number(applied.data?.qtd_obras||linhas.length)} obra(s) enviadas/atualizadas na Curva.`);
      }catch(e){btn.disabled=false;btn.textContent=`Confirmar envio de ${preview.length} obra(s) para a Curva`;errBox.innerHTML=`<div class="error-msg">${esc(e?.message||String(e))}</div>`;}
    };
  }

  async function importPlanningExcelV4024(file){
    try{await loadTipologiasV4026();const parsed=await parsePlanningWorkbookV4024(file);await openPmoPreviewV4024(parsed);}catch(e){alert('Não foi possível importar o planejamento do PMO:\n\n'+(e?.message||String(e)));}
  }

  function choosePlanningExcelV4024(){
    const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xls';input.style.display='none';document.body.appendChild(input);
    input.onchange=async()=>{const file=input.files?.[0];input.remove();if(file)await importPlanningExcelV4024(file);};input.click();
  }

  function commonPlanningHeaderV4023() {
    return `<header class="topbar"><div><div class="brand-eyebrow">Controle de Capex</div><div class="brand-title">Obras a Planejar</div></div>${navHtml(true)}<div class="user-chip">${esc(state.fullName||'')} <span class="role-badge">Admin</span><button class="btn btn-secondary" type="button" onclick="voltarAoSeletorHapcapex()">⇄ Trocar sistema</button><button class="btn btn-secondary" id="logout-btn">Sair</button></div></header>`;
  }

  function renderPlanningTabV4023() {
    const rows=filteredPlanningRowsV4023();
    const withAporte=planningRowsV4023.filter(r=>Number(r.qtd_aportes_pendentes||0)>0),newOnly=planningRowsV4023.filter(r=>Number(r.qtd_aportes_pendentes||0)===0&&!r.existe_na_curva),totalAportes=withAporte.reduce((s,r)=>s+Number(r.valor_aportes_pendentes||0),0),qtdAportes=withAporte.reduce((s,r)=>s+Number(r.qtd_aportes_pendentes||0),0);
    app.innerHTML=`${commonPlanningHeaderV4023()}
      <div class="kpi-grid"><div class="kpi-card"><div class="label">Obras pendentes</div><div class="value">${planningRowsV4023.length}</div><div class="sub">Fila consolidada para planejamento</div></div><div class="kpi-card"><div class="label">Novas O.I.s</div><div class="value">${newOnly.length}</div><div class="sub">Destinadas à Curva e ainda sem planejamento</div></div><div class="kpi-card" style="border-left-color:var(--verde)"><div class="label">Aportes pendentes</div><div class="value" style="color:var(--verde)">${money(totalAportes)}</div><div class="sub">Valor aguardando planejamento</div></div><div class="kpi-card" style="border-left-color:var(--laranja)"><div class="label">Lançamentos de aporte</div><div class="value" style="color:var(--laranja)">${qtdAportes}</div><div class="sub">Aportes ainda não aplicados à Curva</div></div></div>
      <div class="v4023-plan-note"><strong>Fila única para PMO:</strong> reúne novas O.I.s marcadas para participar da Curva e aportes extras que ainda precisam de planejamento. O Excel respeita os filtros exibidos.</div>
      <div class="v4023-plan-toolbar"><input id="v4023-plan-search" placeholder="Buscar por O.I., obra, grupo, categoria ou pacote" value="${esc(planningSearchV4023)}"><select id="v4023-plan-origin"><option value="" ${!planningOriginV4023?'selected':''}>Todos os motivos</option><option value="oi" ${planningOriginV4023==='oi'?'selected':''}>Nova O.I.</option><option value="aporte" ${planningOriginV4023==='aporte'?'selected':''}>Aporte extra</option></select><span style="font-size:10px;color:var(--texto-suave)">${rows.length} de ${planningRowsV4023.length}</span><button class="btn btn-secondary" id="v4023-export">Exportar Excel</button><button class="btn btn-primary" id="v4024-import">Importar Excel preenchido</button></div>
      <div class="table-card"><table class="v4023-plan-table"><thead><tr><th>O.I.</th><th>Obra</th><th>Motivo</th><th>Montante atual</th><th>Aportes pendentes</th><th>Mês(es)</th><th>Início</th><th>Fim</th><th>Curva</th><th>Ações</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.ordem_interna)}</td><td>${esc(r.obra||'—')}</td><td><span class="v4023-origin ${Number(r.qtd_aportes_pendentes||0)>0?'aporte':'oi'}">${Number(r.qtd_aportes_pendentes||0)>0?'APORTE EXTRA':'NOVA O.I.'}</span></td><td>${money(r.montante_atribuido||0)}</td><td>${Number(r.qtd_aportes_pendentes||0)>0?`${money(r.valor_aportes_pendentes||0)}<br><span style="font-size:9px;color:var(--texto-suave)">${Number(r.qtd_aportes_pendentes)} lançamento(s)</span>`:'—'}</td><td>${esc(r.meses_aportes||'—')}</td><td>${dateBr(r.data_inicio)}</td><td>${dateBr(r.data_fim)}</td><td>${r.existe_na_curva?'<span class="flag flag-aporte">Já existe</span>':'<span class="flag flag-conting">Ainda não</span>'}</td><td><div class="v4023-plan-actions">${Number(r.qtd_aportes_pendentes||0)>0?`<button class="btn btn-primary v4023-open-aportes" data-oi="${esc(r.ordem_interna)}">Abrir Aportes</button>`:!r.existe_na_curva?`<button class="btn btn-primary v4023-plan-one" data-oi="${esc(r.ordem_interna)}">Planejar</button>`:''}<button class="btn btn-secondary v4023-edit-oi" data-id="${esc(r.oi_id)}">Editar O.I.</button></div></td></tr>`).join(''):'<tr><td colspan="10"><div class="empty-state">Nenhuma obra pendente com os filtros atuais.</div></td></tr>'}</tbody></table></div>`;
    document.getElementById('logout-btn').onclick=()=>sb.auth.signOut();
    document.getElementById('v4023-plan-search').oninput=e=>{planningSearchV4023=e.target.value;renderPlanningTabV4023();const x=document.getElementById('v4023-plan-search');if(x){x.focus();try{x.setSelectionRange(x.value.length,x.value.length);}catch(_){}}};
    document.getElementById('v4023-plan-origin').onchange=e=>{planningOriginV4023=e.target.value;renderPlanningTabV4023();};
    document.getElementById('v4023-export').onclick=exportPlanningExcelV4023;
    document.getElementById('v4024-import').onclick=choosePlanningExcelV4024;
    document.querySelectorAll('.v4023-plan-one').forEach(b=>b.onclick=()=>openPlanPendingOiV4023(b.dataset.oi));
    document.querySelectorAll('.v4023-open-aportes').forEach(b=>b.onclick=()=>openControlKpiPanel('aportes'));
    document.querySelectorAll('.v4023-edit-oi').forEach(b=>b.onclick=()=>window.editarOi(b.dataset.id));
  }

  async function loadPlanningTabV4023() {
    const {data,error}=await sb.rpc('obter_obras_a_planejar_v4023');
    if(error){app.innerHTML=`<div class="error-msg" style="margin:40px">Erro ao carregar Obras a Planejar: ${esc(error.message)}</div>`;return;}
    planningRowsV4023=Array.isArray(data)?data:[];renderPlanningTabV4023();
  }

  function wrapPlanningNavigationV4023() {
    if(window.__HAP_V4023_NAV_WRAPPED__)return;
    const originalNav=window.navHtml,originalRefresh=window.refreshCurrent;
    if(typeof originalNav!=='function'||typeof originalRefresh!=='function')return;
    navHtml=window.navHtml=function(isAdmin){const base=originalNav(isAdmin);if(!isAdmin||!base||base.includes("switchTab('obras_planejar')"))return base;const pill=`<span class="nav-pill ${state.tab==='obras_planejar'?'active':''}" onclick="switchTab('obras_planejar')">OBRAS A PLANEJAR</span>`;const audit=/<span class="nav-pill[^>]*onclick="switchTab\('auditoria'\)"[^>]*>AUDITORIA<\/span>/;return audit.test(base)?base.replace(audit,m=>pill+m):base.replace(/<\/div>\s*$/,pill+'</div>');};
    refreshCurrent=window.refreshCurrent=async function(){if(state?.tab==='obras_planejar'){if(state.role!=='admin'){state.tab='base_consumo';return originalRefresh();}return loadPlanningTabV4023();}return originalRefresh();};
    window.__HAP_V4023_NAV_WRAPPED__=true;
  }



  injectStyles();
  window.openNovaOiModal=openNovaOiV4023;
  wrapTransferModalV4023();
  wrapEditOiV4023();
  wrapPlanningNavigationV4023();

  window.HAP_V40_CONTROL_UI={version:VERSION,active:true,features:['nova-oi-intencao-curva','edicao-intencao-curva','obras-a-planejar','exportacao-pmo','retorno-pmo-confirmacao-curva','transferencia-expandir','tipologias-dinamicas']};
})();
