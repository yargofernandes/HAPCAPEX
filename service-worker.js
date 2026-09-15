const CACHE_NAME = 'hapcapex-v40-0-93-remove-control-audit-20260915';
const APP_SHELL = [
  './',
  './index.html',
  './controle-capex.html',
  './styles.css?v=29',
  './config.js',
  './v31-addon.js?v=31',
  './v32-addon.js?v=32',
  './v34-module-selector.js?v=39.7.0',
  './v35-control-addon.js?v=35.6.4',
  './v36-control-integration.js?v=36.1',
  './v37-control-governance.js?v=39.7.0',
  './v36-curve-addon.js?v=38.1.0',
  './v39-global-admin.js?v=39.8.0',
  './v39-8-control-hotfix.js?v=39.8.2',
  './v40-security-hardening.js?v=40.0.0',
  './v40-control-security.js?v=40.0.1',
  './v40-control-preauth.js?v=40.0.3',
  './v40-logout-fix.js?v=40.0.6',
  './v40-managerial-kpis-sort.js?v=40.0.9',
  './v40-aporte-status.js?v=40.0.75',
  './v40-tipologia-governance.js?v=40.0.26',
  './v40-control-ui.js?v=40.0.31',
  './v40-classification-copy.js?v=40.0.60',
  './v40-classification-copy-global.js?v=40.0.84',
  './v40-control-managerial.js?v=40.0.90',
  './v40-date-local-policy.js?v=40.0.92',
  './v40-legacy-curve-edit-optional.js?v=40.0.81',
  './original-baseline.js?v=40.0.0',
  './bootstrap.js?v=37.0',
  './dashboard-core.js?v=29',
  './manifest.webmanifest?v=29',
  './hapcapex-icon-v27-180.png',
  './hapcapex-icon-v27-192.png',
  './hapcapex-icon-v27-512.png'
];

const GLOBAL_ADMIN_TAG = '<script src="./v39-global-admin.js?v=39.8.0"></script>';
const CONTROL_HOTFIX_TAG = '<script src="./v39-8-control-hotfix.js?v=39.8.2"></script>';
const CONTROL_GOVERNANCE_TAG = '<script src="./v37-control-governance.js?v=40.0.93"></script>';
const CONTROL_SECURITY_TAG = '<script src="./v40-control-security.js?v=40.0.1"></script>';
const CONTROL_PREAUTH_TAG = '<script src="./v40-control-preauth.js?v=40.0.3"></script>';
const LOGOUT_TAG = '<script src="./v40-logout-fix.js?v=40.0.6"></script>';
const MANAGERIAL_TAG = '<script src="./v40-managerial-kpis-sort.js?v=40.0.9"></script>';
const APORTE_STATUS_TAG = '<script src="./v40-aporte-status.js?v=40.0.75"></script>';
const TIPOLOGIA_TAG = '<script src="./v40-tipologia-governance.js?v=40.0.26"></script>';
const AUDIT_PERF_TAG = ''; // V40.0.93: auditoria é exclusivamente global.
const CONTROL_UI_TAG = '<script src="./v40-control-ui.js?v=40.0.31"></script>';
const CLASSIFICATION_COPY_TAG = '<script src="./v40-classification-copy.js?v=40.0.60"></script>';
const CLASSIFICATION_COPY_GLOBAL_TAG = '<script src="./v40-classification-copy-global.js?v=40.0.84"></script>';
const CONTROL_MANAGERIAL_TAG = '<script src="./v40-control-managerial.js?v=40.0.90"></script>';
const DATE_LOCAL_POLICY_TAG = '<script src="./v40-date-local-policy.js?v=40.0.92"></script>';
const LEGACY_CURVE_EDIT_OPTIONAL_TAG = '<script src="./v40-legacy-curve-edit-optional.js?v=40.0.81"></script>';

const WORK_NAME_MODAL_HTML = `<label id="v4015-work-name-field" style="grid-column:1/-1">
  Nome da obra
  <div style="display:flex;gap:8px;align-items:stretch;margin-top:4px">
    <input id="v4015-work-name" type="text" maxlength="220" autocomplete="off" style="flex:1;min-width:0">
    <button id="v4015-work-name-save" type="button" style="border:1px solid #b8c7da;background:#f5f8fc;color:#163b63;border-radius:8px;padding:0 12px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Atualizar nome</button>
  </div>
  <small id="v4015-work-name-status" style="display:block;margin-top:5px;font-size:10px;color:#61738a;line-height:1.35">
    O nome é sincronizado entre a Curva e o Controle quando a obra possui uma única OI.
  </small>
</label>`;

