// ============================================================
// DADOS — PLANEJAMENTO (94 obras, planilha Curva_CAPEX_2026_-_IA_MAI.xlsx)
// Contingenciadas: excluídas dos fluxos previstos; apenas realizados exibidos
// ============================================================
const obrasRaw = window.HAP_DATA.obrasRaw;
const manObrasRaw = window.HAP_DATA.manObrasRaw;

// ============================================================
// KPI CONSTANTS — carregadas do Supabase
// ============================================================
const CAPEX_INICIAL     = Number(window.HAP_DATA.settings.capex_inicial || window.HAP_ORIGINAL_BASELINE?.constants?.CAPEX_INICIAL || 0);
const PREVISTO_HISTORICO = window.HAP_DATA.settings.previsto_historico || window.HAP_ORIGINAL_BASELINE?.plannedTotals || {};
const CAPEX_DOACAO      = 0;
const CONTING_DETALHE   = Array.isArray(window.HAP_DATA.settings.conting_detalhe) ? window.HAP_DATA.settings.conting_detalhe : [];
const RECEB_DETALHE     = Array.isArray(window.HAP_DATA.settings.aportes_detalhe) ? window.HAP_DATA.settings.aportes_detalhe : [];
// Os totais sempre são derivados das linhas detalhadas. Assim, incluir/excluir uma linha
// atualiza automaticamente todos os KPIs e elimina divergências com campos totais antigos.
const CAPEX_CONTING     = CONTING_DETALHE.reduce((s, r) => s + Number(r?.valor || 0), 0);
const CAPEX_RECEBIMENTO = RECEB_DETALHE.reduce((s, r) => s + Number(r?.valor || 0), 0);
const CAPEX_ATUAL       = CAPEX_INICIAL + CAPEX_RECEBIMENTO - CAPEX_CONTING;
const MES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function detalheMesKey(item){return /^\d{4}-\d{2}$/.test(String(item?.mes||'')) ? String(item.mes) : '';}
function detalheMesLabel(item){const k=detalheMesKey(item);if(!k)return 'Mês não informado';const [y,m]=k.split('-').map(Number);return `${MES_LABELS[m-1]}/${y}`;}
function acumuladoLabel(lista){
  // Regra gerencial:
  // 1. Por padrão, mostra o acumulado até o mês anterior ao mês atual.
  // 2. Se existir ao menos um lançamento no mês atual, inclui o mês atual.
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const chaveAtual = `${anoAtual}-${String(mesAtual).padStart(2,'0')}`;
  const temLancamentoNoMesAtual = (Array.isArray(lista)?lista:[])
    .some(item => detalheMesKey(item) === chaveAtual);

  let anoFim = anoAtual;
  let mesFim = temLancamentoNoMesAtual ? mesAtual : mesAtual - 1;
  if (mesFim === 0) { mesFim = 12; anoFim -= 1; }

  return `Acumulado Jan–${MES_LABELS[mesFim-1]}/${String(anoFim).slice(-2)}`;
}
const CONTING_ACUM_LABEL = acumuladoLabel(CONTING_DETALHE);
const APORTE_ACUM_LABEL = acumuladoLabel(RECEB_DETALHE);

const NAO_PLANEJADO     = window.HAP_DATA.naoPlanejado;
const TOTAL_NAO_PLANEJADO = Object.values(NAO_PLANEJADO).reduce((s,v) => s + Number(v||0), 0);
const isAporteExtra = (nome) => {
  const n = nome.toLowerCase().trim();
  return RECEB_DETALHE.some(r => n.includes(String(r.nome||'').toLowerCase().substring(0,25)));
};

// ============================================================
// MONTHS
// ============================================================
const MONTHS = [
  {key:'jan',label:'JAN/26'},{key:'fev',label:'FEV/26'},
  {key:'mar',label:'MAR/26'},{key:'abr',label:'ABR/26'},
  {key:'mai',label:'MAI/26'},{key:'jun',label:'JUN/26'},
  {key:'jul',label:'JUL/26'},{key:'ago',label:'AGO/26'},
  {key:'set',label:'SET/26'},{key:'out',label:'OUT/26'},
  {key:'nov',label:'NOV/26'},{key:'dez',label:'DEZ/26'},
  {key:'jan27',label:'JAN/27'},{key:'fev27',label:'FEV/27'},
  {key:'mar27',label:'MAR/27'},{key:'abr27',label:'ABR/27'},
  {key:'mai27',label:'MAI/27'},{key:'jun27',label:'JUN/27'},
  {key:'jul27',label:'JUL/27'}
];
const MONTHS_REAL = window.HAP_DATA.monthsReal;

