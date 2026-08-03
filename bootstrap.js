const cfg=window.CAPEX_CONFIG||{};
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
let currentProfile=null,pendingImport=null,coreLoaded=false,usersCache=[];
const monthKeys=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan27','fev27','mar27','abr27','mai27','jun27','jul27'];
const $=s=>document.querySelector(s);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>{if(!v)return'-';const d=new Date(v+'T12:00:00');return isNaN(d)?'-':d.toLocaleDateString('pt-BR')};
function itemToRaw(x){const r={nome:x.nome,ordem:x.ordem,inicio:fmtDate(x.inicio),fim:fmtDate(x.fim),capex:num(x.capex),contingenciada:!!x.contingenciada};monthKeys.forEach(k=>r[k+'_real']=num(x.realizado?.[k]));return r}
async function loadApp(){
 const {data:{session}}=await sb.auth.getSession(); if(!session)return;
 const {data:p,error}=await sb.from('profiles').select('*').eq('id',session.user.id).single();if(error||!p?.is_active){await sb.auth.signOut();return}
 currentProfile=p;$('#authGate').hidden=true;$('#adminToolbar').hidden=false;$('#userLabel').textContent=(p.full_name||p.email)+' · '+(p.role==='admin'?'Administrador':'Visualizador');document.querySelectorAll('.admin-only').forEach(x=>x.hidden=p.role!=='admin');
 const [{data:items,error:ie},{data:settings,error:se}]=await Promise.all([sb.from('capex_items').select('*').is('deleted_at',null),sb.from('capex_settings').select('*').eq('id','main').single()]);
 if(ie)throw ie;if(se)throw se;
 const np=items.find(x=>x.categoria==='obra'&&(x.ordem==='NAO_PLANEJADAS'||/OBRAS NÃO PLANEJADAS/i.test(x.nome)));
 const obras=items.filter(x=>x.categoria==='obra'&&x!==np).map(itemToRaw);
 const mans=items.filter(x=>x.categoria==='manutencao').map(itemToRaw);
 const nao={};monthKeys.forEach(k=>nao[k]=num(np?.realizado?.[k]));
 const monthsReal=monthKeys.filter(k=>items.some(x=>num(x.realizado?.[k])!==0));
 window.HAP_DATA={obrasRaw:obras,manObrasRaw:mans,naoPlanejado:nao,monthsReal,settings};
 $('#dashboardRoot').hidden=false;
 if(!coreLoaded){coreLoaded=true;const s=document.createElement('script');s.src='dashboard-core.js?v='+Date.now();document.body.appendChild(s)}
}
$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#loginMsg').textContent='Entrando...';const f=e.currentTarget;const {error}=await sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value});if(error){$('#loginMsg').textContent='E-mail ou senha inválidos.';return}location.reload()};
$('#logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
function openModal(id){$('#'+id).classList.add('open')}function closeModal(id){$('#'+id).classList.remove('open')}document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$('#importBtn').onclick=()=>{if(currentProfile?.role==='admin')openModal('importModal')};$('#settingsBtn').onclick=()=>{if(currentProfile?.role!=='admin')return;fillSettings();openModal('settingsModal')};$('#usersBtn').onclick=async()=>{if(currentProfile?.role!=='admin')return;openModal('usersModal');await loadUsers()};
function normalizeName(s){return String(s||'').trim().toUpperCase().replace(/\s+/g,' ')}
function xdate(v){if(!v)return null;if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:null}if(v instanceof Date)return v.toISOString().slice(0,10);const s=String(v).trim();const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null}
function parseExcel(wb){const result=[];const findSheet=t=>wb.SheetNames.find(n=>normalizeName(n)===normalizeName(t));const ps=findSheet('PLANEJAMENTO');const ms=findSheet('OBRAS MANUTENÇÃO');if(!ps||!ms)throw new Error('As duas abas obrigatórias não foram encontradas.');
 let rows=XLSX.utils.sheet_to_json(wb.Sheets[ps],{header:1,defval:'',raw:true});let h=rows.findIndex(r=>normalizeName(r[0]).includes('ORDEM INTERNA')&&normalizeName(r[1]).includes('NOME OBRA'));if(h<0)throw new Error('Cabeçalho de PLANEJAMENTO não encontrado.');for(let i=h+1;i<rows.length;i++){const r=rows[i],nome=String(r[1]||'').trim();if(!nome)continue;let ordem=String(r[0]||'').trim();if(/OBRAS NÃO PLANEJADAS/i.test(nome))ordem='NAO_PLANEJADAS';if(!ordem)continue;const realizado={};monthKeys.forEach((k,j)=>realizado[k]=num(r[5+j]));result.push({categoria:'obra',ordem,nome,inicio:xdate(r[2]),fim:xdate(r[3]),capex:num(r[4]),tipologia:'Outros',contingenciada:/CONTINGENCIADA/i.test(nome),realizado})}
 rows=XLSX.utils.sheet_to_json(wb.Sheets[ms],{header:1,defval:'',raw:true});h=rows.findIndex(r=>normalizeName(r[2]).includes('ORDEM INTERNA')&&normalizeName(r[3]).includes('NOME DA OBRA'));if(h<0)throw new Error('Cabeçalho de OBRAS MANUTENÇÃO não encontrado.');for(let i=h+1;i<rows.length;i++){const r=rows[i],nome=String(r[3]||'').trim();if(!nome)continue;let ordem=String(r[2]||'').trim()||('SEM_OI_'+btoa(unescape(encodeURIComponent(nome))).replace(/[^A-Z0-9]/gi,'').slice(0,40));const realizado={};['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'].forEach((k,j)=>realizado[k]=num(r[4+j]));result.push({categoria:'manutencao',ordem,nome,inicio:null,fim:null,capex:0,tipologia:'Manutenção',contingenciada:false,realizado})}return result}
