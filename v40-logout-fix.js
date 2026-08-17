/* HAPCAPEX V40.0.6 — Logout resiliente + saída mobile sem observer recursivo */
(() => {
  'use strict';

  const VERSION = '40.0.6';
  const PROJECT_REF = 'kuvwfyuhrnfsubkapeek';
  const SUPABASE_PREFIX = `sb-${PROJECT_REF}-`;
  const ACTIVITY_PREFIX = 'hapcapex:v40:lastActivity:';
  const BROADCAST_KEY = 'hapcapex:v40:logout-event';
  const MOBILE_ID = 'logout-mobile-btn';
  const LOGOUT_SELECTOR = '#logoutBtn,#logout-btn,#logout-btn2,#logout-mobile-btn';

  try {
    document.getElementById(MOBILE_ID)?.remove();
    document.getElementById('hapcapex-mobile-logout-style')?.remove();
  } catch (_) {}

  let loggingOut = false;
  let lastMobileVisible = null;

  function globalSupabaseClient() {
    try {
      if (typeof sb !== 'undefined' && sb?.auth) return sb;
    } catch (_) {}
    return null;
  }

  function clearMatchingStorage(storage, predicate) {
    if (!storage) return 0;
    const keys = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && predicate(key)) keys.push(key);
      }
      keys.forEach(key => storage.removeItem(key));
    } catch (_) {}
    return keys.length;
  }

  function clearLocalSession({ broadcast = true } = {}) {
    const shouldRemove = key => key.startsWith(SUPABASE_PREFIX) || key.startsWith(ACTIVITY_PREFIX);
    const removed = {
      local: clearMatchingStorage(window.localStorage, shouldRemove),
      session: clearMatchingStorage(window.sessionStorage, shouldRemove)
    };

    if (broadcast) {
      try {
        localStorage.setItem(BROADCAST_KEY, JSON.stringify({ at: Date.now(), version: VERSION }));
      } catch (_) {}
    }
    return removed;
  }

  function appRootUrl() {
    try { return new URL('./', window.location.href).href; }
    catch (_) { return './'; }
  }

  async function tryRemoteLogout(client) {
    if (!client?.auth) return { attempted: false, ok: false };
    try { client.auth.stopAutoRefresh?.(); } catch (_) {}
    try {
      const result = await Promise.race([
        client.auth.signOut({ scope: 'local' }),
        new Promise(resolve => setTimeout(() => resolve({ error: new Error('logout-timeout') }), 650))
      ]);
      return { attempted: true, ok: !result?.error, error: result?.error || null };
    } catch (error) {
      return { attempted: true, ok: false, error };
    }
  }

  async function logout({ navigate = true, remote = true, broadcast = true } = {}) {
    if (loggingOut) return { repeated: true };
    loggingOut = true;

    const client = globalSupabaseClient();
    let remoteResult = { attempted: false, ok: false };
    if (remote) remoteResult = await tryRemoteLogout(client);

    const removed = clearLocalSession({ broadcast });

    if (navigate) window.location.replace(appRootUrl());
    else loggingOut = false;

    return { remote: remoteResult, removed };
  }

  function isMobileViewport() {
    try {
      return window.matchMedia('(max-width: 820px)').matches ||
        (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024);
    } catch (_) {
      return window.innerWidth <= 820;
    }
  }

  function elementVisible(el) {
    if (!el || el.hidden) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    } catch (_) {}
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects?.().length);
  }

  function authenticatedUiVisible() {
    const curveToolbar = document.getElementById('adminToolbar');
    if (curveToolbar && !curveToolbar.hidden && elementVisible(curveToolbar)) return true;

    const dashboard = document.getElementById('dashboardRoot');
    if (dashboard && !dashboard.hidden && elementVisible(dashboard)) return true;

    const controlLogout = document.getElementById('logout-btn') || document.getElementById('logout-btn2');
    if (controlLogout && elementVisible(controlLogout)) return true;

    return false;
  }

  function ensureStyle() {
    if (document.getElementById('hapcapex-mobile-logout-style')) return;

    const style = document.createElement('style');
    style.id = 'hapcapex-mobile-logout-style';
    style.textContent = `
      #${MOBILE_ID}{
        position:fixed;
        right:max(14px,env(safe-area-inset-right));
        bottom:max(16px,calc(env(safe-area-inset-bottom) + 12px));
        z-index:2147483000;
        border:1px solid rgba(13,43,78,.18);
        border-radius:999px;
        padding:10px 15px;
        min-height:42px;
        background:#fff;
        color:#0d2b4e;
        font:700 13px/1 "Segoe UI",Arial,sans-serif;
        box-shadow:0 5px 20px rgba(13,43,78,.22);
        -webkit-tap-highlight-color:transparent;
        touch-action:manipulation;
      }
      #${MOBILE_ID}:active{transform:translateY(1px)}
      #${MOBILE_ID}[aria-busy="true"]{opacity:.65}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureButton() {
    if (!document.body) return null;

    ensureStyle();

    let button = document.getElementById(MOBILE_ID);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = MOBILE_ID;
      button.setAttribute('aria-label', 'Sair do HAPCAPEX');
      button.innerHTML = '<span aria-hidden="true">↪</span><span>Sair</span>';
      button.hidden = true;
      document.body.appendChild(button);
    }
    return button;
  }

  function refreshMobileLogout() {
    const button = ensureButton();
    if (!button) return;

    const show = isMobileViewport() && authenticatedUiVisible();
    if (show === lastMobileVisible) return;

    lastMobileVisible = show;
    button.hidden = !show;
  }

  function interceptLogoutClick(event) {
    const target = event.target instanceof Element ? event.target.closest(LOGOUT_SELECTOR) : null;
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    target.disabled = true;
    target.setAttribute('aria-busy', 'true');
    void logout();
  }

  document.addEventListener('click', interceptLogoutClick, true);

  let pollId = null;
  function startSafeRefresh() {
    refreshMobileLogout();
    if (pollId) clearInterval(pollId);
    pollId = setInterval(refreshMobileLogout, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSafeRefresh, { once: true });
  } else {
    startSafeRefresh();
  }

  window.addEventListener('resize', refreshMobileLogout, { passive: true });
  window.addEventListener('orientationchange', refreshMobileLogout, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshMobileLogout();
  });

  window.addEventListener('storage', event => {
    if (event.key !== BROADCAST_KEY || !event.newValue || loggingOut) return;

    loggingOut = true;
    try { globalSupabaseClient()?.auth?.stopAutoRefresh?.(); } catch (_) {}
    clearLocalSession({ broadcast: false });
    window.location.replace(appRootUrl());
  });

  window.HAP_LOGOUT_V40 = Object.freeze({
    version: VERSION,
    bootstrapped: true,
    clearLocalSession,
    logout,
    refreshMobileLogout
  });
})();
