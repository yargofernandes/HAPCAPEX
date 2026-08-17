/* HAPCAPEX V40.0.1 — Segurança específica do Controle de Capex
   Corrige concorrência de restauração de sessão entre o Controle e o guardião V40.
   O Controle restaura a sessão; este módulo apenas valida o perfil depois disso. */
(() => {
  'use strict';
  if (window.HAP_CONTROL_SECURITY_V40?.bootstrapped) return;

  const VERSION = '40.0.1';
  const DEFAULT_IDLE_MINUTES = 30;
  const CLIENT_WAIT_MS = 15000;
  const SESSION_WAIT_MS = 20000;
  const POLL_MS = 100;
  const IDLE_CHECK_MS = 15000;
  const ACTIVITY_WRITE_MS = 10000;
  const WARNING_MS = 2 * 60 * 1000;
  let securityClient = null;
  let idleTimer = null;
  let activeProfileId = null;
  let lastActivityWrite = 0;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function injectStyles() {
    if (document.getElementById('hap-v40-control-security-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v40-control-security-styles';
    style.textContent = `
      #hap-v40-control-security-gate{position:fixed;inset:0;z-index:2147483600;background:#f4f6fa;display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Segoe UI',Arial,sans-serif;color:#1a2233}
      #hap-v40-control-security-gate .v40c-card{width:min(480px,100%);background:#fff;border:1px solid #dde3ee;border-radius:16px;box-shadow:0 14px 44px rgba(13,43,78,.16);padding:25px}
      #hap-v40-control-security-gate .v40c-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#e07020;font-weight:800}
      #hap-v40-control-security-gate h2{font-size:18px;color:#0d2b4e;margin:5px 0 7px}
      #hap-v40-control-security-gate p{font-size:12px;color:#5a6882;line-height:1.5;margin:0 0 15px}
      #hap-v40-control-security-gate label{display:block;font-size:10px;font-weight:800;color:#5a6882;text-transform:uppercase;margin:11px 0 4px}
      #hap-v40-control-security-gate input{width:100%;padding:10px 11px;border:1px solid #cfd8e6;border-radius:9px;font:inherit;box-sizing:border-box}
      #hap-v40-control-security-gate .v40c-rules{margin:12px 0;padding:10px 12px;border-radius:9px;background:#f4f6fa;font-size:10px;line-height:1.65;color:#5a6882}
      #hap-v40-control-security-gate .v40c-rules span{display:block}.v40c-ok{color:#147a42!important;font-weight:700}.v40c-bad{color:#8d3232!important}
      #hap-v40-control-security-gate .v40c-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:15px}
      #hap-v40-control-security-gate button{border:0;border-radius:9px;padding:10px 15px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
      #hap-v40-control-security-gate .v40c-primary{background:#1a4b8c;color:#fff}.v40c-secondary{background:#fff!important;color:#5a6882!important;border:1px solid #dde3ee!important}
      #hap-v40-control-security-gate .v40c-status{font-size:11px;line-height:1.45;margin-top:10px;min-height:16px}.v40c-status.error{color:#9d2828}.v40c-status.success{color:#147a42}
      #hap-v40-control-idle-warning{position:fixed;right:16px;bottom:16px;z-index:2147483500;width:min(390px,calc(100vw - 32px));background:#fff8e6;border:1px solid #e7bd69;border-radius:12px;padding:11px 13px;box-shadow:0 8px 28px rgba(13,43,78,.16);font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#68480d;line-height:1.45}
      #hap-v40-control-idle-warning strong{display:block;color:#0d2b4e;margin-bottom:3px}
    `;
    document.head?.appendChild(style);
  }

  function ensureGate() {
    injectStyles();
    let gate = document.getElementById('hap-v40-control-security-gate');
    if (gate) return gate;
    gate = document.createElement('div');
    gate.id = 'hap-v40-control-security-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.innerHTML = `<div class="v40c-card"><div class="v40c-eyebrow">Segurança HAPCAPEX</div><h2>Validando o Controle de Capex...</h2><p>A sessão será restaurada pelo próprio Controle antes da validação de segurança.</p></div>`;
    (document.body || document.documentElement).appendChild(gate);
    return gate;
  }

  function removeGate() {
    document.getElementById('hap-v40-control-security-gate')?.remove();
  }

  function globalSupabaseClient() {
    try { if (typeof sb !== 'undefined' && sb?.auth) return sb; }
    catch (_) {}
    return null;
  }

  function controlState() {
    try { return typeof state !== 'undefined' ? state : null; }
    catch (_) { return null; }
  }

  async function waitForClient() {
    const started = Date.now();
    while (Date.now() - started < CLIENT_WAIT_MS) {
      const client = globalSupabaseClient();
      if (client) return client;
      await sleep(50);
    }
    return null;
  }

  function loginIsVisible() {
    const app = document.getElementById('app');
    return !!app?.querySelector?.('.login-wrap');
  }

  async function waitForControlSession() {
    const started = Date.now();
    while (Date.now() - started < SESSION_WAIT_MS) {
      const current = controlState();
      if (current?.session?.user?.id) return current.session;
      if (loginIsVisible()) return null;
      await sleep(POLL_MS);
    }
    throw new Error('O Controle não concluiu a restauração da sessão dentro do tempo de segurança.');
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
    if (!c.lower) return 'Inclua pelo menos uma letra minúscula.';
    if (!c.upper) return 'Inclua pelo menos uma letra maiúscula.';
    if (!c.digit) return 'Inclua pelo menos um número.';
    if (!c.symbol) return 'Inclua pelo menos um símbolo.';
    if (!c.noSpace) return 'Não use espaços.';
    return '';
  }

  function renderPasswordRules(container, password) {
    const c = strongPasswordChecks(password);
    const rules = [
      ['length','12 ou mais caracteres'], ['upper','uma letra maiúscula'],
      ['lower','uma letra minúscula'], ['digit','um número'],
      ['symbol','um símbolo'], ['noSpace','sem espaços']
    ];
    container.innerHTML = rules.map(([key,label]) =>
      `<span class="${c[key] ? 'v40c-ok' : 'v40c-bad'}">${c[key] ? '✓' : '•'} ${label}</span>`
    ).join('');
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
    document.getElementById('hap-v40-control-idle-warning')?.remove();
  }

  async function signOutAndReload(client, delay = 0) {
    clearInterval(idleTimer);
    try { if (activeProfileId) localStorage.removeItem(activityKey(activeProfileId)); } catch (_) {}
    try { await client.auth.signOut({ scope: 'local' }); }
    catch (_) { try { await client.auth.signOut(); } catch (_) {} }
    setTimeout(() => location.reload(), delay);
  }

  function showIdleWarning(remainingMs) {
    const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
    let warning = document.getElementById('hap-v40-control-idle-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'hap-v40-control-idle-warning';
      document.body.appendChild(warning);
    }
    warning.innerHTML = `<strong>Sessão prestes a encerrar</strong>Por segurança, o HAPCAPEX fará logout por inatividade em aproximadamente ${minutes} minuto(s). Qualquer interação válida renova o contador.`;
  }

  function startIdleGuard(client, profile) {
    activeProfileId = profile.id;
    const minutes = Math.max(1, Number(window.CAPEX_CONFIG?.sessionIdleMinutes || DEFAULT_IDLE_MINUTES));
    const limitMs = minutes * 60 * 1000;
    writeActivity(profile.id, true);
    const activity = () => writeActivity(profile.id, false);
    ['pointerdown','keydown','touchstart'].forEach(name => window.addEventListener(name, activity, { passive:true, capture:true }));
    window.addEventListener('storage', event => {
      if (event.key === activityKey(profile.id)) document.getElementById('hap-v40-control-idle-warning')?.remove();
    });

    const check = async () => {
      const last = readActivity(profile.id) || Date.now();
      const idle = Date.now() - last;
      if (idle >= limitMs) {
        const gate = ensureGate();
        gate.innerHTML = `<div class="v40c-card"><div class="v40c-eyebrow">Sessão encerrada</div><h2>Logout por inatividade</h2><p>O HAPCAPEX encerrou esta sessão após ${minutes} minutos sem atividade. Você será direcionado para o login.</p></div>`;
        await signOutAndReload(client, 700);
        return;
      }
      const remaining = limitMs - idle;
      if (remaining <= WARNING_MS) showIdleWarning(remaining);
    };
    idleTimer = setInterval(check, IDLE_CHECK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  }

  function renderForcedPassword(client, profile) {
    const gate = ensureGate();
    gate.innerHTML = `<form class="v40c-card" id="hap-v40-control-password-form">
      <div class="v40c-eyebrow">Primeiro acesso</div>
      <h2>Crie sua senha definitiva</h2>
      <p>${escapeHtml(profile.full_name || profile.email || 'Usuário')}, a senha fornecida pelo administrador é temporária. O restante do HAPCAPEX fica bloqueado até a troca.</p>
      <label>Nova senha</label><input id="hap-v40-control-new-password" type="password" autocomplete="new-password" minlength="12" required>
      <label>Confirmar nova senha</label><input id="hap-v40-control-confirm-password" type="password" autocomplete="new-password" minlength="12" required>
      <div class="v40c-rules" id="hap-v40-control-password-rules"></div>
      <div class="v40c-status" id="hap-v40-control-password-status" role="status"></div>
      <div class="v40c-actions"><button type="button" class="v40c-secondary" id="hap-v40-control-signout">Sair</button><button type="submit" class="v40c-primary">Salvar senha definitiva</button></div>
    </form>`;
    const form = gate.querySelector('#hap-v40-control-password-form');
    const password = gate.querySelector('#hap-v40-control-new-password');
    const confirm = gate.querySelector('#hap-v40-control-confirm-password');
    const rules = gate.querySelector('#hap-v40-control-password-rules');
    const status = gate.querySelector('#hap-v40-control-password-status');
    renderPasswordRules(rules, '');
    password.addEventListener('input', () => renderPasswordRules(rules, password.value));
    gate.querySelector('#hap-v40-control-signout').onclick = () => signOutAndReload(client);
    form.onsubmit = async event => {
      event.preventDefault();
      status.className = 'v40c-status';
      const value = password.value;
      if (!isStrongPassword(value)) {
        status.className = 'v40c-status error';
        status.textContent = passwordError(value);
        return;
      }
      if (value !== confirm.value) {
        status.className = 'v40c-status error';
        status.textContent = 'As duas senhas não coincidem.';
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      status.textContent = 'Atualizando sua senha com segurança...';
      try {
        const { data, error } = await client.functions.invoke('manage-capex-users', {
          body: { action:'change_own_password', password:value }
        });
        if (error) {
          let msg = error.message || 'Não foi possível alterar a senha.';
          try { const body = await error.context?.json(); if (body?.error) msg = body.error; } catch (_) {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        status.className = 'v40c-status success';
        status.textContent = 'Senha definitiva criada. Entre novamente com a nova senha.';
        await signOutAndReload(client, 900);
      } catch (error) {
        submit.disabled = false;
        status.className = 'v40c-status error';
        status.textContent = error?.message || String(error);
      }
    };
  }

  async function securityGate() {
    const gate = ensureGate();
    securityClient = await waitForClient();
    if (!securityClient) {
      gate.innerHTML = `<div class="v40c-card"><div class="v40c-eyebrow">Falha de segurança</div><h2>Cliente de autenticação indisponível</h2><p>Atualize a página. Se o erro persistir, contate o administrador.</p></div>`;
      return;
    }
    try {
      // IMPORTANTE: não chama auth.getSession(). O Controle é o único responsável
      // pela restauração da sessão, evitando a concorrência que travava a V40.0.0.
      const session = await waitForControlSession();
      if (!session) { removeGate(); return; }

      const { data: profile, error } = await securityClient.from('profiles')
        .select('id,email,full_name,role,is_active,must_change_password,deleted_at')
        .eq('id', session.user.id).single();
      if (error || !profile) throw error || new Error('Perfil não encontrado.');
      if (!profile.is_active || profile.deleted_at) {
        gate.innerHTML = `<div class="v40c-card"><div class="v40c-eyebrow">Acesso bloqueado</div><h2>Conta inativa</h2><p>Esta conta não possui mais acesso ao HAPCAPEX.</p></div>`;
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
      console.error('[HAPCAPEX V40.0.1 Controle] Falha ao validar segurança:', error);
      gate.innerHTML = `<div class="v40c-card"><div class="v40c-eyebrow">Falha de segurança</div><h2>O Controle não concluiu a inicialização</h2><p>${escapeHtml(error?.message || 'Não foi possível validar sua sessão.')}</p><div class="v40c-actions"><button class="v40c-primary" onclick="location.reload()">Tentar novamente</button></div></div>`;
    }
  }

  injectStyles();
  ensureGate();
  setTimeout(() => void securityGate(), 0);

  window.HAP_CONTROL_SECURITY_V40 = {
    version: VERSION,
    bootstrapped: true,
    isStrongPassword,
    strongPasswordChecks,
    waitForControlSession
  };
})();
