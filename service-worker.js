const CACHE_NAME = 'hapcapex-v40-0-30-date-planning-reminder-20260818';
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
  './v40-aporte-status.js?v=40.0.11',
  './v40-tipologia-governance.js?v=40.0.26',
  './v40-audit-performance.js?v=40.0.16',
  './v40-control-ui.js?v=40.0.28',
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
const CONTROL_SECURITY_TAG = '<script src="./v40-control-security.js?v=40.0.1"></script>';
const CONTROL_PREAUTH_TAG = '<script src="./v40-control-preauth.js?v=40.0.3"></script>';
const LOGOUT_TAG = '<script src="./v40-logout-fix.js?v=40.0.6"></script>';
const MANAGERIAL_TAG = '<script src="./v40-managerial-kpis-sort.js?v=40.0.9"></script>';
const APORTE_STATUS_TAG = '<script src="./v40-aporte-status.js?v=40.0.11"></script>';
const TIPOLOGIA_TAG = '<script src="./v40-tipologia-governance.js?v=40.0.26"></script>';
const AUDIT_PERF_TAG = '<script src="./v40-audit-performance.js?v=40.0.16"></script>';
const CONTROL_UI_TAG = '<script src="./v40-control-ui.js?v=40.0.28"></script>';

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
  const strip = v => String(v || '').replace(/\\\\s*-\\\\s*CONTIN.*$/i,'').trim();

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
  // V40.0.9 — sinal determinístico de que dashboard-core + v36-curve-addon terminaram.
  if (!text.includes('HAP_V409_CURVE_READY_EVENT')) {
    text = text.replace(
      'v36CurveAddon.onload = finishCurveBoot;\n    v36CurveAddon.onerror = finishCurveBoot;',
      `// HAP_V409_CURVE_READY_EVENT\n    const finishCurveBootV409 = () => {\n      finishCurveBoot();\n      window.dispatchEvent(new CustomEvent('hapcapex:curve-ready'));\n    };\n    v36CurveAddon.onload = finishCurveBootV409;\n    v36CurveAddon.onerror = finishCurveBootV409;`
    );
  }

  return responseWithText(response, text, 'application/javascript; charset=utf-8', {
    'x-hapcapex-security': 'v40.0.6',
    'x-hapcapex-functional': 'v40.0.30',
    'x-hapcapex-bootstrap-guard': text.includes('HAP_V40_PASSWORD_PREAUTH_CURVE') ? 'active' : 'not-applied'
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

  if (control) {
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
    text = removeVersionedScript(text, 'v40-stable-header.js');
    text = removeVersionedScript(text, 'v40-control-ui.js');
    text = removeVersionedScript(text, 'v40-work-name-sync.js');
    text = removeVersionedScript(text, 'v40-tipologia-integrity.js');

    const governancePatterns = [
      '<script src="v37-control-governance.js?v=37.0"></script>',
      '<script src="./v37-control-governance.js?v=37.0"></script>',
      '<script src="v37-control-governance.js?v=39.7.0"></script>',
      '<script src="./v37-control-governance.js?v=39.7.0"></script>'
    ];
    const marker = governancePatterns.find(tag => text.includes(tag));
    if (marker) {
      text = text.replace(marker, `${CONTROL_SECURITY_TAG}${CONTROL_HOTFIX_TAG}${marker}${CONTROL_PREAUTH_TAG}${LOGOUT_TAG}${MANAGERIAL_TAG}${APORTE_STATUS_TAG}${TIPOLOGIA_TAG}${AUDIT_PERF_TAG}${CONTROL_UI_TAG}`);
    } else {
      const initTag = '<script>init();</script>';
      const fallbackInjection = CONTROL_SECURITY_TAG + CONTROL_HOTFIX_TAG + CONTROL_PREAUTH_TAG + LOGOUT_TAG + MANAGERIAL_TAG + APORTE_STATUS_TAG + TIPOLOGIA_TAG + AUDIT_PERF_TAG + CONTROL_UI_TAG;
      if (text.includes(initTag)) text = text.replace(initTag, `${fallbackInjection}${initTag}`);
      else if (/<\/body>/i.test(text)) text = text.replace(/<\/body>/i, `${fallbackInjection}</body>`);
      else text += fallbackInjection;
    }
  } else if (index) {
    // V40.0.15 — campo Nome da obra nativo no modal Editar obra.
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
    'x-hapcapex-functional': 'v40.0.30'
  });
}

async function decorateResponse(response, url) {
  if (isBootstrapScript(url)) return decorateBootstrapResponse(response);
  return decorateHtmlResponse(response, url);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
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
