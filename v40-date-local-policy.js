/* HAPCAPEX V40.0.74 — Política de datas de calendário no Controle de Capex.
   Corrige o deslocamento de -1 dia causado por new Date('YYYY-MM-DD') em fusos UTC negativos.
   Escopo: exibição de Transferências e Base Consumo + data padrão de nova transferência.
   Não altera datas armazenadas no banco.
*/
(() => {
  'use strict';
  if (window.__HAP_V4074_DATE_LOCAL_POLICY__) return;
  window.__HAP_V4074_DATE_LOCAL_POLICY__ = true;

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
      // meia-noite UTC; em Fortaleza, por exemplo, vira 21h do dia anterior.
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
    if (typeof original !== 'function' || original.__hapV4074DateWrapped) return false;
    const wrapped = function(...args) {
      return runWithCalendarDateLocale(() => original.apply(this, args));
    };
    wrapped.__hapV4074DateWrapped = true;
    wrapped.__hapV4074DateOriginal = original;
    window[name] = wrapped;
    return true;
  }

  function wrapNewTransferModal() {
    const original = window.openNovaTransferenciaModal;
    if (typeof original !== 'function' || original.__hapV4074DateWrapped) return false;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      const input = document.getElementById('t-data');
      if (input) input.value = localTodayISO();
      return result;
    };
    wrapped.__hapV4074DateWrapped = true;
    wrapped.__hapV4074DateOriginal = original;
    window.openNovaTransferenciaModal = wrapped;
    return true;
  }

  function wrapParaDataISO() {
    const original = window.paraDataISO;
    if (typeof original !== 'function' || original.__hapV4074DateWrapped) return false;
    const wrapped = function(value) {
      // Quando o XLSX entrega um Date real, preservar o dia civil local em vez
      // de convertê-lo para UTC com toISOString(), que pode deslocar a data.
      if (value instanceof Date && !Number.isNaN(value.getTime())) return localTodayISO(value);
      return original.apply(this, arguments);
    };
    wrapped.__hapV4074DateWrapped = true;
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
      typeof window.renderTransferenciasTab === 'function' && window.renderTransferenciasTab.__hapV4074DateWrapped &&
      typeof window.renderBaseConsumoTab === 'function' && window.renderBaseConsumoTab.__hapV4074DateWrapped &&
      typeof window.openNovaTransferenciaModal === 'function' && window.openNovaTransferenciaModal.__hapV4074DateWrapped &&
      typeof window.paraDataISO === 'function' && window.paraDataISO.__hapV4074DateWrapped
    )) clearInterval(timer);
  }, 200);

  window.HAP_DATE_ONLY = Object.freeze({ localTodayISO });
})();
