/* HAPCAPEX V40.0.21 — UI estável do Controle
   Arquivo permanente para ajustes visuais.
   IMPORTANTE: esta versão NÃO intercepta refreshCurrent e NÃO altera scrollLeft.
*/
(() => {
  'use strict';

  const VERSION = '40.0.21';

  if (document.getElementById('hap-v4021-control-ui')) return;

  const style = document.createElement('style');
  style.id = 'hap-v4021-control-ui';
  style.textContent = `
    html {
      scrollbar-gutter: stable;
    }

    @media (min-width: 721px) {
      html { overflow-y: scroll; }
    }

    @media (min-width: 981px) {
      header.topbar {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 16px !important;
      }

      header.topbar > :first-child {
        flex: 0 0 250px !important;
        width: 250px !important;
        min-width: 250px !important;
        max-width: 250px !important;
        overflow: hidden !important;
      }

      header.topbar > :first-child .brand-title {
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      header.topbar > :nth-child(2) {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-wrap: nowrap !important;
        white-space: nowrap !important;
      }

      header.topbar > :last-child {
        flex: 0 0 360px !important;
        width: 360px !important;
        min-width: 360px !important;
        max-width: 360px !important;
        justify-content: flex-end !important;
        white-space: nowrap !important;
      }

      header.topbar .nav-pill {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
        word-break: keep-all !important;
      }
    }
  `;

  document.head.appendChild(style);

  window.HAP_V40_CONTROL_UI = {
    version: VERSION,
    active: true,
    mode: 'css-only'
  };
})();
