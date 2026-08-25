/* HAPCAPEX V40.0.52 — Pre-auth guard do Controle de Capex
   Impede qualquer carga financeira antes da troca obrigatoria da senha temporaria.
   Deve executar DEPOIS do v37-control-governance.js e ANTES de init().
   V40.0.49: carrega diretamente o tratamento de valores SAP em Transferências.
   V40.0.50: carrega diretamente os filtros por coluna da aba CAPEX.
   V40.0.51: carrega diretamente os totais CAPEX alinhados aos KPIs.
   V40.0.52: opção segura de registrar aporte consolidado em pacote no KPI.
*/
(() => {
  'use strict';
  if (window.HAP_CONTROL_PREAUTH_V40?.bootstrapped) return;

  const VERSION = '40.0.52';

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

  function loadTableTotalsV40051() {
    if (window.__HAP_V40051_TABLE_TOTALS_LOADER__) return;
    window.__HAP_V40051_TABLE_TOTALS_LOADER__ = true;

    const old = [...document.querySelectorAll('script[src]')]
      .find(script => String(script.getAttribute('src') || '').includes('v40-table-totals.js'));

    if (old) {
      // O service worker/loader antigo pode já ter inserido ?v=40.0.37.
      // Removemos apenas a tag; a nova versão possui uma flag própria e substitui o footer.
      old.remove();
    }

    const script = document.createElement('script');
    script.src = './v40-table-totals.js?v=40.0.51';
    script.async = false;
    script.dataset.hapV40051TableTotals = '1';

    script.onerror = () => {
      window.__HAP_V40051_TABLE_TOTALS_LOADER__ = false;
      console.error('[HAPCAPEX V40.0.51] Falha ao carregar totais alinhados aos KPIs.');
    };

    document.head.appendChild(script);
  }

  loadTableTotalsV40051();

  function loadPackageAporteKpiV40052() {
    if (window.__HAP_V40052_PACKAGE_KPI_LOADER__) return;
    window.__HAP_V40052_PACKAGE_KPI_LOADER__ = true;

    const existing = [...document.querySelectorAll('script[src]')]
      .find(script => String(script.getAttribute('src') || '').includes('v40-package-aporte-kpi.js'));

    if (existing) return;

    const script = document.createElement('script');
    script.src = './v40-package-aporte-kpi.js?v=40.0.52';
    script.async = false;
    script.dataset.hapV40052PackageKpi = '1';

    script.onerror = () => {
      window.__HAP_V40052_PACKAGE_KPI_LOADER__ = false;
      console.error('[HAPCAPEX V40.0.52] Falha ao carregar aporte de pacote para KPI.');
    };

    document.head.appendChild(script);
  }

  loadPackageAporteKpiV40052();

  const original = window.loadRoleAndData;

  if (typeof original !== 'function') {
    console.error('[HAPCAPEX V40.0.52] loadRoleAndData indisponivel para o pre-auth guard.');
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
      console.error('[HAPCAPEX V40.0.52] Falha no pre-auth guard', error);

      if (typeof renderLogin === 'function') {
        renderLogin('Nao foi possivel validar o acesso com seguranca. Atualize a pagina e tente novamente.');
        return;
      }

      throw error;
    }
  };

  guarded.__hapV40052PreAuth = true;
  guarded.__hapOriginal = original;

  loadRoleAndData = window.loadRoleAndData = guarded;

  window.HAP_CONTROL_PREAUTH_V40 = {
    version: VERSION,
    bootstrapped: true,
    get original() { return original; }
  };
})();
