/* HAPCAPEX V40.0.22 — UI funcional consolidada do Controle
   - Nova O.I.: planejar agora ou deixar planejamento pendente.
   - Transferências: expandir/restaurar formulário.
   - Sem alterações experimentais de cabeçalho, scrollbar ou troca de abas.
*/
(() => {
  'use strict';

  const VERSION = '40.0.22';
  const PENDING_TYPE = 'control_oi_curve_sync_pending';

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

  function injectStyles() {
    if (document.getElementById('hap-v4022-control-ui')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4022-control-ui';
    style.textContent = `
      .v4022-plan-note{
        border:1px solid #c7d8ee;background:#eef4fc;color:#244b74;
        border-radius:9px;padding:10px 11px;margin:10px 0 12px;
        font-size:10px;line-height:1.45
      }
      .v4022-plan-note strong{color:var(--azul)}
      .v4022-dual-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px}
      .v4022-pending-banner{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        padding:10px 12px;margin:0 0 14px;border:1px solid #f0c98b;
        border-radius:10px;background:#fff8e6;color:#68480d
      }
      .v4022-pending-banner strong{display:block;font-size:12px}
      .v4022-pending-banner span{display:block;margin-top:2px;font-size:10px;line-height:1.4}
      .v4022-pending-list{display:grid;gap:8px;max-height:52vh;overflow:auto;margin-top:12px}
      .v4022-pending-row{
        display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;
        border:1px solid var(--cinza-borda);border-radius:9px;padding:10px 11px;background:#fff
      }
      .v4022-pending-row strong{display:block;color:var(--azul);font-size:12px}
      .v4022-pending-row small{display:block;color:var(--texto-suave);font-size:10px;margin-top:3px;line-height:1.4}
      .v4022-pending-value{font-weight:800;color:var(--azul);white-space:nowrap;margin-right:8px}
      .v4022-transfer-modal{position:relative}
      .v4022-transfer-expand-btn{
        position:absolute;right:18px;top:15px;z-index:2;
        border:1px solid var(--cinza-borda);background:#fff;color:var(--azul-medio);
        border-radius:8px;padding:6px 10px;font:inherit;font-size:10px;font-weight:800;cursor:pointer
      }
      .v4022-transfer-modal.v4022-expanded{
        width:calc(100vw - 40px)!important;
        max-width:1600px!important;
        max-height:calc(100vh - 40px)!important
      }
      .v4022-transfer-modal.v4022-expanded #linhas-container input[id^="t-justificativa-"]{width:320px!important}
      @media(max-width:720px){
        .v4022-dual-actions{flex-direction:column-reverse}
        .v4022-dual-actions .btn{width:100%}
        .v4022-pending-banner{align-items:flex-start;flex-direction:column}
        .v4022-pending-row{grid-template-columns:1fr}
        .v4022-transfer-expand-btn{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  async function getRulesV4022() {
    const { data, error } = await sb
      .from('capex_flow_rules')
      .select('code,name,description,sort_order')
      .eq('selectable', true)
      .order('sort_order', { ascending:true });
    if (error) throw error;
    return data || [];
  }

  function populateDatalist(id, values) {
    const el = document.getElementById(id);
    if (!el || !Array.isArray(values)) return;
    el.innerHTML = values.map(v => `<option value="${esc(v)}">`).join('');
  }

  function openNovaOiV4022(prefill) {
    prefill = prefill || {};
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.v4022NovaOi = '1';
    backdrop.innerHTML = `
      <div class="modal-box modal-wide">
        <h2>Nova ordem interna</h2>
        <p class="sub">Cadastre a O.I. e escolha se o planejamento da Curva será feito agora ou depois.</p>
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
        <div class="field">
          <label>Regra de planejamento da Curva</label>
          <select id="f-flow-rule"><option value="standard_15_75_10">15 / 75 / 10</option></select>
          <div id="f-flow-rule-note" style="font-size:10px;color:var(--texto-suave);margin-top:4px;"></div>
        </div>

        <div class="v4022-plan-note">
          <strong>Planejar agora:</strong> a O.I. e a obra da Curva são gravadas juntas. É necessário informar montante, início e fim.<br>
          <strong>Planejar depois:</strong> a O.I. é criada normalmente e fica um alerta persistente até você concluir o planejamento.
        </div>

        <p class="sub" style="margin:0 0 8px;">* obrigatório para cadastro. Montante e datas também são obrigatórios somente se escolher planejar agora.</p>
        <div class="v4022-dual-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn btn-secondary" id="v4022-save-later">Criar e planejar depois</button>
          <button class="btn btn-primary" id="v4022-save-now">Criar e planejar agora</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.querySelector('#modal-cancel').onclick = close;
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    Promise.all([
      sb.rpc('get_classificacoes_existentes'),
      getRulesV4022()
    ]).then(([classResult, rules]) => {
      if (!classResult.error && classResult.data) {
        const d = classResult.data;
        populateDatalist('dl-grupo', d.grupo_executivo);
        populateDatalist('dl-categoria', d.categoria_orc);
        populateDatalist('dl-pacote', d.classificacao_pacote_capex);
        populateDatalist('dl-head', d.classificacao_head_operacao);
        populateDatalist('dl-detalhamento', d.detalhamento);
        populateDatalist('dl-detalhamento-orc', d.detalhamento_orc);
      }
      const select = backdrop.querySelector('#f-flow-rule');
      if (select && rules.length) {
        select.innerHTML = rules.map(r => `<option value="${esc(r.code)}" ${r.code==='standard_15_75_10'?'selected':''}>${esc(r.name)}</option>`).join('');
        const updateNote = () => {
          const rule = rules.find(r => r.code === select.value);
          backdrop.querySelector('#f-flow-rule-note').textContent = rule?.description || '';
        };
        select.onchange = updateNote;
        updateNote();
      }
    }).catch(() => {});

    async function save(planejarAgora) {
      const errorBox = backdrop.querySelector('#modal-error');
      const payload = {
        p_ordem_interna: backdrop.querySelector('#f-oi').value.trim(),
        p_descricao: backdrop.querySelector('#f-desc').value.trim(),
        p_grupo_executivo: backdrop.querySelector('#f-grupo').value.trim(),
        p_categoria_orc: backdrop.querySelector('#f-categoria').value.trim(),
        p_classificacao_pacote_capex: backdrop.querySelector('#f-pacote').value.trim(),
        p_classificacao_head_operacao: backdrop.querySelector('#f-head').value.trim(),
        p_detalhamento: backdrop.querySelector('#f-detalhamento').value.trim(),
        p_detalhamento_orc: backdrop.querySelector('#f-detalhamento-orc').value.trim(),
        p_montante_atribuido: Number(backdrop.querySelector('#f-montante').value || 0),
        p_valor_compromissado: Number(backdrop.querySelector('#f-compromissado').value || 0),
        p_data_inicio: backdrop.querySelector('#f-data-inicio').value || null,
        p_data_fim: backdrop.querySelector('#f-data-fim').value || null,
        p_planejar_agora: !!planejarAgora,
        p_flow_rule: backdrop.querySelector('#f-flow-rule').value || 'standard_15_75_10'
      };
      const labels = [
        ['p_ordem_interna','Ordem interna'],['p_descricao','Descrição / obra'],
        ['p_grupo_executivo','Grupo executivo'],['p_categoria_orc','Categoria ORC'],
        ['p_classificacao_pacote_capex','Classificação pacote CAPEX'],
        ['p_classificacao_head_operacao','Classificação HEAD operação'],
        ['p_detalhamento','Detalhamento'],['p_detalhamento_orc','Detalhamento ORC']
      ];
      const missing = labels.filter(([key]) => !payload[key]).map(([,label]) => label);
      if (missing.length) {
        errorBox.innerHTML = `<div class="error-msg">Preencha os campos obrigatórios: ${esc(missing.join(', '))}.</div>`;
        return;
      }
      if (planejarAgora) {
        if (payload.p_montante_atribuido <= 0) {
          errorBox.innerHTML = '<div class="error-msg">Para planejar agora, informe um Montante atribuído maior que zero.</div>';
          return;
        }
        if (!payload.p_data_inicio || !payload.p_data_fim) {
          errorBox.innerHTML = '<div class="error-msg">Para planejar agora, informe as datas de início e fim.</div>';
          return;
        }
      }

      const nowBtn = backdrop.querySelector('#v4022-save-now');
      const laterBtn = backdrop.querySelector('#v4022-save-later');
      nowBtn.disabled = true; laterBtn.disabled = true;
      const activeBtn = planejarAgora ? nowBtn : laterBtn;
      const originalText = activeBtn.textContent;
      activeBtn.textContent = planejarAgora ? 'Criando e planejando...' : 'Criando O.I...';
      errorBox.innerHTML = '';

      try {
        const { data, error } = await sb.rpc('criar_ordem_interna_integrada_v4022', payload);
        if (error) throw error;
        close();
        await refreshCurrent();
        if (!planejarAgora && data?.planejamento_status === 'pendente') {
          alert(`O.I. ${payload.p_ordem_interna} criada com sucesso.\n\nO planejamento da Curva ficou pendente e permanecerá em alerta até ser concluído.`);
        }
      } catch (error) {
        nowBtn.disabled = false; laterBtn.disabled = false;
        activeBtn.textContent = originalText;
        errorBox.innerHTML = `<div class="error-msg">${esc(error?.message || String(error))}</div>`;
      }
    }

    backdrop.querySelector('#v4022-save-later').onclick = () => save(false);
    backdrop.querySelector('#v4022-save-now').onclick = () => save(true);
  }

  async function fetchPendingOiV4022() {
    if (typeof state === 'undefined' || state.role !== 'admin') return [];
    const { data, error } = await sb
      .from('capex_notifications')
      .select('id,title,message,metadata,created_at')
      .eq('notification_type', PENDING_TYPE)
      .eq('active', true)
      .order('created_at', { ascending:true });
    if (error) return [];
    return data || [];
  }

  async function injectPendingBannerV4022() {
    if (document.getElementById('v4022-pending-banner')) return;
    const header = document.querySelector('#app header.topbar');
    if (!header || typeof state === 'undefined' || state.role !== 'admin') return;
    const pending = await fetchPendingOiV4022();
    if (!pending.length) return;
    if (!document.body.contains(header) || document.getElementById('v4022-pending-banner')) return;

    const total = pending.reduce((sum, n) => sum + Number(n?.metadata?.value || 0), 0);
    const banner = document.createElement('div');
    banner.id = 'v4022-pending-banner';
    banner.className = 'v4022-pending-banner';
    banner.innerHTML = `
      <div>
        <strong>${pending.length} O.I.${pending.length>1?'s':''} aguardando planejamento na Curva</strong>
        <span>${money(total)} em O.I.s criadas no Controle e ainda não planejadas na Curva.</span>
      </div>
      <button class="btn btn-secondary" type="button">Planejar agora</button>`;
    header.insertAdjacentElement('afterend', banner);
    banner.querySelector('button').onclick = () => openPendingOiListV4022();
  }

  async function openPendingOiListV4022() {
    const pending = await fetchPendingOiV4022();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-box modal-wide">
        <h2>O.I.s aguardando planejamento</h2>
        <p class="sub">A O.I. já existe no Controle. O alerta desaparece quando o planejamento correspondente for criado na Curva.</p>
        <div class="v4022-pending-list">
          ${pending.length ? pending.map(n => {
            const oi = n?.metadata?.oi || '';
            const value = Number(n?.metadata?.value || 0);
            return `<div class="v4022-pending-row">
              <div><strong>OI ${esc(oi)}</strong><small>${esc(n.message || n.title || '')}</small></div>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="v4022-pending-value">${money(value)}</span>
                <button class="btn btn-primary v4022-plan-one" data-oi="${esc(oi)}">Planejar na Curva</button>
              </div>
            </div>`;
          }).join('') : '<div class="empty-state">Nenhuma O.I. pendente.</div>'}
        </div>
        <div class="modal-actions"><button class="btn btn-secondary" id="v4022-pending-close">Fechar</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v4022-pending-close').onclick = () => backdrop.remove();
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelectorAll('.v4022-plan-one').forEach(btn => {
      btn.onclick = () => {
        const oi = btn.dataset.oi;
        backdrop.remove();
        openPlanPendingOiV4022(oi);
      };
    });
  }

  async function openPlanPendingOiV4022(oi) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-box">
      <h2>Planejar O.I. na Curva</h2>
      <p class="sub">OI ${esc(oi)}</p>
      <div id="v4022-plan-error"></div>
      <div id="v4022-plan-loading" class="v4022-plan-note">Carregando dados atuais da O.I...</div>
      <div id="v4022-plan-form" hidden>
        <div class="v4022-plan-note"><strong id="v4022-plan-name"></strong><br>Montante atual: <strong id="v4022-plan-value"></strong></div>
        <div class="grid-2">
          <div class="field"><label>Data de início *</label><input type="date" id="v4022-plan-start"></div>
          <div class="field"><label>Data de fim *</label><input type="date" id="v4022-plan-end"></div>
        </div>
        <div class="field">
          <label>Regra de planejamento *</label>
          <select id="v4022-plan-rule"></select>
          <div id="v4022-plan-rule-note" style="font-size:10px;color:var(--texto-suave);margin-top:4px;"></div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="v4022-plan-cancel">Cancelar</button>
        <button class="btn btn-primary" id="v4022-plan-save" disabled>Planejar na Curva</button>
      </div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v4022-plan-cancel').onclick = () => backdrop.remove();

    try {
      const [workResult, rules] = await Promise.all([
        sb.from('vw_controle_capex_admin')
          .select('ordem_interna,obra,montante_atribuido,data_inicio,data_fim')
          .eq('ordem_interna', oi)
          .maybeSingle(),
        getRulesV4022()
      ]);
      if (workResult.error) throw workResult.error;
      if (!workResult.data) throw new Error('O.I. não encontrada no Controle.');
      const work = workResult.data;
      backdrop.querySelector('#v4022-plan-name').textContent = work.obra || oi;
      backdrop.querySelector('#v4022-plan-value').textContent = money(work.montante_atribuido || 0);
      backdrop.querySelector('#v4022-plan-start').value = work.data_inicio ? String(work.data_inicio).slice(0,10) : '';
      backdrop.querySelector('#v4022-plan-end').value = work.data_fim ? String(work.data_fim).slice(0,10) : '';

      const ruleSelect = backdrop.querySelector('#v4022-plan-rule');
      ruleSelect.innerHTML = rules.map(r => `<option value="${esc(r.code)}" ${r.code==='standard_15_75_10'?'selected':''}>${esc(r.name)}</option>`).join('');
      const updateNote = () => {
        const rule = rules.find(r => r.code === ruleSelect.value);
        backdrop.querySelector('#v4022-plan-rule-note').textContent = rule?.description || '';
      };
      ruleSelect.onchange = updateNote;
      updateNote();

      backdrop.querySelector('#v4022-plan-loading').hidden = true;
      backdrop.querySelector('#v4022-plan-form').hidden = false;
      backdrop.querySelector('#v4022-plan-save').disabled = false;
    } catch (error) {
      backdrop.querySelector('#v4022-plan-loading').hidden = true;
      backdrop.querySelector('#v4022-plan-error').innerHTML = `<div class="error-msg">${esc(error?.message || String(error))}</div>`;
    }

    backdrop.querySelector('#v4022-plan-save').onclick = async () => {
      const start = backdrop.querySelector('#v4022-plan-start').value || null;
      const end = backdrop.querySelector('#v4022-plan-end').value || null;
      const rule = backdrop.querySelector('#v4022-plan-rule').value || 'standard_15_75_10';
      const err = backdrop.querySelector('#v4022-plan-error');
      if (!start || !end) {
        err.innerHTML = '<div class="error-msg">Informe as datas de início e fim.</div>';
        return;
      }
      const btn = backdrop.querySelector('#v4022-plan-save');
      btn.disabled = true; btn.textContent = 'Planejando...'; err.innerHTML = '';
      try {
        const { error } = await sb.rpc('planejar_oi_pendente_v4022', {
          p_ordem_interna: oi,
          p_data_inicio: start,
          p_data_fim: end,
          p_flow_rule: rule
        });
        if (error) throw error;
        backdrop.remove();
        await refreshCurrent();
      } catch (error) {
        btn.disabled = false; btn.textContent = 'Planejar na Curva';
        err.innerHTML = `<div class="error-msg">${esc(error?.message || String(error))}</div>`;
      }
    };
  }

  function enhanceTransferModalV4022() {
    const modals = Array.from(document.querySelectorAll('.modal-backdrop .modal-box'));
    const box = modals.reverse().find(el => el.querySelector('h2')?.textContent?.trim() === 'Nova transferência');
    if (!box || box.dataset.v4022ExpandedReady === '1') return;
    box.dataset.v4022ExpandedReady = '1';
    box.classList.add('v4022-transfer-modal');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'v4022-transfer-expand-btn';
    btn.textContent = '⛶ Expandir formulário';
    btn.title = 'Usar mais largura da tela para preencher as transferências';
    btn.onclick = () => {
      const expanded = box.classList.toggle('v4022-expanded');
      btn.textContent = expanded ? '↙ Restaurar tamanho' : '⛶ Expandir formulário';
    };
    box.appendChild(btn);
  }

  function wrapTransferModalV4022() {
    if (window.__HAP_V4022_TRANSFER_WRAPPED__) return;
    const original = window.openNovaTransferenciaModal;
    if (typeof original !== 'function') return;
    window.openNovaTransferenciaModal = function(...args) {
      const result = original.apply(this, args);
      queueMicrotask(enhanceTransferModalV4022);
      return result;
    };
    window.__HAP_V4022_TRANSFER_WRAPPED__ = true;
  }

  function wrapRenderersV4022() {
    if (window.__HAP_V4022_RENDERERS_WRAPPED__) return;
    const originalCapex = window.renderCapexTab;
    const originalBaseOi = window.renderBaseOiTab;

    if (typeof originalCapex === 'function') {
      window.renderCapexTab = function(...args) {
        const result = originalCapex.apply(this, args);
        Promise.resolve().then(injectPendingBannerV4022);
        return result;
      };
    }
    if (typeof originalBaseOi === 'function') {
      window.renderBaseOiTab = function(...args) {
        const result = originalBaseOi.apply(this, args);
        Promise.resolve().then(injectPendingBannerV4022);
        return result;
      };
    }
    window.__HAP_V4022_RENDERERS_WRAPPED__ = true;
  }

  injectStyles();

  // Substitui apenas o modal de criação, mantendo o restante do Controle intacto.
  window.openNovaOiModal = openNovaOiV4022;
  wrapTransferModalV4022();
  wrapRenderersV4022();

  window.HAP_V40_CONTROL_UI = {
    version: VERSION,
    active: true,
    features: ['nova-oi-planejamento','transferencia-expandir']
  };
})();
