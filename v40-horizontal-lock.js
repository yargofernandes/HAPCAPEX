/* HAPCAPEX V40.0.18 — Bloqueio definitivo de deslocamento horizontal */
(() => {
  'use strict';

  const VERSION = '40.0.18';

  function injectStyles() {
    if (document.getElementById('hap-v4018-horizontal-lock')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4018-horizontal-lock';
    style.textContent = `
      html {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden !important;
        scrollbar-gutter: stable;
      }

      body {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: hidden !important;
      }

      #app {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100vw !important;
        min-width: 0 !important;
        overflow-x: clip !important;
      }

      #app > * {
        min-width: 0;
        max-width: 100%;
      }

      .table-card {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: auto !important;
        overscroll-behavior-x: contain;
      }

      .toolbar,
      header.topbar,
      .kpi-grid {
        max-width: 100%;
        min-width: 0;
      }

      @supports not (overflow: clip) {
        #app { overflow-x: hidden !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeHorizontalPosition() {
    try {
      if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0;
      if (document.body && document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
      if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' });
    } catch (_) {}
  }

  function lockAppGeometry() {
    const app = document.getElementById('app');
    if (!app) return () => {};
    const old = {
      width: app.style.width,
      maxWidth: app.style.maxWidth,
      overflowX: app.style.overflowX
    };
    app.style.width = '100%';
    app.style.maxWidth = '100vw';
    app.style.overflowX = 'clip';
    normalizeHorizontalPosition();

    return () => {
      app.style.width = old.width;
      app.style.maxWidth = old.maxWidth;
      app.style.overflowX = old.overflowX;
      normalizeHorizontalPosition();
      requestAnimationFrame(normalizeHorizontalPosition);
      setTimeout(normalizeHorizontalPosition, 40);
      setTimeout(normalizeHorizontalPosition, 120);
    };
  }

  injectStyles();
  normalizeHorizontalPosition();

  if (typeof refreshCurrent === 'function' && !window.__HAP_V4018_REFRESH_LOCKED__) {
    const originalRefreshCurrentV4018 = refreshCurrent;
    refreshCurrent = async function(...args) {
      const unlock = lockAppGeometry();
      try {
        return await originalRefreshCurrentV4018.apply(this, args);
      } finally {
        unlock();
      }
    };
    window.__HAP_V4018_REFRESH_LOCKED__ = true;
  }

  // Captura a troca de aba antes do handler legado iniciar o re-render.
  document.addEventListener('pointerdown', event => {
    const tab = event.target.closest?.('.nav-pill');
    if (!tab || tab.classList.contains('disabled')) return;
    normalizeHorizontalPosition();
  }, true);

  window.addEventListener('resize', normalizeHorizontalPosition, { passive: true });
  window.addEventListener('pageshow', normalizeHorizontalPosition, { passive: true });

  window.HAP_V4018_HORIZONTAL_LOCK = {
    version: VERSION,
    active: true
  };
})();
