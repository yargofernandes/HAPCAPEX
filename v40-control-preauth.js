/* HAPCAPEX V40.0.50 — Pre-auth guard do Controle de Capex
   Impede qualquer carga financeira antes da troca obrigatoria da senha temporaria.
   Deve executar DEPOIS do v37-control-governance.js e ANTES de init().
   V40.0.49: carrega diretamente o tratamento de valores SAP em Transferências.
   V40.0.50: carrega diretamente os filtros por coluna da aba CAPEX.
*/
(() => {
  'use strict';
  if (window.HAP_CONTROL_PREAUTH_V40?.bootstrapped) return;

  const VERSION = '40.0.50';

  function loadTransferSapValuesV40049() {
    if (window.__HAP_V40049_TRANSFER_SAP_LOADER__) return;
    window.__HAP_V40049_TRANSFER_SAP_LOADER__ = true;

    const existing = [...document.querySelectorAll('script[src]')]
      .find(script => String(script.getAttribute('src') || '').includes('v40-transfer-sap-values.js'));

    if (existing) return;

    const script = document.createElement('script');
    script.src = './v40-transfer-sap-values.js?v=40.0.49';
    script.async = false;
    script.dataset.hapV40049TransferSap = '1';
    script.onerror = () => {
      window.__HAP_V40049_TRANSFER_SAP_LOADER__ = false;
      console.error('[HAPCAPEX V40.0.49] Falha ao carregar tratamento de valores SAP.');
    };
    document.head.appendChild(script);
  }

  // Carrega independentemente de autenticação financeira.
  // O módulo atua apenas nos campos do modal de Transferências.
  loadTransferSapValuesV40049();

  function loadCapexColumnFiltersV40050() {
    if (window.__HAP_V40050_CAPEX_FILTERS_LOADER__) return;
    window.__HAP_V40050_CAPEX_FILTERS_LOADER__ = true;

    const existing = [...document.querySelectorAll('script[src]')]
      .find(script => String(script.getAttribute('src') || '').includes('v40-capex-column-filters.js'));

    if (existing) return;

    const script = document.createElement('script');
    script.src = './v40-capex-column-filters.js?v=40.0.50';
    script.async = false;
    script.dataset.hapV40050CapexFilters = '1';
    script.onerror = () => {
      window.__HAP_V40050_CAPEX_FILTERS_LOADER__ = false;
      console.error('[HAPCAPEX V40.0.50] Falha ao carregar filtros por coluna do CAPEX.');
    };
    document.head.appendChild(script);
  }

  loadCapexColumnFiltersV40050();

  const original = window.loadRoleAndData;

  if (typeof original !== 'function') {
    console.error('[HAPCAPEX V40.0.49] loadRoleAndData indisponivel para o pre-auth guard.');
    window.HAP_CONTROL_PREAUTH_V40 = {
      version: VERSION,
      bootstrapped: false,
      error: 'loadRoleAndData indisponivel'
    };
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

        if (typeof renderLogin === 'function') {
          renderLogin('Esta conta nao possui acesso ativo ao HAPCAPEX.');
        }
        return;
      }

      if (profile.must_change_password) {
        state.role = profile.role;
        state.fullName = profile.full_name || profile.email || state.session?.user?.email || '';
        window.HAP_V40_PENDING_PASSWORD_PROFILE = profile;
        window.dispatchEvent(new CustomEvent(
          'hapcapex:v40:password-required',
          { detail: { userId: uid } }
        ));
        return;
      }

      return original.apply(this, args);
    } catch (error) {
      console.error('[HAPCAPEX V40.0.49] Falha no pre-auth guard', error);

      if (typeof renderLogin === 'function') {
        renderLogin('Nao foi possivel validar o acesso com seguranca. Atualize a pagina e tente novamente.');
        return;
      }

      throw error;
    }
  };

  guarded.__hapV40049PreAuth = true;
  guarded.__hapOriginal = original;

  loadRoleAndData = window.loadRoleAndData = guarded;

  window.HAP_CONTROL_PREAUTH_V40 = {
    version: VERSION,
    bootstrapped: true,
    get original() { return original; }
  };
})();
