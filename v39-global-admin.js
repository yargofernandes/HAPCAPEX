/* HAPCAPEX V40.0.46 — Administração global (Backups + Usuários + Auditoria Geral)
   Correções:
   - Auditoria Geral nasce no mesmo painel global de Backups e Usuários.
   - O módulo de auditoria é carregado sob demanda pelo próprio painel global.
   - Branding da autenticação é normalizado para HAPCAPEX.
*/
(() => {
  'use strict';
  const VERSION='40.0.46';
  let patchedManagers=false;
  let auditLoadPromise=null;

  function isAdmin(){
    try { return typeof currentProfile!=='undefined' && currentProfile?.role==='admin'; }
    catch(_){ return false; }
  }

  function esc398(v){
    return String(v??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function setTextIfNeeded(el,text){
    if(el && el.textContent!==text) el.textContent=text;
  }

  function normalizeBranding(){
    // Tela de login da Curva / página inicial.
    setTextIfNeeded(document.querySelector('#loginForm h2'),'🔐 HAPCAPEX');

    // Barra administrativa legada, quando estiver presente.
    setTextIfNeeded(document.querySelector('#adminToolbar > strong'),'HAPCAPEX');
  }

  function hideLegacyToolbarButtons(){
    ['backupBtn','usersBtn'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){
        el.hidden=true;
        el.style.display='none';
        el.setAttribute('aria-hidden','true');
      }
    });
  }

  function injectStyles(){
    if(document.getElementById('hap-v398-global-admin-styles')) return;
    const s=document.createElement('style');
    s.id='hap-v398-global-admin-styles';
    s.textContent=`
      #backupBtn,#usersBtn{display:none!important}
      .hap-v398-admin-panel{
        margin-top:18px;border:1px solid #d8e1ed;border-radius:16px;background:#fff;
        padding:16px 18px;box-shadow:0 3px 14px rgba(13,43,78,.06)
      }
      .hap-v398-admin-head{
        display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px
      }
      .hap-v398-admin-head strong{color:#0d2b4e;font-size:13px}
      .hap-v398-admin-head span{font-size:10px;color:#758399}
      .hap-v398-admin-actions{
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px
      }
      .hap-v398-admin-btn{
        border:1px solid #d7e0ec;background:#f7f9fc;border-radius:12px;padding:13px 14px;
        text-align:left;cursor:pointer;font:inherit;color:#0d2b4e;transition:.15s ease
      }
      .hap-v398-admin-btn:hover,.hap-v398-admin-btn:focus-visible{
        border-color:#9db7d5;background:#eef4fc;outline:none;transform:translateY(-1px)
      }
      .hap-v398-admin-btn strong{display:block;font-size:12px}
      .hap-v398-admin-btn small{
        display:block;margin-top:3px;color:#66758b;font-size:10px;line-height:1.35
      }
      #backupModal.open,#usersModal.open,#passwordModal.open,#hapGlobalAuditModal.open{
        z-index:100250!important
      }
      .hap-v398-delete{
        color:#a52727!important;border-color:#e4b5b5!important;background:#fffafa!important
      }
      @media(max-width:900px){
        .hap-v398-admin-actions{grid-template-columns:1fr 1fr}
      }
      @media(max-width:720px){
        .hap-v398-admin-actions{grid-template-columns:1fr}
        .hap-v398-admin-panel{padding:14px}
      }
    `;
    document.head.appendChild(s);
  }

  function decorateModalCopy(){
    const backup=document.getElementById('backupModal');
    if(backup){
      const h=backup.querySelector('.user-manager-head h2');
      const p=backup.querySelector('.user-manager-head p');
      const warning=backup.querySelector('.backup-warning');
      setTextIfNeeded(h,'Backups Gerais HAPCAPEX');
      setTextIfNeeded(
        p,
        'Protege em conjunto a Curva de Capex e o Controle de Capex. Backups automáticos ficam por 14 dias; manuais e pré-restauração, por 60 dias.'
      );
      setTextIfNeeded(
        warning,
        'A restauração é transacional e cria um pré-backup. Curva + Controle retornam ao estado escolhido. Usuários, senhas e Auditoria não são apagados.'
      );
      const th=backup.querySelector('.backup-table thead th:nth-child(3)');
      setTextIfNeeded(th,'Cobertura');
    }

    const users=document.getElementById('usersModal');
    if(users){
      const h=users.querySelector('.user-manager-head h2');
      const p=users.querySelector('.user-manager-head p');
      setTextIfNeeded(h,'Usuários HAPCAPEX');
      setTextIfNeeded(
        p,
        'Administração global de acesso à Curva e ao Controle. A exclusão remove o acesso, encerra sessões e preserva a autoria histórica dos registros.'
      );
    }
  }

  function openGlobalManager(kind){
    if(!isAdmin()) return;
    decorateModalCopy();
    const btn=document.getElementById(kind==='backup'?'backupBtn':'usersBtn');
    if(btn) btn.click();
  }

  function waitForAuditApi(timeoutMs=6000){
    return new Promise((resolve,reject)=>{
      const started=Date.now();

      const check=()=>{
        const api=window.HAP_V40045_GLOBAL_AUDIT;
        if(api?.open) return resolve(api);

        if(Date.now()-started>=timeoutMs){
          return reject(new Error('O módulo de Auditoria Geral não respondeu a tempo.'));
        }

        setTimeout(check,80);
      };

      check();
    });
  }

  function loadGlobalAuditModule(){
    if(window.HAP_V40045_GLOBAL_AUDIT?.open){
      return Promise.resolve(window.HAP_V40045_GLOBAL_AUDIT);
    }

    if(auditLoadPromise) return auditLoadPromise;

    auditLoadPromise=new Promise((resolve,reject)=>{
      const existing=[...document.querySelectorAll('script[src]')]
        .find(s=>String(s.getAttribute('src')||'').includes('v40-global-audit.js'));

      if(existing){
        waitForAuditApi().then(resolve,reject);
        return;
      }

      const script=document.createElement('script');
      script.src='./v40-global-audit.js?v=40.0.46';
      script.async=false;
      script.dataset.v40046GlobalAudit='1';

      script.onload=()=>{
        waitForAuditApi().then(resolve,reject);
      };

      script.onerror=()=>{
        reject(new Error('Falha ao carregar v40-global-audit.js.'));
      };

      document.head.appendChild(script);
    }).finally(()=>{
      auditLoadPromise=null;
    });

    return auditLoadPromise;
  }

  async function openGlobalAudit(){
    if(!isAdmin()) return;

    const trigger=document.querySelector('[data-v398-open="audit"]');

    if(trigger){
      trigger.disabled=true;
      trigger.style.opacity='.7';
    }

    try{
      const api=await loadGlobalAuditModule();
      api.open();
    }catch(err){
      console.error('[HAPCAPEX V40.0.46] Falha ao abrir Auditoria Geral',err);
      alert(
        'Não foi possível abrir a Auditoria Geral. Atualize a página e tente novamente.\n\n'+
        (err?.message||String(err))
      );
    }finally{
      if(trigger){
        trigger.disabled=false;
        trigger.style.opacity='';
      }
    }
  }

  function bindPanelButtons(panel){
    if(!panel || panel.dataset.v40046Bound==='1') return;

    panel.dataset.v40046Bound='1';

    panel.querySelector('[data-v398-open="backup"]')
      ?.addEventListener('click',()=>openGlobalManager('backup'));

    panel.querySelector('[data-v398-open="users"]')
      ?.addEventListener('click',()=>openGlobalManager('users'));

    panel.querySelector('[data-v398-open="audit"]')
      ?.addEventListener('click',()=>void openGlobalAudit());
  }

  function ensureGlobalPanel(){
    const selector=document.getElementById('hapcapexSystemSelectorV34');
    if(!selector || !isAdmin()) return;

    const panelRoot=selector.querySelector('.hap-v34-panel');
    if(!panelRoot) return;

    let panel=selector.querySelector('[data-v398-global-admin]');

    if(!panel){
      panel=document.createElement('section');
      panel.className='hap-v398-admin-panel';
      panel.dataset.v398GlobalAdmin='1';

      panel.innerHTML=`
        <div class="hap-v398-admin-head">
          <strong>Administração HAPCAPEX</strong>
          <span>Recursos globais · somente administradores</span>
        </div>
        <div class="hap-v398-admin-actions">
          <button type="button" class="hap-v398-admin-btn" data-v398-open="backup">
            <strong>💾 Backups Gerais</strong>
            <small>Curva + Controle em uma única recuperação.</small>
          </button>
          <button type="button" class="hap-v398-admin-btn" data-v398-open="users">
            <strong>👥 Usuários</strong>
            <small>Acessos, perfis, bloqueio, senha e exclusão segura.</small>
          </button>
          <button type="button" class="hap-v398-admin-btn"
                  data-v398-open="audit" data-v40045-audit-open="1">
            <strong>🧾 Auditoria Geral</strong>
            <small>Controle + Curva + SAP em uma única linha do tempo.</small>
          </button>
        </div>`;

      const note=panelRoot.querySelector('.hap-v34-note');
      if(note) panelRoot.insertBefore(panel,note);
      else panelRoot.appendChild(panel);

      bindPanelButtons(panel);
      return;
    }

    // Compatibilidade com a versão anterior já renderizada:
    // acrescenta apenas a Auditoria, sem reconstruir Backups/Usuários.
    const actions=panel.querySelector('.hap-v398-admin-actions');

    if(actions && !actions.querySelector('[data-v398-open="audit"]')){
      const audit=document.createElement('button');
      audit.type='button';
      audit.className='hap-v398-admin-btn';
      audit.dataset.v398Open='audit';
      audit.dataset.v40045AuditOpen='1';
      audit.innerHTML=`
        <strong>🧾 Auditoria Geral</strong>
        <small>Controle + Curva + SAP em uma única linha do tempo.</small>`;

      audit.addEventListener('click',()=>void openGlobalAudit());
      actions.appendChild(audit);
    }

    // Os dois botões antigos já possuem listeners da versão original.
  }

  function patchManagers(){
    if(patchedManagers) return;

    try{
      if(
        typeof renderBackups!=='function' ||
        typeof renderUsers!=='function' ||
        typeof handleUserAction!=='function' ||
        typeof loadUsers!=='function'
      ) return;

      patchedManagers=true;

      renderBackups=function(){
        const body=document.getElementById('backupsTableBody');
        if(!body) return;

        if(!backupsCache.length){
          body.innerHTML='<tr><td colspan="6">Nenhum backup encontrado.</td></tr>';
          return;
        }

        body.innerHTML=backupsCache.map(backup=>{
          const coverage=Number(backup.snapshot_version||1)>=2
            ? `${Number(backup.item_count||0).toLocaleString('pt-BR')} Curva · ${Number(backup.control_count||0).toLocaleString('pt-BR')} OIs`
            : `${Number(backup.item_count||0).toLocaleString('pt-BR')} Curva · legado`;

          const version=Number(backup.snapshot_version||1)>=2?'Geral V2':'Legado';

          return `<tr>
            <td>
              <strong>${esc398(formatBackupDate(backup.created_at))}</strong>
              <small>${esc398(backup.label||backup.checksum?.slice(0,12)||'')}</small>
            </td>
            <td>
              <span class="backup-type ${esc398(backup.backup_type)}">
                ${esc398(backupTypeLabel(backup.backup_type))}
              </span>
              <small>${version}</small>
            </td>
            <td>${esc398(coverage)}</td>
            <td>${esc398(formatBytes(backup.size_bytes))}</td>
            <td>${esc398(backup.created_by_name||backup.created_by_email||'Sistema')}</td>
            <td>
              <div class="backup-row-actions">
                <button type="button"
                        data-backup-action="download"
                        data-backup-id="${esc398(backup.id)}">
                  Baixar JSON
                </button>
                <button type="button"
                        class="danger"
                        data-backup-action="restore"
                        data-backup-id="${esc398(backup.id)}">
                  Restaurar
                </button>
              </div>
            </td>
          </tr>`;
        }).join('');

        body.querySelectorAll('[data-backup-action]')
          .forEach(button=>{ button.onclick=()=>handleBackupAction(button); });
      };

      loadUsers=async function(){
        if(currentProfile?.role!=='admin') return;

        const body=document.getElementById('usersTableBody');

        if(body){
          body.innerHTML='<tr><td colspan="4">Carregando usuários...</td></tr>';
        }

        const {data,error}=await sb.from('profiles')
          .select('id,email,full_name,role,is_active,created_at,deleted_at')
          .is('deleted_at',null)
          .order('full_name',{ascending:true});

        if(error){
          if(body){
            body.innerHTML=
              `<tr><td colspan="4" class="user-error">${esc398(error.message)}</td></tr>`;
          }
          return;
        }

        usersCache=data||[];
        renderUsers();
      };

      renderUsers=function(){
        const body=document.getElementById('usersTableBody');
        if(!body) return;

        if(!usersCache.length){
          body.innerHTML='<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>';
          return;
        }

        body.innerHTML=usersCache.map(u=>{
          const isSelf=u.id===currentProfile?.id;
          const roleLabel=u.role==='admin'?'Administrador':'Visualizador';
          const roleAction=u.role==='admin'?'viewer':'admin';
          const roleButton=u.role==='admin'
            ?'Tornar visualizador'
            :'Tornar administrador';

          return `<tr>
            <td>
              <strong>${esc398(u.full_name||'Sem nome')}</strong>
              <small>${esc398(u.email||'')}</small>
              ${isSelf?'<span class="self-badge">Sua conta</span>':''}
            </td>
            <td>
              <span class="role-pill ${u.role==='admin'?'role-admin':'role-viewer'}">
                ${roleLabel}
              </span>
            </td>
            <td>
              <span class="status-pill ${u.is_active?'active':'blocked'}">
                ${u.is_active?'Ativo':'Bloqueado'}
              </span>
            </td>
            <td>
              <div class="user-actions">
                <button type="button"
                        data-user-action="role"
                        data-user-id="${esc398(u.id)}"
                        data-role="${roleAction}"
                        ${isSelf?'disabled':''}>
                  ${roleButton}
                </button>
                <button type="button"
                        data-user-action="active"
                        data-user-id="${esc398(u.id)}"
                        data-active="${u.is_active?'false':'true'}"
                        ${isSelf?'disabled':''}>
                  ${u.is_active?'Bloquear':'Ativar'}
                </button>
                <button type="button"
                        data-user-action="password"
                        data-user-id="${esc398(u.id)}"
                        ${isSelf?'disabled':''}>
                  Alterar senha
                </button>
                <button type="button"
                        class="hap-v398-delete"
                        data-user-action="delete"
                        data-user-id="${esc398(u.id)}"
                        ${isSelf?'disabled':''}>
                  Excluir
                </button>
              </div>
            </td>
          </tr>`;
        }).join('');

        body.querySelectorAll('[data-user-action]')
          .forEach(btn=>{btn.onclick=()=>handleUserAction(btn);});
      };

      const oldHandle=handleUserAction;

      handleUserAction=async function(btn){
        if(btn?.dataset?.userAction!=='delete'){
          return oldHandle(btn);
        }

        const userId=btn.dataset.userId;

        if(
          !userId ||
          currentProfile?.role!=='admin' ||
          userId===currentProfile?.id
        ) return;

        const target=usersCache.find(u=>u.id===userId);
        const label=target?.full_name||target?.email||'este usuário';

        if(!confirm(
          `Excluir ${label} do HAPCAPEX?\n\n`+
          'O acesso será encerrado e a conta será arquivada. '+
          'O nome continuará nos históricos e na Auditoria.'
        )) return;

        const reason=
          prompt(
            'Motivo da exclusão (opcional):',
            'Desligamento/remoção de acesso'
          ) ?? null;

        if(reason===null) return;

        btn.disabled=true;

        try{
          const result=await invokeUserAdmin({
            action:'delete',
            user_id:userId,
            reason
          });

          if(result?.warning) alert(result.warning);
          await loadUsers();
        }catch(err){
          alert(err.message||String(err));
        }finally{
          btn.disabled=false;
        }
      };

    }catch(err){
      console.error(
        '[HAPCAPEX V40.0.46] Falha ao preparar administração global',
        err
      );
    }
  }

  function tick(){
    injectStyles();
    normalizeBranding();
    hideLegacyToolbarButtons();
    decorateModalCopy();
    patchManagers();
    ensureGlobalPanel();
  }

  tick();

  // Mantém a correção ativa durante login/boot/transição para o seletor.
  const timer=setInterval(tick,300);
  setTimeout(()=>clearInterval(timer),120000);

  const observer=new MutationObserver(tick);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),120000);

  window.HAP_V39_8_GLOBAL_ADMIN={
    version:VERSION,
    tick,
    openAudit:openGlobalAudit
  };
})();
