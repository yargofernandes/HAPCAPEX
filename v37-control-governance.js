/* HAPCAPEX V37.7 — Governança Financeira, Doações, Auditoria e Notificações
   Controle de Capex: narrativa de KPIs, conciliação, doações e histórico administrativo. */
(() => {
  'use strict';

  const VERSION = '39.7.0';
  const CAPEX_INICIAL_CONTROLE = 306137351.47;
  const OI_BALDE_CONTINGENCIA = '9999999999';

  function injectStyles() {
    if (document.getElementById('hap-v37-styles')) return;
    const style = document.createElement('style');
    style.id = 'hap-v37-styles';
    style.textContent = `
      .v37-kpi-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
      .v37-kpi-grid .kpi-card:nth-child(n+6){border-left-color:var(--azul-claro)}
      .v37-story-arrow{font-size:11px;color:var(--texto-suave);margin-top:5px}
      .v37-recon{display:flex;align-items:center;justify-content:space-between;gap:14px;border-radius:10px;padding:11px 14px;margin-bottom:14px;font-size:11px}
      .v37-recon.ok{background:#e1f5ee;border:1px solid #5dcaa5;color:#04342c}
      .v37-recon.rounding{background:#fff8e6;border:1px solid #f0c98b;color:#68480d}
      .v37-recon.bad{background:#fcebeb;border:1px solid #e4b5b5;color:#791f1f}
      .v37-recon strong{display:block;font-size:12px}.v37-recon small{display:block;margin-top:2px;line-height:1.4}
      .v37-recon button{white-space:nowrap}
      .v37-donation-row,.v37-audit-row{background:#fff;border:1px solid var(--cinza-borda);border-radius:10px;padding:11px 12px;margin-bottom:8px}
      .v37-row-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .v37-row-title{font-size:12px;font-weight:800;color:var(--azul);line-height:1.35}
      .v37-row-meta{font-size:10px;color:var(--texto-suave);margin-top:3px;line-height:1.45}
      .v37-row-value{font-weight:800;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums}
      .v37-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .v37-tag{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:800;margin-right:5px}
      .v37-tag.hist{background:#eef1f5;color:#5d6470}.v37-tag.active{background:#e1f5ee;color:#126b37}.v37-tag.cancel{background:#fcebeb;color:#791f1f}
      .v37-filter-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1.2fr;gap:8px;margin-bottom:12px}
      .v37-filter-grid input,.v37-filter-grid select{width:100%;padding:8px 9px;border:1px solid var(--cinza-borda);border-radius:8px;background:#fff;font:inherit}
      .v37-audit-time{font-size:10px;color:var(--texto-suave);white-space:nowrap}
      .v37-json{margin-top:8px;border-top:1px dashed var(--cinza-borda);padding-top:8px}
      .v37-json summary{cursor:pointer;font-size:10px;font-weight:800;color:var(--azul-medio)}
      .v37-json-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
      .v37-json pre{margin:0;padding:9px;background:var(--cinza-bg);border-radius:8px;font-size:9px;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto}
      .v37-form-note{background:#eef4fc;color:#244b74;padding:9px 10px;border-radius:8px;font-size:10px;line-height:1.45;margin-bottom:12px}
      .v37-danger{color:#a52727!important;border-color:#e4b5b5!important;background:#fffafa!important}
      .v37-formula{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:12px 0}
      .v37-formula > div{background:var(--cinza-bg);border-radius:8px;padding:9px}
      .v37-formula span{display:block;font-size:8px;text-transform:uppercase;font-weight:800;color:var(--texto-suave)}
      .v37-formula strong{display:block;margin-top:4px;font-size:12px;color:var(--azul);white-space:nowrap}
      .v371-bell{position:relative;display:inline-flex;align-items:center;gap:6px}
      .v371-badge{display:inline-flex;min-width:18px;height:18px;padding:0 5px;align-items:center;justify-content:center;border-radius:9px;background:var(--vermelho);color:#fff;font-size:9px;font-weight:800}
      .v371-notif-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0 12px}
      .v371-notif-summary>div{background:var(--cinza-bg);border-radius:9px;padding:9px 10px}.v371-notif-summary span{display:block;font-size:8px;text-transform:uppercase;font-weight:800;color:var(--texto-suave)}.v371-notif-summary strong{display:block;margin-top:3px;font-size:14px;color:var(--azul)}
      .v371-notif-filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.v371-notif-filter{border:1px solid var(--cinza-borda);background:#fff;border-radius:999px;padding:5px 9px;font-size:9px;font-weight:800;cursor:pointer}.v371-notif-filter.active{background:var(--azul-medio);border-color:var(--azul-medio);color:#fff}
      .v371-notif-group{margin-top:13px}.v371-notif-group-title{font-size:10px;font-weight:800;color:var(--azul);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
      .v371-notif{border:1px solid var(--cinza-borda);border-left-width:4px;border-radius:9px;padding:9px 10px;margin-bottom:7px;background:#fff}.v371-notif.unread{box-shadow:0 2px 8px rgba(13,43,78,.08)}.v371-notif.critical{border-left-color:var(--vermelho)}.v371-notif.warning{border-left-color:#e0a020}.v371-notif.info{border-left-color:var(--azul-claro)}
      .v371-notif-head{display:flex;justify-content:space-between;gap:10px}.v371-notif-title{font-size:11px;font-weight:800;color:var(--azul)}.v371-notif-meta{font-size:9px;color:var(--texto-suave);white-space:nowrap}.v371-notif-msg{font-size:10px;color:var(--texto-suave);line-height:1.45;margin-top:3px}.v371-notif-actions{display:flex;justify-content:flex-end;margin-top:6px}
      .v371-donation-panel-list{max-height:52vh;overflow:auto;margin-top:10px}

      .v373-month-group{border:1px solid var(--cinza-borda);border-radius:11px;margin:10px 0 14px;overflow:hidden;background:#fff}
      .v373-month-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:var(--cinza-bg);border-bottom:1px solid var(--cinza-borda);cursor:pointer;user-select:none}
      .v373-month-head:hover{background:#eaf0f8}
      .v374-month-left{display:flex;align-items:center;gap:8px}
      .v374-chevron{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;border-radius:50%;background:#fff;border:1px solid var(--cinza-borda);font-size:10px;color:var(--azul);transition:transform .15s ease}
      .v373-month-group.open .v374-chevron{transform:rotate(90deg)}
      .v373-month-body{display:none}
      .v373-month-group.open .v373-month-body{display:block}
      .v373-month-title{font-size:12px;font-weight:800;color:var(--azul);text-transform:capitalize}
      .v373-month-summary{font-size:10px;color:var(--texto-suave);text-align:right}
      .v373-month-summary strong{display:block;font-size:13px;color:var(--azul);font-variant-numeric:tabular-nums}
      .v373-month-body{padding:0 9px 9px}

      .v373-month-head{cursor:pointer;user-select:none}
      .v373-month-head:hover{background:#eaf0f8}
      .v374-month-left{display:flex;align-items:center;gap:8px}
      .v374-plan-later-note{background:#fff8e6;border:1px solid #f0c98b;color:#68480d;border-radius:8px;padding:9px 10px;font-size:10px;line-height:1.45;margin-top:8px}

      .v373-month-body .v36-movement-row,.v373-month-body .v37-donation-row{margin-top:9px}

      .v375-flow-banner{background:#eef4fc;border:1px solid #c7d8ee;color:#244b74;border-radius:9px;padding:10px 11px;font-size:10px;line-height:1.45;margin-bottom:12px}
      .v375-flow-steps{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
      .v375-flow-step{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;background:#fff;border:1px solid #c7d8ee;font-size:9px;font-weight:800}
      .v375-flow-step.active{background:var(--azul-medio);border-color:var(--azul-medio);color:#fff}
      .v375-create-note{font-size:10px;color:var(--texto-suave);line-height:1.45;margin-top:4px}

      .v376-review-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
      .v376-review-table th{background:var(--cinza-bg);color:var(--azul);padding:8px;text-align:left;border-bottom:1px solid var(--cinza-borda)}
      .v376-review-table td{padding:8px;border-bottom:1px solid var(--cinza-borda);vertical-align:top}
      .v376-review-total{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:12px 13px;border-radius:9px;background:#eef4fc;border:1px solid #c7d8ee}
      .v376-review-total span{font-size:10px;font-weight:800;text-transform:uppercase;color:var(--texto-suave)}
      .v376-review-total strong{font-size:16px;color:var(--azul);font-variant-numeric:tabular-nums}
      .v376-new-oi-alert{background:#fff8e6;border:1px solid #f0c98b;color:#68480d;border-radius:8px;padding:9px 10px;font-size:10px;line-height:1.45;margin:8px 0}
      .v376-flow-line{font-size:10px;color:var(--texto-suave);line-height:1.45}

      .v378-pendency-wrap{display:flex;align-items:center;gap:7px;padding:3px 5px 3px 8px;border:1px solid var(--cinza-borda);border-radius:8px;background:#fff}
      .v378-pendency-wrap label{font-size:9px;font-weight:800;text-transform:uppercase;color:var(--texto-suave);white-space:nowrap}
      .v378-pendency-wrap select{border:none;background:var(--cinza-bg);border-radius:6px;padding:6px 8px;font-size:11px;color:var(--azul);font-weight:700;min-width:210px;outline:none}
      .v378-pendency-count{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:22px;padding:0 7px;border-radius:11px;background:var(--azul-suave);color:var(--azul);font-size:9px;font-weight:800;white-space:nowrap}
      .v378-pendency-reset{border:none;background:transparent;color:var(--azul-medio);font-size:10px;font-weight:800;cursor:pointer;padding:4px 5px}
      @media(max-width:720px){.v378-pendency-wrap{width:100%;flex-wrap:wrap}.v378-pendency-wrap select{flex:1;min-width:180px}}

      .v379-review-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
      .v379-review-grid>div{background:var(--cinza-bg);border-radius:9px;padding:10px 11px;min-width:0}
      .v379-review-grid span{display:block;font-size:8px;font-weight:800;text-transform:uppercase;color:var(--texto-suave)}
      .v379-review-grid strong{display:block;margin-top:4px;font-size:13px;color:var(--azul);font-variant-numeric:tabular-nums}
      .v379-review-flow{display:flex;gap:5px;flex-wrap:wrap;margin:10px 0 12px}
      .v379-review-flow span{padding:5px 8px;border-radius:999px;background:#eef4fc;border:1px solid #c7d8ee;color:#244b74;font-size:9px;font-weight:800}
      .v379-review-table-wrap{max-height:42vh;overflow:auto;border:1px solid var(--cinza-borda);border-radius:9px;margin-top:10px}
      .v379-review-table{width:100%;border-collapse:collapse;font-size:10px;min-width:1000px}
      .v379-review-table th{position:sticky;top:0;z-index:1;background:var(--azul);color:#fff;padding:8px;text-align:left;white-space:nowrap}
      .v379-review-table td{padding:7px 8px;border-bottom:1px solid var(--cinza-borda);white-space:nowrap}
      .v379-delta-up{color:#a52727;font-weight:800}.v379-delta-down{color:#1e8a4a;font-weight:800}
      .v379-warning{background:#fff8e6;border:1px solid #f0c98b;color:#68480d;border-radius:9px;padding:10px 11px;font-size:10px;line-height:1.45;margin:9px 0}
      .v379-danger{background:#fcebeb;border:1px solid #e4b5b5;color:#791f1f;border-radius:9px;padding:10px 11px;font-size:10px;line-height:1.45;margin:9px 0}
      .v379-ok{background:#e1f5ee;border:1px solid #5dcaa5;color:#04342c;border-radius:9px;padding:10px 11px;font-size:10px;line-height:1.45;margin:9px 0}
      @media(max-width:720px){.v379-review-grid{grid-template-columns:1fr 1fr}}


      /* V37.10 — Mobile First: densidade, toque e leitura no PWA instalado */
      body.pwa-mobile #app{padding:8px 8px calc(78px + env(safe-area-inset-bottom,0px))!important;max-width:none!important}
      body.pwa-mobile .kpi-grid,
      body.pwa-mobile .v37-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;margin-bottom:10px!important}
      body.pwa-mobile .kpi-card{padding:9px 9px 8px!important;border-left-width:3px!important;border-radius:9px!important;box-shadow:0 1px 4px rgba(13,43,78,.07)!important;min-height:78px}
      body.pwa-mobile .kpi-card .label{font-size:8px!important;line-height:1.2!important;letter-spacing:.035em!important}
      body.pwa-mobile .kpi-card .value{font-size:14px!important;line-height:1.12!important;margin-top:4px!important;white-space:normal!important;overflow-wrap:anywhere}
      body.pwa-mobile .kpi-card .sub{font-size:8.5px!important;line-height:1.25!important;margin-top:4px!important}
      body.pwa-mobile .v37-story-arrow{font-size:8.5px!important;margin-top:3px!important}
      body.pwa-mobile .toolbar{gap:5px!important;padding:6px!important;margin-bottom:8px!important;border-radius:9px!important}
      body.pwa-mobile .toolbar input[type=text]{min-width:0!important;flex:1 1 100%!important;padding:8px 9px!important;font-size:12px!important}
      body.pwa-mobile .toolbar .btn{min-height:38px;padding:8px 10px!important;flex:1 1 auto}
      body.pwa-mobile .table-card{border-radius:9px!important;max-height:none!important;-webkit-overflow-scrolling:touch}
      body.pwa-mobile .table-card table{font-size:10px!important}
      body.pwa-mobile .table-card thead th{padding:8px 7px!important}
      body.pwa-mobile .table-card tbody td{padding:7px!important}
      body.pwa-mobile .modal-backdrop{padding:0!important;align-items:flex-end!important}
      body.pwa-mobile .modal-box,
      body.pwa-mobile .modal-box.modal-wide,
      body.pwa-mobile .v35-modal-xl{width:100%!important;max-width:100%!important;max-height:92dvh!important;border-radius:17px 17px 0 0!important;padding:15px 14px calc(12px + env(safe-area-inset-bottom,0px))!important}
      body.pwa-mobile .modal-box h2{font-size:16px!important}
      body.pwa-mobile .modal-box .sub{font-size:11px!important;margin-bottom:11px!important}
      body.pwa-mobile .modal-actions{position:sticky!important;bottom:calc(-12px - env(safe-area-inset-bottom,0px));z-index:5;background:linear-gradient(to bottom,rgba(255,255,255,.92),#fff 28%);margin:13px -14px -12px!important;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px))!important;gap:7px!important}
      body.pwa-mobile .modal-actions .btn{min-height:42px!important;padding:9px 11px!important;flex:1 1 0!important}
      body.pwa-mobile .grid-2,
      body.pwa-mobile .grid-3{grid-template-columns:1fr!important;gap:8px!important}
      body.pwa-mobile .field{margin-bottom:10px!important}
      body.pwa-mobile .field label{font-size:9px!important}
      body.pwa-mobile .field input,
      body.pwa-mobile .field select,
      body.pwa-mobile .field textarea{font-size:16px!important;padding:9px 10px!important}
      body.pwa-mobile .history-summary,
      body.pwa-mobile .v35-summary-grid,
      body.pwa-mobile .v371-notif-summary,
      body.pwa-mobile .v379-review-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
      body.pwa-mobile .history-summary>div,
      body.pwa-mobile .v35-summary-card,
      body.pwa-mobile .v371-notif-summary>div,
      body.pwa-mobile .v379-review-grid>div{padding:8px 9px!important}
      body.pwa-mobile .history-summary span,
      body.pwa-mobile .v35-summary-card span{font-size:8px!important}
      body.pwa-mobile .history-summary strong,
      body.pwa-mobile .v35-summary-card strong{font-size:12px!important}
      body.pwa-mobile .history-section-title{font-size:10px!important;margin-top:11px!important;padding-bottom:6px!important}
      body.pwa-mobile .v35-identity-list{gap:7px!important;margin-top:9px!important}
      body.pwa-mobile .v35-identity-item{padding:9px!important}
      body.pwa-mobile .v35-identity-year{gap:6px 10px!important;font-size:9px!important}
      body.pwa-mobile .v373-month-group{margin:7px 0 9px!important;border-radius:9px!important}
      body.pwa-mobile .v373-month-head{padding:9px 10px!important;gap:8px!important}
      body.pwa-mobile .v373-month-title{font-size:11px!important}
      body.pwa-mobile .v373-month-summary{font-size:8.5px!important}
      body.pwa-mobile .v373-month-summary strong{font-size:11px!important}
      body.pwa-mobile .v373-month-body{padding:0 7px 7px!important}
      body.pwa-mobile .v37-donation-row,
      body.pwa-mobile .v37-audit-row,
      body.pwa-mobile .v36-movement-row{padding:9px!important;margin-bottom:6px!important}
      body.pwa-mobile .v378-pendency-wrap{width:100%!important;gap:5px!important;padding:5px 6px!important}
      body.pwa-mobile .v378-pendency-wrap select{min-width:0!important;flex:1!important;font-size:10px!important;padding:7px!important}
      body.pwa-mobile .v379-review-table-wrap{max-height:48dvh!important}
      body.pwa-mobile .v379-review-table{font-size:9px!important}
      body.pwa-mobile .v371-notif-filters{gap:5px!important;margin-bottom:8px!important}
      body.pwa-mobile .v371-notif-filter{padding:5px 8px!important;font-size:8.5px!important}
      @media(max-width:360px){
        body.pwa-mobile .kpi-card .value{font-size:13px!important}
        body.pwa-mobile .history-summary,
        body.pwa-mobile .v35-summary-grid,
        body.pwa-mobile .v371-notif-summary,
        body.pwa-mobile .v379-review-grid{grid-template-columns:1fr 1fr!important}
      }


      /* ==========================================================
         V38 — MOBILE COMPLETO / CONTROLE DE CAPEX
         Camada responsiva sem alterar regras financeiras.
         ========================================================== */
      .v380-control-dock,.v380-more-overlay,.v380-more-sheet,.v380-swipe-hint{display:none}
      body.hap-mobile-v38{overscroll-behavior-y:none;-webkit-tap-highlight-color:transparent}
      body.hap-mobile-v38 #app{padding:8px 8px calc(82px + env(safe-area-inset-bottom,0px))!important;max-width:none!important}
      body.hap-mobile-v38 header.topbar{position:sticky;top:0;z-index:38;background:rgba(244,246,250,.96);backdrop-filter:blur(12px);margin:0 -8px 8px!important;padding:8px 10px!important;border-bottom:1px solid var(--cinza-borda);gap:8px}
      body.hap-mobile-v38 .brand-eyebrow{font-size:8px!important}
      body.hap-mobile-v38 .brand-title{font-size:16px!important;line-height:1.1}
      body.hap-mobile-v38 .user-chip{gap:5px!important;font-size:9px!important;min-width:0}
      body.hap-mobile-v38 .user-chip .role-badge{font-size:8px!important;padding:2px 6px!important}
      body.hap-mobile-v38 .v35-exercise-chip{font-size:8px!important;padding:4px 6px!important}
      body.hap-mobile-v38 .v371-bell{min-width:40px;min-height:40px;justify-content:center}
      body.hap-mobile-v38 .v380-original-nav{display:none!important}

      body.hap-mobile-v38 .kpi-grid,
      body.hap-mobile-v38 .v37-kpi-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;margin-bottom:9px!important}
      body.hap-mobile-v38 .kpi-card{padding:8px 9px!important;min-height:74px!important;border-left-width:3px!important;border-radius:10px!important;box-shadow:0 1px 5px rgba(13,43,78,.07)!important}
      body.hap-mobile-v38 .kpi-card .label{font-size:8px!important;line-height:1.15!important;letter-spacing:.03em!important}
      body.hap-mobile-v38 .kpi-card .value{font-size:13.5px!important;line-height:1.1!important;margin-top:4px!important;white-space:normal!important;overflow-wrap:anywhere!important}
      body.hap-mobile-v38 .kpi-card .sub{font-size:8px!important;line-height:1.25!important;margin-top:3px!important}
      body.hap-mobile-v38 .v37-story-arrow{font-size:8px!important;margin-top:2px!important}

      body.hap-mobile-v38 .toolbar{position:sticky;top:55px;z-index:28;gap:5px!important;padding:6px!important;margin-bottom:7px!important;border-radius:10px!important;box-shadow:0 2px 10px rgba(13,43,78,.06)}
      body.hap-mobile-v38 .toolbar input[type=text]{flex:1 1 100%!important;min-width:0!important;padding:9px 10px!important;font-size:16px!important}
      body.hap-mobile-v38 .toolbar .btn{min-height:40px!important;padding:8px 10px!important;font-size:10px!important;flex:1 1 auto}
      body.hap-mobile-v38 .v378-pendency-wrap{order:2;width:100%!important;display:grid!important;grid-template-columns:auto 1fr auto;gap:5px!important;padding:5px 6px!important}
      body.hap-mobile-v38 .v378-pendency-wrap select{min-width:0!important;width:100%!important;font-size:11px!important;padding:8px!important}

      body.hap-mobile-v38 .table-card{border-radius:10px!important;max-height:none!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;box-shadow:0 1px 5px rgba(13,43,78,.07)!important}
      body.hap-mobile-v38 .v380-swipe-table{font-size:10px!important}
      body.hap-mobile-v38 .v380-swipe-table thead th{padding:8px 7px!important}
      body.hap-mobile-v38 .v380-swipe-table tbody td{padding:7px!important}
      body.hap-mobile-v38 .v380-swipe-table th:first-child,
      body.hap-mobile-v38 .v380-swipe-table td:first-child{position:sticky!important;left:0;z-index:2;box-shadow:2px 0 5px rgba(13,43,78,.08)}
      body.hap-mobile-v38 .v380-swipe-hint{display:flex;align-items:center;justify-content:center;gap:6px;font-size:8.5px;color:var(--texto-suave);padding:5px 8px;background:#eef4fc;border-bottom:1px solid var(--cinza-borda)}

      body.hap-mobile-v38 table.v380-card-table{display:block!important;min-width:0!important;width:100%!important;background:transparent!important}
      body.hap-mobile-v38 table.v380-card-table thead{display:none!important}
      body.hap-mobile-v38 table.v380-card-table tbody{display:grid!important;gap:7px!important;padding:7px!important}
      body.hap-mobile-v38 table.v380-card-table tbody tr{display:block!important;background:#fff!important;border:1px solid var(--cinza-borda)!important;border-radius:10px!important;overflow:hidden!important;box-shadow:0 1px 3px rgba(13,43,78,.04)!important}
      body.hap-mobile-v38 table.v380-card-table tbody td{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;padding:7px 9px!important;border:0!important;border-bottom:1px solid #eef1f5!important;white-space:normal!important;text-align:right!important;position:static!important;background:#fff!important;color:var(--texto)!important;box-shadow:none!important;min-height:30px}
      body.hap-mobile-v38 table.v380-card-table tbody td:last-child{border-bottom:0!important}
      body.hap-mobile-v38 table.v380-card-table tbody td::before{content:attr(data-v380-label);font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--texto-suave);text-align:left;flex:0 0 38%}
      body.hap-mobile-v38 table.v380-card-table tbody td:first-child{display:block!important;text-align:left!important;font-size:11px!important;font-weight:800!important;color:var(--azul)!important;padding:9px!important;background:#f7f9fc!important}
      body.hap-mobile-v38 table.v380-card-table tbody td:first-child::before{display:none!important}
      body.hap-mobile-v38 table.v380-card-table .btn{min-height:36px;padding:7px 9px;font-size:9px}

      body.hap-mobile-v38 .modal-backdrop{padding:0!important;align-items:flex-end!important;z-index:1200!important}
      body.hap-mobile-v38 .modal-box,
      body.hap-mobile-v38 .modal-box.modal-wide,
      body.hap-mobile-v38 .v35-modal-xl{width:100%!important;max-width:100%!important;max-height:94dvh!important;border-radius:18px 18px 0 0!important;padding:14px 13px calc(12px + env(safe-area-inset-bottom,0px))!important;box-shadow:0 -10px 32px rgba(13,43,78,.18)!important}
      body.hap-mobile-v38 .modal-box::before{content:'';display:block;width:38px;height:4px;border-radius:999px;background:#d5dbe5;margin:-5px auto 10px}
      body.hap-mobile-v38 .modal-box h2{font-size:16px!important;line-height:1.2!important}
      body.hap-mobile-v38 .modal-box .sub{font-size:10px!important;line-height:1.35!important;margin-bottom:10px!important}
      body.hap-mobile-v38 .modal-actions{position:sticky!important;bottom:calc(-12px - env(safe-area-inset-bottom,0px));z-index:8;background:linear-gradient(to bottom,rgba(255,255,255,.92),#fff 28%);margin:12px -13px -12px!important;padding:11px 13px calc(11px + env(safe-area-inset-bottom,0px))!important;gap:6px!important}
      body.hap-mobile-v38 .modal-actions .btn{flex:1 1 0!important;min-height:44px!important;padding:8px!important;font-size:10.5px!important}
      body.hap-mobile-v38 .grid-2,body.hap-mobile-v38 .grid-3{grid-template-columns:1fr!important;gap:7px!important}
      body.hap-mobile-v38 .field{margin-bottom:9px!important}
      body.hap-mobile-v38 .field label{font-size:8.5px!important}
      body.hap-mobile-v38 .field input,body.hap-mobile-v38 .field select,body.hap-mobile-v38 .field textarea{font-size:16px!important;padding:9px 10px!important;min-height:42px}
      body.hap-mobile-v38 .field textarea{min-height:78px}

      body.hap-mobile-v38 .history-summary,
      body.hap-mobile-v38 .v35-summary-grid,
      body.hap-mobile-v38 .v371-notif-summary,
      body.hap-mobile-v38 .v379-review-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin:8px 0 10px!important}
      body.hap-mobile-v38 .history-summary>div,
      body.hap-mobile-v38 .v35-summary-card,
      body.hap-mobile-v38 .v371-notif-summary>div,
      body.hap-mobile-v38 .v379-review-grid>div{padding:8px!important;border-radius:8px!important}
      body.hap-mobile-v38 .history-summary span,body.hap-mobile-v38 .v35-summary-card span{font-size:7.5px!important}
      body.hap-mobile-v38 .history-summary strong,body.hap-mobile-v38 .v35-summary-card strong{font-size:11.5px!important;white-space:normal!important}
      body.hap-mobile-v38 .v35-identity-item{padding:8px!important;border-radius:8px!important}
      body.hap-mobile-v38 .v35-identity-year{font-size:9px!important;gap:5px 9px!important}
      body.hap-mobile-v38 .v373-month-group{margin:6px 0 8px!important;border-radius:9px!important}
      body.hap-mobile-v38 .v373-month-head{padding:9px!important}
      body.hap-mobile-v38 .v373-month-title{font-size:10.5px!important}
      body.hap-mobile-v38 .v373-month-summary{font-size:8px!important}
      body.hap-mobile-v38 .v373-month-summary strong{font-size:10.5px!important}
      body.hap-mobile-v38 .v37-donation-row,body.hap-mobile-v38 .v37-audit-row,body.hap-mobile-v38 .v36-movement-row{padding:8px!important;margin-bottom:6px!important;border-radius:8px!important}
      body.hap-mobile-v38 .v37-row-title,body.hap-mobile-v38 .v36-movement-title{font-size:10.5px!important}
      body.hap-mobile-v38 .v37-row-value,body.hap-mobile-v38 .v36-movement-value{font-size:11.5px!important}
      body.hap-mobile-v38 .v37-actions .btn,body.hap-mobile-v38 .v36-movement-actions .btn{min-height:36px;padding:7px 9px;font-size:9px;flex:1 1 auto}
      body.hap-mobile-v38 .v371-notif{padding:8px!important;margin-bottom:5px!important}
      body.hap-mobile-v38 .v371-notif-title{font-size:10px!important}
      body.hap-mobile-v38 .v371-notif-msg{font-size:9px!important}
      body.hap-mobile-v38 .v371-notif-filter{min-height:34px;padding:6px 8px!important}
      body.hap-mobile-v38 .v379-review-table-wrap{max-height:52dvh!important;margin-left:-4px;margin-right:-4px}
      body.hap-mobile-v38 .v379-review-table{font-size:8.5px!important}

      body.hap-mobile-v38 .v380-control-dock{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);left:0;right:0;bottom:0;z-index:1000;padding:5px 5px max(6px,env(safe-area-inset-bottom));background:rgba(255,255,255,.97);border-top:1px solid #d9e1ec;box-shadow:0 -5px 18px rgba(13,43,78,.10);backdrop-filter:blur(12px)}
      .v380-control-dock button{border:0;background:transparent;color:#718096;border-radius:11px;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 2px;font:inherit}
      .v380-control-dock button .v380-icon{font-size:18px;line-height:1}
      .v380-control-dock button small{font-size:8px;font-weight:800;white-space:nowrap}
      .v380-control-dock button.active{background:#e8f0fb;color:var(--azul-medio)}
      body.hap-mobile-v38 .v380-more-overlay{display:block;position:fixed;z-index:1090;inset:0;background:rgba(5,20,38,.45);opacity:0;pointer-events:none;transition:.18s}
      body.hap-mobile-v38 .v380-more-overlay.open{opacity:1;pointer-events:auto}
      body.hap-mobile-v38 .v380-more-sheet{display:block;position:fixed;z-index:1100;left:0;right:0;bottom:0;background:#fff;border-radius:18px 18px 0 0;box-shadow:0 -12px 38px rgba(13,43,78,.22);padding:8px 12px calc(14px + env(safe-area-inset-bottom));transform:translateY(110%);transition:transform .2s ease}
      body.hap-mobile-v38 .v380-more-sheet.open{transform:translateY(0)}
      .v380-sheet-handle{width:38px;height:4px;border-radius:99px;background:#d5dbe5;margin:2px auto 10px}
      .v380-sheet-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.v380-sheet-title strong{font-size:13px;color:var(--azul)}
      .v380-sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.v380-sheet-grid button{min-height:50px;border:1px solid var(--cinza-borda);background:#f8fafc;border-radius:10px;color:var(--azul);font-size:10px;font-weight:800;padding:8px}
      .v380-sheet-grid button:active{transform:scale(.985);background:#eef4fc}

      @media(max-width:350px){body.hap-mobile-v38 .kpi-card .value{font-size:12.5px!important}.v380-control-dock button small{font-size:7.5px}}



      /* V38.2 — Lista de OIs mobile em padrão master-detail, sem tabela horizontal */
      body.hap-mobile-v38 .v382-capex-smart-wrap{overflow:visible!important;background:transparent!important;box-shadow:none!important;border-radius:0!important}
      body.hap-mobile-v38 table.v382-capex-smart{display:block!important;width:100%!important;min-width:0!important;background:transparent!important;border-collapse:separate!important}
      body.hap-mobile-v38 table.v382-capex-smart thead,
      body.hap-mobile-v38 table.v382-capex-smart tfoot{display:none!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody{display:grid!important;gap:8px!important;width:100%!important;padding:0!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody tr{display:grid!important;grid-template-columns:84px repeat(12,minmax(0,1fr))!important;grid-template-areas:'oi obra obra obra obra obra obra obra obra obra obra obra obra' 'mont mont mont mont comp comp comp comp saldo saldo saldo saldo saldo' 'pct pct pct pct pacote pacote pacote pacote pacote pacote pacote pacote pacote';gap:0!important;width:100%!important;min-width:0!important;background:#fff!important;border:1px solid #dbe4ef!important;border-radius:14px!important;overflow:hidden!important;box-shadow:0 2px 8px rgba(13,43,78,.06)!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody tr:nth-child(even){background:#fff!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td{display:none!important;position:static!important;width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;white-space:normal!important;text-align:left!important;color:var(--texto)!important;overflow:visible!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='oi']{grid-area:oi;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;padding:10px 7px 10px 10px!important;background:#f4f8fd!important;border-right:1px solid #e4ebf4!important;font-size:10px!important;font-weight:900!important;line-height:1.15!important;color:var(--azul)!important;letter-spacing:-.01em!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='oi'] .v35-link-badge{font-size:7.5px!important;line-height:1!important;padding:4px 6px!important;margin:5px 0 0!important;max-width:100%!important;white-space:nowrap!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='obra']{grid-area:obra;display:flex!important;flex-direction:column!important;justify-content:center!important;min-height:58px!important;padding:9px 40px 8px 10px!important;font-size:11.5px!important;font-weight:750!important;line-height:1.28!important;color:var(--azul)!important;position:relative!important;overflow-wrap:anywhere!important}
      body.hap-mobile-v38 .v382-detail-toggle{position:absolute;right:7px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:1px solid #d8e2ef;border-radius:9px;background:#f7f9fc;color:#37587d;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0}
      body.hap-mobile-v38 tr.v382-expanded .v382-detail-toggle{transform:translateY(-50%) rotate(180deg);background:#eaf2fc;color:#174978}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='montante'],
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='compromissado'],
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='saldo']{display:flex!important;flex-direction:column!important;justify-content:center!important;padding:8px 7px!important;border-top:1px solid #edf1f6!important;min-width:0!important;font-size:10.5px!important;font-weight:800!important;font-variant-numeric:tabular-nums!important;white-space:nowrap!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='montante']{grid-area:mont;padding-left:10px!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='compromissado']{grid-area:comp;border-left:1px solid #edf1f6!important;border-right:1px solid #edf1f6!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='saldo']{grid-area:saldo;padding-right:10px!important;color:#167746!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='montante']::before,
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='compromissado']::before,
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='saldo']::before{display:block!important;content:attr(data-v380-label)!important;margin-bottom:3px!important;font-size:6.8px!important;font-weight:900!important;line-height:1!important;letter-spacing:.04em!important;text-transform:uppercase!important;color:#7b899d!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='percentual']{grid-area:pct;display:flex!important;align-items:center!important;padding:7px 6px 8px 10px!important;border-top:1px solid #edf1f6!important;font-size:9.5px!important;font-weight:800!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='pacote']{grid-area:pacote;display:flex!important;align-items:center!important;padding:7px 10px 8px 5px!important;border-top:1px solid #edf1f6!important;font-size:8.8px!important;color:#53667f!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='percentual']::before{content:'Comp. ';font-size:7px;color:#7b899d;margin-right:4px;text-transform:uppercase}
      body.hap-mobile-v38 table.v382-capex-smart tbody tr.v382-expanded{padding-bottom:7px!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody tr.v382-expanded td[data-v382-secondary='1']{display:flex!important;grid-column:1 / -1!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;padding:7px 10px!important;border-top:1px solid #edf1f6!important;font-size:9.5px!important;line-height:1.3!important;background:#fbfcfe!important}
      body.hap-mobile-v38 table.v382-capex-smart tbody tr.v382-expanded td[data-v382-secondary='1']::before{content:attr(data-v380-label)!important;flex:0 0 36%!important;font-size:7px!important;font-weight:900!important;text-transform:uppercase!important;letter-spacing:.04em!important;color:#7b899d!important}
      body.hap-mobile-v38 .v382-capex-smart-hint{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 2px 7px;padding:5px 8px;font-size:8px;color:#6d7d92}
      body.hap-mobile-v38 .v382-capex-smart-hint strong{color:#24486f;font-size:8.5px}
      body.hap-mobile-v38 .v380-swipe-hint.v382-hidden{display:none!important}
      @media(max-width:370px){
        body.hap-mobile-v38 table.v382-capex-smart tbody tr{grid-template-columns:76px repeat(12,minmax(0,1fr))!important}
        body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='obra']{font-size:10.8px!important;padding-right:36px!important}
        body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='montante'],body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='compromissado'],body.hap-mobile-v38 table.v382-capex-smart tbody td[data-v382-field='saldo']{font-size:9.6px!important}
      }


      /* ==========================================================
         V38.1 — PADRÃO VISUAL MOBILE CURVA -> CONTROLE
         Cabeçalho unificado, escala visual e densidade.
         ========================================================== */
      .v381-control-header{display:none}
      body.hap-mobile-v38{overflow-x:hidden!important;background:#f4f6fa!important}
      body.hap-mobile-v38 header.topbar{display:none!important}
      body.hap-mobile-v38 .v381-control-header{
        display:flex;position:sticky;top:0;z-index:1050;align-items:center;justify-content:space-between;
        min-height:calc(60px + env(safe-area-inset-top,0px));padding:calc(7px + env(safe-area-inset-top,0px)) 9px 7px;
        background:linear-gradient(135deg,#0d2b4e 0%,#184d82 100%);color:#fff;
        box-shadow:0 2px 10px rgba(13,43,78,.22);margin:0;
      }
      body.hap-mobile-v38 .v381-control-brand{display:flex;align-items:center;gap:10px;min-width:0;cursor:pointer}
      body.hap-mobile-v38 .v381-control-logo{width:40px;height:40px;border-radius:11px;overflow:hidden;flex:0 0 40px;box-shadow:0 2px 8px rgba(0,0,0,.2)}
      body.hap-mobile-v38 .v381-control-logo img{width:100%;height:100%;display:block;object-fit:cover}
      body.hap-mobile-v38 .v381-control-brandtext{min-width:0}
      body.hap-mobile-v38 .v381-control-brandtext strong{display:block;font-size:14px;line-height:1.05;letter-spacing:.055em;color:#fff}
      body.hap-mobile-v38 .v381-control-brandtext small{display:block;margin-top:4px;font-size:9px;line-height:1.1;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px}
      body.hap-mobile-v38 .v381-control-head-actions{display:flex;align-items:center;gap:6px}
      body.hap-mobile-v38 .v381-control-head-actions button{position:relative;width:40px;height:40px;border:1px solid rgba(255,255,255,.22);border-radius:11px;background:rgba(255,255,255,.10);color:#fff;font-size:19px;display:flex;align-items:center;justify-content:center;padding:0}
      body.hap-mobile-v38 .v381-control-head-actions button:active{transform:scale(.98);background:rgba(255,255,255,.18)}
      body.hap-mobile-v38 .v381-head-badge{position:absolute;right:-3px;top:-5px;min-width:22px;height:18px;padding:0 5px;border-radius:999px;background:#d7352b;color:#fff;border:2px solid #174978;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center}

      /* Densidade de um leve zoom-out sem escala CSS: ocupa 100% da largura e não cria overflow. */
      body.hap-mobile-v38 #app{width:100%!important;max-width:100%!important;margin:0!important;padding-left:6px!important;padding-right:6px!important;background:#f4f6fa!important}
      body.hap-mobile-v38 .toolbar{position:static!important;top:auto!important;margin-top:0!important;background:#fff!important;border:1px solid #e1e6ee!important;border-radius:10px!important;box-shadow:0 1px 5px rgba(13,43,78,.06)!important}
      body.hap-mobile-v38 .toolbar input[type=text]{background:#f4f6fa!important;border:0!important;border-radius:9px!important;color:#233955!important}
      body.hap-mobile-v38 .toolbar .btn{border-radius:9px!important;font-weight:750!important}
      body.hap-mobile-v38 .toolbar .btn-primary{background:#1a4f8f!important}

      /* KPIs alinhados ao padrão visual da Curva. */
      body.hap-mobile-v38 .kpi-grid,body.hap-mobile-v38 .v37-kpi-grid{gap:7px!important;margin-bottom:10px!important}
      body.hap-mobile-v38 .kpi-card{min-height:76px!important;padding:8px 9px!important;border-radius:11px!important;border-left-width:3px!important;box-shadow:0 1px 5px rgba(13,43,78,.07)!important;background:#fff!important}
      body.hap-mobile-v38 .kpi-card .label{font-size:8px!important;line-height:1.15!important;color:#5a6882!important;font-weight:800!important;letter-spacing:.045em!important}
      body.hap-mobile-v38 .kpi-card .value{font-size:13.4px!important;line-height:1.1!important;color:#0d2b4e!important;font-weight:800!important;margin-top:6px!important}
      body.hap-mobile-v38 .kpi-card .sub{font-size:8.2px!important;line-height:1.28!important;color:#5a6882!important;margin-top:5px!important}

      /* Evita sobreposição na primeira coluna das tabelas largas do Controle. */
      body.hap-mobile-v38 .v380-swipe-table th:first-child,body.hap-mobile-v38 .v380-swipe-table td:first-child{width:205px!important;min-width:205px!important;max-width:205px!important;white-space:normal!important;line-height:1.35!important;vertical-align:middle!important;background:#fff!important;overflow:hidden!important}
      body.hap-mobile-v38 .v380-swipe-table tbody tr:nth-child(even) td:first-child{background:#e8f0fb!important}
      body.hap-mobile-v38 .v380-swipe-table td:first-child>*{position:static!important;float:none!important}
      body.hap-mobile-v38 .v380-swipe-table .v35-link-badge{display:inline-flex!important;margin:3px 3px 2px 0!important;vertical-align:middle!important;white-space:nowrap!important}
      body.hap-mobile-v38 .v380-swipe-table tbody td{height:auto!important;min-height:38px!important}

      /* Bottom nav igual à linguagem visual da Curva. */
      body.hap-mobile-v38 .v380-control-dock{padding:6px 5px max(6px,env(safe-area-inset-bottom))!important;background:rgba(255,255,255,.98)!important;border-top:1px solid #d9e1ec!important}
      body.hap-mobile-v38 .v380-control-dock button{min-height:52px!important;border-radius:12px!important;color:#758197!important}
      body.hap-mobile-v38 .v380-control-dock button.active{background:#eaf2fc!important;color:#134d8d!important}
      body.hap-mobile-v38 .v380-control-dock button .v380-icon{font-size:19px!important}
      body.hap-mobile-v38 .v380-control-dock button small{font-size:8px!important;font-weight:800!important}

      @media(max-width:365px){
        body.hap-mobile-v38 .v381-control-brandtext small{max-width:165px}
        body.hap-mobile-v38 .kpi-card .value{font-size:13px!important}
      }



      /* ==========================================================
         V39.0 — SAP Bridge V1 / Central de atualização Base Consumo
         ========================================================== */
      .v390-sap-btn{display:inline-flex!important;align-items:center!important;gap:6px!important}
      .v390-sap-btn::before{content:'SAP';display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:20px;padding:0 5px;border-radius:6px;background:#0a6ed1;color:#fff;font-size:8px;font-weight:900;letter-spacing:.04em}
      .v390-sap-box{width:min(760px,96vw)!important}
      .v390-sap-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 13px;border-radius:11px;background:linear-gradient(135deg,#0d2b4e,#185a97);color:#fff;margin:10px 0 12px}
      .v390-sap-hero strong{display:block;font-size:13px}.v390-sap-hero small{display:block;margin-top:4px;font-size:9.5px;line-height:1.4;color:rgba(255,255,255,.82)}
      .v390-sap-pill{flex:0 0 auto;display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);font-size:9px;font-weight:800}
      .v390-step-list{display:grid;gap:7px;margin:10px 0 12px}
      .v390-step{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:9px;padding:8px 9px;border:1px solid var(--cinza-borda);border-radius:9px;background:#fff}
      .v390-step-index{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#eef1f5;color:var(--texto-suave);font-size:9px;font-weight:900}
      .v390-step-title{font-size:10px;font-weight:800;color:var(--azul)}.v390-step small{display:block;margin-top:2px;font-size:8.5px;line-height:1.3;color:var(--texto-suave)}
      .v390-step-state{font-size:9px;font-weight:800;color:var(--texto-suave);white-space:nowrap}
      .v390-step.done{border-color:#b9dec9;background:#f5fbf7}.v390-step.done .v390-step-index{background:#dff3e7;color:#126b37}.v390-step.done .v390-step-state{color:#126b37}
      .v390-step.active{border-color:#a9c8eb;background:#f4f8fd}.v390-step.active .v390-step-index{background:#dceafb;color:#174f8c}.v390-step.active .v390-step-state{color:#174f8c}
      .v390-step.error{border-color:#e4b5b5;background:#fffafa}.v390-step.error .v390-step-index{background:#fcebeb;color:#a52727}.v390-step.error .v390-step-state{color:#a52727}
      .v390-sap-error{border:1px solid #e4b5b5;background:#fffafa;border-radius:10px;padding:10px 11px;margin:10px 0;color:#791f1f;font-size:10px;line-height:1.45}.v390-sap-error strong{display:block;font-size:11px;margin-bottom:3px}.v390-sap-solution{margin-top:6px;padding-top:6px;border-top:1px dashed #e4b5b5;color:#68480d}
      .v390-sap-info{border:1px solid #c7d8ee;background:#eef4fc;border-radius:10px;padding:9px 10px;margin:9px 0;font-size:9.5px;line-height:1.45;color:#244b74}
      .v390-sap-path{display:grid;grid-template-columns:1fr auto;gap:7px;margin:9px 0}.v390-sap-path input{min-width:0;padding:9px 10px;border:1px solid var(--cinza-borda);border-radius:8px;font-size:12px}.v390-sap-path button{white-space:nowrap}
      .v390-sap-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 0}.v390-sap-actions .btn{min-height:38px}
      .v390-sap-log{font-size:8.5px;color:var(--texto-suave);margin-top:8px;line-height:1.4;word-break:break-word}
      .v396-dist{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--cinza-borda);border-radius:10px;padding:10px 12px;margin:10px 0;background:#fff}
      .v396-dist.ok{background:#eef9f3;border-color:#b8dfc9}.v396-dist.warn{background:#fff8e6;border-color:#f0c98b}.v396-dist.offline{background:#f7f8fa}
      .v396-dist-main{min-width:0}.v396-dist-title{font-size:10px;font-weight:800;color:var(--azul)}.v396-dist-sub{font-size:9px;color:var(--texto-suave);line-height:1.4;margin-top:2px}
      .v396-dist-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.v396-dist-actions .btn{white-space:nowrap}
      @media(max-width:680px){.v396-dist{align-items:stretch;flex-direction:column}.v396-dist-actions{justify-content:stretch}.v396-dist-actions .btn{flex:1}}
      .v390-viewer-note{background:#fff8e6;border:1px solid #f0c98b;color:#68480d;border-radius:9px;padding:9px 10px;font-size:9.5px;line-height:1.45;margin-top:9px}
      body.hap-mobile-v38 .v390-sap-box{width:100%!important}
      body.hap-mobile-v38 .v390-sap-hero{padding:10px!important;margin:7px 0 9px!important}
      body.hap-mobile-v38 .v390-step{grid-template-columns:25px 1fr auto;padding:7px!important;gap:7px!important}.v390-step-index{width:22px;height:22px}
      body.hap-mobile-v38 .v390-sap-path{grid-template-columns:1fr}.v390-sap-path input{font-size:16px!important}


      /* V39.4 — Governança Base Consumo, Auditoria e exportação executiva */
      .v394-last-update{display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fff;border:1px solid var(--cinza-borda);border-left:4px solid var(--verde);border-radius:10px;padding:10px 12px;margin:0 0 12px;box-shadow:0 1px 4px rgba(13,43,78,.04)}
      .v394-last-update-main{min-width:0}.v394-last-update-title{font-size:10px;font-weight:800;color:var(--azul);text-transform:uppercase;letter-spacing:.045em}.v394-last-update-value{font-size:13px;font-weight:800;color:var(--azul);margin-top:2px}.v394-last-update-meta{font-size:9.5px;color:var(--texto-suave);margin-top:2px;line-height:1.35}
      .v394-last-update-badge{white-space:nowrap;background:#e1f5ee;color:#075943;border-radius:999px;padding:5px 9px;font-size:9px;font-weight:800}
      .v394-audit-toolbar{display:grid;grid-template-columns:1.35fr repeat(5,minmax(140px,1fr));gap:7px;background:#fff;border:1px solid var(--cinza-borda);border-radius:11px;padding:9px;margin-bottom:10px}
      .v394-audit-toolbar input,.v394-audit-toolbar select{width:100%;min-width:0;padding:8px 9px;border:1px solid var(--cinza-borda);border-radius:8px;background:#fff;font:inherit}
      .v394-audit-secondary{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:-2px 0 12px}
      .v394-audit-secondary input,.v394-audit-secondary select{padding:7px 8px;border:1px solid var(--cinza-borda);border-radius:8px;background:#fff;font:inherit}
      .v394-audit-day{font-size:10px;font-weight:900;color:var(--azul);text-transform:uppercase;letter-spacing:.06em;margin:14px 2px 7px;padding-bottom:5px;border-bottom:1px solid var(--cinza-borda)}
      .v394-audit-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px}.v394-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;font-size:8.5px;font-weight:800;background:var(--azul-suave);color:var(--azul)}.v394-badge.success{background:#e1f5ee;color:#075943}.v394-badge.error{background:#fcebeb;color:#8b2017}.v394-badge.cancelled{background:#fff0c0;color:#805700}
      .v394-audit-op{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0 2px}.v394-audit-op>div{background:var(--cinza-bg);border-radius:7px;padding:6px 7px;min-width:0}.v394-audit-op span{display:block;font-size:7.5px;text-transform:uppercase;font-weight:800;color:var(--texto-suave);letter-spacing:.04em}.v394-audit-op strong{display:block;font-size:9.5px;color:var(--azul);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v394-export-btn{white-space:nowrap}
      .v394-missing-alert{background:#fff8e6;border:1px solid #efc56b;border-radius:9px;padding:9px 10px;margin:10px 0;color:#68480d;font-size:10px;line-height:1.45}
      .v395-issue-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:var(--azul);margin:13px 0 7px}
      .v395-issue-list{display:grid;gap:7px;margin:8px 0 11px}
      .v395-issue-item{border:1px solid #e4b5b5;background:#fffafa;border-radius:9px;padding:9px 10px}
      .v395-issue-item.resolved{border-color:#b6dfc6;background:#f4fbf7}
      .v395-issue-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .v395-issue-oi{font-size:11px;font-weight:900;color:var(--azul)}
      .v395-issue-work{font-size:10px;color:var(--texto-suave);margin-top:2px}
      .v395-issue-tag{font-size:8px;font-weight:900;padding:3px 7px;border-radius:999px;white-space:nowrap}
      .v395-issue-tag.new{background:#fcebeb;color:#9d1c1c}.v395-issue-tag.kept{background:#fff0c0;color:#805a00}.v395-issue-tag.fixed{background:#e1f5ee;color:#126b37}
      .v395-issue-values{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:8px}
      .v395-issue-values>div{background:#fff;border:1px solid #e4e8ef;border-radius:7px;padding:6px 7px;min-width:0}
      .v395-issue-values span{display:block;font-size:7.5px;text-transform:uppercase;font-weight:800;color:var(--texto-suave);letter-spacing:.03em}
      .v395-issue-values strong{display:block;font-size:9.5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v395-issue-note{font-size:9px;margin-top:7px;line-height:1.4;color:#791f1f}
      .v395-export-note{font-size:9px;color:var(--texto-suave);margin-top:4px}
      @media(max-width:700px){.v395-issue-values{grid-template-columns:repeat(2,minmax(0,1fr))}.v395-issue-head{align-items:flex-start}}
      body.pwa-mobile .v394-last-update{padding:8px 9px;gap:8px}.v394-viewer-allowed{background:#e8f0fb;border:1px solid #aac5e8;color:#123b6b;border-radius:9px;padding:8px 9px;font-size:9.5px;line-height:1.4}
      @media(max-width:1100px){.v394-audit-toolbar{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:720px){.v394-audit-toolbar{grid-template-columns:1fr 1fr}.v394-audit-op{grid-template-columns:1fr 1fr}.v394-last-update{align-items:flex-start}.v394-last-update-badge{display:none}}
      @media(max-width:430px){.v394-audit-toolbar{grid-template-columns:1fr}}

      @media(max-width:1100px){.v37-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.v37-filter-grid{grid-template-columns:1fr 1fr 1fr}}
      @media(max-width:720px){.v37-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.v37-filter-grid{grid-template-columns:1fr 1fr}.v37-formula{grid-template-columns:1fr 1fr}.v37-json-grid{grid-template-columns:1fr}}
      @media(max-width:430px){.v37-kpi-grid,.v37-filter-grid,.v37-formula{grid-template-columns:1fr!important}.v37-recon,.v37-row-head{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function initState() {
    state.v37 = state.v37 || {
      donations: [],
      reconciliation: null,
      audit: [],
      auditSearch: '',
      auditUser: '',
      auditAction: '',
      auditModule: '',
      auditStart: '',
      auditEnd: '',
      auditType: '',
      auditStatus: '',
      auditSort: 'desc',
      auditPeriod: '30',
      donationSearch: '',
      notifications: [],
      notificationCategory: 'Todas',
      notificationUnreadOnly: false,
      pendencyFilter: 'all',
      curvePlannedOrders: [],
      curvePlanningContextReady: false,
      curvePlanningContextError: ''
    };
    if (!Object.prototype.hasOwnProperty.call(state.v37, 'pendencyFilter')) state.v37.pendencyFilter = 'all';
    if (!Array.isArray(state.v37.curvePlannedOrders)) state.v37.curvePlannedOrders = [];
    if (typeof state.v37.curvePlanningContextReady !== 'boolean') state.v37.curvePlanningContextReady = false;
    if (typeof state.v37.curvePlanningContextError !== 'string') state.v37.curvePlanningContextError = '';
    if (typeof state.v37.auditType !== 'string') state.v37.auditType = '';
    if (typeof state.v37.auditStatus !== 'string') state.v37.auditStatus = '';
    if (!['asc','desc'].includes(state.v37.auditSort)) state.v37.auditSort = 'desc';
    if (typeof state.v37.auditPeriod !== 'string') state.v37.auditPeriod = '30';
    if (!state.v394) state.v394 = { lastUpdate:null, lastUpdateLoaded:false };
  }

  const originalNavHtml = navHtml;
  const originalRefreshCurrent = refreshCurrent;
  const originalLoadCapexTab = loadCapexTab;
  const originalRenderCapexTab = renderCapexTab;
  const originalLoadRoleAndDataV394 = loadRoleAndData;
  const originalLoadBaseConsumoTabV394 = loadBaseConsumoTab;
  const originalRenderBaseConsumoTabV394 = renderBaseConsumoTab;
  const originalLoadBaseOiTabV394 = loadBaseOiTab;
  const originalRenderBaseOiTabV394 = renderBaseOiTab;

  navHtml = window.navHtml = function(isAdmin) {
    initState();
    if (state.role === 'viewer') {
      const pill=(id,label)=>`<span class="nav-pill ${state.tab===id?'active':''}" onclick="switchTab('${id}')">${label}</span>`;
      return `<div style="display:flex;gap:6px;">${pill('capex','CAPEX')}${pill('base_oi','BASE O.I')}${pill('base_consumo','BASE CONSUMO')}</div>`;
    }
    const base = originalNavHtml(isAdmin);
    if (!isAdmin || !base) return base;
    const extra = `<span class="nav-pill ${state.tab==='auditoria'?'active':''}" onclick="switchTab('auditoria')">AUDITORIA</span>`;
    return base.replace(/<\/div>\s*$/, extra + '</div>');
  };

  refreshCurrent = window.refreshCurrent = async function() {
    initState();
    const viewerTabs=['capex','base_oi','base_consumo'];
    if (state.role === 'viewer' && !viewerTabs.includes(state.tab)) state.tab='capex';
    if (state.tab === 'doacoes') state.tab='capex';
    if (state.tab === 'auditoria') {
      if (state.role !== 'admin') { state.tab = 'capex'; return originalRefreshCurrent(); }
      await loadAuditTabV37();
    } else {
      await originalRefreshCurrent();
    }
    await refreshNotificationsV371(false);
    decorateNotificationButtonV371();
  };

  loadCapexTab = window.loadCapexTab = async function() {
    initState();
    await Promise.all([loadDonationsContextV37(), loadReconciliationV37(), loadCapexPendencyContextV378()]);
    return originalLoadCapexTab();
  };

  renderCapexTab = window.renderCapexTab = function(...args) {
    initState();
    const allRows = state.rows || [];
    const activeFilter = state.role === 'admin' ? (state.v37.pendencyFilter || 'all') : 'all';
    if (activeFilter !== 'all') state.rows = allRows.filter(row => matchesCapexPendencyV378(row, activeFilter));
    let out;
    try {
      out = originalRenderCapexTab(...args);
    } finally {
      state.rows = allRows;
    }
    patchCapexDashboardV37();
    decorateCapexPendencyFilterV378();
    decorateCapexViewerV397();
    return out;
  };

  function decorateCapexViewerV397() {
    if (state.role !== 'viewer' || state.tab !== 'capex') return;
    decorateRoleBadgeV394();
    const table=document.querySelector('.table-card table');
    if(!table)return;
    const header=table.querySelector('thead tr');
    if(!header)return;

    if(!header.querySelector('[data-v397-package]')){
      const anchor=header.children[6]||null;
      const thPackage=document.createElement('th');thPackage.dataset.v397Package='1';thPackage.textContent='Pacote CAPEX';
      const thHead=document.createElement('th');thHead.dataset.v397Head='1';thHead.textContent='HEAD Operação';
      if(anchor){header.insertBefore(thHead,anchor);header.insertBefore(thPackage,thHead);}else{header.append(thPackage,thHead);}
    }

    const filtered=(state.rows||[]).filter(r=>matchesSearch(state.filter,[r.ordem_interna,r.obra]));
    const bodyRows=[...table.querySelectorAll('tbody tr')];
    let dataIndex=0;
    bodyRows.forEach(tr=>{
      if(tr.querySelector('.empty-state'))return;
      if(tr.dataset.v397ViewerCols==='1'){dataIndex++;return;}
      const item=filtered[dataIndex++];
      if(!item)return;
      const anchor=tr.children[6]||null;
      const tdPackage=document.createElement('td');tdPackage.textContent=item.classificacao_pacote_capex||'—';
      const tdHead=document.createElement('td');tdHead.textContent=item.classificacao_head_operacao||'—';
      if(anchor){tr.insertBefore(tdHead,anchor);tr.insertBefore(tdPackage,tdHead);}else{tr.append(tdPackage,tdHead);}
      tr.dataset.v397ViewerCols='1';
    });

    // Defesa visual: nenhum comando administrativo pode sobreviver no CAPEX do Visualizador.
    ['contingenciar-btn','aporte-btn','nova-oi-btn','v35-link-ois-btn','v37-new-donation'].forEach(id=>document.getElementById(id)?.remove());
  }

  async function loadCapexPendencyContextV378() {
    if (state.role !== 'admin') {
      state.v37.curvePlannedOrders = [];
      state.v37.curvePlanningContextReady = false;
      state.v37.curvePlanningContextError = '';
      return;
    }
    try {
      const [itemsResult, multiResult] = await Promise.all([
        sb.from('capex_items').select('ordem,categoria').is('deleted_at', null),
        sb.from('vw_controle_oi_multipla_curva').select('ordem_interna')
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (multiResult.error) throw multiResult.error;
      const planned = new Set();
      (itemsResult.data || []).forEach(item => {
        if (String(item.categoria || '').toLowerCase() !== 'obra') return;
        const oi = String(item.ordem || '').replace(/#\d+$/, '').trim();
        if (oi) planned.add(oi);
      });
      (multiResult.data || []).forEach(item => {
        const oi = String(item.ordem_interna || '').trim();
        if (oi) planned.add(oi);
      });
      state.v37.curvePlannedOrders = [...planned];
      state.v37.curvePlanningContextReady = true;
      state.v37.curvePlanningContextError = '';
    } catch (error) {
      console.warn('[HAPCAPEX V37.8] Não foi possível carregar o contexto de planejamento da Curva.', error);
      state.v37.curvePlannedOrders = [];
      state.v37.curvePlanningContextReady = false;
      state.v37.curvePlanningContextError = error?.message || 'Contexto de planejamento indisponível';
    }
  }

  function blankV378(value) {
    return value === null || value === undefined || String(value).trim() === '';
  }

  function normalizedV378(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function isMaintenanceDayToDayV378(row) {
    return normalizedV378(row?.classificacao_pacote_capex) === normalizedV378('Manutenção Dia a Dia');
  }

  function hasCurvePlanningV378(row) {
    const oi = String(row?.ordem_interna || '').trim();
    return !!oi && (state.v37.curvePlannedOrders || []).includes(oi);
  }

  function capexPendencyFlagsV378(row) {
    const technical = String(row?.ordem_interna || '').trim() === OI_BALDE_CONTINGENCIA;
    const missingPackage = blankV378(row?.classificacao_pacote_capex);
    const missingHead = blankV378(row?.classificacao_head_operacao);
    const missingGroup = blankV378(row?.grupo_executivo);
    const missingDetail = blankV378(row?.detalhamento);
    const missingCategory = blankV378(row?.categoria_orc);
    const missingDetailOrc = blankV378(row?.detalhamento_orc);
    const classificationIncomplete = missingPackage || missingHead || missingGroup || missingDetail || missingCategory || missingDetailOrc || String(row?.status_classificacao || '').toLowerCase() !== 'completa';
    const planned = hasCurvePlanningV378(row);
    const maintenance = isMaintenanceDayToDayV378(row);
    const missingPlanning = state.v37.curvePlanningContextReady && !maintenance && !planned;
    const missingDates = planned && (blankV378(row?.data_inicio) || blankV378(row?.data_fim));
    const any = !technical && (classificationIncomplete || missingPlanning || missingDates);
    return { technical, missingPackage, missingHead, missingGroup, missingDetail, missingCategory, missingDetailOrc, classificationIncomplete, planned, maintenance, missingPlanning, missingDates, any };
  }

  function matchesCapexPendencyV378(row, filter) {
    if (!filter || filter === 'all') return true;
    const f = capexPendencyFlagsV378(row);
    if (f.technical) return false;
    const map = {
      any: f.any,
      classification: f.classificationIncomplete,
      package: f.missingPackage,
      head: f.missingHead,
      group: f.missingGroup,
      detail: f.missingDetail,
      category_orc: f.missingCategory,
      detail_orc: f.missingDetailOrc,
      planning: f.missingPlanning,
      dates: f.missingDates
    };
    return !!map[filter];
  }

  function capexPendencyOptionsV378() {
    const rows = (state.rows || []).filter(row => String(row?.ordem_interna || '').trim() !== OI_BALDE_CONTINGENCIA);
    const defs = [
      ['all','Todas as OIs'],
      ['any','Com qualquer pendência'],
      ['classification','Classificação incompleta'],
      ['package','Sem Pacote CAPEX'],
      ['head','Sem HEAD Operação'],
      ['group','Sem Grupo Executivo'],
      ['detail','Sem Detalhamento'],
      ['category_orc','Sem Categoria ORC'],
      ['detail_orc','Sem Detalhamento ORC'],
      ['planning','Sem planejamento na Curva'],
      ['dates','Sem datas de planejamento']
    ];
    return defs.map(([value,label]) => ({
      value, label,
      count: value === 'all' ? rows.length : rows.filter(row => matchesCapexPendencyV378(row, value)).length,
      disabled: value === 'planning' && !state.v37.curvePlanningContextReady
    }));
  }

  function decorateCapexPendencyFilterV378() {
    if (state.tab !== 'capex' || state.role !== 'admin') return;
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar || document.getElementById('v378-pendency-select')) return;
    const options = capexPendencyOptionsV378();
    const active = state.v37.pendencyFilter || 'all';
    const current = options.find(option => option.value === active) || options[0];
    const visibleRows = (state.rows || []).filter(row => matchesCapexPendencyV378(row, active)).filter(row => matchesSearch(state.filter, [row.ordem_interna, row.obra]));
    const wrap = document.createElement('div');
    wrap.className = 'v378-pendency-wrap';
    wrap.innerHTML = `<label for="v378-pendency-select">Pendências</label>
      <select id="v378-pendency-select" title="Filtrar OIs com informações pendentes">
        ${options.map(option => `<option value="${option.value}" ${option.value===active?'selected':''} ${option.disabled?'disabled':''}>${escapeHtml(option.label)} (${option.count})${option.disabled?' — indisponível':''}</option>`).join('')}
      </select>
      <span class="v378-pendency-count" title="Linhas visíveis após combinar busca e pendência">${visibleRows.length}</span>
      ${active!=='all'?'<button type="button" class="v378-pendency-reset" id="v378-pendency-reset">Limpar</button>':''}`;
    const searchInput = toolbar.querySelector('#search-input') || toolbar.querySelector('input[type="text"]');
    if (searchInput) searchInput.insertAdjacentElement('afterend', wrap); else toolbar.prepend(wrap);
    wrap.querySelector('#v378-pendency-select').onchange = event => {
      state.v37.pendencyFilter = event.target.value;
      renderCapexTab();
    };
    const reset = wrap.querySelector('#v378-pendency-reset');
    if (reset) reset.onclick = () => { state.v37.pendencyFilter = 'all'; renderCapexTab(); };
    if (state.v37.curvePlanningContextError) {
      wrap.title = `Filtro de planejamento indisponível: ${state.v37.curvePlanningContextError}`;
    }
  }

  async function loadDonationsContextV37() {
    const { data, error } = await sb.from('vw_controle_doacoes_capex').select('*').order('created_at', { ascending:false });
    if (error) throw error;
    state.v37.donations = data || [];
  }

  async function loadReconciliationV37() {
    if (state.role !== 'admin') { state.v37.reconciliation = null; return; }
    const { data, error } = await sb.from('vw_controle_conciliacao_capex').select('*').maybeSingle();
    if (error) throw error;
    state.v37.reconciliation = data || null;
  }

  function capexKpisV37() {
    const rows = (state.rows || []).filter(r => String(r.ordem_interna) !== OI_BALDE_CONTINGENCIA);
    const current = computeKpis(state.rows || []);
    const r = state.v37?.reconciliation || {};
    return {
      capexInicial: Number(r.capex_inicial ?? CAPEX_INICIAL_CONTROLE),
      doacoes: Number(r.doacoes ?? (state.v37?.donations || []).filter(x=>x.status==='ativo').reduce((s,x)=>s+Number(x.valor||0),0)),
      contingenciamentos: Number(r.contingenciamentos ?? current.contingenciamento ?? 0),
      aportes: Number(r.aportes ?? current.aportes ?? 0),
      capexAtual: Number(r.capex_atual_formula ?? current.montante ?? 0),
      capexOis: Number(r.capex_atual_ois ?? current.montante ?? 0),
      diferenca: Number(r.diferenca ?? 0),
      status: r.status_conciliacao || 'conciliado',
      compromissado: Number(r.compromissado ?? current.compromissado ?? 0),
      saldo: Number(r.saldo ?? current.saldo ?? 0),
      pctComp: Number(r.capex_atual_formula ?? current.montante ?? 0) > 0
        ? Number(r.compromissado ?? current.compromissado ?? 0) / Number(r.capex_atual_formula ?? current.montante ?? 0)
        : null,
      qtdObras: current.qtdObras ?? rows.length
    };
  }

  function kpiCard(label, value, color, sub='', click='') {
    return `<div class="kpi-card ${click?'clickable':''}" style="border-left-color:${color}" ${click?`role="button" tabindex="0" onclick="${click}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${click}}"`:''}>
      <div class="label">${label}</div><div class="value">${value}</div>${sub?`<div class="sub">${sub}</div>`:''}
    </div>`;
  }

  function patchCapexDashboardV37() {
    initState();
    if (state.tab !== 'capex') return;
    const grid = document.querySelector('.kpi-grid');
    if (!grid) return;
    const k = capexKpisV37();
    grid.classList.add('v37-kpi-grid');
    grid.innerHTML =
      kpiCard('CAPEX Inicial', brl.format(k.capexInicial), 'var(--azul)', 'Base consolidada Obras + Manutenção') +
      kpiCard('Doações', brl.format(k.doacoes), 'var(--laranja)', 'Valores transferidos para outros CAPEX · clique para detalhar', "openDonationPanelV371()") +
      kpiCard('Contingenciamentos', brl.format(k.contingenciamentos), 'var(--vermelho)', 'Ver lançamentos ativos', "openControlKpiPanel('contingenciamento')") +
      kpiCard('Aportes Extras', brl.format(k.aportes), 'var(--verde)', 'Ver lançamentos ativos', "openControlKpiPanel('aportes')") +
      kpiCard('CAPEX Atual', brl.format(k.capexAtual), 'var(--azul-medio)', state.role==='admin' ? 'Inicial − Doações − Contingenciamentos + Aportes' : 'CAPEX vigente', state.role==='admin' ? 'openCapexReconciliationV37()' : '') +
      kpiCard('Compromissado', brl.format(k.compromissado), 'var(--azul-claro)', 'Recursos já comprometidos') +
      kpiCard('Saldo disponível', brl.format(k.saldo), 'var(--verde)', 'Saldo operacional das OIs') +
      kpiCard('% Compromissado', pct(k.pctComp), 'var(--laranja)', 'Compromissado ÷ CAPEX Atual') +
      kpiCard('Qtde de obras', String(k.qtdObras), 'var(--azul-claro)', `Exclui OI técnica ${OI_BALDE_CONTINGENCIA}`);

    document.getElementById('v37-reconciliation-banner')?.remove();
    document.getElementById('v37-new-donation')?.remove();
    decorateNotificationButtonV371();
  }

  window.openCapexReconciliationV37 = function() {
    if (state.role !== 'admin') return;
    const k = capexKpisV37();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-box modal-wide">
      <h2>Conciliação do CAPEX Atual</h2>
      <p class="sub">A fórmula gerencial deve acompanhar a soma dos Montantes Atribuídos das OIs operacionais.</p>
      <div class="v37-formula">
        <div><span>CAPEX Inicial</span><strong>${brl.format(k.capexInicial)}</strong></div>
        <div><span>− Doações</span><strong>${brl.format(k.doacoes)}</strong></div>
        <div><span>− Contingenciamentos</span><strong>${brl.format(k.contingenciamentos)}</strong></div>
        <div><span>+ Aportes</span><strong>${brl.format(k.aportes)}</strong></div>
        <div><span>= CAPEX Atual</span><strong>${brl.format(k.capexAtual)}</strong></div>
      </div>
      <div class="${k.status==='divergente'?'error-msg':k.status==='arredondamento'?'banner-warn':'success-msg'}">
        <strong>Soma dos Montantes das OIs:</strong> ${brl.format(k.capexOis)}<br>
        <strong>Diferença:</strong> ${brl.format(k.diferenca)}<br>
        <span style="font-size:10px">A OI técnica ${OI_BALDE_CONTINGENCIA} não participa do CAPEX operacional. Diferenças de até R$ 0,50 são classificadas como arredondamento, mas o valor exato permanece visível.</span>
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v37-recon-close">Fechar</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v37-recon-close').onclick = () => backdrop.remove();
  };

  function commonHeaderV37(title) {
    return `<header class="topbar">
      <div><div class="brand-eyebrow">Controle de Capex</div><div class="brand-title">${escapeHtml(title)}</div></div>
      ${navHtml(state.role === 'admin')}
      <div class="user-chip">${escapeHtml(state.fullName || '')} <span class="role-badge">${state.role === 'admin' ? 'Admin' : 'Visualizador'}</span>
        <button class="btn btn-secondary" type="button" onclick="voltarAoSeletorHapcapex()">⇄ Trocar sistema</button>
        <button class="btn btn-secondary" id="logout-btn">Sair</button>
      </div>
    </header>`;
  }

  function bindLogoutV37() {
    const b = document.getElementById('logout-btn');
    if (b) b.onclick = () => sb.auth.signOut();
  }

  async function loadDonationsTabV37() {
    initState();
    try {
      await Promise.all([loadDonationsContextV37(), loadReconciliationV37()]);
      renderDonationsTabV37();
    } catch (e) {
      app.innerHTML = `<div class="error-msg" style="margin:40px">Erro ao carregar Doações: ${escapeHtml(e.message)}</div>`;
    }
  }

  function renderDonationsTabV37() {
    const all = state.v37.donations || [];
    const q = String(state.v37.donationSearch || '').toLowerCase();
    const rows = all.filter(x => !q || [x.ordem_interna_origem,x.obra_origem,x.capex_destino,x.descricao,x.observacao].some(v=>String(v||'').toLowerCase().includes(q)));
    const active = all.filter(x=>x.status==='ativo');
    const total = active.reduce((s,x)=>s+Number(x.valor||0),0);
    const hist = active.filter(x=>x.historica).reduce((s,x)=>s+Number(x.valor||0),0);
    const oper = active.filter(x=>!x.historica).reduce((s,x)=>s+Number(x.valor||0),0);

    app.innerHTML = `${commonHeaderV37('Doações')}
      <div class="kpi-grid">
        ${kpiCard('Doações ativas',brl.format(total),'var(--laranja)','Total que saiu do nosso CAPEX')}
        ${kpiCard('Históricas',brl.format(hist),'var(--azul-claro)','Já refletidas antes da V37')}
        ${kpiCard('Operacionais',brl.format(oper),'var(--vermelho)','Criadas no sistema e reversíveis')}
        ${kpiCard('Lançamentos',String(active.length),'var(--azul-medio)','Ativos')}
      </div>
      <div class="toolbar">
        <input type="text" id="v37-donation-search" placeholder="Buscar OI, obra, destino ou descrição" value="${escapeHtml(state.v37.donationSearch || '')}">
        <button class="btn btn-primary" id="v37-donation-new">+ Nova doação</button>
      </div>
      <div id="v37-donation-list">
        ${rows.length ? rows.map(renderDonationRowV37).join('') : '<div class="empty-state">Nenhuma doação encontrada.</div>'}
      </div>`;
    bindLogoutV37();
    document.getElementById('v37-donation-new').onclick = openDonationCreateV37;
    document.getElementById('v37-donation-search').oninput = e => { state.v37.donationSearch=e.target.value; renderDonationsTabV37(); requestAnimationFrame(()=>document.getElementById('v37-donation-search')?.focus()); };
    document.querySelectorAll('.v37-edit-donation').forEach(btn => btn.onclick = ()=>openDonationEditV37(all.find(x=>String(x.id)===btn.dataset.id)));
    document.querySelectorAll('.v37-cancel-donation').forEach(btn => btn.onclick = ()=>openDonationCancelV37(all.find(x=>String(x.id)===btn.dataset.id)));
  }

  function renderDonationRowV37(d) {
    const hist = !!d.historica;
    const cancelled = d.status === 'cancelado';
    const tag = cancelled ? '<span class="v37-tag cancel">Cancelada</span>' : hist ? '<span class="v37-tag hist">Histórica · já refletida</span>' : '<span class="v37-tag active">Operacional · ativa</span>';
    const date = d.data_doacao ? new Date(d.data_doacao+'T12:00:00').toLocaleDateString('pt-BR') : 'Data histórica não informada';
    const creator = d.created_by_name ? ` · por ${escapeHtml(d.created_by_name)}${d.created_by_email?` &lt;${escapeHtml(d.created_by_email)}&gt;`:''}` : '';
    return `<div class="v37-donation-row">
      <div class="v37-row-head"><div><div>${tag}</div><div class="v37-row-title">${escapeHtml(d.descricao || d.capex_destino || 'Doação')}</div>
      <div class="v37-row-meta">OI origem ${escapeHtml(d.ordem_interna_origem)}${d.obra_origem?` · ${escapeHtml(d.obra_origem)}`:''}<br>Destino: ${escapeHtml(d.capex_destino)} · ${date}${creator}</div></div>
      <div class="v37-row-value" style="color:var(--laranja)">${brl.format(Number(d.valor||0))}</div></div>
      ${d.observacao?`<div class="v37-row-meta" style="margin-top:7px">${escapeHtml(d.observacao)}</div>`:''}
      ${!hist && !cancelled ? `<div class="v37-actions"><button class="btn btn-secondary v37-edit-donation" data-id="${d.id}">Editar</button><button class="btn btn-secondary v37-danger v37-cancel-donation" data-id="${d.id}">Cancelar</button></div>` : ''}
      ${cancelled && d.cancel_reason?`<div class="v37-row-meta" style="color:var(--vermelho);margin-top:6px">Motivo: ${escapeHtml(d.cancel_reason)}</div>`:''}
    </div>`;
  }

  window.openDonationCreateV37 = openDonationCreateV37;
  function openDonationCreateV37() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const today = new Date().toISOString().slice(0,10);
    backdrop.innerHTML = `<div class="modal-box modal-wide">
      <h2>Registrar nova doação</h2><p class="sub">Transferência de verba para outro CAPEX da empresa.</p>
      <div class="v37-form-note"><strong>Efeito financeiro:</strong> reduz o Montante e o Saldo da OI de origem e reduz o CAPEX Atual. Nenhuma obra ou fluxo é criado na Curva de Capex. O sistema não permitirá que o Montante fique abaixo do Compromissado.</div>
      <div id="v37-d-error"></div>
      <div class="field"><label>OI de origem *</label><input id="v37-d-oi"><div id="v37-d-oi-info" class="v37-row-meta"></div></div>
      <div class="grid-2"><div class="field"><label>Valor *</label><input type="number" min="0.01" step="0.01" id="v37-d-value"></div><div class="field"><label>Data</label><input type="date" id="v37-d-date" value="${today}"></div></div>
      <div class="field"><label>CAPEX de destino *</label><input id="v37-d-dest" placeholder="Ex.: TI, Recheio, Equipamentos"></div>
      <div class="field"><label>Descrição / motivo</label><input id="v37-d-desc"></div>
      <div class="field"><label>Observação</label><textarea id="v37-d-obs" rows="2"></textarea></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v37-d-close">Cancelar</button><button class="btn btn-primary" id="v37-d-save">Registrar doação</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v37-d-close').onclick=()=>backdrop.remove();
    let timer;
    backdrop.querySelector('#v37-d-oi').oninput=e=>{
      clearTimeout(timer); const oi=e.target.value.trim(), info=backdrop.querySelector('#v37-d-oi-info');
      if(!oi){info.textContent='';return;}
      timer=setTimeout(async()=>{
        const {data,error}=await sb.rpc('buscar_obra_por_oi',{p_ordem_interna:oi});
        if(error){info.textContent=error.message;info.style.color='var(--vermelho)';return;}
        info.textContent=data?.existe?`${data.nome||'(sem nome)'} · Montante ${brl.format(Number(data.montante_atribuido||0))} · Compromissado ${brl.format(Number(data.valor_compromissado||0))} · Saldo ${brl.format(Number(data.saldo_disponivel||0))}`:'OI não encontrada.';
        info.style.color=data?.existe?'var(--texto-suave)':'var(--vermelho)';
      },250);
    };
    backdrop.querySelector('#v37-d-save').onclick=async()=>{
      const oi=backdrop.querySelector('#v37-d-oi').value.trim(), val=Number(backdrop.querySelector('#v37-d-value').value||0), dest=backdrop.querySelector('#v37-d-dest').value.trim(), err=backdrop.querySelector('#v37-d-error'), save=backdrop.querySelector('#v37-d-save');
      if(!oi||val<=0||!dest){err.innerHTML='<div class="error-msg">Informe OI de origem, valor e CAPEX de destino.</div>';return;}
      save.disabled=true;save.textContent='Registrando...';
      const {data,error}=await sb.rpc('criar_doacao_capex',{p_ordem_interna_origem:oi,p_valor:val,p_capex_destino:dest,p_data:backdrop.querySelector('#v37-d-date').value||null,p_descricao:backdrop.querySelector('#v37-d-desc').value.trim()||null,p_observacao:backdrop.querySelector('#v37-d-obs').value.trim()||null});
      if(error){save.disabled=false;save.textContent='Registrar doação';err.innerHTML=`<div class="error-msg">${escapeHtml(error.message)}</div>`;return;}
      backdrop.remove();
      await loadDonationsContextV37(); await loadReconciliationV37();
      await refreshCurrent();
      setTimeout(()=>openDonationPanelV371(),0);
      alert(`Doação registrada com sucesso.\n\nValor: ${brl.format(Number(data?.valor||val))}\nOI origem: ${oi}`);
    };
  }

  function openDonationEditV37(d) {
    if(!d || d.historica || d.status!=='ativo') return;
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box modal-wide"><h2>Editar doação</h2><p class="sub">A diferença será devolvida à OI ou retirada adicionalmente, mantendo a conciliação automática.</p>
      <div id="v37-de-error"></div>
      <div class="v37-form-note">OI origem: <strong>${escapeHtml(d.ordem_interna_origem)}</strong> · valor atual: <strong>${brl.format(Number(d.valor||0))}</strong></div>
      <div class="grid-2"><div class="field"><label>Novo valor *</label><input type="number" min="0.01" step="0.01" id="v37-de-value" value="${Number(d.valor||0).toFixed(2)}"></div><div class="field"><label>Data</label><input type="date" id="v37-de-date" value="${escapeHtml(d.data_doacao||'')}"></div></div>
      <div class="field"><label>CAPEX de destino *</label><input id="v37-de-dest" value="${escapeHtml(d.capex_destino||'')}"></div>
      <div class="field"><label>Descrição / motivo</label><input id="v37-de-desc" value="${escapeHtml(d.descricao||'')}"></div>
      <div class="field"><label>Observação</label><textarea id="v37-de-obs" rows="2">${escapeHtml(d.observacao||'')}</textarea></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v37-de-close">Cancelar</button><button class="btn btn-primary" id="v37-de-save">Salvar correção</button></div></div>`;
    document.body.appendChild(backdrop);backdrop.querySelector('#v37-de-close').onclick=()=>backdrop.remove();
    backdrop.querySelector('#v37-de-save').onclick=async()=>{
      const val=Number(backdrop.querySelector('#v37-de-value').value||0),dest=backdrop.querySelector('#v37-de-dest').value.trim(),err=backdrop.querySelector('#v37-de-error'),save=backdrop.querySelector('#v37-de-save');
      if(val<=0||!dest){err.innerHTML='<div class="error-msg">Informe valor e CAPEX de destino.</div>';return;}
      save.disabled=true;save.textContent='Atualizando...';
      const {data,error}=await sb.rpc('editar_doacao_capex',{p_id:d.id,p_novo_valor:val,p_capex_destino:dest,p_data:backdrop.querySelector('#v37-de-date').value||null,p_descricao:backdrop.querySelector('#v37-de-desc').value.trim()||null,p_observacao:backdrop.querySelector('#v37-de-obs').value.trim()||null});
      if(error){save.disabled=false;save.textContent='Salvar correção';err.innerHTML=`<div class="error-msg">${escapeHtml(error.message)}</div>`;return;}
      backdrop.remove();await loadDonationsContextV37();await loadReconciliationV37();await refreshCurrent();setTimeout(()=>openDonationPanelV371(),0);
      alert(`Doação atualizada.\n\n${brl.format(Number(data?.valor_anterior||d.valor))} → ${brl.format(Number(data?.valor_novo||val))}`);
    };
  }

  function openDonationCancelV37(d) {
    if(!d || d.historica || d.status!=='ativo') return;
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box"><h2>Cancelar doação</h2><p class="sub">O efeito financeiro será revertido, mas o registro continuará na auditoria.</p>
      <div class="v37-form-note"><strong>${escapeHtml(d.descricao||d.capex_destino)}</strong><br>OI ${escapeHtml(d.ordem_interna_origem)} · ${brl.format(Number(d.valor||0))}</div>
      <div id="v37-dc-error"></div><div class="field"><label>Motivo do cancelamento</label><textarea id="v37-dc-reason" rows="2"></textarea></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v37-dc-close">Voltar</button><button class="btn btn-secondary v37-danger" id="v37-dc-save">Cancelar lançamento</button></div></div>`;
    document.body.appendChild(backdrop);backdrop.querySelector('#v37-dc-close').onclick=()=>backdrop.remove();
    backdrop.querySelector('#v37-dc-save').onclick=async()=>{
      const save=backdrop.querySelector('#v37-dc-save'),err=backdrop.querySelector('#v37-dc-error');save.disabled=true;save.textContent='Cancelando...';
      const {data,error}=await sb.rpc('cancelar_doacao_capex',{p_id:d.id,p_motivo:backdrop.querySelector('#v37-dc-reason').value.trim()||null});
      if(error){save.disabled=false;save.textContent='Cancelar lançamento';err.innerHTML=`<div class="error-msg">${escapeHtml(error.message)}</div>`;return;}
      backdrop.remove();await loadDonationsContextV37();await loadReconciliationV37();await refreshCurrent();setTimeout(()=>openDonationPanelV371(),0);
      alert(`Doação cancelada. ${brl.format(Number(data?.valor_cancelado||d.valor))} retornou à OI ${d.ordem_interna_origem}.`);
    };
  }


  window.openDonationPanelV371 = openDonationPanelV371;
  async function openDonationPanelV371() {
    try { await loadDonationsContextV37(); } catch (e) { alert('Não foi possível carregar as doações: ' + e.message); return; }
    const all = state.v37.donations || [];
    const active = all.filter(x=>x.status==='ativo');
    const total = active.reduce((sum,x)=>sum+Number(x.valor||0),0);
    const hist = active.filter(x=>x.historica).reduce((sum,x)=>sum+Number(x.valor||0),0);
    const oper = active.filter(x=>!x.historica).reduce((sum,x)=>sum+Number(x.valor||0),0);
    const backdrop=document.createElement('div'); backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div class="modal-box modal-wide">
      <h2>Doações — Detalhamento</h2><p class="sub">Valores transferidos do nosso CAPEX para outros CAPEX da empresa.</p>
      <div class="history-summary"><div><span>Total de doações</span><strong style="color:var(--laranja)">${brl.format(total)}</strong></div><div><span>Históricas</span><strong>${brl.format(hist)}</strong></div><div><span>Operacionais</span><strong>${brl.format(oper)}</strong></div></div>
      ${state.role==='admin'?`<div class="modal-actions" style="margin-top:0;justify-content:flex-start"><button class="btn btn-primary" id="v371-d-new">+ Nova doação</button></div>`:''}
      <div class="v371-donation-panel-list">${renderDonationMonthsV373(all)}</div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v371-d-close">Fechar</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v371-d-close').onclick=()=>backdrop.remove();
    const nb=backdrop.querySelector('#v371-d-new'); if(nb) nb.onclick=()=>{backdrop.remove();openDonationCreateV37();};
    backdrop.querySelectorAll('.v37-edit-donation').forEach(btn=>{ btn.style.display=state.role==='admin'?'':'none'; btn.onclick=()=>{const d=all.find(x=>String(x.id)===btn.dataset.id);backdrop.remove();openDonationEditV37(d);}; });
    backdrop.querySelectorAll('.v37-cancel-donation').forEach(btn=>{ btn.style.display=state.role==='admin'?'':'none'; btn.onclick=()=>{const d=all.find(x=>String(x.id)===btn.dataset.id);backdrop.remove();openDonationCancelV37(d);}; });
    bindMonthAccordionsV374(backdrop);
  }


  const MONTH_NAMES_V373 = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function monthKeyV373(value, fallback='') {
    const s = String(value || fallback || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return 'sem-mes';
  }

  function monthLabelV373(key) {
    if (key === 'sem-mes') return 'Sem mês informado';
    const [y,m] = key.split('-').map(Number);
    return `${MONTH_NAMES_V373[(m||1)-1]} de ${y}`;
  }

  function renderDonationMonthsV373(all) {
    if (!all.length) return '<div class="empty-state">Nenhuma doação registrada.</div>';
    const groups = new Map();
    all.forEach(d => {
      const key = monthKeyV373(d.data_doacao, d.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    });
    const keys = [...groups.keys()].sort((a,b) => {
      if (a === 'sem-mes') return 1;
      if (b === 'sem-mes') return -1;
      return b.localeCompare(a);
    });
    return keys.map(key => {
      const rows = groups.get(key);
      const active = rows.filter(x => x.status === 'ativo');
      const total = active.reduce((s,x)=>s+Number(x.valor||0),0);
      return `<section class="v373-month-group">
        <div class="v373-month-head" role="button" tabindex="0" aria-expanded="false">
          <div class="v374-month-left"><span class="v374-chevron">▶</span><div class="v373-month-title">${escapeHtml(monthLabelV373(key))}</div></div>
          <div class="v373-month-summary"><strong style="color:var(--laranja)">${brl.format(total)}</strong>${active.length} lançamento(s) ativo(s)</div>
        </div>
        <div class="v373-month-body">${rows.map(renderDonationRowV37).join('')}</div>
      </section>`;
    }).join('');
  }

  function decorateMovementPanelMonthlyV373(type) {
    const backdrops = [...document.querySelectorAll('.modal-backdrop')];
    const backdrop = backdrops.reverse().find(b => b.querySelector('#v36-movement-list'));
    if (!backdrop) return;

    const list = backdrop.querySelector('#v36-movement-list');
    const movementRows = [...list.querySelectorAll(':scope > .v36-movement-row')];
    const movements = (window.HAP_V36?.movements || [])
      .filter(m => m.tipo === type && m?.metadata?.curva_sync_status !== 'cancelado');

    if (!movementRows.length || movementRows.length !== movements.length) return;

    // Botão de criação dentro do KPI; os botões originais permanecem ocultos para manter os handlers V36.
    if (state.role === 'admin' && !backdrop.querySelector('#v373-new-financial')) {
      const summary = backdrop.querySelector('.history-summary');
      if (summary) {
        const action = document.createElement('div');
        action.className = 'modal-actions';
        action.style.cssText = 'margin:8px 0 4px;justify-content:flex-start';
        action.innerHTML = `<button class="btn btn-primary" id="v373-new-financial">+ ${type === 'aporte' ? 'Novo aporte extra' : 'Novo contingenciamento'}</button>`;
        summary.insertAdjacentElement('afterend', action);
        action.querySelector('#v373-new-financial').onclick = () => {
          backdrop.remove();
          const trigger = document.getElementById(type === 'aporte' ? 'aporte-btn' : 'contingenciar-btn');
          if (trigger) trigger.click();
          else alert('A ação de cadastro não está disponível nesta tela.');
        };
      }
    }

    const groups = new Map();
    movements.forEach((m, idx) => {
      const key = monthKeyV373(m.mes, m.data_movimento || m.created_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ movement:m, node:movementRows[idx] });
    });

    const keys = [...groups.keys()].sort((a,b) => {
      if (a === 'sem-mes') return 1;
      if (b === 'sem-mes') return -1;
      return b.localeCompare(a);
    });

    list.innerHTML = '';
    keys.forEach(key => {
      const entries = groups.get(key);
      const total = entries.reduce((s,e)=>s+Number(e.movement.valor||0),0);
      const section = document.createElement('section');
      section.className = 'v373-month-group';
      section.innerHTML = `<div class="v373-month-head" role="button" tabindex="0" aria-expanded="false">
        <div class="v374-month-left"><span class="v374-chevron">▶</span><div class="v373-month-title">${escapeHtml(monthLabelV373(key))}</div></div>
        <div class="v373-month-summary"><strong style="color:${type === 'aporte' ? 'var(--verde)' : 'var(--vermelho)'}">${brl.format(total)}</strong>${entries.length} lançamento(s)</div>
      </div><div class="v373-month-body"></div>`;
      const body = section.querySelector('.v373-month-body');
      entries.forEach(e => {
        body.appendChild(e.node);
        if (e.movement?.metadata?.curva_categoria === 'manutencao') {
          const pill = e.node.querySelector('.v36-status-pill');
          if (pill) { pill.textContent = 'Integrado à Manutenção'; pill.className = 'v36-status-pill existing'; }
        }
      });
      list.appendChild(section);
    });

    const title = backdrop.querySelector('.history-section-title');
    if (title) title.textContent = 'Resumo mensal — clique em um mês para ver os lançamentos';
    bindMonthAccordionsV374(backdrop);
  }

  // V37.3: mantém toda a lógica V36 de edição/cancelamento e apenas reorganiza visualmente por mês.
  const originalOpenControlKpiPanelV373 = window.openControlKpiPanel;
  window.openControlKpiPanel = function(type) {
    const result = originalOpenControlKpiPanelV373(type);
    if (type === 'aportes' || type === 'contingenciamento') {
      const normalized = type === 'aportes' ? 'aporte' : 'contingenciamento';

      // V37.3.1 — o painel V36 é assíncrono: aguarda a consulta ao Supabase e a
      // montagem completa do modal antes de reorganizar visualmente por mês.
      Promise.resolve(result)
        .then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        .then(() => decorateMovementPanelMonthlyV373(normalized))
        .catch(error => console.warn('[HAPCAPEX V37.5] Falha ao agrupar painel por mês.', error));
    }
    return result;
  };


  function bindMonthAccordionsV374(root=document) {
    root.querySelectorAll('.v373-month-group').forEach(group => {
      const head = group.querySelector('.v373-month-head');
      if (!head || head.dataset.v374Bound === '1') return;
      head.dataset.v374Bound = '1';
      const toggle = () => {
        const open = group.classList.toggle('open');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }


  async function operationalOiExistsV375(oi) {
    const { data, error } = await sb.rpc('buscar_obra_por_oi', { p_ordem_interna: oi });
    if (error) throw error;
    return data || { existe:false };
  }

  async function loadClassificationsV375() {
    const { data, error } = await sb.rpc('get_classificacoes_existentes');
    if (error) return null;
    return data || null;
  }

  function openCreateOrderForAporteV375(aporte, onCreated) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.v375CreateOi = '1';
    backdrop.innerHTML = `<div class="modal-box modal-wide">
      <h2>Criar nova ordem interna</h2>
      <p class="sub">A OI ${escapeHtml(aporte.oi)} ainda não existe. Cadastre-a para continuar o aporte operacional.</p>
      <div class="v375-flow-banner">
        <strong>Engrenagem do aporte operacional</strong>
        <div class="v375-flow-steps">
          <span class="v375-flow-step">1 · Aporte informado</span>
          <span class="v375-flow-step active">2 · Criar nova OI</span>
          <span class="v375-flow-step">3 · Confirmar aporte</span>
          <span class="v375-flow-step">4 · Planejar agora ou depois</span>
        </div>
      </div>
      <div id="v375-create-error"></div>
      <div class="grid-2">
        <div class="field"><label>Ordem interna *</label><input id="v375-f-oi" value="${escapeHtml(aporte.oi)}" readonly></div>
        <div class="field"><label>Descrição / obra *</label><input id="v375-f-desc" value="${escapeHtml(aporte.name || '')}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Classificação pacote CAPEX *</label><input id="v375-f-pacote" list="v375-dl-pacote"><datalist id="v375-dl-pacote"></datalist></div>
        <div class="field"><label>Classificação HEAD operação *</label><input id="v375-f-head" list="v375-dl-head"><datalist id="v375-dl-head"></datalist></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Grupo executivo *</label><input id="v375-f-grupo" list="v375-dl-grupo"><datalist id="v375-dl-grupo"></datalist></div>
        <div class="field"><label>Detalhamento *</label><input id="v375-f-detalhamento" list="v375-dl-detalhamento"><datalist id="v375-dl-detalhamento"></datalist></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Categoria ORC *</label><input id="v375-f-categoria" list="v375-dl-categoria"><datalist id="v375-dl-categoria"></datalist></div>
        <div class="field"><label>Detalhamento ORC *</label><input id="v375-f-detalhamento-orc" list="v375-dl-detalhamento-orc"><datalist id="v375-dl-detalhamento-orc"></datalist></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Data de início (opcional)</label><input type="date" id="v375-f-data-inicio"></div>
        <div class="field"><label>Data de fim (opcional)</label><input type="date" id="v375-f-data-fim"></div>
      </div>
      <div class="v375-create-note">O Montante inicial desta nova OI será R$ 0,00. O valor do aporte será acrescentado automaticamente na etapa seguinte, evitando dupla contagem.</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="v375-create-cancel">Voltar ao aporte</button>
        <button class="btn btn-primary" id="v375-create-save">Criar OI e continuar</button>
      </div>
    </div>`;
    document.body.appendChild(backdrop);

    const putOptions = (id, values) => {
      const el = backdrop.querySelector('#'+id);
      if (!el || !Array.isArray(values)) return;
      el.innerHTML = values.map(v => `<option value="${escapeHtml(String(v))}">`).join('');
    };
    loadClassificationsV375().then(data => {
      if (!data) return;
      putOptions('v375-dl-pacote', data.classificacao_pacote_capex);
      putOptions('v375-dl-head', data.classificacao_head_operacao);
      putOptions('v375-dl-grupo', data.grupo_executivo);
      putOptions('v375-dl-detalhamento', data.detalhamento);
      putOptions('v375-dl-categoria', data.categoria_orc);
      putOptions('v375-dl-detalhamento-orc', data.detalhamento_orc);
    }).catch(()=>{});

    const pacoteInputV377 = backdrop.querySelector('#v375-f-pacote');
    if (pacoteInputV377) {
      const maintenanceHint = document.createElement('div');
      maintenanceHint.className = 'v375-create-note';
      maintenanceHint.style.display = 'none';
      maintenanceHint.innerHTML = '<strong>Manutenção Dia a Dia:</strong> esta OI será criada somente na aba Manutenção da Curva. Não haverá CAPEX individual, datas de planejamento ou regra de fluxo; os valores realizados virão automaticamente da Base Consumo.';
      pacoteInputV377.closest('.field')?.insertAdjacentElement('afterend', maintenanceHint);
      const refreshHint = () => { maintenanceHint.style.display = String(pacoteInputV377.value || '').trim() === 'Manutenção Dia a Dia' ? 'block' : 'none'; };
      pacoteInputV377.addEventListener('input', refreshHint);
      pacoteInputV377.addEventListener('change', refreshHint);
      refreshHint();
    }

    backdrop.querySelector('#v375-create-cancel').onclick = () => backdrop.remove();
    backdrop.querySelector('#v375-create-save').onclick = async () => {
      const save = backdrop.querySelector('#v375-create-save');
      const err = backdrop.querySelector('#v375-create-error');
      const payload = {
        p_ordem_interna: aporte.oi,
        p_descricao: backdrop.querySelector('#v375-f-desc').value.trim(),
        p_grupo_executivo: backdrop.querySelector('#v375-f-grupo').value.trim(),
        p_categoria_orc: backdrop.querySelector('#v375-f-categoria').value.trim(),
        p_classificacao_pacote_capex: backdrop.querySelector('#v375-f-pacote').value.trim(),
        p_classificacao_head_operacao: backdrop.querySelector('#v375-f-head').value.trim(),
        p_detalhamento: backdrop.querySelector('#v375-f-detalhamento').value.trim(),
        p_detalhamento_orc: backdrop.querySelector('#v375-f-detalhamento-orc').value.trim(),
        p_montante_atribuido: 0,
        p_valor_compromissado: 0,
        p_data_inicio: backdrop.querySelector('#v375-f-data-inicio').value || null,
        p_data_fim: backdrop.querySelector('#v375-f-data-fim').value || null
      };
      const required = [
        ['p_descricao','Descrição / obra'],['p_grupo_executivo','Grupo executivo'],
        ['p_categoria_orc','Categoria ORC'],['p_classificacao_pacote_capex','Classificação pacote CAPEX'],
        ['p_classificacao_head_operacao','Classificação HEAD operação'],['p_detalhamento','Detalhamento'],
        ['p_detalhamento_orc','Detalhamento ORC']
      ];
      const missing = required.filter(([key]) => !payload[key]).map(([,label]) => label);
      if (missing.length) {
        err.innerHTML = `<div class="error-msg">Preencha os campos obrigatórios: ${missing.join(', ')}.</div>`;
        return;
      }
      save.disabled = true;
      save.textContent = 'Criando OI...';
      try {
        const { error } = await sb.rpc('criar_ordem_interna', payload);
        if (error) throw error;
        backdrop.remove();
        await onCreated();
      } catch(error) {
        save.disabled = false;
        save.textContent = 'Criar OI e continuar';
        err.innerHTML = `<div class="error-msg">${escapeHtml(error.message)}</div>`;
      }
    };
  }

  function readOperationalAporteFormV375(box) {
    return {
      oi: box.querySelector('#v36-a-oi')?.value?.trim() || '',
      value: Number(box.querySelector('#v36-a-valor')?.value || 0),
      mes: box.querySelector('#v36-a-mes')?.value || '',
      name: box.querySelector('#v36-a-nome')?.value?.trim() || '',
      obs: box.querySelector('#v36-a-obs')?.value?.trim() || ''
    };
  }

  function validateOperationalAporteV375(aporte, err) {
    if (!aporte.oi || !aporte.mes || aporte.value <= 0) {
      if (err) err.innerHTML = '<div class="error-msg">Informe OI, mês e valor maior que zero.</div>';
      return false;
    }
    return true;
  }

  async function ensureOrderThenV375(aporte, continuation) {
    let info = await operationalOiExistsV375(aporte.oi);
    if (info?.existe) return continuation(info);
    return new Promise((resolve, reject) => {
      openCreateOrderForAporteV375(aporte, async () => {
        try {
          info = await operationalOiExistsV375(aporte.oi);
          if (!info?.existe) throw new Error('A OI foi criada, mas ainda não pôde ser localizada para concluir o aporte.');
          resolve(await continuation(info));
        } catch(e) { reject(e); }
      });
    });
  }

  function isMaintenanceOiV377(info) {
    const classification = String(info?.classificacao_pacote_capex || info?.pacote || '').trim();
    return info?.eh_manutencao_dia_a_dia === true || classification === 'Manutenção Dia a Dia';
  }

  async function registerMaintenanceAporteV377(aporte, backdrop) {
    const { data, error } = await sb.rpc('registrar_aporte_integrado', {
      p_modo: 'operacional', p_ordem_interna: aporte.oi, p_valor: aporte.value,
      p_mes: aporte.mes, p_nome: aporte.name || null, p_observacao: aporte.obs || null,
      p_planejamento: {}
    });
    if (error) throw error;
    backdrop.remove();
    if (window.HAP_V36) window.HAP_V36.loading = null;
    await refreshCurrent();
    alert(`Aporte operacional registrado na OI de Manutenção.

Valor: ${brl.format(aporte.value)}
OI: ${aporte.oi}

Esta OI pertence a Manutenção Dia a Dia: ela permanece somente na aba Manutenção da Curva e não exige planejamento individual.`);
    return data;
  }


  function relabelAporteWorkNameV3791(backdrop) {
    if (!backdrop) return;
    const input = backdrop.querySelector('#v36-a-nome');
    if (!input) return;
    const field = input.closest('.field');
    const label = field?.querySelector('label');
    if (label && label.textContent.trim() !== 'Nome da Obra') {
      label.textContent = 'Nome da Obra';
    }
  }

  function enhanceOperationalAporteModalV374(backdrop) {
    if (!backdrop || backdrop.dataset.v374Enhanced === '1') return;
    const box = backdrop.querySelector('.modal-box');
    const heading = box?.querySelector('h2')?.textContent?.trim() || '';
    if (heading !== 'Registrar aporte operacional') return;
    const next = box.querySelector('#v36-a-next');
    if (!next) return;

    backdrop.dataset.v374Enhanced = '1';
    const originalPlanNow = next.onclick;

    const note = document.createElement('div');
    note.className = 'v374-plan-later-note';
    note.innerHTML = '<strong>Planejamento opcional:</strong> registre o aporte agora e planeje sua entrada na Curva posteriormente, ou conclua as duas etapas de uma vez.';
    const actions = next.closest('.modal-actions');
    actions?.insertAdjacentElement('beforebegin', note);

    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'btn btn-secondary';
    later.id = 'v374-save-later';
    later.textContent = 'Registrar e planejar depois';
    actions?.insertBefore(later, next);
    next.textContent = 'Registrar e planejar agora';

    later.onclick = async () => {
      const aporte = readOperationalAporteFormV375(box);
      const err = box.querySelector('#v36-entry-error');
      if (!validateOperationalAporteV375(aporte, err)) return;
      later.disabled = true; next.disabled = true; later.textContent = 'Verificando OI...';

      const registerLater = async (info) => {
        later.textContent = 'Registrando aporte...';
        if (isMaintenanceOiV377(info)) return registerMaintenanceAporteV377(aporte, backdrop);
        const { data, error } = await sb.rpc('registrar_aporte_integrado', {
          p_modo: 'operacional', p_ordem_interna: aporte.oi, p_valor: aporte.value,
          p_mes: aporte.mes, p_nome: aporte.name || null, p_observacao: aporte.obs || null,
          p_planejamento: {}
        });
        if (error) throw error;
        backdrop.remove();
        if (window.HAP_V36) window.HAP_V36.loading = null;
        await refreshCurrent();
        alert(`Aporte operacional registrado no Controle.

Valor: ${brl.format(aporte.value)}
OI: ${aporte.oi}

O planejamento da Curva ficou pendente e poderá ser feito depois pelo botão "Planejar na Curva".`);
        return data;
      };

      try {
        await ensureOrderThenV375(aporte, registerLater);
      } catch(error) {
        later.disabled = false; next.disabled = false;
        later.textContent = 'Registrar e planejar depois';
        if (err) err.innerHTML = `<div class="error-msg">${escapeHtml(error.message)}</div>`;
      }
    };

    next.onclick = async () => {
      const aporte = readOperationalAporteFormV375(box);
      const err = box.querySelector('#v36-entry-error');
      if (!validateOperationalAporteV375(aporte, err)) return;
      next.disabled = true; later.disabled = true; next.textContent = 'Verificando OI...';
      try {
        await ensureOrderThenV375(aporte, async (info) => {
          if (isMaintenanceOiV377(info)) {
            next.textContent = 'Registrando manutenção...';
            return registerMaintenanceAporteV377(aporte, backdrop);
          }
          next.disabled = false; later.disabled = false;
          next.textContent = 'Registrar e planejar agora';
          if (typeof originalPlanNow === 'function') return originalPlanNow.call(next);
        });
      } catch(error) {
        next.disabled = false; later.disabled = false;
        next.textContent = 'Registrar e planejar agora';
        if (err) err.innerHTML = `<div class="error-msg">${escapeHtml(error.message)}</div>`;
      }
    };
  }

  function watchFinancialModalsV374() {
    if (window.__HAP_V374_MODAL_OBSERVER__) return;
    window.__HAP_V374_MODAL_OBSERVER__ = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('.modal-backdrop')) {
            relabelAporteWorkNameV3791(node);
            enhanceOperationalAporteModalV374(node);
            enhanceTransferModalV376(node);
          }
          node.querySelectorAll?.('.modal-backdrop').forEach(modal => {
            relabelAporteWorkNameV3791(modal);
            enhanceOperationalAporteModalV374(modal);
            enhanceTransferModalV376(modal);
          });
        }
      }
    });
    window.__HAP_V374_MODAL_OBSERVER__.observe(document.body, { childList: true, subtree: false });
  }


  function readTransferDraftV376(backdrop) {
    const rows = [...backdrop.querySelectorAll('.linha-transf')];
    return {
      documento: backdrop.querySelector('#t-doc')?.value?.trim() || null,
      data: backdrop.querySelector('#t-data')?.value || null,
      itens: rows.map(row => {
        const idx = row.dataset.idx;
        return {
          idx,
          oi_origem: backdrop.querySelector(`#t-origem-${idx}`)?.value?.trim() || '',
          oi_destino: backdrop.querySelector(`#t-destino-${idx}`)?.value?.trim() || '',
          valor: Number(backdrop.querySelector(`#t-valor-${idx}`)?.value || 0),
          justificativa: backdrop.querySelector(`#t-justificativa-${idx}`)?.value?.trim() || null,
          confirma_pacotes_diferentes: !!backdrop.querySelector(`#t-confirma-${idx}`)?.checked
        };
      })
    };
  }

  async function lookupOiV376(oi) {
    const { data, error } = await sb.rpc('buscar_obra_por_oi', { p_ordem_interna: oi });
    if (error) throw error;
    return data || { existe:false };
  }

  async function createTransferDestinationV376(oi) {
    return new Promise(async (resolve, reject) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.dataset.v376CreateTransferOi = '1';
      backdrop.innerHTML = `<div class="modal-box modal-wide">
        <h2>Criar nova ordem interna</h2>
        <p class="sub">A OI destino ${escapeHtml(oi)} ainda não existe. Cadastre-a para continuar a transferência.</p>
        <div class="v375-flow-banner">
          <strong>Engrenagem da transferência</strong>
          <div class="v375-flow-steps">
            <span class="v375-flow-step">1 · Transferência informada</span>
            <span class="v375-flow-step active">2 · Criar OI destino</span>
            <span class="v375-flow-step">3 · Revisar documento</span>
            <span class="v375-flow-step">4 · Confirmar transferência</span>
          </div>
        </div>
        <div id="v376-create-error"></div>
        <div class="grid-2">
          <div class="field"><label>Ordem interna *</label><input id="v376-f-oi" value="${escapeHtml(oi)}" readonly></div>
          <div class="field"><label>Descrição / obra *</label><input id="v376-f-desc"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Classificação pacote CAPEX *</label><input id="v376-f-pacote" list="v376-dl-pacote"><datalist id="v376-dl-pacote"></datalist></div>
          <div class="field"><label>Classificação HEAD operação *</label><input id="v376-f-head" list="v376-dl-head"><datalist id="v376-dl-head"></datalist></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Grupo executivo *</label><input id="v376-f-grupo" list="v376-dl-grupo"><datalist id="v376-dl-grupo"></datalist></div>
          <div class="field"><label>Detalhamento *</label><input id="v376-f-detalhamento" list="v376-dl-detalhamento"><datalist id="v376-dl-detalhamento"></datalist></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Categoria ORC *</label><input id="v376-f-categoria" list="v376-dl-categoria"><datalist id="v376-dl-categoria"></datalist></div>
          <div class="field"><label>Detalhamento ORC *</label><input id="v376-f-detalhamento-orc" list="v376-dl-detalhamento-orc"><datalist id="v376-dl-detalhamento-orc"></datalist></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Data de início (opcional)</label><input type="date" id="v376-f-data-inicio"></div>
          <div class="field"><label>Data de fim (opcional)</label><input type="date" id="v376-f-data-fim"></div>
        </div>
        <div class="v375-create-note">A nova OI será criada com Montante e Compromissado em R$ 0,00. A transferência acrescentará o valor somente depois da confirmação do documento.</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="v376-create-cancel">Voltar à transferência</button>
          <button class="btn btn-primary" id="v376-create-save">Criar OI e continuar</button>
        </div>
      </div>`;
      document.body.appendChild(backdrop);

      const putOptions = (id, values) => {
        const el = backdrop.querySelector('#'+id);
        if (!el || !Array.isArray(values)) return;
        el.innerHTML = values.map(v => `<option value="${escapeHtml(String(v))}">`).join('');
      };
      try {
        const data = await loadClassificationsV375();
        if (data) {
          putOptions('v376-dl-pacote', data.classificacao_pacote_capex);
          putOptions('v376-dl-head', data.classificacao_head_operacao);
          putOptions('v376-dl-grupo', data.grupo_executivo);
          putOptions('v376-dl-detalhamento', data.detalhamento);
          putOptions('v376-dl-categoria', data.categoria_orc);
          putOptions('v376-dl-detalhamento-orc', data.detalhamento_orc);
        }
      } catch (_) {}

      const pacoteTransferV377 = backdrop.querySelector('#v376-f-pacote');
      if (pacoteTransferV377) {
        const maintenanceHint = document.createElement('div');
        maintenanceHint.className = 'v375-create-note';
        maintenanceHint.style.display = 'none';
        maintenanceHint.innerHTML = '<strong>Manutenção Dia a Dia:</strong> a OI destino será criada somente na aba Manutenção da Curva e receberá apenas valores realizados da Base Consumo. Não existe planejamento individual para este pacote.';
        pacoteTransferV377.closest('.field')?.insertAdjacentElement('afterend', maintenanceHint);
        const refreshHint = () => { maintenanceHint.style.display = String(pacoteTransferV377.value || '').trim() === 'Manutenção Dia a Dia' ? 'block' : 'none'; };
        pacoteTransferV377.addEventListener('input', refreshHint);
        pacoteTransferV377.addEventListener('change', refreshHint);
        refreshHint();
      }

      backdrop.querySelector('#v376-create-cancel').onclick = () => {
        backdrop.remove();
        resolve(false);
      };
      backdrop.querySelector('#v376-create-save').onclick = async () => {
        const save = backdrop.querySelector('#v376-create-save');
        const err = backdrop.querySelector('#v376-create-error');
        const payload = {
          p_ordem_interna: oi,
          p_descricao: backdrop.querySelector('#v376-f-desc').value.trim(),
          p_grupo_executivo: backdrop.querySelector('#v376-f-grupo').value.trim(),
          p_categoria_orc: backdrop.querySelector('#v376-f-categoria').value.trim(),
          p_classificacao_pacote_capex: backdrop.querySelector('#v376-f-pacote').value.trim(),
          p_classificacao_head_operacao: backdrop.querySelector('#v376-f-head').value.trim(),
          p_detalhamento: backdrop.querySelector('#v376-f-detalhamento').value.trim(),
          p_detalhamento_orc: backdrop.querySelector('#v376-f-detalhamento-orc').value.trim(),
          p_montante_atribuido: 0,
          p_valor_compromissado: 0,
          p_data_inicio: backdrop.querySelector('#v376-f-data-inicio').value || null,
          p_data_fim: backdrop.querySelector('#v376-f-data-fim').value || null
        };
        const required = [
          ['p_descricao','Descrição / obra'],['p_grupo_executivo','Grupo executivo'],
          ['p_categoria_orc','Categoria ORC'],['p_classificacao_pacote_capex','Classificação pacote CAPEX'],
          ['p_classificacao_head_operacao','Classificação HEAD operação'],['p_detalhamento','Detalhamento'],
          ['p_detalhamento_orc','Detalhamento ORC']
        ];
        const missing = required.filter(([key]) => !payload[key]).map(([,label]) => label);
        if (missing.length) {
          err.innerHTML = `<div class="error-msg">Preencha os campos obrigatórios: ${missing.join(', ')}.</div>`;
          return;
        }
        save.disabled = true;
        save.textContent = 'Criando OI...';
        try {
          const { error } = await sb.rpc('criar_ordem_interna', payload);
          if (error) throw error;
          backdrop.remove();
          resolve(true);
        } catch(error) {
          save.disabled = false;
          save.textContent = 'Criar OI e continuar';
          err.innerHTML = `<div class="error-msg">${escapeHtml(error.message)}</div>`;
        }
      };
    });
  }

  async function ensureTransferOisV376(draft, originalBackdrop) {
    const uniqueOrigins = [...new Set(draft.itens.map(x=>x.oi_origem).filter(Boolean))];
    const uniqueDestinations = [...new Set(draft.itens.map(x=>x.oi_destino).filter(Boolean))];
    const cache = new Map();

    for (const oi of uniqueOrigins) {
      const info = await lookupOiV376(oi);
      cache.set(oi, info);
      if (!info?.existe) throw new Error(`A OI de origem ${oi} não existe. A origem precisa possuir saldo antes de transferir.`);
    }

    for (const oi of uniqueDestinations) {
      let info = cache.get(oi);
      if (!info) {
        info = await lookupOiV376(oi);
        cache.set(oi, info);
      }
      if (!info?.existe) {
        const created = await createTransferDestinationV376(oi);
        if (!created) return null;
        info = await lookupOiV376(oi);
        if (!info?.existe) throw new Error(`A OI ${oi} foi criada, mas não pôde ser localizada após o cadastro.`);
        cache.set(oi, info);
        const idxs = draft.itens.filter(x=>x.oi_destino===oi).map(x=>x.idx);
        idxs.forEach(idx => {
          const el = originalBackdrop.querySelector(`#t-destino-nome-${idx}`);
          if (el) { el.textContent = info.nome || 'OI criada'; el.style.color='var(--verde)'; }
        });
      }
    }

    return cache;
  }

  function openTransferReviewV376(originalBackdrop, draft, cache) {
    const total = draft.itens.reduce((s,x)=>s+Number(x.valor||0),0);
    const packageDiffs = draft.itens.map((item, i) => {
      const origem = cache.get(item.oi_origem) || {};
      const destino = cache.get(item.oi_destino) || {};
      return {
        i, different: !!(origem.pacote && destino.pacote && origem.pacote !== destino.pacote),
        origem, destino
      };
    });

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.v376TransferReview = '1';
    backdrop.innerHTML = `<div class="modal-box v35-modal-xl">
      <h2>Revisar transferência</h2>
      <p class="sub">Confira todas as informações antes da gravação. Nenhuma transferência foi executada ainda.</p>
      <div class="v35-summary-grid">
        <div class="v35-summary-card"><span>Documento</span><strong>${escapeHtml(draft.documento || 'Não informado')}</strong></div>
        <div class="v35-summary-card"><span>Data</span><strong>${draft.data ? new Date(draft.data+'T12:00:00').toLocaleDateString('pt-BR') : 'Não informada'}</strong></div>
        <div class="v35-summary-card"><span>Linhas</span><strong>${draft.itens.length}</strong></div>
        <div class="v35-summary-card"><span>Valor total</span><strong>${brl.format(total)}</strong></div>
      </div>
      <div id="v376-review-error"></div>
      <div style="overflow:auto;max-height:48vh;border:1px solid var(--cinza-borda);border-radius:9px">
        <table class="v376-review-table">
          <thead><tr><th>#</th><th>OI origem</th><th>OI destino</th><th>Valor</th><th>Justificativa</th><th>Pacotes</th></tr></thead>
          <tbody>${draft.itens.map((item,i)=>{
            const p=packageDiffs[i], origem=p.origem, destino=p.destino;
            return `<tr>
              <td>${i+1}</td>
              <td><strong>${escapeHtml(item.oi_origem)}</strong><div class="v376-flow-line">${escapeHtml(origem.nome||'—')}</div></td>
              <td><strong>${escapeHtml(item.oi_destino)}</strong><div class="v376-flow-line">${escapeHtml(destino.nome||'—')}</div></td>
              <td style="white-space:nowrap;font-weight:800">${brl.format(Number(item.valor||0))}</td>
              <td>${escapeHtml(item.justificativa||'—')}</td>
              <td><div class="v376-flow-line">${escapeHtml(origem.pacote||'—')} → ${escapeHtml(destino.pacote||'—')}</div>
                ${p.different ? `<label style="display:block;margin-top:5px;font-size:9px;font-weight:700;color:var(--amarelo-texto)"><input type="checkbox" class="v376-package-confirm" data-index="${i}" ${item.confirma_pacotes_diferentes?'checked':''}> Confirmo transferência entre pacotes diferentes</label>` : ''}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <div class="v376-review-total"><span>Total do documento</span><strong>${brl.format(total)}</strong></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="v376-review-back">Voltar e editar</button>
        <button class="btn btn-primary" id="v376-review-confirm">Confirmar transferência${draft.itens.length>1?'s':''}</button>
      </div>
    </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#v376-review-back').onclick = () => backdrop.remove();
    backdrop.querySelector('#v376-review-confirm').onclick = async () => {
      const err = backdrop.querySelector('#v376-review-error');
      const missingConfirm = packageDiffs.some((p,i) => p.different && !backdrop.querySelector(`.v376-package-confirm[data-index="${i}"]`)?.checked);
      if (missingConfirm) {
        err.innerHTML = '<div class="error-msg">Há transferência entre pacotes CAPEX diferentes. Confirme cada linha destacada antes de prosseguir.</div>';
        return;
      }
      const btn = backdrop.querySelector('#v376-review-confirm');
      btn.disabled = true;
      btn.textContent = 'Registrando...';
      const itens = draft.itens.map((item,i)=>({
        oi_origem:item.oi_origem,
        oi_destino:item.oi_destino,
        valor:Number(item.valor||0),
        justificativa:item.justificativa,
        confirma_pacotes_diferentes: packageDiffs[i].different
          ? !!backdrop.querySelector(`.v376-package-confirm[data-index="${i}"]`)?.checked
          : !!item.confirma_pacotes_diferentes
      }));
      try {
        const { error } = await sb.rpc('criar_transferencias_lote', {
          p_numero_documento: draft.documento,
          p_data: draft.data,
          p_itens: itens
        });
        if (error) throw error;
        backdrop.remove();
        originalBackdrop.remove();
        await refreshCurrent();
        alert(`Transferência${itens.length>1?'s':''} registrada${itens.length>1?'s':''} com sucesso.\n\n${itens.length} linha(s)\nTotal do documento: ${brl.format(total)}`);
      } catch(error) {
        btn.disabled = false;
        btn.textContent = `Confirmar transferência${draft.itens.length>1?'s':''}`;
        err.innerHTML = `<div class="error-msg">${escapeHtml(error.message)}</div>`;
      }
    };
  }

  function enhanceTransferModalV376(backdrop) {
    if (!backdrop || backdrop.dataset.v376Enhanced === '1') return;
    const box = backdrop.querySelector('.modal-box');
    if (box?.querySelector('h2')?.textContent?.trim() !== 'Nova transferência') return;
    const save = backdrop.querySelector('#modal-save');
    if (!save || !backdrop.querySelector('#linhas-container')) return;
    backdrop.dataset.v376Enhanced = '1';

    save.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const err = backdrop.querySelector('#modal-error');
      const draft = readTransferDraftV376(backdrop);
      if (!draft.itens.length) {
        err.innerHTML = '<div class="error-msg">Adicione ao menos uma linha de transferência.</div>';
        return;
      }
      for (const item of draft.itens) {
        if (!item.oi_origem || !item.oi_destino || !Number.isFinite(item.valor) || item.valor <= 0) {
          err.innerHTML = '<div class="error-msg">Preencha origem, destino e valor maior que zero em todas as linhas.</div>';
          return;
        }
        if (item.oi_origem === item.oi_destino) {
          err.innerHTML = `<div class="error-msg">A OI ${escapeHtml(item.oi_origem)} não pode transferir verba para ela mesma.</div>`;
          return;
        }
      }

      save.disabled = true;
      const oldText = save.textContent;
      save.textContent = 'Validando ordens...';
      try {
        const cache = await ensureTransferOisV376(draft, backdrop);
        if (!cache) {
          save.disabled = false;
          save.textContent = oldText;
          return;
        }
        save.disabled = false;
        save.textContent = oldText;
        err.innerHTML = '';
        openTransferReviewV376(backdrop, draft, cache);
      } catch(error) {
        save.disabled = false;
        save.textContent = oldText;
        err.innerHTML = `<div class="error-msg">${escapeHtml(error.message)}</div>`;
      }
    }, true);
  }


  async function refreshNotificationsV371(forceRefresh=true) {
    initState();
    try {
      if (forceRefresh) {
        const {error:refreshError}=await sb.rpc('refresh_controle_capex_notifications');
        if (refreshError) console.warn('[HAPCAPEX V37.1] Falha ao atualizar alertas:',refreshError.message);
      }
      const {data,error}=await sb.from('vw_controle_notificacoes').select('*').order('updated_at',{ascending:false});
      if (error) throw error;
      state.v37.notifications=data||[];
    } catch(e) { console.warn('[HAPCAPEX V37.1] Central de notificações:',e); }
    return state.v37.notifications||[];
  }

  function decorateNotificationButtonV371() {
    const chip=document.querySelector('.user-chip'); if(!chip) return;
    let btn=document.getElementById('v371-notif-btn');
    const unread=(state.v37?.notifications||[]).filter(n=>!n.lida).length;
    if(!btn){
      btn=document.createElement('button'); btn.id='v371-notif-btn'; btn.type='button'; btn.className='btn btn-secondary v371-bell';
      const switchBtn=[...chip.querySelectorAll('button')].find(b=>/Trocar sistema/i.test(b.textContent||''));
      if(switchBtn) chip.insertBefore(btn,switchBtn); else chip.appendChild(btn);
    }
    btn.innerHTML=`🔔 Notificações ${unread?`<span class="v371-badge">${unread>99?'99+':unread}</span>`:''}`;
    btn.onclick=openNotificationCenterV371;
  }

  function priorityLabelV371(p){ return p==='critical'?'Crítica':p==='warning'?'Atenção':'Informativa'; }
  function notificationDateV371(v){ try{return new Date(v).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(_){return String(v||'');} }

  window.openNotificationCenterV371 = openNotificationCenterV371;
  async function openNotificationCenterV371() {
    await refreshNotificationsV371(true);
    const backdrop=document.createElement('div'); backdrop.className='modal-backdrop'; backdrop.id='v371-notif-modal';
    backdrop.innerHTML='<div class="modal-box modal-wide" id="v371-notif-body"></div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});
    renderNotificationCenterV371(backdrop);
  }

  function renderNotificationCenterV371(backdrop) {
    const body=backdrop.querySelector('#v371-notif-body'); if(!body)return;
    const all=state.v37.notifications||[];
    const categories=['Todas',...new Set(all.map(n=>n.categoria).filter(Boolean))];
    const filtered=all.filter(n=>(state.v37.notificationCategory==='Todas'||n.categoria===state.v37.notificationCategory)&&(!state.v37.notificationUnreadOnly||!n.lida));
    const unread=all.filter(n=>!n.lida).length, critical=all.filter(n=>!n.lida&&n.priority==='critical').length, warning=all.filter(n=>!n.lida&&n.priority==='warning').length;
    const groups=[...new Set(filtered.map(n=>n.categoria||'Sistema'))];
    body.innerHTML=`<h2>Central de Notificações</h2><p class="sub">Alertas inteligentes do HAPCAPEX, organizados por assunto e com leitura individual por usuário.</p>
      <div class="v371-notif-summary"><div><span>Não lidas</span><strong>${unread}</strong></div><div><span>Críticas</span><strong style="color:var(--vermelho)">${critical}</strong></div><div><span>Atenção</span><strong style="color:#a66d00">${warning}</strong></div><div><span>Total ativo</span><strong>${all.length}</strong></div></div>
      <div class="v371-notif-filters">${categories.map(c=>`<button class="v371-notif-filter ${state.v37.notificationCategory===c?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}<label style="font-size:9px;margin-left:auto"><input type="checkbox" id="v371-unread-only" ${state.v37.notificationUnreadOnly?'checked':''}> somente não lidas</label></div>
      <div>${filtered.length?groups.map(g=>`<div class="v371-notif-group"><div class="v371-notif-group-title">${escapeHtml(g)}</div>${filtered.filter(n=>(n.categoria||'Sistema')===g).map(renderNotificationV371).join('')}</div>`).join(''):'<div class="empty-state">Nenhuma notificação para este filtro.</div>'}</div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v371-refresh">Atualizar alertas</button>${unread?'<button class="btn btn-secondary" id="v371-mark-all">Marcar todas como lidas</button>':''}<button class="btn btn-primary" id="v371-close">Fechar</button></div>`;
    body.querySelectorAll('.v371-notif-filter').forEach(b=>b.onclick=()=>{state.v37.notificationCategory=b.dataset.cat;renderNotificationCenterV371(backdrop);});
    body.querySelector('#v371-unread-only').onchange=e=>{state.v37.notificationUnreadOnly=e.target.checked;renderNotificationCenterV371(backdrop);};
    body.querySelectorAll('[data-read-id]').forEach(b=>b.onclick=async()=>{const {error}=await sb.rpc('mark_capex_notification_read',{p_notification_id:b.dataset.readId});if(error){alert(error.message);return;}await refreshNotificationsV371(false);decorateNotificationButtonV371();renderNotificationCenterV371(backdrop);});
    body.querySelector('#v371-refresh').onclick=async()=>{await refreshNotificationsV371(true);decorateNotificationButtonV371();renderNotificationCenterV371(backdrop);};
    const ma=body.querySelector('#v371-mark-all'); if(ma) ma.onclick=async()=>{const {error}=await sb.rpc('mark_all_capex_notifications_read');if(error){alert(error.message);return;}await refreshNotificationsV371(false);decorateNotificationButtonV371();renderNotificationCenterV371(backdrop);};
    body.querySelector('#v371-close').onclick=()=>backdrop.remove();
  }

  function renderNotificationV371(n) {
    return `<div class="v371-notif ${escapeHtml(n.priority||'info')} ${n.lida?'':'unread'}"><div class="v371-notif-head"><div><div class="v371-notif-title">${escapeHtml(n.title)}</div><div class="v371-notif-msg">${escapeHtml(n.message)}</div></div><div class="v371-notif-meta">${priorityLabelV371(n.priority)} · ${notificationDateV371(n.updated_at||n.created_at)}</div></div>${!n.lida?`<div class="v371-notif-actions"><button class="btn btn-secondary" data-read-id="${n.id}">Marcar como lida</button></div>`:''}</div>`;
  }

  async function loadAuditTabV37() {
    initState();
    if (state.role !== 'admin') { state.tab='capex'; return originalRefreshCurrent(); }
    const {data,error}=await fetchAllRows('vw_controle_auditoria_v37','created_at',false);
    if(error){app.innerHTML=`<div class="error-msg" style="margin:40px">Erro ao carregar Auditoria: ${escapeHtml(error.message)}</div>`;return;}
    state.v37.audit=data||[];
    renderAuditTabV37();
  }

  function auditDateV37(value) {
    if(!value) return '—';
    try { return new Date(value).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
    catch(_) { return String(value); }
  }

  function auditLocalDayV394(value){
    try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
    catch(_){return String(value||'—');}
  }
  function auditIsoDayV394(value){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
      const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      return `${m.year}-${m.month}-${m.day}`;
    }catch(_){return String(value||'').slice(0,10);}
  }
  function auditPeriodRangeV394(period){
    if(!period||period==='all'||period==='custom')return null;
    const now=new Date();
    const end=new Date(now);
    const start=new Date(now);
    if(period==='today') start.setHours(0,0,0,0);
    else start.setDate(start.getDate()-(Number(period)-1));
    const fmt=d=>d.toISOString().slice(0,10);
    return {start:fmt(start),end:fmt(end)};
  }

  function renderAuditTabV37() {
    const a=state.v37.audit||[], f=state.v37;
    const users=[...new Map(a.filter(x=>x.actor_id||x.usuario_email).map(x=>[x.actor_id||x.usuario_email,{id:x.actor_id||x.usuario_email,label:`${x.usuario_nome} <${x.usuario_email}>`}])).values()].sort((x,y)=>x.label.localeCompare(y.label));
    const actions=[...new Set(a.map(x=>x.acao).filter(Boolean))].sort();
    const modules=[...new Set(a.map(x=>x.modulo).filter(Boolean))].sort();
    const types=[...new Set(a.map(x=>x.tipo_auditoria).filter(Boolean))].sort();
    const statuses=[...new Set(a.map(x=>x.status_evento).filter(Boolean))].sort();
    const preset=auditPeriodRangeV394(f.auditPeriod);
    const rows=a.filter(x=>{
      const text=[x.oi,x.record_id,x.table_name,x.usuario_nome,x.usuario_email,x.acao,x.modulo,x.tipo_auditoria,JSON.stringify(x.old_data||{}),JSON.stringify(x.new_data||{})].join(' ').toLowerCase();
      const matchText=!f.auditSearch||text.includes(f.auditSearch.toLowerCase());
      const matchUser=!f.auditUser||String(x.actor_id||x.usuario_email)===f.auditUser;
      const matchAction=!f.auditAction||x.acao===f.auditAction;
      const matchModule=!f.auditModule||x.modulo===f.auditModule;
      const matchType=!f.auditType||x.tipo_auditoria===f.auditType;
      const matchStatus=!f.auditStatus||x.status_evento===f.auditStatus;
      const day=auditIsoDayV394(x.created_at);
      const startDate=f.auditPeriod==='custom'?f.auditStart:preset?.start;
      const endDate=f.auditPeriod==='custom'?f.auditEnd:preset?.end;
      return matchText&&matchUser&&matchAction&&matchModule&&matchType&&matchStatus&&(!startDate||day>=startDate)&&(!endDate||day<=endDate);
    }).sort((x,y)=>(f.auditSort==='asc'?1:-1)*(new Date(x.created_at)-new Date(y.created_at)));

    const updateEvents=rows.filter(x=>x.modulo==='Base Consumo'||String(x.operation||'').includes('BASE_CONSUMO')).length;
    const problems=rows.filter(x=>['erro','cancelado'].includes(String(x.status_evento||'').toLowerCase())).length;
    const uniqueUsers=new Set(rows.map(x=>x.actor_id||x.usuario_email).filter(Boolean)).size;
    const groups=[];
    rows.forEach(row=>{
      const day=auditLocalDayV394(row.created_at);
      let g=groups.find(x=>x.day===day);
      if(!g){g={day,rows:[]};groups.push(g);}
      g.rows.push(row);
    });

    app.innerHTML=`${commonHeaderV37('Auditoria / Governança')}
      <div class="kpi-grid">
        ${kpiCard('Eventos encontrados',String(rows.length),'var(--azul-medio)','Após os filtros')}
        ${kpiCard('Usuários',String(uniqueUsers),'var(--azul-claro)','Usuários com ações')}
        ${kpiCard('Atualizações de dados',String(updateEvents),'var(--verde)','Base Consumo / integrações')}
        ${kpiCard('Erros / cancelamentos',String(problems),'var(--vermelho)','Eventos que exigem atenção')}
      </div>
      <div class="v394-audit-toolbar">
        <input id="v37-a-search" placeholder="Buscar OI, usuário, ação, arquivo, máquina ou valor" value="${escapeHtml(f.auditSearch||'')}">
        <select id="v37-a-type"><option value="">Todos os tipos</option>${types.map(v=>`<option value="${escapeHtml(v)}" ${v===f.auditType?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select>
        <select id="v37-a-user"><option value="">Todos os usuários</option>${users.map(u=>`<option value="${escapeHtml(String(u.id))}" ${String(u.id)===f.auditUser?'selected':''}>${escapeHtml(u.label)}</option>`).join('')}</select>
        <select id="v37-a-action"><option value="">Todas as ações</option>${actions.map(v=>`<option value="${escapeHtml(v)}" ${v===f.auditAction?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select>
        <select id="v37-a-module"><option value="">Todos os módulos</option>${modules.map(v=>`<option value="${escapeHtml(v)}" ${v===f.auditModule?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select>
        <select id="v37-a-status"><option value="">Todos os status</option>${statuses.map(v=>`<option value="${escapeHtml(v)}" ${v===f.auditStatus?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select>
      </div>
      <div class="v394-audit-secondary">
        <select id="v37-a-period">
          <option value="today" ${f.auditPeriod==='today'?'selected':''}>Hoje</option>
          <option value="7" ${f.auditPeriod==='7'?'selected':''}>Últimos 7 dias</option>
          <option value="30" ${f.auditPeriod==='30'?'selected':''}>Últimos 30 dias</option>
          <option value="all" ${f.auditPeriod==='all'?'selected':''}>Todo o histórico</option>
          <option value="custom" ${f.auditPeriod==='custom'?'selected':''}>Período personalizado</option>
        </select>
        <input type="date" id="v37-a-start" value="${escapeHtml(f.auditStart||'')}" ${f.auditPeriod==='custom'?'':'disabled'}>
        <span style="font-size:10px;color:var(--texto-suave)">até</span>
        <input type="date" id="v37-a-end" value="${escapeHtml(f.auditEnd||'')}" ${f.auditPeriod==='custom'?'':'disabled'}>
        <select id="v37-a-sort"><option value="desc" ${f.auditSort==='desc'?'selected':''}>Mais recentes primeiro</option><option value="asc" ${f.auditSort==='asc'?'selected':''}>Mais antigos primeiro</option></select>
        <button class="btn btn-secondary" id="v394-a-clear">Limpar filtros</button>
      </div>
      <div>${rows.length?groups.map(g=>`<div class="v394-audit-day">${escapeHtml(g.day)} · ${g.rows.length} evento(s)</div>${g.rows.map(renderAuditRowV37).join('')}`).join(''):'<div class="empty-state">Nenhum evento encontrado para os filtros informados.</div>'}</div>`;
    bindLogoutV37();

    const sync=()=>{
      f.auditSearch=document.getElementById('v37-a-search').value;
      f.auditType=document.getElementById('v37-a-type').value;
      f.auditUser=document.getElementById('v37-a-user').value;
      f.auditAction=document.getElementById('v37-a-action').value;
      f.auditModule=document.getElementById('v37-a-module').value;
      f.auditStatus=document.getElementById('v37-a-status').value;
      f.auditPeriod=document.getElementById('v37-a-period').value;
      f.auditStart=document.getElementById('v37-a-start').value;
      f.auditEnd=document.getElementById('v37-a-end').value;
      f.auditSort=document.getElementById('v37-a-sort').value;
      renderAuditTabV37();
    };
    ['v37-a-search','v37-a-type','v37-a-user','v37-a-action','v37-a-module','v37-a-status','v37-a-period','v37-a-start','v37-a-end','v37-a-sort'].forEach(id=>{
      const el=document.getElementById(id);if(!el)return;el.onchange=el.oninput=sync;
    });
    document.getElementById('v394-a-clear').onclick=()=>{
      Object.assign(f,{auditSearch:'',auditType:'',auditUser:'',auditAction:'',auditModule:'',auditStatus:'',auditPeriod:'30',auditStart:'',auditEnd:'',auditSort:'desc'});
      renderAuditTabV37();
    };
  }

  function renderAuditRowV37(x) {
    const actor=`${escapeHtml(x.usuario_nome||'Usuário não identificado')}${x.usuario_email?` &lt;${escapeHtml(x.usuario_email)}&gt;`:''}`;
    const title=`${escapeHtml(x.acao||x.operation||'Ação')} · ${escapeHtml(x.modulo||x.table_name||'')}`;
    const oi=x.oi?` · OI ${escapeHtml(x.oi)}`:'';
    const nd=x.new_data||{}, ctx=nd.contexto_execucao||{};
    const status=String(x.status_evento||'sucesso').toLowerCase();
    const statusClass=status==='erro'?'error':status==='cancelado'?'cancelled':'success';
    const source=nd.origem||ctx.origem||'—';
    const machine=ctx.machineName||ctx.machine_name||ctx.computador||'—';
    const sapUser=ctx.sapUser||ctx.sap_user||'—';
    const lines=nd.resumo?.qtd_lancamentos??nd.total_linhas??'—';
    let duration=nd.duracao_segundos;
    if(ctx.inicio_sap&&nd.fim){try{duration=Math.max(0,(new Date(nd.fim)-new Date(ctx.inicio_sap))/1000);}catch(_){}}
    const isUpdate=(x.modulo==='Base Consumo'||String(x.operation||'').includes('BASE_CONSUMO'));
    return `<div class="v37-audit-row">
      <div class="v394-audit-badges"><span class="v394-badge">${escapeHtml(x.tipo_auditoria||'Sistema')}</span><span class="v394-badge ${statusClass}">${escapeHtml(status)}</span>${isUpdate?`<span class="v394-badge">Origem: ${escapeHtml(source)}</span>`:''}</div>
      <div class="v37-row-head"><div><div class="v37-row-title">${title}</div><div class="v37-row-meta">${actor}${oi}<br>Entidade: ${escapeHtml((x.source_schema?x.source_schema+'.':'')+(x.table_name||''))} · Registro ${escapeHtml(x.record_id||'—')}</div></div>
      <div class="v37-audit-time">${auditDateV37(x.created_at)}</div></div>
      ${isUpdate?`<div class="v394-audit-op">
        <div><span>Arquivo / origem</span><strong title="${escapeHtml(nd.arquivo||source)}">${escapeHtml(nd.arquivo||source)}</strong></div>
        <div><span>Computador</span><strong>${escapeHtml(machine)}</strong></div>
        <div><span>Usuário SAP</span><strong>${escapeHtml(sapUser)}</strong></div>
        <div><span>Tempo total</span><strong>${Number.isFinite(Number(duration))?`${Number(duration).toFixed(1).replace('.',',')} s`:'—'}</strong></div>
        <div><span>Lançamentos</span><strong>${lines==='—'?'—':Number(lines).toLocaleString('pt-BR')}</strong></div>
        <div><span>OIs atualizadas</span><strong>${Number(nd.ois_atualizadas||0).toLocaleString('pt-BR')}</strong></div>
        <div><span>OIs sem Base O.I</span><strong>${Number(nd.resumo?.qtd_ois_consumo_sem_base_oi||0).toLocaleString('pt-BR')}</strong></div>
        <div><span>Reflexo</span><strong>${nd.capex_refletido?'CAPEX + Base O.I':'—'}</strong></div>
      </div>`:''}
      <details class="v37-json"><summary>Ver dados técnicos / antes e depois</summary><div class="v37-json-grid"><div><div class="v37-row-meta" style="font-weight:800">ANTES</div><pre>${escapeHtml(JSON.stringify(x.old_data||null,null,2))}</pre></div><div><div class="v37-row-meta" style="font-weight:800">DEPOIS</div><pre>${escapeHtml(JSON.stringify(x.new_data||null,null,2))}</pre></div></div></details>
    </div>`;
  }


  // V37.9 — Base Consumo: staging -> revisão -> confirmação financeira.
  // Nenhuma etapa deste fluxo altera a Curva de Capex.
  function v379Esc(value){ return escapeHtml(String(value ?? '')); }
  function v379Num(value){ const n=Number(value||0); return Number.isFinite(n)?n:0; }
  function v379Pct(value){ return `${(v379Num(value)*100).toFixed(1).replace('.',',')}%`; }

  function parseBaseConsumoFileV379(file) {
    return file.arrayBuffer().then(buf => {
      const wb = XLSX.read(buf,{type:'array',cellDates:true});
      const sheetName = wb.SheetNames.find(n=>normalizeHeader(n).includes('CONSUMO')) || wb.SheetNames[0];
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:true,defval:null});
      const headerIdx = encontrarLinhaCabecalho(aoa);
      if(headerIdx===-1) throw new Error('Não encontrei os cabeçalhos esperados (Ordem Interna + Montante) nas primeiras linhas.');
      const colMap={};
      (aoa[headerIdx]||[]).forEach((h,i)=>{const c=classificarColuna(h);if(c)colMap[c]=i;});
      const linhas=[];
      for(let i=headerIdx+1;i<aoa.length;i++){
        const row=aoa[i];
        if(!row||row.every(c=>c===null||c==='')) continue;
        const oi=colMap.ordem_interna!==undefined?row[colMap.ordem_interna]:null;
        const montante=colMap.montante!==undefined?row[colMap.montante]:null;
        if(!oi||montante===null||montante==='') continue;
        linhas.push({
          ordem_interna:String(oi).trim(),
          descricao:colMap.descricao!==undefined?row[colMap.descricao]:null,
          categoria_valor:colMap.categoria_valor!==undefined?row[colMap.categoria_valor]:null,
          montante:paraNumero(montante),
          data_lancamento:colMap.data_lancamento!==undefined?paraDataISO(row[colMap.data_lancamento]):null,
          fornecedor:colMap.fornecedor!==undefined?row[colMap.fornecedor]:null,
          fornecedor_nome:colMap.fornecedor_nome!==undefined?row[colMap.fornecedor_nome]:null,
          local:colMap.local!==undefined?row[colMap.local]:null,
          centro_custo:colMap.centro_custo!==undefined?row[colMap.centro_custo]:null,
          empresa:colMap.empresa!==undefined?row[colMap.empresa]:null,
          criado_por:colMap.criado_por!==undefined?row[colMap.criado_por]:null,
          linha_origem:i+1
        });
      }
      if(!linhas.length) throw new Error('Nenhuma linha válida encontrada no arquivo.');
      return {linhas,totalDepoisCabecalho:aoa.length-headerIdx-1,sheetName};
    });
  }

  function renderSaldoIssuesV395(preview){
    const negatives=Array.isArray(preview?.saldos_negativos)?preview.saldos_negativos:[];
    const resolved=Array.isArray(preview?.saldos_negativos_resolvidos)?preview.saldos_negativos_resolvidos:[];
    if(!negatives.length&&!resolved.length)return '';

    const newCount=negatives.filter(x=>x.status==='novo').length;
    const keptCount=negatives.filter(x=>x.status==='mantido').length;
    let summary=[];
    if(newCount)summary.push(`<strong>${newCount.toLocaleString('pt-BR')} OI(s) passariam a ficar com saldo negativo</strong>`);
    if(keptCount)summary.push(`<strong>${keptCount.toLocaleString('pt-BR')} OI(s) já estão negativas e permaneceriam assim</strong>`);

    const negativeHtml=negatives.length?`
      <div class="v379-danger">
        ${summary.join(' · ')}.
        Abaixo estão as OIs exatas e os valores para correção. O aviso diferencia problemas criados pela nova importação de problemas que já existiam antes dela.
      </div>
      <div class="v395-issue-list">
        ${negatives.map(x=>{
          const isNew=x.status==='novo';
          const delta=v379Num(x.variacao_saldo);
          const unchanged=Math.abs(delta)<=0.005;
          return `<div class="v395-issue-item">
            <div class="v395-issue-head">
              <div><div class="v395-issue-oi">OI ${v379Esc(x.ordem_interna)}</div><div class="v395-issue-work">${v379Esc(x.obra||'—')}</div></div>
              <span class="v395-issue-tag ${isNew?'new':'kept'}">${isNew?'NOVO SALDO NEGATIVO':'JÁ ESTAVA NEGATIVA'}</span>
            </div>
            <div class="v395-issue-values">
              <div><span>Montante</span><strong>${brl.format(v379Num(x.montante))}</strong></div>
              <div><span>Comp. atual</span><strong>${brl.format(v379Num(x.comprometido_anterior))}</strong></div>
              <div><span>Novo comp.</span><strong>${brl.format(v379Num(x.comprometido_novo))}</strong></div>
              <div><span>Saldo atual</span><strong style="color:${v379Num(x.saldo_anterior)<0?'var(--vermelho)':'inherit'}">${brl.format(v379Num(x.saldo_anterior))}</strong></div>
              <div><span>Novo saldo</span><strong style="color:var(--vermelho)">${brl.format(v379Num(x.saldo_novo))}</strong></div>
            </div>
            <div class="v395-issue-note">${unchanged
              ?'Sem variação nesta importação: este saldo negativo já existia na fotografia vigente.'
              :`Variação de saldo nesta importação: ${delta>0?'+':''}${brl.format(delta)}. Excesso de Compromissado sobre o Montante: ${brl.format(v379Num(x.excesso_compromissado))}.`}</div>
          </div>`;
        }).join('')}
      </div>`:'';

    const resolvedHtml=resolved.length?`
      <details class="v37-json">
        <summary>${resolved.length.toLocaleString('pt-BR')} OI(s) com saldo negativo seriam regularizadas por esta importação</summary>
        <div class="v395-issue-list">
          ${resolved.map(x=>`<div class="v395-issue-item resolved">
            <div class="v395-issue-head">
              <div><div class="v395-issue-oi">OI ${v379Esc(x.ordem_interna)}</div><div class="v395-issue-work">${v379Esc(x.obra||'—')}</div></div>
              <span class="v395-issue-tag fixed">REGULARIZADA</span>
            </div>
            <div class="v395-issue-values">
              <div><span>Saldo atual</span><strong style="color:var(--vermelho)">${brl.format(v379Num(x.saldo_anterior))}</strong></div>
              <div><span>Novo saldo</span><strong style="color:var(--verde)">${brl.format(v379Num(x.saldo_novo))}</strong></div>
            </div>
          </div>`).join('')}
        </div>
      </details>`:'';

    return `<div class="v395-issue-title">Alertas financeiros específicos</div>${negativeHtml}${resolvedHtml}`;
  }

  function renderBaseConsumoReviewV379(preview, meta) {
    const changes=Array.isArray(preview.alteracoes)?preview.alteracoes:[];
    const missing=Array.isArray(preview.ois_consumo_sem_base_oi)?preview.ois_consumo_sem_base_oi:[];
    const absent=Array.isArray(preview.ois_ausentes_em_relacao_base_atual)?preview.ois_ausentes_em_relacao_base_atual:[];
    const backdrop=document.createElement('div');
    backdrop.className='modal-backdrop';
    backdrop.id='v379-base-consumo-review';
    const riskExtreme=!!preview.snapshot_extremamente_reduzido;
    const riskRelevant=!!preview.snapshot_reducao_relevante && !riskExtreme;
    const coverage=`${v379Pct(preview.cobertura_linhas)} das linhas · ${v379Pct(preview.cobertura_ois)} das OIs`;
    backdrop.innerHTML=`<div class="modal-box modal-wide" style="width:min(1180px,96vw)">
      <h2>Revisar atualização da Base Consumo</h2>
      <p class="sub">${v379Esc(meta.fileName)} · exercício ${v379Esc(preview.exercicio)}. <strong>Nada financeiro foi aplicado ainda.</strong></p>
      <div class="v379-review-flow"><span>1. Base carregada em staging</span><span>2. Compromissado recalculado</span><span>3. Saldo recalculado</span><span>4. Revisão atual</span><span>5. Confirmar</span></div>
      ${riskExtreme?`<div class="v379-danger"><strong>Importação bloqueada por segurança.</strong> A nova planilha tem cobertura muito inferior à Base Consumo vigente (${coverage}). Isso indica provável arquivo parcial. A Base vigente e os saldos atuais permanecerão intactos.</div>`:''}
      ${riskRelevant?`<div class="v379-warning"><strong>Atenção: redução relevante de cobertura.</strong> A nova planilha representa ${coverage} da base vigente e ${Number(preview.qtd_ois_ausentes_em_relacao_base_atual||0).toLocaleString('pt-BR')} OI(s) da base anterior não aparecem na nova fotografia. Se isso for realmente uma Base Consumo completa, marque a confirmação adicional abaixo.</div>`:''}
      ${!riskExtreme&&!riskRelevant?`<div class="v379-ok"><strong>Revisão segura.</strong> A Base Consumo ainda não substituiu a fotografia vigente. A confirmação abaixo alterará somente Compromissado e Saldo das OIs e tornará esta base a fotografia vigente. A Curva de Capex não será atualizada.</div>`:''}
      <div class="v379-review-grid">
        <div><span>Lançamentos nova base</span><strong>${Number(preview.qtd_lancamentos||0).toLocaleString('pt-BR')}</strong></div>
        <div><span>Valor nova base</span><strong>${brl.format(v379Num(preview.valor_total_base))}</strong></div>
        <div><span>OIs alteradas</span><strong>${Number(preview.qtd_ois_alteradas||0).toLocaleString('pt-BR')}</strong></div>
        <div><span>OIs sem Base OI</span><strong>${Number(preview.qtd_ois_consumo_sem_base_oi||0).toLocaleString('pt-BR')}</strong></div>
        <div><span>Compromissado atual</span><strong>${brl.format(v379Num(preview.comprometido_anterior_total))}</strong></div>
        <div><span>Novo compromissado</span><strong>${brl.format(v379Num(preview.comprometido_novo_total))}</strong></div>
        <div><span>Saldo atual</span><strong>${brl.format(v379Num(preview.saldo_anterior_total))}</strong></div>
        <div><span>Novo saldo</span><strong>${brl.format(v379Num(preview.saldo_novo_total))}</strong></div>
      </div>
      ${renderSaldoIssuesV395(preview)}
      ${missing.length?`<div class="v394-missing-alert"><strong>Atenção: ${missing.length.toLocaleString('pt-BR')} OI(s) da Base Consumo ainda não estão cadastradas na Base O.I.</strong><br>A atualização pode continuar, mas essas OIs não terão Compromissado/Saldo refletidos na Base O.I até o cadastro financeiro ser criado. O HAPCAPEX também manterá este aviso na Central de Notificações.</div>`:''}
      ${missing.length?`<details class="v37-json"><summary>${missing.length} OI(s) presentes no consumo sem Base OI financeira</summary><div style="max-height:180px;overflow:auto;margin-top:8px">${missing.map(x=>`<div class="v37-row-meta">OI ${v379Esc(x.ordem_interna)} · ${v379Esc(x.obra||'')} · ${brl.format(v379Num(x.comprometido_novo))}</div>`).join('')}</div></details>`:''}
      ${absent.length?`<details class="v37-json"><summary>${absent.length} OI(s) da Base Consumo vigente ausentes na nova fotografia</summary><div style="max-height:180px;overflow:auto;margin-top:8px">${absent.slice(0,500).map(x=>`<div class="v37-row-meta">OI ${v379Esc(x.ordem_interna)} · atual ${brl.format(v379Num(x.comprometido_base_atual))} → novo R$ 0,00</div>`).join('')}</div></details>`:''}
      <div class="history-section-title" style="margin-top:13px">Alterações financeiras por OI</div>
      <div class="v379-review-table-wrap"><table class="v379-review-table"><thead><tr><th>OI</th><th>Obra</th><th>Montante</th><th>Comp. atual</th><th>Novo comp.</th><th>Variação</th><th>Saldo atual</th><th>Novo saldo</th></tr></thead><tbody>
        ${changes.length?changes.map(x=>{const d=v379Num(x.variacao_comprometido);return `<tr><td>${v379Esc(x.ordem_interna)}</td><td>${v379Esc(x.obra||'—')}</td><td>${brl.format(v379Num(x.montante))}</td><td>${brl.format(v379Num(x.comprometido_anterior))}</td><td>${brl.format(v379Num(x.comprometido_novo))}</td><td class="${d>0?'v379-delta-up':d<0?'v379-delta-down':''}">${d>0?'+':''}${brl.format(d)}</td><td>${brl.format(v379Num(x.saldo_anterior))}</td><td>${brl.format(v379Num(x.saldo_novo))}</td></tr>`}).join(''):`<tr><td colspan="8"><div class="empty-state">Nenhuma alteração de Compromissado/Saldo.</div></td></tr>`}
      </tbody></table></div>
      ${riskRelevant?`<label style="display:flex;gap:7px;align-items:flex-start;margin-top:12px;font-size:10px;color:#68480d"><input type="checkbox" id="v379-confirm-reduction" style="margin-top:2px"> Confirmo que a planilha selecionada é uma Base Consumo completa e que a redução de cobertura é esperada.</label>`:''}
      <div id="v379-review-error"></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="v379-cancel">Cancelar importação</button><button class="btn btn-primary" id="v379-confirm" ${riskExtreme?'disabled':''}>Confirmar importação e atualizar saldos</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    return new Promise(resolve=>{
      backdrop.querySelector('#v379-cancel').onclick=()=>resolve({action:'cancel',backdrop});
      backdrop.querySelector('#v379-confirm').onclick=()=>{
        if(riskRelevant&&!backdrop.querySelector('#v379-confirm-reduction')?.checked){
          backdrop.querySelector('#v379-review-error').innerHTML='<div class="error-msg" style="margin-top:10px">Marque a confirmação adicional para aceitar a redução relevante de cobertura.</div>';return;
        }
        resolve({action:'confirm',backdrop,confirmReduction:riskRelevant});
      };
    });
  }

  async function sha256FileV394(file){
    try{
      if(!crypto?.subtle)return null;
      const buf=await file.arrayBuffer();
      const digest=await crypto.subtle.digest('SHA-256',buf);
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(_){return null;}
  }

  function baseConsumoContextV394(extra={}){
    return {
      origem: extra.origem || 'Manual',
      inicio_cliente: extra.inicio_cliente || new Date().toISOString(),
      navegador: navigator.userAgent || '',
      hapcapex_versao: VERSION,
      usuario_hapcapex: state.fullName || '',
      ...extra
    };
  }

  async function importarArquivoBaseConsumoV394(file, executionContext={}) {
    const statusEl=document.getElementById('import-status');
    const input=document.getElementById('import-file-input');
    let loteId=null;
    const setStatus=html=>{if(statusEl)statusEl.innerHTML=html;};
    const context=baseConsumoContextV394(executionContext||{});
    try{
      if(state.role==='viewer' && String(context.origem||'').trim().toLowerCase()!=='sap'){
        throw new Error('Visualizadores podem atualizar a Base Consumo somente pelo SAP.');
      }
      setStatus('Lendo o arquivo e preparando a revisão...');
      const [parsed,hash]=await Promise.all([parseBaseConsumoFileV379(file),sha256FileV394(file)]);
      setStatus(`${parsed.linhas.length.toLocaleString('pt-BR')} linhas válidas encontradas. Carregando em área temporária...`);
      const {data,error}=await sb.rpc('iniciar_importacao_base_consumo',{
        p_nome_arquivo:file.name,
        p_hash_arquivo:hash,
        p_tamanho_bytes:file.size,
        p_contexto:context
      });
      if(error) throw error;loteId=data;
      const CHUNK=500;let inseridos=0,ignorados=0,processados=0;
      for(let i=0;i<parsed.linhas.length;i+=CHUNK){
        const pedaco=parsed.linhas.slice(i,i+CHUNK);
        const {data:r,error:e}=await sb.rpc('importar_base_consumo_lote',{p_lote_id:loteId,p_linhas:pedaco});
        if(e) throw e;
        inseridos+=Number(r?.inseridos||0);ignorados+=Number(r?.ignorados||0);processados+=pedaco.length;
        setStatus(`Preparando revisão... ${processados.toLocaleString('pt-BR')} de ${parsed.linhas.length.toLocaleString('pt-BR')} linhas.`);
      }
      if(processados!==parsed.linhas.length) throw new Error(`Processamento incompleto: ${processados} de ${parsed.linhas.length} linhas.`);
      const {data:preview,error:previewErr}=await sb.rpc('prever_importacao_base_consumo',{p_lote_id:loteId});
      if(previewErr) throw previewErr;
      setStatus('Base carregada para revisão. Nenhuma alteração financeira aplicada ainda.');
      const choice=await renderBaseConsumoReviewV379(preview,{fileName:file.name,inseridos,ignorados});
      if(choice.action==='cancel'){
        const {error:cancelErr}=await sb.rpc('cancelar_importacao_base_consumo',{p_lote_id:loteId});
        if(cancelErr) throw cancelErr;
        choice.backdrop.remove();loteId=null;
        setStatus('<span style="color:var(--texto-suave)">Atualização cancelada. Base Consumo vigente, Compromissado e Saldo permaneceram inalterados.</span>');
        return {status:'cancelled',loteId:null};
      }
      const confirmBtn=choice.backdrop.querySelector('#v379-confirm');
      const cancelBtn=choice.backdrop.querySelector('#v379-cancel');
      confirmBtn.disabled=true;cancelBtn.disabled=true;confirmBtn.textContent='Confirmando...';
      const {data:confirmed,error:confirmErr}=await sb.rpc('confirmar_importacao_base_consumo',{p_lote_id:loteId,p_confirmar_reducao_relevante:!!choice.confirmReduction});
      if(confirmErr){confirmBtn.disabled=false;cancelBtn.disabled=false;confirmBtn.textContent='Confirmar importação e atualizar saldos';choice.backdrop.querySelector('#v379-review-error').innerHTML=`<div class="error-msg" style="margin-top:10px">${v379Esc(confirmErr.message)}</div>`;return {status:'review_error',error:confirmErr};}
      choice.backdrop.remove();loteId=null;
      const missing=Number(confirmed?.qtd_ois_consumo_sem_base_oi||0);
      setStatus(`<span style="color:var(--verde)">Concluído: ${Number(confirmed?.qtd_lancamentos||parsed.linhas.length).toLocaleString('pt-BR')} lançamentos · ${Number(confirmed?.qtd_ois_alteradas||0).toLocaleString('pt-BR')} OI(s) atualizadas em CAPEX + Base O.I.${missing?` · <b>${missing} OI(s) sem cadastro na Base O.I.</b>`:''} Curva de Capex não alterada.</span>`);
      state.v394.lastUpdateLoaded=false;
      await refreshCurrent();
      return {status:'confirmed',confirmed};
    }catch(error){
      if(loteId){try{await sb.rpc('marcar_importacao_base_consumo_erro',{p_lote_id:loteId,p_mensagem:error.message});}catch(_){}}
      setStatus(`<span style="color:var(--vermelho)">${v379Esc(error.message||error)}</span>`);
      return {status:'error',error};
    }finally{ if(input) input.value=''; }
  }

  window.importarArquivoBaseConsumo = importarArquivoBaseConsumoV394;


  // V37.10 — O total histórico soma anos anteriores + comprometido do exercício atual.
  // O cálculo já era correto; corrigimos apenas o rótulo exibido.
  function fixHistoricalCommittedLabelV3710(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll('.v35-summary-card span').forEach(label => {
      if (String(label.textContent || '').trim().toLowerCase() === 'consumido total') {
        label.textContent = 'Compromissado total';
      }
    });
  }

  function initMobileAndHistoryPolishV3710() {
    fixHistoricalCommittedLabelV3710(document);
    if (window.__HAP_V3710_POLISH_OBSERVER__) return;
    window.__HAP_V3710_POLISH_OBSERVER__ = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.v35-summary-card')) fixHistoricalCommittedLabelV3710(node.parentElement || node);
          else if (node.querySelector?.('.v35-summary-card')) fixHistoricalCommittedLabelV3710(node);
        });
      }
    });
    window.__HAP_V3710_POLISH_OBSERVER__.observe(document.body, { childList: true, subtree: true });
  }


  // ==========================================================
  // V38 — Mobile completo do Controle: navegação inferior,
  // tabelas adaptativas e UX touch sem alterar regras de negócio.
  // ==========================================================
  function isPhoneV380() {
    const narrow = window.matchMedia?.('(max-width: 780px)').matches || window.innerWidth <= 780;
    const mobileAgent = /android|iphone|ipod|mobile/i.test(navigator.userAgent || '');
    const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
    const phoneLandscape = (mobileAgent || coarse || document.body.classList.contains('pwa-mobile')) && Math.min(window.innerWidth, window.innerHeight) <= 780 && Math.max(window.innerWidth, window.innerHeight) <= 980;
    return !!(narrow || phoneLandscape);
  }

  function tabIdFromNavLabelV380(label) {
    const text = String(label || '').trim().toUpperCase();
    if (text.includes('BASE O.I') || text === 'O.I') return 'base_oi';
    if (text.includes('BASE CONSUMO') || text.includes('CONSUMO')) return 'base_consumo';
    if (text.includes('TRANSFER')) return 'transferencias';
    if (text.includes('AUDITORIA')) return 'auditoria';
    if (text.includes('CAPEX')) return 'capex';
    return '';
  }

  function findOriginalNavV380() {
    const pills = [...document.querySelectorAll('.nav-pill')].filter(el => tabIdFromNavLabelV380(el.textContent));
    if (!pills.length) return null;
    const parent = pills[0].parentElement;
    if (parent) parent.classList.add('v380-original-nav');
    return parent;
  }

  function invokeTabV380(tab) {
    try {
      if (typeof window.switchTab === 'function') { window.switchTab(tab); return; }
    } catch (_) {}
    const pill = [...document.querySelectorAll('.nav-pill')].find(el => tabIdFromNavLabelV380(el.textContent) === tab);
    pill?.click();
  }

  function closeMoreV380() {
    document.getElementById('v380-more-overlay')?.classList.remove('open');
    document.getElementById('v380-more-sheet')?.classList.remove('open');
  }

  function openMoreV380() {
    document.getElementById('v380-more-overlay')?.classList.add('open');
    document.getElementById('v380-more-sheet')?.classList.add('open');
  }

  function createControlDockV380() {
    if (!isPhoneV380()) return;
    findOriginalNavV380();
    if (!document.querySelector('.nav-pill')) return;
    if (!document.getElementById('v380-control-dock')) {
      const dock = document.createElement('nav');
      dock.id = 'v380-control-dock';
      dock.className = 'v380-control-dock';
      dock.setAttribute('aria-label','Navegação móvel do Controle');
      dock.innerHTML = `
        <button type="button" data-v380-tab="capex"><span class="v380-icon">⌂</span><small>CAPEX</small></button>
        <button type="button" data-v380-tab="base_oi"><span class="v380-icon">▤</span><small>O.I</small></button>
        <button type="button" data-v380-tab="base_consumo"><span class="v380-icon">◉</span><small>Consumo</small></button>
        <button type="button" data-v380-tab="transferencias"><span class="v380-icon">⇄</span><small>Transf.</small></button>
        <button type="button" data-v380-more><span class="v380-icon">•••</span><small>Mais</small></button>`;
      document.body.appendChild(dock);
      dock.querySelectorAll('[data-v380-tab]').forEach(btn => btn.onclick = () => { invokeTabV380(btn.dataset.v380Tab); closeMoreV380(); setTimeout(syncControlDockV380,0); window.scrollTo({top:0,behavior:'smooth'}); });
      dock.querySelector('[data-v380-more]').onclick = openMoreV380;
    }
    if (!document.getElementById('v380-more-sheet')) {
      const overlay = document.createElement('div');
      overlay.id='v380-more-overlay'; overlay.className='v380-more-overlay'; overlay.onclick=closeMoreV380;
      const sheet = document.createElement('aside');
      sheet.id='v380-more-sheet'; sheet.className='v380-more-sheet';
      const hasAudit = [...document.querySelectorAll('.nav-pill')].some(el => tabIdFromNavLabelV380(el.textContent)==='auditoria');
      sheet.innerHTML = `<div class="v380-sheet-handle"></div><div class="v380-sheet-title"><strong>Mais ações</strong><button type="button" data-v380-close style="border:0;background:transparent;font-size:22px;color:var(--texto-suave)">×</button></div><div class="v380-sheet-grid">
        ${hasAudit ? '<button type="button" data-v380-action="audit">🧾 Auditoria</button>' : ''}
        <button type="button" data-v380-action="notifications">🔔 Notificações</button>
        <button type="button" data-v380-action="top">↑ Ir ao topo</button>
        <button type="button" data-v380-action="home">⌂ HAPCAPEX</button>
      </div>`;
      document.body.append(overlay,sheet);
      sheet.querySelector('[data-v380-close]').onclick=closeMoreV380;
      sheet.querySelector('[data-v380-action="audit"]')?.addEventListener('click',()=>{invokeTabV380('auditoria');closeMoreV380();});
      sheet.querySelector('[data-v380-action="notifications"]')?.addEventListener('click',()=>{closeMoreV380();document.querySelector('.v371-bell')?.click();});
      sheet.querySelector('[data-v380-action="top"]')?.addEventListener('click',()=>{closeMoreV380();window.scrollTo({top:0,behavior:'smooth'});});
      sheet.querySelector('[data-v380-action="home"]')?.addEventListener('click',()=>{ if(typeof window.voltarAoSeletorHapcapex==='function') window.voltarAoSeletorHapcapex(); else location.href='./'; });
    }
    syncControlDockV380();
  }

  function syncControlDockV380() {
    const activePill=[...document.querySelectorAll('.nav-pill.active')].find(el=>tabIdFromNavLabelV380(el.textContent));
    const active=activePill ? tabIdFromNavLabelV380(activePill.textContent) : (window.state?.tab || 'capex');
    document.querySelectorAll('#v380-control-dock [data-v380-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.v380Tab===active));
    syncControlHeaderV381();
  }


  function normalizeHeaderV382(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  }

  function fieldFromHeaderV382(header) {
    const h=normalizeHeaderV382(header);
    if (h==='oi' || h.includes('ordem interna')) return 'oi';
    if (h==='obra' || h.includes('nome da obra')) return 'obra';
    if (h.includes('montante')) return 'montante';
    if (h.includes('compromiss')) return 'compromissado';
    if (h==='saldo' || h.includes('saldo dispon')) return 'saldo';
    if (h.includes('%') || h.includes('percent') || h.includes('comp.')) return 'percentual';
    if (h.includes('pacote capex') || (h.includes('classificacao') && h.includes('capex'))) return 'pacote';
    return 'secondary';
  }

  function isMainCapexTableV382(table, headers) {
    const normalized=headers.map(normalizeHeaderV382);
    return normalized.some(h=>h==='oi' || h.includes('ordem interna'))
      && normalized.some(h=>h==='obra' || h.includes('nome da obra'))
      && normalized.some(h=>h.includes('montante'))
      && normalized.some(h=>h.includes('compromiss'))
      && normalized.some(h=>h==='saldo' || h.includes('saldo dispon'));
  }

  function decorateCapexSmartTableV382(table, headers) {
    table.classList.remove('v380-swipe-table','v380-card-table');
    table.classList.add('v382-capex-smart');
    const host=table.closest('.table-card') || table.parentElement;
    host?.classList.add('v382-capex-smart-wrap');
    host?.querySelector(':scope > .v380-swipe-hint')?.classList.add('v382-hidden');
    if (host && !host.querySelector(':scope > .v382-capex-smart-hint')) {
      const hint=document.createElement('div');
      hint.className='v382-capex-smart-hint';
      hint.innerHTML='<strong>Ordens Internas</strong><span>Toque em ▾ para ver classificações e detalhes</span>';
      host.insertBefore(hint,host.firstChild);
    }
    table.querySelectorAll('tbody tr').forEach(row=>{
      const cells=[...row.children].filter(el=>el.tagName==='TD');
      if (!cells.length) return;
      cells.forEach((td,i)=>{
        const label=headers[i]||'';
        td.dataset.v380Label=label;
        const field=fieldFromHeaderV382(label);
        td.dataset.v382Field=field;
        if (field==='secondary') td.dataset.v382Secondary='1'; else delete td.dataset.v382Secondary;
      });
      const obraCell=cells.find(td=>td.dataset.v382Field==='obra') || cells[1];
      if (obraCell && !obraCell.querySelector('.v382-detail-toggle')) {
        const btn=document.createElement('button');
        btn.type='button'; btn.className='v382-detail-toggle'; btn.setAttribute('aria-label','Mostrar detalhes da OI'); btn.textContent='⌄';
        btn.onclick=(event)=>{event.preventDefault();event.stopPropagation();const expanded=row.classList.toggle('v382-expanded');btn.setAttribute('aria-expanded',String(expanded));};
        obraCell.appendChild(btn);
      }
      row.dataset.v382Done='1';
    });
    table.dataset.v380Done='1';
    table.dataset.v382Smart='1';
  }

  function decorateTablesV380(root=document) {
    if (!isPhoneV380()) return;
    root.querySelectorAll?.('.table-card table, .risk-table, .user-table, .backup-table').forEach(table => {
      const headers=[...table.querySelectorAll('thead th')].map(th=>String(th.textContent||'').trim());
      if (table.dataset.v382Smart==='1') { decorateCapexSmartTableV382(table, headers); return; }
      if (table.dataset.v380Done==='1') return;
      if (!headers.length) return;
      if (isMainCapexTableV382(table, headers)) {
        decorateCapexSmartTableV382(table, headers);
        return;
      }
      const forceSwipe = table.classList.contains('v379-review-table') || table.classList.contains('v376-review-table') || table.classList.contains('v35-preview-table') || headers.length>8;
      if (forceSwipe) {
        table.classList.add('v380-swipe-table');
        const host=table.closest('.table-card,.v379-review-table-wrap,.v376-review-table-wrap') || table.parentElement;
        if (host && !host.querySelector(':scope > .v380-swipe-hint')) {
          const hint=document.createElement('div'); hint.className='v380-swipe-hint'; hint.innerHTML='↔ Deslize para ver todas as colunas'; host.insertBefore(hint,host.firstChild);
        }
      } else {
        table.classList.add('v380-card-table');
        table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((td,i)=>td.dataset.v380Label=headers[i]||''));
      }
      table.dataset.v380Done='1';
    });
  }


  // ==========================================================
  // V38.1 — Cabeçalho móvel do Controle no mesmo padrão da Curva.
  // ==========================================================
  function controlContextLabelV381() {
    const activePill=[...document.querySelectorAll('.nav-pill.active')].find(el=>tabIdFromNavLabelV380(el.textContent));
    const tab=activePill ? tabIdFromNavLabelV380(activePill.textContent) : (window.state?.tab || 'capex');
    const labels={capex:'Controle · CAPEX',base_oi:'Controle · Base O.I',base_consumo:'Controle · Base Consumo',transferencias:'Controle · Transferências',auditoria:'Controle · Auditoria'};
    return labels[tab] || 'Controle de CAPEX';
  }

  function syncControlHeaderV381() {
    const header=document.getElementById('v381-control-header');
    if(!header) return;
    const ctx=header.querySelector('[data-v381-context]');
    if(ctx) ctx.textContent=controlContextLabelV381();
    const srcBadge=document.querySelector('#v371-notif-btn .v371-badge');
    const badge=header.querySelector('.v381-head-badge');
    if(badge){
      if(srcBadge){badge.textContent=srcBadge.textContent||'';badge.hidden=false;}
      else {badge.hidden=true;badge.textContent='';}
    }
  }

  function createControlHeaderV381() {
    if(!isPhoneV380()) return;
    let header=document.getElementById('v381-control-header');
    if(!header){
      header=document.createElement('div');
      header.id='v381-control-header';
      header.className='v381-control-header';
      header.setAttribute('aria-label','Cabeçalho móvel HAPCAPEX');
      header.innerHTML=`<div class="v381-control-brand" role="button" tabindex="0" title="Voltar ao HAPCAPEX">
        <div class="v381-control-logo"><img src="hapcapex-icon-v27-192.png" alt="HAPCAPEX"></div>
        <div class="v381-control-brandtext"><strong>HAPCAPEX</strong><small data-v381-context>Controle · CAPEX</small></div>
      </div><div class="v381-control-head-actions">
        <button type="button" data-v381-notifications aria-label="Abrir notificações">🔔<span class="v381-head-badge" hidden></span></button>
        <button type="button" data-v381-menu aria-label="Abrir menu">☰</button>
      </div>`;
      const app=document.getElementById('app');
      if(app?.parentNode) app.parentNode.insertBefore(header,app); else document.body.prepend(header);
      const goHome=()=>{if(typeof window.voltarAoSeletorHapcapex==='function')window.voltarAoSeletorHapcapex();else location.href='./';};
      const brand=header.querySelector('.v381-control-brand');
      brand.onclick=goHome; brand.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goHome();}};
      header.querySelector('[data-v381-notifications]').onclick=()=>document.querySelector('#v371-notif-btn')?.click();
      header.querySelector('[data-v381-menu]').onclick=()=>{createControlDockV380();openMoreV380();};
    }
    syncControlHeaderV381();
  }

  function syncMobileModeV380() {
    const mobile=isPhoneV380();
    document.body.classList.toggle('hap-mobile-v38',mobile);
    if (!mobile) { closeMoreV380(); document.getElementById('v381-control-header')?.remove(); return; }
    createControlHeaderV381();
    createControlDockV380();
    decorateTablesV380(document);
    fixHistoricalCommittedLabelV3710(document);
    syncControlHeaderV381();
  }

  function initFullMobileV380() {
    syncMobileModeV380();
    if (!window.__HAP_V380_OBSERVER__) {
      let pending=false;
      window.__HAP_V380_OBSERVER__=new MutationObserver(()=>{
        if(pending)return; pending=true; requestAnimationFrame(()=>{pending=false; syncMobileModeV380(); syncControlDockV380();});
      });
      window.__HAP_V380_OBSERVER__.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      window.addEventListener('resize',()=>syncMobileModeV380(),{passive:true});
    }
  }



  // ==========================================================
  // V39.0 — HAPCAPEX SAP Bridge V1
  // Automação local do SAP GUI para exportar Base Consumo.
  // A importação financeira continua usando o fluxo V37.9 de staging/revisão.
  // ==========================================================
  const SAP_BRIDGE_V390 = 'http://127.0.0.1:17891';
  const SAP_BRIDGE_DOWNLOAD_V390 = './sap-bridge/HAPCAPEX-SAP-Bridge-CORPORATIVO.zip';
  const SAP_BRIDGE_MANIFEST_V396 = './sap-bridge/latest.json';
  let sapBridgeHealthV396 = null;
  let sapBridgeManifestV396 = null;
  let sapBridgeUpdateCheckingV396 = false;
  let sapBridgePollV390 = null;
  let sapBridgeAutoRunV390 = false;
  let sapBridgeTransitionV390 = false;
  let sapBridgeOnlineV390 = false;
  let sapBridgeStatusV390 = null;
  let sapBridgeImportingV390 = false;
  let sapCycleStartedAtV394 = null;
  let sapLastAuditedErrorKeyV394 = '';

  async function sapBridgeRequestV390(path, options={}, timeoutMs=10000) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(SAP_BRIDGE_V390+path,{
        method:options.method||'GET',
        headers:{'X-HAPCAPEX-Client':'web-v39','Content-Type':'application/json',...(options.headers||{})},
        body:options.body===undefined?undefined:JSON.stringify(options.body),
        cache:'no-store',signal:controller.signal
      });
      let data=null; try{data=await response.json();}catch(_){data={ok:response.ok};}
      return {httpOk:response.ok,statusCode:response.status,...(data||{})};
    } finally { clearTimeout(timer); }
  }

  function stopSapBridgePollV390(){ if(sapBridgePollV390){clearInterval(sapBridgePollV390);sapBridgePollV390=null;} }

  function sapStepClassV390(kind,status){
    if(!status) return '';
    const order=['bridge_ready','locate_sap','open_sap','login','session_ready','create_session','dedicated_session_ready','open_transaction','transaction_ready','fill_budcon','execute_budcon','open_report_detail','select_layout','export_excel','wait_export','export_ready'];
    const idx=order.indexOf(status.currentStep), target=kind;
    const targetIdx={bridge:0,sap:2,login:4,dedicated:6,transaction:8,export:15}[target]??99;
    if(status.state==='error' && idx>=0 && Math.abs(idx-targetIdx)<=1) return 'error';
    if(target==='bridge') return 'done';
    if(target==='sap' && (status.sapFound||status.sapRunning)) return 'done';
    if(target==='login' && status.sessionConnected) return 'done';
    if(target==='dedicated' && (status.dedicatedSessionId||['dedicated_session_ready','transaction_ready','exporting','export_ready'].includes(status.state))) return 'done';
    if(target==='transaction' && ['transaction_ready','exporting','export_ready'].includes(status.state)) return 'done';
    if(target==='export' && status.state==='export_ready') return 'done';
    if(target==='sap' && ['working','sap_found'].includes(status.state)) return 'active';
    if(target==='login' && status.state==='awaiting_login') return 'active';
    if(target==='dedicated' && status.currentStep==='create_session') return 'active';
    if(target==='transaction' && status.currentStep==='open_transaction') return 'active';
    if(target==='export' && ['exporting'].includes(status.state)) return 'active';
    return '';
  }

  function sapStepStateV390(kind,status){
    const cls=sapStepClassV390(kind,status);
    if(cls==='done') return 'Concluído'; if(cls==='active') return 'Em andamento'; if(cls==='error') return 'Atenção'; return 'Aguardando';
  }

  function sapPrimaryActionLabelV391(st, online) {
    if (!online || !st) return 'Iniciar atualização pelo SAP';
    if (st.state === 'awaiting_login' || st.currentStep === 'login') return 'Login realizado, continuar';
    if (st.state === 'session_ready' || st.currentStep === 'session_ready') return 'Criar sessão HAPCAPEX e continuar';
    if (st.state === 'transaction_ready') return 'Extrair Base Consumo';
    if (st.state === 'export_ready') return 'Enviar Excel ao HAPCAPEX';
    if (st.state === 'error') return 'Tentar novamente';
    if (st.state === 'working' || st.state === 'sap_found') return 'Continuar automação';
    return 'Iniciar atualização pelo SAP';
  }

  async function advanceSapAfterLoginV392(){
    if(sapBridgeTransitionV390||!sapBridgeOnlineV390)return;
    sapBridgeTransitionV390=true;
    try{
      const t=await sapBridgeRequestV390('/api/sap/open-transaction',{method:'POST'},30000);
      sapBridgeStatusV390=t.status||sapBridgeStatusV390;
      renderSapBridgeV390();
      if(!t.ok)return;
    }catch(_){
      await probeSapBridgeV390(false);
      return;
    }finally{
      sapBridgeTransitionV390=false;
    }
    await exportSapConsumoV390();
  }

  async function handleSapPrimaryActionV391() {
    const st = sapBridgeStatusV390;
    if (!sapBridgeOnlineV390) return startSapAutomationV390(true);

    if (st?.state === 'awaiting_login' || st?.currentStep === 'login') {
      sapBridgeAutoRunV390 = true;
      sapBridgeTransitionV390 = true;
      let loginOk=false;
      try {
        const r = await sapBridgeRequestV390('/api/sap/confirm-login', {method:'POST'}, 15000);
        sapBridgeStatusV390 = r.status || sapBridgeStatusV390;
        loginOk=!!r.ok;
        renderSapBridgeV390();
      } catch (_) {
      } finally {
        sapBridgeTransitionV390 = false;
        renderSapBridgeV390();
      }
      if(loginOk) await advanceSapAfterLoginV392();
      return;
    }

    if (st?.state === 'session_ready' || st?.currentStep === 'session_ready') return advanceSapAfterLoginV392();
    if (st?.state === 'transaction_ready') return exportSapConsumoV390();
    if (st?.state === 'export_ready') return consumeSapExportV390();
    if (st?.state === 'error') return startSapAutomationV390(false);
    return startSapAutomationV390(false);
  }

  function bridgeVersionPartsV396(value){
    const m=String(value||'').match(/(\d+)\.(\d+)\.(\d+)/);
    return m?[Number(m[1]),Number(m[2]),Number(m[3])]:[0,0,0];
  }
  function compareBridgeVersionV396(a,b){
    const aa=bridgeVersionPartsV396(a),bb=bridgeVersionPartsV396(b);
    for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]>bb[i]?1:-1;}
    return 0;
  }
  async function loadBridgeManifestV396(force=false){
    if(sapBridgeManifestV396&&!force)return sapBridgeManifestV396;
    try{
      const r=await fetch(SAP_BRIDGE_MANIFEST_V396+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('manifest');
      const d=await r.json();if(!d?.version||!d?.downloadPath)throw new Error('manifest');
      sapBridgeManifestV396=d;
    }catch(_){sapBridgeManifestV396=null}
    return sapBridgeManifestV396;
  }
  function bridgeDistributionStateV396(){
    const latest=sapBridgeManifestV396?.version||'',current=sapBridgeHealthV396?.version||sapBridgeStatusV390?.version||'',corp=sapBridgeHealthV396?.distribution==='corporate';
    if(!sapBridgeOnlineV390)return {kind:'offline',title:'SAP Bridge não detectado',sub:latest?`Versão corporativa disponível: ${latest}`:'Instale o componente local para atualizar pelo SAP.',action:'download'};
    if(!latest)return {kind:'ok',title:`Bridge ${current||'online'}`,sub:'Componente local conectado; versão corporativa indisponível para consulta.',action:'none'};
    if(compareBridgeVersionV396(current,latest)<0)return {kind:'warn',title:'Atualização do SAP Bridge disponível',sub:`Instalado: ${current||'—'} · disponível: ${latest}`,action:corp?'update':'download'};
    if(!corp)return {kind:'warn',title:`Bridge ${current} funcionando`,sub:'Migre uma vez para a distribuição corporativa para ativar autostart e atualizações.',action:'download'};
    return {kind:'ok',title:`SAP Bridge ${current} atualizado`,sub:'Distribuição corporativa · inicialização e atualização automática habilitadas.',action:'none'};
  }
  function renderBridgeDistributionV396(){
    const el=document.querySelector('#v390-sap-modal [data-v396-dist]');if(!el)return;
    const s=bridgeDistributionStateV396();el.className=`v396-dist ${s.kind}`;
    el.innerHTML=`<div class="v396-dist-main"><div class="v396-dist-title">${escapeHtml(s.title)}</div><div class="v396-dist-sub">${escapeHtml(s.sub)}</div></div><div class="v396-dist-actions">${s.action==='download'?`<a class="btn btn-primary" href="${escapeHtml(sapBridgeManifestV396?.downloadPath||SAP_BRIDGE_DOWNLOAD_V390)}" download>Baixar instalador corporativo</a>`:''}${s.action==='update'?'<button type="button" class="btn btn-primary" data-v396-update>Atualizar Bridge agora</button>':''}<button type="button" class="btn btn-secondary" data-v396-check>Verificar</button></div>`;
    el.querySelector('[data-v396-check]')?.addEventListener('click',async()=>{await loadBridgeManifestV396(true);await probeSapBridgeV390(false);renderBridgeDistributionV396()});
    el.querySelector('[data-v396-update]')?.addEventListener('click',startBridgeCorporateUpdateV396);
  }
  async function startBridgeCorporateUpdateV396(){
    if(sapBridgeUpdateCheckingV396)return;sapBridgeUpdateCheckingV396=true;
    try{
      window.location.href='hapcapex-sap://update';
      const end=Date.now()+45000;
      while(Date.now()<end){
        await new Promise(r=>setTimeout(r,1500));
        try{const h=await sapBridgeRequestV390('/api/health',{},1800);if(h?.ok){sapBridgeHealthV396=h;if(sapBridgeManifestV396?.version&&compareBridgeVersionV396(h.version,sapBridgeManifestV396.version)>=0){await probeSapBridgeV390(false);return}}}catch(_){}
      }
      alert('A atualização foi iniciada, mas a nova versão ainda não respondeu. Verifique a janela do atualizador ou use o instalador corporativo.');
    }finally{sapBridgeUpdateCheckingV396=false;renderBridgeDistributionV396()}
  }

  function renderSapBridgeV390() {
    const box=document.querySelector('#v390-sap-modal .modal-box'); if(!box) return;
    const st=sapBridgeStatusV390;
    const err=st?.lastError||null;
    const online=sapBridgeOnlineV390;
    const role=(typeof state!=='undefined'&&state?.role)||'';
    const steps=[
      ['bridge','Bridge local','Conexão segura com o componente Windows'],
      ['sap','SAP GUI','Localizar e abrir o SAP deste computador'],
      ['login','Login','Usuário entra com suas próprias credenciais'],
      ['dedicated','Sessão HAPCAPEX','Nova janela exclusiva; suas outras sessões não são alteradas'],
      ['transaction','FMRP_RW_BUDCON','Abrir Report utilização orçamento'],
      ['export','Base Consumo','HAPV · exercício atual · sho_obras · /IRLANDO']
    ];
    box.querySelector('[data-v390-steps]').innerHTML=steps.map((x,i)=>`<div class="v390-step ${online?sapStepClassV390(x[0],st):i===0?'error':''}"><span class="v390-step-index">${i+1}</span><div><div class="v390-step-title">${escapeHtml(x[1])}</div><small>${escapeHtml(x[2])}</small></div><span class="v390-step-state">${online?sapStepStateV390(x[0],st):i===0?'Não conectado':'Aguardando'}</span></div>`).join('');
    const pill=box.querySelector('[data-v390-pill]');
    pill.textContent=online?`Bridge ${escapeHtml(st?.version||'online')}`:'Bridge não iniciado';
    const msg=box.querySelector('[data-v390-message]');
    msg.textContent=online?(st?.message||'Bridge pronto.'):'O componente local ainda não respondeu.';
    const errorEl=box.querySelector('[data-v390-error]');
    errorEl.innerHTML=err?`<div class="v390-sap-error"><strong>${escapeHtml(err.title||'Falha no SAP')}</strong>${escapeHtml(err.message||'')}<div class="v390-sap-solution"><b>Solução:</b> ${escapeHtml(err.solution||'Tente novamente.')}</div></div>`:'';
    const pathWrap=box.querySelector('[data-v390-path-wrap]');
    pathWrap.hidden=!(err?.code==='SAP_NOT_FOUND');
    const autoInfo=box.querySelector('[data-v390-auto-info]');
    autoInfo.innerHTML=sapBridgeAutoRunV390?'<strong>Automação ativa.</strong> O HAPCAPEX continuará automaticamente assim que cada etapa estiver pronta.':'';
    const viewer=box.querySelector('[data-v390-viewer-note]');
    viewer.hidden=role==='admin';
    box.querySelector('[data-v390-install]').hidden=true;
    box.querySelector('[data-v390-start-bridge]').hidden=online;
    box.querySelector('[data-v390-retry]').hidden=!online;
    const manualTx=err && ['SAP_TRANSACTION_NOT_FOUND','SAP_TRANSACTION_MANUAL_REQUIRED','SAP_TRANSACTION_NOT_CONFIRMED'].includes(err.code);
    box.querySelector('[data-v390-manual-tx]').hidden=!manualTx;
    box.querySelector('[data-v390-export]').hidden=!(online&&st?.state==='transaction_ready'&&!sapBridgeImportingV390);
    box.querySelector('[data-v390-import-export]').hidden=!(online&&st?.state==='export_ready'&&!sapBridgeImportingV390);
    const primary=box.querySelector('[data-v390-start]');
    if(primary){
      primary.textContent=sapPrimaryActionLabelV391(st,online);
      primary.disabled=!!sapBridgeTransitionV390||!!sapBridgeImportingV390;
    }
    box.querySelector('[data-v390-log]').textContent=online?`Etapa: ${st?.currentStep||'—'}${st?.transaction?` · Transação: ${st.transaction}`:''}${st?.exportFileName?` · Arquivo: ${st.exportFileName}`:''}`:'Instale/inicie o SAP Bridge para começar.';
    renderBridgeDistributionV396();
  }

  function openSapBridgeModalV390(){
    let modal=document.getElementById('v390-sap-modal');
    if(!modal){
      modal=document.createElement('div'); modal.id='v390-sap-modal'; modal.className='modal-backdrop';
      modal.innerHTML=`<div class="modal-box modal-wide v390-sap-box">
        <h2>Atualizar Base Consumo pelo SAP</h2>
        <p class="sub">O HAPCAPEX controla o SAP instalado neste computador sem armazenar usuário ou senha.</p>
        <div class="v390-sap-hero"><div><strong>HAPCAPEX ↔ SAP GUI</strong><small data-v390-message>Verificando o componente local...</small></div><span class="v390-sap-pill" data-v390-pill>Verificando...</span></div>
        <div class="v396-dist offline" data-v396-dist><div class="v396-dist-main"><div class="v396-dist-title">Verificando distribuição do SAP Bridge...</div></div></div>
        <div class="v390-sap-info" data-v390-auto-info></div>
        <div class="v390-step-list" data-v390-steps></div>
        <div data-v390-error></div>
        <div class="v390-sap-path" data-v390-path-wrap hidden><input type="text" data-v390-path placeholder="Cole a pasta ou o caminho do saplogon.exe"><button class="btn btn-primary" type="button" data-v390-use-path>Procurar neste caminho</button></div>
        <div class="v394-viewer-allowed" data-v390-viewer-note hidden><strong>Perfil visualizador autorizado.</strong> Você pode extrair, revisar e confirmar a Base Consumo. A atualização ficará registrada na Auditoria com usuário, origem e dados da execução.</div>
        <div class="v390-sap-actions">
          <a class="btn btn-secondary" data-v390-install href="${SAP_BRIDGE_DOWNLOAD_V390}" download>Baixar SAP Bridge</a>
          <button class="btn btn-primary" type="button" data-v390-start-bridge>Iniciar Bridge instalado</button>
          <button class="btn btn-secondary" type="button" data-v390-retry hidden>Tentar novamente</button>
          <button class="btn btn-secondary" type="button" data-v390-manual-tx hidden>Já abri a transação manualmente</button>
          <button class="btn btn-primary" type="button" data-v390-export hidden>Extrair Base Consumo</button>
          <button class="btn btn-primary" type="button" data-v390-import-export hidden>Enviar Excel ao HAPCAPEX</button>
        </div>
        <div class="v390-sap-log" data-v390-log></div>
        <div class="modal-actions"><button class="btn btn-secondary" type="button" data-v390-close>Fechar</button><button class="btn btn-primary" type="button" data-v390-start>Iniciar atualização pelo SAP</button></div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-v390-close]').onclick=()=>{stopSapBridgePollV390();modal.remove();};
      modal.querySelector('[data-v390-start]').onclick=()=>handleSapPrimaryActionV391();
      modal.querySelector('[data-v390-start-bridge]').onclick=()=>{try{window.location.href='hapcapex-sap://start';}catch(_){} setTimeout(()=>probeSapBridgeV390(true),1200);};
      modal.querySelector('[data-v390-retry]').onclick=()=>startSapAutomationV390(false);
      modal.querySelector('[data-v390-use-path]').onclick=async()=>{const path=modal.querySelector('[data-v390-path]').value.trim(); if(!path)return; await sapBridgeRequestV390('/api/sap/find',{method:'POST',body:{manualPath:path}}); await continueSapAutomationV390();};
      modal.querySelector('[data-v390-manual-tx]').onclick=async()=>{const r=await sapBridgeRequestV390('/api/sap/confirm-manual-transaction',{method:'POST'});sapBridgeStatusV390=r.status||sapBridgeStatusV390;renderSapBridgeV390();if(r.ok&&sapBridgeAutoRunV390)await continueSapAutomationV390();};
      modal.querySelector('[data-v390-export]').onclick=()=>exportSapConsumoV390();
      modal.querySelector('[data-v390-import-export]').onclick=()=>consumeSapExportV390();
    }
    loadBridgeManifestV396(false).finally(()=>renderBridgeDistributionV396());
    probeSapBridgeV390(false);
  }

  async function probeSapBridgeV390(startPoll=true){
    try{
      const health=await sapBridgeRequestV390('/api/health',{},1800);
      sapBridgeHealthV396=health?.ok?health:null;
      sapBridgeOnlineV390=!!health.ok;
      if(sapBridgeOnlineV390){const s=await sapBridgeRequestV390('/api/status',{},2500);sapBridgeStatusV390=s.status||null;}
    }catch(_){sapBridgeOnlineV390=false;sapBridgeStatusV390=null;sapBridgeHealthV396=null;}
    if(!sapBridgeManifestV396)loadBridgeManifestV396(false).finally(()=>renderBridgeDistributionV396());
    renderSapBridgeV390();
    if(startPoll){stopSapBridgePollV390();sapBridgePollV390=setInterval(pollSapBridgeV390,1800);}
    return sapBridgeOnlineV390;
  }

  async function pollSapBridgeV390(){
    if(sapBridgeTransitionV390)return;
    await probeSapBridgeV390(false);
    if(!sapBridgeAutoRunV390||!sapBridgeOnlineV390)return;

    const st=sapBridgeStatusV390;
    if(st?.state==='session_ready'){
      await advanceSapAfterLoginV392();
      return;
    }

    if(st?.state==='awaiting_login'||st?.currentStep==='login'){
      const now=Date.now();
      if(now-sapBridgeLastLoginProbeV392<2800)return;
      sapBridgeLastLoginProbeV392=now;

      sapBridgeTransitionV390=true;
      let connected=false;
      try{
        const c=await sapBridgeRequestV390('/api/sap/connect',{method:'POST'},12000);
        sapBridgeStatusV390=c.status||st;
        connected=!!c.ok;
        renderSapBridgeV390();
      }catch(_){
      }finally{
        sapBridgeTransitionV390=false;
      }
      if(connected) await advanceSapAfterLoginV392();
    }
  }

  async function startSapAutomationV390(reset=true){
    sapBridgeAutoRunV390=true; sapBridgeImportingV390=false;
    if(reset) sapCycleStartedAtV394=new Date().toISOString();
    if(!await probeSapBridgeV390(true)){renderSapBridgeV390();return;}
    if(reset){
      try{
        const rr=await sapBridgeRequestV390('/api/reset',{method:'POST'});
        sapBridgeStatusV390=rr.status||sapBridgeStatusV390;
        renderSapBridgeV390();
      }catch(_){}
    }
    await continueSapAutomationV390();
  }

  async function continueSapAutomationV390(){
    if(sapBridgeTransitionV390||!sapBridgeOnlineV390)return;
    sapBridgeTransitionV390=true;
    let next='none';
    try{
      let s=(await sapBridgeRequestV390('/api/status')).status;
      sapBridgeStatusV390=s; renderSapBridgeV390();

      if(s?.state==='export_ready'){ next='consume'; return; }
      if(s?.state==='transaction_ready'){ next='export'; return; }
      if(s?.state==='session_ready'){ next='transaction'; return; }

      if(!s?.sapFound){
        const f=await sapBridgeRequestV390('/api/sap/find',{method:'POST'});
        sapBridgeStatusV390=f.status||s; renderSapBridgeV390();
        if(!f.ok)return;
        s=f.status;
      }

      // Primeiro tenta a sessão existente pelo MacroBridge.
      const c=await sapBridgeRequestV390('/api/sap/connect',{method:'POST'},12000);
      sapBridgeStatusV390=c.status||s; renderSapBridgeV390();
      if(c.ok){ next='transaction'; return; }

      // Se não existe sessão e o SAP ainda não está aberto, abre uma única vez.
      if(!c.status?.sapRunning){
        const o=await sapBridgeRequestV390('/api/sap/open',{method:'POST'});
        sapBridgeStatusV390=o.status||c.status; renderSapBridgeV390();
      }

      startSapBridgePollingV390();
    }catch(_){
      sapBridgeOnlineV390=false; renderSapBridgeV390();
    }finally{
      sapBridgeTransitionV390=false;
    }

    if(next==='transaction') return advanceSapAfterLoginV392();
    if(next==='export') return exportSapConsumoV390();
    if(next==='consume') return consumeSapExportV390();
  }

  function startSapBridgePollingV390(){ if(!sapBridgePollV390)sapBridgePollV390=setInterval(pollSapBridgeV390,1800); }

  async function exportSapConsumoV390(){
    if(sapBridgeTransitionV390)return;
    sapBridgeTransitionV390=true;
    try{
      const year=new Date().getFullYear();
      if(sapBridgeStatusV390){sapBridgeStatusV390.state='exporting';sapBridgeStatusV390.currentStep='fill_budcon';sapBridgeStatusV390.message='Iniciando extração da Base Consumo...';renderSapBridgeV390();}
      const r=await sapBridgeRequestV390('/api/sap/export-consumo',{method:'POST',body:{year}},210000);
      sapBridgeStatusV390=r.status||sapBridgeStatusV390;renderSapBridgeV390();
      if(r.ok&&sapBridgeAutoRunV390)await consumeSapExportV390();
    }catch(error){await probeSapBridgeV390(false);}finally{sapBridgeTransitionV390=false;}
  }

  function downloadBlobV390(blob,fileName){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName||'base consumo.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);}

  async function completeSapCycleV393(){
    try{
      const r=await sapBridgeRequestV390('/api/complete-cycle',{method:'POST'},15000);
      sapBridgeStatusV390=r.status||sapBridgeStatusV390;
      sapBridgeAutoRunV390=false;
      sapBridgeImportingV390=false;
      renderSapBridgeV390();
      return !!r.ok;
    }catch(_){
      sapBridgeAutoRunV390=false;
      return false;
    }
  }

  function sapStagesSnapshotV394(st=sapBridgeStatusV390||{}){
    const order=['bridge_ready','find_sap','open_sap','login','session_ready','create_session','dedicated_session_ready','open_transaction','transaction_ready','fill_budcon','select_layout','exporting','export_ready'];
    const idx=Math.max(0,order.indexOf(String(st.currentStep||st.state||'')));
    const completed=[];
    if(st.version)completed.push('Bridge local');
    if(st.sapFound||st.sapRunning)completed.push('SAP GUI');
    if(st.sessionConnected||idx>=order.indexOf('session_ready'))completed.push('Login');
    if(st.dedicatedSessionId||idx>=order.indexOf('dedicated_session_ready'))completed.push('Sessão HAPCAPEX');
    if(st.transaction&& !['SESSION_MANAGER','S000'].includes(String(st.transaction)) || idx>=order.indexOf('transaction_ready'))completed.push('FMRP_RW_BUDCON');
    if(st.state==='export_ready'||st.exportFileName)completed.push('Base Consumo exportada');
    return [...new Set(completed)];
  }

  async function consumeSapExportV390(){
    if(sapBridgeImportingV390)return; sapBridgeImportingV390=true;renderSapBridgeV390();
    try{
      const meta=await sapBridgeRequestV390('/api/export/latest/meta',{},5000); if(!meta.ok)throw new Error(meta.error||'Export SAP não disponível.');
      const response=await fetch(SAP_BRIDGE_V390+'/api/export/latest/file',{cache:'no-store',headers:{'X-HAPCAPEX-Client':'web-v39'}}); if(!response.ok)throw new Error('Não foi possível transferir o Excel do SAP Bridge para o HAPCAPEX.');
      const blob=await response.blob(); const fileName=meta.fileName||'base consumo.xlsx';
      const st=sapBridgeStatusV390||{};
      const file=new File([blob],fileName,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',lastModified:Date.now()});
      sapBridgeImportingV390=false; renderSapBridgeV390();
      document.getElementById('v390-sap-modal')?.remove(); stopSapBridgePollV390();
      if(typeof window.importarArquivoBaseConsumo!=='function')throw new Error('O fluxo de importação segura da Base Consumo não está disponível.');
      const importResult=await window.importarArquivoBaseConsumo(file,{
        origem:'SAP',
        inicio_sap:sapCycleStartedAtV394,
        bridge_version:st.version||null,
        machineName:st.machineName||null,
        windowsUser:st.windowsUser||null,
        sapUser:st.sapUser||null,
        sapSystem:st.sapSystem||null,
        sapClient:st.sapClient||null,
        sapWindowTitle:st.sapWindowTitle||null,
        dedicatedSessionId:st.dedicatedSessionId||null,
        dedicatedSessionCreatedAt:st.dedicatedSessionCreatedAt||null,
        etapa_final_sap:st.currentStep||null,
        etapas_concluidas:sapStagesSnapshotV394(st),
        arquivo_exportado:fileName,
        export_bytes:meta.bytes||st.exportBytes||null
      });
      if(['confirmed','cancelled'].includes(importResult?.status)) await completeSapCycleV393();
    }catch(error){
      const errBox=document.querySelector('#v390-sap-modal [data-v390-error]');
      if(errBox)errBox.innerHTML=`<div class="v390-sap-error"><strong>Falha ao enviar Base Consumo ao HAPCAPEX</strong>${escapeHtml(error.message||String(error))}</div>`;
    }finally{sapBridgeImportingV390=false;renderSapBridgeV390();}
  }

  function decorateSapBridgeEntryV390(){
    const importBtn=document.getElementById('importar-btn');
    const toolbar=(state.tab==='base_consumo'?document.querySelector('.toolbar'):null);
    if(toolbar && !document.getElementById('v390-sap-btn')){
      const btn=document.createElement('button');btn.id='v390-sap-btn';btn.type='button';btn.className='btn btn-secondary v390-sap-btn';btn.textContent='Atualizar pelo SAP';btn.onclick=openSapBridgeModalV390;
      if(importBtn&&importBtn.parentNode===toolbar)toolbar.insertBefore(btn,importBtn);else toolbar.appendChild(btn);
    }
    if(isPhoneV380()){
      const actions=document.querySelector('.v381-control-head-actions');
      if(actions && !actions.querySelector('[data-v390-sap-head]')){
        const b=document.createElement('button');b.type='button';b.dataset.v390SapHead='1';b.setAttribute('data-v390-sap-head','');b.setAttribute('aria-label','Atualizar Base Consumo pelo SAP');b.textContent='S';b.style.fontSize='13px';b.style.fontWeight='900';b.onclick=openSapBridgeModalV390;actions.insertBefore(b,actions.lastElementChild);
      }
      const grid=document.querySelector('#v380-more-sheet .v380-sheet-grid');
      if(grid && !grid.querySelector('[data-v390-sap-more]')){
        const b=document.createElement('button');b.type='button';b.setAttribute('data-v390-sap-more','');b.textContent='🔄 Atualizar pelo SAP';b.onclick=()=>{closeMoreV380();openSapBridgeModalV390();};grid.prepend(b);
      }
    }
  }

  function initSapBridgeV390(){
    decorateSapBridgeEntryV390();
    if(window.__HAP_V390_SAP_OBSERVER__)return;
    let pending=false;
    window.__HAP_V390_SAP_OBSERVER__=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;decorateSapBridgeEntryV390();});});
    window.__HAP_V390_SAP_OBSERVER__.observe(document.body,{childList:true,subtree:true});
  }


  // ==========================================================
  // V39.4 — Base Consumo como fonte operacional oficial.
  // Visualizadores podem atualizar Base Consumo e consultar/exportar Base O.I,
  // sem receber permissões administrativas dos demais módulos.
  // ==========================================================
  const HAPVIDA_LOGO_PNG_V394 = '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';

  function ensureV394State(){
    initState();
    if(!state.v394) state.v394={lastUpdate:null,lastUpdateLoaded:false};
  }

  loadRoleAndData = window.loadRoleAndData = async function(){
    const uid=state.session?.user?.id;
    if(!uid){renderLogin('Sessão inválida. Entre novamente.');return;}
    const {data:profile,error:profErr}=await sb.from('profiles').select('role, full_name').eq('id',uid).single();
    if(profErr){renderLogin('Não foi possível ler seu perfil: '+profErr.message);return;}
    state.role=profile.role;
    state.fullName=profile.full_name||state.session.user.email;
    if(state.role==='viewer'){
      state.tab=['capex','base_oi','base_consumo'].includes(state.tab)?state.tab:'capex';
      await loadCurveFinanceReference();
      await refreshCurrent();
      return;
    }
    await loadCurveFinanceReference();
    await refreshCurrent();
  };

  async function loadLastBaseConsumoV394(force=false){
    ensureV394State();
    if(state.v394.lastUpdateLoaded&&!force)return state.v394.lastUpdate;
    const {data,error}=await sb.rpc('obter_ultima_atualizacao_base_consumo');
    if(!error){state.v394.lastUpdate=data||null;state.v394.lastUpdateLoaded=true;}
    return state.v394.lastUpdate;
  }

  function formatLastUpdateV394(v){
    if(!v)return 'Nunca atualizada';
    try{return new Date(v).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_){return String(v);}
  }

  function decorateRoleBadgeV394(){
    if(state.role!=='viewer')return;
    document.querySelectorAll('.role-badge').forEach(el=>el.textContent='Visualizador');
  }

  function decorateBaseConsumoV394(){
    const rootBefore=document.getElementById('app');
    const childCountBefore=rootBefore?.children?.length||0;
    if(state.tab!=='base_consumo')return;
    decorateRoleBadgeV394();
    const grid=document.querySelector('.kpi-grid'); if(!grid)return;
    if(state.role==='viewer'){
      // Garante primeiro o único comando permitido e só depois remove importação/edição manual.
      decorateSapBridgeEntryV390();
      document.getElementById('importar-btn')?.remove();
      document.getElementById('import-file-input')?.remove();
      document.getElementById('import-status')?.remove();
      document.getElementById('v35-link-ois-btn')?.remove();
      document.querySelectorAll('[onclick*="abrirCriarOiPrefill"]').forEach(el=>el.remove());
      const toolbar=document.querySelector('.toolbar');
      toolbar?.querySelectorAll('button').forEach(btn=>{if(btn.id!=='v390-sap-btn')btn.remove();});
    }
    document.querySelector('.v394-last-update')?.remove();
    const u=state.v394?.lastUpdate||null;
    const card=document.createElement('div');card.className='v394-last-update';
    const source=u?.origem||'—';
    const lines=Number(u?.total_linhas||u?.totais_financeiros?.qtd||0);
    card.innerHTML=`<div class="v394-last-update-main"><div class="v394-last-update-title">Última atualização da Base Consumo</div><div class="v394-last-update-value">${escapeHtml(formatLastUpdateV394(u?.atualizado_em))}</div><div class="v394-last-update-meta">${u?`${escapeHtml(u.usuario_nome||u.usuario_email||'Usuário')} · ${escapeHtml(source)} · ${lines.toLocaleString('pt-BR')} lançamentos · ${escapeHtml(u.arquivo||'arquivo não informado')}`:'Ainda não há atualização concluída.'}</div></div><span class="v394-last-update-badge">CAPEX + Base O.I sincronizados</span>`;
    grid.parentNode.insertBefore(card,grid);
    // V39.4.1 — nunca procurar o aviso em todos os DIVs: o #app também contém
    // o texto dos seus filhos e, na V39.4, acabava tendo todo o conteúdo substituído.
    const appRoot=document.getElementById('app');
    const lock=appRoot ? [...appRoot.children].find(el=>
      el.tagName==='DIV' &&
      el.children.length===0 &&
      el.textContent?.includes('Somente leitura') &&
      el.textContent?.includes('fotografia anterior')
    ) : null;
    if(lock){
      lock.innerHTML='🔒 A Base Consumo é a fonte operacional de Compromissado e Saldo. Toda confirmação atualiza CAPEX + Base O.I; a Curva de Capex permanece independente.';
      lock.dataset.v394Info='1';
    }
    // V394_APP_INTEGRITY: decoração nunca pode colapsar a página para um único aviso.
    if(rootBefore && childCountBefore>1 && rootBefore.children.length<=1){
      console.error('[HAPCAPEX V39.4.1] Integridade da Base Consumo comprometida durante decoração.');
    }
  }

  function decorateBaseOiV394(){
    if(state.tab!=='base_oi')return;
    decorateRoleBadgeV394();
    const toolbar=document.querySelector('.toolbar'); if(!toolbar)return;
    if(state.role==='viewer'){
      document.getElementById('importar-oi-btn')?.remove();
      document.getElementById('nova-oi-btn')?.remove();
      document.getElementById('import-file-input-oi')?.remove();
      document.getElementById('import-status-oi')?.remove();
      document.getElementById('v35-link-ois-btn')?.remove();
      const table=document.querySelector('.table-card table');
      const headers=table?[...table.querySelectorAll('thead th')]:[];
      const actionIndex=headers.findIndex(th=>String(th.textContent||'').trim().toLowerCase()==='ações');
      if(actionIndex>=0){
        headers[actionIndex]?.remove();
        table.querySelectorAll('tbody tr').forEach(tr=>{if(tr.children[actionIndex])tr.children[actionIndex].remove();});
      }
      document.querySelectorAll('[onclick^="editarOi"],[onclick^="excluirOi"]').forEach(el=>el.remove());
    }
    if(!document.getElementById('v394-export-base-oi')){
      const b=document.createElement('button');b.id='v394-export-base-oi';b.type='button';b.className='btn btn-primary v394-export-btn';b.textContent='⇩ Exportar Base O.I';b.onclick=exportBaseOiExcelV394;toolbar.appendChild(b);
    }
  }

  loadBaseConsumoTab = window.loadBaseConsumoTab = async function(){
    await loadLastBaseConsumoV394(false);
    return originalLoadBaseConsumoTabV394();
  };
  renderBaseConsumoTab = window.renderBaseConsumoTab = function(...args){
    const out=originalRenderBaseConsumoTabV394(...args);decorateBaseConsumoV394();return out;
  };
  loadBaseOiTab = window.loadBaseOiTab = async function(){
    await loadLastBaseConsumoV394(false);
    return originalLoadBaseOiTabV394();
  };
  renderBaseOiTab = window.renderBaseOiTab = function(...args){
    const out=originalRenderBaseOiTabV394(...args);decorateBaseOiV394();return out;
  };

  async function ensureExcelJsV394(){
    if(window.ExcelJS)return window.ExcelJS;
    await new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-hap-exceljs]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');s.dataset.hapExceljs='1';s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o módulo de exportação Excel.'));document.head.appendChild(s);
    });
    if(!window.ExcelJS)throw new Error('Módulo ExcelJS indisponível.');
    return window.ExcelJS;
  }

  function downloadBufferV394(buffer,fileName){
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
  }

  async function validateBaseOiWorkbookV395(ExcelJS,buffer,expectedOis){
    if(!buffer||Number(buffer.byteLength||buffer.length||0)<5000)throw new Error('O arquivo Excel gerado ficou incompleto.');
    const bytes=new Uint8Array(buffer);
    if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4B)throw new Error('O arquivo gerado não possui estrutura XLSX válida.');
    const check=new ExcelJS.Workbook();
    await check.xlsx.load(buffer);
    const sheet=check.getWorksheet('BASE OI');
    if(!sheet)throw new Error('Validação interna: a planilha BASE OI não foi encontrada no arquivo gerado.');

    const expectedHeaders=['OI','Obra','Montante','Compromissado','Saldo','% Comp.','Pacote CAPEX','HEAD Operação'];
    expectedHeaders.forEach((h,i)=>{
      const value=String(sheet.getCell(6,i+1).value??'').trim();
      if(value!==h)throw new Error(`Validação interna: cabeçalho ${h} não foi preservado.`);
    });

    // V39.5.1 — não usa actualRowCount para deduzir quantidade de dados.
    // actualRowCount conta somente linhas com conteúdo; a linha 5 é
    // propositalmente vazia no relatório e fazia a validação perder 1 registro.
    const expectedList=(Array.isArray(expectedOis)?expectedOis:[])
      .map(v=>String(v??'').trim())
      .filter(Boolean);

    const exportedList=[];
    sheet.eachRow({includeEmpty:false},(row,rowNumber)=>{
      if(rowNumber<7)return;
      const rawOi=row.getCell(1).value;
      if(rawOi===null||rawOi===undefined||rawOi==='')return;
      if(typeof rawOi!=='number'||!Number.isFinite(rawOi)){
        throw new Error(`Validação interna: a OI da linha ${rowNumber} não foi gravada como número.`);
      }
      exportedList.push(String(Math.trunc(rawOi)));
    });

    const lastDataRow=6+expectedList.length;
    const expectedSubtotals={
      C5:`SUBTOTAL(9,C7:C${lastDataRow})`,
      D5:`SUBTOTAL(9,D7:D${lastDataRow})`,
      E5:`SUBTOTAL(9,E7:E${lastDataRow})`
    };
    Object.entries(expectedSubtotals).forEach(([addr,expectedFormula])=>{
      const formula=String(sheet.getCell(addr).formula||'').replace(/\s+/g,'').toUpperCase();
      if(formula!==expectedFormula.toUpperCase()){
        throw new Error(`Validação interna: a fórmula ${addr} não foi preservada corretamente.`);
      }
      if(!String(sheet.getCell(addr).numFmt||'').includes('R$')){
        throw new Error(`Validação interna: o total ${addr} não está em formato contábil.`);
      }
      if(sheet.getCell(addr).font?.bold!==true){
        throw new Error(`Validação interna: o total ${addr} não está em negrito.`);
      }
    });

    if(exportedList.length!==expectedList.length){
      const exportedSet=new Set(exportedList);
      const expectedSet=new Set(expectedList);
      const missing=[...expectedSet].filter(oi=>!exportedSet.has(oi));
      const extra=[...exportedSet].filter(oi=>!expectedSet.has(oi));
      const details=[
        missing.length?`faltando: ${missing.slice(0,10).join(', ')}${missing.length>10?'…':''}`:'',
        extra.length?`inesperadas: ${extra.slice(0,10).join(', ')}${extra.length>10?'…':''}`:''
      ].filter(Boolean).join(' · ');
      throw new Error(`Validação interna: eram esperadas ${expectedList.length} OIs e o arquivo contém ${exportedList.length}.${details?` ${details}`:''}`);
    }

    const duplicates=exportedList.filter((oi,idx,arr)=>arr.indexOf(oi)!==idx);
    if(duplicates.length){
      const unique=[...new Set(duplicates)];
      throw new Error(`Validação interna: OI duplicada no Excel: ${unique.slice(0,10).join(', ')}${unique.length>10?'…':''}`);
    }

    const expectedSet=new Set(expectedList);
    const exportedSet=new Set(exportedList);
    const missing=[...expectedSet].filter(oi=>!exportedSet.has(oi));
    if(missing.length){
      throw new Error(`Validação interna: ${missing.length} OI(s) não foram preservadas no Excel: ${missing.slice(0,10).join(', ')}${missing.length>10?'…':''}`);
    }
    return true;
  }

  async function exportBaseOiExcelV394(){
    const btn=document.getElementById('v394-export-base-oi');if(btn){btn.disabled=true;btn.textContent='Gerando e validando Excel...';}
    try{
      const ExcelJS=await ensureExcelJsV394();
      if(!state.baseOiRows?.length)await loadBaseOiTab();
      await loadLastBaseConsumoV394(false);
      const exportExercise=Number(state.v394?.lastUpdate?.exercicio||new Date().getFullYear());
      const rows=(state.baseOiRows||[]).filter(x=>String(x.ordem_interna)!==OI_BALDE_CONTINGENCIA && (!x.exercicio||Number(x.exercicio)===exportExercise));
      if(!rows.length)throw new Error('Nenhuma OI disponível para exportação no exercício atual.');

      const wb=new ExcelJS.Workbook();
      wb.creator='HAPCAPEX';
      wb.lastModifiedBy=state.fullName||'HAPCAPEX';
      wb.company='Hapvida';
      wb.created=new Date();
      wb.modified=new Date();

      // V39.5 SAFE XLSX: sem objeto Excel Table.
      // Mantemos aparência de tabela + AutoFilter único para evitar combinação
      // de Table/AutoFilter que pode gerar reparo de conteúdo no Excel.
      const ws=wb.addWorksheet('BASE OI',{
        views:[{state:'frozen',ySplit:6,activeCell:'A7'}],
        properties:{defaultRowHeight:18},
        pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:.25,right:.25,top:.45,bottom:.45,header:.2,footer:.2}}
      });

      const HAP_BLUE='1539AA';
      const HAP_BLUE_DARK='0D2B4E';
      const HAP_BLUE_LIGHT='EEF4FF';
      const HAP_ORANGE='FF5A00';
      const WHITE='FFFFFF';
      const TEXT='1A2233';
      const GRID='D9E2EF';
      const ROW_ALT='F6F9FE';
      const RED='A52727';
      const RED_LIGHT='FDECEC';

      // Cabeçalho institucional: logo transparente em área clara; título em azul Hapvida.
      for(let r=1;r<=4;r++){
        ws.getRow(r).height=r===1?24:20;
        for(let c=1;c<=2;c++)ws.getCell(r,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'F8FAFF'}};
        for(let c=3;c<=8;c++)ws.getCell(r,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:HAP_BLUE}};
      }
      const imgId=wb.addImage({base64:`data:image/png;base64,${HAPVIDA_LOGO_PNG_V394}`,extension:'png'});
      ws.addImage(imgId,{tl:{col:.10,row:.22},ext:{width:220,height:54}});

      ws.mergeCells('C1:H1');
      ws.getCell('C1').value='BASE O.I — CONTROLE DE CAPEX';
      ws.getCell('C1').font={name:'Calibri',size:17,bold:true,color:{argb:WHITE}};
      ws.getCell('C1').alignment={vertical:'middle'};

      ws.mergeCells('C2:H2');
      ws.getCell('C2').value='Posição financeira consolidada por Ordem Interna';
      ws.getCell('C2').font={name:'Calibri',size:10,color:{argb:'EAF0FF'}};

      const u=state.v394?.lastUpdate||{};
      const last=formatLastUpdateV394(u.atualizado_em);
      ws.mergeCells('C3:H3');
      ws.getCell('C3').value=`Última Base Consumo: ${last} · ${u.origem||'origem não informada'}${u.usuario_nome?` · ${u.usuario_nome}`:''}`;
      ws.getCell('C3').font={name:'Calibri',size:9,color:{argb:WHITE}};

      ws.mergeCells('C4:H4');
      ws.getCell('C4').value=`Exercício ${exportExercise} · ${rows.length.toLocaleString('pt-BR')} OIs · Gerado em ${new Date().toLocaleString('pt-BR')}`;
      ws.getCell('C4').font={name:'Calibri',size:9,color:{argb:'EAF0FF'}};

      for(let c=1;c<=8;c++){
        ws.getCell(4,c).border={bottom:{style:'medium',color:{argb:HAP_ORANGE}}};
      }

      const headers=['OI','Obra','Montante','Compromissado','Saldo','% Comp.','Pacote CAPEX','HEAD Operação'];
      headers.forEach((h,i)=>{
        const cell=ws.getCell(6,i+1);
        cell.value=h;
        cell.font={name:'Calibri',bold:true,color:{argb:WHITE},size:10};
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:HAP_BLUE_DARK}};
        cell.alignment={vertical:'middle',horizontal:(i>=2&&i<=5)?'right':'left'};
        cell.border={bottom:{style:'thin',color:{argb:HAP_BLUE}},right:{style:'thin',color:{argb:'365A80'}}};
      });
      ws.getRow(6).height=24;

      // Larguras definidas individualmente, sem reatribuir worksheet.columns.
      [14,48,18,18,18,12,25,23].forEach((w,i)=>{ws.getColumn(i+1).width=w;});

      const data=rows.map(x=>{
        const oiRaw=String(x.ordem_interna||'').trim();
        const oiNumber=/^\d+$/.test(oiRaw)?Number(oiRaw):oiRaw;
        return [
          oiNumber,
          x.obra||x.descricao||'',
          Number(x.montante_atribuido||0),
          Number(x.valor_compromissado||0),
          Number(x.saldo_disponivel||0),
          x.percentual_compromissado===null||x.percentual_compromissado===undefined?null:Number(x.percentual_compromissado),
          x.classificacao_pacote_capex||'',
          x.classificacao_head_operacao||''
        ];
      });

      data.forEach((values,idx)=>{
        const rowNo=7+idx;
        const row=ws.getRow(rowNo);
        row.values=values;
        row.height=19;
        const alt=idx%2===1;
        for(let c=1;c<=8;c++){
          const cell=ws.getCell(rowNo,c);
          cell.font={name:'Calibri',size:9,color:{argb:TEXT}};
          cell.alignment={vertical:'middle',horizontal:c===1?'center':(c>=3&&c<=6?'right':'left')};
          cell.border={bottom:{style:'hair',color:{argb:GRID}}};
          if(alt)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:ROW_ALT}};
        }
        ws.getCell(rowNo,1).numFmt='0';
        ws.getCell(rowNo,3).numFmt='"R$" #,##0.00;[Red]-"R$" #,##0.00';
        ws.getCell(rowNo,4).numFmt='"R$" #,##0.00;[Red]-"R$" #,##0.00';
        ws.getCell(rowNo,5).numFmt='"R$" #,##0.00;[Red]-"R$" #,##0.00';
        ws.getCell(rowNo,6).numFmt='0.0%';

        if(Number(values[4])<0){
          ws.getCell(rowNo,5).font={name:'Calibri',size:9,bold:true,color:{argb:RED}};
          ws.getCell(rowNo,5).fill={type:'pattern',pattern:'solid',fgColor:{argb:RED_LIGHT}};
        }
        if(values[5]!==null&&Number(values[5])>1){
          ws.getCell(rowNo,6).font={name:'Calibri',size:9,bold:true,color:{argb:RED}};
        }
      });

      const lastRow=6+data.length;

      // V39.5.2 — totais filtráveis acima do cabeçalho.
      // Excel armazena a fórmula em inglês/com vírgulas e, no Excel PT-BR,
      // ela é exibida/localizada como SUBTOTAL(9;...).
      const totals=data.reduce((acc,row)=>{
        acc.montante+=Number(row[2]||0);
        acc.compromissado+=Number(row[3]||0);
        acc.saldo+=Number(row[4]||0);
        return acc;
      },{montante:0,compromissado:0,saldo:0});

      wb.calcProperties.fullCalcOnLoad=true;
      wb.calcProperties.forceFullCalc=true;

      ws.getCell('B5').value='TOTAIS FILTRADOS';
      ws.getCell('B5').font={name:'Calibri',size:9,bold:true,color:{argb:WHITE}};
      ws.getCell('B5').fill={type:'pattern',pattern:'solid',fgColor:{argb:HAP_ORANGE}};
      ws.getCell('B5').alignment={vertical:'middle',horizontal:'center'};
      ws.getCell('B5').border={
        top:{style:'thin',color:{argb:HAP_ORANGE}},
        bottom:{style:'thin',color:{argb:HAP_ORANGE}},
        left:{style:'thin',color:{argb:HAP_ORANGE}},
        right:{style:'thin',color:{argb:HAP_ORANGE}}
      };

      const accountingFmt='"R$"* #,##0.00;[Red]-"R$"* #,##0.00;"R$"* "-"??';
      const subtotalDefs=[
        ['C5',`SUBTOTAL(9,C7:C${lastRow})`,totals.montante],
        ['D5',`SUBTOTAL(9,D7:D${lastRow})`,totals.compromissado],
        ['E5',`SUBTOTAL(9,E7:E${lastRow})`,totals.saldo]
      ];
      subtotalDefs.forEach(([addr,formula,result])=>{
        const cell=ws.getCell(addr);
        cell.value={formula,result};
        cell.numFmt=accountingFmt;
        cell.font={name:'Calibri',size:10,bold:true,color:{argb:HAP_BLUE_DARK}};
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:HAP_BLUE_LIGHT}};
        cell.alignment={vertical:'middle',horizontal:'right'};
        cell.border={
          top:{style:'thin',color:{argb:HAP_BLUE}},
          bottom:{style:'thin',color:{argb:HAP_BLUE}},
          left:{style:'thin',color:{argb:'B8CAE4'}},
          right:{style:'thin',color:{argb:'B8CAE4'}}
        };
      });
      ws.getRow(5).height=22;

      // Um único filtro na planilha; não há table.xml nesta versão.
      ws.autoFilter={from:'A6',to:`H${lastRow}`};
      ws.headerFooter.oddFooter='&LHAPCAPEX — Base O.I&C&P de &N&RConfidencial';

      const buffer=await wb.xlsx.writeBuffer();
      await validateBaseOiWorkbookV395(ExcelJS,buffer,data.map(row=>row[0]));

      const date=new Date().toISOString().slice(0,10).replace(/-/g,'.');
      downloadBufferV394(buffer,`BASE OI HAPCAPEX - ${date}.xlsx`);
    }catch(e){
      console.error('[HAPCAPEX V39.5.2] Falha na exportação Base O.I',e);
      alert('Erro ao exportar Base O.I: '+(e.message||e));
    }finally{
      if(btn){btn.disabled=false;btn.textContent='⇩ Exportar Base O.I';}
    }
  }
  window.exportBaseOiExcelV394=exportBaseOiExcelV394;

  function sapAuditContextV394(extra={}){
    const st=sapBridgeStatusV390||{};
    return {
      origem:'SAP',inicio_sap:sapCycleStartedAtV394,fim_sap:new Date().toISOString(),hapcapex_versao:VERSION,
      bridge_version:st.version||null,machineName:st.machineName||null,windowsUser:st.windowsUser||null,
      sapUser:st.sapUser||null,sapSystem:st.sapSystem||null,sapClient:st.sapClient||null,
      dedicatedSessionId:st.dedicatedSessionId||null,etapa:st.currentStep||null,
      etapas_concluidas:sapStagesSnapshotV394(st),erro:st.lastError||null,...extra
    };
  }
  async function registerSapProblemV394(status,extra={}){
    try{await sb.rpc('registrar_execucao_sap_base_consumo',{p_status:status,p_contexto:sapAuditContextV394(extra)});}catch(_){}
  }
  function auditSapErrorIfNeededV394(){
    const st=sapBridgeStatusV390;if(!st?.lastError||!sapBridgeAutoRunV390)return;
    const key=[st.lastError.code,st.currentStep,st.updatedAt].join('|');
    if(key===sapLastAuditedErrorKeyV394)return;
    sapLastAuditedErrorKeyV394=key;
    registerSapProblemV394('erro',{diagnostico:st.lastError});
  }

  const originalRenderSapBridgeV394=renderSapBridgeV390;
  renderSapBridgeV390=function(...args){
    const out=originalRenderSapBridgeV394(...args);
    const viewer=document.querySelector('#v390-sap-modal [data-v390-viewer-note]');
    if(viewer)viewer.hidden=state.role!=='viewer';
    auditSapErrorIfNeededV394();
    return out;
  };

  // Ajusta navegação mobile para o perfil visualizador.
  const originalCreateControlDockV394=createControlDockV380;
  createControlDockV380=function(...args){
    const out=originalCreateControlDockV394(...args);
    if(state.role==='viewer'){
      document.querySelector('#v380-control-dock [data-v380-tab="transferencias"]')?.remove();
      const more=document.querySelector('#v380-control-dock [data-v380-more]');if(more)more.remove();
      const dock=document.getElementById('v380-control-dock');if(dock)dock.style.gridTemplateColumns='repeat(3,1fr)';
    }
    return out;
  };


  injectStyles();
  initState();
  watchFinancialModalsV374();
  initMobileAndHistoryPolishV3710();
  initFullMobileV380();
  initSapBridgeV390();
  window.HAP_V37 = { version: VERSION, CAPEX_INICIAL_CONTROLE, OI_BALDE_CONTINGENCIA };
  window.HAP_V37_4 = window.HAP_V37;
  window.HAP_V37_1 = window.HAP_V37;
  window.HAP_V37_3 = window.HAP_V37;
  window.HAP_V37_8 = window.HAP_V37;
  window.HAP_V37_9 = window.HAP_V37;
  window.HAP_V37_10 = window.HAP_V37;
  window.HAP_V38 = window.HAP_V37;
  window.HAP_V38_2 = window.HAP_V37;
  window.HAP_V39 = window.HAP_V37;
  window.HAP_V39_4 = window.HAP_V37;
  window.HAP_V39_5 = window.HAP_V37;
  window.HAP_V39_7 = window.HAP_V37;
})();
