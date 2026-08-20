/* HAPCAPEX V40.0.40 — Quarto modo explícito de participação: Manutenção.
   - NÃO seleciona automaticamente pelo nome ou pela classificação da O.I.
   - Só entra na aba Manutenção quando o administrador escolher explicitamente este modo.
   - Sem fluxo previsto individual; somente realizado. Orçamento permanece no bolsão 50158051.
*/
(() => {
  'use strict';
  if (window.__HAP_V4040_MAINTENANCE_MODE__) return;
  window.__HAP_V4040_MAINTENANCE_MODE__ = true;

  const VERSION = '40.0.40';
  const MODE = 'manutencao';
  const LABEL = 'Manutenção — aba Manutenção, somente realizado';

  function addOption(select) {
    if (!select || select.querySelector(`option[value="${MODE}"]`)) return;
    const option = document.createElement('option');
    option.value = MODE;
    option.textContent = LABEL;
    const nao = select.querySelector('option[value="nao"]');
    if (nao) select.insertBefore(option, nao);
    else select.appendChild(option);
  }

  function ensureMaintenanceNote(container, select, button) {
    if (!container || !select) return;
    let note = container.querySelector('.v4040-maintenance-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'v4023-plan-note v4040-maintenance-note';
      note.hidden = true;
      note.innerHTML = '<strong>Manutenção:</strong> esta O.I. será incluída na aba Manutenção da Curva sem planejamento ou CAPEX previsto individual. Serão exibidos somente os realizados da própria O.I.; o orçamento permanece no bolsão de Manutenção (O.I. 50158051).';
      container.appendChild(note);
    }

    const refresh = () => {
      const isMaintenance = select.value === MODE;
      note.hidden = !isMaintenance;
      if (button && isMaintenance) {
        button.disabled = false;
        button.textContent = 'Criar O.I. na Manutenção';
      } else if (button && !select.value) {
        button.textContent = 'Selecione o modo de participação';
      }
    };

    select.addEventListener('change', () => setTimeout(refresh, 0));
    setTimeout(refresh, 0);
  }

  function patchNewModal(backdrop) {
    if (!backdrop || backdrop.dataset.v4040MaintenancePatched === '1') return;
    const select = backdrop.querySelector('#f-vai-curva');
    if (!select) return;

    backdrop.dataset.v4040MaintenancePatched = '1';
    addOption(select);

    const help = backdrop.querySelector('.v4023-intent-help');
    if (help) {
      help.innerHTML = '<strong>Obra individual:</strong> possui linha e planejamento próprios. <strong>Consolidada em pacote:</strong> mantém O.I., aporte e consumo no Controle, mas o efeito financeiro pertence ao pacote escolhido. <strong>Manutenção:</strong> entra apenas na aba Manutenção, sem fluxo previsto individual e com somente os realizados. <strong>Não participa:</strong> não possui efeito na Curva.';
    }

    const box = select.closest('.v4023-intent-box');
    const later = backdrop.querySelector('#v4023-save-later');
    ensureMaintenanceNote(box, select, later);
  }

  async function patchEditModal(backdrop, id) {
    if (!backdrop) return;
    const select = backdrop.querySelector('#v4023-edit-vai-curva');
    if (!select || select.dataset.v4040MaintenancePatched === '1') return;

    select.dataset.v4040MaintenancePatched = '1';
    addOption(select);

    const box = select.closest('.v4023-intent-box');
    const help = box?.querySelector('.v4023-intent-help');
    if (help) {
      help.innerHTML = '<strong>Obra individual:</strong> planejamento próprio. <strong>Consolidada em pacote:</strong> destino financeiro no pacote escolhido. <strong>Manutenção:</strong> somente realizado na aba Manutenção, sem planejamento individual. <strong>Não participa:</strong> sem efeito na Curva.';
    }

    let note = box?.querySelector('.v4040-edit-maintenance-note');
    if (!note && box) {
      note = document.createElement('div');
      note.className = 'v4023-plan-note v4040-edit-maintenance-note';
      note.hidden = true;
      note.innerHTML = '<strong>Manutenção:</strong> esta escolha é explícita e independente da classificação cadastral. A O.I. ficará na aba Manutenção, somente com realizado e sem fluxo previsto próprio.';
      box.appendChild(note);
    }

    const refresh = () => { if (note) note.hidden = select.value !== MODE; };
    select.addEventListener('change', () => setTimeout(refresh, 0));

    if (id && window.sb?.rpc) {
      try {
        const { data, error } = await window.sb.rpc('obter_governanca_oi_v4027', { p_id:id });
        if (!error && data?.participacao_curva) {
          select.value = data.participacao_curva;
          select.dispatchEvent(new Event('change', { bubbles:true }));
        }
      } catch (_) {}
    }
    refresh();
  }

  function patchExistingNewModals() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      if (backdrop.querySelector('#f-vai-curva')) patchNewModal(backdrop);
    });
  }

  function wrapEditOi() {
    if (window.__HAP_V4040_EDIT_WRAPPED__) return true;
    const original = window.editarOi;
    if (typeof original !== 'function') return false;

    window.__HAP_V4040_EDIT_WRAPPED__ = true;
    window.editarOi = async function(id) {
      const result = await original.apply(this, arguments);
      setTimeout(() => {
        const boxes = Array.from(document.querySelectorAll('.modal-backdrop')).reverse();
        const backdrop = boxes.find(b => b.querySelector('#v4023-edit-vai-curva'));
        if (backdrop) patchEditModal(backdrop, id);
      }, 0);
      return result;
    };
    return true;
  }

  const observer = new MutationObserver(() => {
    patchExistingNewModals();
    wrapEditOi();
  });

  function boot() {
    patchExistingNewModals();
    observer.observe(document.body, { childList:true, subtree:true });

    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      if (wrapEditOi() || attempts > 80) clearInterval(retry);
    }, 100);

    window.HAP_V40_MAINTENANCE_MODE = {
      version: VERSION,
      mode: MODE,
      refresh: patchExistingNewModals
    };
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once:true });
})();
