/* HAPCAPEX V40.0.90 — Política de datas e ajustes visuais do Gerencial.
   Mantém a correção de deslocamento de datas em fusos UTC negativos.
   V40.0.88:
   - Gerencial: Situação do saldo = "Todos", "Com saldo" e "Saldo Zerado".
   - "Todos" é a opção padrão e não aplica filtro de saldo.
   - Continua removido o filtro "Regra transferência".
   - Mantém a consolidação gerencial de pacotes da V40.0.87.
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


/* V40.0.88 — Simplificação dos filtros do Gerencial.
   Implementado neste arquivo já existente para evitar a criação de um novo módulo.
   Escopo exclusivamente de interface/filtro; não altera regras financeiras ou banco. */
(() => {
  'use strict';
  if (window.__HAP_V4087_MANAGERIAL_FILTERS__) return;
  window.__HAP_V4087_MANAGERIAL_FILTERS__ = true;

  function injectManagerialFilterStyle() {
    if (document.getElementById('hap-v4087-managerial-filter-style')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4087-managerial-filter-style';
    style.textContent = `
      .v4071-filter-grid.v4087-managerial-filters{
        grid-template-columns:minmax(220px,2fr) repeat(3,minmax(145px,1fr))!important;
      }
      @media(max-width:1100px){
        .v4071-filter-grid.v4087-managerial-filters{
          grid-template-columns:repeat(3,minmax(0,1fr))!important;
        }
        .v4071-filter-grid.v4087-managerial-filters>label:first-child{
          grid-column:1/-1;
        }
      }
      @media(max-width:800px){
        .v4071-filter-grid.v4087-managerial-filters{
          grid-template-columns:1fr 1fr!important;
        }
      }
      @media(max-width:520px){
        .v4071-filter-grid.v4087-managerial-filters{
          grid-template-columns:1fr!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function patchSaldoFilter() {
    const select = document.getElementById('v4071-filter-saldo');
    if (!select) return false;

    // Mantém "Todos" sem filtro, além das duas situações úteis solicitadas.
    Array.from(select.options).forEach(option => {
      if (!['all', 'positive', 'zero'].includes(option.value)) option.remove();
    });

    const all = Array.from(select.options).find(option => option.value === 'all');
    const positive = Array.from(select.options).find(option => option.value === 'positive');
    const zero = Array.from(select.options).find(option => option.value === 'zero');
    if (all && all.textContent !== 'Todos') all.textContent = 'Todos';
    if (positive && positive.textContent !== 'Com saldo') positive.textContent = 'Com saldo';
    if (zero && zero.textContent !== 'Saldo Zerado') zero.textContent = 'Saldo Zerado';

    // Se uma tela antiga ainda estiver com "negative", neutraliza para "Todos".
    if (!['all', 'positive', 'zero'].includes(select.value)) {
      select.value = 'all';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    select.closest('.v4071-filter-grid')?.classList.add('v4087-managerial-filters');
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
    if (!button || button.dataset.v4088SaldoDefault === '1') return;
    button.dataset.v4088SaldoDefault = '1';

    // O handler original já redefine mgr.saldo para "all".
    // Apenas reaplicamos a limpeza visual depois que o toolbar for reconstruído.
    button.addEventListener('click', () => {
      setTimeout(() => patchManagerialFilters(), 0);
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

/* V40.0.89 — Consolidação visual de pacotes no Gerencial.
   IMPORTANTE: atua somente sobre a resposta da RPC do Gerencial no navegador.
   Não grava, renomeia ou altera classificações no banco de dados.
   V40.0.89 adiciona Manutenção Dia a Dia + Obra Extra | Manutenção Dia a Dia. */
(() => {
  'use strict';
  if (window.__HAP_V4089_MANAGERIAL_PACKAGE_GROUPING__) return;
  window.__HAP_V4089_MANAGERIAL_PACKAGE_GROUPING__ = true;

  const TARGET_RPC = 'obter_gerencial_controle_v4082';
  const CANONICAL_OPERATIONAL = 'Pacote Operacional | Suficiência de Rede';
  const CANONICAL_PROJECTS = 'Projetos 2026';
  const CANONICAL_MAINTENANCE = 'Manutenção Dia a Dia';

  function packageKey(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*\|\s*/g, ' | ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function canonicalManagerialPackage(value) {
    const raw = String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const key = packageKey(raw);

    if (key === 'PACOTE OPERACIONAL | SUFICIENCIA DE REDE' ||
        key === 'OBRA EXTRA | PACOTE OPERACIONAL') {
      return CANONICAL_OPERATIONAL;
    }

    if (key === 'PROJETOS 2026 | VERTICALIZACAO' ||
        key === 'PROJETOS 2026 | PROJETOS' ||
        key === 'OBRA EXTRA | PROJETOS 2026') {
      return CANONICAL_PROJECTS;
    }

    if (key === 'MANUTENCAO DIA A DIA' ||
        key === 'OBRA EXTRA | MANUTENCAO DIA A DIA') {
      return CANONICAL_MAINTENANCE;
    }

    return raw;
  }

  function mapRows(rows, mapper) {
    return Array.isArray(rows) ? rows.map(row => mapper({ ...row })) : rows;
  }

  function consolidateInitialPackages(rows) {
    if (!Array.isArray(rows)) return rows;
    const grouped = new Map();
    rows.forEach(source => {
      const row = { ...source };
      const pacote = canonicalManagerialPackage(row.pacote);
      const key = packageKey(pacote);
      if (!grouped.has(key)) grouped.set(key, { ...row, pacote, capex_inicial: 0 });
      const target = grouped.get(key);
      const value = Number(row.capex_inicial);
      target.capex_inicial += Number.isFinite(value) ? value : 0;
    });
    return [...grouped.values()];
  }

  function transformManagerialPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const data = { ...payload };

    data.ois = mapRows(data.ois, row => {
      row.pacote = canonicalManagerialPackage(row.pacote);
      return row;
    });

    data.transferencias = mapRows(data.transferencias, row => {
      row.pacote_origem = canonicalManagerialPackage(row.pacote_origem);
      row.pacote_destino = canonicalManagerialPackage(row.pacote_destino);
      return row;
    });

    data.movimentos = mapRows(data.movimentos, row => {
      row.pacote = canonicalManagerialPackage(row.pacote);
      return row;
    });

    data.capex_inicial_pacotes = consolidateInitialPackages(data.capex_inicial_pacotes);
    return data;
  }

  function wrapRpc() {
    const client = (typeof sb !== 'undefined' && sb) ? sb : window.sb;
    if (!client || typeof client.rpc !== 'function') return false;
    const current = client.rpc;
    if (current.__hapV4087ManagerialPackageGrouping) return true;

    const wrapped = async function(fn, args, options) {
      const result = await current.call(this, fn, args, options);
      if (fn !== TARGET_RPC || !result || result.error || !result.data) return result;
      return { ...result, data: transformManagerialPayload(result.data) };
    };
    wrapped.__hapV4087ManagerialPackageGrouping = true;
    wrapped.__hapV4087Original = current;
    client.rpc = wrapped;
    return true;
  }

  wrapRpc();
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (wrapRpc() || tries >= 40) clearInterval(timer);
  }, 250);

  window.HAP_V4087_MANAGERIAL_PACKAGE_GROUPING = Object.freeze({
    canonicalManagerialPackage,
    transformManagerialPayload
  });
})();

