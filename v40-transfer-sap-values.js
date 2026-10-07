/* HAPCAPEX V40.0.130 — Valores SAP + Transferências somente leitura para Visualizador
   - preserva a conversão pt-BR dos valores SAP (V40.0.49);
   - libera a aba Transferências ao perfil Visualizador;
   - Visualizador pode consultar e filtrar, sem ações operacionais;
   - segurança real de escrita permanece no backend/RLS/RPCs administrativos.
*/
(() => {
  'use strict';

  if (window.__HAP_V40049_TRANSFER_SAP_VALUES__) return;
  window.__HAP_V40049_TRANSFER_SAP_VALUES__ = true;

  const VERSION = '40.0.130';
  const SELECTOR = '.linha-transf input[id^="t-valor-"]';

  function parseSapMoney(value) {
    let raw = String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/R\$/gi, '')
      .trim();

    if (!raw) return null;

    let negative = false;
    if (/^\(.*\)$/.test(raw)) {
      negative = true;
      raw = raw.slice(1, -1);
    }

    raw = raw
      .replace(/\s+/g, '')
      .replace(/[^\d,.\-]/g, '');

    if (!raw || raw === '-' || raw === ',' || raw === '.') return null;

    if (raw.includes(',')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      const dots = (raw.match(/\./g) || []).length;
      if (dots === 1 && /\.\d{1,2}$/.test(raw)) {
        // ponto decimal já canônico
      } else if (dots > 0) {
        raw = raw.replace(/\./g, '');
      }
    }

    raw = raw.replace(/(?!^)-/g, '');

    let number = Number(raw);
    if (!Number.isFinite(number)) return null;
    if (negative) number = -Math.abs(number);
    return number;
  }

  function displayPtBr(value) {
    const n = typeof value === 'number' ? value : parseSapMoney(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(2).replace('.', ',');
  }

  function canonicalJs(value) {
    const n = typeof value === 'number' ? value : parseSapMoney(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(2);
  }

  function isValueInput(element) {
    return !!element?.matches?.(SELECTOR);
  }

  function prepareInput(input) {
    if (!isValueInput(input)) return;
    if (input.dataset.hapSapMoneyV40049 === '1') return;

    input.dataset.hapSapMoneyV40049 = '1';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.placeholder = '0,00';
    input.title = 'Cole o valor diretamente do SAP. Ex.: 61.345,34';

    input.addEventListener('blur', () => {
      const formatted = displayPtBr(input.value);
      if (formatted) input.value = formatted;
    });
  }

  function prepareTree(root = document) {
    if (isValueInput(root)) prepareInput(root);
    root?.querySelectorAll?.(SELECTOR).forEach(prepareInput);
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        prepareTree(node);
      }
    }
  });

  function startObserver() {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
    prepareTree(document);
  }

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });

  document.addEventListener('focusin', event => {
    if (isValueInput(event.target)) prepareInput(event.target);
  }, true);

  document.addEventListener('paste', event => {
    const input = event.target;
    if (!isValueInput(input)) return;

    prepareInput(input);
    const pasted = event.clipboardData?.getData('text') ?? '';
    const parsed = parseSapMoney(pasted);
    if (!Number.isFinite(parsed)) return;

    event.preventDefault();
    event.stopPropagation();
    input.value = displayPtBr(parsed);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);

  document.addEventListener('click', event => {
    const saveButton = event.target?.closest?.('#modal-save');
    if (!saveButton) return;

    const modal = saveButton.closest('.modal-backdrop');
    if (!modal?.querySelector('.linha-transf')) return;

    const restores = [];
    modal.querySelectorAll(SELECTOR).forEach(input => {
      prepareInput(input);
      const parsed = parseSapMoney(input.value);
      if (!Number.isFinite(parsed)) return;
      restores.push([input, displayPtBr(parsed)]);
      input.value = canonicalJs(parsed);
      input.dataset.hapCanonicalV40049 = input.value;
    });

    setTimeout(() => {
      for (const [input, formatted] of restores) {
        if (input?.isConnected) input.value = formatted;
      }
    }, 0);
  }, true);

  window.HAP_V40049_TRANSFER_SAP_VALUES = {
    version: VERSION,
    parse: parseSapMoney,
    display: displayPtBr,
    canonical: canonicalJs,
    refresh: () => prepareTree(document)
  };

  console.info(`[HAPCAPEX ${VERSION}] Valores SAP em Transferências ativo.`);
})();

