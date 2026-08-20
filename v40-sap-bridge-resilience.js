/* HAPCAPEX V40.0.42 — Resiliência do SAP Bridge em operações longas.
   Corrige falso "Bridge não iniciado" durante extrações demoradas.

   1) A chamada POST /api/sap/export-consumo deixa de herdar o timeout legado
      de 210 s do frontend e passa a ter tolerância de até 15 minutos.
   2) /api/health e /api/status recebem uma janela curta de tolerância baseada
      na última resposta válida, evitando que uma única resposta lenta derrube
      visualmente o Bridge.
   3) Não altera o Bridge instalado, credenciais, SAP GUI ou dados do Supabase.
*/
(() => {
  'use strict';

  if (window.__HAP_V4042_SAP_RESILIENCE__) return;
  window.__HAP_V4042_SAP_RESILIENCE__ = true;

  const VERSION = '40.0.42';
  const BRIDGE_ORIGIN = 'http://127.0.0.1:17891';
  const EXPORT_PATH = '/api/sap/export-consumo';
  const LONG_EXPORT_TIMEOUT_MS = 15 * 60 * 1000;
  const TRANSIENT_CACHE_MS = 12 * 1000;

  const nativeFetch = window.fetch.bind(window);

  let longExportActive = false;
  let longExportStartedAt = 0;
  let longExportTimer = null;
  let visualTimer = null;

  const cache = {
    health: null,
    healthAt: 0,
    status: null,
    statusAt: 0
  };

  function requestUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      if (input && typeof input.url === 'string') return input.url;
    } catch (_) {}
    return '';
  }

  function requestMethod(input, init) {
    return String(
      init?.method ||
      (typeof Request !== 'undefined' && input instanceof Request ? input.method : '') ||
      'GET'
    ).toUpperCase();
  }

  function bridgePath(url) {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== BRIDGE_ORIGIN) return '';
      return u.pathname;
    } catch (_) {
      return '';
    }
  }

  async function rememberResponse(kind, response) {
    if (!response?.ok) return;
    try {
      const text = await response.clone().text();
      if (!text) return;
      JSON.parse(text); // valida antes de guardar
      cache[kind] = text;
      cache[kind + 'At'] = Date.now();
    } catch (_) {}
  }

  function cachedResponse(kind) {
    const text = cache[kind];
    const at = Number(cache[kind + 'At'] || 0);
    if (!text || Date.now() - at > TRANSIENT_CACHE_MS) return null;

    try {
      return new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-HAPCAPEX-Resilience': 'cached-transient'
        }
      });
    } catch (_) {
      return null;
    }
  }

  function activeModal() {
    return document.getElementById('v390-sap-modal');
  }

  function renderLongExportNotice() {
    if (!longExportActive) return;

    const modal = activeModal();
    if (!modal) return;

    const info = modal.querySelector('[data-v390-auto-info]');
    const pill = modal.querySelector('[data-v390-pill]');
    const msg = modal.querySelector('[data-v390-message]');
    const log = modal.querySelector('[data-v390-log]');

    const elapsed = Math.max(0, Math.round((Date.now() - longExportStartedAt) / 1000));
    const min = Math.floor(elapsed / 60);
    const sec = String(elapsed % 60).padStart(2, '0');

    if (info) {
      info.className = 'v390-sap-info v3982-sap-ready';
      info.innerHTML =
        '<strong>Extração SAP em andamento.</strong> ' +
        'O Bridge pode ficar ocupado por vários minutos. Não reinicie enquanto o SAP estiver processando.';
      info.dataset.v4042ExportActive = '1';
    }

    if (pill) pill.textContent = 'Bridge ocupado';
    if (msg) msg.textContent = `SAP processando a Base Consumo · ${min}:${sec}`;
    if (log) {
      const current = String(log.textContent || '');
      if (!/V40\.0\.42/.test(current)) {
        log.textContent = `${current ? current + ' · ' : ''}V40.0.42: timeout estendido ativo`;
      }
    }
  }

  function startVisualGuard() {
    if (visualTimer) clearInterval(visualTimer);
    renderLongExportNotice();
    visualTimer = setInterval(renderLongExportNotice, 500);
  }

  function stopVisualGuard() {
    if (visualTimer) {
      clearInterval(visualTimer);
      visualTimer = null;
    }
    document
      .querySelectorAll('[data-v4042-export-active]')
      .forEach(el => delete el.dataset.v4042ExportActive);
  }

  async function longExportFetch(input, init) {
    const controller = new AbortController();
    const patchedInit = { ...(init || {}), signal: controller.signal };

    longExportActive = true;
    longExportStartedAt = Date.now();
    startVisualGuard();

    longExportTimer = setTimeout(() => {
      try { controller.abort(); } catch (_) {}
    }, LONG_EXPORT_TIMEOUT_MS);

    try {
      /*
       * IMPORTANTE:
       * o signal recebido em init pertence ao timeout legado de 210 s.
       * Ele é deliberadamente substituído pelo controller de 15 min acima.
       */
      return await nativeFetch(input, patchedInit);
    } finally {
      if (longExportTimer) {
        clearTimeout(longExportTimer);
        longExportTimer = null;
      }
      longExportActive = false;
      stopVisualGuard();
    }
  }

  async function resilientProbeFetch(input, init, kind) {
    try {
      const response = await nativeFetch(input, init);
      await rememberResponse(kind, response);
      return response;
    } catch (error) {
      const fallback = cachedResponse(kind);
      if (fallback) {
        console.warn(
          `[HAPCAPEX ${VERSION}] ${kind} temporariamente indisponível; ` +
          'mantendo último estado válido do Bridge.'
        );
        return fallback;
      }
      throw error;
    }
  }

  async function hapFetch(input, init) {
    const url = requestUrl(input);
    const path = bridgePath(url);
    const method = requestMethod(input, init);

    if (path === EXPORT_PATH && method === 'POST') {
      return longExportFetch(input, init);
    }

    if (path === '/api/health' && method === 'GET') {
      return resilientProbeFetch(input, init, 'health');
    }

    if (path === '/api/status' && method === 'GET') {
      return resilientProbeFetch(input, init, 'status');
    }

    return nativeFetch(input, init);
  }

  hapFetch.__hapV4042SapResilience = true;
  hapFetch.__hapNativeFetch = nativeFetch;
  window.fetch = hapFetch;

  window.HAP_V40_SAP_RESILIENCE = {
    version: VERSION,
    exportTimeoutMs: LONG_EXPORT_TIMEOUT_MS,
    transientCacheMs: TRANSIENT_CACHE_MS,
    get active() { return longExportActive; },
    get elapsedMs() {
      return longExportActive ? Date.now() - longExportStartedAt : 0;
    },
    get cacheAge() {
      return {
        health: cache.healthAt ? Date.now() - cache.healthAt : null,
        status: cache.statusAt ? Date.now() - cache.statusAt : null
      };
    }
  };

  console.info(
    `[HAPCAPEX ${VERSION}] SAP Bridge resilience ativa: ` +
    `export timeout ${LONG_EXPORT_TIMEOUT_MS / 60000} min; ` +
    `tolerância transitória ${TRANSIENT_CACHE_MS / 1000}s.`
  );
})();
