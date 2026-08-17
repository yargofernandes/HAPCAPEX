const APP_VERSION = '37.0.0';
const cfg = window.CAPEX_CONFIG || {};
const sb = window.supabase.createClient(
  cfg.supabaseUrl,
  cfg.supabasePublishableKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

let currentProfile = null;
let pendingImport = null;
let pendingImportPreview = null;
let pendingImportWorkbook = null;
let activeImportFilter = 'all';
let notificationsCache = [];
let activeNotificationFilter = 'unread';
let coreLoaded = false;
let usersCache = [];
let backupsCache = [];
let deferredInstallPrompt = null;
let desktopInstallHelpShown = false;

const monthKeys = [
  'jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez',
  'jan27','fev27','mar27','abr27','mai27','jun27','jul27'
];
const month2026Keys = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const $ = selector => document.querySelector(selector);
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const normalizeName = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toUpperCase().replace(/\s+/g, ' ');
const orderTokens = value => (String(value || '').match(/\d{8}/g) || []);
const fmtDate = value => {
  if (!value) return '-';
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

const baseline = window.HAP_ORIGINAL_BASELINE || { works: [], naoPlanejado: {}, constants: {} };
const baselineByName = new Map();
const baselineByOrder = new Map();
for (const work of baseline.works || []) {
  baselineByName.set(normalizeName(work.nome), work);
  for (const token of orderTokens(work.ordem)) {
    if (!baselineByOrder.has(token)) baselineByOrder.set(token, work);
  }
}
function findBaselineWork(item) {
  for (const token of orderTokens(item?.ordem)) {
    const match = baselineByOrder.get(token);
    if (match) return match;
  }
  return baselineByName.get(normalizeName(item?.nome)) || null;
}
function isMaintenancePackageName(name) {
  const normalized = normalizeName(name);
  return normalized.includes('PACOTE DE MANUTENCAO DIA A DIA');
}
function isOperName(name) {
  return /_OPER\s*$/i.test(String(name || '').trim());
}
function contingencyState(name, capex) {
  if (!/CONTIN?G/i.test(String(name || ''))) return 'active';
  return num(capex) > 0 ? 'partial' : 'full';
}
function normalizedContingencyName(name, state) {
  const base = String(name || '').replace(/\s*-\s*CONTIN?G[^-]*$/i, '').trim();
  if (state === 'partial') return `${base} - CONTING. PARCIAL`;
  if (state === 'full') return `${base} - CONTINGENCIADA`;
  return String(name || '').trim();
}

const fallbackFlowRules = [
  {code:'historical_baseline',name:'Fluxo histórico preservado',description:'Preserva o fluxo mensal validado da base histórica. Alterações de datas não redistribuem o fluxo enquanto esta regra estiver ativa.',selectable:true,default_params:{}},
  {code:'standard_15_75_10',name:'15 / 75 / 10',description:'15% no início, 75% durante a execução e 10% em duas parcelas de 5% após o término.',selectable:true,default_params:{}},
  {code:'rio_5_85_10',name:'5 / 85 / 10',description:'5% no início, 85% durante a execução e 10% em duas parcelas de 5% após o término.',selectable:true,default_params:{}},
  {code:'realized_equals_forecast',name:'Previsto = Realizado',description:'Nos meses importados, o previsto acompanha exatamente o realizado.',selectable:true,default_params:{}},
  {code:'oper_realized_plus_balance_dec',name:'Realizado + saldo futuro até Dez/26',description:'Preserva o realizado e distribui o saldo residual igualmente nos meses futuros até dezembro de 2026.',selectable:true,default_params:{}},
  {code:'contingency_full',name:'Contingenciamento total',description:'Previsto acompanha o realizado; não há saldo futuro planejado.',selectable:true,default_params:{}},
  {code:'contingency_partial_standard',name:'Contingenciamento parcial',description:'Preserva o realizado e programa o CAPEX residual nos meses futuros conforme os pesos 15/75/10.',selectable:true,default_params:{}},
  {code:'contingency_partial_hapfor',name:'Contingenciamento parcial — HAPFOR',description:'Preserva o realizado e distribui o CAPEX residual apenas nos meses futuros até outubro de 2026.',selectable:true,default_params:{}},
  {code:'single_payment',name:'Pagamento único',description:'Programa todo o CAPEX em um único mês.',selectable:true,default_params:{month:'jul'}},
  {code:'close_by_balance',name:'Encerramento pelo saldo',description:'Preserva realizados anteriores e lança o saldo no mês de encerramento para fechar exatamente o CAPEX.',selectable:true,default_params:{}},
  {code:'linear_year',name:'Linear Jan–Dez',description:'Distribui o CAPEX igualmente entre janeiro e dezembro de 2026.',selectable:true,default_params:{}}
];
function inferFlowRule(item, original, state) {
  if (item?.flow_rule) return String(item.flow_rule);
  if (item?.ordem === 'NAO_PLANEJADAS') return 'non_planned';
  if (isOperName(item?.nome)) return 'oper_realized_plus_balance_dec';
  if (state === 'full') return 'contingency_full';
  if (state === 'partial' && /HAPFOR/i.test(String(item?.nome||''))) return 'contingency_partial_hapfor';
  if (state === 'partial') return 'contingency_partial_standard';
  // Esta ordem preserva exatamente a execução V27: obras existentes no baseline
  // usam o fluxo histórico antes das exceções por nome.
  if (original) return 'historical_baseline';
  if (/Novo Hospital Rio de Janeiro/i.test(String(item?.nome||''))) return 'rio_5_85_10';
  if (/Adequa[cç][aã]o Regulat[oó]ria|Regulat[oó]ria/i.test(String(item?.nome||''))) return 'linear_year';
  if (/QUALIVIDA/i.test(String(item?.nome||''))) return 'single_payment';
  if (/Novo Hospital Atibaia/i.test(String(item?.nome||''))) return 'close_by_balance';
  if (/TEA Maciel/i.test(String(item?.nome||''))) return 'realized_equals_forecast';
  return 'standard_15_75_10';
}
function itemToRaw(item) {
  const original = item.categoria === 'obra' ? findBaselineWork(item) : null;
  const state = item.categoria === 'obra' ? contingencyState(item.nome, item.capex) : 'active';
  const isCurrentContingency = state !== 'active';
  const rule = item.categoria === 'obra' ? inferFlowRule(item, original, state) : null;
  const raw = {
    _id: item.id,
    nome: normalizedContingencyName(item.nome, state),
    ordem: item.categoria === 'manutencao' ? String(item.ordem || '').replace(/#\d+$/, '') : item.ordem,
    // A partir da V28, datas vigentes do Supabase são autoritativas e podem ser
    // replanejadas pelo administrador. O baseline permanece apenas como fonte
    // do fluxo histórico quando a regra da obra assim determinar.
    inicio: fmtDate(item.inicio),
    fim: fmtDate(item.fim),
    capex: num(item.capex),
    tipologia: item.tipologia || (item.categoria === 'manutencao' ? 'Manutenção' : 'Outros'),
    contingenciada: state === 'full',
    _contingencyState: state,
    _sourceOrder: Number.isFinite(Number(item.source_order)) ? Number(item.source_order) : (original?.sourceOrder ?? 999999),
    _baselineFlow: isCurrentContingency ? null : (original?.flow || null),
    _baselineCapex: original ? num(original.capex) : null,
    _isOriginalBaseline: Boolean(original) && !isCurrentContingency,
    _isOper: isOperName(item.nome),
    _flowRule: rule,
    _flowRulePersisted: Boolean(item.flow_rule),
    _flowRuleParams: item.flow_rule_params && typeof item.flow_rule_params === 'object' ? item.flow_rule_params : {},
    _manualOverrides: item.manual_overrides && typeof item.manual_overrides === 'object' ? item.manual_overrides : {},
    _sourceSnapshot: item.source_snapshot && typeof item.source_snapshot === 'object' ? item.source_snapshot : {},
    _dbInicio: item.inicio || null,
    _dbFim: item.fim || null
  };
  monthKeys.forEach(key => raw[key + '_real'] = num(item.realizado?.[key]));
  return raw;
}

function latestReportingMonth(items, naoPlanejado) {
  let latest = 'jan';
  month2026Keys.forEach(key => {
    const hasValue = items.some(item => num(item.realizado?.[key]) !== 0)
      || num(naoPlanejado?.[key]) !== 0;
    if (hasValue) latest = key;
  });
  return latest;
}
function mergeNaoPlanejado(item) {
  const result = {};
  monthKeys.forEach(key => {
    const stored = num(item?.realizado?.[key]);
    const fallback = num(baseline.naoPlanejado?.[key]);
    result[key] = stored !== 0 ? stored : fallback;
  });
  return result;
}

async function loadApp() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    $('#authGate').hidden = false;
    return;
  }

  const { data: profile, error: profileError } = await sb
    .from('profiles').select('*').eq('id', session.user.id).single();
  if (profileError || !profile?.is_active) {
    await sb.auth.signOut();
    $('#authGate').hidden = false;
    return;
  }

  currentProfile = profile;
  $('#authGate').hidden = true;
  $('#adminToolbar').hidden = false;
  $('#userLabel').textContent =
    (profile.full_name || profile.email) + ' · ' +
    (profile.role === 'admin' ? 'Administrador' : 'Visualizador');
  document.querySelectorAll('.admin-only').forEach(
    element => element.hidden = profile.role !== 'admin'
  );
  syncMobileActionPermissions();

  const [itemsResult, settingsResult, rulesResult] = await Promise.all([
    sb.from('capex_items').select('*').is('deleted_at', null),
    sb.from('capex_settings').select('*').eq('id', 'main').single(),
    sb.from('capex_flow_rules').select('*').order('sort_order', { ascending: true })
  ]);
  const { data: items, error: itemsError } = itemsResult;
  const { data: settings, error: settingsError } = settingsResult;
  if (itemsError) throw itemsError;
  if (settingsError) throw settingsError;
  const flowRules = rulesResult.error ? fallbackFlowRules : (rulesResult.data || fallbackFlowRules);

  const allItems = items || [];
  const nonPlannedItem = allItems.find(item =>
    item.categoria === 'obra' &&
    (item.ordem === 'NAO_PLANEJADAS' || /OBRAS NÃO PLANEJADAS/i.test(item.nome))
  );
  const naoPlanejado = mergeNaoPlanejado(nonPlannedItem);

  const obras = allItems
    .filter(item =>
      item.categoria === 'obra' &&
      item !== nonPlannedItem &&
      !isMaintenancePackageName(item.nome)
    )
    .map(itemToRaw)
    .sort((a, b) => a._sourceOrder - b._sourceOrder || a.nome.localeCompare(b.nome, 'pt-BR'));

  const manutencoes = allItems
    .filter(item => item.categoria === 'manutencao')
    .map(itemToRaw)
    .sort((a, b) => a._sourceOrder - b._sourceOrder || a.nome.localeCompare(b.nome, 'pt-BR'));

  const monthsReal = monthKeys.filter(key =>
    allItems.some(item => num(item.realizado?.[key]) !== 0) ||
    num(naoPlanejado[key]) !== 0
  );

  window.HAP_DATA = {
    obrasRaw: obras,
    manObrasRaw: manutencoes,
    naoPlanejado,
    monthsReal,
    reportingMonthKey: latestReportingMonth(allItems, naoPlanejado),
    settings: {
      ...settings,
      capex_inicial: num(settings?.capex_inicial) || num(baseline.constants?.CAPEX_INICIAL)
    },
    flowRules,
    currentProfile: profile
  };
  window.HAP_STATE_ITEMS = allItems;

  if (profile.role === 'admin') void persistMissingFlowRules(obras);
  void refreshCalendarNotifications().then(loadNotifications).catch(() => loadNotifications());

  $('#dashboardRoot').hidden = false;
  if (!coreLoaded) {
    coreLoaded = true;
    const script = document.createElement('script');
    script.src = 'dashboard-core.js?v=' + Date.now();
    script.onload = () => {
      const v36CurveAddon = document.createElement('script');
      v36CurveAddon.src = 'v36-curve-addon.js?v=37.0';
      const finishCurveBoot = () => {
        applyMobileAppMode();
        initMobileAppShell();
      };
      v36CurveAddon.onload = finishCurveBoot;
      v36CurveAddon.onerror = finishCurveBoot;
      document.body.appendChild(v36CurveAddon);
    };
    document.body.appendChild(script);
  }

  // O backup é criado no servidor e não depende do conteúdo da memória do navegador.
  // A função do banco impede mais de uma versão automática dentro de 24 horas.
  void ensureAutomaticBackup();
}

$('#loginForm').onsubmit = async event => {
  event.preventDefault();
  $('#loginMsg').textContent = 'Entrando...';
  const form = event.currentTarget;
  const { error } = await sb.auth.signInWithPassword({
    email: form.email.value.trim(),
    password: form.password.value
  });
  if (error) {
    $('#loginMsg').textContent = 'E-mail ou senha inválidos.';
    return;
  }
  location.reload();
};
$('#logoutBtn').onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }
document.querySelectorAll('[data-close]').forEach(
  button => button.onclick = () => closeModal(button.dataset.close)
);
$('#importBtn').onclick = () => {
  if (currentProfile?.role === 'admin') openModal('importModal');
};
const legacySettingsBtn = $('#settingsBtn');
if (legacySettingsBtn) legacySettingsBtn.onclick = () => {
  if (currentProfile?.role !== 'admin') return;
  fillSettings();
  openModal('settingsModal');
};
$('#usersBtn').onclick = async () => {
  if (currentProfile?.role !== 'admin') return;
  openModal('usersModal');
  await loadUsers();
};
$('#backupBtn').onclick = async () => {
  if (currentProfile?.role !== 'admin') return;
  openModal('backupModal');
  await loadBackups();
};

