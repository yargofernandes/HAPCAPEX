/* HAPCAPEX V40.0.35 — Totais dinâmicos nas tabelas CAPEX e Base O.I.
   - Soma apenas as linhas VISÍVEIS após busca/filtro.
   - CAPEX: Montante, Compromissado, Saldo e % Compromissado consolidado.
   - Base O.I.: Montante, Recursos atribuídos e Saldo.
   - O percentual consolidado é Compromissado total / Montante total (não média de percentuais).
*/
(() => {
  'use strict';
  if (window.__HAP_V4035_TABLE_TOTALS__) return;
  window.__HAP_V4035_TABLE_TOTALS__ = true;

  if (!/\/controle-capex\.html$/i.test(window.location.pathname)) return;

  const brlFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  function normalize(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function parseMoney(value) {
    const raw = String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function ensureStyle() {
    if (document.getElementById('hap-v4035-table-totals-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4035-table-totals-style';
    style.textContent = `
      .v4035-table-totals td{
        position:sticky;bottom:0;z-index:2;
        background:#0d2b4e!important;color:#fff!important;
        font-weight:800!important;border-top:2px solid #2e6bbf;
        box-shadow:0 -2px 5px rgba(13,43,78,.12);
        font-variant-numeric:tabular-nums;
      }
      .v4035-table-totals td:first-child{white-space:nowrap}
      .v4035-total-value{white-space:nowrap}
      .v4035-total-pct{display:inline-flex;padding:2px 8px;border-radius:999px;background:#fff;color:#0d2b4e;font-weight:900}
    `;
    document.head.appendChild(style);
  }

  function dataRows(table) {
    return [...(table.tBodies?.[0]?.rows || [])].filter(row => {
      if (!row || !row.cells?.length) return false;
      if (row.querySelector('.empty-state')) return false;
      return true;
    });
  }

  function headerIndex(headers, tests) {
    return headers.findIndex(h => tests.some(test => test(h)));
  }

  function detectTable(table) {
    const headers = [...table.querySelectorAll('thead th')].map(th => normalize(th.textContent));
    if (!headers.length) return null;

    const montante = headerIndex(headers, [h => h === 'MONTANTE', h => h.startsWith('MONTANTE (')]);
    const saldo = headerIndex(headers, [h => h === 'SALDO', h => h.startsWith('SALDO (')]);
    if (montante < 0 || saldo < 0) return null;

    const pctComp = headerIndex(headers, [h => h.includes('% COMP')]);
    const compromissado = headerIndex(headers, [
      h => h === 'COMPROMISSADO',
      h => h.startsWith('RECURSOS ATRIB')
    ]);
    if (compromissado < 0) return null;

    return {
      headers,
      kind: pctComp >= 0 ? 'capex' : 'base_oi',
      montante,
      compromissado,
      saldo,
      pctComp
    };
  }

  function applyToTable(table) {
    const map = detectTable(table);
    if (!map) return;

    const rows = dataRows(table);
    const montante = rows.reduce((sum, row) => sum + parseMoney(row.cells[map.montante]?.textContent), 0);
    const compromissado = rows.reduce((sum, row) => sum + parseMoney(row.cells[map.compromissado]?.textContent), 0);
    const saldo = rows.reduce((sum, row) => sum + parseMoney(row.cells[map.saldo]?.textContent), 0);
    const pctComp = montante > 0 ? compromissado / montante : 0;

    const signature = [map.kind, rows.length, montante.toFixed(2), compromissado.toFixed(2), saldo.toFixed(2), pctComp.toFixed(8)].join('|');
    const current = table.querySelector('tfoot[data-v4035-table-totals]');
    if (current?.dataset.signature === signature) return;
    current?.remove();

    if (!rows.length) return;

    const tfoot = document.createElement('tfoot');
    tfoot.dataset.v4035TableTotals = '1';
    tfoot.dataset.signature = signature;
    const tr = document.createElement('tr');
    tr.className = 'v4035-table-totals';

    map.headers.forEach((_, index) => {
      const td = document.createElement('td');
      if (index === 0) td.textContent = `TOTAL VISÍVEL (${rows.length} ${rows.length === 1 ? 'OI' : 'OIs'})`;
      else if (index === map.montante) {
        td.textContent = brlFmt.format(montante);
        td.className = 'v4035-total-value';
      } else if (index === map.compromissado) {
        td.textContent = brlFmt.format(compromissado);
        td.className = 'v4035-total-value';
      } else if (index === map.saldo) {
        td.textContent = brlFmt.format(saldo);
        td.className = 'v4035-total-value';
      } else if (map.kind === 'capex' && index === map.pctComp) {
        const pill = document.createElement('span');
        pill.className = 'v4035-total-pct';
        pill.textContent = `${(pctComp * 100).toFixed(1)}%`;
        pill.title = 'Compromissado total ÷ Montante total das linhas visíveis';
        td.appendChild(pill);
      } else {
        td.textContent = '';
      }
      tr.appendChild(td);
    });

    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  }

  let scheduled = false;
  function applyAll() {
    scheduled = false;
    ensureStyle();
    document.querySelectorAll('.table-card table').forEach(applyToTable);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyAll);
  }

  function start() {
    ensureStyle();
    schedule();
    const app = document.getElementById('app');
    if (!app) {
      setTimeout(start, 100);
      return;
    }
    const observer = new MutationObserver(schedule);
    observer.observe(app, { childList:true, subtree:true });
    window.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
    window.addEventListener('focus', schedule);
  }

  start();
})();
