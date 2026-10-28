/* HAPCAPEX V40.0.51 — Totais dinâmicos nas tabelas CAPEX e Base O.I.
   - CAPEX usa a MESMA base dos KPIs: exclui a O.I. técnica 9999999999.
   - A linha técnica continua visível na tabela, mas não entra nos totais financeiros.
   - Soma somente linhas visíveis após busca/filtros.
   - CAPEX: Montante, Compromissado, Saldo e % consolidado.
   - Base O.I.: Montante, Recursos atribuídos e Saldo.
*/
(() => {
  'use strict';

  if (window.__HAP_V4051_TABLE_TOTALS__) return;
  window.__HAP_V4051_TABLE_TOTALS__ = true;

  if (!/controle-capex\.html\/?$/i.test(window.location.pathname)) return;

  const VERSION = '40.0.51';
  const brlFmt = new Intl.NumberFormat('pt-BR', {
    style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2
  });

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim().toUpperCase();
  }
  function cleanHeader(value) {
    return normalize(value).replace(/[↑↓↕⇅⇵▲▼▴▾⇧⇩]/g, '').replace(/\s+/g, ' ').trim();
  }
  function parseMoney(value) {
    const raw = String(value || '').replace(/\u00a0/g, ' ').replace(/R\$/gi, '')
      .replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const n = Number(raw);return Number.isFinite(n) ? n : 0;
  }
  function ensureStyle() {
    if (document.getElementById('hap-v4051-table-totals-style')) return;
    document.getElementById('hap-v4035-table-totals-style')?.remove();
    document.getElementById('hap-v4036-table-totals-style')?.remove();
    document.getElementById('hap-v4037-table-totals-style')?.remove();
    const style=document.createElement('style');style.id='hap-v4051-table-totals-style';
    style.textContent=`
      .table-card table tfoot[data-v4051-table-totals]{display:table-footer-group}
      .v4051-table-totals td{position:sticky;bottom:0;z-index:4;background:#0d2b4e!important;color:#fff!important;font-weight:800!important;border-top:2px solid #2e6bbf!important;box-shadow:0 -2px 6px rgba(13,43,78,.18);font-variant-numeric:tabular-nums;padding:9px 10px!important}
      .v4051-table-totals td:first-child{white-space:nowrap}
      .v4051-total-value{white-space:nowrap}
      .v4051-total-pct{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#fff;color:#0d2b4e;font-weight:900;white-space:nowrap}
    `;document.head.appendChild(style);
  }
  function visibleRows(table) {
    return [...(table.tBodies?.[0]?.rows || [])].filter(row => {
      if(!row||!row.cells?.length||row.querySelector('.empty-state')||row.hidden)return false;
      const style=window.getComputedStyle(row);
      return style.display!=='none'&&style.visibility!=='hidden';
    });
  }
  function detectTable(table) {
    const headers=[...table.querySelectorAll('thead tr:first-child th')]
      .map(th=>cleanHeader(th.childNodes?.[0]?.textContent||th.textContent));
    if(!headers.length)return null;
    const oi=headers.findIndex(h=>h==='OI'||h.startsWith('OI '));
    const obra=headers.findIndex(h=>h==='OBRA'||h.startsWith('OBRA '));
    const montante=headers.findIndex(h=>h.startsWith('MONTANTE'));
    const saldo=headers.findIndex(h=>h.startsWith('SALDO'));
    const pctComp=headers.findIndex(h=>h.includes('% COMP'));
    const compromissado=headers.findIndex(h=>h.includes('COMPROMISSADO')||h.startsWith('RECURSOS ATRIB'));
    if(montante<0||compromissado<0||saldo<0)return null;
    return {headers,kind:pctComp>=0&&obra>=0?'capex':'base_oi',oi,obra,montante,compromissado,saldo,pctComp};
  }
  function isTechnicalContingencyRow(row,map) {
    if(map.kind!=='capex')return false;
    const oiText=normalize(row.cells[map.oi]?.textContent||'');
    const obraText=normalize(row.cells[map.obra]?.textContent||'');
    const noOperationalOi=!oiText||oiText==='—'||oiText==='-'||oiText==='9999999999';
    const contingencyLabel=obraText.includes('CONTING')||obraText.includes('CONTINGENCIAMENTO');
    return noOperationalOi||contingencyLabel&&oiText==='9999999999';
  }
  function financialRows(table,map) {
    const visible=visibleRows(table);
    if(map.kind!=='capex')return {visible,financial:visible,excludedTechnical:0};
    const financial=visible.filter(row=>!isTechnicalContingencyRow(row,map));
    return {visible,financial,excludedTechnical:visible.length-financial.length};
  }
  function applyToTable(table) {
    const map=detectTable(table);if(!map)return;
    table.querySelector('tfoot[data-v4035-table-totals]')?.remove();
    table.querySelector('tfoot[data-v4036-table-totals]')?.remove();
    table.querySelector('tfoot[data-v4037-table-totals]')?.remove();
    const {visible,financial,excludedTechnical}=financialRows(table,map);
    if(!visible.length){table.querySelector('tfoot[data-v4051-table-totals]')?.remove();return;}
    const rows=financial;
    const montante=rows.reduce((s,row)=>s+parseMoney(row.cells[map.montante]?.textContent),0);
    const compromissado=rows.reduce((s,row)=>s+parseMoney(row.cells[map.compromissado]?.textContent),0);
    const saldo=rows.reduce((s,row)=>s+parseMoney(row.cells[map.saldo]?.textContent),0);
    const pctComp=montante>0?compromissado/montante:0;
    const signature=[map.kind,visible.length,rows.length,excludedTechnical,montante.toFixed(2),compromissado.toFixed(2),saldo.toFixed(2),pctComp.toFixed(8)].join('|');
    const current=table.querySelector('tfoot[data-v4051-table-totals]');
    if(current?.dataset.signature===signature)return;
    current?.remove();
    const tfoot=document.createElement('tfoot');tfoot.dataset.v4051TableTotals='1';tfoot.dataset.signature=signature;
    const tr=document.createElement('tr');tr.className='v4051-table-totals';
    map.headers.forEach((_,index)=>{
      const td=document.createElement('td');
      if(index===0){
        const count=map.kind==='capex'?rows.length:visible.length;
        td.textContent=`TOTAL VISÍVEL (${count} ${count===1?'OI':'OIs'})`;
        if(map.kind==='capex'&&excludedTechnical>0)td.title='A O.I. técnica 9999999999 não participa dos totais financeiros.';
      } else if(index===map.montante){td.textContent=brlFmt.format(montante);td.className='v4051-total-value';}
      else if(index===map.compromissado){td.textContent=brlFmt.format(compromissado);td.className='v4051-total-value';}
      else if(index===map.saldo){td.textContent=brlFmt.format(saldo);td.className='v4051-total-value';}
      else if(map.kind==='capex'&&index===map.pctComp){
        const pill=document.createElement('span');pill.className='v4051-total-pct';pill.textContent=`${(pctComp*100).toFixed(1)}%`;
        pill.title='Compromissado ÷ Montante das OIs operacionais visíveis.';td.appendChild(pill);
      }
      tr.appendChild(td);
    });
    tfoot.appendChild(tr);table.appendChild(tfoot);
  }
  let scheduled=false;
  function applyAll(){scheduled=false;ensureStyle();document.querySelectorAll('.table-card table').forEach(applyToTable);}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(applyAll);}
  function start(){
    ensureStyle();schedule();
    const app=document.getElementById('app');if(!app){setTimeout(start,100);return;}
    const observer=new MutationObserver(schedule);
    observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden','class']});
    window.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
    window.addEventListener('focus',schedule);
    window.HAP_V40_TABLE_TOTALS={version:VERSION,refresh:applyAll,detectTable,isTechnicalContingencyRow};
  }
  start();
})();