function xdate(value) {
  if (!value || value === '-') return null;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return date
      ? `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
      : null;
  }
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match
    ? `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`
    : null;
}
function normalizeOrder(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value).trim();
  }
  return String(value || '').trim();
}
function simpleHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}
function findSheet(workbook, expectedName) {
  return workbook.SheetNames.find(
    name => normalizeName(name) === normalizeName(expectedName)
  );
}
function isContingenciada(name) {
  return /CONTIN?G/i.test(String(name || ''));
}
function parseExcel(workbook, scope = 'all') {
  const result = [];
  result.issues = [];
  let ignored = 0;
  const needWorks = scope !== 'maintenance';
  const needMaintenance = scope !== 'works';
  const planningSheet = findSheet(workbook, 'PLANEJAMENTO');
  const maintenanceSheet = findSheet(workbook, 'OBRAS MANUTENÇÃO');

  if (needWorks && !planningSheet) {
    throw new Error('A aba PLANEJAMENTO não foi encontrada.');
  }
  if (needMaintenance && !maintenanceSheet) {
    throw new Error('A aba OBRAS MANUTENÇÃO não foi encontrada.');
  }

  if (needWorks) {
    let rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[planningSheet],
      { header: 1, defval: '', raw: true }
    );
    let header = rows.findIndex(row =>
      normalizeName(row[0]).includes('ORDEM INTERNA') &&
      normalizeName(row[1]).includes('NOME OBRA')
    );
    if (header < 0) throw new Error('Cabeçalho da aba PLANEJAMENTO não encontrado.');

    for (let index = header + 1; index < rows.length; index++) {
      const row = rows[index];
      const nome = String(row[1] || '').trim();
      if (!nome) continue;

      if (isMaintenancePackageName(nome)) {
        ignored++;
        continue;
      }

      const isNonPlanned = /OBRAS NÃO PLANEJADAS/i.test(nome);
      const ordem = isNonPlanned ? 'NAO_PLANEJADAS' : normalizeOrder(row[0]);
      if (!ordem) {
        result.issues.push({ field:'ordem', value:row[0], message:`Linha ${index+1} da aba ${planningSheet} possui nome de obra, mas não possui OI válida.`, location:{sheet:planningSheet,row:index+1,cell:XLSX.utils.encode_cell({r:index,c:0})} });
        continue;
      }

      const realizado = {};
      monthKeys.forEach((key, monthIndex) => {
        realizado[key] = num(row[5 + monthIndex]);
      });

      const capex = num(row[4]);
      const state = isNonPlanned ? 'active' : contingencyState(nome, capex);
      result.push({
        categoria: 'obra',
        ordem,
        nome: normalizedContingencyName(nome, state),
        inicio: xdate(row[2]),
        fim: xdate(row[3]),
        capex,
        // A planilha PLANEJAMENTO não é fonte da tipologia na importação V28;
        // manteremos o valor cadastrado no HAPCAPEX para registros existentes.
        tipologia: null,
        contingenciada: state === 'full',
        realizado,
        source_order: index - header,
        _excel: {
          sheet: planningSheet,
          row: index + 1,
          fields: {
            ordem: { column: 0, cell: XLSX.utils.encode_cell({r:index,c:0}) },
            nome: { column: 1, cell: XLSX.utils.encode_cell({r:index,c:1}) },
            inicio: { column: 2, cell: XLSX.utils.encode_cell({r:index,c:2}) },
            fim: { column: 3, cell: XLSX.utils.encode_cell({r:index,c:3}) },
            capex: { column: 4, cell: XLSX.utils.encode_cell({r:index,c:4}) }
          }
        }
      });
      const last = result[result.length - 1];
      monthKeys.slice(0, 12).forEach((key, monthIndex) => {
        last._excel.fields['realizado.' + key] = { column: 5 + monthIndex, cell: XLSX.utils.encode_cell({r:index,c:5+monthIndex}) };
      });
    }
  }

  if (needMaintenance) {
    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[maintenanceSheet],
      { header: 1, defval: '', raw: true }
    );

    // A aba de Manutenção começa na coluna C. O SheetJS elimina as colunas
    // vazias anteriores ao intervalo usado, então C e D podem chegar como
    // índices 0 e 1. Por isso os cabeçalhos são localizados pelo texto, sem
    // depender de posições fixas.
    let header = -1;
    let orderCol = -1;
    let nameCol = -1;
    const monthCols = {};
    const monthAliases = {
      JAN: 'jan', FEV: 'fev', MAR: 'mar', ABR: 'abr', MAI: 'mai', JUN: 'jun',
      JUL: 'jul', AGO: 'ago', SET: 'set', OUT: 'out', NOV: 'nov', DEZ: 'dez'
    };

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const normalizedRow = (rows[rowIndex] || []).map(normalizeName);
      const currentOrderCol = normalizedRow.findIndex(value => value.includes('ORDEM INTERNA'));
      const currentNameCol = normalizedRow.findIndex(value => value.includes('NOME DA OBRA'));
      if (currentOrderCol >= 0 && currentNameCol >= 0) {
        header = rowIndex;
        orderCol = currentOrderCol;
        nameCol = currentNameCol;
        normalizedRow.forEach((value, colIndex) => {
          const key = monthAliases[value];
          if (key) monthCols[key] = colIndex;
        });
        break;
      }
    }

    const missingMonths = month2026Keys.filter(key => !Number.isInteger(monthCols[key]));
    if (header < 0 || orderCol < 0 || nameCol < 0 || missingMonths.length > 0) {
      const detail = missingMonths.length
        ? ` Meses não identificados: ${missingMonths.map(key => key.toUpperCase()).join(', ')}.`
        : '';
      throw new Error(`Cabeçalho da aba OBRAS MANUTENÇÃO não encontrado.${detail}`);
    }

    // Algumas planilhas possuem a mesma OI repetida em linhas distintas.
    // O sufixo é apenas interno e é removido antes de exibir a OI no dashboard.
    const orderOccurrences = new Map();

    for (let index = header + 1; index < rows.length; index++) {
      const row = rows[index] || [];
      const nome = String(row[nameCol] || '').trim();
      if (!nome) continue;

      const ordemOriginal = normalizeOrder(row[orderCol]);
      const baseOrder = ordemOriginal || `SEM_OI_${simpleHash(normalizeName(nome))}`;
      const occurrence = (orderOccurrences.get(baseOrder) || 0) + 1;
      orderOccurrences.set(baseOrder, occurrence);
      const ordem = occurrence === 1 ? baseOrder : `${baseOrder}#${occurrence}`;

      const realizado = {};
      month2026Keys.forEach(key => {
        realizado[key] = num(row[monthCols[key]]);
      });

      result.push({
        categoria: 'manutencao',
        ordem,
        nome,
        inicio: null,
        fim: null,
        capex: 0,
        tipologia: 'Manutenção',
        contingenciada: false,
        realizado,
        source_order: index - header,
        _excel: {
          sheet: maintenanceSheet,
          row: index + 1,
          fields: {
            ordem: { column: orderCol, cell: XLSX.utils.encode_cell({r:index,c:orderCol}) },
            nome: { column: nameCol, cell: XLSX.utils.encode_cell({r:index,c:nameCol}) }
          }
        }
      });
      const last = result[result.length - 1];
      month2026Keys.forEach(key => {
        const col = monthCols[key];
        last._excel.fields['realizado.' + key] = { column: col, cell: XLSX.utils.encode_cell({r:index,c:col}) };
      });
    }
  }

  result.ignoredCount = ignored;
  result.importScope = scope;
  return result;
}
function sameRecord(existing, incoming) {
  if (existing.categoria !== incoming.categoria) return false;
  // Manutenção usa a chave interna da linha. Isso preserva OIs repetidas
  // existentes no Excel sem misturar ou sobrescrever obras diferentes.
  if (existing.categoria === 'manutencao') {
    return existing.ordem === incoming.ordem;
  }
  if (existing.ordem === incoming.ordem) return true;
  const existingTokens = new Set(orderTokens(existing.ordem));
  if (orderTokens(incoming.ordem).some(token => existingTokens.has(token))) return true;
  return normalizeName(existing.nome) === normalizeName(incoming.nome);
}
function findExistingRecord(existingItems, incoming) {
  return existingItems.find(existing => sameRecord(existing, incoming));
}

$('#importScope')?.addEventListener('change', () => {
  pendingImport = null;
  $('#excelFile').value = '';
  $('#importStatus').textContent = 'Selecione novamente a planilha para validar o modo escolhido.';
  const check = $('#importCheck');
  if (check) { check.hidden = true; check.innerHTML = ''; }
  $('#applyImport').disabled = true;
});

$('#excelFile').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true
    });
    const importScope = $('#importScope')?.value || 'all';
    pendingImport = parseExcel(workbook, importScope);
    const obrasCount = pendingImport.filter(
      item => item.categoria === 'obra' && item.ordem !== 'NAO_PLANEJADAS'
    ).length;
    const maintenanceCount = pendingImport.filter(
      item => item.categoria === 'manutencao'
    ).length;
    const hasNonPlanned = pendingImport.some(item => item.ordem === 'NAO_PLANEJADAS');
    const partialCount = pendingImport.filter(item =>
      item.categoria === 'obra' && item.nome.includes('CONTING. PARCIAL')
    ).length;
    const fullCount = pendingImport.filter(item =>
      item.categoria === 'obra' && item.contingenciada
    ).length;
    const operCount = pendingImport.filter(item =>
      item.categoria === 'obra' && isOperName(item.nome)
    ).length;
    const scopeLabel = pendingImport.importScope === 'maintenance'
      ? 'Somente Manutenção'
      : pendingImport.importScope === 'works' ? 'Somente Obras' : 'Obras e Manutenção';
    const statusParts = [`Modo: ${scopeLabel}.`];
    if (pendingImport.importScope !== 'maintenance') {
      statusParts.push(`${obrasCount} obras`);
      statusParts.push(`${hasNonPlanned ? '1 linha' : 'nenhuma linha'} de Obras Não Planejadas`);
      statusParts.push(`${partialCount} contingenciamentos parciais e ${fullCount} totais`);
      statusParts.push(`${operCount} obras _OPER com realizado preservado e saldo distribuído até dez/26`);
      if (pendingImport.ignoredCount) statusParts.push(`${pendingImport.ignoredCount} linha de pacote ignorada`);
    }
    if (pendingImport.importScope !== 'works') {
      statusParts.push(`${maintenanceCount} linhas de manutenção`);
    }
    $('#importStatus').textContent = statusParts.join(' · ') + '.';
    const check = $('#importCheck');
    if (check) {
      check.hidden = false;
      check.innerHTML = pendingImport.importScope !== 'works'
        ? `<strong>Conferência da Manutenção</strong><span>${maintenanceCount} linhas reconhecidas</span><span>Esperado nesta planilha: 113 linhas</span><span>${maintenanceCount === 113 ? '✅ Quantidade conferida' : '⚠️ Quantidade diferente da planilha-base'}</span>`
        : '<strong>Conferência</strong><span>Importação restrita à aba Obras.</span>';
    }
    $('#applyImport').disabled = pendingImport.importScope !== 'works' && maintenanceCount === 0;
  } catch (error) {
    pendingImport = null;
    $('#importStatus').textContent = 'Erro: ' + error.message;
    $('#applyImport').disabled = true;
  }
};

$('#applyImport').onclick = async () => {
  if (!pendingImport || currentProfile?.role !== 'admin') return;
  $('#applyImport').disabled = true;
  $('#importStatus').textContent = 'Atualizando banco...';

  try {
    const importFileName = $('#excelFile').files[0]?.name || 'planilha.xlsx';
    $('#importStatus').textContent = 'Criando backup de segurança antes da importação...';
    await createServerBackup('manual', true, `Antes da importação: ${importFileName}`);
    $('#importStatus').textContent = 'Backup criado. Atualizando banco...';

    let created = 0;
    let updated = 0;
    let archived = 0;
    const seenMaintenanceIds = new Set();
    const { data: existingItems, error: existingError } = await sb
      .from('capex_items')
      .select('id,categoria,ordem,nome')
      .is('deleted_at', null);
    if (existingError) throw existingError;

    const existing = existingItems || [];
    for (const item of pendingImport) {
      const found = findExistingRecord(existing, item);
      const payload = {
        ...item,
        updated_by: currentProfile.id,
        updated_at: new Date().toISOString()
      };
      if (found) {
        const { error } = await sb.from('capex_items').update(payload).eq('id', found.id);
        if (error) throw error;
        if (item.categoria === 'manutencao') seenMaintenanceIds.add(found.id);
        updated++;
      } else {
        const { data: inserted, error } = await sb.from('capex_items')
          .insert({ ...payload, created_by: currentProfile.id })
          .select('id,categoria,ordem,nome').single();
        if (error) throw error;
        existing.push(inserted);
        if (item.categoria === 'manutencao') seenMaintenanceIds.add(inserted.id);
        created++;
      }
    }

    // A aba OBRAS MANUTENÇÃO é uma fotografia mensal completa. Ao importá-la,
    // linhas antigas que não aparecem mais na planilha são arquivadas para que
    // a tela permaneça exatamente igual ao Excel vigente.
    if (pendingImport.importScope !== 'works') {
      const staleMaintenanceIds = (existingItems || [])
        .filter(item => item.categoria === 'manutencao' && !seenMaintenanceIds.has(item.id))
        .map(item => item.id);
      if (staleMaintenanceIds.length) {
        const { error: archiveError } = await sb.from('capex_items')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: currentProfile.id,
            updated_by: currentProfile.id,
            updated_at: new Date().toISOString()
          })
          .in('id', staleMaintenanceIds);
        if (archiveError) throw archiveError;
        archived = staleMaintenanceIds.length;
      }
    }

    await sb.from('capex_items')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentProfile.id,
        updated_by: currentProfile.id
      })
      .eq('categoria', 'obra')
      .ilike('nome', '%Pacote de Manutenção dia a dia%')
      .is('deleted_at', null);

    await sb.from('import_history').insert({
      file_name: $('#excelFile').files[0]?.name || 'planilha.xlsx',
      total_records: pendingImport.length,
      created_records: created,
      updated_records: updated,
      ignored_records: pendingImport.ignoredCount || 0,
      imported_by: currentProfile.id,
      status: 'completed'
    });

    $('#importStatus').textContent =
      `Concluído: ${created} criados, ${updated} atualizados, ${archived} arquivados e ` +
      `${pendingImport.ignoredCount || 0} ignorados. A página será recarregada.`;
    setTimeout(() => location.reload(), 1200);
  } catch (error) {
    $('#importStatus').textContent = 'Falha: ' + error.message;
    $('#applyImport').disabled = false;
  }
};


