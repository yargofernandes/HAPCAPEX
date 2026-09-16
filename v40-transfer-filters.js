/* HAPCAPEX V40.0.103 — Compatibilidade do filtro legado de Transferências
   O filtro V40.0.48 foi substituído pelo HAP_XF (filtro estilo Excel).
   Este arquivo permanece propositalmente como shim para neutralizar páginas/cache antigos
   que ainda tentem carregá-lo. Não cria linhas de filtro, botões ou contadores.
*/
(() => {
  'use strict';

  window.__HAP_V4041_TRANSFER_FILTERS__ = true;

  const STYLE_ID = 'hap-v40103-transfer-legacy-filter-shim';
  const SELECTORS = [
    '.v4041-transfer-filter-row',
    '#hap-v4041-transfer-filter-style'
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
  if (root && !window.__HAP_V40103_TRANSFER_LEGACY_FILTER_OBSERVER__) {
    const observer = new MutationObserver(cleanup);
    observer.observe(root, { childList: true, subtree: true });
    window.__HAP_V40103_TRANSFER_LEGACY_FILTER_OBSERVER__ = observer;
  }

  window.HAP_V4041_TRANSFER_FILTERS = Object.freeze({
    version: '40.0.103-compat',
    disabled: true,
    refresh: cleanup,
    clear: cleanup
  });
})();
