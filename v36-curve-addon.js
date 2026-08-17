/* HAPCAPEX V38.1 — Curva de Capex: precisão, histórico mensal, canceladas e experiência mobile completa. */
(() => {
  'use strict';

  const originalRenderKPIs = window.renderKPIs;
  const originalRenderAnalysis = window.renderAnalysis;
  const originalOpenKpiPanel = window.openKpiPanel;
  const originalComputeFlow = window.computeFlow;

  // A Curva deixa de ter edição manual dos KPIs financeiros. A origem passa a ser o Controle de Capex.
  function removeLegacyKpiEditor() {
    document.getElementById('settingsBtn')?.remove();
    document.querySelectorAll('[data-mobile-proxy="settingsBtn"]').forEach(el => el.remove());
  }
  removeLegacyKpiEditor();

  function exactMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return '-';
    return 'R$\u00a0' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function exactNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return '-';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Substitui os formatadores globais usados pelos KPIs, tabelas, painéis e tooltips.
  window.fmt = function(value, compact=false) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return '-';
    if (!compact) return exactMoney(n);
    if (Math.abs(n) >= 1e6) return 'R$\u00a0' + (n/1e6).toFixed(2).replace('.', ',') + 'M';
    if (Math.abs(n) >= 1e3) return 'R$\u00a0' + (n/1e3).toFixed(1).replace('.', ',') + 'K';
    return exactMoney(n);
  };
  window.fmtZ = exactNumber;

  function actualWorksCapex() {
    const check = window.HAP_FINANCIAL_CHECK;
    if (check && Number.isFinite(Number(check.capexObras))) return Number(check.capexObras);
    return (window.HAP_DATA?.obrasRaw || []).reduce((sum, work) => sum + Number(work?.capex || 0), 0);
  }

  function formulaWorksCapex() {
    const settings = window.HAP_DATA?.settings || {};
    const initial = Number(settings.capex_inicial || 0);
    const aportes = (Array.isArray(settings.aportes_detalhe) ? settings.aportes_detalhe : []).reduce((s,x)=>s+Number(x?.valor||0),0);
    const conting = (Array.isArray(settings.conting_detalhe) ? settings.conting_detalhe : []).reduce((s,x)=>s+Number(x?.valor||0),0);
    return initial + aportes - conting;
  }

  const CURVE_MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function injectCurveMonthlyStyles() {
    if (document.getElementById('hap-v375-curve-monthly-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v375-curve-monthly-styles';
    style.textContent = `
      .v375-curve-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}
      .v375-curve-summary>div{background:var(--cinza-bg);border-radius:9px;padding:10px 11px}
      .v375-curve-summary span{display:block;font-size:9px;text-transform:uppercase;font-weight:800;color:var(--texto-suave)}
      .v375-curve-summary strong{display:block;margin-top:4px;font-size:14px;color:var(--azul);font-variant-numeric:tabular-nums}
      .v375-month-group{border:1px solid var(--cinza-borda);border-radius:11px;margin:9px 0;overflow:hidden;background:#fff}
      .v375-month-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;background:var(--cinza-bg);cursor:pointer;user-select:none}
      .v375-month-head:hover{background:#eaf0f8}
      .v375-month-left{display:flex;align-items:center;gap:8px;min-width:0}
      .v375-chevron{font-size:13px;font-weight:900;color:var(--azul-medio);transition:transform .16s ease}
      .v375-month-group.collapsed .v375-chevron{transform:rotate(-90deg)}
      .v375-month-title{font-size:12px;font-weight:800;color:var(--azul)}
      .v375-month-summary{text-align:right;font-size:10px;color:var(--texto-suave);white-space:nowrap}
      .v375-month-summary strong{display:block;font-size:13px;font-variant-numeric:tabular-nums}
      .v375-month-body{padding:0 10px 8px;border-top:1px solid var(--cinza-borda)}
      .v375-month-group.collapsed .v375-month-body{display:none}
      .v375-entry{padding:10px 2px;border-bottom:1px solid var(--cinza-borda)}
      .v375-entry:last-child{border-bottom:0}
      .v375-entry-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .v375-entry-name{font-size:12px;font-weight:650;color:var(--azul);line-height:1.35}
      .v375-entry-meta{font-size:10px;color:var(--texto-suave);margin-top:3px}
      .v375-entry-value{font-size:13px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
      .v375-hint{font-size:10px;color:var(--texto-suave);margin:5px 0 10px}
      @media(max-width:640px){.v375-curve-summary{grid-template-columns:1fr}.v375-entry-head{flex-direction:column}.v375-month-summary{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function curveMonthKey(item) {
    const raw = String(item?.mes || item?.data_movimento || item?.created_at || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : 'sem-mes';
  }

  function curveMonthLabel(key) {
    if (key === 'sem-mes') return 'Sem mês informado';
    const [year, month] = key.split('-').map(Number);
    return `${CURVE_MONTH_NAMES[Math.max(1, Math.min(12, month)) - 1]} de ${year}`;
  }

  function curveMonthlyGroups(details) {
    const groups = new Map();
    (details || []).forEach(item => {
      const key = curveMonthKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()].sort(([a],[b]) => {
      if (a === 'sem-mes') return 1;
      if (b === 'sem-mes') return -1;
      return b.localeCompare(a);
    });
  }

  function renderCurveMonthlyGroups(details, color) {
    const groups = curveMonthlyGroups(details);
    if (!groups.length) return '<div class="empty-state">Nenhum lançamento registrado.</div>';
    return groups.map(([key, items]) => {
      const subtotal = items.reduce((sum, item) => sum + Number(item?.valor || 0), 0);
      const rows = items.map(item => {
        const oi = item?.ordem_interna || item?.oi || item?.ordem || '';
        const meta = [oi ? `OI ${oi}` : '', item?.observacao || ''].filter(Boolean).join(' · ');
        return `<div class="v375-entry">
          <div class="v375-entry-head">
            <div><div class="v375-entry-name">${String(item?.nome || 'Lançamento')}</div>${meta ? `<div class="v375-entry-meta">${String(meta)}</div>` : ''}</div>
            <div class="v375-entry-value" style="color:${color}">${exactMoney(Number(item?.valor || 0))}</div>
          </div>
        </div>`;
      }).join('');
      return `<section class="v375-month-group collapsed">
        <div class="v375-month-head" role="button" tabindex="0" aria-expanded="false">
          <div class="v375-month-left"><span class="v375-chevron">▼</span><div class="v375-month-title">${curveMonthLabel(key)}</div></div>
          <div class="v375-month-summary"><strong style="color:${color}">${exactMoney(subtotal)}</strong>${items.length} lançamento(s)</div>
        </div>
        <div class="v375-month-body">${rows}</div>
      </section>`;
    }).join('');
  }

  function bindCurveMonthlyAccordions(body) {
    body?.querySelectorAll('.v375-month-head').forEach(head => {
      const toggle = () => {
        const group = head.closest('.v375-month-group');
        if (!group) return;
        const collapsed = group.classList.toggle('collapsed');
        head.setAttribute('aria-expanded', String(!collapsed));
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  function renderCurveFinancialKpiMonthly(type) {
    const body = document.getElementById('kpi-panel-body');
    const tag = document.getElementById('kpi-panel-tag');
    const title = document.getElementById('kpi-panel-title');
    if (!body || !tag || !title) return;

    const settings = window.HAP_DATA?.settings || {};
    const isAporte = type === 'aportes_extras';
    const details = Array.isArray(isAporte ? settings.aportes_detalhe : settings.conting_detalhe)
      ? (isAporte ? settings.aportes_detalhe : settings.conting_detalhe)
      : [];
    const total = details.reduce((sum, item) => sum + Number(item?.valor || 0), 0);
    const color = isAporte ? 'var(--verde)' : 'var(--vermelho)';
    const label = isAporte ? 'Aportes Extras' : 'Contingenciamentos';

    tag.innerHTML = isAporte ? '💚 Aportes Extras' : '🔴 Contingenciamentos';
    title.textContent = `${label} — Histórico Mensal`;

    const months = curveMonthlyGroups(details);
    let html = `<div class="panel-section">
      <div class="panel-section-title">📊 Resumo</div>
      <div class="v375-curve-summary">
        <div><span>Total acumulado</span><strong style="color:${color}">${exactMoney(total)}</strong></div>
        <div><span>Lançamentos</span><strong>${details.length}</strong></div>
        <div><span>Meses com movimento</span><strong>${months.length}</strong></div>
      </div>
      <div class="v375-hint">Clique em um mês para visualizar ou recolher as obras e lançamentos daquele período.</div>
    </div>
    <div class="panel-section">
      <div class="panel-section-title">🗓️ Histórico por mês</div>
      ${renderCurveMonthlyGroups(details, color)}
    </div>`;

    if (!isAporte) {
      const partial = (window.HAP_RUNTIME_OBRAS || []).filter(work => String(work?.nome || '').includes('CONTING. PARCIAL'));
      const residual = partial.reduce((sum, work) => sum + Number(work?.capex || 0), 0);
      if (partial.length) {
        html += `<div class="panel-section">
          <div class="panel-section-title">🟡 CAPEX residual das contingências parciais</div>
          <div class="v375-curve-summary"><div style="grid-column:1/-1"><span>Residual preservado no CAPEX Atual</span><strong>${exactMoney(residual)}</strong></div></div>
        </div>`;
      }
    }

    body.innerHTML = html;
    bindCurveMonthlyAccordions(body);
  }

  function patchCurrentCapexKpi() {
    const current = actualWorksCapex();
    document.querySelectorAll('#kpi-section .kpi-card').forEach(card => {
      const label = card.querySelector('.kpi-label')?.textContent?.trim();
      if (label === 'CAPEX Atual') {
        const value = card.querySelector('.kpi-value');
        if (value) value.textContent = exactMoney(current);
        const sub = card.querySelector('.kpi-sub');
        if (sub) sub.textContent = `${(window.HAP_RUNTIME_OBRAS || []).filter(o=>!o.contingenciada).length} obras ativas · soma vigente das obras · clique para detalhar`;
      }
    });
    if (window.HAP_FINANCIAL_CHECK) {
      window.HAP_FINANCIAL_CHECK.capexGerencial = current;
      window.HAP_FINANCIAL_CHECK.diferencaGerencial = 0;
    }
  }

  // Regras "Previsto = Realizado" não podem receber saldo artificial apenas para
  // fazer a soma do previsto fechar com o CAPEX. O CAPEX pode ser maior que o
  // realizado e, nesse caso, o saldo simplesmente permanece sem previsão futura.
  const REALIZED_ONLY_RULES = new Set(['realized_equals_forecast', 'contingency_full']);
  const ALL_FLOW_KEYS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan27','fev27','mar27','abr27','mai27','jun27','jul27'];

  function realizedOnlyFlow(obra) {
    const flow = {};
    ALL_FLOW_KEYS.forEach(key => { flow[key] = 0; });
    const realizedKeys = Array.isArray(window.HAP_DATA?.monthsReal) ? window.HAP_DATA.monthsReal : ['jan','fev','mar','abr','mai','jun','jul'];
    realizedKeys.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(flow, key)) flow[key] = Number(obra?.[key + '_real'] || 0);
    });
    return flow;
  }

  function repairRealizedOnlyFlows() {
    (window.HAP_RUNTIME_OBRAS || []).forEach(obra => {
      const rule = obra?._flowRule || obra?.flow_rule;
      if (REALIZED_ONLY_RULES.has(rule)) obra.flow = realizedOnlyFlow(obra);
    });
  }

  if (typeof originalComputeFlow === 'function') {
    window.computeFlow = function(obra) {
      const rule = obra?._flowRule || obra?.flow_rule;
      if (REALIZED_ONLY_RULES.has(rule)) return realizedOnlyFlow(obra);
      return originalComputeFlow(obra);
    };
  }

  if (typeof originalRenderKPIs === 'function') {
    window.renderKPIs = function(...args) {
      const out = originalRenderKPIs(...args);
      patchCurrentCapexKpi();
      return out;
    };
  }

  if (typeof originalRenderAnalysis === 'function') {
    window.renderAnalysis = function(...args) {
      const out = originalRenderAnalysis(...args);
      const container = document.getElementById('analysis-text');
      if (container) {
        const oldValue = exactMoney(formulaWorksCapex());
        const newValue = exactMoney(actualWorksCapex());
        if (oldValue !== newValue) container.innerHTML = container.innerHTML.split(oldValue).join(newValue);
      }
      return out;
    };
  }

  if (typeof originalOpenKpiPanel === 'function') {
    window.openKpiPanel = function(type, ...args) {
      const out = originalOpenKpiPanel(type, ...args);
      if (type === 'aportes_extras' || type === 'contingenciamento') {
        renderCurveFinancialKpiMonthly(type);
      }
      if (type === 'capex_atual') {
        const body = document.getElementById('kpi-panel-body');
        const title = [...(body?.querySelectorAll('.panel-section-title') || [])].find(el => el.textContent.includes('Fórmula de Cálculo'));
        const section = title?.closest('.panel-section');
        if (section) {
          section.innerHTML = `<div class="panel-section-title">💼 CAPEX vigente das obras</div>
            <div style="background:var(--cinza-bg);border-radius:10px;padding:14px 16px;font-size:13px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;">
                <span style="color:var(--texto-suave)">Soma atual das obras na Curva</span>
                <strong style="font-size:15px;color:var(--azul);white-space:nowrap">${exactMoney(actualWorksCapex())}</strong>
              </div>
            </div>`;
        }
      }
      return out;
    };
  }

  // V37.9.2 — Status de negócio persistido na Curva.
  // Obras com flow_rule_params.business_status = "cancelled" continuam no histórico,
  // mas recebem identificação visual inequívoca em todas as tabelas de Obras.
  function cancelledWorksV3792() {
    return (window.HAP_DATA?.obrasRaw || []).filter(work =>
      String(work?._flowRuleParams?.business_status || '').toLowerCase() === 'cancelled'
    );
  }

  function normalizeWorkNameV3792(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*-\s*CONTIN?G[^-]*$/i, '')
      .trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function injectCancelledStylesV3792() {
    if (document.getElementById('hap-v3792-cancelled-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v3792-cancelled-styles';
    style.textContent = `
      .v3792-cancelled-tag{display:inline-flex;align-items:center;margin-left:6px;padding:2px 8px;border-radius:999px;background:#f3f4f6;border:1px solid #cfd4dc;color:#5b6472;font-size:9px;font-weight:900;letter-spacing:.03em;vertical-align:middle;white-space:nowrap}
      .obra-row.v3792-cancelled-row{background:#fafafa}
      .obra-row.v3792-cancelled-row>td:first-child{color:#667085}
    `;
    document.head.appendChild(style);
  }

  function decorateCancelledWorksV3792(root=document) {
    const cancelled = cancelledWorksV3792();
    if (!cancelled.length) return;
    injectCancelledStylesV3792();
    const names = cancelled.map(work => normalizeWorkNameV3792(work?.nome)).filter(Boolean);
    root.querySelectorAll?.('.obra-row td:first-child').forEach(cell => {
      if (cell.querySelector('.v3792-cancelled-tag')) return;
      const cellName = normalizeWorkNameV3792(cell.textContent);
      const matched = names.some(name => cellName.includes(name) || name.includes(cellName));
      if (!matched) return;
      cell.closest('.obra-row')?.classList.add('v3792-cancelled-row');
      cell.insertAdjacentHTML('beforeend', ' <span class="v3792-cancelled-tag">CANCELADA</span>');
    });
  }

  function watchCancelledWorksV3792() {
    if (window.__HAP_V3792_CANCELLED_OBSERVER__) return;
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        decorateCancelledWorksV3792(document);
      });
    };
    window.__HAP_V3792_CANCELLED_OBSERVER__ = new MutationObserver(schedule);
    window.__HAP_V3792_CANCELLED_OBSERVER__.observe(document.body, { childList:true, subtree:true });
    decorateCancelledWorksV3792(document);
  }


  function injectMobileCompleteStylesV380() {
    if (document.getElementById('hap-v380-mobile-complete')) return;
    const style=document.createElement('style'); style.id='hap-v380-mobile-complete';
    style.textContent=`
      body.hap-mobile-v38,body.pwa-mobile{overscroll-behavior-y:none;-webkit-tap-highlight-color:transparent}
      body.hap-mobile-v38 .container,body.pwa-mobile .container{padding:8px 8px calc(78px + env(safe-area-inset-bottom,0px))!important;max-width:none!important}
      body.hap-mobile-v38 .mobile-app-header,body.pwa-mobile .mobile-app-header{min-height:58px!important;padding:7px 9px!important;gap:6px!important;backdrop-filter:blur(12px)}
      body.hap-mobile-v38 .mobile-app-logo,body.pwa-mobile .mobile-app-logo{width:36px!important;height:36px!important;border-radius:10px!important}
      body.hap-mobile-v38 .mobile-brand-line strong,body.pwa-mobile .mobile-brand-line strong{font-size:13px!important}
      body.hap-mobile-v38 .mobile-app-brand small,body.pwa-mobile .mobile-app-brand small{font-size:9px!important;max-width:180px!important}
      body.hap-mobile-v38 .mobile-header-actions button,body.pwa-mobile .mobile-header-actions button{width:40px!important;height:40px!important;border-radius:11px!important}
      body.hap-mobile-v38 .mobile-module-actions,body.pwa-mobile .mobile-module-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:5px!important;margin:6px 8px 8px!important}
      body.hap-mobile-v38 .mobile-module-actions button,body.pwa-mobile .mobile-module-actions button{min-height:38px!important;padding:7px 9px!important;font-size:9px!important;border-radius:10px!important}

      body.hap-mobile-v38 .kpi-grid,body.pwa-mobile .kpi-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;overflow:visible!important;margin-bottom:10px!important}
      body.hap-mobile-v38 .kpi-card,body.pwa-mobile .kpi-card{min-width:0!important;flex-basis:auto!important;padding:9px!important;min-height:82px!important;border-left-width:3px!important;border-radius:10px!important;box-shadow:0 1px 5px rgba(13,43,78,.07)!important}
      body.hap-mobile-v38 .kpi-label,body.pwa-mobile .kpi-label{font-size:8px!important;line-height:1.15!important}
      body.hap-mobile-v38 .kpi-value,body.pwa-mobile .kpi-value{font-size:14px!important;line-height:1.1!important;overflow-wrap:anywhere!important}
      body.hap-mobile-v38 .kpi-sub,body.pwa-mobile .kpi-sub{font-size:8px!important;line-height:1.2!important}
      body.hap-mobile-v38 .tipo-grid,body.pwa-mobile .tipo-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;overflow:visible!important}
      body.hap-mobile-v38 .tipo-card,body.pwa-mobile .tipo-card{min-width:0!important;flex-basis:auto!important;padding:8px 9px!important;border-top-width:3px!important;border-radius:9px!important;min-height:74px!important}
      body.hap-mobile-v38 .tipo-emoji,body.pwa-mobile .tipo-emoji{font-size:15px!important}.tipo-label{font-size:8px!important}.tipo-capex{font-size:11px!important}.tipo-count{font-size:8px!important}

      body.hap-mobile-v38 .section-title,body.pwa-mobile .section-title{font-size:12px!important;margin:10px 0 8px!important;padding-bottom:6px!important;border-bottom-width:2px!important}
      body.hap-mobile-v38 .chart-card,body.pwa-mobile .chart-card,
      body.hap-mobile-v38 .risk-card,body.pwa-mobile .risk-card,
      body.hap-mobile-v38 .analysis-card,body.pwa-mobile .analysis-card,
      body.hap-mobile-v38 .table-card,body.pwa-mobile .table-card{padding:10px!important;border-radius:10px!important;margin-bottom:10px!important;box-shadow:0 1px 5px rgba(13,43,78,.06)!important}
      body.hap-mobile-v38 .chart-card h3,body.pwa-mobile .chart-card h3{font-size:10px!important;margin-bottom:8px!important}
      body.hap-mobile-v38 .analysis-card h2,body.pwa-mobile .analysis-card h2{font-size:13px!important;margin-bottom:10px!important}
      body.hap-mobile-v38 .analysis-card h3,body.pwa-mobile .analysis-card h3{font-size:11px!important;margin:11px 0 5px!important}
      body.hap-mobile-v38 .analysis-card p,body.pwa-mobile .analysis-card p{font-size:10px!important;line-height:1.45!important;margin-bottom:6px!important}
      body.hap-mobile-v38 .highlight-box,body.pwa-mobile .highlight-box{padding:8px 9px!important;margin:7px 0!important;font-size:9.5px!important;line-height:1.4!important}

      body.hap-mobile-v38 .filter-bar,body.pwa-mobile .filter-bar{display:grid!important;grid-template-columns:1fr auto!important;gap:5px!important;margin-bottom:7px!important}
      body.hap-mobile-v38 .filter-bar input,body.pwa-mobile .filter-bar input{grid-column:1/-1;min-width:0!important;width:100%!important;font-size:16px!important;padding:9px 10px!important}
      body.hap-mobile-v38 .filter-bar select,body.pwa-mobile .filter-bar select{min-width:0!important;width:100%!important;font-size:11px!important;padding:8px!important}
      body.hap-mobile-v38 .filter-count,body.pwa-mobile .filter-count{font-size:9px!important;align-self:center}
      body.hap-mobile-v38 .month-filter-bar,body.pwa-mobile .month-filter-bar{padding:8px!important;margin-bottom:8px!important;border-radius:9px!important;gap:5px!important;display:block!important;overflow:hidden!important}
      body.hap-mobile-v38 .month-filter-bar .mf-label,body.pwa-mobile .month-filter-bar .mf-label{font-size:9px!important;margin-bottom:5px!important}
      body.hap-mobile-v38 .month-filter-bar .mf-chips,body.pwa-mobile .month-filter-bar .mf-chips{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;gap:5px!important;padding-bottom:3px!important;scroll-snap-type:x proximity;scrollbar-width:none}
      body.hap-mobile-v38 .month-filter-bar .mf-chips::-webkit-scrollbar,body.pwa-mobile .month-filter-bar .mf-chips::-webkit-scrollbar{display:none}
      body.hap-mobile-v38 .month-chip,body.pwa-mobile .month-chip{flex:0 0 auto!important;scroll-snap-align:start;padding:5px 8px!important;font-size:9px!important}
      body.hap-mobile-v38 .tab-bar,body.pwa-mobile .tab-bar{overflow-x:auto!important;flex-wrap:nowrap!important;gap:4px!important;margin-bottom:8px!important;scrollbar-width:none}
      body.hap-mobile-v38 .tab-bar::-webkit-scrollbar,body.pwa-mobile .tab-bar::-webkit-scrollbar{display:none}
      body.hap-mobile-v38 .tab-btn,body.pwa-mobile .tab-btn{flex:0 0 auto;min-height:36px;padding:7px 10px!important;font-size:9px!important;border-radius:9px!important}

      body.hap-mobile-v38 .table-wrapper,body.pwa-mobile .table-wrapper{max-height:none!important;-webkit-overflow-scrolling:touch!important}
      body.hap-mobile-v38 .table-wrapper table,body.pwa-mobile .table-wrapper table{font-size:9px!important}
      body.hap-mobile-v38 .table-wrapper th,body.pwa-mobile .table-wrapper th{padding:7px 6px!important;font-size:8px!important}
      body.hap-mobile-v38 .table-wrapper td,body.pwa-mobile .table-wrapper td{padding:6px!important;font-size:9px!important}
      body.hap-mobile-v38 .table-wrapper th:first-child,body.pwa-mobile .table-wrapper th:first-child{min-width:180px!important}
      body.hap-mobile-v38 .table-wrapper td:first-child,body.pwa-mobile .table-wrapper td:first-child{max-width:210px!important;white-space:normal!important;line-height:1.25!important}
      .v380-curve-swipe-hint{display:none}
      body.hap-mobile-v38 .v380-curve-swipe-hint,body.pwa-mobile .v380-curve-swipe-hint{display:flex;align-items:center;justify-content:center;gap:5px;background:#eef4fc;color:#5a6882;font-size:8px;padding:5px;border-radius:7px;margin:0 0 5px}

      body.hap-mobile-v38 table.v380-risk-cards,body.pwa-mobile table.v380-risk-cards{display:block!important;min-width:0!important;width:100%!important}
      body.hap-mobile-v38 table.v380-risk-cards thead,body.pwa-mobile table.v380-risk-cards thead{display:none!important}
      body.hap-mobile-v38 table.v380-risk-cards tbody,body.pwa-mobile table.v380-risk-cards tbody{display:grid!important;gap:6px!important}
      body.hap-mobile-v38 table.v380-risk-cards tr,body.pwa-mobile table.v380-risk-cards tr{display:block!important;border:1px solid #dde3ee!important;border-radius:9px!important;overflow:hidden!important;background:#fff!important}
      body.hap-mobile-v38 table.v380-risk-cards td,body.pwa-mobile table.v380-risk-cards td{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;gap:10px!important;padding:6px 8px!important;border:0!important;border-bottom:1px solid #eef1f5!important;background:#fff!important;white-space:normal!important;text-align:right!important;font-size:9px!important}
      body.hap-mobile-v38 table.v380-risk-cards td:last-child,body.pwa-mobile table.v380-risk-cards td:last-child{border-bottom:0!important}
      body.hap-mobile-v38 table.v380-risk-cards td::before,body.pwa-mobile table.v380-risk-cards td::before{content:attr(data-v380-label);font-size:7.5px;font-weight:800;text-transform:uppercase;color:#5a6882;flex:0 0 40%;text-align:left}
      body.hap-mobile-v38 table.v380-risk-cards td:first-child,body.pwa-mobile table.v380-risk-cards td:first-child{display:block!important;background:#f7f9fc!important;text-align:left!important;font-weight:800!important;color:#0d2b4e!important;font-size:10px!important}
      body.hap-mobile-v38 table.v380-risk-cards td:first-child::before,body.pwa-mobile table.v380-risk-cards td:first-child::before{display:none!important}

      body.hap-mobile-v38 .admin-modal,body.pwa-mobile .admin-modal{padding:0!important;align-items:flex-end!important}
      body.hap-mobile-v38 .admin-box,body.pwa-mobile .admin-box{width:100%!important;max-width:100%!important;max-height:94dvh!important;border-radius:18px 18px 0 0!important;padding:14px 12px calc(12px + env(safe-area-inset-bottom,0px))!important}
      body.hap-mobile-v38 .admin-box::before,body.pwa-mobile .admin-box::before{content:'';display:block;width:38px;height:4px;border-radius:99px;background:#d5dbe5;margin:-4px auto 9px}
      body.hap-mobile-v38 .admin-actions,body.pwa-mobile .admin-actions{position:sticky!important;bottom:calc(-12px - env(safe-area-inset-bottom,0px));z-index:8;background:#fff;margin:12px -12px -12px!important;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px))!important;display:flex!important;gap:6px!important}
      body.hap-mobile-v38 .admin-actions button,body.pwa-mobile .admin-actions button{flex:1 1 0!important;min-height:44px!important;font-size:9.5px!important;padding:8px!important}
      body.hap-mobile-v38 .work-edit-grid,body.pwa-mobile .work-edit-grid,
      body.hap-mobile-v38 .import-top-grid,body.pwa-mobile .import-top-grid,
      body.hap-mobile-v38 .user-create-form,body.pwa-mobile .user-create-form{grid-template-columns:1fr!important;gap:7px!important}
      body.hap-mobile-v38 input,body.pwa-mobile input,body.hap-mobile-v38 select,body.pwa-mobile select,body.hap-mobile-v38 textarea,body.pwa-mobile textarea{font-size:16px}

      body.hap-mobile-v38 .mobile-bottom-nav,body.pwa-mobile .mobile-bottom-nav{min-height:calc(60px + env(safe-area-inset-bottom))!important;padding:5px 5px max(6px,env(safe-area-inset-bottom))!important;box-shadow:0 -5px 18px rgba(13,43,78,.12)!important;backdrop-filter:blur(12px);background:rgba(255,255,255,.97)!important}
      body.hap-mobile-v38 .mobile-bottom-nav button,body.pwa-mobile .mobile-bottom-nav button{min-height:50px!important;border-radius:10px!important}
      body.hap-mobile-v38 .mobile-bottom-nav button span,body.pwa-mobile .mobile-bottom-nav button span{font-size:18px!important}
      body.hap-mobile-v38 .mobile-bottom-nav button small,body.pwa-mobile .mobile-bottom-nav button small{font-size:8px!important}
      body.hap-mobile-v38 .mobile-action-sheet,body.pwa-mobile .mobile-action-sheet{border-radius:18px 18px 0 0!important;max-height:88dvh!important}
      body.hap-mobile-v38 .v375-curve-summary,body.pwa-mobile .v375-curve-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin-bottom:8px!important}
      body.hap-mobile-v38 .v375-curve-summary>div,body.pwa-mobile .v375-curve-summary>div{padding:8px!important}.v375-curve-summary span{font-size:8px!important}.v375-curve-summary strong{font-size:11px!important}
      body.hap-mobile-v38 .v375-month-head,body.pwa-mobile .v375-month-head{padding:9px!important}.v375-month-title{font-size:10px!important}.v375-month-summary{font-size:8px!important}.v375-month-summary strong{font-size:10px!important}
      body.hap-mobile-v38 .v3792-cancelled-tag,body.pwa-mobile .v3792-cancelled-tag{font-size:7px!important;padding:2px 6px!important;margin-left:3px!important}
    

      /* V38.1 — retorno ao seletor HAPCAPEX no mobile */
      body.hap-mobile-v38 .mobile-app-brand,body.pwa-mobile .mobile-app-brand{cursor:pointer}
      body.hap-mobile-v38 .v381-curve-home,body.pwa-mobile .v381-curve-home{width:100%;min-height:48px;border:1px solid #d9e1ec;border-radius:11px;background:#f5f8fc;color:#0d2b4e;font-size:10px;font-weight:800;padding:9px 12px;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:7px}
      body.hap-mobile-v38 .v381-curve-home:active,body.pwa-mobile .v381-curve-home:active{transform:scale(.99);background:#eaf2fc}
`;
    document.head.appendChild(style);
  }

  function isPhoneV380() { const narrow=window.matchMedia?.('(max-width:780px)').matches || window.innerWidth<=780; const mobileAgent=/android|iphone|ipod|mobile/i.test(navigator.userAgent||''); const coarse=!!window.matchMedia?.('(pointer:coarse)').matches; const phoneLandscape=(mobileAgent||coarse||document.body.classList.contains('pwa-mobile')) && Math.min(window.innerWidth,window.innerHeight)<=780 && Math.max(window.innerWidth,window.innerHeight)<=980; return !!(narrow||phoneLandscape); }
  function decorateCurveTablesV380(root=document) {
    if (!isPhoneV380()) return;
    root.querySelectorAll?.('.risk-table').forEach(table=>{
      if(table.dataset.v380Risk==='1')return;
      const heads=[...table.querySelectorAll('thead th')].map(th=>String(th.textContent||'').trim());
      if(!heads.length)return;
      table.classList.add('v380-risk-cards');
      table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((td,i)=>td.dataset.v380Label=heads[i]||''));
      table.dataset.v380Risk='1';
    });
    root.querySelectorAll?.('.table-wrapper').forEach(wrapper=>{
      const table=wrapper.querySelector('table'); if(!table)return;
      if(!wrapper.previousElementSibling?.classList?.contains('v380-curve-swipe-hint')){
        const hint=document.createElement('div');hint.className='v380-curve-swipe-hint';hint.textContent='↔ Deslize para consultar os meses';wrapper.parentElement?.insertBefore(hint,wrapper);
      }
    });
  }
  function syncCurveMobileV380(){
    const mobile=isPhoneV380(); document.body.classList.toggle('hap-mobile-v38',mobile);
    if(mobile)decorateCurveTablesV380(document);
  }
  function initCurveMobileV380(){
    injectMobileCompleteStylesV380(); syncCurveMobileV380();
    if(window.__HAP_CURVE_V380_OBSERVER__)return;
    let pending=false;
    window.__HAP_CURVE_V380_OBSERVER__=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;syncCurveMobileV380();});});
    window.__HAP_CURVE_V380_OBSERVER__.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',syncCurveMobileV380,{passive:true});
  }


  // O dashboard já foi renderizado quando este addon entra. Corrige primeiro as
  // regras de previsto=realizado e depois reaplica a apresentação.
  try {
    injectCurveMonthlyStyles();
    initCurveMobileV380();
    watchCancelledWorksV3792();
    repairRealizedOnlyFlows();
    if (typeof window.applyFilter === 'function') window.applyFilter();
    if (typeof window.applyManFilter === 'function') window.applyManFilter();
    patchCurrentCapexKpi();
  } catch (error) {
    console.warn('[HAPCAPEX V37.5] Não foi possível reaplicar os ajustes da Curva.', error);
  }


  function goToHapcapexHomeV381() {
    if (typeof window.voltarAoSeletorHapcapex === 'function') { window.voltarAoSeletorHapcapex(); return; }
    window.location.href = './';
  }

  function ensureCurveHomeV381() {
    const brand=document.querySelector('.mobile-app-brand');
    if(brand && brand.dataset.v381Home!=='1'){
      brand.dataset.v381Home='1'; brand.setAttribute('role','button'); brand.setAttribute('tabindex','0'); brand.title='Voltar ao HAPCAPEX';
      brand.addEventListener('click',goToHapcapexHomeV381);
      brand.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goToHapcapexHomeV381();}});
    }
    const sheet=document.getElementById('mobileActionSheet');
    if(sheet && !sheet.querySelector('.v381-curve-home')){
      const btn=document.createElement('button'); btn.type='button'; btn.className='v381-curve-home'; btn.innerHTML='<span>⌂</span> Voltar ao HAPCAPEX'; btn.onclick=goToHapcapexHomeV381;
      const grid=sheet.querySelector('.mobile-module-actions,.mobile-sheet-grid');
      if(grid) grid.insertAdjacentElement('afterend',btn); else sheet.appendChild(btn);
    }
  }


  ensureCurveHomeV381();
  if(!window.__HAP_V381_CURVE_HOME_OBSERVER__){
    window.__HAP_V381_CURVE_HOME_OBSERVER__=new MutationObserver(()=>ensureCurveHomeV381());
    window.__HAP_V381_CURVE_HOME_OBSERVER__.observe(document.body,{childList:true,subtree:true});
  }

})();
