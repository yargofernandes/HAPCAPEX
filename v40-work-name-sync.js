/* HAPCAPEX V40.0.14 — Renomeação integrada Controle ↔ Curva */
(() => {
  'use strict';

  const VERSION = '40.0.14';
  let installed = false;

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function stripContingency(name) {
    return String(name || '').replace(/\s*-\s*CONTIN.*$/i, '').trim();
  }

  function injectStyles() {
    if (document.getElementById('hap-v4014-name-style')) return;
    const s = document.createElement('style');
    s.id = 'hap-v4014-name-style';
    s.textContent = `
      .v4014-name-field{grid-column:1/-1}
      .v4014-name-row{display:flex;gap:8px;align-items:stretch}
      .v4014-name-row input{flex:1;min-width:0}
      .v4014-name-save{border:1px solid #b8c7da;background:#f5f8fc;color:#163b63;border-radius:8px;padding:0 12px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}
      .v4014-name-save:hover{background:#eaf1f9}
      .v4014-name-save:disabled{opacity:.6;cursor:wait}
      .v4014-name-status{display:block;margin-top:5px;font-size:10px;color:#61738a;line-height:1.35}
      .v4014-name-status.ok{color:#187342}
      .v4014-name-status.error{color:#a12727}
      @media(max-width:640px){.v4014-name-row{flex-direction:column}.v4014-name-save{padding:9px 11px}}
    `;
    document.head.appendChild(s);
  }

  function ensureField() {
    const grid = document.querySelector('#workEditModal .work-edit-grid');
    if (!grid) return null;
    let field = document.getElementById('v4014-work-name-field');
    if (field) return field;

    field = document.createElement('label');
    field.id = 'v4014-work-name-field';
    field.className = 'v4014-name-field';
    field.innerHTML = `
      Nome da obra
      <div class="v4014-name-row">
        <input id="v4014-work-name" type="text" maxlength="220" autocomplete="off">
        <button id="v4014-work-name-save" class="v4014-name-save" type="button">Atualizar nome</button>
      </div>
      <small id="v4014-work-name-status" class="v4014-name-status">
        Sincroniza o nome entre a Curva e o Controle quando a obra possui uma única OI.
      </small>`;
    grid.insertBefore(field, grid.firstChild);

    field.querySelector('#v4014-work-name-save')?.addEventListener('click', saveName);
    field.querySelector('#v4014-work-name')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void saveName();
      }
    });
    return field;
  }

  function currentItem() {
    const id = document.getElementById('workEditId')?.value;
    return (window.HAP_STATE_ITEMS || []).find(row => row.id === id) || null;
  }

  function fillName(item) {
    ensureField();
    const input = document.getElementById('v4014-work-name');
    const status = document.getElementById('v4014-work-name-status');
    if (input) input.value = stripContingency(item?.nome || '');
    if (status) {
      status.className = 'v4014-name-status';
      status.textContent = 'Sincroniza o nome entre a Curva e o Controle quando a obra possui uma única OI.';
    }
  }

  async function saveName() {
    const item = currentItem();
    const input = document.getElementById('v4014-work-name');
    const button = document.getElementById('v4014-work-name-save');
    const status = document.getElementById('v4014-work-name-status');
    const name = String(input?.value || '').trim();

    if (!item || !input || !button || !status) return;
    if (typeof currentProfile === 'undefined' || currentProfile?.role !== 'admin') return;

    if (!name) {
      status.className = 'v4014-name-status error';
      status.textContent = 'Informe o nome da obra.';
      input.focus();
      return;
    }

    if (name === stripContingency(item.nome)) {
      status.className = 'v4014-name-status';
      status.textContent = 'O nome informado já é o nome atual da obra.';
      return;
    }

    button.disabled = true;
    status.className = 'v4014-name-status';
    status.textContent = 'Salvando e sincronizando...';

    try {
      const { data, error } = await sb.rpc('renomear_obra_curva_integrado', {
        p_item_id: item.id,
        p_novo_nome: name
      });
      if (error) throw error;

      const finalName = String(data?.nome || name);
      item.nome = finalName;

      const raw = (window.HAP_DATA?.obrasRaw || []).find(w => w._id === item.id);
      if (raw) raw.nome = finalName;

      const runtime = (window.HAP_RUNTIME_OBRAS || []).find(w => w._id === item.id);
      if (runtime) runtime.nome = finalName;

      const identity = document.getElementById('workEditIdentity');
      if (identity) identity.textContent = `${item.ordem} — ${finalName}`;

      input.value = stripContingency(finalName);
      status.className = 'v4014-name-status ok';
      status.textContent = data?.multiplas_ois
        ? 'Nome atualizado na Curva. A obra possui múltiplas OIs, então o Controle não foi renomeado automaticamente.'
        : data?.controle_sincronizado
          ? 'Nome atualizado e sincronizado com o Controle de CAPEX.'
          : 'Nome atualizado na Curva. Nenhuma OI única correspondente foi encontrada no Controle.';
    } catch (err) {
      status.className = 'v4014-name-status error';
      status.textContent = 'Falha ao atualizar o nome: ' + (err?.message || String(err));
    } finally {
      button.disabled = false;
    }
  }

  function install() {
    injectStyles();
    ensureField();
    if (installed || typeof window.openWorkEditor !== 'function') return false;

    const originalOpenWorkEditor = window.openWorkEditor;
    window.openWorkEditor = function(itemId) {
      const result = originalOpenWorkEditor.apply(this, arguments);
      const item = (window.HAP_STATE_ITEMS || []).find(row => row.id === itemId);
      setTimeout(() => fillName(item), 0);
      return result;
    };

    installed = true;
    window.HAP_V4014_WORK_NAME = { version: VERSION, saveName };
    return true;
  }

  window.addEventListener('hapcapex:curve-ready', () => {
    setTimeout(install, 0);
    setTimeout(install, 250);
  });
  window.addEventListener('pageshow', () => setTimeout(install, 0));

  install();
  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 500);
  setTimeout(() => clearInterval(timer), 120000);
})();
