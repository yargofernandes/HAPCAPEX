/* HAPCAPEX V40.0.112 — Manutenção: governança da O.I. + filtros da Curva.
   Correções:
   1) preserva/exibe participacao_curva='manutencao' nos modais de criação/edição,
      inclusive quando v40-control-ui.js substitui window.editarOi após este módulo carregar;
   2) faz os filtros estilo Excel da aba Manutenção participarem efetivamente do
      conjunto renderizado, KPIs, gráficos e riscos;
   3) mantém a regra funcional já homologada: Manutenção = somente realizado,
      sem planejamento/CAPEX previsto individual e sem automatismo por classificação.
*/
(() => {
  'use strict';
  if (window.__HAP_V40112_MAINTENANCE_MODE__) return;
  window.__HAP_V40112_MAINTENANCE_MODE__ = true;

  const VERSION = '40.0.112';
  const MODE = 'manutencao';
  const LABEL = 'Manutenção — aba Manutenção, somente realizado';
  const EDIT_SELECTOR = '#v4023-edit-vai-curva';
  const NEW_SELECTOR = '#f-vai-curva';

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
      if (!button) return;
      if (isMaintenance) {
        button.disabled = false;
        button.textContent = 'Criar O.I. na Manutenção';
      } else if (!select.value) {
        button.textContent = 'Selecione o modo de participação';
      }
    };

    if (select.dataset.v40112MaintenanceNote !== '1') {
      select.dataset.v40112MaintenanceNote = '1';
      select.addEventListener('change', () => setTimeout(refresh, 0));
    }
    refresh();
  }

  function patchNewModal(backdrop) {
    if (!backdrop) return;
    const select = backdrop.querySelector(NEW_SELECTOR);
    if (!select) return;

    addOption(select);
    select.dataset.v40112MaintenancePatched = '1';

    const help = backdrop.querySelector('.v4023-intent-help');
    if (help) {
      help.innerHTML = '<strong>Obra individual:</strong> possui linha e planejamento próprios. <strong>Consolidada em pacote:</strong> mantém O.I., aporte e consumo no Controle, mas o efeito financeiro pertence ao pacote escolhido. <strong>Manutenção:</strong> entra apenas na aba Manutenção, sem fluxo previsto individual e com somente os realizados. <strong>Não participa:</strong> não possui efeito na Curva.';
    }

    const box = select.closest('.v4023-intent-box');
    const later = backdrop.querySelector('#v4023-save-later');
    ensureMaintenanceNote(box, select, later);
  }

  function decorateEditModal(backdrop) {
    const select = backdrop?.querySelector(EDIT_SELECTOR);
    if (!select) return null;

    addOption(select);
    select.dataset.v40112MaintenancePatched = '1';

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
    if (select.dataset.v40112EditListener !== '1') {
      select.dataset.v40112EditListener = '1';
      select.addEventListener('change', () => setTimeout(refresh, 0));
    }
    refresh();
    return select;
  }

  async function patchEditModal(backdrop, id) {
    const select = decorateEditModal(backdrop);
    if (!select || !id || !window.sb?.rpc) return;

    const token = `${id}`;
    if (select.dataset.v40112GovernanceLoaded === token) return;
    select.dataset.v40112GovernanceLoaded = token;

    try {
      const { data, error } = await window.sb.rpc('obter_governanca_oi_v4027', { p_id: id });
      if (error) throw error;
      const mode = data?.participacao_curva;
      if (mode) {
        addOption(select);
        select.value = mode;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (error) {
      delete select.dataset.v40112GovernanceLoaded;
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível confirmar a governança da O.I.`, error);
    }
  }

  function scanModals() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      if (backdrop.querySelector(NEW_SELECTOR)) patchNewModal(backdrop);
      if (backdrop.querySelector(EDIT_SELECTOR)) decorateEditModal(backdrop);
    });
  }

  function scheduleEditPatch(id) {
    [0, 40, 120, 300].forEach(delay => setTimeout(() => {
      const boxes = Array.from(document.querySelectorAll('.modal-backdrop')).reverse();
      const backdrop = boxes.find(b => b.querySelector(EDIT_SELECTOR));
      if (backdrop) void patchEditModal(backdrop, id);
    }, delay));
  }

  function wrapEditOi() {
    const current = window.editarOi;
    if (typeof current !== 'function') return false;
    if (current.__hapV40112MaintenanceWrapped) return true;

    const wrapped = async function(id) {
      const result = await current.apply(this, arguments);
      scheduleEditPatch(id);
      return result;
    };
    wrapped.__hapV40112MaintenanceWrapped = true;
    wrapped.__hapV40112Original = current;
    window.editarOi = wrapped;
    return true;
  }

  function maintenanceFilterBridgeReady() {
    return typeof window.applyManFilter === 'function' &&
      typeof window.renderManTable === 'function' &&
      !!window.HAP_XF;
  }

  function installMaintenanceFilterBridge() {
    if (!maintenanceFilterBridgeReady()) return false;

    const currentApply = window.applyManFilter;
    if (!currentApply.__hapV40112MaintenanceFilterWrapped) {
      const wrappedApply = function() {
        const result = currentApply.apply(this, arguments);
        try {
          if (window.HAP_XF?.apply) {
            // manFilteredObras/manObras são bindings globais do dashboard-core.js.
            // O filtro legado (texto + período) roda primeiro; o HAP_XF refina e ordena depois.
            manFilteredObras = window.HAP_XF.apply('curve-maintenance', manFilteredObras);
            const count = document.getElementById('manFilterCount');
            if (count) count.textContent = `${manFilteredObras.length} de ${manObras.length} obras`;
            if (typeof renderManKPIs === 'function') renderManKPIs();
            if (typeof renderManTable === 'function') renderManTable();
            if (typeof renderManCharts === 'function') renderManCharts();
            if (typeof renderManRisk === 'function') renderManRisk();
          }
        } catch (error) {
          console.error(`[HAPCAPEX ${VERSION}] Falha ao aplicar filtros da Manutenção.`, error);
        }
        return result;
      };
      wrappedApply.__hapV40112MaintenanceFilterWrapped = true;
      wrappedApply.__hapV40112Original = currentApply;
      window.applyManFilter = wrappedApply;
    }

    const currentClear = window.clearAllManFilters;
    if (typeof currentClear === 'function' && !currentClear.__hapV40112MaintenanceClearWrapped) {
      const wrappedClear = function() {
        try { window.HAP_XF?.clear?.('curve-maintenance', { silent: true }); } catch (_) {}
        return currentClear.apply(this, arguments);
      };
      wrappedClear.__hapV40112MaintenanceClearWrapped = true;
      wrappedClear.__hapV40112Original = currentClear;
      window.clearAllManFilters = wrappedClear;
    }

    return true;
  }

  const observer = new MutationObserver(() => {
    scanModals();
    wrapEditOi();
    installMaintenanceFilterBridge();
  });

  function boot() {
    scanModals();
    observer.observe(document.body, { childList: true, subtree: true });

    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      wrapEditOi();
      installMaintenanceFilterBridge();
      if (attempts > 600) clearInterval(retry); // 60 s: cobre login/carregamento dinâmico do dashboard.
    }, 100);

    window.addEventListener('hapcapex:curve-ready', () => {
      installMaintenanceFilterBridge();
      try { window.applyManFilter?.(); } catch (_) {}
    });

    window.HAP_V40_MAINTENANCE_MODE = {
      version: VERSION,
      mode: MODE,
      refresh() {
        scanModals();
        wrapEditOi();
        installMaintenanceFilterBridge();
      }
    };
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