/* HAPCAPEX V40.0.149 — Histórico Gerencial com filtros Excel encadeados e totais dinâmicos.
 * Substitui a seção existente de aportes/contingenciamentos pelo histórico da obra.
 * Mantém verificações de divergência FORA da interface, exclusivamente na auditoria.
 */
(() => {
  'use strict';
  if (window.__HAP_V40146_MANAGERIAL_HISTORY__) return;
  window.__HAP_V40146_MANAGERIAL_HISTORY__ = true;
  if (!/controle-capex\.html\/?$/i.test(location.pathname)) return;
  const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
  const money=x=>fmt.format(Number(x)||0);
  const n=x=>Number.isFinite(Number(x))?Number(x):0;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  let cached=null, loading=null, key='', activeRows=[], shownRows=[], busy=false, queued=false;
  const HISTORY_XF_ID='mgr-historico-capex-obra';
  let xfStore=null, renderedYear=null;
  const style=document.createElement('style');style.id='hap-v40146-gerencial-historico';
  style.textContent=`#v4078-table-top,#v4071-top-n{display:none!important}
    #v4078-table-adjustments .v40146-work{min-width:265px}
    #v4078-table-adjustments td{font-variant-numeric:tabular-nums}
    #v4078-table-adjustments td.num,#v4078-table-adjustments th.num{text-align:right;white-space:nowrap}
    #v4078-table-adjustments .v40146-detail{padding:5px 10px;border:1px solid #bacfe9;background:#f3f7fd;border-radius:7px;color:#164781;font-weight:700;cursor:pointer}
    #v4078-table-adjustments .hap-xf-head{padding-right:29px!important}
    #v4078-table-adjustments .v40149-clear{padding:5px 9px;border:1px solid #c2d0e2;border-radius:6px;background:#f4f8fc;color:#194a7e;font-size:10px;cursor:pointer}
    #v4078-table-adjustments .v40149-clear:disabled{opacity:.5;cursor:default}
    .v40146-modal{position:fixed;inset:0;z-index:100000;background:rgba(5,20,41,.72);display:flex;align-items:center;justify-content:center;padding:14px}
    .v40146-dialog{background:#fff;color:#172b45;border-radius:12px;padding:20px;max-width:1100px;width:100%;max-height:90vh;overflow:auto;box-sizing:border-box}
    .v40146-dialog h2{margin:0 0 9px;font-size:20px}.v40146-dialog h3{margin:18px 0 6px;font-size:14px}
    .v40146-dialog table{border-collapse:collapse;width:100%;min-width:620px;font-size:11px}.v40146-dialog th,.v40146-dialog td{padding:9px;border-bottom:1px solid #e2e9f3;text-align:left}
    .v40146-dialog th{background:#eef3fa}.v40146-dialog td.num{text-align:right;white-space:nowrap}
    .v40146-dialog .v40146-overflow{overflow:auto}.v40146-totals{display:flex;flex-wrap:wrap;gap:15px;padding:12px;background:#f3f6fb}
    .v40146-dialog .v40146-close{float:right;border:1px solid #a8bad4;border-radius:6px;padding:6px 12px;background:#fff;cursor:pointer}
    #v4078-table-adjustments .v40146-footer td{position:sticky;bottom:0;background:#edf3fb;font-weight:850;border-top:2px solid #9fb6d6}
    @media(max-width:700px){.v40146-dialog{padding:11px}.v40146-dialog h2{font-size:16px}}`;
  (document.head||document.documentElement).appendChild(style);

  function currentYear(){
    const fromCtl=window.HAP_V40139?.getSelectedYear?.();
    const fromEl=document.getElementById('v4071-select-year')?.value;
    const value=Number(fromCtl||fromEl||new Date().getFullYear());
    return value>=2000&&value<=2100?value:null;
  }
  function gerencialVisible(){
    return !!document.querySelector('#v4071-content') && !!document.getElementById('v4078-table-adjustments');
  }
  function clearTop(){
    document.getElementById('v4078-table-top')?.remove();
    const top=document.getElementById('v4071-top-n');if(top)top.closest('label')?.remove();
  }
  function getAuthorizedRpc(){return typeof sb!=='undefined' && typeof sb.rpc==='function' ? sb : null;}
  async function acquire(year){
    if(cached && cached.year===year && Date.now()-cached.at<90000)return cached;
    if(loading && loading.year===year)return loading.promise;
    const client=getAuthorizedRpc();if(!client)throw new Error('Conexão Supabase indisponível');
    const promise=(async()=>{
      const [a,b]=await Promise.all([
        client.rpc('obter_gerencial_controle_v4082',{p_exercicio:year}),
        client.rpc('obter_ajustes_obra_gerencial_v40144',{p_exercicio:year})
      ]);
      if(a.error)throw a.error;if(b.error)throw b.error;
      if(!Array.isArray(a.data?.capex_inicial_itens)||!Array.isArray(a.data?.ois)||!Array.isArray(a.data?.obra_vinculos)||!Array.isArray(b.data?.movimentos))
        throw new Error('Histórico incompleto. Verifique a atualização da consulta Gerencial.');
      return {year,at:Date.now(),main:a.data,adjust:b.data};
    })();
    loading={year,promise};
    try {cached=await promise;return cached;}finally{if(loading?.promise===promise)loading=null;}
  }
  function buildHistory(raw){
    const works=new Map(),links=new Map(),oiMap=new Map();
    raw.main.obra_vinculos.forEach(v=>{if(v?.oi && v?.obra_id)links.set(String(v.oi),v);});
    raw.adjust.movimentos.forEach(m=>{if(m?.oi && m?.obra_id && !links.has(String(m.oi)))links.set(String(m.oi),{obra_id:m.obra_id,obra:m.obra});});
    const get=(v,name,id)=>{
      const oi=String(v||'').trim(),link=links.get(oi),groupId=String(link?.obra_id||id||'').trim();
      const label=String(link?.obra||name||'Obra não identificada').trim();
      const k=groupId?'OBRA:'+groupId:(oi?'OI:'+oi:'NOME:'+norm(label));
      if(!works.has(k))works.set(k,{key:k,nome:label,ois:new Set(),initial:0,conting:0,aporte:0,transfers:0,current:0,baseline:[],movements:[],transferLines:[],currentLines:[]});
      const w=works.get(k);
      if(oi){w.ois.add(oi);oiMap.set(oi,k);}
      return w;
    };
    raw.main.ois.forEach(o=>{
      if(norm(o.pacote)==='COMPENSACAO DE ADIANTAMENTO'||norm(o.pacote_original)==='COMPENSACAO DE ADIANTAMENTO')return;
      const w=get(o.oi,o.nome);w.current+=n(o.atribuido);w.currentLines.push({oi:o.oi,nome:o.nome,valor:n(o.atribuido),pacote:o.pacote,head:o.head,saldo:n(o.saldo)});
    });
    raw.main.capex_inicial_itens.forEach(v=>{
      const oi=String(v.oi||'').trim();
      const w=get(oi,v.nome||'CAPEX inicial',oi?'':('BASE:'+String(v.id||v.linha_origem)));
      w.initial+=n(v.capex_inicial);w.baseline.push({oi,nome:v.nome,valor:n(v.capex_inicial),linha:v.linha_origem});
    });
    raw.adjust.movimentos.forEach(m=>{
      if(m.tipo!=='aporte'&&m.tipo!=='contingenciamento')return;
      const w=get(m.oi,m.obra||m.nome_lancamento,m.obra_id),val=n(m.valor);
      if(m.tipo==='aporte')w.aporte+=val;else w.conting+=val;
      w.movements.push({...m,valor:val});
    });
    (raw.main.transferencias||[]).forEach(t=>{
      const val=n(t.valor);if(!val)return;
      const from=String(t.oi_origem||'').trim(),to=String(t.oi_destino||'').trim();
      if(/^\d+$/.test(from)){
        const w=get(from,t.nome_origem);w.transfers-=val;
        w.transferLines.push({data:t.data,documento:t.numero_documento,oi:from,outra:to,sentido:'Saída',valor:-val,descricao:t.justificativa});
      }
      if(/^\d+$/.test(to)){
        const w=get(to,t.nome_destino);w.transfers+=val;
        w.transferLines.push({data:t.data,documento:t.numero_documento,oi:to,outra:from,sentido:'Entrada',valor:val,descricao:t.justificativa});
      }
    });
    return [...works.values()].map(w=>({...w,ois:[...w.ois].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}))}));
  }
  function applyGlobal(rows){
    const q=norm(document.getElementById('v4071-filter-query')?.value||'');
    const p=document.getElementById('v4071-filter-package')?.value||'';
    const h=document.getElementById('v4071-filter-head')?.value||'';
    const saldo=document.getElementById('v4071-filter-saldo')?.value||'all';
    return rows.filter(w=>{
      const o=w.currentLines;
      if(p && !o.some(x=>String(x.pacote)===p))return false;
      if(h && !o.some(x=>String(x.head)===h))return false;
      if(saldo==='positive'&&!o.some(x=>x.saldo>0.005))return false;
      if(saldo==='negative'&&!o.some(x=>x.saldo<-.005))return false;
      if(saldo==='zero'&&!o.some(x=>Math.abs(x.saldo)<=.005))return false;
      if(q && ![w.nome,...w.ois,...o.map(x=>x.nome)].some(x=>norm(x).includes(q)))return false;
      return true;
    });
  }
  // Mesmas colunas do HAP_XF (filtros estilo Excel) das demais abas.
  // A chave é igual à propriedade financeira de cada linha, evitando duplicar cálculos.
  const cols=[
    ['obra','Obra / OIs',false],['initial','CAPEX inicial',true],['conting','Contingenciamentos (−)',true],
    ['aporte','Aportes extras (+)',true],['transfers','Saldo de transferências',true],['current','CAPEX atual',true]
  ];
  function value(w,k){return k==='conting'?-w.conting:k==='obra'?w.nome+' '+w.ois.join(' '):n(w[k]);}
  const historyColumns=cols.map(([key,label,numeric],index)=>({
    key,label,type:numeric?'number':'text',index,get:row=>value(row,key)
  }));
  // O componente central do sistema preserva seus próprios filtros selecionados.
  // Para montar a lista de opções de uma coluna, consideram-se apenas filtros das
  // OUTRAS colunas. Assim uma seleção não bloqueia outras opções da própria coluna.
  function matchesOtherColumns(w,ignoredKey){
    if(!xfStore)return true;
    for(const [key,f] of Object.entries(xfStore.filters||{})){
      if(key===ignoredKey)continue;
      const col=historyColumns.find(x=>x.key===key);
      if(!col)continue;
      const v=value(w,key);
      if(f.selected instanceof Set && !f.selected.has(window.HAP_XF.canon(col.type,v)))return false;
      if(!f.op)continue;
      if(col.type==='number'){
        const x=window.HAP_XF.parseNumber(v),a=window.HAP_XF.parseNumber(f.a),b=window.HAP_XF.parseNumber(f.b);
        if(x===null||a===null)return false;
        switch(f.op){
          case 'eq':if(Math.abs(x-a)>=0.0000001)return false;break;
          case 'neq':if(Math.abs(x-a)<0.0000001)return false;break;
          case 'gt':if(!(x>a))return false;break;
          case 'gte':if(!(x>=a))return false;break;
          case 'lt':if(!(x<a))return false;break;
          case 'lte':if(!(x<=a))return false;break;
          case 'between':if(b===null||x<Math.min(a,b)||x>Math.max(a,b))return false;break;
        }
      }
    }
    return true;
  }
  function filterOptionsFor(key){
    return activeRows.filter(w=>matchesOtherColumns(w,key)).map(w=>value(w,key));
  }
  function bindHistoryExcel(table){
    const XF=window.HAP_XF;
    if(!XF || typeof XF.bind!=='function')return;
    xfStore=XF.register({
      id:HISTORY_XF_ID,rows:activeRows,columns:historyColumns,
      onChange:display,valuesProvider:filterOptionsFor
    });
    XF.bind({
      id:HISTORY_XF_ID,table,rows:activeRows,columns:historyColumns,
      onChange:display,valuesProvider:filterOptionsFor
    });
  }
  function display(){
    const section=document.getElementById('v4078-table-adjustments');if(!section)return;
    const XF=window.HAP_XF;
    if(XF){
      xfStore=XF.register({id:HISTORY_XF_ID,rows:activeRows,columns:historyColumns,
        onChange:display,valuesProvider:filterOptionsFor});
      shownRows=XF.apply(HISTORY_XF_ID,activeRows);
    } else {
      // Enquanto o núcleo de filtros ainda carrega, nunca exibir falsos totais.
      shownRows=[...activeRows];
    }
    if(!xfStore?.sort?.dir)shownRows=[...shownRows].sort((a,b)=>n(b.current)-n(a.current));
    const head=cols.map(([k,label,num])=>'<th class="'+(num?'num':'')+'">'+esc(label)+'</th>').join('')+'<th>Movimentações</th>';
    const rows=shownRows.map(w=>'<tr><td class="v40146-work"><strong>'+esc(w.nome)+'</strong><small>'+esc(w.ois.join(', ')||'OI não identificada')+'</small></td>'+
      ['initial','conting','aporte','transfers','current'].map(k=>'<td class="num">'+(k==='current'?'<strong>':'')+money(value(w,k))+(k==='current'?'</strong>':'')+'</td>').join('')+
      '<td><button class="v40146-detail" data-v40146-detail="'+esc(w.key)+'">Detalhar</button></td></tr>').join('');
    // Total calculado SEMPRE a partir das linhas após todos os filtros locais e globais.
    // A linha de total existe inclusive com nenhum resultado (todos os valores = R$ 0,00).
    const totals=cols.map(([k])=>'<td class="'+(k==='obra'?'':'num')+'">'+(k==='obra'?'TOTAL VISÍVEL ('+shownRows.length+' obra(s))':money(shownRows.reduce((sum,w)=>sum+value(w,k),0)))+'</td>').join('')+'<td></td>';
    const filtered=!!XF?.hasAnyFilter?.(HISTORY_XF_ID);
    const controls='<div class="v4078-table-actions"><span class="v4078-table-count">'+shownRows.length+' de '+activeRows.length+' obras</span>'+
      '<button type="button" class="v40149-clear" data-v40149-clear '+(filtered?'':'disabled')+'>Limpar filtros da tabela</button></div>';
    section.innerHTML='<div class="v4071-section-head"><div><strong>Histórico de CAPEX por Obra</strong><small>CAPEX inicial, ajustes, transferências e CAPEX atual registrado. Histórico integral do exercício (o filtro de meses não altera os valores acumulados). Consulte o detalhe da obra.</small></div>'+controls+'</div>'+
      '<div class="v4071-table-wrap"><table class="v4071-table"><thead><tr>'+head+'</tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="empty-state">Nenhuma obra encontrada.</td></tr>')+'</tbody><tfoot><tr class="v40146-footer">'+totals+'</tr></tfoot></table></div>';
    section.dataset.v40146='yes';
    bindHistoryExcel(section.querySelector('table'));
    section.querySelector('[data-v40149-clear]')?.addEventListener('click',()=>window.HAP_XF?.clear(HISTORY_XF_ID));
  }
  function detail(k){
    const w=activeRows.find(x=>x.key===k);if(!w)return;
    document.querySelector('.v40146-modal')?.remove();
    const table=(heads,rows)=>'<div class="v40146-overflow"><table><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="'+heads.length+'">Nenhum registro</td></tr>')+'</tbody></table></div>';
    const initial=table(['Linha','OI','Obra do orçamento','CAPEX inicial'],w.baseline.map(x=>'<tr><td>'+esc(x.linha||'—')+'</td><td>'+esc(x.oi||'—')+'</td><td>'+esc(x.nome)+'</td><td class="num">'+money(x.valor)+'</td></tr>').join(''));
    const adj=table(['Mês','OI','Tipo','Descrição','Valor'],w.movements.map(x=>'<tr><td>'+esc(x.mes||x.data||'—')+'</td><td>'+esc(x.oi||'—')+'</td><td>'+esc(x.tipo)+'</td><td>'+esc(x.nome_lancamento||'')+'</td><td class="num">'+money((x.tipo==='aporte'?1:-1)*x.valor)+'</td></tr>').join(''));
    const transfers=table(['Data','Documento','OI','Contraparte','Movimento','Valor'],w.transferLines.map(x=>'<tr><td>'+esc(x.data||'—')+'</td><td>'+esc(x.documento||'—')+'</td><td>'+esc(x.oi)+'</td><td>'+esc(x.outra||'—')+'</td><td>'+esc(x.sentido)+'</td><td class="num">'+money(x.valor)+'</td></tr>').join(''));
    const current=table(['OI','Nome','CAPEX atual'],w.currentLines.map(x=>'<tr><td>'+esc(x.oi)+'</td><td>'+esc(x.nome)+'</td><td class="num">'+money(x.valor)+'</td></tr>').join(''));
    const el=document.createElement('div');el.className='v40146-modal';
    el.innerHTML='<div class="v40146-dialog"><button type="button" class="v40146-close">Fechar</button><h2>'+esc(w.nome)+'</h2><p>OI(s): '+esc(w.ois.join(', ')||'Sem OI')+'</p><div class="v40146-totals"><span>Inicial: <b>'+money(w.initial)+'</b></span><span>Contingenciamentos: <b>'+money(-w.conting)+'</b></span><span>Aportes: <b>'+money(w.aporte)+'</b></span><span>Transferências: <b>'+money(w.transfers)+'</b></span><span>Atual: <b>'+money(w.current)+'</b></span></div><h3>CAPEX inicial</h3>'+initial+'<h3>Aportes e contingenciamentos</h3>'+adj+'<h3>Transferências</h3>'+transfers+'<h3>CAPEX atual por OI</h3>'+current+'</div>';
    document.body.appendChild(el);el.querySelector('.v40146-close').onclick=()=>el.remove();el.onclick=e=>{if(e.target===el)el.remove();};
  }
  async function run(){
    busy=false;clearTop();if(!gerencialVisible())return;
    const container=document.getElementById('v4078-table-adjustments');
    if(container.dataset.v40146==='yes')return;
    const year=currentYear();if(!year)return;
    if(renderedYear!==year){
      window.HAP_XF?.clear(HISTORY_XF_ID,{silent:true});
      xfStore=null;renderedYear=year;
    }
    const requestId=year+'-'+String(Date.now());key=requestId;
    const section=container;
    try{
      const raw=await acquire(year);
      if(key!==requestId||!section.isConnected||!gerencialVisible())return;
      activeRows=applyGlobal(buildHistory(raw));
      display();
    }catch(err){
      if(section.isConnected){section.dataset.v40146='yes';section.innerHTML='<div class="v4071-section-head"><div><strong>Histórico de CAPEX por Obra</strong><small>Consulta indisponível: '+esc(err?.message||err)+'.</small></div></div>';}
      console.warn('[HAPCAPEX histórico] Falha de consulta',err?.code||'');
    }
  }
  function schedule(){
    clearTop();if(busy)return;busy=true;
    requestAnimationFrame(()=>{void run();});
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-v40146-detail]');
    if(btn)detail(btn.dataset.v40146Detail);
  });
  const observer=new MutationObserver(mutations=>{
    if(!gerencialVisible())return;
    if(mutations.some(x=>x.addedNodes.length&&[...x.addedNodes].some(n=>n.nodeType===1 && (n.id==='v4078-table-adjustments'||n.querySelector?.('#v4078-table-adjustments')||n.id==='v4078-table-top'))))schedule();
  });
  function boot(){observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});schedule();}
  if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
  // Exportações integradas: preserva demais dados gerenciais, exclui Top OIs
  // e substitui a antiga tabela de ajustes pelo histórico financeiro.
  function safeSummary(){
    try{return window.HAP_V4071_CONTROL_MANAGERIAL?.summaryData?.()||null;}catch(_){return null;}
  }
  function visibleHistory(){return shownRows;}
  const asBr=x=>money(x);
  function addSheet(book,name,items,widths){
    const ws=XLSX.utils.json_to_sheet(items);
    if(widths)ws['!cols']=widths.map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(book,ws,name.slice(0,31));
  }
  function downloadExcel(){
    if(typeof XLSX==='undefined'||!cached){alert('O histórico ainda não está disponível para exportação.');return;}
    const s=safeSummary(),rows=visibleHistory(),book=XLSX.utils.book_new();
    if(s){
      addSheet(book,'Resumo',[{Indicador:'Exercício',Valor:currentYear()},{Indicador:'CAPEX atual',Valor:s.totalAttr},{Indicador:'Compromissado',Valor:s.totalComp},{Indicador:'Saldo livre',Valor:s.totalSaldo},{Indicador:'Realizado no período',Valor:s.totalReal},{Indicador:'OIs selecionadas',Valor:s.ois?.length||0},{Indicador:'Aportes no período',Valor:s.aporte},{Indicador:'Contingenciamentos no período',Valor:s.conting}], [30,22]);
      addSheet(book,'Pacotes',(s.packages||[]).map(x=>({Pacote:x.label,OIs:x.qtd_ois,CAPEX:x.atribuido,Compromissado:x.compromissado,Realizado:x.realizado,Saldo:x.saldo,Aportes:x.aporte,Contingenciamentos:x.conting})),[37,10,20,20,20,20,20,20]);
      addSheet(book,'HEAD',(s.heads||[]).map(x=>({HEAD:x.label,OIs:x.qtd_ois,CAPEX:x.atribuido,Compromissado:x.compromissado,Realizado:x.realizado,Saldo:x.saldo})),[35,10,20,20,20,20]);
      addSheet(book,'CAPEX Inicial x Atual',(s.capexComparison||[]).map(x=>({Pacote:x.pacote,CAPEX_Inicial:x.capex_inicial,CAPEX_Atual:x.capex_atual,Variacao:x.variacao,Variacao_Pct:x.variacao_pct})),[37,20,20,20,16]);
      addSheet(book,'Transferencias',(s.transfers||[]).map(t=>({Data:t.data,Documento:t.numero_documento,OI_Origem:t.oi_origem,Obra_Origem:t.nome_origem,OI_Destino:t.oi_destino,Obra_Destino:t.nome_destino,Valor:t.valor,Pacote_Origem:t.pacote_origem,Pacote_Destino:t.pacote_destino,Justificativa:t.justificativa})),[13,18,14,40,14,40,20,30,30,45]);
      addSheet(book,'Saldo Liquido Pacotes',(s.nets||[]).map(x=>({Pacote:x.pacote,Recebido:x.recebido,Doado:x.doado,Saldo_Liquido:x.liquido})),[37,20,20,20]);
      addSheet(book,'Realizado Mensal',(s.monthly||[]).map(x=>({Mes:x.label,Realizado:x.valor,Acumulado:x.acumulado})),[16,22,22]);
      addSheet(book,'Aportes Conting',(s.moves||[]).map(x=>({Pacote:x.pacote,Aportes:x.aporte,Contingenciamentos:x.conting,Liquido:x.liquido})),[35,20,22,20]);
      addSheet(book,'Pendencias Cadastro',(s.pending||[]).map(o=>({OI:o.oi,Obra:o.nome,Sem_Pacote:o.pacote_faltante?'Sim':'Não',Sem_HEAD:o.head_faltante?'Sim':'Não'})),[14,48,15,15]);
    }
    const clean=rows.map(w=>({Obra:w.nome,OIs:w.ois.join(', '),CAPEX_Inicial:w.initial,Contingenciamentos:-w.conting,Aportes_Extras:w.aporte,Saldo_Transferencias:w.transfers,CAPEX_Atual:w.current}));
    const total={Obra:'TOTAL',OIs:'',CAPEX_Inicial:rows.reduce((t,w)=>t+w.initial,0),Contingenciamentos:-rows.reduce((t,w)=>t+w.conting,0),Aportes_Extras:rows.reduce((t,w)=>t+w.aporte,0),Saldo_Transferencias:rows.reduce((t,w)=>t+w.transfers,0),CAPEX_Atual:rows.reduce((t,w)=>t+w.current,0)};
    addSheet(book,'Historico CAPEX Obras',[...clean,total],[55,26,22,22,20,24,22]);
    const details=rows.flatMap(w=>[
      ...w.baseline.map(v=>({Obra:w.nome,OI:v.oi,Data:'Inicial',Tipo:'CAPEX inicial',Valor:v.valor,Referencia:v.nome,Documento:''})),
      ...w.movements.map(m=>({Obra:w.nome,OI:m.oi,Data:m.mes||m.data,Tipo:m.tipo,Valor:(m.tipo==='aporte'?1:-1)*m.valor,Referencia:m.nome_lancamento||'',Documento:''})),
      ...w.transferLines.map(t=>({Obra:w.nome,OI:t.oi,Data:t.data,Tipo:'Transferência '+t.sentido,Valor:t.valor,Referencia:t.outra,Documento:t.documento})),
      ...w.currentLines.map(v=>({Obra:w.nome,OI:v.oi,Data:'Atual',Tipo:'CAPEX atual',Valor:v.valor,Referencia:v.nome,Documento:''}))
    ]);
    addSheet(book,'Movimentacoes Obras',details,[55,14,15,24,20,48,22]);
    XLSX.writeFile(book,'Gerencial_HAPCAPEX_'+currentYear()+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
  }
  const loadLib=(src,check)=>new Promise((resolve,reject)=>{
    if(check())return resolve();
    const script=document.createElement('script');script.src=src;script.onload=resolve;
    script.onerror=()=>reject(new Error('Biblioteca de PDF indisponível'));
    document.head.appendChild(script);
  });
  async function downloadPdf(){
    const btn=document.getElementById('v4071-export-pdf');
    if(btn){btn.disabled=true;btn.textContent='Gerando PDF...';}
    try{
      if(!cached)throw new Error('O histórico ainda não está disponível');
      await loadLib('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
      await loadLib('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',()=>typeof new window.jspdf.jsPDF().autoTable==='function');
      const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),s=safeSummary(),rows=visibleHistory();
      let firstPage=true;
      const addHeader=title=>{doc.setFontSize(14);doc.setTextColor(13,43,78);doc.text(title,12,12);doc.setFontSize(8);doc.setTextColor(80,90,105);doc.text('HAPCAPEX · Exercício '+currentYear(),12,18);};
      const table=(title,heads,body,foot)=>{
        if(!firstPage)doc.addPage();firstPage=false;addHeader(title);
        doc.autoTable({startY:23,theme:'striped',styles:{fontSize:6,cellPadding:1.5},head:[heads],body:body.length?body:[heads.map((_,i)=>i?'':'Sem registros')],foot:foot?[foot]:[],headStyles:{fillColor:[13,43,78]},footStyles:{fillColor:[234,241,250],textColor:[13,43,78],fontStyle:'bold'},margin:{left:11,right:11}});
      };
      if(s){
        table('HAPCAPEX · Gerencial · Resumo',['Indicador','Valor'],[
          ['CAPEX atual',asBr(s.totalAttr)],['Compromissado',asBr(s.totalComp)],['Saldo livre',asBr(s.totalSaldo)],['Realizado no período',asBr(s.totalReal)],['OIs selecionadas',String(s.ois?.length||0)],['Aportes no período',asBr(s.aporte)],['Contingenciamentos no período',asBr(s.conting)]
        ]);
        table('HAPCAPEX · Gerencial · CAPEX inicial x atual',['Pacote','Inicial','Atual','Variação'],(s.capexComparison||[]).map(x=>[x.pacote,asBr(x.capex_inicial),asBr(x.capex_atual),asBr(x.variacao)]));
        table('HAPCAPEX · Gerencial · Pacotes',['Pacote','OIs','CAPEX','Compromissado','Realizado','Saldo'],(s.packages||[]).map(x=>[x.label,String(x.qtd_ois),asBr(x.atribuido),asBr(x.compromissado),asBr(x.realizado),asBr(x.saldo)]));
        table('HAPCAPEX · Gerencial · HEAD',['HEAD','OIs','CAPEX','Compromissado','Realizado','Saldo'],(s.heads||[]).map(x=>[x.label,String(x.qtd_ois),asBr(x.atribuido),asBr(x.compromissado),asBr(x.realizado),asBr(x.saldo)]));
      }
      // Conserva os gráficos da Gerencial na exportação, sem o ranking eliminado.
      const chartPairs=[
        ['v4071-chart-package','Concentração por pacote'],
        ['v4071-chart-head','Concentração por HEAD'],
        ['v4071-chart-realized','Evolução mensal do realizado'],
        ['v4071-chart-transfer','Saldo líquido de transferências'],
        ['v4071-chart-balance','Compromissado x saldo livre'],
        ['v4071-chart-movement','Aportes x contingenciamentos']
      ];
      for(const [canvasId,title] of chartPairs){
        const canvas=document.getElementById(canvasId);
        if(!canvas||!canvas.width||!canvas.height)continue;
        doc.addPage();addHeader('HAPCAPEX · Gerencial · '+title);
        try{
          const width=W-24,scale=width/canvas.width;
          const height=Math.min(155,canvas.height*scale);
          doc.addImage(canvas.toDataURL('image/png'),'PNG',12,25,width,height);
        }catch(err){console.warn('[HAPCAPEX PDF] Gráfico indisponível:',canvasId);}
      }
      const totals=fn=>rows.reduce((a,w)=>a+n(fn(w)),0);
      table('HAPCAPEX · Gerencial · Histórico de CAPEX por Obra',
        ['Obra / OIs','CAPEX inicial','Conting. (−)','Aportes (+)','Transfer. líquidas','CAPEX atual'],
        rows.map(w=>[w.nome+' · '+w.ois.join(', '),asBr(w.initial),asBr(-w.conting),asBr(w.aporte),asBr(w.transfers),asBr(w.current)]),
        ['TOTAL',asBr(totals(w=>w.initial)),asBr(-totals(w=>w.conting)),asBr(totals(w=>w.aporte)),asBr(totals(w=>w.transfers)),asBr(totals(w=>w.current))]);
      const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(115);doc.text(String(i)+'/'+String(pages),W-18,H-6);}
      doc.save('Gerencial_HAPCAPEX_'+currentYear()+'_'+new Date().toISOString().slice(0,10)+'.pdf');
    }catch(err){console.error('[HAPCAPEX exportação PDF]',err);alert('Não foi possível gerar o PDF: '+String(err?.message||err));}
    finally{if(btn){btn.disabled=false;btn.textContent='⬇ PDF';}}
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest?.('#v4071-export-xlsx,#v4071-export-pdf');
    if(!el||!gerencialVisible())return;
    e.preventDefault();e.stopImmediatePropagation();
    if(el.id==='v4071-export-xlsx')downloadExcel();else void downloadPdf();
  },true);
})();

