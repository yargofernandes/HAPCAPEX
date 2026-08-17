/* HAPCAPEX V32 — Central de notificações organizada por categoria e tipo */
(() => {
  'use strict';

  const V32_CATEGORY_ORDER = ['all','schedule','financial','import','system','other'];
  const V32_CATEGORY_META = {
    all:       { label:'Todas',       icon:'◉' },
    schedule:  { label:'Cronograma',  icon:'📅' },
    financial: { label:'Financeiro',  icon:'💰' },
    import:    { label:'Importação',  icon:'📥' },
    system:    { label:'Sistema',     icon:'⚙️' },
    other:     { label:'Outros',      icon:'•' }
  };
  const V32_TYPE_META = {
    start_30:                 { category:'schedule', label:'Obras próximas de iniciar — 30 dias' },
    start_15:                 { category:'schedule', label:'Obras próximas de iniciar — 15 dias' },
    start_overdue_zero:       { category:'schedule', label:'Início vencido sem realizado' },
    end_30:                   { category:'schedule', label:'Obras próximas de finalizar — 30 dias' },
    end_15:                   { category:'schedule', label:'Obras próximas de finalizar — 15 dias' },
    end_financial_risk:       { category:'financial', label:'Risco financeiro próximo do encerramento' },
    financial_critical:       { category:'financial', label:'Obras em condição financeira crítica' },
    reclassification_imbalance:{ category:'financial', label:'Reclassificações com impacto no realizado' },
    import_new_work:          { category:'import', label:'Novas obras importadas' },
    import_removed_work:      { category:'import', label:'Obras arquivadas pela importação' },
    import_capex_change:      { category:'import', label:'Alterações relevantes de CAPEX' },
    import_error:             { category:'import', label:'Falhas de importação' },
    flow_integrity:           { category:'system', label:'Conciliação financeira do sistema' },
    backup_error:             { category:'system', label:'Falhas de backup' },
    backup_warning:           { category:'system', label:'Alertas de backup' }
  };

  let activeCategory = 'all';
  let patched = false;
  let originalRender = null;

  const byId = id => document.getElementById(id);
  const esc32 = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function categoryOf(note) {
    const type = String(note?.notification_type || '');
    if (V32_TYPE_META[type]) return V32_TYPE_META[type].category;
    if (/^(start_|end_)/.test(type) && !/financial/.test(type)) return 'schedule';
    if (/financial|capex|reclass|realized|realizado|deviation|risk/.test(type)) return 'financial';
    if (/import/.test(type)) return 'import';
    if (/backup|integrity|system|error/.test(type)) return 'system';
    return 'other';
  }
  function typeLabel(note) {
    const type = String(note?.notification_type || '');
    return V32_TYPE_META[type]?.label || note?.title || 'Outras notificações';
  }
  function severityRank(priority) {
    return priority === 'critical' ? 0 : priority === 'warning' ? 1 : priority === 'info' ? 2 : priority === 'resolved' ? 3 : 4;
  }
  function noteTime(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  }
  function priorityIcon(priority) {
    return priority === 'critical' ? '🔴' : priority === 'warning' ? '🟠' : priority === 'resolved' ? '🟢' : '🔵';
  }
  function statusFilteredNotes() {
    try {
      return notificationsCache.filter(note => activeNotificationFilter === 'all' || !note.read_at);
    } catch (_) { return []; }
  }
  function categoryFilteredNotes() {
    const notes = statusFilteredNotes();
    return activeCategory === 'all' ? notes : notes.filter(note => categoryOf(note) === activeCategory);
  }

  function injectStyles() {
    if (byId('v32NotificationStyles')) return;
    const style = document.createElement('style');
    style.id = 'v32NotificationStyles';
    style.textContent = `
      .v32-notification-filter{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0 4px;border-top:1px solid #edf1f5;margin-top:8px}
      .v32-filter-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#687b8e;margin-right:2px}
      .v32-category-chip{border:1px solid #d6e0e9;background:#fff;color:#30475d;border-radius:999px;padding:7px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
      .v32-category-chip.active{border-color:#1a5ca8;background:#edf4fc;color:#123f73}
      .v32-category-chip .count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#eef1f5;color:#536579;font-size:10px}
      .v32-category-chip.active .count{background:#dbe9f8;color:#123f73}
      .v32-notification-result{font-size:12px;color:#687b8e;padding:5px 0 8px}
      .v32-notification-category{margin:8px 0 16px}
      .v32-category-title{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 2px 7px;color:#31475d;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.035em}
      .v32-category-title span:last-child{font-size:11px;font-weight:700;color:#7a8c9e;text-transform:none;letter-spacing:0}
      .v32-type-group{border:1px solid #dfe7ef;border-radius:12px;background:#fff;margin:0 0 8px;overflow:hidden}
      .v32-type-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f7f9fb;color:#263e55;font-size:13px;font-weight:750}
      .v32-type-group>summary::-webkit-details-marker{display:none}
      .v32-type-group>summary::before{content:'▾';font-size:11px;color:#6c7e90;transition:transform .15s ease}
      .v32-type-group:not([open])>summary::before{transform:rotate(-90deg)}
      .v32-group-count{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:22px;padding:0 6px;border-radius:999px;background:#e8eef5;color:#40566d;font-size:11px;font-weight:800}
      .v32-group-unread{font-size:10px;color:#a24c00;font-weight:800}
      .v32-group-list{padding:4px 6px 7px}
      .v32-group-list .notification-item{margin:3px 0;width:100%}
      .v32-notification-empty{padding:26px 14px;text-align:center;color:#6f8091}
      @media(max-width:720px){
        .v32-notification-filter{gap:6px}.v32-category-chip{font-size:11px;padding:6px 8px}.v32-type-group>summary{padding:9px 10px;font-size:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFilterBar() {
    const toolbar = document.querySelector('#notificationModal .notification-toolbar');
    if (!toolbar || byId('v32NotificationFilter')) return;
    const filter = document.createElement('div');
    filter.id = 'v32NotificationFilter';
    filter.className = 'v32-notification-filter';
    filter.innerHTML = '<span class="v32-filter-label">Assunto</span><div id="v32NotificationCategories" style="display:contents"></div>';
    toolbar.insertAdjacentElement('afterend', filter);
    const result = document.createElement('div');
    result.id = 'v32NotificationResult';
    result.className = 'v32-notification-result';
    filter.insertAdjacentElement('afterend', result);
  }

  function renderCategoryChips() {
    const host = byId('v32NotificationCategories');
    if (!host) return;
    const notes = statusFilteredNotes();
    const counts = Object.fromEntries(V32_CATEGORY_ORDER.map(key => [key, 0]));
    counts.all = notes.length;
    notes.forEach(note => { const key = categoryOf(note); counts[key] = (counts[key] || 0) + 1; });
    const visibleKeys = V32_CATEGORY_ORDER.filter(key => key === 'all' || (counts[key] || 0) > 0);
    if (!visibleKeys.includes(activeCategory)) activeCategory = 'all';
    host.innerHTML = visibleKeys.map(key => {
      const meta = V32_CATEGORY_META[key];
      return `<button type="button" class="v32-category-chip ${activeCategory === key ? 'active' : ''}" data-v32-category="${key}"><span>${meta.icon}</span><span>${meta.label}</span><span class="count">${counts[key] || 0}</span></button>`;
    }).join('');
    host.querySelectorAll('[data-v32-category]').forEach(button => button.addEventListener('click', () => {
      activeCategory = button.dataset.v32Category || 'all';
      renderNotificationList();
    }));
  }

  function sortedCategories(notes) {
    const present = new Set(notes.map(categoryOf));
    return V32_CATEGORY_ORDER.filter(key => key !== 'all' && present.has(key));
  }
  function groupByType(notes) {
    const map = new Map();
    notes.forEach(note => {
      const key = String(note.notification_type || 'other');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(note);
    });
    return [...map.entries()].sort((a,b) => {
      const ar = Math.min(...a[1].map(n => severityRank(n.priority)));
      const br = Math.min(...b[1].map(n => severityRank(n.priority)));
      if (ar !== br) return ar - br;
      return typeLabel(a[1][0]).localeCompare(typeLabel(b[1][0]), 'pt-BR');
    });
  }
  function notificationCard(note) {
    return `<button class="notification-item ${note.read_at ? 'read' : 'unread'}" type="button" data-notification-id="${esc32(note.id)}" data-item-id="${esc32(note.item_id || '')}">
      <span class="notification-priority">${priorityIcon(note.priority)}</span>
      <span class="notification-content"><strong>${esc32(note.title)}</strong><span>${esc32(note.message)}</span><small>${esc32(noteTime(note.created_at))}</small></span>
      ${note.read_at ? '' : '<i class="notification-dot"></i>'}
    </button>`;
  }

  function renderOrganizedNotifications() {
    const box = byId('notificationList');
    if (!box) return;
    ensureFilterBar();
    renderCategoryChips();
    const notes = categoryFilteredNotes();
    const result = byId('v32NotificationResult');
    if (result) {
      const unread = notes.filter(note => !note.read_at).length;
      result.textContent = `${notes.length} notificação${notes.length === 1 ? '' : 'ões'} exibida${notes.length === 1 ? '' : 's'}${unread ? ` · ${unread} não lida${unread === 1 ? '' : 's'}` : ''}`;
    }
    if (!notes.length) {
      box.innerHTML = `<div class="v32-notification-empty">Nenhuma notificação neste filtro.</div>`;
      return;
    }

    const categories = activeCategory === 'all' ? sortedCategories(notes) : [activeCategory];
    box.innerHTML = categories.map(category => {
      const categoryNotes = notes.filter(note => categoryOf(note) === category);
      const groups = groupByType(categoryNotes);
      const categoryUnread = categoryNotes.filter(note => !note.read_at).length;
      const meta = V32_CATEGORY_META[category] || V32_CATEGORY_META.other;
      return `<section class="v32-notification-category" data-v32-section="${category}">
        <div class="v32-category-title"><span>${meta.icon} ${meta.label}</span><span>${categoryNotes.length}${categoryUnread ? ` · ${categoryUnread} não lidas` : ''}</span></div>
        ${groups.map(([type, group]) => {
          const sorted = [...group].sort((a,b) => severityRank(a.priority)-severityRank(b.priority) || new Date(b.created_at)-new Date(a.created_at));
          const unread = sorted.filter(note => !note.read_at).length;
          return `<details class="v32-type-group" open data-v32-type="${esc32(type)}">
            <summary><span>${priorityIcon(sorted[0]?.priority)}</span><span>${esc32(typeLabel(sorted[0]))}</span>${unread ? `<span class="v32-group-unread">${unread} não lida${unread===1?'':'s'}</span>` : ''}<span class="v32-group-count">${sorted.length}</span></summary>
            <div class="v32-group-list">${sorted.map(notificationCard).join('')}</div>
          </details>`;
        }).join('')}
      </section>`;
    }).join('');

    box.querySelectorAll('[data-notification-id]').forEach(button => button.addEventListener('click', async () => {
      try {
        await markNotificationRead(button.dataset.notificationId);
        const itemId = button.dataset.itemId;
        closeModal('notificationModal');
        if (itemId && Array.isArray(window.HAP_RUNTIME_OBRAS)) {
          const index = window.HAP_RUNTIME_OBRAS.findIndex(work => work._id === itemId);
          if (index >= 0 && typeof window.openPanel === 'function') window.openPanel(index);
        }
      } catch (error) {
        console.warn('Falha ao abrir notificação:', error);
      }
    }));
  }

  function patch() {
    if (patched) return;
    try {
      if (typeof renderNotificationList !== 'function' || typeof notificationsCache === 'undefined' || typeof activeNotificationFilter === 'undefined') return;
      originalRender = renderNotificationList;
      renderNotificationList = renderOrganizedNotifications;
      patched = true;
      injectStyles();
      ensureFilterBar();
      // Se o modal já tiver conteúdo da versão anterior, reorganiza imediatamente.
      renderNotificationList();
    } catch (_) {}
  }

  const timer = setInterval(() => {
    patch();
    if (patched) clearInterval(timer);
  }, 120);
  setTimeout(() => { patch(); if (patched) clearInterval(timer); }, 1600);
})();
