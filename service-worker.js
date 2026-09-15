const CACHE_NAME = 'hapcapex-v40-0-101-single-clear-root-fix-20260915';
const APP_SHELL = [
  './',
  './index.html',
  './controle-capex.html',
  './styles.css?v=29',
  './config.js',
  './v31-addon.js?v=31',
  './v32-addon.js?v=32',
  './v34-module-selector.js?v=39.7.0',
  './v35-control-addon.js?v=35.6.4',
  './v36-control-integration.js?v=36.1',
  './v37-control-governance.js?v=39.7.0',
  './v36-curve-addon.js?v=38.1.0',
  './v39-global-admin.js?v=39.8.0',
  './v39-8-control-hotfix.js?v=39.8.2',
  './v40-security-hardening.js?v=40.0.0',
  './v40-control-security.js?v=40.0.1',
  './v40-control-preauth.js?v=40.0.3',
  './v40-logout-fix.js?v=40.0.6',
  './v40-managerial-kpis-sort.js?v=40.0.9',
  './v40-aporte-status.js?v=40.0.75',
  './v40-tipologia-governance.js?v=40.0.26',
  './v40-control-ui.js?v=40.0.31',
  './v40-classification-copy.js?v=40.0.60',
  './v40-classification-copy-global.js?v=40.0.84',
  './v40-control-managerial.js?v=40.0.90',
  './v40-date-local-policy.js?v=40.0.92',
  './v40-legacy-curve-edit-optional.js?v=40.0.81',
  './original-baseline.js?v=40.0.0',
  './bootstrap.js?v=37.0',
  './dashboard-core.js?v=29',
  './manifest.webmanifest?v=29',
  './hapcapex-icon-v27-180.png',
  './hapcapex-icon-v27-192.png',
  './hapcapex-icon-v27-512.png'
];

