/* HAPCAPEX V40.0.3 — Pre-auth guard do Controle de Capex
   Impede qualquer carga financeira antes da troca obrigatoria da senha temporaria.
   Deve executar DEPOIS do v37-control-governance.js e ANTES de init(). */
(() => {
  'use strict';
  if (window.HAP_CONTROL_PREAUTH_V40?.bootstrapped) return;

  const VERSION = '40.0.3';
  const original = window.loadRoleAndData;

  if (typeof original !== 'function') {
    console.error('[HAPCAPEX V40.0.3] loadRoleAndData indisponivel para o pre-auth guard.');
    window.HAP_CONTROL_PREAUTH_V40 = { version: VERSION, bootstrapped: false, error: 'loadRoleAndData indisponivel' };
    return;
  }

  async function readOwnProfile() {
    const uid = state?.session?.user?.id;
    if (!uid) return { profile: null, error: new Error('Sessao invalida.') };
    const { data, error } = await sb.from('profiles')
      .select('id,email,full_name,role,is_active,must_change_password,deleted_at')
      .eq('id', uid)
      .single();
    return { profile: data || null, error: error || null };
  }

  const guarded = async function(...args) {
    const uid = state?.session?.user?.id;
    if (!uid) return original.apply(this, args);

    try {
      const { profile, error } = await readOwnProfile();
      if (error || !profile) {
        if (typeof renderLogin === 'function') {
          renderLogin('Nao foi possivel validar seu perfil. Atualize a pagina e tente novamente.');
          return;
        }
        throw error || new Error('Perfil nao encontrado.');
      }

      if (!profile.is_active || profile.deleted_at) {
        try { await sb.auth.signOut({ scope: 'local' }); }
        catch (_) { try { await sb.auth.signOut(); } catch (_) {} }
        if (typeof renderLogin === 'function') renderLogin('Esta conta nao possui acesso ativo ao HAPCAPEX.');
        return;
      }

      if (profile.must_change_password) {
        state.role = profile.role;
        state.fullName = profile.full_name || profile.email || state.session?.user?.email || '';
        window.HAP_V40_PENDING_PASSWORD_PROFILE = profile;
        window.dispatchEvent(new CustomEvent('hapcapex:v40:password-required', { detail: { userId: uid } }));
        // O v40-control-security.js ja esta aguardando state.session e exibira o formulario.
        // CRITICO: nao chamar o bootstrap original, pois ele consultaria dados financeiros
        // que a Fase 2 corretamente bloqueia enquanto a senha for provisoria.
        return;
      }

      return original.apply(this, args);
    } catch (error) {
      console.error('[HAPCAPEX V40.0.3] Falha no pre-auth guard', error);
      if (typeof renderLogin === 'function') {
        renderLogin('Nao foi possivel validar o acesso com seguranca. Atualize a pagina e tente novamente.');
        return;
      }
      throw error;
    }
  };

  guarded.__hapV4003PreAuth = true;
  guarded.__hapOriginal = original;
  loadRoleAndData = window.loadRoleAndData = guarded;

  window.HAP_CONTROL_PREAUTH_V40 = {
    version: VERSION,
    bootstrapped: true,
    get original() { return original; }
  };
})();
