/* HAPCAPEX V40.0.69 — Política de realizado da Manutenção
   Regra de negócio no backend:
   - Exercício 2026: somente categoria Faturas da Base Consumo.
   - A partir de 2027: todas as categorias/realizados.
   Correção visual:
   - Filtros mensais passam a manter também valores negativos (estornos/créditos),
     para que o KPI mensal represente o líquido real.
*/
(() => {
  'use strict';

  if (window.__HAP_V4068_MAINT_REALIZED_POLICY__) return;
  window.__HAP_V4068_MAINT_REALIZED_POLICY__ = true;

  const VERSION = '40.0.68';
  const EPS = 0.005;
  let attempts = 0;
  let timer = null;

  function hasMovement(value) {
    return Math.abs(Number(value || 0)) > EPS;
  }

  function patchMaintenanceFilter() {
    try {
      if (typeof applyManFilter !== 'function' ||
          typeof manObras === 'undefined' ||
          typeof manSelectedMonths === 'undefined') {
        return false;
      }

      if (window.__HAP_V4068_MAN_FILTER_PATCHED__) return true;

      applyManFilter = function() {
        const input = document.getElementById('manFilterInput');
        const text = String(input?.value || '').toLowerCase();
        const selMons = manSelectedMonths;

        manFilteredObras = manObras.filter(o => {
          const nome = String(o?.nome || '').toLowerCase();
          const ordem = String(o?.ordem || '').toLowerCase();
          const matchText = !text || nome.includes(text) || ordem.includes(text);
          const matchMonth = selMons.size === 0 || [...selMons].some(mk => hasMovement(o?.[mk + '_real']));
          return matchText && matchMonth;
        });

        const count = document.getElementById('manFilterCount');
        if (count) count.textContent = `${manFilteredObras.length} de ${manObras.length} obras`;

        if (typeof renderManKPIs === 'function') renderManKPIs();
        if (typeof renderManTable === 'function') renderManTable();
        if (typeof renderManCharts === 'function') renderManCharts();
        if (typeof renderManRisk === 'function') renderManRisk();
      };

      window.__HAP_V4068_MAN_FILTER_PATCHED__ = true;

      // Reaplica o filtro atual imediatamente, se a aba já estiver montada.
      if (document.getElementById('manFilterInput')) {
        applyManFilter();
      }

      window.HAP_V4068_MAINTENANCE_REALIZED_POLICY = {
        version: VERSION,
        policy2026: 'Faturas',
        policy2027Plus: 'Todas as categorias',
        includesNegativeMonthlyMovements: true
      };
      return true;
    } catch (err) {
      console.warn('[HAPCAPEX V40.0.68] Não foi possível aplicar a correção do filtro de Manutenção.', err);
      return false;
    }
  }

  function boot() {
    if (patchMaintenanceFilter()) return;
    timer = setInterval(() => {
      attempts += 1;
      if (patchMaintenanceFilter() || attempts >= 120) {
        clearInterval(timer);
        timer = null;
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
