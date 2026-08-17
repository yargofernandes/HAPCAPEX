/* HAPCAPEX V30 — edição de Obras Não Planejadas e reclassificação de realizado */
(() => {
  'use strict';

  const V30_MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const V30_LABELS = {jan:'Jan/26',fev:'Fev/26',mar:'Mar/26',abr:'Abr/26',mai:'Mai/26',jun:'Jun/26',jul:'Jul/26',ago:'Ago/26',set:'Set/26',out:'Out/26',nov:'Nov/26',dez:'Dez/26'};
  const v30Num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const v30Brl = value => v30Num(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const v30Esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const byId = id => document.getElementById(id);
  let initialized = false;
  let destinationFilter = '';

  function profileReady() {
    try { return typeof currentProfile !== 'undefined' && currentProfile && Array.isArray(window.HAP_STATE_ITEMS); }
    catch (_) { return false; }
  }
  function isAdmin() {
    try { return currentProfile?.role === 'admin'; }
    catch (_) { return false; }
  }
  function activeItems() { return Array.isArray(window.HAP_STATE_ITEMS) ? window.HAP_STATE_ITEMS : []; }
  function nonPlannedItem() {
    return activeItems().find(item => item.categoria === 'obra' && item.ordem === 'NAO_PLANEJADAS') || null;
  }
  function destinationWorks() {
    return activeItems()
      .filter(item => item.categoria === 'obra' && item.ordem !== 'NAO_PLANEJADAS' && !/PACOTE DE MANUTEN[ÇC][AÃ]O DIA A DIA/i.test(String(item.nome || '')))
      .sort((a,b) => String(a.ordem || '').localeCompare(String(b.ordem || ''), 'pt-BR') || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  }
  function reportingIndex() {
    const key = window.HAP_DATA?.reportingMonthKey || 'jan';
    const index = V30_MONTHS.indexOf(key);
    return index >= 0 ? index : 0;
  }
  function editableMonths() { return V30_MONTHS.slice(0, reportingIndex() + 1); }
  function openV30Modal(id) { byId(id)?.classList.add('open'); }
  function closeV30Modal(id) { byId(id)?.classList.remove('open'); }
  async function backup(label) {
    const { error } = await sb.rpc('create_capex_backup', { p_type:'manual', p_force:true, p_label:label });
    if (error) throw error;
  }

  function injectStyles() {
    if (byId('v30Styles')) return;
    const style = document.createElement('style');
    style.id = 'v30Styles';
    style.textContent = `
      .v30-toolbar-btn{white-space:nowrap}
      .v30-box{max-width:980px;width:min(980px,94vw)}
      .v30-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}
      .v30-month{display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid #dde6ef;border-radius:12px;background:#fff}
      .v30-month.future{opacity:.55;background:#f5f7fa}
      .v30-month>span{font-size:12px;font-weight:700;color:#3f5368}
      .v30-month input{width:100%;box-sizing:border-box}
      .v30-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
      .v30-summary>div{border:1px solid #dde6ef;border-radius:12px;padding:12px;background:#f8fafc}
      .v30-summary span{display:block;font-size:11px;color:#607386;margin-bottom:4px}
      .v30-summary strong{font-size:15px;color:#0d2b4e}
      .v30-impact{margin-top:14px;padding:12px 14px;border-radius:12px;background:#f5f8fb;border:1px solid #dce5ee;color:#31465a}
      .v30-impact.warning{background:#fff7e6;border-color:#e6b85c;color:#7a4e00}
      .v30-impact.ok{background:#eef8f2;border-color:#9bc9ad;color:#1f6540}
      .v30-impact ul{margin:8px 0 0 18px;padding:0}
      .v30-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
      .v30-form-grid label{display:flex;flex-direction:column;gap:6px;font-weight:600;color:#30485f}
      .v30-form-grid input,.v30-form-grid select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccd8e3;border-radius:9px;background:#fff}
      .v30-search{margin-top:8px}
      .v30-help{font-size:12px;color:#627589;margin-top:5px}
      .v30-status{margin-top:12px;font-size:13px;color:#3c536a}
      .v30-status.error{color:#a52020}.v30-status.success{color:#1f6a43}
      .v30-alert-note{margin-top:12px;padding:11px 13px;border-radius:10px;background:#fff7e6;border:1px solid #e4bd70;color:#704900;font-size:13px}
      @media(max-width:720px){.v30-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v30-summary,.v30-form-grid{grid-template-columns:1fr}.v30-box{width:94vw;max-height:88vh;overflow:auto}}
    `;
    document.head.appendChild(style);
  }

  function injectToolbarButtons() {
    const toolbar = byId('adminToolbar');
    if (!toolbar || byId('nonPlannedEditBtn')) return;
    const importButton = byId('importBtn');
    const editButton = document.createElement('button');
    editButton.id = 'nonPlannedEditBtn';
    editButton.type = 'button';
    editButton.className = 'admin-only v30-toolbar-btn';
    editButton.textContent = '✎ Não planejado';
    editButton.addEventListener('click', openNonPlannedEditor);
    toolbar.insertBefore(editButton, importButton || byId('settingsBtn'));

    const reclassButton = document.createElement('button');
    reclassButton.id = 'reclassifyRealizedBtn';
    reclassButton.type = 'button';
    reclassButton.className = 'admin-only v30-toolbar-btn';
    reclassButton.textContent = '↔ Reclassificar consumo';
    reclassButton.addEventListener('click', openReclassification);
    toolbar.insertBefore(reclassButton, importButton || byId('settingsBtn'));

    const mobileActions = document.querySelector('#mobileActionSheet .mobile-sheet-actions');
    if (mobileActions && !byId('mobileNonPlannedEditBtn')) {
      const m1 = document.createElement('button');
      m1.id = 'mobileNonPlannedEditBtn'; m1.type = 'button'; m1.className = 'admin-only';
      m1.innerHTML = '✎ <span>Editar Não Planejado</span>';
      m1.addEventListener('click', () => { try { closeMobileMenu(); } catch (_) {} openNonPlannedEditor(); });
      const m2 = document.createElement('button');
      m2.id = 'mobileReclassifyRealizedBtn'; m2.type = 'button'; m2.className = 'admin-only';
      m2.innerHTML = '↔ <span>Reclassificar consumo</span>';
      m2.addEventListener('click', () => { try { closeMobileMenu(); } catch (_) {} openReclassification(); });
      mobileActions.insertBefore(m2, mobileActions.firstChild);
      mobileActions.insertBefore(m1, mobileActions.firstChild);
    }
  }

  function injectModals() {
    if (byId('nonPlannedEditModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="nonPlannedEditModal" class="admin-modal admin-only"><form id="nonPlannedEditForm" class="admin-box v30-box">
        <div class="user-manager-head"><div><h2>Editar Obras Não Planejadas</h2><p>Corrija o realizado mês a mês. Ao salvar, todo o HAPCAPEX será recalculado.</p></div><button id="v30CloseNonPlanned" type="button" class="modal-x" aria-label="Fechar">×</button></div>
        <div id="nonPlannedEditGrid" class="v30-grid"></div>
        <div class="v30-summary"><div><span>Total atual</span><strong id="nonPlannedBeforeTotal">R$ 0,00</strong></div><div><span>Total após edição</span><strong id="nonPlannedAfterTotal">R$ 0,00</strong></div><div><span>Variação</span><strong id="nonPlannedDelta">R$ 0,00</strong></div></div>
        <div id="nonPlannedImpact" class="v30-impact">Nenhuma alteração detectada.</div>
        <div class="v30-alert-note">As alterações ficam protegidas como edição manual. Se um Excel futuro trouxer valor diferente para o mesmo mês, a prévia da importação exibirá o conflito antes de gravar.</div>
        <div id="nonPlannedStatus" class="v30-status"></div>
        <div class="admin-actions"><button id="v30CancelNonPlanned" type="button">Cancelar</button><button class="save" type="submit">Salvar e recalcular HAPCAPEX</button></div>
      </form></div>

      <div id="reclassifyRealizedModal" class="admin-modal admin-only"><form id="reclassifyRealizedForm" class="admin-box v30-box">
        <div class="user-manager-head"><div><h2>Reclassificar consumo realizado</h2><p>Transfira ou ajuste consumo de Obras Não Planejadas para uma obra específica no mesmo mês.</p></div><button id="v30CloseReclass" type="button" class="modal-x" aria-label="Fechar">×</button></div>
        <div class="v30-form-grid">
          <label>Origem<input value="OBRAS NÃO PLANEJADAS" disabled></label>
          <label>Mês<select id="v30ReclassMonth"></select></label>
          <label style="grid-column:1/-1">Buscar obra de destino<input id="v30DestinationSearch" class="v30-search" type="search" placeholder="Digite OI ou parte do nome"></label>
          <label style="grid-column:1/-1">Obra de destino<select id="v30Destination"></select></label>
          <label>Reduzir em Não Planejado<div class="money-input"><span>R$</span><input id="v30SourceReduction" type="number" min="0" step="0.01" value="0.00"></div><small class="v30-help" id="v30SourceAvailable"></small></label>
          <label>Adicionar na obra<div class="money-input"><span>R$</span><input id="v30DestinationAddition" type="number" min="0" step="0.01" value="0.00"></div><small class="v30-help" id="v30DestinationCurrent"></small></label>
        </div>
        <div id="v30ReclassPreview" class="v30-impact">Informe os valores para visualizar o impacto.</div>
        <div class="v30-alert-note"><strong>Regra de segurança:</strong> retirar mais do que existe em Não Planejado é bloqueado. Já a diferença entre o valor reduzido e o valor adicionado <strong>não bloqueia</strong>: o sistema mostrará o impacto no realizado consolidado e pedirá sua confirmação.</div>
        <div id="v30ReclassStatus" class="v30-status"></div>
        <div class="admin-actions"><button id="v30CancelReclass" type="button">Cancelar</button><button class="save" type="submit">Confirmar e recalcular HAPCAPEX</button></div>
      </form></div>
    `);

    byId('v30CloseNonPlanned').addEventListener('click', () => closeV30Modal('nonPlannedEditModal'));
    byId('v30CancelNonPlanned').addEventListener('click', () => closeV30Modal('nonPlannedEditModal'));
    byId('v30CloseReclass').addEventListener('click', () => closeV30Modal('reclassifyRealizedModal'));
    byId('v30CancelReclass').addEventListener('click', () => closeV30Modal('reclassifyRealizedModal'));
    byId('nonPlannedEditForm').addEventListener('submit', saveNonPlanned);
    byId('reclassifyRealizedForm').addEventListener('submit', saveReclassification);
    byId('v30ReclassMonth').addEventListener('change', updateReclassificationPreview);
    byId('v30Destination').addEventListener('change', updateReclassificationPreview);
    byId('v30SourceReduction').addEventListener('input', updateReclassificationPreview);
    byId('v30DestinationAddition').addEventListener('input', updateReclassificationPreview);
    byId('v30DestinationSearch').addEventListener('input', event => {
      destinationFilter = event.target.value.trim().toUpperCase();
      renderDestinationOptions();
      updateReclassificationPreview();
    });
  }

  function openNonPlannedEditor() {
    if (!isAdmin()) return;
    const item = nonPlannedItem();
    if (!item) { alert('O registro OBRAS NÃO PLANEJADAS não foi encontrado.'); return; }
    const grid = byId('nonPlannedEditGrid');
    const editable = new Set(editableMonths());
    grid.innerHTML = V30_MONTHS.map(key => {
      const future = !editable.has(key);
      const value = v30Num(item.realizado?.[key]);
      return `<label class="v30-month ${future?'future':''}"><span>${V30_LABELS[key]}</span><div class="money-input"><span>R$</span><input data-v30-np-month="${key}" type="number" min="0" step="0.01" value="${value.toFixed(2)}" ${future?'disabled':''}></div>${future?'<small>Futuro</small>':''}</label>`;
    }).join('');
    grid.querySelectorAll('[data-v30-np-month]:not([disabled])').forEach(input => input.addEventListener('input', updateNonPlannedImpact));
    byId('nonPlannedStatus').textContent = '';
    byId('nonPlannedStatus').className = 'v30-status';
    updateNonPlannedImpact();
    openV30Modal('nonPlannedEditModal');
  }

  function nonPlannedDraft() {
    const item = nonPlannedItem();
    const result = { ...(item?.realizado || {}) };
    document.querySelectorAll('[data-v30-np-month]').forEach(input => { result[input.dataset.v30NpMonth] = v30Num(input.value); });
    return result;
  }
  function updateNonPlannedImpact() {
    const item = nonPlannedItem(); if (!item) return;
    const draft = nonPlannedDraft();
    const before = V30_MONTHS.reduce((sum,key) => sum + v30Num(item.realizado?.[key]), 0);
    const after = V30_MONTHS.reduce((sum,key) => sum + v30Num(draft?.[key]), 0);
    const changes = editableMonths().filter(key => Math.abs(v30Num(item.realizado?.[key]) - v30Num(draft?.[key])) > 0.005);
    byId('nonPlannedBeforeTotal').textContent = v30Brl(before);
    byId('nonPlannedAfterTotal').textContent = v30Brl(after);
    byId('nonPlannedDelta').textContent = `${after-before>=0?'+':''}${v30Brl(after-before)}`;
    const impact = byId('nonPlannedImpact');
    impact.className = `v30-impact ${changes.length ? 'warning' : ''}`;
    impact.innerHTML = changes.length
      ? `<strong>${changes.length} mês(es) serão alterados:</strong><ul>${changes.map(key => `<li>${V30_LABELS[key]}: ${v30Brl(item.realizado?.[key])} → ${v30Brl(draft[key])}</li>`).join('')}</ul>`
      : 'Nenhuma alteração detectada.';
  }

  async function saveNonPlanned(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const item = nonPlannedItem(); if (!item) return;
    const draft = nonPlannedDraft();
    const changed = editableMonths().filter(key => Math.abs(v30Num(item.realizado?.[key]) - v30Num(draft?.[key])) > 0.005);
    if (!changed.length) { closeV30Modal('nonPlannedEditModal'); return; }
    if (changed.some(key => v30Num(draft[key]) < 0)) { alert('O realizado mensal não pode ser negativo.'); return; }
    const status = byId('nonPlannedStatus');
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true; status.className = 'v30-status'; status.textContent = 'Criando backup de segurança...';
    try {
      await backup('Antes da edição de OBRAS NÃO PLANEJADAS — V30');
      const now = new Date().toISOString();
      const overrides = { ...(item.manual_overrides || {}) };
      changed.forEach(key => {
        const field = `realizado.${key}`;
        overrides[field] = { previous:v30Num(item.realizado?.[key]), value:v30Num(draft[key]), changed_at:now, changed_by:currentProfile.id, reason:'Edição manual de OBRAS NÃO PLANEJADAS' };
      });
      const { error } = await sb.from('capex_items').update({
        realizado:draft,
        manual_overrides:overrides,
        manual_updated_at:now,
        manual_updated_by:currentProfile.id,
        updated_by:currentProfile.id,
        updated_at:now,
        flow_rule:item.flow_rule || 'non_planned'
      }).eq('id', item.id);
      if (error) throw error;
      status.className = 'v30-status success';
      status.textContent = 'Valores salvos. Recalculando gráficos, KPIs, tabelas, riscos e notificações...';
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      status.className = 'v30-status error'; status.textContent = error.message || String(error); submit.disabled = false;
    }
  }

  function renderDestinationOptions() {
    const select = byId('v30Destination'); if (!select) return;
    const previous = select.value;
    const works = destinationWorks().filter(item => !destinationFilter || `${item.ordem} ${item.nome}`.toUpperCase().includes(destinationFilter));
    select.innerHTML = works.length
      ? works.map(item => `<option value="${v30Esc(item.id)}">${v30Esc(item.ordem)} — ${v30Esc(item.nome)}</option>`).join('')
      : '<option value="">Nenhuma obra encontrada</option>';
    if (works.some(item => item.id === previous)) select.value = previous;
  }

  function openReclassification() {
    if (!isAdmin()) return;
    const source = nonPlannedItem();
    if (!source) { alert('O registro OBRAS NÃO PLANEJADAS não foi encontrado.'); return; }
    const monthSelect = byId('v30ReclassMonth');
    monthSelect.innerHTML = editableMonths().map(key => `<option value="${key}">${V30_LABELS[key]}</option>`).join('');
    monthSelect.value = window.HAP_DATA?.reportingMonthKey && editableMonths().includes(window.HAP_DATA.reportingMonthKey) ? window.HAP_DATA.reportingMonthKey : editableMonths().at(-1);
    destinationFilter = ''; byId('v30DestinationSearch').value = '';
    renderDestinationOptions();
    byId('v30SourceReduction').value = '0.00';
    byId('v30DestinationAddition').value = '0.00';
    byId('v30ReclassStatus').textContent = ''; byId('v30ReclassStatus').className = 'v30-status';
    updateReclassificationPreview();
    openV30Modal('reclassifyRealizedModal');
  }

  function monthlyPortfolioRealized(month) {
    return activeItems().filter(item => item.categoria === 'obra' && !/PACOTE DE MANUTEN[ÇC][AÃ]O DIA A DIA/i.test(String(item.nome || '')))
      .reduce((sum,item) => sum + v30Num(item.realizado?.[month]), 0);
  }
  function updateReclassificationPreview() {
    const source = nonPlannedItem();
    const dest = activeItems().find(item => item.id === byId('v30Destination')?.value);
    const month = byId('v30ReclassMonth')?.value || editableMonths().at(-1);
    const reduction = Math.max(0, v30Num(byId('v30SourceReduction')?.value));
    const addition = Math.max(0, v30Num(byId('v30DestinationAddition')?.value));
    const sourceBefore = v30Num(source?.realizado?.[month]);
    const destBefore = v30Num(dest?.realizado?.[month]);
    const sourceAfter = sourceBefore - reduction;
    const destAfter = destBefore + addition;
    const portfolioBefore = monthlyPortfolioRealized(month);
    const delta = addition - reduction;
    const portfolioAfter = portfolioBefore + delta;
    byId('v30SourceAvailable').textContent = `Disponível em ${V30_LABELS[month]}: ${v30Brl(sourceBefore)}`;
    byId('v30DestinationCurrent').textContent = dest ? `Atual em ${V30_LABELS[month]}: ${v30Brl(destBefore)}` : 'Selecione uma obra.';
    const preview = byId('v30ReclassPreview');
    if (!dest) { preview.className = 'v30-impact'; preview.textContent = 'Selecione a obra de destino.'; return; }
    const overdraw = reduction > sourceBefore + 0.005;
    const imbalance = Math.abs(delta) > 0.005;
    preview.className = `v30-impact ${overdraw || imbalance ? 'warning' : (reduction || addition ? 'ok' : '')}`;
    preview.innerHTML = `
      <strong>${V30_LABELS[month]} — prévia da operação</strong>
      <ul>
        <li>Não Planejado: ${v30Brl(sourceBefore)} → <strong>${v30Brl(sourceAfter)}</strong></li>
        <li>${v30Esc(dest.ordem)} — ${v30Esc(dest.nome)}: ${v30Brl(destBefore)} → <strong>${v30Brl(destAfter)}</strong></li>
        <li>Realizado consolidado do mês: ${v30Brl(portfolioBefore)} → <strong>${v30Brl(portfolioAfter)}</strong></li>
        <li>Impacto consolidado: <strong>${delta>=0?'+':''}${v30Brl(delta)}</strong></li>
      </ul>
      ${overdraw ? '<div><strong>⛔ Bloqueado:</strong> a redução é maior que o saldo disponível em Não Planejado.</div>' : imbalance ? '<div><strong>⚠ Alerta:</strong> os valores de redução e adição são diferentes. Isso alterará o realizado consolidado, mas você poderá confirmar e prosseguir.</div>' : (reduction || addition) ? '<div><strong>✓ Reclassificação neutra:</strong> o realizado consolidado não será alterado.</div>' : ''}`;
  }

  async function saveReclassification(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const source = nonPlannedItem();
    const dest = activeItems().find(item => item.id === byId('v30Destination')?.value);
    const month = byId('v30ReclassMonth')?.value;
    const reduction = Math.max(0, v30Num(byId('v30SourceReduction')?.value));
    const addition = Math.max(0, v30Num(byId('v30DestinationAddition')?.value));
    if (!source || !dest || !month) { alert('Preencha origem, destino e mês.'); return; }
    const sourceBefore = v30Num(source.realizado?.[month]);
    if (reduction > sourceBefore + 0.005) { alert(`A redução de ${v30Brl(reduction)} é maior que o valor disponível em Não Planejado (${v30Brl(sourceBefore)}).`); return; }
    if (reduction <= 0 && addition <= 0) { alert('Informe ao menos um valor para a operação.'); return; }
    const delta = addition - reduction;
    if (Math.abs(delta) > 0.005) {
      const proceed = confirm(`⚠ ALERTA DE IMPACTO CONSOLIDADO\n\nA redução em Não Planejado será ${v30Brl(reduction)} e a adição na obra será ${v30Brl(addition)}.\n\nO realizado consolidado de ${V30_LABELS[month]} será alterado em ${delta>=0?'+':''}${v30Brl(delta)}.\n\nEssa diferença NÃO bloqueia a operação. Deseja prosseguir mesmo assim?`);
      if (!proceed) return;
    } else {
      const proceed = confirm(`Confirmar a reclassificação de ${v30Brl(reduction)} em ${V30_LABELS[month]} para ${dest.ordem} — ${dest.nome}?`);
      if (!proceed) return;
    }
    const status = byId('v30ReclassStatus');
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true; status.className = 'v30-status'; status.textContent = 'Criando backup de segurança...';
    try {
      await backup(`Antes da reclassificação de realizado — ${V30_LABELS[month]} — V30`);
      status.textContent = 'Aplicando reclassificação e registrando auditoria...';
      const { data, error } = await sb.rpc('reclassify_capex_realized', {
        p_source_item_id:source.id,
        p_destination_item_id:dest.id,
        p_month:month,
        p_source_reduction:reduction,
        p_destination_addition:addition
      });
      if (error) throw error;
      if (data?.balance_warning) {
        const nowKey = Date.now();
        await sb.from('capex_notifications').insert({
          notification_key:`reclass-balance:${nowKey}`,
          notification_type:'realized_reclassification_balance',
          priority:'warning',
          title:'Reclassificação alterou o realizado consolidado',
          message:`${V30_LABELS[month]}: redução em Não Planejado ${v30Brl(reduction)}; adição em ${dest.ordem} ${v30Brl(addition)}; impacto consolidado ${delta>=0?'+':''}${v30Brl(delta)}.`,
          item_id:dest.id,
          metadata:{month,source_reduction:reduction,destination_addition:addition,consolidated_delta:delta},
          audience_role:'admin',active:true,updated_at:new Date().toISOString()
        });
      }
      status.className = 'v30-status success';
      status.textContent = 'Operação concluída. Recalculando todo o HAPCAPEX...';
      setTimeout(() => location.reload(), 750);
    } catch (error) {
      status.className = 'v30-status error'; status.textContent = error.message || String(error); submit.disabled = false;
    }
  }

  function initialize() {
    if (initialized || !profileReady()) return false;
    initialized = true;
    if (!isAdmin()) return true;
    injectStyles(); injectModals(); injectToolbarButtons();
    return true;
  }

  if (!initialize()) {
    const timer = setInterval(() => { if (initialize()) clearInterval(timer); }, 150);
    setTimeout(() => clearInterval(timer), 30000);
  }
})();
