/* HAPCAPEX V40.0.117 — Manutenção: governança da O.I. + filtros da Curva.
   Hotfix sobre V40.0.113:
   - corrige a leitura da governança no modal de edição usando o cliente Supabase real
     do Controle de CAPEX (binding global lexical `sb`, não apenas `window.sb`);
   - mantém o modal padrão e evita loops de MutationObserver;
   - preserva/exibe participacao_curva='manutencao' na criação e edição;
   - remove o aviso de "cadastro legado" quando a governança real já foi carregada;
   - mantém os filtros estilo Excel da aba Manutenção aplicados à tabela/KPIs/gráficos/riscos;
   - aportes operacionais de O.I.s com governança explícita `manutencao` são roteados
     automaticamente para a aba Manutenção, sem abrir planejamento individual;
   - elimina o loop de MutationObserver/RPC que podia travar a página ao digitar uma O.I.
     no aporte operacional;
   - V40.0.117: corrige o travamento/lentidão dos filtros da Base Consumo com paginação concorrente e cache curto.
*/
(() => {
  'use strict';

  if (window.__HAP_V40117_MAINTENANCE_MODE__) return;
  window.__HAP_V40117_MAINTENANCE_MODE__ = true;

  const VERSION = '40.0.117';
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
    if (select.dataset.v40117MaintenancePatched === '1') return;
    select.dataset.v40117MaintenancePatched = '1';

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
    if (select.dataset.v40117MaintenancePatched === '1') return select;
    select.dataset.v40117MaintenancePatched = '1';

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
    const maintenanceText = 'Registrar aporte em Manutenção';
    const maintenanceTitle = 'A O.I. já está governada como Manutenção. O aporte será aplicado automaticamente sem planejamento individual.';
    const maintenanceNote = '<strong>Manutenção identificada automaticamente:</strong> esta O.I. já participa da Curva como Manutenção. O aporte será acrescentado ao Controle e mantido na aba Manutenção, <strong>sem datas, tipologia ou regra de planejamento individual</strong>.';

    if (active) {
      if (backdrop.dataset.v40117MaintenanceAporte !== '1') {
        backdrop.dataset.v40117MaintenanceAporte = '1';
      }
      if (next) {
        if (!next.dataset.v40117OriginalText) next.dataset.v40117OriginalText = next.textContent || 'Registrar e planejar agora';
        if (next.textContent !== maintenanceText) next.textContent = maintenanceText;
        if (next.title !== maintenanceTitle) next.title = maintenanceTitle;
      }
      if (later) {
        if (!Object.prototype.hasOwnProperty.call(later.dataset, 'v40117OriginalDisplay')) {
          later.dataset.v40117OriginalDisplay = later.style.display || '';
        }
        if (later.style.display !== 'none') later.style.display = 'none';
      }
      if (kpiOnly) {
        if (!Object.prototype.hasOwnProperty.call(kpiOnly.dataset, 'v40117OriginalDisplay')) {
          kpiOnly.dataset.v40117OriginalDisplay = kpiOnly.style.display || '';
        }
        if (kpiOnly.style.display !== 'none') kpiOnly.style.display = 'none';
      }
      if (note) {
        if (!Object.prototype.hasOwnProperty.call(note.dataset, 'v40117OriginalHtml')) {
          note.dataset.v40117OriginalHtml = note.innerHTML;
        }
        if (note.innerHTML !== maintenanceNote) note.innerHTML = maintenanceNote;
      }
      return;
    }

    if (backdrop.dataset.v40117MaintenanceAporte !== '1') return;
    delete backdrop.dataset.v40117MaintenanceAporte;

    if (next?.dataset.v40117OriginalText) {
      const originalText = next.dataset.v40117OriginalText;
      if (next.textContent !== originalText) next.textContent = originalText;
      if (next.hasAttribute('title')) next.removeAttribute('title');
    }
    if (later && Object.prototype.hasOwnProperty.call(later.dataset, 'v40117OriginalDisplay')) {
      const display = later.dataset.v40117OriginalDisplay || '';
      if (later.style.display !== display) later.style.display = display;
    }
    if (kpiOnly && Object.prototype.hasOwnProperty.call(kpiOnly.dataset, 'v40117OriginalDisplay')) {
      const display = kpiOnly.dataset.v40117OriginalDisplay || '';
      if (kpiOnly.style.display !== display) kpiOnly.style.display = display;
    }
    if (note && Object.prototype.hasOwnProperty.call(note.dataset, 'v40117OriginalHtml')) {
      const originalHtml = note.dataset.v40117OriginalHtml;
      if (note.innerHTML !== originalHtml) note.innerHTML = originalHtml;
    }
  }

  async function refreshOperationalAporteGovernance(backdrop, force=false) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return null;

    const oi = String(oiInput.value || '').replace(/\D/g, '').trim();
    if (!/^\d{8}$/.test(oi)) {
      delete backdrop.dataset.v40117AporteCheckedOi;
      delete backdrop.dataset.v40117AporteGovernanceState;
      setMaintenanceAporteUi(backdrop, false);
      return null;
    }

    if (!force && backdrop.dataset.v40117AporteCheckedOi === oi) {
      const state = backdrop.dataset.v40117AporteGovernanceState;
      if (state === 'maintenance') setMaintenanceAporteUi(backdrop, true);
      else if (state === 'other') setMaintenanceAporteUi(backdrop, false);
      return state || null;
    }

    const seq = String((Number(backdrop.dataset.v40117AporteLookupSeq || 0) + 1));
    backdrop.dataset.v40117AporteLookupSeq = seq;
    try {
      const governance = await getAporteGovernance(oi, force);
      if (backdrop.dataset.v40117AporteLookupSeq !== seq) return governance;
      if (String(oiInput.value || '').replace(/\D/g, '').trim() !== oi) return governance;

      const maintenance = isGovernedMaintenance(governance);
      backdrop.dataset.v40117AporteCheckedOi = oi;
      backdrop.dataset.v40117AporteGovernanceState = maintenance ? 'maintenance' : 'other';
      setMaintenanceAporteUi(backdrop, maintenance);
      return governance;
    } catch (error) {
      if (backdrop.dataset.v40117AporteLookupSeq === seq) {
        delete backdrop.dataset.v40117AporteCheckedOi;
        delete backdrop.dataset.v40117AporteGovernanceState;
      }
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível confirmar governança do aporte da O.I. ${oi}.`, error);
      return null;
    }
  }

  function patchOperationalAporteModal(backdrop) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return;

    if (oiInput.dataset.v40117MaintenanceAporteBound !== '1') {
      oiInput.dataset.v40117MaintenanceAporteBound = '1';
      let timer = null;
      const schedule = () => {
        clearTimeout(timer);
        const currentOi = String(oiInput.value || '').replace(/\D/g, '').trim();
        if (backdrop.dataset.v40117AporteCheckedOi && backdrop.dataset.v40117AporteCheckedOi !== currentOi) {
          delete backdrop.dataset.v40117AporteCheckedOi;
          delete backdrop.dataset.v40117AporteGovernanceState;
          setMaintenanceAporteUi(backdrop, false);
        }
        if (!/^\d{8}$/.test(currentOi)) return;
        timer = setTimeout(() => void refreshOperationalAporteGovernance(backdrop), 180);
      };
      oiInput.addEventListener('input', schedule);
      oiInput.addEventListener('change', schedule);
    }

    const currentOi = String(oiInput.value || '').replace(/\D/g, '').trim();
    if (!/^\d{8}$/.test(currentOi)) {
      setMaintenanceAporteUi(backdrop, false);
      return;
    }

    if (backdrop.dataset.v40117AporteCheckedOi === currentOi) {
      const state = backdrop.dataset.v40117AporteGovernanceState;
      if (state === 'maintenance') setMaintenanceAporteUi(backdrop, true);
      else if (state === 'other') setMaintenanceAporteUi(backdrop, false);
      return;
    }

    // Uma única consulta por O.I. digitada. O MutationObserver pode revarrer o modal,
    // mas não dispara novas RPCs nem reescreve o DOM quando o estado já foi confirmado.
    if (backdrop.dataset.v40117AporteLookupPending !== currentOi) {
      backdrop.dataset.v40117AporteLookupPending = currentOi;
      void refreshOperationalAporteGovernance(backdrop).finally(() => {
        if (backdrop.dataset.v40117AporteLookupPending === currentOi) {
          delete backdrop.dataset.v40117AporteLookupPending;
        }
      });
    }
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
    button.dataset.v40117AporteBypass = '1';
    button.disabled = false;
    queueMicrotask(() => button.click());
  }

  function installAporteMaintenanceInterceptor() {
    if (window.__HAP_V40117_APORTE_MAINTENANCE_INTERCEPTOR__) return;
    window.__HAP_V40117_APORTE_MAINTENANCE_INTERCEPTOR__ = true;

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('#v36-a-next,#v374-save-later') : null;
      if (!target) return;
      if (target.dataset.v40117AporteBypass === '1') {
        delete target.dataset.v40117AporteBypass;
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
            const isMaintenanceUi = backdrop.dataset.v40117MaintenanceAporte === '1';
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
    if (select.dataset.v40117GovernanceLoaded === token) return;
    select.dataset.v40117GovernanceLoaded = token;

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
      delete select.dataset.v40117GovernanceLoaded;
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
    if (current.__hapV40117MaintenanceWrapped) return true;

    const wrapped = async function(id) {
      const result = await current.apply(this, arguments);
      scheduleEditPatch(id);
      return result;
    };
    wrapped.__hapV40117MaintenanceWrapped = true;
    wrapped.__hapV40117Original = current;
    window.editarOi = wrapped;
    return true;
  }


  // V40.0.117 — a Base Consumo possui dezenas de milhares de lançamentos.
  // O HAP_XF precisa da base completa para aplicar os filtros de cabeçalho, mas o
  // fetchAllRows legado fazia as páginas de 1.000 linhas de forma estritamente
  // sequencial. Com ~62 mil linhas, o primeiro filtro podia parecer travado.
  // Mantemos a mesma fonte/mesma regra de filtragem, apenas buscamos as páginas
  // restantes em pequenos lotes concorrentes e reutilizamos o resultado por pouco
  // tempo. Nenhum dado é gravado por este cache.
  const BASE_CONSUMO_FAST_VIEW = 'vw_controle_base_consumo';
  const BASE_CONSUMO_FAST_PAGE = 1000;
  const BASE_CONSUMO_FAST_CONCURRENCY = 8;
  const BASE_CONSUMO_FAST_TTL_MS = 120000;
  const BASE_CONSUMO_FAST_COLUMNS = [
    'id','ordem_interna','descricao','categoria_valor','categoria_resumo',
    'montante','data_lancamento','fornecedor','fornecedor_nome','oi_nao_encontrada'
  ].join(',');
  const baseConsumoFastCache = new Map();
  const baseConsumoFastLoading = new Map();

  function baseConsumoFastKey(orderCol, ascending) {
    return `${String(orderCol || 'data_lancamento')}|${ascending ? 'asc' : 'desc'}`;
  }

  function invalidateBaseConsumoFastCache() {
    baseConsumoFastCache.clear();
    baseConsumoFastLoading.clear();
  }

  function buildBaseConsumoFastQuery(client, orderCol, ascending, withCount=false) {
    const safeOrder = ['id','ordem_interna','descricao','categoria_valor','montante','data_lancamento','fornecedor','fornecedor_nome']
      .includes(String(orderCol || '')) ? String(orderCol) : 'data_lancamento';
    let query = withCount
      ? client.from(BASE_CONSUMO_FAST_VIEW).select(BASE_CONSUMO_FAST_COLUMNS, { count:'exact' })
      : client.from(BASE_CONSUMO_FAST_VIEW).select(BASE_CONSUMO_FAST_COLUMNS);
    query = query.order(safeOrder, { ascending: !!ascending });
    if (safeOrder !== 'id') query = query.order('id', { ascending:true });
    return query;
  }

  async function loadBaseConsumoFast(orderCol, ascending) {
    const key = baseConsumoFastKey(orderCol, ascending);
    const cached = baseConsumoFastCache.get(key);
    if (cached && (Date.now() - cached.at) < BASE_CONSUMO_FAST_TTL_MS) {
      return { data: cached.rows, error: null };
    }
    if (baseConsumoFastLoading.has(key)) return baseConsumoFastLoading.get(key);

    const client = getSupabaseClient();
    if (!client?.from) throw new Error('Supabase indisponível para carregar a Base Consumo.');

    const promise = (async () => {
      const first = await buildBaseConsumoFastQuery(client, orderCol, ascending, true)
        .range(0, BASE_CONSUMO_FAST_PAGE - 1);
      if (first.error) return { data:null, error:first.error };

      const rows = [...(first.data || [])];
      const total = Number(first.count ?? rows.length);
      if (!Number.isFinite(total) || total <= rows.length) {
        baseConsumoFastCache.set(key, { rows, at:Date.now() });
        return { data:rows, error:null };
      }

      const totalPages = Math.ceil(total / BASE_CONSUMO_FAST_PAGE);
      for (let page = 1; page < totalPages; page += BASE_CONSUMO_FAST_CONCURRENCY) {
        const jobs = [];
        const last = Math.min(totalPages, page + BASE_CONSUMO_FAST_CONCURRENCY);
        for (let p = page; p < last; p += 1) {
          const from = p * BASE_CONSUMO_FAST_PAGE;
          const to = Math.min(total - 1, from + BASE_CONSUMO_FAST_PAGE - 1);
          jobs.push(
            buildBaseConsumoFastQuery(client, orderCol, ascending, false).range(from, to)
          );
        }
        const batch = await Promise.all(jobs);
        for (const response of batch) {
          if (response?.error) return { data:null, error:response.error };
          rows.push(...(response?.data || []));
        }
      }

      // Proteção contra respostas incompletas: se a API não devolver exatamente o
      // total informado pelo count, não cacheamos um conjunto parcial.
      if (rows.length !== total) {
        return {
          data:null,
          error:new Error(`Base Consumo incompleta: ${rows.length} de ${total} linhas carregadas.`)
        };
      }

      baseConsumoFastCache.set(key, { rows, at:Date.now() });
      return { data:rows, error:null };
    })().finally(() => baseConsumoFastLoading.delete(key));

    baseConsumoFastLoading.set(key, promise);
    return promise;
  }

  function installBaseConsumoFilterAcceleration() {
    const current = window.fetchAllRows;
    if (typeof current !== 'function') return false;
    if (current.__hapV40117BaseConsumoFast) return true;

    const wrapped = async function(viewName, orderCol, ascending) {
      if (String(viewName || '') !== BASE_CONSUMO_FAST_VIEW) {
        return current.apply(this, arguments);
      }
      try {
        const fast = await loadBaseConsumoFast(orderCol, ascending);
        if (!fast?.error && Array.isArray(fast?.data)) return fast;
        console.warn(`[HAPCAPEX ${VERSION}] Carga rápida da Base Consumo falhou; usando paginação legada.`, fast?.error);
      } catch (error) {
        console.warn(`[HAPCAPEX ${VERSION}] Carga rápida da Base Consumo falhou; usando paginação legada.`, error);
      }
      return current.apply(this, arguments);
    };
    wrapped.__hapV40117BaseConsumoFast = true;
    wrapped.__hapV40117Original = current;
    window.fetchAllRows = wrapped;
    return true;
  }

  function installBaseConsumoImportInvalidation() {
    const current = window.importarArquivoBaseConsumo;
    if (typeof current !== 'function') return false;
    if (current.__hapV40117BaseConsumoInvalidate) return true;

    const wrapped = async function() {
      invalidateBaseConsumoFastCache();
      try {
        return await current.apply(this, arguments);
      } finally {
        invalidateBaseConsumoFastCache();
      }
    };
    wrapped.__hapV40117BaseConsumoInvalidate = true;
    wrapped.__hapV40117Original = current;
    window.importarArquivoBaseConsumo = wrapped;
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
    if (!currentApply.__hapV40117MaintenanceFilterWrapped) {
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
      wrappedApply.__hapV40117MaintenanceFilterWrapped = true;
      wrappedApply.__hapV40117Original = currentApply;
      window.applyManFilter = wrappedApply;
    }

    const currentClear = window.clearAllManFilters;
    if (typeof currentClear === 'function' && !currentClear.__hapV40117MaintenanceClearWrapped) {
      const wrappedClear = function() {
        try { window.HAP_XF?.clear?.('curve-maintenance', { silent: true }); } catch (_) {}
        return currentClear.apply(this, arguments);
      };
      wrappedClear.__hapV40117MaintenanceClearWrapped = true;
      wrappedClear.__hapV40117Original = currentClear;
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
      installBaseConsumoFilterAcceleration();
      installBaseConsumoImportInvalidation();
      installMaintenanceFilterBridge();
    });
  });

  function boot() {
    scanNewModalsOnly();
    installAporteMaintenanceInterceptor();
    installBaseConsumoFilterAcceleration();
    installBaseConsumoImportInvalidation();
    observer.observe(document.body, { childList: true, subtree: true });

    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      wrapEditOi();
      installBaseConsumoFilterAcceleration();
      installBaseConsumoImportInvalidation();
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
        installBaseConsumoFilterAcceleration();
        installBaseConsumoImportInvalidation();
        installMaintenanceFilterBridge();
        installAporteMaintenanceInterceptor();
      }
    };
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