// ============================================================
// DATE PARSING (dd/mm/yyyy)
// ============================================================
function parseDateDDMM(s) {
  if (!s || s === '-') return null;
  const p = s.split('/');
  if (p.length !== 3) return null;
  const d = parseInt(p[0], 10), m = parseInt(p[1], 10), y = parseInt(p[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return { y, m, d };
}

function dateToYM(s) {
  const p = parseDateDDMM(s);
  if (!p) return null;
  return `${p.y}-${String(p.m).padStart(2,'0')}`;
}

function ymKey(ym_str) {
  // convert "2026-05" → "mai"
  const monthMap = {'01':'jan','02':'fev','03':'mar','04':'abr','05':'mai','06':'jun','07':'jul','08':'ago','09':'set','10':'out','11':'nov','12':'dez'};
  if (!ym_str) return null;
  const [y, m] = ym_str.split('-');
  if (y !== '2026') return null; // Only 2026 months in scope
  return monthMap[m] || null;
}

function addMonthsYM(ym_str, n) {
  let [y, m] = ym_str.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2,'0')}`;
}

// ============================================================
// COMPUTE 15/75/10 FLOW
// For contingenciadas: flow = real values only (previsto = realizado)
// ============================================================
function computeFlow(obra) {
  const flow = {};
  MONTHS.forEach(m => flow[m.key] = 0);

  // As obras que já existiam no HTML validado usam exatamente o fluxo
  // calculado naquele arquivo. Isso preserva todas as exceções e os
  // números históricos aprovados, independentemente de mudanças posteriores
  // de datas, CAPEX ou descrição na planilha mensal.
  if (obra._baselineFlow && typeof obra._baselineFlow === 'object') {
    MONTHS.forEach(m => { flow[m.key] = Number(obra._baselineFlow[m.key] || 0); });
    return flow;
  }

  // Contingenciadas totais: previsto = realizado
  if (obra.contingenciada) {
    MONTHS_REAL.forEach(mk => { flow[mk] = obra[mk+'_real'] || 0; });
    return flow;
  }

  // HAPFOR (CONTING. PARCIAL): realizado mês a mês + saldo distribuído igualmente jul-out/26
  if (obra.nome.includes('CONTING. PARCIAL') && obra.nome.includes('HAPFOR')) {
    MONTHS_REAL.forEach(mk => { flow[mk] = obra[mk+'_real'] || 0; });
    // Saldo restante do CAPEX dividido igualmente em JUL/AGO/SET/OUT de 2026
    const saldoHapfor = obra.capex - MONTHS_REAL.reduce((s,mk) => s+(obra[mk+'_real']||0), 0);
    if (saldoHapfor > 0) {
      const mensal = saldoHapfor / 4;
      ['jul','ago','set','out'].forEach(mk => { flow[mk] = mensal; });
    }
    return flow;
  }

  // Demais CONTING. PARCIAL (ex: Natal 1): previsto = realizado mês a mês
  if (obra.nome.includes('CONTING. PARCIAL')) {
    MONTHS_REAL.forEach(mk => { flow[mk] = obra[mk+'_real'] || 0; });
    return flow;
  }

  // Novo Hospital Atibaia: previsto encerra exatamente no CAPEX
  // JAN-MAI = realizados; JUN = saldo restante (para não ultrapassar o CAPEX)
  if (obra.nome.includes('Novo Hospital Atibaia')) {
    const realJanMai = MONTHS_REAL.slice(0,-1).reduce((s,mk) => s+(obra[mk+'_real']||0), 0);
    MONTHS_REAL.slice(0,-1).forEach(mk => { flow[mk] = obra[mk+'_real'] || 0; });
    flow['jun'] = Math.max(0, obra.capex - realJanMai); // saldo restante → encerra no CAPEX
    return flow;
  }

  // QUALIVIDA: pagamento único previsto em julho/2026
  if (obra.nome.includes('QUALIVIDA')) {
    flow['jul'] = obra.capex; // R$ 11.850 previsto em JUL/26
    return flow;
  }

  // TEA Maciel Pinheiro: previsto = realizado (R$ 4.000 já consumidos em FEV+MAR)
  if (obra.nome.includes('TEA Maciel')) {
    MONTHS_REAL.forEach(mk => { flow[mk] = obra[mk+'_real'] || 0; });
    return flow;
  }

  const capex = obra.capex;
  if (!capex || capex === 0) return flow;
  if (!obra.inicio || obra.inicio === '-' || !obra.fim || obra.fim === '-') return flow;

  // ── Exceção: Novo Hospital Rio de Janeiro — regra 5/85/10 ────────
  if (obra.nome.includes('Novo Hospital Rio de Janeiro')) {
    const ymI = dateToYM(obra.inicio);
    const ymF = dateToYM(obra.fim);
    if (ymI && ymF) {
      const sinal505   = obra.capex * 0.05;
      const exec85     = obra.capex * 0.85;
      const ret10      = obra.capex * 0.10;
      // Meses de execução: mês seguinte ao início até o mês de fim (inclusive)
      const execMs = [];
      let cur = addMonthsYM(ymI, 1);
      while (cur <= ymF) { execMs.push(cur); cur = addMonthsYM(cur, 1); }
      const execMon = execMs.length > 0 ? exec85 / execMs.length : exec85;
      const ymToKey505 = (ym) => {
        if (!ym) return null;
        const [y, m] = ym.split('-');
        if (y === '2026') return {'01':'jan','02':'fev','03':'mar','04':'abr','05':'mai','06':'jun','07':'jul','08':'ago','09':'set','10':'out','11':'nov','12':'dez'}[m] || null;
        if (y === '2027') return {'01':'jan27','02':'fev27','03':'mar27','04':'abr27','05':'mai27','06':'jun27','07':'jul27'}[m] || null;
        return null;
      };
      const kI = ymToKey505(ymI);
      if (kI) flow[kI] += sinal505;
      execMs.forEach(ym => { const k = ymToKey505(ym); if (k) flow[k] += execMon; });
      const r1k = ymToKey505(addMonthsYM(ymF, 1)); if (r1k) flow[r1k] += ret10 / 2;
      const r2k = ymToKey505(addMonthsYM(ymF, 2)); if (r2k) flow[r2k] += ret10 / 2;
    }
    return flow;
  }

  // Pacote Regulatório — distribute linearly Jan–Dez
  if (obra.nome.includes('Adequação Regulatória') || obra.nome.includes('Adequacao Regulatoria') || obra.nome.includes('Regulatória')) {
    const monthly = capex / 12;
    MONTHS.filter(m => !m.key.includes('27')).forEach(m => { flow[m.key] = monthly; }); // apenas jan-dez/26
    return flow;
  }

  let ymInicio = dateToYM(obra.inicio);
  let ymFim    = dateToYM(obra.fim);
  if (!ymInicio || !ymFim) return flow;

  // Obras que não existiam no HTML-base só passam a alterar o planejamento
  // a partir do mês da planilha em que foram introduzidas. Assim, uma obra
  // incluída em julho não reescreve retroativamente o previsto de janeiro a junho.
  if (!obra._isOriginalBaseline && window.HAP_DATA.reportingMonthKey) {
    const reportIndex = MONTHS.findIndex(m => m.key === window.HAP_DATA.reportingMonthKey);
    const reportYM = reportIndex >= 0 && reportIndex < 12
      ? `2026-${String(reportIndex + 1).padStart(2, '0')}`
      : null;
    if (reportYM) {
      if (ymFim < reportYM) {
        const reportKey = window.HAP_DATA.reportingMonthKey;
        if (flow[reportKey] !== undefined) flow[reportKey] = obra.capex;
        return flow;
      }
      if (ymInicio < reportYM) ymInicio = reportYM;
    }
  }

  const sinal    = capex * 0.15;
  const exec     = capex * 0.75;
  const retencao = capex * 0.10;

  // Execution months: month after inicio through fim (inclusive)
  const execMonths = [];
  let cur = addMonthsYM(ymInicio, 1);
  while (cur <= ymFim) { execMonths.push(cur); cur = addMonthsYM(cur, 1); }
  const nExec = execMonths.length;
  const execMonthly = nExec > 0 ? exec / nExec : exec;

  const ret1 = addMonthsYM(ymFim, 1);
  const ret2 = addMonthsYM(ymFim, 2);
  const retMonthly = retencao / 2;

  // Map ym → key
  const ymToKey = (ym) => {
    if (!ym) return null;
    const [y, m] = ym.split('-');
    if (y === '2026') return {'01':'jan','02':'fev','03':'mar','04':'abr','05':'mai','06':'jun','07':'jul','08':'ago','09':'set','10':'out','11':'nov','12':'dez'}[m] || null;
    if (y === '2027') return {'01':'jan27','02':'fev27','03':'mar27','04':'abr27','05':'mai27','06':'jun27','07':'jul27'}[m] || null;
    return null;
  };

  const inicioKey = ymToKey(ymInicio);
  if (inicioKey) flow[inicioKey] += sinal + (nExec === 0 ? exec : 0);
  execMonths.forEach(ym => { const k = ymToKey(ym); if (k) flow[k] += execMonthly; });
  const r1k = ymToKey(ret1); if (r1k) flow[r1k] += retMonthly;
  const r2k = ymToKey(ret2); if (r2k) flow[r2k] += retMonthly;

  return flow;
}

// Build full obras array
const obras = obrasRaw
  .map(o => ({ ...o, flow: computeFlow(o) }))
  .sort((a, b) => (a._sourceOrder ?? 999999) - (b._sourceOrder ?? 999999));
obras.forEach(o => { o.total_real = MONTHS_REAL.reduce((s, m) => s + (o[m+'_real'] || 0), 0); });

const manObras = manObrasRaw
  .map(o => ({ ...o, total_real: MONTHS_REAL.reduce((s, m) => s + (o[m+'_real'] || 0), 0) }))
  .sort((a, b) => (a._sourceOrder ?? 999999) - (b._sourceOrder ?? 999999));

const LAST_REAL_MONTH = MONTHS_REAL.length ? MONTHS_REAL[MONTHS_REAL.length - 1] : 'jan';
const LAST_REAL_LABEL = MONTHS.find(m => m.key === LAST_REAL_MONTH)?.label || 'JAN/26';
const headerSub = document.getElementById('header-sub');
if (headerSub) {
  headerSub.textContent = `Fluxo de desembolso mensal · ${obras.length} obras · Atualizado até ${LAST_REAL_LABEL}`;
}
const accumulatedTitle = document.getElementById('accumulatedChartTitle');
if (accumulatedTitle) {
  accumulatedTitle.textContent = `📈 Consumo Acumulado — Previsto vs Realizado Planejado vs Realizado Total (Jan–${LAST_REAL_LABEL})`;
}
const panelRealLabel = document.getElementById('panel-real-label');
if (panelRealLabel) panelRealLabel.textContent = `Realizado Jan–${LAST_REAL_LABEL}`;

// Contadores globais de contingenciadas (disponíveis para renderTipoCards e renderKPIs)
const contingenciasParciais = obras.filter(o => o.nome.includes('CONTING. PARCIAL'));
const nContingParcial = contingenciasParciais.length;
const nConting        = obras.filter(o => o.contingenciada).length + nContingParcial;
const CAPEX_RESIDUAL_PARCIAL = contingenciasParciais.reduce((s, o) => s + Number(o.capex || 0), 0);

// ============================================================
// FORMAT HELPERS
// ============================================================
function fmt(v, compact=false) {
  if (v === null || v === undefined || v === 0) return '-';
  if (!compact) return 'R$\u00a0' + v.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
  if (Math.abs(v) >= 1e6) return 'R$\u00a0' + (v/1e6).toFixed(2).replace('.',',') + 'M';
  if (Math.abs(v) >= 1e3) return 'R$\u00a0' + (v/1e3).toFixed(1).replace('.',',') + 'K';
  return 'R$\u00a0' + v.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
}
function fmtZ(v) { // formats zero as '-'
  if (!v || v === 0) return '-';
  return v.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
}
function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }

// ============================================================
// TIPOLOGIA
// ============================================================
function getTipologia(nome) {
  const n = nome.toLowerCase();
  if (n.includes('visa') || n.includes('ppci') || n.includes('adequação') || n.includes('adequacao')) return 'Legalização';
  if (n.includes('hospital') || n.includes('hapfor') || n.includes('santa martha') || n.includes('parauapebas') || n.includes('atibaia') || n.includes('htl')) return 'Hospital';
  if (n.includes('tea') || n.includes('autismo')) return 'TEA';
  if (n.includes('medprev') || n.includes('furtado')) return 'Medprev';
  if (n.includes('coleta') || n.includes('posto de coleta')) return 'Posto de Coleta';
  if (n.includes('virose') || n.includes('leitos') || n.includes('rampa cirurgica')) return 'Leitos / Virose';
  if (n.includes('pronto atendimento') || (n.includes('pa ') && !n.includes('pacote') && !n.includes('hapnatal') && !n.includes('rampa')) || n.startsWith('0000.pa')) return 'Pronto Atendimento';
  if (n.includes('clínica') || n.includes('clinica')) return 'Clínica';
  if (n.includes('agência transfusional') || n.includes('agencia transfusional')) return 'Ag. Transfusional';
  if (n.includes('hemodinâmica') || n.includes('hemodinamica')) return 'Hemodinâmica';
  if (n.includes('lab') || n.includes('ima ') || n.includes('diagnóstico') || n.includes('diagnostico')) return 'Lab / Diagnóstico';
  if (n.includes('cd ') || n.includes('centro de distribuição') || n.includes('novo cd')) return 'CD';
  if (n.includes('mega')) return 'Mega Unidade';
  if (n.includes('pacote') || n.includes('regulatória') || n.includes('regulatoria')) return 'Pacotes Regulatórios';
  if (n.includes('qualivida')) return 'Qualivida';
  return 'Outros';
}

const tipoEmojis = {
  'Hospital': '🏥', 'TEA': '🧩', 'Clínica': '🩺', 'Medprev': '💚',
  'Posto de Coleta': '🧪', 'Pronto Atendimento': '🚑', 'Ag. Transfusional': '🩸',
  'Hemodinâmica': '💉', 'Lab / Diagnóstico': '🔬', 'CD': '📦', 'Mega Unidade': '🏗️',
  'Legalização': '📜', 'Leitos / Virose': '🛏️', 'Pacotes Regulatórios': '📋',
  'Qualivida': '💊', 'Outros': '📌'
};
const tipoColors = [
  '#0d2b4e','#1a4b8c','#2e6bbf','#16a085','#e07020',
  '#8e44ad','#c0392b','#27ae60','#f39c12','#2980b9',
  '#7f8c8d','d35400','#1abc9c','#e74c3c'
];

obras.forEach(o => { o.tipologia = getTipologia(o.nome); });

// tipoList é recalculado dinamicamente em renderTipoCards()
// baseado em filteredObras para refletir os filtros ativos
let tipoList = [];

// ============================================================
// MONTH FILTER STATE
// ============================================================
let selectedMonths = new Set();
let manSelectedMonths = new Set();

function isObraActiveInMonths(o, selMonths) {
  if (selMonths.size === 0) return true;
  for (const mk of selMonths) {
    const k = mk; // already a key like 'jan'
    if ((o[k+'_real'] || 0) > 0 || (o.flow && o.flow[k] > 0)) return true;
  }
  return false;
}

// ============================================================
// MONTH CHIPS — Obras
// ============================================================
function renderMonthChips() {
  const container = document.getElementById('month-chips');
  container.innerHTML = '';
  MONTHS.forEach(m => {
    const hasReal = MONTHS_REAL.includes(m.key);
    const isActive = selectedMonths.has(m.key);
    const chip = document.createElement('span');
    chip.className = 'month-chip' + (isActive ? ' active' : '') + (hasReal ? ' has-real' : '');
    chip.textContent = m.label;
    chip.onclick = () => {
      if (selectedMonths.has(m.key)) selectedMonths.delete(m.key); else selectedMonths.add(m.key);
      renderMonthChips(); applyFilter();
    };
    container.appendChild(chip);
  });
  const info = document.getElementById('mf-info');
  info.textContent = selectedMonths.size > 0 ? `${selectedMonths.size} período(s) selecionado(s)` : 'Todos os meses';
}

function clearMonthFilter() { selectedMonths.clear(); renderMonthChips(); applyFilter(); }

// ============================================================
// FILTER — OBRAS
// ============================================================
let filteredObras = obras;
let activeTipos = new Set(); // suporte a múltipla seleção de tipologias

// ── Estado de ordenação das tabelas ──────────────────────────
let sortStatePrev = { col: null, dir: 'none' };
let sortStateReal = { col: null, dir: 'none' };
let activeStatusFilter = null; // null | 'ativas' | 'contingenciadas'

function nextSortDir(state, col) {
  if (state.col !== col || state.dir === 'none') return 'desc'; // 1º clique → maior→menor
  if (state.dir === 'desc') return 'asc';                        // 2º clique → menor→maior
  return 'none';                                                  // 3º clique → original
}

function sortedObras(fo, state, getVal) {
  if (state.dir === 'none') return fo;
  const copy = [...fo];
  copy.sort((a, b) => {
    const va = getVal(a), vb = getVal(b);
    if (typeof va === 'string') return state.dir === 'asc' ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR');
    return state.dir === 'asc' ? va - vb : vb - va;
  });
  return copy;
}

function applyFilter() {
  const text = document.getElementById('filterInput').value.toLowerCase();
  // O <select> legado ainda funciona para busca rápida via dropdown
  const tipoSelect = document.getElementById('filterTipo').value;
  if (tipoSelect && !activeTipos.has(tipoSelect)) {
    activeTipos.clear();
    if (tipoSelect) activeTipos.add(tipoSelect);
  }
  filteredObras = obras.filter(o => {
    const matchText   = !text || o.nome.toLowerCase().includes(text);
    const matchTipo   = activeTipos.size === 0 || activeTipos.has(o.tipologia);
    const matchMonth  = isObraActiveInMonths(o, selectedMonths);
    const isContigObj = o.contingenciada || o.nome.includes('CONTING. PARCIAL');
    const matchStatus = !activeStatusFilter
      || (activeStatusFilter === 'ativas'          && !isContigObj)
      || (activeStatusFilter === 'contingenciadas' &&  isContigObj);
    return matchText && matchTipo && matchMonth && matchStatus;
  });

  const statusLabel = activeStatusFilter === 'ativas'          ? ' · só obras ativas'
                    : activeStatusFilter === 'contingenciadas'  ? ' · só contingenciadas'
                    : '';
  const totalLabel = activeTipos.size > 0
    ? `${filteredObras.length} obras · ${[...activeTipos].join(' + ')}${statusLabel}`
    : `${filteredObras.length} de ${obras.length} obras${statusLabel}`;
  document.getElementById('filterCount').textContent = totalLabel;
  renderTipoCards(); // após filteredObras para refletir filtros
  renderKPIs();
  renderTablePrev();   // passa undefined → mantém sort atual
  renderTableReal();   // passa undefined → mantém sort atual
  renderCharts();
  renderRiskPanel();
  renderAnalysis();
}

function clearFilter() {
  document.getElementById('filterInput').value = '';
  document.getElementById('filterTipo').value = '';
  activeTipos.clear();
  renderTipoCards();
  applyFilter();
}

function toggleStatusFilter(status) {
  // Clique no mesmo → deseleciona; clique em outro → seleciona
  activeStatusFilter = activeStatusFilter === status ? null : status;
  renderKPIs(); // re-renderiza para atualizar visual dos cards
  applyFilter();
}

function clearAllObrasFilters() {
  activeStatusFilter = null;
  clearMonthFilter();
  clearFilter();
}

// ============================================================
// TIPOLOGIA CARDS
// ============================================================
function renderTipoCards() {
  const tipoGrid = document.getElementById('tipo-grid');

  // tipoList calculado com filtros de texto/status/mês, mas SEM filtro de tipologia
  // Isso garante que todos os cards sempre apareçam (seleção múltipla funciona)
  const text = document.getElementById('filterInput').value.toLowerCase();
  const isContigObj2 = (o) => o.contingenciada || o.nome.includes('CONTIG. PARCIAL');
  const baseObras = obras.filter(o => {
    const matchText  = !text || o.nome.toLowerCase().includes(text);
    const matchMonth = isObraActiveInMonths(o, selectedMonths);
    const isContigO  = o.contingenciada || o.nome.includes('CONTING. PARCIAL');
    const matchStatus = !activeStatusFilter
      || (activeStatusFilter === 'ativas'          && !isContigO)
      || (activeStatusFilter === 'contingenciadas' &&  isContigO);
    return matchText && matchMonth && matchStatus;
  });
  const tipoMapDyn = {};
  baseObras.forEach(o => {
    if (!tipoMapDyn[o.tipologia]) tipoMapDyn[o.tipologia] = { capex: 0, count: 0, realizado: 0, countConting: 0 };
    if (!o.contingenciada) {
      tipoMapDyn[o.tipologia].capex    += o.capex;
      tipoMapDyn[o.tipologia].realizado += o.total_real;
    } else {
      tipoMapDyn[o.tipologia].countConting++;
    }
    if (o.nome.includes('CONTING. PARCIAL')) {
      tipoMapDyn[o.tipologia].countConting++;
    }
    tipoMapDyn[o.tipologia].count++;
  });
  tipoList = Object.entries(tipoMapDyn).filter(([, d]) => d.count > 0).sort((a, b) => b[1].capex - a[1].capex);

  // Card "Todas": soma dos CAPEXs das obras filtradas
  const totalCapex = tipoList.reduce((s, [, d]) => s + d.capex, 0);
  const noneSelected = activeTipos.size === 0;

  tipoGrid.innerHTML = `
    <div class="tipo-card ${noneSelected ? 'active' : ''}" onclick="toggleTipoFilter(null)">
      <div class="tipo-emoji">🗂️</div>
      <div class="tipo-label">Todas</div>
      <div class="tipo-capex">${fmt(totalCapex, true)}</div>
      <div class="tipo-count">${baseObras.length} obras <span style="color:var(--vermelho);font-size:9px">(${baseObras.filter(o=>o.contingenciada||o.nome.includes('CONTING. PARCIAL')).length} conting.)</span></div>
      ${noneSelected ? '' : '<div style="font-size:9px;color:var(--texto-suave);margin-top:2px">clique para limpar</div>'}
    </div>`;
  // Atualizar o <select> de tipologia com as tipologias visíveis no filtro atual
  const filterTipoEl = document.getElementById('filterTipo');
  if (filterTipoEl) {
    const currentVal = filterTipoEl.value;
    filterTipoEl.innerHTML = '<option value="">Todas as tipologias</option>';
    tipoList.forEach(([tipo]) => {
      const opt = document.createElement('option');
      opt.value = tipo; opt.textContent = `${tipoEmojis[tipo]||'📌'} ${tipo}`;
      if (tipo === currentVal) opt.selected = true;
      filterTipoEl.appendChild(opt);
    });
  }

  tipoList.forEach(([tipo, d], i) => {
    const emoji = tipoEmojis[tipo] || '📌';
    const isActive = activeTipos.has(tipo);
    tipoGrid.innerHTML += `
      <div class="tipo-card ${isActive ? 'active' : ''}" onclick="toggleTipoFilter('${tipo}')"
           style="border-top-color:${tipoColors[i % tipoColors.length]}${isActive ? ';outline:2px solid var(--laranja);background:#fff8f0' : ''}">
        <div class="tipo-emoji">${emoji}</div>
        <div class="tipo-label">${tipo}</div>
        <div class="tipo-capex">${d.capex > 0 ? fmt(d.capex, true) : '<span style="color:var(--texto-suave);font-size:11px">sem CAPEX ativo</span>'}</div>
        <div class="tipo-count">${d.count} obra${d.count > 1 ? 's' : ''}${d.countConting > 0 ? ` <span style="color:var(--vermelho);font-size:9px">(${d.countConting} conting.)</span>` : ''}${isActive ? ' ✓' : ''}</div>
      </div>`;
  });
}

function toggleTipoFilter(tipo) {
  if (tipo === null) {
    activeTipos.clear();                    // "Todas" limpa a seleção
  } else if (activeTipos.has(tipo)) {
    activeTipos.delete(tipo);               // 2º clique deseleciona
  } else {
    activeTipos.add(tipo);                  // 1º clique seleciona
  }
  // Sincroniza o <select> legado (primeiro valor ou vazio)
  const filterTipo = document.getElementById('filterTipo');
  if (filterTipo) filterTipo.value = activeTipos.size === 1 ? [...activeTipos][0] : '';
  renderTipoCards();
  applyFilter();
}
// Alias para compatibilidade
function setTipoFilter(tipo) { toggleTipoFilter(tipo); }

// Populate select
const filterTipoEl = document.getElementById('filterTipo');
tipoList.forEach(([tipo]) => {
  const opt = document.createElement('option');
  opt.value = tipo; opt.textContent = `${tipoEmojis[tipo] || '📌'} ${tipo}`;
  filterTipoEl.appendChild(opt);
});

// ============================================================
// KPI CARDS — OBRAS
// ============================================================
function renderKPIs() {
  const kpiSection = document.getElementById('kpi-section');

  // Determine active months
  const activeMons = selectedMonths.size > 0 ? [...selectedMonths] : MONTHS_REAL;
  // Para realizado: INCLUI contingenciadas (são valores já desembolsados na planilha)
  // Para realizado e previsto: inclui TODAS as obras
  // Contingenciadas têm flow = realizado (via computeFlow), então não distorcem o previsto
  const foReal = filteredObras;
  const foPrev = filteredObras;

  const hasFilterKPI = document.getElementById('filterInput').value.trim() !== ''
                    || activeTipos.size > 0
                    || activeStatusFilter !== null;
  const fRealizado  = activeMons.reduce((s, mk) => s + foReal.reduce((ss, o) => ss + (o[mk+'_real'] || 0), 0), 0);
  const naoPrevisto = hasFilterKPI ? 0 : activeMons.reduce((s, mk) => s + (NAO_PLANEJADO[mk]||0), 0);
  const fPrevisto   = activeMons.reduce((s, mk) => s + foPrev.reduce((ss, o) => ss + (o.flow[mk] || 0), 0), 0) + naoPrevisto;
  const fDesvio    = fPrevisto > 0 ? ((fRealizado - fPrevisto) / fPrevisto) * 100 : 0;

const _firstMes = activeMons[0] || MONTHS_REAL[0];
  const _lastMes  = activeMons[activeMons.length - 1] || MONTHS_REAL[MONTHS_REAL.length - 1];
  const _monthPT  = { jan:'Jan',fev:'Fev',mar:'Mar',abr:'Abr',mai:'Mai',jun:'Jun',
                       jul:'Jul',ago:'Ago',set:'Set',out:'Out',nov:'Nov',dez:'Dez',
                       jan27:'Jan',fev27:'Fev',mar27:'Mar',abr27:'Abr',
                       mai27:'Mai',jun27:'Jun',jul27:'Jul' };
  const _year     = (_lastMes||'').includes('27') ? '27' : '26';
  const periodLabel = activeMons.length === 1
    ? `${_monthPT[_firstMes]||_firstMes.toUpperCase()}/${_year}`
    : `Jan a ${_monthPT[_lastMes]||_lastMes.toUpperCase()}/${_year}`;
  // nConting e nContingParcial são globais (calculados após build de obras)

  // Calcular realizados não planejados no período ativo
  const naoPlanReal = hasFilterKPI ? 0 : activeMons.reduce((s, mk) => s + (NAO_PLANEJADO[mk]||0), 0);
  const naoPlanPct  = CAPEX_ATUAL > 0 ? (TOTAL_NAO_PLANEJADO / CAPEX_ATUAL * 100) : 0;
  const planPct     = CAPEX_ATUAL > 0 ? (fRealizado / CAPEX_ATUAL * 100) : 0;
  const totalRealizado = fRealizado + naoPlanReal;
  const totalPct    = CAPEX_ATUAL > 0 ? (totalRealizado / CAPEX_ATUAL * 100) : 0;

  // Desvio calculado sobre o REALIZADO TOTAL (planejado + não planejado)
  const fDesvioTotal = fPrevisto > 0 ? ((totalRealizado - fPrevisto) / fPrevisto) * 100 : 0;

  const kpis = [
    { label: 'CAPEX Inicial',                          value: fmt(CAPEX_INICIAL),    sub: `${obras.length} obras no portfólio`, cls: '', onclick: '' },
    { label: 'Contingenciamento',  value: fmt(CAPEX_CONTING),    sub: `${CONTING_ACUM_LABEL} · clique para detalhar`, cls: 'vermelho', onclick: "openKpiPanel('contingenciamento')" },
    { label: 'Aportes Extras',     value: fmt(CAPEX_RECEBIMENTO),sub: `${APORTE_ACUM_LABEL} · clique para detalhar`, cls: 'verde', onclick: "openKpiPanel('aportes_extras')" },
    { label: 'CAPEX Atual',        value: fmt(CAPEX_ATUAL),      sub: `${obras.length - nConting} obras ativas · Inicial − Conting. + Aportes · clique para detalhar`, cls: '', onclick: "openKpiPanel('capex_atual')" },
    { label: 'CAPEX PREVISTO YTD',                    value: fmt(fPrevisto),      sub: 'Modelo 15/75/10 · obras planejadas', cls: 'verde', onclick: '' },
    { label: 'REALIZADO OBRAS PLANEJADAS YTD',      value: fmt(fRealizado),     sub: `${planPct.toFixed(1)}% do CAPEX Atual · ${foReal.length} obras`, cls: 'laranja', onclick: '' },
    { label: 'REALIZADO OBRAS NÃO PLANEJADAS YTD',  value: fmt(naoPlanReal),    sub: `${(CAPEX_ATUAL>0?(naoPlanReal/CAPEX_ATUAL*100):0).toFixed(1)}% do CAPEX · aditivos 2025`, cls: 'vermelho', onclick: '' },
    { label: 'CAPEX REALIZADO TOTAL YTD',           value: fmt(totalRealizado), sub: `${(CAPEX_ATUAL>0?(totalRealizado/CAPEX_ATUAL*100):0).toFixed(1)}% do CAPEX Atual`, cls: 'laranja', onclick: '' },
    { label: 'DESVIO YTD (Real Total vs Previsto)',          value: pct(fDesvioTotal),   sub: fDesvioTotal > 0 ? 'Realizado acima do previsto' : 'Realizado abaixo do previsto', cls: Math.abs(fDesvioTotal) > 15 ? 'vermelho' : (Math.abs(fDesvioTotal) > 5 ? 'laranja' : 'verde'), onclick: '' },

  ];

  kpiSection.innerHTML = '';
  kpiSection.style.gridTemplateColumns = 'repeat(4, 1fr)';
  kpis.forEach(k => {
    const clickable = k.onclick ? 'clickable' : '';
    const onclickAttr = k.onclick ? `onclick="${k.onclick}"` : '';
    // Hint diferenciado: filtro de status vs painel informativo
    const isStatusFilter = k.onclick && k.onclick.includes('toggleStatusFilter');
    const isActive = (isStatusFilter && k.onclick.includes('ativas') && activeStatusFilter === 'ativas')
                  || (isStatusFilter && k.onclick.includes('contingenciadas') && activeStatusFilter === 'contingenciadas');
    const hint = isStatusFilter
      ? `<div style="font-size:10px;margin-top:4px;font-weight:600;color:${isActive ? 'var(--laranja)' : 'var(--azul-claro)'}">
           ${isActive ? '✅ filtro ativo — clique para limpar' : '👆 clique para filtrar'}</div>`
      : k.onclick ? '<div style="font-size:10px;color:var(--azul-claro);margin-top:4px;font-weight:600">👆 clique para detalhar</div>' : '';
    // Borda de destaque quando filtro ativo
    const activeStyle = isActive ? 'outline:2px solid var(--laranja);' : '';
    kpiSection.innerHTML += `<div class="kpi-card ${k.cls} ${clickable}" ${onclickAttr} style="${activeStyle}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
      ${hint}
    </div>`;
  });
}

// ============================================================
// TABLE PREVISTO
// ============================================================
function renderTablePrev(triggerCol) {
  if (triggerCol !== undefined) {
    sortStatePrev.dir = nextSortDir(sortStatePrev, triggerCol);
    sortStatePrev.col = sortStatePrev.dir === 'none' ? null : triggerCol;
  }
  const wrapper = document.getElementById('table-prev-wrapper');
  const colMeses = selectedMonths.size > 0
    ? MONTHS.filter(m => selectedMonths.has(m.key))
    : MONTHS;

  // Função de valor para ordenação
  const getVal = (o) => {
    if (!sortStatePrev.col) return 0;
    if (sortStatePrev.col === 'nome')  return o.nome;
    if (sortStatePrev.col === 'capex') return o.capex;
    if (sortStatePrev.col === 'total') return colMeses.reduce((s, m) => s + (o.flow[m.key]||0), 0);
    return o.flow[sortStatePrev.col] || 0; // coluna de mês
  };
  const fo = sortedObras(filteredObras, sortStatePrev, getVal);

  // Helper para classe do header
  const thCls = (col) => {
    let cls = 'sortable';
    if (sortStatePrev.col === col) cls += sortStatePrev.dir === 'asc' ? ' sort-asc' : sortStatePrev.dir === 'desc' ? ' sort-desc' : '';
    return cls;
  };

  let html = `<table><thead><tr>
    <th class="${thCls('nome')}" onclick="renderTablePrev('nome')">Obra</th>
    <th class="${thCls('capex')}" onclick="renderTablePrev('capex')">CAPEX</th>`;
  colMeses.forEach(m => {
    html += `<th class="prev ${thCls(m.key)}" onclick="renderTablePrev('${m.key}')">${m.label}</th>`;
  });
  html += `<th class="${thCls('total')}" onclick="renderTablePrev('total')">Total Previsto</th></tr></thead><tbody>`;

  fo.forEach(o => {
    const total = colMeses.reduce((s, m) => s + (o.flow[m.key] || 0), 0);
      const isConting       = o.contingenciada;
    const isContingParcial = !o.contingenciada && o.nome.includes('CONTING. PARCIAL');
    const isAporte         = isAporteExtra(o.nome);
    html += `<tr class="obra-row${isConting ? ' contingenciada-row' : ''}" onclick="openPanel(${obras.indexOf(o)})">
      <td>${o.nome.replace(' - CONTING. PARCIAL','')}${isContingParcial ? ' <span class="badge-atencao" style="font-size:10px;padding:2px 8px">⚠️ CONTING. PARCIAL</span>' : ''}${isConting ? ' <span class="badge-contingenciada">CONTINGENCIADA</span>' : ''}${isAporte ? ' <span class="badge-aporte">💚 APORTE EXTRA</span>' : ''}</td>
      <td>${fmtZ(o.capex)}</td>`;
    colMeses.forEach(m => {
      const v = o.flow[m.key] || 0;
      html += `<td class="${v ? '' : 'td-zero'}">${fmtZ(v)}</td>`;
    });
    html += `<td><strong>${fmtZ(total)}</strong></td></tr>`;
  });

  const fAll = filteredObras;
  const hasFilterPrev2 = document.getElementById('filterInput').value.trim() !== ''
                      || activeTipos.size > 0 || activeStatusFilter !== null;

  // Linha Consumo Não Planejado — previsto = realizado
  if (!hasFilterPrev2) {
    const totNaoPlanPrev = colMeses.reduce((s,m) => s+(NAO_PLANEJADO[m.key]||0), 0);
    html += `<tr style="background:#fff5f5;font-style:italic;">
      <td style="color:var(--vermelho);font-weight:700;">⚠️ Consumo Não Planejado</td>
      <td class="td-zero">—</td>`;
    colMeses.forEach(m => {
      const v = NAO_PLANEJADO[m.key] || 0;
      html += `<td class="${v ? '' : 'td-zero'}" style="${v ? 'color:var(--vermelho);font-weight:600' : ''}">${v ? fmtZ(v) : '—'}</td>`;
    });
    html += `<td style="color:var(--vermelho);font-weight:700;">${fmtZ(totNaoPlanPrev)}</td></tr>`;
    // Rodapé com não planejado incluído no previsto total
    const totalPrevComNao = fAll.reduce((s,o)=>s+colMeses.reduce((ss,m)=>ss+(o.flow[m.key]||0),0), 0) + totNaoPlanPrev;
    html += `<tfoot><tr><td>TOTAL (${fAll.length} obras + Não Planejado)</td><td>${fmtZ(fAll.reduce((s,o)=>s+o.capex,0))}</td>`;
    colMeses.forEach(m => {
      const planSum = fAll.reduce((s,o)=>s+(o.flow[m.key]||0),0);
      const naoSum  = NAO_PLANEJADO[m.key] || 0;
      html += `<td>${fmtZ(planSum + naoSum)}</td>`;
    });
    html += `<td>${fmtZ(totalPrevComNao)}</td></tr></tfoot></table>`;
  } else {
    html += `<tfoot><tr><td>TOTAL (${fAll.length} obras)</td><td>${fmtZ(fAll.reduce((s,o)=>s+o.capex,0))}</td>`;
    colMeses.forEach(m => { html += `<td>${fmtZ(fAll.reduce((s,o)=>s+(o.flow[m.key]||0),0))}</td>`; });
    html += `<td>${fmtZ(fAll.reduce((s,o)=>s+colMeses.reduce((ss,m)=>ss+(o.flow[m.key]||0),0),0))}</td></tr></tfoot></table>`;
  }

  wrapper.innerHTML = html;
}

// ============================================================
// TABLE REAL vs PREVISTO
// ============================================================
function renderTableReal(triggerCol) {
  if (triggerCol !== undefined) {
    sortStateReal.dir = nextSortDir(sortStateReal, triggerCol);
    sortStateReal.col = sortStateReal.dir === 'none' ? null : triggerCol;
  }
  const wrapper = document.getElementById('table-real-wrapper');
  const colMeses = selectedMonths.size > 0
    ? MONTHS_REAL.filter(mk => selectedMonths.has(mk))
    : MONTHS_REAL;

  // Getters de valor para cada tipo de coluna
  const getVal = (o) => {
    if (!sortStateReal.col) return 0;
    if (sortStateReal.col === 'nome')      return o.nome;
    if (sortStateReal.col === 'capex')     return o.capex;
    if (sortStateReal.col === 'total_real') return colMeses.reduce((s, mk) => s + (o[mk+'_real']||0), 0);
    if (sortStateReal.col === 'total_prev') return colMeses.reduce((s, mk) => s + (o.flow[mk]||0), 0);
    if (sortStateReal.col === 'desvio_pct') {
      const r = colMeses.reduce((s, mk) => s + (o[mk+'_real']||0), 0);
      const p = colMeses.reduce((s, mk) => s + (o.flow[mk]||0), 0);
      // Sem previsto → valor extremo para ordenação (vai para o fim/início conforme dir)
      return p > 0 ? ((r - p) / p) * 100 : (sortStateReal.dir === 'asc' ? -Infinity : Infinity);
    }
    if (sortStateReal.col.startsWith('real_')) return o[sortStateReal.col.slice(5)+'_real'] || 0;
    if (sortStateReal.col.startsWith('prev_')) return o.flow[sortStateReal.col.slice(5)] || 0;
    return 0;
  };
  const fo = sortedObras(filteredObras, sortStateReal, getVal);

  const thCls = (col) => {
    let cls = 'sortable';
    if (sortStateReal.col === col) cls += sortStateReal.dir === 'asc' ? ' sort-asc' : sortStateReal.dir === 'desc' ? ' sort-desc' : '';
    return cls;
  };

  let html = `<table style="min-width:900px"><thead><tr>
    <th class="${thCls('nome')}" onclick="renderTableReal('nome')">Obra</th>
    <th class="${thCls('capex')}" onclick="renderTableReal('capex')">CAPEX</th>`;
  colMeses.forEach(mk => {
    const label = MONTHS.find(m => m.key === mk).label;
    html += `<th class="real ${thCls('real_'+mk)}" onclick="renderTableReal('real_${mk}')">Real ${label}</th>`;
    html += `<th class="prev ${thCls('prev_'+mk)}" onclick="renderTableReal('prev_${mk}')">Prev ${label}</th>`;
  });
  html += `<th class="real ${thCls('total_real')}" onclick="renderTableReal('total_real')">Total Real</th>`;
  html += `<th class="prev ${thCls('total_prev')}" onclick="renderTableReal('total_prev')">Total Prev</th>`;
  html += `<th class="${thCls('desvio_pct')}" onclick="renderTableReal('desvio_pct')">Desvio %</th>`;
  html += `</tr></thead><tbody>`;

  fo.forEach(o => {
    const totReal = colMeses.reduce((s, mk) => s + (o[mk+'_real']||0), 0);
    const totPrev = colMeses.reduce((s, mk) => s + (o.flow[mk]||0), 0);
    const dev = totPrev > 0 ? ((totReal - totPrev) / totPrev) * 100 : null;
    const devClass = dev !== null ? (dev > 15 ? 'desvio-pos' : dev < -15 ? 'desvio-neg' : '') : '';
      const isConting       = o.contingenciada;
    const isContingParcial = !o.contingenciada && o.nome.includes('CONTING. PARCIAL');
    const isAporte         = isAporteExtra(o.nome);
    html += `<tr class="obra-row${isConting ? ' contingenciada-row' : ''}" onclick="openPanel(${obras.indexOf(o)})">
      <td>${o.nome.replace(' - CONTING. PARCIAL','')}${isContingParcial ? ' <span class="badge-atencao" style="font-size:10px;padding:2px 8px">⚠️ CONTING. PARCIAL</span>' : ''}${isConting ? ' <span class="badge-contingenciada">CONTINGENCIADA</span>' : ''}${isAporte ? ' <span class="badge-aporte">💚 APORTE EXTRA</span>' : ''}</td>
      <td>${fmtZ(o.capex)}</td>`;
    colMeses.forEach(mk => {
      const r = o[mk+'_real'] || 0;
      const p = o.flow[mk] || 0;
      html += `<td class="${r ? 'td-real' : 'td-zero'}">${fmtZ(r)}</td>`;
      html += `<td class="${p ? '' : 'td-zero'}">${fmtZ(p)}</td>`;
    });
    html += `<td class="td-real"><strong>${fmtZ(totReal)}</strong></td>`;
    html += `<td>${fmtZ(totPrev)}</td>`;
    html += `<td class="${devClass}">${dev !== null ? pct(dev) : '—'}</td></tr>`;
  });

  // Rodapé
  const fAll = filteredObras;
  const fPrev = fAll.filter(o => !o.contingenciada);
  const grandReal = colMeses.reduce((s, mk) => s + fAll.reduce((ss, o) => ss + (o[mk+'_real']||0), 0), 0);
  const grandPrev = colMeses.reduce((s, mk) => s + fAll.reduce((ss, o) => ss + (o.flow[mk]||0), 0), 0);
  const grandDev  = grandPrev > 0 ? ((grandReal - grandPrev) / grandPrev) * 100 : 0;
  // Linha Consumo Não Planejado + TOTAL GERAL — só no portfólio completo (sem filtro)
  const hasFilterReal = document.getElementById('filterInput').value.trim() !== ''
                     || activeTipos.size > 0
                     || activeStatusFilter !== null;
  const totNaoReal = hasFilterReal ? 0 : colMeses.reduce((s,mk) => s+(NAO_PLANEJADO[mk]||0), 0);

  if (!hasFilterReal) {
    html += `<tr style="background:#fff5f5;font-style:italic;">
      <td style="color:var(--vermelho);font-weight:700;">⚠️ Consumo Não Planejado</td>
      <td class="td-zero">—</td>`;
    colMeses.forEach(mk => {
      const naoReal = NAO_PLANEJADO[mk] || 0;
      html += `<td class="${naoReal?'td-real':'td-zero'}" style="${naoReal?'color:var(--vermelho);font-weight:600':''}">${fmtZ(naoReal)}</td>`;
      html += `<td class="${naoReal?'':'td-zero'}" style="${naoReal?'color:var(--vermelho);font-weight:600':''}">${fmtZ(naoReal)}</td>`;
    });
    html += `<td style="color:var(--vermelho);font-weight:700;">${fmtZ(totNaoReal)}</td>
      <td style="color:var(--vermelho);font-weight:700;">${fmtZ(totNaoReal)}</td>
      <td style="color:var(--verde);font-weight:700;">0,00%</td></tr>`;
  }

  // Rodapé: total planejado
  // Estilos de célula do rodapé — espelham as cores do cabeçalho
  const tfR  = 'style="background:#14436e;color:white;font-weight:700"'; // real → azul escuro
  const tfP  = 'style="background:#1a5ca8;color:white;font-weight:700"'; // prev → azul médio
  const tfTd = 'style="background:#0d2b4e;color:white;font-weight:700"'; // nome/capex/desvio

  const totalCapexRod = fAll.reduce((s,o)=>s+o.capex,0);

  // bottom dinâmico: 38px quando há 2ª linha de rodapé, 0px quando há só 1 linha
  const btm   = hasFilterReal ? '0px' : '38px';
  const tfTdS = `style="background:#0d2b4e;color:white;font-weight:700;position:sticky;bottom:${btm}"`;
  const tfRdS = `style="background:#14436e;color:white;font-weight:700;position:sticky;bottom:${btm}"`;
  const tfPdS = `style="background:#1a5ca8;color:white;font-weight:700;position:sticky;bottom:${btm}"`;
  const tfTdSL = `style="background:#0d2b4e;color:white;font-weight:700;position:sticky;bottom:${btm};left:0;z-index:3;text-align:left"`;
  // Label dinâmico: mostra qtd real de obras filtradas
  const totalLabel = hasFilterReal
    ? `TOTAL (${fAll.length} obra${fAll.length > 1 ? 's' : ''})`
    : `TOTAL PLANEJADO (${fAll.length} obras)`;

  html += `<tfoot>
    <tr>
      <td ${tfTdSL}>${totalLabel}</td>
      <td ${tfTdS}>${fmtZ(totalCapexRod)}</td>`;
  colMeses.forEach(mk => {
    html += `<td ${tfRdS}>${fmtZ(fAll.reduce((s,o)=>s+(o[mk+'_real']||0),0))}</td>`;
    html += `<td ${tfPdS}>${fmtZ(fAll.reduce((s,o)=>s+(o.flow[mk]||0),0))}</td>`;
  });
  html += `<td ${tfRdS}>${fmtZ(grandReal)}</td>
           <td ${tfPdS}>${fmtZ(grandPrev)}</td>
           <td ${tfTdS}>${pct(grandDev)}</td></tr>`;

  // Linha TOTAL GERAL (Planejado + Não Planejado) — só sem filtro
  if (!hasFilterReal) {
    const grandRealTotal = grandReal + totNaoReal;
    const grandPrevTotal = grandPrev + totNaoReal;
    const grandDevTotal  = grandPrevTotal > 0 ? ((grandRealTotal - grandPrevTotal) / grandPrevTotal) * 100 : 0;
    const tfRG = 'style="background:#0f3050;color:white;font-weight:700"'; // realizado total
    const tfPG = 'style="background:#1050a0;color:white;font-weight:700"'; // previsto total
    const tfTG = 'style="background:#08203a;color:white;font-weight:700"'; // label/desvio
    html += `<tr>
      <td ${tfTG}>REALIZADO TOTAL (Planejado + Não Planejado)</td>
      <td ${tfTG}>${fmtZ(fAll.reduce((s,o)=>s+o.capex,0))}</td>`;
    colMeses.forEach(mk => {
      const realMk = fAll.reduce((s,o)=>s+(o[mk+'_real']||0),0) + (NAO_PLANEJADO[mk]||0);
      const prevMk = fAll.reduce((s,o)=>s+(o.flow[mk]||0),0)    + (NAO_PLANEJADO[mk]||0);
      html += `<td ${tfRG}>${fmtZ(realMk)}</td><td ${tfPG}>${fmtZ(prevMk)}</td>`;
    });
    html += `<td ${tfRG}><strong>${fmtZ(grandRealTotal)}</strong></td>
             <td ${tfPG}>${fmtZ(grandPrevTotal)}</td>
             <td ${tfTG} style="color:#6dff9e;font-weight:700">${pct(grandDevTotal)}</td></tr>`;
  }
  html += `</tfoot></table>`;

  wrapper.innerHTML = html;
}

// ============================================================
// CHARTS — OBRAS
// ============================================================
let chartLine, chartDesvio, chartStacked, chartAcumulado;

function renderCharts() {
  // hasFilter controla se NAO_PLANEJADO é incluído nos cálculos
  const hasFilter = document.getElementById('filterInput').value.trim() !== ''
                 || activeTipos.size > 0
                 || activeStatusFilter !== null;
  // Todas as obras: contingenciadas têm flow = realizado (não distorcem o previsto)
  const fo = filteredObras;
  // Realizado: inclui todas as obras (são desembolsos reais)
  const foAll = filteredObras;

  // Meses ativos no filtro — se nenhum selecionado, mostra todos
  const activeMons = selectedMonths.size > 0 ? [...selectedMonths] : null;

  // ── Gráfico de Linha: Previsto vs Realizado ──────────────────
  // Quando há filtro de mês: mostra apenas os meses selecionados,
  // zerando os demais (para evidenciar o período filtrado).
  const prevData = MONTHS.map((m, idx) => {
    if (activeMons && activeMons.length > 0 && !activeMons.includes(m.key)) return null;
    const planSum = fo.reduce((s, o) => s + (o.flow[m.key]||0), 0);
    const naoSum  = hasFilter ? 0 : (NAO_PLANEJADO[m.key] || 0);
    const historicalTotal = !hasFilter && PREVISTO_HISTORICO[m.key] !== undefined
      ? Number(PREVISTO_HISTORICO[m.key])
      : null;
    const total   = historicalTotal !== null ? historicalTotal : planSum + naoSum;
    // Retornar 0 (não null) quando filtro está ativo — para mostrar linha desde JAN
    // Só retorna null se for mês futuro além do calendário necessário
    if (hasFilter && total === 0 && idx > 18) return null;
    return total;
  });
  const realData = MONTHS.map(m => {
    if (!MONTHS_REAL.includes(m.key)) return null;
    if (activeMons && !activeMons.includes(m.key)) return null;
    return foAll.reduce((s, o) => s + (o[m.key+'_real']||0), 0);
  });

  // Realizado total = planejado + não planejado (linha única)
  const naoPlannedByMonth = MONTHS.map(m => {
    if (hasFilter) return null;
    if (activeMons && !activeMons.includes(m.key)) return null;
    if (!MONTHS_REAL.includes(m.key)) return null;
    return NAO_PLANEJADO[m.key] || 0;
  });
  const realPlannedByMonth = realData; // já calculado acima (apenas obras planejadas)
  const realTotalData = MONTHS.map((m, i) => {
    const rPlan = realPlannedByMonth[i];
    const rNao  = naoPlannedByMonth[i];
    if (rPlan === null && rNao === null) return null;
    return (rPlan || 0) + (rNao || 0);
  });

  if (chartLine) chartLine.destroy();
  chartLine = new Chart(document.getElementById('chartLine'), {
    type: 'line',
    data: {
      labels: MONTHS.map(m => m.label),
      datasets: [
        {
          label: 'Previsto (15/75/10)',
          data: prevData,
          borderColor: '#1a5ca8',
          backgroundColor: 'rgba(26,92,168,0.08)',
          fill: true, tension: 0.3, pointRadius: 5, borderWidth: 2.5, spanGaps: false
        },
        {
          label: 'Realizado Total',
          data: realTotalData,
          borderColor: '#e07020',
          backgroundColor: 'rgba(224,112,32,0.10)',
          fill: true, tension: 0.3, pointRadius: 6, borderWidth: 2.5, spanGaps: false,
          // dados auxiliares acessíveis no tooltip
          _realPlan: realPlannedByMonth,
          _realNao:  naoPlannedByMonth
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                // Linha de previsto
                return ` Previsto: ${fmt(ctx.raw)}`;
              }
              // Linha de realizado total — detalhar planejado + não planejado
              const idx   = ctx.dataIndex;
              const rPlan = ctx.dataset._realPlan[idx];
              const rNao  = ctx.dataset._realNao[idx];
              const total = ctx.raw;
              const lines = [` Realizado Total: ${fmt(total)}`];
              if (rPlan !== null && rPlan > 0)
                lines.push(`   ↳ Obras Planejadas: ${fmt(rPlan)}`);
              if (rNao !== null && rNao > 0)
                lines.push(`   ↳ Consumo Não Planejado: ${fmt(rNao)}`);
              return lines;
            }
          }
        }
      },
      scales: { y: { ticks: { callback: v => fmt(v, true) } } }
    }
  });

  // ── Gráfico de Desvio por Obra ────────────────────────────────
  // Quando filtro de mês ativo: calcula desvio apenas nos meses selecionados
  const mesesDesvio = activeMons ? activeMons.filter(mk => MONTHS_REAL.includes(mk)) : MONTHS_REAL;
  const obrasComDesvio = fo.filter(o =>
    mesesDesvio.some(mk => (o[mk+'_real']||0) > 0 || (o.flow[mk]||0) > 0)
  );
  const desvioData = obrasComDesvio.map(o => {
    const r = mesesDesvio.reduce((s, mk) => s + (o[mk+'_real']||0), 0);
    const p = mesesDesvio.reduce((s, mk) => s + (o.flow[mk]||0), 0);
    return p > 0 ? ((r - p) / p) * 100 : 0;
  }).slice(0, 30);
  const desvioLabels = obrasComDesvio.slice(0, 30).map(o => o.nome.substring(0, 35));
  const desvioColors = desvioData.map(v => v >= 0 ? 'rgba(30,138,74,0.75)' : 'rgba(192,57,43,0.75)');

  const h = Math.max(280, desvioLabels.length * 22);
  document.getElementById('chartDesvioContainer').style.height = h + 'px';

  if (chartDesvio) chartDesvio.destroy();
  chartDesvio = new Chart(document.getElementById('chartDesvio'), {
    type: 'bar',
    data: {
      labels: desvioLabels,
      datasets: [{ label: 'Desvio %', data: desvioData, backgroundColor: desvioColors, borderWidth: 0 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => pct(ctx.raw) } } },
      scales: { x: { ticks: { callback: v => pct(v) } } }
    }
  });

  // ── Gráfico Stacked por Tipologia ────────────────────────────
  // Quando filtro de mês ativo: zera os meses não selecionados
  const tiposAtivos = [...new Set(fo.map(o => o.tipologia))];
  const colors14 = ['#0d2b4e','#1a4b8c','#2e6bbf','#16a085','#e07020','#8e44ad','#c0392b','#27ae60','#f39c12','#2980b9','#7f8c8d','#d35400','#1abc9c','#e74c3c'];
  const stackedDatasets = tiposAtivos.map((tipo, i) => ({
    label: tipo,
    data: MONTHS.map(m => {
      if (activeMons && !activeMons.includes(m.key)) return 0;
      return fo.filter(o => o.tipologia === tipo).reduce((s, o) => s + (o.flow[m.key]||0), 0);
    }),
    backgroundColor: colors14[i % colors14.length],
    stack: 'stack'
  }));

  if (chartStacked) chartStacked.destroy();
  chartStacked = new Chart(document.getElementById('chartStacked'), {
    type: 'bar',
    data: { labels: MONTHS.map(m => m.label), datasets: stackedDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw, true)}` } } },
      scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => fmt(v, true) } } }
    }
  });

  // ── Gráfico Acumulado: Previsto vs Realizado Planejado vs Realizado Total ──────
  // Apenas meses reais (Jan–Mai)
  // Acumulado: previsto vai até o último mês do calendário (Jul/27)
  //            realizado para no último mês com dados (MONTHS_REAL)
  const MONTHS_ALL_KEYS = MONTHS.map(m => m.key); // jan...jul27
  let cumPrev=0, cumRealPlan=0, cumRealTotal=0;
  const acumPrevData=[], acumRealPlanData=[], acumRealTotalData=[], acumLabels=[];
  MONTHS_ALL_KEYS.forEach(mk => {
    const isReal = MONTHS_REAL.includes(mk);
    cumPrev     += fo.reduce((s,o) => s+(o.flow[mk]||0), 0) + (hasFilter ? 0 : (NAO_PLANEJADO[mk]||0));
    if (isReal) {
      cumRealPlan  += foAll.reduce((s,o) => s+(o[mk+'_real']||0), 0);
      cumRealTotal += foAll.reduce((s,o) => s+(o[mk+'_real']||0), 0) + (hasFilter ? 0 : (NAO_PLANEJADO[mk]||0));
    }
    acumLabels.push(MONTHS.find(m=>m.key===mk).label);
    acumPrevData.push(cumPrev);
    acumRealPlanData.push(isReal ? cumRealPlan : null);
    acumRealTotalData.push(isReal ? cumRealTotal : null);
  });

  if (chartAcumulado) chartAcumulado.destroy();
  chartAcumulado = new Chart(document.getElementById('chartAcumulado'), {
    type: 'line',
    data: {
      labels: acumLabels,
      datasets: [
        { label: 'Previsto Acumulado (Planejado)',        data: acumPrevData,     borderColor: '#1a5ca8', backgroundColor: 'rgba(26,92,168,0.07)', fill: true,  tension: 0.3, pointRadius: 6, borderWidth: 2.5, pointStyle: 'circle' },
        { label: 'Realizado Acumulado (Obras Planejadas)',data: acumRealPlanData, borderColor: '#e07020', backgroundColor: 'rgba(224,112,32,0.08)', fill: false, tension: 0.3, pointRadius: 6, borderWidth: 2.5, pointStyle: 'circle' },
        { label: 'Realizado Acumulado Total (+ Não Planejado)', data: acumRealTotalData, borderColor: '#c0392b', backgroundColor: 'rgba(192,57,43,0.08)', fill: false, tension: 0.3, pointRadius: 6, borderWidth: 2.5, borderDash: [5,4], pointStyle: 'triangle' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}`,
            afterBody: (items) => {
              if (items.length === 3) {
                const diff = items[2].raw - items[0].raw;
                return [`Gap Total vs Previsto: ${fmt(diff)} (${diff>=0?'+':''}${((diff/items[0].raw)*100).toFixed(1)}%)`];
              }
              return [];
            }
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: v => fmt(v, true) },
          title: { display: true, text: 'Consumo Acumulado (R$)', font: { size: 11 } }
        }
      }
    }
  });
}

// ============================================================
// RISK PANEL — OBRAS
// ============================================================
function renderRiskPanel() {
  const mesesRisco = selectedMonths.size > 0
    ? [...selectedMonths].filter(mk => MONTHS_REAL.includes(mk))
    : MONTHS_REAL;
const _firstMes = mesesRisco[0] || MONTHS_REAL[0];
  const _lastMes  = mesesRisco[mesesRisco.length - 1] || MONTHS_REAL[MONTHS_REAL.length - 1];
  const _monthPT  = { jan:'Jan',fev:'Fev',mar:'Mar',abr:'Abr',mai:'Mai',jun:'Jun',
                       jul:'Jul',ago:'Ago',set:'Set',out:'Out',nov:'Nov',dez:'Dez',
                       jan27:'Jan',fev27:'Fev',mar27:'Mar',abr27:'Abr',
                       mai27:'Mai',jun27:'Jun',jul27:'Jul' };
  const _year     = (_lastMes||'').includes('27') ? '27' : '26';
  const periodLabel = mesesRisco.length === 1 && mesesRisco[0] === mesesRisco[0]
    ? `${_monthPT[_firstMes]||_firstMes.toUpperCase()}/${_year}`
    : `Jan a ${_monthPT[_lastMes]||_lastMes.toUpperCase()}/${_year}`;

  // Inclui contingenciadas: flow=realizado → desvio=0 → aparecem como Normal
  const fo = filteredObras.filter(o =>
    mesesRisco.some(mk => (o[mk+'_real']||0) > 0 || (o.flow[mk]||0) > 0)
  );
  const panel = document.getElementById('risk-panel');

  let html = `<table class="risk-table">
    <thead><tr>
      <th>Obra</th><th>Tipologia</th><th>CAPEX</th>
      <th>REAL YTD</th><th>PREVISTO YTD</th>
      <th>Desvio R$</th><th>Desvio %</th><th>Status</th>
    </tr></thead><tbody>`;

  const rows = fo.map(o => {
    const totReal = mesesRisco.reduce((s, mk) => s + (o[mk+'_real']||0), 0);
    const totPrev = mesesRisco.reduce((s, mk) => s + (o.flow[mk]||0), 0);
    const desvio = totReal - totPrev;
    const devPct = totPrev > 0 ? ((totReal - totPrev) / totPrev) * 100 : 0;
    return { o, totReal, totPrev, desvio, devPct };
  }).sort((a, b) => Math.abs(b.devPct) - Math.abs(a.devPct));

  rows.forEach(({ o, totReal, totPrev, desvio, devPct }) => {
    const absdev = Math.abs(devPct);
    let badge, badgeCls;
    if (absdev <= 10) { badge = '✅ Normal'; badgeCls = 'badge-ok'; }
    else if (absdev <= 25) { badge = '⚠️ Atenção'; badgeCls = 'badge-atencao'; }
    else { badge = '🔴 Crítico'; badgeCls = 'badge-critico'; }
    const devClass = devPct >= 0 ? 'desvio-pos' : 'desvio-neg';
    html += `<tr>
      <td>${o.nome.substring(0, 55)}</td>
      <td>${tipoEmojis[o.tipologia] || ''} ${o.tipologia}</td>
      <td>${fmt(o.capex, true)}</td>
      <td class="td-real">${fmt(totReal)}</td>
      <td>${fmt(totPrev)}</td>
      <td class="${devClass}">${fmt(desvio)}</td>
      <td class="${devClass}">${totPrev > 0 ? pct(devPct) : '—'}</td>
      <td><span class="${badgeCls}">${badge}</span></td>
    </tr>`;
  });

  html += '</tbody></table>';
  panel.innerHTML = html;
}

// ============================================================
// ANALYSIS TEXT — OBRAS
// ============================================================
function renderAnalysis() {
  const mesesAnalise = selectedMonths.size > 0
    ? [...selectedMonths].filter(mk => MONTHS_REAL.includes(mk))
    : MONTHS_REAL;
const _firstMes = mesesAnalise[0] || MONTHS_REAL[0];
  const _lastMes  = mesesAnalise[mesesAnalise.length - 1] || MONTHS_REAL[MONTHS_REAL.length - 1];
  const _monthPT  = { jan:'Jan',fev:'Fev',mar:'Mar',abr:'Abr',mai:'Mai',jun:'Jun',
                       jul:'Jul',ago:'Ago',set:'Set',out:'Out',nov:'Nov',dez:'Dez',
                       jan27:'Jan',fev27:'Fev',mar27:'Mar',abr27:'Abr',
                       mai27:'Mai',jun27:'Jun',jul27:'Jul' };
  const _year     = (_lastMes||'').includes('27') ? '27' : '26';
  const periodLabel = mesesAnalise.length === 1
    ? `${_monthPT[_firstMes]||_firstMes.toUpperCase()}/${_year}`
    : `Jan a ${_monthPT[_lastMes]||_lastMes.toUpperCase()}/${_year}`;

  // Todas as obras: contingenciadas têm flow = realizado (desvio = 0)
  const fo = filteredObras;
  // totalReal INCLUI contingenciadas (são desembolsos reais da planilha)
  const totalReal = filteredObras.reduce((s, o) => mesesAnalise.reduce((ss, mk) => ss + (o[mk+'_real']||0), s), 0);
  const totalRealNaoPlan = mesesAnalise.reduce((s, mk) => s + (NAO_PLANEJADO[mk]||0), 0);
  const totalRealGeral   = totalReal + totalRealNaoPlan;
  const totalPrev = fo.reduce((s, o) => s + mesesAnalise.reduce((ss, mk) => ss + (o.flow[mk]||0), 0), 0);
  const devGeral = totalPrev > 0 ? ((totalReal - totalPrev) / totalPrev) * 100 : 0;
  // Último mês com dados reais — dinâmico (atualiza automaticamente com cada mês)
  const ultimoMes = MONTHS_REAL[MONTHS_REAL.length - 1];
  const ultimoMesLabel = (MONTHS.find(m => m.key === ultimoMes)?.label) || (ultimoMes ? ultimoMes.toUpperCase() : 'JUN');
  const ultimoMesReal = filteredObras.reduce((s, o) => s + (o[ultimoMes+'_real']||0), 0);
  const ultimoMesPrev = fo.reduce((s, o) => s + (o.flow[ultimoMes]||0), 0);
  const devUltimoMes  = ultimoMesPrev > 0 ? ((ultimoMesReal - ultimoMesPrev) / ultimoMesPrev) * 100 : 0;
  // Top 2 obras no último mês (para análise)
  const topUltimoMes = [...filteredObras]
    .sort((a,b) => (b[ultimoMes+'_real']||0) - (a[ultimoMes+'_real']||0))
    .slice(0, 2);

  const topRealizadas = [...filteredObras].sort((a, b) =>
    mesesAnalise.reduce((s,mk) => s+(b[mk+'_real']||0), 0) - mesesAnalise.reduce((s,mk) => s+(a[mk+'_real']||0), 0)
  ).slice(0, 5);
  const topDesvio = [...fo].map(o => ({
    o,
    totPrev: mesesAnalise.reduce((s, mk) => s + (o.flow[mk]||0), 0),
    totReal: mesesAnalise.reduce((s, mk) => s + (o[mk+'_real']||0), 0)
  })).filter(({ totPrev }) => totPrev > 0).sort((a, b) =>
    Math.abs(((b.totReal-b.totPrev)/b.totPrev)) - Math.abs(((a.totReal-a.totPrev)/a.totPrev))
  ).slice(0, 5);

  const container = document.getElementById('analysis-text');
  container.innerHTML = `
    <h2>📋 Análise de Desempenho Financeiro — ${periodLabel}</h2>
    <h3>📊 Visão Geral do Portfólio</h3>
    <p>O portfólio contém <strong>${obras.length} obras</strong> com CAPEX inicial de <strong>${fmt(CAPEX_INICIAL)}</strong>. O CAPEX Atual é <strong>${fmt(CAPEX_ATUAL)}</strong> após contingenciamento acumulado de <strong>${fmt(CAPEX_CONTING)}</strong> e recebimentos acumulados de <strong>${fmt(CAPEX_RECEBIMENTO)}</strong> (${APORTE_ACUM_LABEL.replace("Acumulado ","")}).</p>
    <p>O total realizado no período <strong>${periodLabel}</strong> é de <strong>${fmt(totalReal)}</strong>, frente a um previsto de <strong>${fmt(totalPrev)}</strong> (modelo 15/75/10 para obras ativas; previsto igualado ao realizado para obras contingenciadas), resultando em desvio de <strong class="${devGeral>=0?'desvio-pos':'desvio-neg'}">${pct(devGeral)}</strong>.</p>

    <div class="highlight-box ${devUltimoMes>=0?'verde':'vermelho'}">
      <strong>🗓️ Desempenho de ${ultimoMesLabel}/2026:</strong> Realizado <strong>${fmt(ultimoMesReal)}</strong> vs. Previsto <strong>${fmt(ultimoMesPrev)}</strong> — Desvio: <strong>${pct(devUltimoMes)}</strong>.
      As obras com maior desembolso em ${ultimoMesLabel}/2026 foram:
      ${topUltimoMes.map((o,i) => `<strong>${i+1}. ${o.nome.substring(0,55)}</strong> — ${fmt(o[ultimoMes+'_real']||0)}`).join('; ')}.
    </div>

    <h3>🔴 Contingenciamentos — ${CONTING_ACUM_LABEL}</h3>
    <p>O contingenciamento acumulado até ${CONTING_ACUM_LABEL.replace("Acumulado Jan–","")} é de <strong>${fmt(CAPEX_CONTING)}</strong>, distribuído em <strong>${CONTING_DETALHE.length} lançamentos</strong>:</p>
    <div class="highlight-box vermelho">
      ${CONTING_DETALHE.map(c=>`<strong>${c.nome}:</strong> ${fmt(c.valor)}`).join('<br>')}
    </div>
    ${contingenciasParciais.length ? `<p>Há <strong>${contingenciasParciais.length} contingenciamento(s) parcial(is)</strong>. O CAPEX residual preservado nessas obras totaliza <strong>${fmt(CAPEX_RESIDUAL_PARCIAL)}</strong> e permanece dentro do CAPEX Atual: ${contingenciasParciais.map(o => `<strong>${o.nome.replace(' - CONTING. PARCIAL','')}:</strong> ${fmt(o.capex)}`).join('; ')}.</p>` : ''}

    <h3>💚 Aportes Extras — ${APORTE_ACUM_LABEL}</h3>
    <p>O total de aportes extras acumulados até ${APORTE_ACUM_LABEL.replace("Acumulado Jan–","")} é de <strong>${fmt(CAPEX_RECEBIMENTO)}</strong>:</p>
    <div class="highlight-box verde">
      ${RECEB_DETALHE.map(r=>`<strong>${r.nome}:</strong> ${fmt(r.valor)}`).join('<br>')}
    </div>

    <h3>🏆 Top 5 Obras por Volume Realizado (${periodLabel})</h3>
    ${topRealizadas.map((o, i) => {
      const rPeriodo = mesesAnalise.reduce((s,mk) => s+(o[mk+'_real']||0), 0);
      return `<div class="highlight-box"><strong>${i+1}. ${o.nome.substring(0,60)}</strong><br>Realizado: ${fmt(rPeriodo)} | CAPEX: ${fmt(o.capex)} | Avanço: ${o.capex>0?((o.total_real/o.capex)*100).toFixed(1):'—'}%</div>`;
    }).join('')}

    <h3>⚠️ Obras com Maior Desvio Orçamentário (${periodLabel})</h3>
    ${topDesvio.map(({ o, totReal: tr, totPrev: tp }) => {
      const dev = ((tr - tp) / tp) * 100;
      return `<div class="highlight-box ${dev >= 0 ? '' : 'vermelho'}"><strong>${o.nome.substring(0,60)}</strong><br>Real: ${fmt(tr)} | Prev: ${fmt(tp)} | Desvio: <strong>${pct(dev)}</strong></div>`;
    }).join('')}

    <h3>📌 Pontos de Atenção</h3>
    <p>O Novo Hospital Rio de Janeiro lidera o volume de desembolso acumulado no portfólio em 2026, com total realizado de <strong>${fmt(filteredObras.find(o=>o.nome.includes('Novo Hospital Rio de Janeiro'))?.total_real||0)}</strong> — recomenda-se atenção contínua ao fluxo de caixa desta obra. O PA Barra da Tijuca apresentou volume expressivo em ${ultimoMesLabel}/2026, sinalizando aceleração de execução. O Ampliação Hospital Parauapebas acumula realizações relevantes — a conclusão deve ocorrer conforme programado.</p>

    <h3>⚠️ Impacto do Consumo Não Planejado no CAPEX 2026</h3>
    <div class="highlight-box vermelho">
      <strong>Consumo total não planejado (Jan–Jun/26): ${fmt(TOTAL_NAO_PLANEJADO)}</strong>
      — equivalente a <strong>${(TOTAL_NAO_PLANEJADO/CAPEX_ATUAL*100).toFixed(1)}%</strong> do CAPEX Atual (${fmt(CAPEX_ATUAL)}).
    </div>
    <p>Este consumo representa aditivos de obras iniciadas em 2025 que não foram concluídas no exercício anterior e cujos contratos foram prorrogados para 2026. O previsto foi <strong>igualado ao realizado mês a mês</strong> — zerando o desvio deste pacote e garantindo que o desvio geral reflita apenas a performance das obras planejadas de 2026.</p>
    <p>A distribuição mensal revela concentração relevante no início do ano: <strong>JAN/26 foi o mês de maior impacto</strong> com ${fmt(NAO_PLANEJADO.jan)}, seguido por ABR/26 (${fmt(NAO_PLANEJADO.abr)}) e FEV/26 (${fmt(NAO_PLANEJADO.fev)}). A tendência de redução a partir de MAR/26 sugere que parte desses contratos está chegando ao encerramento.</p>
    <div class="highlight-box">
      <strong>📊 Efeito sobre o CAPEX Atual:</strong> O consumo não planejado acumulado de ${fmt(TOTAL_NAO_PLANEJADO)} representa uma <strong>pressão efetiva de ${(TOTAL_NAO_PLANEJADO/CAPEX_ATUAL*100).toFixed(1)}% sobre o orçamento disponível</strong> para as obras planejadas de 2026. Sem esse consumo residual, o saldo disponível para as obras planejadas seria ${fmt(CAPEX_ATUAL - totalReal + TOTAL_NAO_PLANEJADO)} — ${fmt(TOTAL_NAO_PLANEJADO)} a mais do que o disponível atualmente.
    </div>
    <p><strong>Recomendação:</strong> Monitorar mensalmente a tendência de redução desse consumo. Caso novos aditivos sejam identificados, deve-se avaliar o impacto na capacidade de execução das obras planejadas para o segundo semestre de 2026, em especial as de maior CAPEX: Novo Hospital Rio de Janeiro (${fmt(71542200)}) e PA Barra da Tijuca (${fmt(24994191.11)}).</p>
  `;
}


// ============================================================
// KPI SIDE PANELS
// ============================================================
function closeKpiPanel() {
  document.getElementById('kpi-overlay').classList.remove('open');
  document.getElementById('kpi-panel').classList.remove('open');
}

function openKpiPanel(type) {
  const overlay = document.getElementById('kpi-overlay');
  const panel   = document.getElementById('kpi-panel');
  const tag     = document.getElementById('kpi-panel-tag');
  const title   = document.getElementById('kpi-panel-title');
  const body    = document.getElementById('kpi-panel-body');

  if (type === 'capex_atual') {
    tag.innerHTML   = '💼 CAPEX Atual';
    title.textContent = 'CAPEX Atual — Composição e Detalhamento';

    const contParciais   = contingenciasParciais;
    const contTotais     = obras.filter(o => o.contingenciada);
    const contObras      = [...contTotais, ...contParciais];

    let html = `
    <!-- Fórmula do CAPEX Atual -->
    <div class="panel-section">
      <div class="panel-section-title">📐 Fórmula de Cálculo</div>
      <div style="background:var(--cinza-bg);border-radius:10px;padding:14px 16px;font-size:13px;line-height:2;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--cinza-borda);padding-bottom:8px;margin-bottom:8px;">
          <span style="color:var(--texto-suave)">CAPEX Inicial</span>
          <span style="font-weight:700;color:var(--azul)">${fmt(CAPEX_INICIAL)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--cinza-borda);padding-bottom:8px;margin-bottom:8px;">
          <span style="color:var(--texto-suave)">( − ) Contingenciamento</span>
          <span style="font-weight:700;color:var(--vermelho)">− ${fmt(CAPEX_CONTING)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--cinza-borda);padding-bottom:8px;margin-bottom:8px;">
          <span style="color:var(--texto-suave)">( + ) Aportes Extras</span>
          <span style="font-weight:700;color:var(--verde)">+ ${fmt(CAPEX_RECEBIMENTO)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;">
          <span style="font-weight:800;color:var(--azul);font-size:14px">= CAPEX Atual</span>
          <span style="font-weight:800;color:var(--azul);font-size:15px">${fmt(CAPEX_ATUAL)}</span>
        </div>
      </div>
      ${contParciais.length ? `<div style="margin-top:10px;padding:10px 12px;background:#fff8e6;border-left:3px solid var(--amarelo);border-radius:7px;font-size:11px;line-height:1.5;color:var(--texto-suave)">
        <strong style="color:#8a6000">⚠️ CAPEX residual preservado:</strong> ${fmt(CAPEX_RESIDUAL_PARCIAL)} em ${contParciais.length} obra(s) parcialmente contingenciada(s). Esse saldo já permanece no CAPEX Atual porque o lançamento de contingenciamento considera somente a parcela retirada.
      </div>` : ''}
    </div>

    <!-- Contingenciamentos -->
    <div class="panel-section">
      <div class="panel-section-title">🔴 Contingenciamentos — ${CONTING_ACUM_LABEL.replace('Acumulado ','')} · ${fmt(CAPEX_CONTING)}</div>`;

    CONTING_DETALHE.forEach(c => {
      const pct_c = ((c.valor / CAPEX_CONTING) * 100).toFixed(1);
      html += `<div style="padding:10px 0;border-bottom:1px solid var(--cinza-borda)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600;color:var(--azul);padding-right:8px;flex:1">${c.nome}</span>
          <span style="font-size:13px;font-weight:800;color:var(--vermelho);white-space:nowrap">${fmt(c.valor)}</span>
        </div>
        <div style="background:var(--cinza-borda);border-radius:4px;height:4px">
          <div style="background:var(--vermelho);border-radius:4px;height:4px;width:${pct_c}%"></div>
        </div>
        <div style="font-size:10px;color:var(--texto-suave);margin-top:2px">${pct_c}% do total contingenciado</div>
      </div>`;
    });

    // Obras com realizado parcial antes do contingenciamento
    const comReal = contObras.filter(o => o.total_real > 0);
    if (comReal.length > 0) {
      html += `<div style="margin-top:12px;padding:10px 12px;background:#fff5f5;border-radius:8px;border-left:3px solid var(--vermelho)">
        <div style="font-size:10px;font-weight:800;color:var(--vermelho);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
          ⚠️ Valores realizados antes do contingenciamento
        </div>`;
      comReal.forEach(o => {
        const nomeLimpo = o.nome.replace(' - CONTINGENCIADA','').replace(' - CONTING. PARCIAL','');
        const badge = o.nome.includes('CONTING. PARCIAL')
          ? '<span style="background:#fff0c0;color:#8a6000;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">PARCIAL</span>'
          : '<span style="background:#fde0dd;color:#8a1c1c;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">TOTAL</span>';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(192,57,43,0.15)">
          <span style="font-size:11px;color:var(--azul);flex:1;padding-right:8px">${nomeLimpo} ${badge}</span>
          <span style="font-size:12px;font-weight:700;color:var(--laranja)">${fmt(o.total_real)}</span>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div>

    <!-- Aportes Extras -->
    <div class="panel-section">
      <div class="panel-section-title">💚 Aportes Extras — ${APORTE_ACUM_LABEL.replace('Acumulado ','')} · ${fmt(CAPEX_RECEBIMENTO)}</div>`;

    RECEB_DETALHE.forEach(r => {
      const pct_r = ((r.valor / CAPEX_RECEBIMENTO) * 100).toFixed(1);
      html += `<div style="padding:10px 0;border-bottom:1px solid var(--cinza-borda)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600;color:var(--azul);padding-right:8px;flex:1">${r.nome}</span>
          <span style="font-size:13px;font-weight:800;color:var(--verde);white-space:nowrap">${fmt(r.valor)}</span>
        </div>
        <div style="background:var(--cinza-borda);border-radius:4px;height:4px">
          <div style="background:var(--verde);border-radius:4px;height:4px;width:${pct_r}%"></div>
        </div>
        <div style="font-size:10px;color:var(--texto-suave);margin-top:2px">${pct_r}% do total de aportes</div>
      </div>`;
    });

    html += `</div>`;
    body.innerHTML = html;

  } else if (type === 'contingenciamento') {
    tag.innerHTML   = '🔴 Contingenciamento';
    title.textContent = 'Obras Contingenciadas — Detalhamento';
    const contObras = obras.filter(o => o.contingenciada || o.nome.includes('CONTING. PARCIAL'));
    const contParciais = obras.filter(o => o.nome.includes('CONTING. PARCIAL'));
    const totalConting = CAPEX_CONTING;
    let html = `<div class="panel-section">
      <div class="panel-section-title">💰 Total Contingenciado — ${CONTING_ACUM_LABEL}</div>
      <div class="panel-kpis">
        <div class="panel-kpi vermelho" style="grid-column:1/-1">
          <div class="panel-kpi-label">Total Contingenciado</div>
          <div class="panel-kpi-value">${fmt(totalConting)}</div>
        </div>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-title">📋 Detalhamento por Obra</div>`;

    CONTING_DETALHE.forEach(c => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--cinza-borda)">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--azul)">${c.nome}</div>
          <div style="font-size:11px;color:var(--texto-suave)">Contingenciado em ${detalheMesLabel(c)}</div>
        </div>
        <div style="font-size:13px;font-weight:800;color:var(--vermelho)">${fmt(c.valor)}</div>
      </div>`;
    });
    html += '</div>';

    if (contParciais.length > 0) {
      html += `<div class="panel-section">
        <div class="panel-section-title">🟡 CAPEX Residual das Contingências Parciais</div>
        <div class="panel-kpis">
          <div class="panel-kpi" style="grid-column:1/-1;border-left-color:var(--amarelo)">
            <div class="panel-kpi-label">Residual preservado no CAPEX Atual</div>
            <div class="panel-kpi-value">${fmt(CAPEX_RESIDUAL_PARCIAL)}</div>
          </div>
        </div>`;
      contParciais.forEach(o => {
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--cinza-borda)">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--azul)">${o.nome.replace(' - CONTING. PARCIAL','')}</div>
            <div style="font-size:11px;color:var(--texto-suave)">Contingenciamento parcial</div>
          </div>
          <div style="font-size:13px;font-weight:800;color:#8a6000">${fmt(o.capex)}</div>
        </div>`;
      });
      html += '</div>';
    }

    // Realizados das obras contingenciadas, totais ou parciais
    const comReal = contObras.filter(o => o.total_real > 0);
    if (comReal.length > 0) {
      html += `<div class="panel-section">
        <div class="panel-section-title">📊 Valores Realizados Antes do Contingenciamento</div>`;
      comReal.forEach(o => {
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--cinza-borda)">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--azul)">${o.nome.replace(' - CONTINGENCIADA','').replace(' - CONTING. PARCIAL','')}</div>
            <div style="font-size:11px;color:var(--texto-suave)">Valor já desembolsado</div>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--laranja)">${fmt(o.total_real)}</div>
        </div>`;
      });
      html += '</div>';
    }

    body.innerHTML = html;


    } else if (type === 'aportes_extras') {
    tag.innerHTML   = '💚 Aportes Extras';
    title.textContent = 'Aportes Extras — Detalhamento Acumulado';
    const totalAportes = RECEB_DETALHE.reduce((s, r) => s + r.valor, 0);
    let html = `<div class="panel-section">
      <div class="panel-section-title">💰 Total de Aportes — ${APORTE_ACUM_LABEL}</div>
      <div class="panel-kpis">
        <div class="panel-kpi verde" style="grid-column:1/-1">
          <div class="panel-kpi-label">Total Aportes Extras</div>
          <div class="panel-kpi-value">${fmt(CAPEX_RECEBIMENTO)}</div>
        </div>
      </div>
    </div>
    <div class="panel-section">
      <div class="panel-section-title">📋 Obras com Aporte Extra</div>`;
    RECEB_DETALHE.forEach(r => {
      const pct_aporte = ((r.valor / CAPEX_RECEBIMENTO) * 100).toFixed(1);
      html += `<div style="padding:11px 0;border-bottom:1px solid var(--cinza-borda)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px">
          <div style="padding-right:8px;flex:1"><div style="font-size:12px;font-weight:600;color:var(--azul)">${r.nome}</div><div style="font-size:10px;color:var(--texto-suave);margin-top:2px">Aporte em ${detalheMesLabel(r)}</div></div>
          <div style="font-size:13px;font-weight:800;color:var(--verde);white-space:nowrap">${fmt(r.valor)}</div>
        </div>
        <div style="background:var(--cinza-borda);border-radius:4px;height:5px;margin-top:4px">
          <div style="background:var(--verde);border-radius:4px;height:5px;width:${pct_aporte}%"></div>
        </div>
        <div style="font-size:10px;color:var(--texto-suave);margin-top:3px">${pct_aporte}% do total de aportes</div>
      </div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
  }

  overlay.classList.add('open');
  panel.classList.add('open');
}

// ============================================================
// SIDE PANEL
// ============================================================
let panelChart = null;

function openPanel(idx) {
  const o = obras[idx];
  const panelStatus = o.nome.includes('CONTING. PARCIAL')
    ? ' · <span style="background:rgba(240,180,41,0.35);padding:2px 8px;border-radius:10px;font-size:11px">CONTING. PARCIAL</span>'
    : (o.contingenciada ? ' · <span style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px">CONTINGENCIADA</span>' : '');
  document.getElementById('panel-tipo').innerHTML = `${tipoEmojis[o.tipologia] || '📌'} ${o.tipologia}${panelStatus}`;
  document.getElementById('panel-nome').textContent = o.nome;
  document.getElementById('panel-inicio').textContent = o.inicio || '—';
  document.getElementById('panel-fim').textContent = o.fim || '—';
  document.getElementById('panel-capex').textContent = o.capex ? fmt(o.capex) : '—';

  const totReal = o.total_real;
  const saldo = o.capex - totReal;
  document.getElementById('panel-real').textContent = fmt(totReal) || '—';
  document.getElementById('panel-saldo').textContent = saldo >= 0 ? fmt(saldo) : fmt(saldo);

  // Build chart data
  const labels = MONTHS_REAL.map(mk => MONTHS.find(m=>m.key===mk).label);
  const prevVals = MONTHS_REAL.map(mk => o.flow[mk] || 0);
  const realVals = MONTHS_REAL.map(mk => o[mk+'_real'] || 0);

  if (panelChart) { panelChart.destroy(); panelChart = null; }
  panelChart = new Chart(document.getElementById('panel-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Previsto', data: prevVals, backgroundColor: 'rgba(26,92,168,0.6)', borderRadius: 4 },
        { label: 'Realizado', data: realVals, backgroundColor: 'rgba(224,112,32,0.8)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } } },
      scales: { y: { ticks: { callback: v => fmt(v, true) } } }
    }
  });

  // Deviation chips
  const strip = document.getElementById('panel-dev-strip');
  strip.innerHTML = '';
  MONTHS_REAL.forEach(mk => {
    const r = o[mk+'_real'] || 0;
    const p = o.flow[mk] || 0;
    const d = p > 0 ? ((r-p)/p)*100 : 0;
    const cls = (r===0&&p===0) ? 'zero' : (d>=0?'pos':'neg');
    strip.innerHTML += `<div class="dev-chip ${cls}">
      <div class="dev-chip-mes">${mk.toUpperCase()}</div>
      <div class="dev-chip-pct">${(r===0&&p===0)?'—':pct(d)}</div>
      <div class="dev-chip-vals">${fmt(r,true)}<br>${fmt(p,true)}</div>
    </div>`;
  });

  const totPrev = MONTHS_REAL.reduce((s, mk) => s + (o.flow[mk]||0), 0);
  const totDev = totPrev > 0 ? ((totReal - totPrev) / totPrev) * 100 : 0;
  document.getElementById('panel-total-prev').textContent = fmt(totPrev) || '—';
  document.getElementById('panel-total-real').textContent = fmt(totReal) || '—';
  const devEl = document.getElementById('panel-total-dev');
  devEl.textContent = totPrev > 0 ? pct(totDev) : '—';
  devEl.className = 't-dev ' + (totDev >= 0 ? 'pos' : 'neg');

  document.getElementById('obra-overlay').classList.add('open');
  document.getElementById('obra-panel').classList.add('open');
}

