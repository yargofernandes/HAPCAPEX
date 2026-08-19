/* HAPCAPEX V40.0.37 — Totais dinâmicos nas tabelas CAPEX e Base O.I.
   - Reconhece cabeçalhos mesmo com indicadores de ordenação.
   - Soma somente as linhas visíveis após busca/filtro.
   - CAPEX: Montante, Compromissado, Saldo e % consolidado.
   - Base O.I.: Montante, Recursos atribuídos e Saldo.
*/
(() => {
  'use strict';
  if (window.__HAP_V4037_TABLE_TOTALS__) return;
  window.__HAP_V4037_TABLE_TOTALS__ = true;

  if (!/controle-capex\.html\/?$/i.test(window.location.pathname)) return;

  const brlFmt = new Intl.NumberFormat('pt-BR', {
    style:'currency', currency:'BRL',
    minimumFractionDigits:2, maximumFractionDigits:2
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
    if (document.getElementById('hap-v4037-table-totals-style')) return;
    document.getElementById('hap-v4035-table-totals-style')?.remove();
    document.getElementById('hap-v4036-table-totals-style')?.remove();

    const style = document.createElement('style');
    style.id = 'hap-v4037-table-totals-style';
    style.textContent = `
      .table-card table tfoot[data-v4037-table-totals]{display:table-footer-group}
      .v4037-table-totals td{
        position:sticky;bottom:0;z-index:4;
        background:#0d2b4e!important;color:#fff!important;
        font-weight:800!important;border-top:2px solid #2e6bbf!important;
        box-shadow:0 -2px 6px rgba(13,43,78,.18);
        font-variant-numeric:tabular-nums;padding:9px 10px!important
      }
      .v4037-table-totals td:first-child{white-space:nowrap}
      .v4037-total-value{white-space:nowrap}
      .v4037-total-pct{
        display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;
        background:#fff;color:#0d2b4e;font-weight:900;white-space:nowrap
      }
    `;
    document.head.appendChild(style);
  }

  function dataRows(table) {
    return [...(table.tBodies?.[0]?.rows || [])].filter(row => {
      if (!row || !row.cells?.length) return false;
      if (row.querySelector('.empty-state')) return false;
      if (row.hidden) return false;
      const style = window.getComputedStyle(row);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function detectTable(table) {
    const headers = [...table.querySelectorAll('thead th')].map(th => cleanHeader(th.textContent));
    if (!headers.length) return null;

    const montante = headers.findIndex(h => h.startsWith('MONTANTE'));
    const saldo = headers.findIndex(h => h.startsWith('SALDO'));
    const pctComp = headers.findIndex(h => h.includes('% COMP'));
    const compromissado = headers.findIndex(
      h => h.includes('COMPROMISSADO') || h.startsWith('RECURSOS ATRIB')
    );

    if (montante < 0 || compromissado < 0 || saldo < 0) return null;

    return {
      headers,
      kind: pctComp >= 0 ? 'capex' : 'base_oi',
      montante, compromissado, saldo, pctComp
    };
  }

  function applyToTable(table) {
    const map = detectTable(table);
    if (!map) return;

    table.querySelector('tfoot[data-v4035-table-totals]')?.remove();
    table.querySelector('tfoot[data-v4036-table-totals]')?.remove();

    const rows = dataRows(table);
    if (!rows.length) {
      table.querySelector('tfoot[data-v4037-table-totals]')?.remove();
      return;
    }

    const montante = rows.reduce((s,row)=>s+parseMoney(row.cells[map.montante]?.textContent),0);
    const compromissado = rows.reduce((s,row)=>s+parseMoney(row.cells[map.compromissado]?.textContent),0);
    const saldo = rows.reduce((s,row)=>s+parseMoney(row.cells[map.saldo]?.textContent),0);
    const pctComp = montante > 0 ? compromissado / montante : 0;

    const signature = [
      map.kind, rows.length, montante.toFixed(2),
      compromissado.toFixed(2), saldo.toFixed(2), pctComp.toFixed(8)
    ].join('|');

    const current = table.querySelector('tfoot[data-v4037-table-totals]');
    if (current?.dataset.signature === signature) return;
    current?.remove();

    const tfoot = document.createElement('tfoot');
    tfoot.dataset.v4037TableTotals = '1';
    tfoot.dataset.signature = signature;

    const tr = document.createElement('tr');
    tr.className = 'v4037-table-totals';

    map.headers.forEach((_,index)=>{
      const td=document.createElement('td');

      if(index===0){
        td.textContent=`TOTAL VISÍVEL (${rows.length} ${rows.length===1?'OI':'OIs'})`;
      } else if(index===map.montante){
        td.textContent=brlFmt.format(montante);
        td.className='v4037-total-value';
      } else if(index===map.compromissado){
        td.textContent=brlFmt.format(compromissado);
        td.className='v4037-total-value';
      } else if(index===map.saldo){
        td.textContent=brlFmt.format(saldo);
        td.className='v4037-total-value';
      } else if(map.kind==='capex' && index===map.pctComp){
        const pill=document.createElement('span');
        pill.className='v4037-total-pct';
        pill.textContent=`${(pctComp*100).toFixed(1)}%`;
        pill.title='Compromissado total ÷ Montante total das OIs visíveis';
        td.appendChild(pill);
      }

      tr.appendChild(td);
    });

    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  }

  let scheduled=false;
  function applyAll(){
    scheduled=false;
    ensureStyle();
    document.querySelectorAll('.table-card table').forEach(applyToTable);
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(applyAll);
  }

  function start(){
    ensureStyle();
    schedule();

    const app=document.getElementById('app');
    if(!app){
      setTimeout(start,100);
      return;
    }

    const observer=new MutationObserver(schedule);
    observer.observe(app,{
      childList:true,subtree:true,attributes:true,
      attributeFilter:['style','hidden','class']
    });

    window.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
    window.addEventListener('focus',schedule);

    window.HAP_V40_TABLE_TOTALS={
      version:'40.0.37',
      refresh:applyAll,
      detectTable
    };
  }

  start();
})();
