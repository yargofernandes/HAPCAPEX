/* HAPCAPEX V40.0.53 — Registrar aporte apenas no KPI, sem planejamento
   Caso de uso: O.I. mãe recebe aporte extra, mas o valor é redistribuído
   para outras O.I.s que terão seus próprios planejamentos na Curva.
*/
(() => {
  'use strict';

  if (window.__HAP_V40053_KPI_ONLY_NO_PLAN__) return;
  window.__HAP_V40053_KPI_ONLY_NO_PLAN__ = true;

  const VERSION = '40.0.53';

  function norm(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function moneyFromText(text) {
    const matches = String(text || '').match(/R\$\s*[\d.]+,\d{2}/g) || [];
    return matches[0] || '';
  }

  function getOi(text) {
    const matches = String(text || '').match(/\b50\d{6}\b/g) || [];
    return matches[0] || '';
  }

  function findCard(button) {
    let el = button.parentElement;

    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
      const text = norm(el.textContent);
      const oi = getOi(el.textContent);

      if (
        oi &&
        (text.includes('AGUARDANDO PLANEJAMENTO') ||
         text.includes('PLANEJAR NA CURVA')) &&
        el.querySelectorAll('button').length >= 1
      ) {
        return el;
      }
    }

    return button.parentElement;
  }

  function hasKpiButton(card) {
    return [...card.querySelectorAll('button')].some(btn =>
      norm(btn.textContent).includes('REGISTRAR SO NO KPI') ||
      norm(btn.textContent).includes('REGISTRAR SÓ NO KPI')
    );
  }

  async function registerOnlyKpi(card, button) {
    const oi = getOi(card.textContent);
    const value = moneyFromText(card.textContent);
    const title = [...card.querySelectorAll('strong,b,h1,h2,h3,h4')]
      .map(el => String(el.textContent || '').trim())
      .find(Boolean) || '';

    if (!oi) {
      alert('Não foi possível identificar a O.I. deste aporte.');
      return;
    }

    const ok = confirm(
      `Registrar o aporte da O.I. ${oi} apenas no KPI de Aportes Extras da Curva?\n\n` +
      (title ? `Obra: ${title}\n` : '') +
      (value ? `Valor: ${value}\n\n` : '\n') +
      'Esta opção NÃO cria obra na Curva, NÃO cria fluxo previsto e NÃO altera ' +
      'o CAPEX de nenhuma outra O.I.\n\n' +
      'Use-a quando o aporte original deve ser reconhecido gerencialmente, mas ' +
      'seu recurso será distribuído para outras O.I.s.'
    );

    if (!ok) return;

    const old = button.textContent;
    button.disabled = true;
    button.textContent = 'Registrando...';

    try {
      if (typeof sb === 'undefined') throw new Error('Supabase indisponível.');

      const { data, error } = await sb.rpc(
        'registrar_aporte_kpi_sem_planejamento_v4053',
        { p_ordem_interna: oi }
      );

      if (error) throw error;

      const result = data || {};
      const amount = Number(result.valor_kpi || 0).toLocaleString('pt-BR', {
        style:'currency', currency:'BRL',
        minimumFractionDigits:2, maximumFractionDigits:2
      });

      const planButtons = [...card.querySelectorAll('button')]
        .filter(btn => norm(btn.textContent).includes('PLANEJAR NA CURVA'));

      button.textContent = '✓ Registrado no KPI';
      button.disabled = true;
      button.classList.remove('btn-secondary');
      button.classList.add('btn-primary');

      let badge = card.querySelector('[data-v4053-kpi-badge]');
      if (!badge) {
        badge = document.createElement('span');
        badge.dataset.v4053KpiBadge = '1';
        badge.style.cssText =
          'display:inline-flex;margin:6px 0;padding:4px 8px;border-radius:999px;' +
          'background:#e1f5ee;color:#126b37;font-size:9px;font-weight:800;';
        badge.textContent = 'Aporte reconhecido no KPI · sem planejamento';
        const actionArea = button.parentElement;
        actionArea?.parentElement?.insertBefore(badge, actionArea);
      }

      // A decisão "só no KPI" não obriga apagar a possibilidade de planejar
      // futuramente. Mantemos o botão de planejamento disponível, mas sinalizamos
      // que o aporte já foi reconhecido gerencialmente.
      planButtons.forEach(btn => {
        btn.title =
          'O aporte já está no KPI. Planejar futuramente criará apenas a linha/fluxo da obra.';
      });

      alert(
        `Aporte registrado no KPI com sucesso.\n\n` +
        `O.I.: ${oi}\n` +
        `Valor reconhecido: ${amount}\n\n` +
        `Nenhuma obra ou fluxo da Curva foi criado ou alterado.`
      );

      try {
        if (typeof refreshCurrent === 'function') {
          setTimeout(() => refreshCurrent(), 50);
        }
      } catch (_) {}
    } catch (err) {
      console.error('[HAPCAPEX V40.0.53] Falha ao registrar KPI sem planejamento', err);
      button.disabled = false;
      button.textContent = old;

      alert(
        'Não foi possível registrar o aporte apenas no KPI.\n\n' +
        (err?.message || String(err))
      );
    }
  }

  function decorate() {
    const buttons = [...document.querySelectorAll('button')].filter(btn =>
      norm(btn.textContent).includes('PLANEJAR NA CURVA')
    );

    buttons.forEach(planButton => {
      const card = findCard(planButton);
      if (!card || hasKpiButton(card)) return;

      const oi = getOi(card.textContent);
      if (!oi) return;

      const actions = planButton.parentElement;
      if (!actions) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.dataset.v4053KpiOnly = '1';
      button.textContent = 'Registrar só no KPI';
      button.title =
        'Reconhece o aporte no KPI/histórico da Curva sem criar planejamento.';

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void registerOnlyKpi(card, button);
      });

      actions.insertBefore(button, planButton);
    });
  }

  function start() {
    decorate();

    const observer = new MutationObserver(decorate);
    observer.observe(document.documentElement, {
      childList:true,
      subtree:true
    });

    window.HAP_V40053_KPI_ONLY_NO_PLAN = {
      version: VERSION,
      refresh: decorate
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
