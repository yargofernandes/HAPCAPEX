/* HAPCAPEX V40.0.33 — Aporte de uma O.I. com destino em obra existente da Curva.
   - Mantém a O.I. de origem e o Aporte Extra para KPI/auditoria.
   - Permite selecionar uma obra já existente como destino financeiro.
   - O vínculo fica permanente: aportes operacionais futuros da mesma O.I. seguem o mesmo destino.
*/
(() => {
  'use strict';
  if (window.__HAP_V4032_LINKED_APORTE__) return;
  window.__HAP_V4032_LINKED_APORTE__ = true;

  const VERSION = '40.0.33';
  let decorating = false;
  let observer = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  const brlV4032 = new Intl.NumberFormat('pt-BR', {
    style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2
  });
  const money = value => brlV4032.format(Number(value || 0));
  const oiTokens = value => (String(value || '').match(/\d{8}/g) || []);

  function isPlanningPage() {
    return String(document.querySelector('.brand-title')?.textContent || '').trim().toLowerCase() === 'obras a planejar';
  }

  async function loadSourceRow(oi) {
    const { data, error } = await sb.rpc('obter_obras_a_planejar_v4028');
    if (error) throw error;
    return (Array.isArray(data) ? data : []).find(row => String(row?.ordem_interna || '') === String(oi)) || null;
  }

  async function loadCurveWorks() {
    const { data, error } = await sb.rpc('listar_obras_curva_para_vinculo_v4032', { p_busca: null });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  function injectStyles() {
    if (document.getElementById('hap-v4032-linked-aporte-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4032-linked-aporte-style';
    style.textContent = `
      .v4032-link-btn{border-color:#7fa4d1!important;color:#164b83!important;background:#f7faff!important}
      .v4032-link-btn:hover{background:#eaf2fc!important}
      .v4032-link-summary{border:1px solid #b9d2ed;background:#f3f8fe;border-radius:10px;padding:11px 12px;margin:10px 0 12px;font-size:11px;line-height:1.5;color:#244b74}
      .v4032-link-summary strong{color:#0d2b4e}
      .v4032-target-card{border:1px solid var(--cinza-borda);border-radius:10px;background:#fff;padding:10px 12px;margin-top:8px}
      .v4032-target-card .title{font-size:12px;font-weight:800;color:var(--azul);line-height:1.35}
      .v4032-target-card .meta{font-size:10px;color:var(--texto-suave);margin-top:4px;line-height:1.45}
      .v4032-result-note{border:1px solid #b9dfc8;background:#eefaf3;color:#17643a;border-radius:9px;padding:10px 11px;font-size:10px;line-height:1.45;margin-top:10px}
      .v4032-modal-select{width:100%;min-height:185px;border:1px solid var(--cinza-borda);border-radius:9px;padding:5px;background:#fff;font:inherit;font-size:11px}
      .v4032-modal-select option{padding:6px 8px}
      .v4032-search{width:100%;padding:8px 10px;border:1px solid var(--cinza-borda);border-radius:8px;font:inherit;margin-bottom:7px}
    `;
    document.head.appendChild(style);
  }

  async function openLinkModal(oi) {
    injectStyles();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.v4032LinkedAporte = '1';
    backdrop.innerHTML = `<div class="modal-box modal-wide" style="width:760px;max-width:95vw">
      <h2>Vincular aporte a obra existente</h2>
      <p class="sub">A O.I. do aporte será preservada. Você escolherá apenas onde esse valor deve aumentar o CAPEX na Curva.</p>
      <div id="v4032-link-error"></div>
      <div id="v4032-link-loading" class="v4032-link-summary">Carregando a O.I. de origem e as obras existentes da Curva...</div>
      <div id="v4032-link-form" hidden>
        <div class="v4032-link-summary" id="v4032-source-summary"></div>
        <div class="field">
          <label>Buscar obra existente na Curva</label>
          <input class="v4032-search" id="v4032-target-search" type="text" placeholder="Digite nome da obra ou O.I. da Curva">
          <select class="v4032-modal-select" id="v4032-target-select" size="8"></select>
        </div>
        <div id="v4032-target-detail"></div>
        <div class="field" id="v4032-ref-wrap" hidden style="margin-top:10px">
          <label>O.I. de referência dentro da obra de destino</label>
          <select id="v4032-reference-oi"></select>
          <div style="font-size:10px;color:var(--texto-suave);margin-top:4px">Use a O.I. que explica a relação da nova ordem com a obra já existente.</div>
        </div>
        <div class="field" style="margin-top:10px">
          <label>Observação do vínculo</label>
          <textarea id="v4032-link-note" rows="2" placeholder="Ex.: aporte complementar destinado à mesma obra"></textarea>
        </div>
        <div class="v4032-result-note"><strong>O que acontecerá:</strong> o aporte continuará registrado com a O.I. <span id="v4032-origin-oi"></span> no KPI <strong>Aportes Extras</strong> e na auditoria. Na Curva, o valor será somado ao CAPEX da obra escolhida; o fluxo mensal será recalculado pelas regras vigentes da própria obra, preservando o histórico fechado.</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="v4032-link-cancel">Cancelar</button>
        <button class="btn btn-primary" id="v4032-link-save" disabled>Vincular e aplicar aporte</button>
      </div>
    </div>`;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.querySelector('#v4032-link-cancel').onclick = close;
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });

    let source = null;
    let works = [];
    let selected = null;

    const errorBox = backdrop.querySelector('#v4032-link-error');
    const form = backdrop.querySelector('#v4032-link-form');
    const loading = backdrop.querySelector('#v4032-link-loading');
    const targetSelect = backdrop.querySelector('#v4032-target-select');
    const targetSearch = backdrop.querySelector('#v4032-target-search');
    const detail = backdrop.querySelector('#v4032-target-detail');
    const refWrap = backdrop.querySelector('#v4032-ref-wrap');
    const refSelect = backdrop.querySelector('#v4032-reference-oi');
    const save = backdrop.querySelector('#v4032-link-save');

    function filteredWorks() {
      const q = String(targetSearch.value || '').trim().toLowerCase();
      if (!q) return works;
      return works.filter(w => `${w.nome || ''} ${w.ordem || ''}`.toLowerCase().includes(q));
    }

    function renderTargets(keepId) {
      const list = filteredWorks();
      targetSelect.innerHTML = list.length
        ? list.map(w => `<option value="${esc(w.curva_item_id)}">${esc(w.nome || 'Sem nome')} — O.I. ${esc(w.ordem || '—')} — ${esc(money(w.capex || 0))}</option>`).join('')
        : '<option value="">Nenhuma obra encontrada</option>';
      if (keepId && list.some(w => String(w.curva_item_id) === String(keepId))) targetSelect.value = keepId;
      else targetSelect.selectedIndex = -1;
      selectTarget();
    }

    function selectTarget() {
      const id = targetSelect.value;
      selected = works.find(w => String(w.curva_item_id) === String(id)) || null;
      if (!selected) {
        detail.innerHTML = '';
        refWrap.hidden = true;
        save.disabled = true;
        return;
      }
      const tokens = [...new Set(oiTokens(selected.ordem))];
      detail.innerHTML = `<div class="v4032-target-card"><div class="title">${esc(selected.nome || '—')}</div><div class="meta">O.I.(s) atuais: <strong>${esc(selected.ordem || '—')}</strong> · CAPEX atual: <strong>${esc(money(selected.capex || 0))}</strong><br>Após o aporte pendente: <strong>${esc(money(Number(selected.capex || 0) + Number(source?.valor_aportes_pendentes || 0)))}</strong></div></div>`;
      refSelect.innerHTML = '<option value="">Sem O.I. de referência específica</option>' + tokens.map(token => `<option value="${esc(token)}">${esc(token)}</option>`).join('');
      if (tokens.length === 1) refSelect.value = tokens[0];
      refWrap.hidden = false;
      save.disabled = false;
    }

    try {
      [source, works] = await Promise.all([loadSourceRow(oi), loadCurveWorks()]);
      if (!source) throw new Error('Esta O.I. não está mais na fila de aportes pendentes. Atualize a tela e tente novamente.');
      if (Number(source.qtd_aportes_pendentes || 0) <= 0) throw new Error('Não existem aportes pendentes para esta O.I.');
      if (!works.length) throw new Error('Nenhuma obra ativa foi encontrada na Curva de Capex.');

      backdrop.querySelector('#v4032-source-summary').innerHTML = `<strong>Origem preservada:</strong> O.I. ${esc(source.ordem_interna)} — ${esc(source.obra || '—')}<br><strong>Aporte(s) pendente(s):</strong> ${esc(money(source.valor_aportes_pendentes || 0))} em ${Number(source.qtd_aportes_pendentes || 0)} lançamento(s) · ${esc(source.meses_aportes || 'mês não informado')}`;
      backdrop.querySelector('#v4032-origin-oi').textContent = source.ordem_interna;
      backdrop.querySelector('#v4032-link-note').value = `Aporte da O.I. ${source.ordem_interna} destinado financeiramente a obra existente na Curva.`;
      loading.hidden = true;
      form.hidden = false;
      renderTargets();
    } catch (error) {
      loading.hidden = true;
      errorBox.innerHTML = `<div class="error-msg">${esc(error?.message || String(error))}</div>`;
    }

    targetSearch.oninput = () => renderTargets(selected?.curva_item_id || null);
    targetSelect.onchange = selectTarget;

    save.onclick = async () => {
      if (!source || !selected) return;
      const ref = refSelect.value || null;
      const note = backdrop.querySelector('#v4032-link-note').value.trim() || null;
      const confirmation = `Confirmar vínculo?\n\nO.I. de origem: ${source.ordem_interna}\nAporte pendente: ${money(source.valor_aportes_pendentes || 0)}\nObra destino: ${selected.nome}\nCAPEX: ${money(selected.capex || 0)} → ${money(Number(selected.capex || 0) + Number(source.valor_aportes_pendentes || 0))}\n\nA O.I. de origem continuará aparecendo no KPI Aportes Extras.`;
      if (!window.confirm(confirmation)) return;

      save.disabled = true;
      save.textContent = 'Vinculando e recalculando...';
      errorBox.innerHTML = '';
      try {
        const { data, error } = await sb.rpc('vincular_oi_aporte_a_obra_curva_v4032', {
          p_ordem_interna: source.ordem_interna,
          p_curva_item_id: selected.curva_item_id,
          p_oi_referencia: ref,
          p_observacao: note,
          p_aplicar_pendentes: true
        });
        if (error) throw error;
        close();
        if (typeof window.refreshCurrent === 'function') await window.refreshCurrent();
        else if (typeof refreshCurrent === 'function') await refreshCurrent();
        alert(`Vínculo concluído.\n\nO.I. ${source.ordem_interna} permanece como origem do aporte.\nDestino na Curva: ${data?.destino_nome || selected.nome}\nAporte aplicado: ${money(data?.valor_aplicado || source.valor_aportes_pendentes || 0)}\n\nAportes futuros desta O.I. serão direcionados automaticamente para a mesma obra enquanto o vínculo estiver ativo.`);
      } catch (error) {
        save.disabled = false;
        save.textContent = 'Vincular e aplicar aporte';
        errorBox.innerHTML = `<div class="error-msg">${esc(error?.message || String(error))}</div>`;
      }
    };
  }

  function decoratePlanningRows() {
    if (decorating || !isPlanningPage()) return;
    decorating = true;
    try {
      document.querySelectorAll('.v4023-plan-table tbody tr').forEach(row => {
        if (row.querySelector('.v4032-link-btn')) return;
        const aporteButton = [...row.querySelectorAll('.v4023-open-aportes')]
          .find(btn => /abrir aportes/i.test(String(btn.textContent || '')));
        if (!aporteButton) return;
        const oi = String(row.querySelector('td:first-child')?.textContent || '').trim();
        if (!/^\d{5,}$/.test(oi)) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary v4032-link-btn';
        btn.dataset.oi = oi;
        btn.textContent = 'Vincular à obra';
        btn.title = 'Somar este aporte ao CAPEX de uma obra que já existe na Curva';
        btn.onclick = event => {
          event.preventDefault();
          event.stopPropagation();
          void openLinkModal(oi);
        };
        aporteButton.insertAdjacentElement('afterend', btn);
      });
    } finally {
      decorating = false;
    }
  }

  injectStyles();
  const startObserver = () => {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => queueMicrotask(decoratePlanningRows));
    observer.observe(document.body, { childList:true, subtree:true });
    decoratePlanningRows();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once:true });
  else startObserver();
  [100,400,1000,2500].forEach(ms => setTimeout(decoratePlanningRows, ms));

  window.HAP_V40_LINKED_APORTE = { version:VERSION, openLinkModal, decoratePlanningRows };
})();