const brlValue=v=>num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let settingsDraft={conting:[],aportes:[]};
function cleanDetail(list){return (Array.isArray(list)?list:[]).map(x=>({nome:String(x?.nome||'').trim(),valor:num(x?.valor),mes:String(x?.mes||'').trim()})).filter(x=>x.nome||x.valor)}
function currentMonthKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function makeDetailRow(type,item={nome:'',valor:0,mes:currentMonthKey()}){
 const row=document.createElement('div');row.className='detail-row';row.dataset.type=type;
 row.innerHTML=`<input class="detail-name" type="text" maxlength="300" placeholder="Descrição" value="${String(item.nome||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}"><input class="detail-month" type="month" min="2026-01" value="${String(item.mes||'')}" title="Mês do lançamento"><div class="money-input"><span>R$</span><input class="detail-value" type="number" min="0" step="0.01" value="${num(item.valor).toFixed(2)}"></div><button type="button" class="remove-row" title="Excluir linha">🗑️</button>`;
 row.querySelector('.remove-row').onclick=()=>{row.remove();syncDraftAndTotals()};
 row.querySelectorAll('input').forEach(i=>i.addEventListener('input',syncDraftAndTotals));
 return row;
}
function renderDetailRows(type,items){const box=$(type==='conting'?'#contingRows':'#aporteRows');box.innerHTML='';items.forEach(x=>box.appendChild(makeDetailRow(type,x)));if(!items.length)box.innerHTML='<div class="empty-detail">Nenhuma linha cadastrada.</div>'}
function readRows(type){const box=$(type==='conting'?'#contingRows':'#aporteRows');return [...box.querySelectorAll('.detail-row')].map(r=>({nome:r.querySelector('.detail-name').value.trim(),mes:r.querySelector('.detail-month').value,valor:num(r.querySelector('.detail-value').value)})).filter(x=>x.nome||x.valor)}
function syncDraftAndTotals(){settingsDraft.conting=readRows('conting');settingsDraft.aportes=readRows('aportes');const s=window.HAP_DATA.settings,ci=num(s.capex_inicial),ct=settingsDraft.conting.reduce((a,x)=>a+num(x.valor),0),ap=settingsDraft.aportes.reduce((a,x)=>a+num(x.valor),0),at=ci+ap-ct;$('#sumCapexInicial').textContent=brlValue(ci);$('#sumAportes').textContent=brlValue(ap);$('#sumConting').textContent=brlValue(ct);$('#sumCapexAtual').textContent=brlValue(at)}
function fillSettings(){const s=window.HAP_DATA.settings;settingsDraft={conting:cleanDetail(s.conting_detalhe),aportes:cleanDetail(s.aportes_detalhe)};renderDetailRows('conting',settingsDraft.conting);renderDetailRows('aportes',settingsDraft.aportes);syncDraftAndTotals()}
$('#addContingRow').onclick=()=>{const e=$('#contingRows .empty-detail');if(e)e.remove();$('#contingRows').appendChild(makeDetailRow('conting'));syncDraftAndTotals()};
$('#addAporteRow').onclick=()=>{const e=$('#aporteRows .empty-detail');if(e)e.remove();$('#aporteRows').appendChild(makeDetailRow('aportes'));syncDraftAndTotals()};
$('#settingsForm').onsubmit = async event => {
  event.preventDefault();
  if (currentProfile?.role !== 'admin') return;
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    syncDraftAndTotals();
    await createServerBackup('manual', true, 'Antes da alteração de contingenciamentos e aportes');
    const settings = window.HAP_DATA.settings;
    const capex_conting = settingsDraft.conting.reduce((sum, item) => sum + num(item.valor), 0);
    const capex_aportes = settingsDraft.aportes.reduce((sum, item) => sum + num(item.valor), 0);
    const payload = {
      id: 'main',
      capex_inicial: num(settings.capex_inicial),
      capex_conting,
      capex_aportes,
      manutencao_inicial: num(settings.manutencao_inicial),
      manutencao_atual: num(settings.manutencao_atual),
      conting_detalhe: settingsDraft.conting,
      aportes_detalhe: settingsDraft.aportes,
      updated_by: currentProfile.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from('capex_settings').upsert(payload);
    if (error) throw error;
    location.reload();
  } catch (error) {
    alert('Não foi possível salvar: ' + (error.message || String(error)));
  } finally {
    submit.disabled = false;
  }
};


function formatBackupDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
function formatBytes(value) {
  const bytes = num(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function backupTypeLabel(type) {
  return type === 'automatic' ? 'Automático'
    : type === 'pre_restore' ? 'Pré-restauração'
    : 'Manual';
}
function safeFileTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function createServerBackup(type = 'automatic', force = false, label = null) {
  const { data, error } = await sb.rpc('create_capex_backup', {
    p_type: type,
    p_force: force,
    p_label: label
  });
  if (error) throw error;
  return data || {};
}
async function ensureAutomaticBackup() {
  try {
    const result = await createServerBackup('automatic', false, 'Backup diário automático');
    const button = $('#backupBtn');
    if (button) {
      button.title = result?.created
        ? `Backup automático criado em ${formatBackupDate(result.created_at)}`
        : `Backup diário já existente: ${formatBackupDate(result.created_at)}`;
    }
  } catch (error) {
    console.warn('Backup automático não pôde ser criado:', error);
  }
}
async function loadBackups() {
  if (currentProfile?.role !== 'admin') return;
  const body = $('#backupsTableBody');
  const status = $('#backupStatus');
  body.innerHTML = '<tr><td colspan="6">Carregando backups...</td></tr>';
  status.className = 'backup-status';
  status.textContent = '';
  const { data, error } = await sb.rpc('list_capex_backups');
  if (error) {
    body.innerHTML = `<tr><td colspan="6" class="user-error">${esc(error.message)}</td></tr>`;
    return;
  }
  backupsCache = Array.isArray(data) ? data : [];
  renderBackups();
}
function renderBackups() {
  const body = $('#backupsTableBody');
  if (!backupsCache.length) {
    body.innerHTML = '<tr><td colspan="6">Nenhum backup encontrado.</td></tr>';
    return;
  }
  body.innerHTML = backupsCache.map(backup => `
    <tr>
      <td><strong>${esc(formatBackupDate(backup.created_at))}</strong><small>${esc(backup.label || backup.checksum?.slice(0, 12) || '')}</small></td>
      <td><span class="backup-type ${esc(backup.backup_type)}">${esc(backupTypeLabel(backup.backup_type))}</span></td>
      <td>${num(backup.item_count).toLocaleString('pt-BR')}</td>
      <td>${esc(formatBytes(backup.size_bytes))}</td>
      <td>${esc(backup.created_by_name || backup.created_by_email || 'Sistema')}</td>
      <td><div class="backup-row-actions">
        <button type="button" data-backup-action="download" data-backup-id="${esc(backup.id)}">Baixar JSON</button>
        <button type="button" class="danger" data-backup-action="restore" data-backup-id="${esc(backup.id)}">Restaurar</button>
      </div></td>
    </tr>`).join('');
  body.querySelectorAll('[data-backup-action]').forEach(button => {
    button.onclick = () => handleBackupAction(button);
  });
}
async function handleBackupAction(button) {
  if (currentProfile?.role !== 'admin') return;
  const id = button.dataset.backupId;
  const action = button.dataset.backupAction;
  const backup = backupsCache.find(item => item.id === id);
  const status = $('#backupStatus');
  button.disabled = true;
  try {
    if (action === 'download') {
      status.textContent = 'Preparando arquivo JSON do backup...';
      const { data, error } = await sb.rpc('get_capex_backup_state', { p_backup_id: id });
      if (error) throw error;
      downloadJson(data, `hapcapex_backup_${safeFileTimestamp(backup?.created_at)}.json`);
      status.className = 'backup-status success';
      status.textContent = 'Arquivo do backup gerado com sucesso.';
      return;
    }
    if (action === 'restore') {
      const dateLabel = formatBackupDate(backup?.created_at);
      const confirmed = confirm(
        `Restaurar o estado de ${dateLabel}?\n\n` +
        'Os dados financeiros atuais serão substituídos. Antes disso, o sistema criará automaticamente um backup do estado atual.'
      );
      if (!confirmed) return;
      status.className = 'backup-status';
      status.textContent = 'Restaurando backup. Não feche esta página...';
      const { data, error } = await sb.rpc('restore_capex_backup', { p_backup_id: id });
      if (error) throw error;
      status.className = 'backup-status success';
      status.textContent = `${num(data?.restored_items)} registros restaurados. Recarregando...`;
      setTimeout(() => location.reload(), 1200);
    }
  } catch (error) {
    status.className = 'backup-status error';
    status.textContent = error.message || String(error);
  } finally {
    button.disabled = false;
  }
}
$('#createBackupBtn').onclick = async () => {
  if (currentProfile?.role !== 'admin') return;
  const button = $('#createBackupBtn');
  const status = $('#backupStatus');
  button.disabled = true;
  status.className = 'backup-status';
  status.textContent = 'Criando backup manual...';
  try {
    await createServerBackup('manual', true, 'Backup manual pelo aplicativo');
    status.className = 'backup-status success';
    status.textContent = 'Backup manual criado com sucesso.';
    await loadBackups();
  } catch (error) {
    status.className = 'backup-status error';
    status.textContent = error.message || String(error);
  } finally {
    button.disabled = false;
  }
};
$('#exportBackupBtn').onclick = async () => {
  if (currentProfile?.role !== 'admin') return;
  const button = $('#exportBackupBtn');
  const status = $('#backupStatus');
  button.disabled = true;
  status.className = 'backup-status';
  status.textContent = 'Montando o backup completo...';
  try {
    const { data, error } = await sb.rpc('export_capex_state');
    if (error) throw error;
    downloadJson(data, `hapcapex_backup_completo_${safeFileTimestamp()}.json`);
    status.className = 'backup-status success';
    status.textContent = 'Backup completo exportado. Senhas não fazem parte do arquivo.';
  } catch (error) {
    status.className = 'backup-status error';
    status.textContent = error.message || String(error);
  } finally {
    button.disabled = false;
  }
};
$('#refreshBackupsBtn').onclick = () => loadBackups();

function isPwaStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isDesktopDevice() {
  return !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) && window.matchMedia('(min-width: 700px)').matches;
}
function updateInstallButton() {
  const button = $('#installPwaBtn');
  if (!button) return;
  button.hidden = isPwaStandalone();
  button.textContent = isDesktopDevice() ? '🖥️ Instalar no computador' : '📲 Instalar app';
  button.title = isDesktopDevice()
    ? 'Instalar o HAPCAPEX como aplicativo independente no computador'
    : 'Instalar o HAPCAPEX neste dispositivo';
}
function showDesktopInstallHelp(installed = false) {
  if (!isDesktopDevice()) return;
  const steps = $('#pwaInstallSteps');
  const text = $('#pwaInstallText');
  if (!steps || !text) return;
  text.textContent = installed
    ? 'O HAPCAPEX foi instalado como aplicativo. Finalize os atalhos do Windows.'
    : 'Instale o HAPCAPEX como aplicativo independente no computador.';
  steps.innerHTML = `
    <ol>
      <li>Confirme a instalação exibida pelo Chrome ou Edge.</li>
      <li>Abra o HAPCAPEX instalado. Ele funcionará em uma janela própria, sem abas do navegador.</li>
      <li>Com o aplicativo aberto, clique com o botão direito no ícone da barra de tarefas e escolha <strong>Fixar na barra de tarefas</strong>.</li>
      <li>Para criar o ícone na área de trabalho, procure <strong>HAPCAPEX</strong> no menu Iniciar, clique com o botão direito, abra o local do arquivo e envie o atalho para a Área de Trabalho. No Edge, a tela após a instalação também pode oferecer essa opção diretamente.</li>
    </ol>
    <div class="pwa-desktop-note">Por segurança, navegadores e Windows exigem confirmação do usuário para criar ou fixar atalhos. O site não pode executar essa etapa silenciosamente.</div>`;
  desktopInstallHelpShown = installed;
  openModal('pwaInstallModal');
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallButton();
  if (isDesktopDevice() && !desktopInstallHelpShown) {
    setTimeout(() => showDesktopInstallHelp(true), 500);
  }
});
$('#installPwaBtn').onclick = async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButton();
    if (choice?.outcome === 'accepted' && isDesktopDevice()) {
      setTimeout(() => showDesktopInstallHelp(true), 700);
    }
    return;
  }
  const steps = $('#pwaInstallSteps');
  if (isIosDevice()) {
    $('#pwaInstallText').textContent = 'No iPhone ou iPad, a instalação é feita pelo menu de compartilhamento do Safari.';
    steps.innerHTML = '<ol><li>Abra este site no Safari.</li><li>Toque no botão Compartilhar.</li><li>Escolha “Adicionar à Tela de Início”.</li><li>Confirme em “Adicionar”.</li></ol>';
    openModal('pwaInstallModal');
  } else if (isDesktopDevice()) {
    showDesktopInstallHelp(false);
  } else {
    $('#pwaInstallText').textContent = 'Use o menu do navegador para instalar o HAPCAPEX como aplicativo.';
    steps.innerHTML = '<ol><li>Abra o menu do navegador.</li><li>Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</li><li>Confirme a instalação.</li></ol>';
    openModal('pwaInstallModal');
  }
};
async function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js?v=35', { scope: './' });
    registration.update().catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  } catch (error) {
    console.warn('Não foi possível registrar o PWA:', error);
  }
}
updateInstallButton();
window.addEventListener('load', registerPwaServiceWorker);

