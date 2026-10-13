/* HAPCAPEX V35 — Controle anual, aportes históricos e criação inteligente de OIs */
(() => {
  'use strict';

  const V35 = window.HAP_V35 = {
    version: '35.6.7',
    exercise: 2026,
    exerciseStatus: 'aberto',
    config: { oi_bolsao_manutencao: '50158051' },
    exercises: [],
    movements: [],
    workLinks: [],
    workGroups: [],
    workLinkByOi: new Map(),
    currentNameByOi: new Map(),
    historyOiSet: new Set(),
    ready: false
  };

  const originals = {
    loadCurveFinanceReference,
    curveFinanceTotals,
    openControlKpiPanel,
    renderCapexTab,
    renderBaseOiTab,
    renderBaseConsumoTab,
    renderTransferenciasTab
  };

  function injectV35Styles() {
    if (document.getElementById('hap-v35-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v35-styles';
    style.textContent = `
      .v35-exercise-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;background:#e8f0fb;color:#0d2b4e;font-size:10px;font-weight:800;white-space:nowrap;border:1px solid #cad8eb}
      .v35-exercise-chip i{width:7px;height:7px;border-radius:50%;background:#1e8a4a;display:inline-block}
      .v35-history-btn{background:#f8fffb!important;border-color:#a9dabb!important;color:#126b37!important}
      .v35-aporte-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0 4px}
      .v35-aporte-choice{appearance:none;width:100%;text-align:left;border:1px solid #dde3ee;border-radius:11px;background:#fff;padding:14px;cursor:pointer;font:inherit;color:#0d2b4e;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}
      .v35-aporte-choice:hover{border-color:#9bb7db;box-shadow:0 4px 14px rgba(13,43,78,.08);transform:translateY(-1px)}
      .v35-aporte-choice .v35-choice-kicker{display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#5a6882;margin-bottom:5px}
      .v35-aporte-choice strong{display:block;font-size:14px;margin-bottom:6px}
      .v35-aporte-choice small{display:block;font-size:11px;line-height:1.45;color:#5a6882;font-weight:400}
      .v35-aporte-choice .v35-choice-effect{display:block;margin-top:9px;padding-top:8px;border-top:1px solid #eef1f5;font-size:10px;font-weight:700;line-height:1.35}
      .v35-aporte-choice.operacional .v35-choice-effect{color:#1a4b8c}
      .v35-aporte-choice.historico .v35-choice-effect{color:#1e8a4a}
      .v35-modal-xl{width:min(1100px,96vw)!important}
      .v35-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:8px;margin:12px 0 16px}
      .v35-summary-card{background:#f4f6fa;border:1px solid #dde3ee;border-radius:9px;padding:10px;min-width:0}
      .v35-summary-card span{display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:#5a6882;letter-spacing:.04em}
      .v35-summary-card strong{display:block;margin-top:4px;font-size:clamp(13px,1.05vw,15px);line-height:1.2;color:#0d2b4e;font-variant-numeric:tabular-nums;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
      .v35-preview-table{width:100%;min-width:970px;font-size:11px}
      .v35-preview-table th{padding:7px 8px}
      .v35-preview-table td{padding:7px 8px;vertical-align:top}
      .v35-preview-table input[type=text],.v35-preview-table select{font-size:11px;padding:6px 7px;border:1px solid #dde3ee;border-radius:6px;background:#fff}
      .v35-origin-source{width:110px}
      .v35-origin-select{width:150px}
      .v35-bulkbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#eef4fc;border:1px solid #cad8eb;padding:9px 10px;border-radius:9px;margin:10px 0}
      .v35-bulkbar select,.v35-bulkbar input{padding:7px 8px;border:1px solid #cad8eb;border-radius:7px;background:#fff;font-size:11px}
      .v35-recon{margin-top:14px;border:1px solid #dde3ee;border-radius:10px;overflow:hidden}
      .v35-recon h3{margin:0;padding:9px 11px;background:#f4f6fa;color:#0d2b4e;font-size:11px;text-transform:uppercase}
      .v35-recon-row{display:grid;grid-template-columns:125px 1fr 1fr 1fr 1fr;gap:8px;padding:8px 11px;border-top:1px solid #dde3ee;font-size:11px;align-items:center}
      .v35-recon-row strong{font-variant-numeric:tabular-nums;white-space:nowrap}
      .v35-recon-ok{color:#1e8a4a}.v35-recon-warn{color:#c0392b}
      .v35-collapsible{border:1px solid #dde3ee;border-radius:9px;margin-top:10px;overflow:hidden}
      .v35-collapsible summary{cursor:pointer;padding:9px 11px;font-size:11px;font-weight:800;color:#0d2b4e;background:#f8fafc}
      .v35-collapsible-body{padding:9px 11px;max-height:210px;overflow:auto;font-size:11px}
      .v35-mini-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #eef1f5;padding:6px 0}
      .v35-mini-row:last-child{border-bottom:none}
      .v35-block-note{padding:9px 11px;border-radius:8px;margin:8px 0;font-size:11px;line-height:1.45}
      .v35-block-note.info{background:#e8f0fb;color:#244b74}.v35-block-note.warn{background:#fff0c0;color:#8a6000}.v35-block-note.danger{background:#fcebeb;color:#791f1f}.v35-block-note.ok{background:#e1f5ee;color:#04342c}
      .v35-origin-hint{font-size:9px;color:#5a6882;margin-top:3px;max-width:180px;white-space:normal}
      .v35-link-badge{display:inline-flex;align-items:center;gap:3px;margin-left:5px;padding:2px 6px;border-radius:999px;background:#eee9ff;color:#6044a5;font-size:9px;font-weight:800;cursor:pointer;border:1px solid #d9cff8;vertical-align:middle}
      .v35-link-btn{background:#faf8ff!important;border-color:#d9cff8!important;color:#6044a5!important}
      .v35-identity-list{display:grid;gap:8px;margin-top:12px}.v35-identity-item{border:1px solid #dde3ee;border-radius:9px;padding:10px 11px}.v35-identity-item-head{display:flex;justify-content:space-between;gap:12px}.v35-identity-item strong{color:#0d2b4e}.v35-identity-year{margin-top:7px;padding-top:7px;border-top:1px solid #eef1f5;display:flex;flex-wrap:wrap;gap:12px;font-size:10px;color:#5a6882}.v35-link-suggestion{font-size:9px;color:#6044a5;margin-top:3px;max-width:190px;white-space:normal}
      .v40136-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;margin:14px 0 12px}
      .v40136-stat{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border:1px solid #dde3ee;border-radius:10px;background:#f8fafc;min-height:74px;justify-content:center}
      .v40136-stat small{display:block;font-size:11px;font-weight:800;color:#5a6882;line-height:1.35;text-transform:none}
      .v40136-stat strong{display:block;font-size:19px;line-height:1.2;font-weight:900;color:#0d2b4e;letter-spacing:.01em;font-variant-numeric:tabular-nums}
      .v40136-section-title{font-size:12px;color:#0d2b4e;font-weight:900;margin:17px 0 6px}
      .v40136-section-sub{font-size:10.5px;color:#5a6882;line-height:1.4;margin:0 0 6px}
      .v40136-stat[data-tone="orange"] strong{color:var(--laranja,#dc6b20)}
      .v40136-stat[data-tone="red"] strong{color:var(--vermelho,#c0392b)}
      .v40136-stat[data-tone="green"] strong{color:var(--verde,#12805c)}
      .v40136-recon{border-radius:8px;padding:10px 12px;font-size:11px;line-height:1.5;margin:9px 0}
      .v40136-recon[data-status="conciliado"]{background:#e1f5ee;color:#04342c}
      .v40136-recon[data-status="arredondamento"]{background:#fff0c0;color:#8a6000}
      .v40136-recon[data-status="divergente"],.v40136-recon[data-status="nao_disponivel"]{background:#fcebeb;color:#791f1f}
      .v40136-consumo-last{margin:8px 0 12px;line-height:1.5}
      .v40136-consumo-last strong{font-weight:900;color:#0d2b4e}
      .v40136-check{display:block;margin-top:10px;line-height:1.45}
      @media(max-width:900px){.v35-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v35-recon-row{grid-template-columns:1fr 1fr}.v35-recon-row>span:first-child{grid-column:1/-1}.v35-aporte-choice-grid{grid-template-columns:1fr}.v40136-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function currentExercise() { return Number(V35.exercise || 2026); }

  function applyV35ContextPayload(payload) {
    const cfg = payload?.config || {};
    const exercises = Array.isArray(payload?.exercicios) ? payload.exercicios : [];
    const workLinks = Array.isArray(payload?.vinculos) ? payload.vinculos : [];
    const currentWorks = Array.isArray(payload?.obras_atuais) ? payload.obras_atuais : [];
    const movements = Array.isArray(payload?.movimentos) ? payload.movimentos : [];
    const historyOis = Array.isArray(payload?.historico_ois) ? payload.historico_ois : [];

    V35.config = { ...V35.config, ...cfg };
    V35.exercise = Number(cfg.exercicio_atual || V35.exercise || 2026);
    V35.exercises = exercises;
    V35.workLinks = workLinks;
    V35.workLinkByOi = new Map(V35.workLinks.map(x => [String(x.ordem_interna), x]));
    V35.currentNameByOi = new Map(
      currentWorks
        .filter(x => x.ordem_interna && x.obra)
        .map(x => [String(x.ordem_interna), String(x.obra)])
    );
    V35.historyOiSet = new Set(historyOis.map(x => String(x)));

    const grouped = new Map();
    V35.workLinks.forEach(x => {
      if (!grouped.has(x.obra_id)) {
        grouped.set(x.obra_id, {
          obra_id: x.obra_id,
          nome_oficial: x.nome_oficial,
          codigo_obra: x.codigo_obra,
          ois: []
        });
      }
      grouped.get(x.obra_id).ois.push(String(x.ordem_interna));
    });

    V35.workGroups = [...grouped.values()].map(group => {
      group.ois = [...new Set(group.ois)].sort();
      const currentName = group.ois.map(oi => V35.currentNameByOi.get(oi)).find(Boolean);
      group.display_name = currentName || group.nome_oficial;
      return group;
    });

    const active = V35.exercises.find(x => Number(x.exercicio) === V35.exercise);
    V35.exerciseStatus = active?.status || 'aberto';
    V35.movements = movements;
    V35.ready = true;
  }

  async function loadV35Context() {
    try {
      // V35.6: contexto unificado por RPC com histórico 2022–2025. Evita que uma única view indisponível
      // desligue silenciosamente todos os recursos anuais e os vínculos históricos.
      const { data, error } = await sb.rpc('get_controle_v35_contexto');
      if (error) throw error;
      if (!data || typeof data !== 'object') throw new Error('Contexto anual vazio');
      applyV35ContextPayload(data);
      console.info(`[HAPCAPEX V35.6.6] Contexto carregado: ${V35.workGroups.length} obras vinculadas / ${V35.workLinks.length} OIs vinculadas / ${V35.historyOiSet.size} obras com consumo histórico.`);
      return;
    } catch (rpcErr) {
      console.warn('[HAPCAPEX V35.6.6] RPC de contexto indisponível; tentando fallback por views.', rpcErr);
    }

    try {
      const [{ data: cfg, error: cfgErr }, { data: exercises, error: exErr }, { data: workLinks, error: workErr }, { data: currentWorks, error: currentWorksErr }] = await Promise.all([
        sb.from('vw_controle_configuracoes').select('*').eq('id','main').maybeSingle(),
        sb.from('vw_controle_exercicios').select('*').order('exercicio', { ascending: false }),
        sb.from('vw_controle_obra_oi_vinculos').select('*').order('nome_oficial', { ascending: true }),
        sb.from('vw_controle_capex_admin').select('ordem_interna,obra').limit(1000)
      ]);
      if (cfgErr) throw cfgErr;
      if (exErr) throw exErr;
      if (workErr) throw workErr;
      if (currentWorksErr) throw currentWorksErr;
      const exercise = Number(cfg?.exercicio_atual || 2026);
      const { data: mov, error: movErr } = await sb.from('vw_controle_movimentos_capex')
        .select('*').eq('exercicio', exercise).order('data_movimento', { ascending: true });
      if (movErr) throw movErr;
      applyV35ContextPayload({
        config: cfg || {},
        exercicios: exercises || [],
        vinculos: workLinks || [],
        obras_atuais: currentWorks || [],
        movimentos: mov || []
      });
    } catch (err) {
      console.warn('[HAPCAPEX V35.6.6] Contexto anual indisponível; mantendo fallback V34.', err);
      V35.ready = false;
    }
  }

  loadCurveFinanceReference = async function() {
    await originals.loadCurveFinanceReference();
    await loadV35Context();
  };

  curveFinanceTotals = function() {
    if (!V35.ready) return originals.curveFinanceTotals();
    const movements = V35.movements || [];
    const aportesMov = movements.filter(x => x.tipo === 'aporte');
    const contingMov = movements.filter(x => x.tipo === 'contingenciamento');
    const toDetails = list => list.map(x => ({
      mes: x.mes,
      nome: x.nome,
      valor: Number(x.valor || 0),
      ordem_interna: x.ordem_interna,
      origem_registro: x.origem_registro,
      afeta_estado_atual: !!x.afeta_estado_atual,
      observacao: x.observacao
    }));
    return {
      conting: contingMov.reduce((s,x) => s + Number(x.valor || 0), 0),
      aportes: aportesMov.reduce((s,x) => s + Number(x.valor || 0), 0),
      contingDetalhe: toDetails(contingMov),
      aportesDetalhe: toDetails(aportesMov)
    };
  };

  function decorateExerciseChip() {
    const user = document.querySelector('header.topbar .user-chip');
    if (!user || user.querySelector('.v35-exercise-chip')) return;
    const chip = document.createElement('span');
    chip.className = 'v35-exercise-chip';
    chip.title = 'O Controle de Capex agora possui estrutura financeira separada por exercício.';
    chip.innerHTML = `<i></i> Exercício ${currentExercise()} · ${V35.exerciseStatus === 'aberto' ? 'Atual' : escapeHtml(V35.exerciseStatus)}`;
    user.insertBefore(chip, user.firstChild);
  }

  function decorateOperationalButtons() {
    const aporte = document.getElementById('aporte-btn');
    if (aporte) {
      aporte.textContent = 'Aporte extra';
      aporte.title = 'Escolha entre aporte operacional e aporte histórico.';
      aporte.onclick = openContributionChoiceModal;
    }
    const importBtn = document.getElementById('importar-oi-btn');
    const fileInput = document.getElementById('import-file-input-oi');
    if (importBtn && fileInput) {
      importBtn.textContent = '+ Adicionar novas OIs do Excel';
      importBtn.title = 'Analisa a Base O.I completa do SAP, preserva as OIs existentes e adiciona somente as novas após definir a origem da verba.';
      importBtn.onclick = () => fileInput.click();
      fileInput.onchange = e => {
        const file = e.target.files?.[0];
        if (file) analyzeNewOisFile(file).catch(err => showImportStatusError(err));
        e.target.value = '';
      };
    }
  }

  function decorateCurrentView() {
    injectV35Styles();
    decorateExerciseChip();
    decorateYearSelectorV40139();
    decorateAnnualCloseButtonV40136();
    decorateOperationalButtons();
    decorateWorkIdentityUi();
  }

  renderCapexTab = function() { originals.renderCapexTab(); decorateCurrentView(); };
  renderBaseOiTab = function() { originals.renderBaseOiTab(); decorateCurrentView(); };
  renderBaseConsumoTab = function() { originals.renderBaseConsumoTab(); decorateCurrentView(); };
  renderTransferenciasTab = function() { originals.renderTransferenciasTab(); decorateCurrentView(); };

  // O KPI de Aportes Extras permanece somente para consulta. O registro de novos
  // aportes parte de um único botão na barra do CAPEX para evitar dois caminhos concorrentes.
  openControlKpiPanel = function(type) {
    originals.openControlKpiPanel(type);
  };

  function openContributionChoiceModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-box">
        <h2>Aporte extra</h2>
        <p class="sub">Escolha como o aporte deve ser registrado. A diferença é se o valor já está ou não incorporado ao CAPEX atual.</p>
        <div class="v35-aporte-choice-grid">
          <button type="button" class="v35-aporte-choice operacional" id="v35-aporte-operacional">
            <span class="v35-choice-kicker">Operacional</span>
            <strong>Dinheiro novo ainda não incorporado</strong>
            <small>Use quando o aporte ainda precisa entrar no Montante da OI.</small>
            <span class="v35-choice-effect">Altera o estado financeiro atual e registra o aporte na Curva.</span>
          </button>
          <button type="button" class="v35-aporte-choice historico" id="v35-aporte-historico">
            <span class="v35-choice-kicker">Histórico</span>
            <strong>Valor já incorporado à Base O.I</strong>
            <small>Use para registrar um aporte que já entrou no SAP e não pode ser somado novamente.</small>
            <span class="v35-choice-effect">Somente histórico/KPI. Não altera Montante, Compromissado, Saldo ou Curva atual.</span>
          </button>
        </div>
        <div class="modal-actions"><button class="btn btn-secondary" id="v35-aporte-choice-cancel">Cancelar</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v35-aporte-choice-cancel').onclick = () => backdrop.remove();
    backdrop.querySelector('#v35-aporte-operacional').onclick = () => {
      backdrop.remove();
      openAporteExtraModal();
    };
    backdrop.querySelector('#v35-aporte-historico').onclick = () => {
      backdrop.remove();
      openHistoricalContributionModal();
    };
  }

  function openHistoricalContributionModal() {
    const ex = currentExercise();
    const today = new Date();
    const month = today.getFullYear() === ex ? today.getMonth() + 1 : 1;
    const defaultMonth = `${ex}-${String(month).padStart(2,'0')}`;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-box">
        <h2>Registrar aporte histórico</h2>
        <p class="sub">Use quando o aporte já estiver incorporado à Base O.I do SAP. O lançamento entra no histórico do exercício e no KPI de Aportes Extras, sem somar o dinheiro novamente.</p>
        <div class="v35-block-note ok"><strong>Sem efeito financeiro adicional:</strong> Montante, Compromissado, Saldo, CAPEX atual e Curva permanecem inalterados.</div>
        <div id="v35-aporte-error"></div>
        <div class="grid-2">
          <div class="field"><label>Exercício</label><input value="${ex}" disabled></div>
          <div class="field"><label>Mês *</label><input type="month" id="v35-aporte-mes" value="${defaultMonth}" min="${ex}-01" max="${ex}-12"></div>
        </div>
        <div class="field"><label>Ordem interna *</label><input type="text" id="v35-aporte-oi"><div id="v35-aporte-oi-info" class="v35-origin-hint"></div></div>
        <div class="grid-2">
          <div class="field"><label>Valor *</label><input type="number" min="0.01" step="0.01" id="v35-aporte-valor"></div>
          <div class="field"><label>Nome do aporte (opcional)</label><input type="text" id="v35-aporte-nome"></div>
        </div>
        <div class="field"><label>Observação (opcional)</label><textarea id="v35-aporte-obs" rows="2" placeholder="Ex.: aporte aprovado e já incorporado na Base O.I de agosto"></textarea></div>
        <div class="modal-actions"><button class="btn btn-secondary" id="v35-aporte-cancel">Cancelar</button><button class="btn btn-primary" id="v35-aporte-save">Registrar histórico</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v35-aporte-cancel').onclick = () => backdrop.remove();
    backdrop.querySelector('#v35-aporte-oi').addEventListener('input', e => {
      const oi = e.target.value.trim();
      const info = backdrop.querySelector('#v35-aporte-oi-info');
      clearTimeout(window.__v35OiTimer);
      if (!oi) { info.textContent = ''; return; }
      window.__v35OiTimer = setTimeout(async () => {
        const { data } = await sb.rpc('buscar_obra_por_oi', { p_ordem_interna: oi });
        info.textContent = data?.existe ? `${data.nome || '(sem nome)'} · montante atual ${brl.format(Number(data.montante_atribuido || 0))}` : 'OI não encontrada no exercício atual.';
        info.style.color = data?.existe ? 'var(--texto-suave)' : 'var(--vermelho)';
      }, 300);
    });
    backdrop.querySelector('#v35-aporte-save').onclick = async () => {
      const oi = backdrop.querySelector('#v35-aporte-oi').value.trim();
      const valor = Number(backdrop.querySelector('#v35-aporte-valor').value || 0);
      const mes = backdrop.querySelector('#v35-aporte-mes').value;
      const errorBox = backdrop.querySelector('#v35-aporte-error');
      if (!oi || !mes || valor <= 0) { errorBox.innerHTML = '<div class="error-msg">Informe OI, mês e valor maior que zero.</div>'; return; }
      const save = backdrop.querySelector('#v35-aporte-save');
      save.disabled = true; save.textContent = 'Registrando...';
      const { error } = await sb.rpc('registrar_aporte_historico', {
        p_exercicio: ex,
        p_ordem_interna: oi,
        p_valor: valor,
        p_mes: mes,
        p_nome: backdrop.querySelector('#v35-aporte-nome').value.trim() || null,
        p_observacao: backdrop.querySelector('#v35-aporte-obs').value.trim() || null
      });
      if (error) { save.disabled = false; save.textContent = 'Registrar histórico'; errorBox.innerHTML = `<div class="error-msg">${escapeHtml(error.message)}</div>`; return; }
      backdrop.remove();
      await loadV35Context();
      await refreshCurrent();
    };
  }

  function showImportStatusError(err) {
    const el = document.getElementById('import-status-oi');
    if (el) el.innerHTML = `<span style="color:var(--vermelho)">${escapeHtml(err?.message || String(err))}</span>`;
    else alert(err?.message || String(err));
  }

  async function parseBaseOiFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames.find(n => normalizeHeader(n).includes('OI') || normalizeHeader(n).includes('O.I')) || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const headerIdx = encontrarLinhaCabecalhoBaseOI(aoa);
    if (headerIdx === -1) throw new Error('Não encontrei os cabeçalhos esperados da Base O.I (Ordem Interna + Montante/Saldo).');
    const colMap = {};
    (aoa[headerIdx] || []).forEach((h,i) => { const c = classificarColunaBaseOI(h); if (c) colMap[c] = i; });
    const linhas = [];
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.every(c => c === null || c === '')) continue;
      const rawOi = colMap.ordem_interna !== undefined ? row[colMap.ordem_interna] : null;
      if (rawOi === null || rawOi === undefined || String(rawOi).trim() === '') continue;
      linhas.push({
        ordem_interna: String(rawOi).trim(),
        descricao: colMap.descricao !== undefined ? row[colMap.descricao] : null,
        montante_atribuido: colMap.montante_atribuido !== undefined ? paraNumero(row[colMap.montante_atribuido]) : 0,
        valor_compromissado: colMap.valor_compromissado !== undefined ? paraNumero(row[colMap.valor_compromissado]) : 0,
        saldo_disponivel: colMap.saldo_disponivel !== undefined ? paraNumero(row[colMap.saldo_disponivel]) : 0,
        exercicio: colMap.exercicio !== undefined ? row[colMap.exercicio] : currentExercise(),
        linha_origem: i + 1
      });
    }
    if (!linhas.length) throw new Error('Nenhuma linha com OI foi encontrada no arquivo.');
    const wrongYear = linhas.filter(x => x.exercicio !== null && x.exercicio !== '' && Number(x.exercicio) !== currentExercise());
    if (wrongYear.length) throw new Error(`O arquivo contém ${wrongYear.length} linha(s) de exercício diferente de ${currentExercise()}. Use uma Base O.I do exercício atual.`);
    return { linhas, sheetName };
  }

  async function analyzeNewOisFile(file) {
    const status = document.getElementById('import-status-oi');
    if (status) status.textContent = 'Analisando novas OIs...';
    const parsed = await parseBaseOiFile(file);
    const { data: analysis, error } = await sb.rpc('analisar_novas_ois_base_oi', { p_exercicio: currentExercise(), p_linhas: parsed.linhas });
    if (error) throw error;
    if (status) status.textContent = '';
    openNewOisPreview(file, parsed.linhas, analysis || {});
  }

  function originLabel(value) {
    return ({ transferencia:'Transferência entre OIs', aporte:'Aporte Extra já incorporado', planejamento_inicial:'Planejamento Inicial do Ano', carry_over:'Carry Over', ajuste:'Ajuste / Outro' })[value] || 'Definir origem';
  }

  function originOptions(selected, carrySuggested) {
    const opts = [
      ['', 'Definir origem...'],
      ['transferencia','Transferência entre OIs'],
      ['aporte','Aporte Extra já incorporado'],
      ['planejamento_inicial','Planejamento Inicial do Ano'],
      ['carry_over','Carry Over'],
      ['ajuste','Ajuste / Outro']
    ];
    return opts.map(([v,l]) => `<option value="${v}" ${selected===v?'selected':''} ${v==='carry_over'&&!carrySuggested?'':' '}>${l}</option>`).join('');
  }

  function openNewOisPreview(file, lines, analysis) {
    const novas = Array.isArray(analysis.novas) ? analysis.novas : [];
    const duplicates = Array.isArray(analysis.duplicidades) ? analysis.duplicidades : [];
    const errors = Array.isArray(analysis.erros) ? analysis.erros : [];
    const divergences = Array.isArray(analysis.divergencias_existentes) ? analysis.divergencias_existentes : [];
    const blocked = !!analysis.bloqueado;
    const defaultPool = analysis.oi_bolsao_manutencao || V35.config?.oi_bolsao_manutencao || '50158051';
    const decisions = new Map();
    novas.forEach(x => {
      const suggestion = suggestHistoricalWorkLink(x);
      decisions.set(x.ordem_interna, {
        selected: true,
        tipo: x.carry_over_sugerido ? 'carry_over' : '',
        source: '',
        justification: '',
        carrySuggested: !!x.carry_over_sugerido,
        linkReference: suggestion?.referenceOi || '',
        linkSuggestion: suggestion || null
      });
    });

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-box v35-modal-xl">
        <h2>Adicionar novas OIs — Exercício ${currentExercise()}</h2>
        <p class="sub">O HAPCAPEX leu a Base O.I completa do SAP. OIs já existentes são apenas comparadas e <strong>não serão sobrescritas</strong> neste modo.</p>
        <div class="v35-summary-grid">
          <div class="v35-summary-card"><span>Linhas analisadas</span><strong>${Number(analysis.qtd_arquivo || lines.length).toLocaleString('pt-BR')}</strong></div>
          <div class="v35-summary-card"><span>OIs já existentes</span><strong>${Number(analysis.qtd_existentes || 0).toLocaleString('pt-BR')}</strong></div>
          <div class="v35-summary-card"><span>Novas OIs</span><strong>${novas.length}</strong></div>
          <div class="v35-summary-card"><span>Montante das novas</span><strong>${brl.format(Number(analysis.total_montante_novas || 0))}</strong></div>
          <div class="v35-summary-card"><span>Divergências existentes</span><strong>${divergences.length}</strong></div>
        </div>
        ${blocked ? `<div class="v35-block-note danger"><strong>Importação bloqueada.</strong> O arquivo possui ${duplicates.length} duplicidade(s) e ${errors.length} inconsistência(s) financeira(s). Nenhum dado foi alterado.</div>` : ''}
        ${!blocked && novas.length===0 ? `<div class="v35-block-note info"><strong>Nenhuma OI nova encontrada.</strong> As ${analysis.qtd_existentes || 0} OIs do exercício atual foram preservadas.</div>` : ''}
        ${divergences.length ? `<div class="v35-block-note warn"><strong>${divergences.length} OI(s) existente(s) têm valores diferentes no SAP.</strong> Elas não serão alteradas nesta operação; ficam apenas sinalizadas para uma futura atualização de fotografia.</div>` : ''}
        <div id="v35-import-error"></div>
        ${duplicates.length ? `<details class="v35-collapsible" open><summary>Duplicidades no arquivo (${duplicates.length})</summary><div class="v35-collapsible-body">${duplicates.slice(0,50).map(x=>`<div class="v35-mini-row"><strong>${escapeHtml(x.ordem_interna)}</strong><span>${escapeHtml(x.mensagem || '')}</span></div>`).join('')}</div></details>` : ''}
        ${errors.length ? `<details class="v35-collapsible" open><summary>Inconsistências financeiras (${errors.length})</summary><div class="v35-collapsible-body">${errors.slice(0,50).map(x=>`<div class="v35-mini-row"><strong>${escapeHtml(x.ordem_interna)}</strong><span>${escapeHtml(x.mensagem || '')}${x.diferenca!==undefined?' · diferença '+brl.format(Number(x.diferenca||0)):''}</span></div>`).join('')}</div></details>` : ''}
        ${divergences.length ? `<details class="v35-collapsible"><summary>OIs existentes divergentes — somente consulta (${divergences.length})</summary><div class="v35-collapsible-body">${divergences.slice(0,100).map(x=>`<div class="v35-mini-row"><div><strong>${escapeHtml(x.ordem_interna)}</strong><br><span>${escapeHtml(x.descricao || '')}</span></div><span>Sistema ${brl.format(Number(x.sistema?.montante||0))} → SAP ${brl.format(Number(x.excel?.montante||0))}</span></div>`).join('')}</div></details>` : ''}
        ${(!blocked && novas.length) ? `
          <div class="v35-bulkbar">
            <strong>Aplicar origem em massa:</strong>
            <select id="v35-bulk-origin">
              <option value="">Escolha...</option>
              <option value="maintenance">Manutenção — transferência da OI ${escapeHtml(defaultPool)}</option>
              <option value="aporte">Aporte Extra já incorporado</option>
              <option value="planejamento_inicial">Planejamento Inicial do Ano</option>
              <option value="carry_over">Carry Over — somente OIs sugeridas</option>
              <option value="ajuste">Ajuste / Outro</option>
            </select>
            <button class="btn btn-secondary" id="v35-bulk-apply">Aplicar às selecionadas</button>
            <span style="font-size:10px;color:var(--texto-suave)">Carry Overs identificados automaticamente já vêm pré-selecionados como Carry Over.</span>
          </div>
          <div style="overflow:auto;max-height:43vh;border:1px solid var(--cinza-borda);border-radius:9px">
            <table class="v35-preview-table"><thead><tr><th>Usar</th><th>OI</th><th>Obra</th><th>Montante</th><th>Comprom.</th><th>Saldo</th><th>Origem da verba</th><th>OI origem / justificativa</th><th>Histórico da obra</th></tr></thead><tbody id="v35-new-rows"></tbody></table>
          </div>
          <div id="v35-reconciliation"></div>
          <label id="v35-package-confirm-wrap" style="display:none;margin-top:10px;font-size:11px;font-weight:700"><input type="checkbox" id="v35-package-confirm"> Confirmo que, se alguma transferência envolver pacotes CAPEX diferentes, a autorização necessária foi obtida.</label>
          <label id="v35-diff-confirm-wrap" style="display:none;margin-top:10px;font-size:11px;font-weight:700;color:var(--amarelo-texto)"><input type="checkbox" id="v35-diff-confirm"> A conciliação da origem apresenta diferença e eu confirmo explicitamente que quero prosseguir.</label>
        ` : ''}
        <div class="modal-actions"><button class="btn btn-secondary" id="v35-import-cancel">Fechar</button>${(!blocked && novas.length) ? `<button class="btn btn-primary" id="v35-import-save">Criar OIs e registrar origens</button>` : ''}</div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v35-import-cancel').onclick = () => backdrop.remove();
    if (blocked || !novas.length) return;

    const tbody = backdrop.querySelector('#v35-new-rows');
    function renderRows() {
      tbody.innerHTML = novas.map(x => {
        const d = decisions.get(x.ordem_interna);
        return `<tr data-oi="${escapeHtml(x.ordem_interna)}">
          <td><input type="checkbox" class="v35-use" ${d.selected?'checked':''}></td>
          <td><strong>${escapeHtml(x.ordem_interna)}</strong>${x.carry_over_sugerido?`<div class="v35-origin-hint" style="color:var(--laranja)">↻ existiu em ${x.exercicio_anterior}</div>`:''}</td>
          <td style="white-space:normal;min-width:190px">${escapeHtml(x.descricao || '—')}</td>
          <td>${brl.format(Number(x.montante_atribuido||0))}</td>
          <td>${brl.format(Number(x.valor_compromissado||0))}</td>
          <td>${brl.format(Number(x.saldo_disponivel||0))}</td>
          <td><select class="v35-origin-select">${originOptions(d.tipo,d.carrySuggested)}</select><div class="v35-origin-hint">${d.tipo?originLabel(d.tipo):'Escolha de onde veio a verba.'}</div></td>
          <td><input type="text" class="v35-origin-source" value="${escapeHtml(d.tipo==='transferencia'?d.source:d.justification)}" placeholder="${d.tipo==='transferencia'?'OI origem':'Justificativa'}" ${['transferencia','ajuste'].includes(d.tipo)?'':'disabled'}><div class="v35-origin-hint">${d.tipo==='transferencia'?'Obrigatória para transferência.':d.tipo==='ajuste'?'Justificativa obrigatória.':'Nenhuma ação adicional.'}</div></td>
          <td><input type="text" class="v35-link-reference" value="${escapeHtml(d.linkReference||'')}" placeholder="OI anterior (opcional)" style="width:125px"><div class="${d.linkSuggestion?'v35-link-suggestion':'v35-origin-hint'}">${d.linkSuggestion?`Sugestão: mesma obra de ${escapeHtml(d.linkSuggestion.referenceOi)} · ${escapeHtml(d.linkSuggestion.nome)}`:'Deixe vazio se for uma obra nova.'}</div></td>
        </tr>`;
      }).join('');
      [...tbody.querySelectorAll('tr')].forEach(tr => {
        const oi = tr.dataset.oi, d = decisions.get(oi);
        tr.querySelector('.v35-use').onchange = e => { d.selected=e.target.checked; updateRecon(); };
        tr.querySelector('.v35-origin-select').onchange = e => {
          d.tipo=e.target.value;
          if (d.tipo==='transferencia' && !d.source) d.source=defaultPool;
          if (d.tipo!=='transferencia') d.source='';
          renderRows(); updateRecon();
        };
        tr.querySelector('.v35-origin-source').oninput = e => {
          if (d.tipo==='transferencia') d.source=e.target.value.trim(); else d.justification=e.target.value.trim();
          updateRecon();
        };
        tr.querySelector('.v35-link-reference').oninput = e => { d.linkReference=e.target.value.trim(); };
      });
    }

    backdrop.querySelector('#v35-bulk-apply').onclick = () => {
      const mode = backdrop.querySelector('#v35-bulk-origin').value;
      if (!mode) return;
      decisions.forEach(d => {
        if (!d.selected) return;
        if (mode==='maintenance') { d.tipo='transferencia'; d.source=defaultPool; }
        else if (mode==='carry_over') { if (d.carrySuggested) { d.tipo='carry_over'; d.source=''; } }
        else { d.tipo=mode; d.source=''; }
      });
      renderRows(); updateRecon();
    };

    let reconVersion = 0;
    async function updateRecon() {
      const version = ++reconVersion;
      const selected = [...decisions.entries()].filter(([,d]) => d.selected);
      const transferRows = selected.filter(([,d]) => d.tipo==='transferencia' && d.source);
      const sources = [...new Set(transferRows.map(([,d]) => d.source))];
      const reconEl = backdrop.querySelector('#v35-reconciliation');
      const packageWrap = backdrop.querySelector('#v35-package-confirm-wrap');
      packageWrap.style.display = transferRows.length ? 'block' : 'none';
      if (!sources.length) { reconEl.innerHTML=''; backdrop.querySelector('#v35-diff-confirm-wrap').style.display='none'; return; }
      reconEl.innerHTML='<div class="v35-block-note info">Calculando conciliação das OIs de origem...</div>';
      const { data: sourceStates, error: sourceErr } = await sb.from('vw_controle_oi_exercicio').select('ordem_interna,montante_atribuido,valor_compromissado,saldo_disponivel').eq('exercicio',currentExercise()).in('ordem_interna',sources);
      if (version !== reconVersion) return;
      if (sourceErr) { reconEl.innerHTML=`<div class="v35-block-note danger">Não foi possível calcular a conciliação: ${escapeHtml(sourceErr.message)}</div>`; return; }
      const stateMap = new Map((sourceStates||[]).map(x=>[x.ordem_interna,x]));
      const lineMap = new Map(lines.map(x=>[String(x.ordem_interna).trim(),x]));
      let hasDiff=false;
      const rowsHtml = sources.map(source => {
        const s=stateMap.get(source), excel=lineMap.get(source);
        const allocated=transferRows.filter(([,d])=>d.source===source).reduce((sum,[oi])=>sum+Number(novas.find(x=>x.ordem_interna===oi)?.montante_atribuido||0),0);
        const before=Number(s?.montante_atribuido||0), expected=before-allocated;
        const excelValue=excel ? Number(excel.montante_atribuido||0) : null;
        const diff=excelValue===null ? null : expected-excelValue;
        if (diff===null || Math.abs(diff)>=0.005) hasDiff=true;
        return `<div class="v35-recon-row"><span><strong>${escapeHtml(source)}</strong></span><span>Antes<br><strong>${brl.format(before)}</strong></span><span>Novas OIs<br><strong>− ${brl.format(allocated)}</strong></span><span>Esperado / SAP<br><strong>${brl.format(expected)} / ${excelValue===null?'não encontrada':brl.format(excelValue)}</strong></span><span class="${diff!==null&&Math.abs(diff)<0.005?'v35-recon-ok':'v35-recon-warn'}">Diferença<br><strong>${diff===null?'—':brl.format(diff)}</strong></span></div>`;
      }).join('');
      reconEl.innerHTML=`<div class="v35-recon"><h3>Conciliação automática da origem</h3>${rowsHtml}</div>`;
      const diffWrap=backdrop.querySelector('#v35-diff-confirm-wrap');
      diffWrap.style.display=hasDiff?'block':'none';
      if (!hasDiff) backdrop.querySelector('#v35-diff-confirm').checked=false;
    }

    renderRows(); updateRecon();

    backdrop.querySelector('#v35-import-save').onclick = async () => {
      const selected = [...decisions.entries()].filter(([,d])=>d.selected);
      const errBox=backdrop.querySelector('#v35-import-error');
      if (!selected.length) { errBox.innerHTML='<div class="error-msg">Selecione ao menos uma OI nova.</div>'; return; }
      for (const [oi,d] of selected) {
        if (!d.tipo) { errBox.innerHTML=`<div class="error-msg">Defina a origem da verba para a OI ${escapeHtml(oi)}.</div>`; return; }
        if (d.tipo==='transferencia' && !d.source) { errBox.innerHTML=`<div class="error-msg">Informe a OI de origem da transferência para ${escapeHtml(oi)}.</div>`; return; }
        if (d.tipo==='ajuste' && !d.justification) { errBox.innerHTML=`<div class="error-msg">Informe a justificativa do ajuste para ${escapeHtml(oi)}.</div>`; return; }
      }
      const hasTransfer=selected.some(([,d])=>d.tipo==='transferencia');
      const packageConfirmed=backdrop.querySelector('#v35-package-confirm')?.checked || false;
      const diffVisible=backdrop.querySelector('#v35-diff-confirm-wrap')?.style.display!=='none';
      const diffConfirmed=backdrop.querySelector('#v35-diff-confirm')?.checked || false;
      if (diffVisible && !diffConfirmed) { errBox.innerHTML='<div class="error-msg">A conciliação de origem apresenta diferença. Marque a confirmação explícita ou ajuste as origens antes de prosseguir.</div>'; return; }
      const payload=selected.map(([oi,d])=>({
        ordem_interna:oi,
        tipo:d.tipo,
        oi_origem:d.tipo==='transferencia'?d.source:null,
        justificativa:d.justification||null,
        oi_referencia:d.linkReference||null,
        confirma_pacotes_diferentes:hasTransfer?packageConfirmed:false
      }));
      const save=backdrop.querySelector('#v35-import-save');
      save.disabled=true; save.textContent='Criando e conciliando...';
      const { data: result, error } = await sb.rpc('aplicar_novas_ois_base_oi_com_vinculos', {
        p_exercicio:currentExercise(), p_linhas:lines, p_origens:payload, p_nome_arquivo:file.name, p_confirmar_divergencias:diffConfirmed
      });
      if (error) { save.disabled=false; save.textContent='Criar OIs e registrar origens'; errBox.innerHTML=`<div class="error-msg">${escapeHtml(error.message)}</div>`; return; }
      backdrop.remove();
      await loadV35Context();
      await refreshCurrent();
      const warnings=Array.isArray(result?.avisos)?result.avisos:[];
      alert(`Operação concluída.\n\nOIs criadas: ${result?.qtd_criadas||selected.length}\nMontante das novas OIs: ${brl.format(Number(result?.montante_total||0))}\nVínculos históricos criados: ${Number(result?.vinculos_historicos_criados||0)}${warnings.length?`\nAvisos de conciliação: ${warnings.length}`:''}`);
    };
  }


  function preferredHistoricalName(data) {
    const items = Array.isArray(data?.ois) ? [...data.ois].sort((a,b) => String(a?.ordem_interna||'').localeCompare(String(b?.ordem_interna||''))) : [];
    const currentName = items.map(item => String(item?.nome_atual || '').trim()).find(Boolean);
    return currentName || String(data?.nome_oficial || 'Obra');
  }

  function normalizeWorkName(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/^\s*\d{4}\./,'')
      .replace(/[^a-z0-9]+/g,' ').trim();
  }

  function workCode(value) {
    const m = String(value || '').trim().match(/^(\d{4})\./);
    return m ? m[1] : '';
  }

  function suggestHistoricalWorkLink(row) {
    const desc = String(row?.descricao || '').trim();
    const code = workCode(desc);
    const norm = normalizeWorkName(desc);
    let group = null;
    let reason = '';
    if (code && code !== '0000') {
      const hits = (V35.workGroups || []).filter(g => String(g.codigo_obra || '') === code);
      if (hits.length === 1) { group = hits[0]; reason = `código ${code}`; }
    }
    if (!group && norm.length >= 10) {
      const hits = (V35.workGroups || []).filter(g => {
        const gn = normalizeWorkName(g.display_name || g.nome_oficial);
        return gn === norm || (gn.length >= 14 && (gn.includes(norm) || norm.includes(gn)));
      });
      if (hits.length === 1) { group = hits[0]; reason = 'nome da obra'; }
    }
    if (!group) return null;
    const referenceOi = group.ois?.[0] || '';
    return referenceOi ? { obra_id:group.obra_id, nome:(group.display_name || group.nome_oficial), referenceOi, reason } : null;
  }

  function decorateWorkIdentityUi() {
    if (!V35.ready) return;
    const toolbar = document.querySelector('.toolbar');
    if (state.role === 'admin' && toolbar && !toolbar.querySelector('#v35-link-ois-btn') && ['capex','base_oi'].includes(state.tab)) {
      const button = document.createElement('button');
      button.id = 'v35-link-ois-btn';
      button.type = 'button';
      button.className = 'btn btn-secondary v35-link-btn';
      button.textContent = '🔗 Vincular OIs';
      button.title = 'Informe duas OIs que pertencem à mesma obra para construir um histórico único.';
      button.onclick = openLinkOisModal;
      const newOi = toolbar.querySelector('#nova-oi-btn');
      if (newOi) toolbar.insertBefore(button, newOi); else toolbar.appendChild(button);
    }

    document.querySelectorAll('.table-card tbody tr').forEach(tr => {
      const first = tr.querySelector('td');
      if (!first || first.querySelector('.v35-link-badge')) return;
      const match = first.textContent.match(/\b\d{8,10}\b/);
      if (!match) return;
      const oi = match[0];
      const link = V35.workLinkByOi.get(oi);
      const group = link ? V35.workGroups.find(g => g.obra_id === link.obra_id) : null;
      const groupOis = Array.isArray(group?.ois) ? group.ois : [];
      const hasImportedHistory = V35.historyOiSet.has(oi) || groupOis.some(x => V35.historyOiSet.has(String(x)));

      if ((!group || groupOis.length < 2) && !hasImportedHistory) return;

      const badge = document.createElement('span');
      badge.className = 'v35-link-badge';
      if (group && groupOis.length >= 2) {
        badge.textContent = `🔗 ${groupOis.length} OIs`;
        badge.title = hasImportedHistory
          ? `Esta obra possui ${groupOis.length} OIs vinculadas e consumo histórico anterior. Clique para ver o consolidado.`
          : `Esta OI pertence à obra histórica “${group.display_name || group.nome_oficial}”. Clique para ver o grupo.`;
      } else {
        badge.textContent = '📊 Histórico';
        badge.title = 'Esta obra possui consumo histórico anterior. Clique para ver o consolidado por exercício.';
      }
      badge.onclick = e => { e.stopPropagation(); openWorkIdentityPanel(oi); };
      first.appendChild(badge);
    });
  }

  async function openWorkIdentityPanel(oi) {
    const { data, error } = await sb.rpc('buscar_obra_historica_por_oi', { p_ordem_interna: oi });
    if (error) { alert('Não foi possível consultar o histórico da obra: ' + error.message); return; }
    if (!data) { alert('Esta obra ainda não possui histórico consolidado disponível.'); return; }

    const ois = Array.isArray(data.ois) ? data.ois : [];
    const hist = data.resumo_historico || {};
    const histYears = Array.isArray(hist.anos) ? hist.anos : [];
    const currentHist = histYears.find(y => Number(y.exercicio) === currentExercise()) || {};
    // V35.6.4 — resumo executivo independente do ano-calendário.
    // No exercício atual, realizado + comprometido pendente representam o total já compromissado.
    const roundMoney = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    const previousConsumed = roundMoney(hist.total_realizado_anterior);
    const currentAvailable = roundMoney(currentHist.disponibilizado);
    const currentCommitted = roundMoney(Number(currentHist.realizado || 0) + Number(currentHist.comprometido_pendente || 0));
    const totalConsumed = roundMoney(previousConsumed + currentCommitted);
    const currentBalance = roundMoney(currentAvailable - currentCommitted);
    const isMultiOi = ois.length > 1;

    const annualHtml = histYears.length
      ? `<div class="v35-identity-list">${histYears.map(y => {
          const isImported = y.origem === 'historico_importado' || Number(y.exercicio) < currentExercise();
          return `<div class="v35-identity-item">
            <div class="v35-identity-item-head">
              <strong>Exercício ${y.exercicio}</strong>
              <span class="flag ${isImported ? 'flag-conting' : 'flag-aporte'}">${isImported ? 'Histórico' : 'Atual'}</span>
            </div>
            <div class="v35-identity-year">
              ${isImported
                ? `<span>Consumido / Realizado <b style="color:var(--laranja)">${brl.format(Number(y.realizado||0))}</b></span>`
                : `<span>Disponibilizado <b>${brl.format(Number(y.disponibilizado||0))}</b></span>
                   <span>Consumido / Realizado <b style="color:var(--laranja)">${brl.format(Number(y.realizado||0))}</b></span>
                   <span>Comprometido pendente <b>${brl.format(Number(y.comprometido_pendente||0))}</b></span>
                   <span>Compromissado total <b>${brl.format(Number(y.compromissado_orcamentario||0))}</b></span>
                   <span>Saldo <b>${brl.format(Number(y.saldo||0))}</b></span>`}
            </div>
          </div>`;
        }).join('')}</div>`
      : '<div class="v35-block-note warn">Ainda não há dados anuais disponíveis para esta obra.</div>';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-box modal-wide">
      <h2>Histórico da obra</h2>
      <p class="sub">${escapeHtml(preferredHistoricalName(data))}${isMultiOi ? ' · o consolidado considera todas as OIs que representam esta mesma obra.' : ' · histórico consolidado da obra.'}</p>
      <div class="history-summary">
        <div><span>${isMultiOi ? 'OIs da obra' : 'OI da obra'}</span><strong>${ois.length || 1}</strong></div>
        <div><span>Código da obra</span><strong>${escapeHtml(data.codigo_obra || '—')}</strong></div>
        <div><span>Exercício atual</span><strong>${currentExercise()}</strong></div>
      </div>

      <div class="history-section">
        <div class="history-section-title">Resumo histórico para gestão</div>
        <div class="v35-summary-grid">
          <div class="v35-summary-card"><span>Consumido em anos anteriores</span><strong style="color:var(--laranja)">${brl.format(previousConsumed)}</strong></div>
          <div class="v35-summary-card"><span>Capex ${currentExercise()}</span><strong>${brl.format(currentAvailable)}</strong></div>
          <div class="v35-summary-card"><span>Compromissado em ${currentExercise()}</span><strong style="color:var(--azul-claro)">${brl.format(currentCommitted)}</strong></div>
          <div class="v35-summary-card"><span>Consumido total</span><strong style="color:var(--laranja)">${brl.format(totalConsumed)}</strong></div>
          <div class="v35-summary-card"><span>Saldo atual</span><strong style="color:${currentBalance < -0.005 ? 'var(--vermelho)' : 'var(--verde)'}">${brl.format(currentBalance)}</strong></div>
        </div>

        ${annualHtml}

      </div>

      <div class="history-section">
        <div class="history-section-title">Detalhamento por OI</div>
        <div class="v35-identity-list">${ois.map(item => {
          const years = Array.isArray(item.exercicios) ? item.exercicios : [];
          return `<div class="v35-identity-item">
            <div class="v35-identity-item-head">
              <div>
                <strong>OI ${escapeHtml(item.ordem_interna)}</strong>
                <div class="v35-origin-hint">${escapeHtml(item.nome_atual || (item.tem_cadastro_atual ? 'Cadastro atual sem nome' : 'OI histórica vinculada'))}</div>
              </div>
              <span class="flag ${item.tem_cadastro_atual?'flag-aporte':'flag-conting'}">${item.tem_cadastro_atual?'Cadastro atual':'Histórica'}</span>
            </div>
            ${years.length
              ? years.map(y => `<div class="v35-identity-year">
                  <span><b>${y.exercicio}</b>${y.carry_over?' · Carry Over':''}</span>
                  <span>Disponibilizado <b>${brl.format(Number(y.montante_atribuido||0))}</b></span>
                  <span>Consumido <b style="color:var(--laranja)">${brl.format(Number(y.realizado||0))}</b></span>
                  <span>Comprometido pendente <b>${brl.format(Number(y.comprometido_pendente||0))}</b></span>
                  <span>Compromissado total <b>${brl.format(Number(y.valor_compromissado||0))}</b></span>
                  <span>Saldo <b>${brl.format(Number(y.saldo_disponivel||0))}</b></span>
                </div>`).join('')
              : '<div class="v35-identity-year"><span>OI histórica vinculada.</span></div>'}
          </div>`;
        }).join('')}</div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" id="v35-id-close">Fechar</button>
        ${state.role === 'admin' ? '<button class="btn btn-secondary v35-link-btn" id="v35-id-link">＋ Vincular outra OI</button>' : ''}
      </div>
    </div>`;

    document.body.appendChild(backdrop);
    backdrop.querySelector('#v35-id-close').onclick = () => backdrop.remove();
    const linkBtn = backdrop.querySelector('#v35-id-link');
    if (linkBtn) linkBtn.onclick = () => { backdrop.remove(); openLinkOisModal(oi); };
  }

  function openLinkOisModal(prefillReference='') {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-box">
      <h2>Vincular OIs da mesma obra</h2>
      <p class="sub">Use quando duas OIs representam a mesma obra. O vínculo serve apenas para construir o histórico consolidado; não movimenta nenhum valor.</p>
      <div class="v35-block-note info"><strong>Sem efeito financeiro:</strong> nenhum Montante, Compromissado, Saldo, Aporte, Transferência ou valor da Curva será alterado.</div>
      <div id="v35-link-error"></div>
      <div class="field"><label>OI que deseja vincular *</label><input type="text" id="v35-link-new" placeholder="Ex.: 50160050"><div id="v35-link-new-info" class="v35-origin-hint"></div></div>
      <div class="field"><label>OI da mesma obra / referência *</label><input type="text" id="v35-link-ref" value="${escapeHtml(prefillReference)}" placeholder="Ex.: 50159120"><div id="v35-link-ref-info" class="v35-origin-hint"></div></div>
      <div class="field"><label>Observação (opcional)</label><textarea id="v35-link-obs" rows="2" placeholder="Ex.: troca de OI por CNPJ"></textarea></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v35-link-cancel">Cancelar</button><button class="btn btn-primary" id="v35-link-save">Vincular OIs</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v35-link-cancel').onclick = () => backdrop.remove();

    async function describe(inputId, infoId, allowHistorical) {
      const oi = backdrop.querySelector(inputId).value.trim();
      const info = backdrop.querySelector(infoId);
      if (!oi) { info.textContent=''; return; }
      const [{ data: current }, { data: hist }] = await Promise.all([
        sb.rpc('buscar_obra_por_oi', { p_ordem_interna:oi }),
        sb.rpc('buscar_obra_historica_por_oi', { p_ordem_interna:oi })
      ]);
      if (hist) info.textContent = `${preferredHistoricalName(hist)} · ${hist.ois?.length || 0} OI(s) no histórico consolidado`;
      else if (current?.existe) info.textContent = `${current.nome || '(sem nome)'} · cadastro atual`;
      else info.textContent = allowHistorical ? 'OI não encontrada no cadastro nem nos vínculos históricos.' : 'OI não encontrada no Controle atual.';
      info.style.color = (hist || current?.existe) ? 'var(--texto-suave)' : 'var(--vermelho)';
    }
    backdrop.querySelector('#v35-link-new').oninput = () => { clearTimeout(window.__v35LinkNew); window.__v35LinkNew=setTimeout(()=>describe('#v35-link-new','#v35-link-new-info',false),250); };
    backdrop.querySelector('#v35-link-ref').oninput = () => { clearTimeout(window.__v35LinkRef); window.__v35LinkRef=setTimeout(()=>describe('#v35-link-ref','#v35-link-ref-info',true),250); };
    if (prefillReference) describe('#v35-link-ref','#v35-link-ref-info',true);

    backdrop.querySelector('#v35-link-save').onclick = async () => {
      const oi = backdrop.querySelector('#v35-link-new').value.trim();
      const ref = backdrop.querySelector('#v35-link-ref').value.trim();
      const err = backdrop.querySelector('#v35-link-error');
      if (!oi || !ref) { err.innerHTML='<div class="error-msg">Informe as duas OIs.</div>'; return; }
      const save = backdrop.querySelector('#v35-link-save'); save.disabled=true; save.textContent='Vinculando...';
      const { data, error } = await sb.rpc('vincular_oi_a_obra', { p_ordem_interna:oi, p_oi_referencia:ref, p_observacao:backdrop.querySelector('#v35-link-obs').value.trim() || null });
      if (error) { save.disabled=false; save.textContent='Vincular OIs'; err.innerHTML=`<div class="error-msg">${escapeHtml(error.message)}</div>`; return; }
      backdrop.remove();
      await loadV35Context();
      await refreshCurrent();
      alert(`Vínculo criado.\n\n${preferredHistoricalName(data)}\nOIs vinculadas: ${(data?.ois || []).map(x=>x.ordem_interna).join(', ')}`);
    };
  }

  // V40.0.136 — Preparação auditável da virada anual. Esta etapa é SOMENTE LEITURA.
  // Não congela nem muda o exercício, não cria OIs e não envia arquivos ao servidor.
  const V40136 = {preflight:null,parsed:null,pastOis:null};

  function decorateAnnualCloseButtonV40136() {
    if(window.HAP_V40139?.isHistorical?.()){
      document.getElementById('v40136-annual-close')?.remove();
      return;
    }
    if (state.role !== 'admin' || !['capex','base_oi','base_consumo','transferencias','gerencial'].includes(String(state.tab||''))) return;
    const chip = document.querySelector('header.topbar .user-chip');
    if (!chip || chip.querySelector('#v40136-annual-close')) return;
    const button = document.createElement('button');
    button.type='button';
    button.id='v40136-annual-close';
    button.className='btn btn-secondary';
    button.textContent='Fechar exercício atual';
    button.title='Iniciar conferência anual sem alterar os dados de produção.';
    button.onclick=openAnnualWizardV40136;
    chip.insertBefore(button,chip.firstChild);
  }

  function moneyV40136(value) {
    return brl.format(Number(value||0));
  }
  function normalizeTitleV40136(input) {
    return String(input??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');
  }
  function numberV40136(value) {
    if (typeof value === 'number') return Number.isFinite(value)?value:NaN;
    let t=String(value??'').trim().replace(/\s/g,'').replace(/R\$/gi,'');
    if(!t)return NaN;
    if(t.includes(',')&&t.includes('.'))t=t.lastIndexOf(',')>t.lastIndexOf('.')?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
    else if(t.includes(','))t=t.replace(',','.');
    const n=Number(t);
    return Number.isFinite(n)?n:NaN;
  }
  function findColumnV40136(headers,patterns) {
    return headers.findIndex(h=>patterns.some(p=>p.test(h)));
  }
  function renderWizardV40136(markup) {
    const modal=document.getElementById('v40136-annual-backdrop');
    const content=modal?.querySelector('#v40136-annual-content');
    if(content)content.innerHTML=markup;
    return content;
  }
  function renderStep1V40136() {
    const d=V40136.preflight;
    const y=currentExercise();
    if(!d){renderWizardV40136(`<p>Conferindo Base O.I, Base Consumo, histórico e Transferências...</p>`);return;}
    const alerts=Array.isArray(d.alertas)?d.alertas:[];
    const section=renderWizardV40136(`
      <h3>1 de 4 · Conferência e preservação do histórico de ${y}</h3>
      <p>A fotografia final de ${y} só será gravada no fechamento definitivo. Esta conferência usa os dados vigentes e <b>não altera nenhuma informação</b>.</p>
      <h4 class="v40136-section-title">KPIs financeiros de ${y}</h4>
      <p class="v40136-section-sub">Mesma composição financeira da aba Capex, calculada para o exercício corrente.</p>
      <div class="v40136-grid">
        <div class="v40136-stat"><small>CAPEX Inicial</small><strong>${d.capex_inicial==null?'Não definido':moneyV40136(d.capex_inicial)}</strong></div>
        <div class="v40136-stat" data-tone="orange"><small>Doações</small><strong>${moneyV40136(d.doacoes)}</strong></div>
        <div class="v40136-stat" data-tone="red"><small>Contingenciamentos</small><strong>${moneyV40136(d.contingenciamentos)}</strong></div>
        <div class="v40136-stat" data-tone="green"><small>Aportes Extras</small><strong>${moneyV40136(d.aportes)}</strong></div>
        <div class="v40136-stat"><small>CAPEX Atual</small><strong>${d.capex_atual_formula==null?'Não disponível':moneyV40136(d.capex_atual_formula)}</strong></div>
        <div class="v40136-stat"><small>Compromissado</small><strong>${moneyV40136(d.compromissado_operacional)}</strong></div>
        <div class="v40136-stat" data-tone="green"><small>Saldo disponível</small><strong>${moneyV40136(d.saldo_operacional)}</strong></div>
        <div class="v40136-stat"><small>% Compromissado</small><strong>${Number(d.capex_atual_formula)>0 ? new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(d.compromissado_operacional||0)/Number(d.capex_atual_formula)) : '—'}</strong></div>
        <div class="v40136-stat"><small>Qtde de obras</small><strong>${Number(d.qtd_obras||0).toLocaleString('pt-BR')}</strong></div>
      </div>
      <div class="v40136-recon" data-status="${escapeHtml(d.status_conciliacao||'nao_disponivel')}">
        <strong>Conciliação do CAPEX Atual:</strong> ${d.diferenca_conciliacao==null?'CAPEX inicial indisponível.':`${moneyV40136(d.diferenca_conciliacao)} de diferença entre a fórmula gerencial e a soma das OIs operacionais.`}
        ${d.status_conciliacao==='divergente'?'<strong> Revisar antes do fechamento definitivo.</strong>':''}
      </div>
      <h4 class="v40136-section-title">Conferência das bases</h4>
      <p class="v40136-section-sub">Montante bruto inclui a OI técnica; os KPIs operacionais acima a excluem, como no painel Capex.</p>
      <div class="v40136-grid">
        <div class="v40136-stat"><small>Montante bruto de ${y}</small><strong>${moneyV40136(d.montante)}</strong></div>
        <div class="v40136-stat"><small>OIs do exercício (inclui OI técnica)</small><strong>${Number(d.ois||0).toLocaleString('pt-BR')}</strong></div>
        <div class="v40136-stat"><small>Base Consumo — último lote</small><strong>${Number(d.consumo_linhas||0).toLocaleString('pt-BR')} linhas</strong></div>
        <div class="v40136-stat"><small>Transferências de ${y}</small><strong>${Number(d.transferencias||0).toLocaleString('pt-BR')}</strong></div>
      </div>
      <p class="v40136-consumo-last"><b>Última Base Consumo:</b> <strong>${escapeHtml(d.lote_consumo_nome||'Não encontrada')}</strong>.</p>
      ${alerts.length?`<div class="v35-block-note warn">${alerts.map(x=>`<div>• ${escapeHtml(String(x))}</div>`).join('')}</div>`:'<div class="v35-block-note ok">Nenhum alerta automático nesta pré-conferência.</div>'}
      <label class="v40136-check"><input type="checkbox" id="v40136-understand"> Confirmo que o histórico financeiro de ${y} deverá ser preservado integralmente antes da ativação de ${y+1}. Entendo que esta prévia ainda não faz o fechamento.</label>
      <div class="modal-actions"><button type="button" class="btn btn-secondary" id="v40136-close">Cancelar</button><button type="button" class="btn btn-primary" id="v40136-step2" disabled>Continuar para planilha de ${y+1}</button></div>
    `);
    const accept=section.querySelector('#v40136-understand');
    const next=section.querySelector('#v40136-step2');
    accept.onchange=()=>next.disabled=!accept.checked;
    next.onclick=renderStep2V40136;
    section.querySelector('#v40136-close').onclick=closeAnnualWizardV40136;
  }
  function renderStep2V40136() {
    const year=currentExercise()+1;
    const content=renderWizardV40136(`
      <h3>2 de 4 · Analisar a planilha inicial de ${year}</h3>
      <p>Como o layout do Excel de ${year} ainda não foi definido, esta etapa identifica cabeçalhos e OIs sem alterar a base atual. O arquivo fica <b>somente neste navegador</b>.</p>
      <input id="v40136-file" type="file" accept=".xlsx,.xls" style="width:100%;padding:10px;border:1px solid #dde3ee;border-radius:8px">
      <div id="v40136-file-status" class="v35-block-note info">Aguardando uma planilha. A análise serve para preparar o modelo futuro de importação.</div>
      <div class="modal-actions"><button type="button" class="btn btn-secondary" id="v40136-back1">Voltar</button><button type="button" class="btn btn-secondary" id="v40136-close">Cancelar</button></div>
    `);
    content.querySelector('#v40136-back1').onclick=renderStep1V40136;
    content.querySelector('#v40136-close').onclick=closeAnnualWizardV40136;
    content.querySelector('#v40136-file').onchange=async e=>{
      const file=e.target.files?.[0];
      if(!file)return;
      const status=content.querySelector('#v40136-file-status');
      status.textContent='Lendo e verificando estrutura, OIs e duplicidades...';
      try{
        const result=await parseAnnualPlanV40136(file);
        V40136.parsed=result;
        renderStep3V40136();
      }catch(err){status.className='v35-block-note danger';status.textContent=String(err?.message||err);}
    };
  }
  async function parseAnnualPlanV40136(file) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) throw Error('Selecione um Excel .xlsx ou .xls.');
    if(file.size>25*1024*1024)throw Error('Arquivo acima de 25 MB. Precisaremos de importação em lotes para esse tamanho.');
    if(!window.XLSX)throw Error('Leitor Excel não carregado nesta sessão. Atualize a página e tente novamente.');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
    if(!wb.SheetNames.length)throw Error('O arquivo não possui abas.');
    let candidate=null;
    for(const name of wb.SheetNames){
      const aoa=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null});
      for(let i=0;i<Math.min(25,aoa.length);i++){
        const raw=aoa[i]||[];
        const headers=raw.map(normalizeTitleV40136);
        const colOi=findColumnV40136(headers,[/^oi$/,/^ordeminterna$/,/^numerooi$/,/^nroi$/,/^nordeminterna$/]);
        const colBudget=findColumnV40136(headers,[/^capex(?:inicial|20\d\d)?$/,/^montante(?:atribuido)?$/,/^orcamento(?:inicial)?$/,/^valor(?:capex|orcado)$/]);
        const colDesc=findColumnV40136(headers,[/^obra$/,/^nome(?:da)?obra$/,/^descricao(?:daobra)?$/,/^projeto$/,/^nome$/]);
        const monthCodes=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const monthCols=monthCodes.map(m=>headers.findIndex(h=>h===m||new RegExp('^'+m+'(?:eiro|ereiro|co|il|o|ho|sto|embro|ubro)?(?:\\d{2}|20\\d{2})?$').test(h)));
        if(colOi>=0){candidate={name,aoa,headerIndex:i,raw,headers,colOi,colBudget,colDesc,monthCols};break;}
      }
      if(candidate)break;
    }
    if(!candidate)throw Error('Não identifiquei uma coluna de OI. Aguarde o modelo oficial da planilha para definirmos o mapeamento. Nenhum dado foi modificado.');
    const rows=[];const duplicate=new Set(),seen=new Set();let invalid=0,total=0;let monthlyDifferences=0;
    for(let i=candidate.headerIndex+1;i<candidate.aoa.length;i++){
      const line=candidate.aoa[i];if(!line)continue;
      const rawOi=line[candidate.colOi];if(rawOi===null||rawOi===undefined||String(rawOi).trim()==='')continue;
      let oi=String(rawOi).trim().replace(/\.0+$/,'');
      if(oi.length>60){invalid++;continue;}
      if(seen.has(oi))duplicate.add(oi); else seen.add(oi);
      const capex=candidate.colBudget>=0?numberV40136(line[candidate.colBudget]):null;
      if(candidate.colBudget>=0&&(!Number.isFinite(capex)||capex<0))invalid++;
      else if(Number.isFinite(capex))total+=capex;
      if(candidate.monthCols.every(c=>c>=0)&&Number.isFinite(capex)){
        const monthly=candidate.monthCols.reduce((sum,c)=>sum+(numberV40136(line[c])||0),0);
        if(Math.abs(monthly-capex)>0.01) monthlyDifferences++;
      }
      rows.push({oi,capex,desc:candidate.colDesc>=0?String(line[candidate.colDesc]??'').slice(0,140):'',
        months:candidate.monthCols.every(c=>c>=0)?candidate.monthCols.map(c=>numberV40136(line[c])):null});
      if(rows.length>40000)throw Error('Mais de 40 mil OIs. Precisaremos processar essa planilha em lotes.');
    }
    if(!rows.length)throw Error('Não identifiquei nenhuma OI na planilha.');
    const previous=new Map();let previousIncomplete=false;
    const {data,error}=await sb.from('vw_controle_oi_exercicio')
      .select('ordem_interna,nome_obra_plano,exercicio')
      .eq('exercicio',currentExercise()).range(0,1999);
    if(error)throw new Error('Falha na comparação com o exercício anterior: '+error.message);
    for(const item of data||[])previous.set(String(item.ordem_interna),item);
    if((data||[]).length===2000)previousIncomplete=true;
    const returning=rows.filter(r=>previous.has(r.oi));
    const newOis=rows.filter(r=>!previous.has(r.oi));
    const duplicateNames=new Map();
    for(const item of previous.values()){
      const norm=normalizeTitleV40136(item.nome_obra_plano);
      if(norm&&!duplicateNames.has(norm))duplicateNames.set(norm,item.ordem_interna);
    }
    const possibleRename=newOis.filter(r=>duplicateNames.has(normalizeTitleV40136(r.desc)));
    return {name:file.name,year:currentExercise()+1,sheet:candidate.name,count:rows.length,
      columns:candidate.raw.map(v=>String(v??'')),duplicates:[...duplicate],invalid,total,monthlyDifferences,monthsRecognized:candidate.monthCols.filter(c=>c>=0).length,
      hasBudget:candidate.colBudget>=0,returning:returning.length,newOis:newOis.length,
      possibleRename:possibleRename.slice(0,12).map(r=>({oi:r.oi,prev:duplicateNames.get(normalizeTitleV40136(r.desc))})),previousIncomplete,
      rows:rows.map(r=>({oi:r.oi,descricao:r.desc,capex:Number.isFinite(r.capex)?r.capex:null,
        ...(r.months?.every(Number.isFinite)?{meses:r.months}: {})})),
      status:'PREVIA_LOCAL_NAO_IMPORTADA'};
  }
  function renderStep3V40136(){
    const d=V40136.parsed;if(!d)return renderStep2V40136();
    const notes=[
      ...(!d.hasBudget?['A coluna de CAPEX não foi identificada; o valor e a conciliação mensal precisam ser mapeados quando recebermos o Excel oficial.']:[]),
      ...(d.invalid?[`${d.invalid} linha(s) com valores inválidos ou OIs excessivamente longas.`]:[]),
      ...(d.duplicates.length?[`${d.duplicates.length} OI(s) duplicada(s) na planilha.`]:[]),
      ...(d.monthlyDifferences?[`${d.monthlyDifferences} OI(s) com divergência entre CAPEX total e distribuição mensal.`]:[]),
      ...(d.monthsRecognized<12?['Os 12 meses não foram reconhecidos integralmente. A distribuição mensal ainda precisa de validação.']:[]),
      ...(d.previousIncomplete?['A lista de OIs anteriores excedeu a prévia de 2.000 registros; será necessária comparação por lotes.']:[])
    ];
    const c=renderWizardV40136(`
      <h3>3 de 4 · Relatório preliminar de conciliação — ${d.year}</h3>
      <p>Arquivo <b>${escapeHtml(d.name)}</b> · aba <b>${escapeHtml(d.sheet)}</b>. Os números são apenas uma <b>prévia local</b>.</p>
      <div class="v40136-grid">
        <div><small>Linhas com OI</small><strong>${d.count.toLocaleString('pt-BR')}</strong></div>
        <div><small>OIs já existentes em ${d.year-1}</small><strong>${d.returning.toLocaleString('pt-BR')}</strong></div>
        <div><small>OIs não encontradas em ${d.year-1}</small><strong>${d.newOis.toLocaleString('pt-BR')}</strong></div>
        <div><small>CAPEX identificado</small><strong>${d.hasBudget?moneyV40136(d.total):'Pendente'}</strong></div>
      </div>
      <p><b>Cabeçalhos identificados:</b> ${escapeHtml(d.columns.filter(Boolean).slice(0,20).join(' · '))}</p>
      ${d.possibleRename.length?`<div class="v35-block-note info">Possíveis mudanças de OI a confirmar: ${d.possibleRename.map(x=>`<div>${escapeHtml(x.prev)} → ${escapeHtml(x.oi)}</div>`).join('')}</div>`:''}
      ${notes.length?`<div class="v35-block-note warn">${notes.map(x=>`<div>• ${escapeHtml(x)}</div>`).join('')}</div>`:''}
      <div class="v35-block-note info">O arquivo está somente em prévia local. Para registrar uma preparação no Supabase, a planilha deve apresentar OIs únicas e valores CAPEX válidos. As sugestões de mudança de OI exigirão revisão humana.</div>
      <div id="v40139-stage-status"></div>
      <div class="modal-actions"><button type="button" class="btn btn-secondary" id="v40136-back2">Escolher outro arquivo</button>
        <button type="button" class="btn btn-secondary" id="v40139-save-stage" ${d.hasBudget&&!d.invalid&&!d.duplicates.length&&!d.monthlyDifferences?'':'disabled'}>Salvar preparação de ${d.year}</button>
        <button type="button" class="btn btn-primary" id="v40136-step4">Ver condições de ativação</button></div>
    `);
    c.querySelector('#v40136-back2').onclick=renderStep2V40136;
    c.querySelector('#v40136-step4').onclick=renderStep4V40136;
    c.querySelector('#v40139-save-stage').onclick=async()=>{
      const yes=confirm(`Registrar somente a PREPARAÇÃO de ${d.year} no Supabase? O exercício ${d.year-1} continuará aberto. Nenhuma Base OI, Base Consumo ou Curva será alterada.`);
      if(!yes)return;
      const button=c.querySelector('#v40139-save-stage');const out=c.querySelector('#v40139-stage-status');
      button.disabled=true;out.textContent='Conferindo no servidor...';
      try{
        const params={p_exercicio:d.year,p_arquivo:d.name,p_planilha:d.sheet,p_dados:d.rows};
        const {data:preview,error:e1}=await sb.rpc('preparar_proximo_exercicio_v40139',{...params,p_validar:false});
        if(e1)throw e1;
        if(!preview?.valido)throw Error('Erros: '+(preview?.erros||[]).slice(0,10).join('; '));
        if(Number(preview?.capex_total)!==Number(d.total.toFixed(2)))throw Error('Divergência entre a planilha e a validação no servidor');
        const {data:result,error:e2}=await sb.rpc('preparar_proximo_exercicio_v40139',{...params,p_validar:true});
        if(e2)throw e2;
        if(!result?.valido||!result?.gravado)throw Error('O servidor não confirmou a preparação');
        out.className='v35-block-note ok';out.textContent=`Preparação ${d.year} registrada no Supabase, aguardando conferência final. ${d.year-1} permanece ativo.`;
        V40136.preparation=result;button.textContent='Preparação salva';
      }catch(err){out.className='v35-block-note danger';out.textContent=String(err.message||err);button.disabled=false;}
    };
  }
  function renderStep4V40136(){
    const y=currentExercise()+1;
    const content=renderWizardV40136(`
      <h3>4 de 4 · Aprovação e ativação de ${y}</h3>
      <div class="v35-block-note info"><b>Controle anual protegido:</b> uma simulação verifica a Base Consumo, vínculos das OIs, conciliação financeira e integridade dos registros. Nenhum exercício é fechado sem confirmação administrativa e sem a data correta.</div>
      <div id="v40139-sim-result">Consultando preparação no Supabase...</div>
      <div id="v40139-map-decisions"></div>
      <div class="modal-actions"><button type="button" class="btn btn-secondary" id="v40136-back3">Voltar</button>
        <button type="button" class="btn btn-secondary" id="v40136-close">Concluir pré-conferência</button>
        <button type="button" class="btn btn-primary" id="v40139-final-activate" disabled>Ativar ${y} (aguardando simulação)</button></div>
    `);
    content.querySelector('#v40136-back3').onclick=renderStep3V40136;
    content.querySelector('#v40136-close').onclick=closeAnnualWizardV40136;
    void (async()=>{
      const status=content.querySelector('#v40139-sim-result');
      const decisions=content.querySelector('#v40139-map-decisions');
      const button=content.querySelector('#v40139-final-activate');
      try {
        const {data:d,error}=await sb.rpc('simular_virada_exercicio_v40139',{p_exercicio:y});
        if(error)throw error;if(!document.body.contains(content))return;
        const notes=Array.isArray(d.alertas)?d.alertas:[];
        const linkSuggestions=Array.isArray(d.mudancas_oi_sugeridas)?d.mudancas_oi_sugeridas:[];
        status.innerHTML=`<div class="v40136-grid">
          <div class="v40136-stat"><small>Preparação de ${y}</small><strong style="font-size:14px">${escapeHtml(d.etapa_preparacao||'Não iniciada')}</strong></div>
          <div class="v40136-stat"><small>OIs para ${y}</small><strong>${Number(d.qtd_oi_proxima||0).toLocaleString('pt-BR')}</strong></div>
          <div class="v40136-stat"><small>CAPEX inicial de ${y}</small><strong>${moneyV40136(d.capex_proximo||0)}</strong></div>
          <div class="v40136-stat"><small>Data mínima de ativação</small><strong style="font-size:14px">01/01/${y}</strong></div>
        </div>
        <div class="v35-block-note ${d.apto_tecnicamente?'ok':'warn'}"><b>${d.apto_tecnicamente?'Pré-conferência financeira aprovada':'Há condições pendentes para ativação'}.</b>
          ${d.data_permitida?'A data mínima foi alcançada.':'Ainda não chegou a data de abertura de '+y+'.'}
        </div>
        ${notes.length?`<details class="v35-collapsible" open><summary>Alertas e conferências (${notes.length})</summary><div class="v35-collapsible-body">${notes.slice(0,30).map(t=>`<p>• ${escapeHtml(String(t))}</p>`).join('')}</div></details>`:''}`;
        if(d.etapa_preparacao==='validacao_pendente'){
          const matches=linkSuggestions.map((s,i)=>`<div class="v40139-map-row"><span><strong>OI nova ${escapeHtml(s.oi_nova)}</strong> · ${escapeHtml(s.nome||'')}</span>
            <label>Decisão<select data-v40139-link="${escapeHtml(s.oi_nova)}">
              <option value="">Selecionar...</option>
              <option value="${escapeHtml(s.oi_anterior_sugerida)}">Vincular à OI anterior ${escapeHtml(s.oi_anterior_sugerida)}</option>
              <option value="nova">Tratar como obra nova (sem vínculo)</option>
            </select></label></div>`).join('');
          decisions.innerHTML=`<div class="v35-block-note info"><b>Aprovação administrativa da planilha:</b> confira os valores e as sugestões. Vinculações são registradas somente após sua confirmação.</div>
            ${matches}<div class="modal-actions"><button class="btn btn-secondary" id="v40139-approve-plan">Aprovar preparação de ${y}</button></div><div id="v40139-approve-msg"></div>`;
          decisions.querySelector('#v40139-approve-plan').onclick=async()=>{
            const map={};let missing=false;
            decisions.querySelectorAll('[data-v40139-link]').forEach(el=>{if(!el.value)missing=true;else map[el.dataset.v40139Link]=el.value;});
            if(missing){alert('Revise cada possível mudança de OI antes da aprovação.');return;}
            if(!confirm(`Aprovar a planilha de ${y} e as decisões de Carry Over? Isso NÃO encerra ${y-1} nem ativa ${y}.`))return;
            const approve=decisions.querySelector('#v40139-approve-plan');approve.disabled=true;
            const {data:result,error:err}=await sb.rpc('aprovar_preparacao_exercicio_v40139',{p_exercicio:y,p_vinculos:map,p_confirmo:true});
            if(err){decisions.querySelector('#v40139-approve-msg').textContent=String(err.message);approve.disabled=false;return;}
            if(result?.aprovado)renderStep4V40136();
          };
        }
        if(d.apto_tecnicamente===true && d.data_permitida===true && d.etapa_preparacao==='validado'){
          button.disabled=false;button.textContent='Confirmar fechamento e ativar '+y;
          button.onclick=async()=>{
            const phrase=`FECHAR ${y-1} E ABRIR ${y}`;
            const answer=prompt(`Operação definitiva e auditável. Digite exatamente:\n${phrase}\n\nOs dados financeiros de ${y-1} serão congelados e ${y} será ativado.`);
            if(answer!==phrase){if(answer!==null)alert('Confirmação inválida. Nenhum dado foi alterado.');return;}
            if(!confirm(`Última confirmação: encerrar ${y-1}, guardar o histórico e abrir ${y}?`))return;
            button.disabled=true;button.textContent='Processando fechamento...';
            const {data:result,error:e}=await sb.rpc('concluir_virada_exercicio_v40139',{p_exercicio_proximo:y,p_confirmacao:phrase});
            if(e){alert('Virada não concluída: '+e.message+'\nAs alterações foram revertidas pelo Supabase.');button.disabled=false;button.textContent='Confirmar fechamento e ativar '+y;return;}
            if(result?.executado){alert(`Exercício ${y} ativado. Histórico de ${y-1} preservado. A página será atualizada.`);location.reload();}
          };
        }else button.textContent='Ativar '+y+' (bloqueado)';
      }catch(err){status.innerHTML=`<div class="v35-block-note danger">Não foi possível executar a simulação: ${escapeHtml(String(err.message||err))}. Nenhum dado foi alterado.</div>`;}
    })();
  }
  function closeAnnualWizardV40136(){
    V40136.parsed=null;
    document.getElementById('v40136-annual-backdrop')?.remove();
  }
  async function openAnnualWizardV40136(){
    if(state.role!=='admin')return;
    if(document.getElementById('v40136-annual-backdrop'))return;
    const backdrop=document.createElement('div');
    backdrop.id='v40136-annual-backdrop';
    backdrop.className='modal-backdrop';
    backdrop.innerHTML='<div class="modal-box modal-wide v40136-dialog" role="dialog" aria-modal="true" aria-label="Fechar exercício atual"><h2>Fechar exercício atual · Preparação segura</h2><div id="v40136-annual-content">Conferindo...</div></div>';
    document.body.appendChild(backdrop);
    V40136.preflight=null;
    V40136.parsed=null;
    renderStep1V40136();
    try{
      const {data,error}=await sb.rpc('previsualizar_fechamento_exercicio_v40136');
      if(error)throw error;
      if(!document.getElementById('v40136-annual-backdrop'))return;
      if(Number(data?.exercicio_atual)!==currentExercise())throw Error('Exercício da prévia difere do exercício ativo. Atualize a página.');
      V40136.preflight=data;
      renderStep1V40136();
    }catch(err){
      const c=renderWizardV40136(`<div class="v35-block-note danger">Não foi possível conferir o exercício: ${escapeHtml(String(err?.message||err))}. Nenhum dado foi alterado.</div><div class="modal-actions"><button class="btn btn-secondary" id="v40136-close">Fechar</button></div>`);
      c?.querySelector('#v40136-close')?.addEventListener('click',closeAnnualWizardV40136);
    }
  }


  // V40.0.139 - Filtro de exercicios: atual preserva todas as rotinas originais;
  // historicos sao SOMENTE LEITURA e consultados em paginas no Supabase.
  const A40139 = window.HAP_V40139 = {
    selectedYear: null, exercises: null, loadingYears: false,
    historicQuery:'',historicPackage:'',historicHead:'',historicPage:0,
    getSelectedYear(){return Number(this.selectedYear||currentExercise());},
    isHistorical(){return this.getSelectedYear()!==currentExercise();},
    decorateYearControl(){decorateYearSelectorV40139();},
    renderHistoricalCapex(){return renderHistoricalCapexV40139();},
    renderHistoricalBase(){return renderHistoricalBaseV40139();}
  };
  let historicalRenderTokenV40139=0;
  function showFiscalErrorV40139(err){
    app.innerHTML=`<div class="error-msg" style="margin:25px">Consulta histórica indisponível: ${escapeHtml(String(err?.message||err))}</div>`;
  }
  async function loadYearsV40139() {
    if (A40139.loadingYears || A40139.exercises) return;
    A40139.loadingYears=true;
    try {
      const {data,error}=await sb.rpc('listar_exercicios_consulta_v40138');
      if(error)throw error;
      A40139.exercises=Array.isArray(data?.exercicios)?data.exercicios:[];
      if(!A40139.exercises.some(x=>Number(x.exercicio)===A40139.getSelectedYear()))A40139.selectedYear=Number(data.atual)||currentExercise();
    }catch(err){console.warn('[HAPCAPEX] Exercícios indisponíveis:',err); A40139.exercises=[{exercicio:currentExercise(),situacao:'atual'}];}
    finally {A40139.loadingYears=false;decorateYearSelectorV40139();}
  }
  function yearSelectorMarkupV40139(){
    const choices=A40139.exercises||[{exercicio:currentExercise(),situacao:'atual'}];
    return `<label class="v40139-year-control">Exercício
      <select id="v40139-select-year" aria-label="Exercício para consulta">
       ${choices.map(x=>`<option value="${Number(x.exercicio)}" ${Number(x.exercicio)===A40139.getSelectedYear()?'selected':''}>${Number(x.exercicio)} · ${x.situacao==='atual'?'Atual':'Histórico'}</option>`).join('')}
      </select></label>`;
  }
  function decorateYearSelectorV40139(){
    try{
      if(!['capex','gerencial','base_oi','base_consumo'].includes(String(state.tab||'')))return;
      const chip=document.querySelector('header.topbar .user-chip');
      if(!chip)return;
      const existing=chip.querySelector('#v40139-select-year');
      if(existing){
        const options=yearSelectorMarkupV40139();
        const temp=document.createElement('span');temp.innerHTML=options;
        const newOptions=temp.querySelector('select')?.innerHTML;
        if(newOptions && existing.innerHTML!==newOptions)existing.innerHTML=newOptions;
        existing.value=String(A40139.getSelectedYear());return;
      }
      const slot=document.createElement('span');slot.innerHTML=yearSelectorMarkupV40139();
      chip.insertBefore(slot,chip.firstChild);
      slot.querySelector('#v40139-select-year').onchange=async ev=>{
        const y=Number(ev.target.value);
        if(!A40139.exercises?.some(x=>Number(x.exercicio)===y)){ev.target.value=String(A40139.getSelectedYear());return;}
        A40139.selectedYear=y;A40139.historicPage=0;
        A40139.historicQuery='';A40139.historicPackage='';A40139.historicHead='';
        if(state.tab==='gerencial') {
          if(window.HAP_V4071_CONTROL_MANAGERIAL?.loadManagerialTab)
            await window.HAP_V4071_CONTROL_MANAGERIAL.loadManagerialTab();
          else await refreshCurrent();
        } else if(A40139.isHistorical()){
          if(state.tab==='capex')await renderHistoricalCapexV40139();
          else await renderHistoricalBaseV40139();
        }else await refreshCurrent();
      };
      if(!A40139.exercises)void loadYearsV40139();
    }catch(e){console.warn('Seletor anual:',e);}
  }
  function historicalHeadV40139(title){
    return `<header class="topbar"><div><div class="brand-eyebrow">Controle de Capex</div><div class="brand-title">${escapeHtml(title)}</div></div>
      ${navHtml(state.role==='admin')}<div class="user-chip">${escapeHtml(state.fullName||'')} <span class="role-badge">${state.role==='admin'?'Admin':'Visualizador'}</span>
      <button class="btn btn-secondary" type="button" onclick="voltarAoSeletorHapcapex()">⇄ Trocar sistema</button>
      <button class="btn btn-secondary" id="logout-btn">Sair</button></div></header>`;
  }
  function historicKpiV40139(title,value,metric=''){
    return `<div class="kpi-card ${metric?'clickable':''}" ${metric?`data-v40139-kpi="${metric}" tabindex="0" role="button"`:''}><div class="label">${title}</div><div class="value">${moneyV40136(value)}</div></div>`;
  }
  function setupHistoryHeaderV40139(){
    document.getElementById('logout-btn')?.addEventListener('click',()=>sb.auth.signOut());
    decorateYearSelectorV40139();
  }
  async function renderHistoricalCapexV40139() {
    const y=A40139.getSelectedYear();
    if(!A40139.isHistorical())return refreshCurrent();
    const seq=++historicalRenderTokenV40139;
    const search=A40139.historicQuery;
    const pkg=A40139.historicPackage;
    const head=A40139.historicHead;
    const page=A40139.historicPage;
    try{
      const {data:d,error}=await sb.rpc('consultar_capex_historico_v40138',{
        p_exercicio:y,p_busca:search||null,p_pacote:pkg||null,p_head:head||null,
        p_limite:100,p_deslocamento:page*100});
      if(error)throw error;if(seq!==historicalRenderTokenV40139||state.tab!=='capex'||!A40139.isHistorical())return;
      const k=d.kpis||{};const rows=d.linhas||[];
      const qtd=Number(d.total_filtrado||0),last=Math.max(0,Math.ceil(qtd/100)-1);
      const opts=(values,current)=>Array.isArray(values)?values.map(v=>`<option value="${escapeHtml(String(v))}" ${String(v)===current?'selected':''}>${escapeHtml(String(v))}</option>`).join(''):'';
      app.innerHTML=`<div class="v40139-historical">${historicalHeadV40139('CAPEX · Histórico de '+y)}
      <div class="v35-block-note info"><strong>Exercício ${y} encerrado · somente consulta.</strong> Dados congelados no fechamento anual; nenhuma operação financeira pode ser feita nesta visualização.</div>
      <div class="kpi-grid v37-kpi-grid">
        ${historicKpiV40139('CAPEX Inicial',k.capex_inicial,'inicial')}
        ${historicKpiV40139('Doações',k.doacoes,'doacoes')}
        ${historicKpiV40139('Contingenciamentos',k.contingenciamentos,'contingenciamentos')}
        ${historicKpiV40139('Aportes Extras',k.aportes,'aportes')}
        ${historicKpiV40139('CAPEX Atual',k.capex_atual_formula,'conciliação')}
        ${historicKpiV40139('Compromissado',k.compromissado_operacional,'ois')}
        ${historicKpiV40139('Saldo disponível',k.saldo_operacional,'ois')}
        <div class="kpi-card"><div class="label">% Compromissado</div><div class="value">${Number(k.capex_atual_formula)>0?(Number(k.compromissado_operacional)/Number(k.capex_atual_formula)*100).toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1})+'%':'—'}</div></div>
        <div class="kpi-card"><div class="label">Qtde de obras</div><div class="value">${Number(k.qtd_obras||0).toLocaleString('pt-BR')}</div></div>
      </div>
      <div class="toolbar v40139-toolbar" style="display:flex;gap:8px;flex-wrap:wrap">
       <input id="v40139-search" placeholder="Buscar OI ou obra" value="${escapeHtml(search)}" style="min-width:200px;flex:2">
       <select id="v40139-package"><option value="">Todos os pacotes</option>${opts(d.filtros?.pacotes,pkg)}</select>
       <select id="v40139-head"><option value="">Todos os HEADs</option>${opts(d.filtros?.heads,head)}</select>
       <button class="btn btn-secondary" id="v40139-clear">Limpar filtros</button>
       <button class="btn btn-secondary" id="v40139-xlsx">Exportar Excel</button>
      </div>
      <div class="table-card" id="v40139-lista"><table><thead><tr><th>OI</th><th>Obra</th><th>Montante</th><th>Compromissado</th><th>Saldo</th><th>Pacote CAPEX</th><th>HEAD Operação</th><th>Grupo Executivo</th><th>Detalhamento</th><th>Categoria ORC</th><th>Detalhamento ORC</th></tr></thead><tbody>
      ${rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.ordem_interna)}</td><td>${escapeHtml(r.obra||'')}</td><td>${moneyV40136(r.montante_atribuido)}</td><td>${moneyV40136(r.valor_compromissado)}</td><td>${moneyV40136(r.saldo_disponivel)}</td><td>${escapeHtml(r.pacote_capex||'')}</td><td>${escapeHtml(r.head_operacao||'')}</td><td>${escapeHtml(r.grupo_executivo||'')}</td><td>${escapeHtml(r.detalhamento||'')}</td><td>${escapeHtml(r.categoria_orc||'')}</td><td>${escapeHtml(r.detalhamento_orc||'')}</td></tr>`).join(''):'<tr><td colspan="11">Nenhum registro encontrado.</td></tr>'}
      </tbody></table></div><div class="v40139-pager"><span>${qtd.toLocaleString('pt-BR')} OIs · página ${page+1} de ${last+1}</span><div><button class="btn btn-secondary" id="v40139-prev" ${page===0?'disabled':''}>Anterior</button> <button class="btn btn-secondary" id="v40139-next" ${page>=last?'disabled':''}>Próxima</button></div></div>
      </div>`;
      setupHistoryHeaderV40139();
      const reload=()=>{A40139.historicPage=0;void renderHistoricalCapexV40139();};
      document.getElementById('v40139-search').onchange=e=>{A40139.historicQuery=e.target.value.trim();reload();};
      document.getElementById('v40139-package').onchange=e=>{A40139.historicPackage=e.target.value;reload();};
      document.getElementById('v40139-head').onchange=e=>{A40139.historicHead=e.target.value;reload();};
      document.getElementById('v40139-clear').onclick=()=>{A40139.historicQuery='';A40139.historicPackage='';A40139.historicHead='';reload();};
      document.getElementById('v40139-prev').onclick=()=>{A40139.historicPage=Math.max(0,page-1);void renderHistoricalCapexV40139();};
      document.getElementById('v40139-next').onclick=()=>{A40139.historicPage=Math.min(last,page+1);void renderHistoricalCapexV40139();};
      document.getElementById('v40139-xlsx').onclick=()=>void exportHistoricalCapexV40139();
      document.querySelectorAll('[data-v40139-kpi]').forEach(node=>{
        const open=()=>void openHistoricalKpiV40139(node.dataset.v40139Kpi);
        node.onclick=open;node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
      });
    }catch(err){if(seq===historicalRenderTokenV40139)showFiscalErrorV40139(err);}
  }
  async function exportHistoricalCapexV40139(){
    if(!window.XLSX)return alert('Leitor Excel não disponível');
    const year=A40139.getSelectedYear();const all=[];
    for(let offset=0;offset<200000;offset+=100){
      const {data,error}=await sb.rpc('consultar_capex_historico_v40138',{
        p_exercicio:year,p_busca:A40139.historicQuery||null,
        p_pacote:A40139.historicPackage||null,p_head:A40139.historicHead||null,
        p_limite:100,p_deslocamento:offset});
      if(error)throw Error(error.message);all.push(...(data.linhas||[]));
      if(all.length>=Number(data.total_filtrado||0))break;
    }
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(all),'Capex '+year);
    XLSX.writeFile(wb,'HAPCAPEX_Historico_'+year+'.xlsx');
  }
  async function openHistoricalKpiV40139(metric){
    const year=A40139.getSelectedYear();const id='v40139-historical-detail';
    document.getElementById(id)?.remove();
    const modal=document.createElement('div');modal.id=id;modal.className='modal-backdrop';
    modal.innerHTML=`<div class="modal-box modal-wide"><h2>Detalhamento histórico — ${year}</h2><div id="v40139-detail-body">Carregando...</div><div class="modal-actions"><button class="btn btn-secondary" id="v40139-detail-close">Fechar</button></div></div>`;
    document.body.appendChild(modal);modal.querySelector('#v40139-detail-close').onclick=()=>modal.remove();
    const body=modal.querySelector('#v40139-detail-body');
    try{
      if(metric==='ois'){modal.remove();document.getElementById('v40139-lista')?.scrollIntoView({behavior:'smooth'});return;}
      if(['doacoes','contingenciamentos','aportes'].includes(metric)){
        const type=metric==='doacoes'?'doacoes':'movimentos';
        const {data,error}=await sb.rpc('consultar_historico_detalhes_v40138',{p_exercicio:year,p_tipo:type,p_limite:100,p_deslocamento:0});
        if(error)throw error;
        const rows=(data.linhas||[]).filter(x=>type==='doacoes'||x.tipo===(metric==='aportes'?'aporte':'contingenciamento'));
        body.innerHTML=`<p>Até 100 registros nesta consulta. Use os relatórios completos para auditoria.</p><div class="v35-collapsible-body">${rows.map(x=>`<div class="v35-mini-row"><span>${escapeHtml(x.nome||x.descricao||x.capex_destino||x.ordem_interna||'Lançamento')} · ${escapeHtml(x.data_movimento||x.data_doacao||'')}</span><strong>${moneyV40136(x.valor)}</strong></div>`).join('')||'Sem lançamentos.'}</div>`;
      }else{
        const {data,error}=await sb.rpc('consultar_capex_historico_v40138',{p_exercicio:year,p_limite:1,p_deslocamento:0});if(error)throw error;
        const k=data.kpis||{};
        body.innerHTML=`<div class="v40136-grid">${[
          ['CAPEX inicial',k.capex_inicial],['− Doações',k.doacoes],['− Contingenciamentos',k.contingenciamentos],['+ Aportes',k.aportes],['CAPEX Atual',k.capex_atual_formula],['Montante operacional',k.capex_atual_ois],['Diferença de conciliação',k.diferenca_conciliacao]
        ].map(([t,v])=>`<div class="v40136-stat"><small>${t}</small><strong>${moneyV40136(v)}</strong></div>`).join('')}</div>`;
      }
    }catch(err){body.textContent='Não foi possível consultar: '+String(err.message||err);}
  }
  async function renderHistoricalBaseV40139(){
    if(!A40139.isHistorical())return refreshCurrent();
    const year=A40139.getSelectedYear(),baseOI=state.tab==='base_oi';
    if(state.tab!=='base_oi'&&state.tab!=='base_consumo')return;
    const seq=++historicalRenderTokenV40139;
    try{
      const args=baseOI?{
        fn:'consultar_capex_historico_v40138',params:{p_exercicio:year,p_busca:A40139.historicQuery||null,p_limite:100,p_deslocamento:A40139.historicPage*100}
      }:{fn:'consultar_base_consumo_historica_v40138',params:{p_exercicio:year,p_oi:A40139.historicQuery||null,p_limite:100,p_deslocamento:A40139.historicPage*100}};
      const {data:d,error}=await sb.rpc(args.fn,args.params);if(error)throw error;
      if(seq!==historicalRenderTokenV40139||!A40139.isHistorical())return;
      const rows=d.linhas||[],total=Number(d.total_filtrado||0),page=A40139.historicPage,last=Math.max(0,Math.ceil(total/100)-1);
      const cols=baseOI?['ordem_interna','obra','montante_atribuido','valor_compromissado','saldo_disponivel','pacote_capex','head_operacao']:
        ['linha_origem','ordem_interna','descricao','categoria_valor','montante','data_lancamento','fornecedor_nome'];
      const finance=new Set(['montante_atribuido','valor_compromissado','saldo_disponivel','montante']);
      app.innerHTML=`<div class="v40139-historical">${historicalHeadV40139((baseOI?'Base O.I':'Base Consumo')+' · Histórico de '+year)}
        <div class="v35-block-note info">Exercício ${year} encerrado · somente consulta. Exibição paginada para preservar a velocidade do sistema.</div>
        <div class="toolbar"><input id="v40139-base-search" placeholder="${baseOI?'Buscar OI ou obra':'Pesquisar OI exata'}" value="${escapeHtml(A40139.historicQuery)}">
        <button class="btn btn-secondary" id="v40139-base-clear">Limpar filtro</button></div>
        <div class="table-card"><table><thead><tr>${cols.map(c=>`<th>${escapeHtml(c.replace(/_/g,' ').toUpperCase())}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${finance.has(c)?moneyV40136(r[c]):escapeHtml(r[c]??'')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}">Nenhum registro.</td></tr>`}</tbody></table></div>
        <div class="v40139-pager"><span>${total.toLocaleString('pt-BR')} registros · página ${page+1} de ${last+1}</span><div><button class="btn btn-secondary" id="v40139-base-prev" ${page===0?'disabled':''}>Anterior</button> <button class="btn btn-secondary" id="v40139-base-next" ${page>=last?'disabled':''}>Próxima</button></div></div>
        </div>`;
      setupHistoryHeaderV40139();
      document.getElementById('v40139-base-search').onchange=e=>{A40139.historicQuery=e.target.value.trim();A40139.historicPage=0;void renderHistoricalBaseV40139();};
      document.getElementById('v40139-base-clear').onclick=()=>{A40139.historicQuery='';A40139.historicPage=0;void renderHistoricalBaseV40139();};
      document.getElementById('v40139-base-prev').onclick=()=>{A40139.historicPage=Math.max(0,page-1);void renderHistoricalBaseV40139();};
      document.getElementById('v40139-base-next').onclick=()=>{A40139.historicPage=Math.min(last,page+1);void renderHistoricalBaseV40139();};
    }catch(err){if(seq===historicalRenderTokenV40139)showFiscalErrorV40139(err);}
  }
  // Quando outro módulo re-renderiza uma aba, restabelece somente a consulta histórica.
  function initAnnualObserverV40139(){
    const appEl=document.getElementById('app');if(!appEl)return;
    let pending=false;
    const observer=new MutationObserver(()=>{
      if(pending)return;pending=true;
      Promise.resolve().then(()=>{
        pending=false;
        if(!A40139.isHistorical()){
          decorateYearSelectorV40139();return;
        }
        if(state.tab==='capex'&&!appEl.querySelector('.v40139-historical'))void renderHistoricalCapexV40139();
        else if(['base_oi','base_consumo'].includes(state.tab)&&!appEl.querySelector('.v40139-historical'))void renderHistoricalBaseV40139();
        else decorateYearSelectorV40139();
      });
    });
    observer.observe(appEl,{childList:true});
    decorateYearSelectorV40139();
  }
  const annualStyle=document.createElement('style');annualStyle.id='hap-v40139-annual-style';
  annualStyle.textContent=`.v40139-year-control{display:flex;gap:5px;align-items:center;font-size:10px;font-weight:800;white-space:nowrap}
    .v40139-year-control select{padding:6px 8px;border:1px solid #cad8eb;background:#fff;border-radius:7px;color:#0d2b4e;font-weight:800}
    .v40139-pager{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin:12px 0;font-size:11px;color:#5a6882;font-weight:700}
    .v40139-historical [data-v40139-kpi]{cursor:pointer}
    .v40139-historical .table-card{overflow:auto}
    @media(max-width:680px){.v40139-year-control{width:100%;justify-content:flex-start}}
    .v40139-managerial-historical [data-v4071-edit-oi]{display:none!important}`;
  document.head.appendChild(annualStyle);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAnnualObserverV40139,{once:true});
  else initAnnualObserverV40139();

  injectV35Styles();
})();