/* HAPCAPEX V40.0.148 — status financeiro final da OI na aba CAPEX.
 * UMA ÚNICA TAG, com precedência dos contingenciamentos sobre aportes.
 * - Contingenciamento com saldo residual: Conting. parcial.
 * - Contingenciamento total, depois aporte: Conting. parcial.
 * - Aporte, depois contingenciamento total: Contingenciada.
 * - Aporte, depois contingenciamento parcial: Conting. parcial.
 * - Aporte sem contingenciamento: Aporte extra.
 * Nenhum valor ou flag de cadastro é modificado no Supabase.
 */
(() => {
  'use strict';
  if (window.__HAP_V40147_FLAGS_FINANCEIROS__) return;
  window.__HAP_V40147_FLAGS_FINANCEIROS__ = true;
  if (!/controle-capex\.html\/?$/i.test(location.pathname)) return;

  const VERSION = '40.0.148';
  const EPS = 0.005;
  let cache = null;
  let pending = null;
  let scheduled = false;
  let lastAttempt = 0;
  const MIN_RETRY_MS = 15000;
  const MAX_AGE_MS = 60000;
  let lastFinancialSignature = '';

  function activeYear() {
    let fromControl = null;
    try { fromControl = window.HAP_V40139?.getSelectedYear?.(); } catch (_) {}
    let fromState = null;
    try {
      if (typeof state !== 'undefined') {
        fromState = state?.rows?.find?.(o => Number(o?.exercicio) >= 2000)?.exercicio || null;
      }
    } catch (_) {}
    const year = Number(fromControl || fromState || new Date().getFullYear());
    return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
  }
  function dateKey(m) {
    const value = String(m?.data || m?.mes || '').slice(0,10);
    return /^\d{4}-\d{2}/.test(value) ? value : '';
  }
  function getCapexTables() {
    return [...document.querySelectorAll('.table-card table')].filter(table => {
      const h = [...table.querySelectorAll('thead tr:first-child th')]
        .map(th => String(th.childNodes?.[0]?.textContent || th.textContent || '').normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'').replace(/[↑↓↕⇅⇵▲▼▴▾⇧⇩]/g,'').replace(/\s+/g,' ').trim().toUpperCase());
      return h[0] === 'OI' && h[1] === 'OBRA' && h.includes('MONTANTE') &&
        h.includes('COMPROMISSADO') && h.includes('SALDO') &&
        h.some(x => x.includes('% COMP'));
    });
  }
  function aggregate(movimentos) {
    const result = new Map();
    for (const m of movimentos) {
      const oi = String(m?.oi || '').trim();
      if (!/^\d{5,10}$/.test(oi)) continue;
      const tipo = String(m.tipo || '');
      if (tipo !== 'aporte' && tipo !== 'contingenciamento') continue;
      const valor = Number(m.valor || 0);
      if (!Number.isFinite(valor)) continue;
      if (!result.has(oi)) result.set(oi, {conting:0, aporte:0, ultimaCont:'', ultimaAporte:''});
      const r = result.get(oi);
      const date = dateKey(m);
      if (tipo === 'contingenciamento') {
        r.conting += valor;
        if (date > r.ultimaCont) r.ultimaCont = date;
      } else {
        r.aporte += valor;
        if (date > r.ultimaAporte) r.ultimaAporte = date;
      }
    }
    return result;
  }
  async function fetchFlags(year) {
    if (cache?.year === year && Date.now() - cache.at < MAX_AGE_MS) return cache.flags;
    if (pending?.year === year) return pending.promise;
    if (Date.now() - lastAttempt < MIN_RETRY_MS) return cache?.year === year ? cache.flags : null;
    if (typeof sb === 'undefined' || typeof sb.rpc !== 'function') return null;
    lastAttempt = Date.now();
    const promise = (async () => {
      const response = await sb.rpc('obter_ajustes_obra_gerencial_v40144',{p_exercicio:year});
      if (response.error) throw response.error;
      if (!Array.isArray(response.data?.movimentos)) throw new Error('Histórico financeiro indisponível');
      const flags = aggregate(response.data.movimentos);
      cache = {year,at:Date.now(),flags};
      return flags;
    })();
    pending = {year,promise};
    try { return await promise; }
    catch (e) {
      // Falha de histórico nunca deve converter contingenciada em parcial nem
      // esconder uma tag existente. O sistema permanece com a marcação original.
      console.warn('[HAPCAPEX flags financeiros] Histórico indisponível',e?.code || '');
      return cache?.year === year ? cache.flags : null;
    } finally { if (pending?.promise === promise) pending = null; }
  }
  // Prioridade exclusiva: contingenciamento parcial/total OU aporte, nunca ambos.
  // Retira também as tags antigas impressas pela tela original.
  function setFinalBadge(cell, status, title) {
    const financial=[...cell.querySelectorAll('span.flag')].filter(x =>
      /\bflag-(?:conting|conting-partial|aporte)\b/.test(x.className));
    const existing=financial[0] || null;
    if (!status) {
      financial.forEach(tag => tag.remove());
      return;
    }
    const options={
      partial:{css:'flag-conting-partial', label:'Conting. parcial'},
      total:{css:'flag-conting', label:'Contingenciada'},
      aporte:{css:'flag-aporte', label:'Aporte extra'}
    };
    const desired=options[status];
    if (!desired) return;
    const badge=existing || document.createElement('span');
    if (!existing) {
      cell.insertBefore(badge,cell.firstChild);
      badge.insertAdjacentText('afterend',' ');
    }
    badge.className='flag '+desired.css;
    badge.textContent=desired.label;
    badge.title=title;
    financial.slice(existing?1:0).forEach(tag => tag.remove());
  }
  function readCellMoney(text) {
    const raw=String(text||'').trim().replace(/\u00a0/g,'').replace(/R\$/gi,'')
      .replace(/\s/g,'').replace(/\./g,'').replace(',','.');
    const value=Number(raw);
    return Number.isFinite(value)?value:null;
  }
  // O resultado é aferido após TODO o histórico do exercício.
  // Aportes anteriores ao último contingenciamento não reativam sua tag.
  function resolveFinalStatus(record, saldo) {
    if (!record) return null;
    const hasConting=record.conting>EPS;
    const hasAporte=record.aporte>EPS;
    if (!hasConting) return hasAporte?'aporte':null;
    const hasResidual=Number.isFinite(saldo) && saldo>EPS;
    const laterAporte=hasAporte && record.ultimaAporte && record.ultimaCont &&
      record.ultimaAporte>record.ultimaCont;
    if (hasResidual || laterAporte) return 'partial';
    return 'total';
  }
  function applyTags(flags) {
    if (!flags) return;
    const tableList=getCapexTables();
    if (!tableList.length) return;
    for (const table of tableList) {
      const saldoIndex=[...table.querySelectorAll('thead tr:first-child th')]
        .findIndex(th=>String(th.childNodes?.[0]?.textContent||th.textContent||'')
          .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          .trim().toUpperCase()==='SALDO');
      if (saldoIndex<0) continue;
      for (const tr of table.tBodies?.[0]?.rows || []) {
        const oi=String(tr.cells?.[0]?.textContent||'').match(/^\s*(\d{5,10})(?!\d)/)?.[1]||'';
        const cell=tr.cells?.[1];
        if(!/^\d{5,10}$/.test(oi)||!cell||oi==='9999999999')continue;
        const record=flags.get(oi);
        const currentFinancial=[...cell.querySelectorAll('span.flag')].filter(x=>
          /\bflag-(?:conting|conting-partial|aporte)\b/.test(x.className));
        if(!record){
          // Mantém o indicador do cadastro quando não existe lançamento recuperado.
          // Mesmo nesse caso, nunca permite as duas tags ao mesmo tempo.
          if(currentFinancial.length>1){
            const contingent=currentFinancial.some(x=>/\bflag-(?:conting|conting-partial)\b/.test(x.className));
            setFinalBadge(cell,contingent?'total':'aporte','Status do cadastro; sem movimentação histórica localizada');
          }
          continue;
        }
        const saldo=readCellMoney(tr.cells?.[saldoIndex]?.textContent);
        const status=resolveFinalStatus(record,saldo);
        // Uma consulta válida ao histórico é a fonte de verdade da classificação.
        const title=status==='partial'?'Contingenciamento com verba disponível ou aporte posterior':
          status==='total'?'Última situação: contingenciamento sem verba residual':
          status==='aporte'?'Aportes sem contingenciamento posterior':'';
        setFinalBadge(cell,status,title);
      }
    }
  }
  function ensureCss() {
    if (document.getElementById('hap-v40147-flags-style')) return;
    const css = document.createElement('style');
    css.id = 'hap-v40147-flags-style';
    css.textContent = '.flag-conting-partial{background:#fff1cb!important;color:#805500!important;border:1px solid #eec96d!important;white-space:nowrap}';
    document.head.appendChild(css);
  }
  function financialSignature() {
    try {
      if (typeof state === 'undefined' || !Array.isArray(state?.rows) || !state.rows.length) return '';
      // Invalida o cache quando o Controle recebe novos valores, sem polling.
      return state.rows.map(r => [r.ordem_interna,r.montante_atribuido,r.saldo_disponivel,
        r.contingenciada,r.aporte_extra].join(':')).join('|');
    } catch (_) { return ''; }
  }
  function refresh() {
    scheduled = false;
    const signature = financialSignature();
    if (signature && signature !== lastFinancialSignature) {
      if (lastFinancialSignature) { cache = null; lastAttempt = 0; }
      lastFinancialSignature = signature;
    }
    const tables = getCapexTables();
    if (!tables.length) return;
    ensureCss();
    const year = activeYear();
    if (!year) return;
    if (cache?.year === year) applyTags(cache.flags);
    void fetchFlags(year).then(flags => {
      if (activeYear() === year) applyTags(flags);
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }
  const observer = new MutationObserver(records => {
    if (!getCapexTables().length) return;
    // Mudanças de conteúdo da célula após atualização não são enviadas ao banco.
    // Não há requisição para cada mutação: a consulta fica em cache por exercício.
    if (records.some(r => [...r.addedNodes].some(n =>
      n.nodeType === 1 && (n.matches?.('tr,tbody,table,.table-card') ||
      n.querySelector?.('tr,tbody,table,.table-card'))))) schedule();
  });
  function boot() {
    ensureCss();
    observer.observe(document.getElementById('app') || document.body,
      {childList:true,subtree:true});
    schedule();
  }
  window.HAP_V40147_FINANCIAL_FLAGS = Object.freeze({version:VERSION,refresh:schedule});
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
