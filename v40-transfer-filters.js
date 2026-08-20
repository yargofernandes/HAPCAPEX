/* HAPCAPEX V40.0.41 — Filtros por coluna e totais dinâmicos em Transferências.
   Atua apenas na aba Transferências e não altera dados no backend.
   O total considera exclusivamente as linhas visíveis após TODOS os filtros.
*/
(() => {
  'use strict';
  if (window.__HAP_V4041_TRANSFER_FILTERS__) return;
  window.__HAP_V4041_TRANSFER_FILTERS__ = true;

  const VERSION = '40.0.41';
  const filters = {
    documento: '',
    origem: '',
    destino: '',
    valorMin: '',
    valorMax: '',
    data: '',
    justificativa: ''
  };

  const brlFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function terms(value) {
    const raw = normalize(value);
    if (!raw) return [];
    if (/[;,\n]/.test(raw)) return raw.split(/[;,\n]+/).map(v => v.trim()).filter(Boolean);
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every(v => /^\d{5,}$/.test(v))) return tokens;
    return [raw];
  }

  function matches(value, query) {
    const qs = terms(query);
    if (!qs.length) return true;
    const hay = normalize(value);
    return qs.some(q => hay.includes(q));
  }

  function parseMoney(value) {
    const match = String(value || '').match(/R\$\s*-?[\d.]+(?:,\d{1,2})?/i);
    const source = match ? match[0] : String(value || '');
    const raw = source
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function isoToBr(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }

  function ensureStyle() {
    if (document.getElementById('hap-v4041-transfer-filter-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4041-transfer-filter-style';
    style.textContent = `
      .v4041-transfer-filter-row th{
        position:sticky!important;
        top:34px!important;
        z-index:3!important;
        padding:5px 6px!important;
        background:#e8f0fb!important;
        border-bottom:1px solid #c8d6e8;
      }
      .v4041-transfer-filter-row input{
        width:100%;min-width:70px;height:28px;padding:4px 7px;
        border:1px solid #c9d5e5;border-radius:6px;background:#fff;
        color:#173555;font:inherit;font-size:10px;outline:none;
      }
      .v4041-transfer-filter-row input:focus{
        border-color:#2e6bbf;box-shadow:0 0 0 2px rgba(46,107,191,.10)
      }
      .v4041-value-range{
        display:grid;grid-template-columns:1fr 1fr;gap:4px;min-width:145px
      }
      .v4041-transfer-clear{
        width:100%;min-width:72px;height:28px;border:1px solid #c9d5e5;border-radius:6px;
        background:#fff;color:#1a4b8c;font-size:10px;font-weight:800;cursor:pointer;
      }
      .v4041-transfer-clear:hover{background:#f4f7fb}
      .v4041-transfer-total td{
        position:sticky;bottom:0;z-index:4;
        background:#0d2b4e!important;color:#fff!important;font-weight:800!important;
        border-top:2px solid #2e6bbf!important;padding:9px 10px!important;
        box-shadow:0 -2px 7px rgba(13,43,78,.18);
        font-variant-numeric:tabular-nums;
      }
      .v4041-transfer-total td:first-child{white-space:nowrap}
      .v4041-total-context{
        font-size:10px;font-weight:600;opacity:.86;white-space:normal!important
      }
      .v4041-kpi-sub{
        margin-top:5px;font-size:10px;line-height:1.3;color:var(--texto-suave,#5a6882)
      }
    `;
    document.head.appendChild(style);
  }

  function findTransferTable() {
    return [...document.querySelectorAll('.table-card table')].find(table => {
      const headers = [...table.querySelectorAll('thead tr:first-child th')]
        .map(th => normalize(th.textContent));
      return headers.length >= 7 &&
        headers[0].includes('doc') &&
        headers[1].includes('origem') &&
        headers[2].includes('destino') &&
        headers[3].includes('valor') &&
        headers[4].includes('data') &&
        headers[5].includes('justificativa');
    }) || null;
  }

  function makeInput(key, placeholder, type='text') {
    const input = document.createElement('input');
    input.type = type;
    input.dataset.v4041Filter = key;
    input.placeholder = placeholder;
    input.value = filters[key] || '';
    if (type === 'number') {
      input.step = '0.01';
      input.min = '0';
    }
    const sync = e => {
      filters[key] = e.target.value;
      applyFilters();
    };
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    return input;
  }

  function injectFilterRow(table) {
    const existing = table.querySelector('.v4041-transfer-filter-row');
    if (existing) return existing;

    const thead = table.tHead;
    if (!thead || thead.rows[0]?.cells.length < 7) return null;

    const tr = document.createElement('tr');
    tr.className = 'v4041-transfer-filter-row';

    const cells = Array.from({length:7}, () => document.createElement('th'));
    cells[0].appendChild(makeInput('documento', 'Documento'));
    cells[1].appendChild(makeInput('origem', 'OI / obra origem'));
    cells[2].appendChild(makeInput('destino', 'OI / obra destino'));

    const range = document.createElement('div');
    range.className = 'v4041-value-range';
    range.appendChild(makeInput('valorMin', 'Mín.', 'number'));
    range.appendChild(makeInput('valorMax', 'Máx.', 'number'));
    cells[3].appendChild(range);

    cells[4].appendChild(makeInput('data', 'Data exata', 'date'));
    cells[5].appendChild(makeInput('justificativa', 'Justificativa'));

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'v4041-transfer-clear';
    clear.textContent = 'Limpar';
    clear.title = 'Limpar apenas os filtros das colunas';
    clear.onclick = () => {
      Object.keys(filters).forEach(k => { filters[k] = ''; });
      tr.querySelectorAll('input').forEach(input => { input.value = ''; });
      applyFilters();
    };
    cells[6].appendChild(clear);

    cells.forEach(cell => tr.appendChild(cell));
    thead.appendChild(tr);
    return tr;
  }

  function dataRows(table) {
    return [...(table.tBodies?.[0]?.rows || [])].filter(row =>
      row.cells?.length >= 7 && !row.querySelector('.empty-state')
    );
  }

  function contextLabel() {
    const doc = filters.documento.trim();
    const origem = filters.origem.trim();
    const destino = filters.destino.trim();

    if (doc && !origem && !destino) return 'Total do documento filtrado';
    if (origem && !destino) return 'Total que saiu da origem filtrada';
    if (destino && !origem) return 'Total que entrou no destino filtrado';
    if (origem && destino) return 'Total da combinação Origem → Destino';
    return 'Total transferido visível';
  }

  function rowMatches(row) {
    const c = row.cells;
    if (!matches(c[0]?.textContent, filters.documento)) return false;
    if (!matches(c[1]?.textContent, filters.origem)) return false;
    if (!matches(c[2]?.textContent, filters.destino)) return false;
    if (!matches(c[5]?.textContent, filters.justificativa)) return false;

    const value = parseMoney(c[3]?.textContent);
    const min = filters.valorMin === '' ? null : Number(filters.valorMin);
    const max = filters.valorMax === '' ? null : Number(filters.valorMax);
    if (min !== null && Number.isFinite(min) && value < min) return false;
    if (max !== null && Number.isFinite(max) && value > max) return false;

    if (filters.data) {
      const expected = isoToBr(filters.data);
      const actual = String(c[4]?.textContent || '').trim();
      if (!expected || actual !== expected) return false;
    }

    return true;
  }

  function renderFooter(table, visible, total) {
    table.querySelector('tfoot[data-v4041-transfer-total]')?.remove();
    if (!visible.length) return;

    const tfoot = document.createElement('tfoot');
    tfoot.dataset.v4041TransferTotal = '1';
    const tr = document.createElement('tr');
    tr.className = 'v4041-transfer-total';

    for (let i=0; i<7; i++) {
      const td = document.createElement('td');
      if (i === 0) td.textContent = `TOTAL VISÍVEL (${visible.length})`;
      if (i === 3) td.textContent = brlFmt.format(total);
      if (i === 5) {
        td.className = 'v4041-total-context';
        td.textContent = contextLabel();
      }
      tr.appendChild(td);
    }
    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  }

  function updateKpis(visible, total) {
    const cards = [...document.querySelectorAll('.kpi-grid .kpi-card')];
    if (cards.length < 2) return;

    const label1 = cards[0].querySelector('.label');
    const value1 = cards[0].querySelector('.value');
    const label2 = cards[1].querySelector('.label');
    const value2 = cards[1].querySelector('.value');

    if (label1) label1.textContent = contextLabel();
    if (value1) value1.textContent = brlFmt.format(total);
    if (label2) label2.textContent = 'Qtde visível';
    if (value2) value2.textContent = String(visible.length);

    [cards[0], cards[1]].forEach(card => {
      let sub = card.querySelector('.v4041-kpi-sub');
      if (!sub) {
        sub = document.createElement('div');
        sub.className = 'v4041-kpi-sub';
        card.appendChild(sub);
      }
      sub.textContent = 'Após busca, período e filtros das colunas';
    });
  }

  function applyFilters() {
    const table = findTransferTable();
    if (!table) return;
    injectFilterRow(table);

    const rows = dataRows(table);
    const visible = [];
    let total = 0;

    rows.forEach(row => {
      const ok = rowMatches(row);
      row.hidden = !ok;
      row.style.display = ok ? '' : 'none';
      if (ok) {
        visible.push(row);
        total += parseMoney(row.cells[3]?.textContent);
      }
    });

    renderFooter(table, visible, total);
    updateKpis(visible, total);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureStyle();
      const table = findTransferTable();
      if (!table) return;
      injectFilterRow(table);
      applyFilters();
    });
  }

  function boot() {
    ensureStyle();
    schedule();

    const target = document.getElementById('app') || document.body;
    const observer = new MutationObserver(schedule);
    observer.observe(target, { childList:true, subtree:true });

    window.addEventListener('focus', schedule);
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule();
    });

    window.HAP_V40_TRANSFER_FILTERS = {
      version: VERSION,
      filters,
      refresh: applyFilters,
      clear() {
        Object.keys(filters).forEach(k => { filters[k] = ''; });
        schedule();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
