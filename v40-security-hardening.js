/* HAPCAPEX V40.0 — Security Hardening
   - baseline financeiro migrado para Supabase
   - primeira senha obrigatoria
   - logout por inatividade
   - validacao forte de senha
   - hidratacao segura do fluxo historico antes do dashboard
*/
(() => {
  'use strict';
  if (window.HAP_SECURITY_V40?.bootstrapped) return;

  const VERSION = '40.0.0';
  const DEFAULT_IDLE_MINUTES = 30;
  const IDLE_CHECK_MS = 15000;
  const ACTIVITY_WRITE_MS = 10000;
  const WARNING_MS = 2 * 60 * 1000;
  const CLIENT_WAIT_MS = 15000;
  let idleTimer = null;
  let lastActivityWrite = 0;
  let activeProfileId = null;
  let securityClient = null;
  let gateResolved = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('hap-v40-security-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v40-security-styles';
    style.textContent = `
      #hap-v40-security-gate{position:fixed;inset:0;z-index:2147483600;background:#f4f6fa;display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Segoe UI',Arial,sans-serif;color:#1a2233}
      #hap-v40-security-gate .v40-card{width:min(480px,100%);background:#fff;border:1px solid #dde3ee;border-radius:16px;box-shadow:0 14px 44px rgba(13,43,78,.16);padding:25px}
      #hap-v40-security-gate .v40-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#e07020;font-weight:800}
      #hap-v40-security-gate h2{font-size:18px;color:#0d2b4e;margin:5px 0 7px}
      #hap-v40-security-gate p{font-size:12px;color:#5a6882;line-height:1.5;margin:0 0 15px}
      #hap-v40-security-gate label{display:block;font-size:10px;font-weight:800;color:#5a6882;text-transform:uppercase;margin:11px 0 4px}
      #hap-v40-security-gate input{width:100%;padding:10px 11px;border:1px solid #cfd8e6;border-radius:9px;font:inherit;box-sizing:border-box}
      #hap-v40-security-gate .v40-rules{margin:12px 0;padding:10px 12px;border-radius:9px;background:#f4f6fa;font-size:10px;line-height:1.65;color:#5a6882}
      #hap-v40-security-gate .v40-rules span{display:block}.v40-ok{color:#147a42!important;font-weight:700}.v40-bad{color:#8d3232!important}
      #hap-v40-security-gate .v40-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:15px}
      #hap-v40-security-gate button{border:0;border-radius:9px;padding:10px 15px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
      #hap-v40-security-gate .v40-primary{background:#1a4b8c;color:#fff}.v40-secondary{background:#fff!important;color:#5a6882!important;border:1px solid #dde3ee!important}
      #hap-v40-security-gate .v40-status{font-size:11px;line-height:1.45;margin-top:10px;min-height:16px}.v40-status.error{color:#9d2828}.v40-status.success{color:#147a42}
      #hap-v40-idle-warning{position:fixed;right:16px;bottom:16px;z-index:2147483500;width:min(390px,calc(100vw - 32px));background:#fff8e6;border:1px solid #e7bd69;border-radius:12px;padding:11px 13px;box-shadow:0 8px 28px rgba(13,43,78,.16);font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#68480d;line-height:1.45}
      #hap-v40-idle-warning strong{display:block;color:#0d2b4e;margin-bottom:3px}
    `;
    document.head?.appendChild(style);
  }

  function ensureGate() {
    injectStyles();
    let gate = document.getElementById('hap-v40-security-gate');
    if (gate) return gate;
    gate = document.createElement('div');
    gate.id = 'hap-v40-security-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.innerHTML = `<div class="v40-card"><div class="v40-eyebrow">Seguranca HAPCAPEX</div><h2>Verificando sua sessao...</h2><p>Aguarde enquanto o acesso e validado.</p></div>`;
    (document.body || document.documentElement).appendChild(gate);
    return gate;
  }

  function removeGate() {
    gateResolved = true;
    document.getElementById('hap-v40-security-gate')?.remove();
  }

  function globalSupabaseClient() {
    try {
      // `sb` e um binding global lexical criado pelos scripts atuais do HAPCAPEX.
      if (typeof sb !== 'undefined' && sb?.auth) return sb;
    } catch (_) {}
    return null;
  }

  async function waitForClient() {
    const started = Date.now();
    while (Date.now() - started < CLIENT_WAIT_MS) {
      const client = globalSupabaseClient();
      if (client) return client;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return null;
  }

  function strongPasswordChecks(password) {
    const value = String(password || '');
    return {
      length: value.length >= 12,
      lower: /[a-z]/.test(value),
      upper: /[A-Z]/.test(value),
      digit: /[0-9]/.test(value),
      symbol: /[^A-Za-z0-9]/.test(value),
      noSpace: !/\s/.test(value)
    };
  }

  function isStrongPassword(password) {
    return Object.values(strongPasswordChecks(password)).every(Boolean);
  }

  function passwordError(password) {
    const c = strongPasswordChecks(password);
    if (!c.length) return 'Use pelo menos 12 caracteres.';
    if (!c.lower) return 'Inclua pelo menos uma letra minuscula.';
    if (!c.upper) return 'Inclua pelo menos uma letra maiuscula.';
    if (!c.digit) return 'Inclua pelo menos um numero.';
    if (!c.symbol) return 'Inclua pelo menos um simbolo.';
    if (!c.noSpace) return 'Nao use espacos.';
    return '';
  }

  function renderPasswordRules(container, password) {
    const c = strongPasswordChecks(password);
    const rules = [
      ['length','12 ou mais caracteres'], ['upper','uma letra maiuscula'],
      ['lower','uma letra minuscula'], ['digit','um numero'],
      ['symbol','um simbolo'], ['noSpace','sem espacos']
    ];
    container.innerHTML = rules.map(([key,label]) =>
      `<span class="${c[key] ? 'v40-ok' : 'v40-bad'}">${c[key] ? 'OK' : '-'} ${label}</span>`
    ).join('');
  }

  async function signOutAndReload(client, delay = 0) {
    clearInterval(idleTimer);
    try { if (activeProfileId) localStorage.removeItem(activityKey(activeProfileId)); } catch (_) {}
    try { await client.auth.signOut({ scope: 'local' }); }
    catch (_) { try { await client.auth.signOut(); } catch (_) {} }
    setTimeout(() => location.reload(), delay);
  }

  function renderForcedPassword(client, profile) {
    const gate = ensureGate();
    gate.innerHTML = `<form class="v40-card" id="hap-v40-password-form">
      <div class="v40-eyebrow">Primeiro acesso</div>
      <h2>Crie sua senha definitiva</h2>
      <p>${escapeHtml(profile.full_name || profile.email || 'Usuario')}, a senha fornecida pelo administrador e temporaria. O restante do HAPCAPEX fica bloqueado ate a troca.</p>
      <label>Nova senha</label><input id="hap-v40-new-password" type="password" autocomplete="new-password" minlength="12" required>
      <label>Confirmar nova senha</label><input id="hap-v40-confirm-password" type="password" autocomplete="new-password" minlength="12" required>
      <div class="v40-rules" id="hap-v40-password-rules"></div>
      <div class="v40-status" id="hap-v40-password-status" role="status"></div>
      <div class="v40-actions"><button type="button" class="v40-secondary" id="hap-v40-signout">Sair</button><button type="submit" class="v40-primary">Salvar senha definitiva</button></div>
    </form>`;
    const form = gate.querySelector('#hap-v40-password-form');
    const password = gate.querySelector('#hap-v40-new-password');
    const confirm = gate.querySelector('#hap-v40-confirm-password');
    const rules = gate.querySelector('#hap-v40-password-rules');
    const status = gate.querySelector('#hap-v40-password-status');
    renderPasswordRules(rules, '');
    password.addEventListener('input', () => renderPasswordRules(rules, password.value));
    gate.querySelector('#hap-v40-signout').onclick = () => signOutAndReload(client);
    form.onsubmit = async event => {
      event.preventDefault();
      status.className = 'v40-status';
      const value = password.value;
      if (!isStrongPassword(value)) {
        status.className = 'v40-status error';
        status.textContent = passwordError(value);
        return;
      }
      if (value !== confirm.value) {
        status.className = 'v40-status error';
        status.textContent = 'As duas senhas nao coincidem.';
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      status.textContent = 'Atualizando sua senha com seguranca...';
      try {
        const { data, error } = await client.functions.invoke('manage-capex-users', {
          body: { action: 'change_own_password', password: value }
        });
        if (error) {
          let msg = error.message || 'Nao foi possivel alterar a senha.';
          try { const body = await error.context?.json(); if (body?.error) msg = body.error; } catch (_) {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        status.className = 'v40-status success';
        status.textContent = 'Senha definitiva criada. Entre novamente com a nova senha.';
        await signOutAndReload(client, 900);
      } catch (error) {
        submit.disabled = false;
        status.className = 'v40-status error';
        status.textContent = error?.message || String(error);
      }
    };
  }

  function activityKey(profileId) { return `hapcapex:v40:lastActivity:${profileId}`; }

  function readActivity(profileId) {
    try { return Number(localStorage.getItem(activityKey(profileId)) || 0); }
    catch (_) { return 0; }
  }

  function writeActivity(profileId, force = false) {
    const now = Date.now();
    if (!force && now - lastActivityWrite < ACTIVITY_WRITE_MS) return;
    lastActivityWrite = now;
    try { localStorage.setItem(activityKey(profileId), String(now)); } catch (_) {}
    document.getElementById('hap-v40-idle-warning')?.remove();
  }

  function showIdleWarning(remainingMs) {
    const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
    let warning = document.getElementById('hap-v40-idle-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'hap-v40-idle-warning';
      document.body.appendChild(warning);
    }
    warning.innerHTML = `<strong>Sessao prestes a encerrar</strong>Por seguranca, o HAPCAPEX fara logout por inatividade em aproximadamente ${minutes} minuto(s). Qualquer interacao valida renova o contador.`;
  }

  function startIdleGuard(client, profile) {
    activeProfileId = profile.id;
    const minutes = Math.max(1, Number(window.CAPEX_CONFIG?.sessionIdleMinutes || DEFAULT_IDLE_MINUTES));
    const limitMs = minutes * 60 * 1000;
    writeActivity(profile.id, true);
    const activity = () => writeActivity(profile.id, false);
    ['pointerdown','keydown','touchstart'].forEach(name => window.addEventListener(name, activity, { passive: true, capture: true }));
    window.addEventListener('storage', event => {
      if (event.key === activityKey(profile.id)) document.getElementById('hap-v40-idle-warning')?.remove();
    });

    const check = async () => {
      const last = readActivity(profile.id) || Date.now();
      const idle = Date.now() - last;
      if (idle >= limitMs) {
        const gate = ensureGate();
        gate.innerHTML = `<div class="v40-card"><div class="v40-eyebrow">Sessao encerrada</div><h2>Logout por inatividade</h2><p>O HAPCAPEX encerrou esta sessao apos ${minutes} minutos sem atividade. Voce sera direcionado para o login.</p></div>`;
        await signOutAndReload(client, 700);
        return;
      }
      const remaining = limitMs - idle;
      if (remaining <= WARNING_MS) showIdleWarning(remaining);
    };
    idleTimer = setInterval(check, IDLE_CHECK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  }

  function hardenAdminPasswordForms() {
    const apply = () => {
      ['newUserPassword','resetUserPassword'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        input.minLength = 12;
        input.placeholder = '12+ caracteres, maiuscula, minuscula, numero e simbolo';
      });
      const help = document.querySelector('.password-security-note');
      if (help && !help.dataset.v40Password) {
        help.dataset.v40Password = '1';
        help.textContent = '🔒 Senhas temporarias devem ter 12+ caracteres, maiuscula, minuscula, numero e simbolo. No primeiro acesso o usuario sera obrigado a criar uma senha definitiva.';
      }
    };
    apply();
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !['userForm','passwordForm'].includes(form.id)) return;
      const input = form.querySelector('input[name="password"]');
      if (!input || isStrongPassword(input.value)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.getElementById(form.id === 'userForm' ? 'userFormStatus' : 'passwordFormStatus');
      if (status) {
        status.className = 'user-status error';
        status.textContent = passwordError(input.value);
      }
    }, true);
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 120000);
  }

  function hydrateHistoricalFlows() {
    const works = window.HAP_DATA?.obrasRaw;
    if (!Array.isArray(works)) return { total: 0, hydrated: 0, missing: [] };
    const historical = works.filter(work => work?._flowRule === 'historical_baseline');
    const missing = [];
    let hydrated = 0;
    historical.forEach(work => {
      const params = work?._flowRuleParams || {};
      const flow = params.historical_flow;
      if (!flow || typeof flow !== 'object' || Array.isArray(flow)) {
        missing.push(work?.ordem || work?.nome || '(sem identificacao)');
        return;
      }
      work._baselineFlow = { ...flow };
      work._baselineCapex = Number(params.historical_capex ?? Object.values(flow).reduce((s,v) => s + Number(v || 0), 0));
      work._isOriginalBaseline = true;
      if (!Number.isFinite(Number(work._sourceOrder)) && Number.isFinite(Number(params.historical_source_order))) {
        work._sourceOrder = Number(params.historical_source_order);
      }
      hydrated++;
    });
    return { total: historical.length, hydrated, missing };
  }

  function installDashboardIntegrityHook() {
    if (/controle-capex\.html$/i.test(location.pathname)) return;
    const originalAppend = Element.prototype.appendChild;
    if (originalAppend.__hapV40Wrapped) return;
    function wrappedAppend(node) {
      if (node instanceof HTMLScriptElement && /dashboard-core\.js/i.test(node.src || '')) {
        const result = hydrateHistoricalFlows();
        Element.prototype.appendChild = originalAppend;
        if (result.total && (result.hydrated !== result.total || result.missing.length)) {
          const gate = ensureGate();
          gate.innerHTML = `<div class="v40-card"><div class="v40-eyebrow">Protecao de integridade</div><h2>Fluxo historico protegido incompleto</h2><p>O dashboard foi bloqueado para evitar calculos financeiros incorretos. ${result.hydrated} de ${result.total} obras historicas foram hidratadas. Procure o administrador do HAPCAPEX.</p></div>`;
          console.error('[HAPCAPEX V40] Integridade historica bloqueou dashboard.', result);
          return node;
        }
      }
      return originalAppend.call(this, node);
    }
    wrappedAppend.__hapV40Wrapped = true;
    Element.prototype.appendChild = wrappedAppend;
  }

  async function securityGate() {
    const gate = ensureGate();
    securityClient = await waitForClient();
    if (!securityClient) {
      gate.innerHTML = `<div class="v40-card"><div class="v40-eyebrow">Falha de seguranca</div><h2>Nao foi possivel validar a sessao</h2><p>O cliente seguro do HAPCAPEX nao foi inicializado. Atualize a pagina. Se o erro persistir, contate o administrador.</p></div>`;
      return;
    }
    try {
      const { data: { session }, error: sessionError } = await securityClient.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) { removeGate(); return; }

      const { data: profile, error } = await securityClient.from('profiles')
        .select('id,email,full_name,role,is_active,must_change_password,deleted_at')
        .eq('id', session.user.id).single();
      if (error || !profile) throw error || new Error('Perfil nao encontrado.');
      if (!profile.is_active || profile.deleted_at) {
        gate.innerHTML = `<div class="v40-card"><div class="v40-eyebrow">Acesso bloqueado</div><h2>Conta inativa</h2><p>Esta conta nao possui mais acesso ao HAPCAPEX.</p></div>`;
        await signOutAndReload(securityClient, 800);
        return;
      }
      if (profile.must_change_password) {
        renderForcedPassword(securityClient, profile);
        return;
      }
      removeGate();
      startIdleGuard(securityClient, profile);
    } catch (error) {
      console.error('[HAPCAPEX V40] Falha ao validar seguranca:', error);
      gate.innerHTML = `<div class="v40-card"><div class="v40-eyebrow">Falha de seguranca</div><h2>Acesso nao liberado</h2><p>${escapeHtml(error?.message || 'Nao foi possivel validar sua sessao.')}</p><div class="v40-actions"><button class="v40-primary" onclick="location.reload()">Tentar novamente</button></div></div>`;
    }
  }

  injectStyles();
  ensureGate();
  installDashboardIntegrityHook();
  hardenAdminPasswordForms();
  setTimeout(() => void securityGate(), 0);

  window.HAP_SECURITY_V40 = {
    version: VERSION,
    bootstrapped: true,
    hydrateHistoricalFlows,
    isStrongPassword,
    strongPasswordChecks,
    get gateResolved() { return gateResolved; }
  };
})();
