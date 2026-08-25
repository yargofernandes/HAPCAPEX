/* HAPCAPEX V40.0.49 — Valores SAP em Transferências
   Correção estrutural e independente do loader de filtros.
   Aceita colagem pt-BR do SAP e entrega número canônico à revisão V37.
*/
(() => {
  'use strict';

  if (window.__HAP_V40049_TRANSFER_SAP_VALUES__) return;
  window.__HAP_V40049_TRANSFER_SAP_VALUES__ = true;

  const VERSION = '40.0.49';
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
      // SAP / pt-BR: 61.345,34
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      const dots = (raw.match(/\./g) || []).length;

      if (dots === 1 && /\.\d{1,2}$/.test(raw)) {
        // 61345.34: ponto decimal já canônico.
      } else if (dots > 0) {
        // 61.345 ou 1.234.567: ponto de milhar.
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
    // Conforme padrão solicitado: sem milhar no campo, vírgula decimal.
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

    // type=number é incompatível com "61.345,34".
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

  // 1) Toda linha criada no modal já nasce preparada.
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

  // 2) Segurança no foco.
  document.addEventListener('focusin', event => {
    if (isValueInput(event.target)) prepareInput(event.target);
  }, true);

  // 3) Colagem: usa o texto bruto do clipboard antes de o navegador
  //    tentar interpretá-lo como número.
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

  // 4) CRÍTICO: a governança V37 captura o clique no botão e lê
  //    Number(input.value). Este listener está no document (fase capture),
  //    portanto executa ANTES do listener do botão e converte temporariamente:
  //    24820,00 -> 24820.00.
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

    // readTransferDraftV376 é síncrona no início do handler V37.
    // Depois dessa leitura, devolve o visual pt-BR caso o usuário volte/edite.
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
