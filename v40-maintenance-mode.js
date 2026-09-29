/* HAPCAPEX V40.0.118 — Manutenção: governança da O.I. + filtros da Curva.
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
   - V40.0.118: preserva a aceleração dos filtros da Base Consumo com paginação concorrente e cache curto;
   - V40.0.118: adiciona seleção rápida por Mês e Ano aos filtros de colunas do tipo Data;
   - V40.0.118: transforma o KPI Valor total da Base Consumo em total dinâmico da coluna Montante conforme os filtros ativos.
*/
(() => {
  'use strict';

  if (window.__HAP_V40118_MAINTENANCE_MODE__) return;
  window.__HAP_V40118_MAINTENANCE_MODE__ = true;

  const VERSION = '40.0.118';
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
    if (select.dataset.v40118MaintenancePatched === '1') return;
    select.dataset.v40118MaintenancePatched = '1';

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
    if (select.dataset.v40118MaintenancePatched === '1') return select;
    select.dataset.v40118MaintenancePatched = '1';

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
      if (backdrop.dataset.v40118MaintenanceAporte !== '1') {
        backdrop.dataset.v40118MaintenanceAporte = '1';
      }
      if (next) {
        if (!next.dataset.v40118OriginalText) next.dataset.v40118OriginalText = next.textContent || 'Registrar e planejar agora';
        if (next.textContent !== maintenanceText) next.textContent = maintenanceText;
        if (next.title !== maintenanceTitle) next.title = maintenanceTitle;
      }
      if (later) {
        if (!Object.prototype.hasOwnProperty.call(later.dataset, 'v40118OriginalDisplay')) {
          later.dataset.v40118OriginalDisplay = later.style.display || '';
        }
        if (later.style.display !== 'none') later.style.display = 'none';
      }
      if (kpiOnly) {
        if (!Object.prototype.hasOwnProperty.call(kpiOnly.dataset, 'v40118OriginalDisplay')) {
          kpiOnly.dataset.v40118OriginalDisplay = kpiOnly.style.display || '';
        }
        if (kpiOnly.style.display !== 'none') kpiOnly.style.display = 'none';
      }
      if (note) {
        if (!Object.prototype.hasOwnProperty.call(note.dataset, 'v40118OriginalHtml')) {
          note.dataset.v40118OriginalHtml = note.innerHTML;
        }
        if (note.innerHTML !== maintenanceNote) note.innerHTML = maintenanceNote;
      }
      return;
    }

    if (backdrop.dataset.v40118MaintenanceAporte !== '1') return;
    delete backdrop.dataset.v40118MaintenanceAporte;

    if (next?.dataset.v40118OriginalText) {
      const originalText = next.dataset.v40118OriginalText;
      if (next.textContent !== originalText) next.textContent = originalText;
      if (next.hasAttribute('title')) next.removeAttribute('title');
    }
    if (later && Object.prototype.hasOwnProperty.call(later.dataset, 'v40118OriginalDisplay')) {
      const display = later.dataset.v40118OriginalDisplay || '';
      if (later.style.display !== display) later.style.display = display;
    }
    if (kpiOnly && Object.prototype.hasOwnProperty.call(kpiOnly.dataset, 'v40118OriginalDisplay')) {
      const display = kpiOnly.dataset.v40118OriginalDisplay || '';
      if (kpiOnly.style.display !== display) kpiOnly.style.display = display;
    }
    if (note && Object.prototype.hasOwnProperty.call(note.dataset, 'v40118OriginalHtml')) {
      const originalHtml = note.dataset.v40118OriginalHtml;
      if (note.innerHTML !== originalHtml) note.innerHTML = originalHtml;
    }
  }

  async function refreshOperationalAporteGovernance(backdrop, force=false) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return null;

    const oi = String(oiInput.value || '').replace(/\D/g, '').trim();
    if (!/^\d{8}$/.test(oi)) {
      delete backdrop.dataset.v40118AporteCheckedOi;
      delete backdrop.dataset.v40118AporteGovernanceState;
      setMaintenanceAporteUi(backdrop, false);
      return null;
    }

    if (!force && backdrop.dataset.v40118AporteCheckedOi === oi) {
      const state = backdrop.dataset.v40118AporteGovernanceState;
      if (state === 'maintenance') setMaintenanceAporteUi(backdrop, true);
      else if (state === 'other') setMaintenanceAporteUi(backdrop, false);
      return state || null;
    }

    const seq = String((Number(backdrop.dataset.v40118AporteLookupSeq || 0) + 1));
    backdrop.dataset.v40118AporteLookupSeq = seq;
    try {
      const governance = await getAporteGovernance(oi, force);
      if (backdrop.dataset.v40118AporteLookupSeq !== seq) return governance;
      if (String(oiInput.value || '').replace(/\D/g, '').trim() !== oi) return governance;

      const maintenance = isGovernedMaintenance(governance);
      backdrop.dataset.v40118AporteCheckedOi = oi;
      backdrop.dataset.v40118AporteGovernanceState = maintenance ? 'maintenance' : 'other';
      setMaintenanceAporteUi(backdrop, maintenance);
      return governance;
    } catch (error) {
      if (backdrop.dataset.v40118AporteLookupSeq === seq) {
        delete backdrop.dataset.v40118AporteCheckedOi;
        delete backdrop.dataset.v40118AporteGovernanceState;
      }
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível confirmar governança do aporte da O.I. ${oi}.`, error);
      return null;
    }
  }

  function patchOperationalAporteModal(backdrop) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return;

    if (oiInput.dataset.v40118MaintenanceAporteBound !== '1') {
      oiInput.dataset.v40118MaintenanceAporteBound = '1';
      let timer = null;
      const schedule = () => {
        clearTimeout(timer);
        const currentOi = String(oiInput.value || '').replace(/\D/g, '').trim();
        if (backdrop.dataset.v40118AporteCheckedOi && backdrop.dataset.v40118AporteCheckedOi !== currentOi) {
          delete backdrop.dataset.v40118AporteCheckedOi;
          delete backdrop.dataset.v40118AporteGovernanceState;
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

    if (backdrop.dataset.v40118AporteCheckedOi === currentOi) {
      const state = backdrop.dataset.v40118AporteGovernanceState;
      if (state === 'maintenance') setMaintenanceAporteUi(backdrop, true);
      else if (state === 'other') setMaintenanceAporteUi(backdrop, false);
      return;
    }

    // Uma única consulta por O.I. digitada. O MutationObserver pode revarrer o modal,
    // mas não dispara novas RPCs nem reescreve o DOM quando o estado já foi confirmado.
    if (backdrop.dataset.v40118AporteLookupPending !== currentOi) {
      backdrop.dataset.v40118AporteLookupPending = currentOi;
      void refreshOperationalAporteGovernance(backdrop).finally(() => {
        if (backdrop.dataset.v40118AporteLookupPending === currentOi) {
          delete backdrop.dataset.v40118AporteLookupPending;
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
    button.dataset.v40118AporteBypass = '1';
    button.disabled = false;
    queueMicrotask(() => button.click());
  }

  function installAporteMaintenanceInterceptor() {
    if (window.__HAP_V40118_APORTE_MAINTENANCE_INTERCEPTOR__) return;
    window.__HAP_V40118_APORTE_MAINTENANCE_INTERCEPTOR__ = true;

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('#v36-a-next,#v374-save-later') : null;
      if (!target) return;
      if (target.dataset.v40118AporteBypass === '1') {
        delete target.dataset.v40118AporteBypass;
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
            const isMaintenanceUi = backdrop.dataset.v40118MaintenanceAporte === '1';
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
    if (select.dataset.v40118GovernanceLoaded === token) return;
    select.dataset.v40118GovernanceLoaded = token;

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
      delete select.dataset.v40118GovernanceLoaded;
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
    if (current.__hapV40118MaintenanceWrapped) return true;

    const wrapped = async function(id) {
      const result = await current.apply(this, arguments);
      scheduleEditPatch(id);
      return result;
    };
    wrapped.__hapV40118MaintenanceWrapped = true;
    wrapped.__hapV40118Original = current;
    window.editarOi = wrapped;
    return true;
  }


  // V40.0.118 — a Base Consumo possui dezenas de milhares de lançamentos.
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
    if (current.__hapV40118BaseConsumoFast) return true;

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
    wrapped.__hapV40118BaseConsumoFast = true;
    wrapped.__hapV40118Original = current;
    window.fetchAllRows = wrapped;
    return true;
  }

  function installBaseConsumoImportInvalidation() {
    const current = window.importarArquivoBaseConsumo;
    if (typeof current !== 'function') return false;
    if (current.__hapV40118BaseConsumoInvalidate) return true;

    const wrapped = async function() {
      invalidateBaseConsumoFastCache();
      try {
        return await current.apply(this, arguments);
      } finally {
        invalidateBaseConsumoFastCache();
      }
    };
    wrapped.__hapV40118BaseConsumoInvalidate = true;
    wrapped.__hapV40118Original = current;
    window.importarArquivoBaseConsumo = wrapped;
    return true;
  }

  // V40.0.118 — atalhos de Mês/Ano nos filtros de data do HAP_XF.
  // O núcleo do filtro permanece intocado: os atalhos apenas marcam/desmarcam os
  // mesmos checkboxes de datas já usados pelo filtro estilo Excel e o usuário
  // confirma normalmente pelo botão OK.
  const DATE_FILTER_MONTHS = [
    ['01','Janeiro'],['02','Fevereiro'],['03','Março'],['04','Abril'],
    ['05','Maio'],['06','Junho'],['07','Julho'],['08','Agosto'],
    ['09','Setembro'],['10','Outubro'],['11','Novembro'],['12','Dezembro']
  ];

  function parseFilterDateLabel(value) {
    const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const day = String(match[1]).padStart(2, '0');
    const month = String(match[2]).padStart(2, '0');
    const year = match[3];
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null;
    return { day, month, year };
  }

  function ensureDateFilterStyle() {
    if (document.getElementById('hap-v40118-date-month-year-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v40118-date-month-year-style';
    style.textContent = `
      .hap-v40118-date-quick{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:6px 0 7px;padding:8px;background:#f7f9fc;border:1px solid #d9e0e9;border-radius:7px}
      .hap-v40118-date-quick label{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:10px;font-weight:800;color:#5a6882;text-transform:uppercase;letter-spacing:.03em}
      .hap-v40118-date-quick select{width:100%;min-width:0;padding:7px 8px;border:1px solid #cbd5e3;border-radius:6px;background:#fff;color:#1a2233;font:12px 'Segoe UI',Arial,sans-serif;text-transform:none;letter-spacing:0}
      @media(max-width:520px){.hap-v40118-date-quick{grid-template-columns:1fr}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function decorateDateFilterMenu(menu) {
    if (!menu || menu.dataset.v40118MonthYear === '1') return false;
    const condition = menu.querySelector('select[data-cond]');
    const dateInput = menu.querySelector('input[data-a][type="date"]');
    const search = menu.querySelector('.hap-xf-search');
    const list = menu.querySelector('.hap-xf-list');
    if (!condition || !dateInput || !search || !list) return false;

    const rows = Array.from(menu.querySelectorAll('[data-item]'));
    const parsedRows = rows.map(row => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      const label = row.querySelector('span')?.textContent || '';
      return { row, checkbox, parts: parseFilterDateLabel(label) };
    }).filter(item => item.checkbox && item.parts);
    if (!parsedRows.length) return false;

    ensureDateFilterStyle();
    const years = [...new Set(parsedRows.map(item => item.parts.year))].sort((a,b) => Number(b) - Number(a));
    const block = document.createElement('div');
    block.className = 'hap-v40118-date-quick';
    block.innerHTML = `
      <label>Mês
        <select data-v40118-month>
          <option value="">Todos os meses</option>
          ${DATE_FILTER_MONTHS.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>
      </label>
      <label>Ano
        <select data-v40118-year>
          <option value="">Todos os anos</option>
          ${years.map(year => `<option value="${year}">${year}</option>`).join('')}
        </select>
      </label>`;
    search.parentNode.insertBefore(block, search);

    const monthSelect = block.querySelector('[data-v40118-month]');
    const yearSelect = block.querySelector('[data-v40118-year]');

    const applyMonthYear = () => {
      if (search.value) {
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles:true }));
      }

      // O atalho Mês/Ano substitui qualquer condição de data exata anterior
      // para evitar a combinação acidental de dois filtros incompatíveis.
      condition.value = '';
      condition.dispatchEvent(new Event('change', { bubbles:true }));
      const dateA = menu.querySelector('input[data-a]');
      const dateB = menu.querySelector('input[data-b]');
      if (dateA) dateA.value = '';
      if (dateB) dateB.value = '';

      const month = monthSelect.value;
      const year = yearSelect.value;
      const quickActive = !!month || !!year;
      rows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        const parts = parseFilterDateLabel(row.querySelector('span')?.textContent || '');
        checkbox.checked = !quickActive || (!!parts && (!month || parts.month === month) && (!year || parts.year === year));
      });
      const first = rows.find(row => row.querySelector('input[type="checkbox"]'))?.querySelector('input[type="checkbox"]');
      if (first) first.dispatchEvent(new Event('change', { bubbles:true }));
    };

    monthSelect.addEventListener('change', applyMonthYear);
    yearSelect.addEventListener('change', applyMonthYear);
    menu.dataset.v40118MonthYear = '1';
    return true;
  }

  function decorateDateFilterMenus() {
    document.querySelectorAll('.hap-xf-menu').forEach(decorateDateFilterMenu);
  }

  // V40.0.118 — total dinâmico da coluna Montante na Base Consumo.
  // O total é calculado sobre TODA a fotografia atual, não apenas sobre a página
  // visível. Quando houver filtro, reutiliza a mesma base completa/cache acelerado
  // já usado pelos filtros para evitar novas cargas sequenciais de ~62 mil linhas.
  let baseConsumoDynamicTotalTimer = null;
  let baseConsumoDynamicTotalSeq = 0;

  function brlDynamic(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  function getBaseConsumoTotalCard() {
    try {
      if (String(state?.tab || '') !== 'base_consumo') return null;
    } catch (_) { return null; }
    return Array.from(document.querySelectorAll('.kpi-card')).find(card =>
      String(card.querySelector('.label')?.textContent || '').trim().toLocaleLowerCase('pt-BR') === 'valor total'
    ) || null;
  }

  async function updateBaseConsumoDynamicTotal() {
    const card = getBaseConsumoTotalCard();
    if (!card) return;
    const valueEl = card.querySelector('.value');
    if (!valueEl) return;

    let sub = card.querySelector('.v40118-consumo-total-sub');
    if (!sub) {
      sub = document.createElement('div');
      sub.className = 'sub v40118-consumo-total-sub';
      card.appendChild(sub);
    }

    const xf = window.HAP_XF;
    const active = !!xf?.hasActive?.('control-consumo');
    if (!active) {
      let total = 0;
      try { total = Number(state?.consumoResumo?.valor_total || 0); } catch (_) {}
      const formatted = brlDynamic(total);
      if (valueEl.textContent !== formatted) valueEl.textContent = formatted;
      const text = 'Total da coluna Montante · atualiza conforme os filtros';
      if (sub.textContent !== text) sub.textContent = text;
      return;
    }

    const seq = ++baseConsumoDynamicTotalSeq;
    if (sub.textContent !== 'Calculando total dos filtros…') sub.textContent = 'Calculando total dos filtros…';
    try {
      const loaded = await loadBaseConsumoFast('data_lancamento', false);
      if (seq !== baseConsumoDynamicTotalSeq || !getBaseConsumoTotalCard()) return;
      if (loaded?.error || !Array.isArray(loaded?.data)) throw loaded?.error || new Error('Base Consumo indisponível.');
      const filtered = xf?.apply ? xf.apply('control-consumo', loaded.data) : loaded.data;
      const total = filtered.reduce((sum, row) => sum + (Number(row?.montante) || 0), 0);
      const formatted = brlDynamic(total);
      if (valueEl.textContent !== formatted) valueEl.textContent = formatted;
      const text = `${filtered.length.toLocaleString('pt-BR')} lançamentos no resultado atual`;
      if (sub.textContent !== text) sub.textContent = text;
    } catch (error) {
      console.warn(`[HAPCAPEX ${VERSION}] Falha ao calcular total dinâmico da Base Consumo.`, error);
      if (sub.textContent !== 'Não foi possível recalcular o total agora.') sub.textContent = 'Não foi possível recalcular o total agora.';
    }
  }

  function scheduleBaseConsumoDynamicTotal(delay=80) {
    clearTimeout(baseConsumoDynamicTotalTimer);
    baseConsumoDynamicTotalTimer = setTimeout(() => void updateBaseConsumoDynamicTotal(), delay);
  }

  function installBaseConsumoDynamicTotalBridge() {
    if (window.__HAP_V40118_CONSUMO_DYNAMIC_TOTAL_BRIDGE__) return true;
    const current = window.renderBaseConsumoTab;
    if (typeof current !== 'function') return false;
    const wrapped = function() {
      const result = current.apply(this, arguments);
      scheduleBaseConsumoDynamicTotal(40);
      return result;
    };
    wrapped.__hapV40118DynamicTotalWrapped = true;
    wrapped.__hapV40118Original = current;
    window.renderBaseConsumoTab = wrapped;
    window.__HAP_V40118_CONSUMO_DYNAMIC_TOTAL_BRIDGE__ = true;
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
    if (!currentApply.__hapV40118MaintenanceFilterWrapped) {
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
      wrappedApply.__hapV40118MaintenanceFilterWrapped = true;
      wrappedApply.__hapV40118Original = currentApply;
      window.applyManFilter = wrappedApply;
    }

    const currentClear = window.clearAllManFilters;
    if (typeof currentClear === 'function' && !currentClear.__hapV40118MaintenanceClearWrapped) {
      const wrappedClear = function() {
        try { window.HAP_XF?.clear?.('curve-maintenance', { silent: true }); } catch (_) {}
        return currentClear.apply(this, arguments);
      };
      wrappedClear.__hapV40118MaintenanceClearWrapped = true;
      wrappedClear.__hapV40118Original = currentClear;
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
      installBaseConsumoDynamicTotalBridge();
      decorateDateFilterMenus();
      installMaintenanceFilterBridge();
    });
  });

  function boot() {
    scanNewModalsOnly();
    installAporteMaintenanceInterceptor();
    installBaseConsumoFilterAcceleration();
    installBaseConsumoImportInvalidation();
    installBaseConsumoDynamicTotalBridge();
    decorateDateFilterMenus();
    scheduleBaseConsumoDynamicTotal(0);
    observer.observe(document.body, { childList: true, subtree: true });

    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      wrapEditOi();
      installBaseConsumoFilterAcceleration();
      installBaseConsumoImportInvalidation();
      installBaseConsumoDynamicTotalBridge();
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
        installBaseConsumoDynamicTotalBridge();
        decorateDateFilterMenus();
        scheduleBaseConsumoDynamicTotal(0);
        installMaintenanceFilterBridge();
        installAporteMaintenanceInterceptor();
      }
    };
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
