/* HAPCAPEX V40.0.91 — Política de datas e ajustes visuais do Gerencial.
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



/* V40.0.91 — Colar transferências diretamente do Excel.
   - Reutiliza exclusivamente o RPC existente criar_transferencias_lote.
   - O backend continua responsável por autorização, saldo, OIs e atomicidade.
   - Nenhum dado é gravado durante a análise/pré-visualização.
   - Não cria nova rota, tabela ou credencial. */
(() => {
  'use strict';
  if (window.__HAP_V4091_BULK_TRANSFER_PASTE__) return;
  window.__HAP_V4091_BULK_TRANSFER_PASTE__ = true;

  const cleanCell = value => String(value ?? '').replace(/\u00a0/g, ' ').trim();
  const escapeHtml = value => cleanCell(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function parseBRL(value) {
    let s = cleanCell(value).replace(/^R\$\s*/i, '').replace(/\s+/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    const n = Number(s.replace(/[^\d+\-.]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  function parseDate(value) {
    const s = cleanCell(value);
    if (!s) return '';
    let y, m, d;
    let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) [, y, m, d] = match;
    else {
      match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return '';
      [, d, m, y] = match;
      d = String(d).padStart(2, '0');
      m = String(m).padStart(2, '0');
    }
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(m) || dt.getUTCDate() !== Number(d)) return '';
    return `${y}-${m}-${d}`;
  }

  function isHeader(cells) {
    const h = cells.map(v => cleanCell(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()).join(' ');
    return h.includes('ORIG') && h.includes('DEST') && h.includes('VALOR');
  }

  function isMarkdownSeparator(cells) {
    return cells.length > 0 && cells.every(v => /^:?-{3,}:?$/.test(cleanCell(v)));
  }

  function splitClipboardLine(line) {
    if (line.includes('\t')) return line.split('\t').map(cleanCell);
    const trimmed = line.trim();
    if (trimmed.includes('|')) {
      const body = trimmed.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
      return body.split('|').map(cleanCell);
    }
    return [cleanCell(line)];
  }

  function parseClipboardText(text) {
    const rawLines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const rows = [];
    const errors = [];
    let logicalLine = 0;

    rawLines.forEach((raw, index) => {
      if (!raw.trim()) return;
      const cells = splitClipboardLine(raw);
      if (isMarkdownSeparator(cells) || isHeader(cells)) return;
      logicalLine += 1;

      if (cells.length < 6) {
        errors.push(`Linha ${logicalLine}: esperadas 6 colunas; recebidas ${cells.length}.`);
        return;
      }

      const origem = cleanCell(cells[0]).replace(/\s+/g, '');
      const destino = cleanCell(cells[1]).replace(/\s+/g, '');
      const valor = parseBRL(cells[2]);
      const documento = cleanCell(cells[3]);
      const justificativa = cleanCell(cells.slice(4, cells.length - 1).join(' '));
      const data = parseDate(cells[cells.length - 1]);

      const rowErrors = [];
      if (!/^\d{5,}$/.test(origem)) rowErrors.push('OI origem inválida');
      if (!/^\d{5,}$/.test(destino)) rowErrors.push('OI destino inválida');
      if (origem && destino && origem === destino) rowErrors.push('origem e destino são iguais');
      if (!Number.isFinite(valor) || valor <= 0) rowErrors.push('valor inválido');
      if (!documento) rowErrors.push('documento vazio');
      if (!data) rowErrors.push('data inválida');

      rows.push({
        linha: logicalLine,
        origem, destino, valor, documento, justificativa, data,
        errors: rowErrors,
        sourceLine: index + 1
      });
    });

    if (!rows.length && !errors.length) errors.push('Nenhuma linha de transferência foi encontrada.');

    const docs = [...new Set(rows.map(r => r.documento).filter(Boolean))];
    const dates = [...new Set(rows.map(r => r.data).filter(Boolean))];
    if (docs.length > 1) errors.push('O lote contém mais de um número de documento. Cole um documento por vez.');
    if (dates.length > 1) errors.push('O lote contém mais de uma data. Cole uma data por vez.');

    const seen = new Set();
    rows.forEach(r => {
      const key = `${r.origem}|${r.destino}|${Number.isFinite(r.valor) ? r.valor.toFixed(2) : ''}|${r.documento}|${r.data}`;
      if (seen.has(key)) r.errors.push('linha duplicada na própria colagem');
      else seen.add(key);
    });

    return {
      rows,
      errors,
      documento: docs.length === 1 ? docs[0] : '',
      data: dates.length === 1 ? dates[0] : ''
    };
  }

  async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function runner() {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) return;
        results[idx] = await worker(items[idx], idx);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
    return results;
  }

  function existingTransfers() {
    try {
      return (typeof state !== 'undefined' && Array.isArray(state.transferRows)) ? state.transferRows : [];
    } catch (_) {
      return [];
    }
  }

  function duplicateExistsInSystem(row) {
    return existingTransfers().some(t => {
      const sameValue = Math.abs(Number(t.valor || 0) - row.valor) < 0.005;
      const sameDate = String(t.data || '').slice(0,10) === row.data;
      return cleanCell(t.oi_origem) === row.origem &&
        cleanCell(t.oi_destino) === row.destino &&
        cleanCell(t.numero_documento) === row.documento &&
        sameValue && sameDate;
    });
  }

  async function validateRows(parsed) {
    const rows = parsed.rows.map(r => ({ ...r, errors:[...(r.errors || [])], warnings:[] }));
    const uniqueOis = [...new Set(rows.flatMap(r => [r.origem, r.destino]).filter(Boolean))];
    const infoMap = new Map();

    await mapLimit(uniqueOis, 8, async oi => {
      try {
        const { data, error } = await sb.rpc('buscar_obra_por_oi', { p_ordem_interna: oi });
        if (error) infoMap.set(oi, { existe:false, error:error.message });
        else infoMap.set(oi, data || { existe:false });
      } catch (err) {
        infoMap.set(oi, { existe:false, error:err?.message || String(err) });
      }
    });

    rows.forEach(row => {
      const origem = infoMap.get(row.origem);
      const destino = infoMap.get(row.destino);
      if (!origem?.existe) row.errors.push(`OI origem ${row.origem} não encontrada`);
      if (!destino?.existe) row.errors.push(`OI destino ${row.destino} não encontrada`);
      if (origem?.existe && (origem.saldo_disponivel === null || origem.saldo_disponivel === undefined || !Number.isFinite(Number(origem.saldo_disponivel)))) {
        row.errors.push(`OI origem ${row.origem} sem saldo financeiro disponível`);
      }
      if (destino?.existe && destino.montante_atribuido === null && destino.saldo_disponivel === null) {
        row.errors.push(`OI destino ${row.destino} sem valores financeiros cadastrados`);
      }
      if (origem?.existe && destino?.existe && cleanCell(origem.pacote) !== cleanCell(destino.pacote)) {
        row.warnings.push(`Pacotes: ${cleanCell(origem.pacote) || 'sem pacote'} → ${cleanCell(destino.pacote) || 'sem pacote'}`);
        row.rawPackageDifference = true;
      } else {
        row.rawPackageDifference = false;
      }
      if (duplicateExistsInSystem(row)) row.errors.push('transferência idêntica já consta no sistema');
      row.origemInfo = origem || null;
      row.destinoInfo = destino || null;
    });

    const simulated = new Map();
    uniqueOis.forEach(oi => {
      const info = infoMap.get(oi);
      if (info?.existe && Number.isFinite(Number(info.saldo_disponivel))) simulated.set(oi, Number(info.saldo_disponivel));
    });

    rows.forEach(row => {
      if (row.errors.length) return;
      const current = simulated.get(row.origem);
      if (!Number.isFinite(current)) return;
      if (row.valor > current + 0.004) {
        row.errors.push(`saldo insuficiente na origem: disponível nesta etapa ${current.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`);
        return;
      }
      simulated.set(row.origem, Math.round((current - row.valor) * 100) / 100);
      if (simulated.has(row.destino)) {
        simulated.set(row.destino, Math.round((simulated.get(row.destino) + row.valor) * 100) / 100);
      }
    });

    return {
      ...parsed,
      rows,
      valid: parsed.errors.length === 0 && rows.every(r => r.errors.length === 0),
      total: Math.round(rows.reduce((sum, r) => sum + (Number.isFinite(r.valor) ? r.valor : 0), 0) * 100) / 100,
      rawPackageDifferences: rows.filter(r => r.rawPackageDifference).length
    };
  }

  function renderPreview(container, analysis) {
    const money = value => Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const globalErrors = analysis.errors || [];
    const invalid = analysis.rows.filter(r => r.errors.length).length;
    const ok = analysis.rows.length - invalid;

    container.innerHTML = `
      ${globalErrors.length ? `<div class="error-msg">${globalErrors.map(escapeHtml).join('<br>')}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 10px;">
        <span class="role-badge">${analysis.rows.length} linha(s)</span>
        <span class="role-badge">${ok} válida(s)</span>
        ${invalid ? `<span class="role-badge" style="background:#fcebeb;color:#791f1f">${invalid} com erro</span>` : ''}
        <span class="role-badge">Total ${escapeHtml(money(analysis.total))}</span>
        ${analysis.documento ? `<span class="role-badge">Doc. ${escapeHtml(analysis.documento)}</span>` : ''}
        ${analysis.data ? `<span class="role-badge">${escapeHtml(analysis.data.split('-').reverse().join('/'))}</span>` : ''}
      </div>
      ${analysis.rawPackageDifferences ? `
        <div class="banner-warn" style="margin:8px 0;">
          ${analysis.rawPackageDifferences} linha(s) têm classificação de pacote diferente entre origem e destino.
          O backend aplicará a regra gerencial. Se alguma realmente exigir autorização, marque a confirmação abaixo.
        </div>` : ''}
      <div style="overflow:auto;max-height:340px;border:1px solid var(--cinza-borda);border-radius:8px;">
        <table style="min-width:940px;font-size:11px;">
          <thead><tr>
            <th>#</th><th>Origem</th><th>Destino</th><th>Valor</th><th>Documento</th><th>Data</th><th>Justificativa</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${analysis.rows.map(r => `
              <tr>
                <td>${r.linha}</td>
                <td>${escapeHtml(r.origem)}<br><small>${escapeHtml(r.origemInfo?.nome || '')}</small></td>
                <td>${escapeHtml(r.destino)}<br><small>${escapeHtml(r.destinoInfo?.nome || '')}</small></td>
                <td>${escapeHtml(money(r.valor))}</td>
                <td>${escapeHtml(r.documento)}</td>
                <td>${escapeHtml(r.data ? r.data.split('-').reverse().join('/') : '')}</td>
                <td style="white-space:normal;min-width:220px;">${escapeHtml(r.justificativa)}</td>
                <td style="white-space:normal;min-width:210px;">
                  ${r.errors.length
                    ? `<span style="color:var(--vermelho);font-weight:700">${r.errors.map(escapeHtml).join('<br>')}</span>`
                    : `<span style="color:var(--verde);font-weight:700">✓ OK</span>${r.warnings.length ? `<br><span style="color:var(--amarelo-texto)">${r.warnings.map(escapeHtml).join('<br>')}</span>` : ''}`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function openBulkTransferModal() {
    const existing = document.getElementById('v4091-bulk-transfer-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'v4091-bulk-transfer-modal';
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-box" style="width:min(1120px,96vw);">
        <h2>Colar transferências do Excel</h2>
        <p class="sub">
          Copie as colunas no Excel e cole abaixo. Ordem esperada:
          <strong>OI origem · OI destino · Valor · Nº documento · Justificativa · Data</strong>.
          Pode colar com ou sem cabeçalho.
        </p>
        <div id="v4091-bulk-error"></div>
        <textarea id="v4091-bulk-text" rows="9" spellcheck="false"
          style="width:100%;font-family:Consolas,monospace;font-size:11px;resize:vertical"
          placeholder="50159083&#9;50159680&#9;R$ 450.000,00&#9;15359&#9;SOLICITAÇÃO...&#9;15/09/2026"></textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;">
          <button class="btn btn-secondary" id="v4091-analyze">Analisar colagem</button>
          <span id="v4091-analysis-status" style="font-size:11px;color:var(--texto-suave);"></span>
        </div>
        <div id="v4091-preview"></div>
        <label id="v4091-auth-wrap" style="display:none;align-items:center;gap:7px;margin-top:12px;font-size:11px;font-weight:700;">
          <input type="checkbox" id="v4091-confirm-auth">
          Confirmo que possuo autorização do diretor caso alguma linha realmente exija transferência entre pacotes gerenciais diferentes.
        </label>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="v4091-cancel">Cancelar</button>
          <button class="btn btn-primary" id="v4091-save" disabled>Registrar lote</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);

    const textEl = document.getElementById('v4091-bulk-text');
    const previewEl = document.getElementById('v4091-preview');
    const statusEl = document.getElementById('v4091-analysis-status');
    const errorEl = document.getElementById('v4091-bulk-error');
    const saveBtn = document.getElementById('v4091-save');
    const authWrap = document.getElementById('v4091-auth-wrap');
    const authEl = document.getElementById('v4091-confirm-auth');
    let lastText = '';

    async function analyze() {
      saveBtn.disabled = true;
      errorEl.innerHTML = '';
      statusEl.textContent = 'Validando OIs e saldos...';
      const currentText = textEl.value;
      const parsed = parseClipboardText(currentText);
      const analysis = await validateRows(parsed);
      lastText = currentText;
      renderPreview(previewEl, analysis);
      authWrap.style.display = analysis.rawPackageDifferences ? 'flex' : 'none';
      statusEl.textContent = analysis.valid ? 'Pronto para registrar.' : 'Corrija as linhas destacadas.';
      saveBtn.disabled = !analysis.valid;
      saveBtn.textContent = analysis.valid ? `Registrar ${analysis.rows.length} transferência(s)` : 'Registrar lote';
      return analysis;
    }

    document.getElementById('v4091-analyze').onclick = () => void analyze();
    document.getElementById('v4091-cancel').onclick = () => backdrop.remove();
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

    textEl.addEventListener('input', () => {
      if (textEl.value !== lastText) {
        saveBtn.disabled = true;
        statusEl.textContent = 'Conteúdo alterado — analise novamente.';
      }
    });

    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      errorEl.innerHTML = '';
      try {
        const analysis = await analyze();
        if (!analysis.valid) return;

        const confirma = !!authEl.checked;
        const itens = analysis.rows.map(r => ({
          oi_origem: r.origem,
          oi_destino: r.destino,
          valor: r.valor,
          justificativa: r.justificativa || null,
          confirma_pacotes_diferentes: r.rawPackageDifference ? confirma : false
        }));

        statusEl.textContent = 'Registrando lote...';
        saveBtn.disabled = true;
        const { data, error } = await sb.rpc('criar_transferencias_lote', {
          p_numero_documento: analysis.documento || null,
          p_data: analysis.data || null,
          p_itens: itens
        });
        if (error) throw error;

        const qtd = Number(data?.quantidade || analysis.rows.length);
        backdrop.remove();
        if (typeof refreshCurrent === 'function') await refreshCurrent();

        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;background:#e1f5ee;border:1px solid #5dcaa5;color:#04342c;padding:12px 14px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);font-size:12px;font-weight:700';
        toast.textContent = `${qtd} transferência(s) registradas com sucesso.`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4200);
      } catch (err) {
        errorEl.innerHTML = `<div class="error-msg">${escapeHtml(err?.message || String(err))}</div>`;
        statusEl.textContent = 'Lote não registrado.';
        saveBtn.disabled = false;
      }
    };

    textEl.focus();
  }

  function ensureBulkPasteButton() {
    const anchor = document.getElementById('nova-transf-btn');
    if (!anchor || document.getElementById('v4091-bulk-transfer-btn')) return false;
    const btn = document.createElement('button');
    btn.id = 'v4091-bulk-transfer-btn';
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = '📋 Colar do Excel';
    btn.title = 'Copiar várias transferências do Excel e validar antes de registrar';
    btn.onclick = openBulkTransferModal;
    anchor.parentNode.insertBefore(btn, anchor);
    return true;
  }

  ensureBulkPasteButton();
  const observer = new MutationObserver(() => ensureBulkPasteButton());
  if (document.body) observer.observe(document.body, { childList:true, subtree:true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList:true, subtree:true }), { once:true });

  let tries = 0;
  const timer = setInterval(() => {
    ensureBulkPasteButton();
    tries += 1;
    if (tries >= 40) clearInterval(timer);
  }, 250);

  window.HAP_BULK_TRANSFER = Object.freeze({ parseBRL, parseDate, parseClipboardText });
})();
