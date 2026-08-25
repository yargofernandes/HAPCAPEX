/* HAPCAPEX V40.0.51 — Totais dinâmicos nas tabelas CAPEX e Base O.I.
   - CAPEX usa a MESMA base dos KPIs: exclui a O.I. técnica 9999999999.
   - A linha técnica continua visível na tabela, mas não entra nos totais financeiros.
   - Soma somente linhas visíveis após busca/filtros.
   - CAPEX: Montante, Compromissado, Saldo e % consolidado.
   - Base O.I.: Montante, Recursos atribuídos e Saldo.
*/
(() => {
  'use strict';

  // Remove a trava de versões anteriores, caso o arquivo seja atualizado em sessão viva.
  if (window.__HAP_V4051_TABLE_TOTALS__) return;
  window.__HAP_V4051_TABLE_TOTALS__ = true;

  if (!/controle-capex\.html\/?$/i.test(window.location.pathname)) return;

  const VERSION = '40.0.51';

  const brlFmt = new Intl.NumberFormat('pt-BR', {
    style:'currency',
    currency:'BRL',
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });

  function normalize(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function cleanHeader(value) {
    return normalize(value)
      .replace(/[↑↓↕⇅⇵▲▼▴▾⇧⇩]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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
    if (document.getElementById('hap-v4051-table-totals-style')) return;

    document.getElementById('hap-v4035-table-totals-style')?.remove();
    document.getElementById('hap-v4036-table-totals-style')?.remove();
    document.getElementById('hap-v4037-table-totals-style')?.remove();

    const style = document.createElement('style');
    style.id = 'hap-v4051-table-totals-style';
    style.textContent = `
      .table-card table tfoot[data-v4051-table-totals]{display:table-footer-group}

      .v4051-table-totals td{
        position:sticky;
        bottom:0;
        z-index:4;
        background:#0d2b4e!important;
        color:#fff!important;
        font-weight:800!important;
        border-top:2px solid #2e6bbf!important;
        box-shadow:0 -2px 6px rgba(13,43,78,.18);
        font-variant-numeric:tabular-nums;
        padding:9px 10px!important
      }

      .v4051-table-totals td:first-child{white-space:nowrap}
      .v4051-total-value{white-space:nowrap}

      .v4051-total-pct{
        display:inline-flex;
        align-items:center;
        padding:2px 8px;
        border-radius:999px;
        background:#fff;
        color:#0d2b4e;
        font-weight:900;
        white-space:nowrap
      }
    `;
    document.head.appendChild(style);
  }

  function visibleRows(table) {
    return [...(table.tBodies?.[0]?.rows || [])].filter(row => {
      if (!row || !row.cells?.length) return false;
      if (row.querySelector('.empty-state')) return false;
      if (row.hidden) return false;

      const style = window.getComputedStyle(row);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function detectTable(table) {
    const headers = [...table.querySelectorAll('thead tr:first-child th')]
      .map(th => cleanHeader(
        th.childNodes?.[0]?.textContent || th.textContent
      ));

    if (!headers.length) return null;

    const oi = headers.findIndex(h => h === 'OI' || h.startsWith('OI '));
    const obra = headers.findIndex(h => h === 'OBRA' || h.startsWith('OBRA '));
    const montante = headers.findIndex(h => h.startsWith('MONTANTE'));
    const saldo = headers.findIndex(h => h.startsWith('SALDO'));
    const pctComp = headers.findIndex(h => h.includes('% COMP'));
    const compromissado = headers.findIndex(
      h => h.includes('COMPROMISSADO') || h.startsWith('RECURSOS ATRIB')
    );

    if (montante < 0 || compromissado < 0 || saldo < 0) return null;

    return {
      headers,
      kind: pctComp >= 0 && obra >= 0 ? 'capex' : 'base_oi',
      oi,
      obra,
      montante,
      compromissado,
      saldo,
      pctComp
    };
  }

  function isTechnicalContingencyRow(row, map) {
    if (map.kind !== 'capex') return false;

    const oiText = normalize(row.cells[map.oi]?.textContent || '');
    const obraText = normalize(row.cells[map.obra]?.textContent || '');

    // No render nativo, a O.I. 9999999999 é deliberadamente exibida como "—".
    // É a única linha técnica sem O.I. operacional na aba CAPEX.
    const noOperationalOi =
      !oiText ||
      oiText === '—' ||
      oiText === '-' ||
      oiText === '9999999999';

    // Confirmação adicional quando a descrição explicita contingência.
    // A condição "sem O.I. operacional" permanece suficiente para compatibilidade
    // com o render atual, no qual 9999999999 vira "—".
    const contingencyLabel =
      obraText.includes('CONTING') ||
      obraText.includes('CONTINGENCIAMENTO');

    return noOperationalOi || contingencyLabel && oiText === '9999999999';
  }

  function financialRows(table, map) {
    const visible = visibleRows(table);

    if (map.kind !== 'capex') {
      return { visible, financial: visible, excludedTechnical: 0 };
    }

    const financial = visible.filter(row => !isTechnicalContingencyRow(row, map));

    return {
      visible,
      financial,
      excludedTechnical: visible.length - financial.length
    };
  }

  function applyToTable(table) {
    const map = detectTable(table);
    if (!map) return;

    table.querySelector('tfoot[data-v4035-table-totals]')?.remove();
    table.querySelector('tfoot[data-v4036-table-totals]')?.remove();
    table.querySelector('tfoot[data-v4037-table-totals]')?.remove();

    const { visible, financial, excludedTechnical } = financialRows(table, map);

    if (!visible.length) {
      table.querySelector('tfoot[data-v4051-table-totals]')?.remove();
      return;
    }

    const rows = financial;

    const montante = rows.reduce(
      (s,row) => s + parseMoney(row.cells[map.montante]?.textContent),
      0
    );

    const compromissado = rows.reduce(
      (s,row) => s + parseMoney(row.cells[map.compromissado]?.textContent),
      0
    );

    const saldo = rows.reduce(
      (s,row) => s + parseMoney(row.cells[map.saldo]?.textContent),
      0
    );

    const pctComp = montante > 0 ? compromissado / montante : 0;

    const signature = [
      map.kind,
      visible.length,
      rows.length,
      excludedTechnical,
      montante.toFixed(2),
      compromissado.toFixed(2),
      saldo.toFixed(2),
      pctComp.toFixed(8)
    ].join('|');

    const current = table.querySelector('tfoot[data-v4051-table-totals]');
    if (current?.dataset.signature === signature) return;

    current?.remove();

    const tfoot = document.createElement('tfoot');
    tfoot.dataset.v4051TableTotals = '1';
    tfoot.dataset.signature = signature;

    const tr = document.createElement('tr');
    tr.className = 'v4051-table-totals';

    map.headers.forEach((_, index) => {
      const td = document.createElement('td');

      if (index === 0) {
        const labelCount = map.kind === 'capex' ? rows.length : visible.length;
        td.textContent =
          `TOTAL VISÍVEL (${labelCount} ${labelCount === 1 ? 'OI' : 'OIs'})`;

        if (map.kind === 'capex' && excludedTechnical > 0) {
          td.title =
            'A O.I. técnica de contingenciamento 9999999999 permanece visível, ' +
            'mas não participa dos totais financeiros nem do % Compromissado.';
        }
      }
      else if (index === map.montante) {
        td.textContent = brlFmt.format(montante);
        td.className = 'v4051-total-value';
      }
      else if (index === map.compromissado) {
        td.textContent = brlFmt.format(compromissado);
        td.className = 'v4051-total-value';
      }
      else if (index === map.saldo) {
        td.textContent = brlFmt.format(saldo);
        td.className = 'v4051-total-value';
      }
      else if (map.kind === 'capex' && index === map.pctComp) {
        const pill = document.createElement('span');
        pill.className = 'v4051-total-pct';
        pill.textContent = `${(pctComp * 100).toFixed(1)}%`;
        pill.title =
          'Compromissado ÷ Montante das OIs operacionais visíveis. ' +
          'A O.I. técnica 9999999999 é excluída, assim como no KPI.';
        td.appendChild(pill);
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

    observer.observe(app, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['style','hidden','class']
    });

    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule();
    });

    window.addEventListener('focus', schedule);

    // Mantém o mesmo nome público usado pelos filtros V40.0.50.
    window.HAP_V40_TABLE_TOTALS = {
      version: VERSION,
      refresh: applyAll,
      detectTable,
      isTechnicalContingencyRow
    };
  }

  start();
})();
