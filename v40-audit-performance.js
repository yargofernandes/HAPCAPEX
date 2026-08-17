/* HAPCAPEX V40.0.16 — Auditoria com carregamento progressivo */
(() => {
  'use strict';

  const VERSION = '40.0.16';
  const INITIAL = 300;
  const STEP = 300;
  const BIG_STEP = 1000;

  function ensureState() {
    if (typeof state === 'undefined') return null;
    if (!state.v4016Audit) {
      state.v4016Audit = {
        limit: INITIAL,
        total: 0,
        loaded: 0,
        lastLoadMs: 0
      };
    }
    return state.v4016Audit;
  }

  function injectStyles() {
    if (document.getElementById('hap-v4016-audit-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4016-audit-style';
    style.textContent = `
      .v4016-audit-perf{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        padding:9px 11px;margin:0 0 12px;border:1px solid #c7d8ee;border-radius:9px;
        background:#eef4fc;color:#244b74;font-size:10px;line-height:1.4
      }
      .v4016-audit-perf strong{color:#0d2b4e}
      .v4016-audit-actions{display:flex;gap:6px;flex-wrap:wrap}
      .v4016-audit-actions button{
        border:1px solid #b8c7da;background:#fff;color:#163b63;border-radius:7px;
        padding:6px 9px;font:inherit;font-size:10px;font-weight:800;cursor:pointer
      }
      .v4016-audit-actions button:hover{background:#e6eef8}
      .v4016-audit-actions button:disabled{opacity:.5;cursor:default}
      @media(max-width:720px){
        .v4016-audit-perf{align-items:flex-start;flex-direction:column}
        .v4016-audit-actions{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  const originalFetchAllRows = typeof fetchAllRows === 'function' ? fetchAllRows : null;

  if (originalFetchAllRows && !window.__HAP_V4016_FETCH_PATCHED__) {
    fetchAllRows = async function(viewName, orderCol, ascending) {
      if (viewName !== 'vw_controle_auditoria_v37') {
        return originalFetchAllRows(viewName, orderCol, ascending);
      }

      const cfg = ensureState();
      const started = performance.now();

      let query = sb
        .from(viewName)
        .select('*', { count: 'exact' })
        .order(orderCol || 'created_at', { ascending: Boolean(ascending) })
        .range(0, Math.max(0, Number(cfg?.limit || INITIAL) - 1));

      const result = await query;
      if (cfg) {
        cfg.total = Number(result.count || 0);
        cfg.loaded = Array.isArray(result.data) ? result.data.length : 0;
        cfg.lastLoadMs = Math.round(performance.now() - started);
      }
      return result;
    };
    window.__HAP_V4016_FETCH_PATCHED__ = true;
  }

  function decorateAudit() {
    const cfg = ensureState();
    if (!cfg || state.tab !== 'auditoria') return;

    injectStyles();

    const filter = document.querySelector('.v37-filter-grid');
    if (!filter || document.getElementById('v4016-audit-perf')) return;

    const box = document.createElement('div');
    box.id = 'v4016-audit-perf';
    box.className = 'v4016-audit-perf';

    const more = Math.max(0, cfg.total - cfg.loaded);
    box.innerHTML = `
      <div>
        <strong>⚡ Auditoria otimizada</strong><br>
        ${Number(cfg.loaded || 0).toLocaleString('pt-BR')} de
        ${Number(cfg.total || 0).toLocaleString('pt-BR')} eventos carregados
        · ${Number(cfg.lastLoadMs || 0).toLocaleString('pt-BR')} ms.
        ${more > 0 ? 'Carregue mais somente quando precisar consultar eventos antigos.' : 'Todo o histórico disponível está carregado.'}
      </div>
      <div class="v4016-audit-actions">
        <button type="button" data-audit-more="300" ${more <= 0 ? 'disabled' : ''}>+ 300 eventos</button>
        <button type="button" data-audit-more="1000" ${more <= 0 ? 'disabled' : ''}>+ 1.000 eventos</button>
        ${cfg.limit > INITIAL ? '<button type="button" data-audit-reset="1">Voltar aos 300 recentes</button>' : ''}
      </div>`;

    filter.insertAdjacentElement('beforebegin', box);

    box.querySelectorAll('[data-audit-more]').forEach(button => {
      button.addEventListener('click', async () => {
        const amount = Number(button.dataset.auditMore || STEP);
        cfg.limit = Math.min(cfg.total || cfg.limit + amount, cfg.limit + amount);
        button.disabled = true;
        await refreshCurrent();
      });
    });

    box.querySelector('[data-audit-reset]')?.addEventListener('click', async () => {
      cfg.limit = INITIAL;
      await refreshCurrent();
    });
  }

  if (typeof refreshCurrent === 'function' && !window.__HAP_V4016_REFRESH_PATCHED__) {
    const originalRefreshCurrentV4016 = refreshCurrent;
    refreshCurrent = async function(...args) {
      const result = await originalRefreshCurrentV4016.apply(this, args);
      if (typeof state !== 'undefined' && state.tab === 'auditoria') {
        setTimeout(decorateAudit, 0);
      }
      return result;
    };
    window.__HAP_V4016_REFRESH_PATCHED__ = true;
  }

  // Para o caso de a aba já estar aberta durante atualização do SW.
  setTimeout(decorateAudit, 200);
  window.HAP_V4016_AUDIT = { version: VERSION, decorateAudit };
})();
