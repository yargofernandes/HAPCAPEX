/* HAPCAPEX V40.0.17 — Estabilidade visual nas trocas de abas */
(() => {
  'use strict';

  if (document.getElementById('hap-v4017-layout-stability')) return;

  const style = document.createElement('style');
  style.id = 'hap-v4017-layout-stability';
  style.textContent = `
    /*
      Mantém a largura útil da página constante quando uma aba passa
      temporariamente de conteúdo curto para conteúdo longo durante o carregamento.
    */
    html {
      scrollbar-gutter: stable;
    }

    @media (min-width: 721px) {
      html {
        overflow-y: scroll;
      }
    }

    /*
      Impede micro deslocamento horizontal causado por arredondamentos de largura
      durante re-renderizações das abas do Controle.
    */
    body {
      width: 100%;
      overflow-x: hidden;
    }

    #app {
      min-width: 0;
    }
  `;
  document.head.appendChild(style);

  window.HAP_V4017_LAYOUT_STABILITY = {
    version: '40.0.17',
    active: true
  };
})();
