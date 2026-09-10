/* HAPCAPEX V40.0.81 — Edição de O.I. legada sem obrigar definição de participação na Curva.
   - Se a O.I. abriu como "Não definido (cadastro legado)" e o usuário mantiver essa opção,
     salva somente os dados cadastrais/financeiros pelo RPC editar_ordem_interna.
   - Não altera participacao_curva, vai_para_curva, destino, vínculo ou planejamento da Curva.
   - Se o usuário escolher um modo de participação, o fluxo de governança V40 existente continua responsável pelo salvamento.
*/
(() => {
  'use strict';
  if (window.__HAP_V4081_LEGACY_CURVE_EDIT_OPTIONAL__) return;
  window.__HAP_V4081_LEGACY_CURVE_EDIT_OPTIONAL__ = true;

  const VERSION = '40.0.81';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  const isLegacyUnchanged = (initialMode, currentMode) => !String(initialMode || '').trim() && !String(currentMode || '').trim();

  function payloadFromModal(box, id) {
    return {
      p_id: id,
      p_descricao: box.querySelector('#e-desc')?.value.trim() || '',
      p_grupo_executivo: box.querySelector('#e-grupo')?.value.trim() || '',
      p_categoria_orc: box.querySelector('#e-categoria')?.value.trim() || '',
      p_classificacao_pacote_capex: box.querySelector('#e-pacote')?.value.trim() || '',
      p_classificacao_head_operacao: box.querySelector('#e-head')?.value.trim() || '',
      p_detalhamento: box.querySelector('#e-detalhamento')?.value.trim() || '',
      p_detalhamento_orc: box.querySelector('#e-detalhamento-orc')?.value.trim() || '',
      p_montante_atribuido: Number(box.querySelector('#e-montante')?.value || 0),
      p_valor_compromissado: Number(box.querySelector('#e-compromissado')?.value || 0),
      p_data_inicio: box.querySelector('#e-data-inicio')?.value || null,
      p_data_fim: box.querySelector('#e-data-fim')?.value || null
    };
  }

  function validatePayload(payload) {
    const required = [
      ['p_descricao','Descrição / obra'],
      ['p_classificacao_pacote_capex','Pacote CAPEX'],
      ['p_classificacao_head_operacao','HEAD Operação'],
      ['p_grupo_executivo','Grupo Executivo'],
      ['p_detalhamento','Detalhamento'],
      ['p_categoria_orc','Categoria ORC'],
      ['p_detalhamento_orc','Detalhamento ORC']
    ];
    const missing = required.filter(([key]) => !String(payload[key] ?? '').trim()).map(([,label]) => label);
    if (missing.length) return `Preencha os campos obrigatórios: ${missing.join(', ')}.`;
    if (payload.p_data_inicio && payload.p_data_fim && payload.p_data_fim < payload.p_data_inicio) return 'A data de fim não pode ser anterior à data de início.';
    return '';
  }

  function addLegacyHint(block) {
    if (!block || block.querySelector('[data-v4081-legacy-hint]')) return;
    const help = document.createElement('div');
    help.dataset.v4081LegacyHint = '1';
    help.className = 'v4023-intent-help';
    help.style.marginTop = '7px';
    help.innerHTML = '<strong>Cadastro legado:</strong> você pode manter “Não definido” e salvar alterações nos demais campos sem alterar a participação desta O.I. na Curva.';
    const warning = block.querySelector('#v4023-edit-curve-warning');
    if (warning) block.insertBefore(help, warning);
    else block.appendChild(help);
  }

  function resolveOiId(backdrop, box) {
    const explicit = backdrop?.dataset?.v4043OiId || backdrop?.dataset?.v4081OiId || '';
    if (explicit) return explicit;
    const hidden = box.querySelector('#e-id,[name="id"],[name="oi_id"]');
    if (hidden?.value) return hidden.value;
    return '';
  }

  function patchEditModal(backdrop) {
    if (!backdrop || backdrop.dataset.v4081LegacyOptional === '1') return;
    const box = backdrop.querySelector('.modal-box');
    const select = box?.querySelector('#v4023-edit-vai-curva');
    const save = box?.querySelector('#modal-save');
    const desc = box?.querySelector('#e-desc');
    if (!box || !select || !save || !desc) return;

    const initialMode = String(select.value || '').trim();
    if (initialMode) {
      backdrop.dataset.v4081LegacyOptional = '1';
      return;
    }

    backdrop.dataset.v4081LegacyOptional = '1';
    backdrop.dataset.v4081InitialCurveMode = initialMode;
    addLegacyHint(select.closest('.v4023-intent-box'));

    save.addEventListener('click', async event => {
      const currentMode = String(select.value || '').trim();
      if (!isLegacyUnchanged(initialMode, currentMode)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const err = box.querySelector('#modal-error');
      if (err) err.innerHTML = '';

      let id = resolveOiId(backdrop, box);
      if (!id) {
        const oiText = box.querySelector('h2')?.nextElementSibling?.textContent || '';
        const oi = (oiText.match(/\b\d{8}\b/) || [])[0] || '';
        if (oi && typeof sb !== 'undefined') {
          try {
            const lookup = await sb.from('vw_controle_capex_admin').select('id').eq('ordem_interna', oi).maybeSingle();
            if (!lookup.error && lookup.data?.id) id = lookup.data.id;
          } catch (_) {}
        }
      }
      if (!id) {
        if (err) err.innerHTML = '<div class="error-msg">Não foi possível identificar esta O.I. para salvar.</div>';
        return;
      }

      const payload = payloadFromModal(box, id);
      const validation = validatePayload(payload);
      if (validation) {
        if (err) err.innerHTML = `<div class="error-msg">${esc(validation)}</div>`;
        return;
      }

      const oldText = save.textContent;
      save.disabled = true;
      save.textContent = 'Salvando...';
      try {
        const { error } = await sb.rpc('editar_ordem_interna', payload);
        if (error) throw error;
        backdrop.remove();
        if (typeof window.refreshCurrent === 'function') await window.refreshCurrent();
        else if (typeof refreshCurrent === 'function') await refreshCurrent();
      } catch (e) {
        save.disabled = false;
        save.textContent = oldText || 'Salvar alterações';
        if (err) err.innerHTML = `<div class="error-msg">${esc(e?.message || String(e))}</div>`;
      }
    }, true);
  }

  function patchAll() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => patchEditModal(backdrop));
  }

  function boot() {
    patchAll();
    const observer = new MutationObserver(() => patchAll());
    observer.observe(document.body, { childList:true, subtree:true });
    window.HAP_V4081_LEGACY_CURVE_EDIT_OPTIONAL = {
      version: VERSION,
      active: true,
      isLegacyUnchanged,
      payloadFromModal,
      validatePayload,
      patchEditModal,
      refresh: patchAll
    };
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once:true });
})();
