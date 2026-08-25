/* HAPCAPEX V40.0.50 — Filtros por coluna na aba CAPEX
   - Filtros diretamente nos cabeçalhos da tabela.
   - Texto para OI/Obra/classificações/Ações.
   - Faixa mínima/máxima para valores e % comprometido.
   - Convive com a busca geral existente.
   - Oculta linhas no DOM, permitindo que v40-table-totals.js recalcule os totais visíveis.
*/
(() => {
  'use strict';

  if (window.__HAP_V40050_CAPEX_COLUMN_FILTERS__) return;
  window.__HAP_V40050_CAPEX_COLUMN_FILTERS__ = true;

  const VERSION = '40.0.50';

  const filters = new Map();
  let scheduled = false;
  let observer = null;

  function normalize(value) {
    return String(value ?? '')
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
    const raw = String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/R\$/gi, '')
      .replace(/\s+/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.\-]/g, '');

    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function parsePercent(value) {
    const raw = String(value ?? '')
      .replace('%', '')
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^0-9.\-]/g, '');

    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function parseFilterNumber(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    // Usuário pode digitar 1.000,00, 1000,00 ou 1000.00.
    let normalized = raw.replace(/\s+/g, '');
    if (normalized.includes(',')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      const dots = (normalized.match(/\./g) || []).length;
      if (dots > 1) normalized = normalized.replace(/\./g, '');
    }

    normalized = normalized.replace(/[^0-9.\-]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function textTerms(value) {
    const raw = normalize(value);
    if (!raw) return [];
    if (/[;,\n]/.test(raw)) {
      return raw.split(/[;,\n]+/).map(v => v.trim()).filter(Boolean);
    }
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every(v => /^\d{5,}$/.test(v))) return tokens;
    return [raw];
  }

  function textMatches(cellText, query) {
    const terms = textTerms(query);
    if (!terms.length) return true;
    const hay = normalize(cellText);
    return terms.some(term => hay.includes(term));
  }

  function findCapexTable() {
    const tables = [...document.querySelectorAll('.table-card table')];

    return tables.find(table => {
      const row = table.tHead?.rows?.[0];
      if (!row) return false;

      const headers = [...row.cells].map(th => cleanHeader(th.textContent));

      return headers.includes('OI') &&
        headers.includes('OBRA') &&
        headers.some(h => h.startsWith('MONTANTE')) &&
        headers.some(h => h.startsWith('COMPROMISSADO')) &&
        headers.some(h => h.startsWith('SALDO')) &&
        headers.some(h => h.includes('% COMP'));
    }) || null;
  }

  function headerType(header) {
    const h = cleanHeader(header);

    if (h.startsWith('MONTANTE')) return 'money';
    if (h.startsWith('COMPROMISSADO')) return 'money';
    if (h.startsWith('SALDO')) return 'money';
    if (h.includes('% COMP')) return 'percent';

    return 'text';
  }

  function keyForHeader(header, index) {
    return `${index}:${cleanHeader(header)}`;
  }

  function ensureStyles() {
    if (document.getElementById('hap-v40050-capex-column-filter-style')) return;

    const style = document.createElement('style');
    style.id = 'hap-v40050-capex-column-filter-style';
    style.textContent = `
      .v40050-capex-filter-wrap{
        margin-top:6px;
        display:flex;
        gap:4px;
        align-items:center;
        min-width:88px
      }

      .v40050-capex-filter-wrap input{
        width:100%;
        min-width:70px;
        height:26px;
        padding:3px 6px;
        border:1px solid #b8c9df;
        border-radius:6px;
        background:#fff;
        color:#173555;
        font:inherit;
        font-size:9.5px;
        font-weight:500;
        outline:none;
        box-shadow:none
      }

      .v40050-capex-filter-wrap input:focus{
        border-color:#6e9ccc;
        box-shadow:0 0 0 2px rgba(255,255,255,.16)
      }

      .v40050-capex-filter-wrap.v40050-range{
        display:grid;
        grid-template-columns:minmax(62px,1fr) minmax(62px,1fr)
      }

      .v40050-capex-filter-wrap input::placeholder{
        color:#8392a8;
        opacity:1
      }

      .v40050-capex-filter-active{
        background:#fff7df!important;
        border-color:#e5bd63!important
      }

      #v40050-capex-clear{
        white-space:nowrap
      }

      .v40050-capex-filter-count{
        font-size:10px;
        color:var(--texto-suave,#5a6882);
        font-weight:700;
        white-space:nowrap
      }

      @media(max-width:980px){
        .v40050-capex-filter-wrap input{
          min-width:64px
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildTextFilter(th, key) {
    const wrap = document.createElement('div');
    wrap.className = 'v40050-capex-filter-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Filtrar';
    input.autocomplete = 'off';
    input.dataset.v40050Key = key;
    input.value = filters.get(key)?.text || '';

    wrap.appendChild(input);
    return wrap;
  }

  function buildRangeFilter(th, key, type) {
    const wrap = document.createElement('div');
    wrap.className = 'v40050-capex-filter-wrap v40050-range';

    const current = filters.get(key) || {};

    const min = document.createElement('input');
    min.type = 'text';
    min.inputMode = 'decimal';
    min.placeholder = type === 'percent' ? '% mín.' : 'Mín.';
    min.dataset.v40050Key = key;
    min.dataset.v40050Range = 'min';
    min.value = current.min ?? '';

    const max = document.createElement('input');
    max.type = 'text';
    max.inputMode = 'decimal';
    max.placeholder = type === 'percent' ? '% máx.' : 'Máx.';
    max.dataset.v40050Key = key;
    max.dataset.v40050Range = 'max';
    max.value = current.max ?? '';

    wrap.append(min, max);
    return wrap;
  }

  function stopHeaderEvent(event) {
    event.stopPropagation();
  }

  function bindFilterInput(input) {
    if (input.dataset.v40050Bound === '1') return;
    input.dataset.v40050Bound = '1';

    ['click','mousedown','pointerdown','dblclick'].forEach(type => {
      input.addEventListener(type, stopHeaderEvent);
    });

    const update = () => {
      const key = input.dataset.v40050Key;
      const range = input.dataset.v40050Range;

      if (range) {
        const current = filters.get(key) || {};
        current[range] = input.value;
        filters.set(key, current);
      } else {
        filters.set(key, { text: input.value });
      }

      input.classList.toggle('v40050-capex-filter-active', !!input.value.trim());
      applyFilters();
    };

    input.addEventListener('input', update);
    input.addEventListener('change', update);
  }

  function injectIntoHeaders(table) {
    const headerRow = table.tHead?.rows?.[0];
    if (!headerRow) return;

    [...headerRow.cells].forEach((th, index) => {
      if (th.querySelector(':scope > .v40050-capex-filter-wrap')) return;

      const header = cleanHeader(th.childNodes[0]?.textContent || th.textContent);
      const key = keyForHeader(header, index);
      const type = headerType(header);

      const wrap = (type === 'money' || type === 'percent')
        ? buildRangeFilter(th, key, type)
        : buildTextFilter(th, key);

      wrap.dataset.v40050Header = header;
      wrap.querySelectorAll('input').forEach(bindFilterInput);

      // Interação no filtro não deve disparar ordenação do cabeçalho.
      ['click','mousedown','pointerdown','dblclick'].forEach(eventName => {
        wrap.addEventListener(eventName, stopHeaderEvent);
      });

      th.appendChild(wrap);
    });
  }

  function dataRows(table) {
    return [...(table.tBodies?.[0]?.rows || [])].filter(row => {
      if (!row?.cells?.length) return false;
      if (row.querySelector('.empty-state')) return false;
      return true;
    });
  }

  function rowMatches(table, row) {
    const headerRow = table.tHead?.rows?.[0];
    if (!headerRow) return true;

    return [...headerRow.cells].every((th, index) => {
      const header = cleanHeader(th.childNodes[0]?.textContent || th.textContent);
      const key = keyForHeader(header, index);
      const config = filters.get(key);

      if (!config) return true;

      const cell = row.cells[index];
      if (!cell) return true;

      const type = headerType(header);

      if (type === 'money') {
        const value = parseMoney(cell.textContent);
        if (value === null) return false;

        const min = parseFilterNumber(config.min);
        const max = parseFilterNumber(config.max);

        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
        return true;
      }

      if (type === 'percent') {
        const value = parsePercent(cell.textContent);
        if (value === null) return false;

        const min = parseFilterNumber(config.min);
        const max = parseFilterNumber(config.max);

        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
        return true;
      }

      return textMatches(cell.textContent, config.text);
    });
  }

  function activeFilterCount() {
    let count = 0;

    for (const config of filters.values()) {
      if (config?.text?.trim()) count++;
      else if (String(config?.min ?? '').trim() || String(config?.max ?? '').trim()) count++;
    }

    return count;
  }

  function updateToolbar(table, visible, total) {
    const card = table.closest('.table-card');
    if (!card) return;

    const toolbar = card.previousElementSibling?.classList?.contains('toolbar')
      ? card.previousElementSibling
      : [...document.querySelectorAll('.toolbar')].find(el => {
          const r1 = el.getBoundingClientRect();
          const r2 = card.getBoundingClientRect();
          return r1.bottom <= r2.top + 12;
        });

    if (!toolbar) return;

    let clear = toolbar.querySelector('#v40050-capex-clear');

    if (!clear) {
      clear = document.createElement('button');
      clear.id = 'v40050-capex-clear';
      clear.type = 'button';
      clear.className = 'btn btn-secondary';
      clear.textContent = 'Limpar filtros';
      clear.addEventListener('click', () => {
        filters.clear();
        table.querySelectorAll('.v40050-capex-filter-wrap input').forEach(input => {
          input.value = '';
          input.classList.remove('v40050-capex-filter-active');
        });
        applyFilters();
      });
      toolbar.appendChild(clear);
    }

    let count = toolbar.querySelector('.v40050-capex-filter-count');

    if (!count) {
      count = document.createElement('span');
      count.className = 'v40050-capex-filter-count';
      toolbar.appendChild(count);
    }

    const active = activeFilterCount();
    count.textContent = active
      ? `${visible} de ${total} OIs · ${active} filtro${active === 1 ? '' : 's'} ativo${active === 1 ? '' : 's'}`
      : `${visible} de ${total} OIs`;
  }

  function applyFilters() {
    const table = findCapexTable();
    if (!table) return;

    injectIntoHeaders(table);

    const rows = dataRows(table);
    let visible = 0;

    for (const row of rows) {
      const show = rowMatches(table, row);
      row.hidden = !show;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    }

    updateToolbar(table, visible, rows.length);

    // Integração explícita com a linha de totais existente.
    try {
      window.HAP_V40_TABLE_TOTALS?.refresh?.();
    } catch (_) {}
  }

  function run() {
    scheduled = false;
    ensureStyles();

    const table = findCapexTable();
    if (!table) return;

    injectIntoHeaders(table);
    applyFilters();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    ensureStyles();
    schedule();

    const app = document.getElementById('app');
    if (!app) {
      setTimeout(start, 100);
      return;
    }

    observer = new MutationObserver(mutations => {
      // Evita loop ao alterar apenas hidden/style nas próprias linhas.
      const structural = mutations.some(m =>
        m.type === 'childList' ||
        (m.type === 'attributes' && !m.target?.closest?.('.v40050-capex-filter-wrap'))
      );

      if (structural) schedule();
    });

    observer.observe(app, {
      childList: true,
      subtree: true
    });

    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule();
    });

    window.HAP_V40050_CAPEX_COLUMN_FILTERS = {
      version: VERSION,
      filters,
      refresh: applyFilters,
      clear() {
        filters.clear();
        schedule();
      },
      findCapexTable
    };
  }

  start();
})();