function closePanel() {
  document.getElementById('obra-overlay').classList.remove('open');
  document.getElementById('obra-panel').classList.remove('open');
}

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');
  // Não reseta sort — mantém a ordenação ao trocar entre as abas
}

function switchPage(id, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
}

// ============================================================
// MANUTENÇÃO
// ============================================================
const MAN_PACOTE_INICIAL = 20000000.00;   // Pacote original antes da doação
const MAN_PACOTE         = 19609389.82;   // Pacote Atual = Inicial − doação (R$ 390.610,18)
let manFilteredObras = manObras;
let manChartLine, manChartBar;

function applyManFilter() {
  const text = document.getElementById('manFilterInput').value.toLowerCase();
  const selMons = manSelectedMonths;
  manFilteredObras = manObras.filter(o => {
    const matchText = !text || o.nome.toLowerCase().includes(text) || o.ordem.includes(text);
    const matchMonth = selMons.size === 0 || [...selMons].some(mk => (o[mk+'_real']||0) > 0);
    return matchText && matchMonth;
  });
  document.getElementById('manFilterCount').textContent = `${manFilteredObras.length} de ${manObras.length} obras`;
  renderManKPIs();
  renderManTable();
  renderManCharts();
  renderManRisk();
}

function clearManFilter() {
  document.getElementById('manFilterInput').value = '';
  applyManFilter();
}