const GLOBAL_ADMIN_TAG = '<script src="./v39-global-admin.js?v=39.8.0"></script>';
const CONTROL_HOTFIX_TAG = '<script src="./v39-8-control-hotfix.js?v=39.8.2"></script>';
const CONTROL_GOVERNANCE_TAG = '<script src="./v37-control-governance.js?v=40.0.93"></script>';
const CONTROL_SECURITY_TAG = '<script src="./v40-control-security.js?v=40.0.1"></script>';
const CONTROL_PREAUTH_TAG = '<script src="./v40-control-preauth.js?v=40.0.3"></script>';
const LOGOUT_TAG = '<script src="./v40-logout-fix.js?v=40.0.6"></script>';
const MANAGERIAL_TAG = '<script src="./v40-managerial-kpis-sort.js?v=40.0.9"></script>';
const APORTE_STATUS_TAG = '<script src="./v40-aporte-status.js?v=40.0.75"></script>';
const TIPOLOGIA_TAG = '<script src="./v40-tipologia-governance.js?v=40.0.26"></script>';
const AUDIT_PERF_TAG = ''; // V40.0.93: auditoria é exclusivamente global.
const CONTROL_UI_TAG = '<script src="./v40-control-ui.js?v=40.0.31"></script>';
const CLASSIFICATION_COPY_TAG = '<script src="./v40-classification-copy.js?v=40.0.60"></script>';
const CLASSIFICATION_COPY_GLOBAL_TAG = '<script src="./v40-classification-copy-global.js?v=40.0.84"></script>';
const CONTROL_MANAGERIAL_TAG = '<script src="./v40-control-managerial.js?v=40.0.90"></script>';
const DATE_LOCAL_POLICY_TAG = '<script src="./v40-date-local-policy.js?v=40.0.92"></script>';
const LEGACY_CURVE_EDIT_OPTIONAL_TAG = '<script src="./v40-legacy-curve-edit-optional.js?v=40.0.81"></script>';
const EXCEL_FILTER_CORE_TAG = "<script>(() => {\n  'use strict';\n  if (window.HAP_XF?.version === '40.0.100') return;\n\n  const stores = new Map();\n  let openMenu = null;\n  const BLANK = '__HAP_XF_BLANK__';\n\n  function normText(v) {\n    return String(v ?? '').replace(/\\u00a0/g,' ').replace(/\\s+/g,' ').trim();\n  }\n  function isBlank(v) {\n    const s = normText(v);\n    return v === null || v === undefined || s === '' || s === '—' || s === '-';\n  }\n  function parseNumber(v) {\n    if (typeof v === 'number') return Number.isFinite(v) ? v : null;\n    let s = normText(v).replace(/^R\\$\\s*/i,'').replace(/%$/,'').replace(/\\s+/g,'');\n    if (!s || s === '—' || s === '-') return null;\n    if (s.includes(',') && s.includes('.')) s=s.replace(/\\./g,'').replace(',','.');\n    else if (s.includes(',')) s=s.replace(',','.');\n    else if (/^-?\\d{1,3}(\\.\\d{3})+$/.test(s)) s=s.replace(/\\./g,'');\n    s=s.replace(/[^\\d+\\-.]/g,'');\n    const n=Number(s);\n    return Number.isFinite(n)?n:null;\n  }\n  function parseDate(v) {\n    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);\n    const s=normText(v);\n    if(!s || s==='—' || s==='-') return null;\n    let m=s.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);\n    if(m) return `${m[1]}-${m[2]}-${m[3]}`;\n    m=s.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);\n    if(!m) return null;\n    const d=String(m[1]).padStart(2,'0'), mo=String(m[2]).padStart(2,'0'), y=m[3];\n    const dt=new Date(`${y}-${mo}-${d}T00:00:00Z`);\n    return !isNaN(dt) && dt.getUTCDate()===Number(d) && dt.getUTCMonth()+1===Number(mo) ? `${y}-${mo}-${d}` : null;\n  }\n  function canon(type,v) {\n    if (isBlank(v)) return BLANK;\n    if (type==='number') {\n      const n=parseNumber(v);\n      return n===null?BLANK:String(n);\n    }\n    if (type==='date') {\n      const d=parseDate(v);\n      return d||BLANK;\n    }\n    return normText(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('pt-BR');\n  }\n  function display(type,v) {\n    if (isBlank(v)) return '(Em branco)';\n    if (type==='date') {\n      const d=parseDate(v);\n      if(d){const [y,m,day]=d.split('-');return `${day}/${m}/${y}`;}\n    }\n    return normText(v);\n  }\n\n  function ensure(id) {\n    if(!stores.has(id)) {\n      stores.set(id,{\n        id,\n        filters:{},\n        sort:{key:'',dir:0},\n        columns:new Map(),\n        rows:[],\n        onChange:null,\n        valuesProvider:null\n      });\n    }\n    return stores.get(id);\n  }\n  function register({id,rows,columns,onChange,valuesProvider}) {\n    const s=ensure(id);\n    if(Array.isArray(rows)) s.rows=rows;\n    if(typeof onChange==='function') s.onChange=onChange;\n    if(typeof valuesProvider==='function') s.valuesProvider=valuesProvider;\n    else if(valuesProvider===null) s.valuesProvider=null;\n    (columns||[]).forEach(c=>s.columns.set(c.key,{...s.columns.get(c.key),...c}));\n    return s;\n  }\n  function getVal(row,col){\n    try {\n      return typeof col.get==='function' ? col.get(row) : row?.[col.key];\n    } catch(_) {\n      return null;\n    }\n  }\n  function filterState(s,key){\n    if(!s.filters[key]) s.filters[key]={selected:null,op:'',a:'',b:''};\n    return s.filters[key];\n  }\n  function conditionMatch(type,value,f) {\n    if(!f.op) return true;\n    if(type==='number') {\n      const v=parseNumber(value), a=parseNumber(f.a), b=parseNumber(f.b);\n      if(v===null || a===null) return false;\n      if(f.op==='eq') return Math.abs(v-a)<0.0000001;\n      if(f.op==='neq') return Math.abs(v-a)>=0.0000001;\n      if(f.op==='gt') return v>a;\n      if(f.op==='gte') return v>=a;\n      if(f.op==='lt') return v<a;\n      if(f.op==='lte') return v<=a;\n      if(f.op==='between') return b!==null && v>=Math.min(a,b) && v<=Math.max(a,b);\n    }\n    if(type==='date') {\n      const v=parseDate(value), a=parseDate(f.a), b=parseDate(f.b);\n      if(!v || !a) return false;\n      if(f.op==='eq') return v===a;\n      if(f.op==='neq') return v!==a;\n      if(f.op==='gt') return v>a;\n      if(f.op==='gte') return v>=a;\n      if(f.op==='lt') return v<a;\n      if(f.op==='lte') return v<=a;\n      if(f.op==='between') return !!b && v>=Math.min(a,b) && v<=Math.max(a,b);\n    }\n    return true;\n  }\n  function matches(id,row) {\n    const s=stores.get(id);\n    if(!s) return true;\n    for(const [key,f] of Object.entries(s.filters)) {\n      const col=s.columns.get(key);\n      if(!col) continue;\n      const value=getVal(row,col);\n      if(f.selected instanceof Set && !f.selected.has(canon(col.type||'text',value))) return false;\n      if(!conditionMatch(col.type||'text',value,f)) return false;\n    }\n    return true;\n  }\n  function compare(type,a,b) {\n    const ab=isBlank(a), bb=isBlank(b);\n    if(ab&&bb)return 0;\n    if(ab)return 1;\n    if(bb)return -1;\n    if(type==='number') return (parseNumber(a)??0)-(parseNumber(b)??0);\n    if(type==='date') return String(parseDate(a)||'').localeCompare(String(parseDate(b)||''));\n    return normText(a).localeCompare(normText(b),'pt-BR',{numeric:true,sensitivity:'base'});\n  }\n  function sortRows(id,rows) {\n    const s=stores.get(id);\n    if(!s?.sort?.key || !s.sort.dir) return [...rows];\n    const col=s.columns.get(s.sort.key);\n    if(!col) return [...rows];\n    return rows.map((row,i)=>({row,i})).sort((a,b)=>{\n      const c=compare(col.type||'text',getVal(a.row,col),getVal(b.row,col));\n      return c ? c*s.sort.dir : a.i-b.i;\n    }).map(x=>x.row);\n  }\n  function apply(id,rows) {\n    return sortRows(id,(rows||[]).filter(r=>matches(id,r)));\n  }\n  function hasFilter(id,key) {\n    const s=stores.get(id), f=s?.filters?.[key];\n    return !!(f && ((f.selected instanceof Set) || f.op));\n  }\n  function hasActive(id) {\n    const s=stores.get(id);\n    if(!s)return false;\n    return !!(s.sort?.key&&s.sort.dir) || Object.keys(s.filters).some(k=>hasFilter(id,k));\n  }\n  function activeCount(id) {\n    const s=stores.get(id);\n    if(!s)return 0;\n    let n=Object.keys(s.filters).filter(k=>hasFilter(id,k)).length;\n    if(s.sort?.key&&s.sort.dir)n++;\n    return n;\n  }\n  function notify(s) {\n    try {\n      s?.onChange?.();\n    } catch(e) {\n      console.error('[HAPCAPEX XF] onChange',e);\n    }\n  }\n  function clearColumn(id,key,{silent=false,keepSort=true}={}) {\n    const s=ensure(id);\n    delete s.filters[key];\n    if(!keepSort && s.sort.key===key) s.sort={key:'',dir:0};\n    if(!silent) notify(s);\n  }\n  function clear(id,{silent=false}={}) {\n    const s=ensure(id);\n    s.filters={};\n    s.sort={key:'',dir:0};\n    if(!silent) notify(s);\n  }\n  function clearPrefix(prefix,{silent=false}={}) {\n    const callbacks=new Set();\n    for(const [id,s] of stores.entries()) {\n      if(!String(id).startsWith(prefix)) continue;\n      s.filters={};\n      s.sort={key:'',dir:0};\n      if(typeof s.onChange==='function') callbacks.add(s.onChange);\n    }\n    if(!silent) callbacks.forEach(fn=>{try{fn();}catch(e){console.error('[HAPCAPEX XF] clearPrefix',e);}});\n  }\n  function setSort(id,key,dir,{silent=false}={}) {\n    const s=ensure(id);\n    s.sort={key,dir};\n    if(!silent) notify(s);\n  }\n  function clearSort(id,{silent=false}={}) {\n    const s=ensure(id);\n    s.sort={key:'',dir:0};\n    if(!silent) notify(s);\n  }\n\n  function searchTerms(v) {\n    const raw=normText(v);\n    if(!raw)return [];\n    if(/[;,\\n\\t]/.test(raw)) return raw.split(/[;,\\n\\t]+/).map(x=>normText(x).toLocaleLowerCase('pt-BR')).filter(Boolean);\n    const tokens=raw.split(/\\s+/).filter(Boolean);\n    if(tokens.length>1 && tokens.every(x=>/^\\d{5,}$/.test(x))) return tokens.map(x=>x.toLowerCase());\n    return [raw.toLocaleLowerCase('pt-BR')];\n  }\n  function searchHit(label,query) {\n    const terms=searchTerms(query);\n    if(!terms.length)return true;\n    const hay=normText(label).toLocaleLowerCase('pt-BR');\n    return terms.some(t=>hay.includes(t));\n  }\n  function closeMenu(){\n    if(openMenu){\n      openMenu.remove();\n      openMenu=null;\n    }\n  }\n\n  function ensureStyles(){\n    if(document.getElementById('hap-xf-style-v4098'))return;\n    const st=document.createElement('style');\n    st.id='hap-xf-style-v4098';\n    st.textContent=`\n      .hap-xf-head{position:relative!important;padding-right:28px!important}\n      .hap-xf-btn{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:19px;height:19px;padding:0;border:1px solid rgba(255,255,255,.38);border-radius:4px;background:rgba(255,255,255,.12);color:inherit;font:700 10px/1 Arial;cursor:pointer;z-index:4}\n      .hap-xf-btn:hover{background:rgba(255,255,255,.25)}\n      .hap-xf-btn.active{background:#e07020!important;border-color:#e07020!important;color:#fff!important}\n      .hap-xf-menu{position:fixed;z-index:100500;width:min(340px,calc(100vw - 20px));max-height:min(580px,calc(100vh - 20px));overflow:auto;background:#fff;color:#1a2233;border:1px solid #cbd5e3;border-radius:9px;box-shadow:0 12px 34px rgba(13,43,78,.24);padding:7px;font:12px 'Segoe UI',Arial,sans-serif;text-align:left}\n      .hap-xf-menu button,.hap-xf-menu input,.hap-xf-menu select{font:inherit}\n      .hap-xf-cmd{display:block;width:100%;text-align:left;border:0;background:#fff;padding:8px 9px;border-radius:6px;cursor:pointer;color:#1a2233}\n      .hap-xf-cmd:hover{background:#eef4fc}\n      .hap-xf-cmd:disabled{opacity:.45;cursor:default}\n      .hap-xf-sep{height:1px;background:#e3e8ef;margin:5px 0}\n      .hap-xf-search{width:100%;padding:7px 8px;border:1px solid #cbd5e3;border-radius:6px;margin:3px 0 6px}\n      .hap-xf-condition{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:5px 0}\n      .hap-xf-condition select,.hap-xf-condition input{min-width:0;padding:6px;border:1px solid #cbd5e3;border-radius:6px}\n      .hap-xf-condition .wide{grid-column:1/-1}\n      .hap-xf-list{border:1px solid #d9e0e9;border-radius:6px;max-height:240px;overflow:auto;padding:4px;overscroll-behavior:contain}\n      .hap-xf-check{display:flex;align-items:center;gap:7px;padding:4px 5px;border-radius:4px;cursor:pointer;min-width:0}\n      .hap-xf-check:hover{background:#f3f6fa}\n      .hap-xf-check span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n      .hap-xf-check input{flex:0 0 auto}\n      .hap-xf-select-results{border:0;background:transparent;color:#1a4b8c;font-weight:700;font-size:10px;cursor:pointer;padding:4px 1px 6px;display:none}\n      .hap-xf-add-current{display:none;border-top:1px solid #eef1f5;margin-top:2px;padding-top:6px;font-weight:600}\n      .hap-xf-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:7px}\n      .hap-xf-actions button{border:1px solid #cbd5e3;background:#fff;border-radius:6px;padding:6px 10px;cursor:pointer;font-weight:700}\n      .hap-xf-actions .ok{background:#1a4b8c;border-color:#1a4b8c;color:#fff}\n      .hap-xf-toolbar-summary{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:28px;font-size:11px;color:#5a6882}\n      .hap-xf-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;background:#eef3f9;color:#314b69;font-size:10px;font-weight:700}\n      .hap-xf-toolbar-clear{border:1px solid #d1dae6;background:#fff;color:#1a4b8c;border-radius:7px;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer}\n      .hap-xf-toolbar-clear:disabled{opacity:.45;cursor:default}\n      @media(max-width:720px){.hap-xf-menu{width:calc(100vw - 16px);left:8px!important;right:8px!important;max-height:72vh}.hap-xf-toolbar-summary{font-size:10px}}\n    `;\n    document.head.appendChild(st);\n  }\n\n  async function valuesFor(s,col) {\n    let vals;\n    if(typeof s.valuesProvider==='function') {\n      try {\n        vals=await s.valuesProvider(col.key,col);\n      } catch(e) {\n        console.error('[HAPCAPEX XF] valuesProvider',e);\n        vals=[];\n      }\n    } else {\n      vals=(s.rows||[]).map(r=>getVal(r,col));\n    }\n    const map=new Map();\n    (vals||[]).forEach(v=>{\n      const c=canon(col.type||'text',v);\n      if(!map.has(c)) map.set(c,v);\n    });\n    const arr=[...map.entries()].map(([canonical,raw])=>({canonical,raw,label:display(col.type||'text',raw)}));\n    arr.sort((a,b)=>compare(col.type||'text',a.raw,b.raw));\n    return arr;\n  }\n\n  async function showMenu(id,key,button) {\n    closeMenu();\n    ensureStyles();\n    const s=ensure(id), col=s.columns.get(key);\n    if(!col)return;\n\n    const f=filterState(s,key);\n    const menu=document.createElement('div');\n    menu.className='hap-xf-menu';\n    menu.innerHTML='<div style=\"padding:10px;color:#607088\">Carregando...</div>';\n    document.body.appendChild(menu);\n    openMenu=menu;\n\n    const rect=button.getBoundingClientRect();\n    let left=Math.min(rect.left,window.innerWidth-350);\n    if(left<8)left=8;\n    let top=rect.bottom+4;\n    if(top+500>window.innerHeight)top=Math.max(8,rect.top-500);\n    menu.style.left=left+'px';\n    menu.style.top=top+'px';\n\n    const values=await valuesFor(s,col);\n    if(openMenu!==menu)return;\n\n    const baseSelected=f.selected instanceof Set ? new Set(f.selected) : null;\n    const selected=baseSelected ? new Set(baseSelected) : new Set(values.map(v=>v.canonical));\n    const type=col.type||'text';\n    const sortAsc=type==='date'?'Classificar do mais antigo para o mais recente':type==='number'?'Classificar do menor para o maior':'Classificar de A a Z';\n    const sortDesc=type==='date'?'Classificar do mais recente para o mais antigo':type==='number'?'Classificar do maior para o menor':'Classificar de Z a A';\n    const condOptions= type==='date'\n      ? '<option value=\"\">Sem filtro de data</option><option value=\"eq\">Igual a</option><option value=\"gt\">Depois de</option><option value=\"gte\">Em ou depois de</option><option value=\"lt\">Antes de</option><option value=\"lte\">Em ou antes de</option><option value=\"between\">Entre</option><option value=\"neq\">Diferente de</option>'\n      : '<option value=\"\">Sem filtro numérico</option><option value=\"eq\">Igual a</option><option value=\"gt\">Maior que</option><option value=\"gte\">Maior ou igual</option><option value=\"lt\">Menor que</option><option value=\"lte\">Menor ou igual</option><option value=\"between\">Entre</option><option value=\"neq\">Diferente de</option>';\n    const inputType=type==='date'?'date':'text';\n\n    menu.innerHTML=`\n      <button class=\"hap-xf-cmd\" data-sort=\"1\">↗ ${sortAsc}</button>\n      <button class=\"hap-xf-cmd\" data-sort=\"-1\">↘ ${sortDesc}</button>\n      <button class=\"hap-xf-cmd\" data-sort-default ${(s.sort?.key&&s.sort.dir)?'':'disabled'}>↺ Classificação padrão</button>\n      <button class=\"hap-xf-cmd\" data-clear ${hasFilter(id,key)?'':'disabled'}>⌫ Limpar filtro de “${String(col.label||key).replace(/[&<>]/g,'')}”</button>\n      <div class=\"hap-xf-sep\"></div>\n      ${type==='number'||type==='date'?`<div class=\"hap-xf-condition\"><select class=\"wide\" data-cond>${condOptions}</select><input data-a type=\"${inputType}\" placeholder=\"Valor inicial\"><input data-b type=\"${inputType}\" placeholder=\"Valor final\"></div><div class=\"hap-xf-sep\"></div>`:''}\n      <input class=\"hap-xf-search\" type=\"search\" placeholder=\"Pesquisar\" autocomplete=\"off\">\n      <button class=\"hap-xf-select-results\" type=\"button\">Selecionar resultados da pesquisa</button>\n      <label class=\"hap-xf-check hap-xf-add-current\"><input type=\"checkbox\" data-add-current> <span>Adicionar seleção atual ao filtro</span></label>\n      <div class=\"hap-xf-list\">\n        <label class=\"hap-xf-check\" data-all-row><input type=\"checkbox\" data-all checked><strong>(Selecionar tudo)</strong></label>\n        ${values.map(v=>`<label class=\"hap-xf-check\" data-item data-label=\"${encodeURIComponent(v.label.toLocaleLowerCase('pt-BR'))}\"><input type=\"checkbox\" data-value=\"${encodeURIComponent(v.canonical)}\" ${selected.has(v.canonical)?'checked':''}><span title=\"${v.label.replace(/\"/g,'&quot;')}\">${v.label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span></label>`).join('')}\n      </div>\n      <div class=\"hap-xf-actions\"><button type=\"button\" data-cancel>Cancelar</button><button type=\"button\" class=\"ok\" data-apply>OK</button></div>`;\n\n    const cond=menu.querySelector('[data-cond]');\n    const aEl=menu.querySelector('[data-a]');\n    const bEl=menu.querySelector('[data-b]');\n    if(cond){\n      cond.value=f.op||'';\n      aEl.value=f.a||'';\n      bEl.value=f.b||'';\n      bEl.style.display=f.op==='between'?'block':'none';\n      cond.onchange=()=>{bEl.style.display=cond.value==='between'?'block':'none';};\n    }\n\n    const all=menu.querySelector('[data-all]');\n    const addCurrent=menu.querySelector('[data-add-current]');\n    const addCurrentRow=menu.querySelector('.hap-xf-add-current');\n    const selectResults=menu.querySelector('.hap-xf-select-results');\n    const search=menu.querySelector('.hap-xf-search');\n    const itemInputs=()=>[...menu.querySelectorAll('[data-item] input')];\n\n    const visibleInputs=()=>itemInputs().filter(x=>x.closest('[data-item]').style.display!=='none');\n    const updateAll=()=>{\n      const xs=visibleInputs();\n      all.checked=xs.length>0&&xs.every(x=>x.checked);\n      all.indeterminate=xs.some(x=>x.checked)&&!all.checked;\n    };\n    updateAll();\n\n    all.onchange=()=>{\n      visibleInputs().forEach(x=>x.checked=all.checked);\n      updateAll();\n    };\n    itemInputs().forEach(x=>x.onchange=updateAll);\n\n    const applySearch=()=>{\n      const q=search.value;\n      menu.querySelectorAll('[data-item]').forEach(row=>{\n        const lab=decodeURIComponent(row.dataset.label||'');\n        row.style.display=searchHit(lab,q)?'flex':'none';\n      });\n      const hasQuery=!!normText(q);\n      selectResults.style.display=hasQuery?'block':'none';\n      addCurrentRow.style.display=hasQuery&&baseSelected?'flex':'none';\n      if(!hasQuery && addCurrent) addCurrent.checked=false;\n      updateAll();\n    };\n    search.oninput=applySearch;\n\n    selectResults.onclick=()=>{\n      const q=search.value;\n      if(!normText(q))return;\n      if(!(addCurrent?.checked && baseSelected)) {\n        itemInputs().forEach(x=>x.checked=false);\n      } else {\n        itemInputs().forEach(x=>{\n          const c=decodeURIComponent(x.dataset.value||'');\n          x.checked=baseSelected.has(c);\n        });\n      }\n      visibleInputs().forEach(x=>x.checked=true);\n      updateAll();\n    };\n\n    const defaultSortBtn=menu.querySelector('[data-sort-default]');\n    menu.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{\n      setSort(id,key,Number(b.dataset.sort));\n      defaultSortBtn.disabled=false;\n      menu.querySelectorAll('[data-sort]').forEach(x=>x.style.fontWeight=Number(x.dataset.sort)===Number(b.dataset.sort)?'800':'');\n    });\n\n    defaultSortBtn.onclick=()=>{\n      clearSort(id);\n      defaultSortBtn.disabled=true;\n      menu.querySelectorAll('[data-sort]').forEach(x=>x.style.fontWeight='');\n    };\n\n    const clearBtn=menu.querySelector('[data-clear]');\n    clearBtn.onclick=()=>{\n      clearColumn(id,key,{keepSort:true});\n      itemInputs().forEach(x=>x.checked=true);\n      if(cond){cond.value='';aEl.value='';bEl.value='';bEl.style.display='none';}\n      search.value='';\n      applySearch();\n      clearBtn.disabled=true;\n    };\n\n    menu.querySelector('[data-cancel]').onclick=closeMenu;\n\n    menu.querySelector('[data-apply]').onclick=()=>{\n      const hasQuery=!!normText(search.value);\n      let xs=itemInputs();\n\n      // Excel-like behavior: when a search is active and \"Adicionar seleção atual\"\n      // is NOT checked, only the visible search result selection becomes the filter.\n      if(hasQuery && baseSelected && !addCurrent?.checked) {\n        xs=visibleInputs();\n      }\n\n      const checked=new Set(xs.filter(x=>x.checked).map(x=>decodeURIComponent(x.dataset.value||'')));\n\n      // When adding to the current filter, explicitly preserve the existing set.\n      if(hasQuery && baseSelected && addCurrent?.checked) {\n        baseSelected.forEach(v=>checked.add(v));\n      }\n\n      const allCanon=new Set(values.map(v=>v.canonical));\n      const sameAll=checked.size===allCanon.size && [...allCanon].every(v=>checked.has(v));\n\n      const fs=filterState(s,key);\n      fs.selected=sameAll?null:checked;\n      if(cond){\n        fs.op=cond.value||'';\n        fs.a=aEl.value||'';\n        fs.b=bEl.value||'';\n      } else {\n        fs.op='';\n        fs.a='';\n        fs.b='';\n      }\n      if(!(fs.selected instanceof Set)&&!fs.op) delete s.filters[key];\n\n      closeMenu();\n      notify(s);\n    };\n\n    setTimeout(()=>search.focus(),0);\n  }\n\n  function bind({id,table,rows,columns,onChange,valuesProvider,disableNativeSort=true}) {\n    ensureStyles();\n    if(typeof table==='string')table=document.querySelector(table);\n    if(!table)return;\n    const s=register({id,rows,columns,onChange,valuesProvider});\n    const ths=[...table.querySelectorAll('thead tr:first-child th')];\n    (columns||[]).forEach(col=>{\n      const th=ths[col.index];\n      if(!th)return;\n      th.classList.add('hap-xf-head');\n      if(disableNativeSort){\n        th.removeAttribute('onclick');\n        th.classList.remove('sortable','sort-asc','sort-desc','v4078-sortable');\n      }\n      let btn=th.querySelector(`.hap-xf-btn[data-key=\"${CSS.escape(col.key)}\"]`);\n      if(!btn){\n        btn=document.createElement('button');\n        btn.type='button';\n        btn.className='hap-xf-btn';\n        btn.dataset.key=col.key;\n        btn.textContent='▼';\n        btn.setAttribute('aria-label',`Filtrar ${col.label||col.key}`);\n        th.appendChild(btn);\n      }\n      btn.classList.toggle('active',hasFilter(id,col.key)||(s.sort.key===col.key&&!!s.sort.dir));\n      btn.onclick=e=>{\n        e.preventDefault();\n        e.stopPropagation();\n        void showMenu(id,col.key,btn);\n      };\n    });\n  }\n\n  function bindDom({id,table,columns,countEl,summaryEl}) {\n    if(typeof table==='string')table=document.querySelector(table);\n    if(!table)return;\n    const body=table.tBodies?.[0];\n    if(!body)return;\n\n    // Capture the complete current tbody each time a new table instance is bound.\n    const domRows=[...body.rows].filter(tr=>!tr.querySelector('.empty-state')).map((tr,i)=>({tr,i}));\n    const cols=(columns||[]).map(c=>({...c,get:r=>{\n      const text=r.tr.cells[c.index]?.innerText||'';\n      if(c.type==='number')return parseNumber(text);\n      if(c.type==='date')return parseDate(text);\n      return text;\n    }}));\n\n    const render=()=>{\n      register({id,rows:domRows,columns:cols,onChange:render,valuesProvider:null});\n      const visible=apply(id,domRows), set=new Set(visible);\n      domRows.forEach(r=>{r.tr.style.display=set.has(r)?'':'none';});\n      visible.forEach(r=>body.appendChild(r.tr));\n      if(countEl){\n        const el=typeof countEl==='string'?document.querySelector(countEl):countEl;\n        if(el)el.textContent=`${visible.length} de ${domRows.length}`;\n      }\n      if(summaryEl) mountSummary(summaryEl,id);\n      bind({id,table,rows:domRows,columns:cols,onChange:render,valuesProvider:null});\n    };\n    render();\n  }\n\n  function summaryHtml(id) {\n    const s=stores.get(id);\n    if(!s||!hasActive(id))return '';\n    const parts=[];\n    for(const [key] of Object.entries(s.filters)) {\n      if(!hasFilter(id,key))continue;\n      const c=s.columns.get(key);\n      parts.push(`<span class=\"hap-xf-chip\">${String(c?.label||key).replace(/</g,'&lt;')}: filtrado</span>`);\n    }\n    if(s.sort?.key&&s.sort.dir){\n      const c=s.columns.get(s.sort.key);\n      parts.push(`<span class=\"hap-xf-chip\">${String(c?.label||s.sort.key).replace(/</g,'&lt;')}: ${s.sort.dir===1?'↑':'↓'}</span>`);\n    }\n    return parts.join('');\n  }\n\n  function mountSummary(container,id,{showClear=true}={}) {\n    if(typeof container==='string')container=document.querySelector(container);\n    if(!container)return;\n    const active=hasActive(id);\n    container.innerHTML=summaryHtml(id)+(showClear\n      ? ` <button type=\"button\" class=\"hap-xf-toolbar-clear\" ${active?'':'disabled'}>Limpar filtros</button>`\n      : '');\n    container.querySelector('.hap-xf-toolbar-clear')?.addEventListener('click',()=>clear(id));\n  }\n\n  // Popup permanence: scroll anywhere does not close it.\n  // It closes only by outside click, Cancel or OK.\n  document.addEventListener('pointerdown',e=>{\n    if(openMenu && !openMenu.contains(e.target) && !e.target.closest('.hap-xf-btn')) closeMenu();\n  },true);\n\n  window.HAP_XF=Object.freeze({\n    version:'40.0.100',\n    register,bind,bindDom,apply,matches,sortRows,hasActive,activeCount,\n    clear,clearColumn,clearPrefix,setSort,clearSort,mountSummary,parseNumber,parseDate,canon\n  });\n})();</script>";
const CONTROL_EXCEL_FILTER_TAG = "<script>(() => {\n  'use strict';\n  if(window.__HAP_V40101_CONTROL_XF_RUNTIME__) return;\n  window.__HAP_V40101_CONTROL_XF_RUNTIME__={started:true};\n\n  const desktop=()=>window.innerWidth>720;\n  const safeMoneyPct=r=>Number(r?.montante_atribuido||0)>0?Number(r?.valor_compromissado||0)/Number(r?.montante_atribuido||0)*100:0;\n  const XF=()=>window.HAP_XF;\n\n  function removeToolbarField(el) {\n    if(!el)return;\n    if(el.type==='file')return;\n    const wrap=el.closest('label');\n    if(wrap && wrap.parentElement) { wrap.remove(); return; }\n    const span=el.closest('span');\n    if(span && span.parentElement && span.querySelectorAll('input,select').length===1) { span.remove(); return; }\n    el.remove();\n  }\n\n  function currentControlFilterId() {\n    try {\n      const tab=String(state?.tab||'');\n      if(tab==='capex') return 'control-capex';\n      if(tab==='base_oi') return 'control-base-oi';\n      if(tab==='base_consumo') return 'control-consumo';\n      if(tab==='transferencias') return 'control-transfer';\n    } catch(_){}\n    return '';\n  }\n\n  function removeLegacyFilterArtifacts(root=document) {\n    root.querySelectorAll?.(\n      '#v40050-capex-clear,.v40050-capex-filter-count,.v40050-capex-filter-wrap,' +\n      '.v4041-transfer-filter-row'\n    ).forEach(el=>el.remove());\n  }\n\n  function resetLegacyStateForId(id) {\n    try {\n      if(id==='control-capex') {\n        state.filter='';\n      } else if(id==='control-base-oi') {\n        state.baseOiFilter='';\n      } else if(id==='control-consumo') {\n        state.consumoFilter='';\n        state.consumoPage=0;\n      } else if(id==='control-transfer') {\n        state.transferFilter='';\n        state.transferDataInicio=null;\n        state.transferDataFim=null;\n        state.transferPendencia=null;\n      }\n    } catch(_){}\n  }\n\n  function refreshAfterUnifiedClear(id) {\n    if(id==='control-consumo') window.loadBaseConsumoTab?.();\n    else if(id==='control-capex') window.renderCapexTab?.();\n    else if(id==='control-base-oi') window.renderBaseOiTab?.();\n    else if(id==='control-transfer') window.renderTransferenciasTab?.();\n  }\n\n  function enforceSingleClearButton(toolbar,id) {\n    if(!toolbar||!id)return null;\n\n    removeLegacyFilterArtifacts(toolbar);\n\n    const named=[...toolbar.querySelectorAll('button')].filter(\n      btn=>String(btn.textContent||'').trim().toLocaleLowerCase('pt-BR')==='limpar filtros'\n    );\n\n    let canonical=named.find(btn=>btn.classList.contains('hap-xf-unified-clear'))||null;\n    named.forEach(btn=>{\n      if(btn!==canonical) btn.remove();\n    });\n\n    if(!canonical){\n      canonical=document.createElement('button');\n      canonical.type='button';\n      canonical.className='btn btn-secondary hap-xf-unified-clear';\n      canonical.textContent='Limpar filtros';\n      toolbar.appendChild(canonical);\n    }\n\n    canonical.dataset.hapXfUnifiedId=id;\n\n    if(canonical.dataset.hapXfUnifiedBound!=='1'){\n      canonical.dataset.hapXfUnifiedBound='1';\n      canonical.addEventListener('click',()=>{\n        const targetId=canonical.dataset.hapXfUnifiedId||currentControlFilterId();\n        XF()?.clear(targetId,{silent:true});\n        resetLegacyStateForId(targetId);\n        refreshAfterUnifiedClear(targetId);\n      });\n    }\n\n    canonical.disabled=!XF()?.hasActive(id);\n    return canonical;\n  }\n\n  function compactToolbar(id) {\n    if(!desktop())return;\n    const toolbar=document.querySelector('.toolbar');\n    if(!toolbar)return;\n\n    removeLegacyFilterArtifacts(document);\n\n    // Filtros horizontais de dados são redundantes após os filtros de cabeçalho.\n    toolbar.querySelectorAll('input:not([type=\"file\"]),select').forEach(removeToolbarField);\n\n    let sum=toolbar.querySelector('.hap-xf-toolbar-summary');\n    if(!sum){\n      sum=document.createElement('div');\n      sum.className='hap-xf-toolbar-summary';\n      sum.style.flex='1 1 260px';\n      toolbar.prepend(sum);\n    }\n\n    XF()?.mountSummary(sum,id,{showClear:false});\n    enforceSingleClearButton(toolbar,id);\n  }\n\n  function hardenCurrentFilterUi() {\n    removeLegacyFilterArtifacts(document);\n    const id=currentControlFilterId();\n    const toolbar=document.querySelector('.toolbar');\n    if(id&&toolbar) enforceSingleClearButton(toolbar,id);\n  }\n\n  function bindCapex(){\n    const table=document.querySelector('.table-card table');\n    if(!table||!XF())return;\n    const cols=[\n      {key:'oi',label:'OI',type:'text',index:0,get:r=>r.ordem_interna},\n      {key:'obra',label:'Obra',type:'text',index:1,get:r=>r.obra},\n      {key:'montante',label:'Montante',type:'number',index:2,get:r=>r.montante_atribuido},\n      {key:'compromissado',label:'Compromissado',type:'number',index:3,get:r=>r.valor_compromissado},\n      {key:'saldo',label:'Saldo',type:'number',index:4,get:r=>r.saldo_disponivel},\n      {key:'pct',label:'% Comp.',type:'number',index:5,get:safeMoneyPct},\n      {key:'pacote',label:'Pacote CAPEX',type:'text',index:6,get:r=>r.classificacao_pacote_capex},\n      {key:'head',label:'HEAD Operação',type:'text',index:7,get:r=>r.classificacao_head_operacao},\n      {key:'grupo',label:'Grupo Executivo',type:'text',index:8,get:r=>r.grupo_executivo},\n      {key:'det',label:'Detalhamento',type:'text',index:9,get:r=>r.detalhamento},\n      {key:'cat',label:'Categoria ORC',type:'text',index:10,get:r=>r.categoria_orc},\n      {key:'detorc',label:'Detalhamento ORC',type:'text',index:11,get:r=>r.detalhamento_orc}\n    ].filter(c=>c.index<table.tHead.rows[0].cells.length-1);\n    XF().bind({id:'control-capex',table,rows:state.rows||[],columns:cols,onChange:()=>window.renderCapexTab?.()});\n    compactToolbar('control-capex');\n  }\n\n  function bindBaseOi(){\n    const table=document.querySelector('.table-card table');\n    if(!table||!XF())return;\n    const cols=[\n      {key:'oi',label:'OI',type:'text',index:0,get:r=>r.ordem_interna},\n      {key:'descricao',label:'Descrição',type:'text',index:1,get:r=>r.descricao},\n      {key:'montante',label:'Montante (D)',type:'number',index:2,get:r=>r.montante_atribuido},\n      {key:'compromissado',label:'Recursos atrib. (E)',type:'number',index:3,get:r=>r.valor_compromissado},\n      {key:'saldo',label:'Saldo (F)',type:'number',index:4,get:r=>r.saldo_disponivel},\n      {key:'exercicio',label:'Exercício',type:'number',index:5,get:r=>r.exercicio},\n      {key:'status',label:'Status',type:'text',index:6,get:r=>r.status_classificacao}\n    ];\n    XF().bind({id:'control-base-oi',table,rows:state.baseOiRows||[],columns:cols,onChange:()=>window.renderBaseOiTab?.()});\n    compactToolbar('control-base-oi');\n  }\n\n  function bindTransfers(){\n    const table=document.querySelector('.table-card table');\n    if(!table||!XF())return;\n    const cols=[\n      {key:'doc',label:'Nº doc.',type:'text',index:0,get:r=>r.numero_documento},\n      {key:'origem',label:'Origem',type:'text',index:1,get:r=>r.oi_origem},\n      {key:'destino',label:'Destino',type:'text',index:2,get:r=>r.oi_destino},\n      {key:'valor',label:'Valor',type:'number',index:3,get:r=>r.valor},\n      {key:'data',label:'Data',type:'date',index:4,get:r=>r.data},\n      {key:'justificativa',label:'Justificativa',type:'text',index:5,get:r=>r.justificativa}\n    ];\n    XF().bind({id:'control-transfer',table,rows:state.transferRows||[],columns:cols,onChange:()=>window.renderTransferenciasTab?.()});\n    compactToolbar('control-transfer');\n  }\n\n  let consumoAllCache=null, consumoLoading=null;\n  async function ensureConsumoAll(force=false){\n    if(force)consumoAllCache=null;\n    if(consumoAllCache)return consumoAllCache;\n    if(consumoLoading)return consumoLoading;\n    consumoLoading=(async()=>{\n      const {data,error}=await fetchAllRows('vw_controle_base_consumo','data_lancamento',false);\n      if(error)throw error;\n      consumoAllCache=data||[];\n      return consumoAllCache;\n    })().finally(()=>{consumoLoading=null;});\n    return consumoLoading;\n  }\n  const consumoCols=()=>[\n    {key:'oi',label:'OI',type:'text',index:0,get:r=>r.ordem_interna},\n    {key:'descricao',label:'Descrição',type:'text',index:1,get:r=>r.descricao},\n    {key:'categoria',label:'Categoria',type:'text',index:2,get:r=>r.categoria_valor},\n    {key:'resumo',label:'Resumo',type:'text',index:3,get:r=>r.categoria_resumo},\n    {key:'montante',label:'Montante',type:'number',index:4,get:r=>r.montante},\n    {key:'data',label:'Data',type:'date',index:5,get:r=>r.data_lancamento},\n    {key:'fornecedor',label:'Fornecedor',type:'text',index:6,get:r=>r.fornecedor_nome||r.fornecedor}\n  ];\n  function bindConsumo(){\n    const table=document.querySelector('.table-card table');\n    if(!table||!XF())return;\n    const cols=consumoCols();\n    XF().bind({\n      id:'control-consumo',\n      table,\n      rows:consumoAllCache||state.consumoRows||[],\n      columns:cols,\n      onChange:()=>{state.consumoPage=0;window.loadBaseConsumoTab?.();},\n      valuesProvider:async key=>{\n        const all=await ensureConsumoAll();\n        const c=cols.find(x=>x.key===key);\n        return c?all.map(c.get):[];\n      }\n    });\n    compactToolbar('control-consumo');\n  }\n\n  function wrapFunction(name,wrapperFactory){\n    const current=window[name];\n    if(typeof current!=='function')return false;\n    if(current.__hapXfV40101)return true;\n    const wrapped=wrapperFactory(current);\n    wrapped.__hapXfV40101=true;\n    wrapped.__hapXfOriginal=current;\n    window[name]=wrapped;\n    return true;\n  }\n\n  function installCapex(){\n    return wrapFunction('renderCapexTab',original=>function(){\n      const full=state.rows||[];\n      window.__HAP_V40100_FULL_CAPEX_ROWS__=full;\n      const view=XF()?.apply('control-capex',full) || full;\n      const saveRows=state.rows, saveFilter=state.filter;\n      state.rows=view; state.filter='';\n      let r;\n      try{r=original.apply(this,arguments);}\n      finally{state.rows=saveRows;state.filter=saveFilter;}\n      bindCapex();\n      return r;\n    });\n  }\n\n  function installBaseOi(){\n    return wrapFunction('renderBaseOiTab',original=>function(){\n      const full=state.baseOiRows||[];\n      const view=XF()?.apply('control-base-oi',full) || full;\n      const saveRows=state.baseOiRows, saveFilter=state.baseOiFilter;\n      state.baseOiRows=view; state.baseOiFilter='';\n      let r;\n      try{r=original.apply(this,arguments);}\n      finally{state.baseOiRows=saveRows;state.baseOiFilter=saveFilter;}\n      bindBaseOi();\n      return r;\n    });\n  }\n\n  function installTransfers(){\n    return wrapFunction('renderTransferenciasTab',original=>function(){\n      const full=state.transferRows||[];\n      const view=XF()?.apply('control-transfer',full) || full;\n      const saved={\n        rows:state.transferRows,\n        filter:state.transferFilter,\n        ini:state.transferDataInicio,\n        fim:state.transferDataFim,\n        pend:state.transferPendencia\n      };\n      state.transferRows=view;\n      state.transferFilter='';\n      state.transferDataInicio=null;\n      state.transferDataFim=null;\n      state.transferPendencia=null;\n      let r;\n      try{r=original.apply(this,arguments);}\n      finally{\n        state.transferRows=saved.rows;\n        state.transferFilter=saved.filter;\n        state.transferDataInicio=saved.ini;\n        state.transferDataFim=saved.fim;\n        state.transferPendencia=saved.pend;\n      }\n      bindTransfers();\n      return r;\n    });\n  }\n\n  function installConsumo(){\n    const a=wrapFunction('loadBaseConsumoTab',original=>async function(){\n      if(!XF()?.hasActive('control-consumo')){\n        consumoAllCache=null;\n        state.consumoFilter='';\n        return original.apply(this,arguments);\n      }\n      try{\n        const all=await ensureConsumoAll();\n        const filtered=XF().apply('control-consumo',all);\n        const from=state.consumoPage*state.consumoPageSize;\n        state.consumoRows=filtered.slice(from,from+state.consumoPageSize);\n        state.consumoTotal=filtered.length;\n        if(!state.consumoResumo){\n          const {data,error}=await sb.from('vw_controle_base_consumo_resumo').select('*').maybeSingle();\n          if(error)throw error;\n          state.consumoResumo=data||{};\n        }\n        window.renderBaseConsumoTab?.();\n      }catch(err){\n        app.innerHTML=`<div class=\"error-msg\" style=\"margin:40px;\">Erro ao filtrar Base Consumo: ${String(err?.message||err)}</div>`;\n      }\n    });\n    const b=wrapFunction('renderBaseConsumoTab',original=>function(){\n      const r=original.apply(this,arguments);\n      bindConsumo();\n      return r;\n    });\n    const c=wrapFunction('importarArquivoBaseConsumo',original=>async function(){\n      consumoAllCache=null;\n      return original.apply(this,arguments);\n    });\n    return a||b||c;\n  }\n\n  function bindPlanning(){\n    if(!desktop()||!XF())return;\n    const table=document.querySelector('.v4023-plan-table');\n    if(!table)return;\n    const toolbar=document.querySelector('.v4023-plan-toolbar');\n    if(toolbar){\n      toolbar.querySelectorAll('input,select').forEach(el=>el.style.display='none');\n      let sum=toolbar.querySelector('.hap-xf-toolbar-summary');\n      if(!sum){\n        sum=document.createElement('div');\n        sum.className='hap-xf-toolbar-summary';\n        sum.style.flex='1 1 260px';\n        toolbar.prepend(sum);\n      }\n      XF().mountSummary(sum,'control-planning',{showClear:true});\n    }\n    if(table.dataset.hapXfPlanning==='40.0.99')return;\n    table.dataset.hapXfPlanning='40.0.99';\n    XF().bindDom({\n      id:'control-planning',\n      table,\n      columns:[\n        {key:'oi',label:'O.I.',type:'text',index:0},\n        {key:'obra',label:'Obra',type:'text',index:1},\n        {key:'motivo',label:'Motivo',type:'text',index:2},\n        {key:'montante',label:'Montante atual',type:'number',index:3},\n        {key:'aportes',label:'Aportes pendentes',type:'number',index:4},\n        {key:'meses',label:'Mês(es)',type:'text',index:5},\n        {key:'inicio',label:'Início',type:'date',index:6},\n        {key:'fim',label:'Fim',type:'date',index:7},\n        {key:'curva',label:'Curva',type:'text',index:8}\n      ],\n      countEl:toolbar?.querySelector('span[style*=\"font-size:10px\"]')||null,\n      summaryEl:toolbar?.querySelector('.hap-xf-toolbar-summary')||null\n    });\n  }\n\n  function bindManagerGlobalClear(){\n    const btn=document.getElementById('v4071-clear');\n    if(!btn||btn.dataset.hapXfV40101==='1'||!XF())return;\n    btn.dataset.hapXfV40101='1';\n    btn.addEventListener('click',()=>XF().clearPrefix('mgr-',{silent:true}),true);\n  }\n\n  let refreshedAfterInstall=false;\n  function install(){\n    if(!XF())return false;\n    const installed=[\n      installCapex(),\n      installBaseOi(),\n      installTransfers(),\n      installConsumo()\n    ].some(Boolean);\n\n    bindPlanning();\n    bindManagerGlobalClear();\n\n    if(installed && !refreshedAfterInstall && typeof window.refreshCurrent==='function'){\n      refreshedAfterInstall=true;\n      setTimeout(()=>{\n        try{window.refreshCurrent();}\n        catch(e){console.error('[HAPCAPEX V40.0.99] refresh inicial',e);}\n      },0);\n    }\n    return installed;\n  }\n\n  install();\n\n  let tries=0;\n  const timer=setInterval(()=>{\n    install();\n    tries++;\n    if(tries>=120)clearInterval(timer);\n  },100);\n\n  let obsTimer=0;\n  const observer=new MutationObserver(()=>{\n    clearTimeout(obsTimer);\n    obsTimer=setTimeout(()=>{\n      install();\n      bindPlanning();\n      bindManagerGlobalClear();\n      hardenCurrentFilterUi();\n    },30);\n  });\n  observer.observe(document.documentElement,{childList:true,subtree:true});\n  hardenCurrentFilterUi();\n})();</script>";
const LEGACY_HEADER_FILTER_CLEANUP_TAG = "<script>(() => {\n  'use strict';\n  if (window.__HAP_V4095_REMOVE_LEGACY_HEADER_FILTERS__) return;\n  window.__HAP_V4095_REMOVE_LEGACY_HEADER_FILTERS__ = true;\n\n  function cleanTable(table) {\n    if (!table?.tHead || !table.querySelector('.hap-xf-btn')) return;\n    table.classList.add('hap-xf-clean-table');\n\n    [...table.tHead.rows].forEach((row, rowIndex) => {\n      const controls = [...row.querySelectorAll('input,select,textarea')];\n      if (!controls.length) return;\n\n      controls.forEach(el => {\n        const wrapper = el.parentElement;\n        el.remove();\n\n        if (wrapper && wrapper !== row && !['TH','TD'].includes(wrapper.tagName)) {\n          const hasMeaningfulText = !!String(wrapper.textContent || '').trim();\n          const hasUsefulControl = !!wrapper.querySelector('button,.hap-xf-btn');\n          if (!hasMeaningfulText && !hasUsefulControl) wrapper.remove();\n        }\n      });\n\n      if (rowIndex > 0) {\n        const meaningful = [...row.cells].some(cell => {\n          const text = String(cell.textContent || '').trim();\n          return !!text || !!cell.querySelector('button,.hap-xf-btn');\n        });\n        if (!meaningful) row.remove();\n      }\n    });\n  }\n\n  function cleanAll() {\n    document.querySelectorAll('table').forEach(cleanTable);\n  }\n\n  if (!document.getElementById('hap-v4095-remove-legacy-header-filters-style')) {\n    const style = document.createElement('style');\n    style.id = 'hap-v4095-remove-legacy-header-filters-style';\n    style.textContent = `\n      .hap-xf-clean-table thead input,\n      .hap-xf-clean-table thead select,\n      .hap-xf-clean-table thead textarea {\n        display:none !important;\n      }\n    `;\n    document.head.appendChild(style);\n  }\n\n  cleanAll();\n  const observer = new MutationObserver(cleanAll);\n  observer.observe(document.documentElement, { childList:true, subtree:true });\n  setTimeout(cleanAll, 0);\n})();</script>";
const CURVE_EXCEL_FILTER_TAG = "<script>(() => {\n  'use strict';\n  if(window.__HAP_V4098_CURVE_XF_RUNTIME__)return;\n  window.__HAP_V4098_CURVE_XF_RUNTIME__={started:true};\n\n  const XF=()=>window.HAP_XF;\n  const mobile=()=>document.body.classList.contains('pwa-mobile')||window.innerWidth<=720;\n\n  function ensureClearButton(bar,xfId,mode){\n    if(!bar||!XF())return;\n    let btn=bar.querySelector('.btn-clear');\n    if(!btn){\n      btn=document.createElement('button');\n      btn.type='button';\n      btn.className='btn-clear';\n      btn.textContent='Limpar filtros';\n      bar.appendChild(btn);\n    } else {\n      btn.style.display='';\n      btn.textContent='Limpar filtros';\n    }\n    if(btn.dataset.hapXfV4098==='1')return;\n    btn.dataset.hapXfV4098='1';\n    btn.addEventListener('click',()=>{\n      if(mode==='obras' && typeof window.clearAllObrasFilters==='function') window.clearAllObrasFilters();\n      else if(mode==='man' && typeof window.clearAllManFilters==='function') window.clearAllManFilters();\n      else XF().clear(xfId);\n    });\n  }\n\n  function prepBar(inputId,selectId,countId,xfId,mode){\n    if(mobile()||!XF())return;\n    const input=document.getElementById(inputId);\n    if(input){input.value='';input.style.display='none';}\n    const sel=selectId&&document.getElementById(selectId);\n    if(sel){sel.value='';sel.style.display='none';}\n    const bar=input?.closest('.filter-bar');\n    if(!bar)return;\n    let sum=bar.querySelector('.hap-xf-toolbar-summary');\n    if(!sum){\n      sum=document.createElement('div');\n      sum.className='hap-xf-toolbar-summary';\n      sum.style.flex='1 1 280px';\n      bar.prepend(sum);\n    }\n    XF().mountSummary(sum,xfId,{showClear:false});\n    ensureClearButton(bar,xfId,mode);\n    const count=document.getElementById(countId);\n    if(count)count.style.marginLeft='auto';\n  }\n\n  function bindPrev(){\n    if(mobile()||!XF())return;\n    const table=document.querySelector('#table-prev-wrapper table');\n    if(!table)return;\n    const mons=selectedMonths.size>0?MONTHS.filter(m=>selectedMonths.has(m.key)):MONTHS;\n    const cols=[\n      {key:'nome',label:'Obra',type:'text',index:0,get:o=>o.nome},\n      {key:'capex',label:'CAPEX',type:'number',index:1,get:o=>o.capex}\n    ];\n    mons.forEach((m,i)=>cols.push({key:'prev_'+m.key,label:m.label,type:'number',index:2+i,get:o=>o.flow?.[m.key]||0}));\n    cols.push({key:'prev_total',label:'Total Previsto',type:'number',index:2+mons.length,get:o=>mons.reduce((s,m)=>s+Number(o.flow?.[m.key]||0),0)});\n    XF().bind({id:'curve-obras',table,rows:obras,columns:cols,onChange:()=>window.applyFilter?.()});\n    prepBar('filterInput','filterTipo','filterCount','curve-obras','obras');\n  }\n\n  function bindReal(){\n    if(mobile()||!XF())return;\n    const table=document.querySelector('#table-real-wrapper table');\n    if(!table)return;\n    const mons=selectedMonths.size>0?MONTHS_REAL.filter(m=>selectedMonths.has(m)):MONTHS_REAL;\n    const cols=[\n      {key:'nome',label:'Obra',type:'text',index:0,get:o=>o.nome},\n      {key:'capex',label:'CAPEX',type:'number',index:1,get:o=>o.capex}\n    ];\n    mons.forEach((mk,i)=>{\n      const label=MONTHS.find(m=>m.key===mk)?.label||mk;\n      cols.push(\n        {key:'real_'+mk,label:'Real '+label,type:'number',index:2+i*2,get:o=>o[mk+'_real']||0},\n        {key:'prev_'+mk,label:'Prev '+label,type:'number',index:3+i*2,get:o=>o.flow?.[mk]||0}\n      );\n    });\n    const b=2+mons.length*2;\n    cols.push(\n      {key:'total_real',label:'Total Real',type:'number',index:b,get:o=>mons.reduce((s,m)=>s+Number(o[m+'_real']||0),0)},\n      {key:'total_prev',label:'Total Prev',type:'number',index:b+1,get:o=>mons.reduce((s,m)=>s+Number(o.flow?.[m]||0),0)},\n      {key:'desvio_pct',label:'Desvio %',type:'number',index:b+2,get:o=>{\n        const r=mons.reduce((s,m)=>s+Number(o[m+'_real']||0),0);\n        const p=mons.reduce((s,m)=>s+Number(o.flow?.[m]||0),0);\n        return p?((r-p)/p)*100:null;\n      }}\n    );\n    XF().bind({id:'curve-obras',table,rows:obras,columns:cols,onChange:()=>window.applyFilter?.()});\n    prepBar('filterInput','filterTipo','filterCount','curve-obras','obras');\n  }\n\n  function bindMan(){\n    if(mobile()||!XF())return;\n    const table=document.querySelector('#man-table-wrapper table');\n    if(!table)return;\n    const mons=manSelectedMonths.size>0?MONTHS_REAL.filter(m=>manSelectedMonths.has(m)):MONTHS_REAL;\n    const cols=[\n      {key:'nome',label:'Obra de Manutenção',type:'text',index:0,get:o=>o.nome},\n      {key:'ordem',label:'Ordem Int.',type:'text',index:1,get:o=>o.ordem}\n    ];\n    mons.forEach((mk,i)=>cols.push({key:'real_'+mk,label:MONTHS.find(m=>m.key===mk)?.label||mk,type:'number',index:2+i,get:o=>o[mk+'_real']||0}));\n    cols.push({key:'total_real',label:'Total Real',type:'number',index:2+mons.length,get:o=>mons.reduce((s,m)=>s+Number(o[m+'_real']||0),0)});\n    XF().bind({id:'curve-maintenance',table,rows:manObras,columns:cols,onChange:()=>window.applyManFilter?.()});\n    prepBar('manFilterInput',null,'manFilterCount','curve-maintenance','man');\n  }\n\n  function wrap(name,binder){\n    const current=window[name];\n    if(typeof current!=='function')return false;\n    if(current.__hapXfV4098)return true;\n    const wrapped=function(){\n      const r=current.apply(this,arguments);\n      binder();\n      return r;\n    };\n    wrapped.__hapXfV4098=true;\n    wrapped.__hapXfOriginal=current;\n    window[name]=wrapped;\n    return true;\n  }\n\n  let refreshed=false;\n  function install(){\n    if(!XF())return false;\n    const ok=[\n      wrap('renderTablePrev',bindPrev),\n      wrap('renderTableReal',bindReal),\n      wrap('renderManTable',bindMan)\n    ].some(Boolean);\n\n    if(ok&&!refreshed){\n      refreshed=true;\n      setTimeout(()=>{\n        try{\n          const fi=document.getElementById('filterInput');if(fi)fi.value='';\n          const ft=document.getElementById('filterTipo');if(ft)ft.value='';\n          const mi=document.getElementById('manFilterInput');if(mi)mi.value='';\n          window.applyFilter?.();\n          window.applyManFilter?.();\n        }catch(e){console.error('[HAPCAPEX V40.0.98] filtros Curva',e);}\n      },0);\n    }\n    return ok;\n  }\n\n  install();\n  let tries=0;\n  const timer=setInterval(()=>{install();tries++;if(tries>=120)clearInterval(timer);},100);\n})();</script>";
const MANAGERIAL_TABLE_V4094 = "  function renderManagerialTable({id,title,description,rows,columns,empty='Sem dados.'}) {\n    // HAP_V4098_MANAGERIAL_EXCEL_FILTERS\n    const xfId=`mgr-${id}`;\n    const visible=window.HAP_XF ? window.HAP_XF.apply(xfId,rows) : tableView(id,rows,columns);\n    const head=columns.map(col=>`<th class=\"${col.num?'num ':''}\">${esc(col.label)}</th>`).join('');\n    const body=visible.map((row,idx)=>`<tr>${columns.map(col=>{\n      const cls=typeof col.className==='function'?col.className(row,idx):(col.className||'');\n      const cell=typeof col.render==='function'?col.render(row,idx):esc(columnRawValue(row,col));\n      return `<td class=\"${col.num?'num ':''}${cls}\">${cell}</td>`;\n    }).join('')}</tr>`).join('');\n    const footer=visible.length ? `<tfoot><tr class=\"v4080-total-row\">${columns.map(col=>`<td class=\"${col.num?'num ':''}\">${renderTableTotalCell(col,visible)}</td>`).join('')}</tr></tfoot>` : '';\n    const active=!!window.HAP_XF?.hasActive(xfId);\n    const actions=`<div class=\"v4078-table-actions\"><span class=\"v4078-table-count\">${intFmt.format(visible.length)} de ${intFmt.format(rows.length)} linha(s)</span>${active?`<button class=\"v4078-table-clear\" onclick=\"window.HAP_XF?.clear('${esc(xfId)}')\">Limpar filtros</button>`:''}</div>`;\n    if(window.HAP_XF) setTimeout(()=>{\n      const table=document.querySelector(`#v4078-table-${id} table`);\n      if(!table)return;\n      window.HAP_XF.bind({\n        id:xfId,\n        table,\n        rows,\n        columns:columns.map((col,index)=>({\n          key:col.key,\n          label:col.label,\n          type:col.type==='number'?'number':'text',\n          index,\n          get:row=>columnRawValue(row,col)\n        })),\n        onChange:()=>renderContent()\n      });\n    },0);\n    return `<section class=\"v4071-section\" id=\"v4078-table-${esc(id)}\"><div class=\"v4071-section-head\"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div>${actions}</div><div class=\"v4071-table-wrap\"><table class=\"v4071-table\"><thead><tr>${head}</tr></thead><tbody>${body||`<tr><td colspan=\"${columns.length}\" class=\"empty-state\">${esc(empty)}</td></tr>`}</tbody>${footer}</table></div></section>`;\n  }";


