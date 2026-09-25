/* HAPCAPEX V40.0.114 — Manutenção: governança da O.I. + filtros da Curva.
   Hotfix sobre V40.0.113:
   - corrige a leitura da governança no modal de edição usando o cliente Supabase real
     do Controle de CAPEX (binding global lexical `sb`, não apenas `window.sb`);
   - mantém o modal padrão e evita loops de MutationObserver;
   - preserva/exibe participacao_curva='manutencao' na criação e edição;
   - remove o aviso de "cadastro legado" quando a governança real já foi carregada;
   - mantém os filtros estilo Excel da aba Manutenção aplicados à tabela/KPIs/gráficos/riscos.
*/
(() => {
  'use strict';

  if (window.__HAP_V40114_MAINTENANCE_MODE__) return;
  window.__HAP_V40114_MAINTENANCE_MODE__ = true;

  const VERSION = '40.0.114';
  const MODE = 'manutencao';
  const LABEL = 'Manutenção — aba Manutenção, somente realizado';
  const EDIT_SELECTOR = '#v4023-edit-vai-curva';
  const NEW_SELECTOR = '#f-vai-curva';

  function addOption(select) {
    if (!select || select.querySelector(`option[value="${MODE}"]`)) return false;
    const option = document.createElement('option');
    option.value = MODE;
    option.textContent = LABEL;
    const nao = select.querySelector('option[value="nao"]');
    if (nao) select.insertBefore(option, nao);
    else select.appendChild(option);
    return true;
  }

  function updateMaintenanceNote(select, note, button) {
    if (!select) return;
    const isMaintenance = select.value === MODE;
    if (note) note.hidden = !isMaintenance;
    if (!button) return;
    if (isMaintenance) {
      button.disabled = false;
      button.textContent = 'Criar O.I. na Manutenção';
    } else if (!select.value) {
      button.textContent = 'Selecione o modo de participação';
    }
  }

  function patchNewModal(backdrop) {
    if (!backdrop) return;
    const select = backdrop.querySelector(NEW_SELECTOR);
    if (!select) return;

    // CRÍTICO: depois de decorado, não reescreve DOM. Evita loop de MutationObserver.
    if (select.dataset.v40114MaintenancePatched === '1') return;
    select.dataset.v40114MaintenancePatched = '1';

    addOption(select);

    const box = select.closest('.v4023-intent-box');
    const help = box?.querySelector('.v4023-intent-help');
    if (help) {
      help.innerHTML = '<strong>Obra individual:</strong> possui linha e planejamento próprios. <strong>Consolidada em pacote:</strong> mantém O.I., aporte e consumo no Controle, mas o efeito financeiro pertence ao pacote escolhido. <strong>Manutenção:</strong> entra apenas na aba Manutenção, sem fluxo previsto individual e com somente os realizados. <strong>Não participa:</strong> não possui efeito na Curva.';
    }

    let note = box?.querySelector('.v4040-maintenance-note');
    if (!note && box) {
      note = document.createElement('div');
      note.className = 'v4023-plan-note v4040-maintenance-note';
      note.hidden = true;
      note.innerHTML = '<strong>Manutenção:</strong> esta O.I. será incluída na aba Manutenção da Curva sem planejamento ou CAPEX previsto individual. Serão exibidos somente os realizados da própria O.I.; o orçamento permanece no bolsão de Manutenção (O.I. 50158051).';
      box.appendChild(note);
    }

    const later = backdrop.querySelector('#v4023-save-later');
    select.addEventListener('change', () => updateMaintenanceNote(select, note, later));
    updateMaintenanceNote(select, note, later);
  }

  function decorateEditModal(backdrop) {
    const select = backdrop?.querySelector(EDIT_SELECTOR);
    if (!select) return null;

    // CRÍTICO: patch estritamente idempotente.
    if (select.dataset.v40114MaintenancePatched === '1') return select;
    select.dataset.v40114MaintenancePatched = '1';

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
    select.addEventListener('change', refresh);
    refresh();
    return select;
  }

  function getSupabaseClient() {
    // controle-capex.html declara `const sb = ...` em script clássico.
    // Top-level const não vira window.sb, mas continua acessível por identificador
    // aos scripts clássicos carregados depois. O fallback mantém compatibilidade.
    try {
      if (typeof sb !== 'undefined' && sb?.rpc) return sb;
    } catch (_) {}
    return window.sb?.rpc ? window.sb : null;
  }

  async function patchEditModal(backdrop, id) {
    const select = decorateEditModal(backdrop);
    const client = getSupabaseClient();
    if (!select || !id || !client) return;

    const token = String(id);
    if (select.dataset.v40114GovernanceLoaded === token) return;
    select.dataset.v40114GovernanceLoaded = token;

    try {
      const { data, error } = await client.rpc('obter_governanca_oi_v4027', { p_id: id });
      if (error) throw error;

      const mode = String(data?.participacao_curva || '').trim();
      if (mode) {
        addOption(select);
        select.value = mode;

        // Se a governança existe no banco, este cadastro não é legado.
        // O módulo legado pode ter observado o select antes da resposta do RPC.
        backdrop?.querySelectorAll('[data-v4081-legacy-hint]').forEach(el => el.remove());
        if (backdrop?.dataset) {
          backdrop.dataset.v4081InitialCurveMode = mode;
        }

        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (error) {
      delete select.dataset.v40114GovernanceLoaded;
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível confirmar a governança da O.I.`, error);
    }
  }

  function scanNewModalsOnly() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      if (backdrop.querySelector(NEW_SELECTOR)) patchNewModal(backdrop);
      // Edição é apenas decorada aqui; a leitura do Supabase ocorre pelo wrapper com o ID correto.
      if (backdrop.querySelector(EDIT_SELECTOR)) decorateEditModal(backdrop);
    });
  }

  function findLatestEditBackdrop() {
    return Array.from(document.querySelectorAll('.modal-backdrop'))
      .reverse()
      .find(backdrop => backdrop.querySelector(EDIT_SELECTOR));
  }

  function scheduleEditPatch(id) {
    [0, 50, 150, 350].forEach(delay => {
      setTimeout(() => {
        const backdrop = findLatestEditBackdrop();
        if (backdrop) void patchEditModal(backdrop, id);
      }, delay);
    });
  }

  function wrapEditOi() {
    const current = window.editarOi;
    if (typeof current !== 'function') return false;
    if (current.__hapV40114MaintenanceWrapped) return true;

    const wrapped = async function(id) {
      const result = await current.apply(this, arguments);
      scheduleEditPatch(id);
      return result;
    };
    wrapped.__hapV40114MaintenanceWrapped = true;
    wrapped.__hapV40114Original = current;
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
    if (!currentApply.__hapV40114MaintenanceFilterWrapped) {
      const wrappedApply = function() {
        const result = currentApply.apply(this, arguments);
        try {
          if (window.HAP_XF?.apply) {
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
      wrappedApply.__hapV40114MaintenanceFilterWrapped = true;
      wrappedApply.__hapV40114Original = currentApply;
      window.applyManFilter = wrappedApply;
    }

    const currentClear = window.clearAllManFilters;
    if (typeof currentClear === 'function' && !currentClear.__hapV40114MaintenanceClearWrapped) {
      const wrappedClear = function() {
        try { window.HAP_XF?.clear?.('curve-maintenance', { silent: true }); } catch (_) {}
        return currentClear.apply(this, arguments);
      };
      wrappedClear.__hapV40114MaintenanceClearWrapped = true;
      wrappedClear.__hapV40114Original = currentClear;
      window.clearAllManFilters = wrappedClear;
    }

    return true;
  }

  let scanQueued = false;
  const observer = new MutationObserver(() => {
    // Agrupa mutações numa única varredura e impede cascatas síncronas.
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      scanNewModalsOnly();
      wrapEditOi();
      installMaintenanceFilterBridge();
    });
  });

  function boot() {
    scanNewModalsOnly();
    observer.observe(document.body, { childList: true, subtree: true });

    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      wrapEditOi();
      installMaintenanceFilterBridge();
      if (attempts > 600) clearInterval(retry);
    }, 100);

    window.addEventListener('hapcapex:curve-ready', () => {
      installMaintenanceFilterBridge();
      try { window.applyManFilter?.(); } catch (_) {}
    });

    window.HAP_V40_MAINTENANCE_MODE = {
      version: VERSION,
      mode: MODE,
      refresh() {
        scanNewModalsOnly();
        wrapEditOi();
        installMaintenanceFilterBridge();
      }
    };
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
