/* HAPCAPEX V40.0.20 — UI consolidada do Controle
   Arquivo permanente para ajustes visuais e estabilidade de layout.
   Substitui: v40-ui-stability.js, v40-horizontal-lock.js e v40-stable-header.js.
*/
(() => {
  'use strict';

  const VERSION = '40.0.20';

  function injectStyles() {
    if (document.getElementById('hap-v4020-control-ui')) return;

    const style = document.createElement('style');
    style.id = 'hap-v4020-control-ui';
    style.textContent = `
      /* Reserva permanente da barra de rolagem */
      html {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden !important;
        scrollbar-gutter: stable;
      }

      @media (min-width: 721px) {
        html { overflow-y: scroll; }
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

      /*
        Desktop: três zonas estáveis.
        O tamanho do título não desloca o menu central.
      */
      @media (min-width: 981px) {
        header.topbar {
          display: grid !important;
          grid-template-columns: minmax(250px, 1fr) auto minmax(250px, 1fr) !important;
          align-items: center !important;
          column-gap: 16px !important;
          width: 100% !important;
        }

        header.topbar > :first-child {
          justify-self: start !important;
          min-width: 0 !important;
          max-width: 100% !important;
        }

        header.topbar > :first-child .brand-title {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        header.topbar > nav,
        header.topbar > .nav-wrap,
        header.topbar > .nav-pills,
        header.topbar > :nth-child(2) {
          justify-self: center !important;
          min-width: max-content !important;
        }

        header.topbar > .user-chip,
        header.topbar > :last-child {
          justify-self: end !important;
          min-width: 0 !important;
        }
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
      if (window.scrollX !== 0) {
        window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' });
      }
    } catch (_) {}
  }

  function lockAppGeometry() {
    const app = document.getElementById('app');
    if (!app) return () => {};

    const previous = {
      width: app.style.width,
      maxWidth: app.style.maxWidth,
      overflowX: app.style.overflowX
    };

    app.style.width = '100%';
    app.style.maxWidth = '100vw';
    app.style.overflowX = 'clip';
    normalizeHorizontalPosition();

    return () => {
      app.style.width = previous.width;
      app.style.maxWidth = previous.maxWidth;
      app.style.overflowX = previous.overflowX;

      normalizeHorizontalPosition();
      requestAnimationFrame(normalizeHorizontalPosition);
      setTimeout(normalizeHorizontalPosition, 40);
      setTimeout(normalizeHorizontalPosition, 120);
    };
  }

  injectStyles();
  normalizeHorizontalPosition();

  if (typeof refreshCurrent === 'function' && !window.__HAP_V4020_REFRESH_LOCKED__) {
    const originalRefreshCurrentV4020 = refreshCurrent;

    refreshCurrent = async function(...args) {
      const unlock = lockAppGeometry();
      try {
        return await originalRefreshCurrentV4020.apply(this, args);
      } finally {
        unlock();
      }
    };

    window.__HAP_V4020_REFRESH_LOCKED__ = true;
  }

  document.addEventListener('pointerdown', event => {
    const tab = event.target.closest?.('.nav-pill');
    if (!tab || tab.classList.contains('disabled')) return;
    normalizeHorizontalPosition();
  }, true);

  window.addEventListener('resize', normalizeHorizontalPosition, { passive: true });
  window.addEventListener('pageshow', normalizeHorizontalPosition, { passive: true });

  window.HAP_V40_CONTROL_UI = {
    version: VERSION,
    active: true
  };
})();
