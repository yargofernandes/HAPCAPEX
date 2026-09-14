/* HAPCAPEX V40.0.86 — Política de datas de calendário no Controle de Capex.
   Mantém a correção de deslocamento de datas em fusos UTC negativos.
   V40.0.86:
   - Gerencial: Situação do saldo fica apenas com "Com saldo" e "Saldo Zerado".
   - Gerencial: remove o filtro "Regra transferência".
   - O padrão da Situação do saldo passa a ser "Com saldo".
   - Não altera dados financeiros, regras de autorização ou registros do banco.
*/
(() => {
  'use strict';
  if (window.__HAP_V4075_DATE_LOCAL_POLICY__) return;
  window.__HAP_V4075_DATE_LOCAL_POLICY__ = true;

  function pad2(v) { return String(v).padStart(2, '0'); }

  function localTodayISO(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function calendarDateBRFromUtcDate(date) {
    return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  }

  function isExactUtcMidnight(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) &&
      date.getUTCHours() === 0 && date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  }

  function runWithCalendarDateLocale(callback) {
    const original = Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString = function(locale, options) {
      // SQL DATE chega ao browser como YYYY-MM-DD. new Date() interpreta isso como
      // meia-noite UTC; em fusos UTC negativos pode virar o dia anterior.
      // Durante os renders abaixo, datas em meia-noite UTC são datas de calendário,
      // portanto devem ser exibidas pelos componentes UTC, sem conversão de fuso.
      if ((!locale || String(locale).toLowerCase().startsWith('pt-br')) &&
          (!options || !options.timeZone) && isExactUtcMidnight(this)) {
        return calendarDateBRFromUtcDate(this);
      }
      return original.call(this, locale, options);
    };
    try {
      return callback();
    } finally {
      Date.prototype.toLocaleDateString = original;
    }
  }

  function wrapRender(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__hapV4075DateWrapped) return false;
    const wrapped = function(...args) {
      return runWithCalendarDateLocale(() => original.apply(this, args));
    };
    wrapped.__hapV4075DateWrapped = true;
    wrapped.__hapV4074DateOriginal = original;
    window[name] = wrapped;
    return true;
  }

  function wrapNewTransferModal() {
    const original = window.openNovaTransferenciaModal;
    if (typeof original !== 'function' || original.__hapV4075DateWrapped) return false;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      const input = document.getElementById('t-data');
      if (input) input.value = localTodayISO();
      return result;
    };
    wrapped.__hapV4075DateWrapped = true;
    wrapped.__hapV4074DateOriginal = original;
    window.openNovaTransferenciaModal = wrapped;
    return true;
  }

  function wrapParaDataISO() {
    const original = window.paraDataISO;
    if (typeof original !== 'function' || original.__hapV4075DateWrapped) return false;
    const wrapped = function(value) {
      // Quando o XLSX entrega um Date real, preservar o dia civil local em vez
      // de convertê-lo para UTC com toISOString(), que pode deslocar a data.
      if (value instanceof Date && !Number.isNaN(value.getTime())) return localTodayISO(value);
      return original.apply(this, arguments);
    };
    wrapped.__hapV4075DateWrapped = true;
    wrapped.__hapV4074DateOriginal = original;
    window.paraDataISO = wrapped;
    return true;
  }

  function patch() {
    const a = wrapRender('renderTransferenciasTab');
    const b = wrapRender('renderBaseConsumoTab');
    const c = wrapNewTransferModal();
    const d = wrapParaDataISO();
    return a || b || c || d;
  }

  // O loader entra depois do núcleo do Controle, mas tentamos novamente por segurança
  // caso a ordem de carregamento mude em versões futuras.
  patch();
  let tries = 0;
  const timer = setInterval(() => {
    patch();
    tries += 1;
    if (tries >= 30 || (
      typeof window.renderTransferenciasTab === 'function' && window.renderTransferenciasTab.__hapV4075DateWrapped &&
      typeof window.renderBaseConsumoTab === 'function' && window.renderBaseConsumoTab.__hapV4075DateWrapped &&
      typeof window.openNovaTransferenciaModal === 'function' && window.openNovaTransferenciaModal.__hapV4075DateWrapped &&
      typeof window.paraDataISO === 'function' && window.paraDataISO.__hapV4075DateWrapped
    )) clearInterval(timer);
  }, 200);

  window.HAP_DATE_ONLY = Object.freeze({ localTodayISO });
})();


