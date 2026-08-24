/* HAPCAPEX V40.0.45 — Auditoria Geral HAPCAPEX
   Fonte única: public.vw_auditoria_global -> public.audit_log.
   - Curva + Controle + SAP Bridge + Administração na mesma linha do tempo.
   - Disponível na página inicial junto de Backups e Usuários.
   - Remove o ponto de acesso legado "Auditoria" do Controle.
   - Atualização automática por Realtime quando disponível + polling de segurança.
*/
(() => {
  'use strict';
  if (window.__HAP_V40045_GLOBAL_AUDIT__) return;
  window.__HAP_V40045_GLOBAL_AUDIT__ = true;

  const VERSION = '40.0.45';
  const VIEW = 'vw_auditoria_global';
  const INITIAL = 300;
  const STEP = 300;
  const POLL_MS = 15000;

  const cfg = {
    limit: INITIAL,
    total: 0,
    rows: [],
    loading: false,
    opened: false,
    search: '',
    sistema: '',
    modulo: '',
    tipo: '',
    status: '',
    period: '30',
    start: '',
    end: '',
    sort: 'desc',
    lastLoadAt: null,
    lastLoadMs: 0
  };

  let pollTimer = null;
  let realtimeChannel = null;
  let refreshTimer = null;

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function isAdmin() {
    try { return typeof currentProfile !== 'undefined' && currentProfile?.role === 'admin'; }
    catch (_) { return false; }
  }

  function hasSb() {
    try { return typeof sb !== 'undefined' && !!sb?.from; }
    catch (_) { return false; }
  }

  function ptDate(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('pt-BR', {
        timeZone:'America/Fortaleza', day:'2-digit', month:'2-digit', year:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      });
    } catch (_) { return String(value); }
  }

  function dayIso(value) {
    try {
      const d = new Date(value);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone:'America/Fortaleza', year:'numeric', month:'2-digit', day:'2-digit'
      }).formatToParts(d);
      const get = t => parts.find(x => x.type === t)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}`;
    } catch (_) { return ''; }
  }

  function periodRange() {
    if (cfg.period === 'all') return null;
    if (cfg.period === 'custom') {
      return { start: cfg.start || '', end: cfg.end || '' };
    }
    const days = Number(cfg.period || 30);
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - Math.max(0, days - 1));
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { start: fmt(start), end: fmt(end) };
  }

  function sanitizeSearch(v) {
    return String(v || '').replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function injectStyles() {
    if (document.getElementById('hap-v40045-global-audit-style')) return;
    const s = document.createElement('style');
    s.id = 'hap-v40045-global-audit-style';
    s.textContent = `
      .hap-v398-admin-actions{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      #hapGlobalAuditModal{z-index:100250!important}
      #hapGlobalAuditModal .hap-ga-box{width:min(1240px,100%);padding:20px 22px}
      .hap-ga-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
      .hap-ga-head h2{margin:0!important;color:#0d2b4e;font-size:18px}.hap-ga-head p{margin:4px 0 0;color:#5a6882;font-size:11px;line-height:1.45}
      .hap-ga-close{border:1px solid #d7e0ec;background:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer;font-size:19px;color:#5a6882}
      .hap-ga-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}
      .hap-ga-summary>div{background:#f4f6fa;border-radius:10px;padding:10px 11px;border-left:4px solid #2e6bbf;min-width:0}
      .hap-ga-summary>div:nth-child(2){border-left-color:#1e8a4a}.hap-ga-summary>div:nth-child(3){border-left-color:#e07020}.hap-ga-summary>div:nth-child(4){border-left-color:#7950b5}
      .hap-ga-summary span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.04em;font-weight:800;color:#5a6882}
      .hap-ga-summary strong{display:block;margin-top:4px;font-size:14px;color:#0d2b4e;white-space:nowrap}
      .hap-ga-filters{display:grid;grid-template-columns:minmax(220px,2fr) repeat(4,minmax(130px,1fr));gap:7px;margin-bottom:8px}
      .hap-ga-filters input,.hap-ga-filters select,.hap-ga-period input,.hap-ga-period select{width:100%;min-width:0;padding:8px 9px;border:1px solid #ccd5e2;border-radius:8px;background:#fff;color:#1a2233;font:inherit;font-size:10px}
      .hap-ga-period{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:11px}
      .hap-ga-period>*{flex:0 0 auto}.hap-ga-period select{width:auto}.hap-ga-period input{width:140px}
      .hap-ga-btn{border:1px solid #cbd7e6;background:#fff;color:#174f8c;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:800;cursor:pointer}
      .hap-ga-btn:hover{background:#eef4fc}.hap-ga-btn:disabled{opacity:.5;cursor:default}
      .hap-ga-sync{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;margin-bottom:10px;border:1px solid #c7d8ee;border-radius:9px;background:#eef4fc;color:#244b74;font-size:9.5px;line-height:1.35}
      .hap-ga-live{display:inline-flex;align-items:center;gap:5px;font-weight:800;color:#126b37}.hap-ga-dot{width:7px;height:7px;border-radius:50%;background:#1e8a4a;box-shadow:0 0 0 3px rgba(30,138,74,.12)}
      .hap-ga-list{max-height:58vh;overflow:auto;padding-right:3px}
      .hap-ga-day{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:#5a6882;padding:9px 2px 5px;position:sticky;top:0;background:#fff;z-index:2}
      .hap-ga-row{border:1px solid #dde3ee;border-radius:10px;background:#fff;padding:10px 11px;margin-bottom:7px}
      .hap-ga-row-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
      .hap-ga-title{font-size:11px;font-weight:800;color:#0d2b4e;line-height:1.4}.hap-ga-meta{font-size:9.5px;color:#5a6882;line-height:1.45;margin-top:3px}.hap-ga-time{font-size:9px;color:#5a6882;white-space:nowrap}
      .hap-ga-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px}.hap-ga-badge{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:8.5px;font-weight:850;background:#eef1f5;color:#46556a}
      .hap-ga-badge.curva{background:#e8f0fb;color:#174f8c}.hap-ga-badge.controle{background:#e1f5ee;color:#126b37}.hap-ga-badge.sap{background:#fff0dd;color:#8b5300}.hap-ga-badge.admin{background:#f0eafa;color:#6b3ca0}
      .hap-ga-badge.erro{background:#fcebeb;color:#a52727}.hap-ga-badge.cancelado{background:#fff0c0;color:#8a6000}.hap-ga-badge.sucesso{background:#e1f5ee;color:#126b37}
      .hap-ga-json{margin-top:7px;border-top:1px dashed #dde3ee;padding-top:7px}.hap-ga-json summary{cursor:pointer;color:#1a4b8c;font-size:9px;font-weight:800}.hap-ga-json-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}.hap-ga-json pre{margin:0;background:#f4f6fa;padding:8px;border-radius:7px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:8.5px}
      .hap-ga-more{display:flex;justify-content:center;gap:7px;padding:10px 0 2px}.hap-ga-empty{text-align:center;padding:36px 15px;color:#6c7890;font-size:11px}
      @media(max-width:950px){.hap-ga-filters{grid-template-columns:1fr 1fr 1fr}.hap-ga-filters input:first-child{grid-column:1/-1}.hap-ga-summary{grid-template-columns:1fr 1fr}}
      @media(max-width:720px){.hap-v398-admin-actions{grid-template-columns:1fr!important}.hap-ga-filters{grid-template-columns:1fr}.hap-ga-filters input:first-child{grid-column:auto}.hap-ga-summary{grid-template-columns:1fr 1fr}.hap-ga-row-head{flex-direction:column}.hap-ga-time{white-space:normal}.hap-ga-json-grid{grid-template-columns:1fr}#hapGlobalAuditModal .hap-ga-box{min-height:100dvh;width:100%;border-radius:0;margin:0;padding:16px 12px}.hap-ga-list{max-height:none}.hap-ga-sync{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(s);
  }

  function legacyControlCleanup() {
    const onControl = /controle-capex\.html\/?$/i.test(location.pathname);
    if (!onControl) return;

    document.querySelectorAll('.nav-pill').forEach(el => {
      if (String(el.textContent || '').trim().toUpperCase() === 'AUDITORIA') el.remove();
    });
    document.querySelectorAll('[data-v380-action="audit"]').forEach(el => el.remove());

    try {
      if (typeof state !== 'undefined' && state?.tab === 'auditoria') {
        state.tab = 'capex';
        if (typeof refreshCurrent === 'function') setTimeout(() => refreshCurrent(), 0);
      }
    } catch (_) {}
  }

  function ensureGlobalButton() {
    if (!isAdmin()) return;
    const actions = document.querySelector('[data-v398-global-admin] .hap-v398-admin-actions');
    if (!actions || actions.querySelector('[data-v40045-audit-open]')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hap-v398-admin-btn';
    btn.setAttribute('data-v40045-audit-open','1');
    btn.innerHTML = '<strong>🧾 Auditoria Geral</strong><small>Controle + Curva em uma única linha do tempo.</small>';
    btn.addEventListener('click', openModal);
    actions.appendChild(btn);
  }

  function ensureModal() {
    let modal = document.getElementById('hapGlobalAuditModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'hapGlobalAuditModal';
    modal.className = 'admin-modal admin-only';
    modal.innerHTML = `
      <div class="admin-box hap-ga-box">
        <div class="hap-ga-head">
          <div><h2>Auditoria Geral HAPCAPEX</h2><p>Histórico único e sincronizado de ações do Controle de Capex, Curva de Capex, SAP Bridge e Administração.</p></div>
          <button type="button" class="hap-ga-close" data-ga-close aria-label="Fechar">×</button>
        </div>
        <div class="hap-ga-summary">
          <div><span>Eventos encontrados</span><strong data-ga-total>—</strong></div>
          <div><span>Eventos carregados</span><strong data-ga-loaded>—</strong></div>
          <div><span>Período</span><strong data-ga-period-label>30 dias</strong></div>
          <div><span>Última sincronização</span><strong data-ga-last>—</strong></div>
        </div>
        <div class="hap-ga-filters">
          <input type="search" data-ga-search placeholder="Buscar O.I., usuário, ação, registro ou entidade">
          <select data-ga-system><option value="">Todos os sistemas</option></select>
          <select data-ga-module><option value="">Todos os módulos</option></select>
          <select data-ga-type><option value="">Todos os tipos</option></select>
          <select data-ga-status><option value="">Todos os status</option></select>
        </div>
        <div class="hap-ga-period">
          <select data-ga-period>
            <option value="7">Últimos 7 dias</option>
            <option value="30" selected>Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
            <option value="all">Todo o histórico</option>
            <option value="custom">Período personalizado</option>
          </select>
          <input type="date" data-ga-start disabled>
          <span>até</span>
          <input type="date" data-ga-end disabled>
          <select data-ga-sort><option value="desc">Mais recentes primeiro</option><option value="asc">Mais antigos primeiro</option></select>
          <button type="button" class="hap-ga-btn" data-ga-clear>Limpar filtros</button>
          <button type="button" class="hap-ga-btn" data-ga-refresh>↻ Atualizar</button>
        </div>
        <div class="hap-ga-sync"><div><span class="hap-ga-live"><i class="hap-ga-dot"></i> Sincronização ativa</span><br>Novos eventos da Curva ou do Controle aparecem aqui sem criar históricos separados.</div><div data-ga-perf>—</div></div>
        <div class="hap-ga-list" data-ga-list><div class="hap-ga-empty">Carregando auditoria...</div></div>
        <div class="hap-ga-more" data-ga-more></div>
        <div class="admin-actions"><button type="button" data-ga-close>Fechar</button></div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-ga-close]').forEach(btn => btn.addEventListener('click', closeModal));
    modal.addEventListener('click', e => { if (e.target === modal) e.stopPropagation(); });

    const bind = (sel, key, event='change') => {
      const el = modal.querySelector(sel);
      if (!el) return;
      el.addEventListener(event, () => {
        cfg[key] = el.value;
        cfg.limit = INITIAL;
        if (key === 'period') {
          modal.querySelector('[data-ga-start]').disabled = el.value !== 'custom';
          modal.querySelector('[data-ga-end]').disabled = el.value !== 'custom';
        }
        scheduleLoad(180);
      });
    };
    bind('[data-ga-search]','search','input');
    bind('[data-ga-system]','sistema');
    bind('[data-ga-module]','modulo');
    bind('[data-ga-type]','tipo');
    bind('[data-ga-status]','status');
    bind('[data-ga-period]','period');
    bind('[data-ga-start]','start');
    bind('[data-ga-end]','end');
    bind('[data-ga-sort]','sort');

    modal.querySelector('[data-ga-clear]').addEventListener('click', () => {
      Object.assign(cfg, {limit:INITIAL,search:'',sistema:'',modulo:'',tipo:'',status:'',period:'30',start:'',end:'',sort:'desc'});
      modal.querySelector('[data-ga-search]').value='';
      modal.querySelector('[data-ga-system]').value='';
      modal.querySelector('[data-ga-module]').value='';
      modal.querySelector('[data-ga-type]').value='';
      modal.querySelector('[data-ga-status]').value='';
      modal.querySelector('[data-ga-period]').value='30';
      modal.querySelector('[data-ga-start]').value='';
      modal.querySelector('[data-ga-end]').value='';
      modal.querySelector('[data-ga-start]').disabled=true;
      modal.querySelector('[data-ga-end]').disabled=true;
      modal.querySelector('[data-ga-sort]').value='desc';
      void load();
    });
    modal.querySelector('[data-ga-refresh]').addEventListener('click', () => void load());

    return modal;
  }

  function badgeClass(systemOrStatus) {
    const v = String(systemOrStatus || '').toLowerCase();
    if (v.includes('curva')) return 'curva';
    if (v.includes('controle')) return 'controle';
    if (v.includes('sap')) return 'sap';
    if (v.includes('admin')) return 'admin';
    if (v.includes('erro')) return 'erro';
    if (v.includes('cancel')) return 'cancelado';
    if (v.includes('sucesso')) return 'sucesso';
    return '';
  }

  function prettyJson(value) {
    if (!value || (typeof value === 'object' && !Object.keys(value).length)) return '—';
    try { return JSON.stringify(value, null, 2); } catch (_) { return String(value); }
  }

  function renderRow(x) {
    const status = String(x.status_evento || 'sucesso');
    const entity = `${x.source_schema ? x.source_schema + '.' : ''}${x.table_name || ''}`;
    const actor = `${x.usuario_nome || 'Usuário não identificado'}${x.usuario_email ? ` <${x.usuario_email}>` : ''}`;
    const oi = x.oi ? ` · O.I. ${x.oi}` : '';
    return `<div class="hap-ga-row">
      <div class="hap-ga-badges">
        <span class="hap-ga-badge ${badgeClass(x.sistema)}">${esc(x.sistema || 'HAPCAPEX')}</span>
        <span class="hap-ga-badge">${esc(x.modulo || 'Sistema')}</span>
        <span class="hap-ga-badge ${badgeClass(status)}">${esc(status)}</span>
      </div>
      <div class="hap-ga-row-head">
        <div><div class="hap-ga-title">${esc(x.acao || x.operation || 'Ação')}</div>
          <div class="hap-ga-meta">${esc(actor)}${esc(oi)}<br>Entidade: ${esc(entity || '—')} · Registro ${esc(x.record_id || '—')} · Tipo: ${esc(x.tipo_auditoria || 'Sistema')}</div>
        </div>
        <div class="hap-ga-time">${esc(ptDate(x.created_at))}</div>
      </div>
      <details class="hap-ga-json"><summary>Ver dados antes / depois</summary><div class="hap-ga-json-grid"><div><strong>Antes</strong><pre>${esc(prettyJson(x.old_data))}</pre></div><div><strong>Depois</strong><pre>${esc(prettyJson(x.new_data))}</pre></div></div></details>
    </div>`;
  }

  function updateSelect(selector, values, selected, allLabel) {
    const el = document.querySelector(`#hapGlobalAuditModal ${selector}`);
    if (!el) return;
    const list = [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    el.innerHTML = `<option value="">${esc(allLabel)}</option>` + list.map(v => `<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
  }

  function render() {
    const modal = ensureModal();
    const rows = cfg.rows || [];

    updateSelect('[data-ga-system]', rows.map(x=>x.sistema), cfg.sistema, 'Todos os sistemas');
    updateSelect('[data-ga-module]', rows.map(x=>x.modulo), cfg.modulo, 'Todos os módulos');
    updateSelect('[data-ga-type]', rows.map(x=>x.tipo_auditoria), cfg.tipo, 'Todos os tipos');
    updateSelect('[data-ga-status]', rows.map(x=>x.status_evento), cfg.status, 'Todos os status');

    modal.querySelector('[data-ga-total]').textContent = Number(cfg.total || 0).toLocaleString('pt-BR');
    modal.querySelector('[data-ga-loaded]').textContent = Number(rows.length || 0).toLocaleString('pt-BR');
    const periodLabels = {'7':'7 dias','30':'30 dias','90':'90 dias','365':'1 ano','all':'Todo histórico','custom':'Personalizado'};
    modal.querySelector('[data-ga-period-label]').textContent = periodLabels[cfg.period] || '—';
    modal.querySelector('[data-ga-last]').textContent = cfg.lastLoadAt ? cfg.lastLoadAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
    modal.querySelector('[data-ga-perf]').textContent = `${rows.length.toLocaleString('pt-BR')} carregados · ${cfg.lastLoadMs.toLocaleString('pt-BR')} ms`;

    const groups = [];
    for (const row of rows) {
      const day = dayIso(row.created_at) || 'Sem data';
      let g = groups.find(x => x.day === day);
      if (!g) { g = {day,rows:[]}; groups.push(g); }
      g.rows.push(row);
    }
    const list = modal.querySelector('[data-ga-list]');
    list.innerHTML = rows.length
      ? groups.map(g => `<div class="hap-ga-day">${esc(g.day)} · ${g.rows.length} evento(s)</div>${g.rows.map(renderRow).join('')}`).join('')
      : '<div class="hap-ga-empty">Nenhum evento encontrado para os filtros informados.</div>';

    const more = Math.max(0, Number(cfg.total || 0) - rows.length);
    const moreEl = modal.querySelector('[data-ga-more]');
    moreEl.innerHTML = more > 0
      ? `<button type="button" class="hap-ga-btn" data-ga-more300>+ 300 eventos</button><button type="button" class="hap-ga-btn" data-ga-more1000>+ 1.000 eventos</button><span style="align-self:center;font-size:9px;color:#5a6882">${more.toLocaleString('pt-BR')} ainda não carregados</span>`
      : rows.length ? '<span style="font-size:9px;color:#5a6882">Todo o histórico filtrado está carregado.</span>' : '';
    moreEl.querySelector('[data-ga-more300]')?.addEventListener('click',()=>{cfg.limit+=300;void load();});
    moreEl.querySelector('[data-ga-more1000]')?.addEventListener('click',()=>{cfg.limit+=1000;void load();});
  }

  async function load() {
    if (!cfg.opened || cfg.loading || !isAdmin() || !hasSb()) return;
    cfg.loading = true;
    const modal = ensureModal();
    const list = modal.querySelector('[data-ga-list]');
    if (!cfg.rows.length) list.innerHTML = '<div class="hap-ga-empty">Carregando auditoria...</div>';
    const started = performance.now();
    try {
      let query = sb.from(VIEW)
        .select('*', {count:'exact'})
        .order('created_at', {ascending: cfg.sort === 'asc'})
        .range(0, Math.max(0, cfg.limit - 1));

      if (cfg.sistema) query = query.eq('sistema', cfg.sistema);
      if (cfg.modulo) query = query.eq('modulo', cfg.modulo);
      if (cfg.tipo) query = query.eq('tipo_auditoria', cfg.tipo);
      if (cfg.status) query = query.eq('status_evento', cfg.status);

      const range = periodRange();
      if (range?.start) query = query.gte('created_at', `${range.start}T00:00:00-03:00`);
      if (range?.end) query = query.lte('created_at', `${range.end}T23:59:59.999-03:00`);

      const q = sanitizeSearch(cfg.search);
      if (q) {
        const like = `*${q}*`;
        query = query.or(`oi.ilike.${like},record_id.ilike.${like},usuario_nome.ilike.${like},usuario_email.ilike.${like},acao.ilike.${like},modulo.ilike.${like},sistema.ilike.${like},table_name.ilike.${like}`);
      }

      const {data,error,count} = await query;
      if (error) throw error;
      cfg.rows = data || [];
      cfg.total = Number(count || 0);
      cfg.lastLoadAt = new Date();
      cfg.lastLoadMs = Math.round(performance.now() - started);
      render();
    } catch (err) {
      list.innerHTML = `<div class="hap-ga-empty" style="color:#a52727">Falha ao carregar Auditoria Geral: ${esc(err?.message || String(err))}</div>`;
    } finally {
      cfg.loading = false;
    }
  }

  function scheduleLoad(delay=250) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void load(), delay);
  }

  function startSync() {
    stopSync();
    pollTimer = setInterval(() => { if (cfg.opened && document.visibilityState !== 'hidden') void load(); }, POLL_MS);
    try {
      if (hasSb() && typeof sb.channel === 'function') {
        realtimeChannel = sb.channel('hapcapex-global-audit-v40045')
          .on('postgres_changes', {event:'INSERT', schema:'public', table:'audit_log'}, () => scheduleLoad(500))
          .subscribe();
      }
    } catch (_) { realtimeChannel = null; }
  }

  function stopSync() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    try { if (realtimeChannel && hasSb()) sb.removeChannel(realtimeChannel); } catch (_) {}
    realtimeChannel = null;
  }

  function openModal() {
    if (!isAdmin()) return;
    const modal = ensureModal();
    cfg.opened = true;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    startSync();
    void load();
  }

  function closeModal() {
    const modal = document.getElementById('hapGlobalAuditModal');
    if (modal) modal.classList.remove('open');
    cfg.opened = false;
    document.body.style.overflow = '';
    stopSync();
  }

  function tick() {
    injectStyles();
    legacyControlCleanup();
    ensureGlobalButton();
  }

  tick();
  const timer = setInterval(tick, 350);
  setTimeout(() => clearInterval(timer), 120000);
  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  setTimeout(() => observer.disconnect(), 120000);

  window.addEventListener('visibilitychange', () => {
    if (!document.hidden && cfg.opened) scheduleLoad(100);
  });

  window.HAP_V40045_GLOBAL_AUDIT = {version:VERSION, open:openModal, close:closeModal, refresh:load, state:cfg};
})();
