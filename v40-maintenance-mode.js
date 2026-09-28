/* HAPCAPEX V40.0.115 — Manutenção: governança da O.I. + filtros da Curva.
   Hotfix sobre V40.0.113:
   - corrige a leitura da governança no modal de edição usando o cliente Supabase real
     do Controle de CAPEX (binding global lexical `sb`, não apenas `window.sb`);
   - mantém o modal padrão e evita loops de MutationObserver;
   - preserva/exibe participacao_curva='manutencao' na criação e edição;
   - remove o aviso de "cadastro legado" quando a governança real já foi carregada;
   - mantém os filtros estilo Excel da aba Manutenção aplicados à tabela/KPIs/gráficos/riscos;
   - aportes operacionais de O.I.s com governança explícita `manutencao` são roteados
     automaticamente para a aba Manutenção, sem abrir planejamento individual.
*/
(() => {
  'use strict';

  if (window.__HAP_V40115_MAINTENANCE_MODE__) return;
  window.__HAP_V40115_MAINTENANCE_MODE__ = true;

  const VERSION = '40.0.115';
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
    if (select.dataset.v40115MaintenancePatched === '1') return;
    select.dataset.v40115MaintenancePatched = '1';

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
    if (select.dataset.v40115MaintenancePatched === '1') return select;
    select.dataset.v40115MaintenancePatched = '1';

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

  const aporteGovernanceCache = new Map();

  async function getAporteGovernance(oi, force=false) {
    const key = String(oi || '').replace(/\D/g, '').trim();
    if (!/^\d{8}$/.test(key)) return null;
    if (!force && aporteGovernanceCache.has(key)) return aporteGovernanceCache.get(key);

    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase indisponível para confirmar a governança da O.I.');

    const promise = (async () => {
      const { data, error } = await client.rpc('prever_sincronia_curva', { p_ordem_interna:key });
      if (error) throw error;
      return data || null;
    })();
    aporteGovernanceCache.set(key, promise);
    try {
      return await promise;
    } catch (error) {
      aporteGovernanceCache.delete(key);
      throw error;
    }
  }

  function isGovernedMaintenance(governance) {
    const mode = String(governance?.participacao_curva || '').trim().toLowerCase();
    return mode === MODE || (governance?.eh_manutencao === true && governance?.requer_planejamento === false);
  }

  function getOperationalAporteBox(backdrop) {
    const box = backdrop?.querySelector('.modal-box');
    if (!box) return null;
    const heading = String(box.querySelector('h2')?.textContent || '').trim();
    return heading === 'Registrar aporte operacional' ? box : null;
  }

  function readOperationalAporte(box) {
    return {
      oi: String(box?.querySelector('#v36-a-oi')?.value || '').replace(/\D/g, '').trim(),
      value: Number(box?.querySelector('#v36-a-valor')?.value || 0),
      mes: String(box?.querySelector('#v36-a-mes')?.value || '').trim(),
      name: String(box?.querySelector('#v36-a-nome')?.value || '').trim(),
      obs: String(box?.querySelector('#v36-a-obs')?.value || '').trim()
    };
  }

  function setMaintenanceAporteUi(backdrop, active) {
    const box = getOperationalAporteBox(backdrop);
    if (!box) return;
    const next = box.querySelector('#v36-a-next');
    const later = box.querySelector('#v374-save-later');
    const kpiOnly = box.querySelector('#v4066-kpi-only');
    const note = box.querySelector('.v374-plan-later-note');

    if (active) {
      backdrop.dataset.v40115MaintenanceAporte = '1';
      if (next) {
        if (!next.dataset.v40115OriginalText) next.dataset.v40115OriginalText = next.textContent || 'Registrar e planejar agora';
        next.textContent = 'Registrar aporte em Manutenção';
        next.title = 'A O.I. já está governada como Manutenção. O aporte será aplicado automaticamente sem planejamento individual.';
      }
      if (later) {
        if (!later.dataset.v40115OriginalDisplay) later.dataset.v40115OriginalDisplay = later.style.display || '';
        later.style.display = 'none';
      }
      if (kpiOnly) {
        if (!kpiOnly.dataset.v40115OriginalDisplay) kpiOnly.dataset.v40115OriginalDisplay = kpiOnly.style.display || '';
        kpiOnly.style.display = 'none';
      }
      if (note) {
        if (!note.dataset.v40115OriginalHtml) note.dataset.v40115OriginalHtml = note.innerHTML;
        note.innerHTML = '<strong>Manutenção identificada automaticamente:</strong> esta O.I. já participa da Curva como Manutenção. O aporte será acrescentado ao Controle e mantido na aba Manutenção, <strong>sem datas, tipologia ou regra de planejamento individual</strong>.';
      }
    } else if (backdrop.dataset.v40115MaintenanceAporte === '1') {
      delete backdrop.dataset.v40115MaintenanceAporte;
      if (next?.dataset.v40115OriginalText) {
        next.textContent = next.dataset.v40115OriginalText;
        next.removeAttribute('title');
      }
      if (later) later.style.display = later.dataset.v40115OriginalDisplay || '';
      if (kpiOnly) kpiOnly.style.display = kpiOnly.dataset.v40115OriginalDisplay || '';
      if (note?.dataset.v40115OriginalHtml) note.innerHTML = note.dataset.v40115OriginalHtml;
    }
  }

  async function refreshOperationalAporteGovernance(backdrop, force=false) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return null;
    const oi = String(oiInput.value || '').replace(/\D/g, '').trim();
    if (!/^\d{8}$/.test(oi)) {
      setMaintenanceAporteUi(backdrop, false);
      return null;
    }

    const seq = String((Number(backdrop.dataset.v40115AporteLookupSeq || 0) + 1));
    backdrop.dataset.v40115AporteLookupSeq = seq;
    try {
      const governance = await getAporteGovernance(oi, force);
      if (backdrop.dataset.v40115AporteLookupSeq !== seq) return governance;
      if (String(oiInput.value || '').replace(/\D/g, '').trim() !== oi) return governance;
      setMaintenanceAporteUi(backdrop, isGovernedMaintenance(governance));
      return governance;
    } catch (error) {
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível confirmar governança do aporte da O.I. ${oi}.`, error);
      return null;
    }
  }

  function patchOperationalAporteModal(backdrop) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return;

    if (oiInput.dataset.v40115MaintenanceAporteBound !== '1') {
      oiInput.dataset.v40115MaintenanceAporteBound = '1';
      let timer = null;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => void refreshOperationalAporteGovernance(backdrop), 120);
      };
      oiInput.addEventListener('input', schedule);
      oiInput.addEventListener('change', schedule);
    }

    // V37 e o módulo de KPI podem acrescentar nota/botões após o modal nascer.
    // Reaplica somente o estado visual, sem nova consulta quando já confirmado.
    if (backdrop.dataset.v40115MaintenanceAporte === '1') setMaintenanceAporteUi(backdrop, true);
    else void refreshOperationalAporteGovernance(backdrop);
  }

  async function registerGovernedMaintenanceAporte(backdrop, box, button) {
    const aporte = readOperationalAporte(box);
    const errorBox = box.querySelector('#v36-entry-error');
    if (!/^\d{8}$/.test(aporte.oi) || !/^\d{4}-\d{2}$/.test(aporte.mes) || !Number.isFinite(aporte.value) || aporte.value <= 0) {
      return false;
    }

    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase indisponível.');
    const actionButtons = ['#v36-a-next','#v374-save-later','#v4066-kpi-only']
      .map(selector => box.querySelector(selector)).filter(Boolean);
    const oldText = button.textContent;
    actionButtons.forEach(btn => { btn.disabled = true; });
    button.textContent = 'Registrando em Manutenção...';
    if (errorBox) errorBox.innerHTML = '';

    try {
      const { data, error } = await client.rpc('registrar_aporte_integrado', {
        p_modo:'operacional',
        p_ordem_interna:aporte.oi,
        p_valor:aporte.value,
        p_mes:aporte.mes,
        p_nome:aporte.name || null,
        p_observacao:aporte.obs || null,
        p_planejamento:{}
      });
      if (error) throw error;

      backdrop.remove();
      try { if (window.HAP_V36) window.HAP_V36.loading = null; } catch (_) {}
      if (typeof window.refreshCurrent === 'function') await window.refreshCurrent();
      else {
        try { if (typeof refreshCurrent === 'function') await refreshCurrent(); } catch (_) {}
      }
      const money = Number(aporte.value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
      window.alert(`Aporte registrado automaticamente em Manutenção.\n\nO.I.: ${aporte.oi}\nValor: ${money}\n\nA O.I. permanece na aba Manutenção da Curva, sem planejamento individual.`);
      return data || true;
    } catch (error) {
      actionButtons.forEach(btn => { btn.disabled = false; });
      button.textContent = oldText || 'Registrar aporte em Manutenção';
      if (errorBox) errorBox.innerHTML = `<div class="error-msg">${String(error?.message || error).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</div>`;
      throw error;
    }
  }

  function replayAporteClick(button) {
    button.dataset.v40115AporteBypass = '1';
    button.disabled = false;
    queueMicrotask(() => button.click());
  }

  function installAporteMaintenanceInterceptor() {
    if (window.__HAP_V40115_APORTE_MAINTENANCE_INTERCEPTOR__) return;
    window.__HAP_V40115_APORTE_MAINTENANCE_INTERCEPTOR__ = true;

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('#v36-a-next,#v374-save-later') : null;
      if (!target) return;
      if (target.dataset.v40115AporteBypass === '1') {
        delete target.dataset.v40115AporteBypass;
        return;
      }

      const backdrop = target.closest('.modal-backdrop');
      const box = getOperationalAporteBox(backdrop);
      if (!backdrop || !box) return;
      const aporte = readOperationalAporte(box);
      // Deixa a validação legada cuidar de formulários incompletos.
      if (!/^\d{8}$/.test(aporte.oi) || !/^\d{4}-\d{2}$/.test(aporte.mes) || !Number.isFinite(aporte.value) || aporte.value <= 0) return;

      // Intercepta antes dos handlers legados: a decisão é feita pela governança explícita no Supabase.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      target.disabled = true;
      const originalText = target.textContent;
      target.textContent = 'Confirmando governança...';

      void (async () => {
        try {
          const governance = await getAporteGovernance(aporte.oi, true);
          if (!isGovernedMaintenance(governance)) {
            target.textContent = originalText;
            replayAporteClick(target);
            return;
          }
          setMaintenanceAporteUi(backdrop, true);
          await registerGovernedMaintenanceAporte(backdrop, box, target);
        } catch (error) {
          // Se a consulta de governança falhar, preserva o fluxo anterior; se a gravação falhar,
          // o próprio formulário já exibiu o erro e não deve abrir planejamento genérico.
          if (document.body.contains(backdrop)) {
            const isMaintenanceUi = backdrop.dataset.v40115MaintenanceAporte === '1';
            if (!isMaintenanceUi) {
              target.textContent = originalText;
              replayAporteClick(target);
            } else {
              target.disabled = false;
            }
          }
        }
      })();
    }, true);
  }

  async function patchEditModal(backdrop, id) {
    const select = decorateEditModal(backdrop);
    const client = getSupabaseClient();
    if (!select || !id || !client) return;

    const token = String(id);
    if (select.dataset.v40115GovernanceLoaded === token) return;
    select.dataset.v40115GovernanceLoaded = token;

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
      delete select.dataset.v40115GovernanceLoaded;
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível confirmar a governança da O.I.`, error);
    }
  }

  function scanNewModalsOnly() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      if (backdrop.querySelector(NEW_SELECTOR)) patchNewModal(backdrop);
      // Edição é apenas decorada aqui; a leitura do Supabase ocorre pelo wrapper com o ID correto.
      if (backdrop.querySelector(EDIT_SELECTOR)) decorateEditModal(backdrop);
      patchOperationalAporteModal(backdrop);
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
    if (current.__hapV40115MaintenanceWrapped) return true;

    const wrapped = async function(id) {
      const result = await current.apply(this, arguments);
      scheduleEditPatch(id);
      return result;
    };
    wrapped.__hapV40115MaintenanceWrapped = true;
    wrapped.__hapV40115Original = current;
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
    if (!currentApply.__hapV40115MaintenanceFilterWrapped) {
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
      wrappedApply.__hapV40115MaintenanceFilterWrapped = true;
      wrappedApply.__hapV40115Original = currentApply;
      window.applyManFilter = wrappedApply;
    }

    const currentClear = window.clearAllManFilters;
    if (typeof currentClear === 'function' && !currentClear.__hapV40115MaintenanceClearWrapped) {
      const wrappedClear = function() {
        try { window.HAP_XF?.clear?.('curve-maintenance', { silent: true }); } catch (_) {}
        return currentClear.apply(this, arguments);
      };
      wrappedClear.__hapV40115MaintenanceClearWrapped = true;
      wrappedClear.__hapV40115Original = currentClear;
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
    installAporteMaintenanceInterceptor();
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
        installAporteMaintenanceInterceptor();
      }
    };
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