/* V40.0.86 — Simplificação dos filtros do Gerencial.
   Implementado neste arquivo já existente para evitar a criação de um novo módulo.
   Escopo exclusivamente de interface/filtro; não altera regras financeiras ou banco. */
(() => {
  'use strict';
  if (window.__HAP_V4086_MANAGERIAL_FILTERS__) return;
  window.__HAP_V4086_MANAGERIAL_FILTERS__ = true;

  function injectManagerialFilterStyle() {
    if (document.getElementById('hap-v4086-managerial-filter-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4086-managerial-filter-style';
    style.textContent = `
      .v4071-filter-grid.v4086-managerial-filters{
        grid-template-columns:minmax(220px,2fr) repeat(3,minmax(145px,1fr))!important;
      }
      @media(max-width:1100px){
        .v4071-filter-grid.v4086-managerial-filters{
          grid-template-columns:repeat(3,minmax(0,1fr))!important;
        }
        .v4071-filter-grid.v4086-managerial-filters>label:first-child{
          grid-column:1/-1;
        }
      }
      @media(max-width:800px){
        .v4071-filter-grid.v4086-managerial-filters{
          grid-template-columns:1fr 1fr!important;
        }
      }
      @media(max-width:520px){
        .v4071-filter-grid.v4086-managerial-filters{
          grid-template-columns:1fr!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function forcePositiveBalanceFilter(select) {
    if (!select) return;
    if (select.value === 'positive' || select.value === 'zero') return;
    select.value = 'positive';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function patchSaldoFilter() {
    const select = document.getElementById('v4071-filter-saldo');
    if (!select) return false;

    // Mantém somente as duas escolhas solicitadas.
    Array.from(select.options).forEach(option => {
      if (!['positive', 'zero'].includes(option.value)) option.remove();
    });

    const positive = Array.from(select.options).find(option => option.value === 'positive');
    const zero = Array.from(select.options).find(option => option.value === 'zero');
    if (positive && positive.textContent !== 'Com saldo') positive.textContent = 'Com saldo';
    if (zero && zero.textContent !== 'Saldo Zerado') zero.textContent = 'Saldo Zerado';

    select.closest('.v4071-filter-grid')?.classList.add('v4086-managerial-filters');

    // O Gerencial antigo inicia em "Todos". Como essa escolha deixa de existir,
    // a visão inicial passa a ser "Com saldo".
    forcePositiveBalanceFilter(select);
    return true;
  }

  function removeTransferRuleFilter() {
    const select = document.getElementById('v4071-filter-transfer');
    if (!select) return false;
    const label = select.closest('label');
    if (label) label.remove();
    else select.remove();
    return true;
  }

  function patchClearButton() {
    const button = document.getElementById('v4071-clear');
    if (!button || button.dataset.v4086SaldoDefault === '1') return;
    button.dataset.v4086SaldoDefault = '1';

    // O manipulador original zera os filtros. Em seguida restabelecemos a única
    // opção padrão válida da nova interface: "Com saldo".
    button.addEventListener('click', () => {
      setTimeout(() => {
        patchManagerialFilters();
        forcePositiveBalanceFilter(document.getElementById('v4071-filter-saldo'));
      }, 0);
    });
  }

  function patchManagerialFilters() {
    injectManagerialFilterStyle();
    const changedSaldo = patchSaldoFilter();
    const changedTransfer = removeTransferRuleFilter();
    patchClearButton();
    return changedSaldo || changedTransfer;
  }

  patchManagerialFilters();

  const observer = new MutationObserver(() => {
    // O Gerencial reconstrói o toolbar ao entrar novamente na aba.
    patchManagerialFilters();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      patchManagerialFilters();
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }

  // Janela curta adicional para cobrir carregamento assíncrono dos módulos legados.
  let attempts = 0;
  const bootTimer = setInterval(() => {
    patchManagerialFilters();
    attempts += 1;
    if (attempts >= 40) clearInterval(bootTimer);
  }, 250);
})();
