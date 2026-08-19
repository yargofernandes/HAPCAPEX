/* HAPCAPEX V40.0.34 — Divisão Linear determinística + sincronização da Curva e painel lateral.
   Regra interna: linear_month_fraction

   Princípios:
   - A obra termina exatamente na data de término: não existe retenção pós-obra.
   - Cada mês recebe peso = dias ativos da obra no mês / dias do respectivo mês.
   - Datas são inclusivas.
   - A soma mensal fecha exatamente no CAPEX em centavos.
   - A regra escolhida explicitamente prevalece inclusive para obras _OPER.
   - Obras já carregadas antes deste addon são recalculadas e a UI é redesenhada.
*/
(() => {
  'use strict';
  if (window.__HAP_V4034_LINEAR_FLOW__) return;
  window.__HAP_V4034_LINEAR_FLOW__ = true;

  const VERSION = '40.0.34';
  const RULE = 'linear_month_fraction';
  const EPS = 0.005;
  let installed = false;
  let panelPatched = false;
  let originalRaw = null;
  let originalFlow = null;
  let originalOpenPanel = null;

  const FALLBACK_MONTHS = [
    ['jan','JAN/26'],['fev','FEV/26'],['mar','MAR/26'],['abr','ABR/26'],
    ['mai','MAI/26'],['jun','JUN/26'],['jul','JUL/26'],['ago','AGO/26'],
    ['set','SET/26'],['out','OUT/26'],['nov','NOV/26'],['dez','DEZ/26'],
    ['jan27','JAN/27'],['fev27','FEV/27'],['mar27','MAR/27'],['abr27','ABR/27'],
    ['mai27','MAI/27'],['jun27','JUN/27'],['jul27','JUL/27']
  ].map(([key,label]) => ({key,label}));

  function months() {
    try { if (typeof MONTHS !== 'undefined' && Array.isArray(MONTHS)) return MONTHS; } catch (_) {}
    return FALLBACK_MONTHS;
  }

  function parseDate(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return null;
    let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return { y:Number(m[3]), m:Number(m[2]), d:Number(m[1]) };
    m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return { y:Number(m[1]), m:Number(m[2]), d:Number(m[3]) };
    return null;
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function validDateParts(p) {
    return !!p && Number.isInteger(p.y) && Number.isInteger(p.m) && Number.isInteger(p.d)
      && p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= daysInMonth(p.y,p.m);
  }

  function serialDay(p) {
    return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }

  function monthKey(year, month) {
    const list = months();
    const index = (Number(year) - 2026) * 12 + (Number(month) - 1);
    return index >= 0 && index < list.length ? list[index].key : null;
  }

  function nextMonth(year, month) {
    return month === 12 ? { y:year + 1, m:1 } : { y:year, m:month + 1 };
  }

  function buildSegments(start, end) {
    const segments = [];
    let cursor = { y:start.y, m:start.m };
    const endMonthSerial = end.y * 12 + end.m;
    let guard = 0;
    while (cursor.y * 12 + cursor.m <= endMonthSerial && guard++ < 120) {
      const dim = daysInMonth(cursor.y, cursor.m);
      const activeStart = (cursor.y === start.y && cursor.m === start.m) ? start.d : 1;
      const activeEnd = (cursor.y === end.y && cursor.m === end.m) ? end.d : dim;
      const activeDays = Math.max(0, activeEnd - activeStart + 1);
      if (activeDays > 0) {
        segments.push({
          year:cursor.y,
          month:cursor.m,
          key:monthKey(cursor.y, cursor.m),
          activeDays,
          daysInMonth:dim,
          weight:activeDays / dim
        });
      }
      cursor = nextMonth(cursor.y, cursor.m);
    }
    return segments;
  }

  function allocateCents(totalCents, segments) {
    const totalWeight = segments.reduce((sum,s) => sum + Number(s.weight || 0), 0);
    if (!(totalCents > 0) || !(totalWeight > 0) || !segments.length) return segments.map(() => 0);

    // Método dos maiores restos: sempre fecha em centavos e nunca cria parcela negativa.
    const exact = segments.map(s => totalCents * s.weight / totalWeight);
    const floor = exact.map(v => Math.floor(v));
    let remainder = totalCents - floor.reduce((a,b) => a + b, 0);
    const order = exact.map((v,i) => ({i, frac:v - floor[i]}))
      .sort((a,b) => b.frac - a.frac || a.i - b.i);
    for (let i=0; i<remainder; i++) floor[order[i % order.length].i] += 1;
    return floor;
  }

  function emptyFlow() {
    const flow = {};
    months().forEach(month => { flow[month.key] = 0; });
    return flow;
  }

  function computeLinearFlow(obra, fallback) {
    const flow = emptyFlow();
    const capex = Math.max(0, Number(obra?.capex || 0));
    if (capex <= EPS) return flow;

    const start = parseDate(obra?.inicio);
    const end = parseDate(obra?.fim);
    if (!validDateParts(start) || !validDateParts(end) || serialDay(end) < serialDay(start)) {
      console.error('[HAPCAPEX V40.0.34] Divisão Linear exige datas válidas.', obra?.nome, obra?.inicio, obra?.fim);
      return typeof fallback === 'function' ? fallback(obra) : flow;
    }

    const allSegments = buildSegments(start,end);
    const unsupported = allSegments.filter(segment => !segment.key);
    const segments = allSegments.filter(segment => segment.key);
    if (!segments.length || unsupported.length) {
      console.error('[HAPCAPEX V40.0.34] Datas da Divisão Linear ultrapassam o horizonte da Curva.', obra?.nome, obra?.inicio, obra?.fim);
      return typeof fallback === 'function' ? fallback(obra) : flow;
    }

    const totalCents = Math.round(capex * 100);
    const allocations = allocateCents(totalCents,segments);
    segments.forEach((segment,index) => { flow[segment.key] = allocations[index] / 100; });

    obra._linearMonthFraction = {
      version:VERSION,
      start:obra?.inicio || null,
      end:obra?.fim || null,
      totalWeight:segments.reduce((sum,s) => sum + s.weight,0),
      segments:segments.map((s,i) => ({
        key:s.key,
        activeDays:s.activeDays,
        daysInMonth:s.daysInMonth,
        weight:s.weight,
        value:allocations[i] / 100
      }))
    };
    return flow;
  }

  function ensureRuleCatalog() {
    const rules = window.HAP_DATA?.flowRules;
    if (!Array.isArray(rules)) return false;
    const existing = rules.find(rule => String(rule?.code || '') === RULE);
    if (existing) {
      existing.name = 'Divisão Linear';
      existing.description = 'Distribui o CAPEX proporcionalmente à fração de cada mês entre as datas de início e término. A obra encerra exatamente no mês de término, sem retenção posterior.';
      existing.selectable = true;
    } else {
      rules.push({
        code:RULE,
        name:'Divisão Linear',
        description:'Distribui o CAPEX proporcionalmente à fração de cada mês entre as datas de início e término. A obra encerra exatamente no mês de término, sem retenção posterior.',
        selectable:true,
        sort_order:115,
        default_params:{}
      });
    }
    rules.sort((a,b) => Number(a?.sort_order || 999) - Number(b?.sort_order || 999));
    return true;
  }

  function getRule(obra) {
    return String(obra?._flowRule || obra?.flow_rule || '').trim();
  }

  function installFlowPatches() {
    ensureRuleCatalog();
    if (installed) return true;

    try { if (typeof computeFlowRaw === 'function') originalRaw = computeFlowRaw; } catch (_) {}
    if (!originalRaw && typeof window.computeFlowRaw === 'function') originalRaw = window.computeFlowRaw;
    try { if (typeof computeFlow === 'function') originalFlow = computeFlow; } catch (_) {}
    if (!originalFlow && typeof window.computeFlow === 'function') originalFlow = window.computeFlow;

    if (!originalRaw || !originalFlow) return false;
    if (originalFlow.__hapV4034LinearPatched) { installed = true; return true; }

    const patchedRaw = function(obra) {
      if (getRule(obra) === RULE) return computeLinearFlow(obra, originalRaw);
      return originalRaw(obra);
    };
    patchedRaw.__hapV4034LinearPatched = true;
    patchedRaw.__hapV4034Original = originalRaw;

    const patchedFlow = function(obra) {
      // Bypass completo das regras 15/75/10 e _OPER quando Divisão Linear foi escolhida.
      if (getRule(obra) === RULE) return computeLinearFlow(obra, originalFlow);
      return originalFlow(obra);
    };
    patchedFlow.__hapV4034LinearPatched = true;
    patchedFlow.__hapV4034Original = originalFlow;

    try { computeFlowRaw = patchedRaw; } catch (_) {}
    try { window.computeFlowRaw = patchedRaw; } catch (_) {}
    try { computeFlow = patchedFlow; } catch (_) {}
    try { window.computeFlow = patchedFlow; } catch (_) {}

    installed = true;
    return true;
  }

  function relevantPanelKeys(obra) {
    const list = months();
    const used = list.filter(month => Math.abs(Number(obra?.flow?.[month.key] || 0)) > EPS
      || Math.abs(Number(obra?.[month.key + '_real'] || 0)) > EPS);
    if (used.length) return used.map(month => month.key);

    const start = parseDate(obra?.inicio);
    const end = parseDate(obra?.fim);
    if (validDateParts(start) && validDateParts(end) && serialDay(end) >= serialDay(start)) {
      return buildSegments(start,end).map(segment => segment.key).filter(Boolean);
    }
    return list.slice(0,12).map(month => month.key);
  }

  function formatMoney(value, compact=false) {
    if (typeof window.fmt === 'function') return window.fmt(Number(value || 0),compact);
    const n = Number(value || 0);
    if (!n) return '-';
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
  }

  function formatPct(value) {
    try { if (typeof pct === 'function') return pct(value); } catch (_) {}
    return `${Number(value || 0).toFixed(1).replace('.',',')}%`;
  }

  function refreshOpenPanel(idx) {
    const works = Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : [];
    const obra = works[Number(idx)];
    if (!obra) return;

    const keys = relevantPanelKeys(obra);
    const list = months();
    const labelByKey = new Map(list.map(month => [month.key,month.label]));
    const labels = keys.map(key => labelByKey.get(key) || String(key).toUpperCase());
    const prevVals = keys.map(key => Number(obra?.flow?.[key] || 0));
    const realVals = keys.map(key => Number(obra?.[key + '_real'] || 0));

    const canvas = document.getElementById('panel-chart');
    if (canvas && window.Chart) {
      try { window.Chart.getChart?.(canvas)?.destroy(); } catch (_) {}
      try {
        new window.Chart(canvas,{
          type:'bar',
          data:{
            labels,
            datasets:[
              {label:'Previsto',data:prevVals,backgroundColor:'rgba(26,92,168,0.6)',borderRadius:4},
              {label:'Realizado',data:realVals,backgroundColor:'rgba(224,112,32,0.8)',borderRadius:4}
            ]
          },
          options:{
            responsive:true,
            maintainAspectRatio:false,
            plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${formatMoney(ctx.raw)}`}}},
            scales:{y:{beginAtZero:true,ticks:{callback:value=>formatMoney(value,true)}}}
          }
        });
      } catch (error) { console.warn('[HAPCAPEX V40.0.34] Falha ao redesenhar gráfico lateral',error); }
    }

    const strip = document.getElementById('panel-dev-strip');
    if (strip) {
      strip.innerHTML = '';
      keys.forEach(key => {
        const realized = Number(obra?.[key + '_real'] || 0);
        const planned = Number(obra?.flow?.[key] || 0);
        const deviation = planned > EPS ? ((realized-planned)/planned)*100 : 0;
        const cls = (Math.abs(realized)<=EPS && Math.abs(planned)<=EPS) ? 'zero' : (deviation>=0?'pos':'neg');
        strip.insertAdjacentHTML('beforeend',`<div class="dev-chip ${cls}">
          <div class="dev-chip-mes">${String(labelByKey.get(key) || key).replace('/26','').replace('/27','')}</div>
          <div class="dev-chip-pct">${(Math.abs(realized)<=EPS&&Math.abs(planned)<=EPS)?'—':formatPct(deviation)}</div>
          <div class="dev-chip-vals">${formatMoney(realized,true)}<br>${formatMoney(planned,true)}</div>
        </div>`);
      });
    }

    const totalReal = Number(obra?.total_real || 0);
    const totalPrev = keys.reduce((sum,key) => sum + Number(obra?.flow?.[key] || 0),0);
    const totalDev = totalPrev > EPS ? ((totalReal-totalPrev)/totalPrev)*100 : 0;
    const prevEl = document.getElementById('panel-total-prev');
    const realEl = document.getElementById('panel-total-real');
    const devEl = document.getElementById('panel-total-dev');
    if (prevEl) prevEl.textContent = formatMoney(totalPrev) || '—';
    if (realEl) realEl.textContent = formatMoney(totalReal) || '—';
    if (devEl) {
      devEl.textContent = totalPrev > EPS ? formatPct(totalDev) : '—';
      devEl.className = 't-dev ' + (totalDev >= 0 ? 'pos' : 'neg');
    }
  }

  function installPanelPatch() {
    if (panelPatched) return true;
    try { if (typeof openPanel === 'function') originalOpenPanel = openPanel; } catch (_) {}
    if (!originalOpenPanel && typeof window.openPanel === 'function') originalOpenPanel = window.openPanel;
    if (!originalOpenPanel) return false;
    if (originalOpenPanel.__hapV4034PanelPatched) { panelPatched = true; return true; }

    const patchedOpenPanel = function(idx) {
      const result = originalOpenPanel(idx);
      setTimeout(() => refreshOpenPanel(idx),0);
      return result;
    };
    patchedOpenPanel.__hapV4034PanelPatched = true;
    patchedOpenPanel.__hapV4034Original = originalOpenPanel;
    try { openPanel = patchedOpenPanel; } catch (_) {}
    try { window.openPanel = patchedOpenPanel; } catch (_) {}
    panelPatched = true;
    return true;
  }

  function fixGenericLabels() {
    document.querySelectorAll('button,.tab-btn,.kpi-sub').forEach(el => {
      const text = String(el.textContent || '').trim();
      if (text === 'Fluxo Previsto (15/75/10)') el.textContent = 'Fluxo Previsto';
      if (text.includes('Modelo 15/75/10 · obras planejadas')) {
        el.textContent = text.replace('Modelo 15/75/10','Regras financeiras por obra');
      }
    });
    try {
      const instances = window.Chart?.instances ? Object.values(window.Chart.instances) : [];
      instances.forEach(chart => {
        let changed = false;
        (chart?.data?.datasets || []).forEach(dataset => {
          if (dataset?.label === 'Previsto (15/75/10)') { dataset.label = 'Previsto'; changed = true; }
        });
        if (changed) chart.update('none');
      });
    } catch (_) {}
  }

  function rerenderCurve() {
    const works = Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : [];
    const calculate = typeof window.computeFlow === 'function' ? window.computeFlow : null;
    if (!calculate || !works.length) return false;

    let changed = false;
    works.forEach(obra => {
      if (getRule(obra) !== RULE) return;
      obra.flow = calculate(obra);
      changed = true;
    });
    if (!changed) return true;

    const renderers = ['renderTablePrev','renderTableReal','renderCharts','renderKPIs','renderRiskPanel','renderAnalysis'];
    renderers.forEach(name => {
      try { if (typeof window[name] === 'function') window[name](); } catch (error) {
        console.warn(`[HAPCAPEX V40.0.34] ${name} não pôde ser redesenhado`,error);
      }
    });
    fixGenericLabels();
    return true;
  }

  function installAll() {
    ensureRuleCatalog();
    const flowReady = installFlowPatches();
    const panelReady = installPanelPatch();
    if (flowReady) rerenderCurve();
    fixGenericLabels();
    return flowReady && panelReady;
  }

  window.addEventListener('hapcapex:curve-ready',() => {
    setTimeout(installAll,0);
    setTimeout(installAll,120);
  });
  window.addEventListener('visibilitychange',() => { if (!document.hidden) setTimeout(installAll,0); });
  [0,50,150,400,900,1600,2800].forEach(ms => setTimeout(installAll,ms));

  window.HAP_V40_LINEAR_FLOW = {
    version:VERSION,
    rule:RULE,
    buildSegments,
    allocateCents,
    computeLinearFlow,
    rerenderCurve,
    refreshOpenPanel,
    installAll
  };
})();
