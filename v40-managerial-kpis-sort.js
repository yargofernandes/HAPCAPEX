/* HAPCAPEX V40.0.9 — Visão Gerencial consolidada + gráfico executivo + inicialização determinística + ordenação do Controle */
(() => {
  'use strict';

  const VERSION = '40.0.9';
  const FLOW_KEYS = [
    'jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez',
    'jan27','fev27','mar27','abr27','mai27','jun27','jul27'
  ];
  const FLOW_LABELS = {
    jan:'Jan/26', fev:'Fev/26', mar:'Mar/26', abr:'Abr/26', mai:'Mai/26', jun:'Jun/26',
    jul:'Jul/26', ago:'Ago/26', set:'Set/26', out:'Out/26', nov:'Nov/26', dez:'Dez/26',
    jan27:'Jan/27', fev27:'Fev/27', mar27:'Mar/27', abr27:'Abr/27', mai27:'Mai/27', jun27:'Jun/27', jul27:'Jul/27'
  };
  const YM_TO_FLOW = {
    '2026-01':'jan','2026-02':'fev','2026-03':'mar','2026-04':'abr','2026-05':'mai','2026-06':'jun',
    '2026-07':'jul','2026-08':'ago','2026-09':'set','2026-10':'out','2026-11':'nov','2026-12':'dez',
    '2027-01':'jan27','2027-02':'fev27','2027-03':'mar27','2027-04':'abr27','2027-05':'mai27','2027-06':'jun27','2027-07':'jul27'
  };

  function injectStyles() {
    if (document.getElementById('hap-v407-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v407-styles';
    style.textContent = `
      .v407-manager-tab{white-space:nowrap}
      #page-obras.v407-managerial-mode .container > *{display:none!important}
      #page-obras.v407-managerial-mode .container > .month-filter-bar{display:flex!important}
      #page-obras.v407-managerial-mode .container > #v407-managerial-wrap{display:block!important}
      #v407-managerial-wrap{display:none;margin-top:10px}
      .v407-manager-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:4px 0 12px;padding:14px 16px;background:#fff;border:1px solid var(--cinza-borda,#dde3ee);border-radius:12px}
      .v407-manager-head span{display:block;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--laranja,#e07020)}
      .v407-manager-head strong{display:block;margin-top:3px;font-size:18px;color:var(--azul,#0d2b4e)}
      .v407-manager-head small{display:block;margin-top:4px;color:var(--texto-suave,#5a6882);line-height:1.4}
      .v407-manager-badge{flex:0 0 auto;padding:7px 10px;border-radius:999px;background:#eef4fc;color:#244b74;font-size:10px;font-weight:800}
      #v407-managerial-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      #v407-managerial-kpis .kpi-card{min-width:0}
      #v407-managerial-kpis .kpi-card.clickable{cursor:pointer}
      .v408-manager-chart-card{margin-top:14px;background:#fff;border:1px solid var(--cinza-borda,#dde3ee);border-radius:12px;padding:16px;box-shadow:0 1px 5px rgba(13,43,78,.05)}
      .v408-manager-chart-card h3{margin:0 0 12px;font-size:14px;color:var(--azul,#0d2b4e)}
      .v408-manager-chart-wrap{height:420px;position:relative}
      .v408-manager-chart-note{margin-top:8px;font-size:10px;color:var(--texto-suave,#5a6882)}
      .v407-sortable{cursor:pointer;user-select:none;position:relative;padding-right:24px!important}
      .v407-sortable:hover{filter:brightness(1.08)}
      .v407-sort-indicator{position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:10px;opacity:.9}
      .v407-sortable[data-v407-dir="none"] .v407-sort-indicator{opacity:.55}
      @media(max-width:980px){#v407-managerial-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.v407-manager-head{align-items:flex-start;flex-direction:column}}
      @media(max-width:520px){#v407-managerial-kpis{grid-template-columns:1fr}.v407-manager-badge{align-self:flex-start}.v408-manager-chart-wrap{height:320px}}
      body.pwa-mobile #page-obras.v407-managerial-mode .container > .month-filter-bar,
      body.hap-mobile-v38 #page-obras.v407-managerial-mode .container > .month-filter-bar{display:block!important}
    `;
    document.head.appendChild(style);
  }

  function money(value) {
    if (typeof window.fmt === 'function') return window.fmt(Number(value || 0));
    return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(value || 0));
  }
  function percent(value) {
    const n = Number(value || 0);
    if (typeof window.pct === 'function') return window.pct(n);
    return `${n.toFixed(1)}%`;
  }

  function selectedMonthKeys() {
    try {
      if (typeof selectedMonths !== 'undefined' && selectedMonths && selectedMonths.size > 0) {
        return FLOW_KEYS.filter(key => selectedMonths.has(key));
      }
    } catch (_) {}
    const real = Array.isArray(window.HAP_DATA?.monthsReal) ? window.HAP_DATA.monthsReal : [];
    return FLOW_KEYS.filter(key => real.includes(key));
  }

  function hasExplicitMonthFilter() {
    try { return typeof selectedMonths !== 'undefined' && selectedMonths && selectedMonths.size > 0; }
    catch (_) { return false; }
  }

  function currentFilteredWorks() {
    try {
      if (typeof filteredObras !== 'undefined' && Array.isArray(filteredObras)) return filteredObras;
    } catch (_) {}
    return Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : [];
  }

  function hasOtherCurveFilter() {
    const text = String(document.getElementById('filterInput')?.value || '').trim();
    let tipo = false;
    let status = false;
    try { tipo = typeof activeTipos !== 'undefined' && activeTipos && activeTipos.size > 0; } catch (_) {}
    try { status = typeof activeStatusFilter !== 'undefined' && activeStatusFilter !== null; } catch (_) {}
    return Boolean(text || tipo || status);
  }

  function detailFlowKey(item) {
    const raw = String(item?.mes || item?.data_movimento || item?.created_at || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})/);
    return match ? (YM_TO_FLOW[`${match[1]}-${match[2]}`] || '') : '';
  }

  function sumDetails(details, activeKeys, explicitFilter) {
    const rows = Array.isArray(details) ? details : [];
    if (!explicitFilter) return rows.reduce((sum, item) => sum + Number(item?.valor || 0), 0);
    const set = new Set(activeKeys);
    return rows.reduce((sum, item) => sum + (set.has(detailFlowKey(item)) ? Number(item?.valor || 0) : 0), 0);
  }

  function actualCurrentCapex() {
    const check = window.HAP_FINANCIAL_CHECK;
    if (check && Number.isFinite(Number(check.capexObras))) return Number(check.capexObras);
    const works = Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : (window.HAP_DATA?.obrasRaw || []);
    return works.reduce((sum, work) => sum + Number(work?.capex || 0), 0);
  }

  function periodLabel(keys, explicitFilter) {
    if (!explicitFilter) {
      const last = keys[keys.length - 1];
      return last ? `YTD até ${FLOW_LABELS[last] || last}` : 'YTD';
    }
    if (!keys.length) return 'Período selecionado';
    if (keys.length === 1) return FLOW_LABELS[keys[0]] || keys[0];
    const first = FLOW_LABELS[keys[0]] || keys[0];
    const last = FLOW_LABELS[keys[keys.length - 1]] || keys[keys.length - 1];
    return `${first} a ${last} · ${keys.length} meses`;
  }

  function curveKpiModel() {
    const keys = selectedMonthKeys();
    const explicit = hasExplicitMonthFilter();
    const works = currentFilteredWorks();
    const otherFilter = hasOtherCurveFilter();
    const settings = window.HAP_DATA?.settings || {};
    const naoPlan = window.HAP_DATA?.naoPlanejado || {};
    const initial = Number(settings.capex_inicial || 0);
    const conting = sumDetails(settings.conting_detalhe, keys, explicit);
    const aportes = sumDetails(settings.aportes_detalhe, keys, explicit);
    const current = explicit ? initial + aportes - conting : actualCurrentCapex();

    const plannedRealized = keys.reduce((sum, key) =>
      sum + works.reduce((s, work) => s + Number(work?.[`${key}_real`] || 0), 0), 0);
    const nonPlannedRealized = otherFilter ? 0 : keys.reduce((sum, key) => sum + Number(naoPlan?.[key] || 0), 0);
    const plannedForecast = keys.reduce((sum, key) =>
      sum + works.reduce((s, work) => s + Number(work?.flow?.[key] || 0), 0), 0);
    // Preserva a regra vigente do HAPCAPEX: o realizado não planejado compõe o previsto executivo.
    const forecast = plannedForecast + nonPlannedRealized;
    const realizedTotal = plannedRealized + nonPlannedRealized;
    const deviationPct = forecast > 0 ? ((realizedTotal - forecast) / forecast) * 100 : 0;
    const denominator = current > 0 ? current : 0;

    return {
      keys, explicit, period: periodLabel(keys, explicit), initial, conting, aportes, current,
      forecast, plannedRealized, nonPlannedRealized, realizedTotal, deviationPct,
      plannedPct: denominator ? plannedRealized / denominator * 100 : 0,
      nonPlannedPct: denominator ? nonPlannedRealized / denominator * 100 : 0,
      totalPct: denominator ? realizedTotal / denominator * 100 : 0,
      worksCount: works.length
    };
  }

  function findKpiCard(labelStartsWith) {
    return [...document.querySelectorAll('#kpi-section .kpi-card')].find(card =>
      String(card.querySelector('.kpi-label')?.textContent || '').trim().toUpperCase().startsWith(labelStartsWith.toUpperCase())
    );
  }

  function updateCard(prefix, value, sub, newLabel) {
    const card = findKpiCard(prefix);
    if (!card) return;
    const label = card.querySelector('.kpi-label');
    const val = card.querySelector('.kpi-value');
    const subEl = card.querySelector('.kpi-sub');
    if (newLabel && label) label.textContent = newLabel;
    if (val) val.textContent = value;
    if (subEl && sub) subEl.textContent = sub;
  }

  function applyMonthAwareOperationalKpis() {
    const m = curveKpiModel();
    updateCard('Contingenciamento', money(m.conting), `${m.period} · clique para detalhar`);
    updateCard('Aportes Extras', money(m.aportes), `${m.period} · clique para detalhar`);
    updateCard('CAPEX Atual', money(m.current), m.explicit
      ? `CAPEX Inicial + Aportes − Conting. do período · ${m.period} · clique para detalhar`
      : `${m.worksCount} obras no filtro atual · CAPEX vigente · clique para detalhar`);
    updateCard('CAPEX PREVISTO', money(m.forecast), `${m.period} · previsto executivo`, m.explicit ? 'CAPEX PREVISTO — PERÍODO' : 'CAPEX PREVISTO YTD');
    updateCard('REALIZADO OBRAS PLANEJADAS', money(m.plannedRealized), `${m.plannedPct.toFixed(1)}% do CAPEX Atual · ${m.period}`, m.explicit ? 'REALIZADO OBRAS PLANEJADAS — PERÍODO' : 'REALIZADO OBRAS PLANEJADAS YTD');
    updateCard('REALIZADO OBRAS NÃO PLANEJADAS', money(m.nonPlannedRealized), `${m.nonPlannedPct.toFixed(1)}% do CAPEX Atual · ${m.period}`, m.explicit ? 'REALIZADO OBRAS NÃO PLANEJADAS — PERÍODO' : 'REALIZADO OBRAS NÃO PLANEJADAS YTD');
    updateCard('CAPEX REALIZADO TOTAL', money(m.realizedTotal), `${m.totalPct.toFixed(1)}% do CAPEX Atual · ${m.period}`, m.explicit ? 'CAPEX REALIZADO TOTAL — PERÍODO' : 'CAPEX REALIZADO TOTAL YTD');
    updateCard('DESVIO', percent(m.deviationPct), `${m.deviationPct > 0 ? 'Realizado acima' : 'Realizado abaixo'} do previsto · ${m.period}`, m.explicit ? 'DESVIO — PERÍODO (Real Total vs Previsto)' : 'DESVIO YTD (Real Total vs Previsto)');
    return m;
  }

  function managerialCard(label, value, sub, cls='', onclick='') {
    const clickable = onclick ? ' clickable' : '';
    const attrs = onclick ? ` role="button" tabindex="0" onclick="${onclick}" onkeydown="if(event.key==='Enter'||event.key===' ')${onclick}"` : '';
    return `<div class="kpi-card ${cls}${clickable}"${attrs}>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
  }

  function ensureManagerialUi() {
    const page = document.getElementById('page-obras');
    const container = page?.querySelector('.container');
    const monthBar = container?.querySelector('.month-filter-bar');
    const nav = document.querySelector('.page-nav');
    if (!page || !container || !monthBar || !nav) return false;

    if (!document.getElementById('v407-manager-tab')) {
      const btn = document.createElement('button');
      btn.id = 'v407-manager-tab';
      btn.type = 'button';
      btn.className = 'page-btn v407-manager-tab';
      btn.innerHTML = '📈 Visão Gerencial KPIs';
      btn.onclick = () => activateManagerialMode();
      nav.appendChild(btn);
    }

    if (!document.getElementById('v407-managerial-wrap')) {
      const wrap = document.createElement('section');
      wrap.id = 'v407-managerial-wrap';
      wrap.innerHTML = `<div class="v407-manager-head">
        <div><span>Visão Gerencial KPIs</span><strong>Resumo executivo da Curva de Capex</strong><small>Indicadores consolidados para acompanhamento gerencial.</small></div>
        <div class="v407-manager-badge" id="v407-manager-period">Período</div>
      </div>
      <div id="v407-managerial-kpis"></div>
      <section class="v408-manager-chart-card">
        <h3 id="v408-manager-chart-title">📈 Fluxo Previsto vs Realizado (Jan–Dez 2026)</h3>
        <div class="v408-manager-chart-wrap"><canvas id="v408-manager-chart"></canvas></div>
        <div class="v408-manager-chart-note" id="v408-manager-chart-note">Visão executiva do período.</div>
      </section>`;
      monthBar.insertAdjacentElement('afterend', wrap);
    }
    return true;
  }

  let managerialMode = false;
  function activateManagerialMode() {
    if (!ensureManagerialUi()) return;
    managerialMode = true;
    const page = document.getElementById('page-obras');
    page.classList.add('v407-managerial-mode');
    document.querySelectorAll('.page-nav .page-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('v407-manager-tab')?.classList.add('active');
    renderManagerialKpis();
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function deactivateManagerialMode() {
    managerialMode = false;
    document.getElementById('page-obras')?.classList.remove('v407-managerial-mode');
    document.getElementById('v407-manager-tab')?.classList.remove('active');
  }

  let managerialChart = null;

  function managerialChartKeys(model) {
    if (model.explicit && model.keys.length) return model.keys;
    return FLOW_KEYS;
  }

  function managerialChartModel(model) {
    const keys = managerialChartKeys(model);
    const works = currentFilteredWorks();
    const otherFilter = hasOtherCurveFilter();
    const naoPlan = window.HAP_DATA?.naoPlanejado || {};
    const forecast = keys.map(key => {
      const previsto = works.reduce((sum, work) => sum + Number(work?.flow?.[key] || 0), 0);
      const complementoExecutivo = otherFilter ? 0 : Number(naoPlan?.[key] || 0);
      return previsto + complementoExecutivo;
    });
    const realized = keys.map(key => {
      const realizado = works.reduce((sum, work) => sum + Number(work?.[`${key}_real`] || 0), 0);
      const complementoExecutivo = otherFilter ? 0 : Number(naoPlan?.[key] || 0);
      return realizado + complementoExecutivo;
    });
    return { keys, labels: keys.map(key => (FLOW_LABELS[key] || key).toUpperCase()), forecast, realized };
  }

  function renderManagerialChart(model) {
    const canvas = document.getElementById('v408-manager-chart');
    const title = document.getElementById('v408-manager-chart-title');
    const note = document.getElementById('v408-manager-chart-note');
    if (!canvas || typeof window.Chart !== 'function') return;

    const series = managerialChartModel(model);
    if (title) title.textContent = model.explicit
      ? `📈 Fluxo Previsto vs Realizado — ${model.period}`
      : '📈 Fluxo Previsto vs Realizado (Jan–Dez 2026)';
    if (note) note.textContent = model.explicit
      ? `Gráfico sincronizado com o filtro de período: ${model.period}.`
      : 'Fluxo executivo completo da Curva de Capex.';

    if (managerialChart) {
      try { managerialChart.destroy(); } catch (_) {}
      managerialChart = null;
    }

    managerialChart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [
          {
            label: 'Previsto (15/75/10)',
            data: series.forecast,
            borderColor: '#1a5ca8',
            backgroundColor: 'rgba(26,92,168,.10)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: .28,
            fill: true
          },
          {
            label: 'Realizado Total',
            data: series.realized,
            borderColor: '#e07020',
            backgroundColor: 'rgba(224,112,32,.09)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: .28,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { position:'top' },
          tooltip: {
            callbacks: {
              label: context => `${context.dataset.label}: ${money(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: value => money(value).replace(/,00$/, '') },
            grid: { color:'rgba(13,43,78,.10)' }
          },
          x: { grid: { color:'rgba(13,43,78,.08)' } }
        }
      }
    });
  }

  function renderManagerialKpis(model) {
    if (!ensureManagerialUi()) return;
    const m = model || curveKpiModel();
    const grid = document.getElementById('v407-managerial-kpis');
    const period = document.getElementById('v407-manager-period');
    if (!grid) return;
    if (period) period.textContent = m.period;
    const forecastLabel = m.explicit ? 'CAPEX PREVISTO — PERÍODO' : 'CAPEX PREVISTO YTD';
    const totalLabel = m.explicit ? 'REALIZADO TOTAL — PERÍODO' : 'REALIZADO TOTAL YTD';
    const deviationLabel = m.explicit ? 'DESVIO — PERÍODO' : 'DESVIO YTD';
    const devCls = Math.abs(m.deviationPct) > 15 ? 'vermelho' : (Math.abs(m.deviationPct) > 5 ? 'laranja' : 'verde');

    grid.innerHTML = [
      managerialCard('CAPEX Inicial', money(m.initial), 'Base aprovada do portfólio'),
      managerialCard('Contingenciamento', money(m.conting), `${m.period} · clique para detalhar`, 'vermelho', "openKpiPanel('contingenciamento')"),
      managerialCard('Aportes Extras', money(m.aportes), `${m.period} · clique para detalhar`, 'verde', "openKpiPanel('aportes_extras')"),
      managerialCard('CAPEX Atual', money(m.current), m.explicit ? `Inicial + movimentações do período · ${m.period}` : 'CAPEX vigente das obras', '', "openKpiPanel('capex_atual')"),
      managerialCard(forecastLabel, money(m.forecast), `${m.period} · previsto executivo`, 'verde'),
      managerialCard(totalLabel, money(m.realizedTotal), `${m.totalPct.toFixed(1)}% do CAPEX Atual`, 'laranja'),
      managerialCard(deviationLabel, percent(m.deviationPct), `${m.deviationPct > 0 ? 'Realizado acima' : 'Realizado abaixo'} do previsto · ${m.period}`, devCls)
    ].join('');
    renderManagerialChart(m);
  }

  let curveRenderFirstSeenAt = 0;
  function installCurvePatch() {
    if (window.__HAP_V408_CURVE_INSTALLED__) return true;
    if (typeof window.renderKPIs !== 'function' || !document.getElementById('page-obras')) return false;
    if (!curveRenderFirstSeenAt) curveRenderFirstSeenAt = Date.now();
    // Aguarda o v36-curve-addon concluir seu wrapper de CAPEX vigente antes de instalar
    // esta camada. Assim a V40.0.7 fica por último e o filtro mensal não é sobrescrito.
    const renderSource = Function.prototype.toString.call(window.renderKPIs);
    const v36Ready = renderSource.includes('patchCurrentCapexKpi');
    if (!v36Ready && Date.now() - curveRenderFirstSeenAt < 5000) return false;

    injectStyles();
    const previousRenderKPIs = window.renderKPIs;
    const patchedRenderKPIs = function(...args) {
      const out = previousRenderKPIs.apply(this, args);
      const model = applyMonthAwareOperationalKpis();
      renderManagerialKpis(model);
      return out;
    };
    patchedRenderKPIs.__hapV407 = true;
    window.renderKPIs = patchedRenderKPIs;

    if (typeof window.switchPage === 'function') {
      const previousSwitchPage = window.switchPage;
      window.switchPage = function(page, button, ...args) {
        deactivateManagerialMode();
        return previousSwitchPage.call(this, page, button, ...args);
      };
    }

    ensureManagerialUi();
    applyMonthAwareOperationalKpis();
    renderManagerialKpis();
    window.__HAP_V408_CURVE_INSTALLED__ = true;
    console.info(`[HAPCAPEX V${VERSION}] KPIs por período e Visão Gerencial ativos.`);
    return true;
  }

  // ---------------- CONTROLE: ordenação tri-state ----------------
  const controlSort = { dir:'none', col:-1 };

  function parseSortableValue(text) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw === '—' || raw === '-') return { type:'empty', value:'' };
    if (/R\$/.test(raw)) {
      const number = Number(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
      return { type:'number', value:Number.isFinite(number) ? number : 0 };
    }
    if (/%/.test(raw)) {
      const number = Number(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
      return { type:'number', value:Number.isFinite(number) ? number : 0 };
    }
    if (/^\d+(?:\.\d+)?$/.test(raw)) return { type:'number', value:Number(raw) };
    return { type:'text', value:raw.toLocaleLowerCase('pt-BR') };
  }

  function compareCells(a, b, dir) {
    const va = parseSortableValue(a);
    const vb = parseSortableValue(b);
    if (va.type === 'empty' && vb.type !== 'empty') return 1;
    if (vb.type === 'empty' && va.type !== 'empty') return -1;
    let cmp = 0;
    if (va.type === 'number' && vb.type === 'number') cmp = va.value - vb.value;
    else cmp = String(va.value).localeCompare(String(vb.value), 'pt-BR', { numeric:true, sensitivity:'base' });
    return dir === 'desc' ? -cmp : cmp;
  }

  function applyControlSort(table) {
    if (!table) return;
    const body = table.tBodies?.[0];
    if (!body) return;
    const rows = [...body.rows].filter(row => !row.querySelector('.empty-state'));
    rows.forEach((row, index) => {
      if (!row.dataset.v407OriginalIndex) row.dataset.v407OriginalIndex = String(index);
    });
    if (controlSort.dir === 'none' || controlSort.col < 0) {
      rows.sort((a,b) => Number(a.dataset.v407OriginalIndex) - Number(b.dataset.v407OriginalIndex));
    } else {
      rows.sort((a,b) => compareCells(a.cells[controlSort.col]?.innerText, b.cells[controlSort.col]?.innerText, controlSort.dir));
    }
    rows.forEach(row => body.appendChild(row));
  }

  function decorateControlTable() {
    let isCapex = false;
    try { isCapex = typeof state !== 'undefined' && state?.tab === 'capex'; } catch (_) {}
    if (!isCapex) return;
    const table = document.querySelector('.table-card table');
    if (!table?.tHead?.rows?.[0]) return;
    const headers = [...table.tHead.rows[0].cells];
    headers.forEach((th, index) => {
      const title = String(th.textContent || '').trim();
      if (!title || /^Ações$/i.test(title)) return;
      th.classList.add('v407-sortable');
      th.dataset.v407Col = String(index);
      th.dataset.v407Dir = controlSort.col === index ? controlSort.dir : 'none';
      th.title = 'Clique 1: maior→menor · Clique 2: menor→maior · Clique 3: ordem original';
      let indicator = th.querySelector('.v407-sort-indicator');
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'v407-sort-indicator';
        th.appendChild(indicator);
      }
      indicator.textContent = controlSort.col !== index || controlSort.dir === 'none' ? '↕' : (controlSort.dir === 'desc' ? '↓' : '↑');
      th.onclick = () => {
        if (controlSort.col !== index) {
          controlSort.col = index;
          controlSort.dir = 'desc';
        } else if (controlSort.dir === 'desc') {
          controlSort.dir = 'asc';
        } else if (controlSort.dir === 'asc') {
          controlSort.dir = 'none';
          controlSort.col = -1;
        } else {
          controlSort.col = index;
          controlSort.dir = 'desc';
        }
        decorateControlTable();
      };
    });
    applyControlSort(table);
  }

  function installControlPatch() {
    if (window.__HAP_V408_CONTROL_INSTALLED__) return true;
    if (typeof window.renderCapexTab !== 'function') return false;
    injectStyles();
    const previous = window.renderCapexTab;
    window.renderCapexTab = function(...args) {
      const out = previous.apply(this, args);
      decorateControlTable();
      return out;
    };
    // Caso a aba já esteja renderizada quando o patch entrar.
    decorateControlTable();
    window.__HAP_V408_CONTROL_INSTALLED__ = true;
    console.info(`[HAPCAPEX V${VERSION}] Ordenação tri-state do Controle ativa.`);
    return true;
  }

  function boot() {
    injectStyles();

    // V40.0.9: a Curva sinaliza explicitamente quando dashboard-core + v36-addon
    // terminaram de carregar. Isso elimina a dependência de timing que podia fazer
    // a aba Gerencial desaparecer após bloqueio de integridade/reload/PWA.
    const installCurveNow = () => {
      try { installCurvePatch(); } catch (error) { console.error('[HAPCAPEX V40.0.9] Falha ao instalar Visão Gerencial:', error); }
    };
    window.addEventListener('hapcapex:curve-ready', installCurveNow);
    window.addEventListener('pageshow', installCurveNow);

    // Tentativa imediata (caso a Curva já esteja pronta quando este arquivo entrar).
    installCurveNow();
    try { installControlPatch(); } catch (error) { console.error('[HAPCAPEX V40.0.9] Falha ao instalar ordenação:', error); }

    // Fallback resiliente: continua tentando por até 5 minutos, mas só o componente
    // ainda não instalado. Sem MutationObserver, evitando loops de DOM.
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      let curveDone = Boolean(window.__HAP_V408_CURVE_INSTALLED__);
      let controlDone = Boolean(window.__HAP_V408_CONTROL_INSTALLED__);
      if (!curveDone) {
        try { curveDone = installCurvePatch(); } catch (error) { console.error('[HAPCAPEX V40.0.9] Retry Curva:', error); }
      }
      if (!controlDone) {
        try { controlDone = installControlPatch(); } catch (error) { console.error('[HAPCAPEX V40.0.9] Retry Controle:', error); }
      }
      const onControl = /controle-capex\.html$/i.test(location.pathname);
      const targetDone = onControl ? controlDone : curveDone;
      if (targetDone || attempts >= 400) clearInterval(timer);
    }, 750);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