const WORK_NAME_MODAL_HTML = `<label id="v4015-work-name-field" style="grid-column:1/-1">
  Nome da obra
  <div style="display:flex;gap:8px;align-items:stretch;margin-top:4px">
    <input id="v4015-work-name" type="text" maxlength="220" autocomplete="off" style="flex:1;min-width:0">
    <button id="v4015-work-name-save" type="button" style="border:1px solid #b8c7da;background:#f5f8fc;color:#163b63;border-radius:8px;padding:0 12px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">Atualizar nome</button>
  </div>
  <small id="v4015-work-name-status" style="display:block;margin-top:5px;font-size:10px;color:#61738a;line-height:1.35">
    O nome é sincronizado entre a Curva e o Controle quando a obra possui uma única OI.
  </small>
</label>`;

const WORK_NAME_INLINE_SCRIPT = `<script>
(() => {
  'use strict';
  const strip = v => String(v || '').replace(/\\s*-\\s*CONTIN.*$/i,'').trim();

  function itemAtual(){
    const id=document.getElementById('workEditId')?.value;
    return (window.HAP_STATE_ITEMS||[]).find(x=>x.id===id)||null;
  }

  function preencher(){
    const item=itemAtual();
    const input=document.getElementById('v4015-work-name');
    const status=document.getElementById('v4015-work-name-status');
    if(input && item) input.value=strip(item.nome);
    if(status){
      status.style.color='#61738a';
      status.textContent='O nome é sincronizado entre a Curva e o Controle quando a obra possui uma única OI.';
    }
  }

  async function salvar(){
    const item=itemAtual();
    const input=document.getElementById('v4015-work-name');
    const btn=document.getElementById('v4015-work-name-save');
    const status=document.getElementById('v4015-work-name-status');
    const nome=String(input?.value||'').trim();
    if(!item||!input||!btn||!status)return;
    if(typeof currentProfile==='undefined'||currentProfile?.role!=='admin')return;
    if(!nome){
      status.style.color='#a12727';
      status.textContent='Informe o nome da obra.';
      input.focus();
      return;
    }
    if(nome===strip(item.nome)){
      status.style.color='#61738a';
      status.textContent='O nome informado já é o nome atual.';
      return;
    }
    btn.disabled=true;
    status.style.color='#61738a';
    status.textContent='Salvando e sincronizando...';
    try{
      const {data,error}=await sb.rpc('renomear_obra_curva_integrado',{
        p_item_id:item.id,
        p_novo_nome:nome
      });
      if(error)throw error;
      const finalName=String(data?.nome||nome);
      item.nome=finalName;
      const raw=(window.HAP_DATA?.obrasRaw||[]).find(w=>w._id===item.id);
      if(raw)raw.nome=finalName;
      const runtime=(window.HAP_RUNTIME_OBRAS||[]).find(w=>w._id===item.id);
      if(runtime)runtime.nome=finalName;
      const identity=document.getElementById('workEditIdentity');
      if(identity)identity.textContent=(item.ordem||'')+' — '+finalName;
      input.value=strip(finalName);
      status.style.color='#187342';
      status.textContent=data?.multiplas_ois
        ? 'Nome atualizado na Curva. Como esta obra possui múltiplas OIs, o Controle não foi renomeado automaticamente.'
        : data?.controle_sincronizado
          ? 'Nome atualizado na Curva e sincronizado com o Controle de CAPEX.'
          : 'Nome atualizado na Curva.';
    }catch(err){
      status.style.color='#a12727';
      status.textContent='Falha ao atualizar o nome: '+(err?.message||String(err));
    }finally{
      btn.disabled=false;
    }
  }

  document.getElementById('v4015-work-name-save')?.addEventListener('click',salvar);
  document.getElementById('v4015-work-name')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();void salvar();}
  });

  const original=window.openWorkEditor;
  if(typeof original==='function'&&!window.__HAP_V4015_NAME_PATCHED__){
    window.openWorkEditor=function(){
      const r=original.apply(this,arguments);
      setTimeout(preencher,0);
      return r;
    };
    window.__HAP_V4015_NAME_PATCHED__=true;
  }
  setTimeout(preencher,0);
})();
</script>`;

