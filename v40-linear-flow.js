/* HAPCAPEX V40.0.33 — Regra financeira "Divisão Linear".
   Regra interna: linear_month_fraction
   - Cada mês recebe peso = dias ativos da obra no mês / dias do mês.
   - O CAPEX é distribuído proporcionalmente à soma desses pesos.
   - Datas são inclusivas.
   - A soma do fluxo fecha exatamente no CAPEX em centavos.
   - A regra escolhida explicitamente tem prioridade inclusive para obras _OPER.
*/
(() => {
  'use strict';
  if (window.__HAP_V4033_LINEAR_FLOW__) return;
  window.__HAP_V4033_LINEAR_FLOW__ = true;

  const VERSION = '40.0.33';
  const RULE = 'linear_month_fraction';
  const EPS = 0.005;
  let installed = false;

  function parseDate(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return null;
    let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return { y:Number(m[3]), m:Number(m[2]), d:Number(m[1]) };
    m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return { y:Number(m[1]), m:Number(m[2]), d:Number(m[3]) };
    return null;
  }

  function validDateParts(p) {
    if (!p || !Number.isInteger(p.y) || !Number.isInteger(p.m) || !Number.isInteger(p.d)) return false;
    if (p.m < 1 || p.m > 12 || p.d < 1) return false;
    return p.d <= daysInMonth(p.y, p.m);
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function serialDay(p) {
    return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }

  function monthKey(year, month) {
    if (typeof MONTHS === 'undefined' || !Array.isArray(MONTHS)) return null;
    const index = (Number(year) - 2026) * 12 + (Number(month) - 1);
    return index >= 0 && index < MONTHS.length ? MONTHS[index].key : null;
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
    const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
    if (!(totalCents > 0) || !(totalWeight > 0)) return segments.map(() => 0);

    const allocations = [];
    let used = 0;
    for (let i = 0; i < segments.length; i++) {
      if (i === segments.length - 1) {
        allocations.push(totalCents - used);
        break;
      }
      const cents = Math.round(totalCents * segments[i].weight / totalWeight);
      allocations.push(cents);
      used += cents;
    }

    // Proteção para CAPEX extremamente pequeno dividido por muitos meses:
    // se o arredondamento dos meses anteriores ultrapassar o total, usa método
    // de maiores restos, que nunca produz parcela negativa e continua fechando em centavos.
    if (allocations.some(v => v < 0)) {
      const exact = segments.map(s => totalCents * s.weight / totalWeight);
      const floor = exact.map(v => Math.floor(v));
      let remainder = totalCents - floor.reduce((a,b) => a + b, 0);
      const order = exact.map((v,i) => ({ i, frac:v - floor[i] }))
        .sort((a,b) => b.frac - a.frac || a.i - b.i);
      for (let i = 0; i < remainder; i++) floor[order[i % order.length].i] += 1;
      return floor;
    }
    return allocations;
  }

  function computeLinearFlow(obra, original) {
    const flow = {};
    if (typeof MONTHS === 'undefined' || !Array.isArray(MONTHS)) return original(obra);
    MONTHS.forEach(month => { flow[month.key] = 0; });

    const capex = Math.max(0, Number(obra?.capex || 0));
    if (capex <= EPS) return flow;

    const start = parseDate(obra?.inicio);
    const end = parseDate(obra?.fim);
    if (!validDateParts(start) || !validDateParts(end) || serialDay(end) < serialDay(start)) {
      console.warn('[HAPCAPEX V40.0.33] Divisão Linear ignorada: datas inválidas.', obra?.nome, obra?.inicio, obra?.fim);
      return original({ ...obra, _flowRule:'standard_15_75_10' });
    }

    const allSegments = buildSegments(start, end);
    const unsupported = allSegments.filter(s => !s.key);
    const segments = allSegments.filter(s => s.key);
    if (!segments.length || unsupported.length) {
      console.warn('[HAPCAPEX V40.0.33] Divisão Linear fora do horizonte exibido pela Curva.', obra?.nome, obra?.inicio, obra?.fim);
      return original({ ...obra, _flowRule:'standard_15_75_10' });
    }

    const totalCents = Math.round(capex * 100);
    const allocations = allocateCents(totalCents, segments);
    segments.forEach((segment, index) => {
      flow[segment.key] = allocations[index] / 100;
    });

    obra._linearMonthFraction = {
      version:VERSION,
      totalWeight:segments.reduce((sum, s) => sum + s.weight, 0),
      segments:segments.map((s, i) => ({
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
    if (!rules.some(rule => String(rule?.code || '') === RULE)) {
      rules.push({
        code:RULE,
        name:'Divisão Linear',
        description:'Distribui o CAPEX proporcionalmente à fração de cada mês entre as datas de início e término da obra.',
        selectable:true,
        sort_order:115,
        default_params:{}
      });
      rules.sort((a,b) => Number(a?.sort_order || 999) - Number(b?.sort_order || 999));
    }
    return true;
  }

  function install() {
    ensureRuleCatalog();
    if (installed) return true;
    let original = null;
    try {
      if (typeof computeFlowRaw === 'function') original = computeFlowRaw;
    } catch (_) {}
    if (!original && typeof window.computeFlowRaw === 'function') original = window.computeFlowRaw;
    if (!original || original.__hapV4033LinearPatched) return !!original?.__hapV4033LinearPatched;

    const patched = function(obra) {
      if (String(obra?._flowRule || '') === RULE) return computeLinearFlow(obra, original);
      return original(obra);
    };
    patched.__hapV4033LinearPatched = true;
    patched.__hapV4033Original = original;

    try { computeFlowRaw = patched; } catch (_) {}
    try { window.computeFlowRaw = patched; } catch (_) {}
    installed = true;
    window.HAP_V40_LINEAR_FLOW = {
      version:VERSION,
      rule:RULE,
      buildSegments,
      allocateCents,
      computeLinearFlow,
      ensureRuleCatalog
    };
    return true;
  }

  window.addEventListener('hapcapex:curve-ready', () => { install(); }, { once:false });
  [0,50,150,400,1000,2500].forEach(ms => setTimeout(install, ms));
})();