async function invokeUserAdmin(payload){
 if(currentProfile?.role!=='admin')throw new Error('Somente administradores podem gerenciar usuários.');
 const {data,error}=await sb.functions.invoke('manage-capex-users',{body:payload});
 if(error){
  let message=error.message||'Não foi possível concluir a operação.';
  try{const body=await error.context?.json();if(body?.error)message=body.error}catch{}
  throw new Error(message);
 }
 if(data?.error)throw new Error(data.error);
 return data;
}
async function loadUsers(){
 if(currentProfile?.role!=='admin')return;
 const body=$('#usersTableBody');body.innerHTML='<tr><td colspan="4">Carregando usuários...</td></tr>';
 const {data,error}=await sb.from('profiles').select('id,email,full_name,role,is_active,created_at').order('full_name',{ascending:true});
 if(error){body.innerHTML=`<tr><td colspan="4" class="user-error">${esc(error.message)}</td></tr>`;return}
 usersCache=data||[];renderUsers();
}
function renderUsers(){
 const body=$('#usersTableBody');
 if(!usersCache.length){body.innerHTML='<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>';return}
 body.innerHTML=usersCache.map(u=>{
  const isSelf=u.id===currentProfile?.id;
  const roleLabel=u.role==='admin'?'Administrador':'Visualizador';
  const statusLabel=u.is_active?'Ativo':'Bloqueado';
  const roleAction=u.role==='admin'?'viewer':'admin';
  const roleButton=u.role==='admin'?'Tornar visualizador':'Tornar administrador';
  return `<tr>
   <td><strong>${esc(u.full_name||'Sem nome')}</strong><small>${esc(u.email||'')}</small>${isSelf?'<span class="self-badge">Sua conta</span>':''}</td>
   <td><span class="role-pill ${u.role==='admin'?'role-admin':'role-viewer'}">${roleLabel}</span></td>
   <td><span class="status-pill ${u.is_active?'active':'blocked'}">${statusLabel}</span></td>
   <td><div class="user-actions">
    <button type="button" data-user-action="role" data-user-id="${esc(u.id)}" data-role="${roleAction}" ${isSelf?'disabled':''}>${roleButton}</button>
    <button type="button" data-user-action="active" data-user-id="${esc(u.id)}" data-active="${u.is_active?'false':'true'}" ${isSelf?'disabled':''}>${u.is_active?'Bloquear':'Ativar'}</button>
    <button type="button" data-user-action="password" data-user-id="${esc(u.id)}" ${isSelf?'disabled':''}>Alterar senha</button>
   </div></td>
  </tr>`;
 }).join('');
 body.querySelectorAll('[data-user-action]').forEach(btn=>btn.onclick=()=>handleUserAction(btn));
}
async function handleUserAction(btn){
 const action=btn.dataset.userAction,userId=btn.dataset.userId;
 if(!userId||currentProfile?.role!=='admin')return;
 btn.disabled=true;
 try{
  if(action==='role'){
   const role=btn.dataset.role;
   const label=role==='admin'?'administrador':'visualizador';
   if(!confirm(`Alterar este usuário para ${label}? A sessão dele será encerrada.`))return;
   await invokeUserAdmin({action:'set_role',user_id:userId,role});
  }else if(action==='active'){
   const isActive=btn.dataset.active==='true';
   if(!confirm(isActive?'Reativar este usuário?':'Bloquear este usuário e encerrar a sessão dele?'))return;
   await invokeUserAdmin({action:'set_active',user_id:userId,is_active:isActive});
  }else if(action==='password'){
   const target=usersCache.find(u=>u.id===userId);
   $('#passwordUserId').value=userId;
   $('#passwordUserLabel').textContent=`Defina uma nova senha para ${target?.full_name||target?.email||'o usuário'}.`;
   $('#resetUserPassword').value='';
   $('#resetUserPassword').type='password';
   const toggle=document.querySelector('[data-password-target="resetUserPassword"]');if(toggle)toggle.textContent='Mostrar';
   $('#passwordFormStatus').className='user-status';$('#passwordFormStatus').textContent='';
   openModal('passwordModal');
   return;
  }
  await loadUsers();
 }catch(err){alert(err.message||String(err))}finally{btn.disabled=false}
}
$('#refreshUsersBtn').onclick=()=>loadUsers();