const DATE_PLANNING_REMINDER_SCRIPT = `<script>
(() => {
  'use strict';
  if (window.__HAP_V4030_DATE_REMINDER__) return;
  window.__HAP_V4030_DATE_REMINDER__ = true;

  const form = document.getElementById('workEditForm');
  const start = document.getElementById('workEditStart');
  const end = document.getElementById('workEditEnd');
  const rule = document.getElementById('workEditRule');
  if (!form || !start || !end || !rule) return;

  const warning = document.createElement('div');
  warning.id = 'v4030-date-planning-warning';
  warning.hidden = true;
  warning.style.cssText = 'margin:10px 0;padding:10px 12px;border:1px solid #e6b64b;background:#fff7df;color:#68480d;border-radius:9px;font-size:11px;line-height:1.45';
  warning.innerHTML = '<strong>⚠ Datas alteradas — revise o planejamento</strong><br>O HAPCAPEX não mudará a regra financeira automaticamente. Se o fluxo mensal também precisar mudar, revise a <strong>Regra financeira</strong> antes ou depois de salvar.';
  const impact = document.getElementById('workEditImpact');
  if (impact?.parentNode) impact.parentNode.insertBefore(warning, impact);
  else form.querySelector('.admin-actions')?.before(warning);

  let snapshot = null;

  function currentItem(){
    const id=document.getElementById('workEditId')?.value;
    return (window.HAP_STATE_ITEMS||[]).find(x=>x.id===id)||null;
  }

  function capture(){
    const item=currentItem();
    if(!item){ snapshot=null; warning.hidden=true; return; }
    snapshot={
      id:item.id,
      inicio:item.inicio||'',
      fim:item.fim||'',
      rule:item.flow_rule||''
    };
    update();
  }

  function datesChanged(){
    if(!snapshot) return false;
    return String(start.value||'')!==String(snapshot.inicio||'') || String(end.value||'')!==String(snapshot.fim||'');
  }

  function ruleChanged(){
    if(!snapshot) return false;
    return String(rule.value||'')!==String(snapshot.rule||'');
  }

  function update(){
    warning.hidden=!datesChanged();
    if(!warning.hidden){
      warning.style.borderColor = ruleChanged() ? '#9bc9aa' : '#e6b64b';
      warning.style.background = ruleChanged() ? '#eefaf3' : '#fff7df';
      warning.style.color = ruleChanged() ? '#17643a' : '#68480d';
      warning.innerHTML = ruleChanged()
        ? '<strong>✓ Datas e regra financeira foram revisadas</strong><br>Confira o impacto abaixo antes de salvar.'
        : '<strong>⚠ Datas alteradas — planejamento ainda não revisado</strong><br>As novas datas serão salvas, mas o HAPCAPEX <strong>não trocará a regra financeira automaticamente</strong>. Se o fluxo mensal também precisar mudar, revise a <strong>Regra financeira</strong>.';
    }
  }

  start.addEventListener('input',update);
  end.addEventListener('input',update);
  rule.addEventListener('change',update);

  form.addEventListener('submit',e=>{
    if(!datesChanged() || ruleChanged()) return;
    const ok=window.confirm('Você alterou as datas da obra, mas não alterou o planejamento/regra financeira.\\n\\nAs novas datas serão salvas mantendo o planejamento atual.\\n\\nDeseja continuar?');
    if(!ok){ e.preventDefault(); e.stopImmediatePropagation(); rule.focus(); }
  },true);

  const original=window.openWorkEditor;
  if(typeof original==='function'&&!window.__HAP_V4030_EDITOR_CAPTURED__){
    window.openWorkEditor=function(){
      const r=original.apply(this,arguments);
      setTimeout(capture,0);
      return r;
    };
    window.__HAP_V4030_EDITOR_CAPTURED__=true;
  }
})();
</script>`;

