/* HAPCAPEX V40.0.33 — Estado visual de Aporte Extra + loaders de Aporte Vinculado e Divisão Linear. */
(() => {
  'use strict';

  const EPS = 0.005;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*-\s*CONTIN?G[^-]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function orderTokens(value) {
    return (String(value || '').match(/\d{8}/g) || []);
  }

  function activeAporteRows() {
    const rows = window.HAP_DATA?.settings?.aportes_detalhe;
    return (Array.isArray(rows) ? rows : []).filter(row => {
      const valor = Number(row?.valor || 0);
      return valor > EPS && row?.cancelado !== true;
    });
  }

  function rowMatchesWork(row, work) {
    const rowOi = String(row?.ordem_interna || row?.oi || row?.ordem || '').trim();
    if (rowOi) {
      const workTokens = new Set(orderTokens(work?.ordem));
      if (workTokens.has(rowOi) || orderTokens(rowOi).some(token => workTokens.has(token))) return true;
    }

    const a = normalize(row?.nome);
    const b = normalize(work?.nome);
    if (!a || !b) return false;
    const shortA = a.slice(0, 28);
    const shortB = b.slice(0, 28);
    return a === b || b.includes(shortA) || a.includes(shortB);
  }

  function activeAporteValue(work) {
    return activeAporteRows()
      .filter(row => rowMatchesWork(row, work))
      .reduce((sum, row) => sum + Number(row?.valor || 0), 0);
  }

  function statusForWork(work) {
    const aporte = activeAporteValue(work);
    if (aporte <= EPS) return { type: 'none', aporte: 0 };
    const capex = Math.max(0, Number(work?.capex || 0));
    const total = capex > EPS && aporte >= capex - EPS;
    return { type: total ? 'total' : 'partial', aporte, capex };
  }

  function findWorkByCell(cell) {
    const works = Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : [];
    if (!works.length) return null;

    const cloned = cell.cloneNode(true);
    cloned.querySelectorAll(
      '.badge-aporte,.v4011-aporte-badge,.v4010-aporte-badge,.badge-atencao,.badge-contingenciada,.v3792-cancelled-tag'
    ).forEach(el => el.remove());

    const label = normalize(cloned.textContent);
    if (!label) return null;

    return works.find(work => {
      const name = normalize(work?.nome);
      const cleanName = name.replace(/\s*-\s*CONTIN?G[^-]*$/i, '').trim();
      return label === cleanName || label.includes(cleanName) || cleanName.includes(label);
    }) || null;
  }

  function ensureStyle() {
    if (document.getElementById('hap-v4011-aporte-style')) return;
    document.getElementById('hap-v4010-aporte-style')?.remove();

    const style = document.createElement('style');
    style.id = 'hap-v4011-aporte-style';
    style.textContent = `
      .v4011-aporte-badge{display:inline-flex;align-items:center;margin-left:6px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}
      .v4011-aporte-total{background:#188a43;color:#fff}
      .v4011-aporte-partial{background:#eaf8ef;color:#13763a;border:1px solid #62b77d}
    `;
    document.head.appendChild(style);
  }

  function reconcileBadges() {
    if (!window.HAP_DATA || !Array.isArray(window.HAP_RUNTIME_OBRAS)) return;
    ensureStyle();

    document.querySelectorAll('.obra-row td:first-child').forEach(cell => {
      const work = findWorkByCell(cell);
      cell.querySelectorAll('.badge-aporte,.v4010-aporte-badge,.v4011-aporte-badge')
        .forEach(el => el.remove());
      if (!work) return;

      const status = statusForWork(work);
      if (status.type === 'none') return;

      const badge = document.createElement('span');
      badge.className = `v4011-aporte-badge ${
        status.type === 'partial' ? 'v4011-aporte-partial' : 'v4011-aporte-total'
      }`;
      badge.textContent = status.type === 'partial'
        ? '💚 APORTE EXTRA PARCIAL'
        : '💚 APORTE EXTRA';
      badge.title = `Aporte extra ativo: ${
        new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(status.aporte)
      }`;
      cell.append(' ', badge);
    });
  }

  function runSoon() {
    setTimeout(reconcileBadges, 0);
    setTimeout(reconcileBadges, 120);
    setTimeout(reconcileBadges, 400);
  }

  function loadLinkedAporteV4032(){
    if (window.__HAP_V4032_LOADER__ || document.querySelector('script[data-hap-v4032-linked-aporte]')) return;
    window.__HAP_V4032_LOADER__ = true;
    const script = document.createElement('script');
    script.src = './v40-linked-aporte.js?v=40.0.33';
    script.async = false;
    script.dataset.hapV4032LinkedAporte = '1';
    script.onerror = () => { window.__HAP_V4032_LOADER__ = false; };
    document.head.appendChild(script);
  }


  function loadLinearFlowV4033(){
    if (window.__HAP_V4033_LINEAR_LOADER__ || document.querySelector('script[data-hap-v4033-linear-flow]')) return;
    window.__HAP_V4033_LINEAR_LOADER__ = true;
    const script = document.createElement('script');
    script.src = './v40-linear-flow.js?v=40.0.33';
    script.async = false;
    script.dataset.hapV4033LinearFlow = '1';
    script.onerror = () => { window.__HAP_V4033_LINEAR_LOADER__ = false; };
    document.head.appendChild(script);
  }

  window.addEventListener('hapcapex:curve-ready', runSoon);
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) runSoon();
  });

  setInterval(reconcileBadges, 900);
  setTimeout(reconcileBadges, 350);
  loadLinkedAporteV4032();
  loadLinearFlowV4033();
})();
