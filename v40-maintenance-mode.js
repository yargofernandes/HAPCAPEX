/* HAPCAPEX V40.0.120 — Manutenção: governança da O.I. + filtros da Curva.
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
   - V40.0.120: preserva a aceleração dos filtros da Base Consumo com paginação concorrente e cache curto;
   - V40.0.120: adiciona seleção rápida por Mês e Ano aos filtros de colunas do tipo Data;
   - V40.0.120: corrige o total dinâmico da Base Consumo, atualizando após o carregamento/filtro e exibindo também no rodapé da tabela.
   - V40.0.120: torna os filtros Excel cumulativos/cascateados entre colunas da mesma tabela/aba, sem compartilhar filtros entre abas.
*/
(() => {
  'use strict';

  if (window.__HAP_V40120_MAINTENANCE_MODE__) return;
  window.__HAP_V40120_MAINTENANCE_MODE__ = true;

  const VERSION = '40.0.120';
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
    if (select.dataset.v40120MaintenancePatched === '1') return;
    select.dataset.v40120MaintenancePatched = '1';

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
    if (select.dataset.v40120MaintenancePatched === '1') return select;
    select.dataset.v40120MaintenancePatched = '1';

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
      if (backdrop.dataset.v40120MaintenanceAporte !== '1') {
        backdrop.dataset.v40120MaintenanceAporte = '1';
      }
      if (next) {
        if (!next.dataset.v40120OriginalText) next.dataset.v40120OriginalText = next.textContent || 'Registrar e planejar agora';
        if (next.textContent !== maintenanceText) next.textContent = maintenanceText;
        if (next.title !== maintenanceTitle) next.title = maintenanceTitle;
      }
      if (later) {
        if (!Object.prototype.hasOwnProperty.call(later.dataset, 'v40120OriginalDisplay')) {
          later.dataset.v40120OriginalDisplay = later.style.display || '';
        }
        if (later.style.display !== 'none') later.style.display = 'none';
      }
      if (kpiOnly) {
        if (!Object.prototype.hasOwnProperty.call(kpiOnly.dataset, 'v40120OriginalDisplay')) {
          kpiOnly.dataset.v40120OriginalDisplay = kpiOnly.style.display || '';
        }
        if (kpiOnly.style.display !== 'none') kpiOnly.style.display = 'none';
      }
      if (note) {
        if (!Object.prototype.hasOwnProperty.call(note.dataset, 'v40120OriginalHtml')) {
          note.dataset.v40120OriginalHtml = note.innerHTML;
        }
        if (note.innerHTML !== maintenanceNote) note.innerHTML = maintenanceNote;
      }
      return;
    }

    if (backdrop.dataset.v40120MaintenanceAporte !== '1') return;
    delete backdrop.dataset.v40120MaintenanceAporte;

    if (next?.dataset.v40120OriginalText) {
      const originalText = next.dataset.v40120OriginalText;
      if (next.textContent !== originalText) next.textContent = originalText;
      if (next.hasAttribute('title')) next.removeAttribute('title');
    }
    if (later && Object.prototype.hasOwnProperty.call(later.dataset, 'v40120OriginalDisplay')) {
      const display = later.dataset.v40120OriginalDisplay || '';
      if (later.style.display !== display) later.style.display = display;
    }
    if (kpiOnly && Object.prototype.hasOwnProperty.call(kpiOnly.dataset, 'v40120OriginalDisplay')) {
      const display = kpiOnly.dataset.v40120OriginalDisplay || '';
      if (kpiOnly.style.display !== display) kpiOnly.style.display = display;
    }
    if (note && Object.prototype.hasOwnProperty.call(note.dataset, 'v40120OriginalHtml')) {
      const originalHtml = note.dataset.v40120OriginalHtml;
      if (note.innerHTML !== originalHtml) note.innerHTML = originalHtml;
    }
  }

  async function refreshOperationalAporteGovernance(backdrop, force=false) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return null;

    const oi = String(oiInput.value || '').replace(/\D/g, '').trim();
    if (!/^\d{8}$/.test(oi)) {
      delete backdrop.dataset.v40120AporteCheckedOi;
      delete backdrop.dataset.v40120AporteGovernanceState;
      setMaintenanceAporteUi(backdrop, false);
      return null;
    }

    if (!force && backdrop.dataset.v40120AporteCheckedOi === oi) {
      const state = backdrop.dataset.v40120AporteGovernanceState;
      if (state === 'maintenance') setMaintenanceAporteUi(backdrop, true);
      else if (state === 'other') setMaintenanceAporteUi(backdrop, false);
      return state || null;
    }

    const seq = String((Number(backdrop.dataset.v40120AporteLookupSeq || 0) + 1));
    backdrop.dataset.v40120AporteLookupSeq = seq;
    try {
      const governance = await getAporteGovernance(oi, force);
      if (backdrop.dataset.v40120AporteLookupSeq !== seq) return governance;
      if (String(oiInput.value || '').replace(/\D/g, '').trim() !== oi) return governance;

      const maintenance = isGovernedMaintenance(governance);
      backdrop.dataset.v40120AporteCheckedOi = oi;
      backdrop.dataset.v40120AporteGovernanceState = maintenance ? 'maintenance' : 'other';
      setMaintenanceAporteUi(backdrop, maintenance);
      return governance;
    } catch (error) {
      if (backdrop.dataset.v40120AporteLookupSeq === seq) {
        delete backdrop.dataset.v40120AporteCheckedOi;
        delete backdrop.dataset.v40120AporteGovernanceState;
      }
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível confirmar governança do aporte da O.I. ${oi}.`, error);
      return null;
    }
  }

  function patchOperationalAporteModal(backdrop) {
    const box = getOperationalAporteBox(backdrop);
    const oiInput = box?.querySelector('#v36-a-oi');
    if (!box || !oiInput) return;

    if (oiInput.dataset.v40120MaintenanceAporteBound !== '1') {
      oiInput.dataset.v40120MaintenanceAporteBound = '1';
      let timer = null;
      const schedule = () => {
        clearTimeout(timer);
        const currentOi = String(oiInput.value || '').replace(/\D/g, '').trim();
        if (backdrop.dataset.v40120AporteCheckedOi && backdrop.dataset.v40120AporteCheckedOi !== currentOi) {
          delete backdrop.dataset.v40120AporteCheckedOi;
          delete backdrop.dataset.v40120AporteGovernanceState;
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

    if (backdrop.dataset.v40120AporteCheckedOi === currentOi) {
      const state = backdrop.dataset.v40120AporteGovernanceState;
      if (state === 'maintenance') setMaintenanceAporteUi(backdrop, true);
      else if (state === 'other') setMaintenanceAporteUi(backdrop, false);
      return;
    }

    // Uma única consulta por O.I. digitada. O MutationObserver pode revarrer o modal,
    // mas não dispara novas RPCs nem reescreve o DOM quando o estado já foi confirmado.
    if (backdrop.dataset.v40120AporteLookupPending !== currentOi) {
      backdrop.dataset.v40120AporteLookupPending = currentOi;
      void refreshOperationalAporteGovernance(backdrop).finally(() => {
        if (backdrop.dataset.v40120AporteLookupPending === currentOi) {
          delete backdrop.dataset.v40120AporteLookupPending;
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
    button.dataset.v40120AporteBypass = '1';
    button.disabled = false;
    queueMicrotask(() => button.click());
  }

  function installAporteMaintenanceInterceptor() {
    if (window.__HAP_V40120_APORTE_MAINTENANCE_INTERCEPTOR__) return;
    window.__HAP_V40120_APORTE_MAINTENANCE_INTERCEPTOR__ = true;

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('#v36-a-next,#v374-save-later') : null;
      if (!target) return;
      if (target.dataset.v40120AporteBypass === '1') {
        delete target.dataset.v40120AporteBypass;
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
            const isMaintenanceUi = backdrop.dataset.v40120MaintenanceAporte === '1';
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
    if (select.dataset.v40120GovernanceLoaded === token) return;
    select.dataset.v40120GovernanceLoaded = token;

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
      delete select.dataset.v40120GovernanceLoaded;
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
    if (current.__hapV40120MaintenanceWrapped) return true;

    const wrapped = async function(id) {
      const result = await current.apply(this, arguments);
      scheduleEditPatch(id);
      return result;
    };
    wrapped.__hapV40120MaintenanceWrapped = true;
    wrapped.__hapV40120Original = current;
    window.editarOi = wrapped;
    return true;
  }


  // V40.0.120 — a Base Consumo possui dezenas de milhares de lançamentos.
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
    if (current.__hapV40120BaseConsumoFast) return true;

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
    wrapped.__hapV40120BaseConsumoFast = true;
    wrapped.__hapV40120Original = current;
    window.fetchAllRows = wrapped;
    return true;
  }

  function installBaseConsumoImportInvalidation() {
    const current = window.importarArquivoBaseConsumo;
    if (typeof current !== 'function') return false;
    if (current.__hapV40120BaseConsumoInvalidate) return true;

    const wrapped = async function() {
      invalidateBaseConsumoFastCache();
      try {
        return await current.apply(this, arguments);
      } finally {
        invalidateBaseConsumoFastCache();
      }
    };
    wrapped.__hapV40120BaseConsumoInvalidate = true;
    wrapped.__hapV40120Original = current;
    window.importarArquivoBaseConsumo = wrapped;
    return true;
  }

  // V40.0.120 — atalhos de Mês/Ano nos filtros de data do HAP_XF.
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
    if (document.getElementById('hap-v40120-date-month-year-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v40120-date-month-year-style';
    style.textContent = `
      .hap-v40120-date-quick{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:6px 0 7px;padding:8px;background:#f7f9fc;border:1px solid #d9e0e9;border-radius:7px}
      .hap-v40120-date-quick label{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:10px;font-weight:800;color:#5a6882;text-transform:uppercase;letter-spacing:.03em}
      .hap-v40120-date-quick select{width:100%;min-width:0;padding:7px 8px;border:1px solid #cbd5e3;border-radius:6px;background:#fff;color:#1a2233;font:12px 'Segoe UI',Arial,sans-serif;text-transform:none;letter-spacing:0}
      @media(max-width:520px){.hap-v40120-date-quick{grid-template-columns:1fr}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function decorateDateFilterMenu(menu) {
    if (!menu || menu.dataset.v40120MonthYear === '1') return false;
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
    block.className = 'hap-v40120-date-quick';
    block.innerHTML = `
      <label>Mês
        <select data-v40120-month>
          <option value="">Todos os meses</option>
          ${DATE_FILTER_MONTHS.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>
      </label>
      <label>Ano
        <select data-v40120-year>
          <option value="">Todos os anos</option>
          ${years.map(year => `<option value="${year}">${year}</option>`).join('')}
        </select>
      </label>`;
    search.parentNode.insertBefore(block, search);

    const monthSelect = block.querySelector('[data-v40120-month]');
    const yearSelect = block.querySelector('[data-v40120-year]');

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
    menu.dataset.v40120MonthYear = '1';
    return true;
  }

  function decorateDateFilterMenus() {
    document.querySelectorAll('.hap-xf-menu').forEach(decorateDateFilterMenu);
  }

  // V40.0.120 — total dinâmico da coluna Montante na Base Consumo.
  // A V40.0.118 atualizava apenas o KPI e dependia do ciclo de renderização do
  // HAP_XF. Em alguns fluxos o wrapper do filtro era instalado depois e o recálculo
  // podia não acontecer. Agora o recálculo é ligado tanto ao carregamento quanto ao
  // render da aba e também fica visível no rodapé da tabela.
  let baseConsumoDynamicTotalTimer = null;
  let baseConsumoDynamicTotalSeq = 0;

  function brlDynamic(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  function sumBaseConsumoMontante(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
      const value = Number(row?.montante);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  function isBaseConsumoTab() {
    try { return String(state?.tab || '') === 'base_consumo'; }
    catch (_) { return false; }
  }

  function getBaseConsumoTotalCard() {
    if (!isBaseConsumoTab()) return null;
    return Array.from(document.querySelectorAll('.kpi-card')).find(card =>
      String(card.querySelector('.label')?.textContent || '').trim().toLocaleLowerCase('pt-BR') === 'valor total'
    ) || null;
  }

  function getBaseConsumoFooter() {
    if (!isBaseConsumoTab()) return null;
    const tableCard = document.querySelector('.table-card');
    const footer = tableCard?.nextElementSibling;
    return footer && footer.querySelector ? footer : null;
  }

  function ensureBaseConsumoFooterTotal() {
    const footer = getBaseConsumoFooter();
    if (!footer) return null;
    let el = footer.querySelector('[data-v40120-consumo-total]');
    if (el) return el;
    el = document.createElement('span');
    el.dataset.v40120ConsumoTotal = '1';
    el.style.fontWeight = '800';
    el.style.color = 'var(--azul)';
    el.style.marginLeft = '14px';
    el.style.marginRight = 'auto';
    const first = footer.firstElementChild;
    if (first?.nextSibling) footer.insertBefore(el, first.nextSibling);
    else if (first) footer.appendChild(el);
    else footer.prepend(el);
    return el;
  }

  function paintBaseConsumoDynamicTotal({ total, count, active, loading=false, error=false }) {
    const formatted = brlDynamic(total);
    const card = getBaseConsumoTotalCard();
    if (card) {
      const valueEl = card.querySelector('.value');
      if (valueEl && !loading && !error && valueEl.textContent !== formatted) valueEl.textContent = formatted;
      let sub = card.querySelector('.v40120-consumo-total-sub');
      if (!sub) {
        sub = document.createElement('div');
        sub.className = 'sub v40120-consumo-total-sub';
        card.appendChild(sub);
      }
      const text = loading
        ? 'Calculando total dos filtros…'
        : error
          ? 'Não foi possível recalcular o total agora.'
          : active
            ? `${Number(count || 0).toLocaleString('pt-BR')} lançamentos no resultado filtrado`
            : 'Total da coluna Montante';
      if (sub.textContent !== text) sub.textContent = text;
    }

    const footerTotal = ensureBaseConsumoFooterTotal();
    if (footerTotal) {
      const text = loading
        ? 'Total Montante: calculando…'
        : error
          ? 'Total Montante: indisponível'
          : `${active ? 'Total Montante filtrado' : 'Total Montante'}: ${formatted}`;
      if (footerTotal.textContent !== text) footerTotal.textContent = text;
    }
  }

  async function updateBaseConsumoDynamicTotal() {
    if (!isBaseConsumoTab()) return;

    const xf = window.HAP_XF;
    const active = !!xf?.hasActive?.('control-consumo');
    if (!active) {
      let total = 0;
      let count = 0;
      try {
        total = Number(state?.consumoResumo?.valor_total || 0);
        count = Number(state?.consumoTotal || 0);
      } catch (_) {}
      paintBaseConsumoDynamicTotal({ total, count, active:false });
      return;
    }

    const seq = ++baseConsumoDynamicTotalSeq;
    paintBaseConsumoDynamicTotal({ total:0, count:0, active:true, loading:true });
    try {
      const loaded = await loadBaseConsumoFast('data_lancamento', false);
      if (seq !== baseConsumoDynamicTotalSeq || !isBaseConsumoTab()) return;
      if (loaded?.error || !Array.isArray(loaded?.data)) {
        throw loaded?.error || new Error('Base Consumo indisponível.');
      }
      const filtered = xf?.apply ? xf.apply('control-consumo', loaded.data) : loaded.data;
      const total = sumBaseConsumoMontante(filtered);
      paintBaseConsumoDynamicTotal({ total, count:filtered.length, active:true });
    } catch (error) {
      console.warn(`[HAPCAPEX ${VERSION}] Falha ao calcular total dinâmico da Base Consumo.`, error);
      paintBaseConsumoDynamicTotal({ total:0, count:0, active:true, error:true });
    }
  }

  function scheduleBaseConsumoDynamicTotal(delay=80) {
    clearTimeout(baseConsumoDynamicTotalTimer);
    baseConsumoDynamicTotalTimer = setTimeout(() => void updateBaseConsumoDynamicTotal(), delay);
  }

  function installBaseConsumoDynamicTotalBridge() {
    let installed = false;

    const renderCurrent = window.renderBaseConsumoTab;
    if (typeof renderCurrent === 'function' && !renderCurrent.__hapV40120DynamicTotalRenderWrapped) {
      const wrappedRender = function() {
        const result = renderCurrent.apply(this, arguments);
        scheduleBaseConsumoDynamicTotal(60);
        return result;
      };
      wrappedRender.__hapV40120DynamicTotalRenderWrapped = true;
      wrappedRender.__hapV40120Original = renderCurrent;
      window.renderBaseConsumoTab = wrappedRender;
      installed = true;
    }

    const loadCurrent = window.loadBaseConsumoTab;
    if (typeof loadCurrent === 'function' && !loadCurrent.__hapV40120DynamicTotalLoadWrapped) {
      const wrappedLoad = async function() {
        const result = await loadCurrent.apply(this, arguments);
        scheduleBaseConsumoDynamicTotal(0);
        return result;
      };
      wrappedLoad.__hapV40120DynamicTotalLoadWrapped = true;
      wrappedLoad.__hapV40120Original = loadCurrent;
      window.loadBaseConsumoTab = wrappedLoad;
      installed = true;
    }

    return installed ||
      !!window.renderBaseConsumoTab?.__hapV40120DynamicTotalRenderWrapped ||
      !!window.loadBaseConsumoTab?.__hapV40120DynamicTotalLoadWrapped;
  }

  // Fallback adicional: depois de confirmar/limpar filtros, agenda novo cálculo.
  document.addEventListener('click', event => {
    const target = event.target?.closest?.('.hap-xf-menu [data-apply], .hap-xf-unified-clear');
    if (!target) return;
    setTimeout(() => scheduleBaseConsumoDynamicTotal(0), 120);
  }, true);

  // V40.0.120 — filtros cumulativos/cascateados no padrão Excel.
  // Cada conjunto HAP_XF continua isolado pelo seu próprio `id` (aba/tabela),
  // mas a lista de valores de uma coluna considera os filtros já ativos nas
  // OUTRAS colunas daquele mesmo conjunto. Assim, ao abrir novamente uma coluna
  // já filtrada, ela continua mostrando as opções permitidas pelas demais colunas,
  // exatamente como o AutoFiltro do Excel.
  let cumulativeExcelRefreshDone = false;
  const cumulativeShadow = new Map();
  let cumulativeMenuContext = null;
  let cumulativeEventsInstalled = false;

  function cumulativeState(id) {
    const key = String(id || '');
    if (!cumulativeShadow.has(key)) cumulativeShadow.set(key, new Map());
    return cumulativeShadow.get(key);
  }

  function cumulativeNormalizeText(value) {
    return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cumulativeConditionMatch(api, type, value, filter) {
    if (!filter?.op) return true;
    if (type === 'number') {
      const v = api.parseNumber?.(value);
      const a = api.parseNumber?.(filter.a);
      const b = api.parseNumber?.(filter.b);
      if (v === null || v === undefined || a === null || a === undefined) return false;
      if (filter.op === 'eq') return Math.abs(v - a) < 0.0000001;
      if (filter.op === 'neq') return Math.abs(v - a) >= 0.0000001;
      if (filter.op === 'gt') return v > a;
      if (filter.op === 'gte') return v >= a;
      if (filter.op === 'lt') return v < a;
      if (filter.op === 'lte') return v <= a;
      if (filter.op === 'between') return b !== null && b !== undefined && v >= Math.min(a, b) && v <= Math.max(a, b);
      return true;
    }
    if (type === 'date') {
      const v = api.parseDate?.(value);
      const a = api.parseDate?.(filter.a);
      const b = api.parseDate?.(filter.b);
      if (!v || !a) return false;
      if (filter.op === 'eq') return v === a;
      if (filter.op === 'neq') return v !== a;
      if (filter.op === 'gt') return v > a;
      if (filter.op === 'gte') return v >= a;
      if (filter.op === 'lt') return v < a;
      if (filter.op === 'lte') return v <= a;
      if (filter.op === 'between') return !!b && v >= Math.min(a, b) && v <= Math.max(a, b);
      return true;
    }
    return true;
  }

  function cumulativeApplyOtherColumns(api, id, targetKey, rows, columns) {
    const filters = cumulativeState(id);
    if (!filters.size) return [...rows];
    const columnMap = new Map((columns || []).map(col => [String(col?.key || ''), col]));

    return (rows || []).filter(row => {
      for (const [key, filter] of filters.entries()) {
        if (key === String(targetKey || '')) continue;
        const col = columnMap.get(key);
        if (!col) continue;
        let value = null;
        try { value = typeof col.get === 'function' ? col.get(row) : row?.[col.key]; }
        catch (_) { value = null; }
        const type = col.type || 'text';
        if (filter.selected instanceof Set) {
          const canonical = api.canon?.(type, value);
          if (!filter.selected.has(canonical)) return false;
        }
        if (!cumulativeConditionMatch(api, type, value, filter)) return false;
      }
      return true;
    });
  }

  async function cumulativeRowsFor(id, fallbackRows) {
    if (id === 'control-consumo') {
      try {
        const loaded = await loadBaseConsumoFast('data_lancamento', false);
        if (!loaded?.error && Array.isArray(loaded?.data)) return loaded.data;
      } catch (error) {
        console.warn(`[HAPCAPEX ${VERSION}] Não foi possível usar a base completa no filtro cumulativo da Base Consumo.`, error);
      }
    }
    return Array.isArray(fallbackRows) ? fallbackRows : [];
  }

  function cumulativeValuesProvider(originalApi, id, rows, columns) {
    return async function(key, col) {
      const allRows = await cumulativeRowsFor(id, rows);
      const available = cumulativeApplyOtherColumns(originalApi, id, key, allRows, columns);
      const target = col || (columns || []).find(item => item?.key === key);
      if (!target) return [];
      return available.map(row => {
        try {
          return typeof target.get === 'function' ? target.get(row) : row?.[target.key];
        } catch (_) {
          return null;
        }
      });
    };
  }

  function captureCumulativeFilterFromMenu(menu, context) {
    if (!menu || !context?.id || !context?.key) return;
    const store = cumulativeState(context.id);
    const previous = store.get(context.key);
    const search = menu.querySelector('.hap-xf-search');
    const hasQuery = !!cumulativeNormalizeText(search?.value);
    const itemInputs = [...menu.querySelectorAll('[data-item] input[data-value]')];
    const sourceInputs = hasQuery
      ? itemInputs.filter(input => input.closest('[data-item]')?.style.display !== 'none')
      : itemInputs;
    const checked = new Set(sourceInputs.filter(input => input.checked).map(input => {
      try { return decodeURIComponent(input.dataset.value || ''); }
      catch (_) { return input.dataset.value || ''; }
    }));

    const addCurrent = menu.querySelector('[data-add-current]');
    if (hasQuery && addCurrent?.checked && previous?.selected instanceof Set) {
      previous.selected.forEach(value => checked.add(value));
    }

    const allCanon = new Set(itemInputs.map(input => {
      try { return decodeURIComponent(input.dataset.value || ''); }
      catch (_) { return input.dataset.value || ''; }
    }));
    const sameAll = checked.size === allCanon.size && [...allCanon].every(value => checked.has(value));

    const condition = menu.querySelector('[data-cond]');
    const op = condition?.value || '';
    const a = menu.querySelector('[data-a]')?.value || '';
    const b = menu.querySelector('[data-b]')?.value || '';
    const next = { selected: sameAll ? null : checked, op, a, b };

    if (!(next.selected instanceof Set) && !next.op) store.delete(context.key);
    else store.set(context.key, next);
  }

  function installCumulativeMenuEvents() {
    if (cumulativeEventsInstalled) return;
    cumulativeEventsInstalled = true;

    document.addEventListener('click', event => {
      const filterButton = event.target?.closest?.('.hap-xf-btn[data-hap-xf-id][data-key]');
      if (filterButton) {
        cumulativeMenuContext = {
          id: filterButton.dataset.hapXfId || '',
          key: filterButton.dataset.key || ''
        };
        return;
      }

      const menu = event.target?.closest?.('.hap-xf-menu');
      if (!menu || !cumulativeMenuContext) return;
      if (event.target?.closest?.('[data-apply]')) {
        captureCumulativeFilterFromMenu(menu, cumulativeMenuContext);
      } else if (event.target?.closest?.('[data-clear]')) {
        cumulativeState(cumulativeMenuContext.id).delete(cumulativeMenuContext.key);
      }
    }, true);
  }

  function installCumulativeExcelFilters() {
    const current = window.HAP_XF;
    if (!current?.bind || !current?.apply) return false;
    if (current.__hapV40120Cumulative) return true;

    const originalApi = current;
    const originalBind = originalApi.bind.bind(originalApi);
    const originalClear = originalApi.clear?.bind(originalApi);
    const originalClearColumn = originalApi.clearColumn?.bind(originalApi);
    const originalClearPrefix = originalApi.clearPrefix?.bind(originalApi);

    const wrappedBind = function(options = {}) {
      const id = String(options?.id || '');
      const rows = Array.isArray(options?.rows) ? options.rows : [];
      const columns = Array.isArray(options?.columns) ? options.columns : [];
      if (!id || !columns.length) return originalBind(options);

      const next = {
        ...options,
        valuesProvider: cumulativeValuesProvider(originalApi, id, rows, columns)
      };
      const result = originalBind(next);

      // Identifica cada botão com o id do seu conjunto para conseguirmos manter
      // um espelho independente dos filtros por aba/tabela.
      if (options?.table) {
        const table = typeof options.table === 'string' ? document.querySelector(options.table) : options.table;
        columns.forEach(col => {
          const button = table?.querySelector?.(`.hap-xf-btn[data-key="${CSS.escape(String(col.key || ''))}"]`);
          if (button) button.dataset.hapXfId = id;
        });
      }
      return result;
    };

    const wrappedBindDom = function(options = {}) {
      let table = options?.table;
      if (typeof table === 'string') table = document.querySelector(table);
      if (!table) return;
      const body = table.tBodies?.[0];
      if (!body) return;

      const id = String(options?.id || '');
      const domRows = [...body.rows]
        .filter(tr => !tr.querySelector('.empty-state'))
        .map((tr, i) => ({ tr, i }));
      const columns = (options?.columns || []).map(c => ({
        ...c,
        get: row => {
          const text = row?.tr?.cells?.[c.index]?.innerText || '';
          if (c.type === 'number') return originalApi.parseNumber?.(text) ?? text;
          if (c.type === 'date') return originalApi.parseDate?.(text) ?? text;
          return text;
        }
      }));

      const render = () => {
        const visible = originalApi.apply ? originalApi.apply(id, domRows) : domRows;
        const visibleSet = new Set(visible);
        domRows.forEach(row => { row.tr.style.display = visibleSet.has(row) ? '' : 'none'; });
        visible.forEach(row => body.appendChild(row.tr));

        const countTarget = typeof options?.countEl === 'string'
          ? document.querySelector(options.countEl)
          : options?.countEl;
        if (countTarget) countTarget.textContent = `${visible.length} de ${domRows.length}`;
        if (options?.summaryEl) originalApi.mountSummary?.(options.summaryEl, id);

        wrappedBind({ id, table, rows: domRows, columns, onChange: render });
      };
      render();
    };

    const wrappedClear = function(id, options) {
      cumulativeState(id).clear();
      return originalClear ? originalClear(id, options) : undefined;
    };
    const wrappedClearColumn = function(id, key, options) {
      cumulativeState(id).delete(String(key || ''));
      return originalClearColumn ? originalClearColumn(id, key, options) : undefined;
    };
    const wrappedClearPrefix = function(prefix, options) {
      const pfx = String(prefix || '');
      [...cumulativeShadow.keys()].forEach(id => {
        if (id.startsWith(pfx)) cumulativeShadow.get(id)?.clear();
      });
      return originalClearPrefix ? originalClearPrefix(prefix, options) : undefined;
    };

    const wrappedApi = Object.freeze({
      ...originalApi,
      bind: wrappedBind,
      bindDom: wrappedBindDom,
      clear: wrappedClear,
      clearColumn: wrappedClearColumn,
      clearPrefix: wrappedClearPrefix,
      __hapV40120Cumulative: true,
      cumulativeVersion: VERSION
    });
    window.HAP_XF = wrappedApi;
    installCumulativeMenuEvents();

    if (!cumulativeExcelRefreshDone) {
      cumulativeExcelRefreshDone = true;
      setTimeout(() => {
        try {
          const tab = String(state?.tab || '');
          if (tab === 'base_consumo') window.renderBaseConsumoTab?.();
          else if (tab === 'base_oi') window.renderBaseOiTab?.();
          else if (tab === 'transferencias') window.renderTransferenciasTab?.();
          else if (tab === 'capex') window.renderCapexTab?.();
        } catch (_) {}
        try { window.applyFilter?.(); } catch (_) {}
        try { window.applyManFilter?.(); } catch (_) {}
        try { window.renderContent?.(); } catch (_) {}
      }, 0);
    }

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
    if (!currentApply.__hapV40120MaintenanceFilterWrapped) {
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
      wrappedApply.__hapV40120MaintenanceFilterWrapped = true;
      wrappedApply.__hapV40120Original = currentApply;
      window.applyManFilter = wrappedApply;
    }

    const currentClear = window.clearAllManFilters;
    if (typeof currentClear === 'function' && !currentClear.__hapV40120MaintenanceClearWrapped) {
      const wrappedClear = function() {
        try { window.HAP_XF?.clear?.('curve-maintenance', { silent: true }); } catch (_) {}
        return currentClear.apply(this, arguments);
      };
      wrappedClear.__hapV40120MaintenanceClearWrapped = true;
      wrappedClear.__hapV40120Original = currentClear;
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
      installCumulativeExcelFilters();
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
    installCumulativeExcelFilters();
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
      installCumulativeExcelFilters();
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
        installCumulativeExcelFilters();
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