const WORK_NAME_INLINE_SCRIPT = `<script>
(() => {
  'use strict';
  const strip = v => String(v || '').replace(/\\s*-\\s*CONTIN.*$/i,'').trim();

  function itemAtual(){
    const id=document.getElementById('workEditId')?.value;
    return (window.HAP_STATE_ITEMS||[]).find(x=>x.id===id)||null;
  }

  function preencher(){
    const item=itemAtual();
    const input=document.getElementById('v4015-work-name');
    const status=document.getElementById('v4015-work-name-status');
    if(input && item) input.value=strip(item.nome);
    if(status){
      status.style.color='#61738a';
      status.textContent='O nome é sincronizado entre a Curva e o Controle quando a obra possui uma única OI.';
    }
  }

  async function salvar(){
    const item=itemAtual();
    const input=document.getElementById('v4015-work-name');
    const btn=document.getElementById('v4015-work-name-save');
    const status=document.getElementById('v4015-work-name-status');
    const nome=String(input?.value||'').trim();
    if(!item||!input||!btn||!status)return;
    if(typeof currentProfile==='undefined'||currentProfile?.role!=='admin')return;
    if(!nome){
      status.style.color='#a12727';
      status.textContent='Informe o nome da obra.';
      input.focus();
      return;
    }
    if(nome===strip(item.nome)){
      status.style.color='#61738a';
      status.textContent='O nome informado já é o nome atual.';
      return;
    }
    btn.disabled=true;
    status.style.color='#61738a';
    status.textContent='Salvando e sincronizando...';
    try{
      const {data,error}=await sb.rpc('renomear_obra_curva_integrado',{
        p_item_id:item.id,
        p_novo_nome:nome
      });
      if(error)throw error;
      const finalName=String(data?.nome||nome);
      item.nome=finalName;
      const raw=(window.HAP_DATA?.obrasRaw||[]).find(w=>w._id===item.id);
      if(raw)raw.nome=finalName;
      const runtime=(window.HAP_RUNTIME_OBRAS||[]).find(w=>w._id===item.id);
      if(runtime)runtime.nome=finalName;
      const identity=document.getElementById('workEditIdentity');
      if(identity)identity.textContent=(item.ordem||'')+' — '+finalName;
      input.value=strip(finalName);
      status.style.color='#187342';
      status.textContent=data?.multiplas_ois
        ? 'Nome atualizado na Curva. Como esta obra possui múltiplas OIs, o Controle não foi renomeado automaticamente.'
        : data?.controle_sincronizado
          ? 'Nome atualizado na Curva e sincronizado com o Controle de CAPEX.'
          : 'Nome atualizado na Curva.';
    }catch(err){
      status.style.color='#a12727';
      status.textContent='Falha ao atualizar o nome: '+(err?.message||String(err));
    }finally{
      btn.disabled=false;
    }
  }

  document.getElementById('v4015-work-name-save')?.addEventListener('click',salvar);
  document.getElementById('v4015-work-name')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();void salvar();}
  });

  const original=window.openWorkEditor;
  if(typeof original==='function'&&!window.__HAP_V4015_NAME_PATCHED__){
    window.openWorkEditor=function(){
      const r=original.apply(this,arguments);
      setTimeout(preencher,0);
      return r;
    };
    window.__HAP_V4015_NAME_PATCHED__=true;
  }
  setTimeout(preencher,0);
})();
</script>`;

const DATE_PLANNING_REMINDER_SCRIPT = `<script>
(() => {
  'use strict';
  if (window.__HAP_V4030_DATE_REMINDER__) return;
  window.__HAP_V4030_DATE_REMINDER__ = true;

  const form = document.getElementById('workEditForm');
  const start = document.getElementById('workEditStart');
  const end = document.getElementById('workEditEnd');
  const rule = document.getElementById('workEditRule');
  if (!form || !start || !end || !rule) return;

  const warning = document.createElement('div');
  warning.id = 'v4030-date-planning-warning';
  warning.hidden = true;
  warning.style.cssText = 'margin:10px 0;padding:10px 12px;border:1px solid #e6b64b;background:#fff7df;color:#68480d;border-radius:9px;font-size:11px;line-height:1.45';
  warning.innerHTML = '<strong>⚠ Datas alteradas — revise o planejamento</strong><br>O HAPCAPEX não mudará a regra financeira automaticamente. Se o fluxo mensal também precisar mudar, revise a <strong>Regra financeira</strong> antes ou depois de salvar.';
  const impact = document.getElementById('workEditImpact');
  if (impact?.parentNode) impact.parentNode.insertBefore(warning, impact);
  else form.querySelector('.admin-actions')?.before(warning);

  let snapshot = null;

  function currentItem(){
    const id=document.getElementById('workEditId')?.value;
    return (window.HAP_STATE_ITEMS||[]).find(x=>x.id===id)||null;
  }

  function capture(){
    const item=currentItem();
    if(!item){ snapshot=null; warning.hidden=true; return; }
    snapshot={
      id:item.id,
      inicio:item.inicio||'',
      fim:item.fim||'',
      rule:item.flow_rule||''
    };
    update();
  }

  function datesChanged(){
    if(!snapshot) return false;
    return String(start.value||'')!==String(snapshot.inicio||'') || String(end.value||'')!==String(snapshot.fim||'');
  }

  function ruleChanged(){
    if(!snapshot) return false;
    return String(rule.value||'')!==String(snapshot.rule||'');
  }

  function update(){
    warning.hidden=!datesChanged();
    if(!warning.hidden){
      warning.style.borderColor = ruleChanged() ? '#9bc9aa' : '#e6b64b';
      warning.style.background = ruleChanged() ? '#eefaf3' : '#fff7df';
      warning.style.color = ruleChanged() ? '#17643a' : '#68480d';
      warning.innerHTML = ruleChanged()
        ? '<strong>✓ Datas e regra financeira foram revisadas</strong><br>Confira o impacto abaixo antes de salvar.'
        : '<strong>⚠ Datas alteradas — planejamento ainda não revisado</strong><br>As novas datas serão salvas, mas o HAPCAPEX <strong>não trocará a regra financeira automaticamente</strong>. Se o fluxo mensal também precisar mudar, revise a <strong>Regra financeira</strong>.';
    }
  }

  start.addEventListener('input',update);
  end.addEventListener('input',update);
  rule.addEventListener('change',update);

  form.addEventListener('submit',e=>{
    if(!datesChanged() || ruleChanged()) return;
    const ok=window.confirm('Você alterou as datas da obra, mas não alterou o planejamento/regra financeira.\\n\\nAs novas datas serão salvas mantendo o planejamento atual.\\n\\nDeseja continuar?');
    if(!ok){ e.preventDefault(); e.stopImmediatePropagation(); rule.focus(); }
  },true);

  const original=window.openWorkEditor;
  if(typeof original==='function'&&!window.__HAP_V4030_EDITOR_CAPTURED__){
    window.openWorkEditor=function(){
      const r=original.apply(this,arguments);
      setTimeout(capture,0);
      return r;
    };
    window.__HAP_V4030_EDITOR_CAPTURED__=true;
  }
})();
</script>`;

