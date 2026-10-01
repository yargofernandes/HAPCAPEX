/* HAPCAPEX V40.0.126 — Aporte Extra consolidado em pacote da Curva
   Regras:
   - preserva o fluxo V40.0.52 para aportes pendentes já consolidados;
   - no planejamento de um NOVO aporte operacional, permite escolher "Consolidar em pacote existente";
   - o aporte aumenta o Montante/Saldo da O.I. no Controle e o CAPEX do pacote na Curva;
   - a O.I. NÃO vira uma obra separada na Curva;
   - o aporte entra no KPI/histórico de Aportes Extras e fica auditado no backend.
*/
(() => {
  'use strict';

  if (window.__HAP_V40126_PACKAGE_APORTE_KPI__) return;
  window.__HAP_V40126_PACKAGE_APORTE_KPI__ = true;
  // Compatibilidade com referências antigas do módulo V40.0.52.
  window.__HAP_V40052_PACKAGE_APORTE_KPI__ = true;

  const VERSION = '40.0.126';
  const operationalDrafts = new Map();
  let packageCache = null;
  let packagePromise = null;
  let captureInstalled = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function norm(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style:'currency', currency:'BRL',
      minimumFractionDigits:2, maximumFractionDigits:2
    });
  }

  function isAdmin() {
    try {
      if (typeof state !== 'undefined' && state?.role) return state.role === 'admin';
    } catch (_) {}
    try {
      if (typeof currentProfile !== 'undefined' && currentProfile) return currentProfile.role === 'admin';
    } catch (_) {}
    try {
      if (window.HAP_DATA?.currentProfile?.role) return window.HAP_DATA.currentProfile.role === 'admin';
      if (window.HAP_V35?.profile?.role) return window.HAP_V35.profile.role === 'admin';
    } catch (_) {}
    return false;
  }

  function readOperationalDraft(box) {
    if (!box) return null;
    const oi = String(box.querySelector('#v36-a-oi')?.value || '').replace(/\D/g,'').trim();
    const value = Number(box.querySelector('#v36-a-valor')?.value || 0);
    const mes = String(box.querySelector('#v36-a-mes')?.value || '').trim();
    const name = String(box.querySelector('#v36-a-nome')?.value || '').trim();
    const obs = String(box.querySelector('#v36-a-obs')?.value || '').trim();
    if (!/^\d{8}$/.test(oi) || !Number.isFinite(value) || value <= 0 || !/^\d{4}-\d{2}$/.test(mes)) return null;
    return { oi, value, mes, name, obs, capturedAt: Date.now() };
  }

  function scheduleDecorate() {
    [0, 80, 250, 700, 1500].forEach(delay => {
      setTimeout(() => {
        try { decorate(document); } catch (err) {
          console.warn(`[HAPCAPEX ${VERSION}] Falha ao reaplicar opção de pacote`, err);
        }
      }, delay);
    });
  }

  function installPlanNowCapture() {
    if (captureInstalled) return;
    captureInstalled = true;
    document.addEventListener('click', event => {
      const operationalButton = event.target?.closest?.('#v36-a-next');
      if (operationalButton) {
        const box = operationalButton.closest('.modal-box');
        if (box && norm(box.querySelector('h2')?.textContent) === 'REGISTRAR APORTE OPERACIONAL') {
          const draft = readOperationalDraft(box);
          if (draft) {
            operationalDrafts.set(draft.oi, draft);
            window.__HAP_V40126_LAST_APORTE_DRAFT__ = draft;
            window.__HAP_V40126_LAST_PENDING_MOVEMENT__ = null;
            // O planejamento é aberto após chamadas assíncronas. Além do observer,
            // reaplica a decoração em janelas progressivas para eliminar condição de corrida.
            scheduleDecorate();
          }
        }
      }

      const pendingButton = event.target?.closest?.('.v36-plan-pending[data-id],.v36-plan-mov[data-id]');
      if (pendingButton?.dataset?.id) {
        const row = pendingButton.closest('.v36-queue-item,.v36-movement-row');
        const oi = String(row?.textContent || '').match(/\b\d{8}\b/)?.[0] || null;
        window.__HAP_V40126_LAST_PENDING_MOVEMENT__ = {
          id: pendingButton.dataset.id,
          oi,
          capturedAt: Date.now()
        };
        window.__HAP_V40126_LAST_APORTE_DRAFT__ = null;
        scheduleDecorate();
      }
    }, true);
  }

  async function listPackages(force=false) {
    if (!force && Array.isArray(packageCache)) return packageCache;
    if (!force && packagePromise) return packagePromise;
    packagePromise = (async () => {
      if (typeof sb === 'undefined') throw new Error('Supabase indisponível.');
      const { data, error } = await sb.rpc('listar_pacotes_curva_v4027');
      if (error) throw error;
      packageCache = Array.isArray(data) ? data.filter(p => p?.active !== false) : [];
      return packageCache;
    })().finally(() => { packagePromise = null; });
    return packagePromise;
  }

  async function refreshAfterPackageAporte() {
    try {
      if (window.HAP_V36 && typeof window.HAP_V36 === 'object') window.HAP_V36.loading = null;
    } catch (_) {}
    if (typeof refreshCurrent === 'function') {
      await refreshCurrent();
      return;
    }
    window.location.reload();
  }

  function planningTable() {
    return [...document.querySelectorAll('.table-card table')].find(table => {
      const text = String(table.tHead?.textContent || '').toUpperCase();
      return text.includes('O.I.') &&
             text.includes('APORTES PENDENTES') &&
             text.includes('CURVA') &&
             text.includes('AÇÕES');
    }) || null;
  }

  function getRowOi(row) {
    return String(row?.cells?.[0]?.textContent || '')
      .replace(/[^\d]/g, '')
      .trim();
  }

  function getPendingValue(row) {
    const text = String(row?.cells?.[4]?.textContent || '');
    const m = text.match(/R\$\s*([\d.]+,\d{2})/i);
    if (!m) return null;
    const n = Number(m[1].replace(/\./g,'').replace(',','.'));
    return Number.isFinite(n) ? n : null;
  }

  function getPackageName(row) {
    const workCell = row?.cells?.[1];
    if (!workCell) return '';
    const small = workCell.querySelector('small');
    if (small) {
      return String(small.textContent || '')
        .replace(/^Destino:\s*/i,'')
        .trim();
    }
    return '';
  }

  function isPackagePendingRow(row) {
    if (!row?.cells?.length) return false;
    const reason = String(row.cells[2]?.textContent || '').toUpperCase();
    return reason.includes('APORTE') && reason.includes('PACOTE');
  }

  async function registerKpiOnly(button, row) {
    if (!isAdmin()) return;

    const oi = getRowOi(row);
    const value = getPendingValue(row);
    const packageName = getPackageName(row) || 'pacote selecionado';

    if (!oi) {
      alert('Não foi possível identificar a O.I. desta linha.');
      return;
    }

    const valueText = value === null ? 'o aporte pendente' : money(value);

    const ok = window.confirm(
      `Registrar ${valueText} da O.I. ${oi} no KPI de Aportes Extras?\n\n` +
      `Destino: ${packageName}\n\n` +
      'Use esta opção SOMENTE quando o valor já estiver incorporado ao CAPEX do pacote.\n\n' +
      'Esta ação NÃO aumentará o CAPEX do pacote. Ela apenas registrará o aporte ' +
      'no KPI/histórico da Curva e encerrará a pendência.'
    );

    if (!ok) return;

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Registrando...';

    try {
      if (typeof sb === 'undefined') throw new Error('Supabase indisponível.');

      const { data, error } = await sb.rpc(
        'registrar_aporte_pacote_kpi_v4052',
        { p_ordem_interna: oi }
      );

      if (error) throw error;

      const result = data || {};
      const amount = Number(result.valor_kpi || value || 0);

      alert(
        `Aporte registrado no KPI com sucesso.\n\n` +
        `O.I.: ${oi}\n` +
        `Valor no KPI: ${money(amount)}\n` +
        `Pacote: ${result.pacote_nome || packageName}\n\n` +
        `CAPEX do pacote preservado: ${money(result.capex_pacote_preservado || 0)}`
      );

      const planningNav = [...document.querySelectorAll('.nav-pill')]
        .find(el => String(el.textContent || '').toUpperCase().includes('OBRAS A PLANEJAR'));

      if (planningNav) planningNav.click();
      else if (typeof refreshCurrent === 'function') await refreshCurrent();
      else window.location.reload();
    } catch (err) {
      console.error(`[HAPCAPEX ${VERSION}] Falha ao registrar aporte de pacote no KPI`, err);
      alert(
        'Não foi possível registrar o aporte no KPI.\n\n' +
        (err?.message || String(err))
      );
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function setDisplay(el, visible) {
    if (!el) return;
    if (el.dataset.v40125OriginalDisplay === undefined) {
      el.dataset.v40125OriginalDisplay = el.style.display || '';
    }
    el.style.display = visible ? el.dataset.v40125OriginalDisplay : 'none';
  }

  function readPlanningOi(box) {
    const card = [...box.querySelectorAll('.v36-plan-card')].find(card =>
      norm(card.querySelector('span')?.textContent) === 'OI'
    );
    return String(card?.querySelector('strong')?.textContent || '').replace(/\D/g,'').trim();
  }

  function isNewAportePlanning(box) {
    if (!box) return false;
    if (norm(box.querySelector('h2')?.textContent) !== 'PLANEJAMENTO NA CURVA DE CAPEX') return false;
    const sub = norm(box.querySelector('p.sub')?.textContent);
    if (!sub.includes('APORTE')) return false;
    const status = [...box.querySelectorAll('.v36-status-pill')].some(el =>
      norm(el.textContent).includes('NOVA OBRA NA CURVA')
    );
    return status;
  }

  function parseMoneyText(value) {
    const text = String(value || '').replace(/[^0-9,.-]/g,'').trim();
    if (!text) return 0;
    const normalized = text.includes(',')
      ? text.replace(/\./g,'').replace(',','.')
      : text;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function readPlanningValue(box) {
    const card = [...box.querySelectorAll('.v36-plan-card')].find(card =>
      norm(card.querySelector('span')?.textContent).includes('APORTE')
    );
    return parseMoneyText(card?.querySelector('strong')?.textContent || '');
  }

  async function resolvePlanningSource(box) {
    const oi = readPlanningOi(box);
    const value = readPlanningValue(box);
    if (!/^\d{8}$/.test(oi) || !(value > 0)) return null;

    const draft = operationalDrafts.get(oi) ||
      ((window.__HAP_V40126_LAST_APORTE_DRAFT__?.oi === oi)
        ? window.__HAP_V40126_LAST_APORTE_DRAFT__ : null);
    if (draft && Date.now() - draft.capturedAt <= 15 * 60 * 1000) {
      return { source:'new', oi, value:draft.value, draft };
    }

    const pending = window.__HAP_V40126_LAST_PENDING_MOVEMENT__;
    if (pending?.id && Date.now() - Number(pending.capturedAt || 0) <= 15 * 60 * 1000 && (!pending.oi || pending.oi === oi)) {
      return { source:'pending', oi, value, movementId:pending.id };
    }

    // Fallback seguro para refresh/reabertura: localiza um único aporte pendente
    // pela O.I. e valor exibidos no próprio modal. Nunca cria um novo aporte aqui.
    try {
      if (typeof sb === 'undefined') return null;
      const { data, error } = await sb.rpc('localizar_aporte_pendente_v40126', {
        p_ordem_interna: oi,
        p_valor: value
      });
      if (error) throw error;
      if (data?.encontrado && data?.movimento_id) {
        return { source:'pending', oi, value:Number(data.valor || value), movementId:data.movimento_id, pending:data };
      }
      if (data?.ambiguo) {
        return { source:'ambiguous', oi, value, message:data.mensagem || 'Há mais de um aporte pendente compatível.' };
      }
    } catch (err) {
      console.warn(`[HAPCAPEX ${VERSION}] Não foi possível localizar aporte pendente`, err);
    }
    return null;
  }

  function renderPackageCapexSummary(box, pkg, aporteValue, packageMode) {
    const cards = [...box.querySelectorAll('.v36-plan-card')];
    const target = cards[2];
    if (!target) return;
    const label = target.querySelector('span');
    const strong = target.querySelector('strong');
    if (!label || !strong) return;
    if (target.dataset.v40125OriginalLabel === undefined) {
      target.dataset.v40125OriginalLabel = label.textContent || '';
      target.dataset.v40125OriginalValue = strong.textContent || '';
    }
    if (!packageMode || !pkg) {
      label.textContent = target.dataset.v40125OriginalLabel;
      strong.textContent = target.dataset.v40125OriginalValue;
      return;
    }
    const before = Number(pkg.capex_atual || 0);
    label.textContent = 'CAPEX do pacote';
    strong.textContent = `${money(before)} → ${money(before + Number(aporteValue || 0))}`;
  }

  async function applyPackageMode(backdrop, box, panel) {
    const errorBox = box.querySelector('#v36-plan-error');
    const select = panel.querySelector('#v40125-package-select');
    const confirm = panel.querySelector('#v40125-package-confirm');
    const save = box.querySelector('#v36-p-save');
    const context = panel.__hapPackageContext || await resolvePlanningSource(box);

    if (!context || context.source === 'ambiguous') {
      if (errorBox) errorBox.innerHTML = `<div class="error-msg">${esc(context?.message || 'Não foi possível identificar com segurança a origem deste aporte. Volte e abra novamente o aporte.')}</div>`;
      return;
    }
    if (!select?.value) {
      if (errorBox) errorBox.innerHTML = '<div class="error-msg">Selecione o pacote da Curva.</div>';
      return;
    }
    if (!confirm?.checked) {
      if (errorBox) errorBox.innerHTML = '<div class="error-msg">Confirme que esta O.I. deve ser consolidada no pacote e não criada como obra individual.</div>';
      return;
    }

    const packages = await listPackages();
    const pkg = packages.find(p => String(p.id) === String(select.value));
    if (!pkg) {
      if (errorBox) errorBox.innerHTML = '<div class="error-msg">Pacote selecionado não está mais disponível.</div>';
      return;
    }

    const planningName = String(box.querySelector('#v36-p-name')?.value || context.draft?.name || context.pending?.nome || '').trim();
    const alreadyInControl = context.source === 'pending';
    const ok = window.confirm(
      `Consolidar este aporte no pacote da Curva?\n\n` +
      `O.I.: ${context.oi}\n` +
      `Obra: ${planningName || '—'}\n` +
      `Valor: ${money(context.value)}\n` +
      `Pacote: ${pkg.nome_curva || pkg.nome || '—'}\n\n` +
      `O que será feito:\n` +
      (alreadyInControl
        ? `• o aporte já registrado no Controle será preservado, sem somar o valor novamente;\n`
        : `• o Montante e o Saldo da O.I. serão aumentados no Controle;\n`) +
      `• o CAPEX do pacote receberá ${money(context.value)};\n` +
      `• o aporte entrará no KPI/histórico de Aportes Extras;\n` +
      `• a O.I. será marcada como participante do pacote;\n` +
      `• NÃO será criada uma obra individual na Curva.`
    );
    if (!ok) return;

    const oldText = save?.textContent || 'Confirmar e aplicar';
    if (save) {
      save.disabled = true;
      save.textContent = 'Consolidando no pacote...';
    }

    try {
      let response;
      if (context.source === 'pending') {
        response = await sb.rpc('aplicar_aporte_pendente_pacote_v40126', {
          p_movimento_id: context.movementId,
          p_pacote_destino_id: pkg.id
        });
      } else {
        const draft = context.draft;
        response = await sb.rpc('registrar_aporte_operacional_pacote_v40124', {
          p_ordem_interna: draft.oi,
          p_valor: draft.value,
          p_mes: draft.mes,
          p_nome: draft.name || null,
          p_observacao: draft.obs || null,
          p_pacote_destino_id: pkg.id
        });
      }
      if (response.error) throw response.error;
      const data = response.data || {};

      operationalDrafts.delete(context.oi);
      window.__HAP_V40126_LAST_APORTE_DRAFT__ = null;
      window.__HAP_V40126_LAST_PENDING_MOVEMENT__ = null;
      backdrop.remove();
      await refreshAfterPackageAporte();

      window.alert(
        `Aporte consolidado no pacote com sucesso.\n\n` +
        `O.I.: ${context.oi}\n` +
        `Valor: ${money(data.valor_aporte || context.value)}\n` +
        `Pacote: ${data.pacote_nome || pkg.nome_curva || pkg.nome || '—'}\n` +
        `CAPEX do pacote: ${money(data.curva_capex_antes || pkg.capex_atual || 0)} → ${money(data.curva_capex_depois || (Number(pkg.capex_atual || 0) + context.value))}\n\n` +
        (alreadyInControl ? `O valor do Controle não foi somado novamente.\n` : '') +
        `Nenhuma obra individual foi criada na Curva.`
      );
    } catch (err) {
      console.error(`[HAPCAPEX ${VERSION}] Falha ao consolidar aporte no pacote`, err);
      if (save) {
        save.disabled = false;
        save.textContent = oldText;
      }
      if (errorBox) errorBox.innerHTML = `<div class="error-msg">${esc(err?.message || String(err))}</div>`;
    }
  }

  async function decoratePlanningModal(backdrop) {
    const box = backdrop?.querySelector('.modal-box');
    if (!isNewAportePlanning(box) || box.dataset.v40125PackageChoice === '1' || !isAdmin()) return;

    const context = await resolvePlanningSource(box);
    if (!context) return;

    const errorBox = box.querySelector('#v36-plan-error');
    if (context.source === 'ambiguous') {
      if (errorBox) errorBox.innerHTML = `<div class="error-msg">${esc(context.message)}</div>`;
      return;
    }

    box.dataset.v40125PackageChoice = '1';

    const panel = document.createElement('div');
    panel.className = 'v40125-package-panel';
    panel.__hapPackageContext = context;
    panel.innerHTML = `
      <div class="v40125-title">Destino na Curva</div>
      <div class="v40125-choice-row">
        <label class="v40125-choice active" data-mode="individual">
          <input type="radio" name="v40125-destino" value="individual" checked>
          <span><strong>Obra individual</strong><small>Cria esta O.I. como uma linha própria na Curva.</small></span>
        </label>
        <label class="v40125-choice" data-mode="pacote">
          <input type="radio" name="v40125-destino" value="pacote">
          <span><strong>Consolidar em pacote existente</strong><small>O aporte entra no pacote e esta O.I. não vira uma obra separada.</small></span>
        </label>
      </div>
      <div class="v40125-package-fields" style="display:none">
        <div class="field">
          <label>Pacote de destino *</label>
          <select id="v40125-package-select"><option value="">Carregando pacotes...</option></select>
          <div id="v40125-package-hint" class="v40125-hint"></div>
        </div>
        <label class="v40125-confirm">
          <input type="checkbox" id="v40125-package-confirm">
          <span>Confirmo que esta O.I. faz parte do pacote selecionado e <strong>não deve ser criada como obra individual</strong> na Curva.</span>
        </label>
      </div>
    `;
    (errorBox?.parentElement || box).insertBefore(panel, errorBox || null);

    const nameField = box.querySelector('#v36-p-name')?.closest('.field');
    const dateGrid = box.querySelector('#v36-p-start')?.closest('.grid-2');
    const ruleGrid = box.querySelector('#v36-p-type')?.closest('.grid-2');
    const monthWrap = box.querySelector('#v36-p-month-wrap');
    const normalConfirm = box.querySelector('#v36-p-confirm')?.closest('.v36-confirm');
    const save = box.querySelector('#v36-p-save');
    const select = panel.querySelector('#v40125-package-select');
    const hint = panel.querySelector('#v40125-package-hint');
    const packageFields = panel.querySelector('.v40125-package-fields');

    let packages = [];
    try {
      packages = await listPackages();
      select.innerHTML = packages.length
        ? packages.map(p => `<option value="${esc(p.id)}">${esc(p.nome || p.nome_curva || 'Pacote')}</option>`).join('')
        : '<option value="">Nenhum pacote ativo encontrado</option>';
    } catch (err) {
      select.innerHTML = '<option value="">Falha ao carregar pacotes</option>';
      hint.textContent = err?.message || String(err);
      hint.style.color = 'var(--vermelho)';
    }

    const currentPkg = () => packages.find(p => String(p.id) === String(select.value));

    const updateHint = () => {
      const pkg = currentPkg();
      if (!pkg) {
        hint.textContent = '';
        return;
      }
      const prefix = context.source === 'pending'
        ? 'Aporte já registrado no Controle · '
        : '';
      hint.textContent = `${prefix}${pkg.nome_curva || pkg.nome || 'Pacote'} · CAPEX atual: ${money(pkg.capex_atual || 0)} · após este aporte: ${money(Number(pkg.capex_atual || 0) + context.value)}`;
    };

    const setMode = mode => {
      const packageMode = mode === 'pacote';
      box.dataset.v40125PackageMode = packageMode ? '1' : '0';
      panel.querySelectorAll('.v40125-choice').forEach(label =>
        label.classList.toggle('active', label.dataset.mode === mode)
      );
      packageFields.style.display = packageMode ? 'block' : 'none';
      [nameField, dateGrid, ruleGrid, monthWrap, normalConfirm].forEach(el => setDisplay(el, !packageMode));
      if (save) save.textContent = packageMode ? 'Consolidar aporte no pacote' : 'Confirmar e aplicar';
      renderPackageCapexSummary(box, currentPkg(), context.value, packageMode);
      if (packageMode) updateHint();
      if (errorBox) errorBox.innerHTML = '';
    };

    panel.querySelectorAll('input[name="v40125-destino"]').forEach(input => {
      input.addEventListener('change', () => setMode(input.value));
    });
    select.addEventListener('change', () => {
      updateHint();
      if (box.dataset.v40125PackageMode === '1') renderPackageCapexSummary(box, currentPkg(), context.value, true);
    });
    updateHint();

    if (save) {
      save.addEventListener('click', event => {
        if (box.dataset.v40125PackageMode !== '1') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void applyPackageMode(backdrop, box, panel);
      }, true);
    }
  }

  function decoratePlanningTable() {
    const table = planningTable();
    if (!table || !isAdmin()) return;

    [...(table.tBodies?.[0]?.rows || [])].forEach(row => {
      if (!isPackagePendingRow(row)) return;

      const actionCell = row.cells[row.cells.length - 1];
      if (!actionCell) return;

      const actions = actionCell.querySelector('.v4023-plan-actions') || actionCell;

      if (actions.querySelector('[data-v4052-package-kpi]')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary';
      button.dataset.v4052PackageKpi = '1';
      button.textContent = 'Registrar no KPI';
      button.title =
        'Registra o aporte no KPI/histórico sem somar novamente ao CAPEX do pacote.';

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void registerKpiOnly(button, row);
      });

      const existing = actions.querySelector('.v4023-open-aportes');
      if (existing) existing.insertAdjacentElement('afterend', button);
      else actions.prepend(button);
    });

    const note = document.querySelector('.v4023-plan-note');
    if (note && !document.getElementById('v4052-package-kpi-note')) {
      const extra = document.createElement('div');
      extra.id = 'v4052-package-kpi-note';
      extra.style.cssText =
        'margin-top:7px;padding-top:7px;border-top:1px solid #c7d8ee;' +
        'font-size:9.5px;line-height:1.45;';
      extra.innerHTML =
        '<strong>Aporte consolidado em pacote:</strong> quando o CAPEX já tiver sido ' +
        'incorporado ao pacote, use <strong>Registrar no KPI</strong>. O valor entra no ' +
        'histórico de Aportes Extras sem ser somado novamente ao CAPEX do pacote.';
      note.appendChild(extra);
    }
  }

  function ensureStyle() {
    if (document.getElementById('hap-v40125-package-choice-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v40125-package-choice-style';
    style.textContent = `
      .v40125-package-panel{margin:10px 0 14px;padding:12px;border:1px solid #c9d8eb;background:#f7faff;border-radius:10px}
      .v40125-title{font-size:10px;font-weight:900;color:#173a64;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
      .v40125-choice-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .v40125-choice{display:flex;align-items:flex-start;gap:8px;border:1px solid #d8e1ed;background:#fff;border-radius:9px;padding:10px;cursor:pointer}
      .v40125-choice.active{border:2px solid #1a4b8c;background:#edf4fd;padding:9px}
      .v40125-choice input{margin-top:2px}
      .v40125-choice strong{display:block;color:#173a64;font-size:11px}
      .v40125-choice small{display:block;color:#64748b;font-size:9.5px;line-height:1.35;margin-top:2px}
      .v40125-package-fields{margin-top:11px;padding-top:10px;border-top:1px solid #d9e4f1}
      .v40125-package-fields select{width:100%;padding:8px 10px;border:1px solid #d8e1ed;border-radius:8px;background:#fff}
      .v40125-hint{font-size:9.5px;color:#5a6882;margin-top:5px;line-height:1.4}
      .v40125-confirm{display:flex;gap:8px;align-items:flex-start;background:#eef4fc;border-radius:8px;padding:9px 10px;font-size:10px;color:#244b74;line-height:1.4}
      .v40125-confirm input{margin-top:2px}
      @media(max-width:680px){.v40125-choice-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function decorate(root=document) {
    ensureStyle();
    installPlanNowCapture();
    decoratePlanningTable();

    const backdrops = root.matches?.('.modal-backdrop')
      ? [root]
      : [...root.querySelectorAll?.('.modal-backdrop') || []];

    backdrops.forEach(backdrop => {
      void decoratePlanningModal(backdrop);
    });
  }

  function start() {
    decorate(document);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node?.nodeType === 1) decorate(node);
        });
      });
      document.querySelectorAll('.modal-backdrop').forEach(modal => decorate(modal));
      decoratePlanningTable();
    });

    // Os modais V36 são anexados diretamente ao document.body, como irmãos de #app.
    // Observar somente #app fazia a V40.0.125 nunca enxergar o modal de planejamento.
    observer.observe(document.documentElement, { childList:true, subtree:true });

    window.HAP_V40052_PACKAGE_APORTE_KPI = {
      version: VERSION,
      refresh: () => decorate(document),
      listPackages,
      operationalDrafts,
      observerScope: 'document.documentElement'
    };
    window.HAP_V40126_PACKAGE_APORTE_KPI = window.HAP_V40052_PACKAGE_APORTE_KPI;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