const SRI = {
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js': 'sha384-AkNSQdptcXlJ0/NBZc4qGk86cDVXcCevwoWgEKIpHOEfbvlXGLlIkimQtONt8KNf',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js': 'sha384-e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js': 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'
};

function isControlPage(url) {
  return /\/controle-capex\.html$/i.test(url.pathname);
}
function isIndexPage(url) {
  return /\/index\.html$/i.test(url.pathname) || url.pathname.endsWith('/');
}
function isBootstrapScript(url) {
  return /\/bootstrap\.js$/i.test(url.pathname);
}
function isControlManagerialScript(url) {
  return /\/v40-control-managerial\.js$/i.test(url.pathname);
}
function isControlGovernanceScript(url) {
  return /\/v37-control-governance\.js$/i.test(url.pathname);
}
function isDashboardCoreScript(url) {
  return /\/dashboard-core\.js$/i.test(url.pathname);
}

function addSri(html) {
  let text = html;
  Object.entries(SRI).forEach(([src, integrity]) => {
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<script\\s+src=["']${escaped}["'](?:\\s+[^>]*)?><\\/script>`, 'gi');
    text = text.replace(re, `<script src="${src}" integrity="${integrity}" crossorigin="anonymous"></script>`);
  });
  return text;
}

function removeVersionedScript(text, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<script[^>]+src=["'][^"']*${escaped}(?:\\?v=[^"']*)?["'][^>]*><\\/script>`, 'gi');
  return text.replace(re, '');
}

function responseWithText(response, text, contentType, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('content-type', contentType);
  Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(text, { status: response.status, statusText: response.statusText, headers });
}


function patchControlManagerialSource(source) {
  if (!source || source.includes('HAP_V4090_OPERATIONAL_HEAD_SCOPE')) {
    return { text: source, applied: !!source?.includes('HAP_V4090_OPERATIONAL_HEAD_SCOPE') };
  }

  const replacements = [
    [
      "  const isExcludedManagerialPackage = value => EXCLUDED_MANAGERIAL_PACKAGES.has(norm(value));",
      "  const isExcludedManagerialPackage = value => EXCLUDED_MANAGERIAL_PACKAGES.has(norm(value));\n  // HAP_V4090_OPERATIONAL_HEAD_SCOPE — bolsões financeiros não são áreas operacionais.\n  const NON_OPERATIONAL_HEADS = new Set(['SAVING SLT','SAVING C.O']);\n  const isOperationalHead = value => !NON_OPERATIONAL_HEADS.has(norm(value));"
    ],
    [
      "    const heads=aggregateFinance(ois,'head');",
      "    const heads=aggregateFinance(ois.filter(o=>isOperationalHead(o?.head)),'head');"
    ],
    [
      "    const heads=uniq(allOis().map(o=>o.head)).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));",
      "    const heads=uniq(allOis().filter(o=>isOperationalHead(o?.head)).map(o=>o.head)).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));"
    ],
    [
      "${card('v4071-chart-head','Concentração do CAPEX por HEAD','% do CAPEX atual. Exibe os principais HEADs; clique para filtrar.',true)}",
      "${card('v4071-chart-head','Concentração do CAPEX por HEAD','% do CAPEX das áreas operacionais. SAVING SLT e SAVING C.O não entram nesta análise.',true)}"
    ],
    [
      "return renderManagerialTable({id:'heads',title:'HEAD Operação',description:'Distribuição financeira e concentração dentro do universo filtrado.',rows:s.heads,columns:cols});",
      "return renderManagerialTable({id:'heads',title:'HEAD Operação',description:'Distribuição financeira entre áreas operacionais. SAVING SLT e SAVING C.O não entram nesta análise.',rows:s.heads,columns:cols});"
    ]
  ];

  let text = source;
  for (const [from, to] of replacements) {
    if (!text.includes(from)) {
      return { text: source, applied: false };
    }
    text = text.replace(from, to);
  }
  return { text, applied: true };
}


function patchManagerExcelFiltersV4098(source) {
  if (!source) return { text: source, applied: false };
  if (source.includes('HAP_V4098_MANAGERIAL_EXCEL_FILTERS')) return { text: source, applied: true };
  const start = source.indexOf('  function renderManagerialTable({id,title,description,rows,columns,empty=');
  const end = source.indexOf('\n\n  function ensureStyle()', start);
  if (start < 0 || end < 0) return { text: source, applied: false };
  return { text: source.slice(0,start) + MANAGERIAL_TABLE_V4094 + source.slice(end), applied: true };
}

function patchDashboardCoreV4098(source) {
  if (!source) return { text: source, applied: false };
  if (source.includes('HAP_V4098_CURVE_EXCEL_FILTERS')) return { text: source, applied: true };
  let text=source;
  const a1=`    return matchText && matchTipo && matchMonth && matchStatus;\n  });\n\n  const statusLabel`;
  const b1=`    const matchExcel = !window.HAP_XF || window.HAP_XF.matches('curve-obras', o); // HAP_V4098_CURVE_EXCEL_FILTERS\n    return matchText && matchTipo && matchMonth && matchStatus && matchExcel;\n  });\n  if (window.HAP_XF) filteredObras = window.HAP_XF.sortRows('curve-obras', filteredObras);\n\n  const statusLabel`;
  if(!text.includes(a1)) return {text:source,applied:false};text=text.replace(a1,b1);
  const a2=`    return matchText && matchMonth && matchStatus;\n  });\n  const tipoMapDyn = {};`;
  const b2=`    const matchExcel = !window.HAP_XF || window.HAP_XF.matches('curve-obras', o);\n    return matchText && matchMonth && matchStatus && matchExcel;\n  });\n  const tipoMapDyn = {};`;
  if(!text.includes(a2)) return {text:source,applied:false};text=text.replace(a2,b2);
  const a3=`    return matchText && matchMonth;\n  });\n  document.getElementById('manFilterCount').textContent`;
  const b3=`    const matchExcel = !window.HAP_XF || window.HAP_XF.matches('curve-maintenance', o);\n    return matchText && matchMonth && matchExcel;\n  });\n  if (window.HAP_XF) manFilteredObras = window.HAP_XF.sortRows('curve-maintenance', manFilteredObras);\n  document.getElementById('manFilterCount').textContent`;
  if(!text.includes(a3)) return {text:source,applied:false};text=text.replace(a3,b3);
  text=text.replace(/\|\| activeStatusFilter !== null;/g, "|| activeStatusFilter !== null || !!window.HAP_XF?.hasActive('curve-obras');");
  text=text.replace(`function clearAllObrasFilters() {\n  activeStatusFilter = null;`, `function clearAllObrasFilters() {\n  window.HAP_XF?.clear('curve-obras',{silent:true});\n  activeStatusFilter = null;`);
  text=text.replace(`function clearAllManFilters() { clearManMonthFilter(); clearManFilter(); }`, `function clearAllManFilters() { window.HAP_XF?.clear('curve-maintenance',{silent:true}); clearManMonthFilter(); clearManFilter(); }`);
  text=text.replace(`function renderManRisk() {\n  const fo = manObras.filter(o => o.total_real > 0);`, `function renderManRisk() {\n  const fo = manFilteredObras.filter(o => o.total_real > 0);`);
  return {text,applied:true};
}

async function decorateDashboardCoreResponse(response) {
  if (!response || !response.ok) return response;
  const original=await response.text();
  const patched=patchDashboardCoreV4098(original);
  return responseWithText(response,patched.text,'application/javascript; charset=utf-8',{
    'x-hapcapex-functional':'v40.0.101','x-hapcapex-excel-filters':patched.applied?'curve-active':'not-applied'
  });
}

async function decorateControlManagerialResponse(response) {
  if (!response || !response.ok) return response;
  const original = await response.text();
  const headPatch = patchControlManagerialSource(original);
  const excelPatch = patchManagerExcelFiltersV4098(headPatch.text);
  return responseWithText(response, excelPatch.text, 'application/javascript; charset=utf-8', {
    'x-hapcapex-functional': 'v40.0.101',
    'x-hapcapex-managerial-head-scope': headPatch.applied ? 'operational-only' : 'not-applied',
    'x-hapcapex-excel-filters': excelPatch.applied ? 'managerial-active' : 'not-applied'
  });
}

async function decorateBootstrapResponse(response) {
  if (!response || !response.ok) return response;
  let text = await response.text();
  if (!text.includes('HAP_V40_PASSWORD_PREAUTH_CURVE')) {
    const re = /(\s*currentProfile\s*=\s*profile;\s*)(\$\('#authGate'\)\.hidden\s*=\s*true;)/;
    if (re.test(text)) {
      text = text.replace(re, (match, before, authGateLine) => `${before}if (profile.must_change_password) {
    // HAP_V40_PASSWORD_PREAUTH_CURVE — Fase 2: nenhum dado financeiro antes da troca.
    ${authGateLine}
    window.HAP_V40_PENDING_PASSWORD_PROFILE = profile;
    window.dispatchEvent(new CustomEvent('hapcapex:v40:password-required', { detail: { userId: session.user.id } }));
    return;
  }
  ${authGateLine}`);
    }
  }
  if (!text.includes('HAP_V409_CURVE_READY_EVENT')) {
    text = text.replace(
      'v36CurveAddon.onload = finishCurveBoot;\n    v36CurveAddon.onerror = finishCurveBoot;',
      `// HAP_V409_CURVE_READY_EVENT\n    const finishCurveBootV409 = () => {\n      finishCurveBoot();\n      window.dispatchEvent(new CustomEvent('hapcapex:curve-ready'));\n    };\n    v36CurveAddon.onload = finishCurveBootV409;\n    v36CurveAddon.onerror = finishCurveBootV409;`
    );
  }

  return responseWithText(response, text, 'application/javascript; charset=utf-8', {
    'x-hapcapex-security': 'v40.0.6',
    'x-hapcapex-functional': 'v40.0.101',
    'x-hapcapex-bootstrap-guard': text.includes('HAP_V40_PASSWORD_PREAUTH_CURVE') ? 'active' : 'not-applied'
  });
}


const CONTROL_BULK_TRANSFER_HELPERS_V4092 = "// HAP_V4092_BULK_TRANSFER_DIRECT — colagem em lote integrada diretamente ao Controle.\nconst bulkCleanCell = value => String(value ?? '').replace(/\\u00a0/g, ' ').trim();\nconst bulkEscapeHtml = value => bulkCleanCell(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\n\nfunction bulkParseBRL(value) {\n  let s = bulkCleanCell(value).replace(/^R\\$\\s*/i, '').replace(/\\s+/g, '');\n  if (!s) return NaN;\n  if (s.includes(',')) s = s.replace(/\\./g, '').replace(',', '.');\n  else if ((s.match(/\\./g) || []).length > 1) s = s.replace(/\\./g, '');\n  const valueNumber = Number(s.replace(/[^\\d+\\-.]/g, ''));\n  return Number.isFinite(valueNumber) ? Math.round(valueNumber * 100) / 100 : NaN;\n}\n\nfunction bulkParseDate(value) {\n  const s = bulkCleanCell(value);\n  if (!s) return '';\n  let y, m, d;\n  let match = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);\n  if (match) [, y, m, d] = match;\n  else {\n    match = s.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);\n    if (!match) return '';\n    [, d, m, y] = match;\n    d = String(d).padStart(2, '0');\n    m = String(m).padStart(2, '0');\n  }\n  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));\n  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(m) || dt.getUTCDate() !== Number(d)) return '';\n  return `${y}-${m}-${d}`;\n}\n\nfunction bulkSplitClipboardLine(line) {\n  if (line.includes('\\t')) return line.split('\\t').map(bulkCleanCell);\n  const trimmed = line.trim();\n  if (trimmed.includes('|')) {\n    const body = trimmed.replace(/^\\s*\\|/, '').replace(/\\|\\s*$/, '');\n    return body.split('|').map(bulkCleanCell);\n  }\n  return [bulkCleanCell(line)];\n}\n\nfunction bulkIsHeader(cells) {\n  const h = cells.map(v => bulkCleanCell(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase()).join(' ');\n  return h.includes('ORIG') && h.includes('DEST') && h.includes('VALOR');\n}\n\nfunction parseColarTransferenciasTexto(text) {\n  const rawLines = String(text || '').replace(/\\r\\n?/g, '\\n').split('\\n');\n  const rows = [];\n  const errors = [];\n  let logicalLine = 0;\n\n  rawLines.forEach((raw, sourceIndex) => {\n    if (!raw.trim()) return;\n    const cells = bulkSplitClipboardLine(raw);\n    if (cells.length && cells.every(v => /^:?-{3,}:?$/.test(bulkCleanCell(v)))) return;\n    if (bulkIsHeader(cells)) return;\n    logicalLine += 1;\n    if (cells.length < 6) {\n      errors.push(`Linha ${logicalLine}: esperadas 6 colunas; recebidas ${cells.length}.`);\n      return;\n    }\n\n    const origem = bulkCleanCell(cells[0]).replace(/\\s+/g, '');\n    const destino = bulkCleanCell(cells[1]).replace(/\\s+/g, '');\n    const valor = bulkParseBRL(cells[2]);\n    const documento = bulkCleanCell(cells[3]);\n    const justificativa = bulkCleanCell(cells.slice(4, cells.length - 1).join(' '));\n    const data = bulkParseDate(cells[cells.length - 1]);\n    const rowErrors = [];\n    if (!/^\\d{5,}$/.test(origem)) rowErrors.push('OI origem inválida');\n    if (!/^\\d{5,}$/.test(destino)) rowErrors.push('OI destino inválida');\n    if (origem && destino && origem === destino) rowErrors.push('origem e destino são iguais');\n    if (!Number.isFinite(valor) || valor <= 0) rowErrors.push('valor inválido');\n    if (!documento) rowErrors.push('documento vazio');\n    if (!data) rowErrors.push('data inválida');\n    rows.push({ linha:logicalLine, sourceLine:sourceIndex+1, origem, destino, valor, documento, justificativa, data, errors:rowErrors });\n  });\n\n  if (!rows.length && !errors.length) errors.push('Nenhuma linha de transferência foi encontrada.');\n  const docs = [...new Set(rows.map(r => r.documento).filter(Boolean))];\n  const dates = [...new Set(rows.map(r => r.data).filter(Boolean))];\n  if (docs.length > 1) errors.push('O lote contém mais de um número de documento. Cole um documento por vez.');\n  if (dates.length > 1) errors.push('O lote contém mais de uma data. Cole uma data por vez.');\n\n  const seen = new Set();\n  rows.forEach(r => {\n    const key = `${r.origem}|${r.destino}|${Number.isFinite(r.valor) ? r.valor.toFixed(2) : ''}|${r.documento}|${r.data}`;\n    if (seen.has(key)) r.errors.push('linha duplicada na própria colagem');\n    else seen.add(key);\n  });\n  return { rows, errors, documento:docs.length===1?docs[0]:'', data:dates.length===1?dates[0]:'' };\n}\n\nasync function bulkMapLimit(items, limit, worker) {\n  const results = new Array(items.length); let cursor = 0;\n  async function runner(){ while(true){ const idx=cursor++; if(idx>=items.length)return; results[idx]=await worker(items[idx],idx); } }\n  await Promise.all(Array.from({length:Math.min(limit,items.length)},runner));\n  return results;\n}\n\nfunction bulkTransferAlreadyExists(row) {\n  return (state.transferRows || []).some(t => {\n    const sameValue = Math.abs(Number(t.valor || 0) - row.valor) < 0.005;\n    const sameDate = String(t.data || '').slice(0,10) === row.data;\n    return bulkCleanCell(t.oi_origem)===row.origem && bulkCleanCell(t.oi_destino)===row.destino && bulkCleanCell(t.numero_documento)===row.documento && sameValue && sameDate;\n  });\n}\n\nasync function validarColagemTransferencias(parsed) {\n  const rows = parsed.rows.map(r => ({...r,errors:[...(r.errors||[])],warnings:[]}));\n  const uniqueOis = [...new Set(rows.flatMap(r => [r.origem,r.destino]).filter(Boolean))];\n  const infoMap = new Map();\n  await bulkMapLimit(uniqueOis,8,async oi => {\n    try {\n      const {data,error}=await sb.rpc('buscar_obra_por_oi',{p_ordem_interna:oi});\n      infoMap.set(oi,error?{existe:false,error:error.message}:(data||{existe:false}));\n    } catch(err){ infoMap.set(oi,{existe:false,error:err?.message||String(err)}); }\n  });\n\n  rows.forEach(row => {\n    const origemInfo=infoMap.get(row.origem), destinoInfo=infoMap.get(row.destino);\n    if(!origemInfo?.existe) row.errors.push(`OI origem ${row.origem} não encontrada`);\n    if(!destinoInfo?.existe) row.errors.push(`OI destino ${row.destino} não encontrada`);\n    if(origemInfo?.existe && !Number.isFinite(Number(origemInfo.saldo_disponivel))) row.errors.push(`OI origem ${row.origem} sem saldo financeiro disponível`);\n    if(origemInfo?.existe && destinoInfo?.existe && bulkCleanCell(origemInfo.pacote)!==bulkCleanCell(destinoInfo.pacote)){\n      row.rawPackageDifference=true;\n      row.warnings.push(`Pacotes: ${bulkCleanCell(origemInfo.pacote)||'sem pacote'} → ${bulkCleanCell(destinoInfo.pacote)||'sem pacote'}`);\n    } else row.rawPackageDifference=false;\n    if(bulkTransferAlreadyExists(row)) row.errors.push('transferência idêntica já consta no sistema');\n    row.origemInfo=origemInfo||null; row.destinoInfo=destinoInfo||null;\n  });\n\n  const saldoSimulado=new Map();\n  uniqueOis.forEach(oi => { const info=infoMap.get(oi); if(info?.existe && Number.isFinite(Number(info.saldo_disponivel))) saldoSimulado.set(oi,Number(info.saldo_disponivel)); });\n  rows.forEach(row => {\n    if(row.errors.length)return;\n    const atual=saldoSimulado.get(row.origem); if(!Number.isFinite(atual))return;\n    if(row.valor>atual+0.004){ row.errors.push(`saldo insuficiente na origem: disponível nesta etapa ${atual.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`); return; }\n    saldoSimulado.set(row.origem,Math.round((atual-row.valor)*100)/100);\n    if(saldoSimulado.has(row.destino)) saldoSimulado.set(row.destino,Math.round((saldoSimulado.get(row.destino)+row.valor)*100)/100);\n  });\n\n  return {...parsed,rows,valid:parsed.errors.length===0&&rows.every(r=>r.errors.length===0),total:Math.round(rows.reduce((s,r)=>s+(Number.isFinite(r.valor)?r.valor:0),0)*100)/100,rawPackageDifferences:rows.filter(r=>r.rawPackageDifference).length};\n}\n\nfunction renderColagemTransferenciasPreview(container,analysis){\n  const invalid=analysis.rows.filter(r=>r.errors.length).length;\n  const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});\n  container.innerHTML=`\n    ${analysis.errors.length?`<div class=\"error-msg\">${analysis.errors.map(bulkEscapeHtml).join('<br>')}</div>`:''}\n    <div style=\"display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 10px\"><span class=\"role-badge\">${analysis.rows.length} linha(s)</span><span class=\"role-badge\">${analysis.rows.length-invalid} válida(s)</span>${invalid?`<span class=\"role-badge\" style=\"background:#fcebeb;color:#791f1f\">${invalid} com erro</span>`:''}<span class=\"role-badge\">Total ${bulkEscapeHtml(money(analysis.total))}</span>${analysis.documento?`<span class=\"role-badge\">Doc. ${bulkEscapeHtml(analysis.documento)}</span>`:''}${analysis.data?`<span class=\"role-badge\">${bulkEscapeHtml(analysis.data.split('-').reverse().join('/'))}</span>`:''}</div>\n    ${analysis.rawPackageDifferences?`<div class=\"banner-warn\" style=\"margin:8px 0\">${analysis.rawPackageDifferences} linha(s) possuem pacotes de origem/destino diferentes. O backend aplicará a regra gerencial e bloqueará o lote caso alguma exija autorização.</div>`:''}\n    <div style=\"overflow:auto;max-height:340px;border:1px solid var(--cinza-borda);border-radius:8px\"><table style=\"min-width:980px;font-size:11px\"><thead><tr><th>#</th><th>Origem</th><th>Destino</th><th>Valor</th><th>Documento</th><th>Data</th><th>Justificativa</th><th>Status</th></tr></thead><tbody>${analysis.rows.map(r=>`<tr><td>${r.linha}</td><td>${bulkEscapeHtml(r.origem)}<br><small>${bulkEscapeHtml(r.origemInfo?.nome||'')}</small></td><td>${bulkEscapeHtml(r.destino)}<br><small>${bulkEscapeHtml(r.destinoInfo?.nome||'')}</small></td><td>${bulkEscapeHtml(money(r.valor))}</td><td>${bulkEscapeHtml(r.documento)}</td><td>${bulkEscapeHtml(r.data?r.data.split('-').reverse().join('/'):'')}</td><td style=\"white-space:normal;min-width:220px\">${bulkEscapeHtml(r.justificativa)}</td><td style=\"white-space:normal;min-width:220px\">${r.errors.length?`<span style=\"color:var(--vermelho);font-weight:700\">${r.errors.map(bulkEscapeHtml).join('<br>')}</span>`:`<span style=\"color:var(--verde);font-weight:700\">✓ OK</span>${r.warnings.length?`<br><span style=\"color:var(--amarelo-texto)\">${r.warnings.map(bulkEscapeHtml).join('<br>')}</span>`:''}`}</td></tr>`).join('')}</tbody></table></div>`;\n}\n\nfunction openColarTransferenciasModal(){\n  document.getElementById('bulk-transfer-modal-v4092')?.remove();\n  const backdrop=document.createElement('div'); backdrop.id='bulk-transfer-modal-v4092'; backdrop.className='modal-backdrop';\n  backdrop.innerHTML=`<div class=\"modal-box\" style=\"width:min(1120px,96vw)\"><h2>Colar transferências do Excel</h2><p class=\"sub\">Copie e cole as colunas nesta ordem: <strong>OI origem · OI destino · Valor · Nº documento · Justificativa · Data</strong>. Pode colar com ou sem cabeçalho.</p><div id=\"bulk-transfer-error-v4092\"></div><textarea id=\"bulk-transfer-text-v4092\" rows=\"9\" spellcheck=\"false\" style=\"width:100%;font-family:Consolas,monospace;font-size:11px;resize:vertical\" placeholder=\"50159083&#9;50159680&#9;R$ 450.000,00&#9;15359&#9;SOLICITAÇÃO...&#9;15/09/2026\"></textarea><div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0\"><button class=\"btn btn-secondary\" id=\"bulk-transfer-analisar-v4092\">Analisar colagem</button><span id=\"bulk-transfer-status-v4092\" style=\"font-size:11px;color:var(--texto-suave)\"></span></div><div id=\"bulk-transfer-preview-v4092\"></div><label id=\"bulk-transfer-auth-wrap-v4092\" style=\"display:none;align-items:center;gap:7px;margin-top:12px;font-size:11px;font-weight:700\"><input type=\"checkbox\" id=\"bulk-transfer-auth-v4092\"> Confirmo autorização do diretor caso alguma linha exija transferência entre pacotes gerenciais diferentes.</label><div class=\"modal-actions\"><button class=\"btn btn-secondary\" id=\"bulk-transfer-cancel-v4092\">Cancelar</button><button class=\"btn btn-primary\" id=\"bulk-transfer-save-v4092\" disabled>Registrar lote</button></div></div>`;\n  document.body.appendChild(backdrop);\n  const textEl=document.getElementById('bulk-transfer-text-v4092'),previewEl=document.getElementById('bulk-transfer-preview-v4092'),statusEl=document.getElementById('bulk-transfer-status-v4092'),errorEl=document.getElementById('bulk-transfer-error-v4092'),saveBtn=document.getElementById('bulk-transfer-save-v4092'),authWrap=document.getElementById('bulk-transfer-auth-wrap-v4092'),authEl=document.getElementById('bulk-transfer-auth-v4092');\n  let lastText='';\n  async function analisar(){ saveBtn.disabled=true; errorEl.innerHTML=''; statusEl.textContent='Validando OIs e saldos...'; const currentText=textEl.value; const analysis=await validarColagemTransferencias(parseColarTransferenciasTexto(currentText)); lastText=currentText; renderColagemTransferenciasPreview(previewEl,analysis); authWrap.style.display=analysis.rawPackageDifferences?'flex':'none'; statusEl.textContent=analysis.valid?'Pronto para registrar.':'Corrija as linhas destacadas.'; saveBtn.disabled=!analysis.valid; saveBtn.textContent=analysis.valid?`Registrar ${analysis.rows.length} transferência(s)`:'Registrar lote'; return analysis; }\n  document.getElementById('bulk-transfer-analisar-v4092').onclick=()=>void analisar();\n  document.getElementById('bulk-transfer-cancel-v4092').onclick=()=>backdrop.remove();\n  backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});\n  textEl.addEventListener('input',()=>{if(textEl.value!==lastText){saveBtn.disabled=true;statusEl.textContent='Conteúdo alterado — analise novamente.';}});\n  saveBtn.onclick=async()=>{ saveBtn.disabled=true; errorEl.innerHTML=''; try{ const analysis=await analisar(); if(!analysis.valid)return; const confirma=!!authEl.checked; const itens=analysis.rows.map(r=>({oi_origem:r.origem,oi_destino:r.destino,valor:r.valor,justificativa:r.justificativa||null,confirma_pacotes_diferentes:r.rawPackageDifference?confirma:false})); statusEl.textContent='Registrando lote...'; saveBtn.disabled=true; const {data,error}=await sb.rpc('criar_transferencias_lote',{p_numero_documento:analysis.documento||null,p_data:analysis.data||null,p_itens:itens}); if(error)throw error; const quantidade=Number(data?.quantidade||analysis.rows.length); backdrop.remove(); await loadTransferenciasTab(); alert(`${quantidade} transferência(s) registradas com sucesso.`); }catch(err){ errorEl.innerHTML=`<div class=\"error-msg\">${bulkEscapeHtml(err?.message||String(err))}</div>`; statusEl.textContent='Lote não registrado.'; saveBtn.disabled=false; } };\n  textEl.focus();\n}\n";

function patchControlBulkTransferSourceV4092(source) {
  if (!source) return { text: source, applied: false };
  if (source.includes('HAP_V4092_BULK_TRANSFER_DIRECT')) return { text: source, applied: true };
  const buttonTarget = `      <button class="btn btn-secondary" id="importar-transf-btn">+ Importar planilha</button>\n      <button class="btn btn-primary" id="nova-transf-btn">+ Nova transferência</button>`;
  const buttonReplacement = `      <button class="btn btn-secondary" id="importar-transf-btn">+ Importar planilha</button>\n      <button class="btn btn-secondary" id="colar-transf-btn">📋 Colar do Excel</button>\n      <button class="btn btn-primary" id="nova-transf-btn">+ Nova transferência</button>`;
  const bindingTarget = `  document.getElementById('importar-transf-btn').onclick = () => document.getElementById('import-file-input-transf').click();`;
  const bindingReplacement = bindingTarget + `\n  document.getElementById('colar-transf-btn').onclick = openColarTransferenciasModal;`;
  const helperTarget = `function openNovaTransferenciaModal() {`;
  if (!source.includes(buttonTarget) || !source.includes(bindingTarget) || !source.includes(helperTarget)) return { text: source, applied: false };
  let text = source.replace(buttonTarget, buttonReplacement);
  text = text.replace(bindingTarget, bindingReplacement);
  text = text.replace(helperTarget, CONTROL_BULK_TRANSFER_HELPERS_V4092 + '\n\n' + helperTarget);
  return { text, applied: true };
}


function patchControlGovernanceSourceV4093(source) {
  if (!source) return { text: source, applied: false };
  if (source.includes('HAP_V4093_GLOBAL_AUDIT_ONLY')) {
    return { text: source, applied: true };
  }

  // 1) Remove somente o pill AUDITORIA adicionado ao menu do Controle.
  const auditPillRe = /const extra\s*=\s*`[^`]*AUDITORIA<\/span>`;/;
  const stateAnchor = "    if (state.tab === 'doacoes') state.tab='capex';";
  const mobileAuditAnchor = "    if (text.includes('AUDITORIA')) return 'auditoria';";

  if (!auditPillRe.test(source) || !source.includes(stateAnchor) || !source.includes(mobileAuditAnchor)) {
    return { text: source, applied: false };
  }

  let text = source.replace(
    auditPillRe,
    "const extra = ''; // HAP_V4093_GLOBAL_AUDIT_ONLY — auditoria somente no módulo global."
  );

  // 2) Se uma sessão antiga ainda estiver em state.tab='auditoria', retorna ao CAPEX.
  text = text.replace(
    stateAnchor,
    stateAnchor + "\n    if (state.tab === 'auditoria') state.tab='capex';"
  );

  // 3) O menu móvel também deixa de reconhecer Auditoria como aba do Controle.
  text = text.replace(
    mobileAuditAnchor,
    "    if (text.includes('AUDITORIA')) return '';"
  );

  return { text, applied: true };
}

async function decorateControlGovernanceResponse(response) {
  if (!response || !response.ok) return response;
  const original = await response.text();
  const patched = patchControlGovernanceSourceV4093(original);
  return responseWithText(response, patched.text, 'application/javascript; charset=utf-8', {
    'x-hapcapex-functional': 'v40.0.101',
    'x-hapcapex-control-audit': patched.applied ? 'global-only' : 'not-applied'
  });
}


function patchControlContingencyWarningV40100(source) {
  if (!source) return { text: source, applied: false };
  if (source.includes('HAP_V40100_FULL_CAPEX_CONTINGENCY')) {
    return { text: source, applied: true };
  }
  const target = "const rowConting = state.rows.find(r => r.ordem_interna === '9999999999');";
  if (!source.includes(target)) return { text: source, applied: false };
  const replacement = "const rowConting = (window.__HAP_V40100_FULL_CAPEX_ROWS__ || state.rows).find(r => r.ordem_interna === '9999999999'); // HAP_V40100_FULL_CAPEX_CONTINGENCY";
  return { text: source.replace(target, replacement), applied: true };
}

async function decorateHtmlResponse(response, url) {
  if (!response || !response.ok) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !isControlPage(url) && !isIndexPage(url)) return response;

  const control = isControlPage(url);
  const index = !control && isIndexPage(url);
  if (!control && !index) return response;

  let text = addSri(await response.text());
  let bulkTransferPatched = false;
  let contingencyWarningPatched = false;

  if (control) {
    const bulkPatch = patchControlBulkTransferSourceV4092(text);
    text = bulkPatch.text;
    bulkTransferPatched = bulkPatch.applied;
    const contingencyPatch = patchControlContingencyWarningV40100(text);
    text = contingencyPatch.text;
    contingencyWarningPatched = contingencyPatch.applied;
    text = removeVersionedScript(text, 'v40-security-hardening.js');
    text = removeVersionedScript(text, 'v40-control-security.js');
    text = removeVersionedScript(text, 'v40-control-preauth.js');
    text = removeVersionedScript(text, 'v39-8-control-hotfix.js');
    text = removeVersionedScript(text, 'v40-logout-fix.js');
    text = removeVersionedScript(text, 'v40-managerial-kpis-sort.js');
    text = removeVersionedScript(text, 'v40-aporte-status.js');
    text = removeVersionedScript(text, 'v40-tipologia-governance.js');
    text = removeVersionedScript(text, 'v40-audit-performance.js');
    text = removeVersionedScript(text, 'v40-ui-stability.js');
    text = removeVersionedScript(text, 'v40-horizontal-lock.js');
    text = removeVersionedScript(text, 'v40-stable-header.js');
    text = removeVersionedScript(text, 'v40-control-ui.js');
    text = removeVersionedScript(text, 'v40-work-name-sync.js');
    text = removeVersionedScript(text, 'v40-tipologia-integrity.js');
    text = removeVersionedScript(text, 'v40-classification-copy.js');
    text = removeVersionedScript(text, 'v40-classification-copy-global.js');
    text = removeVersionedScript(text, 'v40-control-managerial.js');
    text = removeVersionedScript(text, 'v40-date-local-policy.js');
    text = removeVersionedScript(text, 'v40-legacy-curve-edit-optional.js');
    // V40.0.101 — motores legados de filtro foram substituídos pelo HAP_XF.
    // Remove também de respostas antigas/decoradas que possam ter ficado em cache.
    text = removeVersionedScript(text, 'v40-capex-column-filters.js');
    text = removeVersionedScript(text, 'v40-transfer-filters.js');

    const governancePatterns = [
      '<script src="v37-control-governance.js?v=37.0"></script>',
      '<script src="./v37-control-governance.js?v=37.0"></script>',
      '<script src="v37-control-governance.js?v=39.7.0"></script>',
      '<script src="./v37-control-governance.js?v=39.7.0"></script>'
    ];
    const marker = governancePatterns.find(tag => text.includes(tag));
    if (marker) {
      text = text.replace(marker, `${CONTROL_SECURITY_TAG}${CONTROL_HOTFIX_TAG}${CONTROL_GOVERNANCE_TAG}${CONTROL_PREAUTH_TAG}${LOGOUT_TAG}${MANAGERIAL_TAG}${APORTE_STATUS_TAG}${TIPOLOGIA_TAG}${AUDIT_PERF_TAG}${CONTROL_UI_TAG}${CLASSIFICATION_COPY_TAG}${CLASSIFICATION_COPY_GLOBAL_TAG}${CONTROL_MANAGERIAL_TAG}${DATE_LOCAL_POLICY_TAG}${LEGACY_CURVE_EDIT_OPTIONAL_TAG}${EXCEL_FILTER_CORE_TAG}${CONTROL_EXCEL_FILTER_TAG}${LEGACY_HEADER_FILTER_CLEANUP_TAG}`);
    } else {
      const initTag = '<script>init();</script>';
      const fallbackInjection = CONTROL_SECURITY_TAG + CONTROL_HOTFIX_TAG + CONTROL_PREAUTH_TAG + LOGOUT_TAG + MANAGERIAL_TAG + APORTE_STATUS_TAG + TIPOLOGIA_TAG + AUDIT_PERF_TAG + CONTROL_UI_TAG + CLASSIFICATION_COPY_TAG + CLASSIFICATION_COPY_GLOBAL_TAG + CONTROL_MANAGERIAL_TAG + DATE_LOCAL_POLICY_TAG + LEGACY_CURVE_EDIT_OPTIONAL_TAG + EXCEL_FILTER_CORE_TAG + CONTROL_EXCEL_FILTER_TAG + LEGACY_HEADER_FILTER_CLEANUP_TAG;
      if (text.includes(initTag)) text = text.replace(initTag, `${fallbackInjection}${initTag}`);
      else if (/<\/body>/i.test(text)) text = text.replace(/<\/body>/i, `${fallbackInjection}</body>`);
      else text += fallbackInjection;
    }
  } else if (index) {
    if (!text.includes('id="v4015-work-name-field"')) {
      text = text.replace(
        '<div class="work-edit-grid">',
        '<div class="work-edit-grid">' + WORK_NAME_MODAL_HTML
      );
    }
    text = removeVersionedScript(text, 'v40-logout-fix.js');
    text = removeVersionedScript(text, 'v40-managerial-kpis-sort.js');
    text = removeVersionedScript(text, 'v40-aporte-status.js');
    text = removeVersionedScript(text, 'v40-tipologia-governance.js');
    text = removeVersionedScript(text, 'v40-audit-performance.js');
    text = removeVersionedScript(text, 'v40-ui-stability.js');
    text = removeVersionedScript(text, 'v40-horizontal-lock.js');
    text = removeVersionedScript(text, 'v40-stable-header.js');
    text = removeVersionedScript(text, 'v40-control-ui.js');
    text = removeVersionedScript(text, 'v40-work-name-sync.js');
    text = removeVersionedScript(text, 'v40-tipologia-integrity.js');
    let injection = '';
    if (!text.includes('v39-global-admin.js')) injection += GLOBAL_ADMIN_TAG;
    injection += LOGOUT_TAG + MANAGERIAL_TAG + APORTE_STATUS_TAG + TIPOLOGIA_TAG;
    injection += WORK_NAME_INLINE_SCRIPT + DATE_PLANNING_REMINDER_SCRIPT + EXCEL_FILTER_CORE_TAG + CURVE_EXCEL_FILTER_TAG;
    if (/<\/body>/i.test(text)) text = text.replace(/<\/body>/i, `${injection}</body>`);
    else text += injection;
  }

  return responseWithText(response, text, 'text/html; charset=utf-8', {
    'x-hapcapex-security': 'v40.0.6',
    'x-hapcapex-functional': 'v40.0.101',
    'x-hapcapex-bulk-transfer': control ? (bulkTransferPatched ? 'direct-source-patched' : 'not-applied') : 'n/a',
    'x-hapcapex-excel-filters': control ? 'control-runtime' : 'curve-runtime'
  });
}

async function decorateResponse(response, url) {
  if (isBootstrapScript(url)) return decorateBootstrapResponse(response);
  if (isControlManagerialScript(url)) return decorateControlManagerialResponse(response);
  if (isControlGovernanceScript(url)) return decorateControlGovernanceResponse(response);
  if (isDashboardCoreScript(url)) return decorateDashboardCoreResponse(response);
  return decorateHtmlResponse(response, url);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))));
    await self.clients.claim();

    // V40.0.86 — força uma navegação das abas abertas para carregar a política
    // de filtros do Gerencial com URL versionada e descartar o cache anterior.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(async client => {
      try {
        const url = new URL(client.url);
        if (url.origin !== self.location.origin) return;
        if (!/\/(?:controle-capex\.html)?(?:$|[?#])/.test(url.pathname + url.search + url.hash)) return;
        await client.navigate(client.url);
      } catch (_) {}
    }));
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const networkResponse = await fetch(request, { cache: 'no-cache' });
      const response = await decorateResponse(networkResponse, url);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        if (cached.headers.get('x-hapcapex-functional') === 'v40.0.101') return cached;
        return decorateResponse(cached, url);
      }
      if (request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return decorateHtmlResponse(fallback, new URL('./index.html', self.location.href));
      }
      throw error;
    }
  })());
});
