/* HAPCAPEX V40.0.52 — Aporte Extra consolidado em pacote: registrar no KPI
   Regra:
   - O CAPEX já incorporado ao pacote NÃO é somado novamente.
   - A ação registra apenas a natureza gerencial do aporte no KPI/histórico da Curva.
   - Backend: registrar_aporte_pacote_kpi_v4052.
*/
(() => {
  'use strict';

  if (window.__HAP_V40052_PACKAGE_APORTE_KPI__) return;
  window.__HAP_V40052_PACKAGE_APORTE_KPI__ = true;

  const VERSION = '40.0.52';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style:'currency', currency:'BRL',
      minimumFractionDigits:2, maximumFractionDigits:2
    });
  }

  function isAdmin() {
    try {
      return state?.role === 'admin';
    } catch (_) {
      return false;
    }
  }

  function planningTable() {
    return [...document.querySelectorAll('.table-card table')].find(table => {
      const text = String(table.tHead?.textContent || '').toUpperCase();
      return text.includes('O.I.') &&
             text.includes('APORTES PENDENTES') &&
             text.includes('CURVA') &&
             text.includes('AÇÕES');
    }) || null;
  }

  function getRowOi(row) {
    return String(row?.cells?.[0]?.textContent || '')
      .replace(/[^\d]/g, '')
      .trim();
  }

  function getPendingValue(row) {
    const text = String(row?.cells?.[4]?.textContent || '');
    const m = text.match(/R\$\s*([\d.]+,\d{2})/i);
    if (!m) return null;
    const n = Number(m[1].replace(/\./g,'').replace(',','.'));
    return Number.isFinite(n) ? n : null;
  }

  function getPackageName(row) {
    const workCell = row?.cells?.[1];
    if (!workCell) return '';
    const small = workCell.querySelector('small');
    if (small) {
      return String(small.textContent || '')
        .replace(/^Destino:\s*/i,'')
        .trim();
    }
    return '';
  }

  function isPackagePendingRow(row) {
    if (!row?.cells?.length) return false;
    const reason = String(row.cells[2]?.textContent || '').toUpperCase();
    return reason.includes('APORTE') && reason.includes('PACOTE');
  }

  async function registerKpiOnly(button, row) {
    if (!isAdmin()) return;

    const oi = getRowOi(row);
    const value = getPendingValue(row);
    const packageName = getPackageName(row) || 'pacote selecionado';

    if (!oi) {
      alert('Não foi possível identificar a O.I. desta linha.');
      return;
    }

    const valueText = value === null ? 'o aporte pendente' : money(value);

    const ok = window.confirm(
      `Registrar ${valueText} da O.I. ${oi} no KPI de Aportes Extras?\n\n` +
      `Destino: ${packageName}\n\n` +
      'Use esta opção SOMENTE quando o valor já estiver incorporado ao CAPEX do pacote.\n\n' +
      'Esta ação NÃO aumentará o CAPEX do pacote. Ela apenas registrará o aporte ' +
      'no KPI/histórico da Curva e encerrará a pendência.'
    );

    if (!ok) return;

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Registrando...';

    try {
      if (typeof sb === 'undefined') throw new Error('Supabase indisponível.');

      const { data, error } = await sb.rpc(
        'registrar_aporte_pacote_kpi_v4052',
        { p_ordem_interna: oi }
      );

      if (error) throw error;

      const result = data || {};
      const amount = Number(result.valor_kpi || value || 0);

      alert(
        `Aporte registrado no KPI com sucesso.\n\n` +
        `O.I.: ${oi}\n` +
        `Valor no KPI: ${money(amount)}\n` +
        `Pacote: ${result.pacote_nome || packageName}\n\n` +
        `CAPEX do pacote preservado: ${money(result.capex_pacote_preservado || 0)}`
      );

      // A lista "Obras a Planejar" é uma renderização do backend.
      // Reabre a própria aba para buscar o estado atualizado.
      const planningNav = [...document.querySelectorAll('.nav-pill')]
        .find(el => String(el.textContent || '').toUpperCase().includes('OBRAS A PLANEJAR'));

      if (planningNav) {
        planningNav.click();
      } else if (typeof refreshCurrent === 'function') {
        await refreshCurrent();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('[HAPCAPEX V40.0.52] Falha ao registrar aporte de pacote no KPI', err);
      alert(
        'Não foi possível registrar o aporte no KPI.\n\n' +
        (err?.message || String(err))
      );
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function decorate() {
    const table = planningTable();
    if (!table || !isAdmin()) return;

    [...(table.tBodies?.[0]?.rows || [])].forEach(row => {
      if (!isPackagePendingRow(row)) return;

      const actionCell = row.cells[row.cells.length - 1];
      if (!actionCell) return;

      const actions = actionCell.querySelector('.v4023-plan-actions') || actionCell;

      if (actions.querySelector('[data-v4052-package-kpi]')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary';
      button.dataset.v4052PackageKpi = '1';
      button.textContent = 'Registrar no KPI';
      button.title =
        'Registra o aporte no KPI/histórico sem somar novamente ao CAPEX do pacote.';

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void registerKpiOnly(button, row);
      });

      const existing = actions.querySelector('.v4023-open-aportes');
      if (existing) existing.insertAdjacentElement('afterend', button);
      else actions.prepend(button);
    });

    const note = document.querySelector('.v4023-plan-note');
    if (note && !document.getElementById('v4052-package-kpi-note')) {
      const extra = document.createElement('div');
      extra.id = 'v4052-package-kpi-note';
      extra.style.cssText =
        'margin-top:7px;padding-top:7px;border-top:1px solid #c7d8ee;' +
        'font-size:9.5px;line-height:1.45;';
      extra.innerHTML =
        '<strong>Aporte consolidado em pacote:</strong> quando o CAPEX já tiver sido ' +
        'incorporado ao pacote, use <strong>Registrar no KPI</strong>. O valor entra no ' +
        'histórico de Aportes Extras sem ser somado novamente ao CAPEX do pacote.';
      note.appendChild(extra);
    }
  }

  function start() {
    decorate();

    const app = document.getElementById('app');
    if (!app) {
      setTimeout(start, 120);
      return;
    }

    const observer = new MutationObserver(() => decorate());
    observer.observe(app, { childList:true, subtree:true });

    window.HAP_V40052_PACKAGE_APORTE_KPI = {
      version: VERSION,
      refresh: decorate
    };
  }

  start();
})();
