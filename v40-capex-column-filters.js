/* HAPCAPEX V40.0.103 — Compatibilidade do filtro legado de CAPEX
   O filtro V40.0.50 foi substituído pelo HAP_XF (filtro estilo Excel).
   Este arquivo permanece propositalmente como shim para neutralizar páginas/cache antigos
   que ainda tentem carregá-lo. Não cria filtros, botões ou contadores.
*/
(() => {
  'use strict';

  window.__HAP_V40050_CAPEX_COLUMN_FILTERS__ = true;

  const STYLE_ID = 'hap-v40103-capex-legacy-filter-shim';
  const SELECTORS = [
    '#v40050-capex-clear',
    '.v40050-capex-filter-count',
    '.v40050-capex-filter-wrap',
    '#hap-v40050-capex-column-filter-style'
  ].join(',');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `${SELECTORS}{display:none!important}`;
    (document.head || document.documentElement).appendChild(style);
  }

  function cleanup() {
    ensureStyle();
    document.querySelectorAll(SELECTORS).forEach(el => el.remove());
  }

  cleanup();

  const root = document.getElementById('app') || document.documentElement;
  if (root && !window.__HAP_V40103_CAPEX_LEGACY_FILTER_OBSERVER__) {
    const observer = new MutationObserver(cleanup);
    observer.observe(root, { childList: true, subtree: true });
    window.__HAP_V40103_CAPEX_LEGACY_FILTER_OBSERVER__ = observer;
  }

  window.HAP_V40050_CAPEX_COLUMN_FILTERS = Object.freeze({
    version: '40.0.103-compat',
    disabled: true,
    refresh: cleanup,
    clear: cleanup,
    findCapexTable: () => null
  });
})();
