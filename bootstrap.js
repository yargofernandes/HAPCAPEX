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
    ordem: item.ordem,
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
    _isOriginalBaseline: Boolean(original) && !isCurrentContingency
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
    document.body.appendChild(script);
  }
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
function parseExcel(workbook) {
  const result = [];
  let ignored = 0;
  const planningSheet = findSheet(workbook, 'PLANEJAMENTO');
  const maintenanceSheet = findSheet(workbook, 'OBRAS MANUTENÇÃO');
  if (!planningSheet || !maintenanceSheet) {
    throw new Error('As abas PLANEJAMENTO e OBRAS MANUTENÇÃO são obrigatórias.');
  }

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
    let ordem = isNonPlanned ? 'NAO_PLANEJADAS' : normalizeOrder(row[0]);
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
      // CAPEX residual maior que zero caracteriza contingenciamento parcial.
      // Somente as linhas contingenciadas com CAPEX zerado são totais.
      contingenciada: state === 'full',
      realizado,
      source_order: index - header
    });
  }

  rows = XLSX.utils.sheet_to_json(
    workbook.Sheets[maintenanceSheet],
    { header: 1, defval: '', raw: true }
  );
  header = rows.findIndex(row =>
    normalizeName(row[2]).includes('ORDEM INTERNA') &&
    normalizeName(row[3]).includes('NOME DA OBRA')
  );
  if (header < 0) throw new Error('Cabeçalho da aba OBRAS MANUTENÇÃO não encontrado.');

  for (let index = header + 1; index < rows.length; index++) {
    const row = rows[index];
    const nome = String(row[3] || '').trim();
    if (!nome) continue;
    const ordemOriginal = normalizeOrder(row[2]);
    const ordem = ordemOriginal || `SEM_OI_${simpleHash(normalizeName(nome))}`;
    const realizado = {};
    month2026Keys.forEach((key, monthIndex) => {
      realizado[key] = num(row[4 + monthIndex]);
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
  result.ignoredCount = ignored;
  return result;
}
function sameRecord(existing, incoming) {
  if (existing.categoria !== incoming.categoria) return false;
  if (existing.ordem === incoming.ordem) return true;
  if (existing.categoria === 'obra') {
    const existingTokens = new Set(orderTokens(existing.ordem));
    if (orderTokens(incoming.ordem).some(token => existingTokens.has(token))) return true;
  }
  return normalizeName(existing.nome) === normalizeName(incoming.nome);
}
function findExistingRecord(existingItems, incoming) {
  return existingItems.find(existing => sameRecord(existing, incoming));
}

$('#excelFile').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true
    });
    pendingImport = parseExcel(workbook);
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
    $('#importStatus').textContent =
      `${obrasCount} obras, ${maintenanceCount} manutenções e ` +
      `${hasNonPlanned ? '1 linha' : 'nenhuma linha'} de Obras Não Planejadas reconhecidas. ` +
      `${partialCount} contingenciamentos parciais e ${fullCount} totais identificados.` +
      (pendingImport.ignoredCount ? ` ${pendingImport.ignoredCount} linha de pacote foi ignorada.` : '');
    $('#applyImport').disabled = false;
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
    let created = 0;
    let updated = 0;
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
        updated++;
      } else {
        const { data: inserted, error } = await sb.from('capex_items')
          .insert({ ...payload, created_by: currentProfile.id })
          .select('id,categoria,ordem,nome').single();
        if (error) throw error;
        existing.push(inserted);
        created++;
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
      `Concluído: ${created} criados, ${updated} atualizados e ` +
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
$('#settingsForm').onsubmit=async e=>{e.preventDefault();if(currentProfile?.role!=='admin')return;syncDraftAndTotals();const s=window.HAP_DATA.settings,capex_conting=settingsDraft.conting.reduce((a,x)=>a+num(x.valor),0),capex_aportes=settingsDraft.aportes.reduce((a,x)=>a+num(x.valor),0);const payload={id:'main',capex_inicial:num(s.capex_inicial),capex_conting,capex_aportes,manutencao_inicial:num(s.manutencao_inicial),manutencao_atual:num(s.manutencao_atual),conting_detalhe:settingsDraft.conting,aportes_detalhe:settingsDraft.aportes,updated_by:currentProfile.id,updated_at:new Date().toISOString()};const {error}=await sb.from('capex_settings').upsert(payload);if(error)return alert(error.message);location.reload()};

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

loadApp().catch(e=>{$('#loginMsg').textContent='Erro ao carregar: '+e.message;console.error(e)});
