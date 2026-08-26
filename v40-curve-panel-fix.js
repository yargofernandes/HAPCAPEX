/* HAPCAPEX V40.0.57 — Correção do ciclo do painel lateral da Curva
   Garante que abrir -> fechar -> abrir novamente funcione indefinidamente.
*/
(() => {
  'use strict';

  if (window.__HAP_V40057_CURVE_PANEL_FIX__) return;
  window.__HAP_V40057_CURVE_PANEL_FIX__ = true;

  const VERSION = '40.0.57';
  let attempts = 0;
  const maxAttempts = 240; // ~2 min em páginas que não carregam a Curva.

  function safeDestroyPanelChart() {
    let destroyed = false;

    try {
      if (typeof panelChart !== 'undefined' && panelChart) {
        try { panelChart.destroy(); } catch (_) {}
        try { panelChart = null; } catch (_) {}
        destroyed = true;
      }
    } catch (_) {}

    try {
      const canvas = document.getElementById('panel-chart');
      if (canvas && window.Chart && typeof window.Chart.getChart === 'function') {
        const orphan = window.Chart.getChart(canvas);
        if (orphan) {
          try { orphan.destroy(); } catch (_) {}
          destroyed = true;
        }
      }
    } catch (_) {}

    return destroyed;
  }

  function resetPanelVisualState() {
    const overlay = document.getElementById('obra-overlay');
    const panel = document.getElementById('obra-panel');

    overlay?.classList.remove('open');
    panel?.classList.remove('open');
    document.body?.classList.remove('mobile-panel-open');

    if (overlay) {
      overlay.style.pointerEvents = '';
      overlay.removeAttribute('aria-hidden');
    }
    if (panel) {
      panel.style.pointerEvents = '';
      panel.removeAttribute('aria-hidden');
    }
  }

  function forceOpenVisualState() {
    const overlay = document.getElementById('obra-overlay');
    const panel = document.getElementById('obra-panel');
    overlay?.classList.add('open');
    panel?.classList.add('open');
    panel?.querySelector('.obra-panel-body')?.scrollTo(0, 0);
    if (document.body?.classList.contains('pwa-mobile')) {
      document.body.classList.add('mobile-panel-open');
    }
  }

  function install() {
    attempts++;

    if (typeof window.openPanel !== 'function' || typeof window.closePanel !== 'function') {
      if (attempts < maxAttempts) setTimeout(install, 500);
      return;
    }

    if (window.openPanel.__hapV40057) return;

    const originalOpen = window.openPanel;
    const originalClose = window.closePanel;

    window.closePanel = function(...args) {
      // O gráfico da obra é encerrado no fechamento, não apenas no próximo open.
      safeDestroyPanelChart();

      let result;
      try {
        result = originalClose.apply(this, args);
      } finally {
        resetPanelVisualState();
      }
      return result;
    };

    window.openPanel = function(...args) {
      // Defesa contra instância Chart.js órfã deixada por uma abertura anterior.
      safeDestroyPanelChart();
      resetPanelVisualState();

      try {
        const result = originalOpen.apply(this, args);
        forceOpenVisualState();
        return result;
      } catch (firstError) {
        console.warn(
          `[HAPCAPEX ${VERSION}] Recuperando painel após erro de ciclo Chart.js.`,
          firstError
        );

        // Uma única tentativa de recuperação. Nunca entra em loop.
        safeDestroyPanelChart();
        resetPanelVisualState();

        try {
          const result = originalOpen.apply(this, args);
          forceOpenVisualState();
          return result;
        } catch (secondError) {
          console.error(`[HAPCAPEX ${VERSION}] Falha ao abrir painel lateral.`, secondError);
          throw secondError;
        }
      }
    };

    window.openPanel.__hapV40057 = true;
    window.closePanel.__hapV40057 = true;

    window.HAP_V40057_CURVE_PANEL_FIX = {
      version: VERSION,
      installed: true,
      destroy: safeDestroyPanelChart,
      reset: resetPanelVisualState
    };

    console.info(`[HAPCAPEX ${VERSION}] Correção do painel lateral instalada.`);
  }

  install();
})();
