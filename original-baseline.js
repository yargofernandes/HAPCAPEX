/* HAPCAPEX V40 — ARQUIVO SANITIZADO
   O baseline financeiro foi migrado para o Supabase em 16/08/2026.
   Este arquivo e mantido apenas para compatibilidade de cache com versoes anteriores
   e NAO contem nomes de obras, OIs, CAPEX, fluxos mensais ou totais corporativos.
*/
window.HAP_ORIGINAL_BASELINE = Object.freeze({
  version: 'migrated-to-supabase-v40',
  constants: Object.freeze({}),
  naoPlanejado: Object.freeze({}),
  plannedTotals: Object.freeze({}),
  works: Object.freeze([])
});

// Carrega o hardening antes do bootstrap nas versoes do HTML que ainda referenciam este arquivo.
if (!document.querySelector('script[src*="v40-security-hardening.js"]')) {
  document.write('<script src="./v40-security-hardening.js?v=40.0.0"><\/script>');
}