function clearAllManFilters() { clearManMonthFilter(); clearManFilter(); }

function renderManMonthChips() {
  const container = document.getElementById('man-month-chips');
  container.innerHTML = '';
  MONTHS.forEach(m => {
    const hasReal = MONTHS_REAL.includes(m.key);
    const isActive = manSelectedMonths.has(m.key);
    const chip = document.createElement('span');
    chip.className = 'month-chip' + (isActive?' active':'') + (hasReal?' has-real':'');
    chip.textContent = m.label;
    chip.onclick = () => {
      if (manSelectedMonths.has(m.key)) manSelectedMonths.delete(m.key); else manSelectedMonths.add(m.key);
      renderManMonthChips(); applyManFilter();
    };
    container.appendChild(chip);
  });
  document.getElementById('man-mf-info').textContent = manSelectedMonths.size > 0 ? `${manSelectedMonths.size} período(s)` : 'Todos os meses';
}

function clearManMonthFilter() { manSelectedMonths.clear(); renderManMonthChips(); applyManFilter(); }

function renderManKPIs() {
  const fo = manFilteredObras;
  const activeMons = manSelectedMonths.size > 0 ? [...manSelectedMonths] : MONTHS_REAL;
  const totalReal = activeMons.reduce((s, mk) => s + fo.reduce((ss, o) => ss + (o[mk+'_real']||0), 0), 0);
  const totalObras = fo.filter(o => o.total_real > 0).length;
const _firstMes = activeMons[0] || MONTHS_REAL[0];
  const _lastMes  = activeMons[activeMons.length - 1] || MONTHS_REAL[MONTHS_REAL.length - 1];
  const _monthPT  = { jan:'Jan',fev:'Fev',mar:'Mar',abr:'Abr',mai:'Mai',jun:'Jun',
                       jul:'Jul',ago:'Ago',set:'Set',out:'Out',nov:'Nov',dez:'Dez',
                       jan27:'Jan',fev27:'Fev',mar27:'Mar',abr27:'Abr',
                       mai27:'Mai',jun27:'Jun',jul27:'Jul' };
  const _year     = (_lastMes||'').includes('27') ? '27' : '26';
  const periodLabel = activeMons.length === 1
    ? `${_monthPT[_firstMes]||_firstMes.toUpperCase()}/${_year}`
    : `Jan a ${_monthPT[_lastMes]||_lastMes.toUpperCase()}/${_year}`;
  const pctConsumo = MAN_PACOTE > 0 ? (totalReal / MAN_PACOTE) * 100 : 0;

  // Pacote manutenção previsto (15/75/10 distribution — 41.7% by May)
  const manPrevisto = MAN_PACOTE * (5/12); // ~5 months of 12

  document.getElementById('man-kpi-section').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Pacote Anual Inicial</div>
      <div class="kpi-value">${fmt(MAN_PACOTE_INICIAL)}</div>
      <div class="kpi-sub">Orçamento original 2026</div>
    </div>
    <div class="kpi-card clickable" onclick="openManPacotePanel()" style="cursor:pointer">
      <div class="kpi-label">Pacote Anual Atual</div>
      <div class="kpi-value">${fmt(MAN_PACOTE)}</div>
      <div class="kpi-sub">Após doação · clique para detalhar</div>
      <div style="font-size:10px;color:var(--azul-claro);margin-top:4px;font-weight:600">👆 clique para detalhar</div>
    </div>
    <div class="kpi-card laranja">
      <div class="kpi-label">REALIZADO YTD</div>
      <div class="kpi-value">${fmt(totalReal)}</div>
      <div class="kpi-sub">${totalObras} obras com movimentação · ${pctConsumo.toFixed(1)}% do pacote</div>
    </div>
    <div class="kpi-card verde">
      <div class="kpi-label">Saldo Disponível</div>
      <div class="kpi-value">${fmt(MAN_PACOTE - totalReal)}</div>
      <div class="kpi-sub">${(100 - pctConsumo).toFixed(1)}% do pacote restante</div>
    </div>`;

  const pctReal = (totalReal / MAN_PACOTE) * 100;
  const pctPrev = (manPrevisto / MAN_PACOTE) * 100;
  document.getElementById('man-bar-real').style.width = Math.min(pctReal, 100) + '%';
  document.getElementById('man-bar-prev').style.width = Math.min(Math.max(pctPrev - pctReal, 0), 100 - pctReal) + '%';
  document.getElementById('man-pool-pct').textContent = pctConsumo.toFixed(1) + '% consumido';
}

function renderManTable() {
  const fo = manFilteredObras;

  // Colunas visíveis: só meses selecionados (com dados reais); senão todos os meses reais
  const colMeses = manSelectedMonths.size > 0
    ? MONTHS_REAL.filter(mk => manSelectedMonths.has(mk))
    : MONTHS_REAL;

  let html = `<table><thead><tr><th>Obra de Manutenção</th><th>Ordem Int.</th>`;
  colMeses.forEach(mk => { html += `<th class="real">${MONTHS.find(m=>m.key===mk).label}</th>`; });
  html += `<th class="real">Total Real</th></tr></thead><tbody>`;

  fo.forEach(o => {
    const totalPeriodo = colMeses.reduce((s, mk) => s + (o[mk+'_real']||0), 0);
    html += `<tr><td>${o.nome}</td><td style="text-align:center;font-size:11px;color:var(--texto-suave)">${o.ordem}</td>`;
    colMeses.forEach(mk => {
      const v = o[mk+'_real'] || 0;
      html += `<td class="${v ? 'td-real' : 'td-zero'}">${fmtZ(v)}</td>`;
    });
    html += `<td class="td-real"><strong>${fmtZ(totalPeriodo)}</strong></td></tr>`;
  });

  const grandTotal = colMeses.reduce((s, mk) => s + fo.reduce((ss, o) => ss + (o[mk+'_real']||0), 0), 0);
  html += `<tfoot><tr><td>TOTAL (${fo.length} obras)</td><td></td>`;
  colMeses.forEach(mk => { html += `<td>${fmtZ(fo.reduce((s,o)=>s+(o[mk+'_real']||0),0))}</td>`; });
  html += `<td>${fmtZ(grandTotal)}</td></tr></tfoot></table>`;
  document.getElementById('man-table-wrapper').innerHTML = html;
}

function openManPacotePanel() {
  const overlay = document.getElementById('kpi-overlay');
  const panel   = document.getElementById('kpi-panel');
  const tag     = document.getElementById('kpi-panel-tag');
  const title   = document.getElementById('kpi-panel-title');
  const body    = document.getElementById('kpi-panel-body');

  tag.innerHTML   = '🛠️ Pacote Anual Manutenção';
  title.textContent = 'Pacote Anual Atual — Composição e Doação';

  const doacao    = MAN_PACOTE_INICIAL - MAN_PACOTE;
  const pctDoacao = ((doacao / MAN_PACOTE_INICIAL) * 100).toFixed(2);

  body.innerHTML = `
    <div class="panel-section">
      <div class="panel-section-title">📐 Fórmula de Cálculo</div>
      <div style="background:var(--cinza-bg);border-radius:10px;padding:14px 16px;font-size:13px;line-height:2.2;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--cinza-borda);padding-bottom:8px;margin-bottom:8px;">
          <span style="color:var(--texto-suave)">Pacote Anual Inicial</span>
          <span style="font-weight:700;color:var(--azul)">${fmt(MAN_PACOTE_INICIAL)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--cinza-borda);padding-bottom:8px;margin-bottom:8px;">
          <span style="color:var(--texto-suave)">( − ) Doação para obra externa</span>
          <span style="font-weight:700;color:var(--vermelho)">− ${fmt(doacao)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;">
          <span style="font-weight:800;color:var(--azul);font-size:14px">= Pacote Anual Atual</span>
          <span style="font-weight:800;color:var(--azul);font-size:15px">${fmt(MAN_PACOTE)}</span>
        </div>
      </div>
    </div>

    <div class="panel-section">
      <div class="panel-section-title">🎁 Detalhamento da Doação</div>
      <div style="padding:12px 0;border-bottom:1px solid var(--cinza-borda)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div style="flex:1;padding-right:12px">
            <div style="font-size:13px;font-weight:700;color:var(--azul)">
              Ensino e Pesquisa Higienópolis (T.I + Recheio)
            </div>
            <div style="font-size:11px;color:var(--texto-suave);margin-top:4px">
              Valor doado do Pacote de Manutenção para esta obra
            </div>
          </div>
          <div style="font-size:16px;font-weight:800;color:var(--vermelho);white-space:nowrap">
            − ${fmt(doacao)}
          </div>
        </div>
        <div style="background:var(--cinza-borda);border-radius:4px;height:5px;">
          <div style="background:var(--vermelho);border-radius:4px;height:5px;width:${pctDoacao}%"></div>
        </div>
        <div style="font-size:10px;color:var(--texto-suave);margin-top:4px">
          ${pctDoacao}% do pacote inicial foi doado (${fmt(doacao)} de ${fmt(MAN_PACOTE_INICIAL)})
        </div>
      </div>
      <div style="margin-top:14px;padding:12px 14px;background:#fff5f5;border-radius:8px;border-left:3px solid var(--vermelho)">
        <div style="font-size:11px;color:var(--vermelho);font-weight:700;line-height:1.6">
          ⚠️ O saldo disponível para manutenção em 2026 é <strong>${fmt(MAN_PACOTE)}</strong>,
          não R$ 20.000.000,00 — em razão da doação de ${fmt(doacao)} realizada.
        </div>
      </div>
    </div>`;

  overlay.classList.add('open');
  panel.classList.add('open');
}

function renderManCharts() {
  const fo = manFilteredObras;
  const activeMons = manSelectedMonths.size > 0 ? [...manSelectedMonths] : null;

  // ── Gráfico de Linha Manutenção ───────────────────────────────
  const manMonthly = MAN_PACOTE / 12;
  const manPrevLine = MONTHS.map(m => {
    if (activeMons && !activeMons.includes(m.key)) return null;
    return manMonthly;
  });
  const manRealLine = MONTHS.map(m => {
    if (!MONTHS_REAL.includes(m.key)) return null;
    if (activeMons && !activeMons.includes(m.key)) return null;
    return fo.reduce((s, o) => s + (o[m.key+'_real']||0), 0);
  });


  // Eixo Y dinâmico: zoom no intervalo real dos dados (75% do min / 118% do max)
  const manRealVals = manRealLine.filter(v => v !== null && v > 0);
  const manAllVals  = [...manRealVals, manMonthly];
  const manYMin     = Math.max(0, Math.min(...manAllVals) * 0.75);
  const manYMax     = Math.max(...manAllVals) * 1.18;

  if (manChartLine) manChartLine.destroy();
  manChartLine = new Chart(document.getElementById('manChartLine'), {
    type: 'line',
    data: {
      labels: MONTHS.map(m=>m.label),
      datasets: [
        { label: 'Previsto (média mensal)', data: manPrevLine, borderColor: '#1a5ca8', backgroundColor: 'rgba(26,92,168,0.07)', fill: false, tension: 0.3, borderWidth: 2.5, spanGaps: false, pointRadius: 4 },
        { label: 'Realizado',               data: manRealLine, borderColor: '#e07020', backgroundColor: 'rgba(224,112,32,0.12)', fill: true,  tension: 0.3, borderWidth: 2.5, spanGaps: false, pointRadius: 5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
      },
      scales: {
        y: {
          min: manYMin,
          max: manYMax,
          ticks: { callback: v => fmt(v, true) },
          title: { display: true, text: 'Desembolso mensal (R$)', font: { size: 11 } }
        }
      }
    }
  });

  // ── Top 15 por Período Filtrado ───────────────────────────────
  // Calcula realizado apenas nos meses selecionados para o ranking
  const mesesBar = activeMons ? activeMons.filter(mk => MONTHS_REAL.includes(mk)) : MONTHS_REAL;
  const periodLabel = mesesBar.length > 0 ? mesesBar.map(m => m.toUpperCase()).join('+') + '/26' : 'Jan–Jun/26';
  const foComReal = fo.map(o => ({
    ...o,
    real_periodo: mesesBar.reduce((s, mk) => s + (o[mk+'_real']||0), 0)
  })).filter(o => o.real_periodo > 0);
  const top15 = [...foComReal].sort((a,b) => b.real_periodo - a.real_periodo).slice(0, 15);

  if (manChartBar) manChartBar.destroy();
  manChartBar = new Chart(document.getElementById('manChartBar'), {
    type: 'bar',
    data: {
      labels: top15.map(o => o.nome.substring(0, 40)),
      datasets: [{ label: `Realizado ${periodLabel}`, data: top15.map(o => o.real_periodo), backgroundColor: 'rgba(14,75,140,0.75)', borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } },
      scales: { x: { ticks: { callback: v => fmt(v, true) } } }
    }
  });
}

function renderManRisk() {
  const fo = manObras.filter(o => o.total_real > 0);
  const manMonthly = MAN_PACOTE / 12;
  let html = `<table class="risk-table">
    <thead><tr><th>Obra</th><th>Real Jan–Jun</th><th>% do Pacote</th><th>Status</th></tr></thead><tbody>`;
  fo.sort((a,b)=>b.total_real-a.total_real).slice(0, 20).forEach(o => {
    const pctPacote = (o.total_real / MAN_PACOTE) * 100;
    let badge, badgeCls;
    if (pctPacote < 2) { badge = '✅ Normal'; badgeCls = 'badge-ok'; }
    else if (pctPacote < 5) { badge = '⚠️ Atenção'; badgeCls = 'badge-atencao'; }
    else { badge = '🔴 Alto consumo'; badgeCls = 'badge-critico'; }
    html += `<tr><td>${o.nome}</td><td class="td-real">${fmt(o.total_real)}</td><td>${pctPacote.toFixed(2)}%</td><td><span class="${badgeCls}">${badge}</span></td></tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('man-risk-panel').innerHTML = html;
}

// ============================================================
// INIT
// ============================================================
renderMonthChips();
renderManMonthChips();
renderTipoCards();
applyFilter();
applyManFilter();