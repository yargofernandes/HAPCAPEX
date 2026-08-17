/* HAPCAPEX V39.8 — Administração global (Backups + Usuários) */
(() => {
  'use strict';
  const VERSION='39.8.0';
  let patchedManagers=false;

  function isAdmin(){
    try { return typeof currentProfile!=='undefined' && currentProfile?.role==='admin'; }
    catch(_){ return false; }
  }
  function esc398(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function hideLegacyToolbarButtons(){
    ['backupBtn','usersBtn'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){ el.hidden=true; el.style.display='none'; el.setAttribute('aria-hidden','true'); }
    });
  }
  function injectStyles(){
    if(document.getElementById('hap-v398-global-admin-styles')) return;
    const s=document.createElement('style');
    s.id='hap-v398-global-admin-styles';
    s.textContent=`
      #backupBtn,#usersBtn{display:none!important}
      .hap-v398-admin-panel{margin-top:18px;border:1px solid #d8e1ed;border-radius:16px;background:#fff;padding:16px 18px;box-shadow:0 3px 14px rgba(13,43,78,.06)}
      .hap-v398-admin-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}
      .hap-v398-admin-head strong{color:#0d2b4e;font-size:13px}.hap-v398-admin-head span{font-size:10px;color:#758399}
      .hap-v398-admin-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .hap-v398-admin-btn{border:1px solid #d7e0ec;background:#f7f9fc;border-radius:12px;padding:13px 14px;text-align:left;cursor:pointer;font:inherit;color:#0d2b4e;transition:.15s ease}
      .hap-v398-admin-btn:hover,.hap-v398-admin-btn:focus-visible{border-color:#9db7d5;background:#eef4fc;outline:none;transform:translateY(-1px)}
      .hap-v398-admin-btn strong{display:block;font-size:12px}.hap-v398-admin-btn small{display:block;margin-top:3px;color:#66758b;font-size:10px;line-height:1.35}
      #backupModal.open,#usersModal.open,#passwordModal.open{z-index:100200!important}
      .hap-v398-delete{color:#a52727!important;border-color:#e4b5b5!important;background:#fffafa!important}
      @media(max-width:720px){.hap-v398-admin-actions{grid-template-columns:1fr}.hap-v398-admin-panel{padding:14px}}
    `;
    document.head.appendChild(s);
  }
  function setTextIfNeeded(el,text){ if(el && el.textContent!==text) el.textContent=text; }
  function decorateModalCopy(){
    const backup=document.getElementById('backupModal');
    if(backup){
      const h=backup.querySelector('.user-manager-head h2');
      const p=backup.querySelector('.user-manager-head p');
      const warning=backup.querySelector('.backup-warning');
      setTextIfNeeded(h,'Backups Gerais HAPCAPEX');
      setTextIfNeeded(p,'Protege em conjunto a Curva de Capex e o Controle de Capex. Backups automáticos ficam por 14 dias; manuais e pré-restauração, por 60 dias.');
      setTextIfNeeded(warning,'A restauração é transacional e cria um pré-backup. Curva + Controle retornam ao estado escolhido. Usuários, senhas e Auditoria não são apagados.');
      const th=backup.querySelector('.backup-table thead th:nth-child(3)');
      setTextIfNeeded(th,'Cobertura');
    }
    const users=document.getElementById('usersModal');
    if(users){
      const h=users.querySelector('.user-manager-head h2');
      const p=users.querySelector('.user-manager-head p');
      setTextIfNeeded(h,'Usuários HAPCAPEX');
      setTextIfNeeded(p,'Administração global de acesso à Curva e ao Controle. A exclusão remove o acesso, encerra sessões e preserva a autoria histórica dos registros.');
    }
  }
  function openGlobalManager(kind){
    if(!isAdmin()) return;
    decorateModalCopy();
    const btn=document.getElementById(kind==='backup'?'backupBtn':'usersBtn');
    if(btn) btn.click();
  }
  function ensureGlobalPanel(){
    const selector=document.getElementById('hapcapexSystemSelectorV34');
    if(!selector || !isAdmin()) return;
    const panelRoot=selector.querySelector('.hap-v34-panel');
    if(!panelRoot || selector.querySelector('[data-v398-global-admin]')) return;
    const panel=document.createElement('section');
    panel.className='hap-v398-admin-panel';
    panel.dataset.v398GlobalAdmin='1';
    panel.innerHTML=`<div class="hap-v398-admin-head"><strong>Administração HAPCAPEX</strong><span>Recursos globais · somente administradores</span></div>
      <div class="hap-v398-admin-actions">
        <button type="button" class="hap-v398-admin-btn" data-v398-open="backup"><strong>💾 Backups Gerais</strong><small>Curva + Controle em uma única recuperação.</small></button>
        <button type="button" class="hap-v398-admin-btn" data-v398-open="users"><strong>👥 Usuários</strong><small>Acessos, perfis, bloqueio, senha e exclusão segura.</small></button>
      </div>`;
    const note=panelRoot.querySelector('.hap-v34-note');
    if(note) panelRoot.insertBefore(panel,note); else panelRoot.appendChild(panel);
    panel.querySelector('[data-v398-open="backup"]')?.addEventListener('click',()=>openGlobalManager('backup'));
    panel.querySelector('[data-v398-open="users"]')?.addEventListener('click',()=>openGlobalManager('users'));
  }

  function patchManagers(){
    if(patchedManagers) return;
    try {
      if(typeof renderBackups!=='function' || typeof renderUsers!=='function' || typeof handleUserAction!=='function' || typeof loadUsers!=='function') return;
      patchedManagers=true;

      renderBackups=function(){
        const body=document.getElementById('backupsTableBody');
        if(!body) return;
        if(!backupsCache.length){ body.innerHTML='<tr><td colspan="6">Nenhum backup encontrado.</td></tr>'; return; }
        body.innerHTML=backupsCache.map(backup=>{
          const coverage=Number(backup.snapshot_version||1)>=2
            ? `${Number(backup.item_count||0).toLocaleString('pt-BR')} Curva · ${Number(backup.control_count||0).toLocaleString('pt-BR')} OIs`
            : `${Number(backup.item_count||0).toLocaleString('pt-BR')} Curva · legado`;
          const version=Number(backup.snapshot_version||1)>=2?'Geral V2':'Legado';
          return `<tr>
            <td><strong>${esc398(formatBackupDate(backup.created_at))}</strong><small>${esc398(backup.label||backup.checksum?.slice(0,12)||'')}</small></td>
            <td><span class="backup-type ${esc398(backup.backup_type)}">${esc398(backupTypeLabel(backup.backup_type))}</span><small>${version}</small></td>
            <td>${esc398(coverage)}</td>
            <td>${esc398(formatBytes(backup.size_bytes))}</td>
            <td>${esc398(backup.created_by_name||backup.created_by_email||'Sistema')}</td>
            <td><div class="backup-row-actions">
              <button type="button" data-backup-action="download" data-backup-id="${esc398(backup.id)}">Baixar JSON</button>
              <button type="button" class="danger" data-backup-action="restore" data-backup-id="${esc398(backup.id)}">Restaurar</button>
            </div></td></tr>`;
        }).join('');
        body.querySelectorAll('[data-backup-action]').forEach(button=>{ button.onclick=()=>handleBackupAction(button); });
      };

      loadUsers=async function(){
        if(currentProfile?.role!=='admin') return;
        const body=document.getElementById('usersTableBody');
        if(body) body.innerHTML='<tr><td colspan="4">Carregando usuários...</td></tr>';
        const {data,error}=await sb.from('profiles')
          .select('id,email,full_name,role,is_active,created_at,deleted_at')
          .is('deleted_at',null)
          .order('full_name',{ascending:true});
        if(error){ if(body) body.innerHTML=`<tr><td colspan="4" class="user-error">${esc398(error.message)}</td></tr>`; return; }
        usersCache=data||[];
        renderUsers();
      };

      renderUsers=function(){
        const body=document.getElementById('usersTableBody');
        if(!body) return;
        if(!usersCache.length){body.innerHTML='<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>';return;}
        body.innerHTML=usersCache.map(u=>{
          const isSelf=u.id===currentProfile?.id;
          const roleLabel=u.role==='admin'?'Administrador':'Visualizador';
          const roleAction=u.role==='admin'?'viewer':'admin';
          const roleButton=u.role==='admin'?'Tornar visualizador':'Tornar administrador';
          return `<tr>
            <td><strong>${esc398(u.full_name||'Sem nome')}</strong><small>${esc398(u.email||'')}</small>${isSelf?'<span class="self-badge">Sua conta</span>':''}</td>
            <td><span class="role-pill ${u.role==='admin'?'role-admin':'role-viewer'}">${roleLabel}</span></td>
            <td><span class="status-pill ${u.is_active?'active':'blocked'}">${u.is_active?'Ativo':'Bloqueado'}</span></td>
            <td><div class="user-actions">
              <button type="button" data-user-action="role" data-user-id="${esc398(u.id)}" data-role="${roleAction}" ${isSelf?'disabled':''}>${roleButton}</button>
              <button type="button" data-user-action="active" data-user-id="${esc398(u.id)}" data-active="${u.is_active?'false':'true'}" ${isSelf?'disabled':''}>${u.is_active?'Bloquear':'Ativar'}</button>
              <button type="button" data-user-action="password" data-user-id="${esc398(u.id)}" ${isSelf?'disabled':''}>Alterar senha</button>
              <button type="button" class="hap-v398-delete" data-user-action="delete" data-user-id="${esc398(u.id)}" ${isSelf?'disabled':''}>Excluir</button>
            </div></td></tr>`;
        }).join('');
        body.querySelectorAll('[data-user-action]').forEach(btn=>{btn.onclick=()=>handleUserAction(btn);});
      };

      const oldHandle=handleUserAction;
      handleUserAction=async function(btn){
        if(btn?.dataset?.userAction!=='delete') return oldHandle(btn);
        const userId=btn.dataset.userId;
        if(!userId || currentProfile?.role!=='admin' || userId===currentProfile?.id) return;
        const target=usersCache.find(u=>u.id===userId);
        const label=target?.full_name||target?.email||'este usuário';
        if(!confirm(`Excluir ${label} do HAPCAPEX?\n\nO acesso será encerrado e a conta será arquivada. O nome continuará nos históricos e na Auditoria.`)) return;
        const reason=prompt('Motivo da exclusão (opcional):','Desligamento/remoção de acesso') ?? null;
        if(reason===null) return;
        btn.disabled=true;
        try{
          const result=await invokeUserAdmin({action:'delete',user_id:userId,reason});
          if(result?.warning) alert(result.warning);
          await loadUsers();
        }catch(err){ alert(err.message||String(err)); }
        finally{ btn.disabled=false; }
      };
    } catch(err){ console.error('[HAPCAPEX V39.8] Falha ao preparar administração global',err); }
  }

  function tick(){
    injectStyles();
    hideLegacyToolbarButtons();
    decorateModalCopy();
    patchManagers();
    ensureGlobalPanel();
  }
  tick();
  const timer=setInterval(tick,300);
  setTimeout(()=>clearInterval(timer),90000);
  const observer=new MutationObserver(tick);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),90000);
  window.HAP_V39_8_GLOBAL_ADMIN={version:VERSION,tick};
})();
