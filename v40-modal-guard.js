/* HAPCAPEX V40.0.37 — Proteção contra fechamento acidental de formulários.
   Regra:
   - Clique no fundo externo de um modal com formulário NÃO fecha o modal.
   - Fechamento continua permitido apenas por ações explícitas: Cancelar, X, Salvar, Confirmar etc.
   - Atua em fase de captura para neutralizar handlers legados adicionados ao backdrop.
*/
(() => {
  'use strict';
  if (window.__HAP_V4037_MODAL_GUARD__) return;
  window.__HAP_V4037_MODAL_GUARD__ = true;

  function isFormModal(backdrop) {
    if (!backdrop || !backdrop.classList?.contains('modal-backdrop')) return false;
    return !!backdrop.querySelector(
      'form, input, select, textarea, [contenteditable="true"], button[type="submit"]'
    );
  }

  function blockBackdropClose(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Só bloqueia quando o clique ocorreu exatamente no fundo externo.
    if (!target.classList.contains('modal-backdrop')) return;
    if (!isFormModal(target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  // Captura antes dos listeners legados registrados no próprio backdrop.
  document.addEventListener('click', blockBackdropClose, true);

  // Proteção complementar contra implementações futuras em pointerup/mousedown.
  document.addEventListener('pointerup', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.classList.contains('modal-backdrop')) return;
    if (!isFormModal(target)) return;
    event.stopPropagation();
  }, true);

  window.HAP_V40_MODAL_GUARD = {
    version: '40.0.37',
    active: true
  };
})();