document.querySelectorAll('[data-password-target]').forEach(btn=>{
 btn.onclick=()=>{const input=document.getElementById(btn.dataset.passwordTarget);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Ocultar':'Mostrar'};
});
$('#passwordForm').onsubmit=async e=>{
 e.preventDefault();
 if(currentProfile?.role!=='admin')return;
 const form=e.currentTarget,userId=form.user_id.value,password=form.password.value,status=$('#passwordFormStatus'),submit=form.querySelector('button[type="submit"]');
 status.className='user-status';status.textContent='Alterando senha...';submit.disabled=true;
 try{
  if(!userId)throw new Error('Usuário não informado.');
  if(password.length<8)throw new Error('A senha deve ter pelo menos 8 caracteres.');
  await invokeUserAdmin({action:'reset_password',user_id:userId,password});
  status.className='user-status success';status.textContent='Senha alterada com sucesso.';
  setTimeout(()=>{closeModal('passwordModal');form.reset();loadUsers()},700);
 }catch(err){status.className='user-status error';status.textContent=err.message||String(err)}finally{submit.disabled=false}
};

$('#userForm').onsubmit=async e=>{
 e.preventDefault();
 if(currentProfile?.role!=='admin')return;
 const form=e.currentTarget,status=$('#userFormStatus'),submit=form.querySelector('button[type="submit"]');
 status.className='user-status';status.textContent='Criando usuário...';submit.disabled=true;
 try{
  if(form.password.value.length<8)throw new Error('A senha deve ter pelo menos 8 caracteres.');
  await invokeUserAdmin({action:'create',full_name:form.full_name.value.trim(),email:form.email.value.trim(),password:form.password.value,role:form.role.value});
  status.className='user-status success';status.textContent='Usuário criado com sucesso.';
  form.reset();form.role.value='viewer';await loadUsers();
 }catch(err){status.className='user-status error';status.textContent=err.message||String(err)}finally{submit.disabled=false}
};


// ============================================================
// V18 — EXPERIÊNCIA MÓVEL EXCLUSIVA DO PWA INSTALADO
// ============================================================
let mobileShellInitialized = false;
let mobileChartRestore = null;
let mobileResizeTimer = null;

function isMobileAppMode() {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const mobileAgent = /android|iphone|ipod|mobile/i.test(navigator.userAgent || '');
  const phoneDimension = Math.min(window.innerWidth, window.innerHeight) <= 720;
  return isPwaStandalone() && phoneDimension && (coarsePointer || mobileAgent);
}

function applyMobileAppMode() {
  const enabled = isMobileAppMode();
  document.body.classList.toggle('pwa-mobile', enabled);
  const header = $('#mobileAppHeader');
  if (header) header.setAttribute('aria-hidden', enabled ? 'false' : 'true');
  if (enabled && coreLoaded) initMobileAppShell();
  if (!enabled) closeMobileMenu();
  return enabled;
}

function syncMobileActionPermissions() {
  const label = $('#mobileUserLabel');
  if (label && currentProfile) {
    label.textContent = `${currentProfile.full_name || currentProfile.email} · ${currentProfile.role === 'admin' ? 'Administrador' : 'Visualizador'}`;
  }
  document.querySelectorAll('#mobileActionSheet .admin-only').forEach(element => {
    element.hidden = currentProfile?.role !== 'admin';
  });
}

function showCorePage(pageName) {
  document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
  const target = document.getElementById(`page-${pageName}`);
  if (target) target.classList.add('active');
  document.querySelectorAll('.page-btn').forEach(button => button.classList.remove('active'));
  const desktopButton = [...document.querySelectorAll('.page-btn')]
    .find(button => button.getAttribute('onclick')?.includes(`'${pageName}'`));
  if (desktopButton) desktopButton.classList.add('active');
}

function setMobileVisibility(selector, activeValue, dataKey) {
  document.querySelectorAll(selector).forEach(element => {
    const shouldHide = element.dataset[dataKey] !== activeValue;
    element.classList.toggle('mobile-view-hidden', shouldHide);
    element.toggleAttribute('hidden', shouldHide);
    element.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
  });
}

function updateMobileHeader(moduleName, sectionName) {
  const moduleLabel = moduleName === 'maintenance' ? 'Manutenção' : 'Obras';
  const sectionLabels = {
    summary: 'resumo',
    works: 'obras',
    charts: 'gráficos',
    risks: 'riscos'
  };
  const context = $('#mobileHeaderContext');
  if (context) context.textContent = `${moduleLabel} · ${sectionLabels[sectionName] || 'resumo'}`;
}

function resizeVisibleCharts() {
  clearTimeout(mobileResizeTimer);
  mobileResizeTimer = setTimeout(() => {
    document.querySelectorAll('canvas').forEach(canvas => {
      if (!canvas.offsetParent) return;
      try { window.Chart?.getChart(canvas)?.resize(); } catch (_) {}
    });
  }, 100);
}

function updateMobileModuleButtons(moduleName) {
  document.querySelectorAll('[data-mobile-module]').forEach(button => {
    const active = button.dataset.mobileModule === moduleName;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function mobileSetSection(section, options = {}) {
  if (!document.body.classList.contains('pwa-mobile')) return;
  const normalizedSection = ['summary','works','charts','risks'].includes(section) ? section : 'summary';
  const moduleName = document.body.dataset.mobileModule === 'maintenance' ? 'maintenance' : 'works';

  try { window.closeKpiPanel?.(); } catch (_) {}
  try { window.closePanel?.(); } catch (_) {}

  document.body.dataset.mobileSection = normalizedSection;
  if (moduleName === 'maintenance') {
    showCorePage('manutencao');
    const maintenanceView = normalizedSection === 'works' ? 'table' : normalizedSection;
    document.body.dataset.manScreen = maintenanceView;
    setMobileVisibility('#page-manutencao [data-man-mobile-view]', maintenanceView, 'manMobileView');
  } else {
    showCorePage('obras');
    setMobileVisibility('#page-obras [data-mobile-view]', normalizedSection, 'mobileView');
  }

  document.querySelectorAll('#mobileBottomNav [data-mobile-section]').forEach(button => {
    button.classList.toggle('active', button.dataset.mobileSection === normalizedSection);
  });
  updateMobileModuleButtons(moduleName);
  updateMobileHeader(moduleName, normalizedSection);
  closeMobileMenu();
  if (!options.noScroll) window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
  resizeVisibleCharts();
}

function mobileSetModule(moduleName, options = {}) {
  if (!document.body.classList.contains('pwa-mobile')) return;
  const normalizedModule = moduleName === 'maintenance' ? 'maintenance' : 'works';
  document.body.dataset.mobileModule = normalizedModule;
  try { localStorage.setItem('hapcapex-mobile-module', normalizedModule); } catch (_) {}
  mobileSetSection(options.section || 'summary', options);
}

// Compatibilidade com chamadas antigas do modo móvel.
function mobileSetScreen(screen, options = {}) {
  if (screen === 'maintenance') {
    mobileSetModule('maintenance', { ...options, section: 'summary' });
    return;
  }
  mobileSetSection(screen, options);
}

function mobileSetMaintenanceView(view, noScroll = false) {
  const sectionMap = { summary:'summary', table:'works', charts:'charts', risks:'risks' };
  mobileSetModule('maintenance', { section: sectionMap[view] || 'summary', noScroll });
}

function openMobileMenu() {
  if (!document.body.classList.contains('pwa-mobile')) return;
  $('#mobileActionSheet')?.classList.add('open');
  $('#mobileMenuOverlay')?.classList.add('open');
  $('#mobileActionSheet')?.setAttribute('aria-hidden', 'false');
  $('#mobileMenuBtn')?.setAttribute('aria-expanded', 'true');
}
function closeMobileMenu() {
  $('#mobileActionSheet')?.classList.remove('open');
  $('#mobileMenuOverlay')?.classList.remove('open');
  $('#mobileActionSheet')?.setAttribute('aria-hidden', 'true');
  $('#mobileMenuBtn')?.setAttribute('aria-expanded', 'false');
}

function addMobileChartLaunchers() {
  document.querySelectorAll('.chart-card').forEach(card => {
    if (card.querySelector('.mobile-chart-launch')) return;
    const canvas = card.querySelector('canvas');
    const container = canvas?.closest('.chart-container');
    if (!canvas || !container) return;
    const title = card.querySelector('h3')?.textContent?.trim() || 'Gráfico financeiro';
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'mobile-chart-launch';
    launcher.innerHTML = `<span><b>Ver gráfico</b><small>${esc(title.replace(/^[^\wÀ-ÿ]+/, ''))}</small></span><strong>↗</strong>`;
    launcher.addEventListener('click', () => openMobileChart(container, title));
    card.insertBefore(launcher, container);
  });
}

function addMobileTableControls() {
  document.querySelectorAll('.table-wrapper').forEach(wrapper => {
    const existing = wrapper.previousElementSibling?.classList.contains('mobile-table-controls') ? wrapper.previousElementSibling : null;
    const isMaintenancePage = !!wrapper.closest('#page-manutencao');
    const hasHorizontalOverflow = (wrapper.scrollWidth - wrapper.clientWidth) > 40;
    const visibleTable = wrapper.querySelector('table') && getComputedStyle(wrapper.querySelector('table')).display !== 'none';
    const shouldShowControls = hasHorizontalOverflow && visibleTable && !isMaintenancePage;

    if (!shouldShowControls) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const controls = document.createElement('div');
    controls.className = 'mobile-table-controls';
    controls.innerHTML = '<span>Deslize para consultar a tabela</span><div><button type="button" data-scroll="left" aria-label="Rolar para esquerda">←</button><button type="button" data-scroll="right" aria-label="Rolar para direita">→</button><button type="button" data-scroll="end">Fim</button></div>';
    controls.querySelector('[data-scroll="left"]').onclick = () => wrapper.scrollBy({ left: -Math.max(260, wrapper.clientWidth * .75), behavior: 'smooth' });
    controls.querySelector('[data-scroll="right"]').onclick = () => wrapper.scrollBy({ left: Math.max(260, wrapper.clientWidth * .75), behavior: 'smooth' });
    controls.querySelector('[data-scroll="end"]').onclick = () => wrapper.scrollTo({ left: wrapper.scrollWidth, behavior: 'smooth' });
    wrapper.parentNode.insertBefore(controls, wrapper);
  });
}

async function tryLandscapeMode(viewer) {
  try {
    if (!document.fullscreenElement && viewer.requestFullscreen) await viewer.requestFullscreen();
  } catch (_) {}
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch (_) {}
}

function resizeOpenedMobileChart() {
  if (!mobileChartRestore) return;
  const host = $('#mobileChartHost');
  const { container } = mobileChartRestore;
  const canvas = container?.querySelector('canvas');
  const chart = canvas ? window.Chart?.getChart(canvas) : null;
  if (!host || !container || !chart) return;

  const landscape = window.innerWidth > window.innerHeight;
  const width = landscape ? Math.max(640, host.clientWidth - 24) : 920;
  const height = landscape ? Math.max(300, host.clientHeight - 12) : 430;
  container.style.width = `${width}px`;
  container.style.minWidth = `${width}px`;
  container.style.height = `${height}px`;
  container.style.minHeight = `${height}px`;
  try {
    chart.options.maintainAspectRatio = false;
    chart.options.devicePixelRatio = Math.min(3, window.devicePixelRatio || 1);
    chart.resize(width, height);
    chart.update('none');
  } catch (_) {}
}

async function openMobileChart(container, title) {
  if (!document.body.classList.contains('pwa-mobile') || mobileChartRestore) return;
  const viewer = $('#mobileChartViewer');
  const host = $('#mobileChartHost');
  const titleElement = $('#mobileChartTitle');
  if (!viewer || !host) return;

  const placeholder = document.createComment('mobile-chart-placeholder');
  container.parentNode.insertBefore(placeholder, container);
  mobileChartRestore = { container, placeholder };
  host.appendChild(container);
  if (titleElement) titleElement.textContent = title.replace(/^[^\wÀ-ÿ]+/, '').trim();
  viewer.classList.add('open');
  viewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('mobile-chart-open');
  await tryLandscapeMode(viewer);
  [40, 160, 360, 750].forEach(delay => setTimeout(resizeOpenedMobileChart, delay));
}

async function closeMobileChart() {
  if (!mobileChartRestore) return;
  const { container, placeholder } = mobileChartRestore;
  placeholder.parentNode?.insertBefore(container, placeholder);
  placeholder.remove();
  mobileChartRestore = null;
  $('#mobileChartViewer')?.classList.remove('open');
  $('#mobileChartViewer')?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('mobile-chart-open');
  try { screen.orientation?.unlock?.(); } catch (_) {}
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (_) {}
  container.style.removeProperty('width');
  container.style.removeProperty('min-width');
  container.style.removeProperty('height');
  container.style.removeProperty('min-height');
  [80, 220].forEach(delay => setTimeout(() => {
    const currentCanvas = container.querySelector('canvas');
    const currentChart = currentCanvas ? window.Chart?.getChart(currentCanvas) : null;
    try { currentChart?.resize(); currentChart?.update('none'); } catch (_) {}
  }, delay));
}

function initMobileAppShell() {
  if (!isMobileAppMode()) return;
  document.body.classList.add('pwa-mobile');
  syncMobileActionPermissions();
  addMobileChartLaunchers();
  addMobileTableControls();

  if (!mobileShellInitialized) {
    mobileShellInitialized = true;
    $('#mobileMenuBtn')?.addEventListener('click', openMobileMenu);
    $('#mobileMenuClose')?.addEventListener('click', closeMobileMenu);
    $('#mobileMenuOverlay')?.addEventListener('click', closeMobileMenu);
    $('#mobileChartClose')?.addEventListener('click', closeMobileChart);

    document.querySelectorAll('#mobileBottomNav [data-mobile-section]').forEach(button => {
      button.addEventListener('click', () => mobileSetSection(button.dataset.mobileSection));
    });
    document.querySelectorAll('[data-mobile-module]').forEach(button => {
      button.addEventListener('click', () => mobileSetModule(button.dataset.mobileModule, { section:'summary' }));
    });
    document.querySelectorAll('[data-mobile-proxy]').forEach(button => {
      button.addEventListener('click', () => {
        closeMobileMenu();
        document.getElementById(button.dataset.mobileProxy)?.click();
      });
    });
    document.querySelector('[data-mobile-action="logout"]')?.addEventListener('click', () => {
      closeMobileMenu();
      $('#logoutBtn')?.click();
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && mobileChartRestore && $('#mobileChartViewer')?.classList.contains('open')) {
        void closeMobileChart();
      }
    });
  }

  let initialModule = document.body.dataset.mobileModule;
  if (!initialModule) {
    try { initialModule = localStorage.getItem('hapcapex-mobile-module'); } catch (_) {}
  }
  mobileSetModule(initialModule === 'maintenance' ? 'maintenance' : 'works', {
    section: document.body.dataset.mobileSection || 'summary',
    instant: true,
    noScroll: true
  });
}

window.addEventListener('resize', () => {
  clearTimeout(mobileResizeTimer);
  mobileResizeTimer = setTimeout(() => {
    applyMobileAppMode();
    resizeVisibleCharts();
    resizeOpenedMobileChart();
  }, 160);
});
window.addEventListener('orientationchange', () => setTimeout(() => { resizeVisibleCharts(); resizeOpenedMobileChart(); }, 250));


document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (mobileChartRestore) { void closeMobileChart(); return; }
  try { window.closeKpiPanel?.(); } catch (_) {}
  try { window.closePanel?.(); } catch (_) {}
  closeMobileMenu();
});

// ============================================================
// V28 — REGRAS POR OBRA, EDIÇÃO ADMINISTRATIVA, IMPORTAÇÃO SEGURA
//       E CENTRAL DE NOTIFICAÇÕES
// ============================================================

async function persistMissingFlowRules(rawWorks) {
  if (currentProfile?.role !== 'admin') return;
  const pending = (rawWorks || []).filter(work => work._id && !work._flowRulePersisted && work._flowRule);
  for (const work of pending) {
    const rule = (window.HAP_DATA?.flowRules || fallbackFlowRules).find(r => r.code === work._flowRule);
    const params = Object.keys(work._flowRuleParams || {}).length
      ? work._flowRuleParams
      : (rule?.default_params || {});
    const { error } = await sb.from('capex_items').update({
      flow_rule: work._flowRule,
      flow_rule_params: params,
      updated_by: currentProfile.id,
      updated_at: new Date().toISOString()
    }).eq('id', work._id);
    if (!error) work._flowRulePersisted = true;
  }
}

async function refreshCalendarNotifications() {
  const { error } = await sb.rpc('refresh_capex_calendar_notifications');
  if (error) console.warn('Não foi possível atualizar notificações de calendário:', error.message);
}

async function upsertNotification(notification) {
  if (currentProfile?.role !== 'admin') return null;
  const payload = {
    notification_key: notification.key,
    notification_type: notification.type,
    priority: notification.priority || 'info',
    title: notification.title,
    message: notification.message,
    item_id: notification.itemId || null,
    metadata: notification.metadata || {},
    audience_role: notification.audienceRole || 'all',
    active: notification.active !== false,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await sb.from('capex_notifications')
    .upsert(payload, { onConflict: 'notification_key' })
    .select('id').single();
  if (error) console.warn('Falha ao registrar notificação:', error.message);
  return data?.id || null;
}

async function loadNotifications() {
  if (!currentProfile) return;
  const [{ data: notes, error: notesError }, { data: reads, error: readsError }] = await Promise.all([
    sb.from('capex_notifications').select('*').eq('active', true).order('created_at', { ascending: false }).limit(250),
    sb.from('capex_notification_reads').select('notification_id,read_at').eq('user_id', currentProfile.id)
  ]);
  if (notesError) { console.warn(notesError.message); return; }
  if (readsError) console.warn(readsError.message);
  const readMap = new Map((reads || []).map(row => [row.notification_id, row.read_at]));
  notificationsCache = (notes || []).map(note => ({ ...note, read_at: readMap.get(note.id) || null }));
  renderNotificationBell();
  renderNotificationList();
}

function renderNotificationBell() {
  const unread = notificationsCache.filter(note => !note.read_at).length;
  [['#notificationBadge', unread], ['#mobileNotificationBadge', unread]].forEach(([selector, count]) => {
    const badge = $(selector);
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
  });
  const count = $('#notificationUnreadCount');
  if (count) count.textContent = String(unread);
}

function notificationIcon(priority) {
  return priority === 'critical' ? '🔴' : priority === 'warning' ? '🟠' : priority === 'resolved' ? '🟢' : '🔵';
}
function notificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
}
function renderNotificationList() {
  const box = $('#notificationList');
  if (!box) return;
  const filtered = notificationsCache.filter(note => activeNotificationFilter === 'all' || !note.read_at);
  if (!filtered.length) {
    box.innerHTML = `<div class="notification-empty">${activeNotificationFilter === 'unread' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação disponível.'}</div>`;
    return;
  }
  box.innerHTML = filtered.map(note => `
    <button class="notification-item ${note.read_at ? 'read' : 'unread'}" type="button" data-notification-id="${note.id}" data-item-id="${note.item_id || ''}">
      <span class="notification-priority">${notificationIcon(note.priority)}</span>
      <span class="notification-content"><strong>${esc(note.title)}</strong><span>${esc(note.message)}</span><small>${notificationTime(note.created_at)}</small></span>
      ${note.read_at ? '' : '<i class="notification-dot"></i>'}
    </button>`).join('');
  box.querySelectorAll('[data-notification-id]').forEach(button => button.addEventListener('click', async () => {
    await markNotificationRead(button.dataset.notificationId);
    const itemId = button.dataset.itemId;
    closeModal('notificationModal');
    if (itemId && Array.isArray(window.HAP_RUNTIME_OBRAS)) {
      const index = window.HAP_RUNTIME_OBRAS.findIndex(work => work._id === itemId);
      if (index >= 0 && typeof window.openPanel === 'function') window.openPanel(index);
    }
  }));
}
async function markNotificationRead(notificationId) {
  if (!notificationId || !currentProfile) return;
  await sb.from('capex_notification_reads').upsert({
    notification_id: notificationId,
    user_id: currentProfile.id,
    read_at: new Date().toISOString()
  }, { onConflict: 'notification_id,user_id' });
  const note = notificationsCache.find(item => item.id === notificationId);
  if (note) note.read_at = new Date().toISOString();
  renderNotificationBell();
  renderNotificationList();
}
async function markAllNotificationsRead() {
  const { error } = await sb.rpc('mark_all_capex_notifications_read');
  if (error) throw error;
  const now = new Date().toISOString();
  notificationsCache.forEach(note => { note.read_at = now; });
  renderNotificationBell();
  renderNotificationList();
}

$('#notificationBtn')?.addEventListener('click', () => { renderNotificationList(); openModal('notificationModal'); });
$('#mobileNotificationBtn')?.addEventListener('click', () => { renderNotificationList(); openModal('notificationModal'); });
$('#markAllNotificationsRead')?.addEventListener('click', () => markAllNotificationsRead().catch(error => alert('Falha ao marcar notificações: ' + error.message)));
document.querySelectorAll('[data-notification-filter]').forEach(button => button.addEventListener('click', () => {
  activeNotificationFilter = button.dataset.notificationFilter;
  document.querySelectorAll('[data-notification-filter]').forEach(item => item.classList.toggle('active', item === button));
  renderNotificationList();
}));

window.HAP_NOTIFICATIONS = {
  async syncDerived(works) {
    if (currentProfile?.role !== 'admin' || !Array.isArray(works)) return;
    const reportingKey = window.HAP_DATA?.reportingMonthKey || month2026Keys[0];
    const reportingIndex = month2026Keys.indexOf(reportingKey);
    const reportKeys = month2026Keys.slice(0, Math.max(0, reportingIndex) + 1);
    const today = new Date(); today.setHours(0,0,0,0);

    for (const work of works) {
      const planned = reportKeys.reduce((sum, key) => sum + num(work.flow?.[key]), 0);
      const actual = reportKeys.reduce((sum, key) => sum + num(work[key + '_real']), 0);
      const deviation = planned > 0 ? (actual - planned) / planned : 0;
      const end = work._dbFim ? new Date(work._dbFim + 'T00:00:00') : null;
      const daysToEnd = end && !Number.isNaN(end.getTime()) ? Math.round((end - today) / 86400000) : null;
      if (daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 30 && planned > 0 && deviation <= -0.20) {
        await upsertNotification({
          key: `end-risk:${work._id}:${work._dbFim}:${reportingKey}`,
          type:'end_financial_risk', priority:'critical', itemId:work._id,
          title:'Risco de encerramento financeiro',
          message:`${work.nome} termina em ${daysToEnd} dias e está ${(Math.abs(deviation)*100).toFixed(1).replace('.',',')}% abaixo do previsto acumulado.`,
          metadata:{days_to_end:daysToEnd,planned,actual,deviation,reporting_month:reportingKey}
        });
      }
      if (planned > 0 && deviation <= -0.20) {
        await upsertNotification({
          key:`financial-critical:${work._id}:${reportingKey}`,
          type:'financial_critical', priority:'critical', itemId:work._id,
          title:'Obra em condição financeira crítica',
          message:`${work.nome} apresenta desvio acumulado de ${(deviation*100).toFixed(1).replace('.',',')}% em relação ao previsto.`,
          metadata:{planned,actual,deviation,reporting_month:reportingKey}
        });
      }
    }
    const check = window.HAP_FINANCIAL_CHECK;
    if (check && Math.abs(num(check.diferenca)) > 0.01) {
      await upsertNotification({
        key:`flow-integrity:${reportingKey}:${Math.round(num(check.diferenca)*100)}`,
        type:'flow_integrity', priority:'critical', title:'Falha de conciliação financeira',
        message:`A soma dos fluxos previstos diverge do CAPEX das obras em ${brlValue(check.diferenca)}.`,
        metadata:check, audienceRole:'admin'
      });
    }
    await loadNotifications();
  }
};

function ruleByCode(code) {
  return (window.HAP_DATA?.flowRules || fallbackFlowRules).find(rule => rule.code === code) || fallbackFlowRules.find(rule => rule.code === code);
}
function buildRuleOptions(selected, forNew = false) {
  return (window.HAP_DATA?.flowRules || fallbackFlowRules)
    .filter(rule => rule.selectable !== false && (!forNew || rule.code !== 'historical_baseline'))
    .map(rule => `<option value="${esc(rule.code)}" ${rule.code === selected ? 'selected' : ''}>${esc(rule.name)}</option>`).join('');
}
function isoToInput(value) { return value || ''; }
function formatEditValue(field, value) {
  if (field === 'capex' || field.startsWith('realizado.')) return brlValue(value);
  if (field === 'inicio' || field === 'fim') return value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
  if (field === 'contingenciada') return value ? 'Sim' : 'Não';
  return value == null || value === '' ? '—' : String(value);
}

function renderWorkRuleParams() {
  const code = $('#workEditRule')?.value;
  const box = $('#workRuleParams');
  if (!box) return;
  const item = (window.HAP_STATE_ITEMS || []).find(row => row.id === $('#workEditId')?.value);
  const params = item?.flow_rule_params || ruleByCode(code)?.default_params || {};
  if (code === 'single_payment') {
    const month = params.month || 'jul';
    box.innerHTML = `<label>Mês do pagamento único<select id="workSinglePaymentMonth">${month2026Keys.map(key => `<option value="${key}" ${key===month?'selected':''}>${key.toUpperCase()}/26</option>`).join('')}</select></label>`;
  } else box.innerHTML = '';
  const rule = ruleByCode(code);
  $('#workRuleDescription').textContent = rule?.description || '';
  updateWorkEditImpact();
}
function currentWorkEditParams() {
  const code = $('#workEditRule')?.value;
  return code === 'single_payment' ? { month: $('#workSinglePaymentMonth')?.value || 'jul' } : {};
}
function editableRealizedMonthKeys() {
  const reportingKey = window.HAP_DATA?.reportingMonthKey || 'jan';
  const reportingIndex = month2026Keys.indexOf(reportingKey);
  return month2026Keys.slice(0, Math.max(0, reportingIndex) + 1);
}
function workRealizedDraft() {
  const item = (window.HAP_STATE_ITEMS || []).find(row => row.id === $('#workEditId')?.value);
  const result = { ...(item?.realizado || {}) };
  document.querySelectorAll('#workEditRealizedGrid [data-realized-month]').forEach(input => {
    result[input.dataset.realizedMonth] = num(input.value);
  });
  return result;
}
function updateWorkRealizedTotal() {
  const total = month2026Keys.reduce((sum,key) => sum + num(workRealizedDraft()?.[key]), 0);
  const target = $('#workEditRealizedTotal');
  if (target) target.textContent = brlValue(total);
}
function renderWorkRealizedEditor(item) {
  const box = $('#workEditRealizedGrid');
  if (!box) return;
  const reportingKey = window.HAP_DATA?.reportingMonthKey || 'jan';
  const reportingIndex = month2026Keys.indexOf(reportingKey);
  const labels = {jan:'Jan/26',fev:'Fev/26',mar:'Mar/26',abr:'Abr/26',mai:'Mai/26',jun:'Jun/26',jul:'Jul/26',ago:'Ago/26',set:'Set/26',out:'Out/26',nov:'Nov/26',dez:'Dez/26'};
  box.innerHTML = month2026Keys.map((key,index) => {
    const future = index > reportingIndex;
    const value = num(item?.realizado?.[key]);
    return `<label class="work-realized-month ${future ? 'future' : ''}"><span>${labels[key]}</span><div class="money-input"><span>R$</span><input type="number" min="0" step="0.01" data-realized-month="${key}" value="${value.toFixed(2)}" ${future ? 'disabled' : ''}></div>${future ? '<small>Futuro</small>' : ''}</label>`;
  }).join('');
  box.querySelectorAll('[data-realized-month]:not([disabled])').forEach(input => {
    input.addEventListener('input', () => { updateWorkRealizedTotal(); updateWorkEditImpact(); });
  });
  updateWorkRealizedTotal();
}
function updateWorkEditImpact() {
  const id = $('#workEditId')?.value;
  const item = (window.HAP_STATE_ITEMS || []).find(row => row.id === id);
  const box = $('#workEditImpact');
  if (!item || !box) return;
  const changes = [];
  const capex = num($('#workEditCapex')?.value);
  const inicio = $('#workEditStart')?.value || null;
  const fim = $('#workEditEnd')?.value || null;
  const rule = $('#workEditRule')?.value || item.flow_rule;
  if (Math.abs(capex - num(item.capex)) > 0.005) changes.push(`CAPEX: ${brlValue(item.capex)} → ${brlValue(capex)}`);
  if ((item.inicio || null) !== inicio) changes.push(`Início: ${formatEditValue('inicio',item.inicio)} → ${formatEditValue('inicio',inicio)}`);
  if ((item.fim || null) !== fim) changes.push(`Término: ${formatEditValue('fim',item.fim)} → ${formatEditValue('fim',fim)}`);
  if ((item.flow_rule || inferFlowRule(item, findBaselineWork(item), contingencyState(item.nome,item.capex))) !== rule) changes.push(`Regra: ${ruleByCode(item.flow_rule)?.name || 'Atual'} → ${ruleByCode(rule)?.name || rule}`);
  const draftRealized = workRealizedDraft();
  editableRealizedMonthKeys().forEach(key => {
    const current = num(item.realizado?.[key]);
    const next = num(draftRealized?.[key]);
    if (Math.abs(current - next) > 0.005) changes.push(`Realizado ${key.toUpperCase()}/26: ${brlValue(current)} → ${brlValue(next)}`);
  });
  box.innerHTML = changes.length ? `<strong>Alterações que serão aplicadas</strong><ul>${changes.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>` : '<span>Nenhuma alteração detectada.</span>';
}

window.openWorkEditor = function(itemId) {
  if (currentProfile?.role !== 'admin') return;
  const item = (window.HAP_STATE_ITEMS || []).find(row => row.id === itemId);
  if (!item) return;
  const original = findBaselineWork(item);
  const state = contingencyState(item.nome, item.capex);
  const rule = item.flow_rule || inferFlowRule(item, original, state);
  $('#workEditId').value = item.id;
  $('#workEditIdentity').textContent = `${item.ordem} — ${item.nome}`;
  $('#workEditStart').value = isoToInput(item.inicio);
  $('#workEditEnd').value = isoToInput(item.fim);
  $('#workEditCapex').value = num(item.capex).toFixed(2);
  $('#workEditRule').innerHTML = buildRuleOptions(rule);
  renderWorkRuleParams();
  renderWorkRealizedEditor(item);
  updateWorkEditImpact();
  openModal('workEditModal');
};
['#workEditStart','#workEditEnd','#workEditCapex'].forEach(selector => $(selector)?.addEventListener('input', updateWorkEditImpact));
$('#workEditRule')?.addEventListener('change', renderWorkRuleParams);
$('#workRuleParams')?.addEventListener('change', updateWorkEditImpact);
$('#workEditForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (currentProfile?.role !== 'admin') return;
  const id = $('#workEditId').value;
  const item = (window.HAP_STATE_ITEMS || []).find(row => row.id === id);
  if (!item) return;
  const next = {
    inicio: $('#workEditStart').value || null,
    fim: $('#workEditEnd').value || null,
    capex: num($('#workEditCapex').value),
    flow_rule: $('#workEditRule').value,
    flow_rule_params: currentWorkEditParams(),
    realizado: workRealizedDraft()
  };
  if (['standard_15_75_10','rio_5_85_10'].includes(next.flow_rule) && (!next.inicio || !next.fim)) {
    alert('A regra selecionada exige data de início e data de término.'); return;
  }
  if (next.inicio && next.fim && next.fim < next.inicio) {
    alert('A data de término não pode ser anterior à data de início.'); return;
  }
  const overrides = { ...(item.manual_overrides || {}) };
  const now = new Date().toISOString();
  ['inicio','fim','capex','flow_rule'].forEach(field => {
    const current = field === 'flow_rule' ? (item.flow_rule || inferFlowRule(item, findBaselineWork(item), contingencyState(item.nome,item.capex))) : item[field];
    if (String(current ?? '') !== String(next[field] ?? '')) {
      overrides[field] = { previous: current ?? null, value: next[field] ?? null, changed_at: now, changed_by: currentProfile.id };
    }
  });
  const currentParams = JSON.stringify(item.flow_rule_params || {});
  if (currentParams !== JSON.stringify(next.flow_rule_params || {})) {
    overrides.flow_rule_params = { previous:item.flow_rule_params||{}, value:next.flow_rule_params||{}, changed_at:now, changed_by:currentProfile.id };
  }
  editableRealizedMonthKeys().forEach(key => {
    const field = `realizado.${key}`;
    const current = num(item.realizado?.[key]);
    const value = num(next.realizado?.[key]);
    if (Math.abs(current - value) > 0.005) {
      overrides[field] = { previous:current, value, changed_at:now, changed_by:currentProfile.id };
    }
  });
  const { error } = await sb.from('capex_items').update({
    ...next,
    manual_overrides: overrides,
    manual_updated_at: now,
    manual_updated_by: currentProfile.id,
    updated_by: currentProfile.id,
    updated_at: now
  }).eq('id', id);
  if (error) { alert('Falha ao salvar a obra: ' + error.message); return; }
  closeModal('workEditModal');
  closePanel?.();
  // Recarregar é intencional: o pipeline completo recalcula fluxo, KPIs, gráficos,
  // riscos, textos interpretativos, painel lateral e notificações a partir da fonte persistida.
  location.reload();
});

