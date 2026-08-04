const APP_VERSION = '18.0.0';
const cfg = window.CAPEX_CONFIG || {};
const sb = window.supabase.createClient(
  cfg.supabaseUrl,
  cfg.supabasePublishableKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

let currentProfile = null;
let pendingImport = null;
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
function itemToRaw(item) {
  const original = item.categoria === 'obra' ? findBaselineWork(item) : null;
  const state = item.categoria === 'obra'
    ? contingencyState(item.nome, item.capex)
    : 'active';
  const isCurrentContingency = state !== 'active';
  const raw = {
    nome: normalizedContingencyName(item.nome, state),
    ordem: item.categoria === 'manutencao' ? String(item.ordem || '').replace(/#\d+$/, '') : item.ordem,
    inicio: isCurrentContingency ? fmtDate(item.inicio) : (original?.inicio || fmtDate(item.inicio)),
    fim: isCurrentContingency ? fmtDate(item.fim) : (original?.fim || fmtDate(item.fim)),
    // O CAPEX exibido nas tabelas, tipologias e totais deve ser sempre o valor
    // vigente da planilha/Supabase. O HTML-base continua sendo usado somente
    // para preservar o fluxo financeiro histórico já validado (_baselineFlow).
    // Usar o CAPEX antigo do HTML-base fazia o rodapé da tabela divergir do
    // KPI CAPEX Atual sempre que uma obra tinha seu orçamento revisado.
    capex: num(item.capex),
    contingenciada: state === 'full',
    _contingencyState: state,
    _sourceOrder: Number.isFinite(Number(item.source_order))
      ? Number(item.source_order)
      : (original?.sourceOrder ?? 999999),
    // Quando o estado atual é contingenciado, o fluxo aprovado anteriormente
    // deixa de valer. O cálculo passa a usar a regra de contingência total ou
    // parcial com os realizados atuais da planilha.
    _baselineFlow: isCurrentContingency ? null : (original?.flow || null),
    _baselineCapex: original ? num(original.capex) : null,
    _isOriginalBaseline: Boolean(original) && !isCurrentContingency,
    _isOper: isOperName(item.nome)
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
  if (!session) return;

  const { data: profile, error: profileError } = await sb
    .from('profiles').select('*').eq('id', session.user.id).single();
  if (profileError || !profile?.is_active) {
    await sb.auth.signOut();
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

  const [{ data: items, error: itemsError }, { data: settings, error: settingsError }] =
    await Promise.all([
      sb.from('capex_items').select('*').is('deleted_at', null),
      sb.from('capex_settings').select('*').eq('id', 'main').single()
    ]);
  if (itemsError) throw itemsError;
  if (settingsError) throw settingsError;

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
    }
  };

  $('#dashboardRoot').hidden = false;
  if (!coreLoaded) {
    coreLoaded = true;
    const script = document.createElement('script');
    script.src = 'dashboard-core.js?v=' + Date.now();
    script.onload = () => {
      applyMobileAppMode();
      initMobileAppShell();
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
$('#settingsBtn').onclick = () => {
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
      if (!ordem) continue;

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
        tipologia: 'Outros',
        contingenciada: state === 'full',
        realizado,
        source_order: index - header
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
        source_order: index - header
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
    const registration = await navigator.serviceWorker.register('./service-worker.js?v=25', { scope: './' });
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

function updateMobileHeader(screen) {
  const titles = {
    summary: 'Resumo executivo',
    works: 'Obras · acumulado YTD',
    charts: 'Gráficos financeiros',
    risks: 'Riscos e análise',
    maintenance: 'Manutenção'
  };
  const context = $('#mobileHeaderContext');
  if (context) context.textContent = titles[screen] || 'HAPCAPEX';
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

function mobileSetScreen(screen, options = {}) {
  if (!document.body.classList.contains('pwa-mobile')) return;
  const normalized = ['summary','works','charts','risks','maintenance'].includes(screen) ? screen : 'summary';
  try { window.closeKpiPanel?.(); } catch (_) {}
  try { window.closePanel?.(); } catch (_) {}
  document.body.dataset.mobileScreen = normalized;
  if (normalized === 'maintenance') {
    showCorePage('manutencao');
    if (!options.keepMaintenanceView) mobileSetMaintenanceView(document.body.dataset.manScreen || 'summary', true);
  } else {
    showCorePage('obras');
    setMobileVisibility('#page-obras [data-mobile-view]', normalized, 'mobileView');
  }
  document.querySelectorAll('#mobileBottomNav [data-mobile-screen]').forEach(button => {
    button.classList.toggle('active', button.dataset.mobileScreen === normalized);
  });
  updateMobileHeader(normalized);
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
  resizeVisibleCharts();
}

function mobileSetMaintenanceView(view, noScroll = false) {
  const normalized = ['summary','table','charts','risks'].includes(view) ? view : 'summary';
  document.body.dataset.manScreen = normalized;
  setMobileVisibility('#page-manutencao [data-man-mobile-view]', normalized, 'manMobileView');
  document.querySelectorAll('[data-mobile-man]').forEach(button => {
    button.classList.toggle('active', button.dataset.mobileMan === normalized);
  });
  const labels = { summary:'Manutenção · resumo', table:'Manutenção · obras', charts:'Manutenção · gráficos', risks:'Manutenção · riscos' };
  const context = $('#mobileHeaderContext');
  if (context && document.body.dataset.mobileScreen === 'maintenance') context.textContent = labels[normalized];
  if (!noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  resizeVisibleCharts();
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

    document.querySelectorAll('#mobileBottomNav [data-mobile-screen]').forEach(button => {
      button.addEventListener('click', () => mobileSetScreen(button.dataset.mobileScreen));
    });
    document.querySelectorAll('[data-mobile-go]').forEach(button => {
      button.addEventListener('click', () => mobileSetScreen(button.dataset.mobileGo));
    });
    document.querySelectorAll('[data-mobile-man]').forEach(button => {
      button.addEventListener('click', () => mobileSetMaintenanceView(button.dataset.mobileMan));
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

  mobileSetMaintenanceView(document.body.dataset.manScreen || 'summary', true);
  mobileSetScreen(document.body.dataset.mobileScreen || 'summary', { instant:true, keepMaintenanceView:true });
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

applyMobileAppMode();

loadApp().catch(e=>{$('#loginMsg').textContent='Erro ao carregar: '+e.message;console.error(e)});
