/* HAPCAPEX V40.0.56 — Roteamento confiável de exceção de contingenciamento
   Corrige a V40.0.55 no ponto real de execução:
   intercepta somente a RPC contingenciar_obra_integrado_v36 ANTES do backend normal.
*/
(() => {
  'use strict';

  if (window.__HAP_V40056_CONTING_RPC_ROUTER__) return;
  window.__HAP_V40056_CONTING_RPC_ROUTER__ = true;

  const VERSION = '40.0.56';
  const EPS = 0.005;

  function brl(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function realizedTotal(realizado) {
    return Object.values(realizado || {}).reduce((sum, value) => {
      const n = Number(value);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  async function inspectOi(client, oi) {
    const { data, error } = await client
      .from('capex_items')
      .select('id,ordem,nome,capex,realizado')
      .eq('ordem', String(oi || '').trim())
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const capex = Number(data.capex || 0);
    const realizado = realizedTotal(data.realizado);

    return {
      ...data,
      capex,
      realizado,
      gap: capex - realizado,
      preexistingDeficit: capex + EPS < realizado
    };
  }

  function confirmationText(info, args) {
    const tipo = args?.p_tipo === 'total' ? 'Total' : 'Parcial';
    const value = args?.p_tipo === 'total'
      ? 'todo o saldo disponível'
      : brl(Number(args?.p_valor || 0));

    return (
      'EXCEÇÃO CONTROLADA DE CONTINGENCIAMENTO\n\n' +
      `O.I.: ${info.ordem}\n` +
      `${info.nome || ''}\n\n` +
      `CAPEX atual na Curva: ${brl(info.capex)}\n` +
      `Realizado acumulado: ${brl(info.realizado)}\n` +
      `Diferença já existente: ${brl(info.gap)}\n\n` +
      `Contingenciamento: ${tipo} — ${value}\n\n` +
      'Esta obra JÁ estava com o CAPEX abaixo do realizado antes deste movimento.\n' +
      'O contingenciamento não é a causa da inconsistência.\n\n' +
      'Deseja autorizar excepcionalmente este contingenciamento?\n\n' +
      'A autorização e os valores serão registrados na Auditoria.'
    );
  }

  function install() {
    if (typeof sb === 'undefined' || !sb || typeof sb.rpc !== 'function') {
      setTimeout(install, 80);
      return;
    }

    if (sb.__hapV40056RpcRouterInstalled) return;

    const originalRpc = sb.rpc.bind(sb);

    const routedRpc = async function(fn, args, options) {
      if (fn !== 'contingenciar_obra_integrado_v36') {
        return originalRpc(fn, args, options);
      }

      const oi = String(args?.p_ordem_interna || '').trim();

      try {
        const info = await inspectOi(sb, oi);

        // Sem obra na Curva ou sem déficit preexistente:
        // preserva 100% o comportamento original.
        if (!info || !info.preexistingDeficit) {
          return originalRpc(fn, args, options);
        }

        const authorized = window.confirm(confirmationText(info, args));

        if (!authorized) {
          return {
            data: null,
            error: {
              message: 'Contingenciamento cancelado. A exceção não foi autorizada.'
            }
          };
        }

        console.info(
          `[HAPCAPEX ${VERSION}] Exceção autorizada para O.I. ${oi}: ` +
          `CAPEX ${info.capex}, realizado ${info.realizado}.`
        );

        return originalRpc(
          'contingenciar_obra_integrado_excecao_v4055',
          {
            ...(args || {}),
            p_autorizar_excecao: true
          },
          options
        );
      } catch (inspectionError) {
        // Falhar ao inspecionar nunca deve liberar exceção silenciosamente.
        // Retorna ao fluxo seguro/original, que manterá a trava do backend.
        console.error(
          `[HAPCAPEX ${VERSION}] Não foi possível avaliar a exceção; ` +
          'mantendo o fluxo protegido original.',
          inspectionError
        );
        return originalRpc(fn, args, options);
      }
    };

    // Preserva referência para diagnóstico.
    Object.defineProperty(sb, '__hapV40056OriginalRpc', {
      configurable: true,
      value: originalRpc
    });
    Object.defineProperty(sb, '__hapV40056RpcRouterInstalled', {
      configurable: true,
      value: true
    });

    sb.rpc = routedRpc;

    window.HAP_V40056_CONTING_RPC_ROUTER = {
      version: VERSION,
      installed: true,
      inspectOi: oi => inspectOi(sb, oi)
    };

    console.info(`[HAPCAPEX ${VERSION}] Roteador de contingenciamento instalado.`);
  }

  install();
})();
