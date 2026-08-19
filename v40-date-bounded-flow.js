/* HAPCAPEX V40.0.39 — 15/75/10 ancorado nas datas + retenção pós-término.
   CORREÇÃO da V40.0.38.

   Regra standard_15_75_10:
   - 15% no mês de início da obra;
   - 75% distribuídos igualmente entre os meses seguintes de execução,
     até e incluindo o mês da data de fim;
   - 5% no primeiro mês posterior à data de fim;
   - 5% no segundo mês posterior à data de fim.

   Invariantes:
   - trocar/recalcular a regra NÃO altera data_inicio nem data_fim;
   - o mês atual NÃO pode ser usado como novo início;
   - os 10% após a data fim são uma exceção EXCLUSIVA e intencional
     da regra 15/75/10 (retenções pós-obra);
   - o fluxo fecha exatamente no CAPEX, em centavos.
*/
(() => {
  'use strict';
  if (window.__HAP_V4039_STANDARD_DATE_ANCHOR__) return;
  window.__HAP_V4039_STANDARD_DATE_ANCHOR__ = true;

  const VERSION = '40.0.39';
  const RULE = 'standard_15_75_10';
  const EPS = 0.005;

  const FALLBACK_MONTHS = [
    ['jan','JAN/26'],['fev','FEV/26'],['mar','MAR/26'],['abr','ABR/26'],
    ['mai','MAI/26'],['jun','JUN/26'],['jul','JUL/26'],['ago','AGO/26'],
    ['set','SET/26'],['out','OUT/26'],['nov','NOV/26'],['dez','DEZ/26'],
    ['jan27','JAN/27'],['fev27','FEV/27'],['mar27','MAR/27'],['abr27','ABR/27'],
    ['mai27','MAI/27'],['jun27','JUN/27'],['jul27','JUL/27']
  ].map(([key,label]) => ({key,label}));

  let installed = false;
  let originalRaw = null;
  let originalFlow = null;

  function months() {
    try {
      if (typeof MONTHS !== 'undefined' && Array.isArray(MONTHS)) return MONTHS;
    } catch (_) {}
    return FALLBACK_MONTHS;
  }

  function getRule(obra) {
    return String(obra?._flowRule || obra?.flow_rule || '').trim();
  }

  function parseDate(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return null;

    let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return { y:Number(m[3]), m:Number(m[2]), d:Number(m[1]) };

    m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return { y:Number(m[1]), m:Number(m[2]), d:Number(m[3]) };

    return null;
  }

  function daysInMonth(year,month) {
    return new Date(Date.UTC(year,month,0)).getUTCDate();
  }

  function validDate(p) {
    return !!p &&
      Number.isInteger(p.y) && Number.isInteger(p.m) && Number.isInteger(p.d) &&
      p.m >= 1 && p.m <= 12 &&
      p.d >= 1 && p.d <= daysInMonth(p.y,p.m);
  }

  function serialDay(p) {
    return Math.floor(Date.UTC(p.y,p.m-1,p.d)/86400000);
  }

  function monthSerial(year,month) {
    return year*12 + (month-1);
  }

  function nextMonthObj(p) {
    return p.m === 12 ? {y:p.y+1,m:1} : {y:p.y,m:p.m+1};
  }

  function addMonths(p,n) {
    let out={y:p.y,m:p.m};
    for(let i=0;i<n;i++) out=nextMonthObj(out);
    return out;
  }

  function monthKey(year,month) {
    const list=months();
    const idx=(Number(year)-2026)*12+(Number(month)-1);
    return idx>=0 && idx<list.length ? list[idx].key : null;
  }

  function emptyFlow() {
    const flow={};
    months().forEach(m=>{flow[m.key]=0;});
    return flow;
  }

  function executionMonths(start,end) {
    const result=[];
    let cursor=nextMonthObj({y:start.y,m:start.m});
    const endSerial=monthSerial(end.y,end.m);
    let guard=0;

    while(monthSerial(cursor.y,cursor.m)<=endSerial && guard++<120){
      result.push({y:cursor.y,m:cursor.m,key:monthKey(cursor.y,cursor.m)});
      cursor=nextMonthObj(cursor);
    }
    return result;
  }

  function distributeEqualCents(totalCents,count) {
    if (count<=0) return [];
    const base=Math.floor(totalCents/count);
    let remainder=totalCents-base*count;
    return Array.from({length:count},(_,i)=>base+(i<remainder?1:0));
  }

  function computeStandardFlow(obra,fallback) {
    const flow=emptyFlow();
    const capex=Math.max(0,Number(obra?.capex||0));
    if(capex<=EPS) return flow;

    const start=parseDate(obra?.inicio);
    const end=parseDate(obra?.fim);

    if(!validDate(start)||!validDate(end)||serialDay(end)<serialDay(start)){
      console.error(`[HAPCAPEX ${VERSION}] 15/75/10 exige datas válidas.`,
        obra?.nome,obra?.inicio,obra?.fim);
      return typeof fallback==='function'?fallback(obra):flow;
    }

    const startKey=monthKey(start.y,start.m);
    const exec=executionMonths(start,end);
    const retention1=addMonths({y:end.y,m:end.m},1);
    const retention2=addMonths({y:end.y,m:end.m},2);
    const retention1Key=monthKey(retention1.y,retention1.m);
    const retention2Key=monthKey(retention2.y,retention2.m);

    // A regra só pode ser calculada se todo o horizonte necessário
    // (incluindo os dois meses de retenção) estiver representável na Curva.
    if(!startKey || exec.some(m=>!m.key) || !retention1Key || !retention2Key){
      console.error(`[HAPCAPEX ${VERSION}] Horizonte da Curva insuficiente para 15/75/10.`,
        obra?.nome,obra?.inicio,obra?.fim);
      return typeof fallback==='function'?fallback(obra):flow;
    }

    const totalCents=Math.round(capex*100);

    // Percentuais financeiros em centavos. A parcela de execução absorve
    // qualquer centavo residual para garantir Σ fluxo = CAPEX exato.
    const retention1Cents=Math.round(totalCents*0.05);
    const retention2Cents=Math.round(totalCents*0.05);

    let startCents;
    let executionCents;

    if(exec.length===0){
      // Início e fim no mesmo mês: 15% + 75% = 90% no mês da obra.
      startCents=totalCents-retention1Cents-retention2Cents;
      executionCents=0;
    } else {
      startCents=Math.round(totalCents*0.15);
      executionCents=totalCents-startCents-retention1Cents-retention2Cents;
    }

    flow[startKey]=startCents/100;

    if(exec.length){
      const executionAlloc=distributeEqualCents(executionCents,exec.length);
      exec.forEach((month,index)=>{
        flow[month.key]=(Number(flow[month.key]||0)+executionAlloc[index]/100);
      });
    }

    flow[retention1Key]=(Number(flow[retention1Key]||0)+retention1Cents/100);
    flow[retention2Key]=(Number(flow[retention2Key]||0)+retention2Cents/100);

    obra._standard157510 = {
      version:VERSION,
      start:obra?.inicio||null,
      end:obra?.fim||null,
      startKey,
      executionKeys:exec.map(m=>m.key),
      retentionKeys:[retention1Key,retention2Key],
      retentionPostEnd:true
    };

    return flow;
  }

  function updateRuleCatalog() {
    const rules=window.HAP_DATA?.flowRules;
    if(!Array.isArray(rules)) return;
    const rule=rules.find(r=>String(r?.code||'')===RULE);
    if(rule){
      rule.description =
        '15% no mês de início, 75% distribuídos durante a execução até o término e 10% em duas parcelas de 5% nos dois meses posteriores ao término.';
    }
  }

  function install() {
    updateRuleCatalog();
    if(installed) return true;

    try { if(typeof computeFlowRaw==='function') originalRaw=computeFlowRaw; } catch(_){}
    if(!originalRaw && typeof window.computeFlowRaw==='function') originalRaw=window.computeFlowRaw;

    try { if(typeof computeFlow==='function') originalFlow=computeFlow; } catch(_){}
    if(!originalFlow && typeof window.computeFlow==='function') originalFlow=window.computeFlow;

    if(!originalRaw||!originalFlow) return false;
    if(originalFlow.__hapV4039StandardDateAnchor){
      installed=true;
      return true;
    }

    const patchedRaw=function(obra){
      if(getRule(obra)===RULE) return computeStandardFlow(obra,originalRaw);
      return originalRaw(obra);
    };

    const patchedFlow=function(obra){
      if(getRule(obra)===RULE){
        // Bypass da proteção antiga que deslocava ymInicio para reportingMonth.
        return computeStandardFlow(obra,originalFlow);
      }
      return originalFlow(obra);
    };

    patchedRaw.__hapV4039StandardDateAnchor=true;
    patchedRaw.__hapV4039Original=originalRaw;
    patchedFlow.__hapV4039StandardDateAnchor=true;
    patchedFlow.__hapV4039Original=originalFlow;

    try { computeFlowRaw=patchedRaw; } catch(_){}
    try { window.computeFlowRaw=patchedRaw; } catch(_){}
    try { computeFlow=patchedFlow; } catch(_){}
    try { window.computeFlow=patchedFlow; } catch(_){}

    installed=true;
    return true;
  }

  function rerender() {
    if(!installed) return false;

    const works=Array.isArray(window.HAP_RUNTIME_OBRAS)?window.HAP_RUNTIME_OBRAS:[];
    const calculate=typeof window.computeFlow==='function'?window.computeFlow:null;
    if(!calculate||!works.length) return false;

    let changed=false;
    works.forEach(obra=>{
      if(getRule(obra)!==RULE) return;
      obra.flow=calculate(obra);
      changed=true;
    });

    if(!changed) return true;

    [
      'renderTablePrev','renderTableReal','renderCharts',
      'renderKPIs','renderRiskPanel','renderAnalysis'
    ].forEach(name=>{
      try{
        const fn=window[name];
        if(typeof fn==='function') fn();
      }catch(error){
        console.warn(`[HAPCAPEX ${VERSION}] Falha ao atualizar ${name}`,error);
      }
    });

    window.dispatchEvent(new CustomEvent('hapcapex:flow-recalculated',{
      detail:{version:VERSION,rule:RULE}
    }));

    return true;
  }

  function boot() {
    let attempts=0;
    const tryInstall=()=>{
      attempts+=1;
      if(install()){
        setTimeout(rerender,0);
        setTimeout(rerender,150);
        setTimeout(rerender,500);
        return;
      }
      if(attempts<80) setTimeout(tryInstall,100);
      else console.error(`[HAPCAPEX ${VERSION}] Não foi possível instalar o patch 15/75/10.`);
    };
    tryInstall();
  }

  window.HAP_V40_STANDARD_157510={
    version:VERSION,
    recompute:rerender,
    compute:computeStandardFlow
  };

  boot();
})();
