/* HAPCAPEX V40.0.13 — Governança de Tipologias da Curva.
   - Preserva as tipologias existentes da Curva.
   - Elimina "Outros" apenas por overrides explícitos aprovados.
   - VISA/PPCI permanecem em "Classificação".
   - Adiciona ADM.
   - Permite classificar novas OIs no Controle e no planejamento de aporte.
   - Reconcilia CAPEX Atual x CAPEX por Tipologia com valores exatos.
*/
(() => {
  'use strict';

  const VERSION = '40.0.13';
  const TOL = 0.01;
  const TYPES = [
    'Classificação',
    'Hospital',
    'TEA',
    'Medprev',
    'Posto de Coleta',
    'Leitos / Virose',
    'Pronto Atendimento',
    'Clínica',
    'Ag. Transfusional',
    'Hemodinâmica',
    'Lab / Diagnóstico',
    'CD',
    'Mega Unidade',
    'Pacotes Regulatórios',
    'Qualivida',
    'ADM'
  ];
  const EMOJI = {
    'Classificação':'📜',
    'Hospital':'🏥',
    'TEA':'🧩',
    'Medprev':'💚',
    'Posto de Coleta':'🧪',
    'Leitos / Virose':'🛏️',
    'Pronto Atendimento':'🚑',
    'Clínica':'🩺',
    'Ag. Transfusional':'🩸',
    'Hemodinâmica':'💉',
    'Lab / Diagnóstico':'🔬',
    'CD':'📦',
    'Mega Unidade':'🏗️',
    'Pacotes Regulatórios':'📋',
    'Qualivida':'💊',
    'ADM':'🏢'
  };

  const money = value => new Intl.NumberFormat('pt-BR', {
    style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2
  }).format(Number(value || 0));

  function norm(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g,' ').trim();
  }

  function canonicalFromName(name) {
    const n = norm(name);
    if (!n) return '';

    // Exceções aprovadas explicitamente.
    if (n.includes('aquis. equip. climat. adm sorocaba')) return 'ADM';
    if (n.includes('adeq. 11º e 12º pav. adm paulista') || n.includes('adeq. 11o e 12o pav. adm paulista')) return 'ADM';
    if (n.includes('adeq unidade autonomista')) return 'Clínica';

    if (n.includes('visa') || n.includes('ppci') || n.includes('adequação') || n.includes('adequacao')) return 'Classificação';
    if (n.includes('hospital') || n.includes('hapfor') || n.includes('santa martha') || n.includes('parauapebas') || n.includes('atibaia') || n.includes('htl')) return 'Hospital';
    if (n.includes('tea') || n.includes('autismo')) return 'TEA';
    if (n.includes('medprev') || n.includes('furtado')) return 'Medprev';
    if (n.includes('coleta') || n.includes('posto de coleta')) return 'Posto de Coleta';
    if (n.includes('virose') || n.includes('leitos') || n.includes('rampa cirurgica')) return 'Leitos / Virose';
    if (n.includes('pronto atendimento') ||
        (n.includes('pa ') && !n.includes('pacote') && !n.includes('hapnatal') && !n.includes('rampa')) ||
        n.startsWith('0000.pa')) return 'Pronto Atendimento';
    if (n.includes('clínica') || n.includes('clinica')) return 'Clínica';
    if (n.includes('agência transfusional') || n.includes('agencia transfusional')) return 'Ag. Transfusional';
    if (n.includes('hemodinâmica') || n.includes('hemodinamica')) return 'Hemodinâmica';
    if (n.includes('lab') || n.includes('ima ') || n.includes('diagnóstico') || n.includes('diagnostico')) return 'Lab / Diagnóstico';
    if (n.includes('cd ') || n.includes('centro de distribuição') || n.includes('novo cd')) return 'CD';
    if (n.includes('mega')) return 'Mega Unidade';
    if (n.includes('pacote') || n.includes('regulatória') || n.includes('regulatoria')) return 'Pacotes Regulatórios';
    if (n.includes('qualivida')) return 'Qualivida';
    return '';
  }

  function typeOptions(current='', allowBlank=true) {
    const opts = [];
    if (allowBlank) opts.push(`<option value="">Selecione a tipologia</option>`);
    TYPES.forEach(type => {
      const selected = current === type ? ' selected' : '';
      opts.push(`<option value="${type}"${selected}>${EMOJI[type] || '📌'} ${type}</option>`);
    });
    return opts.join('');
  }

  function ensureStyles() {
    if (document.getElementById('hap-v4013-tipologia-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4013-tipologia-styles';
    style.textContent = `
      .v4013-tipologia-note{font-size:10px;color:var(--texto-suave,#5a6882);margin-top:5px;line-height:1.4}
      .v4013-integrity-error{margin:10px 0;padding:9px 11px;border:1px solid #e0a6a6;border-radius:9px;background:#fff4f4;color:#922828;font-size:10px;font-weight:650;line-height:1.45}
      #tipo-grid .tipo-capex{font-variant-numeric:tabular-nums}
    `;
    document.head.appendChild(style);
  }

  // -------------------- CURVA --------------------
  let lastCurveOverrideSignature = '';

  function rawItemsById() {
    const map = new Map();
    (Array.isArray(window.HAP_STATE_ITEMS) ? window.HAP_STATE_ITEMS : []).forEach(item => map.set(String(item.id), item));
    return map;
  }

  function applyCurveTypeOverrides() {
    const works = Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : [];
    if (!works.length) return;

    const rawMap = rawItemsById();
    let changed = false;
    const sigParts = [];

    works.forEach(work => {
      const raw = rawMap.get(String(work?._id));
      const explicit = String(raw?.tipologia_curva || '').trim();
      let desired = explicit;

      // Mantém a taxonomia existente, apenas corrigindo o nome esperado pelo negócio.
      if (!desired && work?.tipologia === 'Legalização') desired = 'Classificação';

      // As três exceções aprovadas também funcionam como fallback caso o cache do item
      // ainda não tenha trazido a coluna tipologia_curva.
      if (!desired && String(work?.tipologia || '') === 'Outros') desired = canonicalFromName(work?.nome);

      sigParts.push(`${work?._id}:${desired || work?.tipologia || ''}`);
      if (desired && work.tipologia !== desired) {
        work.tipologia = desired;
        changed = true;
      }
    });

    const signature = sigParts.join('|');
    if (signature === lastCurveOverrideSignature && !changed) return;
    lastCurveOverrideSignature = signature;

    if (changed && typeof window.applyFilter === 'function') {
      try { window.applyFilter(); } catch (_) {}
    }
  }

  function reconcileTypeCards() {
    const grid = document.getElementById('tipo-grid');
    if (!grid) return;

    let works = [];
    try {
      works = (typeof filteredObras !== 'undefined' && Array.isArray(filteredObras))
        ? filteredObras
        : (Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : []);
    } catch (_) {
      works = Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : [];
    }

    const grouped = new Map();
    works.forEach(work => {
      const type = String(work?.tipologia || '').trim();
      if (!type) return;
      grouped.set(type, (grouped.get(type) || 0) + Number(work?.capex || 0));
    });
    const total = works.reduce((sum, work) => sum + Number(work?.capex || 0), 0);

    grid.querySelectorAll('.tipo-card').forEach(card => {
      const labelEl = card.querySelector('.tipo-label');
      const valueEl = card.querySelector('.tipo-capex');
      const emojiEl = card.querySelector('.tipo-emoji');
      if (!labelEl || !valueEl) return;
      let label = String(labelEl.textContent || '').trim();

      if (label === 'Legalização') {
        label = 'Classificação';
        labelEl.textContent = label;
      }

      if (label.toLowerCase() === 'todas') {
        valueEl.textContent = money(total);
        valueEl.title = 'Valor exato do CAPEX das obras no filtro atual.';
      } else if (grouped.has(label)) {
        valueEl.textContent = money(grouped.get(label));
        valueEl.title = `CAPEX exato da tipologia ${label}.`;
      }

      if (emojiEl && EMOJI[label]) emojiEl.textContent = EMOJI[label];
    });

    // "Outros" não deve existir após as três reclassificações.
    grid.querySelectorAll('.tipo-card').forEach(card => {
      const label = String(card.querySelector('.tipo-label')?.textContent || '').trim();
      if (label === 'Outros' && !grouped.has('Outros')) card.remove();
    });

    const filterTipo = document.getElementById('filterTipo');
    if (filterTipo) {
      [...filterTipo.options].forEach(opt => {
        if (opt.value === 'Legalização') {
          opt.value = 'Classificação';
          opt.textContent = '📜 Classificação';
        } else if (EMOJI[opt.value]) {
          opt.textContent = `${EMOJI[opt.value]} ${opt.value}`;
        }
        if (opt.value === 'Outros' && !grouped.has('Outros')) opt.remove();
      });
    }

    const fullWorks = Array.isArray(window.HAP_RUNTIME_OBRAS) ? window.HAP_RUNTIME_OBRAS : [];
    const fullTotal = fullWorks.reduce((sum, work) => sum + Number(work?.capex || 0), 0);
    const typeTotal = fullWorks.reduce((sum, work) => sum + (String(work?.tipologia || '').trim() ? Number(work?.capex || 0) : 0), 0);
    const others = fullWorks.filter(work => String(work?.tipologia || '').trim() === 'Outros');
    const expected = Number.isFinite(Number(window.HAP_FINANCIAL_CHECK?.capexObras))
      ? Number(window.HAP_FINANCIAL_CHECK.capexObras)
      : fullTotal;
    const diff = Math.abs(typeTotal - expected);
    const ok = diff <= TOL && others.length === 0;

    window.HAP_TIPOLOGY_INTEGRITY = {
      ok, expected, typeTotal, difference:typeTotal-expected, others:others.map(x => x.nome), checkedAt:new Date().toISOString()
    };

    let warning = document.getElementById('v4013-tipologia-warning');
    if (!ok) {
      if (!warning) {
        warning = document.createElement('div');
        warning.id = 'v4013-tipologia-warning';
        warning.className = 'v4013-integrity-error';
        grid.insertAdjacentElement('afterend', warning);
      }
      warning.textContent = `⚠️ Proteção de integridade da Tipologia: CAPEX Atual ${money(expected)} · Tipologias ${money(typeTotal)}`
        + (others.length ? ` · ${others.length} obra(s) ainda sem classificação gerencial.` : '');
    } else if (warning) {
      warning.remove();
    }

    const panelTipo = document.getElementById('panel-tipo');
    if (panelTipo) {
      if (/Legalização/.test(panelTipo.textContent || '')) panelTipo.innerHTML = panelTipo.innerHTML.replace(/Legalização/g,'Classificação').replace('📌','📜');
      if (/\bADM\b/.test(panelTipo.textContent || '')) panelTipo.innerHTML = panelTipo.innerHTML.replace('📌','🏢');
    }
  }

  // -------------------- CONTROLE --------------------
  async function getStoredType(oi) {
    if (!oi || typeof sb === 'undefined') return '';
    try {
      const { data, error } = await sb.rpc('obter_tipologia_curva_oi', { p_ordem_interna:String(oi).trim() });
      if (error) return '';
      return String(data || '').trim();
    } catch (_) { return ''; }
  }

  async function saveStoredType(oi, type) {
    if (!oi || !type || typeof sb === 'undefined') return;
    const { error } = await sb.rpc('definir_tipologia_curva_oi', {
      p_ordem_interna:String(oi).trim(),
      p_tipologia_curva:type
    });
    if (error) throw error;
  }

  function addTypeField(modal, id, current='', required=true) {
    if (!modal || modal.querySelector(`#${id}`)) return modal?.querySelector(`#${id}`) || null;
    const actions = modal.querySelector('.modal-actions');
    if (!actions) return null;
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `
      <label>Tipologia da Curva${required ? ' *' : ''}</label>
      <select id="${id}" ${required ? 'required' : ''}>${typeOptions(current, true)}</select>
      <div class="v4013-tipologia-note">Classificação gerencial usada na Curva de Capex. “Outros” não é permitido.</div>
    `;
    actions.insertAdjacentElement('beforebegin', field);
    const select = field.querySelector('select');
    if (current && TYPES.includes(current)) select.value = current;
    return select;
  }

  function wrapSaveWithType(modal, saveButton, oiGetter, typeSelect, required=true) {
    if (!saveButton || saveButton.dataset.v4013Wrapped === '1') return;
    const original = saveButton.onclick;
    if (typeof original !== 'function') return;
    saveButton.dataset.v4013Wrapped = '1';

    saveButton.onclick = async function(event) {
      const type = String(typeSelect?.value || '').trim();
      if (required && !TYPES.includes(type)) {
        const err = modal.querySelector('#modal-error') || modal.querySelector('#v36-plan-error');
        if (err) err.innerHTML = '<div class="error-msg">Selecione a Tipologia da Curva antes de continuar.</div>';
        return;
      }

      const oi = String(typeof oiGetter === 'function' ? oiGetter() : '').trim();
      await original.call(this, event);

      // Os handlers originais removem o modal somente quando a operação foi concluída.
      if (!document.body.contains(modal) && oi && TYPES.includes(type)) {
        try { await saveStoredType(oi, type); }
        catch (err) { console.error('[HAPCAPEX V40.0.13] Falha ao salvar tipologia da Curva:', err); }
      }
    };
  }

  function setupNewOiModal() {
    const oiInput = document.getElementById('f-oi');
    const modal = oiInput?.closest('.modal-backdrop');
    if (!oiInput || !modal || modal.dataset.v4013TypeReady === '1') return;
    modal.dataset.v4013TypeReady = '1';

    const select = addTypeField(modal, 'v4013-new-oi-type', '', true);
    const save = modal.querySelector('#modal-save');
    wrapSaveWithType(modal, save, () => oiInput.value, select, true);
  }

  async function setupEditOiModal() {
    const descInput = document.getElementById('e-desc');
    const modal = descInput?.closest('.modal-backdrop');
    if (!descInput || !modal || modal.dataset.v4013TypeReady === '1') return;
    modal.dataset.v4013TypeReady = '1';

    const oi = String(modal.querySelector('.sub')?.textContent || '').trim();
    const current = await getStoredType(oi);
    const select = addTypeField(modal, 'v4013-edit-oi-type', current, false);
    const save = modal.querySelector('#modal-save');

    if (select && !current) {
      select.innerHTML = typeOptions('', true);
    }

    if (save && save.dataset.v4013Wrapped !== '1') {
      const original = save.onclick;
      save.dataset.v4013Wrapped = '1';
      save.onclick = async function(event) {
        const chosen = String(select?.value || '').trim();
        await original.call(this, event);
        if (!document.body.contains(modal) && oi && TYPES.includes(chosen)) {
          try { await saveStoredType(oi, chosen); }
          catch (err) { console.error('[HAPCAPEX V40.0.13] Falha ao atualizar tipologia da Curva:', err); }
        }
      };
    }
  }

  function planningOi(modal) {
    const cards = [...modal.querySelectorAll('.v36-plan-card')];
    const oiCard = cards.find(card => String(card.querySelector('span')?.textContent || '').trim().toUpperCase() === 'OI');
    return String(oiCard?.querySelector('strong')?.textContent || '').trim();
  }

  async function setupPlanningModal() {
    const old = document.getElementById('v36-p-type');
    const modal = old?.closest('.modal-backdrop');
    if (!old || !modal || old.dataset.v4013 === '1') return;

    const oi = planningOi(modal);
    const isNew = Boolean(modal.querySelector('.v36-status-pill.new'));
    const name = String(document.getElementById('v36-p-name')?.value || '').trim();
    const stored = await getStoredType(oi);
    let current = stored || canonicalFromName(name);

    const select = document.createElement('select');
    select.id = 'v36-p-type';
    select.dataset.v4013 = '1';
    select.required = true;
    select.innerHTML = typeOptions(current, true);
    if (current && TYPES.includes(current)) select.value = current;
    else select.value = '';

    old.replaceWith(select);

    const note = document.createElement('div');
    note.className = 'v4013-tipologia-note';
    note.textContent = isNew
      ? 'Obrigatório para novas obras. Selecione uma tipologia existente da Curva.'
      : 'A tipologia pode ser confirmada ou ajustada antes de aplicar o movimento.';
    select.insertAdjacentElement('afterend', note);

    const save = modal.querySelector('#v36-p-save');
    if (save && save.dataset.v4013Wrapped !== '1') {
      const original = save.onclick;
      save.dataset.v4013Wrapped = '1';
      save.onclick = async function(event) {
        const chosen = String(select.value || '').trim();
        if (!TYPES.includes(chosen)) {
          const err = modal.querySelector('#v36-plan-error');
          if (err) err.innerHTML = '<div class="error-msg">Selecione a Tipologia da Curva antes de aplicar.</div>';
          return;
        }
        await original.call(this, event);
        if (!document.body.contains(modal) && oi) {
          try { await saveStoredType(oi, chosen); }
          catch (err) { console.error('[HAPCAPEX V40.0.13] Falha ao sincronizar tipologia após planejamento:', err); }
        }
      };
    }
  }

  function installControlHooks() {
    if (window.__HAP_V4013_CONTROL_HOOKS__) return;
    if (typeof window.openNovaOiModal === 'function') {
      const original = window.openNovaOiModal;
      window.openNovaOiModal = function(...args) {
        const out = original.apply(this,args);
        setTimeout(setupNewOiModal,0);
        setTimeout(setupNewOiModal,120);
        return out;
      };
    }
    if (typeof window.editarOi === 'function') {
      const original = window.editarOi;
      window.editarOi = async function(...args) {
        const out = await original.apply(this,args);
        setTimeout(setupEditOiModal,0);
        setTimeout(setupEditOiModal,150);
        return out;
      };
    }
    window.__HAP_V4013_CONTROL_HOOKS__ = true;
  }

  function tick() {
    ensureStyles();
    installControlHooks();
    setupNewOiModal();
    void setupEditOiModal();
    void setupPlanningModal();
    applyCurveTypeOverrides();
    reconcileTypeCards();
  }

  window.addEventListener('hapcapex:curve-ready', () => {
    setTimeout(tick,0);
    setTimeout(tick,200);
    setTimeout(tick,600);
  });
  window.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  // Sem MutationObserver: preserva a baseline estável e evita loops de DOM.
  setInterval(tick,900);
  setTimeout(tick,350);

  console.info(`[HAPCAPEX V${VERSION}] Governança de Tipologias ativa.`);
})();