function excelLocation(item, field) {
  const meta = item?._excel || {};
  const fieldMeta = meta.fields?.[field] || {};
  return { sheet:meta.sheet || '', row:meta.row || null, cell:fieldMeta.cell || '' };
}
function sameScalar(field, a, b) {
  if (field === 'capex' || field.startsWith('realizado.')) return Math.abs(num(a)-num(b)) <= 0.005;
  if (field === 'contingenciada') return Boolean(a) === Boolean(b);
  return String(a ?? '') === String(b ?? '');
}
function getExistingValue(item, field) {
  if (field.startsWith('realizado.')) return num(item.realizado?.[field.split('.')[1]]);
  return item[field];
}
function hasManualOverride(item, field) {
  return Boolean(item?.manual_overrides && Object.prototype.hasOwnProperty.call(item.manual_overrides, field));
}
function getSourceSnapshotValue(item, field) {
  const source=item?.source_snapshot || {};
  if(field.startsWith('realizado.')) return num(source.realizado?.[field.split('.')[1]]);
  return source[field];
}
function importImpactText(field) {
  if(field==='capex') return 'Impacto: recalcula o fluxo da obra conforme a regra vigente, KPIs, gráficos, riscos e totais do portfólio.';
  if(field==='inicio'||field==='fim') return 'Impacto: replaneja o calendário da obra e pode redistribuir o fluxo futuro conforme a regra vigente.';
  if(field.startsWith('realizado.')) return 'Impacto: altera realizado acumulado, desvios, gráficos, riscos e análises interpretativas.';
  if(field==='ordem'||field==='nome') return 'Impacto: altera a identificação usada nas consultas e nas próximas correspondências de importação.';
  return 'Impacto: os painéis dependentes deste campo serão recalculados.';
}
function matchingExistingItems(existingItems, incoming) {
  return (existingItems || []).filter(existing => sameRecord(existing, incoming));
}
function latestIncomingRealMonth(incomingItems) {
  let latest = 0;
  month2026Keys.forEach((key,index) => {
    if ((incomingItems || []).some(item => num(item.realizado?.[key]) !== 0)) latest = index;
  });
  return latest;
}
function sourceSnapshotFromIncoming(item) {
  return {
    ordem:item.ordem, nome:item.nome, inicio:item.inicio, fim:item.fim, capex:num(item.capex),
    tipologia:item.tipologia, contingenciada:Boolean(item.contingenciada), realizado:item.realizado || {}
  };
}
function makeImportChange(data) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `chg_${Date.now()}_${Math.random()}`,
    decision: data.decision ?? (data.severity === 'info' ? 'excel' : (data.kind === 'changed' && data.severity === 'warning' ? 'excel' : null)),
    ...data
  };
}
function analyzeImport(items, existingItems, scope) {
  const changes = [];
  const matchedIds = new Set();
  const latestRealIndex = latestIncomingRealMonth(items);
  const incomingMatches = new Map();
  const issues = items.issues || [];

  issues.forEach(issue => changes.push(makeImportChange({ kind:'error', severity:'critical', title:'Erro estrutural no Excel', field:issue.field||'estrutura', current:null, incoming:issue.value||null, location:issue.location||{}, reason:issue.message, decision:null })));

  items.forEach((incoming, incomingIndex) => {
    const matches = matchingExistingItems(existingItems, incoming);
    incomingMatches.set(incomingIndex, matches.map(item => item.id));
    if (matches.length > 1) {
      changes.push(makeImportChange({kind:'ambiguous',severity:'critical',incomingIndex,title:'Correspondência ambígua',itemName:incoming.nome,itemOrder:incoming.ordem,field:'identificação',current:matches.map(x=>`${x.ordem} — ${x.nome}`).join(' | '),incoming:`${incoming.ordem} — ${incoming.nome}`,location:excelLocation(incoming,'ordem'),reason:'Mais de uma obra do HAPCAPEX corresponde a esta linha. Corrija a identificação no Excel antes de importar.',decision:null}));
      return;
    }
    if (!matches.length) {
      changes.push(makeImportChange({kind:'new',severity:incoming.categoria==='obra'?'critical':'info',incomingIndex,title:'Nova obra detectada',itemName:incoming.nome,itemOrder:incoming.ordem,field:'nova_obra',current:null,incoming:incoming.capex,location:excelLocation(incoming,'ordem'),reason:incoming.categoria==='obra'?'Selecione uma regra financeira antes de incluir a nova obra.':'Novo registro de manutenção.',decision:'excel',selectedRule:null}));
      return;
    }
    const existing = matches[0]; matchedIds.add(existing.id);
    const fields = ['ordem','nome','inicio','fim','capex','contingenciada'];
    fields.forEach(field => {
      const incomingValue = incoming[field];
      if (incomingValue === undefined || incomingValue === null && field === 'tipologia') return;
      const currentValue = getExistingValue(existing, field);
      if (sameScalar(field,currentValue,incomingValue)) return;
      const manual = hasManualOverride(existing,field);
      changes.push(makeImportChange({kind:'changed',severity:manual?'critical':'warning',incomingIndex,existingId:existing.id,title:manual?'Conflito com edição manual':`Alteração de ${field === 'capex' ? 'CAPEX' : field === 'inicio' ? 'data de início' : field === 'fim' ? 'data de término' : field === 'nome' ? 'nome da obra' : 'contingenciamento'}`,itemName:existing.nome,itemOrder:existing.ordem,field,current:currentValue,incoming:incomingValue,location:excelLocation(incoming,field),reason:(manual?'O campo foi alterado manualmente no HAPCAPEX e o Excel traz outro valor. A decisão é obrigatória. ':'O Excel alterará este campo se a importação for confirmada. ')+importImpactText(field),sourcePrevious:manual?getSourceSnapshotValue(existing,field):undefined,manualConflict:manual,decision:manual?null:'excel'}));
    });
    month2026Keys.forEach((key,index) => {
      const field='realizado.'+key;
      const currentValue=num(existing.realizado?.[key]);
      const incomingValue=num(incoming.realizado?.[key]);
      if (sameScalar(field,currentValue,incomingValue)) return;
      const manual=hasManualOverride(existing,field);
      const historical=index < latestRealIndex;
      const severity=manual||historical?'critical':'info';
      changes.push(makeImportChange({kind:'changed',severity,incomingIndex,existingId:existing.id,title:historical?'Realizado histórico alterado':`Realizado ${key.toUpperCase()}/26 atualizado`,itemName:existing.nome,itemOrder:existing.ordem,field,current:currentValue,incoming:incomingValue,location:excelLocation(incoming,field),reason:(manual?'Existe decisão manual anterior para este mês. ':historical?'O Excel está modificando um mês anterior ao último mês de referência. Confirmação explícita é obrigatória. ':'Atualização do mês de referência. ')+importImpactText(field),sourcePrevious:manual?getSourceSnapshotValue(existing,field):undefined,manualConflict:manual,historical,decision:severity==='info'?'excel':null}));
    });
  });

  const scopeCategories = scope === 'works' ? ['obra'] : scope === 'maintenance' ? ['manutencao'] : ['obra','manutencao'];
  (existingItems || []).filter(existing => scopeCategories.includes(existing.categoria) && existing.ordem !== 'NAO_PLANEJADAS' && !isMaintenancePackageName(existing.nome) && !matchedIds.has(existing.id)).forEach(existing => {
    changes.push(makeImportChange({kind:'removed',severity:'warning',existingId:existing.id,title:'Registro não encontrado no novo Excel',itemName:existing.nome,itemOrder:existing.ordem,field:'remoção',current:'Ativo no HAPCAPEX',incoming:'Ausente no Excel',location:{sheet:existing.categoria==='obra'?'PLANEJAMENTO':'OBRAS MANUTENÇÃO',row:null,cell:''},reason:'O registro não será arquivado automaticamente. Escolha manter ou arquivar.',decision:null}));
  });
  return { changes, incomingMatches, latestRealIndex, scope, newRules:{}, newRuleParams:{}, fileName:$('#excelFile')?.files?.[0]?.name || 'planilha.xlsx' };
}

