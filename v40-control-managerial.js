/* HAPCAPEX V40.0.78 — Controle de Capex: tabelas gerenciais filtráveis + rotas líquidas.
   - Gerencial com filtros globais, KPIs, tabelas e gráficos integrados.
   - Saldo líquido de transferências, concentração CAPEX, Realizado mensal,
     aportes/contingenciamentos, comprometido x saldo livre, Top OIs e pendências.
   - Exportação Excel e PDF.
   - OIs sem Pacote/HEAD aparecem como pendência corrigível e notificação backend.
   - Regra Carry Over preservada no front e no backend.
   - Tempo de obra em dias corridos no formulário de criação de OI.
*/
(() => {
  'use strict';
  if (window.__HAP_V4074_CONTROL_MANAGERIAL__) return;
  window.__HAP_V4074_CONTROL_MANAGERIAL__ = true;

  const VERSION = '40.0.78';
  const MONTHS = [
    ['01','Jan'],['02','Fev'],['03','Mar'],['04','Abr'],['05','Mai'],['06','Jun'],
    ['07','Jul'],['08','Ago'],['09','Set'],['10','Out'],['11','Nov'],['12','Dez']
  ];
  const moneyFmt = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
  const intFmt = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const numFmt = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const mgr = {
    raw: null,
    pacote: '',
    head: '',
    query: '',
    monthStart: 1,
    monthEnd: 12,
    saldo: 'all',
    transferRule: 'all',
    topN: 10,
    charts: {},
    chartReady: false,
    chartSeq: 0,
    loading: false,
    tableStates: {}
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => moneyFmt.format(n(value));
  const pct = value => `${n(value).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
  const uniq = arr => [...new Set(arr.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))];
  const EXCLUDED_MANAGERIAL_PACKAGES = new Set(['COMPENSACAO DE ADIANTAMENTO']);
  const isExcludedManagerialPackage = value => EXCLUDED_MANAGERIAL_PACKAGES.has(norm(value));

  function canonicalPackage(value) {
    const raw = String(value || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    const normalized = raw.replace(/[|\-]/g,' ').replace(/\s+/g,' ').toUpperCase();
    return /CARRY\s*OVER/.test(normalized) ? 'Carry Over' : (raw || 'Sem classificação');
  }

  function getTableState(id) {
    if(!mgr.tableStates[id]) mgr.tableStates[id]={filters:{},sortKey:'',sortDir:0};
    return mgr.tableStates[id];
  }
  function resetTableStates(){ mgr.tableStates={}; }

  function parseLocaleNumber(value) {
    let s=String(value??'').trim().replace(/\s+/g,'').replace(/^R\$/i,'').replace(/%$/,'');
    if(!s) return null;
    if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(',')) s=s.replace(',','.');
    else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
    s=s.replace(/[^\d+\-.]/g,'');
    const v=Number(s);
    return Number.isFinite(v)?v:null;
  }
  function numericFilterMatch(value,query) {
    const q=String(query||'').trim();
    if(!q) return true;
    const current=n(value);
    const range=q.match(/^\s*(.+?)\s*\.\.\s*(.+?)\s*$/);
    if(range){
      const a=parseLocaleNumber(range[1]), b=parseLocaleNumber(range[2]);
      return a!==null && b!==null && current>=Math.min(a,b) && current<=Math.max(a,b);
    }
    const op=q.match(/^(>=|<=|>|<|=)\s*(.+)$/);
    if(op){
      const target=parseLocaleNumber(op[2]); if(target===null)return false;
      if(op[1]==='>=')return current>=target;
      if(op[1]==='<=')return current<=target;
      if(op[1]==='>')return current>target;
      if(op[1]==='<')return current<target;
      return Math.abs(current-target)<0.005;
    }
    const qn=norm(q);
    const candidates=[String(current),current.toLocaleString('pt-BR',{maximumFractionDigits:2}),money(current),numFmt.format(current)];
    return candidates.some(x=>norm(x).includes(qn));
  }
  function columnFilterMatch(row,col,query) {
    if(!String(query||'').trim()) return true;
    const value=typeof col.value==='function'?col.value(row):row?.[col.key];
    return col.type==='number' ? numericFilterMatch(value,query) : norm(value).includes(norm(query));
  }
  function compareColumnValues(a,b,col) {
    const av=typeof col.value==='function'?col.value(a):a?.[col.key];
    const bv=typeof col.value==='function'?col.value(b):b?.[col.key];
    if(col.type==='number') return n(av)-n(bv);
    return String(av??'').localeCompare(String(bv??''),'pt-BR',{numeric:true,sensitivity:'base'});
  }
  function tableView(id,rows,columns) {
    const st=getTableState(id);
    let out=rows.filter(row=>columns.every(col=>columnFilterMatch(row,col,st.filters[col.key])));
    const col=columns.find(c=>c.key===st.sortKey);
    if(col && st.sortDir) out=[...out].sort((a,b)=>compareColumnValues(a,b,col)*st.sortDir);
    return out;
  }
  function tableSortIndicator(id,key) {
    const st=getTableState(id);
    if(st.sortKey!==key || !st.sortDir) return '↕';
    return st.sortDir===-1?'↓':'↑';
  }
  function tableHasState(id) {
    const st=getTableState(id);
    return !!(st.sortDir || Object.values(st.filters).some(v=>String(v||'').trim()));
  }
  function renderManagerialTable({id,title,description,rows,columns,empty='Sem dados.'}) {
    const st=getTableState(id);
    const visible=tableView(id,rows,columns);
    const head=columns.map(col=>`<th class="${col.num?'num ':''}v4078-sortable" data-v4078-sort-table="${esc(id)}" data-v4078-sort-key="${esc(col.key)}" title="Clique: maior→menor; novamente: menor→maior; terceiro clique: padrão">${esc(col.label)}<span class="v4078-sort-ind">${tableSortIndicator(id,col.key)}</span></th>`).join('');
    const filters=columns.map(col=>`<th><input class="v4078-col-filter" data-v4078-filter-table="${esc(id)}" data-v4078-filter-key="${esc(col.key)}" value="${esc(st.filters[col.key]||'')}" placeholder="${col.type==='number'?'≥, ≤ ou valor':'Filtrar...'}" title="${col.type==='number'?'Aceita >, <, >=, <= e intervalo 100..200':'Filtro por texto'}"></th>`).join('');
    const body=visible.map((row,idx)=>`<tr>${columns.map(col=>{
      const cls=typeof col.className==='function'?col.className(row,idx):(col.className||'');
      const cell=typeof col.render==='function'?col.render(row,idx):esc(typeof col.value==='function'?col.value(row):row?.[col.key]);
      return `<td class="${col.num?'num ':''}${cls}">${cell}</td>`;
    }).join('')}</tr>`).join('');
    const actions=`<div class="v4078-table-actions"><span class="v4078-table-count">${intFmt.format(visible.length)} de ${intFmt.format(rows.length)} linha(s)</span>${tableHasState(id)?`<button class="v4078-table-clear" data-v4078-table-clear="${esc(id)}">Limpar filtros/ordenação</button>`:''}</div>`;
    return `<section class="v4071-section" id="v4078-table-${esc(id)}"><div class="v4071-section-head"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div>${actions}</div><div class="v4071-table-wrap"><table class="v4071-table"><thead><tr>${head}</tr><tr class="v4078-filter-row">${filters}</tr></thead><tbody>${body||`<tr><td colspan="${columns.length}" class="empty-state">${esc(empty)}</td></tr>`}</tbody></table></div></section>`;
  }

  function ensureStyle() {
    if (document.getElementById('hap-v4071-managerial-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4071-managerial-style';
    style.textContent = `
      .v4071-toolbar{background:#fff;border:1px solid var(--cinza-borda);border-radius:12px;padding:10px;margin-bottom:12px;box-shadow:0 2px 7px rgba(0,0,0,.035)}
      .v4071-filter-grid{display:grid;grid-template-columns:minmax(220px,2fr) repeat(4,minmax(145px,1fr));gap:8px;align-items:end}
      .v4071-filter-grid label,.v4071-filter-row label{display:flex;flex-direction:column;gap:4px;font-size:9px;font-weight:800;color:var(--texto-suave);text-transform:uppercase;letter-spacing:.035em}
      .v4071-filter-grid input,.v4071-filter-grid select,.v4071-filter-row select{width:100%;min-width:0;border:1px solid var(--cinza-borda);border-radius:8px;background:#fff;padding:7px 8px;font:inherit;font-size:10.5px;color:var(--texto)}
      .v4071-filter-row{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;margin-top:8px}.v4071-filter-row label{min-width:135px}.v4071-filter-row .spacer{flex:1}
      .v4071-btn{border:1px solid #c7d3e3;background:#fff;color:#174f8c;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}.v4071-btn:hover{background:#eef4fc}.v4071-btn.primary{background:#1a4b8c;color:#fff;border-color:#1a4b8c}.v4071-btn.pdf{color:#8a3328;border-color:#e3b7b1}.v4071-btn:disabled{opacity:.5;cursor:default}
      .v4071-filter-summary{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;color:var(--texto-suave);font-size:9.5px}.v4071-chip{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:#eef3f9;color:#415873;font-weight:750}.v4071-chip.warn{background:#fff0c0;color:#8a6000}
      .v4071-section{background:#fff;border-radius:11px;box-shadow:0 2px 8px rgba(0,0,0,.055);margin:0 0 14px;overflow:hidden}.v4071-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 14px;border-bottom:1px solid var(--cinza-borda)}.v4071-section-head strong{display:block;color:var(--azul);font-size:13px}.v4071-section-head small{display:block;color:var(--texto-suave);font-size:9.5px;margin-top:3px;line-height:1.35}
      .v4071-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px}.v4071-chart-card{background:#fff;border-radius:11px;box-shadow:0 2px 8px rgba(0,0,0,.055);padding:11px 12px;min-width:0}.v4071-chart-card h3{font-size:11px;color:var(--azul);margin:0 0 3px}.v4071-chart-card p{font-size:9px;color:var(--texto-suave);margin:0 0 8px;line-height:1.35}.v4071-chart-wrap{position:relative;height:310px}.v4071-chart-wrap.tall{height:360px}.v4071-chart-empty{height:100%;display:flex;align-items:center;justify-content:center;color:var(--texto-suave);font-size:10px;text-align:center;padding:20px}
      .v4071-table-wrap{overflow:auto;max-height:49vh}.v4071-table{min-width:980px}.v4071-table th,.v4071-table td{font-variant-numeric:tabular-nums}.v4071-table th.num,.v4071-table td.num{text-align:right}.v4071-table th.clickable{cursor:pointer}.v4071-table td.main{font-weight:750;color:var(--azul)}.v4071-table td small{display:block;color:var(--texto-suave);font-size:8.5px;margin-top:2px;font-weight:500}
      .v4071-tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:999px;font-size:8.5px;font-weight:850;white-space:nowrap}.v4071-tag.internal{background:#e1f5ee;color:#17643a}.v4071-tag.director{background:#fff0c0;color:#8a6000}.v4071-tag.warning{background:#fcebeb;color:#8f2626}.v4071-tag.info{background:#e8f0fb;color:#174f8c}
      .v4071-kpi-sub{font-size:9px;color:var(--texto-suave);margin-top:4px;line-height:1.3}.v4071-kpi-card.clickable{cursor:pointer}.v4071-kpi-card.clickable:hover{box-shadow:0 6px 15px rgba(13,43,78,.1);transform:translateY(-1px)}
      .v4071-pending{border:1px solid #f0b429;background:#fff9e8}.v4071-pending-list{padding:5px 13px 12px}.v4071-pending-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #f0dfae;padding:8px 0}.v4071-pending-row:first-child{border-top:0}.v4071-pending-row strong{font-size:10px;color:#674700}.v4071-pending-row small{display:block;font-size:9px;color:#7c663a;margin-top:2px}.v4071-edit{border:1px solid #d9a62e;background:#fff;color:#7a5700;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer}
      .v4071-carry-info{background:#e1f5ee;border:1px solid #8fd2b3;color:#17643a;border-radius:8px;padding:5px 7px;font-size:10px;font-weight:650;line-height:1.35}
      .v4071-duration-help{display:block;margin-top:4px;color:var(--texto-suave);font-size:9px;line-height:1.3;text-transform:none;font-weight:400}
      .v4071-positive{color:var(--verde)!important}.v4071-negative{color:var(--vermelho)!important}.v4071-neutral{color:var(--texto-suave)!important}
      .v4078-sortable{cursor:pointer;user-select:none;white-space:nowrap}.v4078-sortable:hover{background:#edf3fb}.v4078-sort-ind{display:inline-block;min-width:12px;margin-left:4px;color:#55708f;font-size:9px}
      .v4078-filter-row th{background:#f7f9fc;padding:4px 5px!important;position:sticky;top:27px;z-index:2}.v4078-col-filter{width:100%;min-width:58px;box-sizing:border-box;border:1px solid #d4deea;border-radius:6px;background:#fff;padding:4px 5px;font:inherit;font-size:8.5px;color:var(--texto)}.v4078-col-filter::placeholder{color:#94a3b8}
      .v4078-table-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.v4078-table-count{font-size:9px;color:var(--texto-suave);white-space:nowrap}.v4078-table-clear{border:1px solid #c7d3e3;background:#fff;color:#47627f;border-radius:7px;padding:5px 7px;font-size:8.5px;font-weight:800;cursor:pointer}.v4078-table-clear:hover{background:#eef4fc}
      @media(max-width:1100px){.v4071-filter-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v4071-filter-grid>label:first-child{grid-column:1/-1}}
      @media(max-width:800px){.v4071-grid-2{grid-template-columns:1fr}.v4071-filter-grid{grid-template-columns:1fr 1fr}.v4071-filter-grid>label:first-child{grid-column:1/-1}.v4071-chart-wrap{height:300px}.v4071-duration-grid{grid-template-columns:1fr!important}.v4071-section-head{flex-direction:column}}
      @media(max-width:520px){.v4071-filter-grid{grid-template-columns:1fr}.v4071-filter-grid>label:first-child{grid-column:auto}.v4071-filter-row{display:grid;grid-template-columns:1fr 1fr}.v4071-filter-row .spacer{display:none}.v4071-btn{width:100%}.v4071-pending-row{align-items:flex-start;flex-direction:column}.v4071-edit{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function managerialNavPill() {
    let active = false;
    try { active = typeof state !== 'undefined' && state?.tab === 'gerencial'; } catch (_) {}
    return `<span class="nav-pill ${active?'active':''}" onclick="switchTab('gerencial')">GERENCIAL</span>`;
  }

  function patchNavigation() {
    if (typeof navHtml !== 'function' || typeof refreshCurrent !== 'function') return false;
    if (window.navHtml?.__hapV4075ManagerialWrapped && window.refreshCurrent?.__hapV4075ManagerialWrapped) {
      window.__HAP_V4071_NAV_PATCHED__ = true;
      return true;
    }

    const originalNav = navHtml;
    const wrappedNav = function(isAdmin) {
      const html = originalNav.apply(this, arguments);
      if (!isAdmin || !html || html.includes("switchTab('gerencial')")) return html;
      return html.replace(/<\/div>\s*$/, `${managerialNavPill()}</div>`);
    };
    wrappedNav.__hapV4075ManagerialWrapped = true;
    wrappedNav.__hapV4075Original = originalNav;
    navHtml = window.navHtml = wrappedNav;

    const originalRefresh = refreshCurrent;
    const wrappedRefresh = async function() {
      try {
        if (typeof state !== 'undefined' && state?.tab === 'gerencial') {
          await loadManagerialTab();
          return;
        }
      } catch (_) {}
      destroyCharts();
      return originalRefresh.apply(this, arguments);
    };
    wrappedRefresh.__hapV4075ManagerialWrapped = true;
    wrappedRefresh.__hapV4075Original = originalRefresh;
    refreshCurrent = window.refreshCurrent = wrappedRefresh;

    window.__HAP_V4071_NAV_PATCHED__ = true;
    return true;
  }

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [y,m,d] = String(value).split('-').map(Number);
    const date = new Date(y,m-1,d,12,0,0,0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function dateValue(date) {
    const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function daysInclusive(start,end) {
    const a=parseDate(start), b=parseDate(end); if(!a||!b) return null;
    return Math.round((b-a)/86400000)+1;
  }
  function endFromDuration(startValue,diasValue) {
    const s=parseDate(startValue); const dias=Math.trunc(Number(diasValue||0));
    if(!s || !Number.isFinite(dias) || dias<1) return '';
    s.setDate(s.getDate()+dias-1);
    return dateValue(s);
  }

  function patchDuration(backdrop) {
    const start = backdrop?.querySelector('#f-data-inicio');
    const end = backdrop?.querySelector('#f-data-fim');
    if (!start || !end || backdrop.querySelector('#v4071-duracao-dias')) return;
    const grid = start.closest('.grid-2');
    if (!grid || end.closest('.grid-2') !== grid) return;
    grid.classList.add('v4071-duration-grid');
    grid.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';
    const field = document.createElement('div');
    field.className='field';
    field.innerHTML=`<label>Tempo de obra (dias corridos)</label><input type="number" min="1" step="1" id="v4071-duracao-dias" placeholder="Ex.: 90"><small class="v4071-duration-help">1 dia = início e fim no mesmo dia.</small>`;
    grid.insertBefore(field,end.closest('.field'));
    const duration = field.querySelector('input');
    let internal=false;
    const calculateEnd=()=>{
      if(internal) return;
      const calculated=endFromDuration(start.value,duration.value);
      if(!calculated) return;
      internal=true; end.value=calculated; end.dispatchEvent(new Event('change',{bubbles:true})); internal=false;
    };
    const calculateDuration=()=>{
      if(internal) return;
      const dias=daysInclusive(start.value,end.value);
      if(dias!==null && dias>=1){ internal=true; duration.value=String(dias); internal=false; }
    };
    start.addEventListener('change',()=>{ if(duration.value) calculateEnd(); else calculateDuration(); });
    duration.addEventListener('input',calculateEnd);
    end.addEventListener('change',calculateDuration);
    calculateDuration();
  }

  function patchCarryWarningElement(el) {
    if (!el) return;
    const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
    const match=text.match(/Pacotes diferentes\s*\((.*?)\s*→\s*(.*?)\)\.?/i);
    if(!match) return;
    if(canonicalPackage(match[1])!=='Carry Over' || canonicalPackage(match[2])!=='Carry Over') return;
    el.innerHTML='<div class="v4071-carry-info">✓ Movimentação interna do pacote gerencial <strong>Carry Over</strong>. Não exige autorização da diretoria.</div>';
  }

  function patchDynamicUi(root=document) {
    ensureStyle();
    document.querySelectorAll('.modal-backdrop').forEach(patchDuration);
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll('[id^="t-pacote-alerta-"],.banner-warn').forEach(patchCarryWarningElement);
  }

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type==='childList' || m.type==='characterData') {
        patchDynamicUi(m.target?.nodeType===1 ? m.target : m.target?.parentElement || document);
      }
    }
  });

  function monthKey(index) {
    const year = Number(mgr.raw?.exercicio || new Date().getFullYear());
    return `${year}-${String(index).padStart(2,'0')}`;
  }
  function periodKeys() {
    const start=Math.min(mgr.monthStart,mgr.monthEnd), end=Math.max(mgr.monthStart,mgr.monthEnd);
    const out=[]; for(let i=start;i<=end;i++) out.push(monthKey(i)); return out;
  }
  function monthLabel(index) { return MONTHS[index-1]?.[1] || String(index); }
  function periodLabel() {
    return mgr.monthStart===1 && mgr.monthEnd===12 ? 'Jan–Dez' : `${monthLabel(Math.min(mgr.monthStart,mgr.monthEnd))}–${monthLabel(Math.max(mgr.monthStart,mgr.monthEnd))}`;
  }
  function monthOfDate(value) {
    const s=String(value||'');
    const m=s.match(/^\d{4}-(\d{2})-/) || s.match(/^\d{4}-(\d{2})$/);
    return m ? Number(m[1]) : null;
  }
  function monthInPeriod(value) {
    const m=monthOfDate(value); if(!m) return true;
    const start=Math.min(mgr.monthStart,mgr.monthEnd), end=Math.max(mgr.monthStart,mgr.monthEnd);
    return m>=start && m<=end;
  }

  function allOis() {
    const rows=Array.isArray(mgr.raw?.ois) ? mgr.raw.ois : [];
    return rows.filter(o=>!isExcludedManagerialPackage(o?.pacote) && !isExcludedManagerialPackage(o?.pacote_original));
  }
  function allTransfers() {
    const rows=Array.isArray(mgr.raw?.transferencias) ? mgr.raw.transferencias : [];
    return rows.filter(t=>!isExcludedManagerialPackage(t?.pacote_origem) && !isExcludedManagerialPackage(t?.pacote_destino) && !isExcludedManagerialPackage(t?.pacote_origem_original) && !isExcludedManagerialPackage(t?.pacote_destino_original));
  }
  function allMovements() {
    const rows=Array.isArray(mgr.raw?.movimentos) ? mgr.raw.movimentos : [];
    return rows.filter(m=>!isExcludedManagerialPackage(m?.pacote));
  }

  function saldoMatches(oi) {
    const s=n(oi?.saldo);
    if(mgr.saldo==='positive') return s>0.005;
    if(mgr.saldo==='zero') return Math.abs(s)<=0.005;
    if(mgr.saldo==='negative') return s<-0.005;
    return true;
  }
  function queryMatches(values) {
    const q=norm(mgr.query); if(!q) return true;
    return values.some(v=>norm(v).includes(q));
  }
  function filteredOis() {
    return allOis().filter(oi => {
      if(mgr.pacote && String(oi.pacote)!==mgr.pacote) return false;
      if(mgr.head && String(oi.head)!==mgr.head) return false;
      if(!saldoMatches(oi)) return false;
      return queryMatches([oi.oi,oi.nome,oi.pacote,oi.pacote_original,oi.head]);
    });
  }
  function activeMainFilter() {
    return !!(mgr.pacote || mgr.head || mgr.query || mgr.saldo!=='all');
  }
  function filteredOiSet() { return new Set(filteredOis().map(x=>String(x.oi))); }
  function transferClassifiable(t) { return String(t?.pacote_origem||'')!=='Sem classificação' && String(t?.pacote_destino||'')!=='Sem classificação'; }

  function filteredTransfers() {
    const oiSet=filteredOiSet();
    return allTransfers().filter(t=>{
      if(!monthInPeriod(t.data)) return false;
      const classifiable=transferClassifiable(t);
      if(mgr.transferRule==='unknown' && classifiable) return false;
      if(mgr.transferRule!=='unknown' && !classifiable) return false;
      if(mgr.transferRule==='internal' && t.exige_autorizacao) return false;
      if(mgr.transferRule==='director' && !t.exige_autorizacao) return false;
      if(mgr.pacote && t.pacote_origem!==mgr.pacote && t.pacote_destino!==mgr.pacote) return false;
      if(mgr.head && t.head_origem!==mgr.head && t.head_destino!==mgr.head) return false;
      if(mgr.query && !queryMatches([t.oi_origem,t.nome_origem,t.oi_destino,t.nome_destino,t.numero_documento,t.justificativa,t.pacote_origem,t.pacote_destino,t.head_origem,t.head_destino])) return false;
      if(mgr.saldo!=='all' && !oiSet.has(String(t.oi_origem)) && !oiSet.has(String(t.oi_destino))) return false;
      return true;
    });
  }

  function filteredUnresolvedTransfers() {
    const oiSet=filteredOiSet();
    return allTransfers().filter(t=>{
      if(transferClassifiable(t)) return false;
      if(!monthInPeriod(t.data)) return false;
      if(mgr.pacote && t.pacote_origem!==mgr.pacote && t.pacote_destino!==mgr.pacote) return false;
      if(mgr.head && t.head_origem!==mgr.head && t.head_destino!==mgr.head) return false;
      if(mgr.query && !queryMatches([t.oi_origem,t.nome_origem,t.oi_destino,t.nome_destino,t.numero_documento,t.justificativa,t.pacote_origem,t.pacote_destino,t.head_origem,t.head_destino])) return false;
      if(mgr.saldo!=='all' && !oiSet.has(String(t.oi_origem)) && !oiSet.has(String(t.oi_destino))) return false;
      return true;
    });
  }

  function filteredMovements() {
    const oiSet=filteredOiSet();
    return allMovements().filter(m=>{
      if(!monthInPeriod(m.data || m.mes)) return false;
      if(mgr.pacote && m.pacote!==mgr.pacote) return false;
      if(mgr.head && m.head!==mgr.head) return false;
      if(mgr.query && !queryMatches([m.oi,m.nome,m.pacote,m.head])) return false;
      if(mgr.saldo!=='all' && !oiSet.has(String(m.oi))) return false;
      return true;
    });
  }

  function realizedPeriod(oi) {
    const obj=oi?.realizado_mensal && typeof oi.realizado_mensal==='object' ? oi.realizado_mensal : {};
    return periodKeys().reduce((s,k)=>s+n(obj[k]),0);
  }
  function aggregateFinance(rows,keyField,labelField=keyField) {
    const map=new Map();
    rows.forEach(oi=>{
      const key=String(oi[keyField] || 'Sem classificação');
      if(!map.has(key)) map.set(key,{key,label:key,qtd_ois:0,atribuido:0,compromissado:0,realizado:0,saldo:0,aporte:0,conting:0});
      const x=map.get(key);
      x.qtd_ois++; x.atribuido+=n(oi.atribuido); x.compromissado+=n(oi.compromissado); x.realizado+=realizedPeriod(oi); x.saldo+=n(oi.saldo); x.aporte+=n(oi.aporte_atual); x.conting+=n(oi.conting_atual);
    });
    const total=rows.reduce((s,o)=>s+n(o.atribuido),0);
    return [...map.values()].map(x=>({
      ...x,
      pct_capex: total ? x.atribuido/total*100 : 0,
      pct_compromissado: x.atribuido ? x.compromissado/x.atribuido*100 : 0,
      pct_realizado: x.atribuido ? x.realizado/x.atribuido*100 : 0
    })).sort((a,b)=>b.atribuido-a.atribuido);
  }

  function aggregateTransferNet(rows) {
    const map=new Map();
    const ensure=p=>{ if(!map.has(p)) map.set(p,{pacote:p,recebido:0,doado:0,liquido:0,qtd_entrada:0,qtd_saida:0}); return map.get(p); };
    rows.forEach(t=>{
      const o=String(t.pacote_origem||'Sem classificação'), d=String(t.pacote_destino||'Sem classificação');
      if(o===d) return; // movimentação interna não altera saldo do pacote gerencial.
      const v=n(t.valor);
      const a=ensure(o), b=ensure(d);
      a.doado+=v; a.qtd_saida++;
      b.recebido+=v; b.qtd_entrada++;
    });
    return [...map.values()].map(x=>({...x,liquido:x.recebido-x.doado})).sort((a,b)=>Math.abs(b.liquido)-Math.abs(a.liquido));
  }

  function aggregateRoutes(rows) {
    const map=new Map();
    rows.forEach(t=>{
      const origem=String(t.pacote_origem||'Sem classificação'), destino=String(t.pacote_destino||'Sem classificação');
      if(origem===destino) return;
      const ordered=[origem,destino].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
      const a=ordered[0], b=ordered[1], key=`${a}|||${b}`;
      if(!map.has(key)) map.set(key,{a,b,ab:0,ba:0,qtd_ab:0,qtd_ba:0});
      const x=map.get(key), valor=n(t.valor);
      if(origem===a){x.ab+=valor;x.qtd_ab++;}else{x.ba+=valor;x.qtd_ba++;}
    });
    return [...map.values()].map(x=>{
      const saldo=x.ab-x.ba;
      if(Math.abs(saldo)<0.005) return null;
      const direto=saldo>0;
      return {
        origem:direto?x.a:x.b,
        destino:direto?x.b:x.a,
        total:Math.abs(saldo),
        qtd:x.qtd_ab+x.qtd_ba,
        qtd_sentido:direto?x.qtd_ab:x.qtd_ba,
        qtd_contrario:direto?x.qtd_ba:x.qtd_ab,
        bruto_sentido:direto?x.ab:x.ba,
        bruto_contrario:direto?x.ba:x.ab,
        compensado:Math.min(x.ab,x.ba)
      };
    }).filter(Boolean).sort((a,b)=>b.total-a.total);
  }

  function aggregateMovements(rows) {
    const map=new Map();
    rows.forEach(m=>{
      const p=String(m.pacote||'Sem classificação');
      if(!map.has(p)) map.set(p,{pacote:p,aporte:0,conting:0,liquido:0,qtd_aporte:0,qtd_conting:0});
      const x=map.get(p);
      if(m.tipo==='aporte'){x.aporte+=n(m.valor);x.qtd_aporte++;}
      else if(m.tipo==='contingenciamento'){x.conting+=n(m.valor);x.qtd_conting++;}
    });
    return [...map.values()].map(x=>({...x,liquido:x.aporte-x.conting})).sort((a,b)=>(b.aporte+b.conting)-(a.aporte+a.conting));
  }

  function monthlyRealized(rows) {
    const year=Number(mgr.raw?.exercicio||new Date().getFullYear());
    let cumulative=0;
    const result=[];
    for(let i=Math.min(mgr.monthStart,mgr.monthEnd);i<=Math.max(mgr.monthStart,mgr.monthEnd);i++){
      const key=`${year}-${String(i).padStart(2,'0')}`;
      const value=rows.reduce((s,o)=>s+n(o.realizado_mensal?.[key]),0);
      cumulative+=value;
      result.push({mes:key,label:`${monthLabel(i)}/${String(year).slice(-2)}`,valor:value,acumulado:cumulative});
    }
    return result;
  }

  function topBalance(rows) {
    return [...rows].sort((a,b)=>n(b.saldo)-n(a.saldo)).slice(0,Math.max(1,n(mgr.topN)));
  }

  function pendingRows(rows) { return rows.filter(o=>o.pacote_faltante || o.head_faltante); }

  function summaryData() {
    const ois=filteredOis(), transfers=filteredTransfers(), unresolvedTransfers=filteredUnresolvedTransfers(), movements=filteredMovements();
    const packages=aggregateFinance(ois,'pacote');
    const heads=aggregateFinance(ois,'head');
    const nets=aggregateTransferNet(transfers);
    const routes=aggregateRoutes(transfers);
    const moves=aggregateMovements(movements);
    const monthly=monthlyRealized(ois);
    const top=topBalance(ois);
    const pending=pendingRows(ois);
    const totalAttr=ois.reduce((s,o)=>s+n(o.atribuido),0);
    const totalComp=ois.reduce((s,o)=>s+n(o.compromissado),0);
    const totalSaldo=ois.reduce((s,o)=>s+n(o.saldo),0);
    const totalReal=monthly.reduce((s,x)=>s+n(x.valor),0);
    const transferTotal=transfers.reduce((s,t)=>s+n(t.valor),0);
    const transferDirector=transfers.filter(t=>t.exige_autorizacao).reduce((s,t)=>s+n(t.valor),0);
    const transferInternal=transferTotal-transferDirector;
    const aporte=movements.filter(m=>m.tipo==='aporte').reduce((s,m)=>s+n(m.valor),0);
    const conting=movements.filter(m=>m.tipo==='contingenciamento').reduce((s,m)=>s+n(m.valor),0);
    const unresolvedTransferTotal=unresolvedTransfers.reduce((s,t)=>s+n(t.valor),0);
    return {ois,transfers,unresolvedTransfers,movements,packages,heads,nets,routes,moves,monthly,top,pending,totalAttr,totalComp,totalSaldo,totalReal,transferTotal,transferDirector,transferInternal,aporte,conting,unresolvedTransferTotal};
  }

  function optionHtml(value,label,current) {
    return `<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;
  }
  function monthOptions(current) {
    return MONTHS.map((m,i)=>optionHtml(i+1,m[1],current)).join('');
  }
  function filterToolbarHtml() {
    const packages=uniq(allOis().map(o=>o.pacote)).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    const heads=uniq(allOis().map(o=>o.head)).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    return `<div class="v4071-toolbar">
      <div class="v4071-filter-grid">
        <label>Buscar OI / Obra<input id="v4071-filter-query" type="search" placeholder="Ex.: 50159... ou nome" value="${esc(mgr.query)}"></label>
        <label>Pacote CAPEX<select id="v4071-filter-package"><option value="">Todos os pacotes</option>${packages.map(x=>optionHtml(x,x,mgr.pacote)).join('')}</select></label>
        <label>HEAD Operação<select id="v4071-filter-head"><option value="">Todos os HEADs</option>${heads.map(x=>optionHtml(x,x,mgr.head)).join('')}</select></label>
        <label>Situação do saldo<select id="v4071-filter-saldo">
          <option value="all" ${mgr.saldo==='all'?'selected':''}>Todos</option><option value="positive" ${mgr.saldo==='positive'?'selected':''}>Saldo positivo</option><option value="zero" ${mgr.saldo==='zero'?'selected':''}>Saldo zerado</option><option value="negative" ${mgr.saldo==='negative'?'selected':''}>Saldo negativo</option>
        </select></label>
        <label>Regra transferência<select id="v4071-filter-transfer">
          <option value="all" ${mgr.transferRule==='all'?'selected':''}>Todas classificadas</option><option value="internal" ${mgr.transferRule==='internal'?'selected':''}>Internas / sem diretoria</option><option value="director" ${mgr.transferRule==='director'?'selected':''}>Exigem diretoria</option><option value="unknown" ${mgr.transferRule==='unknown'?'selected':''}>Históricas sem pacote</option>
        </select></label>
      </div>
      <div class="v4071-filter-row">
        <label>Mês inicial<select id="v4071-month-start">${monthOptions(mgr.monthStart)}</select></label>
        <label>Mês final<select id="v4071-month-end">${monthOptions(mgr.monthEnd)}</select></label>
        <label>Top OIs<select id="v4071-top-n">${[10,15,20,30,50].map(x=>optionHtml(x,`Top ${x}`,mgr.topN)).join('')}</select></label>
        <span class="spacer"></span>
        <button class="v4071-btn" id="v4071-clear">Limpar filtros</button>
        <button class="v4071-btn primary" id="v4071-export-xlsx">⬇ Excel</button>
        <button class="v4071-btn pdf" id="v4071-export-pdf">⬇ PDF</button>
      </div>
      <div class="v4071-filter-summary" id="v4071-filter-summary"></div>
    </div>`;
  }

  function filtersSummaryHtml(s) {
    const chips=[`Período: ${periodLabel()}`,`${intFmt.format(s.ois.length)} OIs`];
    if(mgr.pacote) chips.push(`Pacote: ${mgr.pacote}`);
    if(mgr.head) chips.push(`HEAD: ${mgr.head}`);
    if(mgr.query) chips.push(`Busca: ${mgr.query}`);
    if(mgr.saldo!=='all') chips.push(`Saldo: ${mgr.saldo==='positive'?'positivo':mgr.saldo==='negative'?'negativo':'zerado'}`);
    if(mgr.transferRule!=='all') chips.push(`Transferências: ${mgr.transferRule==='director'?'Diretoria':mgr.transferRule==='unknown'?'Históricas sem pacote':'Internas'}`);
    return chips.map(x=>`<span class="v4071-chip">${esc(x)}</span>`).join('') + (s.pending.length?`<span class="v4071-chip warn">${s.pending.length} pendência(s) de classificação</span>`:'');
  }

  function kpiHtml(s) {
    const compPct=s.totalAttr ? s.totalComp/s.totalAttr*100 : 0;
    const realPct=s.totalAttr ? s.totalReal/s.totalAttr*100 : 0;
    return `<div class="kpi-grid">
      <div class="kpi-card"><div class="label">Valor atribuído</div><div class="value">${money(s.totalAttr)}</div><div class="v4071-kpi-sub">Snapshot atual · filtros de Pacote/HEAD/OI</div></div>
      <div class="kpi-card" style="border-left-color:var(--azul-claro)"><div class="label">Compromissado</div><div class="value">${money(s.totalComp)}</div><div class="v4071-kpi-sub">${pct(compPct)} do atribuído</div></div>
      <div class="kpi-card" style="border-left-color:var(--laranja)"><div class="label">Realizado no período</div><div class="value" style="color:var(--laranja)">${money(s.totalReal)}</div><div class="v4071-kpi-sub">${periodLabel()} · ${pct(realPct)} do atribuído</div></div>
      <div class="kpi-card" style="border-left-color:var(--verde)"><div class="label">Saldo livre</div><div class="value" style="color:var(--verde)">${money(s.totalSaldo)}</div><div class="v4071-kpi-sub">Atribuído − compromissado</div></div>
      <div class="kpi-card"><div class="label">OIs selecionadas</div><div class="value">${intFmt.format(s.ois.length)}</div><div class="v4071-kpi-sub">Após filtros globais</div></div>
      <div class="kpi-card"><div class="label">Transferido classificado</div><div class="value">${money(s.transferTotal)}</div><div class="v4071-kpi-sub">${intFmt.format(s.transfers.length)} transferência(s) entre pacotes identificados</div></div>
      <div class="kpi-card" style="border-left-color:var(--verde)"><div class="label">Aportes no período</div><div class="value" style="color:var(--verde)">${money(s.aporte)}</div><div class="v4071-kpi-sub">Histórico consolidado da Curva</div></div>
      <div class="kpi-card" style="border-left-color:var(--vermelho)"><div class="label">Contingenciamentos</div><div class="value" style="color:var(--vermelho)">${money(s.conting)}</div><div class="v4071-kpi-sub">Histórico consolidado da Curva · período</div></div>
      <div class="kpi-card v4071-kpi-card clickable" style="border-left-color:${s.pending.length?'var(--laranja)':'var(--verde)'}" id="v4071-pending-kpi"><div class="label">Pendências cadastro</div><div class="value" style="color:${s.pending.length?'var(--laranja)':'var(--verde)'}">${intFmt.format(s.pending.length)}</div><div class="v4071-kpi-sub">OI sem Pacote CAPEX ou HEAD</div></div>
    </div>`;
  }

  function chartGridHtml() {
    const card=(id,title,desc,tall=false)=>`<div class="v4071-chart-card"><h3>${esc(title)}</h3><p>${esc(desc)}</p><div class="v4071-chart-wrap ${tall?'tall':''}"><canvas id="${id}"></canvas></div></div>`;
    return `<div class="v4071-grid-2">
      ${card('v4071-chart-package','Concentração do CAPEX por pacote','% do valor atribuído. Clique em uma barra para filtrar o pacote.',true)}
      ${card('v4071-chart-head','Concentração do CAPEX por HEAD','% do valor atribuído. Exibe os principais HEADs; clique para filtrar.',true)}
      ${card('v4071-chart-realized','Evolução mensal do Realizado','Barras mensais + linha acumulada dentro do período selecionado.')}
      ${card('v4071-chart-transfer','Saldo líquido de transferências por pacote','Recebido − Doado. Movimentações internas do mesmo pacote gerencial não alteram o líquido.')}
      ${card('v4071-chart-balance','Compromissado x saldo livre por pacote','Leitura do valor já comprometido versus o saldo ainda disponível.')}
      ${card('v4071-chart-movement','Aportes x contingenciamentos por pacote','Histórico consolidado da Curva + movimentos integrados atuais no período selecionado.')}
    </div>`;
  }

  function packageTableRows(s) {
    const netMap=new Map(s.nets.map(x=>[x.pacote,x]));
    const movMap=new Map(s.moves.map(x=>[x.pacote,x]));
    return s.packages.map(x=>{
      const tr=netMap.get(x.key)||{recebido:0,doado:0,liquido:0}; const mv=movMap.get(x.key)||{aporte:0,conting:0};
      return {...x,recebido:tr.recebido,doado:tr.doado,liquido_transf:tr.liquido,aporte_mov:mv.aporte,conting_mov:mv.conting};
    });
  }
  function packageTableHtml(s) {
    const rows=packageTableRows(s);
    const cols=[
      {key:'label',label:'Pacote',value:r=>r.label,render:r=>`<strong class="main">${esc(r.label)}</strong>`},
      {key:'qtd_ois',label:'OIs',type:'number',num:true,value:r=>r.qtd_ois,render:r=>intFmt.format(r.qtd_ois)},
      {key:'atribuido',label:'Atribuído',type:'number',num:true,value:r=>r.atribuido,render:r=>money(r.atribuido)},
      {key:'pct_capex',label:'% CAPEX',type:'number',num:true,value:r=>r.pct_capex,render:r=>pct(r.pct_capex)},
      {key:'compromissado',label:'Compromissado',type:'number',num:true,value:r=>r.compromissado,render:r=>money(r.compromissado)},
      {key:'realizado',label:'Realizado',type:'number',num:true,value:r=>r.realizado,render:r=>money(r.realizado)},
      {key:'saldo',label:'Saldo livre',type:'number',num:true,value:r=>r.saldo,className:r=>r.saldo<0?'v4071-negative':'v4071-positive',render:r=>money(r.saldo)},
      {key:'recebido',label:'Recebido',type:'number',num:true,value:r=>r.recebido,render:r=>money(r.recebido)},
      {key:'doado',label:'Doado',type:'number',num:true,value:r=>r.doado,render:r=>money(r.doado)},
      {key:'liquido_transf',label:'Líquido transf.',type:'number',num:true,value:r=>r.liquido_transf,className:r=>r.liquido_transf>0?'v4071-positive':r.liquido_transf<0?'v4071-negative':'v4071-neutral',render:r=>money(r.liquido_transf)},
      {key:'aporte_mov',label:'Aportes',type:'number',num:true,value:r=>r.aporte_mov,className:'v4071-positive',render:r=>money(r.aporte_mov)},
      {key:'conting_mov',label:'Conting.',type:'number',num:true,value:r=>r.conting_mov,className:'v4071-negative',render:r=>money(r.conting_mov)}
    ];
    return renderManagerialTable({id:'packages',title:'Pacotes CAPEX · visão integrada',description:'Atribuído, concentração, consumo, saldo, transferências e ajustes financeiros. Carry Over fica consolidado em um único pacote.',rows,columns:cols});
  }

  function headTableHtml(s) {
    const cols=[
      {key:'label',label:'HEAD',value:r=>r.label,render:r=>`<strong class="main">${esc(r.label)}</strong>`},
      {key:'qtd_ois',label:'OIs',type:'number',num:true,value:r=>r.qtd_ois,render:r=>intFmt.format(r.qtd_ois)},
      {key:'atribuido',label:'Atribuído',type:'number',num:true,value:r=>r.atribuido,render:r=>money(r.atribuido)},
      {key:'pct_capex',label:'% CAPEX',type:'number',num:true,value:r=>r.pct_capex,render:r=>pct(r.pct_capex)},
      {key:'compromissado',label:'Compromissado',type:'number',num:true,value:r=>r.compromissado,render:r=>money(r.compromissado)},
      {key:'realizado',label:'Realizado',type:'number',num:true,value:r=>r.realizado,render:r=>money(r.realizado)},
      {key:'saldo',label:'Saldo',type:'number',num:true,value:r=>r.saldo,className:r=>r.saldo<0?'v4071-negative':'v4071-positive',render:r=>money(r.saldo)},
      {key:'pct_compromissado',label:'% Comp.',type:'number',num:true,value:r=>r.pct_compromissado,render:r=>pct(r.pct_compromissado)},
      {key:'pct_realizado',label:'% Real.',type:'number',num:true,value:r=>r.pct_realizado,render:r=>pct(r.pct_realizado)}
    ];
    return renderManagerialTable({id:'heads',title:'HEAD Operação',description:'Distribuição financeira e concentração dentro do universo filtrado.',rows:s.heads,columns:cols});
  }

  function transferNetTableHtml(s) {
    const cols=[
      {key:'pacote',label:'Pacote',value:r=>r.pacote,render:r=>`<strong class="main">${esc(r.pacote)}</strong>`},
      {key:'recebido',label:'Recebido',type:'number',num:true,value:r=>r.recebido,render:r=>money(r.recebido)},
      {key:'doado',label:'Doado',type:'number',num:true,value:r=>r.doado,render:r=>money(r.doado)},
      {key:'liquido',label:'Líquido',type:'number',num:true,value:r=>r.liquido,className:r=>r.liquido>0?'v4071-positive':r.liquido<0?'v4071-negative':'v4071-neutral',render:r=>money(r.liquido)},
      {key:'qtd_entrada',label:'Entradas',type:'number',num:true,value:r=>r.qtd_entrada,render:r=>intFmt.format(r.qtd_entrada)},
      {key:'qtd_saida',label:'Saídas',type:'number',num:true,value:r=>r.qtd_saida,render:r=>intFmt.format(r.qtd_saida)}
    ];
    return renderManagerialTable({id:'net',title:'Saldo líquido de transferências por pacote',description:`Recebido − Doado. Transferências internas do mesmo pacote gerencial são neutras. ${periodLabel()}.`,rows:s.nets,columns:cols,empty:'Sem transferências externas entre pacotes no período.'});
  }

  function topOisTableHtml(s) {
    const rows=s.top.map((o,i)=>({...o,__rank:i+1}));
    const cols=[
      {key:'__rank',label:'#',type:'number',num:true,value:r=>r.__rank,render:r=>intFmt.format(r.__rank)},
      {key:'oi_obra',label:'OI / Obra',value:r=>`${r.oi} ${r.nome||''}`,render:r=>`<strong class="main">${esc(r.oi)}</strong><small>${esc(r.nome||'')}</small>`},
      {key:'pacote',label:'Pacote',value:r=>r.pacote,render:r=>esc(r.pacote)},
      {key:'head',label:'HEAD',value:r=>r.head,render:r=>esc(r.head)},
      {key:'atribuido',label:'Atribuído',type:'number',num:true,value:r=>r.atribuido,render:r=>money(r.atribuido)},
      {key:'compromissado',label:'Compromissado',type:'number',num:true,value:r=>r.compromissado,render:r=>money(r.compromissado)},
      {key:'saldo',label:'Saldo',type:'number',num:true,value:r=>r.saldo,className:'v4071-positive',render:r=>`<strong>${money(r.saldo)}</strong>`},
      {key:'realizado',label:'Realizado período',type:'number',num:true,value:r=>realizedPeriod(r),render:r=>money(realizedPeriod(r))}
    ];
    return renderManagerialTable({id:'top',title:'Top OIs com maior saldo disponível',description:`Prioriza oportunidades de redistribuição de verba dentro dos filtros atuais. Top ${mgr.topN}.`,rows,columns:cols,empty:'Sem OIs no filtro.'});
  }

  function routesTableHtml(s) {
    const cols=[
      {key:'origem',label:'Origem líquida',value:r=>r.origem,render:r=>`<strong class="main">${esc(r.origem)}</strong>`},
      {key:'destino',label:'Destino líquido',value:r=>r.destino,render:r=>`<strong class="main">${esc(r.destino)}</strong>`},
      {key:'qtd',label:'Movs.',type:'number',num:true,value:r=>r.qtd,render:r=>`<span title="${r.qtd_sentido} no sentido líquido e ${r.qtd_contrario} no sentido contrário">${intFmt.format(r.qtd)}</span>`},
      {key:'total',label:'Saldo transferido',type:'number',num:true,value:r=>r.total,render:r=>`<strong>${money(r.total)}</strong>`}
    ];
    return renderManagerialTable({id:'routes',title:'Rotas líquidas de transferência entre pacotes',description:'Cada par de pacotes é compensado nos dois sentidos. Ex.: 100 de A→B e 20 de B→A resulta em apenas 80 de A→B.',rows:s.routes,columns:cols,empty:'Sem saldo líquido entre pacotes no período.'});
  }

  function managerialTableHtmlById(id,s=summaryData()) {
    if(id==='packages') return packageTableHtml(s);
    if(id==='heads') return headTableHtml(s);
    if(id==='net') return transferNetTableHtml(s);
    if(id==='top') return topOisTableHtml(s);
    if(id==='routes') return routesTableHtml(s);
    return '';
  }
  function refreshManagerialTable(id,focusKey='',caret=null) {
    const current=document.getElementById(`v4078-table-${id}`); if(!current)return;
    const holder=document.createElement('div'); holder.innerHTML=managerialTableHtmlById(id).trim();
    const next=holder.firstElementChild; if(!next)return;
    current.replaceWith(next);
    bindManagerialTableControls(next);
    if(focusKey){
      const input=next.querySelector(`[data-v4078-filter-key="${CSS.escape(focusKey)}"]`);
      if(input){ input.focus(); if(Number.isInteger(caret)) try{input.setSelectionRange(caret,caret);}catch(_){} }
    }
  }
  function bindManagerialTableControls(scope=document) {
    scope.querySelectorAll('[data-v4078-sort-table]').forEach(th=>th.addEventListener('click',()=>{
      const id=th.getAttribute('data-v4078-sort-table'), key=th.getAttribute('data-v4078-sort-key'); if(!id||!key)return;
      const st=getTableState(id);
      if(st.sortKey!==key){st.sortKey=key;st.sortDir=-1;}
      else if(st.sortDir===-1)st.sortDir=1;
      else if(st.sortDir===1){st.sortKey='';st.sortDir=0;}
      else st.sortDir=-1;
      refreshManagerialTable(id);
    }));
    scope.querySelectorAll('[data-v4078-filter-table]').forEach(input=>input.addEventListener('input',e=>{
      const id=input.getAttribute('data-v4078-filter-table'), key=input.getAttribute('data-v4078-filter-key'); if(!id||!key)return;
      getTableState(id).filters[key]=e.target.value||'';
      refreshManagerialTable(id,key,e.target.selectionStart);
    }));
    scope.querySelectorAll('[data-v4078-table-clear]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.getAttribute('data-v4078-table-clear'); if(!id)return;
      mgr.tableStates[id]={filters:{},sortKey:'',sortDir:0};
      refreshManagerialTable(id);
    }));
  }

  function pendingHtml(s) {
    let html='';
    if(s.pending.length) html+=`<section class="v4071-section v4071-pending" id="v4071-pending-section"><div class="v4071-section-head"><div><strong>⚠ OIs com classificação incompleta</strong><small>Essas OIs também são geradas como notificação administrativa até serem corrigidas.</small></div><span class="v4071-tag warning">${s.pending.length} pendência(s)</span></div><div class="v4071-pending-list">${s.pending.map(o=>`<div class="v4071-pending-row"><div><strong>OI ${esc(o.oi)} · ${esc(o.nome||'Sem nome')}</strong><small>${o.pacote_faltante?'Sem Pacote CAPEX':''}${o.pacote_faltante&&o.head_faltante?' · ':''}${o.head_faltante?'Sem HEAD Operação':''}</small></div><button class="v4071-edit" data-v4071-edit-oi="${esc(o.id)}">Corrigir classificação</button></div>`).join('')}</div></section>`;
    if(s.unresolvedTransfers.length) html+=`<section class="v4071-section v4071-pending"><div class="v4071-section-head"><div><strong>⚠ Transferências históricas sem pacote identificável</strong><small>Esses registros permanecem no histórico, mas são excluídos dos KPIs de transferência entre pacotes e da regra de autorização porque não é possível determinar o pacote de uma das pontas.</small></div><span class="v4071-tag warning">${s.unresolvedTransfers.length} · ${money(s.unresolvedTransferTotal)}</span></div></section>`;
    return html;
  }

  function renderContent() {
    const content=document.getElementById('v4071-content'); if(!content || !mgr.raw) return;
    const s=summaryData();
    const summary=document.getElementById('v4071-filter-summary'); if(summary) summary.innerHTML=filtersSummaryHtml(s);
    content.innerHTML=`${kpiHtml(s)}${pendingHtml(s)}${chartGridHtml()}${packageTableHtml(s)}${headTableHtml(s)}${transferNetTableHtml(s)}${topOisTableHtml(s)}${routesTableHtml(s)}`;
    bindContentActions();
    renderCharts(s);
  }

  function bindContentActions() {
    bindManagerialTableControls(document);
    document.querySelectorAll('[data-v4071-edit-oi]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.getAttribute('data-v4071-edit-oi');
      if(typeof editarOi==='function' && id) void editarOi(id);
    }));
    const pending=document.getElementById('v4071-pending-kpi');
    if(pending) pending.addEventListener('click',()=>document.getElementById('v4071-pending-section')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }

  function syncFilterControls() {
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=String(val??'');};
    set('v4071-filter-query',mgr.query);set('v4071-filter-package',mgr.pacote);set('v4071-filter-head',mgr.head);set('v4071-filter-saldo',mgr.saldo);set('v4071-filter-transfer',mgr.transferRule);set('v4071-month-start',mgr.monthStart);set('v4071-month-end',mgr.monthEnd);set('v4071-top-n',mgr.topN);
  }

  function debounce(fn,wait=180){let t;return (...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};}
  function bindFilterControls() {
    const query=document.getElementById('v4071-filter-query');
    if(query) query.addEventListener('input',debounce(e=>{mgr.query=e.target.value||'';renderContent();},180));
    const bind=(id,key,convert=v=>v)=>{const el=document.getElementById(id);if(el)el.addEventListener('change',e=>{mgr[key]=convert(e.target.value);renderContent();});};
    bind('v4071-filter-package','pacote');bind('v4071-filter-head','head');bind('v4071-filter-saldo','saldo');bind('v4071-filter-transfer','transferRule');
    bind('v4071-month-start','monthStart',Number);bind('v4071-month-end','monthEnd',Number);bind('v4071-top-n','topN',Number);
    document.getElementById('v4071-clear')?.addEventListener('click',()=>{
      mgr.pacote='';mgr.head='';mgr.query='';mgr.monthStart=1;mgr.monthEnd=12;mgr.saldo='all';mgr.transferRule='all';mgr.topN=10;resetTableStates();syncFilterControls();renderContent();
    });
    document.getElementById('v4071-export-xlsx')?.addEventListener('click',()=>void exportExcel());
    document.getElementById('v4071-export-pdf')?.addEventListener('click',()=>void exportPdf());
  }

  async function loadManagerialTab() {
    ensureStyle(); destroyCharts();
    if (typeof sb === 'undefined') throw new Error('Supabase indisponível');
    const appEl=document.getElementById('app'); if(!appEl)return;
    mgr.loading=true;
    appEl.innerHTML='<div class="session-loading"><div class="session-loading-card"><strong>Gerencial</strong><span>Consolidando dados e indicadores...</span></div></div>';
    const {data,error}=await sb.rpc('obter_gerencial_controle_v4077',{p_exercicio:null});
    mgr.loading=false;
    if(error){appEl.innerHTML=`<div class="error-msg">Não foi possível carregar o Gerencial: ${esc(error.message||error)}</div>`;return;}
    mgr.raw=data||{};
    let fullName='';try{fullName=state?.fullName||'';}catch(_){}
    appEl.innerHTML=`<header class="topbar"><div><div class="brand-eyebrow">Controle de Capex</div><div class="brand-title">Gerencial</div></div>${navHtml(true)}<div class="user-chip">${esc(fullName)} <span class="role-badge">Admin</span><button class="btn btn-secondary" type="button" onclick="voltarAoSeletorHapcapex()">⇄ Trocar sistema</button><button class="btn btn-secondary" id="logout-btn">Sair</button></div></header>
      ${filterToolbarHtml()}<div id="v4071-content"></div>`;
    document.getElementById('logout-btn')?.addEventListener('click',()=>sb.auth.signOut());
    bindFilterControls(); renderContent();
  }

  function loadScriptOnce(src,test) {
    if(test()) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('Falha ao carregar biblioteca')),{once:true});return;}
      const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));document.head.appendChild(s);
    });
  }
  async function ensureChartJs(){
    if(typeof Chart!=='undefined') return;
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',()=>typeof Chart!=='undefined');
  }
  async function ensurePdfLibs(){
    if(!window.jspdf?.jsPDF) await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
    const testAuto=()=>{try{const J=window.jspdf?.jsPDF;return !!J && typeof new J().autoTable==='function';}catch(_){return false;}};
    if(!testAuto()) await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',testAuto);
  }

  function destroyCharts(){mgr.chartSeq++;Object.values(mgr.charts).forEach(c=>{try{c?.destroy();}catch(_){}});mgr.charts={};}
  const palette=['#1a4b8c','#2e6bbf','#1e8a4a','#e07020','#7857a4','#0f7c87','#c65850','#70839a','#8f6d2d','#4c8e64','#9a5f7d','#4f65a8','#768b3c','#ad6b34'];
  function chartBaseOptions(extra={}){return {responsive:true,maintainAspectRatio:false,animation:{duration:260},plugins:{legend:{labels:{boxWidth:10,font:{size:9}}},tooltip:{callbacks:{label:ctx=>{const raw=ctx.raw;const v=(typeof raw==='number'&&Number.isFinite(raw))?raw:(Number.isFinite(Number(ctx.parsed?.y))?Number(ctx.parsed.y):Number(ctx.parsed?.x||0));return `${ctx.dataset.label||''}: ${money(v)}`;}}}},scales:{x:{ticks:{font:{size:8}},grid:{color:'rgba(80,100,130,.08)'}},y:{ticks:{font:{size:8}},grid:{color:'rgba(80,100,130,.08)'}}},...extra};}

  function applyPackageFilter(label){mgr.pacote=String(label||'');syncFilterControls();renderContent();}
  function applyHeadFilter(label){mgr.head=String(label||'');syncFilterControls();renderContent();}

  async function renderCharts(s) {
    const seq=++mgr.chartSeq;
    try{await ensureChartJs();}catch(err){console.warn('[HAPCAPEX V40.0.77] Chart.js indisponível',err);return;}
    if(seq!==mgr.chartSeq) return;
    Object.values(mgr.charts).forEach(c=>{try{c?.destroy();}catch(_){}});mgr.charts={};
    if(typeof state!=='undefined' && state?.tab!=='gerencial') return;

    const make=(id,config)=>{const el=document.getElementById(id);if(!el)return null;const c=new Chart(el.getContext('2d'),config);mgr.charts[id]=c;return c;};

    const p=s.packages.slice(0,14);
    make('v4071-chart-package',{type:'bar',data:{labels:p.map(x=>x.label),datasets:[{label:'% do CAPEX',data:p.map(x=>x.pct_capex),backgroundColor:p.map((_,i)=>palette[i%palette.length]),borderWidth:0}]},options:{...chartBaseOptions(),indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${numFmt.format(ctx.raw)}% · ${money(p[ctx.dataIndex]?.atribuido)}`}}},scales:{x:{beginAtZero:true,ticks:{callback:v=>`${v}%`,font:{size:8}}},y:{ticks:{font:{size:8}}}},onClick:(evt,elements)=>{if(elements.length)applyPackageFilter(p[elements[0].index]?.label);}}});

    const h=s.heads.slice(0,14);
    make('v4071-chart-head',{type:'bar',data:{labels:h.map(x=>x.label),datasets:[{label:'% do CAPEX',data:h.map(x=>x.pct_capex),backgroundColor:h.map((_,i)=>palette[(i+3)%palette.length]),borderWidth:0}]},options:{...chartBaseOptions(),indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${numFmt.format(ctx.raw)}% · ${money(h[ctx.dataIndex]?.atribuido)}`}}},scales:{x:{beginAtZero:true,ticks:{callback:v=>`${v}%`,font:{size:8}}},y:{ticks:{font:{size:8}}}},onClick:(evt,elements)=>{if(elements.length)applyHeadFilter(h[elements[0].index]?.label);}}});

    make('v4071-chart-realized',{type:'bar',data:{labels:s.monthly.map(x=>x.label),datasets:[{type:'bar',label:'Realizado mensal',data:s.monthly.map(x=>x.valor),backgroundColor:'#e07020',borderWidth:0,yAxisID:'y'},{type:'line',label:'Acumulado no período',data:s.monthly.map(x=>x.acumulado),borderColor:'#1a4b8c',backgroundColor:'#1a4b8c',pointRadius:3,tension:.2,yAxisID:'y'}]},options:chartBaseOptions({plugins:{legend:{labels:{boxWidth:10,font:{size:9}}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label||''}: ${money(Number(ctx.raw||0))}`}}},scales:{x:{ticks:{font:{size:8}}},y:{beginAtZero:true,ticks:{callback:v=>compactMoney(v),font:{size:8}}}}})});

    const net=s.nets.slice(0,14);
    make('v4071-chart-transfer',{type:'bar',data:{labels:net.map(x=>x.pacote),datasets:[{label:'Saldo líquido',data:net.map(x=>x.liquido),backgroundColor:net.map(x=>x.liquido>=0?'#1e8a4a':'#c0392b'),borderWidth:0}]},options:{...chartBaseOptions(),indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`Líquido: ${money(ctx.raw)} · Recebido ${money(net[ctx.dataIndex]?.recebido)} · Doado ${money(net[ctx.dataIndex]?.doado)}`}}},scales:{x:{ticks:{callback:v=>compactMoney(v),font:{size:8}}},y:{ticks:{font:{size:8}}}},onClick:(evt,elements)=>{if(elements.length)applyPackageFilter(net[elements[0].index]?.pacote);}}});

    const bal=s.packages.slice(0,14);
    make('v4071-chart-balance',{type:'bar',data:{labels:bal.map(x=>x.label),datasets:[{label:'Compromissado',data:bal.map(x=>x.compromissado),backgroundColor:'#2e6bbf',stack:'a'},{label:'Saldo livre',data:bal.map(x=>x.saldo),backgroundColor:'#1e8a4a',stack:'a'}]},options:{...chartBaseOptions(),indexAxis:'y',scales:{x:{stacked:true,ticks:{callback:v=>compactMoney(v),font:{size:8}}},y:{stacked:true,ticks:{font:{size:8}}}},onClick:(evt,elements)=>{if(elements.length)applyPackageFilter(bal[elements[0].index]?.label);}}});

    const mv=s.moves.slice(0,14);
    make('v4071-chart-movement',{type:'bar',data:{labels:mv.map(x=>x.pacote),datasets:[{label:'Aportes',data:mv.map(x=>x.aporte),backgroundColor:'#1e8a4a'},{label:'Contingenciamentos',data:mv.map(x=>x.conting),backgroundColor:'#c0392b'}]},options:{...chartBaseOptions(),indexAxis:'y',scales:{x:{ticks:{callback:v=>compactMoney(v),font:{size:8}}},y:{ticks:{font:{size:8}}}},onClick:(evt,elements)=>{if(elements.length)applyPackageFilter(mv[elements[0].index]?.pacote);}}});
  }

  function compactMoney(value){const v=n(value),a=Math.abs(v);if(a>=1e9)return `R$ ${(v/1e9).toLocaleString('pt-BR',{maximumFractionDigits:1})} bi`;if(a>=1e6)return `R$ ${(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})} mi`;if(a>=1e3)return `R$ ${(v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})} mil`;return money(v);}

  function workbookSheet(rows,cols) {
    const ws=XLSX.utils.json_to_sheet(rows);
    if(cols) ws['!cols']=cols.map(w=>({wch:w}));
    return ws;
  }
  function exportFiltersObject(){return {'Exercício':mgr.raw?.exercicio,'Pacote':mgr.pacote||'Todos','HEAD':mgr.head||'Todos','Busca':mgr.query||'—','Saldo':mgr.saldo,'Período':periodLabel(),'Regra transferência':mgr.transferRule};}

  async function exportExcel(){
    if(typeof XLSX==='undefined'){alert('Biblioteca Excel indisponível.');return;}
    const s=summaryData(); const wb=XLSX.utils.book_new();
    const resumo=[...Object.entries(exportFiltersObject()).map(([Indicador,Valor])=>({Indicador,Valor})),
      {Indicador:'Valor atribuído',Valor:s.totalAttr},{Indicador:'Compromissado',Valor:s.totalComp},{Indicador:'Realizado no período',Valor:s.totalReal},{Indicador:'Saldo livre',Valor:s.totalSaldo},{Indicador:'OIs',Valor:s.ois.length},{Indicador:'Transferido no período',Valor:s.transferTotal},{Indicador:'Aportes no período',Valor:s.aporte},{Indicador:'Contingenciamentos no período',Valor:s.conting},{Indicador:'Pendências de classificação',Valor:s.pending.length},{Indicador:'Transferências históricas sem pacote',Valor:s.unresolvedTransfers.length},{Indicador:'Valor histórico sem pacote',Valor:s.unresolvedTransferTotal}];
    XLSX.utils.book_append_sheet(wb,workbookSheet(resumo,[28,32]),'Resumo');
    XLSX.utils.book_append_sheet(wb,workbookSheet(s.packages.map(x=>({Pacote:x.label,OIs:x.qtd_ois,Atribuido:x.atribuido,Pct_CAPEX:x.pct_capex,Compromissado:x.compromissado,Realizado_Periodo:x.realizado,Saldo:x.saldo,Aporte_Atual:x.aporte,Conting_Atual:x.conting})),[36,10,18,12,18,18,18,18,18]),'Pacotes');
    XLSX.utils.book_append_sheet(wb,workbookSheet(s.heads.map(x=>({HEAD:x.label,OIs:x.qtd_ois,Atribuido:x.atribuido,Pct_CAPEX:x.pct_capex,Compromissado:x.compromissado,Realizado_Periodo:x.realizado,Saldo:x.saldo})),[36,10,18,12,18,18,18]),'HEAD');
    XLSX.utils.book_append_sheet(wb,workbookSheet(s.top.map((o,i)=>({Posicao:i+1,OI:o.oi,Obra:o.nome,Pacote:o.pacote,HEAD:o.head,Atribuido:n(o.atribuido),Compromissado:n(o.compromissado),Saldo:n(o.saldo),Realizado_Periodo:realizedPeriod(o)})),[9,12,42,34,32,18,18,18,18]),'Top Saldo');
    XLSX.utils.book_append_sheet(wb,workbookSheet(s.nets.map(x=>({Pacote:x.pacote,Recebido:x.recebido,Doado:x.doado,Liquido:x.liquido,Entradas:x.qtd_entrada,Saidas:x.qtd_saida})),[34,18,18,18,10,10]),'Liquido Transferencias');
    XLSX.utils.book_append_sheet(wb,workbookSheet([...s.transfers,...s.unresolvedTransfers].map(t=>({Data:t.data,Documento:t.numero_documento,OI_Origem:t.oi_origem,Obra_Origem:t.nome_origem,Pacote_Origem:t.pacote_origem,HEAD_Origem:t.head_origem,OI_Destino:t.oi_destino,Obra_Destino:t.nome_destino,Pacote_Destino:t.pacote_destino,HEAD_Destino:t.head_destino,Valor:n(t.valor),Status_Classificacao:transferClassifiable(t)?'Classificada':'Histórica sem pacote',Exige_Diretoria:transferClassifiable(t)?(t.exige_autorizacao?'Sim':'Não'):'Indeterminado',Justificativa:t.justificativa})),[12,16,12,36,32,28,12,36,32,28,18,15,45]),'Transferencias');
    XLSX.utils.book_append_sheet(wb,workbookSheet(s.monthly.map(x=>({Mes:x.label,Realizado:x.valor,Acumulado_Periodo:x.acumulado})),[12,20,20]),'Realizado Mensal');
    XLSX.utils.book_append_sheet(wb,workbookSheet(s.moves.map(x=>({Pacote:x.pacote,Aportes:x.aporte,Contingenciamentos:x.conting,Liquido:x.liquido,Qtd_Aportes:x.qtd_aporte,Qtd_Conting:x.qtd_conting})),[34,18,20,18,12,12]),'Aportes Conting');
    XLSX.utils.book_append_sheet(wb,workbookSheet(s.pending.map(o=>({OI:o.oi,Obra:o.nome,Sem_Pacote:o.pacote_faltante?'Sim':'Não',Sem_HEAD:o.head_faltante?'Sim':'Não'})),[12,44,14,14]),'Pendencias Cadastro');
    const safe=`Gerencial_HAPCAPEX_${mgr.raw?.exercicio||''}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb,safe);
  }

  async function exportPdf(){
    const btn=document.getElementById('v4071-export-pdf');if(btn){btn.disabled=true;btn.textContent='Gerando PDF...';}
    try{
      await ensurePdfLibs();
      const {jsPDF}=window.jspdf; const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}); const s=summaryData();
      const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight();
      const addHeader=(title='HAPCAPEX · Gerencial')=>{doc.setFontSize(15);doc.setTextColor(13,43,78);doc.text(title,12,12);doc.setFontSize(8);doc.setTextColor(90,104,130);doc.text(`Exercício ${mgr.raw?.exercicio} · ${periodLabel()} · Pacote: ${mgr.pacote||'Todos'} · HEAD: ${mgr.head||'Todos'} · Busca: ${mgr.query||'—'}`,12,18);};
      const footer=()=>{const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(120);doc.text(`HAPCAPEX V${VERSION} · Gerado em ${new Date().toLocaleString('pt-BR')}`,12,H-6);doc.text(`${i}/${pages}`,W-18,H-6);}};
      addHeader();
      doc.autoTable({startY:23,theme:'grid',styles:{fontSize:8,cellPadding:2},head:[['Atribuído','Compromissado','Realizado período','Saldo livre','OIs','Transferido','Aportes','Conting.']],body:[[money(s.totalAttr),money(s.totalComp),money(s.totalReal),money(s.totalSaldo),String(s.ois.length),money(s.transferTotal),money(s.aporte),money(s.conting)]],headStyles:{fillColor:[26,75,140]}});
      let y=doc.lastAutoTable.finalY+5;
      const chartIds=['v4071-chart-package','v4071-chart-head','v4071-chart-realized','v4071-chart-transfer','v4071-chart-balance','v4071-chart-movement'];
      const chartTitles=['Concentração por pacote','Concentração por HEAD','Evolução mensal do Realizado','Saldo líquido de transferências','Compromissado x saldo livre','Aportes x contingenciamentos'];
      for(let i=0;i<chartIds.length;i++){
        const canvas=document.getElementById(chartIds[i]);
        if(!canvas)continue;
        if(i>0 && i%2===0){doc.addPage('a4','landscape');addHeader('HAPCAPEX · Gerencial · Gráficos');y=23;}
        const col=i%2, x=12+col*((W-30)/2); const width=(W-34)/2, height=68;
        doc.setFontSize(9);doc.setTextColor(13,43,78);doc.text(chartTitles[i],x,y);
        try{doc.addImage(canvas.toDataURL('image/png'),'PNG',x,y+3,width,height);}catch(_){}
        if(col===1)y+=78;
      }
      doc.addPage('a4','landscape');addHeader('HAPCAPEX · Gerencial · Pacotes');
      doc.autoTable({startY:23,theme:'striped',styles:{fontSize:6.7,cellPadding:1.4},head:[['Pacote','OIs','Atribuído','% CAPEX','Comprom.','Realizado','Saldo']],body:s.packages.map(x=>[x.label,x.qtd_ois,money(x.atribuido),pct(x.pct_capex),money(x.compromissado),money(x.realizado),money(x.saldo)]),headStyles:{fillColor:[13,43,78]}});
      doc.addPage('a4','landscape');addHeader('HAPCAPEX · Gerencial · HEAD e Top Saldo');
      doc.autoTable({startY:23,theme:'striped',styles:{fontSize:6.5,cellPadding:1.3},head:[['HEAD','OIs','Atribuído','% CAPEX','Comprom.','Realizado','Saldo']],body:s.heads.map(x=>[x.label,x.qtd_ois,money(x.atribuido),pct(x.pct_capex),money(x.compromissado),money(x.realizado),money(x.saldo)]),headStyles:{fillColor:[13,43,78]},margin:{bottom:15}});
      const nextY=Math.min(doc.lastAutoTable.finalY+6,H-50);
      if(nextY>H-45){doc.addPage('a4','landscape');addHeader('HAPCAPEX · Gerencial · Top Saldo');y=23;} else y=nextY;
      doc.autoTable({startY:y,theme:'striped',styles:{fontSize:6.5,cellPadding:1.3},head:[['#','OI','Obra','Pacote','HEAD','Saldo']],body:s.top.map((o,i)=>[i+1,o.oi,o.nome,o.pacote,o.head,money(o.saldo)]),headStyles:{fillColor:[30,138,74]}});
      if(s.pending.length){doc.addPage('a4','landscape');addHeader('HAPCAPEX · Gerencial · Pendências de cadastro');doc.autoTable({startY:23,theme:'grid',styles:{fontSize:7,cellPadding:1.6},head:[['OI','Obra','Sem Pacote','Sem HEAD']],body:s.pending.map(o=>[o.oi,o.nome,o.pacote_faltante?'Sim':'Não',o.head_faltante?'Sim':'Não']),headStyles:{fillColor:[224,112,32]}});}
      footer();
      doc.save(`Gerencial_HAPCAPEX_${mgr.raw?.exercicio||''}_${new Date().toISOString().slice(0,10)}.pdf`);
    }catch(err){console.error(err);alert('Não foi possível gerar o PDF automaticamente. Abriremos a impressão do navegador; escolha “Salvar como PDF”.');try{window.print();}catch(_){}}
    finally{if(btn){btn.disabled=false;btn.textContent='⬇ PDF';}}
  }

  function boot() {
    ensureStyle();
    let tries=0;
    let renderedOnce=false;
    const timer=setInterval(()=>{
      tries++;
      const ok=patchNavigation();
      if(ok && !renderedOnce){
        renderedOnce=true;
        try{if(typeof state!=='undefined' && state?.role==='admin')void refreshCurrent();}catch(_){}
      }
      // Mantém uma janela de proteção contra módulos que ainda estejam carregando e
      // possam embrulhar/redefinir navHtml depois deste módulo.
      if(tries>=120) clearInterval(timer);
    },250);
    patchDynamicUi();
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    window.HAP_V4071_CONTROL_MANAGERIAL={version:VERSION,canonicalPackage,isExcludedManagerialPackage,endFromDuration,daysInclusive,loadManagerialTab,summaryData};
  }

  if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
