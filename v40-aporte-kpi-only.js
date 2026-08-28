/* HAPCAPEX V40.0.66 — Aporte operacional nos KPIs sem criar obra/fluxo na Curva
   - Terceira opção no aporte operacional: Controle + KPI da Curva, sem planejamento.
   - Nome da obra preenchido automaticamente a partir da O.I.
   - Pendências V36 podem ser encerradas individualmente como KPI sem Curva.
*/
(() => {
  'use strict';

  if (window.__HAP_V4066_APORTE_KPI_ONLY__) return;
  window.__HAP_V4066_APORTE_KPI_ONLY__ = true;

  const VERSION = '40.0.66';
  const oiCache = new Map();
  const timers = new WeakMap();

  function norm(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style:'currency', currency:'BRL',
      minimumFractionDigits:2, maximumFractionDigits:2
    });
  }

  function isAdmin() {
    try {
      if (typeof currentProfile !== 'undefined' && currentProfile) return currentProfile.role === 'admin';
    } catch (_) {}
    try {
      return window.HAP_DATA?.currentProfile?.role === 'admin' || window.HAP_V35?.profile?.role === 'admin';
    } catch (_) {
      return false;
    }
  }

  function operationalModal(backdrop) {
    const box = backdrop?.querySelector('.modal-box');
    return box && norm(box.querySelector('h2')?.textContent) === 'REGISTRAR APORTE OPERACIONAL' ? box : null;
  }

  function setError(box, message, ok=false) {
    const target = box?.querySelector('#v36-entry-error');
    if (!target) return;
    target.innerHTML = message
      ? `<div class="${ok ? 'success-msg' : 'error-msg'}">${String(message).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`
      : '';
  }

  async function lookupOi(oi, force=false) {
    const key = String(oi || '').replace(/\D/g,'').trim();
    if (!/^\d{8}$/.test(key)) return { existe:false };
    if (!force && oiCache.has(key)) return oiCache.get(key);
    if (typeof sb === 'undefined') throw new Error('Supabase indisponível.');
    const { data, error } = await sb.rpc('buscar_obra_por_oi', { p_ordem_interna:key });
    if (error) throw error;
    const result = data || { existe:false };
    oiCache.set(key, result);
    return result;
  }

  async function autofillWorkName(box, force=false) {
    const oiInput = box?.querySelector('#v36-a-oi');
    const nameInput = box?.querySelector('#v36-a-nome');
    if (!oiInput || !nameInput) return { existe:false };

    const oi = String(oiInput.value || '').replace(/\D/g,'').trim();
    if (!/^\d{8}$/.test(oi)) return { existe:false };

    const lookupSeq = String((Number(box.dataset.v4066LookupSeq || 0) + 1));
    box.dataset.v4066LookupSeq = lookupSeq;
    const info = await lookupOi(oi, force);

    if (box.dataset.v4066LookupSeq !== lookupSeq) return info;
    if (String(oiInput.value || '').replace(/\D/g,'').trim() !== oi) return info;

    if (info?.existe && String(info.nome || '').trim()) {
      const canonicalName = String(info.nome).trim();
      const manual = nameInput.dataset.v4066Manual === '1';
      if (force || !manual || !String(nameInput.value || '').trim()) {
        nameInput.value = canonicalName;
        nameInput.dataset.v4066AutoName = canonicalName;
        nameInput.dataset.v4066AutoOi = oi;
        nameInput.dataset.v4066Manual = '0';
      }
      nameInput.placeholder = 'Preenchido automaticamente pela O.I.';
      nameInput.title = `Nome localizado no cadastro da O.I. ${oi}`;
    }
    return info;
  }

  function bindAutofill(box) {
    const oiInput = box?.querySelector('#v36-a-oi');
    const nameInput = box?.querySelector('#v36-a-nome');
    if (!oiInput || !nameInput || oiInput.dataset.v4066AutofillBound === '1') return;
    oiInput.dataset.v4066AutofillBound = '1';

    nameInput.placeholder = 'Preenchido automaticamente pela O.I.';
    nameInput.addEventListener('input', () => {
      nameInput.dataset.v4066Manual = '1';
    });

    oiInput.addEventListener('input', () => {
      const oi = String(oiInput.value || '').replace(/\D/g,'').trim();
      const previous = oiInput.dataset.v4066LastOi || '';
      if (previous && previous !== oi) {
        nameInput.value = '';
        nameInput.dataset.v4066Manual = '0';
        delete nameInput.dataset.v4066AutoName;
        delete nameInput.dataset.v4066AutoOi;
      }
      oiInput.dataset.v4066LastOi = oi;

      const oldTimer = timers.get(oiInput);
      if (oldTimer) clearTimeout(oldTimer);
      if (!/^\d{8}$/.test(oi)) return;
      timers.set(oiInput, setTimeout(() => {
        void autofillWorkName(box).catch(err => console.warn('[HAPCAPEX V40.0.66] Falha no preenchimento automático do nome', err));
      }, 180));
    });

    if (/^\d{8}$/.test(String(oiInput.value || '').replace(/\D/g,'').trim())) {
      void autofillWorkName(box).catch(() => {});
    }
  }

  function readForm(box) {
    return {
      oi: String(box?.querySelector('#v36-a-oi')?.value || '').replace(/\D/g,'').trim(),
      value: Number(box?.querySelector('#v36-a-valor')?.value || 0),
      mes: String(box?.querySelector('#v36-a-mes')?.value || '').trim(),
      name: String(box?.querySelector('#v36-a-nome')?.value || '').trim(),
      obs: String(box?.querySelector('#v36-a-obs')?.value || '').trim()
    };
  }

  function validateForm(aporte, box) {
    if (!/^\d{8}$/.test(aporte.oi)) {
      setError(box, 'Informe uma O.I. válida com 8 dígitos.');
      return false;
    }
    if (!/^\d{4}-\d{2}$/.test(aporte.mes)) {
      setError(box, 'Informe o mês do aporte.');
      return false;
    }
    if (!Number.isFinite(aporte.value) || aporte.value <= 0) {
      setError(box, 'Informe um valor maior que zero.');
      return false;
    }
    return true;
  }

  function setOperationalBusy(box, busy, activeButton) {
    ['#v4066-kpi-only','#v374-save-later','#v36-a-next'].forEach(selector => {
      const button = box?.querySelector(selector);
      if (button) button.disabled = busy;
    });
    if (activeButton) activeButton.textContent = busy ? 'Registrando...' : (activeButton.dataset.v4066Label || 'Registrar nos KPIs · sem Curva');
  }

  async function refreshAfterChange() {
    try {
      if (window.HAP_V36) window.HAP_V36.loading = null;
    } catch (_) {}
    if (typeof refreshCurrent === 'function') {
      await refreshCurrent();
      return;
    }
    window.location.reload();
  }

  async function registerOperationalKpiOnly(backdrop, box, button) {
    if (!isAdmin()) return;
    setError(box, '');

    let aporte = readForm(box);
    if (!validateForm(aporte, box)) return;

    setOperationalBusy(box, true, button);
    try {
      const info = await autofillWorkName(box, true);
      if (!info?.existe) throw new Error('O.I. não encontrada no cadastro do exercício atual.');
      aporte = readForm(box);
      if (!aporte.name) aporte.name = String(info.nome || '').trim();

      const ok = window.confirm(
        `Registrar este aporte sem criar obra ou fluxo na Curva?\n\n` +
        `O.I.: ${aporte.oi}\n` +
        `Obra: ${aporte.name || info.nome || '—'}\n` +
        `Valor: ${money(aporte.value)}\n\n` +
        `O que será feito:\n` +
        `• o Montante e o Saldo da O.I. serão aumentados no Controle de Capex;\n` +
        `• o aporte aparecerá no KPI Aportes Extras do Controle e da Curva;\n` +
        `• a O.I. ficará marcada como “Não participa da Curva”;\n` +
        `• nenhuma obra, data, regra ou fluxo mensal será criado na Curva.`
      );
      if (!ok) {
        setOperationalBusy(box, false, button);
        return;
      }

      const { data, error } = await sb.rpc('registrar_aporte_operacional_kpi_sem_planejamento_v4066', {
        p_ordem_interna: aporte.oi,
        p_valor: aporte.value,
        p_mes: aporte.mes,
        p_nome: aporte.name || null,
        p_observacao: aporte.obs || null
      });
      if (error) throw error;

      backdrop.remove();
      await refreshAfterChange();
      window.alert(
        `Aporte registrado com sucesso.\n\n` +
        `O.I.: ${data?.ordem_interna || aporte.oi}\n` +
        `Valor: ${money(data?.valor_kpi || aporte.value)}\n\n` +
        `O Controle e os KPIs foram atualizados sem criar planejamento na Curva.`
      );
    } catch (err) {
      console.error('[HAPCAPEX V40.0.66] Falha ao registrar aporte nos KPIs sem Curva', err);
      setOperationalBusy(box, false, button);
      setError(box, err?.message || String(err));
    }
  }

  function decorateChoiceModal(backdrop) {
    const box = backdrop?.querySelector('.modal-box');
    if (!box || norm(box.querySelector('h2')?.textContent) !== 'APORTE EXTRA') return;

    const sub = box.querySelector('p.sub');
    if (sub && sub.dataset.v4066Patched !== '1') {
      sub.dataset.v4066Patched = '1';
      sub.textContent = 'Escolha como o aporte entra no Controle. No aporte operacional, você poderá planejar a Curva agora, depois ou registrar somente nos KPIs sem criar obra/fluxo na Curva.';
    }

    const operational = box.querySelector('#v36-aporte-operacional');
    const effect = operational?.querySelector('.v35-choice-effect');
    if (effect && effect.dataset.v4066Patched !== '1') {
      effect.dataset.v4066Patched = '1';
      effect.textContent = 'Atualiza o Controle e, na próxima etapa, você escolhe se haverá planejamento ou somente registro no KPI da Curva.';
    }
  }

  function decorateOperationalModal(backdrop) {
    const box = operationalModal(backdrop);
    if (!box) return;
    bindAutofill(box);

    const note = box.querySelector('.v374-plan-later-note');
    if (note && note.dataset.v4066Patched !== '1') {
      note.dataset.v4066Patched = '1';
      note.innerHTML = '<strong>Destino do aporte:</strong> escolha entre planejar agora, planejar depois ou <strong>registrar somente nos KPIs sem criar obra/fluxo na Curva</strong>.';
    }

    const actions = box.querySelector('#v36-a-next')?.closest('.modal-actions');
    if (!actions) return;
    actions.classList.add('v4066-actions');

    if (!box.querySelector('#v4066-kpi-only')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'v4066-kpi-only';
      button.className = 'btn btn-secondary v4066-kpi-only';
      button.dataset.v4066Label = 'Registrar nos KPIs · sem Curva';
      button.textContent = button.dataset.v4066Label;
      button.title = 'Atualiza o Controle e o KPI Aportes Extras da Curva sem criar obra ou fluxo mensal na Curva.';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void registerOperationalKpiOnly(backdrop, box, button);
      });

      const later = box.querySelector('#v374-save-later');
      const next = box.querySelector('#v36-a-next');
      actions.insertBefore(button, later || next || null);
    }
  }

  async function registerPendingMovementKpiOnly(backdrop, row, button) {
    const movementId = button.dataset.movementId;
    if (!movementId) return;
    const title = String(row?.querySelector('.v36-queue-main strong')?.textContent || '').trim();
    const value = String(row?.querySelector('.v36-queue-value')?.textContent || '').trim();
    const ok = window.confirm(
      `Encerrar esta pendência sem planejamento na Curva?\n\n${title}${value ? `\n${value}` : ''}\n\n` +
      `O aporte permanecerá no Controle e será reconhecido no KPI Aportes Extras da Curva, sem criar obra ou fluxo mensal.`
    );
    if (!ok) return;

    const old = button.textContent;
    button.disabled = true;
    button.textContent = 'Registrando...';
    try {
      const { data, error } = await sb.rpc('registrar_aporte_pendente_kpi_sem_planejamento_v4066', {
        p_movimento_id: movementId
      });
      if (error) throw error;
      backdrop.remove();
      await refreshAfterChange();
      window.alert(`Pendência encerrada no KPI sem Curva.\n\nO.I.: ${data?.ordem_interna || '—'}\nValor: ${money(data?.valor_kpi || 0)}`);
    } catch (err) {
      console.error('[HAPCAPEX V40.0.66] Falha ao encerrar pendência no KPI', err);
      button.disabled = false;
      button.textContent = old;
      window.alert('Não foi possível registrar esta pendência somente nos KPIs.\n\n' + (err?.message || String(err)));
    }
  }

  function decoratePendingQueue(backdrop) {
    const box = backdrop?.querySelector('.modal-box');
    if (!box || norm(box.querySelector('h2')?.textContent) !== 'APORTES AGUARDANDO PLANEJAMENTO') return;

    box.querySelectorAll('.v36-queue-item').forEach(row => {
      const plan = row.querySelector('.v36-plan-pending[data-id]');
      if (!plan || row.querySelector('[data-v4066-pending-kpi]')) return;
      const actions = plan.parentElement;
      if (!actions) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.dataset.v4066PendingKpi = '1';
      button.dataset.movementId = plan.dataset.id;
      button.textContent = 'Só nos KPIs · sem Curva';
      button.title = 'Encerra somente este aporte como KPI sem criar planejamento na Curva.';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void registerPendingMovementKpiOnly(backdrop, row, button);
      });
      actions.insertBefore(button, plan);
    });
  }

  function injectStyles() {
    if (document.getElementById('hap-v4066-aporte-kpi-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v4066-aporte-kpi-styles';
    style.textContent = `
      .v4066-actions{flex-wrap:wrap}
      .v4066-actions .v4066-kpi-only{border-color:#80b995;background:#eefaf3;color:#17643a;font-weight:800;white-space:normal;line-height:1.2}
      .v4066-actions .v4066-kpi-only:hover{background:#e2f5e9}
      @media(max-width:720px){.v4066-actions .btn{flex:1 1 46%;min-height:42px}.v4066-actions #v36-a-cancel{flex:0 0 100%}}
      @media(max-width:480px){.v4066-actions .btn{flex:0 0 100%;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function decorate(root=document) {
    if (!isAdmin()) return;
    injectStyles();
    const backdrops = root.matches?.('.modal-backdrop') ? [root] : [...root.querySelectorAll?.('.modal-backdrop') || []];
    backdrops.forEach(backdrop => {
      decorateChoiceModal(backdrop);
      decorateOperationalModal(backdrop);
      decoratePendingQueue(backdrop);
    });
  }

  function start() {
    decorate(document);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node?.nodeType === 1) decorate(node);
        });
      });
      // V37 pode acrescentar os botões/notas dentro de um modal já existente.
      document.querySelectorAll('.modal-backdrop').forEach(decorate);
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });

    window.HAP_V4066_APORTE_KPI_ONLY = {
      version: VERSION,
      refresh: () => decorate(document),
      autofill: autofillWorkName
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