function importChangeLabel(change) {
  const loc = [change.location?.sheet ? `Aba ${change.location.sheet}` : '', change.location?.row ? `linha ${change.location.row}` : '', change.location?.cell ? `célula ${change.location.cell}` : ''].filter(Boolean).join(' · ');
  return loc;
}
function importSeverityIcon(severity) { return severity==='critical'?'🔴':severity==='warning'?'🟠':'🔵'; }
function importFieldLabel(field) {
  if (field==='capex') return 'CAPEX'; if(field==='ordem') return 'Ordem Interna (OI)'; if(field==='inicio') return 'Data de início'; if(field==='fim') return 'Data de término'; if(field==='nome') return 'Nome'; if(field==='contingenciada') return 'Contingenciamento'; if(field.startsWith('realizado.')) return 'Realizado '+field.split('.')[1].toUpperCase()+'/26'; return field;
}
function calculateImportImpact(preview) {
  const existing=(window.HAP_STATE_ITEMS||[]).filter(item=>item.categoria==='obra'&&item.ordem!=='NAO_PLANEJADAS'&&!isMaintenancePackageName(item.nome));
  let capexBefore=existing.reduce((sum,item)=>sum+num(item.capex),0);
  let capexAfter=capexBefore;
  let worksBefore=existing.length;
  let worksAfter=worksBefore;
  const latestIndex=preview?.latestRealIndex ?? 0;
  const keys=month2026Keys.slice(0,latestIndex+1);
  let realBefore=existing.reduce((sum,item)=>sum+keys.reduce((s,key)=>s+num(item.realizado?.[key]),0),0);
  let realAfter=realBefore;
  (preview?.changes||[]).forEach(change=>{
    if(change.kind==='new'&&change.severity==='critical'){
      const incoming=pendingImport?.[change.incomingIndex];
      if(incoming?.categoria==='obra'){capexAfter+=num(incoming.capex);worksAfter++;realAfter+=keys.reduce((s,key)=>s+num(incoming.realizado?.[key]),0);}
    }
    if(change.kind==='changed'&&change.decision==='excel'){
      if(change.field==='capex')capexAfter+=num(change.incoming)-num(change.current);
      if(change.field.startsWith('realizado.'))realAfter+=num(change.incoming)-num(change.current);
    }
    if(change.kind==='removed'&&change.decision==='archive'){
      const item=(window.HAP_STATE_ITEMS||[]).find(row=>row.id===change.existingId);
      if(item?.categoria==='obra'){capexAfter-=num(item.capex);worksAfter--;realAfter-=keys.reduce((s,key)=>s+num(item.realizado?.[key]),0);}
    }
  });
  return {capexBefore,capexAfter,worksBefore,worksAfter,realBefore,realAfter};
}

function renderImportPreview() {
  const preview = pendingImportPreview;
  if (!preview) return;
  const all = preview.changes;
  const visible = all.filter(change => activeImportFilter==='all' || activeImportFilter===change.severity || activeImportFilter===change.kind);
  const unresolved = all.filter(change => change.severity==='critical' && !change.decision || change.kind==='removed' && !change.decision || change.kind==='new' && change.severity==='critical' && !preview.newRules[change.incomingIndex]);
  const summary = $('#importSummary');
  const impact=calculateImportImpact(preview);
  if (summary) summary.innerHTML = `
    <div><span>Alterações detectadas</span><strong>${all.length}</strong></div>
    <div class="critical"><span>Bloqueantes</span><strong>${all.filter(c=>c.severity==='critical').length}</strong></div>
    <div class="warning"><span>Requerem revisão</span><strong>${all.filter(c=>c.severity==='warning').length}</strong></div>
    <div><span>Novas / Removidas</span><strong>${all.filter(c=>c.kind==='new').length} / ${all.filter(c=>c.kind==='removed').length}</strong></div>
    <div class="${unresolved.length?'critical':'ok'}"><span>Decisões pendentes</span><strong>${unresolved.length}</strong></div>
    <div><span>Obras após decisões</span><strong>${impact.worksBefore} → ${impact.worksAfter}</strong></div>
    <div><span>CAPEX das obras</span><strong>${brlValue(impact.capexBefore)}</strong><small>→ ${brlValue(impact.capexAfter)}</small></div>
    <div><span>Realizado YTD</span><strong>${brlValue(impact.realBefore)}</strong><small>→ ${brlValue(impact.realAfter)}</small></div>`;
  const box=$('#importChanges');
  if (box) box.innerHTML = visible.length ? visible.map(change => {
    const selectedNewRule = preview.newRules[change.incomingIndex] || '';
    const ruleSelect = change.kind==='new' && change.severity==='critical' ? `<label class="import-decision-label">Regra financeira<select data-new-rule="${change.incomingIndex}"><option value="">Selecione...</option>${buildRuleOptions(selectedNewRule,true)}</select></label>${selectedNewRule==='single_payment'?`<label class="import-decision-label">Mês do pagamento<select data-new-rule-month="${change.incomingIndex}">${month2026Keys.map(key=>`<option value="${key}" ${(preview.newRuleParams[change.incomingIndex]?.month||'jul')===key?'selected':''}>${key.toUpperCase()}/26</option>`).join('')}</select></label>`:''}` : '';
    const decisionSelect = change.kind==='removed'
      ? `<label class="import-decision-label">Decisão<select data-change-decision="${change.id}"><option value="">Selecione...</option><option value="keep" ${change.decision==='keep'?'selected':''}>Manter ativa no HAPCAPEX</option><option value="archive" ${change.decision==='archive'?'selected':''}>Arquivar obra</option></select></label>`
      : (change.kind==='changed' && change.severity!=='info' ? `<label class="import-decision-label">Decisão<select data-change-decision="${change.id}"><option value="" ${!change.decision?'selected':''}>Selecione...</option><option value="excel" ${change.decision==='excel'?'selected':''}>Usar valor do Excel</option><option value="keep" ${change.decision==='keep'?'selected':''}>Manter HAPCAPEX</option></select></label>` : '');
    return `<div class="import-change-card ${change.severity}" data-kind="${change.kind}">
      <div class="import-change-head"><span>${importSeverityIcon(change.severity)}</span><div><strong>${esc(change.title)}</strong><small>${esc(change.itemOrder||'')} ${change.itemName?'— '+esc(change.itemName):''}</small></div><em>${esc(importChangeLabel(change))}</em></div>
      <div class="import-change-values"><div><span>Campo</span><strong>${esc(importFieldLabel(change.field))}</strong></div>${change.manualConflict?`<div><span>Último Excel aceito</span><strong>${esc(formatEditValue(change.field,change.sourcePrevious))}</strong></div>`:''}<div><span>HAPCAPEX atual</span><strong>${esc(formatEditValue(change.field,change.current))}</strong></div><div><span>Excel novo</span><strong>${esc(formatEditValue(change.field,change.incoming))}</strong></div>${change.field==='capex'&&change.current!=null?`<div><span>Diferença</span><strong>${esc(brlValue(num(change.incoming)-num(change.current)))}</strong></div>`:''}</div>
      <p>${esc(change.reason||'')}</p>${ruleSelect}${decisionSelect}
    </div>`;
  }).join('') : '<div class="notification-empty">Nenhuma alteração nesta categoria.</div>';
  box?.querySelectorAll('[data-change-decision]').forEach(select => select.addEventListener('change', () => { const c=all.find(x=>x.id===select.dataset.changeDecision); if(c)c.decision=select.value||null; validateImportReady(); renderImportPreview(); }));
  box?.querySelectorAll('[data-new-rule]').forEach(select => select.addEventListener('change', () => {
    const idx=Number(select.dataset.newRule); preview.newRules[idx]=select.value||null;
    const def=ruleByCode(select.value); preview.newRuleParams[idx]={...(def?.default_params||{})};
    renderImportPreview(); validateImportReady();
  }));
  box?.querySelectorAll('[data-new-rule-month]').forEach(select => select.addEventListener('change',()=>{
    const idx=Number(select.dataset.newRuleMonth); preview.newRuleParams[idx]={...(preview.newRuleParams[idx]||{}),month:select.value}; validateImportReady();
  }));
  $('#importPreview').hidden=false;
  validateImportReady();
}
function validateImportReady() {
  const preview=pendingImportPreview;
  const reviewed=$('#importReviewed')?.checked;
  if (!preview) { $('#applyImport').disabled=true; return false; }
  const unresolved=preview.changes.some(change => {
    if(change.severity==='critical' && change.kind!=='new' && !change.decision) return true;
    if(change.kind==='removed'&&!change.decision) return true;
    if(change.kind==='new'&&change.severity==='critical'){
      const rule=preview.newRules[change.incomingIndex]; if(!rule)return true;
      const incoming=pendingImport?.[change.incomingIndex];
      if(['standard_15_75_10','rio_5_85_10'].includes(rule) && (!incoming?.inicio || !incoming?.fim)) return true;
    }
    return false;
  });
  $('#applyImport').disabled = Boolean(unresolved || !reviewed);
  return !unresolved && reviewed;
}
$('#importReviewed')?.addEventListener('change', validateImportReady);
document.querySelectorAll('[data-import-filter]').forEach(button=>button.addEventListener('click',()=>{activeImportFilter=button.dataset.importFilter;document.querySelectorAll('[data-import-filter]').forEach(b=>b.classList.toggle('active',b===button));renderImportPreview();}));

