/* HAPCAPEX V40.0.62 — Copiar classificações de OI existente na criação de nova OI */
(() => {
  'use strict';
  if (window.__HAP_V40060_CLASS_COPY__) return;
  window.__HAP_V40060_CLASS_COPY__ = true;

  const VERSION = '40.0.62';

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


  // V40.0.62 — engrenagem de OIs vinculadas:
  // a composição oficial da Curva (capex_items.ordem) é a fonte única da contagem visual.
  let linkedOiMapV4062 = new Map();
  let linkedOiRefreshPromiseV4062 = null;
  let linkedOiDecorateTimerV4062 = null;

  function splitOisV4062(value){
    return [...new Set(
      String(value || '')
        .split(';')
        .map(v => v.trim())
        .filter(v => /^\d{5,}$/.test(v))
    )];
  }

  async function loadLinkedOiMapV4062(force=false){
    if (!force && linkedOiMapV4062.size) return linkedOiMapV4062;
    if (linkedOiRefreshPromiseV4062) return linkedOiRefreshPromiseV4062;

    linkedOiRefreshPromiseV4062 = (async () => {
      if (typeof sb === 'undefined') return linkedOiMapV4062;
      const { data, error } = await sb
        .from('capex_items')
        .select('id,nome,ordem')
        .eq('categoria','obra')
        .is('deleted_at', null);

      if (error) throw error;

      const next = new Map();
      for (const item of (data || [])){
        const ois = splitOisV4062(item.ordem);
        if (ois.length < 2) continue;
        const group = {
          curva_item_id: item.id,
          nome: item.nome || '',
          ois,
          qtd: ois.length
        };
        for (const oi of ois) next.set(oi, group);
      }
      linkedOiMapV4062 = next;
      return linkedOiMapV4062;
    })();

    try { return await linkedOiRefreshPromiseV4062; }
    finally { linkedOiRefreshPromiseV4062 = null; }
  }

  function ensureLinkedOiStylesV4062(){
    if (document.getElementById('hap-v4062-linked-oi-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4062-linked-oi-styles';
    style.textContent = `
      .v4062-oi-badge{
        display:inline-flex;align-items:center;gap:4px;margin-left:6px;
        padding:2px 7px;border-radius:999px;border:1px solid #d8c7f1;
        background:#f3eafd;color:#6b3fa0;font-size:9px;font-weight:800;
        line-height:1.2;vertical-align:middle;white-space:nowrap;cursor:default
      }
    `;
    document.head.appendChild(style);
  }

  function rowOiV4062(row){
    const cell = row?.cells?.[0];
    if (!cell) return '';
    const own = cell.dataset?.v4062Oi;
    if (own) return own;
    const match = String(cell.textContent || '').match(/\b\d{5,}\b/);
    if (!match) return '';
    cell.dataset.v4062Oi = match[0];
    return match[0];
  }

  function decorateLinkedOiBadgesV4062(){
    ensureLinkedOiStylesV4062();

    for (const row of document.querySelectorAll('.table-card tbody tr')){
      const cell = row.cells?.[0];
      if (!cell) continue;
      const oi = rowOiV4062(row);
      if (!oi) continue;

      const group = linkedOiMapV4062.get(oi);
      const ours = cell.querySelector('[data-v4062-oi-badge]');

      // Se outro módulo legado já renderizou corretamente "N OIs", não duplica.
      const legacyBadge = [...cell.querySelectorAll('span')]
        .find(el => !el.hasAttribute('data-v4062-oi-badge') && /\b\d+\s*OIs?\b/i.test(el.textContent || ''));

      if (!group || group.qtd < 2){
        ours?.remove();
        continue;
      }
      if (legacyBadge){
        ours?.remove();
        continue;
      }

      const badge = ours || document.createElement('span');
      badge.className = 'v4062-oi-badge';
      badge.dataset.v4062OiBadge = '1';
      badge.textContent = `🔗 ${group.qtd} OIs`;
      badge.title = `${group.nome}\nOIs: ${group.ois.join(' ; ')}`;
      if (!ours) cell.appendChild(badge);
    }
  }

  async function refreshLinkedOiBadgesV4062(force=false){
    try{
      await loadLinkedOiMapV4062(force);
      decorateLinkedOiBadgesV4062();
    }catch(err){
      console.warn('[HAPCAPEX V40.0.62] Falha ao atualizar contagem de OIs vinculadas:', err);
    }
  }

  function scheduleLinkedOiDecorateV4062(){
    clearTimeout(linkedOiDecorateTimerV4062);
    linkedOiDecorateTimerV4062 = setTimeout(() => {
      decorateLinkedOiBadgesV4062();
    }, 60);
  }

  // Recalcula após qualquer atualização real do Controle.
  setTimeout(() => {
    const currentRefresh = window.refreshCurrent;
    if (typeof currentRefresh === 'function' && !currentRefresh.__hapV4062LinkedOi){
      const wrapped = async function(){
        const result = await currentRefresh.apply(this, arguments);
        linkedOiMapV4062 = new Map();
        await refreshLinkedOiBadgesV4062(true);
        return result;
      };
      wrapped.__hapV4062LinkedOi = true;
      wrapped.__hapV4062Original = currentRefresh;
      window.refreshCurrent = refreshCurrent = wrapped;
    }
    void refreshLinkedOiBadgesV4062(true);
  }, 0);

  // Garante decoração quando filtros/tabelas forem redesenhados sem round-trip.
  const linkedObserverV4062 = new MutationObserver(scheduleLinkedOiDecorateV4062);
  linkedObserverV4062.observe(document.documentElement, { childList:true, subtree:true });

  // Fallback leve para vínculos feitos por rotinas que não chamem refreshCurrent.
  setInterval(() => { void refreshLinkedOiBadgesV4062(true); }, 15000);

  window.HAP_V40060_CLASS_COPY = { version:VERSION, active:true, features:['classification-copy','linked-oi-count'] };
})();