/* V40.0.130 — Correção de isolamento de perfil: Viewer read-only sem afetar Admin. */
(() => {
  'use strict';

  if (window.__HAP_V40130_VIEWER_TRANSFER_READONLY__) return;
  window.__HAP_V40130_VIEWER_TRANSFER_READONLY__ = true;

  const VERSION = '40.0.130';
  const STYLE_ID = 'hap-v40130-viewer-transfer-readonly-style';
  const OPERATIONAL_SELECTORS = [
    '#importar-transf-btn',
    '#colar-transf-btn',
    '#nova-transf-btn',
    '#import-file-input-transf',
    '#import-status-transf',
    '#v40123-export-transfer'
  ];

  function getState() {
    try { return typeof state !== 'undefined' ? state : null; }
    catch (_) { return null; }
  }

  function role() {
    return String(getState()?.role || '').trim().toLowerCase();
  }

  function isViewer() {
    return role() === 'viewer';
  }

  function isAdmin() {
    return role() === 'admin';
  }

  function isTransferTab() {
    return String(getState()?.tab || '') === 'transferencias';
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    const operational = OPERATIONAL_SELECTORS.join(',');
    style.textContent = `
      body.hap-v40130-viewer-transfer :is(${operational}){display:none!important}
      body.hap-v40130-viewer-transfer .hap-v40130-transfer-action-cell{display:none!important}
      body.hap-v40130-viewer-clean .hap-v40130-viewer-hidden{display:none!important}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function transferPill() {
    const active = isTransferTab();
    return `<span class="nav-pill ${active ? 'active' : ''}" onclick="switchTab('transferencias')">TRANSFERÊNCIAS</span>`;
  }

  function ensureViewerTransferNavHtml(html) {
    if (!isViewer() || !html || typeof html !== 'string') return html;
    if (html.includes("switchTab('transferencias')")) return html;
    const pill = transferPill();
    const gerencial = html.indexOf("switchTab('gerencial')");
    if (gerencial >= 0) {
      const marker = html.lastIndexOf('<span', gerencial);
      if (marker >= 0) return html.slice(0, marker) + pill + html.slice(marker);
    }
    if (/<\/div>\s*$/.test(html)) return html.replace(/<\/div>\s*$/, pill + '</div>');
    return `<div style="display:flex;gap:6px;">${html}${pill}</div>`;
  }

  function installNavWrapper() {
    const current = window.navHtml;
    if (typeof current !== 'function') return false;
    if (current.__hapV40130ViewerTransferNav) return true;
    const wrapped = function() {
      return ensureViewerTransferNavHtml(current.apply(this, arguments));
    };
    wrapped.__hapV40130ViewerTransferNav = true;
    wrapped.__hapV40130Original = current;
    try { navHtml = window.navHtml = wrapped; }
    catch (_) { window.navHtml = wrapped; }
    return true;
  }

  function installRefreshWrapper() {
    const current = window.refreshCurrent;
    if (typeof current !== 'function') return false;
    if (current.__hapV40130ViewerTransferRefresh) return true;
    const wrapped = async function() {
      if (isViewer() && isTransferTab()) {
        if (typeof window.loadTransferenciasTab === 'function') {
          await window.loadTransferenciasTab();
          queueMicrotask(enforceProfileUi);
          return;
        }
      }
      const result = await current.apply(this, arguments);
      queueMicrotask(enforceProfileUi);
      return result;
    };
    wrapped.__hapV40130ViewerTransferRefresh = true;
    wrapped.__hapV40130Original = current;
    try { refreshCurrent = window.refreshCurrent = wrapped; }
    catch (_) { window.refreshCurrent = wrapped; }
    return true;
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function markActionColumn() {
    const table = document.querySelector('.table-card table');
    if (!table?.tHead) return;
    const headRow = table.tHead.rows?.[0];
    if (!headRow) return;
    const headers = [...headRow.cells];
    const idx = headers.findIndex(cell => normalizeText(cell.textContent) === 'ACOES');
    if (idx < 0) return;
    headRow.cells[idx]?.classList?.add('hap-v40130-transfer-action-cell');
    [...table.tBodies].forEach(tbody => {
      [...tbody.rows].forEach(row => row.cells?.[idx]?.classList?.add('hap-v40130-transfer-action-cell'));
    });
  }

  function markViewerTechnicalMessages() {
    if (!isViewer()) return;

    // Mensagens de permissão/suporte: continuam no DOM e ficam invisíveis apenas no Viewer.
    document.querySelectorAll('.v40127-viewer-transfer-note,[data-v390-viewer-note],.v394-viewer-allowed,[data-v394-info]')
      .forEach(el => el.classList.add('hap-v40130-viewer-hidden'));

    // Base Consumo: manter a última atualização e ocultar somente o texto conceitual.
    const appRoot = document.getElementById('app');
    if (appRoot) {
      [...appRoot.children].forEach(el => {
        const text = normalizeText(el.textContent);
        if (text.includes('A BASE CONSUMO E A FONTE OPERACIONAL DE COMPROMISSADO E SALDO')) {
          el.classList.add('hap-v40130-viewer-hidden');
        }
      });
    }

    // Base O.I.: o diagnóstico de consistência é administrativo, não executivo.
    document.querySelectorAll('.banner-ok,.banner-warn').forEach(el => {
      const text = normalizeText(el.textContent);
      if (text.includes('CONSISTENCIA COM O CAPEX')) el.classList.add('hap-v40130-viewer-hidden');
    });

    // Gerencial: pendências técnicas seguem disponíveis ao Admin e ocultas no Viewer.
    document.querySelectorAll('.v4071-pending').forEach(section => {
      const text = normalizeText(section.textContent);
      if (
        text.includes('OIS COM CLASSIFICACAO INCOMPLETA') ||
        text.includes('TRANSFERENCIAS HISTORICAS SEM PACOTE IDENTIFICAVEL')
      ) section.classList.add('hap-v40130-viewer-hidden');
    });
  }

  function syncRoleBadge() {
    const currentRole = role();
    if (!['viewer','admin'].includes(currentRole)) return;
    document.querySelectorAll('.role-badge').forEach(el => {
      const text = normalizeText(el.textContent);
      if (!['ADMIN','VIEWER','VISUALIZADOR','ADMINISTRADOR'].includes(text)) return;
      el.textContent = currentRole === 'viewer' ? 'Visualizador' : 'Admin';
    });
  }

  function enforceProfileUi() {
    injectStyle();
    const body = document.body;
    if (!body) return;

    const viewer = isViewer();
    const viewerTransfer = viewer && isTransferTab();
    body.classList.toggle('hap-v40130-viewer-clean', viewer);
    body.classList.toggle('hap-v40130-viewer-transfer', viewerTransfer);

    // Remove classes legadas para evitar que uma versão anterior permaneça influenciando o Admin.
    body.classList.remove('hap-v40127-viewer-transfer','hap-v40128-viewer-clean');

    syncRoleBadge();
    if (!viewer) return;

    markViewerTechnicalMessages();
    if (!viewerTransfer) return;

    // Não removemos elementos do DOM. O isolamento entre perfis é feito por CSS + backend.
    markActionColumn();
    ensureMobileTransferButton();
  }

  function ensureMobileTransferButton() {
    if (!isViewer()) return;
    const dock = document.getElementById('v380-control-dock');
    if (!dock) return;
    let button = dock.querySelector('[data-v380-tab="transferencias"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.v380Tab = 'transferencias';
      button.innerHTML = '<span class="v380-icon">⇄</span><small>Transf.</small>';
      const more = dock.querySelector('[data-v380-more]');
      if (more) dock.insertBefore(button, more); else dock.appendChild(button);
      button.addEventListener('click', () => {
        try { window.switchTab?.('transferencias'); } catch (_) {}
        setTimeout(enforceProfileUi, 0);
        try { window.scrollTo({ top:0, behavior:'smooth' }); } catch (_) {}
      });
    }
    button.classList.toggle('active', isTransferTab());
    const visibleButtons = dock.querySelectorAll('button:not([hidden])').length;
    if (visibleButtons > 0) dock.style.gridTemplateColumns = `repeat(${visibleButtons},1fr)`;
  }

  function installRenderWrapper() {
    const current = window.renderTransferenciasTab;
    if (typeof current !== 'function') return false;
    if (current.__hapV40130ViewerTransferRender) return true;
    const wrapped = function() {
      const result = current.apply(this, arguments);
      queueMicrotask(enforceProfileUi);
      return result;
    };
    wrapped.__hapV40130ViewerTransferRender = true;
    wrapped.__hapV40130Original = current;
    try { renderTransferenciasTab = window.renderTransferenciasTab = wrapped; }
    catch (_) { window.renderTransferenciasTab = wrapped; }
    return true;
  }

  function blockViewerMutationFunction(name) {
    const current = window[name];
    if (typeof current !== 'function') return false;
    if (current.__hapV40130ViewerBlocked) return true;
    const wrapped = function() {
      if (isViewer()) {
        console.warn(`[HAPCAPEX ${VERSION}] Ação ${name} bloqueada para Visualizador.`);
        return undefined;
      }
      return current.apply(this, arguments);
    };
    wrapped.__hapV40130ViewerBlocked = true;
    wrapped.__hapV40130Original = current;
    window[name] = wrapped;
    try {
      if (name === 'openNovaTransferenciaModal') openNovaTransferenciaModal = wrapped;
      else if (name === 'editarTransferencia') editarTransferencia = wrapped;
      else if (name === 'excluirTransferencia') excluirTransferencia = wrapped;
      else if (name === 'importarArquivoTransferencias') importarArquivoTransferencias = wrapped;
      else if (name === 'openColarTransferenciasModal') openColarTransferenciasModal = wrapped;
    } catch (_) {}
    return true;
  }

  function installMutationGuards() {
    ['openNovaTransferenciaModal','editarTransferencia','excluirTransferencia','importarArquivoTransferencias','openColarTransferenciasModal']
      .forEach(blockViewerMutationFunction);
  }

  function install() {
    installNavWrapper();
    installRefreshWrapper();
    installRenderWrapper();
    installMutationGuards();
    enforceProfileUi();
    ensureMobileTransferButton();
  }

  install();
  let tries = 0;
  const timer = setInterval(() => {
    install();
    if (++tries >= 300) clearInterval(timer);
  }, 100);

  let mutationTimer = 0;
  const root = document.body || document.documentElement;
  if (root && typeof MutationObserver === 'function') {
    const uiObserver = new MutationObserver(() => {
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        enforceProfileUi();
        ensureMobileTransferButton();
      }, 20);
    });
    uiObserver.observe(root, { childList:true, subtree:true });
  }

  window.HAP_V40130_VIEWER_TRANSFER_READONLY = Object.freeze({
    version: VERSION,
    enabled: true,
    readOnly: true,
    refresh: enforceProfileUi,
    cleanViewerMessages: markViewerTechnicalMessages
  });

  console.info(`[HAPCAPEX ${VERSION}] Perfis isolados: Admin operacional; Visualizador somente leitura em Transferências.`);
})();