function exportImportDivergences() {
  if (!pendingImportPreview) return;
  const rows=pendingImportPreview.changes.map(change=>({
    Severidade: change.severity==='critical'?'BLOQUEANTE':change.severity==='warning'?'REVISÃO':'INFORMATIVO',
    Tipo: change.title,
    Aba: change.location?.sheet||'', Linha: change.location?.row||'', Célula: change.location?.cell||'',
    OI: change.itemOrder||'', Obra: change.itemName||'', Campo: importFieldLabel(change.field),
    'HAPCAPEX atual': formatEditValue(change.field,change.current), 'Excel novo': formatEditValue(change.field,change.incoming),
    Motivo: change.reason||'', Decisão: change.decision||'',
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Divergências');
  XLSX.writeFile(wb,`HAPCAPEX_DIVERGENCIAS_${new Date().toISOString().slice(0,10)}.xlsx`);
}
$('#reviewExcelBtn')?.addEventListener('click',()=>{
  pendingImport=null;pendingImportPreview=null;pendingImportWorkbook=null;
  $('#excelFile').value=''; $('#importPreview').hidden=true; $('#importCheck').hidden=true;
  $('#importReviewed').checked=false; $('#applyImport').disabled=true;
  $('#importStatus').textContent='Corrija o Excel e selecione novamente o arquivo para executar uma nova análise.';
});
$('#exportImportDiff')?.addEventListener('click',exportImportDivergences);

function stripImportMeta(item) {
  const { _excel, ...clean } = item;
  return clean;
}
function findChange(preview,incomingIndex,field) { return preview.changes.find(change=>change.incomingIndex===incomingIndex&&change.field===field); }
function applyFieldDecision(existing,incoming,preview,incomingIndex,field,overrides) {
  const change=findChange(preview,incomingIndex,field);
  const current=getExistingValue(existing,field);
  const incomingValue=field.startsWith('realizado.')?num(incoming.realizado?.[field.split('.')[1]]):incoming[field];
  if (!change) return incomingValue;
  if (change.decision==='keep') {
    overrides[field]={previous:incomingValue,value:current,changed_at:new Date().toISOString(),changed_by:currentProfile.id,reason:'Mantido pelo administrador durante importação'};
    return current;
  }
  if (change.decision==='excel') delete overrides[field];
  return incomingValue;
}

async function applyImportV28() {
  if (!pendingImport || !pendingImportPreview || currentProfile?.role!=='admin' || !validateImportReady()) return;
  $('#applyImport').disabled=true;
  const fileName=pendingImportPreview.fileName;
  try {
    $('#importStatus').textContent='Criando backup de segurança antes da importação...';
    await createServerBackup('manual',true,`Antes da importação: ${fileName}`);
    $('#importStatus').textContent='Aplicando decisões revisadas...';
    const {data:existingRows,error:existingError}=await sb.from('capex_items').select('*').is('deleted_at',null);
    if(existingError)throw existingError;
    const existing=existingRows||[];
    let created=0,updated=0,archived=0,ignored=pendingImport.ignoredCount||0;
    const decisionAudit=[];
    const changedForNotifications=[];

    for (let incomingIndex=0; incomingIndex<pendingImport.length; incomingIndex++) {
      const incoming=pendingImport[incomingIndex];
      const matches=matchingExistingItems(existing,incoming);
      if(matches.length>1) throw new Error(`Correspondência ambígua não resolvida para ${incoming.ordem} — ${incoming.nome}.`);
      if(!matches.length){
        const rule=incoming.categoria==='obra' ? pendingImportPreview.newRules[incomingIndex] : null;
        if(incoming.categoria==='obra'&&!rule) throw new Error(`Regra financeira não definida para ${incoming.nome}.`);
        const ruleDef=ruleByCode(rule);
        const ruleParams=pendingImportPreview.newRuleParams[incomingIndex] || ruleDef?.default_params || {};
        const clean=stripImportMeta(incoming);
        if(clean.tipologia==null) clean.tipologia=incoming.categoria==='obra'?'Outros':'Manutenção';
        const payload={...clean,flow_rule:rule,flow_rule_params:ruleParams,source_snapshot:sourceSnapshotFromIncoming(incoming),manual_overrides:{},updated_by:currentProfile.id,created_by:currentProfile.id,updated_at:new Date().toISOString()};
        const {data:inserted,error}=await sb.from('capex_items').insert(payload).select('*').single();
        if(error)throw error; existing.push(inserted);created++;
        changedForNotifications.push({kind:'new',item:inserted});
        continue;
      }
      const row=matches[0];
      const overrides={...(row.manual_overrides||{})};
      const nextReal={...(row.realizado||{})};
      month2026Keys.forEach(key=>{nextReal[key]=applyFieldDecision(row,incoming,pendingImportPreview,incomingIndex,'realizado.'+key,overrides);});
      const payload={
        ordem:applyFieldDecision(row,incoming,pendingImportPreview,incomingIndex,'ordem',overrides),
        nome:applyFieldDecision(row,incoming,pendingImportPreview,incomingIndex,'nome',overrides),
        inicio:applyFieldDecision(row,incoming,pendingImportPreview,incomingIndex,'inicio',overrides),
        fim:applyFieldDecision(row,incoming,pendingImportPreview,incomingIndex,'fim',overrides),
        capex:applyFieldDecision(row,incoming,pendingImportPreview,incomingIndex,'capex',overrides),
        contingenciada:Boolean(applyFieldDecision(row,incoming,pendingImportPreview,incomingIndex,'contingenciada',overrides)),
        realizado:nextReal,
        source_order:incoming.source_order,
        source_snapshot:sourceSnapshotFromIncoming(incoming),
        manual_overrides:overrides,
        flow_rule:row.flow_rule||inferFlowRule(row,findBaselineWork(row),contingencyState(row.nome,row.capex)),
        flow_rule_params:row.flow_rule_params||{},
        updated_by:currentProfile.id, updated_at:new Date().toISOString()
      };
      // Tipologia não é fonte da aba PLANEJAMENTO. Para manutenção permanece fixa.
      payload.tipologia=incoming.categoria==='manutencao'?'Manutenção':(row.tipologia||'Outros');
      const appliedChanges=pendingImportPreview.changes.filter(c=>c.incomingIndex===incomingIndex&&c.kind==='changed');
      const {error}=await sb.from('capex_items').update(payload).eq('id',row.id); if(error)throw error;updated++;
      appliedChanges.forEach(change=>{
        decisionAudit.push({item_id:row.id,file_name:fileName,sheet_name:change.location?.sheet||null,excel_row:change.location?.row||null,excel_cell:change.location?.cell||null,field_name:change.field,current_value:change.current===undefined?null:change.current,incoming_value:change.incoming===undefined?null:change.incoming,decision:change.decision||'excel',severity:change.severity,decided_by:currentProfile.id});
        if(change.decision==='excel') changedForNotifications.push({kind:'change',item:{...row,...payload,id:row.id},change});
      });
    }

    for(const change of pendingImportPreview.changes.filter(c=>c.kind==='removed')){
      decisionAudit.push({item_id:change.existingId,file_name:fileName,sheet_name:change.location?.sheet||null,excel_row:null,excel_cell:null,field_name:'remoção',current_value:change.current,incoming_value:change.incoming,decision:change.decision,severity:change.severity,decided_by:currentProfile.id});
      if(change.decision==='archive'){
        const {error}=await sb.from('capex_items').update({deleted_at:new Date().toISOString(),deleted_by:currentProfile.id,updated_by:currentProfile.id,updated_at:new Date().toISOString()}).eq('id',change.existingId);if(error)throw error;archived++;
        changedForNotifications.push({kind:'removed',item:existing.find(x=>x.id===change.existingId)});
      }
    }
    await sb.from('capex_items').update({deleted_at:new Date().toISOString(),deleted_by:currentProfile.id,updated_by:currentProfile.id}).eq('categoria','obra').ilike('nome','%Pacote de Manutenção dia a dia%').is('deleted_at',null);
    const {data:history,error:historyError}=await sb.from('import_history').insert({file_name:fileName,total_records:pendingImport.length,created_records:created,updated_records:updated,ignored_records:ignored,imported_by:currentProfile.id,status:'completed'}).select('id').single();
    if(historyError)throw historyError;
    if(decisionAudit.length){decisionAudit.forEach(row=>row.import_history_id=history?.id||null);const {error:auditError}=await sb.from('capex_import_decisions').insert(decisionAudit);if(auditError)console.warn(auditError.message);}

    for(const event of changedForNotifications){
      if(event.kind==='new') await upsertNotification({key:`import-new:${history?.id}:${event.item.id}`,type:'import_new_work',priority:'info',itemId:event.item.id,title:'Nova obra adicionada',message:`${event.item.nome} foi incluída no portfólio pela importação ${fileName}.`});
      if(event.kind==='removed'&&event.item) await upsertNotification({key:`import-removed:${history?.id}:${event.item.id}`,type:'import_removed_work',priority:'warning',itemId:event.item.id,title:'Obra arquivada após importação',message:`${event.item.nome} não constava no novo Excel e foi arquivada por decisão do administrador.`});
      if(event.kind==='change'&&event.change.field==='capex'){
        const delta=num(event.change.incoming)-num(event.change.current);const pctBase=Math.abs(num(event.change.current));const pctChange=pctBase>0?Math.abs(delta)/pctBase:1;
        if(Math.abs(delta)>=100000||pctChange>=0.10) await upsertNotification({key:`import-capex:${history?.id}:${event.item.id}`,type:'import_capex_change',priority:'warning',itemId:event.item.id,title:'CAPEX alterado na importação',message:`${event.item.nome}: ${brlValue(event.change.current)} → ${brlValue(event.change.incoming)} (${delta>=0?'+':''}${brlValue(delta)}).`});
      }
    }
    $('#importStatus').textContent=`Importação concluída: ${created} criados, ${updated} atualizados, ${archived} arquivados. Todas as decisões foram registradas. Recalculando o HAPCAPEX...`;
    setTimeout(()=>location.reload(),1400);
  }catch(error){
    $('#importStatus').textContent='Falha: '+error.message; $('#applyImport').disabled=false;
    await upsertNotification({key:`import-error:${Date.now()}`,type:'import_error',priority:'critical',title:'Importação mensal não concluída',message:`${pendingImportPreview?.fileName||'Arquivo'}: ${error.message}`,audienceRole:'admin'});
  }
}

// Substitui os manipuladores V27. A V28 nunca grava o Excel antes da prévia.
$('#excelFile').onchange = async event => {
  const file=event.target.files[0]; if(!file)return;
  pendingImport=null;pendingImportPreview=null;pendingImportWorkbook=null;$('#importReviewed').checked=false;$('#applyImport').disabled=true;$('#importPreview').hidden=true;
  try{
    $('#importStatus').textContent='Analisando o Excel sem alterar o banco...';
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}); pendingImportWorkbook=workbook;
    const scope=$('#importScope')?.value||'all'; pendingImport=parseExcel(workbook,scope);
    const {data:existing,error}=await sb.from('capex_items').select('*').is('deleted_at',null);if(error)throw error;
    pendingImportPreview=analyzeImport(pendingImport,existing||[],scope); pendingImportPreview.fileName=file.name;
    const obrasCount=pendingImport.filter(item=>item.categoria==='obra'&&item.ordem!=='NAO_PLANEJADAS').length; const maintenanceCount=pendingImport.filter(item=>item.categoria==='manutencao').length;
    $('#importStatus').textContent=`Análise concluída: ${obrasCount} obras e ${maintenanceCount} registros de manutenção reconhecidos. Nenhum dado foi alterado.`;
    $('#importCheck').hidden=false; $('#importCheck').innerHTML=`<strong>Prévia obrigatória</strong><span>${pendingImportPreview.changes.length} alteração(ões) ou divergência(s) detectada(s)</span><span>Use o relatório para localizar exatamente aba, linha e célula no Excel.</span>`;
    renderImportPreview();
  }catch(error){pendingImport=null;pendingImportPreview=null;$('#importStatus').textContent='Erro: '+error.message;$('#applyImport').disabled=true;}
};
$('#applyImport').onclick=applyImportV28;
$('#importScope')?.addEventListener('change',()=>{pendingImportPreview=null;pendingImportWorkbook=null;const preview=$('#importPreview');if(preview)preview.hidden=true;});


applyMobileAppMode();

loadApp().catch(e=>{$('#loginMsg').textContent='Erro ao carregar: '+e.message;console.error(e)});
