/* HAPCAPEX V40.0.84 — Cópia global de classificações em todos os fluxos de criação de OI */
(() => {
  'use strict';
  if (window.__HAP_V40084_GLOBAL_CLASS_COPY__) return;
  window.__HAP_V40084_GLOBAL_CLASS_COPY__ = true;

  const VERSION = '40.0.84';
  const COPY_FIELDS = [
    ['Pacote CAPEX', 'classificacao_pacote_capex', 'pacote'],
    ['HEAD Operação', 'classificacao_head_operacao', 'head'],
    ['Grupo Executivo', 'grupo_executivo', 'grupo'],
    ['Detalhamento', 'detalhamento', 'detalhamento'],
    ['Categoria ORC', 'categoria_orc', 'categoria'],
    ['Detalhamento ORC', 'detalhamento_orc', 'detalhamentoOrc']
  ];

  const KNOWN_FORMS = [
    {
      name: 'padrao',
      oi: '#f-oi', pacote: '#f-pacote', head: '#f-head', grupo: '#f-grupo',
      detalhamento: '#f-detalhamento', categoria: '#f-categoria', detalhamentoOrc: '#f-detalhamento-orc'
    },
    {
      name: 'aporte-extra',
      oi: '#v375-f-oi', pacote: '#v375-f-pacote', head: '#v375-f-head', grupo: '#v375-f-grupo',
      detalhamento: '#v375-f-detalhamento', categoria: '#v375-f-categoria', detalhamentoOrc: '#v375-f-detalhamento-orc'
    },
    {
      name: 'transferencia',
      oi: '#v376-f-oi', pacote: '#v376-f-pacote', head: '#v376-f-head', grupo: '#v376-f-grupo',
      detalhamento: '#v376-f-detalhamento', categoria: '#v376-f-categoria', detalhamentoOrc: '#v376-f-detalhamento-orc'
    }
  ];

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function norm(v){
    return String(v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function isCreateContext(backdrop){
    if (!backdrop) return false;
    if (backdrop.dataset.v375CreateOi === '1' || backdrop.dataset.v376CreateTransferOi === '1') return true;
    const title = norm(backdrop.querySelector('h1,h2,h3,.modal-title')?.textContent || '');
    if (/(nova|novo|criar|cadastrar|incluir).*(ordem interna|\boi\b)/.test(title)) return true;
    return [...backdrop.querySelectorAll('button')].some(btn => /(criar|cadastrar|incluir).*(oi|ordem)/.test(norm(btn.textContent)));
  }

  function fieldByLabel(backdrop, matcher){
    const labels = [...backdrop.querySelectorAll('.field label,label')];
    for (const label of labels){
      const text = norm(label.textContent);
      if (!matcher(text)) continue;
      const field = label.closest('.field') || label.parentElement;
      const input = field?.querySelector('input:not([type="hidden"]),select,textarea');
      if (input) return input;
    }
    return null;
  }

  function semanticForm(backdrop){
    const oi = fieldByLabel(backdrop, t => t.startsWith('ordem interna') || t === 'oi' || t.startsWith('oi '));
    const pacote = fieldByLabel(backdrop, t => t.includes('pacote capex'));
    const head = fieldByLabel(backdrop, t => t.includes('head') && t.includes('oper'));
    const grupo = fieldByLabel(backdrop, t => t.includes('grupo executivo'));
    const detalhamentoOrc = fieldByLabel(backdrop, t => t.includes('detalhamento orc'));
    const categoria = fieldByLabel(backdrop, t => t.includes('categoria orc') && !t.includes('detalhamento'));
    const detalhamento = fieldByLabel(backdrop, t => t.startsWith('detalhamento') && !t.includes('orc'));
    if (!oi || !pacote || !head) return null;
    return { name:'semantico', oi, pacote, head, grupo, detalhamento, categoria, detalhamentoOrc };
  }

  function resolveForm(backdrop){
    for (const def of KNOWN_FORMS){
      const oi = backdrop.querySelector(def.oi);
      const pacote = backdrop.querySelector(def.pacote);
      const head = backdrop.querySelector(def.head);
      if (!oi || !pacote || !head) continue;
      return {
        name:def.name,
        oi,
        pacote,
        head,
        grupo:backdrop.querySelector(def.grupo),
        detalhamento:backdrop.querySelector(def.detalhamento),
        categoria:backdrop.querySelector(def.categoria),
        detalhamentoOrc:backdrop.querySelector(def.detalhamentoOrc)
      };
    }
    return semanticForm(backdrop);
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

  function setValue(el, value){
    if (!el) return;
    el.value = value ?? '';
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function makeBox(backdrop, form){
    const box = document.createElement('div');
    box.dataset.v40084GlobalCopyBox = '1';
    // Compatibilidade com o módulo V40.0.65: evita caixa duplicada no formulário padrão.
    box.dataset.v40060CopyBox = '1';
    box.style.cssText = 'border:1px solid #c7d8ee;background:#eef4fc;border-radius:10px;padding:11px 12px;margin:4px 0 12px;';
    box.innerHTML = `
      <div style="font-size:10px;font-weight:800;color:var(--azul);text-transform:uppercase;margin-bottom:6px;">
        Copiar classificações de outra OI
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;">
        <div class="field" style="margin:0">
          <label>OI modelo</label>
          <input type="text" data-v40084-source-oi inputmode="numeric" autocomplete="off" placeholder="Ex.: 50159120">
        </div>
        <button type="button" class="btn btn-secondary" data-v40084-copy-btn style="height:34px;">
          Copiar classificações
        </button>
      </div>
      <div data-v40084-copy-status style="font-size:10px;color:var(--texto-suave);margin-top:6px;line-height:1.4;">
        Copia somente Pacote CAPEX, HEAD Operação, Grupo Executivo, Detalhamento, Categoria ORC e Detalhamento ORC.
      </div>`;

    const packageField = form.pacote?.closest('.field') || form.pacote?.parentElement;
    const insertionAnchor = packageField?.closest('.grid-2,.grid-3') || packageField;
    if (!insertionAnchor?.parentNode) return null;
    insertionAnchor.parentNode.insertBefore(box, insertionAnchor);
    return box;
  }

  function enhance(backdrop){
    if (!backdrop || !isCreateContext(backdrop)) return;
    if (backdrop.querySelector('[data-v40060-copy-box],[data-v40084-global-copy-box]')) return;

    const form = resolveForm(backdrop);
    if (!form) return;

    // No formulário padrão, sinaliza também o marcador legado para impedir corrida com V40.0.65.
    if (form.name === 'padrao') backdrop.dataset.v40060ClassCopy = '1';
    backdrop.dataset.v40084GlobalClassCopy = '1';

    const box = makeBox(backdrop, form);
    if (!box) return;

    const input = box.querySelector('[data-v40084-source-oi]');
    const btn = box.querySelector('[data-v40084-copy-btn]');
    const status = box.querySelector('[data-v40084-copy-status]');

    async function copy(){
      const sourceOi = String(input?.value || '').trim();
      const targetOi = String(form.oi?.value || '').trim();

      if (!sourceOi){
        status.style.color = '#a52727';
        status.textContent = 'Informe a OI modelo.';
        input?.focus();
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
        const targets = {
          pacote: form.pacote,
          head: form.head,
          grupo: form.grupo,
          detalhamento: form.detalhamento,
          categoria: form.categoria,
          detalhamentoOrc: form.detalhamentoOrc
        };

        for (const [, sourceKey, targetKey] of COPY_FIELDS){
          setValue(targets[targetKey], row[sourceKey]);
        }

        const unavailable = COPY_FIELDS.filter(([, , targetKey]) => !targets[targetKey]).map(([label]) => label);
        const missing = COPY_FIELDS
          .filter(([, , targetKey]) => targets[targetKey])
          .filter(([, sourceKey]) => !String(row[sourceKey] ?? '').trim())
          .map(([label]) => label);

        const warnings = [];
        if (missing.length) warnings.push(`campos vazios na OI modelo: ${missing.join(', ')}`);
        if (unavailable.length) warnings.push(`campos não disponíveis neste formulário: ${unavailable.join(', ')}`);

        status.style.color = warnings.length ? '#8a6000' : '#187342';
        status.innerHTML = warnings.length
          ? `Classificações copiadas de <strong>${esc(row.ordem_interna)}</strong> — ${esc(row.obra || '')}. ${esc(warnings.join(' · '))}.`
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

  function scan(root=document){
    if (root?.matches?.('.modal-backdrop')) enhance(root);
    root?.querySelectorAll?.('.modal-backdrop').forEach(enhance);
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations){
      mutation.addedNodes.forEach(node => {
        if (node?.nodeType === 1) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  scan();
  setInterval(scan, 900);

  window.HAP_V40084 = {
    version: VERSION,
    globalClassificationCopy: true,
    supportedKnownFlows: ['nova-oi', 'aporte-extra', 'transferencia'],
    semanticFallback: true
  };
})();