$('#excelFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});pendingImport=parseExcel(wb);const o=pendingImport.filter(x=>x.categoria==='obra').length,m=pendingImport.filter(x=>x.categoria==='manutencao').length;$('#importStatus').textContent=`${o} registros de Obras e ${m} registros de Manutenção reconhecidos.`;$('#applyImport').disabled=false}catch(err){pendingImport=null;$('#importStatus').textContent='Erro: '+err.message;$('#applyImport').disabled=true}};
$('#applyImport').onclick=async()=>{if(!pendingImport||currentProfile?.role!=='admin')return;$('#applyImport').disabled=true;$('#importStatus').textContent='Atualizando banco...';try{let created=0,updated=0;const {data:old}=await sb.from('capex_items').select('id,categoria,ordem').is('deleted_at',null);const map=new Map((old||[]).map(x=>[x.categoria+'|'+x.ordem,x]));for(const x of pendingImport){const key=x.categoria+'|'+x.ordem,found=map.get(key);if(found){const {error}=await sb.from('capex_items').update({...x,updated_by:currentProfile.id}).eq('id',found.id);if(error)throw error;updated++}else{const {error}=await sb.from('capex_items').insert({...x,created_by:currentProfile.id,updated_by:currentProfile.id});if(error)throw error;created++}}await sb.from('import_history').insert({file_name:$('#excelFile').files[0]?.name||'planilha.xlsx',total_records:pendingImport.length,created_records:created,updated_records:updated,ignored_records:0,imported_by:currentProfile.id,status:'completed'});$('#importStatus').textContent=`Concluído: ${created} criados e ${updated} atualizados. A página será recarregada.`;setTimeout(()=>location.reload(),1200)}catch(err){$('#importStatus').textContent='Falha: '+err.message;$('#applyImport').disabled=false}};
const brlValue=v=>num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let settingsDraft={conting:[],aportes:[]};
function cleanDetail(list){return (Array.isArray(list)?list:[]).map(x=>({nome:String(x?.nome||'').trim(),valor:num(x?.valor),mes:String(x?.mes||'').trim()})).filter(x=>x.nome||x.valor)}
function currentMonthKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function makeDetailRow(type,item={nome:'',valor:0,mes:currentMonthKey()}){
 const row=document.createElement('div');row.className='detail-row';row.dataset.type=type;
 row.innerHTML=`<input class="detail-name" type="text" maxlength="300" placeholder="Descrição" value="${String(item.nome||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}"><input class="detail-month" type="month" min="2026-01" value="${String(item.mes||'')}" title="Mês do lançamento"><div class="money-input"><span>R$</span><input class="detail-value" type="number" min="0" step="0.01" value="${num(item.valor).toFixed(2)}"></div><button type="button" class="remove-row" title="Excluir linha">🗑️</button>`;
 row.querySelector('.remove-row').onclick=()=>{row.remove();syncDraftAndTotals()};
 row.querySelectorAll('input').forEach(i=>i.addEventListener('input',syncDraftAndTotals));
 return row;
}
function renderDetailRows(type,items){const box=$(type==='conting'?'#contingRows':'#aporteRows');box.innerHTML='';items.forEach(x=>box.appendChild(makeDetailRow(type,x)));if(!items.length)box.innerHTML='<div class="empty-detail">Nenhuma linha cadastrada.</div>'}
function readRows(type){const box=$(type==='conting'?'#contingRows':'#aporteRows');return [...box.querySelectorAll('.detail-row')].map(r=>({nome:r.querySelector('.detail-name').value.trim(),mes:r.querySelector('.detail-month').value,valor:num(r.querySelector('.detail-value').value)})).filter(x=>x.nome||x.valor)}
function syncDraftAndTotals(){settingsDraft.conting=readRows('conting');settingsDraft.aportes=readRows('aportes');const s=window.HAP_DATA.settings,ci=num(s.capex_inicial),ct=settingsDraft.conting.reduce((a,x)=>a+num(x.valor),0),ap=settingsDraft.aportes.reduce((a,x)=>a+num(x.valor),0),at=ci+ap-ct;$('#sumCapexInicial').textContent=brlValue(ci);$('#sumAportes').textContent=brlValue(ap);$('#sumConting').textContent=brlValue(ct);$('#sumCapexAtual').textContent=brlValue(at)}
function fillSettings(){const s=window.HAP_DATA.settings;settingsDraft={conting:cleanDetail(s.conting_detalhe),aportes:cleanDetail(s.aportes_detalhe)};renderDetailRows('conting',settingsDraft.conting);renderDetailRows('aportes',settingsDraft.aportes);syncDraftAndTotals()}
$('#addContingRow').onclick=()=>{const e=$('#contingRows .empty-detail');if(e)e.remove();$('#contingRows').appendChild(makeDetailRow('conting'));syncDraftAndTotals()};
$('#addAporteRow').onclick=()=>{const e=$('#aporteRows .empty-detail');if(e)e.remove();$('#aporteRows').appendChild(makeDetailRow('aportes'));syncDraftAndTotals()};
$('#settingsForm').onsubmit=async e=>{e.preventDefault();if(currentProfile?.role!=='admin')return;syncDraftAndTotals();const s=window.HAP_DATA.settings,capex_conting=settingsDraft.conting.reduce((a,x)=>a+num(x.valor),0),capex_aportes=settingsDraft.aportes.reduce((a,x)=>a+num(x.valor),0);const payload={id:'main',capex_inicial:num(s.capex_inicial),capex_conting,capex_aportes,manutencao_inicial:num(s.manutencao_inicial),manutencao_atual:num(s.manutencao_atual),conting_detalhe:settingsDraft.conting,aportes_detalhe:settingsDraft.aportes,updated_by:currentProfile.id,updated_at:new Date().toISOString()};const {error}=await sb.from('capex_settings').upsert(payload);if(error)return alert(error.message);location.reload()};

async function invokeUserAdmin(payload){
 if(currentProfile?.role!=='admin')throw new Error('Somente administradores podem gerenciar usuários.');
 const {data,error}=await sb.functions.invoke('manage-capex-users',{body:payload});
 if(error){
  let message=error.message||'Não foi possível concluir a operação.';
  try{const body=await error.context?.json();if(body?.error)message=body.error}catch{}
  throw new Error(message);
 }
 if(data?.error)throw new Error(data.error);
 return data;
}
async function loadUsers(){
 if(currentProfile?.role!=='admin')return;
 const body=$('#usersTableBody');body.innerHTML='<tr><td colspan="4">Carregando usuários...</td></tr>';
 const {data,error}=await sb.from('profiles').select('id,email,full_name,role,is_active,created_at').order('full_name',{ascending:true});
 if(error){body.innerHTML=`<tr><td colspan="4" class="user-error">${esc(error.message)}</td></tr>`;return}
 usersCache=data||[];renderUsers();
}
function renderUsers(){
 const body=$('#usersTableBody');
 if(!usersCache.length){body.innerHTML='<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>';return}
 body.innerHTML=usersCache.map(u=>{
  const isSelf=u.id===currentProfile?.id;
  const roleLabel=u.role==='admin'?'Administrador':'Visualizador';
  const statusLabel=u.is_active?'Ativo':'Bloqueado';
  const roleAction=u.role==='admin'?'viewer':'admin';
  const roleButton=u.role==='admin'?'Tornar visualizador':'Tornar administrador';
  return `<tr>
   <td><strong>${esc(u.full_name||'Sem nome')}</strong><small>${esc(u.email||'')}</small>${isSelf?'<span class="self-badge">Sua conta</span>':''}</td>
   <td><span class="role-pill ${u.role==='admin'?'role-admin':'role-viewer'}">${roleLabel}</span></td>
   <td><span class="status-pill ${u.is_active?'active':'blocked'}">${statusLabel}</span></td>
   <td><div class="user-actions">
    <button type="button" data-user-action="role" data-user-id="${esc(u.id)}" data-role="${roleAction}" ${isSelf?'disabled':''}>${roleButton}</button>
    <button type="button" data-user-action="active" data-user-id="${esc(u.id)}" data-active="${u.is_active?'false':'true'}" ${isSelf?'disabled':''}>${u.is_active?'Bloquear':'Ativar'}</button>
    <button type="button" data-user-action="password" data-user-id="${esc(u.id)}" ${isSelf?'disabled':''}>Alterar senha</button>
   </div></td>
  </tr>`;
 }).join('');
 body.querySelectorAll('[data-user-action]').forEach(btn=>btn.onclick=()=>handleUserAction(btn));
}
async function handleUserAction(btn){
 const action=btn.dataset.userAction,userId=btn.dataset.userId;
 if(!userId||currentProfile?.role!=='admin')return;
 btn.disabled=true;
 try{
  if(action==='role'){
   const role=btn.dataset.role;
   const label=role==='admin'?'administrador':'visualizador';
   if(!confirm(`Alterar este usuário para ${label}? A sessão dele será encerrada.`))return;
   await invokeUserAdmin({action:'set_role',user_id:userId,role});
  }else if(action==='active'){
   const isActive=btn.dataset.active==='true';
   if(!confirm(isActive?'Reativar este usuário?':'Bloquear este usuário e encerrar a sessão dele?'))return;
   await invokeUserAdmin({action:'set_active',user_id:userId,is_active:isActive});
  }else if(action==='password'){
   const target=usersCache.find(u=>u.id===userId);
   $('#passwordUserId').value=userId;
   $('#passwordUserLabel').textContent=`Defina uma nova senha para ${target?.full_name||target?.email||'o usuário'}.`;
   $('#resetUserPassword').value='';
   $('#resetUserPassword').type='password';
   const toggle=document.querySelector('[data-password-target="resetUserPassword"]');if(toggle)toggle.textContent='Mostrar';
   $('#passwordFormStatus').className='user-status';$('#passwordFormStatus').textContent='';
   openModal('passwordModal');
   return;
  }
  await loadUsers();
 }catch(err){alert(err.message||String(err))}finally{btn.disabled=false}
}
$('#refreshUsersBtn').onclick=()=>loadUsers();

document.querySelectorAll('[data-password-target]').forEach(btn=>{
 btn.onclick=()=>{const input=document.getElementById(btn.dataset.passwordTarget);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Ocultar':'Mostrar'};
});
$('#passwordForm').onsubmit=async e=>{
 e.preventDefault();
 if(currentProfile?.role!=='admin')return;
 const form=e.currentTarget,userId=form.user_id.value,password=form.password.value,status=$('#passwordFormStatus'),submit=form.querySelector('button[type="submit"]');
 status.className='user-status';status.textContent='Alterando senha...';submit.disabled=true;
 try{
  if(!userId)throw new Error('Usuário não informado.');
  if(password.length<8)throw new Error('A senha deve ter pelo menos 8 caracteres.');
  await invokeUserAdmin({action:'reset_password',user_id:userId,password});
  status.className='user-status success';status.textContent='Senha alterada com sucesso.';
  setTimeout(()=>{closeModal('passwordModal');form.reset();loadUsers()},700);
 }catch(err){status.className='user-status error';status.textContent=err.message||String(err)}finally{submit.disabled=false}
};

$('#userForm').onsubmit=async e=>{
 e.preventDefault();
 if(currentProfile?.role!=='admin')return;
 const form=e.currentTarget,status=$('#userFormStatus'),submit=form.querySelector('button[type="submit"]');
 status.className='user-status';status.textContent='Criando usuário...';submit.disabled=true;
 try{
  if(form.password.value.length<8)throw new Error('A senha deve ter pelo menos 8 caracteres.');
  await invokeUserAdmin({action:'create',full_name:form.full_name.value.trim(),email:form.email.value.trim(),password:form.password.value,role:form.role.value});
  status.className='user-status success';status.textContent='Usuário criado com sucesso.';
  form.reset();form.role.value='viewer';await loadUsers();
 }catch(err){status.className='user-status error';status.textContent=err.message||String(err)}finally{submit.disabled=false}
};

loadApp().catch(e=>{$('#loginMsg').textContent='Erro ao carregar: '+e.message;console.error(e)});