const SRI = {
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js': 'sha384-AkNSQdptcXlJ0/NBZc4qGk86cDVXcCevwoWgEKIpHOEfbvlXGLlIkimQtONt8KNf',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js': 'sha384-e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js': 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'
};

function isControlPage(url) {
  return /\/controle-capex\.html$/i.test(url.pathname);
}
function isIndexPage(url) {
  return /\/index\.html$/i.test(url.pathname) || url.pathname.endsWith('/');
}
function isBootstrapScript(url) {
  return /\/bootstrap\.js$/i.test(url.pathname);
}
function isControlManagerialScript(url) {
  return /\/v40-control-managerial\.js$/i.test(url.pathname);
}
function isControlGovernanceScript(url) {
  return /\/v37-control-governance\.js$/i.test(url.pathname);
}

function addSri(html) {
  let text = html;
  Object.entries(SRI).forEach(([src, integrity]) => {
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<script\\s+src=["']${escaped}["'](?:\\s+[^>]*)?><\\/script>`, 'gi');
    text = text.replace(re, `<script src="${src}" integrity="${integrity}" crossorigin="anonymous"></script>`);
  });
  return text;
}

function removeVersionedScript(text, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<script[^>]+src=["'][^"']*${escaped}(?:\\?v=[^"']*)?["'][^>]*><\\/script>`, 'gi');
  return text.replace(re, '');
}

function responseWithText(response, text, contentType, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('content-type', contentType);
  Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(text, { status: response.status, statusText: response.statusText, headers });
}


function patchControlManagerialSource(source) {
  if (!source || source.includes('HAP_V4090_OPERATIONAL_HEAD_SCOPE')) {
    return { text: source, applied: !!source?.includes('HAP_V4090_OPERATIONAL_HEAD_SCOPE') };
  }

  const replacements = [
    [
      "  const isExcludedManagerialPackage = value => EXCLUDED_MANAGERIAL_PACKAGES.has(norm(value));",
      "  const isExcludedManagerialPackage = value => EXCLUDED_MANAGERIAL_PACKAGES.has(norm(value));\n  // HAP_V4090_OPERATIONAL_HEAD_SCOPE — bolsões financeiros não são áreas operacionais.\n  const NON_OPERATIONAL_HEADS = new Set(['SAVING SLT','SAVING C.O']);\n  const isOperationalHead = value => !NON_OPERATIONAL_HEADS.has(norm(value));"
    ],
    [
      "    const heads=aggregateFinance(ois,'head');",
      "    const heads=aggregateFinance(ois.filter(o=>isOperationalHead(o?.head)),'head');"
    ],
    [
      "    const heads=uniq(allOis().map(o=>o.head)).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));",
      "    const heads=uniq(allOis().filter(o=>isOperationalHead(o?.head)).map(o=>o.head)).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));"
    ],
    [
      "${card('v4071-chart-head','Concentração do CAPEX por HEAD','% do CAPEX atual. Exibe os principais HEADs; clique para filtrar.',true)}",
      "${card('v4071-chart-head','Concentração do CAPEX por HEAD','% do CAPEX das áreas operacionais. SAVING SLT e SAVING C.O não entram nesta análise; clique para filtrar.',true)}"
    ],
    [
      "return renderManagerialTable({id:'heads',title:'HEAD Operação',description:'Distribuição financeira e concentração dentro do universo filtrado.',rows:s.heads,columns:cols});",
      "return renderManagerialTable({id:'heads',title:'HEAD Operação',description:'Distribuição financeira entre áreas operacionais. SAVING SLT e SAVING C.O não entram nesta análise.',rows:s.heads,columns:cols});"
    ]
  ];

  let text = source;
  for (const [from, to] of replacements) {
    if (!text.includes(from)) {
      return { text: source, applied: false };
    }
    text = text.replace(from, to);
  }
  return { text, applied: true };
}

async function decorateControlManagerialResponse(response) {
  if (!response || !response.ok) return response;
  const original = await response.text();
  const patched = patchControlManagerialSource(original);
  return responseWithText(response, patched.text, 'application/javascript; charset=utf-8', {
    'x-hapcapex-functional': 'v40.0.93',
    'x-hapcapex-managerial-head-scope': patched.applied ? 'operational-only' : 'not-applied'
  });
}

async function decorateBootstrapResponse(response) {
  if (!response || !response.ok) return response;
  let text = await response.text();
  if (!text.includes('HAP_V40_PASSWORD_PREAUTH_CURVE')) {
    const re = /(\s*currentProfile\s*=\s*profile;\s*)(\$\('#authGate'\)\.hidden\s*=\s*true;)/;
    if (re.test(text)) {
      text = text.replace(re, (match, before, authGateLine) => `${before}if (profile.must_change_password) {
    // HAP_V40_PASSWORD_PREAUTH_CURVE — Fase 2: nenhum dado financeiro antes da troca.
    ${authGateLine}
    window.HAP_V40_PENDING_PASSWORD_PROFILE = profile;
    window.dispatchEvent(new CustomEvent('hapcapex:v40:password-required', { detail: { userId: session.user.id } }));
    return;
  }
  ${authGateLine}`);
    }
  }
  if (!text.includes('HAP_V409_CURVE_READY_EVENT')) {
    text = text.replace(
      'v36CurveAddon.onload = finishCurveBoot;\n    v36CurveAddon.onerror = finishCurveBoot;',
      `// HAP_V409_CURVE_READY_EVENT\n    const finishCurveBootV409 = () => {\n      finishCurveBoot();\n      window.dispatchEvent(new CustomEvent('hapcapex:curve-ready'));\n    };\n    v36CurveAddon.onload = finishCurveBootV409;\n    v36CurveAddon.onerror = finishCurveBootV409;`
    );
  }

  return responseWithText(response, text, 'application/javascript; charset=utf-8', {
    'x-hapcapex-security': 'v40.0.6',
    'x-hapcapex-functional': 'v40.0.93',
    'x-hapcapex-bootstrap-guard': text.includes('HAP_V40_PASSWORD_PREAUTH_CURVE') ? 'active' : 'not-applied'
  });
}


const CONTROL_BULK_TRANSFER_HELPERS_V4092 = "// HAP_V4092_BULK_TRANSFER_DIRECT — colagem em lote integrada diretamente ao Controle.\nconst bulkCleanCell = value => String(value ?? '').replace(/\\u00a0/g, ' ').trim();\nconst bulkEscapeHtml = value => bulkCleanCell(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\n\nfunction bulkParseBRL(value) {\n  let s = bulkCleanCell(value).replace(/^R\\$\\s*/i, '').replace(/\\s+/g, '');\n  if (!s) return NaN;\n  if (s.includes(',')) s = s.replace(/\\./g, '').replace(',', '.');\n  else if ((s.match(/\\./g) || []).length > 1) s = s.replace(/\\./g, '');\n  const valueNumber = Number(s.replace(/[^\\d+\\-.]/g, ''));\n  return Number.isFinite(valueNumber) ? Math.round(valueNumber * 100) / 100 : NaN;\n}\n\nfunction bulkParseDate(value) {\n  const s = bulkCleanCell(value);\n  if (!s) return '';\n  let y, m, d;\n  let match = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);\n  if (match) [, y, m, d] = match;\n  else {\n    match = s.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);\n    if (!match) return '';\n    [, d, m, y] = match;\n    d = String(d).padStart(2, '0');\n    m = String(m).padStart(2, '0');\n  }\n  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));\n  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(m) || dt.getUTCDate() !== Number(d)) return '';\n  return `${y}-${m}-${d}`;\n}\n\nfunction bulkSplitClipboardLine(line) {\n  if (line.includes('\\t')) return line.split('\\t').map(bulkCleanCell);\n  const trimmed = line.trim();\n  if (trimmed.includes('|')) {\n    const body = trimmed.replace(/^\\s*\\|/, '').replace(/\\|\\s*$/, '');\n    return body.split('|').map(bulkCleanCell);\n  }\n  return [bulkCleanCell(line)];\n}\n\nfunction bulkIsHeader(cells) {\n  const h = cells.map(v => bulkCleanCell(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase()).join(' ');\n  return h.includes('ORIG') && h.includes('DEST') && h.includes('VALOR');\n}\n\nfunction parseColarTransferenciasTexto(text) {\n  const rawLines = String(text || '').replace(/\\r\\n?/g, '\\n').split('\\n');\n  const rows = [];\n  const errors = [];\n  let logicalLine = 0;\n\n  rawLines.forEach((raw, sourceIndex) => {\n    if (!raw.trim()) return;\n    const cells = bulkSplitClipboardLine(raw);\n    if (cells.length && cells.every(v => /^:?-{3,}:?$/.test(bulkCleanCell(v)))) return;\n    if (bulkIsHeader(cells)) return;\n    logicalLine += 1;\n    if (cells.length < 6) {\n      errors.push(`Linha ${logicalLine}: esperadas 6 colunas; recebidas ${cells.length}.`);\n      return;\n    }\n\n    const origem = bulkCleanCell(cells[0]).replace(/\\s+/g, '');\n    const destino = bulkCleanCell(cells[1]).replace(/\\s+/g, '');\n    const valor = bulkParseBRL(cells[2]);\n    const documento = bulkCleanCell(cells[3]);\n    const justificativa = bulkCleanCell(cells.slice(4, cells.length - 1).join(' '));\n    const data = bulkParseDate(cells[cells.length - 1]);\n    const rowErrors = [];\n    if (!/^\\d{5,}$/.test(origem)) rowErrors.push('OI origem inválida');\n    if (!/^\\d{5,}$/.test(destino)) rowErrors.push('OI destino inválida');\n    if (origem && destino && origem === destino) rowErrors.push('origem e destino são iguais');\n    if (!Number.isFinite(valor) || valor <= 0) rowErrors.push('valor inválido');\n    if (!documento) rowErrors.push('documento vazio');\n    if (!data) rowErrors.push('data inválida');\n    rows.push({ linha:logicalLine, sourceLine:sourceIndex+1, origem, destino, valor, documento, justificativa, data, errors:rowErrors });\n  });\n\n  if (!rows.length && !errors.length) errors.push('Nenhuma linha de transferência foi encontrada.');\n  const docs = [...new Set(rows.map(r => r.documento).filter(Boolean))];\n  const dates = [...new Set(rows.map(r => r.data).filter(Boolean))];\n  if (docs.length > 1) errors.push('O lote contém mais de um número de documento. Cole um documento por vez.');\n  if (dates.length > 1) errors.push('O lote contém mais de uma data. Cole uma data por vez.');\n\n  const seen = new Set();\n  rows.forEach(r => {\n    const key = `${r.origem}|${r.destino}|${Number.isFinite(r.valor) ? r.valor.toFixed(2) : ''}|${r.documento}|${r.data}`;\n    if (seen.has(key)) r.errors.push('linha duplicada na própria colagem');\n    else seen.add(key);\n  });\n  return { rows, errors, documento:docs.length===1?docs[0]:'', data:dates.length===1?dates[0]:'' };\n}\n\nasync function bulkMapLimit(items, limit, worker) {\n  const results = new Array(items.length); let cursor = 0;\n  async function runner(){ while(true){ const idx=cursor++; if(idx>=items.length)return; results[idx]=await worker(items[idx],idx); } }\n  await Promise.all(Array.from({length:Math.min(limit,items.length)},runner));\n  return results;\n}\n\nfunction bulkTransferAlreadyExists(row) {\n  return (state.transferRows || []).some(t => {\n    const sameValue = Math.abs(Number(t.valor || 0) - row.valor) < 0.005;\n    const sameDate = String(t.data || '').slice(0,10) === row.data;\n    return bulkCleanCell(t.oi_origem)===row.origem && bulkCleanCell(t.oi_destino)===row.destino && bulkCleanCell(t.numero_documento)===row.documento && sameValue && sameDate;\n  });\n}\n\nasync function validarColagemTransferencias(parsed) {\n  const rows = parsed.rows.map(r => ({...r,errors:[...(r.errors||[])],warnings:[]}));\n  const uniqueOis = [...new Set(rows.flatMap(r => [r.origem,r.destino]).filter(Boolean))];\n  const infoMap = new Map();\n  await bulkMapLimit(uniqueOis,8,async oi => {\n    try {\n      const {data,error}=await sb.rpc('buscar_obra_por_oi',{p_ordem_interna:oi});\n      infoMap.set(oi,error?{existe:false,error:error.message}:(data||{existe:false}));\n    } catch(err){ infoMap.set(oi,{existe:false,error:err?.message||String(err)}); }\n  });\n\n  rows.forEach(row => {\n    const origemInfo=infoMap.get(row.origem), destinoInfo=infoMap.get(row.destino);\n    if(!origemInfo?.existe) row.errors.push(`OI origem ${row.origem} não encontrada`);\n    if(!destinoInfo?.existe) row.errors.push(`OI destino ${row.destino} não encontrada`);\n    if(origemInfo?.existe && !Number.isFinite(Number(origemInfo.saldo_disponivel))) row.errors.push(`OI origem ${row.origem} sem saldo financeiro disponível`);\n    if(origemInfo?.existe && destinoInfo?.existe && bulkCleanCell(origemInfo.pacote)!==bulkCleanCell(destinoInfo.pacote)){\n      row.rawPackageDifference=true;\n      row.warnings.push(`Pacotes: ${bulkCleanCell(origemInfo.pacote)||'sem pacote'} → ${bulkCleanCell(destinoInfo.pacote)||'sem pacote'}`);\n    } else row.rawPackageDifference=false;\n    if(bulkTransferAlreadyExists(row)) row.errors.push('transferência idêntica já consta no sistema');\n    row.origemInfo=origemInfo||null; row.destinoInfo=destinoInfo||null;\n  });\n\n  const saldoSimulado=new Map();\n  uniqueOis.forEach(oi => { const info=infoMap.get(oi); if(info?.existe && Number.isFinite(Number(info.saldo_disponivel))) saldoSimulado.set(oi,Number(info.saldo_disponivel)); });\n  rows.forEach(row => {\n    if(row.errors.length)return;\n    const atual=saldoSimulado.get(row.origem); if(!Number.isFinite(atual))return;\n    if(row.valor>atual+0.004){ row.errors.push(`saldo insuficiente na origem: disponível nesta etapa ${atual.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`); return; }\n    saldoSimulado.set(row.origem,Math.round((atual-row.valor)*100)/100);\n    if(saldoSimulado.has(row.destino)) saldoSimulado.set(row.destino,Math.round((saldoSimulado.get(row.destino)+row.valor)*100)/100);\n  });\n\n  return {...parsed,rows,valid:parsed.errors.length===0&&rows.every(r=>r.errors.length===0),total:Math.round(rows.reduce((s,r)=>s+(Number.isFinite(r.valor)?r.valor:0),0)*100)/100,rawPackageDifferences:rows.filter(r=>r.rawPackageDifference).length};\n}\n\nfunction renderColagemTransferenciasPreview(container,analysis){\n  const invalid=analysis.rows.filter(r=>r.errors.length).length;\n  const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});\n  container.innerHTML=`\n    ${analysis.errors.length?`<div class=\"error-msg\">${analysis.errors.map(bulkEscapeHtml).join('<br>')}</div>`:''}\n    <div style=\"display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 10px\"><span class=\"role-badge\">${analysis.rows.length} linha(s)</span><span class=\"role-badge\">${analysis.rows.length-invalid} válida(s)</span>${invalid?`<span class=\"role-badge\" style=\"background:#fcebeb;color:#791f1f\">${invalid} com erro</span>`:''}<span class=\"role-badge\">Total ${bulkEscapeHtml(money(analysis.total))}</span>${analysis.documento?`<span class=\"role-badge\">Doc. ${bulkEscapeHtml(analysis.documento)}</span>`:''}${analysis.data?`<span class=\"role-badge\">${bulkEscapeHtml(analysis.data.split('-').reverse().join('/'))}</span>`:''}</div>\n    ${analysis.rawPackageDifferences?`<div class=\"banner-warn\" style=\"margin:8px 0\">${analysis.rawPackageDifferences} linha(s) possuem pacotes de origem/destino diferentes. O backend aplicará a regra gerencial e bloqueará o lote caso alguma exija autorização.</div>`:''}\n    <div style=\"overflow:auto;max-height:340px;border:1px solid var(--cinza-borda);border-radius:8px\"><table style=\"min-width:980px;font-size:11px\"><thead><tr><th>#</th><th>Origem</th><th>Destino</th><th>Valor</th><th>Documento</th><th>Data</th><th>Justificativa</th><th>Status</th></tr></thead><tbody>${analysis.rows.map(r=>`<tr><td>${r.linha}</td><td>${bulkEscapeHtml(r.origem)}<br><small>${bulkEscapeHtml(r.origemInfo?.nome||'')}</small></td><td>${bulkEscapeHtml(r.destino)}<br><small>${bulkEscapeHtml(r.destinoInfo?.nome||'')}</small></td><td>${bulkEscapeHtml(money(r.valor))}</td><td>${bulkEscapeHtml(r.documento)}</td><td>${bulkEscapeHtml(r.data?r.data.split('-').reverse().join('/'):'')}</td><td style=\"white-space:normal;min-width:220px\">${bulkEscapeHtml(r.justificativa)}</td><td style=\"white-space:normal;min-width:220px\">${r.errors.length?`<span style=\"color:var(--vermelho);font-weight:700\">${r.errors.map(bulkEscapeHtml).join('<br>')}</span>`:`<span style=\"color:var(--verde);font-weight:700\">✓ OK</span>${r.warnings.length?`<br><span style=\"color:var(--amarelo-texto)\">${r.warnings.map(bulkEscapeHtml).join('<br>')}</span>`:''}`}</td></tr>`).join('')}</tbody></table></div>`;\n}\n\nfunction openColarTransferenciasModal(){\n  document.getElementById('bulk-transfer-modal-v4092')?.remove();\n  const backdrop=document.createElement('div'); backdrop.id='bulk-transfer-modal-v4092'; backdrop.className='modal-backdrop';\n  backdrop.innerHTML=`<div class=\"modal-box\" style=\"width:min(1120px,96vw)\"><h2>Colar transferências do Excel</h2><p class=\"sub\">Copie e cole as colunas nesta ordem: <strong>OI origem · OI destino · Valor · Nº documento · Justificativa · Data</strong>. Pode colar com ou sem cabeçalho.</p><div id=\"bulk-transfer-error-v4092\"></div><textarea id=\"bulk-transfer-text-v4092\" rows=\"9\" spellcheck=\"false\" style=\"width:100%;font-family:Consolas,monospace;font-size:11px;resize:vertical\" placeholder=\"50159083&#9;50159680&#9;R$ 450.000,00&#9;15359&#9;SOLICITAÇÃO...&#9;15/09/2026\"></textarea><div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0\"><button class=\"btn btn-secondary\" id=\"bulk-transfer-analisar-v4092\">Analisar colagem</button><span id=\"bulk-transfer-status-v4092\" style=\"font-size:11px;color:var(--texto-suave)\"></span></div><div id=\"bulk-transfer-preview-v4092\"></div><label id=\"bulk-transfer-auth-wrap-v4092\" style=\"display:none;align-items:center;gap:7px;margin-top:12px;font-size:11px;font-weight:700\"><input type=\"checkbox\" id=\"bulk-transfer-auth-v4092\"> Confirmo autorização do diretor caso alguma linha exija transferência entre pacotes gerenciais diferentes.</label><div class=\"modal-actions\"><button class=\"btn btn-secondary\" id=\"bulk-transfer-cancel-v4092\">Cancelar</button><button class=\"btn btn-primary\" id=\"bulk-transfer-save-v4092\" disabled>Registrar lote</button></div></div>`;\n  document.body.appendChild(backdrop);\n  const textEl=document.getElementById('bulk-transfer-text-v4092'),previewEl=document.getElementById('bulk-transfer-preview-v4092'),statusEl=document.getElementById('bulk-transfer-status-v4092'),errorEl=document.getElementById('bulk-transfer-error-v4092'),saveBtn=document.getElementById('bulk-transfer-save-v4092'),authWrap=document.getElementById('bulk-transfer-auth-wrap-v4092'),authEl=document.getElementById('bulk-transfer-auth-v4092');\n  let lastText='';\n  async function analisar(){ saveBtn.disabled=true; errorEl.innerHTML=''; statusEl.textContent='Validando OIs e saldos...'; const currentText=textEl.value; const analysis=await validarColagemTransferencias(parseColarTransferenciasTexto(currentText)); lastText=currentText; renderColagemTransferenciasPreview(previewEl,analysis); authWrap.style.display=analysis.rawPackageDifferences?'flex':'none'; statusEl.textContent=analysis.valid?'Pronto para registrar.':'Corrija as linhas destacadas.'; saveBtn.disabled=!analysis.valid; saveBtn.textContent=analysis.valid?`Registrar ${analysis.rows.length} transferência(s)`:'Registrar lote'; return analysis; }\n  document.getElementById('bulk-transfer-analisar-v4092').onclick=()=>void analisar();\n  document.getElementById('bulk-transfer-cancel-v4092').onclick=()=>backdrop.remove();\n  backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});\n  textEl.addEventListener('input',()=>{if(textEl.value!==lastText){saveBtn.disabled=true;statusEl.textContent='Conteúdo alterado — analise novamente.';}});\n  saveBtn.onclick=async()=>{ saveBtn.disabled=true; errorEl.innerHTML=''; try{ const analysis=await analisar(); if(!analysis.valid)return; const confirma=!!authEl.checked; const itens=analysis.rows.map(r=>({oi_origem:r.origem,oi_destino:r.destino,valor:r.valor,justificativa:r.justificativa||null,confirma_pacotes_diferentes:r.rawPackageDifference?confirma:false})); statusEl.textContent='Registrando lote...'; saveBtn.disabled=true; const {data,error}=await sb.rpc('criar_transferencias_lote',{p_numero_documento:analysis.documento||null,p_data:analysis.data||null,p_itens:itens}); if(error)throw error; const quantidade=Number(data?.quantidade||analysis.rows.length); backdrop.remove(); await loadTransferenciasTab(); alert(`${quantidade} transferência(s) registradas com sucesso.`); }catch(err){ errorEl.innerHTML=`<div class=\"error-msg\">${bulkEscapeHtml(err?.message||String(err))}</div>`; statusEl.textContent='Lote não registrado.'; saveBtn.disabled=false; } };\n  textEl.focus();\n}\n";

function patchControlBulkTransferSourceV4092(source) {
  if (!source) return { text: source, applied: false };
  if (source.includes('HAP_V4092_BULK_TRANSFER_DIRECT')) return { text: source, applied: true };
  const buttonTarget = `      <button class="btn btn-secondary" id="importar-transf-btn">+ Importar planilha</button>\n      <button class="btn btn-primary" id="nova-transf-btn">+ Nova transferência</button>`;
  const buttonReplacement = `      <button class="btn btn-secondary" id="importar-transf-btn">+ Importar planilha</button>\n      <button class="btn btn-secondary" id="colar-transf-btn">📋 Colar do Excel</button>\n      <button class="btn btn-primary" id="nova-transf-btn">+ Nova transferência</button>`;
  const bindingTarget = `  document.getElementById('importar-transf-btn').onclick = () => document.getElementById('import-file-input-transf').click();`;
  const bindingReplacement = bindingTarget + `\n  document.getElementById('colar-transf-btn').onclick = openColarTransferenciasModal;`;
  const helperTarget = `function openNovaTransferenciaModal() {`;
  if (!source.includes(buttonTarget) || !source.includes(bindingTarget) || !source.includes(helperTarget)) return { text: source, applied: false };
  let text = source.replace(buttonTarget, buttonReplacement);
  text = text.replace(bindingTarget, bindingReplacement);
  text = text.replace(helperTarget, CONTROL_BULK_TRANSFER_HELPERS_V4092 + '\n\n' + helperTarget);
  return { text, applied: true };
}


function patchControlGovernanceSourceV4093(source) {
  if (!source) return { text: source, applied: false };
  if (source.includes('HAP_V4093_GLOBAL_AUDIT_ONLY')) {
    return { text: source, applied: true };
  }

  // 1) Remove somente o pill AUDITORIA adicionado ao menu do Controle.
  const auditPillRe = /const extra\s*=\s*`[^`]*AUDITORIA<\/span>`;/;
  const stateAnchor = "    if (state.tab === 'doacoes') state.tab='capex';";
  const mobileAuditAnchor = "    if (text.includes('AUDITORIA')) return 'auditoria';";

  if (!auditPillRe.test(source) || !source.includes(stateAnchor) || !source.includes(mobileAuditAnchor)) {
    return { text: source, applied: false };
  }

  let text = source.replace(
    auditPillRe,
    "const extra = ''; // HAP_V4093_GLOBAL_AUDIT_ONLY — auditoria somente no módulo global."
  );

  // 2) Se uma sessão antiga ainda estiver em state.tab='auditoria', retorna ao CAPEX.
  text = text.replace(
    stateAnchor,
    stateAnchor + "\n    if (state.tab === 'auditoria') state.tab='capex';"
  );

  // 3) O menu móvel também deixa de reconhecer Auditoria como aba do Controle.
  text = text.replace(
    mobileAuditAnchor,
    "    if (text.includes('AUDITORIA')) return '';"
  );

  return { text, applied: true };
}

async function decorateControlGovernanceResponse(response) {
  if (!response || !response.ok) return response;
  const original = await response.text();
  const patched = patchControlGovernanceSourceV4093(original);
  return responseWithText(response, patched.text, 'application/javascript; charset=utf-8', {
    'x-hapcapex-functional': 'v40.0.93',
    'x-hapcapex-control-audit': patched.applied ? 'global-only' : 'not-applied'
  });
}

async function decorateHtmlResponse(response, url) {
  if (!response || !response.ok) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !isControlPage(url) && !isIndexPage(url)) return response;

  const control = isControlPage(url);
  const index = !control && isIndexPage(url);
  if (!control && !index) return response;

  let text = addSri(await response.text());
  let bulkTransferPatched = false;

  if (control) {
    const bulkPatch = patchControlBulkTransferSourceV4092(text);
    text = bulkPatch.text;
    bulkTransferPatched = bulkPatch.applied;
    text = removeVersionedScript(text, 'v40-security-hardening.js');
    text = removeVersionedScript(text, 'v40-control-security.js');
    text = removeVersionedScript(text, 'v40-control-preauth.js');
    text = removeVersionedScript(text, 'v39-8-control-hotfix.js');
    text = removeVersionedScript(text, 'v40-logout-fix.js');
    text = removeVersionedScript(text, 'v40-managerial-kpis-sort.js');
    text = removeVersionedScript(text, 'v40-aporte-status.js');
    text = removeVersionedScript(text, 'v40-tipologia-governance.js');
    text = removeVersionedScript(text, 'v40-audit-performance.js');
    text = removeVersionedScript(text, 'v40-ui-stability.js');
    text = removeVersionedScript(text, 'v40-horizontal-lock.js');
    text = removeVersionedScript(text, 'v40-stable-header.js');
    text = removeVersionedScript(text, 'v40-control-ui.js');
    text = removeVersionedScript(text, 'v40-work-name-sync.js');
    text = removeVersionedScript(text, 'v40-tipologia-integrity.js');
    text = removeVersionedScript(text, 'v40-classification-copy.js');
    text = removeVersionedScript(text, 'v40-classification-copy-global.js');
    text = removeVersionedScript(text, 'v40-control-managerial.js');
    text = removeVersionedScript(text, 'v40-date-local-policy.js');
    text = removeVersionedScript(text, 'v40-legacy-curve-edit-optional.js');

    const governancePatterns = [
      '<script src="v37-control-governance.js?v=37.0"></script>',
      '<script src="./v37-control-governance.js?v=37.0"></script>',
      '<script src="v37-control-governance.js?v=39.7.0"></script>',
      '<script src="./v37-control-governance.js?v=39.7.0"></script>'
    ];
    const marker = governancePatterns.find(tag => text.includes(tag));
    if (marker) {
      text = text.replace(marker, `${CONTROL_SECURITY_TAG}${CONTROL_HOTFIX_TAG}${CONTROL_GOVERNANCE_TAG}${CONTROL_PREAUTH_TAG}${LOGOUT_TAG}${MANAGERIAL_TAG}${APORTE_STATUS_TAG}${TIPOLOGIA_TAG}${AUDIT_PERF_TAG}${CONTROL_UI_TAG}${CLASSIFICATION_COPY_TAG}${CLASSIFICATION_COPY_GLOBAL_TAG}${CONTROL_MANAGERIAL_TAG}${DATE_LOCAL_POLICY_TAG}${LEGACY_CURVE_EDIT_OPTIONAL_TAG}`);
    } else {
      const initTag = '<script>init();</script>';
      const fallbackInjection = CONTROL_SECURITY_TAG + CONTROL_HOTFIX_TAG + CONTROL_PREAUTH_TAG + LOGOUT_TAG + MANAGERIAL_TAG + APORTE_STATUS_TAG + TIPOLOGIA_TAG + AUDIT_PERF_TAG + CONTROL_UI_TAG + CLASSIFICATION_COPY_TAG + CLASSIFICATION_COPY_GLOBAL_TAG + CONTROL_MANAGERIAL_TAG + DATE_LOCAL_POLICY_TAG + LEGACY_CURVE_EDIT_OPTIONAL_TAG;
      if (text.includes(initTag)) text = text.replace(initTag, `${fallbackInjection}${initTag}`);
      else if (/<\/body>/i.test(text)) text = text.replace(/<\/body>/i, `${fallbackInjection}</body>`);
      else text += fallbackInjection;
    }
  } else if (index) {
    if (!text.includes('id="v4015-work-name-field"')) {
      text = text.replace(
        '<div class="work-edit-grid">',
        '<div class="work-edit-grid">' + WORK_NAME_MODAL_HTML
      );
    }
    text = removeVersionedScript(text, 'v40-logout-fix.js');
    text = removeVersionedScript(text, 'v40-managerial-kpis-sort.js');
    text = removeVersionedScript(text, 'v40-aporte-status.js');
    text = removeVersionedScript(text, 'v40-tipologia-governance.js');
    text = removeVersionedScript(text, 'v40-audit-performance.js');
    text = removeVersionedScript(text, 'v40-ui-stability.js');
    text = removeVersionedScript(text, 'v40-horizontal-lock.js');
    text = removeVersionedScript(text, 'v40-stable-header.js');
    text = removeVersionedScript(text, 'v40-control-ui.js');
    text = removeVersionedScript(text, 'v40-work-name-sync.js');
    text = removeVersionedScript(text, 'v40-tipologia-integrity.js');
    let injection = '';
    if (!text.includes('v39-global-admin.js')) injection += GLOBAL_ADMIN_TAG;
    injection += LOGOUT_TAG + MANAGERIAL_TAG + APORTE_STATUS_TAG + TIPOLOGIA_TAG;
    injection += WORK_NAME_INLINE_SCRIPT + DATE_PLANNING_REMINDER_SCRIPT;
    if (/<\/body>/i.test(text)) text = text.replace(/<\/body>/i, `${injection}</body>`);
    else text += injection;
  }

  return responseWithText(response, text, 'text/html; charset=utf-8', {
    'x-hapcapex-security': 'v40.0.6',
    'x-hapcapex-functional': 'v40.0.93',
    'x-hapcapex-bulk-transfer': control ? (bulkTransferPatched ? 'direct-source-patched' : 'not-applied') : 'n/a'
  });
}

async function decorateResponse(response, url) {
  if (isBootstrapScript(url)) return decorateBootstrapResponse(response);
  if (isControlManagerialScript(url)) return decorateControlManagerialResponse(response);
  if (isControlGovernanceScript(url)) return decorateControlGovernanceResponse(response);
  return decorateHtmlResponse(response, url);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))));
    await self.clients.claim();

    // V40.0.86 — força uma navegação das abas abertas para carregar a política
    // de filtros do Gerencial com URL versionada e descartar o cache anterior.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(async client => {
      try {
        const url = new URL(client.url);
        if (url.origin !== self.location.origin) return;
        if (!/\/(?:controle-capex\.html)?(?:$|[?#])/.test(url.pathname + url.search + url.hash)) return;
        await client.navigate(client.url);
      } catch (_) {}
    }));
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const networkResponse = await fetch(request, { cache: 'no-cache' });
      const response = await decorateResponse(networkResponse, url);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return decorateResponse(cached, url);
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return decorateHtmlResponse(fallback, new URL('./index.html', self.location.href));
      }
      throw error;
    }
  })());
});
