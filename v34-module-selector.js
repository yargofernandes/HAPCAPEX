/* HAPCAPEX V39.7 — Seleção de sistema para Administradores e Visualizadores */
(() => {
  'use strict';

  const SELECTOR_ID = 'hapcapexSystemSelectorV34';
  const STYLE_ID = 'hapcapexSystemSelectorStylesV34';

  function currentPathIsCurveRoot() {
    const name = (location.pathname.split('/').pop() || '').toLowerCase();
    return !name || name === 'index.html';
  }

  function shouldSkipSelector() {
    if (!currentPathIsCurveRoot()) return true;
    const params = new URLSearchParams(location.search);
    return params.get('hapModule') === 'curve';
  }

  function profileReady() {
    try {
      return typeof currentProfile !== 'undefined' && !!currentProfile;
    } catch (_) {
      return false;
    }
  }

  function profileLabel() {
    try {
      if (typeof currentProfile === 'undefined' || !currentProfile) return '';
      return currentProfile.full_name || currentProfile.email || '';
    } catch (_) {
      return '';
    }
  }

  function profileRole() {
    try {
      if (typeof currentProfile === 'undefined' || !currentProfile) return '';
      return currentProfile.role === 'admin' ? 'Administrador' : 'Visualizador';
    } catch (_) {
      return '';
    }
  }

  function isAdminProfile() {
    try {
      return typeof currentProfile !== 'undefined' && currentProfile?.role === 'admin';
    } catch (_) {
      return false;
    }
  }

  function authIsReady() {
    if (!profileReady()) return false;
    const gate = document.getElementById('authGate');
    if (!gate) return true;
    return gate.hidden || gate.style.display === 'none' || gate.getAttribute('aria-hidden') === 'true';
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${SELECTOR_ID}{position:fixed;inset:0;z-index:100000;background:#f4f6fa;color:#1a2233;font-family:'Segoe UI',Arial,sans-serif;overflow:auto}
      #${SELECTOR_ID} *{box-sizing:border-box}
      .hap-v34-shell{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 20px}
      .hap-v34-panel{width:min(960px,100%)}
      .hap-v34-brand{display:flex;align-items:center;gap:14px;margin-bottom:28px;background:linear-gradient(100deg,#0d2b4e,#1a4b8c);padding:22px 26px;border-radius:18px;box-shadow:0 5px 18px rgba(13,43,78,.16)}
      .hap-v34-brand img{width:54px;height:54px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.18)}
      .hap-v34-eyebrow{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#ff9b4d;margin-bottom:3px}
      .hap-v34-title{font-size:26px;line-height:1.1;font-weight:800;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.14)}
      .hap-v34-subtitle{margin-top:7px;color:#d9e7f6;font-size:13px}
      .hap-v34-user{margin-left:auto;text-align:right;color:#d9e7f6;font-size:12px}
      .hap-v34-user strong{display:block;color:#fff;font-size:13px}
      .hap-v34-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
      .hap-v34-grid.viewer-only{grid-template-columns:minmax(0,1fr);max-width:470px}
      .hap-v34-card{appearance:none;width:100%;border:1px solid #dde3ee;border-radius:18px;background:#fff;padding:26px;text-align:left;cursor:pointer;box-shadow:0 4px 18px rgba(13,43,78,.07);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;font:inherit;color:inherit}
      .hap-v34-card:hover,.hap-v34-card:focus-visible{transform:translateY(-2px);box-shadow:0 9px 28px rgba(13,43,78,.12);border-color:#b8c9df;outline:none}
      .hap-v34-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:18px;background:#e8f0fb}
      .hap-v34-card.control .hap-v34-icon{background:#fff1e6}
      .hap-v34-card h2{margin:0;color:#0d2b4e;font-size:20px}
      .hap-v34-card p{margin:9px 0 0;color:#5a6882;font-size:13px;line-height:1.55}
      .hap-v34-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:18px}
      .hap-v34-tag{font-size:10px;font-weight:700;padding:5px 8px;border-radius:999px;background:#f1f5fa;color:#40536a}
      .hap-v34-enter{margin-top:22px;color:#1a4b8c;font-weight:800;font-size:12px;display:flex;align-items:center;gap:6px}
      .hap-v34-card.control .hap-v34-enter{color:#c65d13}
      .hap-v34-note{margin-top:18px;text-align:center;color:#758399;font-size:11px}
      #hapV34SwitchSystem{white-space:nowrap}
      @media(max-width:720px){
        .hap-v34-shell{align-items:flex-start;padding:24px 16px}
        .hap-v34-brand{align-items:flex-start;flex-wrap:wrap;margin-bottom:20px}
        .hap-v34-user{width:100%;margin-left:68px;text-align:left;margin-top:-7px}
        .hap-v34-title{font-size:22px}
        .hap-v34-grid{grid-template-columns:1fr;gap:12px}
        .hap-v34-card{padding:20px;border-radius:15px}
      }
    `;
    document.head.appendChild(style);
  }

  function enterCurve() {
    const url = new URL(location.href);
    url.searchParams.set('hapModule', 'curve');
    history.replaceState({ hapModule: 'curve' }, '', url.pathname + url.search + url.hash);
    document.getElementById(SELECTOR_ID)?.remove();
  }

  function enterControl() {
    if (!profileReady()) return;
    location.href = './controle-capex.html';
  }

  function returnToSelector() {
    const url = new URL(location.href);
    url.searchParams.delete('hapModule');
    url.searchParams.delete('controlAccess');
    history.replaceState({ hapModule: null }, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
    document.getElementById(SELECTOR_ID)?.remove();
    renderSelector();
  }

  function ensureCurveSwitchButton() {
    if (!currentPathIsCurveRoot() || !authIsReady()) return;
    const toolbar = document.getElementById('adminToolbar');
    const logout = document.getElementById('logoutBtn');
    if (!toolbar || !logout || toolbar.hidden || document.getElementById('hapV34SwitchSystem')) return;
    const button = document.createElement('button');
    button.id = 'hapV34SwitchSystem';
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = '⇄ Trocar sistema';
    button.setAttribute('aria-label', 'Voltar à escolha de sistema do HAPCAPEX');
    button.addEventListener('click', returnToSelector);
    toolbar.insertBefore(button, logout);
  }

  function renderSelector() {
    if (shouldSkipSelector() || document.getElementById(SELECTOR_ID) || !authIsReady()) return;
    injectStyles();
    const admin=isAdminProfile();

    const layer = document.createElement('div');
    layer.id = SELECTOR_ID;
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', 'Escolher sistema HAPCAPEX');
    layer.innerHTML = `
      <div class="hap-v34-shell">
        <main class="hap-v34-panel">
          <header class="hap-v34-brand">
            <img src="hapcapex-icon-v27-192.png" alt="" aria-hidden="true">
            <div>
              <div class="hap-v34-eyebrow">Plataforma financeira</div>
              <div class="hap-v34-title">HAPCAPEX</div>
              <div class="hap-v34-subtitle">Escolha o sistema que deseja acessar.</div>
            </div>
            <div class="hap-v34-user"><strong>${escapeHtml(profileLabel())}</strong>${escapeHtml(profileRole())}</div>
          </header>

          <section class="hap-v34-grid" aria-label="Sistemas disponíveis">
            <button type="button" class="hap-v34-card curve" id="hapV34EnterCurve">
              <div class="hap-v34-icon">📈</div>
              <h2>Curva de Capex</h2>
              <p>Planejamento mensal do CAPEX, realizado, manutenção, gráficos, riscos, notificações e acompanhamento executivo.</p>
              <div class="hap-v34-tags"><span class="hap-v34-tag">Obras</span><span class="hap-v34-tag">Manutenção</span><span class="hap-v34-tag">Riscos</span><span class="hap-v34-tag">Curva mensal</span></div>
              <div class="hap-v34-enter">Entrar na Curva de Capex →</div>
            </button>

            <button type="button" class="hap-v34-card control" id="hapV34EnterControl">
              <div class="hap-v34-icon">💰</div>
              <h2>Controle de Capex</h2>
              <p>${admin?'Controle financeiro operacional das OIs, saldos, consumo SAP e transferências.':'Consulta do CAPEX, Base O.I e Base Consumo, com atualização da Base Consumo pelo SAP.'}</p>
              <div class="hap-v34-tags"><span class="hap-v34-tag">CAPEX</span><span class="hap-v34-tag">Base O.I</span><span class="hap-v34-tag">Base Consumo</span>${admin?'<span class="hap-v34-tag">Transferências</span>':''}</div>
              <div class="hap-v34-enter">Entrar no Controle de Capex →</div>
            </button>
          </section>

          <div class="hap-v34-note">As permissões de consulta e edição seguem o perfil de cada usuário.</div>
        </main>
      </div>`;

    document.body.appendChild(layer);
    document.getElementById('hapV34EnterCurve')?.addEventListener('click', enterCurve);
    document.getElementById('hapV34EnterControl')?.addEventListener('click', enterControl);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function boot() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      ensureCurveSwitchButton();
      if (!shouldSkipSelector()) renderSelector();
      if ((document.getElementById(SELECTOR_ID) || shouldSkipSelector()) && document.getElementById('hapV34SwitchSystem')) clearInterval(timer);
      if (attempts > 240) clearInterval(timer);
    }, 250);

    const observer = new MutationObserver(() => {
      ensureCurveSwitchButton();
      if (!shouldSkipSelector()) renderSelector();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden','style','class'] });
    setTimeout(() => observer.disconnect(), 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
