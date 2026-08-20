/* HAPCAPEX V40.0.43 — Quinto modo: Vinculada a obra existente.
   - O.I. permanece no Controle, mas não cria linha própria na Curva.
   - CAPEX/realizado atual são incorporados à obra destino no vínculo.
   - Se já houver linha individual, ela é migrada/arquivada com auditoria.
*/
(() => {
  'use strict';
  if (window.__HAP_V4043_LINKED_OI_MODE__) return;
  window.__HAP_V4043_LINKED_OI_MODE__ = true;

  const VERSION = '40.0.43';
  const MODE = 'vinculada';
  const LABEL = 'Vinculada a obra existente — compõe uma linha já existente';
  let worksCache = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const brl = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
  const tokens = value => (String(value || '').match(/\d{8}/g) || []);

  async function loadWorks(force=false) {
    if (!force && Array.isArray(worksCache)) return worksCache;
    const { data, error } = await sb.rpc('listar_obras_curva_para_vinculo_v4032', { p_busca:null });
    if (error) throw error;
    worksCache = Array.isArray(data) ? data : [];
    return worksCache;
  }

  function addModeOption(select) {
    if (!select || select.querySelector(`option[value="${MODE}"]`)) return;
    const option = document.createElement('option');
    option.value = MODE;
    option.textContent = LABEL;
    const maintenance = select.querySelector('option[value="manutencao"]');
    const nao = select.querySelector('option[value="nao"]');
    select.insertBefore(option, maintenance || nao || null);
  }

  function buildTargetField(box, idPrefix) {
    let wrap = box.querySelector(`[data-v4043-target="${idPrefix}"]`);
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.v4043Target = idPrefix;
    wrap.hidden = true;
    wrap.style.marginTop = '10px';
    wrap.innerHTML = `
      <label>Obra existente de destino *</label>
      <input type="text" data-v4043-search placeholder="Buscar por nome ou O.I." style="margin-bottom:6px">
      <select data-v4043-select size="6" style="min-height:145px"></select>
      <div data-v4043-detail style="font-size:10px;color:var(--texto-suave);margin-top:5px;line-height:1.45"></div>
      <div class="v4023-plan-note" style="margin-bottom:0"><strong>Vínculo com obra existente:</strong> a O.I. continuará no Controle, mas não terá linha própria na Curva. Seu CAPEX será incorporado à obra escolhida e o planejamento seguirá a regra financeira da obra destino.</div>`;
    box.appendChild(wrap);
    return wrap;
  }

  async function populateTargets(wrap, sourceOi, selectedId=null) {
    const all = await loadWorks();
    const search = wrap.querySelector('[data-v4043-search]');
    const select = wrap.querySelector('[data-v4043-select]');
    const detail = wrap.querySelector('[data-v4043-detail]');

    const render = () => {
      const q = String(search.value || '').trim().toLowerCase();
      const list = all.filter(w => {
        if (sourceOi && tokens(w.ordem).includes(String(sourceOi))) return false;
        if (!q) return true;
        return `${w.nome || ''} ${w.ordem || ''}`.toLowerCase().includes(q);
      });
      select.innerHTML = list.length
        ? '<option value="">Selecione a obra...</option>' + list.map(w => `<option value="${esc(w.curva_item_id)}">${esc(w.nome || 'Sem nome')} — O.I. ${esc(w.ordem || '—')} — ${esc(brl.format(Number(w.capex || 0)))}</option>`).join('')
        : '<option value="">Nenhuma obra encontrada</option>';
      if (selectedId && list.some(w => String(w.curva_item_id) === String(selectedId))) select.value = selectedId;
      showDetail();
    };

    const showDetail = () => {
      const w = all.find(x => String(x.curva_item_id) === String(select.value));
      detail.innerHTML = w
        ? `Destino: <strong>${esc(w.nome)}</strong> · O.I.(s): <strong>${esc(w.ordem || '—')}</strong> · CAPEX atual: <strong>${esc(brl.format(Number(w.capex || 0)))}</strong>`
        : '';
    };

    search.oninput = render;
    select.onchange = showDetail;
    render();
  }

  function newPayload(backdrop, targetId) {
    return {
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
      p_participacao_curva: MODE,
      p_pacote_destino_id: targetId,
      p_planejar_agora: false,
      p_flow_rule: backdrop.querySelector('#f-flow-rule')?.value || 'standard_15_75_10',
      p_tipologia_curva: backdrop.querySelector('#f-tipologia-curva')?.value || null
    };
  }

  function editPayload(backdrop, id, targetId) {
    return {
      p_id: id,
      p_descricao: backdrop.querySelector('#e-desc').value.trim(),
      p_grupo_executivo: backdrop.querySelector('#e-grupo').value.trim(),
      p_categoria_orc: backdrop.querySelector('#e-categoria').value.trim(),
      p_classificacao_pacote_capex: backdrop.querySelector('#e-pacote').value.trim(),
      p_classificacao_head_operacao: backdrop.querySelector('#e-head').value.trim(),
      p_detalhamento: backdrop.querySelector('#e-detalhamento').value.trim(),
      p_detalhamento_orc: backdrop.querySelector('#e-detalhamento-orc').value.trim(),
      p_montante_atribuido: Number(backdrop.querySelector('#e-montante').value || 0),
      p_valor_compromissado: Number(backdrop.querySelector('#e-compromissado').value || 0),
      p_data_inicio: backdrop.querySelector('#e-data-inicio').value || null,
      p_data_fim: backdrop.querySelector('#e-data-fim').value || null,
      p_participacao_curva: MODE,
      p_pacote_destino_id: targetId
    };
  }

  function requiredMissing(payload) {
    const required = [
      ['p_ordem_interna','Ordem interna'],['p_descricao','Descrição / obra'],
      ['p_grupo_executivo','Grupo executivo'],['p_categoria_orc','Categoria ORC'],
      ['p_classificacao_pacote_capex','Classificação pacote CAPEX'],['p_classificacao_head_operacao','Classificação HEAD operação'],
      ['p_detalhamento','Detalhamento'],['p_detalhamento_orc','Detalhamento ORC']
    ];
    return required.filter(([k]) => !String(payload[k] ?? '').trim()).map(([,label]) => label);
  }

  async function patchNew(backdrop) {
    if (!backdrop || backdrop.dataset.v4043LinkedNew === '1') return;
    const select = backdrop.querySelector('#f-vai-curva');
    if (!select) return;
    backdrop.dataset.v4043LinkedNew = '1';
    addModeOption(select);
    const box = select.closest('.v4023-intent-box');
    const targetWrap = buildTargetField(box, 'new');
    const later = backdrop.querySelector('#v4023-save-later');
    const packageField = backdrop.querySelector('#v4027-package-field');
    const planning = backdrop.querySelector('#v4023-planning-options');

    const update = async () => {
      const active = select.value === MODE;
      targetWrap.hidden = !active;
      if (!active) return;
      if (packageField) packageField.hidden = true;
      if (planning) planning.hidden = true;
      if (later) { later.disabled = false; later.textContent = 'Criar O.I. vinculada à obra'; }
      try { await populateTargets(targetWrap, backdrop.querySelector('#f-oi')?.value.trim() || null); }
      catch (e) { targetWrap.querySelector('[data-v4043-detail]').textContent = `Erro ao carregar obras: ${e?.message || e}`; }
    };
    select.addEventListener('change', () => setTimeout(update, 0));

    later?.addEventListener('click', async event => {
      if (select.value !== MODE) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const err = backdrop.querySelector('#modal-error');
      const targetId = targetWrap.querySelector('[data-v4043-select]')?.value || null;
      const payload = newPayload(backdrop, targetId);
      const missing = requiredMissing(payload);
      if (missing.length) { err.innerHTML = `<div class="error-msg">Preencha: ${esc(missing.join(', '))}.</div>`; return; }
      if (!targetId) { err.innerHTML = '<div class="error-msg">Selecione a obra existente de destino.</div>'; return; }
      if (!confirm(`Vincular a O.I. ${payload.p_ordem_interna} à obra selecionada?\n\nEla não criará uma linha própria na Curva. O CAPEX atual será incorporado ao destino.`)) return;
      later.disabled = true; later.textContent = 'Criando e vinculando...'; err.innerHTML = '';
      try {
        const { data, error } = await sb.rpc('criar_ordem_interna_integrada_v4027', payload);
        if (error) throw error;
        backdrop.remove();
        if (typeof window.refreshCurrent === 'function') await window.refreshCurrent();
        else if (typeof refreshCurrent === 'function') await refreshCurrent();
        alert(`O.I. criada e vinculada com sucesso.\nDestino: ${data?.obra_destino_nome || 'obra selecionada'}`);
      } catch (e) {
        later.disabled = false; later.textContent = 'Criar O.I. vinculada à obra';
        err.innerHTML = `<div class="error-msg">${esc(e?.message || String(e))}</div>`;
      }
    }, true);
    update();
  }

  async function patchEdit(backdrop, id, gov) {
    const select = backdrop.querySelector('#v4023-edit-vai-curva');
    if (!select || backdrop.dataset.v4043LinkedEdit === '1') return;
    backdrop.dataset.v4043LinkedEdit = '1';
    backdrop.dataset.v4043OiId = id;
    addModeOption(select);
    if (gov?.participacao_curva === MODE) select.value = MODE;

    const box = select.closest('.v4023-intent-box');
    const targetWrap = buildTargetField(box, 'edit');
    const packageField = backdrop.querySelector('#v4027-edit-package-field');
    const save = backdrop.querySelector('#modal-save');
    const sourceOi = gov?.ordem_interna || null;

    const update = async () => {
      const active = select.value === MODE;
      targetWrap.hidden = !active;
      if (!active) return;
      if (packageField) packageField.hidden = true;
      try { await populateTargets(targetWrap, sourceOi, gov?.obra_destino_id || null); }
      catch (e) { targetWrap.querySelector('[data-v4043-detail]').textContent = `Erro ao carregar obras: ${e?.message || e}`; }
    };
    select.addEventListener('change', () => setTimeout(update, 0));

    save?.addEventListener('click', async event => {
      if (select.value !== MODE) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const err = backdrop.querySelector('#modal-error');
      const targetId = targetWrap.querySelector('[data-v4043-select]')?.value || null;
      if (!targetId) { err.innerHTML = '<div class="error-msg">Selecione a obra existente de destino.</div>'; return; }
      const payload = editPayload(backdrop, id, targetId);
      if (!confirm(`Confirmar vínculo da O.I. ${sourceOi || ''} com a obra selecionada?\n\nSe existir uma linha individual desta O.I. na Curva, ela será incorporada ao destino e arquivada.`)) return;
      save.disabled = true; save.textContent = 'Vinculando...'; err.innerHTML = '';
      try {
        const { data, error } = await sb.rpc('editar_ordem_interna_integrada_v4027', payload);
        if (error) throw error;
        backdrop.remove();
        if (typeof window.refreshCurrent === 'function') await window.refreshCurrent();
        else if (typeof refreshCurrent === 'function') await refreshCurrent();
        if (data?.aviso) alert(data.aviso);
      } catch (e) {
        save.disabled = false; save.textContent = 'Salvar alterações';
        err.innerHTML = `<div class="error-msg">${esc(e?.message || String(e))}</div>`;
      }
    }, true);
    update();
  }

  function patchOpenNewModals() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      if (backdrop.querySelector('#f-vai-curva')) void patchNew(backdrop);
    });
  }

  function wrapEditOi() {
    if (window.__HAP_V4043_EDIT_WRAPPED__) return true;
    const original = window.editarOi;
    if (typeof original !== 'function') return false;
    window.__HAP_V4043_EDIT_WRAPPED__ = true;
    window.editarOi = async function(id) {
      const result = await original.apply(this, arguments);
      setTimeout(async () => {
        const boxes = Array.from(document.querySelectorAll('.modal-backdrop')).reverse();
        const backdrop = boxes.find(b => b.querySelector('#v4023-edit-vai-curva') && b.querySelector('#e-desc'));
        if (!backdrop) return;
        try {
          const { data, error } = await sb.rpc('obter_governanca_oi_v4027', { p_id:id });
          if (error) throw error;
          await patchEdit(backdrop, id, data || {});
        } catch (e) {
          const err = backdrop.querySelector('#modal-error');
          if (err) err.innerHTML = `<div class="error-msg">Não foi possível carregar o vínculo com a Curva: ${esc(e?.message || String(e))}</div>`;
        }
      }, 0);
      return result;
    };
    return true;
  }

  function boot() {
    patchOpenNewModals();
    new MutationObserver(() => { patchOpenNewModals(); wrapEditOi(); })
      .observe(document.body, { childList:true, subtree:true });
    let tries = 0;
    const timer = setInterval(() => { tries++; if (wrapEditOi() || tries > 80) clearInterval(timer); }, 100);
    window.HAP_V40_LINKED_OI_MODE = { version:VERSION, mode:MODE, refresh:patchOpenNewModals };
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once:true });
})();
