/* HAPCAPEX V40.0.65 — Copiar classificações de OI existente na criação de nova OI */
(() => {
  'use strict';
  if (window.__HAP_V40065_CLASS_COPY__) return;
  window.__HAP_V40065_CLASS_COPY__ = true;

  const VERSION = '40.0.65';

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function findNewOiModal(){
    return [...document.querySelectorAll('.modal-backdrop')]
      .reverse()
      .find(b => b.querySelector('h2')?.textContent?.trim() === 'Nova ordem interna' && b.querySelector('#f-oi'));
  }

  async function fetchSource(oi){
    const value = String(oi || '').trim();
    if (!value) throw new Error('Informe a OI que servirá como modelo.');
    if (typeof sb === 'undefined') throw new Error('Conexão com o Controle de Capex indisponível.');

    const { data, error } = await sb
      .from('vw_controle_capex_admin')
      .select('ordem_interna,obra,classificacao_pacote_capex,classificacao_head_operacao,grupo_executivo,detalhamento,categoria_orc,detalhamento_orc')
      .eq('ordem_interna', value)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`OI ${value} não encontrada no Controle de Capex.`);
    return data;
  }

  function setValue(backdrop, selector, value){
    const el = backdrop.querySelector(selector);
    if (!el) return;
    el.value = value ?? '';
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function enhance(backdrop){
    if (!backdrop || backdrop.dataset.v40060ClassCopy === '1') return;
    const firstClassificationGrid = backdrop.querySelector('#f-pacote')?.closest('.grid-2');
    if (!firstClassificationGrid) return;

    backdrop.dataset.v40060ClassCopy = '1';

    const box = document.createElement('div');
    box.dataset.v40060CopyBox = '1';
    box.style.cssText = 'border:1px solid #c7d8ee;background:#eef4fc;border-radius:10px;padding:11px 12px;margin:4px 0 12px;';
    box.innerHTML = `
      <div style="font-size:10px;font-weight:800;color:var(--azul);text-transform:uppercase;margin-bottom:6px;">
        Copiar classificações de outra OI
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;">
        <div class="field" style="margin:0">
          <label>OI modelo</label>
          <input type="text" id="v40060-source-oi" inputmode="numeric" autocomplete="off"
                 placeholder="Ex.: 50159120">
        </div>
        <button type="button" class="btn btn-secondary" id="v40060-copy-btn" style="height:34px;">
          Copiar classificações
        </button>
      </div>
      <div id="v40060-copy-status" style="font-size:10px;color:var(--texto-suave);margin-top:6px;line-height:1.4;">
        Copia somente Pacote CAPEX, HEAD Operação, Grupo Executivo, Detalhamento, Categoria ORC e Detalhamento ORC.
      </div>`;

    firstClassificationGrid.before(box);

    const input = box.querySelector('#v40060-source-oi');
    const btn = box.querySelector('#v40060-copy-btn');
    const status = box.querySelector('#v40060-copy-status');

    async function copy(){
      const sourceOi = input.value.trim();
      const targetOi = backdrop.querySelector('#f-oi')?.value?.trim() || '';

      if (!sourceOi){
        status.style.color = '#a52727';
        status.textContent = 'Informe a OI modelo.';
        input.focus();
        return;
      }
      if (targetOi && sourceOi === targetOi){
        status.style.color = '#a52727';
        status.textContent = 'A OI modelo deve ser diferente da nova OI.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Buscando...';
      status.style.color = 'var(--texto-suave)';
      status.textContent = `Consultando OI ${sourceOi}...`;

      try{
        const row = await fetchSource(sourceOi);

        setValue(backdrop, '#f-pacote', row.classificacao_pacote_capex);
        setValue(backdrop, '#f-head', row.classificacao_head_operacao);
        setValue(backdrop, '#f-grupo', row.grupo_executivo);
        setValue(backdrop, '#f-detalhamento', row.detalhamento);
        setValue(backdrop, '#f-categoria', row.categoria_orc);
        setValue(backdrop, '#f-detalhamento-orc', row.detalhamento_orc);

        const missing = [
          ['Pacote CAPEX', row.classificacao_pacote_capex],
          ['HEAD Operação', row.classificacao_head_operacao],
          ['Grupo Executivo', row.grupo_executivo],
          ['Detalhamento', row.detalhamento],
          ['Categoria ORC', row.categoria_orc],
          ['Detalhamento ORC', row.detalhamento_orc]
        ].filter(([,v]) => !String(v ?? '').trim()).map(([k]) => k);

        status.style.color = missing.length ? '#8a6000' : '#187342';
        status.innerHTML = missing.length
          ? `Classificações copiadas de <strong>${esc(row.ordem_interna)}</strong> — ${esc(row.obra || '')}. Campos vazios na OI modelo: ${esc(missing.join(', '))}.`
          : `✓ Classificações copiadas de <strong>${esc(row.ordem_interna)}</strong> — ${esc(row.obra || '')}.`;
      }catch(err){
        status.style.color = '#a52727';
        status.textContent = err?.message || String(err);
      }finally{
        btn.disabled = false;
        btn.textContent = 'Copiar classificações';
      }
    }

    btn.addEventListener('click', () => void copy());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter'){
        e.preventDefault();
        void copy();
      }
    });
  }

  const observer = new MutationObserver(() => {
    const backdrop = findNewOiModal();
    if (backdrop) enhance(backdrop);
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  setInterval(() => {
    const backdrop = findNewOiModal();
    if (backdrop) enhance(backdrop);
  }, 700);


  // V40.0.65 — integração com o painel histórico ORIGINAL V35.
  // Não cria badge nem painel paralelos. Apenas atualiza o contexto V35
  // antes do redraw para que o próprio v35-control-addon.js gere
  // .v35-link-badge e chame openWorkIdentityPanel().
  async function syncLegacyV35ContextV4065(){
    const V35 = window.HAP_V35;
    if (!V35 || typeof sb === 'undefined') return;

    const { data: payload, error } = await sb.rpc('get_controle_v35_contexto');
    if (error) throw error;
    if (!payload || typeof payload !== 'object') throw new Error('Contexto V35 vazio.');

    const cfg = payload.config || {};
    const exercises = Array.isArray(payload.exercicios) ? payload.exercicios : [];
    const workLinks = Array.isArray(payload.vinculos) ? payload.vinculos : [];
    const currentWorks = Array.isArray(payload.obras_atuais) ? payload.obras_atuais : [];
    const movements = Array.isArray(payload.movimentos) ? payload.movimentos : [];
    const historyOis = Array.isArray(payload.historico_ois) ? payload.historico_ois : [];

    V35.config = { ...(V35.config || {}), ...cfg };
    V35.exercise = Number(cfg.exercicio_atual || V35.exercise || new Date().getFullYear());
    V35.exercises = exercises;
    V35.workLinks = workLinks;
    V35.workLinkByOi = new Map(
      workLinks
        .filter(x => x?.ordem_interna)
        .map(x => [String(x.ordem_interna), x])
    );
    V35.currentNameByOi = new Map(
      currentWorks
        .filter(x => x?.ordem_interna && x?.obra)
        .map(x => [String(x.ordem_interna), String(x.obra)])
    );
    V35.historyOiSet = new Set(historyOis.map(x => String(x)));

    const grouped = new Map();
    workLinks.forEach(x => {
      if (!x?.obra_id || !x?.ordem_interna) return;
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
      const currentName = group.ois
        .map(oi => V35.currentNameByOi.get(oi))
        .find(Boolean);
      group.display_name = currentName || group.nome_oficial;
      return group;
    });

    const active = exercises.find(x => Number(x.exercicio) === Number(V35.exercise));
    V35.exerciseStatus = active?.status || 'aberto';
    V35.movements = movements;
    V35.ready = true;
  }

  function removeParallelMultiOiUiV4065(){
    // Segurança ao migrar da V40.0.63/64: o painel paralelo deixa de existir.
    document.querySelectorAll('[data-v4063-linked-panel]').forEach(el => el.remove());
    document.querySelectorAll('[data-v4062-oi-badge]').forEach(el => el.remove());
    document.getElementById('hap-v4062-linked-oi-styles')?.remove();
  }

  setTimeout(() => {
    removeParallelMultiOiUiV4065();

    const currentRefresh = window.refreshCurrent;
    if (typeof currentRefresh === 'function' && !currentRefresh.__hapV4065V35Sync) {
      const wrapped = async function(){
        try {
          await syncLegacyV35ContextV4065();
        } catch (err) {
          console.warn('[HAPCAPEX V40.0.65] Não foi possível atualizar o contexto histórico V35 antes do redraw:', err);
        }
        return currentRefresh.apply(this, arguments);
      };
      wrapped.__hapV4065V35Sync = true;
      wrapped.__hapV4065Original = currentRefresh;

      window.refreshCurrent = wrapped;
      try { refreshCurrent = wrapped; } catch (_) {}
    }
  }, 0);

  window.HAP_V40065 = {
    version: VERSION,
    classificationCopy: true,
    multiOiPanel: 'legacy-v35',
    refreshV35BeforeRedraw: true
  };

  window.HAP_V40060_CLASS_COPY = { version:VERSION, active:true };
})();
