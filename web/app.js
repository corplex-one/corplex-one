/* built by scripts/mkweb.mjs — edit ../portal/app.js, not this file */
const DATA = window.__DATA;
/* ---------------- Corplex Sales Portal — demo app ---------------- */
const QS = ['Q1','Q2','Q3','Q4'];
const QLABEL = {Q1:'Q1 · Jan–Mar', Q2:'Q2 · Apr–Jun', Q3:'Q3 · Jul–Sep', Q4:'Q4 · Oct–Dec'};
const MONTHNAME = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ADMIN = 'Avin Mascarenhas';
const USERS = [
  {name:'Abdulkhamid Makhamatjanov',         role:'staff'},
  {name:'Shohruh Karimov',                   role:'staff'},
  {name:'Rana Amine',                        role:'manager'},
  {name:'Abdunosir Kadirov',                 role:'manager'},
  {name:'Shamsiddin Kadirov',                role:'staff'},
  {name:'Nissa Muradova',                    role:'staff'},
  {name:'Zhavokhir Khasanbaev',              role:'staff'},
  {name:'Avin Mascarenhas',                  role:'admin'},
  {name:'Fatima Khaliqdad',                  role:'staff'},
  {name:'Maylyn Aguba Asilo',                role:'staff'},
  {name:'Janine Lagumbay',                   role:'staff'},
  {name:'Sayyora Kadirova',                  role:'staff'},
  {name:'Kazimzhanov Mirabbosbek',           role:'staff'},
  {name:'Mukhamad Musulmonkulov',            role:'staff'},
  {name:'Fakhridin Kochkorov',               role:'staff'},
  {name:'Ma Concecion Bello Viron',          role:'staff'},
  {name:'Shahlaa Mariyam',                   role:'staff'},
  {name:'Donia Mohamed Mahmoud Ahmed',       role:'manager'},
  {name:'Umidakhon Gapurova',                role:'staff'},
  {name:'Razan Faisal Ahamed Yassin',        role:'staff'},
  {name:'Jessa Minda Elle Lagumbay',         role:'staff'},
  {name:'Aziz Karimov',                      role:'staff'},
  {name:'Luna Eltantawy',                    role:'staff'},
  {name:'Ahmed Talaat Mohamed',              role:'staff'},
  {name:'Sevara Maksudova',                  role:'staff'},
  {name:'Abdullokh Fozilov',                 role:'staff'},
  {name:'Shannan Veigas',                    role:'staff'},
  {name:'Jasmine Azerby',                    role:'staff'},
  {name:'Batul Ibrahim Wadiwala',            role:'staff'},
  {name:'Ruel Tolentino',                    role:'staff'},
  {name:'Miraziz Makhamatzhanov',            role:'owner'}
];
const APPROLE = {owner:'owner', accounts:'admin', manager:'manager', staff:'staff'};
const RANK = ['staff','manager','admin','owner'];
const ROLE = Object.fromEntries(Object.entries(DATA._roles || {}).map(([n, rs]) =>
  [n, (rs || []).map(r => APPROLE[r] || 'staff')
        .sort((a,b) => RANK.indexOf(b) - RANK.indexOf(a))[0] || 'staff']));
const COMPANIES = ['CorpLex','POA','Lex Estates'];
const ROLELABEL = {staff:'Consultant', manager:'Department manager', admin:'Accounts manager', owner:'Owner', former:'Left the firm'};
const roleOf = u => ROLE[u] || 'former';
const FORMER = Object.keys(DATA.engine).filter(n=>!ROLE[n]).sort();
/* The department's figures: the sales_company aggregate arrived, so this
   person may read what the whole department did. */
const seesDeptSales = u => !!DATA.dept[u] && companyOf(u).sales;
/* Their own: commission rows of their own came back, which the database sends
   to everybody about themselves. */
const hasOwnSales = u => !!(DATA.engine || {})[u];
const inSales = u => seesDeptSales(u) || hasOwnSales(u);
const isPartner = u => (HR().partners||[]).includes(u);
const noGratuity = u => (HR().noGratuity||[]).includes(u);
/* What a person wants to be called. Every record in the portal shows this once they
   set it; payslips, salary certificates and letters keep the name on the visa,
   because those are legal documents and a bank or an embassy has to match them. */
const NM = n => (((HR().profile||{})[n]||{}).callMe || '').trim() || n;
const nm = n => esc(NM(n));
/* The name on the visa. For most people that is the name the portal is keyed by,
   but not always - Nissa is on file everywhere as Nissa Muradova while her documents
   have to read Gurbanjemal Muradova. Payslips and letters use this and nothing else. */
// the leave types that come off the annual balance
const POOLED = t => !!(REQTYPES.find(x=>x.id===t)||{}).pool;
const legalOf = n => (((HR().legalName||{})[n] || '').trim() || n);
const goesBy = n => NM(n) !== legalOf(n);
const nm2 = v => esc((USERS.some(u=>u.name===v) ? NM(v) : v));
// no annual-leave entitlement: no balance, no leave request, WFH still available
const noLeave = u => (HR().noLeave||[]).includes(u);
// overdrawn: no more leave until the balance is back above zero
const leaveOwed = u => !noLeave(u) && leaveBal(u).left < 0;
const isRemote = u => (HR().remote||[]).includes(u);
const titleOf = u => (HR().titles||{})[u] || (payrollRowFor(u)||{}).title || '';
const phoneOf = u => (HR().phones||{})[u] || '';
const eidOf   = u => (HR().eid||{})[u] || '';
// 784-1234-5678901-2 shows as 784-****-***8901-2
function maskEID(v){
  if(!v) return '';
  const p = String(v).split('-');
  if(p.length !== 4) return String(v).replace(/\d(?=\d{4})/g, '\u2022');
  return `${p[0]}-\u2022\u2022\u2022\u2022-\u2022\u2022\u2022${p[2].slice(-4)}-${p[3]}`;
}
const emailOf = u => (HR().emails||{})[u] || (payrollRowFor(u)||{}).email || '';
/* Managers see their company's sales team. Jessa is the second line for POA sales,
   so she sees it too without being anyone's line manager. */
const salesLead = u => Object.values(HR().salesSecond || {}).includes(u);
const canSeeTeam = u => ['manager','admin','owner'].includes(roleOf(u)) || salesLead(u);
const canSeeTeamCommission = u => ['admin','owner'].includes(roleOf(u));
const canUpload = u => roleOf(u)==='admin';
const canAdmin = u => ['admin','owner'].includes(roleOf(u));
/* Narrower than canAdmin on purpose: accounts, and not the owner. The staff
   register is the one console screen the owner is not offered — see the long
   note where it is built for why that is a choice about whose screen it is
   rather than a restriction the database enforces. */
const isAccounts = u => roleOf(u) === 'admin';
const IC = {q:0,date:1,no:2,client:3,type:4,amt:5,exp:6,pc:7,net:8,elig:9,status:10,bal:11,shared:12,cn:13,ontime:14,forfeit:15,pr:16,sp:17,pm:18,recd:19,sort:20,role:21};

const state = {
  user: window.__ME,
  asAdmin: (window.__ROLES||[]).some(r => r === 'accounts' || r === 'owner'),
  year: '2026',
  period: 'Q2',
  tab: 'home',
  companyGrain: 'month',
  companyMetric: 'net',
  invFilter: {q:'Q2', status:'all', text:'', type:'all', sp:'all', pm:'all', role:'all'},
  invSort: {key:null, dir:1},
  payCompany: 'all',
  deptView: null, company: null, mvWho: '', mvDept: null, mvBusy: false, mvDone: '', attMonth: null, edit: null, edSaved: null,
  exitId: null, exitLines: [], exBusy: false, exitOpen: null, exAsk: null, exWhy: '',
  revQ: '', refShow: false, dirWho: null, attTab: 'me', slipRun: null, slipYear: '',
  opForm: null, opDone: '', reqForm: null, reqSent: false, onOfficeNet: true,
  annNew: false, annT: '', annB: '',
  docFilter: 'attention', docQ: '', ltForm: null, ltSent: false, ltOpen: null,
  lnForm: null, lnSent: false, exitWho: '', exitLwd: '', exitSettle: '', mailPick: 'weekly', mailWeek: null,
  revForm: null, revSent: '', noteDone: [], who: null, peopleQ: '', askTab: 'loans',
  askOnly: null, askBack: 'home', gratMonth: '2026-08', peopleTab: '', leaveTab: 'leave', calcTab: 'card', invRaw: null, invPrint: false,
  payStatus: (window.__DATA && window.__DATA.payroll && window.__DATA.payroll.status) || 'draft',
  pfDirty: null, pfSaved: '', upBusy: null,
  payRun: null, slipOpen: null, mode: 'staff',
  payInternal: false,
  payFilter: {ch:'all', visa:'all', text:''},
  atFilter: {status:'all', country:'all', text:''},
  atSort: {key:'nextS', dir:1},
  paySort: {key:'id', dir:1},
  payNote: '',
  pqConfirm: '',
  approve: {ref:null, payStatus:'', account:'', remarks:''},
  uploaded: false
};
const PERIODS = ['Q1','Q2','Q3','Q4','FY'];
const PLABEL = {Q1:'Q1 · Jan–Mar', Q2:'Q2 · Apr–Jun', Q3:'Q3 · Jul–Sep', Q4:'Q4 · Oct–Dec', FY:'Full year'};
const AGGKEYS = ['newInv','newElig','newCost','exInv','exElig','exCost','pmInv','pmElig','pmCost','totElig',
  'newComm','exComm','pmComm','comm','paid','lost','bal','notColl','eligOnTime','commOnTime','netTot','forf','lateColl'];
function aggOf(u,p){
  if(p!=='FY') return eng(u,p);
  const qs = QS.map(q=>eng(u,q)).filter(Boolean);
  if(!qs.length) return null;
  const o={}; AGGKEYS.forEach(k=>o[k]=Math.round(qs.reduce((s,x)=>s+(x[k]||0),0)*100)/100);
  o.band='FY'; o.isFY=true; o.deptOk=qs[0].deptOk; o.flat=qs[0].flat;
  return o;
}
function mgrOf(u,p){
  const m = DATA.managers && DATA.managers[u];
  if(!m) return null;
  if(p!=='FY') return Object.assign({}, m.q[p]||{deptElig:0,lessOwn:0,lessPm:0,base:0,rate:m.rate,earned:0,paid:0,bal:0}, {rate:m.rate, dept:m.dept});
  const ks=['deptElig','lessOwn','lessPm','base','earned','paid','bal'];
  const o={rate:m.rate, dept:m.dept};
  ks.forEach(k=>o[k]=Math.round(QS.reduce((s,q)=>s+((m.q[q]||{})[k]||0),0)*100)/100);
  return o;
}
const CLDEPT = () => ({
  department: DATA.department, monthly: DATA.monthly, typeMonthly: DATA.typeMonthly,
  topClients: DATA.topClients, clients: DATA.clients, clientCount: DATA.clientCount,
  statusMix: DATA.statusMix, target: DATA.target, totals: DATA.totals });
let _MERGED = null;
function mergedDept(){
  if(_MERGED) return _MERGED;
  const A = CLDEPT(), B = DATA.atDept;
  const mon = {};
  [A,B].forEach(D=>Object.keys(D.monthly).forEach(k=>{
    const s = mon[k] || (mon[k]=[0,0,0,0]);
    for(let i=0;i<4;i++) s[i] += D.monthly[k][i];
  }));
  Object.keys(mon).forEach(k=>{ for(let i=0;i<3;i++) mon[k][i]=Math.round(mon[k][i]*100)/100; });
  const tm = {};
  [A,B].forEach(D=>Object.keys(D.typeMonthly||{}).forEach(k=>{
    const s = tm[k] || (tm[k]=[0,0]);
    s[0]+=D.typeMonthly[k][0]; s[1]+=D.typeMonthly[k][1];
  }));
  Object.keys(tm).forEach(k=>{ tm[k][0]=Math.round(tm[k][0]*100)/100; tm[k][1]=Math.round(tm[k][1]*100)/100; });
  const cl = {};
  [A,B].forEach(D=>Object.keys(D.clients).forEach(k=>{
    const c = D.clients[k];
    if(!cl[k]) cl[k] = c.slice();
    else { cl[k][0]=Math.round((cl[k][0]+c[0])*100)/100; cl[k][1]=Math.round((cl[k][1]+c[1])*100)/100;
           cl[k][2]+=c[2]; if(String(c[3])>String(cl[k][3])) { cl[k][3]=c[3]; cl[k][4]=c[4]; } }
  }));
  const top = Object.keys(cl).map(k=>[k, cl[k][0], cl[k][1], cl[k][2]]).sort((x,y)=>y[2]-x[2]).slice(0,10);
  const sm = {};
  [A,B].forEach(D=>Object.keys(D.statusMix).forEach(k=>sm[k]=(sm[k]||0)+D.statusMix[k]));
  const tot = {};
  ['inv','net','elig','outstanding','count'].forEach(k=>tot[k]=Math.round((A.totals[k]+B.totals[k])*100)/100);
  const keys = Object.keys(mon).sort();
  const monS = {}; keys.forEach(k=>monS[k]=mon[k]);
  _MERGED = {department:'Both departments', monthly:monS, typeMonthly:tm, topClients:top,
    clients:cl, clientCount:Object.keys(cl).length, statusMix:sm, target:null, totals:tot,
    combined:true};
  return _MERGED;
}
const deptOf = u => DATA.dept[u] || DATA.department;
/* Which company's sales a person belongs to. It follows the sales department, not
   the payroll - Miraziz is paid out of POA but sells for CorpLex. Anyone with no
   sales department is in no sales team at all and never appears in these tables. */
const REVDEPT = co => (HR().revDept || {})[co] || [];
const SALESEXTRA = n => (HR().salesExtra || {})[n] || null;
/* Which company's sales a person counts towards. Support departments - Marketing,
   HR & Finance, Operations - earn nothing and never appear in a performance table,
   except for the two people named in salesExtra. */
function salesCoOf(n){
  const x = SALESEXTRA(n); if(x) return x.co;
  const co = ((HR().orgCo || {})[n]) || companyOf(n).key;
  return REVDEPT(co).includes(orgDeptOf(n)) ? co : null;
}
const salesDeptOf = n => { const x = SALESEXTRA(n); return x ? x.dept : (DATA.dept[n] || ''); };
function scopeOf(u){
  if(!canAdmin(u)) return salesDeptOf(u) || deptOf(u);
  const ds = REVDEPT(activeCo().key);
  const v = state.deptView;
  if(v && (v === 'all' || ds.includes(v))) return v;
  return ds.includes(salesDeptOf(u)) ? salesDeptOf(u) : (ds[0] || deptOf(u));
}
function deptData(u){
  const s = scopeOf(u);
  if(s==='all') return mergedDept();
  return s==='Accounting & Tax' ? DATA.atDept : CLDEPT();
}
const sameDept = (a,b) => deptOf(a)===deptOf(b);
function inScope(n,u){
  if(salesCoOf(n) !== activeCo().key) return false;   // one company's table shows that company's people
  const s = scopeOf(u);
  return s==='all' || salesDeptOf(n)===s;
}
function deptSeg(u){
  if(!canAdmin(u)) return '';
  const ds = REVDEPT(activeCo().key);
  if(ds.length < 2) return '';                       // nothing to switch between
  const s = scopeOf(u);
  return `<div class="seg" id="deptSeg" style="margin-left:auto">${
    ds.map(d=>[d,d]).concat([['all','Both']])
    .map(([v,l])=>`<button data-dv="${esc(v)}" aria-pressed="${s===v}" type="button">${esc(l)}</button>`).join('')}</div>`;
}
function deptNet(p, u){
  const M = deptData(u||state.user).monthly;
  return Object.keys(M).reduce((s,k)=>{
    const q = 'Q'+(Math.floor((parseInt(k.slice(5),10)-1)/3)+1);
    return (p==='FY' || q===p) ? s + M[k][1] : s;
  },0);
}
function invRows(u,p){
  const rs = (DATA.inv[u] || []).filter(r => !r[IC.sort] || String(r[IC.sort]).slice(0,4) === state.year);
  return p === 'FY' ? rs.slice() : rs.filter(r => r[IC.q] === p);
}
function outstandingOf(u,p){ return invRows(u,p).reduce((s,r)=>s+(r[IC.bal]||0),0); }

const money = (v,d=0) => (v==null||isNaN(v)?'—':Number(v).toLocaleString('en-AE',{minimumFractionDigits:d,maximumFractionDigits:d}));
const pct = (v,d=1) => (v*100).toFixed(d)+'%';
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const eng = (u,q) => {
  const per = DATA.engine[u] || {};
  // Older data has no year layer; a portal holding one year keeps working.
  const y = per[state.year] || (per.Q1 || per.Q2 || per.Q3 || per.Q4 ? per : null);
  return (y && y[q]) || null;
};
const isFlat = e => !!(e && e.flat);
const bandRates = b => { const r = DATA.bands.find(x=>x[0]===b); return r?{nw:r[3],ex:r[4],pm:r[5]}:{nw:0,ex:0,pm:0}; };

/* ---------------- charts ---------------- */
const TIP = document.getElementById('tip');
function attachTips(wrap){
  wrap.querySelectorAll('[data-tip]').forEach(el=>{
    el.addEventListener('mousemove', ev=>{
      TIP.innerHTML = el.getAttribute('data-tip');
      const r = wrap.getBoundingClientRect();
      TIP.style.left = (ev.clientX - r.left + wrap.offsetLeft) + 'px';
      TIP.style.top  = (ev.clientY - r.top + wrap.offsetTop) + 'px';
      TIP.style.opacity = 1;
    });
    el.addEventListener('mouseleave', ()=>{ TIP.style.opacity = 0; });
  });
}
function niceMax(v){
  if(v<=0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const s = [1,1.25,1.5,2,2.5,3,4,5,6,8,10];
  for(const k of s){ if(p*k >= v) return p*k; }
  return p*10;
}
function topRoundPath(x,y,w,h,r){
  r = Math.min(r, w/2, h);
  return `M${x},${y+h} V${y+r} Q${x},${y} ${x+r},${y} H${x+w-r} Q${x+w},${y} ${x+w},${y+r} V${y+h} Z`;
}
let CHARTS = {};
function chartSlot(id, items, opts){ CHARTS[id] = {items, opts}; return `<div class="pad chartwrap" data-chart="${id}"></div>`; }
function drawCharts(){
  document.querySelectorAll('[data-chart]').forEach(w=>{
    const c = CHARTS[w.dataset.chart]; if(!c) return;
    const W = Math.max(560, Math.round(w.clientWidth - 36));
    w.innerHTML = barChart(c.items, Object.assign({}, c.opts, {W}));
    attachTips(w);
  });
}
function barChart(items, opts){
  opts = opts || {};
  const W = opts.W || 720, H = opts.height || 250, L = 70, R = opts.thresholds ? 86 : 22, T = 18, B = 36;
  const pw = W-L-R, ph = H-T-B;
  const maxv = niceMax(Math.max(...items.map(d=>d.value), ...(opts.thresholds||[]).map(t=>t.v*1.05), 1));
  const y = v => T + ph - (v/maxv)*ph;
  const slot = pw/items.length;
  const bw = Math.min(opts.barWidth||56, slot*0.56);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria||'bar chart')}" style="display:block;width:100%;height:auto">`;
  s += '<g class="grid">';
  for(let i=0;i<=4;i++){ const v = maxv*i/4; s += `<line x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`; }
  s += '</g>';
  for(let i=0;i<=4;i++){ const v = maxv*i/4;
    s += `<text class="ax" x="${L-9}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end">${opts.tickFmt?opts.tickFmt(v):money(v)}</text>`; }
  (opts.thresholds||[]).forEach(t=>{
    if(t.v>maxv) return;
    s += `<line class="thr" x1="${L}" x2="${W-R+4}" y1="${y(t.v).toFixed(1)}" y2="${y(t.v).toFixed(1)}"/>`;
    s += `<text class="thrl" x="${W-R+8}" y="${(y(t.v)+3.5).toFixed(1)}">${esc(t.label)}</text>`;
  });
  items.forEach((d,i)=>{
    const cx = L + slot*i + slot/2, x = cx - bw/2;
    const h = Math.max(0, (d.value/maxv)*ph), yy = y(d.value);
    if(d.parts){
      let acc = 0;
      d.parts.forEach((pt,pi)=>{
        if(pt.value<=0) return;
        const segH = (pt.value/maxv)*ph;
        const y0 = T + ph - ((acc+pt.value)/maxv)*ph;
        const gap = pi===0 ? 0 : 2;
        const isTop = pi === d.parts.length-1;
        s += isTop ? `<path d="${topRoundPath(x,y0,bw,Math.max(1,segH-gap),4)}" fill="${pt.color}"/>`
                   : `<rect x="${x}" y="${y0}" width="${bw}" height="${Math.max(1,segH-gap)}" fill="${pt.color}"/>`;
        acc += pt.value;
      });
    } else if(d.value>0) s += `<path d="${topRoundPath(x,yy,bw,h,4)}" fill="${d.color}"/>`;
    s += `<text class="axl" x="${cx}" y="${H-14}" text-anchor="middle">${esc(d.label)}</text>`;
    if(d.value>0) s += `<text class="dl" x="${cx}" y="${(yy-7).toFixed(1)}" text-anchor="middle">${opts.labelFmt?opts.labelFmt(d.value):money(d.value)}</text>`;
    s += `<rect x="${(cx-slot/2).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${ph}" fill="transparent" data-tip="${esc(d.tip||(d.label+': '+money(d.value)))}"/>`;
  });
  s += `<line x1="${L}" x2="${W-R}" y1="${T+ph}" y2="${T+ph}" stroke="var(--line)" stroke-width="1"/>`;
  s += '</svg>';
  return s;
}
function hbars(rows, opts){
  opts = opts || {};
  const max = Math.max(...rows.map(r=>r.value), 1);
  return '<div class="bars">' + rows.map((r,i)=>`
    <div class="row${r.me?' me':''}">
      <span class="nm">${opts.rank?`<span class="rk">${i+1}</span>`:''}${esc(r.label)}</span>
      <span class="track"><span class="fill" style="width:${Math.max(1.5,(r.value/max)*100).toFixed(1)}%;background:${r.color||'var(--c1)'}"></span></span>
      <span class="val">${opts.fmt?opts.fmt(r.value):money(r.value)}</span>
    </div>`).join('') + '</div>';
}
function stacked(parts){
  const tot = parts.reduce((a,b)=>a+Math.max(0,b.value),0) || 1;
  return `<div class="meter">${parts.map(p=>`<i style="width:${(Math.max(0,p.value)/tot*100).toFixed(2)}%;background:${p.color}" title="${esc(p.label)}"></i>`).join('')}</div>`;
}
function legend(parts){
  return `<div class="legend">${parts.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.label)}</span>`).join('')}</div>`;
}
const statusPill = s => {
  const m = {'Paid':'good','Partially Paid':'warn','Unpaid':'bad'};
  return `<span class="pill ${m[s]||'mute'}"><span class="dt"></span>${esc(s||'Unpaid')}</span>`;
};

/* ---------------- views ---------------- */
const LOGOS = {
  corplex: {rail:'data:image/png;base64,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', slip:'data:image/png;base64,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'},
  poa: {rail:'data:image/png;base64,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', slip:'data:image/png;base64,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'},
  lex: {rail:'data:image/png;base64,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', slip:'data:image/png;base64,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'}
};
/* ---------- companies ---------- */
const CO_BY_CODE = {};
function coByCode(code){
  if(!Object.keys(CO_BY_CODE).length)
    Object.values(DATA.companies).forEach(c=>CO_BY_CODE[c.code]=c);
  return CO_BY_CODE[code] || DATA.companies.corplex;
}
function byCompany(list, o){
  const who  = o.who  || (r => r.name);
  const code = o.code || (r => companyOf(who(r)).code);
  const out = Object.values(DATA.companies).map(c => {
    const rs = list.filter(r => code(r) === c.code);
    if(!rs.length) return '';
    return `<div class="regblock">
      <div class="regbar"><b>${esc(c.name)}</b>
        <span>${rs.length} ${rs.length === 1 ? 'person' : 'people'}</span>
        ${o.note ? `<em>${o.note(rs, c)}</em>` : ''}</div>
      <div class="tw${o.cls ? ' tw-' + o.cls : ''}"><table class="cotab${o.cls ? ' ' + o.cls : ''}">${o.cols || ''}
        ${o.head}<tbody>${rs.map(o.row).join('')}${o.foot ? o.foot(rs, c) : ''}</tbody></table></div>
    </div>`;
  }).join('');
  return out || `<div class="regblock"><p class="cap" style="padding:22px">${
    esc(o.empty || 'Nobody to show here yet.')}</p></div>`;
}

function companyOf(user){
  // the org chart wins: Fakhridin and Mukhamad sell for Lex while POA and CorpLex pay them
  const k = (HR().orgCo || {})[user];
  if(k && DATA.companies[k]) return DATA.companies[k];
  const r = payrollRowFor(user);
  return r ? coByCode(r.company) : DATA.companies.corplex;
}
// the entity that pays them
function payCompanyOf(user){
  const r = payrollRowFor(user);
  return r ? coByCode(r.company) : DATA.companies.corplex;
}
/* Payslips and letters carry the entity that sponsors the visa, which is not always
   the one that runs the payroll or the one they work for - Donia is on a CorpLex
   visa while she runs POA. Where no visa entity is recorded the payroll entity
   stands in, because that is the usual case. */
const VISACO = {'CorpLex':'corplex', 'CorpLex - POA':'corplex', 'POA':'poa', 'Lex':'lex'};
function visaCoOf(user){
  const o = (HR().visaCo || {})[user];                     // a manual correction wins
  if(o && DATA.companies[o]) return DATA.companies[o];
  const r = payrollRowFor(user) || {};
  const k = VISACO[r.visa];                                 // the visa on the payroll file
  if(k && DATA.companies[k]) return DATA.companies[k];
  if(r.paidBy){ const c = coByCode(r.paidBy); if(c) return c; }   // sponsored elsewhere
  return payCompanyOf(user);
}
// a visa held by a company outside the group - no letterhead of ours applies
const visaOutside = user => ((payrollRowFor(user)||{}).visa === 'Other company')
  && !((HR().visaCo || {})[user]);
const visaCode = user => visaCoOf(user).code;
const visaEnt = user => (DATA.entities||{})[visaCode(user)] || {legal:'\u2014', addr:[]};
// the department a person sits in, whether or not it bills clients
const orgDeptOf = n => (HR().orgDept || {})[n] || '';
function activeCo(){
  if(canAdmin(state.user) && state.company) return DATA.companies[state.company] || companyOf(state.user);
  return companyOf(state.user);
}
function applyTheme(){
  const c = activeCo();
  // One identity and one palette everywhere. The company you are in is named under
  // the mark, not signalled by a change of colour; only payslips and letters carry
  // a company's own letterhead.
  document.documentElement.setAttribute('data-company', c.key);
  ['railMark','loginMark'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.src = LOGOS.corplex.rail; el.alt = 'CorpLex One'; }
  });
  const rc = document.getElementById('railCo');
  if(rc){ rc.textContent = c.name; rc.classList.remove('hidden'); }
  document.title = 'CorpLex One';
}
const SALESTABS = ['dashboard','commission','invoices','team','leaderboard','company'];
const coOf = n => companyOf(n).key;
// the company a tab should answer to: the one an admin is looking at, else their own
const coInView = u => (canAdmin(u) && state.company) ? state.company : companyOf(u).key;
/* Does the company being looked at sell through the portal? Only one with its
   own sales figures does. The others have no bands, no referral rates and no
   consultants, and showing them CorpLex's would be presenting one company's
   commercial arrangements as another's. */
const salesHere = () => !!(DATA.companies[coInView(state.user)] || {}).sales;
const coNameInView = () => (DATA.companies[coInView(state.user)] || {}).name || 'This company';
const noSalesHere = what => `<div class="pad"><p class="note" style="margin:0">
  <b>${esc(coNameInView())} has no ${esc(what)} in the portal.</b>
  ${esc((DATA.companies.corplex || {}).name || 'CorpLex')}'s are deliberately not shown here, because
  they are not ${esc(coNameInView())}'s. Change the company at the top of the screen to see them, or
  send me ${esc(coNameInView())}'s and this page fills in.</p></div>`;
function inCoScope(n, u){
  if(canAdmin(u)) return coOf(n) === activeCo().key;
  return coOf(n) === coOf(u);
}
const coLabel = u => canAdmin(u) ? activeCo().name : companyOf(u).name;
function vNoSales(){
  const c = activeCo();
  return `<section class="panel"><div class="pad" style="text-align:center;padding:56px 24px">
    <h3 style="font-size:22px;margin-bottom:8px">${esc(c.name)} sales are not uploaded yet</h3>
    <p style="color:var(--ink2);max-width:56ch;margin:0 auto 18px">This page fills in as soon as the ${esc(c.name)} sales workbook is uploaded.
    Everything else &mdash; your attendance, leave, payslip, air ticket and payment requests &mdash; is working now.</p>
    <button class="btn" data-go="home" type="button">Back to home</button>
  </div></section>`;
}

/* ---------- HR: attendance, requests, availability ---------- */
const HR = () => DATA.hr;
const HDATE = () => HR().today;
const mins = t => t ? (+t.slice(0,2))*60 + (+t.slice(3,5)) : 0;
const hhmm = m => (m<0?'-':'') + String(Math.floor(Math.abs(m)/60)).padStart(2,'0') + ':' + String(Math.abs(m)%60).padStart(2,'0');
const dayLabel = ds => { const d=new Date(ds+'T00:00:00');
  return String(d.getDate()).padStart(2,'0') + ' ' + MONTHNAME[d.getMonth()]; };
const dayName = ds => new Date(ds+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'});
const dayLong = ds => new Date(ds+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long'});
const isWeekend = ds => [0,6].includes(new Date(ds+'T00:00:00').getDay());
const holOn = ds => (HR().holidays||[]).find(h=>h.d===ds);
const mgrName = u => (HR().managers||{})[u] || '';
const reportsTo = m => Object.keys(HR().managers||{}).filter(k=>HR().managers[k]===m);
const isMgr = u => reportsTo(u).length > 0;
const attOf = (u, ds) => HR().attendance.find(a=>a.who===u && a.d===ds);
const SHIFTS = () => HR().shifts || [];
const tracksAtt = u => !(HR().noAttendance||[]).includes(u);
const WHERE = () => window.__WHERE || {};
// A screen must never go blank because one settings block is missing. If an
// older mapper is in the browser's cache these come back undefined, and a
// thrown error looks exactly like a menu item that does nothing.
const OFFICE = () => HR().office || {ips:[], geo:{}, set:false};
const REG = () => HR().regular ||
  {max:2, graceDays:5, rows:[], mine:[], left:2, from:'', used:{}};
const officeRules = () => !!WHERE().rules_on;
const onOfficeNet = () => WHERE().ip_ok === true;

/* --- the nudge ---
 * Fifteen minutes past your own shift with nothing recorded, and the app
 * says so. Thirty, and it is your manager's to know. Weekends, public
 * holidays and approved leave are quiet; a day working from home is not,
 * because that day still wants a check-in.
 */
function nowMins(){ const d=new Date(); return d.getHours()*60 + d.getMinutes(); }
function nudgeFor(u){
  if(!tracksAtt(u) || !canCheckIn(u)) return null;
  const d = HDATE(), st = dayStatus(u, d);
  if(['Weekend','Holiday','Annual','Sick','Unpaid','Bereavement','Birthday',
      'Maternity','Paternity','Hajj','Umrah'].includes(st.k)) return null;
  const s = shiftOf(u), a = attOf(u, d), open = openSeg(u);
  const late  = HR().nudgeMin ?? 15, shout = HR().escalateMin ?? 30;
  const n = nowMins();
  if(!a || !a.segs.length){
    const over = n - (mins(s.start) + late);
    if(over < 0) return null;
    return {kind:'in', by: n - mins(s.start), escalated: n - mins(s.start) >= shout, shift:s};
  }
  if(open && n >= mins(s.end) + late)
    return {kind:'out', by: n - mins(s.end), escalated:false, shift:s};
  return null;
}
// Reports of mine who are past the shout line with nothing recorded. This is
// the in-app half of the escalation; the email half needs a sender.
function lateReports(u){
  return reportsTo(u).filter(n => {
    const g = nudgeFor(n); return g && g.kind === 'in' && g.escalated;
  }).map(n => ({who:n, by: nudgeFor(n).by}));
}
function nudgeBanner(u){
  const g = nudgeFor(u); if(!g) return '';
  const mLabel = m => m >= 60 ? Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m' : m+' minutes';
  return `<div class="nudge${g.escalated?' loud':''}">
    <span class="ndot"></span>
    <div><b>${g.kind==='in'?'You have not checked in':'You are still checked in'}</b>
      <span>${g.kind==='in'
        ? 'Your shift started at '+esc(g.shift.start)+', '+mLabel(g.by)+' ago.'
          + (g.escalated ? ' Your manager can see this.' : '')
        : 'Your shift ended at '+esc(g.shift.end)+', '+mLabel(g.by)+' ago. Check out to close the day.'}</span></div>
  </div>`;
}
const canCheckIn = u => tracksAtt(u) && (!canAdmin(u) || activeCo().key === companyOf(u).key);
function shiftOf(u){
  const id = (HR().assign||{})[u] || 'S2';
  return SHIFTS().find(s=>s.id===id) || SHIFTS()[1] || {id:'S2',label:'Shift 2',start:'09:00',end:'18:00'};
}
const shiftText = u => { const s=shiftOf(u); return `${s.label} · ${s.start}–${s.end}`; };
const shiftMins = u => { const s=shiftOf(u); return mins(s.end)-mins(s.start); };
function segMins(a, running){ if(!a||!a.segs) return 0;
  const now = mins(nowHM());
  return a.segs.reduce((s,g)=>{
    if(g.out) return s + (mins(g.out) - mins(g.in));
    if(!running || a.d !== HDATE()) return s;      // an open segment on a past day counts nothing
    return s + Math.max(0, now - mins(g.in));
  }, 0); }
function openSeg(u){ const a=attOf(u, HDATE()); if(!a) return null;
  return a.segs.find(g=>!g.out) || null; }
const REQTYPES = [
  {id:'WFH',          label:'Work from home',   wfh:true,  pay:'full'},
  {id:'Annual',       label:'Annual leave',     pool:true, pay:'full',
   note:'Comes off your 22-day annual balance.'},
  {id:'Bereavement',  label:'Bereavement leave', pay:'full', max:5,
   note:'5 days for a spouse; 3 for a parent, child, sibling, grandparent or grandchild. Does not touch your annual balance.'},
  {id:'Sick',         label:'Sick leave',       pay:'scale', max:90,
   note:'Up to 90 days a year — the first 15 at full pay, the next 30 at half pay, the last 45 unpaid. A medical certificate is needed.'},
  {id:'Unpaid',       label:'Unpaid leave',     pay:'none',
   note:'Not paid. Reduces your working days for the month and shows as LOP days on your payslip.'},
  {id:'Birthday',     label:'Birthday leave',   pay:'full', half:true, perYear:0.5, onBday:true,
   note:'Half a day, once a year, and only on your birthday itself. Does not touch your annual balance.'},
  {id:'Maternity',    label:'Maternity leave',  pay:'scale', max:60,
   need:{gender:'Female', marital:'Married'},
   note:'60 days — 45 at full pay then 15 at half pay. Does not touch your annual balance.'},
  {id:'Paternity',    label:'Paternity leave',  pay:'full', max:5,
   need:{gender:'Male', marital:'Married'},
   note:'5 working days, to be taken within six months of the birth.'},
  {id:'Study',        label:'Study leave',      pay:'full', max:10, minYears:2,
   note:'10 working days a year to sit examinations, for anyone with two years of service who is enrolled at an educational institution in the UAE. Does not touch your annual balance.'},
  {id:'Hajj',         label:'Hajj leave',       pay:'none', max:30,
   note:'Up to 30 days, unpaid, once during your service.'},
  {id:'Umrah',        label:'Umrah leave',      pool:true, pay:'full',
   note:'Comes off your annual leave balance, the same as annual leave.'}
];
const LEAVEONLY = () => REQTYPES.filter(t=>!t.wfh);
const MIDX = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const bdayOf = u => ((HR().birthdays||{})[u]||{}).d || '';
/* '16 Feb 1991' is what is on file; '16 Feb' is what a colleague sees. BDM is
   the one that goes on a screen unless the viewer is the person themselves or
   accounts, and BYEAR is how a screen asks whether the year is known yet. */
const BDM    = v => String(v || '').split(' ').slice(0, 2).join(' ');
const BYEAR  = v => (String(v || '').split(' ')[2] || '');
const bdayDM = u => BDM(bdayOf(u));
const bdayYr = u => BYEAR(bdayOf(u));
// '16 Feb 1991' <-> '1991-02-16', for the one box that sets it
const bdayToISO = v => { const p = String(v||'').split(' '); const mm = MIDX[p[1]];
  return (p[2] && mm) ? `${p[2]}-${String(mm).padStart(2,'0')}-${String(+p[0]).padStart(2,'0')}` : ''; };
const bdayFromISO = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v||'').trim());
  return m ? `${+m[3]} ${Object.keys(MIDX)[+m[2]-1]} ${m[1]}` : ''; };
function bdayDate(u){
  const dm = bdayOf(u); if(!dm) return '';
  const [d,m] = dm.split(' '); const mm = MIDX[m]; if(!mm) return '';
  const ty = +HDATE().slice(0,4);
  const iso = y => `${y}-${String(mm).padStart(2,'0')}-${String(+d).padStart(2,'0')}`;
  return iso(ty) >= HDATE() ? iso(ty) : iso(ty+1);
}
/* Sick leave, UAE Labour Law article 31: after probation, 90 days a leave year -
   the first 15 at full pay, the next 30 at half pay, the last 45 unpaid. The year
   runs from the joining date and resets on the anniversary. Nothing is paid during
   probation. The figures on file are the full-pay days left on 31 Aug 2026. */
function sickBal(u){
  const S = HR().sick || {}, P = HR().leavePolicy || {};
  const b = (HR().balances||{})[u] || {};
  const j = parseDoj(b.doj);
  // sick leave is statutory for employees, so being off the annual scheme does not
  // remove it - only the partners, who are on commission and not employed, are out
  if(!j || isPartner(u)) return {has:false};
  const t = HDATE(), ty = +t.slice(0,4);
  const at = y => dayIn(y, j.m, j.d);
  const yearStart = t >= at(ty) ? at(ty) : at(ty-1);
  const yearEnd = t >= at(ty) ? at(ty+1) : at(ty);
  // six months of service before any of it is paid
  const served = (ty - j.y)*12 + (+t.slice(5,7) - j.m) + (+t.slice(8,10) >= j.d ? 0 : -1);
  const probation = served < (P.probationMonths || 6);
  const FULL = S.fullDays || 15, HALF = S.halfDays || 30, UNPAID = S.unpaidDays || 45;
  const open = S.openingAt || '2026-08-31';
  // a new sick year that started after the opening date wipes the slate
  const fresh = yearStart > open;
  const opening = fresh ? FULL : ((S.balance||{})[u] === undefined ? FULL : (S.balance||{})[u]);
  const since = fresh ? subDay(yearStart) : open;
  const taken = HR().requests.filter(r=>r.who===u && r.status==='Approved' && r.type==='Sick' && r.from > since)
    .reduce((a,r)=>a+r.days, 0);
  const full = Math.round(Math.max(0, opening - taken)*100)/100;
  return {has:true, probation, full, opening, taken, FULL, HALF, UNPAID,
    usedFull: Math.round((FULL - full)*100)/100,
    yearStart, yearEnd, fresh, served};
}

/* Birthday leave has its own half day. It is credited on the birthday itself and,
   if it is not taken, it lapses - it never joins the annual balance. */
function bdayBal(u){
  const dm = bdayOf(u);
  if(!dm) return {has:false, credited:0, used:0, left:0};
  const [d,m] = dm.split(' '); const mm = MIDX[m];
  if(!mm) return {has:false, credited:0, used:0, left:0};
  const t = HDATE(), ty = +t.slice(0,4);
  const at = y => `${y}-${String(mm).padStart(2,'0')}-${String(+d).padStart(2,'0')}`;
  const thisYear = at(ty), next = thisYear >= t ? thisYear : at(ty+1);
  const half = (HR().leavePolicy||{}).birthdayDays || 0.5;
  const at_ = st => HR().requests.filter(r=>r.who===u && r.status===st
      && r.type==='Birthday' && r.from === at(ty)).reduce((a,r)=>a+r.days, 0);
  const credited = thisYear <= t ? half : 0;
  const taken = at_('Approved'), waiting = at_('Pending');
  const left = Math.round((credited - taken)*100)/100;
  // one request is enough - a pending one already claims it
  const open_ = Math.round((credited - taken - waiting)*100)/100;
  return {has:true, on:thisYear, next, credited, used:taken, pending:waiting, left, open:open_, half,
    today: thisYear === t,
    lapsed: credited > 0 && thisYear < t && left > 0};
}
const rType = id => REQTYPES.find(x=>x.id===id) || {id, label:id, pay:'full'};

/* The other kinds of leave, as a balance.
 *
 * Annual leave has leaveBal, sick leave has sickBal and the birthday half-day
 * has bdayBal, because each of those is a running account with its own rules.
 * The rest are simply an entitlement less what has been taken, and what
 * varies is who the entitlement is written for and what it is counted over —
 * a leave year for most, the whole of somebody's service for Hajj.
 *
 * A dash is never the same as a zero. Zero means the person has used it all;
 * a dash means the policy does not reach them, and the reason is on the
 * hover so that nobody has to guess which.
 */
const PERSERVICE = ['Hajj'];
function otherBal(u, id){
  const t = rType(id);
  const dash = why => ({txt:'\u2014', n:null, off:true, why});
  if(noLeave(u) || isPartner(u)) return dash('Not on the leave scheme');
  if(t.pool) return dash('Comes off the annual leave balance, so it has no separate one');

  if(t.need){
    const p = PROF(u) || {};
    if(!p.gender || !p.marital)
      return dash('Gender and marital status are not on this profile yet, so the portal cannot tell whether this applies');
    if((t.need.gender && p.gender !== t.need.gender) || (t.need.marital && p.marital !== t.need.marital))
      return dash('For ' + (t.need.gender === 'Female' ? 'married female' : 'married male') + ' employees only');
  }
  if(t.minYears){
    const y = yearsWith(u);
    if(!y) return dash('Joining date not on file, so service cannot be counted');
    if(y.years < t.minYears) return dash('After ' + t.minYears + ' years of service \u2014 ' + NM(u) + ' has ' + y.years);
  }

  if(id === 'Sick'){
    const S = sickBal(u);
    if(!S.has) return dash('Not on the leave scheme');
    if(S.probation) return {txt:'0', n:0, probation:true,
      why:'Still inside probation, and nothing is paid until it is served. ' + S.FULL
        + ' full-pay days open up after ' + ((HR().leavePolicy||{}).probationMonths || 6) + ' months.'};
    return {txt:String(S.full), n:S.full,
      why:S.full + ' of ' + S.FULL + ' full-pay days left this leave year' + (S.taken ? ' \u2014 ' + S.taken + ' taken' : '')
        + '. After those, ' + S.HALF + ' days at half pay and ' + S.UNPAID + ' unpaid.'};
  }

  const B = leaveBal(u);
  const perService = PERSERVICE.includes(id);
  const since = perService ? '' : (B.yearStart || '');
  const taken = HR().requests.filter(r => r.who === u && r.status === 'Approved'
      && r.type === id && (!since || r.to >= since)).reduce((a, r) => a + r.days, 0);
  const cap = id === 'Birthday' ? ((HR().leavePolicy||{}).birthdayDays || 0.5) : (t.max || 0);
  const left = Math.round((cap - taken) * 100) / 100;
  const over = cap === 0;
  return {txt:String(left), n:left, taken, cap, over,
    why: over
      ? (taken ? taken + ' unpaid day' + (taken===1?'':'s') + ' taken. There is no entitlement to draw on, so it shows below zero.'
               : 'No entitlement \u2014 unpaid leave is agreed case by case and counted after the fact.')
      : cap + ' day' + (cap===1?'':'s') + (perService ? ' once during service' : ' a leave year')
        + (taken ? ', ' + taken + ' taken' : ', none taken')
        + (perService || !B.yearEnd ? '' : '. Resets ' + dayLabel(B.yearEnd) + ' ' + B.yearEnd.slice(0,4) + '.')};
}
/* The columns. Work from home is not leave; annual leave has its own table
 * above; and anything else that spends the annual balance — Umrah — has no
 * balance of its own, so a column for it could only ever hold a dash. A
 * column that can never carry a number is not information, so it is said in
 * the caption instead of drawn twenty-five times. */
const OTHERKINDS = () => REQTYPES.filter(t => !t.wfh && !t.pool);
const usesPool = id => !!rType(id).pool;
const isUnpaid = id => rType(id).pay==='none';
function typeAllowed(u, t){
  if(t.onBday){
    if(!bdayOf(u)) return {ok:false, why:'accounts has not put your birthday on file yet \u2014 ask them'};
    const K = bdayBal(u);
    if(K.today && K.credited > 0 && K.open <= 0)
      return {ok:false, why: K.pending > 0 ? 'already requested, waiting on your manager' : 'already taken today'};
    if(!K.today) return {ok:false, why:'only on the day itself, ' + dayLabel(K.next)};
    if(isWeekend(K.on) || holOn(K.on)) return {ok:false, why:'your birthday is not a working day this year'};
  }
  if(t.minYears){
    const y = yearsWith(u);
    if(!y) return {ok:false, why:'your joining date is not on file yet'};
    if(y.years < t.minYears)
      return {ok:false, why:`after ${t.minYears} years of service`};
  }
  if(!t.need) return {ok:true};
  const p = PROF(u) || {};
  const miss = [];
  if(t.need.gender && p.gender !== t.need.gender) miss.push(t.need.gender.toLowerCase());
  if(t.need.marital && p.marital !== t.need.marital) miss.push(t.need.marital.toLowerCase());
  if(!p.gender || !p.marital) return {ok:false, why:'Add your gender and marital status on My profile first'};
  return miss.length ? {ok:false, why:`For ${t.need.gender==='Female'?'married female':'married male'} employees`} : {ok:true};
}
const halfLabel = h => h==='pm' ? 'second half' : h==='am' ? 'first half' : '';
const dayText = r => dayLabel(r.from) + (r.from!==r.to ? ' \u2013 ' + dayLabel(r.to) : (r.half ? ', ' + halfLabel(r.half) : ''));
const reqLabel = t => (REQTYPES.find(x=>x.id===t)||{label:t}).label;
function spanDays(f,t){ const out=[]; let a=new Date(f+'T00:00:00'), b=new Date(t+'T00:00:00');
  while(a<=b){ out.push(a.toISOString().slice(0,10)); a.setDate(a.getDate()+1); } return out; }
function reqOn(u, ds){
  return HR().requests.find(r=>r.who===u && r.status==='Approved' && r.from<=ds && ds<=r.to) || null;
}
function dayStatus(u, ds){
  if(holOn(ds)) return {k:'Holiday', label:holOn(ds).n};
  if(isWeekend(ds)) return {k:'Weekend', label:'Weekend'};
  if(ds > HDATE()){ const r=reqOn(u,ds); return r ? {k:r.type, label:reqLabel(r.type)} : {k:'Planned', label:''}; }
  const r = reqOn(u,ds);
  if(r && r.type!=='WFH') return {k:r.type, label:reqLabel(r.type)};
  const a = attOf(u, ds);
  if(a && a.kind==='WFH') return {k:'WFH', label:'Working from home'};
  if(a && a.segs.length) return {k:'Office', label:'In the office'};
  return {k:'Absent', label:'No record'};
}
const STCOL = {Office:'var(--c1)', WFH:'var(--c3)', Annual:'var(--accent)', Sick:'var(--bad)',
  Unpaid:'var(--warn)', Bereavement:'var(--ink3)', Birthday:'var(--c2)', Maternity:'var(--c3)',
  Paternity:'var(--c3)', Hajj:'var(--good)', Umrah:'var(--accent2)',
  Holiday:'var(--good)', Weekend:'var(--line)', Absent:'var(--bad)', Planned:'var(--line2)'};
const STSHORT = {WFH:'H', Annual:'A', Sick:'S', Unpaid:'U', Bereavement:'B', Birthday:'\u00bd',
  Maternity:'M', Paternity:'P', Hajj:'J', Umrah:'O', Holiday:'\u2605', Absent:'?'};
const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function parseDoj(s){
  if(!s) return null;
  const m = String(s).match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/);
  if(!m) return null;
  const mi = MONS.indexOf(m[2].slice(0,3));
  if(mi<0) return null;
  return {y:+m[3], m:mi+1, d:+m[1], iso:`${m[3]}-${String(mi+1).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`};
}
function workDaysBetween(f,t){
  if(!f||!t||t<f) return 0;
  return spanDays(f,t).filter(d=>!isWeekend(d) && !holOn(d)).length;
}

/* ---------- celebrations: birthdays and work anniversaries ---------- */
const CMARK = {
  cake:'<path d="M4 20.2h16v-6.1a2.9 2.9 0 0 0-2.9-2.9H6.9A2.9 2.9 0 0 0 4 14.1v6.1Z"/><path d="M4 16.4c1.6 0 1.6 1.5 3.2 1.5s1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5"/><path d="M12 11.2V7.9"/><path d="M12 4.2c1.1 1 1.5 1.9 0 3.3-1.5-1.4-1.1-2.3 0-3.3Z"/>',
  medal:'<circle cx="12" cy="14.8" r="5"/><path d="M12 12.7l.85 1.7 1.9.28-1.38 1.34.33 1.88L12 17.01l-1.7.89.33-1.88-1.38-1.34 1.9-.28.85-1.7Z"/><path d="M8.6 10.1 6.2 3.8h11.6l-2.4 6.3"/>',
  cal:'<rect x="3" y="5.2" width="18" height="15.6" rx="2.2"/><path d="M3 10.2h18M8 3.2v4M16 3.2v4"/><circle cx="12" cy="15.6" r="1.7"/>'
};
const cmark = (k, sz) => `<svg viewBox="0 0 24 24" width="${sz||24}" height="${sz||24}" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CMARK[k]}</svg>`;
const quietBday = u => !!((HR().profile||{})[u]||{}).quietBday;
// the year is yours and accounts', and nobody else's, on any screen
const SEESALL = u => u === state.user || canAdmin(state.user);
const dmOf = iso => iso.slice(5);
// everyone's birthday as a MM-DD, minus anyone who asked to be left out
function bdayMap(){
  const B = HR().birthdays||{}, out = {};
  Object.keys(B).forEach(n=>{
    if(!USERS.some(x=>x.name===n)) return;
    if(quietBday(n)) return;
    const [d,m] = String(B[n].d).split(' '); const mm = MIDX[m];
    if(mm) out[n] = `${String(mm).padStart(2,'0')}-${String(+d).padStart(2,'0')}`;
  });
  return out;
}
// what falls on one specific date
function celebsOn(iso){
  const key = dmOf(iso), bm = bdayMap();
  const bdays = Object.keys(bm).filter(n=>bm[n]===key)
    .map(n=>({n, dm:BDM((HR().birthdays[n]||{}).d)}));
  const annis = USERS.map(x=>x.name).map(n=>{
    const j = parseDoj(((HR().balances||{})[n]||{}).doj);
    if(!j) return null;
    const k = `${String(j.m).padStart(2,'0')}-${String(j.d).padStart(2,'0')}`;
    if(k !== key) return null;
    const years = +iso.slice(0,4) - j.y;
    return years>0 ? {n, years, doj:((HR().balances||{})[n]||{}).doj} : null;
  }).filter(Boolean);
  return {bdays, annis, any: bdays.length + annis.length};
}
// the next N days, each with anything on it
function celebsWithin(fromISO, days){
  const out = [];
  for(let i=0;i<=days;i++){
    const d = new Date(fromISO+'T00:00:00'); d.setDate(d.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const c = celebsOn(iso);
    if(c.any) out.push(Object.assign({d:iso, in:i}, c));
  }
  return out;
}
/* Annual leave, as the payroll system actually runs it.
   1.84 days are credited on the joining day of every month, starting on the joining
   date itself - not on completion of the month. The balances Avin typed in are the
   balance as it stood on 31 Aug 2026, with every earlier accrual and every day taken
   already inside them, so the portal only adds what has happened since. */
const OPENAT = () => (HR().leavePolicy || {}).openingAt || '2026-08-31';

/* ---------- one way to change anything in the console ----------
 *
 * A table declares itself here: how to read a cell's value now, what to call
 * that cell in the list of changes, how to print a value so a person can
 * check it, and how to write the whole draft at once. Everything else — the
 * Edit button, the draft, the count, the confirmation, the undo — is shared,
 * which is the point: a safeguard that has to be remembered per screen is a
 * safeguard that will be forgotten on one.
 *
 * A draft key is whatever the table wants; where a row has more than one
 * editable cell the key carries which, as 's|Rana Amine' or 'Rana|passport'.
 */
const EDTABLES = {
  carry: {
    title: 'Carried-forward leave',
    now:  k => { const b = (HR().balances||{})[k] || {}; return b.carriedSet ? String(b.carried) : ''; },
    name: k => NM(k) + ' \u2014 carried forward',
    fmt:  v => String(v).trim() === '' ? 'not recorded'
             : (Math.round((+v || 0) * 100) / 100) + (Math.abs(+v) === 1 ? ' day' : ' days'),
    /* Blank means "nothing recorded" and is not the same as nought, so the
       two are only equal when both are blank; otherwise compare the numbers,
       so 12 and 12.0 are one figure rather than a change. */
    same: (a, b) => (String(a).trim() === '') === (String(b).trim() === '')
            && (String(a).trim() === '' || (+a || 0) === (+b || 0)),
    save: d => window.__db.setCarried(d, OPENAT())
  },
  shifts: {
    title: 'Shifts and reporting lines',
    now:  k => k[0] === 's' ? (shiftOf(k.slice(2)) || {}).id || '' : (mgrName(k.slice(2)) || ''),
    name: k => NM(k.slice(2)) + (k[0] === 's' ? ' \u2014 shift' : ' \u2014 reports to'),
    fmt:  (v, k) => k && k[0] === 'm'
            ? (v ? NM(v) : 'nobody')
            : (() => { const s = SHIFTS().find(x => x.id === v);
                       return s ? s.label + ' \u00b7 ' + s.start + '\u2013' + s.end : 'none'; })(),
    save: d => window.__db.saveShiftLines(d)
  },
  hols: {
    title: 'Public holidays',
    now:  k => { const h = (HR().holidays||[]).find(x => x.d === k.slice(2)) || {};
                 return k[0] === 'd' ? (h.d || '') : k[0] === 'n' ? (h.n || '')
                      : k[0] === 'k' ? (h.fixed ? '1' : '0') : ''; },
    name: k => { const h = (HR().holidays||[]).find(x => x.d === k.slice(2)) || {};
                 const who = h.n || k.slice(2);
                 return who + (k[0] === 'd' ? ' \u2014 date' : k[0] === 'n' ? ' \u2014 name'
                             : k[0] === 'k' ? ' \u2014 fixed or moving' : ''); },
    fmt:  (v, k) => k && k[0] === 'x' ? 'removed from the calendar'
            : k && k[0] === 'k' ? (v === '1' ? 'a fixed date' : 'moves with the moon')
            : k && k[0] === 'd' ? (v ? dayLabel(v) + ' ' + String(v).slice(0,4) : '\u2014')
            : String(v || '\u2014'),
    save: d => window.__db.saveHolidays(d, HR().holidays || [])
  },
  /* The grid holds a number and an expiry date for each of four documents,
     and it is one table on the screen, so it is one table here: one Edit, one
     list of what is about to change, one Save. Two Edit buttons on one grid
     would mean a number and its own expiry could not be corrected in the same
     sitting, which is exactly how they arrive — off one card.

     A key is 'Rana Amine|passport|no' or 'Rana Amine|passport|exp'. Dropping
     the last segment gives 'Rana Amine|passport', which is the key both
     writers already take, so the split at the end is the whole of it.

     The date of birth is the third thing this table writes, under the key
     'Rana Amine|dob|d'. It used to be a table of its own further down the
     page, which meant correcting somebody's passport and their birth date —
     both read off the same passport, in the same sitting — was two Edits, two
     confirmations and two Saves. Avin's sketch of this screen puts the date of
     birth in the second column, so that is where it is, and it goes in on the
     same Save as everything else in the row. */
  basis: {
    title: 'Who is on payroll',
    now:  k => BASISOF(k),
    name: k => NM(k) + ' \u2014 paid',
    fmt:  v => BASIS[v] || v,
    save: d => window.__db.setPayrollBasis(d)
  },
  bdate: {
    title: 'Dates of birth',
    now:  k => bdayToISO(bdayOf(k)),
    name: k => NM(k) + ' \u2014 date of birth',
    fmt:  v => v ? dayLabel(v) + ' ' + String(v).slice(0,4) : 'not on file',
    save: d => window.__db.setBirthDates(d)
  },
  docs: {
    title: 'Staff documents',
    now:  k => { const i = k.lastIndexOf('|'), who = k.slice(0, i), rest = k.slice(i + 1);
                 const j = who.lastIndexOf('|'), n = who.slice(0, j), kind = who.slice(j + 1);
                 return kind === 'dob' ? (bdayToISO(bdayOf(n)) || '')
                      : rest === 'no'  ? REFOF(n, kind)
                      : (((HR().docs||{})[n] || {})[kind]) || ''; },
    name: k => { const i = k.lastIndexOf('|'), who = k.slice(0, i), rest = k.slice(i + 1);
                 const j = who.lastIndexOf('|'), n = who.slice(0, j), kind = who.slice(j + 1);
                 if(kind === 'dob') return NM(n) + ' \u2014 date of birth';
                 const t = DOCTYPES().find(x => x.k === kind);
                 return NM(n) + ' \u2014 ' + ((t && t.label) || kind)
                      + (rest === 'no' ? ' number' : ' expiry'); },
    /* A number is shown whole here, not masked: this is the one moment you are
       being asked to check that it is right. */
    fmt:  (v, k) => { const rest = k ? k.slice(k.lastIndexOf('|') + 1) : '';
      return (rest === 'exp' || rest === 'd')
        ? (v ? dayLabel(v) + ' ' + String(v).slice(0,4) : 'not on file')
        : (String(v || '').trim() || 'not on file'); },
    save: async d => {
      const nos = {}, exp = {}, dob = {};
      Object.keys(d).forEach(k => { const i = k.lastIndexOf('|'), rest = k.slice(i + 1);
        const who = k.slice(0, i);
        if(rest === 'd') dob[who.slice(0, who.lastIndexOf('|'))] = d[k];
        else (rest === 'no' ? nos : exp)[who] = d[k]; });
      /* Numbers first. If they fail the dates are not attempted, so what the
         confirmation listed and what was written cannot drift apart silently
         \u2014 the error names the half that did not go in. */
      if(Object.keys(nos).length && !await window.__db.saveDocRefs(nos))   return null;
      if(Object.keys(exp).length && !await window.__db.saveDocDates(exp))  return null;
      if(Object.keys(dob).length && !await window.__db.setBirthDates(dob)) return null;
      return true;
    }
  },
  payline: {
    title: 'Payroll figures',
    /* A key is '<line id>|<database field>'. The column list already pairs the
       field with the name the screen uses for it and the words on the heading,
       so the confirmation reads 'Rana Amine \u2014 Advance' rather than
       'a1b2c3|advance'. */
    now:  k => { const i = k.lastIndexOf('|'), id = k.slice(0,i), f = k.slice(i+1);
                 const c = PAYCOLS.find(x => x.f === f) || {k:f};
                 for(const run of (DATA.payroll.runs||[]))
                   for(const r of run.rows) if(r.lineId === id) return String(+r[c.k] || 0);
                 return '0'; },
    name: k => { const i = k.lastIndexOf('|'), id = k.slice(0,i), f = k.slice(i+1);
                 const c = PAYCOLS.find(x => x.f === f) || {label:f};
                 let who = id;
                 for(const run of (DATA.payroll.runs||[]))
                   for(const r of run.rows) if(r.lineId === id) who = NM(r.portalName || r.name);
                 return who + ' \u2014 ' + (c.label || f); },
    fmt:  (v, k) => (k && k.slice(k.lastIndexOf('|') + 1) === 'days')
            ? (+v || 0) + ((+v || 0) === 1 ? ' day' : ' days')
            : money(+v || 0, 2),
    // an empty box and a nought are the same figure
    same: (a, b) => (+a || 0) === (+b || 0),
    save: d => window.__db.savePayLines(d)
  }
};

const EDITING = id => !!(state.edit && state.edit.table === id);
const EDANY   = () => !!state.edit;
const edNow   = (id, k) => { const t = EDTABLES[id]; return t ? t.now(k) : ''; };
function edVal(id, k){
  if(!EDITING(id)) return edNow(id, k);
  return (k in state.edit.draft) ? state.edit.draft[k] : edNow(id, k);
}
/* A cell is only a change if it differs from what is there, and "differs" is
   not always string equality. An empty money box and a nought are the same
   figure: the box shows blank where the value is zero, so comparing the two
   as text made every untouched cell on the payroll a change — three hundred
   and sixty-eight of them, all reading 0.00 to 0.00. A table that says you
   are about to change nothing, three hundred times, teaches you to press Yes
   without reading, which is the exact habit this whole mechanism exists to
   prevent. */
function edSame(id, a, b){
  const t = EDTABLES[id];
  return t && t.same ? t.same(a, b) : String(a) === String(b);
}
function edSet(id, k, v){
  if(!EDITING(id)) return;
  if(edSame(id, v, edNow(id, k))) delete state.edit.draft[k];
  else state.edit.draft[k] = v;
}
function edList(id){
  if(!EDITING(id)) return [];
  const t = EDTABLES[id];
  return Object.keys(state.edit.draft).sort().map(k => ({
    key: k, what: t.name(k),
    was: t.fmt(edNow(id, k), k), now: t.fmt(state.edit.draft[k], k)}));
}
const edPhrase = n => n ? n + (n === 1 ? ' change not saved yet' : ' changes not saved yet')
                        : 'nothing changed yet';
/* The buttons that turn a table from something you read into something you
   are changing. Only one table at a time, so an unsaved draft on one screen
   cannot be forgotten while a second is being edited on another. */
function edBar(id){
  if(!EDTABLES[id]) return '';
  if(!EDITING(id)) return `<button class="btn ghost edbtn" data-edon="${esc(id)}" type="button"${
    EDANY() ? ' disabled title="Finish the other table first"' : ''}>Edit</button>`;
  const n = edList(id).length;
  return `<span class="edmsg${n ? ' on' : ''}">${edPhrase(n)}</span>
    <button class="btn edbtn" data-edsave="${esc(id)}" type="button"${n ? '' : ' disabled'}>Save${n ? ' ' + n : ''}</button>
    <button class="btn ghost edbtn" data-edoff="1" type="button">Cancel</button>`;
}
/* What you are about to do, in words, before it happens. This is the whole
   point of the exercise: a wrong key press is caught here, where the old
   value is printed beside the new one, and not a month later in a balance
   nobody can explain. */
function edConfirm(id){
  if(!EDITING(id) || !state.edit.confirm) return '';
  const rows = edList(id);
  return `<div class="edconf">
    <h4>About to change ${rows.length} ${rows.length === 1 ? 'thing' : 'things'}</h4>
    <div class="tw"><table class="edtab">
      <thead><tr><th>What</th><th>From</th><th>To</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.what)}</td>
        <td class="edwas">${esc(r.was)}</td><td class="ednow">${esc(r.now)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="edconfb">
      <button class="btn" id="edGo" type="button"${state.edit.busy ? ' disabled' : ''}>${
        state.edit.busy ? 'Saving\u2026' : 'Yes, save ' + (rows.length === 1 ? 'it' : 'them')}</button>
      <button class="btn ghost" id="edBack" type="button"${state.edit.busy ? ' disabled' : ''}>Back</button>
      <span>Nothing has been written yet. <b>Back</b> returns you to the table with your changes still on it.</span>
    </div>
  </div>`;
}
function edSaved(id){
  const s = state.edSaved;
  if(!s || s.table !== id) return '';
  return `<div class="edok"><b>Saved.</b> ${s.n} ${s.n === 1 ? 'change' : 'changes'} written.</div>`;
}
/* A cell, in whichever of the two states the table is in. */
function edCell(id, key, control, show){
  return EDITING(id) ? control(edVal(id, key)) : show(edNow(id, key));
}
const edAttr = (id, key) => ` data-edt="${esc(id)}" data-edk="${esc(key)}"`;
const dayIn = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(Math.min(d, new Date(y, m, 0).getDate())).padStart(2,'0')}`;
// every credit date strictly after `after` and on or before `to`
function accrualDates(j, after, to){
  if(!j) return [];
  const join = dayIn(j.y, j.m, j.d), out = [];
  let y = +after.slice(0,4), m = +after.slice(5,7);
  const ey = +to.slice(0,4), em = +to.slice(5,7);
  while(y < ey || (y === ey && m <= em)){
    const iso = dayIn(y, m, j.d);
    if(iso > after && iso <= to && iso >= join) out.push(iso);
    if(++m > 12){ m = 1; y++; }
  }
  return out;
}
// the leave year runs from the joining anniversary; this is the one covering `iso`
function leaveYearStart(j, iso){
  if(!j) return '';
  const y = +iso.slice(0,4);
  return (iso >= dayIn(y, j.m, j.d)) ? dayIn(y, j.m, j.d) : dayIn(y-1, j.m, j.d);
}
const subDay = iso => { const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };
const addDay = iso => { const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); };
function nextAccrual(u){
  const b = (HR().balances||{})[u]; const j = b && parseDoj(b.doj);
  if(!j) return '';
  const t = HDATE();
  let y = +t.slice(0,4), m = +t.slice(5,7);
  for(let i = 0; i < 14; i++){
    const iso = dayIn(y, m, j.d);
    if(iso > t) return iso;
    if(++m > 12){ m = 1; y++; }
  }
  return '';
}
function leaveBal(u){
  const P = HR().leavePolicy, b = (HR().balances||{})[u] || {carried:0, carriedSet:false, doj:''};
  const j = parseDoj(b.doj);
  const today = HDATE(), ty = +today.slice(0,4), tm = +today.slice(5,7), td = +today.slice(8,10);
  let yearStart, yearEnd, yearNo = null;
  if(j){
    yearNo = ty - j.y + ((tm > j.m || (tm===j.m && td>=j.d)) ? 1 : 0);
    const sy = ty - ((tm > j.m || (tm===j.m && td>=j.d)) ? 0 : 1);
    yearStart = `${sy}-${String(j.m).padStart(2,'0')}-${String(j.d).padStart(2,'0')}`;
    yearEnd = `${sy+1}-${String(j.m).padStart(2,'0')}-${String(j.d).padStart(2,'0')}`;
  } else {
    return {carried: b.carried||0, carriedSet:!!b.carriedSet, accrued:0, taken:0, booked:
      HR().requests.filter(r=>r.who===u && r.status==='Pending').reduce((s,r)=>s+r.days,0),
      pendDays:0, monthsIn:0, credits:[], openAt:OPENAT(), next:'',
      yearNo:null, yearStart:'', yearEnd:'', doj:'', left: b.carried||0, noDoj:true, policy:P};
  }
  /* Two live buckets. Days earned in a leave year may be used until the end of the
     NEXT leave year, oldest first; whatever is left of the older bucket is wiped at
     the year boundary. The balances on file are one number, so they are split at the
     opening date: what this leave year has credited so far is the new bucket, the
     rest is last year's remainder, due to expire at the next anniversary. */
  const open = OPENAT(), rate = P.accrualPerMonth;
  const openYS = leaveYearStart(j, open);
  const openThisYear = accrualDates(j, subDay(openYS), open).length * rate;
  let cur = Math.round(Math.min(openThisYear, Math.max(b.carried||0, 0)) * 100)/100;
  let old_ = Math.round(((b.carried||0) - cur) * 100)/100;
  let expired = 0;

  const ORD = {roll:0, credit:1, take:2}, ev = [];
  accrualDates(j, open, today).forEach(d=>ev.push({d, k:'credit'}));
  for(let y = +open.slice(0,4); y <= +today.slice(0,4); y++){
    const a = dayIn(y, j.m, j.d);
    if(a > open && a <= today) ev.push({d:a, k:'roll'});
  }
  /* Days already lived come off the balance; days approved but still in the future
     are committed rather than spent, and are shown separately - otherwise someone
     with a month booked in October looks overdrawn today, before two more months of
     accrual have landed. A booking that began on or before the opening date is
     already inside the opening figure up to that day. */
  let ahead = 0;
  HR().requests.filter(r=>r.who===u && r.status==='Approved' && POOLED(r.type) && r.to > open)
    .forEach(r=>{
      const start = r.from > open ? r.from : addDay(open);
      if(start > today){ ahead += r.days; return; }                 // wholly ahead
      const past = workDaysBetween(start, r.to < today ? r.to : today);
      const whole = r.from > open ? r.days : workDaysBetween(start, r.to);
      if(past > 0) ev.push({d:start, k:'take', n:past});
      ahead += Math.max(0, Math.round((whole - past)*100)/100);     // the rest still to come
    });
  ev.sort((a,c)=> a.d.localeCompare(c.d) || ORD[a.k]-ORD[c.k]);

  let credited = 0, taken = 0;
  ev.forEach(e=>{
    if(e.k === 'roll'){ if(old_ > 0) expired += old_; old_ = Math.min(old_, 0) + cur; cur = 0; }
    else if(e.k === 'credit'){ cur = Math.round((cur + rate)*100)/100; credited += rate; }
    else {
      taken += e.n;
      let need = e.n;
      const fromOld = Math.min(Math.max(old_, 0), need);
      old_ = Math.round((old_ - fromOld)*100)/100; need -= fromOld;
      cur = Math.round((cur - need)*100)/100;
    }
  });
  const monthsIn = Math.round(credited / rate);
  const accrued = Math.round(credited * 100)/100;
  expired = Math.round(expired * 100)/100;
  const ty2 = +today.slice(0,4);
  const expiresOn = dayIn(ty2 + (today >= dayIn(ty2, j.m, j.d) ? 1 : 0), j.m, j.d);
  const pendDays = HR().requests.filter(r=>r.who===u && r.status==='Pending' && r.type==='Annual')
    .reduce((s,r)=>s+r.days,0);
  const booked = HR().requests.filter(r=>r.who===u && r.status==='Pending').reduce((s,r)=>s+r.days,0);
  const carried = b.carried || 0;   // the balance on 31 Aug 2026, cap does not apply
  const older = Math.round(old_*100)/100, thisYear = Math.round(cur*100)/100;
  const left = Math.round((older + thisYear)*100)/100;
  ahead = Math.round(ahead*100)/100;
  // what will still accrue between now and the last booked day
  const lastBooked = HR().requests.filter(r=>r.who===u && r.status==='Approved' && POOLED(r.type) && r.to > today)
    .reduce((m,r)=>r.to > m ? r.to : m, '');
  const toCome = lastBooked ? accrualDates(j, today, lastBooked).length * rate : 0;
  return {carried, carriedSet:!!b.carriedSet, accrued, taken, booked, pendDays, monthsIn,
    ahead, toCome: Math.round(toCome*100)/100,
    after: Math.round((left - ahead + toCome)*100)/100,
    openAt:open, next:nextAccrual(u), older, thisYear, expired,
    expiring: Math.max(older, 0), expiresOn,
    yearNo, yearStart, yearEnd, doj:b.doj, left, policy:P};
}
function monthDays(ym){
  const [y,m]=ym.split('-').map(Number); const out=[]; const last=new Date(y,m,0).getDate();
  for(let i=1;i<=last;i++) out.push(`${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`);
  return out;
}
function monthSummary(u, ym){
  const days = monthDays(ym).filter(d=>d<=HDATE());
  let office=0, wfh=0, annual=0, sick=0, unpaid=0, absent=0, worked=0, late=0, workdays=0;
  const G = mins(shiftOf(u).start) + HR().hours.grace;
  days.forEach(ds=>{
    const s = dayStatus(u, ds);
    if(s.k==='Weekend'||s.k==='Holiday') return;
    workdays++;
    if(s.k==='Office'){ office++; const a=attOf(u,ds); worked+=segMins(a);
      if(a && a.segs[0] && a.segs[0].loc==='Office' && mins(a.segs[0].in)>G) late++; }
    else if(s.k==='WFH'){ wfh++; worked+=segMins(attOf(u,ds)); }
    else if(s.k==='Annual') annual++;
    else if(s.k==='Sick') sick++;
    else if(s.k==='Unpaid') unpaid++;
    else absent++;
  });
  const present = office+wfh;
  const counted = days.filter(ds=>{const a2=attOf(u,ds); return a2 && segMins(a2)>0;}).length;
  return {office, wfh, annual, sick, unpaid, absent, present, workdays, worked, late,
    avg: counted ? Math.round(worked/counted) : 0,
    payDays: Math.max(0, 30 - unpaid - absent)};
}

/* ---------- HR views ---------- */
function attTabs(){
  const T = [['me','My attendance'], ['reg','Regularization']];
  const cur = T.some(x => x[0] === state.attTab) ? state.attTab : 'me';
  const wait = REG().mine.filter(r => r.status === 'Pending').length;
  return {cur, bar: `<div class="seg segbig" id="attSeg">${T.map(([v, l]) =>
    `<button data-att="${v}" aria-pressed="${cur === v}" type="button">${esc(l)}${
      v === 'reg' && wait ? ` <span class="pill warn" style="margin-left:6px;padding:0 7px">${wait}</span>` : ''
    }</button>`).join('')}</div>`};
}

function vAttend(){
  const u = state.user, today = HDATE();
  if(!tracksAtt(u)) return `<section class="panel"><div class="pad" style="text-align:center;padding:52px 24px">
    <h3 style="font-size:20px;margin-bottom:8px">You are not on the attendance list</h3>
    <p style="color:var(--ink2);max-width:52ch;margin:0 auto">Nothing is recorded for you. Everyone else's attendance is on <b>Who is in</b>.</p></div></section>`;
  const ym = state.attMonth || today.slice(0,7);
  const a = attOf(u, today), open = openSeg(u);
  const st = dayStatus(u, today);
  const S = monthSummary(u, ym);
  const days = monthDays(ym).filter(d=>d<=today).reverse();
  const onNet = onOfficeNet();
  const H = HR();

  /* Everything closed today, and the day's target. A day is nine hours; the
   * clock shows the whole of it and the line under it says what is left. */
  const closedMins = (a && a.segs ? a.segs : []).filter(g => g.out)
    .reduce((s, g) => s + (mins(g.out) - mins(g.in)), 0);
  const doneToday = segMins(a, true);
  const shortBy = Math.max(0, FULLDAY() - doneToday);
  const leftLine = shortBy
    ? hhmm(shortBy) + ' left of the ' + hhmm(FULLDAY()) + ' day'
    : 'the full ' + hhmm(FULLDAY()) + ' is in';

  const segRow = g => `<tr><td class="n">${esc(g.in)}</td><td class="n">${g.out?esc(g.out):'<span class="pill warn"><span class="dt"></span>open</span>'}</td>
    <td>${esc(g.loc)}${whereMark(g)}</td><td class="n r">${g.out?hhmm(mins(g.out)-mins(g.in)):'—'}</td>
    <td style="color:var(--ink2);font-size:12.5px">${esc(g.note||'')}</td></tr>`;

  const AT = attTabs();
  /* The list is on both halves on purpose. On Regularization it is the point
     of the page; under the form on My attendance it is the answer to "did
     that go anywhere", four inches from where the question was asked. */
  if(AT.cur === 'reg') return `
  ${nudgeBanner(u)}
  ${AT.bar}
  ${regularForm(u) || `<section class="panel"><div class="pad" style="padding:40px 24px;color:var(--ink2)">
    <b style="display:block;font-size:16px;margin-bottom:6px;color:var(--ink)">Nothing to fix</b>
    Every working day since ${esc(dayLabel(REG().from || today))} has a check-in and a check-out.
    If you spot one that does not, it will appear here.</div></section>`}
  ${regularList(u)}`;

  return `
  ${nudgeBanner(u)}
  ${AT.bar}
  <div class="strip">
    <div class="stat"><span class="k">Today &middot; ${esc(dayName(today))} ${esc(dayLabel(today))}</span>
      <span class="v" style="font-size:19px;font-family:'IBM Plex Sans',sans-serif">${open?'<span class="pill good"><span class="dt"></span>Checked in</span>':(a&&a.segs.length?'<span class="pill mute">Checked out</span>':'<span class="pill warn"><span class="dt"></span>Not checked in</span>')}</span>
      <span class="n">${a&&a.segs.length?hhmm(segMins(a))+' recorded so far':'no time recorded yet'}</span></div>
    <div class="stat"><span class="k">Days present &middot; ${esc(MONTHNAME[+ym.slice(5)-1])}</span><span class="v">${S.present}</span>
      <span class="n">of ${S.workdays} working days &middot; ${S.wfh} from home</span></div>
    <div class="stat"><span class="k">Average day</span><span class="v" style="font-size:23px">${hhmm(S.avg)}</span>
      <span class="n">${hhmm(S.worked)} in total this month</span></div>
    <div class="stat"><span class="k">Late arrivals</span><span class="v" style="color:var(--${S.late?'warn':'good'})">${S.late}</span>
      <span class="n">after ${esc(shiftOf(u).start)} plus ${H.hours.grace} minutes</span></div>
  </div>

  <div class="grid g2 gtop attpair">
  <section class="panel">
    <header><h3>Check in and out</h3>
      <span class="pill ${onNet?'good':'mute'}">${!officeRules()?'Office network not set yet'
        :onNet?'<span class="dt"></span>On the office network':'Off the office network'}</span>
      <span class="pill mute">${esc(shiftText(u))}</span>
      <span class="hint">${esc(H.week)}</span></header>
    <div class="pad">
      ${st.k==='Holiday'||st.k==='Weekend'
        ? `<p style="margin:0;color:var(--ink2)">Today is ${esc(st.label)} &mdash; nothing to record.</p>`
        : !canCheckIn(u) ? `<p style="margin:0;color:var(--ink2);font-size:14.5px">You check in and out under <b>${esc(companyOf(u).name)}</b>. Switch the company at the top to record your own day.</p>`
        : `<div class="ciwrap">
        <div class="cibox">
          <span class="cik">${open?'On the clock':'Not checked in'}</span>
          ${open ? ciClock(open, closedMins) : '<b>—</b>'}
          <span class="cin">${open
            ? esc(open.loc) + ' · since ' + esc(open.in)
              + (closedMins ? ' · ' + hhmm(closedMins) + ' earlier today' : '')
            : (doneToday ? hhmm(doneToday) + ' recorded today · ' + leftLine
               : 'press a button below to start the day')}</span>
          <span class="cin" style="margin-top:2px">${open ? leftLine : ''}</span>
        </div>
        <div class="cibtns">
          ${open
            ? `<button class="btn" id="ciOut" type="button">Check out</button>
               <span class="cihint">Leaving the ${esc(open.loc.toLowerCase())}? Check out, then check in again when you arrive somewhere else.</span>`
            : `<button class="btn" data-ci="Office" type="button">Check in &mdash; office</button>
               <button class="btn ghost" data-ci="Client site" type="button">Check in &mdash; off-site</button>
               <button class="btn ghost" data-ci="Home" type="button">Check in &mdash; home</button>`}
        </div>
      </div>
      ${state.ciSaid ? `<div class="ciwarn">
        <b>Recorded as off-site.</b> We could not confirm you were at the office \u2014
        ${state.ciSaid.ip_ok===false?'you are not on the office network':'the office network did not answer'}${
          state.ciSaid.distance_m!=null?' and your phone put you '+money(state.ciSaid.distance_m,0)+'\u2009m away':
          ', and your device did not share where it is'}.
        Say where you are and it goes on the record.
        <div class="ciwrow"><input id="ciNote" type="text" maxlength="120"
          placeholder="At the Al Barsha client, back after lunch" value="${esc(state.ciNote||'')}">
          <button class="btn" id="ciNoteGo" type="button">Save</button></div></div>` : ''}
      <p class="note" style="margin-top:16px">An office check-in is confirmed by the office network or by where your device says you are. Neither is a barrier: if we cannot confirm it the day is still recorded, as off-site, and you are asked where you were. Going straight to a client is fine &mdash; check in as <b>off-site</b>, then check out and check in again as <b>office</b> when you arrive. Every segment of the day is kept.</p>`}
    </div>
    ${a && a.segs.length ? `<div class="tw"><table>
      <thead><tr><th>In</th><th>Out</th><th>Where</th><th class="r">Hours</th><th>Note</th></tr></thead>
      <tbody>${a.segs.map(segRow).join('')}
        <tr class="tot"><td>Today</td><td></td><td>${a.segs.length} segment${a.segs.length===1?'':'s'}</td>
          <td class="n r">${hhmm(segMins(a))}</td><td></td></tr>
      </tbody></table></div>`:''}
  </section>

  ${regularForm(u) || '<div></div>'}
  </div>

  ${REG().mine.length ? regularList(u) : ''}

  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>${esc(MONTHNAME[+ym.slice(5)-1])} ${ym.slice(0,4)}</h3>
      <div class="seg" id="attMonthSeg" style="margin-left:auto">
        ${['2026-08','2026-09'].map(m=>`<button data-am="${m}" aria-pressed="${ym===m}" type="button">${MONTHNAME[+m.slice(5)-1]}</button>`).join('')}
      </div></header>
    <div class="tw"><table class="invtable">
      <thead><tr><th>Date</th><th>Day</th><th>Status</th><th class="n">First in</th><th class="n">Last out</th>
        <th class="r">Hours</th><th>Where</th></tr></thead>
      <tbody>${days.map(ds=>{
        const s = dayStatus(u, ds), aa = attOf(u, ds);
        const first = aa && aa.segs.length ? aa.segs[0].in : '';
        const last = aa && aa.segs.length ? (aa.segs[aa.segs.length-1].out || '') : '';
        const dim = ['Weekend','Holiday'].includes(s.k);
        return `<tr${dim?' style="color:var(--ink3)"':''}>
          <td class="n nw">${esc(dayLabel(ds))}</td><td class="nw">${esc(dayName(ds))}</td>
          <td class="nw"><span class="dpill" style="--dc:${STCOL[s.k]||'var(--line)'}">${esc(s.k==='Holiday'?'Holiday':s.label||s.k)}</span></td>
          <td class="n">${esc(first)||'—'}</td><td class="n">${esc(last)||'—'}</td>
          <td class="n r netcol">${aa&&segMins(aa)?hhmm(segMins(aa)):'—'}</td>
          <td style="color:var(--ink2);font-size:12.5px">${aa&&aa.segs.length?esc(aa.segs.map(g=>g.loc).join(' → ')):''}</td></tr>`;
      }).join('')}
        <tr class="tot"><td>${S.workdays}</td><td>working days</td>
          <td>${S.present} present &middot; ${S.annual+S.sick+S.unpaid} on leave${S.absent?' &middot; '+S.absent+' unexplained':''}</td>
          <td></td><td></td><td class="n r netcol">${hhmm(S.worked)}</td><td></td></tr>
      </tbody></table></div>
    <p class="cap">${HR().sample?'<b>Sample records.</b> The portal holds no attendance history until check-in goes live &mdash; these days are here to show the shape of the report. ':''}Only you, your manager and accounts can see your attendance.</p>
  </section>`;
}

function leaveTabs(){
  const T = [['leave','Leave'], ['wfh','Work from home'], ['policy','Leave policy']];
  const cur = T.some(x => x[0] === state.leaveTab) ? state.leaveTab : 'leave';
  return {cur, bar: `<div class="seg segbig" id="leaveSeg">${T.map(([v, l]) =>
    `<button data-lv="${v}" aria-pressed="${cur === v}" type="button">${esc(l)}</button>`).join('')}</div>`};
}

/* The work-from-home tab. Two columns: apply on the left, what you have asked
 * for before on the right. Nothing about annual leave appears here at all —
 * a day at home does not come off a balance and never did. */
function vWfhTab(u, B, f, mine, inbox){
  const wfh = mine.filter(r => r.type === 'WFH');
  const wait = inbox.filter(r => r.type === 'WFH');
  const done = wfh.filter(r => r.status === 'Approved');
  const strip = `<div class="strip">
    <div class="stat"><span class="k">Days from home</span><span class="v">${done.reduce((s, r) => s + r.days, 0)}</span>
      <span class="n">approved so far this year</span></div>
    <div class="stat"><span class="k">Waiting on a decision</span><span class="v">${
      wfh.filter(r => r.status === 'Pending').length}</span>
      <span class="n">with ${nm2(mgrName(u) || 'your manager')}</span></div>
    <div class="stat"><span class="k">Comes off your balance</span><span class="v" style="font-size:17px;font-family:'IBM Plex Sans',sans-serif">Nothing</span>
      <span class="n">a day at home is not leave</span></div>
  </div>`;
  const stPill = s => s === 'Approved' ? '<span class="pill good"><span class="dt"></span>Approved</span>'
    : s === 'Declined' ? '<span class="pill bad"><span class="dt"></span>Declined</span>'
    : '<span class="pill warn"><span class="dt"></span>Waiting</span>';
  return strip + `
  ${wait.length ? `<section class="panel">
    <header><h3>Waiting on you</h3><span class="pill warn"><span class="dt"></span>${wait.length}</span>
      <span class="hint">days at home, waiting on your decision</span></header>
    <div class="tw"><table>
      <thead><tr><th>Who</th><th>Dates</th><th class="r">Days</th><th>Reason</th><th></th></tr></thead>
      <tbody>${wait.map(r => `<tr>
        <td class="nw">${nm(r.who)}</td>
        <td class="n nw">${esc(dayText(r))}</td>
        <td class="n r">${r.days}</td>
        <td style="color:var(--ink2)">${esc(r.reason)}</td>
        <td class="r nw"><button class="btn" data-approve-req="${esc(r.id)}" type="button" style="padding:3px 11px;font-size:12.5px">Approve</button>
          <button class="btn ghost" data-decline-req="${esc(r.id)}" type="button" style="padding:3px 11px;font-size:12.5px;margin-left:6px">Decline</button></td></tr>`).join('')}
      </tbody></table></div>
  </section>` : ''}

  <div class="grid g2 gtop">
    <section class="panel">
      <header><h3>Apply for work from home</h3>
        <span class="hint">goes to ${nm2(mgrName(u) || 'your manager')}</span></header>
      <div class="pad">${reqFormBody(u, B, f, false)}</div>
    </section>

    <section class="panel">
      <header><h3>List of previous work from home</h3>
        <span style="margin-left:auto;color:var(--ink3);font-size:12.5px">${wfh.length}</span></header>
      <div class="tw"><table>
        <thead><tr><th>Reference</th><th>Dates</th><th class="r">Days</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>${wfh.length ? wfh.map(r => `<tr>
          <td class="n nw">${esc(r.id)}</td>
          <td class="n nw">${esc(dayLabel(r.from))}${r.from !== r.to ? ' &ndash; ' + esc(dayLabel(r.to)) : ''}</td>
          <td class="n r">${r.days}</td>
          <td style="color:var(--ink2)">${esc(r.reason)}</td>
          <td>${stPill(r.status)}</td></tr>`).join('')
          : '<tr><td colspan="5" style="color:var(--ink3)">You have not asked to work from home yet.</td></tr>'}
        </tbody></table></div>
      <p class="cap">Days at home do not come off any balance. They are shown on the team board so people know where you are.</p>
    </section>
  </div>`;
}

/* The policy itself, on the page the people it applies to are already on.
 * Read from the same list of types the request form offers, so the two can
 * never drift: a kind of leave that is not on this table cannot be asked
 * for, and one that is, is. */
function vLeavePolicyTab(u){
  const P = (HR().leavePolicy || {});
  const pay = t => t.pay === 'full' ? 'Full pay'
    : t.pay === 'none' ? 'Unpaid'
    : t.pay === 'scale' ? 'Full, then half, then unpaid' : '—';
  return `
  <section class="panel">
    <header><h3>Leave policy</h3>
      <span class="pill mute">${P.annualDays} working days a year &middot; ${P.accrualPerMonth} a month</span>
      <span class="hint">the same rules for everyone</span></header>
    <div class="tw"><table class="cotab">
      ${colsOf([20, 17, 12, 17, 34])}
      <thead><tr><th>Leave</th><th>Pay</th><th class="r">Days</th><th>Comes off your annual balance</th><th>Notes</th></tr></thead>
      <tbody>${LEAVEONLY().map(t => `<tr>
        <td><b>${esc(t.label)}</b></td>
        <td>${esc(pay(t))}</td>
        <td class="n r">${t.max ? t.max : t.pool ? P.annualDays : t.half ? '\u00bd' : '—'}</td>
        <td>${t.pool ? '<span class="pill warn"><span class="dt"></span>Yes</span>'
                     : '<span class="pill mute">No</span>'}</td>
        <td style="color:var(--ink2)"${full(t.note || '')}>${esc(t.note || '—')}</td></tr>`).join('')}
      </tbody></table></div>
    <p class="cap">${esc(P.note || '')} Days are counted in <b>working days</b>, so a weekend or a public holiday
      inside your dates does not come off the balance. Only <b>annual</b> and <b>Umrah</b> leave draw on the annual
      balance; everything else is separate and does not touch it.</p>
  </section>

  <section class="panel">
    <header><h3>How it works</h3></header>
    <div class="pad"><dl class="kv wide">
      <dt>Who decides</dt><dd>Your manager, ${nm2(mgrName(u) || '—')}. Accounts is copied so payroll stays right.</dd>
      <dt>Who is told</dt><dd>Your manager decides it and you are emailed the answer. The team is told once it is approved and again on the first morning &mdash; the dates only, never the reason.</dd>
      <dt>Carry forward</dt><dd>Days you earn in one leave year can be used until the end of the next one, and the oldest days are used first. Anything still unused from last year lapses on your joining anniversary.</dd>
      <dt>Unpaid leave</dt><dd>Reduces your working days for the month, which shows as LOP days on your payslip.</dd>
      <dt>Cancelling</dt><dd>Ask your manager &mdash; an approved request can be withdrawn up to the day before it starts.</dd>
      <dt>Public holidays</dt><dd>${(HR().holidays || []).length} in ${String(HDATE()).slice(0, 4)}, the same for all three companies. They do not come off any balance.</dd>
    </dl></div>
  </section>`;
}

function reqFormBody(u, B, f, modes){
  return `
        ${modes ? `<div class="rqmode">
          <button data-rqmode="wfh" aria-pressed="${f.type==='WFH'}" type="button">
            <b>Work from home</b><span>A day at home</span></button>
          ${(noLeave(u) || leaveOwed(u)) ? '' : `<button data-rqmode="leave" aria-pressed="${f.type!=='WFH'}" type="button">
            <b>Leave request</b><span>Nine kinds of leave</span></button>`}
        </div>` : ''}
        ${f.type!=='WFH' ? `
        <div class="field"><label for="rqType">Kind of leave</label>
          <select id="rqType">${LEAVEONLY().map(t=>{const g=typeAllowed(u,t);
            return `<option value="${t.id}"${f.type===t.id?' selected':''}${g.ok?'':' disabled'}>${esc(t.label)}${g.ok?'':' — '+esc(g.why)}</option>`;}).join('')}</select></div>
        ${(()=>{const t=rType(f.type); return t.note?`<p class="rqnote">${esc(t.note)}${t.max?` Up to ${t.max} days.`:''}</p>`:'';})()}
        `:''}
        ${rType(f.type).onBday ? (()=>{
          const K = bdayBal(u), bd = K.has ? (K.today ? K.on : K.next) : '';
          const weekendish = bd && (isWeekend(bd) || holOn(bd));
          const gone = K.has && K.today && K.open <= 0;
          return `<div class="field"><label>Date &mdash; your birthday</label>
            <input type="date" value="${esc(bd)}" disabled>
            <span class="pfhint">${bd ? (K.today
                ? `Today, <b>${esc(dayName(bd))} ${esc(dayLabel(bd))}</b>. Birthday leave opens on the day itself and closes at the end of it.`
                : `Your next birthday is <b>${esc(dayName(bd))} ${esc(dayLabel(bd))} ${bd.slice(0,4)}</b>. Birthday leave can only be taken on the day itself.`)
              : 'Add your birthday on My profile first.'}</span></div>
            ${gone ? `<p class="note" style="margin:0 0 14px;border-left-color:var(--warn)"><b>Already claimed.</b> ${K.pending>0?'Your request is with '+nm2(mgrName(u)||'your manager')+' and nothing further can be applied for.':'You have taken your half day this year, so there is nothing left to apply for.'} It comes round again on your next birthday.</p>`
            : (K.today ? `<div class="field"><label>Which half</label>
              <div class="seg halfseg" id="rqHalfSeg">
                <button data-half="am" aria-pressed="${(f.half||'am')==='am'}" type="button">First half<span>${esc(shiftOf(u).start)} &ndash; midday</span></button>
                <button data-half="pm" aria-pressed="${f.half==='pm'}" type="button">Second half<span>midday &ndash; ${esc(shiftOf(u).end)}</span></button>
              </div></div>` : '')}
            ${(weekendish && !gone) ? `<p class="note" style="margin:0 0 14px;border-left-color:var(--warn)">Your birthday falls on ${holOn(bd)?'<b>'+esc(holOn(bd).n)+'</b>, a public holiday,':'a <b>'+esc(dayLong(bd))+'</b>'} this year, so there is no working half-day to take &mdash; you are already off. It does not move to another day and it does not carry over.</p>` : ''}`;})()
        : `<div class="grid g2" style="gap:12px">
          <div class="field"><label for="rqFrom">${rType(f.type).half?'Date':'From'}</label><input id="rqFrom" type="date" value="${esc(f.from)}" min="2026-09-01"></div>
          ${rType(f.type).half?'':`<div class="field"><label for="rqTo">To</label><input id="rqTo" type="date" value="${esc(f.to)}" min="2026-09-01"></div>`}
        </div>`}
        <div class="field"><label for="rqReason">Reason</label><input id="rqReason" placeholder="A line is enough" value="${esc(f.reason)}"></div>
        ${(()=>{
          const t = rType(f.type);
          const from = t.onBday ? bdayDate(u) : f.from;
          const to = t.half ? from : f.to;
          if(!(from && to && to>=from)) return '';
          const w = t.half ? 0.5 : workDaysBetween(from,to);
          const c = t.half ? 1 : spanDays(from,to).length;
          const over = t.max && w > t.max;
          return `<p class="note" style="margin:0 0 14px${over?';border-left-color:var(--bad)':''}"><b>${w} working day${w===1?'':'s'}</b>${(!t.half && c!==w)?` (${c} calendar days — weekends and public holidays do not count)`:''}${
            usesPool(f.type)?` &middot; ${B.left} available, ${Math.round((B.left-w)*100)/100} would be left`:''}${
            isUnpaid(f.type)?' &middot; unpaid, so it reduces your working days for the month':''}${
            over?` &middot; <b style="color:var(--bad)">that is more than the ${t.max}-day limit</b>`:''}.
            ${nm2(mgrName(u) || 'Your manager')} is emailed as soon as you submit.</p>`;})()}
        ${(()=>{const t=rType(f.type);
          const from = t.onBday ? bdayDate(u) : f.from;
          const g = typeAllowed(u, t);
          const ok = g.ok && from && (t.half || f.to) && f.reason && !(t.onBday && (isWeekend(from)||holOn(from)));
          return `<button class="btn wide" id="rqSubmit" type="button"${ok?'':' disabled'}>Send to ${esc((mgrName(u)||'manager').split(' ')[0])}</button>`;})()}
        ${state.reqSent?`<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>Sent.</b> ${nm2(mgrName(u) || 'Your manager')} has it, and you will be emailed the moment it is decided.</div>`:''}`;
}

/* On a phone the + opens one thing at a time: a work-from-home screen with nothing
   about leave on it, or a leave screen with no WFH. Nothing else competes for the
   space, and Cancel puts you back where you were. */
function vAsk(kind){
  const u = state.user, B = leaveBal(u);
  const f = state.reqForm || (state.reqForm = {type:kind==='WFH'?'WFH':'Annual', from:'', to:'', reason:'', half:'am'});
  if(kind==='WFH' && f.type!=='WFH') f.type = 'WFH';
  if(kind!=='WFH' && f.type==='WFH') f.type = 'Annual';
  const mine = HR().requests.filter(r=>r.who===u && (kind==='WFH' ? r.type==='WFH' : r.type!=='WFH'))
    .slice().sort((a,b)=>b.from.localeCompare(a.from)).slice(0,4);
  const stPill = st => st==='Approved' ? '<span class="pill good"><span class="dt"></span>Approved</span>'
    : st==='Declined' ? '<span class="pill bad"><span class="dt"></span>Declined</span>'
    : '<span class="pill warn"><span class="dt"></span>Waiting</span>';
  return `
  <div class="askbar">
    <button class="askback" data-askback="1" type="button" aria-label="Back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
    <div><b>${kind==='WFH' ? 'Work from home' : 'Leave request'}</b>
      <span>goes to ${nm2(mgrName(u) || 'your manager')}</span></div>
  </div>
  ${(kind!=='WFH' && !noLeave(u)) ? `<div class="askbal">
      <span>Annual leave left</span><b>${B.left}</b>
      <i>${B.ahead?B.ahead+' already booked':B.expiring?B.expiring+' expires '+dayLabel(B.expiresOn):'days'}</i>
    </div>` : ''}
  <section class="panel"><div class="pad">
    ${reqFormBody(u, B, f, false)}
  </div></section>
  ${mine.length ? `<section class="panel">
    <header><h3>Your recent ${kind==='WFH' ? 'days at home' : 'leave'}</h3></header>
    <div class="apxlist">${mine.map(r=>`<div class="apx" style="padding:11px 16px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <div><b style="display:block;font-size:14.5px">${esc(dayText(r))}</b>
          <span style="font-size:12.5px;color:var(--ink2)">${esc(reqLabel(r.type))} &middot; ${r.days} day${r.days===1?'':'s'}</span></div>
        ${stPill(r.status)}</div></div>`).join('')}</div>
  </section>` : ''}`;
}

function vRequests(){
  const u = state.user, R = HR().requests;
  let mine = R.filter(r=>r.who===u).slice().sort((a,b)=>b.from.localeCompare(a.from));
  let inbox = R.filter(r=>r.mgr===u && r.status==='Pending');
  const B = leaveBal(u);
  const f = state.reqForm || (state.reqForm = {type:'WFH', from:'', to:'', reason:'', half:'am'});
  const team = reportsTo(u);
  const stPill = s => s==='Approved' ? '<span class="pill good"><span class="dt"></span>Approved</span>'
    : s==='Declined' ? '<span class="pill bad"><span class="dt"></span>Declined</span>'
    : '<span class="pill warn"><span class="dt"></span>Waiting</span>';

  /* The tab decides what this page is, and the form follows the tab rather
   * than a toggle inside it. Leave is what is left once the other two have
   * taken their own screens, so anything about a day at home leaves here. */
  const LV = leaveTabs();
  if(LV.cur === 'wfh'){
    if(f.type !== 'WFH') f.type = 'WFH';
    return LV.bar + vWfhTab(u, B, f, mine, inbox);
  }
  if(LV.cur === 'policy') return LV.bar + vLeavePolicyTab(u);
  if(f.type === 'WFH') f.type = 'Annual';
  mine  = mine.filter(r => r.type !== 'WFH');
  inbox = inbox.filter(r => r.type !== 'WFH');

  /* The two lines Avin wanted under the three columns rather than inside one
   * of them: what expires and when, and what a working day means. */
  const leaveNotes = noLeave(u) ? '' : `<div class="lvnotes">
${B.expiring>0?`<p class="note" style="border-left-color:var(--warn)"><b>${B.expiring} day${B.expiring===1?'':'s'} expire on ${esc(dayLabel(B.expiresOn))} ${B.expiresOn.slice(0,4)}.</b> Days earned in one leave year can be used until the end of the next one, and the oldest days go first &mdash; so anything still unused from last year is lost at your anniversary.</p>`:''}
        <p class="note">${esc(B.policy.note)} Days are counted in <b>working days</b>, so a weekend or a public holiday inside your dates does not come off the balance.${B.yearEnd?` Your leave year runs to ${esc(dayLabel(B.yearEnd))} ${B.yearEnd.slice(0,4)}.`:''}</p></div>`;

  return LV.bar + `
  <div class="strip">
    ${noLeave(u)
      ? `<div class="stat"><span class="k">Annual leave</span><span class="v" style="font-size:17px;font-family:'IBM Plex Sans',sans-serif">Not applicable</span>
          <span class="n">you are not on the annual leave scheme</span></div>`
      : `<div class="stat"><span class="k">Annual leave left</span><span class="v" style="color:var(--${B.left<0?'bad':B.left>3?'good':'warn'})">${B.left}<span class="cur" style="margin-left:6px">days</span></span>
          <span class="n">${B.carried} on 31 Aug${B.accrued?' plus '+B.accrued+' since':''}${B.taken?', '+B.taken+' taken':''}${B.left<0?' · overdrawn, no leave until it clears':B.after<0?' · '+Math.abs(B.after)+' short on booked leave':B.ahead?' · '+B.ahead+' booked ahead':B.expiring?' · '+B.expiring+' expires '+dayLabel(B.expiresOn):''}</span></div>`}
    <div class="stat"><span class="k">Waiting on a decision</span><span class="v">${B.booked}<span class="cur" style="margin-left:6px">days</span></span>
      <span class="n">${mine.filter(r=>r.status==='Pending').length} request${mine.filter(r=>r.status==='Pending').length===1?'':'s'} with ${nm2(mgrName(u) || 'your manager')}</span></div>
    <div class="stat"><span class="k">Taken since 31 Aug</span><span class="v">${B.taken||0}<span class="cur" style="margin-left:6px">days</span></span>
      <span class="n">annual leave, this leave year</span></div>
    ${team.length?`<div class="stat"><span class="k">Waiting on you</span><span class="v" style="color:var(--${inbox.length?'warn':'good'})">${inbox.length}</span>
      <span class="n">${team.length} people report to you</span></div>`
    :`<div class="stat"><span class="k">Your manager</span><span class="v" style="font-size:16px;font-family:'IBM Plex Sans',sans-serif">${nm2(mgrName(u) || '—')}</span>
      <span class="n">approves your leave and WFH</span></div>`}
  </div>

  ${inbox.length?`
  <section class="panel">
    <header><h3>Waiting on you</h3><span class="pill warn"><span class="dt"></span>${inbox.length}</span>
      <span class="hint">approve or decline &mdash; they are told by email either way</span></header>
    ${MOBILE() ? `<div class="apxlist">${inbox.map(r=>`
      <div class="apx">
        <div class="apxh">${avatar(r.who)}<div><b>${nm(r.who)}</b><span>${esc(reqLabel(r.type))} &middot; ${r.days} day${r.days===1?'':'s'}</span></div></div>
        <div class="apxd">${esc(dayText(r))}</div>
        ${r.reason?`<p class="apxr">${esc(r.reason)}</p>`:''}
        <div class="apxb">
          <button class="btn" data-approve-req="${esc(r.id)}" type="button">Approve</button>
          <button class="btn ghost" data-decline-req="${esc(r.id)}" type="button">Decline</button>
        </div>
      </div>`).join('')}</div>` : `
    <div class="tw"><table>
      <thead><tr><th>Who</th><th>Type</th><th>Dates</th><th class="r">Days</th><th>Reason</th><th></th></tr></thead>
      <tbody>${inbox.map(r=>`<tr>
        <td class="nw">${nm(r.who)}</td><td class="nw">${esc(reqLabel(r.type))}</td>
        <td class="n nw">${esc(dayText(r))}</td>
        <td class="n r">${r.days}</td>
        <td style="color:var(--ink2)">${esc(r.reason)}</td>
        <td class="r nw"><button class="btn" data-approve-req="${esc(r.id)}" type="button" style="padding:3px 11px;font-size:12.5px">Approve</button>
          <button class="btn ghost" data-decline-req="${esc(r.id)}" type="button" style="padding:3px 11px;font-size:12.5px;margin-left:6px">Decline</button></td></tr>`).join('')}
      </tbody></table></div>`}
  </section>`:''}

  <div class="grid g3 gtop">
    <section class="panel">
      <header><h3>New leave request</h3><span class="hint">goes to ${nm2(mgrName(u) || 'your manager')}</span></header>
      <div class="pad">
        ${reqFormBody(u, B, f, false)}
      </div>
    </section>

    <section class="panel">
      <header><h3>Your leave</h3>${(!noLeave(u) && B.yearNo)?`<span class="pill mute">year ${B.yearNo}</span>`:''}
        <span class="hint">${noLeave(u)?'not on the scheme':(B.doj?'from '+esc(B.doj):'joining date not on file')}</span></header>
      <div class="pad">
        ${noLeave(u) ? `<p style="margin:0;color:var(--ink2);font-size:14.5px">You are not on the annual leave scheme, so there is no balance to show and no leave to request. Working from home still goes through this page. If that is wrong, speak to ${esc(ADMIN.split(' ')[0])}.</p>` : `
        <dl class="kv">
          <dt>Balance on 31 Aug 2026</dt><dd>${B.carriedSet?B.carried:'<i style="color:var(--ink3);font-weight:400">not on file yet</i>'}</dd>
          <dt>Credited since 31 Aug${B.monthsIn?` &mdash; ${B.monthsIn} month${B.monthsIn===1?'':'s'} at ${B.policy.accrualPerMonth}`:''}</dt><dd>${B.accrued}${B.next?` <span class="pill mute" style="margin-left:6px">next ${esc(dayLabel(B.next))}</span>`:''}</dd>
          <dt>Taken since 31 Aug</dt><dd>${B.taken?'('+B.taken+')':'—'}</dd>
          <div class="sep"></div>
          <dt><b>Available now</b></dt><dd class="big"><b>${B.left}</b></dd>
          ${B.ahead?`<dt>Already booked${B.toCome?', less '+B.toCome+' still to accrue':''}</dt><dd>(${B.ahead})</dd>
          <dt><b>Left after your booked leave</b></dt>
            <dd${B.after<0?' style="color:var(--bad);font-weight:700"':''}><b>${B.after}</b></dd>`:''}
          <dt>&mdash; earned last year, use by ${esc(dayLabel(B.expiresOn))} ${B.expiresOn.slice(0,4)}</dt>
            <dd${B.expiring>0?' style="color:var(--warn);font-weight:600"':''}>${B.older}</dd>
          <dt>&mdash; earned this year</dt><dd>${B.thisYear}</dd>
          <dt>Requested, not yet approved</dt><dd>${B.pendDays||'—'}</dd>
        </dl>
        ${(()=>{ const S = sickBal(u); if(!S.has) return '';
          return `<dl class="kv" style="margin-top:14px">
            <div class="sep"></div>
            <dt>Sick leave at full pay</dt>
            <dd${S.probation?' style="color:var(--ink3)"':(S.full<=3?' style="color:var(--warn);font-weight:600"':'')}>${
              S.probation ? 'after probation' : S.full + ' of ' + S.FULL}</dd>
            ${S.probation ? '' : `<dt>&mdash; then half pay, then unpaid</dt><dd style="color:var(--ink2)">${S.HALF} + ${S.UNPAID}</dd>`}
            <dt>Resets</dt><dd>${esc(dayLabel(S.yearEnd))} ${S.yearEnd.slice(0,4)}</dd>
          </dl>
          <p class="cap" style="padding-top:10px">${S.probation
            ? `Sick leave is unpaid during your first six months and needs your manager&rsquo;s agreement &mdash; you are ${S.served} month${S.served===1?'':'s'} in. After that the full entitlement applies: ${S.FULL} days at full pay, ${S.HALF} at half pay and ${S.UNPAID} unpaid.`
            : `UAE law gives ${S.FULL + S.HALF + S.UNPAID} days a leave year: the first ${S.FULL} at full pay, the next ${S.HALF} at half pay and the last ${S.UNPAID} unpaid. A medical certificate is needed. It does not touch your annual balance.`}</p>`;
        })()}
        ${(()=>{ const K = bdayBal(u); if(!K.has) return '';
          return `<dl class="kv" style="margin-top:14px">
            <div class="sep"></div>
            <dt>Birthday half day &mdash; ${esc(dayLabel(K.today?K.on:K.next))}</dt>
            <dd${K.today&&K.open>0?' style="color:var(--good);font-weight:600"':''}>${
              K.today ? (K.pending>0 ? 'requested, waiting' : K.open>0 ? K.open+' &mdash; today only' : 'taken')
              : (K.credited>0 && K.left<=0 ? 'taken this year' : K.lapsed ? 'lapsed this year' : 'not yet due')}</dd>
          </dl>
          <p class="cap" style="padding-top:10px">Half a day, credited on your birthday and taken on the day itself. It is separate from your annual balance and lapses if it is not used.</p>`;
        })()}
        ${(B.after < 0 && !leaveOwed(u))?`<p class="note" style="margin-top:16px;border-left-color:var(--bad)"><b>Your booked leave is ${Math.abs(B.after)} day${Math.abs(B.after)===1?'':'s'} more than you will have earned by then.</b> You have ${B.left} now and ${B.ahead} booked; ${B.toCome?'another '+B.toCome+' accrues before the last of it, which still leaves you short':'nothing further accrues before it starts'}. Speak to ${esc(NM(mgrName(u))||'your manager')} about shortening it or taking the difference unpaid.</p>`:''}
        ${leaveOwed(u)?`<p class="note" style="margin-top:16px;border-left-color:var(--bad)"><b>You are ${Math.abs(B.left)} day${Math.abs(B.left)===1?'':'s'} overdrawn</b>, so no further leave can be requested. The balance climbs back by ${B.policy.accrualPerMonth} days each month${B.next?`, next on ${esc(dayLabel(B.next))}`:''}. Working from home is unaffected.</p>`:''}
        `}
      </div>
    </section>

  <section class="panel">
    <header><h3>How it works</h3></header>
    <div class="pad"><dl class="kv wide">
      <dt>Who decides</dt><dd>Your manager, ${nm2(mgrName(u) || '—')}. Accounts is copied so payroll stays right.</dd>
      <dt>Who is told</dt><dd>Your manager decides it and you are emailed the answer. The team is told once it is approved and again on the first morning &mdash; the dates only, never the reason.</dd>
      <dt>Carry forward</dt><dd>Days you earn in one leave year can be used until the end of the next one, and the oldest days are used first. Anything still unused from last year lapses on your joining anniversary.</dd>
      <dt>What comes off the balance</dt><dd>Only <b>annual</b> and <b>Umrah</b> leave. Bereavement, sick, birthday, maternity, paternity and Hajj leave are separate and do not touch it.</dd>
      <dt>Unpaid leave</dt><dd>Reduces your working days for the month, which shows as LOP days on your payslip.</dd>
      <dt>Cancelling</dt><dd>Ask your manager — an approved request can be withdrawn up to the day before it starts.</dd>
    </dl></div>
    </section>
  </div>

  ${leaveNotes}

  <section class="panel">
    <header><h3>Your requests</h3><span style="margin-left:auto;color:var(--ink3);font-size:12.5px">${mine.length}</span></header>
    <div class="tw"><table>
      <thead><tr><th>Reference</th><th>Type</th><th>Dates</th><th class="r">Working days</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>${mine.length?mine.map(r=>`<tr>
        <td class="n nw">${esc(r.id)}</td><td class="nw">${esc(reqLabel(r.type))}</td>
        <td class="n nw">${esc(dayLabel(r.from))}${r.from!==r.to?' &ndash; '+esc(dayLabel(r.to)):''}</td>
        <td class="n r">${r.days}</td><td style="color:var(--ink2)">${esc(r.reason)}</td>
        <td>${stPill(r.status)}</td></tr>`).join('')
        :'<tr><td colspan="6" style="color:var(--ink3)">Nothing requested yet.</td></tr>'}
      </tbody></table></div>
  </section>`;
}

/* ---------- people directory: what a colleague may see ---------- */
function yearsWith(n){
  const j = parseDoj(((HR().balances||{})[n]||{}).doj);
  if(!j) return null;
  const t = HDATE();
  let y = +t.slice(0,4) - j.y;
  if(t.slice(5) < `${String(j.m).padStart(2,'0')}-${String(j.d).padStart(2,'0')}`) y--;
  return {years:y, doj:((HR().balances||{})[n]||{}).doj};
}
function nextLeave(n){
  const t = HDATE();
  return HR().requests.filter(r=>r.who===n && r.status==='Approved' && r.type!=='WFH' && r.to>=t)
    .sort((a,b)=>a.from.localeCompare(b.from))[0] || null;
}
const avatar = (n, cls) => {
  const p = PROF(n) || {};
  return `<div class="pa ${cls||''}">${p.photo
    ? `<img src="${p.photo.url}" alt="${nm(n)}">`
    : `<span>${esc(NM(n).split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`}</div>`;
};
// colleagues see a company address only - never a personal one
const WORKDOM = /@(corplex\.ae|poa\.ae|lexestates\.ae)$/i;
const workEmail = n => { const e = (HR().emails||{})[n] || ''; return WORKDOM.test(e) ? e : ''; };
// UAE work numbers are stored locally (05x…); WhatsApp wants them international
function waNumber(v){
  const d = String(v||'').replace(/\D/g,'');
  if(!d) return '';
  if(d.startsWith('971')) return d;
  if(d.startsWith('0'))   return '971' + d.slice(1);
  if(d.length === 9)      return '971' + d;
  return d;
}
const WAICON = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" style="flex:none"><path fill="currentColor" d="M12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.94L2 22l5.35-1.4a9.83 9.83 0 0 0 4.69 1.19h.01c5.44 0 9.87-4.43 9.87-9.87 0-2.64-1.03-5.12-2.9-6.99A9.8 9.8 0 0 0 12.04 2Zm0 18.03h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.32c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.2 8.2Zm4.5-6.14c-.25-.12-1.46-.72-1.68-.8-.23-.09-.39-.13-.55.12s-.63.8-.78.97c-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42l-.47-.01c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z"/></svg>';
// a name anywhere in the portal opens that person's card
const whoLink = n => `<button class="wholink" data-who="${esc(n)}" type="button">${nm(n)}</button>`;

function statusNow(n){
  if(!tracksAtt(n)) return {t:'Not on the attendance list', c:'var(--ink3)'};
  const s = dayStatus(n, HDATE());
  if(s.k === 'Office')  return {t:'In the office', c:'var(--c1)'};
  if(s.k === 'WFH')     return {t:'Working from home', c:'var(--c3)'};
  if(s.k === 'Holiday') return {t:s.label, c:'var(--good)'};
  if(s.k === 'Weekend') return {t:'Weekend', c:'var(--ink3)'};
  if(s.k === 'Absent')  return {t:'Not checked in yet', c:'var(--ink3)'};
  return {t:s.label, c:STCOL[s.k] || 'var(--ink2)'};
}

/* ---------- the organisation, all three companies ---------- */
function orgKids(n, coKey){
  return USERS.map(x=>x.name)
    .filter(x => mgrName(x) === n && ((HR().orgCo||{})[x] || companyOf(x).key) === coKey)
    .sort((a,b)=>{
      const r = x => orgKids(x, coKey).length ? 0 : 1;        // people with reports first
      return r(a)-r(b) || a.localeCompare(b);
    });
}
function orgBox(n, cls, hideDept){
  const co = ((HR().orgCo||{})[n]) || companyOf(n).key;
  const d = orgDeptOf(n);
  const rev = REVDEPT(co).includes(d) || !!SALESEXTRA(n);
  return `<button class="otn${cls?' '+cls:''}" data-who="${esc(n)}" type="button">
    ${avatar(n)}
    <span class="otwho">
      <span class="otn1">${nm(n)}</span>
      <span class="otn2">${esc(titleOf(n) || ROLELABEL[roleOf(n)])}</span>
    </span>
    ${(d && !hideDept) ? `<span class="otd${rev?' rev':''}">${esc(d)}</span>` : ''}
  </button>`;
}
/* The tree groups by department. The owner sits above all three companies, so he
   is shown once at the head of each and left out of his own department stack. */
function orgDeptNode(co, dept, people, owner){
  const rev = REVDEPT(co).includes(dept);
  const list = people.filter(n => n !== owner).sort((a,b)=>{
    const lead = n => (['manager','owner'].includes(roleOf(n)) || salesLead(n)) ? 0 : 1;
    return lead(a)-lead(b) || a.localeCompare(b);
  });
  return `<li>
    <div class="otdept${rev?' rev':''}">
      <span class="odn">${esc(dept)}</span>
      <span class="odc">${list.length}</span>
    </div>
    ${list.length ? `<ul class="stack">${list.map(n=>`<li>${orgBox(n, '', true)}</li>`).join('')}</ul>` : ''}
  </li>`;
}
function vOrg(){
  const owner = (USERS.find(u=>u.role==='owner')||{}).name;
  /* The colours, said where they are being looked at rather than in a caption
   * under the whole page. Orange earns; grey supports. */
  const legend = `<div class="orglgd">
    <span><i class="rev"></i>earns revenue &mdash; appears in that company&rsquo;s performance pages</span>
    <span><i></i>support &mdash; does not sell, and never shows a sales figure</span>
  </div>`;
  const coOfOrg = n => ((HR().orgCo||{})[n]) || companyOf(n).key;
  return ['corplex','poa','lex'].map(k=>DATA.companies[k]).filter(Boolean).map(c=>{
    const roll = USERS.map(x=>x.name).filter(n => coOfOrg(n) === c.key);
    const byDept = {};
    roll.forEach(n => { const d = orgDeptOf(n) || 'No department set'; (byDept[d]=byDept[d]||[]).push(n); });
    const rev = REVDEPT(c.key);
    const order = Object.keys(byDept).filter(d => byDept[d].length).sort((a,b)=>{
      const r = d => rev.includes(d) ? 0 : 1;
      return r(a)-r(b) || a.localeCompare(b);
    });
    return `
    <section class="panel">
      <header><h3>${esc(c.name)}</h3>
        <span class="hint">${roll.length} ${roll.length===1?'person':'people'} &middot; ${order.length} department${order.length===1?'':'s'}</span>
        ${legend}</header>
      <div class="pad orgwrap">
        <ul class="ot">
          <li>${orgBox(owner, 'col', true)}
            ${order.length ? `<ul>${order.map(d=>orgDeptNode(c.key, d, byDept[d], owner)).join('')}</ul>` : ''}
          </li>
        </ul>
      </div>
    </section>`;
  }).join('') + `
  <p class="cap" style="color:var(--ink3);font-size:13px;margin:0">Grouped by department. A department in the accent colour earns revenue and appears in that company&rsquo;s performance pages; a grey one is support. Managers are listed first within their department. ${esc(owner)} heads all three companies, so he sits at the top of each tree rather than inside a department. Click anyone to open their page &mdash; their card shows who they report to.
  <b>No department set</b> is not a department: it is everyone who has not been given one yet, and it disappears
  as they are.</p>`;
}

function vPeople(){
  const who = state.who;
  const roll = USERS.map(x=>x.name);

  if(who && roll.includes(who)){
    const p = PROF(who) || {};
    const co = companyOf(who), st = statusNow(who), yw = yearsWith(who), nl = nextLeave(who);
    const reps = reportsTo(who), mgr = mgrName(who);
    const row = (l, v) => v ? `<dt>${esc(l)}</dt><dd>${v}</dd>` : '';
    const mail = workEmail(who), first = who.split(' ')[0];
    const segs = (attOf(who, HDATE())||{}).segs || [];
    const g = segs.length ? segs[segs.length-1] : null;
    const since = g ? (g.out ? `${g.in} \u2013 ${g.out}` : `since ${g.in}`) : '';
    const wa = waNumber(phoneOf(who));
    return `
    <button class="btn ghost" data-people-back type="button" style="align-self:flex-start">&larr; All people</button>
    <section class="panel">
      <div class="pfhead">
        ${avatar(who, 'big')}
        <div class="pfwho">
          <h2>${nm(who)}</h2>${goesBy(who)?`<p class="pfleg">${esc(legalOf(who))} on record</p>`:''}
          <p>${esc(titleOf(who) || ROLELABEL[roleOf(who)])} &middot; ${esc(co.name)}${orgDeptOf(who) ? ' &middot; '+esc(orgDeptOf(who)) : ''}</p>
          <span class="pfupd" style="color:${st.c}">&#9679; ${esc(st.t)}${since ? ' &middot; '+esc(since) : ''}</span>
        </div>
        <div class="pfact">
          ${mail ? `<a class="btn" href="mailto:${esc(mail)}">Email ${esc(first)}</a>` : ''}
          ${wa ? `<a class="btn wa" href="https://wa.me/${wa}" target="_blank" rel="noopener">${WAICON}WhatsApp</a>` : ''}
        </div>
      </div>
    </section>

    <div class="grid g3">
      <section class="panel">
        <header><h3>How to reach them</h3><span class="hint">work only</span></header>
        <div class="pad"><dl class="kv wide">
          ${row('Work email', mail ? `<a href="mailto:${esc(mail)}">${esc(mail)}</a>` : '')}
          ${row('Work phone', phoneOf(who) ? `<a href="tel:${esc(phoneOf(who).replace(/\s/g,''))}">${esc(phoneOf(who))}</a>${wa?` <a class="walink" href="https://wa.me/${wa}" target="_blank" rel="noopener" title="Message on WhatsApp">${WAICON}</a>`:''}` : '')}
          ${row('Working hours', tracksAtt(who) ? esc(shiftOf(who).start+'\u2013'+shiftOf(who).end) : 'Not on the attendance list')}
          ${row('Based', isRemote(who) ? 'Works remotely' : 'In the office')}
        </dl>
        ${!mail && !phoneOf(who) ? `<p style="margin:0;color:var(--ink3);font-size:13.5px">No work contact details on file yet.</p>` : ''}
        </div>
      </section>

      <section class="panel">
        <header><h3>Where they sit</h3></header>
        <div class="pad"><dl class="kv wide">
          ${row('Company', esc(co.name))}
          ${row('Department', orgDeptOf(who) ? esc(orgDeptOf(who)) : '&mdash;')}
          ${row('Reports to', mgr ? whoLink(mgr) : 'Nobody &mdash; top of the tree')}
          ${row('Looks after', reps.length ? reps.map((r,i)=>`<span class="wnb">`+whoLink(r)+(i<reps.length-1?',':'')+`</span>`).join(' ') : '')}
        </dl></div>
      </section>

      <section class="panel">
        <header><h3>Good to know</h3></header>
        <div class="pad"><dl class="kv wide">
          ${row('Home country', esc((p.homeCountry) || ''))}
          ${row('Birthday', (bdayDM(who) && !quietBday(who))
            ? esc(bdayDM(who)) + (SEESALL(who) && bdayYr(who)
                ? ' <span style="color:var(--ink3)">' + esc(bdayYr(who)) + '</span>' : '') : '')}
          ${row('With us', yw ? (yw.years < 1 ? `Joined ${esc(yw.doj)}` : `${yw.years} year${yw.years===1?'':'s'} &middot; joined ${esc(yw.doj)}`) : '')}
          ${row('Next booked off', nl ? `${esc(reqLabel(nl.type))} &middot; ${esc(dayLabel(nl.from))}${nl.from!==nl.to?' \u2013 '+esc(dayLabel(nl.to)):''}` : 'Nothing booked')}
          ${row('Gender', esc(p.gender || ''))}
          ${row('Marital status', esc(p.marital || ''))}
        </dl></div>
      </section>
    </div>

    ${(() => {
      /* The rest of their profile. Drawn only where there is something in it,
         so a card does not fill up with a column of dashes reproaching
         somebody who has not got round to it yet. */
      const own  = SEESALL(who);
      const home = [
        ['Permanent address', p.homeAddr],
        ['Contact there',     p.homeContact],
        ['Their phone',       p.homePhone]
      ].filter(x => String(x[1] || '').trim());
      const emg = [
        ['Name',            p.ecName],
        ['Relationship',    p.ecRel],
        ['Phone',           p.ecPhone],
        ['Alternate phone', p.ecAlt]
      ].filter(x => String(x[1] || '').trim());
      const here = [
        ['Address in the UAE', p.uaeAddr],
        ['Personal email',     p.pemail ? `<a href="mailto:${esc(p.pemail)}">${esc(p.pemail)}</a>` : '', true],
        own ? ['Personal mobile', p.mobile
                ? `${esc(p.mobile)} <span class="pill mute">not shown to colleagues</span>` : '', true]
            : null
      ].filter(Boolean).filter(x => String(x[1] || '').trim());
      const D = profDone(who);
      const panel = (h, hint, list) => `<section class="panel">
        <header><h3>${h}</h3>${hint ? `<span class="hint">${hint}</span>` : ''}</header>
        <div class="pad">${list.length
          ? `<dl class="kv wide">${list.map(x =>
              `<dt>${esc(x[0])}</dt><dd>${x[2] ? x[1] : esc(x[1])}</dd>`).join('')}</dl>`
          : `<p style="margin:0;color:var(--ink3)">Nothing on file yet</p>`}</div></section>`;
      const any = here.length || home.length || emg.length;
      return `<div class="grid g3">
        ${panel('Where they live', 'in the UAE', here)}
        ${panel('Back home', '', home)}
        ${panel('In an emergency', 'who we call', emg)}
      </div>`
      + (any ? '' : `<p class="cap" style="color:var(--ink3);font-size:13px;margin:0;border:0;padding:2px 0 0">
          ${esc(NM(who))} has not filled in a profile yet \u2014 ${D.total - D.done} of ${D.total} things still to go.</p>`);
    })()}
    ${(() => {
      /* Avin: 'it should be viewed only by Miraziz and me'. canAdmin is
         accounts and the owner, which is exactly those two today and stays
         right if a second accounts person is ever added. A colleague opening
         the same card sees the six boxes above and no sign that these exist. */
      if(!canAdmin(state.user)) return '';

      const kv = rows => `<div class="pad"><dl class="kv wide">${rows
        .map(r => `<dt>${esc(r[0])}</dt><dd>${r[1]}</dd>`).join('')}</dl></div>`;
      const box = (h, hint, rows) => `<section class="panel">
        <header><h3>${esc(h)}</h3>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</header>
        ${kv(rows)}</section>`;
      const dim = t => `<span style="color:var(--ink3)">${esc(t)}</span>`;
      /* Whole months between two dates, which is how a raise is talked about
         for the first two years and how long ago it was after that. */
      const monthsSince = iso => {
        if(!iso) return null;
        const t = HDATE();
        let m = (+t.slice(0,4) - +iso.slice(0,4)) * 12 + (+t.slice(5,7) - +iso.slice(5,7));
        if(+t.slice(8,10) < +iso.slice(8,10)) m--;
        return Math.max(0, m);
      };
      const spell = m => m === null ? '' : m < 1 ? 'this month'
        : m < 12 ? m + ' month' + (m === 1 ? '' : 's')
        : (m % 12 === 0 ? (m / 12) + ' year' + (m === 12 ? '' : 's')
           : Math.floor(m / 12) + ' year' + (m >= 24 ? 's' : '') + ' ' + (m % 12) + ' month' + (m % 12 === 1 ? '' : 's'));

      // ---------------------------------------------------------- what they are paid
      const basis = BASISOF(who);
      const S = salParts(who);
      const pay = [];
      if(basis === 'commission'){
        pay.push(['On payroll as', 'Commission only ' + dim('\u2014 no salary on file')]);
      } else if(basis === 'off'){
        pay.push(['On payroll as', 'Not on payroll ' + dim('\u2014 on the staff list, off the run')]);
      } else if(!S || !S.co || !S.co.length){
        pay.push(['Current salary', dim('nothing on file')]);
      } else {
        const one = S.co.length === 1;
        pay.push(['Current salary',
          `<b style="font-size:15px">AED ${money(S.salary,2)}</b> a month`]);
        S.co.forEach(c => pay.push([one ? 'Made up of' : esc(c.label),
          `${money(c.basic,2)} basic &middot; ${money(c.allow,2)} allowance`
          + (one ? '' : ` ${dim('\u2014 ' + money(c.salary,2))}`)]));
        const lead = S.co[0] || {};
        pay.push(['Running since', esc(lead.from || '') || dim('not dated')]);
        /* The revision is the row before the one in force. Somebody still on
           their first salary has none, and saying so is better than a dash
           that could mean either. */
        const pv = lead.prev;
        if(pv){
          const rise = Math.round((lead.salary - pv.salary) * 100) / 100;
          pay.push(['Last revision',
            `${money(pv.salary,2)} <span style="color:var(--ink3)">&rarr;</span> <b>${money(lead.salary,2)}</b>`]);
          pay.push(['', dim((rise >= 0 ? 'a rise of ' : 'a cut of ') + money(Math.abs(rise),2)
            + (pv.salary ? ' \u00b7 ' + Math.round(Math.abs(rise) / pv.salary * 100) + '%' : ''))]);
        } else {
          pay.push(['Last revision', dim('none on file \u2014 this is the first figure')]);
        }
        const m = monthsSince(lead.on);
        if(m !== null) pay.push(['Time since',
          esc(spell(m)) + (m >= 12 ? ' <span class="pill warn">due a review</span>' : '')]);
        (S.ahead || []).forEach(a => pay.push(['Already agreed',
          `<b>${money(a.salary,2)}</b> from ${esc(a.from)}`]));
      }

      // -------------------------------------------------------- leave and air tickets
      const B = leaveBal(who);
      const lv = [];
      lv.push(['Annual leave balance', `<b style="font-size:15px">${(B.left||0).toFixed(1)} days</b>`]);
      lv.push(['Made up of', dim(`${(B.carried||0).toFixed(1)} carried \u00b7 ${(B.accrued||0).toFixed(1)} earned \u00b7 ${(B.taken||0).toFixed(1)} taken`)]);
      /* The three most recent that have actually started. A booking for next
         month is on the card already, under Next booked off. */
      const past = (HR().requests || [])
        .filter(r => r.who === who && r.status === 'Approved' && r.from <= HDATE())
        .sort((a, b) => a.from < b.from ? 1 : -1).slice(0, 3);
      if(past.length) past.forEach((r, i) => lv.push([i ? '' : 'Last three taken',
        `${esc(dayLabel(r.from))} \u2013 ${esc(dayLabel(r.to))} ${esc(String(r.to).slice(0,4))}`
        + ` ${dim('\u00b7 ' + (r.days === null ? '' : r.days + ' day' + (r.days === 1 ? '' : 's') + ' \u00b7 ') + reqLabel(r.type).toLowerCase())}`]));
      else lv.push(['Last three taken', dim('none taken yet')]);
      const tk = (DATA.tickets.employees || []).find(e => e.portalName === who || e.name === who);
      if(tk){
        const h = (DATA.tickets.history || {})[tk.id] || (DATA.tickets.history || {})[who] || {rows: []};
        const last = (h.rows || [])[(h.rows || []).length - 1];
        lv.push(['Air tickets paid', (h.rows || []).length
          ? `${h.rows.length} ${dim('\u00b7 last ' + last[1] + ', AED ' + money(last[2],2))}`
          : dim('none yet')]);
        lv.push(['Next air ticket due', tk.next
          ? `${esc(tk.next)} ${tk.status ? `<span class="pill mute">${esc(tk.status.toLowerCase())}</span>` : ''}`
          : dim(tk.status || 'not scheduled')]);
      } else {
        lv.push(['Air tickets', dim('not on the scheme')]);
      }

      // ---------------------------------------------------------------- visa
      const D = (HR().docs || {})[who] || {};
      const vco = visaCoOf(who);
      const KINDS = [['visa','Residency visa'],['eid','Emirates ID'],
                     ['passport','Passport'],['labour','Labour card']];
      const doc = KINDS.map(([k, label]) => {
        const v = D[k];
        if(!v) return [label, dim('\u2014 not on file')];
        const d = dTo(v);
        const pill = d === null ? '' : d < 0 ? ' <span class="pill bad">expired</span>'
          : d <= 60 ? ` <span class="pill warn">${d} day${d === 1 ? '' : 's'}</span>`
          : d <= 183 ? ` <span class="pill warn">${Math.round(d / 30)} months</span>` : '';
        const col = d === null ? '' : d < 0 ? 'var(--bad)' : d <= 60 ? 'var(--warn)' : '';
        return [label, `<b${col ? ` style="color:${col}"` : ''}>${esc(dayLabel(v))} ${esc(String(v).slice(0,4))}</b>${pill}`];
      });
      doc.push(['Sponsored by', esc(vco.name)]);

      return `<div class="grid g3">
        ${box('What they are paid', 'accounts and the owner', pay)}
        ${box('Leave and air tickets', '', lv)}
        ${box('Visa and documents', 'expiry only', doc)}
      </div>`;
    })()}
    <p class="cap" style="color:var(--ink3);font-size:13px;margin:0">${canAdmin(state.user)
      ? `Everyone in the group can see the boxes above. <b>The three below the line are yours and the owner&rsquo;s
         alone</b> &mdash; pay, leave and document expiry are not on a colleague&rsquo;s view of this page and never
         are, and neither are document numbers, personal mobiles, or the year of somebody&rsquo;s birth.`
      : `Everyone in the group can see this page. Documents, document numbers, pay and the year of somebody&rsquo;s
         birth are not on it and never are &mdash; those are accounts&rsquo; and the person&rsquo;s own. Personal
         mobiles are not on it either: colleagues get the work number.
         ${SEESALL(who) ? '' : `If something here is wrong about you, it is yours to fix on <b>My profile</b>.`}`}</p>`;
  }

  // ---- the directory ----
  const TABSP = [['corplex','CorpLex'],['poa','POA'],['lex','Lex Estates'],
                 ['all','Everyone'],['org','Organisation']];
  // no tab chosen yet means the viewer's own company, if they have one here
  const myCo = companyOf(state.user).key;
  const ptab = TABSP.some(t=>t[0]===state.peopleTab) ? state.peopleTab
             : (TABSP.some(t=>t[0]===myCo) ? myCo : 'all');
  const bar = `<div class="seg segbig" id="peopleSeg">${TABSP.map(([v,l])=>
    `<button data-pt="${v}" aria-pressed="${ptab===v}" type="button"${
      v==='org'?' class="orgtab"':''}>${esc(l)}</button>`).join('')}</div>`;
  if(ptab === 'org') return bar + vOrg();

  const today = HDATE();
  const q = (state.peopleQ || '').trim().toLowerCase();
  const match = n => !q || [n, titleOf(n), companyOf(n).name, workEmail(n), orgDeptOf(n)]
    .join(' ').toLowerCase().includes(q);
  const inTab = n => ptab === 'all' || companyOf(n).key === ptab;
  const byCo = {};
  roll.filter(n=>inTab(n) && match(n)).sort().forEach(n=>{ const k = companyOf(n).name; (byCo[k]=byCo[k]||[]).push(n); });
  const order = ['CorpLex','POA','Lex Estates'].filter(k=>byCo[k]).concat(Object.keys(byCo).filter(k=>!['CorpLex','POA','Lex Estates'].includes(k)));
  const shown = roll.filter(n=>inTab(n) && match(n)).length;

  // today at a glance, across all three companies
  const tracked = roll.filter(tracksAtt);
  const nowk = tracked.map(n=>dayStatus(n, today).k);
  const cnt = k => nowk.filter(x=>x===k).length;
  const holsAhead = (HR().holidays||[]).filter(h=>h.d>=today).slice(0,3);

  // the fortnight strip runs from two days back
  const days = []; { let d=new Date(today+'T00:00:00'); d.setDate(d.getDate()-2);
    for(let i=0;i<16;i++){ days.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); } }
  const tint = k => `color-mix(in srgb, ${STCOL[k]||'var(--line)'} 22%, var(--panel))`;
  const avail = tracked.filter(n=>inTab(n) && match(n));

  return bar + `
  <div class="strip">
    <div class="stat"><span class="k">In the office today</span><span class="v" style="color:var(--c1)">${cnt('Office')}</span>
      <span class="n">of ${tracked.length} people across the group</span></div>
    <div class="stat"><span class="k">Working from home</span><span class="v" style="color:var(--c3)">${cnt('WFH')}</span>
      <span class="n">approved in advance</span></div>
    <div class="stat"><span class="k">On leave</span><span class="v" style="color:var(--accent2)">${LEAVEONLY().reduce((t,x)=>t+cnt(x.id),0)}</span>
      <span class="n">annual, sick or unpaid</span></div>
    <div class="stat"><span class="k">Next public holiday</span>
      <span class="v" style="font-size:17px;font-family:'IBM Plex Sans',sans-serif">${holsAhead.length?esc(dayLabel(holsAhead[0].d)):'\u2014'}</span>
      <span class="n">${holsAhead.length?esc(holsAhead[0].n):'none left in 2026'}</span></div>
  </div>

  <section class="panel">
    <header><h3>${ptab === 'all' ? 'Everyone' : esc((DATA.companies[ptab]||{}).name || 'Everyone')}</h3>
      <span class="hint">${shown} of ${roll.filter(inTab).length} ${shown===1?'person':'people'}</span></header>
    <div class="pad" style="padding-bottom:6px">
      <input id="peopleQ" placeholder="Search a name, a job title, a company" value="${esc(state.peopleQ||'')}" style="max-width:420px">
    </div>
  </section>
  ${order.map(k=>`
  <section class="panel">
    <header><h3>${esc(k)}</h3><span class="hint">${byCo[k].length}</span></header>
    <div class="pad">
      <div class="pgrid">${byCo[k].map(n=>{ const st = statusNow(n);
        return `<button class="pcard" data-who="${esc(n)}" type="button">
          ${avatar(n)}
          <span class="pn">${nm(n)}</span>
          <span class="pt">${esc(titleOf(n) || ROLELABEL[roleOf(n)])}</span>
          <span class="ps" style="color:${st.c}">&#9679; ${esc(st.t)}</span>
        </button>`;}).join('')}</div>
    </div>
  </section>`).join('')}
  ${shown ? '' : `<section class="panel"><div class="pad" style="padding:44px 24px;text-align:center;color:var(--ink3)">Nobody matches \u201c${esc(state.peopleQ||'')}\u201d.</div></section>`}

  ${avail.length ? `<section class="panel">
    <header><h3>The next two weeks</h3><span class="hint">planned leave and working from home${q?' &middot; matching your search':''}</span></header>
    ${byCompany(avail, {
      who: n => n, cls: 'availtable',
      cols: colsOf([22].concat(days.map(() => 78 / days.length))),
      head: `<thead><tr><th>Name</th>${days.map(d=>`<th class="r${d===today?' av-today':''}"><span>${esc(dayName(d).slice(0,2))}</span><b>${esc(dayLabel(d).slice(0,2))}</b></th>`).join('')}</tr></thead>`,
      row: n => `<tr><td>${whoLink(n)}</td>${days.map(d=>{
        const ds = dayStatus(n, d), short = STSHORT[ds.k] || '';
        return `<td class="av${d===today?' av-today':''}${ds.k==='Weekend'?' av-we':''}" style="background:${['Weekend','Planned','Office'].includes(ds.k)?'transparent':tint(ds.k)}"
          title="${esc(n)} \u2014 ${esc(dayLabel(d))}: ${esc(ds.label||ds.k)}">${short}</td>`;
      }).join('')}</tr>`,
      empty: 'Nothing planned in the next two weeks.'
    })}
    <div class="pad" style="padding-top:12px">${
      [['Office','In the office'],['WFH','From home (H)'],['Annual','Annual (A)'],['Sick','Sick (S)'],['Unpaid','Unpaid (U)'],['Bereavement','Bereavement (B)'],['Birthday','Birthday (\u00bd)'],['Maternity','Maternity (M)'],['Hajj','Hajj (J)'],['Umrah','Umrah (O)'],['Holiday','Public holiday (\u2605)']]
      .map(([k,l])=>`<span class="lgd"><i style="background:${STCOL[k]}"></i>${l}</span>`).join('')}</div>
    <p class="cap">Everyone sees everyone &mdash; the three companies share an office, so leave, working from home and public holidays are shown across the group. Sales, commission and payroll stay company by company. Public holidays marked \u2605 still need confirming against the official 2026 dates.</p>
  </section>` : ''}`;
}

function vHRAdmin(){
  const P = DATA.payroll;
  const ym = state.attMonth || P.monthKey || HDATE().slice(0,7);
  const samePay = ym === P.monthKey;
  const list = USERS.map(x=>x.name).filter(tracksAtt);
  const rows = list.map(n=>{
    const S = monthSummary(n, ym);
    const pr = payrollRowFor(n);
    return {n, S, typed: (pr && samePay) ? pr.days : null, diff: (pr && samePay) ? S.payDays - pr.days : null};
  });
  const flags = rows.filter(r=>r.diff!==null && r.diff!==0);
  const pend = HR().requests.filter(r=>r.status==='Pending');

  return `
  <div class="strip">
    <div class="stat"><span class="k">Present today</span><span class="v">${list.filter(n=>['Office','WFH'].includes(dayStatus(n,HDATE()).k)).length}</span>
      <span class="n">of ${list.length} people</span></div>
    <div class="stat"><span class="k">Requests waiting</span><span class="v" style="color:var(--${pend.length?'warn':'good'})">${pend.length}</span>
      <span class="n">with their managers, not with you</span></div>
    <div class="stat"><span class="k">Payroll differences</span><span class="v" style="color:var(--${flags.length?'warn':'good'})">${flags.length}</span>
      <span class="n">calculated days vs the file you uploaded</span></div>
  </div>

  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>${esc(MONTHNAME[+ym.slice(5)-1])} ${ym.slice(0,4)} attendance</h3>
      <div class="seg" id="attMonthSeg" style="margin-left:auto">
        ${['2026-08','2026-09'].map(m=>`<button data-am="${m}" aria-pressed="${ym===m}" type="button">${MONTHNAME[+m.slice(5)-1]}</button>`).join('')}
      </div></header>
    ${byCompany(rows, {
      who: r => r.n, cls: 'invtable',
      cols: colsOf([12.5, 9, 6, 6, 6.5, 5.5, 6.5, 9, 5.5, 6.5, 8, 8, 10.5]),
      head: `<thead><tr><th>Employee</th><th>Shift</th><th class="r">Office</th><th class="r">Home</th>
        <th class="r">Annual</th><th class="r">Sick</th><th class="r">Unpaid</th><th class="r">Unexplained</th>
        <th class="r">Late</th><th class="r">Hours</th><th class="r">Days calculated</th><th class="r">In the ${esc(P.month.split(' ')[0])} file</th><th>Check</th></tr></thead>`,
      empty: 'Nobody has attendance this month.',
      row: r => `<tr>
        <td>${nm(r.n)}</td><td class="n nw" style="color:var(--ink2)">${esc(shiftOf(r.n).start)}&ndash;${esc(shiftOf(r.n).end)}</td>
        <td class="n r">${r.S.office}</td><td class="n r">${r.S.wfh||'—'}</td>
        <td class="n r">${r.S.annual||'—'}</td><td class="n r">${r.S.sick||'—'}</td>
        <td class="n r"${r.S.unpaid?' style="color:var(--warn);font-weight:600"':''}>${r.S.unpaid||'—'}</td>
        <td class="n r"${r.S.absent?' style="color:var(--bad);font-weight:600"':''}>${r.S.absent||'—'}</td>
        <td class="n r">${r.S.late||'—'}</td><td class="n r">${hhmm(r.S.worked)}</td>
        <td class="n r netcol">${r.S.payDays}</td>
        <td class="n r">${r.typed===null?'—':r.typed}</td>
        <td class="nw">${r.diff===null?`<span class="pill mute">${samePay?'not on the run':'no run for this month'}</span>`
          : r.diff===0?'<span class="pill good"><span class="dt"></span>Matches</span>'
          : `<span class="pill warn"><span class="dt"></span>${r.diff>0?'+':''}${r.diff} day${Math.abs(r.diff)===1?'':'s'}</span>`}</td></tr>`
    })}
    <p class="cap">${samePay?'':'<b>You are looking at '+esc(MONTHNAME[+ym.slice(5)-1])+', and the payroll on file is '+esc(P.month)+'</b>, so there is nothing to compare against yet. '}<b>Suggestion only.</b> The portal never changes the payroll. It works out days as 30 less unpaid leave and unexplained absence, and shows that beside the <b>Working days</b> column in the file you uploaded, so a difference is something to look at rather than something to accept.</p>
  </section>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Shifts and reporting lines</h3>
        <span class="hint">${EDITING('shifts') ? 'change a shift or a reporting line' : 'who receives whose requests'}</span>
        ${edBar('shifts')}</header>
      ${edSaved('shifts')}${edConfirm('shifts')}
      ${byCompany(list, {
        who: n => n,
        cols: colsOf([30, 34, 36]),
        head: `<thead><tr><th>Employee</th><th>Shift</th><th>Reports to</th></tr></thead>`,
        row: n => `<tr><td class="nw">${nm(n)}</td>
          <td>${edCell('shifts', 's|' + n,
            v => `<select class="ff"${edAttr('shifts', 's|' + n)} style="padding:3px 8px;font-size:12.5px">
              ${SHIFTS().map(s=>`<option value="${esc(s.id)}"${v===s.id?' selected':''}>${esc(s.label)} &middot; ${esc(s.start)}&ndash;${esc(s.end)}</option>`).join('')}
            </select>`,
            v => { const s = SHIFTS().find(x=>x.id===v);
                   return s ? `<span class="edread">${esc(s.label)} &middot; ${esc(s.start)}&ndash;${esc(s.end)}</span>`
                            : '<span class="edread none">none set</span>'; })}</td>
          <td>${edCell('shifts', 'm|' + n,
            v => `<select class="ff"${edAttr('shifts', 'm|' + n)} style="padding:3px 8px;font-size:12.5px">
              <option value="">Nobody &mdash; requests have nowhere to go</option>
              ${USERS.map(x=>x.name).filter(m=>m!==n).map(m=>`<option value="${esc(m)}"${v===m?' selected':''}>${esc(NM(m))}</option>`).join('')}
            </select>`,
            v => v ? `<span class="edread">${nm(v)}</span>`
                   : '<span class="pill warn"><span class="dt"></span>nobody yet</span>')}</td></tr>`,
        empty: 'Nobody on the shift list yet.'
      })}
      <p class="cap">Three shifts: ${SHIFTS().map(s=>esc(s.label)+' '+esc(s.start)+'–'+esc(s.end)).join(', ')}. Late arrival is measured against the person's own shift start plus ${HR().hours.grace} minutes.
        <b>Both columns save the moment you change them</b> \u2014 there is no button, and nothing here needs approving.
        The second column is the reporting line: it is who receives that person's leave and work-from-home requests, and
        anything already waiting moves with it. Nobody can be set to report to themselves, or into a circle.${
        (() => { /* Somebody with no line above them and people below is the top of the
                    tree and is meant to be blank; anybody else with a blank line has
                    requests going nowhere. */
          const none = list.filter(n => !mgrName(n) && reportsTo(n).length === 0);
          return none.length ? ` <b style="color:var(--warn)">${none.length} ${none.length === 1 ? 'person has' : 'people have'} nobody to send requests to</b> \u2014 ${esc(none.map(n => NM(n)).join(', '))}.` : ''; })()}</p>
    </section>
  </div>

  <section class="panel">
    <header><h3>Annual leave balances</h3>
      <span class="pill mute">${HR().leavePolicy.annualDays} working days &middot; ${HR().leavePolicy.accrualPerMonth} a month</span>
      <span class="hint">${EDITING('carry') ? 'change what each person carried forward' : 'what each person carried forward'}</span>
      ${edBar('carry')}</header>
    ${edSaved('carry')}${edConfirm('carry')}
    ${byCompany(list.filter(n=>!noLeave(n)), {
      who: n => n,
      cols: colsOf([19, 11, 20, 11, 10, 10, 9.5, 9.5]),
      note: rs => `${Math.round(rs.reduce((s,n)=>s+leaveBal(n).left,0)*100)/100} days available`,
      head: `<thead><tr><th>Employee</th><th>Joined</th><th>Leave year</th><th class="r">On 31 Aug 2026</th>
        <th class="r">Credited since</th><th class="r">Taken since</th><th class="r">Available</th><th class="r">Requested</th></tr></thead>`,
      row: n => { const B = leaveBal(n); return `<tr>
        <td>${esc(n)}</td>
        <td class="n nw">${esc(B.doj)||'<span style="color:var(--ink3)">not on file</span>'}</td>
        <td class="nw"${full(B.yearNo?`Year ${B.yearNo}, to ${dayLabel(B.yearEnd)} ${B.yearEnd.slice(0,4)}`:'')}>${B.yearNo?`Year ${B.yearNo}, to ${esc(dayLabel(B.yearEnd))} ${B.yearEnd.slice(0,4)}`:'<span style="color:var(--ink3)">needs a joining date</span>'}</td>
        <td class="n r">${edCell('carry', n,
          v => `<input class="ff cfin" type="number" step="0.01"${edAttr('carry', n)} value="${esc(String(v))}" placeholder="\u2014">`,
          v => String(v) === '' ? '<span class="edread none">\u2014</span>' : '<span class="edread">' + money(+v, 2) + '</span>')}</td>
        <td class="n r">${B.noDoj?'—':B.accrued}</td><td class="n r">${B.taken||'—'}</td>
        <td class="n r netcol"${B.left<0?' style="color:var(--bad)"':''}>${B.noDoj?'—':B.left}</td>
        <td class="n r">${B.pendDays||'—'}</td></tr>`; },
      foot: rs => `<tr class="tot"><td>${rs.length} on the scheme</td><td></td><td></td>
        <td class="n r">${Math.round(rs.reduce((s,n)=>s+leaveBal(n).carried,0)*100)/100}</td>
        <td class="n r">${Math.round(rs.reduce((s,n)=>s+leaveBal(n).accrued,0)*100)/100}</td>
        <td class="n r">${rs.reduce((s,n)=>s+leaveBal(n).taken,0)}</td>
        <td class="n r netcol">${Math.round(rs.reduce((s,n)=>s+leaveBal(n).left,0)*100)/100}</td>
        <td class="n r">${rs.reduce((s,n)=>s+leaveBal(n).pendDays,0)}</td></tr>`,
      empty: 'Nobody is on the leave scheme yet.'
    })}
    <p class="cap">${esc(HR().leavePolicy.note)} Accrual runs from each person's own joining date, so their leave year is their anniversary rather than January. Leave taken is counted in working days &mdash; weekends and public holidays inside a request do not come off the balance. Anyone without a joining date on file accrues nothing until it is added. A <b style="color:var(--bad)">negative balance</b> is not an error &mdash; it means leave was taken in a year that has only just started, and the days carried forward from the year before have not been entered yet.</p>
  </section>

  <section class="panel">
    <header><h3>Other leave balances</h3>
      <span class="pill mute">${OTHERKINDS().length} kinds</span>
      <span class="hint">what each person has left, not what they have taken</span></header>
    ${(() => {
      /* The columns are ordered by the group they sit under, not by the order
         the kinds happen to be declared in — otherwise the two heading rows
         disagree and unpaid leave ends up printed under "Paid". */
      const ALL = OTHERKINDS();
      const paid = ALL.filter(t => t.pay !== 'none');
      const free = ALL.filter(t => t.pay === 'none');
      const KINDS = paid.concat(free);
      /* The name needs about a fifth; the rest is shared out between the
         figures so that no column is wider than the number it holds. */
      const each = KINDS.length ? Math.min(12, (100 - 22) / KINDS.length) : 0;
      const cols = [100 - each * KINDS.length].concat(KINDS.map(() => each));
      const roll = list.filter(n => !isPartner(n));
      const short = roll.filter(n => { const p = PROF(n) || {}; return !p.gender || !p.marital; });
      const cell = (n, t) => { const b = otherBal(n, t.id);
        return `<td class="n r${b.off ? ' obdash' : ''}"${full(b.why)}${
          b.n !== null && b.n < 0 ? ' style="color:var(--bad)"' : ''} data-always="1">${esc(b.txt)}</td>`; };
      return byCompany(roll, {
        who: n => n,
        cols: colsOf(cols),
        cls: 'obtab',
        note: rs => `${rs.length} ${rs.length === 1 ? 'person' : 'people'}`,
        head: `<thead>
          <tr class="obgrp"><th></th>
            <th class="r" colspan="${paid.length}">Paid</th>
            <th class="r" colspan="${free.length}">Not paid</th></tr>
          <tr><th>Employee</th>${KINDS.map(t =>
            `<th class="r"${full(t.note || '')}>${esc(t.label.replace(/ leave$/i, ''))}</th>`).join('')}</tr>
        </thead>`,
        row: n => `<tr><td${full(NM(n) === n ? '' : n)}>${nm(n)}</td>${KINDS.map(t => cell(n, t)).join('')}</tr>`,
        empty: 'Nobody is on the leave scheme yet.'
      }) + `<p class="cap">Every figure is what is <b>still available</b>, so a zero means it has been used up.
        Unpaid leave has no entitlement to draw on \u2014 Avin: <i>we cant keep a fixed number of days</i> \u2014 so
        its balance is the days already taken, shown <b style="color:var(--bad)">below zero</b>.
        A <b>dash is not a zero</b>: it means the policy was never written for that person, and the reason is on the
        hover \u2014 maternity is for married female employees, paternity for married male employees, and study
        leave needs two years of service. <b>Umrah has no column</b> because it comes off the annual balance above
        rather than having one of its own.${
        short.length ? ` <b>${short.length} ${short.length === 1 ? 'profile has' : 'profiles have'} no gender or marital status on file</b>
          \u2014 ${esc(short.map(n => NM(n)).join(', '))} \u2014 so the portal cannot yet say whether maternity or paternity
          leave applies to ${short.length === 1 ? 'them' : 'any of them'}.` : ''} Sick leave follows the law:
        the full-pay days are counted here, and the half-pay and unpaid days that follow them are on the hover.</p>`;
    })()}
  </section>

  <section class="panel">
    <header><h3>Public holidays ${String(HDATE()).slice(0,4)}</h3>
      <span class="pill mute">${(HR().holidays||[]).length} days</span>
      <span class="hint">${canUpload(state.user)
        ? 'the dates that move need confirming each year' : 'accounts keeps these'}</span>
      ${canUpload(state.user) ? edBar('hols') : ''}</header>
    ${edSaved('hols')}${edConfirm('hols')}
    <div class="tw"><table class="cotab">
      ${colsOf([16, 11, 34, 21, 12])}
      <thead><tr><th>Date</th><th>Day</th><th>Holiday</th><th>Kind</th><th></th></tr></thead>
      <tbody>${(HR().holidays||[]).map(h=>{
        const gone = EDITING('hols') && state.edit.draft['x|' + h.d] === 'x';
        return `<tr${gone ? ' class="edgone"' : (h.d<HDATE()?' style="color:var(--ink3)"':'')}>
        <td>${edCell('hols', 'd|' + h.d,
          v => `<input class="ff" type="date"${edAttr('hols', 'd|' + h.d)} value="${esc(v)}">`,
          v => '<span class="edread">' + esc(dayLabel(v || h.d)) + ' ' + String(v || h.d).slice(0,4) + '</span>')}</td>
        <td class="nw">${esc(dayName(h.d))}</td>
        <td>${edCell('hols', 'n|' + h.d,
          v => `<input class="ff"${edAttr('hols', 'n|' + h.d)} value="${esc(v)}">`,
          v => '<span class="edread">' + esc(v) + '</span>')}</td>
        <td>${edCell('hols', 'k|' + h.d,
          v => `<select class="ff"${edAttr('hols', 'k|' + h.d)}>
              <option value="1"${v==='1'?' selected':''}>Fixed date</option>
              <option value="0"${v==='1'?'':' selected'}>Moves with the moon</option>
            </select>`,
          v => v==='1' ? '<span class="pill good"><span class="dt"></span>Fixed date</span>'
                       : '<span class="pill warn"><span class="dt"></span>Moves with the moon</span>')}</td>
        <td class="r">${EDITING('hols')
          ? `<button class="btn ghost sm" data-edt="hols" data-edrm="x|${esc(h.d)}" type="button">${
              gone ? 'Keep it' : 'Remove'}</button>`
          : ''}</td></tr>`;}).join('')}
      </tbody></table></div>
    ${canUpload(state.user) ? `<div class="pad" style="padding-top:14px">
      <div class="grid g3" style="gap:12px;align-items:end">
        <div class="field" style="margin:0"><label for="holNewD">Add a holiday</label>
          <input id="holNewD" type="date" value="${esc(state.holNew && state.holNew.d || '')}"></div>
        <div class="field" style="margin:0"><label for="holNewN">What it is called</label>
          <input id="holNewN" value="${esc(state.holNew && state.holNew.n || '')}" placeholder="Eid Al Fitr"></div>
        <div class="drow" style="margin:0">
          <button class="btn" id="holAdd" type="button"${(state.holNew && state.holNew.d && state.holNew.n)?'':' disabled'}>Add</button>
        </div>
      </div>
    </div>` : ''}
    <p class="cap">The Islamic holidays shift each year and are announced by the government, which is why they
      are marked as moving &mdash; check those against the official calendar before anyone relies on them.
      A holiday is the same for all three companies, it does not come off anybody&rsquo;s leave balance, and a
      day of leave that falls on one is not counted against it. Moving a date deletes the old one and writes
      the new, because that is what moving it is.</p>
  </section>`;
}

/* ---------- documents, letters, loans, exits ---------- */
const DOCTYPES = () => HR().docTypes || [];
const docsOf = u => (HR().docs||{})[u] || null;
const dTo = ds => ds ? Math.round((new Date(ds+'T00:00:00') - new Date(HDATE()+'T00:00:00'))/86400000) : null;
function docRows(u){
  const d = docsOf(u); if(!d) return [];
  return DOCTYPES().map(t=>{
    const exp = d[t.k] || '';
    const n = dTo(exp);
    return {k:t.k, label:t.label, exp, days:n, warn:t.warn,
      state: n===null ? 'none' : n < 0 ? 'expired' : n <= t.warn ? 'soon' : 'ok'};
  });
}
function allDocRows(){
  const out = [];
  USERS.map(x=>x.name).forEach(n=>docRows(n).forEach(r=>out.push({who:n, ...r})));
  (HR().companyDocs||[]).forEach(c=>{
    const n = dTo(c.expiry);
    out.push({who:(DATA.companies[Object.keys(DATA.companies).find(k=>DATA.companies[k].code===c.co)]||{name:c.co}).name,
      company:true, k:'co', label:c.name, exp:c.expiry, days:n, warn:90,
      state: n<0?'expired':n<=90?'soon':'ok'});
  });
  return out.filter(r=>r.exp).sort((a,b)=>a.days-b.days);
}
const DOCPILL = s => s==='expired' ? '<span class="pill bad"><span class="dt"></span>Expired</span>'
  : s==='soon' ? '<span class="pill warn"><span class="dt"></span>Expiring</span>'
  : '<span class="pill good"><span class="dt"></span>Valid</span>';
const inWord = n => n<0 ? Math.abs(n)+' day'+(Math.abs(n)===1?'':'s')+' ago' : n===0 ? 'today' : 'in '+n+' day'+(n===1?'':'s');

/* The contractual monthly salary and its split. The payroll row holds what was PAID
   in the month, which is pro-rated — never the master salary. Basic comes from the
   person's own salary revision letter where we have one, and falls back to the 60/40
   house split, flagged as assumed, where we do not. */
/* What is on file for somebody. The three headline figures are the total
   across every company that pays them; `co` is the breakdown, one entry per
   company, and `ahead` is anything already agreed but not yet in force. For
   the great majority `co` has one entry and nothing else changes. */
function salParts(name){
  const p = (DATA.master.parts||{})[name];
  if(p) return {salary:p.salary, basic:p.basic, allow:p.allow, assumed:false,
                from:p.from||'', src:p.src||'',
                co: p.co||[], ahead: p.ahead||[], multi: !!p.multi};
  const r = payrollRowFor(name) || {};
  const days = r.days || 30;
  const salary = Math.round((r.salary||0) * 30 / days * 100)/100;
  const basic = Math.round(salary * DATA.master.basicPct * 100)/100;
  return {salary, basic, allow: Math.round((salary-basic)*100)/100, assumed:true,
          from:'', src:'', co:[], ahead:[], multi:false};
}
/* The company a revision is for. One company and it is decided; more than one
   and the form has to ask, because a revision against the wrong one writes a
   salary row that belongs to nobody. */
const salCos = n => (salParts(n).co || []);
function revCo(){
  const g = state.revForm || {}, cos = salCos(g.who);
  if(!cos.length) return '';
  return cos.some(c => c.company === g.co) ? g.co : cos[0].company;
}
const revCoPart = () => (salCos((state.revForm||{}).who)
  .find(c => c.company === revCo()) || salParts((state.revForm||{}).who));
const salPartsRow = r => salParts(r.name);

const MONFULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function effLabel(iso){
  if(!iso) return '—';
  const m = +iso.slice(5,7), y = iso.slice(0,4), d = +iso.slice(8,10);
  return d === 1 ? `${MONFULL[m-1]} ${y}` : `${dayLabel(iso)} ${y}`;
}
const LTYPE = id => (HR().letterTypes||[]).find(t=>t.id===id) || {label:id, body:''};
function letterFill(l){
  const r = payrollRowFor(l.who) || {};
  const ent = visaEnt(l.who);
  const P = salParts(l.who);
  return LTYPE(l.type).body
    .replace('{name}', legalOf(l.who)).replace('{legal}', ent.legal).replace('{title}', r.title||'—')
    .replace('{doj}', r.doj||'—').replace('{salary}', money(P.salary,2))
    .replace('{basic}', money(P.basic,2)).replace('{allow}', money(P.allow,2));
}

const LOANCAP = () => HR().loanThreshold || 3000;
const loanApprover = amt => amt < LOANCAP() ? ADMIN : (USERS.find(u=>u.role==='owner')||{}).name;
const loanLeft = l => Math.round((l.amount - (l.paid||0))*100)/100;
function loansOf(u){ return (HR().loans||[]).filter(l=>l.who===u); }
function myLoanName(u){
  const r = payrollRowFor(u); return r ? r.name : u;
}

function exitCalc(name, lwd, o){
  const r = payrollRowFor(name); if(!r || !lwd) return null;
  const B = leaveBal(name), j = parseDoj(r.doj);
  const P = salParts(name);
  // P.salary is the total across every company paying them; see the note above.
  const salary = P.salary, basic = P.basic;
  const dayBasic = basic/30;
  const start = j ? j.iso : '';
  const days = start ? Math.round((new Date(lwd+'T00:00:00') - new Date(start+'T00:00:00'))/86400000) : 0;
  const years = days/365;
  let grat = 0;
  if(years >= 1 && !noGratuity(name) && basic > 0){
    const first = Math.min(years,5) * 21 * dayBasic;
    const beyond = Math.max(0, years-5) * 30 * dayBasic;
    grat = Math.min(first+beyond, salary*24);
  }
  const leaveDays = Math.max(0, B.left);
  const leaveCash = leaveDays * dayBasic;
  const tk = (DATA.tickets.employees||[]).find(e=>e.portalName===name || e.name===name);
  const ticket = tk ? (tk.backlog||0) : 0;
  const adv = (HR().loans||[]).filter(l=>l.who===name && l.status==='Approved').reduce((s,l)=>s+loanLeft(l),0);
  const r2 = v => Math.round(v*100)/100;
  /* The things the portal cannot know: a bonus, a quarter's commission, a
     laptop that did not come back. Free lines rather than a list I invent. */
  const extra = (o && o.lines) || [];
  const addOn = r2(extra.filter(x => !x.deduct).reduce((s, x) => s + (+x.amount || 0), 0));
  const takeOff = r2(extra.filter(x => x.deduct).reduce((s, x) => s + (+x.amount || 0), 0));
  /* Payroll runs on a thirty-day month, so somebody who leaves on the 31st
     has worked a whole month and never thirty-one thirtieths of one. */
  const period = MONFULL[+lwd.slice(5,7)-1] + ' ' + lwd.slice(0,4);
  const worked = Math.min(30, +lwd.slice(8,10));
  /* LOP is loss of pay — unpaid leave — and not the part of the month that
     comes after somebody has left. The run's day count is thirty less any
     unpaid leave, so what it falls short by is the unpaid leave; the days
     after the last working day are simply not employment, and calling them
     lost pay would say on a signed document that the person was docked. */
  const runDays = (r.days === undefined || r.days === null) ? 30 : r.days;
  const lop = period === DATA.payroll.month ? Math.max(0, Math.min(worked, 30 - runDays)) : 0;
  const paidDays = Math.max(0, worked - lop);
  const mBasic = r2(basic * paidDays / 30);
  const mAllow = r2((salary - basic) * paidDays / 30);
  const monthPay = r2(mBasic + mAllow);
  return {row:r, doj:r.doj, start, lwd, days, years, salary, basic, dayBasic:r2(dayBasic),
    grat:r2(grat), leaveDays, leaveCash:r2(leaveCash), ticket:r2(ticket), adv:r2(adv),
    period,
    paidDays, lop, mBasic, mAllow, monthPay,
    extra, addOn, takeOff,
    settleDate: (o && o.settled) || state.exitSettle || lwd,
    net: r2(monthPay + grat + leaveCash + ticket + addOn - takeOff - adv),
    capped: years>=1 && (grat >= salary*24 - 0.5)};
}

function vDocs(){
  const u = state.user, rows = docRows(u);
  const worst = rows.filter(r=>r.state!=='ok' && r.state!=='none').sort((a,b)=>a.days-b.days)[0];
  return `
  <div class="strip">
    ${rows.slice(0,4).map(r=>`<div class="stat"><span class="k">${esc(r.label)}</span>
      <span class="v" style="font-size:19px;font-family:'IBM Plex Sans',sans-serif;color:var(--${r.state==='expired'?'bad':r.state==='soon'?'warn':'ink'})">${r.exp?esc(dayLabel(r.exp))+' '+r.exp.slice(0,4):'—'}</span>
      <span class="n">${r.exp?esc(inWord(r.days)):'not on file'}</span></div>`).join('')}
  </div>

  <section class="panel">
    <header><h3>Your documents</h3>
      ${worst?`<span class="pill ${worst.state==='expired'?'bad':'warn'}"><span class="dt"></span>${worst.state==='expired'?'Something has expired':'Something is due'}</span>`
        :'<span class="pill good"><span class="dt"></span>All valid</span>'}
      <span class="hint">accounts and you &mdash; nobody else</span></header>
    <div class="tw"><table>
      <thead><tr><th>Document</th><th>Expires</th><th>When</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td class="nw">${esc(r.label)}</td>
        <td class="n nw">${r.exp?esc(dayLabel(r.exp))+' '+r.exp.slice(0,4):'—'}</td>
        <td class="nw" style="color:var(--ink2)">${r.exp?esc(inWord(r.days)):'not on file'}</td>
        <td>${r.exp?DOCPILL(r.state):'<span class="pill mute">Not on file</span>'}</td></tr>`).join('')}
      </tbody></table></div>
    <p class="cap">${HR().docs && HR().docs[u] && HR().docs[u].sample ? '<b>Sample dates.</b> Send accounts the real expiry dates and these fill in. ':''}The portal holds the expiry date, the copy you upload, and &mdash; since September 2026 &mdash; the number itself, for your Emirates ID, passport, residency visa and labour card. They are held because payroll, insurance and the MOHRE filings need them, and because a gap in your file is better found here than at a renewal counter. <b>Only you and accounts can see them</b>, on any screen; they are masked even there, and they never go in an email or on a list. Accounts will contact you before anything expires &mdash; you do not need to chase.</p>
  </section>`;
}

function vDocsEdit(){
  const q = (state.docQ || '').trim().toLowerCase();
  const types = DOCTYPES();
  const roll = USERS.map(x=>x.name).filter(n=>!q || n.toLowerCase().includes(q) || companyOf(n).name.toLowerCase().includes(q));
  const gaps = n => types.filter(t=>!((HR().docs||{})[n]||{})[t.k]).length + (eidOf(n)?0:1);
  const rows = roll.slice().sort((a,b)=>gaps(b)-gaps(a) || a.localeCompare(b));
  const left = USERS.map(x=>x.name).reduce((s,n)=>s+gaps(n),0);
  return `
  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Staff Documents</h3>
      <span class="pill ${left?'warn':'good'}"><span class="dt"></span>${left} still blank</span>
      <input id="docQ" placeholder="Find a name" value="${esc(state.docQ||'')}" style="margin-left:auto;max-width:220px;padding:5px 10px;font-size:13px">
      <button class="btn ghost edbtn" id="refShow" type="button">${state.refShow?'Hide the numbers':'Show the numbers'}</button>
      ${edBar('docs')}
    </header>
    ${edSaved('docs')}${edConfirm('docs')}
    ${(() => {
      /* The four, in the order Avin wrote them. */
      const ORDER = ['eid','passport','visa','labour'];
      const DOCS = ORDER.map(k => types.find(t => t.k === k)).filter(Boolean)
        .concat(types.filter(t => !ORDER.includes(t.k)));
      /* Thirteen columns wide plus the birth date, so the widths are set from
         what each one actually has to hold at the grid's own width. Two of
         those were sized wrong to begin with: the heading came out as
         "DOCUME…", and the number column was cut to fit a MASKED number
         when the width that matters is the one it needs with the numbers
         SHOWN — '784-1990-1234567-1' is eighteen characters and the point of
         the button is to read it. Avin: 'i want to see the numbers clearly'. */
      const each = (100 - 15.4 - 7.7) / (DOCS.length * 3);
      /* Second column, off the same passport as the rest of the row. A date
         held without a year still shows what there is, with the gap named,
         because 'not on file' would be a lie about a birthday everybody
         already wishes somebody. */
      const dobCell = n => {
        const key = n + '|dob|d';
        return `<td class="n b">${edCell('docs', key,
          x => `<input class="ff dt" type="date"${edAttr('docs', key)} value="${esc(x)}" max="${esc(HDATE())}">`,
          x => x ? `<span class="edread">${esc(dayLabel(x))} ${esc(String(x).slice(0,4))}</span>`
                 : bdayOf(n) ? `<span class="edread">${esc(bdayDM(n))}</span> <span class="pill warn">no year</span>`
                 : '<span class="miss">\u2014</span>')}</td>`;
      };
      const refCell = (n, k) => {
        const v = REFOF(n, k);
        return `<td class="num b">${edCell('docs', n + '|' + k + '|no',
          x => `<input class="ff"${edAttr('docs', n + '|' + k + '|no')} value="${esc(x)}" placeholder="\u2014">`,
          () => v ? `<span class="edread"${full(state.refShow ? '' : v)}>${esc(state.refShow ? v : maskRef(v))}</span>`
                  : '<span class="miss">\u2014</span>')}</td>`;
      };
      const expCell = (n, k) => {
        const v = ((HR().docs||{})[n]||{})[k] || '';
        const d = v ? dTo(v) : null;
        const col = d === null ? '' : d < 0 ? 'var(--bad)' : d <= 60 ? 'var(--warn)' : '';
        return `<td class="n">${edCell('docs', n + '|' + k + '|exp',
          x => `<input class="ff dt" type="date"${edAttr('docs', n + '|' + k + '|exp')} value="${esc(x)}"${col?` style="border-color:${col};color:${col}"`:''}>`,
          x => x ? `<span class="edread"${col?` style="color:${col}"`:''}>${esc(dayLabel(x))} ${esc(String(x).slice(0,4))}</span>`
                 : '<span class="miss">\u2014</span>')}</td>`;
      };
      const clip = (n, k) => {
        const f = fileOf(n, k);
        return `<td class="clipc">${f
          ? `<button class="clip on" data-docsee="${esc(n)}|${esc(k)}" type="button" title="Open the copy" aria-label="Open ${esc(NM(n))}&rsquo;s ${esc(k)}">\u{1F4CE}</button>`
          : `<span class="clip no" title="No copy on file" aria-label="No copy on file">\u{1F4CE}</span>`}</td>`;
      };
      return byCompany(rows, {
        who: n => n, cls: 'dgrid',
        cols: colsOf([15.4, 7.7].concat([].concat(...DOCS.map(() => [each * 1.282, each * 0.893, each * 0.815])))),
        note: rs => `${rs.filter(n => gaps(n)).length} still to fill in`,
        head: `<thead>
          <tr class="dgrp"><th></th><th></th>${DOCS.map(t =>
            `<th class="grp b" colspan="3">${esc(t.label)}</th>`).join('')}</tr>
          <tr><th>Employee</th><th class="b">Date of birth</th>${DOCS.map(() =>
            '<th class="b">Number</th><th>Expiry</th><th class="doc">Document</th>').join('')}</tr>
        </thead>`,
        row: n => `<tr>
          <td class="nw"${full(NM(n) + (gaps(n) ? ' \u2014 ' + gaps(n) + ' still blank' : ''))}>${nm(n)}${gaps(n)?` <span class="pill mute">${gaps(n)} blank</span>`:''}</td>
          ${dobCell(n)}${DOCS.map(t => refCell(n, t.k) + expCell(n, t.k) + clip(n, t.k)).join('')}</tr>`,
        empty: 'Nobody matches that.'
      });
    })()}
    <p class="cap">The rows with the most blanks come first. A number is masked until you press <b>Show the
      numbers</b> &mdash; they are government references and this screen gets looked at with somebody standing
      behind you. The paperclip opens the copy the employee uploaded; hollow and amber means there is none. A date
      in <b style="color:var(--bad)">red</b> has already passed and one in <b style="color:var(--warn)">amber</b>
      is inside two months. Typing a date feeds the expiry table, the reminders and the person&rsquo;s own page, so
      take them off the card rather than from memory.</p>
  </section>`;
}

function vDocsAdmin(){
  const all = allDocRows();
  const exp = all.filter(r=>r.state==='expired');
  const soon = all.filter(r=>r.state==='soon');
  const f = state.docFilter || 'attention';
  const shown = f==='all' ? all : f==='people' ? all.filter(r=>!r.company)
    : f==='company' ? all.filter(r=>r.company) : exp.concat(soon);
  return `
  <div class="strip">
    <div class="stat"><span class="k">Expired</span><span class="v" style="color:var(--${exp.length?'bad':'good'})">${exp.length}</span>
      <span class="n">${exp.length?'needs attention today':'nothing has lapsed'}</span></div>
    <div class="stat"><span class="k">Expiring soon</span><span class="v" style="color:var(--${soon.length?'warn':'good'})">${soon.length}</span>
      <span class="n">inside the warning window</span></div>
    <div class="stat"><span class="k">Staff documents</span><span class="v">${all.filter(r=>!r.company).length}</span>
      <span class="n">across ${USERS.length} people</span></div>
    <div class="stat"><span class="k">Company documents</span><span class="v">${all.filter(r=>r.company).length}</span>
      <span class="n">licences, cards and tenancy</span></div>
  </div>

  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Document expiry</h3>
      <div class="seg" id="docSeg" style="margin-left:auto">
        ${[['attention','Needs attention'],['people','Staff'],['company','Company'],['all','Everything']]
          .map(([k,l])=>`<button data-df="${k}" aria-pressed="${f===k}" type="button">${l}</button>`).join('')}
      </div></header>
    <div class="tw"><table class="invtable">
      <thead><tr><th class="s1">Who</th><th>Document</th><th>Expires</th><th>When</th><th>Status</th></tr></thead>
      <tbody>${shown.length?shown.map(r=>`<tr${r.company?' style="background:var(--panel2)"':''}>
        <td class="s1 nw">${r.company?esc(r.who)+' <span class="pill mute">company</span>':nm(r.who)}</td>
        <td class="nw">${esc(r.label)}</td>
        <td class="n nw">${esc(dayLabel(r.exp))} ${r.exp.slice(0,4)}</td>
        <td class="nw" style="color:var(--ink2)">${esc(inWord(r.days))}</td>
        <td>${DOCPILL(r.state)}</td></tr>`).join('')
        :'<tr><td colspan="5" style="color:var(--ink3)">Nothing in this view.</td></tr>'}
      </tbody></table></div>
    <p class="cap">Warning windows: visa and labour card 60 days, Emirates ID 45 days, passport 180 days, company documents 90 days. Employees upload their own copies and type their own expiry dates. The four <b>reference numbers</b> &mdash; Emirates ID, passport, residency visa, labour card &mdash; are held on the grid below, masked until you ask for them, readable by the person themselves and by accounts and by nobody else. They never go in an email or on a team list.</p>
  </section>

  ${vDocsEdit()}

  ${vProfilesAdmin()}

  ${(() => {
    /* The columns are Avin's, in his order and under his headings. Each one is
       a label and the way to read it off the person, so the head, the body and
       the count of what is still blank cannot fall out of step with each
       other. */
    const P = n => PROF(n) || {};
    const GROUPS = [
      ['Personal details', [
        ['Gender',             9, n => P(n).gender],
        ['Marital status',    10, n => P(n).marital],
        ['Personal mobile',   14, n => P(n).mobile],
        ['Personal email',    20, n => P(n).pemail],
        ['Address in the UAE',26, n => P(n).uaeAddr]]],
      ['Home country', [
        ['Home country',      12, n => P(n).homeCountry],
        ['Home address',      26, n => P(n).homeAddr],
        ['Contact person',    15, n => P(n).homeContact],
        ['Contact number',    14, n => P(n).homePhone]]],
      ['Emergency contact in the UAE', [
        ['Name',              15, n => P(n).ecName],
        /* One long word that cannot wrap, so it needs the width outright or it
           reads 'RELATIONSH...' */
        ['Relationship',      15, n => P(n).ecRel],
        ['Phone number',      14, n => P(n).ecPhone]]]
    ];
    const COLS = [].concat(...GROUPS.map(g => g[1]));
    const val   = (n, c) => String(c[2](n) || '').trim();
    const blank = n => COLS.filter(c => !val(n, c)).length;
    const roll  = USERS.map(x => x.name);
    /* The rows with the most missing come first, for the same reason they do
       on the documents grid: this screen exists to be worked down. */
    const rows  = roll.slice().sort((a, b) => blank(b) - blank(a) || a.localeCompare(b));
    const short = rows.filter(n => blank(n)).length;
    /* Weights, not percentages: the name is worth 34 of them and each column
       above is worth what it has to hold, and the lot is scaled to a hundred
       so the same numbers hold whatever the table is worth in pixels. The name
       column is the widest because it carries a full legal name AND the count
       of what is missing beside it; at a third of this it ended in an
       ellipsis, which on a register of people is the one column that must
       never be cut. */
    const wide  = COLS.reduce((s, c) => s + c[1], 0) + 34;
    const w     = x => x * 100 / wide;
    const cell  = (n, c, first) => { const v = val(n, c);
      return `<td${first ? ' class="b"' : ''}>${v ? esc(v) : '<span class="miss">\u2014</span>'}</td>`; };
    return `<section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Staff register</h3>
      <span class="pill ${short ? 'warn' : 'good'}"><span class="dt"></span>${
        short ? short + (short === 1 ? ' person has' : ' people have') + ' something missing'
              : 'nothing missing'}</span>
      <span class="hint" style="margin-left:auto">filled in by the employee, not by you</span></header>
    ${byCompany(rows, {
      who: n => n, cls: 'rgstr',
      cols: colsOf([w(34)].concat(COLS.map(c => w(c[1])))),
      note: rs => `${rs.filter(n => blank(n)).length} of ${rs.length} incomplete`,
      head: `<thead>
        <tr class="dgrp"><th></th>${GROUPS.map(g =>
          `<th class="grp b" colspan="${g[1].length}">${esc(g[0])}</th>`).join('')}</tr>
        <tr><th>Employee name</th>${GROUPS.map(g => g[1].map((c, i) =>
          `<th${i ? '' : ' class="b"'}>${esc(c[0])}</th>`).join('')).join('')}</tr>
      </thead>`,
      row: n => `<tr>
        <td class="nw"${full(NM(n) + (blank(n) ? ' \u2014 ' + blank(n) + ' still blank' : ''))}>${nm(n)}${
          blank(n) ? ` <span class="pill mute">${blank(n)} blank</span>` : ''}</td>
        ${GROUPS.map(g => g[1].map((c, i) => cell(n, c, !i)).join('')).join('')}</tr>`,
      empty: 'Nobody on the staff list yet.'
    })}
    <p class="cap">Read only, and it stays that way: every line of it is the person&rsquo;s own account of
      themselves, kept on their profile. A blank is something to ask them for, not something to fill in from
      memory &mdash; a home address or a next of kin taken down second-hand is worse than an empty box, because
      it looks answered. The table scrolls sideways; the name column is what you read down.
      <b>Only accounts can open this screen.</b> A manager cannot, and the database gives them nothing from
      this table but their own row, so a personal mobile or a home address never reaches a colleague.</p>
  </section>`;
  })()}`;
}

/* ---------- gratuity provision ----------
   UAE Labour Law article 51: 21 calendar days of basic for each of the first five
   years, 30 days a year after that, measured in calendar days from the joining date.
   This reproduces Avin's workbook exactly - all 684 cells of it, across both years
   and both companies - so the portal and the accounts agree by construction. */
const GRAT = () => DATA.gratuity || {policy:{}, rows:[]};
const gMonthEnd = ym => { const [y,m] = ym.split('-').map(Number);
  return `${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`; };
const gDays = (a,b) => Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/86400000);
function gratAt(row, monthEnd){
  const P = GRAT().policy, cap = (P.firstYears||5) * (P.yearDays||365);
  if(row.left && row.left < monthEnd) return {v:0, gone:true, days:0, basic:0};
  /* A month with no basic on that company's sheet is a month the person was not on
     that company's books - Shannan moved from CorpLex to POA, and without this she
     would be provided for twice. */
  const basic = row.basic[monthEnd];
  if(!basic) return {v:0, gone:false, days:0, basic:0};
  const to = (row.left && row.left < monthEnd) ? row.left : monthEnd;
  const d = gDays(row.doj, to);
  if(d <= 0) return {v:0, gone:false, days:Math.max(0,d), basic};
  const early = Math.min(d, cap), late = Math.max(0, d - cap);
  const v = basic/30 * ((P.daysEarly||21)*early/(P.yearDays||365) + (P.daysLate||30)*late/(P.yearDays||365));
  return {v, gone:false, days:d, basic};
}
const gMonths = () => { const set = new Set();
  GRAT().rows.forEach(r=>Object.keys(r.basic).forEach(k=>set.add(k.slice(0,7))));
  return [...set].sort(); };

/* Four kinds, and the order is the order they are offered in. 'director' is
   paid from the salary rows exactly as a wage is — the generator's only
   special case is commission — but it is not wages, and calling it that on a
   screen is how it ends up on a salary certificate. */
const BASIS = {salaried: 'A fixed salary', director: "A director's remuneration",
               commission: 'Commission only', off: 'Not on payroll'};
// the two that are paid from what is on file
const FROMFILE = b => b === 'salaried' || b === 'director';
const BASISOF = n => { const e = USERS.find(x => x.name === n) || {};
  return e.payBasis || (HR().payBasis || {})[n] || 'salaried'; };

/* The four columns Avin reads down: who, whether they are paid, how much is
   on file, and where that figure came from. Somebody paid by two companies
   gets a line each, for the same reason the salary-on-file table does. */
function vOnPayroll(){
  const roll = USERS.map(x => x.name).slice().sort((a, b) => a.localeCompare(b));
  const rowsOf = n => { const p = salParts(n), cos = p.co || [];
    return cos.length ? cos.map(c => ({n, p, c})) : [{n, p, c: null}]; };
  const rows = roll.flatMap(rowsOf);
  const off  = roll.filter(n => BASISOF(n) === 'off');
  const noSal = roll.filter(n => BASISOF(n) !== 'off' && !(salParts(n).co || []).length
                                 && !salParts(n).assumed);
  const f = state.opForm || (state.opForm = {who: '', co: '', basic: '', allow: '', from: ''});
  const canRecord = f.who && f.from && (+f.basic > 0 || +f.allow > 0)
    && !(salParts(f.who).co || []).some(c => c.company === (f.co || ''));

  return `
  <div class="strip">
    <div class="stat"><span class="k">On payroll</span><span class="v">${roll.filter(n => BASISOF(n) !== 'off').length}</span>
      <span class="n">of ${roll.length} on the staff list</span></div>
    <div class="stat"><span class="k">Not on payroll</span>
      <span class="v">${off.length}</span>
      <span class="n">${off.length ? esc(off.map(NM).join(', ')) + ' \u2014 on the staff list, paid outside it'
        : 'everybody on the staff list is paid through the portal'}</span></div>
    <div class="stat"><span class="k">Paid by two companies</span>
      <span class="v">${roll.filter(n => (salParts(n).co || []).length > 1).length}</span>
      <span class="n">a line each, every month</span></div>
    <div class="stat"><span class="k">Nothing on file</span>
      <span class="v" style="color:var(--${noSal.length ? 'warn' : 'good'})">${noSal.length}</span>
      <span class="n">${noSal.length ? 'paid, but no figure recorded' : 'every paid person has a figure'}</span></div>
  </div>

  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Who is on payroll</h3>
      <span class="hint">the generator builds a line for everybody here, and for nobody else</span>
      <span style="margin-left:auto;display:flex;gap:8px;align-items:center">${edBar('basis')}</span></header>
    ${edConfirm('basis')}${edSaved('basis')}
    ${byCompany(rows, {
      who: r => r.n, cls: 'invtable',
      /* Grouped by whoever pays the line, not by the company the person
         belongs to \u2014 which is why Miraziz's POA half was sitting under
         CorpLex. Somebody with no salary on file has no paying company, so
         they stay under their own. */
      code: r => { const k = r.c && r.c.company;
        return (k && DATA.companies[k]) ? DATA.companies[k].code : companyOf(r.n).code; },
      cols: colsOf([22, 17, 12, 12, 12, 14, 11]),
      head: `<thead><tr><th>Employee</th><th>Paid</th><th class="r">Basic</th>
        <th class="r">Allowance</th><th class="r">Total</th><th>From</th><th></th></tr></thead>`,
      row: r => { const v = r.c, b = BASISOF(r.n), first = !r.c || r.p.co[0] === r.c;
        /* A figure on file for somebody who is not paid from it. It is not an
           error the portal can resolve on its own \u2014 only accounts knows
           whether the person moved to commission or the figure is simply
           stale \u2014 so it is marked and offered, not cleaned up. */
        const orphan = v && !FROMFILE(b);
        return `<tr${orphan ? ' style="background:color-mix(in srgb, var(--warn) 7%, transparent)"' : ''}>
        <td class="nw">${nm(r.n)}${r.c && r.p.multi ? ` <span class="pill mute">${esc(r.c.label)}</span>` : ''}</td>
        <td>${first ? edCell('basis', r.n,
          x => `<select class="ff"${edAttr('basis', r.n)}>${Object.entries(BASIS).map(([k, l]) =>
                 `<option value="${k}"${x === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`,
          x => `<span class="edread"${x === 'off' ? ' style="color:var(--ink3)"' : ''}>${esc(BASIS[x] || x)}</span>`)
          : `<span style="color:var(--ink3)">${esc(BASIS[b] || b)}</span>`}</td>
        <td class="n r">${v ? money(v.basic, 2) : '<span class="miss">\u2014</span>'}</td>
        <td class="n r">${v ? money(v.allow, 2) : '<span class="miss">\u2014</span>'}</td>
        <td class="n r netcol">${v ? money(v.salary, 2) : '<span class="miss">\u2014</span>'}</td>
        <td style="color:var(--ink2);font-size:12.5px"${full(v ? (v.from ? 'From ' + v.from : v.src) : '')}>${
          v ? (v.from ? esc(v.from) : esc(v.src || '\u2014')) : (b === 'commission'
            ? '<span class="miss">commission only</span>' : '<span class="miss">nothing on file</span>')}</td>
        <td class="r nw">${orphan
          ? `<button class="btn ghost sm" data-salclr="${esc(r.n)}|${esc((r.c||{}).company || '')}" type="button"
              title="${esc(NM(r.n))} is ${esc((BASIS[b]||b).toLowerCase())}, so nothing pays this figure">Clear the figure</button>`
          : ''}</td></tr>`; },
      empty: 'Nobody on the staff list yet.'
    })}
    <p class="cap"><b>A fixed salary</b> and <b>a director&rsquo;s remuneration</b> are both paid from what is on
      file, a line per company, so both need a figure recorded first &mdash; otherwise the month generates a line of
      nought. They are kept apart because a director&rsquo;s remuneration is not wages: it does not belong on a
      salary certificate and no gratuity accrues on it. <b>Commission only</b> means no fixed pay at all; the line is
      built from that month&rsquo;s commission, and a figure still sitting on file for such a person is
      <b style="color:var(--warn)">shaded</b>, because nothing pays it. <b>Not on payroll</b> leaves them off the run
      entirely, and the database refuses it while a month that pays them is still open.</p>
  </section>

  <section class="panel">
    <header><h3>Record an opening salary</h3>
      <span class="hint">for somebody who has none &mdash; a salary that exists moves by letter</span></header>
    <div class="pad grid g2" style="gap:22px;align-items:start">
      <div>
        <div class="field"><label for="opWho">Employee</label>
          <select id="opWho"><option value="">Choose someone</option>${roll.map(n =>
            `<option value="${esc(n)}"${f.who === n ? ' selected' : ''}>${esc(n)}${
              (salParts(n).co || []).length ? ' \u2014 ' + money(salParts(n).salary, 0) + ' on file' : ''}</option>`).join('')}</select></div>
        <div class="field"><label for="opCo">Paid by</label>
          <select id="opCo"><option value=""${!f.co ? ' selected' : ''}>The group, not a named company</option>${
            (DATA.companies ? Object.values(DATA.companies) : []).map(c =>
              `<option value="${esc(c.key)}"${f.co === c.key ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <span class="pfhint">One entry per company. Somebody paid by two gets two, and two payroll lines every month.</span></div>
        <div class="grid g2" style="gap:12px">
          <div class="field"><label for="opBasic">Basic (AED)</label><input id="opBasic" inputmode="decimal" placeholder="0.00" value="${esc(f.basic)}"></div>
          <div class="field"><label for="opAllow">Other allowance</label><input id="opAllow" inputmode="decimal" placeholder="0.00" value="${esc(f.allow)}"></div>
        </div>
        <div class="field"><label for="opFrom">On file from</label><input id="opFrom" type="date" value="${esc(f.from)}"></div>
        <button class="btn wide" id="opGo" type="button"${canRecord ? '' : ' disabled'}>Record it</button>
        ${state.opDone ? `<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>Recorded.</b> ${esc(state.opDone)}</div>` : ''}
      </div>
      <div>
        ${f.who ? (() => { const p = salParts(f.who), hit = (p.co || []).find(c => c.company === (f.co || ''));
          if(hit) return `<div class="note" style="border-left-color:var(--warn)">
            <b>${esc(nm2(f.who))} already has ${money(hit.salary, 2)} on file${
              hit.label ? ' from ' + esc(hit.label) : ''}.</b>
            A salary that exists is moved by a revision letter, not typed over &mdash; so that there is always a
            document behind a figure somebody is paid. The database refuses this whatever this screen offers.
            <div style="margin-top:10px"><button class="btn ghost" data-go="revisions" data-mode="console" type="button">Go to Revisions</button></div></div>`;
          const t = Math.round(((+f.basic || 0) + (+f.allow || 0)) * 100) / 100;
          return `<dl class="kv">
            <dt>Total</dt><dd class="big">${t ? money(t, 2) : '\u2014'}</dd>
            <dt>Basic share</dt><dd>${t ? pct((+f.basic || 0) / t, 1) : '\u2014'}</dd>
            <div class="sep"></div>
            <dt>Paid by</dt><dd>${esc(f.co ? ((DATA.companies[f.co] || {}).name || f.co) : 'the group')}</dd>
            <dt>From</dt><dd>${f.from ? esc(effLabel(f.from)) : '\u2014'}</dd>
          </dl>
          <p class="cap" style="padding:14px 0 0">This records what somebody is already paid; it is not a rise and
            it writes no letter. The gratuity provision reads the basic from this date, so use the date the salary
            actually started rather than today.</p>`; })()
        : '<p style="margin:0;color:var(--ink3);font-size:13.5px">Choose someone to see what is on file.</p>'}
      </div>
    </div>
  </section>`;
}

function vGratuity(){
  const months = gMonths();
  const ym = months.includes(state.gratMonth) ? state.gratMonth : (months[months.length-1] || '2026-08');
  const me = gMonthEnd(ym), prev = months[months.indexOf(ym)-1];
  const pe = prev ? gMonthEnd(prev) : '';
  const cos = ['CorpLex','POA','Lex'];
  const CoLabel = {corplex:'CorpLex', poa:'POA', lex:'Lex'};
  const gVisa = r => {
    if(r && r.visa) return CoLabel[r.visa] || 'Other';
    const v = ((payrollRowFor(r && r.n)||{}).visa || '').trim();
    if(!v) return ''; if(/^CorpLex/.test(v)) return 'CorpLex';
    if(v==='POA') return 'POA'; if(v==='Lex') return 'Lex'; return 'Other'; };
  const rowsFor = co => GRAT().rows.filter(r=>r.co===co)
    .map(r=>{ const now = gratAt(r, me), was = pe ? gratAt(r, pe) : {v:0};
      return {r, now, was, move: now.v - was.v, visa: gVisa(r)}; })
    .filter(x=>x.now.v > 0 || x.was.v > 0)
    .sort((a,b)=>b.now.v - a.now.v);
  const all = cos.map(rowsFor);
  const tot = all.flat().reduce((s,x)=>s+x.now.v, 0);
  const mv  = all.flat().reduce((s,x)=>s+x.move, 0);
  const released = all.flat().filter(x=>x.now.v===0 && x.was.v>0 && x.r.left);
  const movedTo = (n, co) => { const o = GRAT().rows.find(r=>r.n===n && r.co!==co && r.basic[me]);
    return o ? (o.co==='Lex'?'Lex Estates':o.co) : ''; };
  const yrs = d => (d/365).toFixed(1);
  const mism = n => { const p = (DATA.master.parts||{})[n]; return p ? p.basic : null; };
  const VLAB = {'POA':'On a POA visa','CorpLex':'On a CorpLex visa','Lex':'On a Lex Estates visa',
                'Other':'On another company’s visa','':'Visa entity not recorded'};

  const line = x => { const pb = mism(x.r.n),
      off = (pb!==null && Math.abs(pb - x.now.basic) > 0.5 && !x.r.left);
    return `<tr${x.now.v===0?' class="dimr"':''}>
      <td class="s1 gname">${nm(x.r.n)}</td>
      <td class="n nw">${esc(dayLabel(x.r.doj))} ${x.r.doj.slice(0,4)}</td>
      <td class="n r">${x.now.days?yrs(x.now.days):'—'}</td>
      <td class="n r">${x.now.basic?money(x.now.basic,0):'—'}</td>
      <td class="n r netcol">${money(x.now.v,0)}</td>
      <td class="n r"${x.move<0?' style="color:var(--good)"':''}>${x.move?((x.move<0?'(':'')+money(Math.abs(x.move),0)+(x.move<0?')':'')):'—'}</td>
      <td class="gnote">${
        x.r.left ? `<span class="pill mute">left ${esc(dayLabel(x.r.left))} ${x.r.left.slice(0,4)}</span>`
        : (x.now.v===0 && x.was.v>0 && movedTo(x.r.n, x.r.co)) ? `<span class="pill mute">moved to ${esc(movedTo(x.r.n, x.r.co))}</span>`
        : off ? `<span class="pill warn"><span class="dt"></span>payroll says ${money(pb,0)}</span>`
        : pb===null ? '<span class="pill mute">not on the payroll file</span>' : ''}</td>
    </tr>`; };
  const sumrow = (rs, label, cls) => {
    const t = rs.reduce((s,x)=>s+x.now.v,0), tm = rs.reduce((s,x)=>s+x.move,0);
    return `<tr class="${cls}"><td class="s1">${esc(label)}</td>
      <td>${rs.filter(x=>x.now.v>0).length} ${rs.filter(x=>x.now.v>0).length===1?'person':'people'}</td>
      <td></td><td></td><td class="n r">${money(t,0)}</td>
      <td class="n r">${tm?money(tm,0):'—'}</td><td></td></tr>`; };

  const block = (co, rs) => {
    if(!rs.length) return '';
    const order = ['POA','CorpLex','Lex','Other',''];
    const keys = order.filter(k => rs.some(x=>x.visa===k));
    const split = co==='POA' && keys.length > 1;
    const body = split
      ? keys.map(k=>{ const g = rs.filter(x=>x.visa===k);
          return `<tr class="grp"><td class="s1" colspan="7">${esc(VLAB[k])}</td></tr>`
               + g.map(line).join('') + sumrow(g, '', 'sub'); }).join('')
      : rs.map(line).join('');
    return `<div class="tw"><table class="invtable gtable">
      <colgroup><col style="width:24%"><col style="width:12%"><col style="width:8%"><col style="width:11%">
        <col style="width:14%"><col style="width:13%"><col style="width:18%"></colgroup>
      <thead><tr><th class="s1">${esc(co==='Lex'?'Lex Estates':co)}</th><th>Joined</th><th class="r">Years</th>
        <th class="r">Basic</th><th class="r">Provision</th><th class="r">Movement</th><th>Note</th></tr></thead>
      <tbody>${body}${sumrow(rs, co==='Lex'?'Lex Estates':co, 'tot')}</tbody></table></div>`; };

  return `
  ${(() => {
    // provision above, this month's movement below it, for the group and for
    // each company — the same shape four times over
    const tile = (label, sub, value, move, heads) => `
      <div class="stat"><span class="k">${esc(label)}${sub?' <i>'+esc(sub)+'</i>':''}</span>
        <span class="v"><span class="cur">AED</span>${money(value,0)}</span>
        <span class="n">${move
          ? '<b style="color:var(--'+(move>=0?'warn':'good')+')">'
            + (move>=0?'+':'(') + money(Math.abs(move),0) + (move>=0?'':')')
            + '</b> ' + (move>=0?'charged':'released')
          : '<span style="color:var(--ink3)">no movement</span>'}
          &middot; ${heads} ${heads===1?'person':'people'}</span></div>`;
    return `<div class="strip tight">
      ${tile('All three companies', esc(dayLabel(me)) + ' ' + me.slice(0,4),
             tot, mv, all.flat().filter(x=>x.now.v>0).length)}
      ${cos.map((c,i)=>tile(c==='Lex'?'Lex Estates':c, '',
             all[i].reduce((s,x)=>s+x.now.v,0),
             all[i].reduce((s,x)=>s+x.move,0),
             all[i].filter(x=>x.now.v>0).length)).join('')}
    </div>`;
  })()}

  <section class="panel">
    <header><h3>Gratuity provision</h3>
      <span class="hint">${esc(GRAT().policy.daysEarly)} days a year for the first ${esc(GRAT().policy.firstYears)}, then ${esc(GRAT().policy.daysLate)}</span>
      <select id="gratSeg" class="ff" style="margin-left:auto;width:auto">${months.map(m=>
        `<option value="${m}"${m===ym?' selected':''}>${esc(MONTHNAME[+m.slice(5)-1])} ${m.slice(0,4)}</option>`).join('')}</select>
    </header>
    ${cos.map((c,i)=>block(c, all[i])).join('')}
    ${(() => {
      const young = all.flat().filter(x => !x.r.left && x.now.days && x.now.days < 365);
      if(!young.length) return '';
      const v = young.reduce((s,x) => s + x.now.v, 0);
      return `<p class="cap" style="border-left:2px solid var(--line2);padding-left:12px">
        <b>${money(v,0)} of this is held for ${young.length} ${young.length===1?'person':'people'} who
        ${young.length===1?'has':'have'} not completed a year</b> &mdash;
        ${esc(young.sort((a,b)=>b.now.days-a.now.days).map(x=>nm(x.r.n)+' ('+Math.round(365-x.now.days)+'d)').join(', '))}.
        Nothing is payable to them until they do, so it is provided against the likelihood they stay,
        and written back if they do not.</p>`;
    })()}
    <p class="cap">Straight from your workbook and recalculated here, not copied &mdash; every figure in the 2025 and 2026 sheets reproduces to the dirham. Service runs in calendar days from the joining date; a leaver is held to their last working day and released the following month. The POA table is split by <b>visa entity</b>, because the end-of-service liability sits with the company that sponsors the visa, not the one the person works for. A <b>payroll says</b> flag means the basic on the payroll file differs from the one in the workbook &mdash; one of the two is out of date.</p>
  </section>

  ${released.length?`<section class="panel">
    <header><h3>Released this month</h3><span class="hint">provision no longer held</span></header>
    <div class="tw"><table class="gtable2">
      <thead><tr><th>Who</th><th>Company</th><th>Last day</th><th class="r">Provision released</th><th class="r">Paid</th><th class="r">Over/(under)</th><th>Why</th></tr></thead>
      <tbody>${released.map(x=>{
        const served = Math.round((new Date(x.r.left) - new Date(x.r.doj))/86400000);
        const short = served < 365 && !(x.r.paid > 0);
        const d = (x.r.paid||0) - x.was.v;
        return `<tr><td class="nw">${nm(x.r.n)}</td><td class="nw">${esc(x.r.co==='Lex'?'Lex Estates':x.r.co)}</td>
        <td class="n nw">${esc(dayLabel(x.r.left))} ${x.r.left.slice(0,4)}</td>
        <td class="n r">${money(x.was.v,0)}</td><td class="n r">${short?'—':money(x.r.paid||0,0)}</td>
        <td class="n r"${short?' style="color:var(--good)"':(Math.abs(d)>1?' style="color:var(--warn)"':'')}>${short?'('+money(x.was.v,0)+')':money(d,0)}</td>
        <td class="gnote">${short
          ? '<span class="pill mute">'+served+' days &mdash; under a year, none payable</span>'
          : !x.r.paid ? '<span class="pill warn"><span class="dt"></span>nothing recorded as paid</span>'
          : !x.r.paidOn ? ''
          : (() => {
              // Paid on the last day and released the month after is the normal
              // shape of things; only a real gap is worth flagging.
              const gap = (+ym.slice(0,4)*12 + +ym.slice(5,7)) -
                          (+x.r.paidOn.slice(0,4)*12 + +x.r.paidOn.slice(5,7));
              return Math.abs(gap) <= 1
                ? '<span class="pill good"><span class="dt"></span>paid '+esc(dayLabel(x.r.paidOn))+'</span>'
                : '<span class="pill warn"><span class="dt"></span>cash paid '+esc(dayLabel(x.r.paidOn))+' '+x.r.paidOn.slice(0,4)+'</span>';
            })()}</td></tr>`;}).join('')}
      </tbody></table></div>
    <p class="cap">A difference here is an over or under provision, and goes through the P&amp;L in the month the person is paid. Somebody who leaves before completing a year is owed nothing under the law, so their whole provision is written back &mdash; that is a credit, not a debt. Where the cash left in a different month from the release, the date it actually went out is shown.</p>
  </section>`:''}`;
}

const REVS = () => HR().revisions || [];
const DRAFTS = () => REVS().filter(r => r.status === 'draft');
const SENTREV = () => REVS().filter(r => r.status === 'issued');

function vDeskOnly(){
  return `
  <section class="panel">
    <header><h3>This one is for a desk</h3></header>
    <div class="pad">
      <p style="margin:0 0 14px;color:var(--ink2);font-size:15px;max-width:60ch">
        The accounts console &mdash; payroll, payslips, salary revisions, the air
        ticket register, gratuity, sales and the staff rules &mdash; is wide,
        detailed work, and a phone is the wrong place to do it. A payroll month
        approved by thumb is a payroll month approved without reading it.</p>
      <p style="margin:0 0 20px;color:var(--ink3);font-size:14px;max-width:60ch">
        Open <b>one.corplex.ae</b> on a laptop and it is all there, exactly as you
        left it. Everything you need day to day &mdash; checking in, leave, your
        payslip, your air ticket &mdash; is below.</p>
      <button class="btn" id="deskBack" type="button">Back to my portal</button>
    </div>
  </section>`;
}

function vRevisions(){
  const g = state.revForm || (state.revForm = {who:'', eff:'', basic:'', allow:'', co:''});
    const roll = USERS.map(x=>x.name).filter(n=>payrollRowFor(n));
    const cur = g.who ? salParts(g.who) : null;
    /* The figures the revision is measured against: the chosen company's, not
       the total. A 25,000 rise on a man paid 25,000 by each of two companies
       is a 100% rise on the half being moved, not 50% on the pair. */
    const one = g.who ? revCoPart() : null;
    const nb = +g.basic || 0, na = +g.allow || 0, nt = Math.round((nb+na)*100)/100;
    const ok = g.who && g.eff && nb > 0;
    const rise = (one && nt) ? Math.round((nt - one.salary)*100)/100 : 0;
  return `
    <section class="panel">
    <header><h3>Issue a salary revision</h3><span class="hint">accounts only &mdash; the employee cannot ask for this</span></header>
    <div class="pad grid g2" style="gap:22px;align-items:start">
      <div>
        <div class="field"><label for="rvWho">Employee</label>
          <select id="rvWho"><option value="">Choose someone</option>${roll.map(n=>`<option value="${esc(n)}"${g.who===n?' selected':''}>${esc(n)}</option>`).join('')}</select></div>
        ${(() => { const cos = salCos(g.who);
          if(cos.length < 2) return '';
          return `<div class="field"><label for="rvCo">Which company</label>
            <select id="rvCo">${cos.map(c => `<option value="${esc(c.company)}"${
              c.company === revCo() ? ' selected' : ''}>${esc(c.label)} &mdash; ${money(c.salary,2)} on file</option>`).join('')}</select>
            <span class="pfhint">${esc(nm2(g.who))} is paid by ${cos.length} companies. A revision moves
              one of them; the other is untouched.</span></div>`; })()}
        <div class="field"><label for="rvEff">With effect from</label><input id="rvEff" type="date" value="${esc(g.eff)}"></div>
        <div class="grid g2" style="gap:12px">
          <div class="field"><label for="rvBasic">New basic (AED)</label><input id="rvBasic" inputmode="decimal" placeholder="0.00" value="${esc(g.basic)}"></div>
          <div class="field"><label for="rvAllow">New other allowance</label><input id="rvAllow" inputmode="decimal" placeholder="0.00" value="${esc(g.allow)}"></div>
        </div>
        <button class="btn wide" id="rvIssue" type="button"${ok?'':' disabled'}>Write the draft</button>
        ${(() => {
          const g = state.revForm || {};
          if(!g.eff) return '';
          const shut = (DATA.payroll.runs || []).filter(r => r.status === 'closed'
            && r.key >= String(g.eff).slice(0, 7));
          if(!shut.length) return '';
          return `<div class="note" style="margin-top:14px;border-left-color:var(--bad)">
            <b>${esc(shut.map(r => r.label).join(', '))} ${shut.length === 1 ? 'is' : 'are'} already closed and paid.</b>
            A revision dated ${esc(effLabel(g.eff))} cannot reach ${shut.length === 1 ? 'that month' : 'those months'} \u2014 a closed
            run is never restated. The difference for ${shut.length === 1 ? 'it' : 'them'} will not appear on any payroll
            month, so pay it by hand or date this from the first open month instead.</div>`;
        })()}
        ${state.revSent?`<div class="note" style="margin-top:14px;border-left-color:var(--warn)"><b>Drafted. Nothing has moved.</b> ${esc(state.revSent)}'s letter is waiting below. The salary on file, the payslip and the gratuity provision all still read the old figure until you send it.</div>`:''}
      </div>
      <div>
        ${g.who?`<dl class="kv">
          ${cur.multi ? `<dt>This revision moves</dt><dd><b>${esc((salCos(g.who).find(c=>c.company===revCo())||{}).label || '')}</b></dd>` : ''}
          <dt>On file now</dt><dd>${money(one.salary,2)}</dd>
          <dt>&mdash; basic</dt><dd>${money(one.basic,2)}${cur.assumed?' <span class="pill warn" style="margin-left:6px">assumed</span>':''}</dd>
          <dt>&mdash; other allowance</dt><dd>${money(one.allow,2)}</dd>
          ${cur.multi ? `<div class="sep"></div><dt>Left alone</dt><dd style="color:var(--ink2)">${
            salCos(g.who).filter(c=>c.company!==revCo()).map(c=>esc(c.label)+' \u00b7 '+money(c.salary,2)).join('<br>')}</dd>` : ''}
          <div class="sep"></div>
          <dt>New total</dt><dd class="big">${nt?money(nt,2):'—'}</dd>
          ${nt?`<dt>Change</dt><dd style="color:var(--${rise>0?'good':rise<0?'bad':'ink2'})">${rise>0?'+':''}${money(rise,2)}${one.salary?' · '+pct(rise/one.salary,1):''}</dd>`:''}
        </dl>
        ${cur.assumed?`<p class="note" style="margin-top:14px;border-left-color:var(--warn)">There is no revision letter on file for ${esc(g.who.split(' ')[0])}, so the basic above is the <b>60/40 house split</b>, not a contractual figure. Issuing this replaces the guess with the real number.</p>`:`<p class="cap" style="padding:14px 0 0">From ${esc(cur.src||'a letter on file')}.</p>`}`
        :`<p style="margin:0;color:var(--ink3);font-size:13.5px">Choose someone to see what is on file now.</p>`}
      </div>
    </div>
  </section>

  <section class="panel">
    <header><h3>Waiting to be sent</h3>
      <span class="pill ${DRAFTS().length?'warn':'good'}"><span class="dt"></span>${DRAFTS().length||'none'}</span>
      <span class="hint" style="margin-left:auto">a draft changes nothing until you send it</span></header>
    <div class="pad">
      ${DRAFTS().length ? DRAFTS().map(r => `
        <div class="draft">
          <div class="dhead">
            <div><b>${nm(r.who)}</b>
              <span class="dsub">${esc(r.ref)} &middot; with effect from ${esc(dayLabel(r.eff))} ${esc(r.eff.slice(0,4))}${r.why?' &middot; '+esc(r.why):''}</span></div>
            <div class="dfig">
              <span class="was">${r.was==null?'&mdash;':money(r.was,2)}</span>
              <span class="arw">&rarr;</span>
              <b class="n">${money(r.now,2)}</b>
              <span class="dsub">basic ${money(r.basic,2)} &middot; other ${money(r.allow,2)}</span>
            </div>
            <div class="dact">
              ${state.revAsk===r.revId ? '' : `<button class="btn ghost sm" data-rvsee="${esc(r.ref)}" type="button">View</button>
              <button class="btn sm" data-rvsend="${esc(r.revId)}" type="button">Send it</button>
              <button class="btn ghost sm" data-rvdrop="${esc(r.revId)}" type="button">Withdraw</button>`}
            </div>
          </div>
          ${state.revAsk===r.revId ? `<div class="dask">
            <p>Sending this moves <b>${nm(r.who)}</b> from <b>${r.was==null?'no salary on file':money(r.was,2)}</b>
              to <b>${money(r.now,2)}</b> from <b>${esc(dayLabel(r.eff))} ${esc(r.eff.slice(0,4))}</b>,
              on a basic of <b>${money(r.basic,2)}</b>.
              From that date the payslip, the salary certificate, the gratuity provision and
              every payroll month still open all read the new figure. It cannot be undone by
              deleting it &mdash; only by another letter.</p>
            <div class="drow">
              <button class="btn" data-rvyes="${esc(r.revId)}" type="button">Yes, send it</button>
              <button class="btn ghost" id="rvNo" type="button">Not yet</button>
            </div></div>` : ''}
        </div>`).join('')
      : '<p style="margin:0;color:var(--ink3);font-size:13.5px">No letters waiting. Anything you write above lands here first.</p>'}
    </div>
  </section>

  ${SENTREV().length ? `<section class="panel">
    <header><h3>Sent</h3>
      <span class="pill mute">${SENTREV().length}</span>
      <input id="revQ" placeholder="Find a name" value="${esc(state.revQ||'')}"
        style="margin-left:auto;max-width:220px;padding:5px 10px;font-size:13px">
      <span class="hint">every letter that has gone out</span></header>
    <div class="tw revsent"><table>
      <thead><tr><th class="s1">Employee</th><th>Letter</th><th>From</th><th class="r">Was</th><th class="r">Now</th><th class="r">Basic</th><th>Sent</th></tr></thead>
      <tbody>${SENTREV().filter(r => !state.revQ
        || NM(r.who).toLowerCase().includes(state.revQ.toLowerCase())
        || String(r.ref).toLowerCase().includes(state.revQ.toLowerCase())).map(r => `<tr>
        <td class="s1 nw">${nm(r.who)}</td>
        <td class="nw" style="color:var(--ink2)">${esc(r.ref)}</td>
        <td class="nw" style="color:var(--ink2)">${esc(dayLabel(r.eff))} ${esc(r.eff.slice(0,4))}</td>
        <td class="n r" style="color:var(--ink3)">${r.was==null?'&mdash;':money(r.was,2)}</td>
        <td class="n r netcol">${money(r.now,2)}</td>
        <td class="n r">${money(r.basic,2)}</td>
        <td class="nw" style="color:var(--ink2)">${r.sentAt?esc(dayLabel(r.sentAt))+' '+esc(r.sentAt.slice(0,4)):'&mdash;'}${r.sentBy?' by '+nm(r.sentBy):''}</td></tr>`).join('')}
      </tbody></table></div>
  </section>` : ''}

  <section class="panel">
    <header><h3>Salary on file</h3>
      <span class="hint">what payslips, the salary certificate and the gratuity provision read from</span></header>
    ${byCompany(USERS.map(x=>x.name).filter(n=>(DATA.master.parts||{})[n])
        .sort((a,b)=>a.localeCompare(b))
        /* One line per company that pays them. Somebody paid by two shows
           twice, which is the point: a single row of 50,000 would be a figure
           that appears on no payslip and in no bank file. */
        .flatMap(n => { const p = salParts(n);
          return (p.co && p.co.length > 1) ? p.co.map(c => ({n, p, c}))
                                           : [{n, p, c: (p.co||[])[0] || null}]; }), {
      who: r => r.n,
      cols: colsOf([22, 13, 15, 13, 12, 25]),
      note: rs => `${money(rs.reduce((a,r)=>a + (r.c ? r.c.salary : r.p.salary), 0),2)} on file`,
      head: `<thead><tr><th>Employee</th><th class="r">Basic</th><th class="r">Other allowance</th>
        <th class="r">Total</th><th class="r">Basic share</th><th>Where it came from</th></tr></thead>`,
      row: r => { const v = r.c || r.p; return `<tr>
        <td>${nm(r.n)}${r.p.multi && r.c ? ` <span class="pill mute">${esc(r.c.label)}</span>` : ''}</td>
        <td class="n r">${money(v.basic,2)}</td><td class="n r">${money(v.allow,2)}</td>
        <td class="n r netcol">${money(v.salary,2)}</td>
        <td class="n r" style="color:var(--ink2)">${v.salary?pct(v.basic/v.salary,1):'\u2014'}</td>
        <td style="color:var(--ink2)"${full(v.from?'From '+v.from:(v.src||''))}>${v.from?esc('From '+v.from):esc(v.src||'\u2014')}${r.p.assumed?' <span class="pill warn" style="margin-left:6px">assumed 60/40</span>':''}${
          (r.p.ahead||[]).filter(a => !r.c || a.company === r.c.company).map(a =>
            ` <span class="pill warn" title="already agreed, not yet in force">from ${esc(a.from)} \u00b7 ${money(a.salary,2)}</span>`).join('')}</td></tr>`; },
      empty: 'Nothing on file.'
    })}
    <p class="cap">Issuing a revision replaces the basic and allowance the whole portal works from &mdash; payslips split the month on the new ratio, the salary certificate quotes the new figures, and the gratuity provision recalculates. The letter itself lands on the employee's own Letters page and is emailed to them. The real splits run from 57% to 66% of salary, so anything still marked <b>assumed</b> is a guess that should be replaced with the figure on the person's contract.</p>
  </section>`;
}

function vAsks(){
  const u = state.user, sec = state.askTab === 'letters' ? 'letters' : 'loans';
  const nLoan = (HR().loans||[]).filter(x=>x.status==='Pending' && x.approver===u).length;
  const nLtr  = canUpload(u) ? (HR().letters||[]).filter(x=>x.status==='Pending' && x.type!=='revision').length : 0;
  const badge = n => n ? ` <span class="segn">${n}</span>` : '';
  return `
  <div class="seg segbig" id="askSeg">
    <button data-ask="loans" aria-pressed="${sec==='loans'}" type="button">Advances${badge(nLoan)}</button>
    <button data-ask="letters" aria-pressed="${sec==='letters'}" type="button">Letters${badge(nLtr)}</button>
  </div>
  ${sec==='loans' ? vLoans() : vLetters()}`;
}

function vLetters(){
  const u = state.user, adm = canUpload(u);
  const L = HR().letters || [];
  /* And out of the person's own list until it is issued — otherwise a draft
     tells somebody about a pay rise before it has been decided to send it. */
  const mine = L.filter(x=>x.who===u && !(x.type==='revision' && x.status!=='Issued'))
    .sort((a,b)=>b.asked.localeCompare(a.asked));
  /* A revision is accounts' own draft, not a request from staff waiting on a
     decision. It has no business in this queue: issuing it from here marks the
     letter issued without moving the salary. */
  const inbox = L.filter(x=>x.status==='Pending' && x.type!=='revision');
  const f = state.ltForm || (state.ltForm = {type:'salary', to:'', why:''});
  const t = LTYPE(f.type);
  const open = state.ltOpen ? L.find(x=>x.id===state.ltOpen) : null;
  const stPill = s => s==='Issued' ? '<span class="pill good"><span class="dt"></span>Issued</span>'
    : s==='Declined' ? '<span class="pill bad"><span class="dt"></span>Declined</span>'
    : s==='Cancelled' ? '<span class="pill mute">Withdrawn</span>'
    : '<span class="pill warn"><span class="dt"></span>Waiting</span>';
  return `
  ${adm && inbox.length?`
  <section class="panel">
    <header><h3>Waiting on you</h3><span class="pill warn"><span class="dt"></span>${inbox.length}</span>
      <span class="hint">issue the letter and it is emailed to them</span></header>
    <div class="tw"><table>
      <thead><tr><th>Who</th><th>Letter</th><th>Addressed to</th><th>Why</th><th>Asked</th><th></th></tr></thead>
      <tbody>${inbox.map(x=>`<tr>
        <td class="nw">${nm(x.who)}</td><td class="nw">${esc(LTYPE(x.type).label)}</td>
        <td class="nw">${esc(x.to||'To whom it may concern')}</td>
        <td style="color:var(--ink2)">${esc(x.why||'—')}</td>
        <td class="n nw">${esc(dayLabel(x.asked))}</td>
        <td class="r nw"><button class="btn" data-lt-ok="${esc(x.id)}" type="button" style="padding:3px 11px;font-size:12.5px">Issue</button>
          <button class="btn ghost" data-lt-no="${esc(x.id)}" type="button" style="padding:3px 11px;font-size:12.5px;margin-left:6px">Decline</button></td></tr>`).join('')}
      </tbody></table></div>
  </section>`:''}


  <div class="grid g2 gtop">
    <section class="panel">
      <header><h3>Request a letter</h3><span class="hint">goes to ${esc(ADMIN.split(' ')[0])}</span></header>
      <div class="pad">
        <div class="field"><label for="ltType">What do you need</label>
          <select id="ltType">${(HR().letterTypes||[]).filter(x=>!x.issueOnly).map(x=>`<option value="${esc(x.id)}"${f.type===x.id?' selected':''}>${esc(x.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="ltTo">Addressed to${t.needsAddressee?'':' <i style="font-style:normal;color:var(--ink3);font-weight:400">— optional</i>'}</label>
          <input id="ltTo" placeholder="${t.needsAddressee?'Bank, embassy or authority':'Leave it blank for &ldquo;To whom it may concern&rdquo;'}" value="${esc(f.to)}"></div>
        <div class="field"><label for="ltWhy">What it is for</label><input id="ltWhy" placeholder="A line is enough" value="${esc(f.why)}"></div>
        <button class="btn wide" id="ltSubmit" type="button"${(f.why && (!t.needsAddressee || f.to))?'':' disabled'}>Send the request</button>
        ${state.ltSent?`<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>Sent.</b> ${esc(ADMIN.split(' ')[0])} is emailed now, and you will get the letter here as soon as it is issued.</div>`:''}
      </div>
    </section>
    <section class="panel">
      <header><h3>How it works</h3></header>
      <div class="pad"><dl class="kv wide">
        <dt>Who issues it</dt><dd>${esc(ADMIN)} in accounts. Nobody else sees your request.</dd>
        <dt>How long</dt><dd>Same day in most cases — you are emailed the moment it is ready.</dd>
        <dt>What it says</dt><dd>Your name, designation, joining date and, on a salary certificate, your salary breakdown — printed on your company's letterhead.</dd>
        <dt>Getting it</dt><dd>Accounts write it, sign it and send it to you. It stays here too, so you can open it, print it or save it as a PDF any time. If you need it stamped, ask Admin.</dd>
      </dl></div>
    </section>
  </div>

  <section class="panel">
    <header><h3>${adm?'All letter requests':'Your requests'}</h3>
      <span style="margin-left:auto;color:var(--ink3);font-size:12.5px">${(adm?L:mine).length}</span></header>
    <div class="tw"><table>
      <thead><tr>${adm?'<th>Who</th>':''}<th>Reference</th><th>Letter</th><th>Addressed to</th><th>Asked</th><th>Status</th><th></th></tr></thead>
      <tbody>${(adm?L:mine).length?(adm?L:mine).map(x=>`<tr>
        ${adm?`<td class="nw">${nm(x.who)}</td>`:''}
        <td class="n nw">${esc(x.id)}</td><td class="nw">${esc(LTYPE(x.type).label)}</td>
        <td class="nw" style="color:var(--ink2)">${esc(x.to||'—')}</td>
        <td class="n nw">${esc(dayLabel(x.asked))}</td><td>${stPill(x.status)}</td>
        <td class="r">${x.status==='Issued'
            ? `<button class="btn ghost" data-lt-view="${esc(x.id)}" type="button" style="padding:3px 10px;font-size:12.5px">${state.ltOpen===x.id?'Hide':'View'}</button>`
            : (x.status==='Pending' && x.who===u)
            ? `<button class="btn ghost" data-ltpull="${esc(x.id)}" type="button" style="padding:3px 10px;font-size:12.5px">Withdraw</button>`
            : ''}</td></tr>`).join('')
        :`<tr><td colspan="${adm?7:6}" style="color:var(--ink3)">Nothing requested yet.</td></tr>`}
      </tbody></table></div>
  </section>

  ${open && open.status==='Issued'?`
  <section class="panel">
    <header><h3>${esc(LTYPE(open.type).label)}</h3><span class="pill mute">${esc(open.id)}</span>
      <span class="pill mute" style="margin-left:auto">A4</span>
      <button class="btn" id="slPrint" type="button" style="padding:6px 14px;font-size:13px">Print or save as PDF</button></header>
    <div class="slwrap">${letterHTML(open)}</div>
  </section>`:''}`;
}

function letterHTML(l){
  const r = payrollRowFor(l.who) || {};
  const co = visaCoOf(l.who);                    // the sponsoring entity, not the payroll one
  const ent = visaEnt(l.who);
  const logo = (LOGOS[co.key] || LOGOS.corplex).slip;
  const when = l.decided || l.asked;

  if(l.type === 'revision'){
    const basic = l.basic||0, allow = l.allow||0, tot = Math.round((basic+allow)*100)/100;
    return `<article class="slip letter">
    <header class="slhead">
      <img src="${logo}" alt="${esc(ent.legal)}">
      <div class="slco"><h4>${esc(ent.legal)}</h4>${ent.addr.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
    </header>
    <div class="slbody">
      <h5 class="lttitle big">Salary revision letter</h5>
      <div class="ltdear"><p>Dear <b>${esc(legalOf(l.who))}</b></p><p>Date: <b>${esc(dayLabel(when))} ${when.slice(0,4)}</b></p></div>
      <p class="ltbody">We are pleased to inform you that your salary has been revised with effect from
        <b>${esc(effLabel(l.eff))}</b>. Your revised salary stands as per the break-up given below:</p>
      <table class="lttab">
        <thead><tr><th>Earnings</th><th class="r">Amount</th></tr></thead>
        <tbody>
          <tr><td>Basic</td><td class="n r">${money(basic,2)}</td></tr>
          <tr><td>Other Allowance</td><td class="n r">${money(allow,2)}</td></tr>
        </tbody>
        <tfoot><tr><td>Total amount</td><td class="n r">AED ${money(tot,2)}</td></tr></tfoot>
      </table>
      <p class="ltbody">All other terms and conditions of your employment remain the same as mentioned in your
        offer letter and subsequent appraisal letters. The management is looking forward to your continued
        good performance and support.</p>
      <p class="ltbody"><b>Wishing you a great year ahead.</b></p>
      <div class="ltsig plain">
        <b>${esc(l.by || ADMIN)}</b>
        <i></i>
        <span>${esc(co.name)} Accounts Department</span>
      </div>
    </div>
  </article>`;
  }

  return `<article class="slip letter">
    <header class="slhead">
      <img src="${logo}" alt="${esc(ent.legal)}">
      <div class="slco"><h4>${esc(ent.legal)}</h4>${ent.addr.map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      <div class="slper"><span>Date</span><b>${esc(dayLabel(l.decided||l.asked))} ${(l.decided||l.asked).slice(0,4)}</b></div>
    </header>
    <div class="slbody">
      <p class="ltto">${esc(l.to || 'To whom it may concern')}</p>
      <h5 class="lttitle">${esc(LTYPE(l.type).label)}</h5>
      <p class="ltbody">${esc(letterFill(l))}</p>
      <p class="ltbody">This certificate is issued at the request of the employee and carries no financial obligation on the part of the company.</p>
      <div class="ltsig">
        <span>For and on behalf of</span>
        <b>${esc(ent.legal)}</b>
        <i></i>
        <span>Authorised signatory</span>
      </div>
      <p class="slfoot">-- This is a system-generated document. --</p>
    </div>
  </article>`;
}

function vLoans(){
  const u = state.user, adm = canAdmin(u), isAdmin = canUpload(u), isOwner = roleOf(u)==='owner';
  const L = HR().loans || [];
  const mine = L.filter(x=>x.who===u || x.who===myLoanName(u));
  const inbox = L.filter(x=>x.status==='Pending' && x.approver===u);
  const f = state.lnForm || (state.lnForm = {amount:'', months:'', why:'', plan:''});
  const amt = +f.amount || 0, mth = +f.months || 0;
  const monthly = (amt && mth) ? Math.round(amt/mth*100)/100 : 0;
  const goesTo = loanApprover(amt);
  const active = mine.filter(x=>x.status==='Approved' && loanLeft(x) > 0);
  const owe = active.reduce((s,x)=>s+loanLeft(x),0);
  const perMonth = active.reduce((s,x)=>s+x.monthly,0);
  const stPill = s => s==='Approved' ? '<span class="pill good"><span class="dt"></span>Approved</span>'
    : s==='Declined' ? '<span class="pill bad"><span class="dt"></span>Declined</span>'
    : s==='Cancelled' ? '<span class="pill mute">Withdrawn</span>'
    : '<span class="pill warn"><span class="dt"></span>Waiting</span>';
  const allActive = L.filter(x=>x.status==='Approved');

  return `
  <div class="strip">
    <div class="stat"><span class="k">You owe</span><span class="v" style="color:var(--${owe?'warn':'good'})"><span class="cur">AED</span>${money(owe,2)}</span>
      <span class="n">${active.length?active.length+' advance'+(active.length===1?'':'s')+' running':'nothing outstanding'}</span></div>
    <div class="stat"><span class="k">Coming off your salary</span><span class="v"><span class="cur">AED</span>${money(perMonth,2)}</span>
      <span class="n">each month until it clears</span></div>
    <div class="stat"><span class="k">Approval limit</span><span class="v"><span class="cur">AED</span>${money(LOANCAP(),0)}</span>
      <span class="n">below this ${esc(ADMIN.split(' ')[0])} decides, at or above it ${esc((loanApprover(LOANCAP())||'').split(' ')[0])}</span></div>
    ${adm?`<div class="stat"><span class="k">Waiting on you</span><span class="v" style="color:var(--${inbox.length?'warn':'good'})">${inbox.length}</span>
      <span class="n">${L.filter(x=>x.status==='Pending').length} in the queue overall</span></div>`
    :`<div class="stat"><span class="k">Your requests</span><span class="v">${mine.length}</span>
      <span class="n">${mine.filter(x=>x.status==='Pending').length} waiting on a decision</span></div>`}
  </div>

  ${inbox.length?`
  <section class="panel">
    <header><h3>Waiting on you</h3><span class="pill warn"><span class="dt"></span>${inbox.length}</span>
      <span class="hint">check the repayment plan before approving</span></header>
    <div class="tw"><table>
      <thead><tr><th>Who</th><th class="r">Amount</th><th class="r">Monthly</th><th>Over</th><th>Reason</th><th>Repayment plan</th><th></th></tr></thead>
      <tbody>${inbox.map(x=>`<tr>
        <td class="nw">${nm(x.who)}</td><td class="n r netcol">${money(x.amount,2)}</td>
        <td class="n r">${money(x.monthly,2)}</td><td class="n nw">${x.months} months</td>
        <td style="color:var(--ink2)">${esc(x.why)}</td>
        <td style="color:var(--ink2)">${esc(x.plan)}</td>
        <td class="r nw"><button class="btn" data-ln-ok="${esc(x.id)}" type="button" style="padding:3px 11px;font-size:12.5px">Approve</button>
          <button class="btn ghost" data-ln-no="${esc(x.id)}" type="button" style="padding:3px 11px;font-size:12.5px;margin-left:6px">Decline</button></td></tr>`).join('')}
      </tbody></table></div>
  </section>`:''}

  <div class="grid g2 gtop">
    <section class="panel">
      <header><h3>Request an advance</h3><span class="hint">${amt?'goes to '+esc((goesTo||'').split(' ')[0]):'who approves depends on the amount'}</span></header>
      <div class="pad">
        <div class="grid g2" style="gap:12px">
          <div class="field"><label for="lnAmt">Amount (AED)</label><input id="lnAmt" type="number" min="100" step="50" value="${esc(f.amount)}" placeholder="e.g. 2500"></div>
          <div class="field"><label for="lnMon">Repay over (months)</label><input id="lnMon" type="number" min="1" max="12" value="${esc(f.months)}" placeholder="e.g. 5"></div>
        </div>
        <div class="field"><label for="lnWhy">Reason</label><input id="lnWhy" placeholder="A line is enough" value="${esc(f.why)}"></div>
        <div class="field"><label for="lnPlan">Your repayment plan</label><input id="lnPlan" placeholder="How you will pay it back" value="${esc(f.plan)}"></div>
        ${amt&&mth?`<p class="note" style="margin:0 0 14px"><b>AED ${money(monthly,2)} a month for ${mth} month${mth===1?'':'s'}</b>, deducted from your salary.
          This goes to <b>${esc(goesTo)}</b> because it is ${amt<LOANCAP()?'below':'at or above'} the AED ${money(LOANCAP(),0)} limit.</p>`:''}
        <button class="btn wide" id="lnSubmit" type="button"${(amt&&mth&&f.why&&f.plan)?'':' disabled'}>Send the request</button>
        ${state.lnSent?`<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>Sent.</b> You will be emailed as soon as it is decided.</div>`:''}
      </div>
    </section>
    <section class="panel">
      <header><h3>How it works</h3></header>
      <div class="pad"><dl class="kv wide">
        <dt>Who approves</dt><dd>Under AED ${money(LOANCAP(),0)} it is ${esc(ADMIN)}. At AED ${money(LOANCAP(),0)} or above it goes to ${esc(loanApprover(LOANCAP()))}.</dd>
        <dt>The plan matters</dt><dd>Say clearly how many months and how much a month. A request without a workable plan gets sent back.</dd>
        <dt>How it is repaid</dt><dd>Deducted from your salary each month and shown on your payslip under Advance, until the balance clears.</dd>
        <dt>Leaving</dt><dd>Anything still outstanding is taken out of your final settlement.</dd>
      </dl></div>
    </section>
  </div>

  ${adm ? `<section class="panel">
    <header><h3>Your advances</h3>
      <span class="hint">accounts take advances like anybody else &mdash; these are yours</span>
      <span style="margin-left:auto;color:var(--ink3);font-size:12.5px">${mine.length}</span></header>
    <div class="tw"><table>
      <thead><tr><th>Reference</th><th class="r">Amount</th><th class="r">Monthly</th><th>From</th>
        <th class="r">Repaid</th><th class="r">Left</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>${mine.length ? mine.map(x => `<tr>
        <td class="n nw">${esc(x.id)}</td><td class="n r">${money(x.amount,2)}</td>
        <td class="n r">${money(x.monthly,2)}</td><td class="nw">${esc(x.start||'\u2014')}</td>
        <td class="n r">${money(x.paid||0,2)}</td>
        <td class="n r netcol"${loanLeft(x)>0?' style="color:var(--warn)"':''}>${x.status==='Approved'?money(loanLeft(x),2):'\u2014'}</td>
        <td style="color:var(--ink2)">${esc(x.why)}</td>
        <td>${stPill(x.status)}${x.status==='Pending'
          ? ` <button class="btn ghost sm" data-lnpull="${esc(x.id)}" type="button"
                style="padding:2px 9px;font-size:11.5px;margin-left:6px">Withdraw</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="8" style="color:var(--ink3)">Nothing yet.</td></tr>'}
      </tbody></table></div>
  </section>` : ''}

  <section class="panel">
    <header><h3>${adm?'Advances ledger':'Your advances'}</h3>
      ${adm?`<span class="hint">everyone &middot; ${allActive.length} running</span>`:''}
      <span style="margin-left:auto;color:var(--ink3);font-size:12.5px">${(adm?L:mine).length}</span></header>
    <div class="tw"><table>
      <thead><tr>${adm?'<th>Who</th>':''}<th>Reference</th><th class="r">Amount</th><th class="r">Monthly</th><th>From</th>
        <th class="r">Repaid</th><th class="r">Left</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>${(adm?L:mine).length?(adm?L:mine).map(x=>`<tr>
        ${adm?`<td class="nw">${nm(x.who)}</td>`:''}
        <td class="n nw">${esc(x.id)}</td><td class="n r">${money(x.amount,2)}</td>
        <td class="n r">${money(x.monthly,2)}</td><td class="nw">${esc(x.start||'—')}</td>
        <td class="n r">${money(x.paid||0,2)}</td>
        <td class="n r netcol"${loanLeft(x)>0?' style="color:var(--warn)"':''}>${x.status==='Approved'?money(loanLeft(x),2):'—'}</td>
        <td style="color:var(--ink2)">${esc(x.why)}</td>
        <td>${stPill(x.status)}${(x.status==='Pending' && (x.who===u || x.who===myLoanName(u)))
          ? ` <button class="btn ghost sm" data-lnpull="${esc(x.id)}" type="button"
                style="padding:2px 9px;font-size:11.5px;margin-left:6px">Withdraw</button>` : ''}</td></tr>`).join('')
        :`<tr><td colspan="${adm?9:8}" style="color:var(--ink3)">Nothing yet.</td></tr>`}
        ${adm?`<tr class="tot"><td>${allActive.length} running</td><td></td>
          <td class="n r">${money(allActive.reduce((s,x)=>s+x.amount,0),2)}</td>
          <td class="n r">${money(allActive.reduce((s,x)=>s+x.monthly,0),2)}</td><td></td>
          <td class="n r">${money(allActive.reduce((s,x)=>s+(x.paid||0),0),2)}</td>
          <td class="n r netcol">${money(allActive.reduce((s,x)=>s+loanLeft(x),0),2)}</td><td></td><td></td></tr>`:''}
      </tbody></table></div>
    ${adm?`<p class="cap">The monthly figure is what should sit in the <b>Advance</b> column of the payroll file for that person. The portal does not write it &mdash; it is here so the balance is never guessed at.</p>`:''}
  </section>`;
}

function vExits(){
  const open = state.exitOpen ? EXITS().find(x => x.id === state.exitOpen) : null;
  if(open) return vExitOne(exitOf(open));

  const sel = state.exitWho, lwd = state.exitLwd || '';
  const staff = DATA.payroll.rows.filter(r=>!r.dummy).map(r=>r.name).sort();
  const lines = state.exitLines || [];
  const c = (sel && lwd) ? exitCalc(sel, lwd, {lines}) : null;
  const list = EXITS().slice().sort((a,b)=>
    (EXSTAGE[a.status]||0)-(EXSTAGE[b.status]||0) || a.lastDay.localeCompare(b.lastDay));
  const line = (l,v,neg) => `<tr><td>${l}</td><td class="n r"${neg?' style="color:var(--bad)"':''}>${neg?'(':''}${money(Math.abs(v),2)}${neg?')':''}</td></tr>`;
  const already = sel ? exitFor(sel) : null;

  return `
  <section class="panel">
    <header><h3>${state.exitId ? 'Change this settlement' : 'Work out a settlement'}</h3>
      <span class="hint">nothing is written down until you save it</span></header>
    <div class="pad">
      <div class="grid g3" style="gap:14px">
        <div class="field" style="margin:0"><label for="exWho">Employee</label>
          <select id="exWho"${state.exitId?' disabled':''}><option value="">Choose someone</option>
            ${staff.map(n=>`<option value="${esc(n)}"${sel===n?' selected':''}>${esc(NM(n))}</option>`).join('')}</select></div>
        <div class="field" style="margin:0"><label for="exLwd">Last working day</label>
          <input id="exLwd" type="date" value="${esc(lwd)}"></div>
        <div class="field" style="margin:0"><label for="exSettle">Settlement date</label>
          <input id="exSettle" type="date" value="${esc(state.exitSettle || lwd)}"${lwd?'':' disabled'}>
          <span class="pfhint">The day the money leaves. Defaults to the last working day.</span></div>
      </div>
      ${already && already.id !== state.exitId
        ? `<p class="note" style="margin-top:16px;border-left-color:var(--warn)"><b>${nm(sel)} already has a settlement in progress</b>
            &mdash; ${esc(EXLABEL[already.status] || already.status)}. <button class="btn ghost sm" data-exopen="${esc(already.id)}" type="button">Open it</button></p>`
        : ''}
      ${!c?`<p class="note" style="margin-top:16px">Pick someone and a last working day. Everything else is worked out from what the portal already holds &mdash; joining date, salary, leave balance, unclaimed air tickets and any advance still running.</p>`:''}
    </div>
  </section>

  ${c?`
  <div class="grid g2 gtop">
    <section class="panel">
      <header><h3>${nm(sel)}</h3><span class="pill mute">${esc(c.row.id)}</span>
        <span class="hint">${esc(DATA.companies[coByCode(c.row.company).key].name)}</span></header>
      <div class="pad"><dl class="kv">
        <dt>Joined</dt><dd>${esc(c.doj)||'—'}</dd>
        <dt>Last working day</dt><dd>${esc(dayLabel(c.lwd))} ${c.lwd.slice(0,4)}</dd>
        <dt>Service</dt><dd>${c.years.toFixed(2)} years</dd>
        <div class="sep"></div>
        <dt>Monthly salary</dt><dd>${money(c.salary,2)}</dd>
        <dt>Basic (${Math.round(DATA.master.basicPct*100)}%)</dt><dd>${money(c.basic,2)}</dd>
        <dt>Daily basic</dt><dd>${money(c.dayBasic,2)}</dd>
        <dt>Leave days left</dt><dd>${c.leaveDays}</dd>
      </dl></div>
    </section>

    <section class="panel">
      <header><h3>What is due</h3>
        <button class="btn ghost" id="exDoc" type="button">Open the settlement</button></header>
      <div class="tw"><table>
        <tbody>
          ${line('Salary for ' + c.period + ' \u2014 ' + c.paidDays + ' paid day' + (c.paidDays===1?'':'s'), c.monthPay)}
          ${line('End-of-service gratuity' + (noGratuity(c.row.portalName || c.row.name)
            ? ' \u2014 none accrues' : ''), c.grat)}
          ${line('Leave encashment — '+c.leaveDays+' days at daily basic', c.leaveCash)}
          ${c.ticket?line('Unclaimed air tickets', c.ticket):''}
          ${lines.map((x,i)=>`<tr><td>${x.label?esc(x.label):'<i style="color:var(--ink3)">describe this line</i>'}
            <button class="exdrop" data-exdrop="${i}" type="button" title="Remove this line" aria-label="Remove this line">&times;</button></td>
            <td class="n r"${x.deduct?' style="color:var(--bad)"':''}>${x.deduct?'(':''}${money(Math.abs(+x.amount||0),2)}${x.deduct?')':''}</td></tr>`).join('')}
          ${c.adv?line('Advance still outstanding', -c.adv, true):''}
          <tr class="tot"><td><b>Final settlement</b></td><td class="n r netcol"><b>AED ${money(c.net,2)}</b></td></tr>
        </tbody></table></div>
      <div class="pad" style="padding-top:14px">
        ${lines.map((x,i)=>`<div class="exline">
          <input class="ff" placeholder="What is it for" value="${esc(x.label)}" data-exlbl="${i}">
          <input class="ff n" type="number" step="0.01" min="0" placeholder="0.00" value="${x.amount===''?'':esc(String(x.amount))}" data-examt="${i}">
          <div class="seg sm"><button data-exsign="${i}" data-v="add" aria-pressed="${x.deduct?'false':'true'}" type="button">Add</button><button data-exsign="${i}" data-v="less" aria-pressed="${x.deduct?'true':'false'}" type="button">Deduct</button></div>
        </div>`).join('')}
        <div class="btns" style="margin-top:${lines.length?'12px':'0'}">
          <button class="btn ghost" id="exAdd" type="button">Add a line</button>
          <button class="btn" id="exSave" type="button"${state.exBusy?' disabled':''}>${
            state.exBusy ? 'Saving\u2026' : state.exitId ? 'Save the changes' : 'Save as draft'}</button>
          ${state.exitId?'<button class="btn ghost" id="exCancel" type="button">Stop editing</button>':''}
        </div>
      </div>
      <p class="cap">A line is a description and an amount &mdash; a bonus, a quarter's commission, a laptop that did
        not come back. Gratuity on the standard rule &mdash; ${c.years<1?'under one year of service, so none is due':'21 days of basic pay for each of the first five years and 30 days a year after that'}${c.capped?', capped at two years of total pay':''}.
        Leave and gratuity are both worked out on <b>basic</b>, not total salary.</p>
    </section>
  </div>`:''}

  <section class="panel">
    <header><h3>Settlements</h3>
      <span class="hint">${list.length ? list.filter(x=>x.status!=='paid').length + ' open' : 'none yet'}</span></header>
    ${list.length ? `<div class="tw"><table class="cotab">
      ${colsOf([21, 13, 12, 15, 15, 24])}
      <thead><tr><th>Employee</th><th>Last day</th><th>Month</th><th class="r">Settlement</th><th>Stage</th><th class="r"></th></tr></thead>
      <tbody>${list.map(x=>{
        const cc = exitOf(x).c;
        return `<tr>
        <td>${nm(x.who)}</td>
        <td class="n nw">${esc(dayLabel(x.lastDay))} ${x.lastDay.slice(0,4)}</td>
        <td class="nw" style="color:var(--ink2)">${x.month ? esc(MONTHNAME[+x.month.slice(5)-1] + ' ' + x.month.slice(0,4)) : '\u2014'}</td>
        <td class="n r netcol">${money(x.net === null ? cc.net : x.net, 2)}</td>
        <td class="nw">${exitPill(x.status)}</td>
        <td class="r nw">${x.status === 'draft'
          ? `<button class="btn ghost sm" data-exedit="${esc(x.id)}" type="button">Edit</button>
             <button class="btn sm" data-exgo="${esc(x.id)}" type="button">Initiate exit process</button>`
          : `<button class="btn ghost sm" data-exopen="${esc(x.id)}" type="button">Open</button>`}</td></tr>`;}).join('')}
      </tbody></table></div>` : '<div class="pad"><p style="margin:0;color:var(--ink3)">Nothing saved yet. Work one out above and save it as a draft.</p></div>'}
    <p class="cap">A draft is yours to change as often as you need to, right up to the day.
      <b>Initiate</b> writes the figures down, posts the settlement to the month of the last working day, and takes
      the person off that month's payroll and off the staff list &mdash; every record they have is kept. After that
      it goes to their reporting manager and to ${nm((USERS.find(u=>u.role==='owner')||{}).name||'the owner')} to approve.</p>
  </section>`;
}

/* One settlement, opened: where it has got to, who it is with, and the only
   buttons that belong to whoever is looking at it. */
function vExitOne(x){
  const c = x.c, me = state.user;
  const owner = (USERS.find(u=>u.role==='owner')||{}).name || '';
  const isOwner = roleOf(me) === 'owner';
  const isMgr = x.mgr === me;
  const isAcc = canUpload(me);
  const one = x.mgr === owner;            // the manager IS the owner: one stage
  const st = x.status, at = EXSTAGE[st] || 0;
  /* The rail. It was six calls with their own hand-worked done/now flags, and
     two of them said "here" at the same time — at 'initiated' both step 2 and
     step 3 claimed to be where it was. It is a list now, each step carrying
     the status it IS, so done and here are read off one number and cannot
     disagree with each other:

       done  the settlement has reached this step's own status
       here  the first step it has not \u2014 what is being waited on

     'Miraziz approved' was also typed in rather than read off the owner, and
     the whole thing had no stylesheet, which is why it came out as
     '1 · doneDraftedby Avin Mascarenhas'. */
  const OWN1 = (NM(owner) || 'The owner').split(' ')[0];
  const STEPS = [
    ['draft', 'Drafted', x.by ? 'by ' + NM(x.by) : 'not sent yet'],
    ['initiated', 'Initiated', x.month
        ? MONTHNAME[+x.month.slice(5)-1] + ' ' + x.month.slice(0,4) + ' payroll'
        : 'waiting on accounts'],
    ...(one ? [] : [['mgr_ok', 'Manager approved', x.mgrOkBy
        ? NM(x.mgrOkBy) + ', ' + dayLabel(x.mgrOkAt)
        : 'with ' + (NM(x.mgr) || NM(mgrName(x.who)) || 'the manager')]]),
    ['owner_ok', one ? 'Approved' : OWN1 + ' approved', x.ownerOkBy
        ? NM(x.ownerOkBy) + ', ' + dayLabel(x.ownerOkAt)
        : 'with ' + (NM(owner) || 'the owner')],
    ['decided', 'Payment decided', x.payMode
        ? (x.payMode === 'with_salaries' ? 'with the salaries' : 'on its own')
        : 'accounts chooses how'],
    ['paid', 'Paid', x.paidOn ? dayLabel(x.paidOn) + ' ' + x.paidOn.slice(0,4) : 'not yet']
  ];
  /* A step is done when the settlement has reached the status that step ends
     at; 'here' is the first one it has not. The last step has no status after
     it, so it is done only when everything is paid. */
  const reached = k => at >= EXSTAGE[k];
  const hereAt = STEPS.findIndex(([k]) => !reached(k));
  const step = ([k, label, sub], i) => `<div class="step${reached(k)?' done':''}${
      i === hereAt ? ' now' : ''}">
    <i>${i + 1}</i>
    <span class="sw">${reached(k) ? 'done' : i === hereAt ? 'here' : ''}</span>
    <b>${esc(label)}</b><em>${esc(sub || '')}</em></div>`;
  return `
  <section class="panel">
    <header><h3>${nm(x.who)} &mdash; final settlement</h3>
      ${exitPill(st)}
      <span class="hint">last day ${esc(dayLabel(x.lastDay))} ${x.lastDay.slice(0,4)} &middot; AED ${money(x.net===null?c.net:x.net,2)}</span>
      <button class="btn ghost" id="exBack" type="button" style="margin-left:12px">Back to settlements</button></header>
    <div class="pad">
      <div class="wfbar exrail">${STEPS.map(step).join('')}</div>
      ${x.backWhy?`<div class="note" style="border-left-color:var(--bad);margin-bottom:16px"><b>Sent back${x.backBy?' by '+NM(x.backBy):''}.</b> ${esc(x.backWhy)}</div>`:''}
      ${state.exAsk===x.id?`<div class="ciwarn" style="border-left-color:var(--bad)">
        <b>What is wrong with it?</b>
        <div class="ciwrow"><input id="exWhy" placeholder="so accounts knows what to fix" value="${esc(state.exWhy||'')}">
          <button class="btn" id="exWhyGo" type="button"${(state.exWhy||'').trim()?'':' disabled'}>Send it back</button>
          <button class="btn ghost" id="exWhyNo" type="button">Cancel</button></div></div>`:''}
      <div class="btns" style="margin-top:16px">
        ${(isMgr && st==='initiated') || (isOwner && ['initiated','mgr_ok'].includes(st))
          ? `<button class="btn" data-exok="${esc(x.id)}" type="button">Approve it</button>
             <button class="btn ghost" data-exno="${esc(x.id)}" type="button">Send it back</button>
             ${isOwner && !isMgr && st === 'initiated' && !one
               ? `<span style="font-size:13px;color:var(--ink2)">Still with ${NM(x.mgr) || NM(mgrName(x.who)) || 'the manager'}.
                   Approving now counts as both.</span>` : ''}` : ''}
        ${isAcc && st==='owner_ok' ? `<span style="font-size:13px;color:var(--ink2)">Approved. How is it paid?</span>
          <button class="btn" data-expay="${esc(x.id)}" data-mode="with_salaries" type="button">With the salaries</button>
          <button class="btn ghost" data-expay="${esc(x.id)}" data-mode="separate" type="button">On its own</button>` : ''}
        ${isAcc && st==='decided' ? `<button class="btn" data-exdone="${esc(x.id)}" type="button">Mark it paid</button>
          <span style="font-size:13px;color:var(--ink2)">${x.payMode==='with_salaries'?'going out with the salaries':'going out on its own'}</span>` : ''}
        <button class="btn ghost" data-exsee="${esc(x.id)}" type="button">Open the settlement document</button>
        ${isAcc && !['paid','draft'].includes(st)
          ? `<button class="btn ghost" data-exundo="${esc(x.id)}" type="button">Undo &mdash; back to draft</button>` : ''}
        ${isAcc && st !== 'paid'
          ? `<button class="btn ghost bad" data-exkill="${esc(x.id)}" type="button">${
              st === 'draft' ? 'Discard this draft' : 'Withdraw &mdash; they are staying'}</button>` : ''}
      </div>
      ${isAcc && st === 'draft' ? `<p class="cap" style="padding:14px 0 0">Nothing has been sent to anybody yet
        and ${nm(x.who)} is on the payroll as normal. <b>Discard this draft</b> clears it \u2014 which is what to
        press after working a settlement out for somebody who then stays, or for somebody who only wanted to
        see the number.</p>` : ''}
      ${isAcc && st==='paid' ? '<p class="cap" style="padding:14px 0 0">Paid and closed. Nothing further to do.</p>' : ''}
    </div>
  </section>

  <div class="grid g2 gtop">
    <section class="panel">
      <header><h3>What was owed</h3><span class="hint">${x.frozen?'frozen when it was initiated':'still being worked out'}</span></header>
      <div class="tw"><table><tbody>
        <tr><td>Salary for ${esc(c.period)} &mdash; ${c.paidDays} paid day${c.paidDays===1?'':'s'}</td><td class="n r">${money(c.monthPay,2)}</td></tr>
        <tr><td>End-of-service gratuity${noGratuity(x.who)
          ? ' <span class="pill mute" title="No end-of-service provision is held for them">none accrues</span>' : ''}</td>
          <td class="n r">${money(c.grat,2)}</td></tr>
        <tr><td>Leave encashment &mdash; ${c.leaveDays} days</td><td class="n r">${money(c.leaveCash,2)}</td></tr>
        ${c.ticket?`<tr><td>Unclaimed air tickets</td><td class="n r">${money(c.ticket,2)}</td></tr>`:''}
        ${(c.extra||[]).map(l=>`<tr><td>${esc(l.label||'—')}</td><td class="n r"${l.deduct?' style="color:var(--bad)"':''}>${l.deduct?'(':''}${money(Math.abs(+l.amount||0),2)}${l.deduct?')':''}</td></tr>`).join('')}
        ${c.adv?`<tr><td>Advance still outstanding</td><td class="n r" style="color:var(--bad)">(${money(c.adv,2)})</td></tr>`:''}
        <tr class="tot"><td><b>Final settlement</b></td><td class="n r netcol"><b>AED ${money(x.net===null?c.net:x.net,2)}</b></td></tr>
      </tbody></table></div>
      <p class="cap">${x.frozen
        ? 'These figures were written down when the exit was initiated. A salary revision or another month of leave accrual cannot move them now &mdash; which is the point, because this is what somebody signs for.'
        : 'Worked out from what the portal holds today. Initiating writes them down.'}</p>
    </section>

    <section class="panel">
      <header><h3>Before the last day</h3><span class="hint">tick these off</span></header>
      <div class="pad"><dl class="kv wide">
        <dt>Handover</dt><dd>Named successor for live files and clients, and their portal access updated.</dd>
        <dt>Company property</dt><dd>Laptop, phone, SIM, access card and keys returned.</dd>
        <dt>Portal access</dt><dd>${x.status==='draft'?'Ends by itself the day after the last working day, once the exit is initiated.':'Ends after '+esc(dayLabel(x.lastDay))+'.'}</dd>
        <dt>Visa and labour card</dt><dd>Cancellation started with the PRO &mdash; the expiry dates are on the Documents page.</dd>
        <dt>Air ticket</dt><dd>${c.ticket?`AED ${money(c.ticket,2)} of unclaimed entitlement is included above.`:'Nothing unclaimed.'}</dd>
        <dt>The last month</dt><dd>${x.month?`Inside the settlement, and ${nm(x.who)} is off the ${esc(MONTHNAME[+x.month.slice(5)-1])} run.`:'Inside the settlement once this is initiated.'}</dd>
      </dl></div>
    </section>
  </div>`;
}

/* ---------- employee profile ---------- */
const PROF = u => (HR().profile||{})[u] || null;
function bdayISO(u){
  const dm = bdayOf(u); if(!dm) return '';
  const [d,m] = dm.split(' '); const mm = MIDX[m]; if(!mm) return '';
  return `2000-${String(mm).padStart(2,'0')}-${String(+d).padStart(2,'0')}`;
}
const UPLOADS = () => HR().uploadTypes || [];
/* The four references. Held so a gap in somebody's file is visible on one
   screen; masked by default because they are government identifiers and this
   table is looked at with somebody standing behind you. */
const REFOF = (n, k) => ((HR().ref || {})[n] || {})[k] || '';
/* Two characters, four dots, four characters — the same shape whatever the
   document, so it fits a column and two rows can still be told apart. It is
   deliberately not "everything but the last digit": a mask that keeps almost
   all of a government number is not a mask, and an Emirates ID's readable
   prefix is the year of birth. */
function maskRef(v){
  const s = String(v || '').trim();
  if(s.length <= 6) return s.length <= 2 ? s : s.slice(0, 1) + '\u2022'.repeat(s.length - 1);
  return s.slice(0, 2) + '\u2022\u2022\u2022\u2022' + s.slice(-4);
}
const DOCREF = {eid:'eid', passport:'passport', visa:'visa', labour:'labour'};
const fileOf = (u,k) => ((HR().files||{})[u]||{})[k] || null;
const kb = n => n>=1048576 ? (n/1048576).toFixed(1)+' MB' : Math.round(n/1024)+' KB';
const PICKS = {gender:['Female','Male'], marital:['Single','Married']};
/* row groups the fields into lines; the numbers are what the page reads across */
const PFIELDS = [
  {k:'callMe',      label:'Name you go by',         group:'you',   req:false, ph:'Leave blank to use your full name', row:1},
  {k:'bday',        label:'Date of birth',          group:'you',   req:false, bday:true, row:1, theirs:false},
  {k:'gender',      label:'Gender',                 group:'you',   req:true,  pick:'gender', row:2},
  {k:'marital',     label:'Marital status',         group:'you',   req:true,  pick:'marital', row:2},
  {k:'mobile',      label:'Personal mobile',        group:'you',   req:true,  ph:'+971 50 000 0000',
   note:'Only you and accounts see this. Colleagues get the work number.', row:2},
  {k:'pemail',      label:'Personal email',         group:'you',   req:true,  ph:'you@example.com', row:3},
  {k:'uaeAddr',     label:'Address in the UAE',     group:'you',   req:true,  ph:'Flat, building, area, emirate', row:3},
  {k:'homeCountry', label:'Home country',           group:'home',  req:true,  ph:'Country', row:1},
  {k:'homeAddr',    label:'Permanent address',      group:'home',  req:true,  ph:'Address back home', row:1},
  {k:'homeContact', label:'Contact there',          group:'home',  req:false, ph:'Name of someone at that address', row:2},
  {k:'homePhone',   label:'Their phone',            group:'home',  req:false, ph:'+00 00 000 0000', row:2},
  {k:'ecName',      label:'Name',                   group:'emg',   req:true,  ph:'Who we call first', row:1},
  {k:'ecRel',       label:'Relationship',           group:'emg',   req:true,  ph:'Father, spouse, friend', row:1},
  {k:'ecPhone',     label:'Phone',                  group:'emg',   req:true,  ph:'+971 50 000 0000', row:2},
  {k:'ecAlt',       label:'Alternate phone',        group:'emg',   req:false, ph:'Optional', row:2}
];
function profDone(u){
  const p = PROF(u); if(!p) return {pct:0, missing:[], done:0, total:0};
  const missing = [];
  PFIELDS.filter(f=>f.req).forEach(f=>{
    const v = f.bday ? bdayOf(u) : p[f.k];
    if(!String(v||'').trim()) missing.push(f.label); });
  const d = docsOf(u) || {};
  UPLOADS().filter(t=>t.need).forEach(t=>{
    if(!fileOf(u,t.k)) missing.push(t.label+' copy');
    if(!d[t.k]) missing.push(t.label+' expiry');
  });
  const total = PFIELDS.filter(f=>f.req).length + UPLOADS().filter(t=>t.need).length*2;
  const done = total - missing.length;
  return {pct: Math.round(done/total*100), missing, done, total};
}
function vProfile(){
  const u = state.user, p = PROF(u);
  if(!p) return `<section class="panel"><div class="pad" style="padding:52px 24px;text-align:center">
    <h3 style="font-size:20px;margin-bottom:8px">No profile yet</h3>
    <p style="color:var(--ink2)">Accounts has not set one up for you. Ask them.</p></div></section>`;
  const r = payrollRowFor(u) || {};
  const co = companyOf(u);
  const D = profDone(u), docs = docsOf(u) || {};
  const fld = f => `<div class="field"><label for="pf_${f.k}">${esc(f.label)}${
      f.theirs === false ? ' <span style="text-transform:none;letter-spacing:0;color:var(--ink3)">(accounts sets this)</span>'
      : f.req ? '' : ' <span style="text-transform:none;letter-spacing:0;color:var(--ink3)">(optional)</span>'}</label>
    ${f.bday
      ? `<div class="pfread">${bdayOf(u)
            ? esc(bdayDM(u)) + (bdayYr(u) ? ' <span style="color:var(--ink3)">' + esc(bdayYr(u)) + '</span>' : '')
            : '<span class="miss">not on file</span>'}</div>
         <span class="pfhint">${bdayOf(u)
            ? 'Accounts sets this from your passport. If it is wrong, tell them and it is a two-second fix.'
            : 'Accounts has not filled this in yet. Until they do you cannot book your birthday half-day.'}
           ${bdayYr(u) ? 'Your colleagues see the day and the month only \u2014 never the year.' : ''}</span>`
      : f.pick
      ? `<select id="pf_${f.k}" data-pfs="${f.k}"><option value="">Not said</option>${PICKS[f.pick].map(o=>`<option value="${esc(o)}"${p[f.k]===o?' selected':''}>${esc(o)}</option>`).join('')}</select>`
      : `<input id="pf_${f.k}" data-pf="${f.k}" value="${esc(p[f.k]||'')}" placeholder="${esc(f.ph||'')}">`}${
      f.note ? `<span class="pfhint">${esc(f.note)}</span>` : ''}</div>`;
  const grp = g => {
    const fs = PFIELDS.filter(f=>f.group===g);
    const rows = [...new Set(fs.map(f=>f.row||0))];
    return rows.map(r => {
      const line = fs.filter(f=>(f.row||0)===r);
      return `<div class="frow c${line.length}">${line.map(fld).join('')}</div>`;
    }).join('');
  };
  const ro = (l,v) => `<dt>${esc(l)}</dt><dd style="font-family:inherit;font-weight:600">${esc(v||'—')}</dd>`;

  return `
  <section class="panel">
    <div class="pfhead">
      <div class="pfpic">
        ${p.photo ? `<img src="${p.photo.url}" alt="${nm(u)}">` : `<span>${esc(NM(u).split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`}
        <label class="pfpicbtn">${state.upBusy==='photo' ? 'Uploading…' : p.photo?'Change':'Add photo'}<input type="file" accept="image/*" data-photo="1" hidden${state.upBusy?' disabled':''}></label>
        ${p.photo && !state.upBusy ? '<button class="pfpicdel" id="pfPhotoOff" type="button">Remove</button>' : ''}
      </div>
      <div class="pfwho">
        <h2>${nm(u)}</h2>${goesBy(u)?`<p class="pfleg">${esc(legalOf(u))} on record &mdash; payslips and letters use this</p>`:''}
        <p>${esc(r.title||'—')} &middot; ${esc(co.name)}${r.id?' &middot; '+esc(r.id):''}</p>
        <span class="pfupd">${p.updated?'Last updated '+esc(dayLabel(p.updated))+' '+p.updated.slice(0,4):'Not filled in yet'}</span>
      </div>
      <div class="pfmeter">
        <div class="pfbar"><i style="width:${D.pct}%;background:var(--${D.pct===100?'good':D.pct>=60?'accent':'warn'})"></i></div>
        <b>${D.pct}%</b>
        <span>${D.missing.length?D.missing.length+' still to do':'complete — thank you'}</span>
      </div>
    </div>
    ${D.missing.length?`<div class="pad" style="padding-top:0"><p class="note" style="margin:0"><b>Still needed:</b> ${esc(D.missing.slice(0,6).join(', '))}${D.missing.length>6?' and '+(D.missing.length-6)+' more':''}.</p></div>`:''}
  </section>

  <div class="grid g2 gtop pfgrid">
    <section class="panel">
      <header><h3>Your details</h3><span class="hint">yours to change any time</span></header>
      <div class="pad">${grp('you')}</div>
    </section>
    <section class="panel">
      <header><h3>Employment</h3><span class="hint">accounts holds these &mdash; ask them to change one</span></header>
      <div class="pad"><dl class="kv">
        ${ro('Employee ID', r.id)}
        ${ro('Company', co.name)}
        ${ro('Designation', r.title)}
        ${ro('Department', r.dept)}
        ${ro('Date of joining', r.doj)}
        ${ro('Shift', tracksAtt(u) ? shiftOf(u).start+'–'+shiftOf(u).end : 'not on the attendance list')}
        ${ro('Reports to', mgrName(u) || '—')}
        ${ro('Work email', emailOf(u) || r.email)}
        ${phoneOf(u) ? ro('Work phone', phoneOf(u)) : ''}
        ${(() => {
          const REFS = [['eid','Emirates ID'],['passport','Passport'],['visa','Residence visa'],['labour','Labour card']];
          const have = REFS.filter(([k]) => REFOF(u, k));
          if(!have.length) return '';
          return have.map(([k, l], i) => `<dt>${esc(l)}</dt><dd style="font-family:inherit;font-weight:600">
            <span class="refval" data-full="${esc(REFOF(u, k))}">${esc(maskRef(REFOF(u, k)))}</span>${i ? '' :
            ` <button class="btn ghost" id="eidShow" type="button" style="padding:1px 8px;font-size:11.5px;margin-left:8px;font-weight:500">Show numbers</button>`}</dd>`).join('')
            + (have.length < REFS.length ? `<dt>Not on file</dt><dd style="font-family:inherit;color:var(--ink3)">${
                esc(REFS.filter(([k]) => !REFOF(u, k)).map(x => x[1]).join(', '))}</dd>` : '');
        })()}
      </dl>
      <p class="cap" style="padding:0;margin-top:14px">Bank details are not held here at all, and your salary breakdown is on your payslip rather than this page. Your <b>Emirates ID, passport, residency visa and labour card numbers</b> are held because payroll, insurance and the MOHRE filings need them &mdash; only you and accounts can see them, on any screen, they are never in an email, and they are masked until you press Show. They are accounts&rsquo; to type, off the documents themselves; if one of them is wrong or missing here, tell accounts. Gender and marital status are asked only because maternity and paternity leave depend on them.</p></div>
    </section>
    <section class="panel">
      <header><h3>Home country</h3><span class="hint">where to reach you and yours</span></header>
      <div class="pad">${grp('home')}</div>
    </section>
    <section class="panel">
      <header><h3>Emergency contact</h3><span class="hint">who we call if something happens</span></header>
      <div class="pad">${grp('emg')}</div>
    </section>
  </div>

  <section class="panel">
    <header><h3>Your documents</h3>
      <span class="hint">upload a copy and type the expiry date &mdash; the date is what drives the reminders</span></header>
    <div class="tw"><table>
      <thead><tr><th>Document</th><th>Copy</th><th>Expires</th><th>When</th><th>Status</th></tr></thead>
      <tbody>${UPLOADS().map(t=>{
        const f = fileOf(u,t.k), exp = docs[t.k]||'';
        const n = exp ? dTo(exp) : null;
        const state2 = !exp ? 'none' : n<0 ? 'expired' : n<=(DOCTYPES().find(x=>x.k===t.k)||{warn:60}).warn ? 'soon' : 'ok';
        return `<tr>
          <td class="nw">${esc(t.label)}${t.need?'':' <span class="pill mute">optional</span>'}</td>
          <td class="nw">${f?`<span class="pffile"><b>${esc(f.name)}</b><em>${kb(f.size)}</em>${f.url?` <button class="lookbtn" data-look="${esc(t.k)}" type="button">View</button>`:''}</span>`
            :'<span style="color:var(--ink3)">not uploaded</span>'}
            <label class="pfup">${state.upBusy===t.k ? 'Uploading…' : f?'Replace':'Upload'}<input type="file" accept="image/*,application/pdf" data-doc="${esc(t.k)}" hidden${state.upBusy?' disabled':''}></label></td>
          <td><input class="ff pfdate" type="date" data-docexp="${esc(t.k)}" value="${esc(exp)}"></td>
          <td class="nw" style="color:var(--ink2)">${exp?esc(inWord(n)):'—'}</td>
          <td>${exp?DOCPILL(state2):'<span class="pill mute">Nothing yet</span>'}</td></tr>`;
      }).join('')}
      </tbody></table></div>
    <div class="pfsave${state.pfDirty ? ' on' : state.pfSaved ? ' just' : ''}">
      <span>${state.pfDirty
        ? Object.keys(state.pfDirty).length + ' change' + (Object.keys(state.pfDirty).length===1?'':'s') + ' not saved yet'
        : 'Your changes are saved'}</span>
      <button class="btn" id="pfSave" type="button"${state.pfDirty ? '' : ' disabled'}>Save changes</button>
    </div>
    <p class="cap">Take a clear photo or scan of the whole page. PDF or image, up to about 5 MB each. The expiry date you type is what drives the reminders, so take it off the document rather than from memory. <b>The number on each of these is held too</b>, by accounts, off the copy you upload &mdash; that changed in September 2026, and the four are listed under Employment above. Your documents and your numbers are visible to you and to accounts, nobody else.</p>
  </section>`;
}

function vProfilesAdmin(){
  const rows = USERS.map(x=>x.name).map(n=>({n, d:profDone(n), p:PROF(n)||{}}))
    .sort((a,b)=>a.d.pct-b.d.pct);
  const done = rows.filter(r=>r.d.pct===100).length;
  const none = rows.filter(r=>!(r.p.updated)).length;
  return `
  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Profile completeness</h3>
      <span class="pill ${done===rows.length?'good':'warn'}">${done} of ${rows.length} complete</span>
      <span class="hint">filled in by the employee, not by you</span></header>
    ${byCompany(rows, {
      who: r => r.n, cls: 'invtable',
      cols: colsOf([26, 19, 37, 18]),
      note: rs => `${rs.filter(r=>r.d.pct===100).length} of ${rs.length} complete`,
      head: `<thead><tr><th>Employee</th><th>Done</th><th>Still needed</th><th>Last updated</th></tr></thead>`,
      row: r => `<tr>
        <td class="nw">${nm(r.n)}</td>
        <td><div class="pfbar sm"><i style="width:${r.d.pct}%;background:var(--${r.d.pct===100?'good':r.d.pct>=60?'accent':'warn'})"></i></div>
          <span style="font-size:12px;color:var(--ink2)">${r.d.pct}%</span></td>
        <td style="color:var(--ink2);font-size:12.5px"${full(r.d.missing.join(', '))}>${r.d.missing.length?esc(r.d.missing.slice(0,4).join(', '))+(r.d.missing.length>4?' +'+(r.d.missing.length-4):''):'—'}</td>
        <td class="n nw" style="color:var(--ink2)">${r.p.updated?esc(dayLabel(r.p.updated))+' '+r.p.updated.slice(0,4):'never'}</td></tr>`,
      empty: 'Nobody has a profile yet.'
    })}
    <p class="cap">${none?`<b>${none} ${none===1?'person has':'people have'} not started.</b> `:''} Nothing here is verified &mdash; whatever an employee uploads and dates is taken as correct and feeds the expiry reminders straight away, so a wrong date means a missed warning. Chase the empty rows.</p>
  </section>`;
}

/* ---------- home ---------- */
const ICO = {
  dash:'<path d="M3 13h6V3H3zM13 21h6V11h-6zM3 21h6v-4H3zM13 7h6V3h-6z"/>',
  comm:'<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  inv:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  board:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  dept:'<path d="M3 21V8l6-4 6 4v13M9 21v-5h4v5M15 21V12l6-3v12"/>',
  calc:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4"/>',
  pay:'<path d="M4 5h16v14H4z"/><path d="M4 10h16M8 15h4"/>',
  slip:'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
  plane:'<path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.5.5 0 0 0-.5.8l3.2 3.4-2 2-2.2-.5a.5.5 0 0 0-.5.8L5 15l1.8 2.2a.5.5 0 0 0 .8-.5L7.1 14.5l2-2 3.4 3.2a.5.5 0 0 0 .8-.5z"/>',
  con:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h8M8 16.5h5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3M8 17.5h6"/>',
  people:'<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.4"/><path d="M22 20v-2a4 4 0 0 0-3-3.8M16.5 3.6a3.4 3.4 0 0 1 0 6.6"/>'
};
const svg = k => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;

/* everything waiting on one person, in one list, for the bell */
function alertsFor(u){
  const H = HR(), adm = canAdmin(u), role = roleOf(u), today = HDATE();
  const out = [];
  const add = (key, t, s, tab, kind, extra) => out.push(Object.assign({key, t, s, tab, kind:kind||'warn'}, extra||{}));

  const pend = reqs().filter(r=>r.status==='Pending');
  if(canUpload(u) && pend.length && coInView(u)==='corplex')
    add('pay-req', `${pend.length} payment request${pend.length===1?'':'s'} waiting on you`,
      `AED ${money(pend.reduce((x,r)=>x+r.amount,0),2)} · oldest from ${pend[pend.length-1].by}`, 'payapprove');

  // and what happened to mine, once and once only
  reqs().filter(r=>r.by===u && !r.seen && (r.status==='Approved' || r.status==='Rejected'))
    .forEach(r=>{
      if(r.status==='Rejected')
        add('pay-no-'+r.id, `${reqName(r)} was turned down`,
          r.why || 'No reason was given', 'payment', 'bad');
      else
        add('pay-ok-'+r.id, `${reqName(r)} was approved — AED ${money(r.amount,2)}`,
          r.remarks || (r.payStatus ? r.payStatus : 'Accounts will record the payment shortly'),
          'payment', 'good');
    });

  // a request of mine that nobody has looked at yet, so it is not forgotten
  reqs().filter(r=>r.by===u && r.status==='Pending').forEach(r=>
    add('pay-wait-'+r.id, `${reqName(r)} is with accounts`,
      `${r.payee} · AED ${money(r.amount,2)} · raised ${r.date}`, 'payment', 'warn'));

  H.requests.filter(r=>r.mgr===u && r.status==='Pending').forEach(r=>
    add('req-'+r.id, `${r.who} — ${reqLabel(r.type).toLowerCase()}`,
      `${dayLabel(r.from)}${r.from!==r.to?' – '+dayLabel(r.to):''} · ${r.days} working day${r.days===1?'':'s'}`, 'requests'));

  (H.letters||[]).filter(x=>x.status==='Pending' && canUpload(u)).forEach(x=>
    add('ltr-'+x.id, `${x.who} — ${LTYPE(x.type).label.toLowerCase()}`, `${x.to?x.to+' · ':''}${x.why}`, 'letters'));

  (H.loans||[]).filter(x=>x.status==='Pending' && x.approver===u).forEach(x=>
    add('loan-'+x.id, `${x.who} — advance of AED ${money(x.amount,0)}`,
      `${x.months} months at ${money(x.monthly,0)} · ${x.why}`, 'loans'));

  /* Regularizations. Accounts decides them, so accounts is told one has
     arrived — this is the line whose absence made a sent request look like a
     request that went nowhere. */
  if(adm) (REG().rows || []).filter(x => x.status === 'Pending').forEach(x =>
    add('rg-'+x.id, `${NM(x.who)} — fix ${dayLabel(x.d)}`,
      `${x.in || '—'} to ${x.out || '—'} · ${x.reason}`, 'regular', 'warn'));

  /* And the person who asked is told the same two things they are told about
     every other request they make: that it is with somebody, and what came
     of it. */
  (REG().mine || []).forEach(x => {
    if(x.status === 'Pending')
      add('rgmine-'+x.id, `Your ${dayLabel(x.d)} fix is with accounts`,
        `${x.in || '—'} to ${x.out || '—'} · you will see the answer on My attendance`, 'attend', 'warn');
    else if(x.status === 'Approved')
      add('rgok-'+x.id, `${dayLabel(x.d)} has been corrected`,
        `${x.in || '—'} to ${x.out || '—'} is on the record now${x.note ? ' · ' + x.note : ''}`, 'attend', 'good');
    else if(x.status === 'Declined')
      add('rgno-'+x.id, `Your ${dayLabel(x.d)} fix was turned down`,
        x.note || 'No reason was given', 'attend', 'bad');
  });

  if(adm){
    const bad = allDocRows().filter(r=>r.state==='expired').length;
    const soon = allDocRows().filter(r=>r.state==='soon').length;
    if(bad||soon) add('docs', `${bad?bad+' expired':''}${bad&&soon?', ':''}${soon?soon+' expiring':''} document${(bad+soon)===1?'':'s'}`,
      'Emirates IDs and company licences', 'docsadmin', 'bad');
  } else {
    const my = docRows(u).filter(r=>r.state==='expired'||r.state==='soon');
    if(my.length) add('mydoc-'+my[0].k, `Your ${my[0].label.toLowerCase()} ${my[0].state==='expired'?'has expired':'expires '+inWord(my[0].days)}`,
      'Accounts has been told — nothing for you to do', 'profile', my[0].state==='expired'?'bad':'warn');
  }

  if(typeof DATA!=='undefined' && DATA.payroll){
    const net = DATA.payroll.rows.reduce((s,r)=>s+r.net,0);
    if(role==='owner' && PAYST()==='submitted')
      add('pr-approve', `Payroll ${DATA.payroll.month} needs your approval`,
        `AED ${money(net,2)} net across ${DATA.payroll.rows.length} people`, 'payroll');
    if(canUpload(u) && PAYST()==='initiated')
      add('pr-release', `${DATA.payroll.month} payment is initiated`, 'Release it to publish payslips', 'payroll');
    if(canUpload(u) && PAYST()==='returned')
      add('pr-back', `Miraziz sent the ${DATA.payroll.month} payroll back`, state.payNote || 'No note given', 'payroll', 'bad');
    // a run waiting on the owner is already covered by pr-approve above,
    // which reads the run's real status rather than a counter on this screen
    if(PAYST()==='closed' && !canAdmin(u) && payrollRowFor(u))
      add('slip', `Your ${DATA.payroll.month} payslip is ready`, 'Released by accounts — view or download it', 'myslip', 'good');
  }

  const D = profDone(u);
  if(D.total && D.pct < 100)
    add('prof', D.pct===0 ? 'Fill in your profile' : `Your profile is ${D.pct}% done`,
      `${D.missing.length} thing${D.missing.length===1?'':'s'} still needed`, 'profile', 'warn');

  const c = celebsOn(today);
  c.bdays.forEach(b=>{
    if(b.n === u){
      const booked = H.requests.some(r=>r.who===b.n && r.type==='Birthday' && r.from===today && r.status!=='Declined');
      const wd = !['Holiday','Weekend'].includes(dayStatus(b.n,today).k);
      add('bday-me', 'Happy birthday from all of us',
        !wd ? 'It falls on a day off this year, so there is no half-day to take'
            : booked ? 'Your half-day is booked — enjoy it' : 'Your half-day is not booked yet',
        wd && !booked ? 'requests' : 'home', 'good');
    } else add('bday-'+b.n, `It is ${b.n}'s birthday today`, `${companyOf(b.n).name} · say something`, 'people', 'good');
  });
  c.annis.forEach(a=> add('anni-'+a.n,
    a.n===u ? `${a.years} year${a.years===1?'':'s'} with ${companyOf(a.n).name} today` : `${a.n} — ${a.years} year${a.years===1?'':'s'} today`,
    `Joined ${a.doj}`, 'people', 'good'));

  return out;
}

function vHome(){
  const u = state.user, role = roleOf(u), adm = canAdmin(u), today = HDATE();
  const H = HR();
  const ty = +today.slice(0,4);
  const mmdd = ds => ds.slice(5);
  const inNext = (ds, days) => { const a=new Date(today+'T00:00:00'), b=new Date(ds+'T00:00:00');
    const diff=(b-a)/86400000; return diff>=0 && diff<=days; };
  const daysTo = ds => Math.round((new Date(ds+'T00:00:00') - new Date(today+'T00:00:00'))/86400000);
  const soonLabel = n => n===0?'today':n===1?'tomorrow':`in ${n} days`;

  // --- check in / out
  const aTod = attOf(u, today), open = openSeg(u), st = dayStatus(u, today);
  const onNet = onOfficeNet();

  // --- birthdays (day and month only)
  const MI = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const nextOccur = dm => { const [d,m]=dm.split(' '); const mm=MI[m];
    const thisYr = `${ty}-${String(mm).padStart(2,'0')}-${String(+d).padStart(2,'0')}`;
    return thisYr >= today ? thisYr : `${ty+1}-${String(mm).padStart(2,'0')}-${String(+d).padStart(2,'0')}`; };
  const bdays = Object.keys(H.birthdays||{}).filter(n=>USERS.some(x=>x.name===n))
    .map(n=>({n, dm:BDM(H.birthdays[n].d), on:nextOccur(H.birthdays[n].d)}))
    .sort((x,y)=>x.on.localeCompare(y.on)).slice(0,4);

  // --- work anniversaries (from joining dates)
  const annis = USERS.map(x=>x.name).map(n=>{
    const B = leaveBal(n); const j = parseDoj(B.doj);
    if(!j) return null;
    const on = nextOccur(`${String(j.d).padStart(2,'0')} ${MONS[j.m-1]}`);
    return {n, on, years: +on.slice(0,4) - j.y, doj:B.doj};
  }).filter(Boolean).sort((x,y)=>x.on.localeCompare(y.on)).slice(0,4);

  // --- holidays within two months
  const twoMo = (()=>{ const d=new Date(today+'T00:00:00'); d.setMonth(d.getMonth()+2);
    return d.toISOString().slice(0,10); })();
  const hols = (H.holidays||[]).filter(h=>h.d>=today && h.d<=twoMo);

  // --- leave coming up
  const away = H.requests.filter(r=>r.status==='Approved' && r.type!=='WFH' && USERS.some(x=>x.name===r.who)
      && r.to>=today && r.from<=twoMo)
    .sort((x,y)=>x.from.localeCompare(y.from)).slice(0,7);
  // --- who is working from home today, across all three companies
  const wfhToday = USERS.map(x=>x.name).filter(tracksAtt).map(n=>{
    const r = reqOn(n, today);
    if(r && r.type==='WFH') return {n, from:r.from, to:r.to, approved:true};
    const a = attOf(n, today);
    if(a && a.kind==='WFH') return {n, from:today, to:today, approved:false};
    return null;
  }).filter(Boolean).sort((a,b)=>a.n.localeCompare(b.n));

  // --- announcements
  const anns = (H.announcements||[]).slice().sort((x,y)=>(y.pinned-x.pinned)||y.date.localeCompare(x.date));

  const todo = [];
  {
    const D = profDone(u);
    // the profile chip lives in the banner at the top of this page now
  }
  if(!adm && payrollRowFor(u) && PAYST()==='closed') todo.push([`Your ${DATA.payroll.month} payslip is ready`, 'myslip', null]);
  {
    const rg = (REG().rows || []).filter(x => x.status === 'Pending');
    if(adm && rg.length) todo.push([
      rg.length === 1 ? `${NM(rg[0].who)} wants ${dayLabel(rg[0].d)} corrected`
                      : `${rg.length} attendance fixes waiting on you`, 'regular', true]);
    const my = (REG().mine || []).filter(x => x.status === 'Pending');
    if(!adm && my.length) todo.push([
      my.length === 1 ? `Your ${dayLabel(my[0].d)} fix is with accounts`
                      : `${my.length} attendance fixes are with accounts`, 'attend', null]);
  }

  const empty = t => `<p style="margin:0;color:var(--ink3);font-size:13.5px">${esc(t)}</p>`;

  // --- celebrations today and this week
  const cTod = celebsOn(today), cSoon = celebsWithin(today, 7).filter(x=>x.in>0);
  const celebStrip = (()=>{
    if(!cTod.any && !cSoon.length) return '';
    const first = n => esc(n.split(' ')[0]);
    const line = [];
    cTod.bdays.forEach(b=> line.push(b.n===u
      ? `<b>Happy birthday, ${first(u)}.</b>`
      : `It is <b>${esc(b.n)}</b>'s birthday today.`));
    cTod.annis.forEach(a=> line.push(a.n===u
      ? `<b>${a.years} year${a.years===1?'':'s'} with ${esc(companyOf(u).name)} today.</b>`
      : `<b>${esc(a.n)}</b> is ${a.years} year${a.years===1?'':'s'} with ${esc(companyOf(a.n).name)} today.`));
    const whenOf = d => d.in===1 ? 'tomorrow' : d.in>=7 ? 'on '+esc(dayLabel(d.d)) : 'on '+esc(dayLong(d.d));
    const soon = cSoon.slice(0,3).map(d=>{
      const who = d.bdays.map(b=>`${first(b.n)}'s birthday`)
        .concat(d.annis.map(a=>`${first(a.n)} at ${a.years} year${a.years===1?'':'s'}`));
      return `${who.join(' and ')} ${whenOf(d)}`;
    });
    const soonHead = cSoon.length ? (()=>{ const d = cSoon[0];
      const who = d.bdays.map(b=>`<b>${esc(b.n)}</b>'s birthday`)
        .concat(d.annis.map(a=>`<b>${esc(a.n)}</b>'s ${a.years} year${a.years===1?'':'s'}`));
      return `${who.join(' and ')} ${who.length>1?'are':'is'} ${whenOf(d)}.`; })() : '';
    const mine = cTod.bdays.some(b=>b.n===u);
    const bookedHalf = HR().requests.some(r=>r.who===u && r.type==='Birthday' && r.from===today && r.status!=='Declined');
    const workday = !['Holiday','Weekend'].includes(dayStatus(u,today).k);
    return `<section class="celeb${cTod.any?'':' quiet'}">
      <span class="cmark">${cmark(cTod.bdays.length?'cake':cTod.annis.length?'medal':'cal')}</span>
      <div class="ctext">
        <span class="ck">${cTod.any?'Today':'Coming up'}</span>
        <p>${line.length?line.join(' '):soonHead}</p>
        ${!line.length && soon.length>1?`<span class="cnext">Then ${soon.slice(1).join(', then ')}.</span>`:''}
      </div>
      ${mine && workday && !bookedHalf
        ? `<button class="btn" data-go="requests" type="button">Take your half-day</button>`
        : mine && bookedHalf ? `<span class="cdone">Half-day booked</span>` : ''}
    </section>`;
  })();

  const me = PROF(u) || {};
  const initials = u.split(' ').map(x=>x[0]).slice(0,2).join('');
  const PD = profDone(u);
  const profBanner = (!PROF(u) || PD.pct >= 100) ? '' : (() => {
    const n = PD.missing.length;
    const first = PD.missing.slice(0, 3).map(esc).join(', ');
    const rest  = n > 3 ? ` and ${n - 3} more` : '';
    return `<div class="nudge${PD.pct < 60 ? ' loud' : ''}">
      <span class="ndot"></span>
      <div><b>Your file is ${PD.pct}% complete</b>
        <span>Still needed: ${first}${rest}. It takes a couple of minutes, and it is what the
          company has to show when somebody asks \u2014 a visa renewal, an insurance claim, or a
          hospital at two in the morning.</span></div>
      <button class="btn" data-go="profile" type="button">Finish it</button>
    </div>`;
  })();
  return `
  ${profBanner}
  ${nudgeBanner(u)}
  ${(() => { const late = lateReports(u);
    if(!late.length) return '';
    return `<div class="nudge loud"><span class="ndot"></span>
      <div><b>${late.length === 1 ? esc(NM(late[0].who)) + ' has not checked in'
                                  : late.length + ' of your team have not checked in'}</b>
      <span>${esc(late.map(l => NM(l.who) + ' (' + l.by + ' minutes past)').join(', '))}. They have been told.</span></div></div>`;
  })()}
  ${celebStrip}
  <section class="panel hhero${MOBILE()?' slim':' withme'}">
    <div class="pad">
      <span class="hgreet">Welcome back</span>
      <h2>${nm(u)}</h2>
      <p>${esc(titleOf(u) || ROLELABEL[role])} &middot; ${esc(companyOf(u).name)}${orgDeptOf(u) ? ' \u00b7 '+esc(orgDeptOf(u)) : ''} &nbsp;&middot;&nbsp; ${esc(dayName(today))} ${esc(dayLabel(today))} ${ty}</p>
      ${(!MOBILE() && todo.length)?`<div class="htodo">${todo.map(([t,tab,con])=>
        `<button data-go="${esc(tab)}"${con?' data-mode="console"':''} type="button"><i></i>${esc(t)}</button>`).join('')}</div>`:''}
    </div>
    ${MOBILE() ? '' : `<aside class="hme">
      <div class="hmepic">${me.photo?`<img src="${me.photo.url}" alt="${nm(u)}">`:`<span>${esc(initials)}</span>`}</div>
      <button class="hmebtn" data-go="profile" type="button">My profile</button>
    </aside>`}
  </section>

  <div class="grid g3 hrow">
    <section class="panel">
      <header><h3>${tracksAtt(u)?'Your day':'The office today'}</h3>
        ${tracksAtt(u)?`<span class="pill mute">${esc(shiftOf(u).start)}&ndash;${esc(shiftOf(u).end)}</span>`:`<span class="hint">across the group</span>`}</header>
      <div class="pad hbody">
        ${!tracksAtt(u) ? (()=>{
            const roll = USERS.map(x=>x.name).filter(tracksAtt);
            const k = key => roll.filter(n=>dayStatus(n,today).k===key).length;
            const off = k('Office'), home = k('WFH'), lv = LEAVEONLY().reduce((s,t)=>s+k(t.id),0);
            return `<dl class="kv">
              <dt>In the office</dt><dd class="big"><b>${off}</b></dd>
              <dt>Working from home</dt><dd>${home||'—'}</dd>
              <dt>On leave</dt><dd>${lv||'—'}</dd>
              <div class="sep"></div>
              <dt>On the attendance list</dt><dd>${roll.length}</dd>
            </dl>
            <p class="hfoot">You are not on the attendance list. The full board is on <b>Who is in</b>.</p>`;})()
        : !canCheckIn(u) ? `<p style="margin:0;color:var(--ink2);font-size:14px">You check in and out under <b>${esc(companyOf(u).name)}</b>. Switch the company at the top to record your day.</p>`
        : ['Holiday','Weekend'].includes(st.k)
          ? `<p style="margin:0;color:var(--ink2);font-size:14px">Today is <b>${esc(st.label)}</b> &mdash; nothing to record.</p>`
          : LEAVEONLY().some(t=>t.id===st.k)
          ? `<p style="margin:0;color:var(--ink2);font-size:14px">You are on <b>${esc(st.label)}</b> today. Enjoy it.</p>`
          : `<div class="cibox">
            <span class="cik">${open?'On the clock':'Not checked in'}</span>
            ${open ? ciClock(open) : '<b>—</b>'}
            <span class="cin">${open?esc(open.loc==='Office'?'Office':'Work from home')+' · since '+esc(open.in):esc(shiftText(u))}</span>
          </div>
          <div class="cistack">
            ${open
              ? `<button class="btn wide" id="ciOut" type="button">Check out</button>
                 <span class="cihint">Moving on? Check out, then check in again when you get there.</span>`
              : `<button class="btn wide" data-ci="Office" type="button">Check in &mdash; office</button>
                 <div class="cirow"><button class="btn ghost" data-ci="Client site" type="button">Off-site</button>
                 <button class="btn ghost" data-ci="Home" type="button">Home</button></div>
                 <span class="cihint">${!officeRules()?'The office network has not been set yet.':onNet?'You are on the office network.':'You are not on the office network \u2014 an office check-in will be recorded as off-site.'}</span>`}
          </div>`}
        ${aTod && aTod.segs.length ? `<p class="hfoot">${aTod.segs.map(g=>`${esc(g.loc)} ${esc(g.in)}${g.out?'–'+esc(g.out):' (open)'}`).join(' &middot; ')} &mdash; <b>${hhmm(segMins(aTod, true))}</b> today</p>`:''}
      </div>
    </section>

    <section class="panel">
      <header><h3>Away soon</h3><span class="hint">everyone &middot; next two months</span></header>
      <div class="pad hbody">
        ${away.length?`<ul class="feed">${away.slice(0,4).map(r=>{
          const n = daysTo(r.from), on = n<=0;
          return `<li><i style="background:${STCOL[r.type]||'var(--line)'}"></i>
            <div><b>${whoLink(r.who)}</b><span>${esc(reqLabel(r.type))} &middot; ${esc(dayLabel(r.from))}${r.from!==r.to?' – '+esc(dayLabel(r.to)):''}</span></div>
            <em>${on?'away now':soonLabel(n)}</em></li>`;}).join('')}</ul>`
        :empty('Nobody is booked off in the next two months.')}
      </div>
      ${away.length?`<p class="cap">The full picture is on <b>Who is in</b>.</p>`:''}
    </section>

    <section class="panel">
      <header><h3>Working from home</h3><span class="hint">today &middot; all three companies</span></header>
      <div class="pad hbody">
        ${wfhToday.length?`<ul class="feed">${wfhToday.slice(0,4).map(x=>`
          <li><i style="background:${STCOL.WFH}"></i>
            <div><b>${whoLink(x.n)}</b><span>${esc(companyOf(x.n).name)}${x.from!==x.to?' &middot; until '+esc(dayLabel(x.to)):''}</span></div>
            <em>${x.approved?'approved':'checked in'}</em></li>`).join('')}</ul>`
        :empty('Nobody is working from home today.')}
      </div>
      ${wfhToday.length>4?`<p class="cap">and ${wfhToday.length-4} more &mdash; the full board is on <b>Who is in</b>.</p>`
        :(holOn(today)?`<p class="cap"><b>${esc(holOn(today).n)}</b> &mdash; the office is closed today.</p>`:'')}
    </section>
  </div>

  <div class="grid g3 hrow">
    <section class="panel">
      <header><h3>Announcements</h3>
        ${adm?'<button class="btn ghost" id="annNew" type="button" style="margin-left:auto;padding:3px 10px;font-size:12px">Post one</button>':'<span class="hint">from accounts</span>'}</header>
      ${adm && state.annNew ? `<div class="pad" style="padding-bottom:4px">
        <div class="field"><label for="annT">Title</label><input id="annT" value="${esc(state.annT||'')}" placeholder="Short and plain"></div>
        <div class="field"><label for="annB">Message</label><input id="annB" value="${esc(state.annB||'')}" placeholder="A sentence or two"></div>
        <button class="btn" id="annPost" type="button"${(state.annT&&state.annB)?'':' disabled'}>Post</button>
        <button class="btn ghost" id="annCancel" type="button" style="margin-left:8px">Cancel</button>
      </div>`:''}
      <div class="pad hbody">
        ${anns.length?`<ul class="anns">${anns.slice(0,2).map(x=>`<li${x.pinned?' class="pin"':''}>
          <div class="ah"><b>${esc(x.title)}</b><span>${esc(dayLabel(x.date))}</span></div>
          <p>${esc(x.body)}</p>
          <span class="ab">${esc(x.by)}</span></li>`).join('')}</ul>`:empty('Nothing posted yet.')}
      </div>
    </section>

    <section class="panel">
      <header><h3>Birthdays</h3><span class="hint">next up</span></header>
      <div class="pad hbody">
        ${bdays.length?`<ul class="feed">${bdays.map(x=>{const n=daysTo(x.on);
          return `<li><i style="background:var(--accent)"></i>
            <div><b>${whoLink(x.n)}</b><span>${esc(x.dm)}</span></div>
            <em>${n===0?'<b style="color:var(--accent)">today</b>':soonLabel(n)}</em></li>`;}).join('')}</ul>`:empty('No dates on file.')}
      </div>
      ${Object.values(H.birthdays||{}).some(b=>b.sample)?`<p class="cap">Sample dates &mdash; send me the day and month for each person.</p>`:''}
    </section>

    <section class="panel">
      <header><h3>Work anniversaries</h3><span class="hint">from joining dates</span></header>
      <div class="pad hbody">
        ${annis.length?`<ul class="feed">${annis.map(x=>{const n=daysTo(x.on);
          return `<li><i style="background:var(--c1)"></i>
            <div><b>${whoLink(x.n)}</b><span>${x.years} year${x.years===1?'':'s'} &middot; joined ${esc(x.doj)}</span></div>
            <em>${n===0?'today':soonLabel(n)}</em></li>`;}).join('')}</ul>`:empty('No joining dates on file.')}
      </div>
    </section>
  </div>`;
}
function nowHM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

function vDashboard(){
  const u = state.user, p = state.period, e = aggOf(u,p);
  if(!e) return '<div class="panel pad">No data.</div>';
  const rows = invRows(u,p);
  const outstanding = outstandingOf(u,p);
  const consultantNet = rows.filter(r=>r[IC.role]==='C').reduce((s,r)=>s+(r[IC.net]||0),0);
  const pmNet = rows.filter(r=>r[IC.role]==='P').reduce((s,r)=>s+(r[IC.net]||0),0);
  const stillOut = Math.max(0, (e.notColl||0) - (e.forf||0));
  const invValue = e.newInv + e.exInv + e.pmInv;

  const qChart = QS.map(qq=>{
    const ee = eng(u,qq) || {netTot:0,totElig:0,notColl:0};
    const unq = Math.max(0, ee.notColl||0);
    return {label:qq, value:(ee.netTot||0),
      parts:[{value:ee.totElig||0, color:'var(--c1)'},{value:unq, color:'var(--c3)'}],
      tip:`<b>${money(ee.netTot||0)}</b> net sales<br>${qq} · counted <b>${money(ee.totElig||0)}</b><br>not counted ${money(unq)}`};
  });
  const legendParts = [{label:'Counted', color:'var(--c1)'},{label:'Not counted (unqualified)', color:'var(--c3)'}];

  const buckets = [
    {label:'New client (as consultant)', inv:e.newInv, cost:e.newCost, net:Math.max(0,e.newInv-e.newCost), color:'var(--c1)'},
    {label:'Existing client (as consultant)', inv:e.exInv, cost:e.exCost, net:Math.max(0,e.exInv-e.exCost), color:'var(--c2)'},
    {label:'Project managed (shared)', inv:e.pmInv, cost:e.pmCost, net:Math.max(0,e.pmInv-e.pmCost), color:'var(--c3)'}
  ];
  const bTot = buckets.reduce((s,b)=>s+b.net,0);

  return `
  <div class="strip">
    <div class="stat"><span class="k">Total net sales · ${p==='FY'?esc(state.year):p}</span><span class="v"><span class="cur">AED</span>${money(e.netTot)}</span>
      <span class="n">from ${rows.length} invoice${rows.length===1?'':'s'} · ${money(invValue)} invoiced</span></div>
    <div class="stat"><span class="k">Counted for commission</span><span class="v" style="color:var(--good)"><span class="cur">AED</span>${money(e.totElig)}</span>
      <span class="n">${e.netTot?pct(e.totElig/e.netTot,1):'—'} of your net sales &mdash; see My commission</span></div>
    <div class="stat"><span class="k">Unqualified net sales</span><span class="v" style="color:var(--warn)"><span class="cur">AED</span>${money(e.notColl)}</span>
      <span class="n">not counted — client hasn't paid, or paid too late</span></div>
    <div class="stat"><span class="k">Outstanding invoices</span><span class="v" style="color:var(--bad)"><span class="cur">AED</span>${money(outstanding)}</span>
      <span class="n">${rows.filter(r=>r[IC.bal]>0).length} invoice${rows.filter(r=>r[IC.bal]>0).length===1?'':'s'} still to collect</span></div>
  </div>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Net sales by quarter</h3><span class="hint">2026</span></header>
      ${chartSlot('q', qChart, {aria:'Net sales by quarter for '+u, tickFmt:v=>v>=1000?(v/1000)+'k':money(v)})}
      <div class="pad" style="padding-top:0">${legend(legendParts)}</div>
      <p class="cap">Net sales is invoice value less costs, credit notes and partner commission. The pale segment is the part not yet counted, because the client has not paid or paid outside the window.</p>
    </section>

    <section class="panel">
      <header><h3>How your net sales reconcile</h3><span class="hint">${PLABEL[p]}</span></header>
      <div class="pad">
        <dl class="kv">
          <dt><b>Total net sales</b></dt><dd class="big">${money(e.netTot)}</dd>
          <dt style="padding-left:14px;color:var(--ink3)">as sales consultant</dt><dd style="color:var(--ink2)">${money(consultantNet)}</dd>
          <dt style="padding-left:14px;color:var(--ink3)">as project manager (shared)</dt><dd style="color:var(--ink2)">${money(pmNet)}</dd>
          <div class="sep"></div>
          <dt>less &mdash; unqualified net sales</dt><dd style="color:var(--warn)">(${money(e.notColl)})</dd>
          <dt style="padding-left:14px;color:var(--ink3)">lost net sales &mdash; collected too late</dt><dd style="color:var(--bad)">(${money(e.forf)})</dd>
          <dt style="padding-left:14px;color:var(--ink3)">still uncollected</dt><dd style="color:var(--ink2)">(${money(stillOut)})</dd>
          <div class="sep"></div>
          <dt><b>Counted for commission</b></dt><dd class="big" style="color:var(--good)">${money(e.totElig)}</dd>
          <div class="sep"></div>
          <dt>Outstanding invoice value still to collect</dt><dd style="color:var(--bad)">${money(outstanding)}</dd>
        </dl>
        <p class="note" style="margin-top:16px">The two deductions are different problems. <b>Still uncollected</b> converts the moment the client pays. <b>Lost</b> does not &mdash; that money came in more than a month after quarter end and no longer counts.</p>
      </div>
    </section>
  </div>

  <section class="panel">
    <header><h3>Where the work came from</h3><span class="hint">${PLABEL[p]}</span></header>
    <div class="pad" style="display:flex;flex-direction:column;gap:14px">
      ${stacked(buckets.map(b=>({label:b.label, value:b.net, color:b.color})))}
      ${legend(buckets.map(b=>({label:b.label, color:b.color})))}
      <div class="tw"><table>
        <thead><tr><th>Bucket</th><th class="r">Invoiced</th><th class="r">Costs</th><th class="r">Net sales</th><th class="r">Share</th></tr></thead>
        <tbody>
          ${buckets.map(b=>`<tr><td>${esc(b.label)}</td><td class="n r">${money(b.inv)}</td><td class="n r">${money(b.cost)}</td><td class="n r">${money(b.net)}</td><td class="n r">${bTot?pct(b.net/bTot,1):'—'}</td></tr>`).join('')}
          <tr class="tot"><td>Total</td><td class="n r">${money(e.newInv+e.exInv+e.pmInv)}</td><td class="n r">${money(e.newCost+e.exCost+e.pmCost)}</td><td class="n r">${money(bTot)}</td><td class="n r">100.0%</td></tr>
        </tbody></table></div>
    </div>
  </section>`;
}

function vCommission(){
  const u = state.user, p = state.period, e = aggOf(u,p);
  if(!e) return '<div class="panel pad">No data.</div>';
  const fy = p==='FY';
  const flat = isFlat(e);
  const q1 = fy ? null : e;
  const rates = flat ? {nw:e.flat,ex:e.flat,pm:e.flat} : (fy ? null : bandRates(e.band));
  const rowsFY = QS.map(qq=>eng(u,qq)||{totElig:0,comm:0,paid:0,bal:0,lost:0});
  const tot = rowsFY.reduce((a,b)=>({totElig:a.totElig+b.totElig,comm:a.comm+b.comm,paid:a.paid+b.paid,bal:a.bal+b.bal,lost:a.lost+b.lost}),{totElig:0,comm:0,paid:0,bal:0,lost:0});
  const nextBand = (flat||fy) ? null : DATA.bands.find(b=>b[1] > e.totElig);
  const gap = nextBand ? nextBand[1]-e.totElig : 0;
  const deptOk = e.deptOk === 'Yes';
  const mo = mgrOf(u,p);

  return `
  <div class="strip">
    <div class="stat"><span class="k">Eligible net sales · ${fy?esc(state.year):p}</span><span class="v"><span class="cur">AED</span>${money(e.totElig)}</span>
      <span class="n">${flat?'flat '+pct(e.flat,0)+' — no target':(fy?'band set quarter by quarter':(deptOk?'band '+e.band:'department not commission-eligible'))}</span></div>
    <div class="stat"><span class="k">${mo?'Your own commission':'Commission earned'}</span><span class="v"><span class="cur">AED</span>${money(e.comm,2)}</span>
      <span class="n">${mo?`plus <b>AED ${money(mo.earned,2)}</b> manager override &mdash; total ${money(e.comm+mo.earned,2)}`:(e.totElig?pct(e.comm/e.totElig,2)+' of eligible net sales':'—')}</span></div>
    <div class="stat"><span class="k">Paid to date</span><span class="v"><span class="cur">AED</span>${money(e.paid,2)}</span>
      <span class="n">${e.lost>0?`<span class="pill bad"><span class="dt"></span>${money(e.lost,2)} forfeited</span>`:'nothing forfeited'}</span></div>
    <div class="stat"><span class="k">Balance owed to you</span><span class="v"><span class="cur">AED</span>${money(e.bal+(mo?mo.bal:0),2)}</span>
      <span class="n">${mo?`${money(e.bal,2)} own + ${money(mo.bal,2)} override`:(e.bal>0?'due after quarter sign-off':'nothing outstanding')}</span></div>
  </div>

  ${!deptOk ? `<div class="note"><b>${esc(DATA.dept[u])} is set to non-commission-eligible</b> in the commission rules. Sales are tracked and reported in full — commission calculates to nil.</div>` : ''}

  <div class="grid g2">
    <section class="panel">
      <header><h3>${fy?'2026 commission, bucket by bucket':p+' commission, line by line'}</h3></header>
      <div class="tw"><table>
        <thead><tr><th>Bucket</th><th class="r">Eligible net sales</th><th class="r">Rate</th><th class="r">Commission</th></tr></thead>
        <tbody>
          <tr><td>New client (as consultant)</td><td class="n r">${money(e.newElig)}</td><td class="n r">${rates?pct(rates.nw,0):'varies'}</td><td class="n r">${money(e.newComm,2)}</td></tr>
          <tr><td>Existing client (as consultant)</td><td class="n r">${money(e.exElig)}</td><td class="n r">${rates?pct(rates.ex,0):'varies'}</td><td class="n r">${money(e.exComm,2)}</td></tr>
          <tr><td>Project managed (shared work)</td><td class="n r">${money(e.pmElig)}</td><td class="n r">${rates?pct(rates.pm,0):'varies'}</td><td class="n r">${money(e.pmComm,2)}</td></tr>
          <tr class="tot"><td>${flat?'Flat-rate arrangement':(fy?'2026 total':'Band '+e.band)}</td><td class="n r">${money(e.totElig)}</td><td class="r">—</td><td class="n r">${money(e.comm,2)}</td></tr>
        </tbody></table></div>
      <p class="cap">Your band is set by <b>total</b> eligible net sales for the quarter; the three rates then apply to each bucket separately.${fy?' Across a full year the rate column varies, because each quarter lands in its own band.':''}</p>
    </section>

    <section class="panel">
      <header><h3>Settlement</h3></header>
      <div class="pad">
        <dl class="kv">
          <dt>Commission earned</dt><dd class="big">${money(e.comm,2)}</dd>
          <dt>Already paid to you</dt><dd>${money(e.paid,2)}</dd>
          <dt>Forfeited — collections more than a month late</dt><dd style="color:var(--bad)">${money(e.lost,2)}</dd>
          <div class="sep"></div>
          <dt><b>Balance owed</b></dt><dd class="big">${money(e.bal,2)}</dd>
        </dl>
        ${e.lost>0 ? `<div class="note" style="margin-top:16px;border-left-color:var(--bad)"><b>Why ${money(e.lost,2)} was forfeited.</b> One or more invoices were settled more than a month after quarter end. Under the current rules that forfeits the commission not already paid. Those invoices are flagged <b>Late</b> on your invoice list.</div>`
          : `<div class="note" style="margin-top:16px;border-left-color:var(--good)">Every collection landed inside the window. Nothing forfeited.</div>`}
      </div>
    </section>
  </div>

  <div class="grid g2">
    <section class="panel">
      <header><h3>${flat?'Your arrangement':'Your band'}</h3>${fy?'<span class="hint">bands are set per quarter</span>':''}</header>
      <div class="pad">
        ${flat ? `<p style="margin:0 0 12px;color:var(--ink2)">Flat <b>${pct(e.flat,0)}</b> on all eligible net sales from the first dirham — no target to clear.</p>`
        : `<div class="tw"><table>
            <thead><tr><th>Band</th><th class="r">Eligible net sales</th><th class="r">New</th><th class="r">Existing</th><th class="r">PM shared</th></tr></thead>
            <tbody>${DATA.bands.map(b=>`<tr${(!fy && b[0]===e.band)?' style="background:var(--panel2);font-weight:600"':''}>
              <td>${(!fy && b[0]===e.band)?'▸ ':''}Band ${b[0]}</td>
              <td class="n r">${money(b[1])} – ${b[2]>1e8?'above':money(b[2])}</td>
              <td class="n r">${pct(b[3],0)}</td><td class="n r">${pct(b[4],0)}</td><td class="n r">${pct(b[5],0)}</td></tr>`).join('')}</tbody></table></div>
          ${fy ? `<p class="note" style="margin-top:14px">Your band is decided quarter by quarter, so a strong Q2 does not carry into Q3. The quarterly table below shows which band each quarter landed in.</p>`
             : (nextBand ? `<p class="note" style="margin-top:14px"><b>AED ${money(gap)}</b> more in eligible net sales this quarter moves you to band ${nextBand[0]} — existing-client work would then pay ${pct(nextBand[4],0)} instead of ${pct(rates.ex,0)}, on the whole quarter.</p>`
                : `<p class="note" style="margin-top:14px">You are in the top band for this quarter.</p>`)}`}
      </div>
    </section>

    <section class="panel">
      <header><h3>Money not counted yet</h3><span class="hint">why sales ≠ commission</span></header>
      <div class="pad">
        <dl class="kv">
          <dt>Net sales on invoices the client has not paid</dt><dd>${money(e.notColl)}</dd>
          <dt>Eligible net sales if everything were collected on time</dt><dd>${money(e.eligOnTime)}</dd>
          <dt>Commission if everything were collected on time</dt><dd>${money(e.commOnTime,2)}</dd>
          <div class="sep"></div>
          <dt><b>Commission actually earned</b></dt><dd class="big">${money(e.comm,2)}</dd>
          <dt>Difference still sitting with clients</dt><dd>${money(Math.max(0,e.commOnTime-e.comm),2)}</dd>
        </dl>
        <p class="note" style="margin-top:14px">Commission follows <b>collection</b>, not invoicing. Chase the open invoices on your <b>My invoices</b> tab and the figure above converts by itself.</p>
      </div>
    </section>
  </div>

  ${mgrPanel(u,p,e)}

  <section class="panel">
    <header><h3>2026 quarter by quarter</h3></header>
    <div class="tw"><table>
      <thead><tr><th>Quarter</th><th class="r">Eligible net sales</th><th class="r">Band</th><th class="r">Earned</th><th class="r">Paid</th><th class="r">Forfeited</th><th class="r">Balance</th></tr></thead>
      <tbody>
        ${QS.map((qq,i)=>{const r=rowsFY[i]; const ee=eng(u,qq)||{};
          return `<tr${(!fy && qq===p)?' style="background:var(--panel2)"':''}><td>${QLABEL[qq]}</td><td class="n r">${money(r.totElig)}</td><td class="n r">${isFlat(ee)?'Flat':('Band '+(ee.band||1))}</td><td class="n r">${money(r.comm,2)}</td><td class="n r">${money(r.paid,2)}</td><td class="n r">${money(r.lost,2)}</td><td class="n r">${money(r.bal,2)}</td></tr>`}).join('')}
        <tr class="tot"><td>Full year</td><td class="n r">${money(tot.totElig)}</td><td class="r">—</td><td class="n r">${money(tot.comm,2)}</td><td class="n r">${money(tot.paid,2)}</td><td class="n r">${money(tot.lost,2)}</td><td class="n r">${money(tot.bal,2)}</td></tr>
      </tbody></table></div>
  </section>`;
}

function mgrPanel(u,p,e){
  const m = mgrOf(u,p);
  if(!m) return '';
  const total = (e.comm||0) + (m.earned||0);
  const rows = QS.map(q=>Object.assign({q}, (DATA.managers[u].q[q]||{})));
  return `
  <section class="panel" style="border-color:var(--accent)">
    <header style="background:var(--accentSoft)">
      <h3>Manager override commission</h3>
      <span class="hint">${esc(m.dept)} &middot; ${pct(m.rate,0)} of the department, excluding your own work</span>
    </header>
    <div class="pad grid g2" style="align-items:start">
      <dl class="kv">
        <dt>${esc(m.dept)} eligible net sales</dt><dd>${money(m.deptElig)}</dd>
        <dt>less &mdash; your own sales as consultant</dt><dd style="color:var(--ink2)">(${money(m.lessOwn)})</dd>
        <dt>less &mdash; department work you project-managed</dt><dd style="color:var(--ink2)">(${money(m.lessPm)})</dd>
        <div class="sep"></div>
        <dt><b>Commission base</b></dt><dd class="big">${money(m.base)}</dd>
        <dt>Rate</dt><dd>${pct(m.rate,0)}</dd>
        <div class="sep"></div>
        <dt><b>Override earned</b></dt><dd class="big" style="color:var(--good)">${money(m.earned,2)}</dd>
        <dt>Paid</dt><dd>${money(m.paid,2)}</dd>
        <dt>Balance owed</dt><dd>${money(m.bal,2)}</dd>
      </dl>
      <div>
        <div class="strip" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="stat"><span class="k">Your own commission</span><span class="v" style="font-size:19px"><span class="cur">AED</span>${money(e.comm,2)}</span></div>
          <div class="stat"><span class="k">Override</span><span class="v" style="font-size:19px"><span class="cur">AED</span>${money(m.earned,2)}</span></div>
          <div class="stat"><span class="k">Total commission</span><span class="v" style="font-size:19px;color:var(--good)"><span class="cur">AED</span>${money(total,2)}</span></div>
        </div>
        <div class="tw" style="margin-top:14px"><table>
          <thead><tr><th>Quarter</th><th class="r">Dept eligible</th><th class="r">Base</th><th class="r">Earned</th><th class="r">Balance</th></tr></thead>
          <tbody>${rows.map(r=>`<tr${(p!=='FY'&&r.q===p)?' style="background:var(--panel2)"':''}><td>${r.q}</td><td class="n r">${money(r.deptElig||0)}</td><td class="n r">${money(r.base||0)}</td><td class="n r">${money(r.earned||0,2)}</td><td class="n r">${money(r.bal||0,2)}</td></tr>`).join('')}
            <tr class="tot"><td>Full year</td><td class="n r">${money(rows.reduce((s,r)=>s+(r.deptElig||0),0))}</td><td class="n r">${money(rows.reduce((s,r)=>s+(r.base||0),0))}</td><td class="n r">${money(rows.reduce((s,r)=>s+(r.earned||0),0),2)}</td><td class="n r">${money(rows.reduce((s,r)=>s+(r.bal||0),0),2)}</td></tr>
          </tbody></table></div>
      </div>
    </div>
    <p class="cap">The base is your department's eligible net sales less everything that arises from your own work — the invoices you sold and the shared invoices you project-managed inside the department — so you earn nothing twice. Shared invoices you project-managed for another department were never in the base to begin with.</p>
  </section>`;
}

const first = s => (NM(s)||'').trim().split(/\s+/)[0] || '';
const INVSORT = {date:IC.sort, no:IC.no, pr:IC.pr, type:IC.type, client:IC.client, sp:IC.sp, pm:IC.pm,
  amt:IC.amt, exp:IC.exp, pc:IC.pc, cn:IC.cn, net:IC.net, status:IC.status, recd:IC.recd, bal:IC.bal, elig:IC.elig};
/* a short confirmation in the corner - the export is silent otherwise */
let _toastT;
function toast(msg){
  let el = document.getElementById('toast');
  if(!el){ el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_toastT);
  _toastT = setTimeout(()=>el.classList.remove('on'), 3600);
}

/* ---------- taking the invoice list away with you ---------- */
const EXPCOLS = [
  ['Quarter', IC.q, 't'], ['Date', IC.date, 't'], ['Invoice #', IC.no, 't'], ['PR #', IC.pr, 't'],
  ['Client type', IC.type, 't'], ['Company', IC.client, 't'],
  ['Salesperson', IC.sp, 't'], ['Project manager', IC.pm, 't'],
  ['Invoice', IC.amt, 'n'], ['Expenses', IC.exp, 'n'], ['Partner share', IC.pc, 'n'],
  ['Credit note', IC.cn, 'n'], ['Net sales', IC.net, 'n'],
  ['Status', IC.status, 't'], ['Received', IC.recd, 'n'], ['Balance', IC.bal, 'n'],
  ['Eligible', IC.elig, 'n'], ['On time', IC.ontime, 't'], ['Role', IC.role, 't']
];
const expName = (u, ext) => `${u.split(' ')[0].toLowerCase()}-invoices-${HDATE()}.${ext}`;
// the browser is what saves the file; inside an embedded preview that is blocked,
// so the raw text is offered as well rather than the button doing nothing
const embedded = () => { try { return window.self !== window.top; } catch(e){ return true; } };

// claude.ai grants a published page a save channel; a normally hosted copy just
// uses the browser. Spreadsheet binaries are not on the platform's allowlist, so
// inside the preview the XLS is offered to copy instead of pretending to save.
async function useDownloads(){
  try{ if(window.claude && typeof window.claude.use === 'function') return await window.claude.use('downloads'); }
  catch(e){}
  return null;
}
function saveBlob(text, name, mime){
  try{
    const url = URL.createObjectURL(new Blob(['\ufeff' + text], {type:mime}));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    return true;
  } catch(e){ return false; }
}

function invCSV(rows){
  const q = v => { const t = v==null ? '' : String(v);
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g,'""') + '"' : t; };
  return [EXPCOLS.map(c=>q(c[0])).join(',')]
    .concat(rows.map(r=>EXPCOLS.map(c=>q(c[2]==='n' ? (r[c[1]]||0) : r[c[1]])).join(',')))
    .join('\r\n');
}
// a table Excel opens natively - no library, and the column types survive
function invXLS(rows, u){
  const cell = (v, t) => t==='n'
    ? `<td style="mso-number-format:'#,##0.00'">${v||0}</td>`
    : `<td style="mso-number-format:'\\@'">${esc(v==null?'':v)}</td>`;
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
<style>td,th{font-family:Arial;font-size:10pt;border:.5pt solid #d8d3dd}
th{background:#2A1B33;color:#fff;font-weight:bold}</style></head><body>
<table><thead><tr>${EXPCOLS.map(c=>`<th>${esc(c[0])}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r=>`<tr>${EXPCOLS.map(c=>cell(r[c[1]], c[2])).join('')}</tr>`).join('')}</tbody>
<tfoot><tr><th colspan="8">${rows.length} invoice${rows.length===1?'':'s'} &mdash; ${nm(u)}</th>
${['n','n','n','n','n'].map((_,i)=>{const k=[IC.amt,IC.exp,IC.pc,IC.cn,IC.net][i];
  return `<th style="mso-number-format:'#,##0.00'">${rows.reduce((a,r)=>a+(r[k]||0),0)}</th>`;}).join('')}
<th></th>${[IC.recd,IC.bal,IC.elig].map(k=>`<th style="mso-number-format:'#,##0.00'">${rows.reduce((a,r)=>a+(r[k]||0),0)}</th>`).join('')}
<th colspan="2"></th></tr></tfoot></table>
<p style="font-family:Arial;font-size:9pt">All amounts exclusive of VAT. CorpLex One, ${esc(dayLabel(HDATE()))} ${HDATE().slice(0,4)}.</p>
</body></html>`;
}

function invExport(kind){
  const u = state.user, {rows} = invFiltered(u);
  if(!rows.length){ toast('Nothing to export — no invoices match those filters.'); return; }
  if(kind === 'pdf'){ state.invPrint = true; render();
    setTimeout(()=>{ window.print(); state.invPrint = false; render(); }, 60); return; }
  const csv = kind === 'csv';
  const text = csv ? invCSV(rows) : invXLS(rows, u);
  const name = expName(u, csv ? 'csv' : 'xls');
  const mime = csv ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel;charset=utf-8';
  deliver(text, name, mime, rows.length);
}

async function deliver(text, name, mime, n){
  const dl = await useDownloads();
  if(dl){
    try{
      await dl.save({filename:name, data:text});
      toast(`${name} — ${n} invoice${n===1?'':'s'}`);
      return;
    }catch(err){
      const code = (err && err.code) || 'unavailable';
      if(code === 'declined') return;
      if(code === 'rate_limited'){ toast('A save is already open — try again in a moment.'); return; }
      if(code !== 'rejected_extension' && code !== 'extension_not_enabled' && code !== 'unavailable'){
        toast(`Could not save ${name}.`); return;
      }
      // the extension is not allowed here - offer the text instead
      state.invRaw = {name, text, why:'Excel files cannot be saved from inside the Claude preview. Copy from here, or use CSV — or open the portal on one.corplex.ae, where all three work.'};
      render(); return;
    }
  }
  saveBlob(text, name, mime);
  if(embedded()){ state.invRaw = {name, text, why:'The browser blocked the save here — select all and copy, or use this page on one.corplex.ae.'}; render(); }
  else toast(`${name} — ${n} invoice${n===1?'':'s'}`);
}

/* the rows the filters and the sort actually leave on screen - the exports send
   exactly this, so what you download is what you were looking at */
function invFiltered(u){
  const f = state.invFilter, so = state.invSort;
  const all = (DATA.inv[u]||[]).slice();
  let rows = all;
  if(f.q!=='all') rows = rows.filter(r=>r[IC.q]===f.q);
  if(f.status==='Paid') rows = rows.filter(r=>(r[IC.bal]||0)<=0.5);
  else if(f.status==='outstanding') rows = rows.filter(r=>(r[IC.bal]||0)>0.5);
  if(f.type!=='all') rows = rows.filter(r=>r[IC.type]===f.type);
  if(f.sp!=='all') rows = rows.filter(r=>r[IC.sp]===f.sp);
  if(f.pm!=='all') rows = rows.filter(r=>r[IC.pm]===f.pm);
  if(f.role!=='all') rows = rows.filter(r=>r[IC.role]===f.role);
  if(f.text){ const t=f.text.toLowerCase();
    rows = rows.filter(r=>[IC.client,IC.no,IC.pr,IC.sp,IC.pm].some(k=>(r[k]||'').toLowerCase().includes(t))); }

  if(so.key){
    const k = INVSORT[so.key];
    rows = rows.slice().sort((a,b)=>{
      const av=a[k], bv=b[k];
      const c = (typeof av==='number' && typeof bv==='number') ? av-bv : String(av||'').localeCompare(String(bv||''));
      return c*so.dir;
    });
  } else {
    rows = rows.slice().sort((a,b)=>{
      const ao=(a[IC.bal]||0)>0.5?0:1, bo=(b[IC.bal]||0)>0.5?0:1;
      if(ao!==bo) return ao-bo;
      return (b[IC.sort]||'').localeCompare(a[IC.sort]||'');
    });
  }
  return {rows, all};
}

function vInvoices(){
  const u = state.user, f = state.invFilter, so = state.invSort;
  const {rows, all} = invFiltered(u);
  const uniq = k => [...new Set(all.map(r=>r[k]).filter(Boolean))].sort();
  const sum = k => rows.reduce((a,r)=>a+(r[k]||0),0);
  const num = v => v ? money(v,2) : '<span style="color:var(--ink3)">—</span>';
  const active = (f.q!=='all'?1:0)+(f.status!=='all'?1:0)+(f.type!=='all'?1:0)+(f.sp!=='all'?1:0)+(f.pm!=='all'?1:0)+(f.role!=='all'?1:0)+(f.text?1:0);
  const arrow = k => so.key===k ? `<span class="sar">${so.dir>0?'▲':'▼'}</span>` : '';
  const th = (k, label, cls='') => `<th class="${cls} sortable${so.key===k?' sorted':''}" data-sort="${k}">${esc(label)}${arrow(k)}</th>`;
  const sel = (id, val, opts) => `<select id="${id}" class="ff">${opts.map(([v,l])=>`<option value="${esc(v)}"${val===v?' selected':''}>${esc(l)}</option>`).join('')}</select>`;

  return `
  <section class="panel invpanel">
    <header>
      <h3>My invoices</h3>
      <span class="pill mute" style="margin-left:2px">All amounts exclusive of VAT</span>
      <span style="margin-left:auto;color:var(--ink3);font-size:12.5px">${rows.length} of ${all.length} rows</span>
      <div class="expbar">
        <span class="exph">Download</span>
        <button class="expbtn" data-exp="pdf" type="button" title="Print or save these ${rows.length} invoices as a PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5"/><path d="M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1"/><rect x="6" y="15" width="12" height="6" rx="1"/></svg>PDF</button>
        <button class="expbtn" data-exp="csv" type="button" title="Download these ${rows.length} invoices as a CSV file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M9 13h6M9 17h4"/></svg>CSV</button>
        <button class="expbtn" data-exp="xls" type="button" title="Download these ${rows.length} invoices as an Excel file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="m9.5 12.5 5 5M14.5 12.5l-5 5"/></svg>XLS</button>
      </div>
    </header>
    ${state.invRaw ? `<div class="pad" style="padding-bottom:0"><div class="rawbox">
      <header><b>${esc(state.invRaw.name)}</b>
        <span style="color:var(--ink3);font-size:12.5px">${esc(state.invRaw.why||'')}</span>
        <button class="btn ghost" id="rawClose" type="button" style="margin-left:auto;padding:3px 11px;font-size:12px">Close</button></header>
      <textarea id="rawText" readonly spellcheck="false">${esc(state.invRaw.text)}</textarea>
    </div></div>` : ''}
    <div class="filterbar">
      ${sel('fq', f.q, [['all','All quarters']].concat(QS.map(q=>[q,q])))}
      ${sel('fs', f.status, [['all','All statuses'],['outstanding','Unpaid & partially paid'],['Paid','Paid in full']])}
      ${sel('ftype', f.type, [['all','New & existing']].concat(uniq(IC.type).map(t=>[t,t+' clients'])))}
      ${sel('frole', f.role, [['all','Any role'],['C','I sold it'],['P','I managed it']])}
      ${sel('fsp', f.sp, [['all','Any salesperson']].concat(uniq(IC.sp).map(x=>[x,first(x)])))}
      ${sel('fpm', f.pm, [['all','Any P. manager']].concat(uniq(IC.pm).map(x=>[x,first(x)])))}
      <input id="ft" class="ff" placeholder="Search client, invoice, PR, name" value="${esc(f.text)}">
      <button class="btn ghost fclear${active?'':' off'}" id="fclear" type="button">Clear${active?' ('+active+')':''}</button>
    </div>
    <div class="printhead">
      <b>${nm(u)} &mdash; invoices</b>
      <span>${rows.length} row${rows.length===1?'':'s'}${f.q!=='all'?' &middot; '+esc(f.q):''}${f.status!=='all'?' &middot; '+esc(f.status==='Paid'?'paid in full':'unpaid and partially paid'):''} &middot; all amounts exclusive of VAT &middot; ${esc(dayLabel(HDATE()))} ${HDATE().slice(0,4)}</span>
    </div>
    <div class="tw invscroll"><table class="invtable">
      <thead><tr>
        ${th('date','Date','s1')}${th('no','Invoice #','s2')}${th('pr','PR#')}${th('type','Client')}${th('client','Company')}
        ${th('sp','Salesperson')}${th('pm','P. Manager')}
        ${th('amt','Invoice','r')}${th('exp','Expenses','r')}${th('pc','Partner','r')}${th('cn','CN','r')}
        ${th('net','Net Sales','r')}${th('status','Status')}${th('recd','Paid','r')}${th('bal','Balance','r')}
        ${th('elig','Eligible','r')}
      </tr></thead>
      <tbody>
        ${rows.length ? rows.map(r=>`<tr>
          <td class="n nw s1">${esc(r[IC.date])}</td>
          <td class="n nw s2">${esc(r[IC.no])}</td>
          <td class="n nw">${esc(r[IC.pr])||'<span style="color:var(--ink3)">—</span>'}</td>
          <td class="nw">${esc(r[IC.type])}</td>
          <td class="cname">${esc(r[IC.client])}${r[IC.forfeit]>0?' <span class="pill bad"><span class="dt"></span>Late</span>':''}</td>
          <td class="nw${r[IC.sp]===u?' me':''}" title="${esc(r[IC.sp])}">${esc(first(r[IC.sp]))}</td>
          <td class="nw${r[IC.pm]===u&&r[IC.sp]!==u?' me':''}" title="${esc(r[IC.pm])}">${esc(first(r[IC.pm]))||'<span style="color:var(--ink3)">—</span>'}</td>
          <td class="n r">${money(r[IC.amt],2)}</td>
          <td class="n r">${num(r[IC.exp])}</td>
          <td class="n r">${num(r[IC.pc])}</td>
          <td class="n r">${num(r[IC.cn])}</td>
          <td class="n r">${money(r[IC.net],2)}</td>
          <td class="nw">${statusPill(r[IC.status])}</td>
          <td class="n r">${num(r[IC.recd])}</td>
          <td class="n r"${r[IC.bal]>0?' style="color:var(--bad)"':''}>${num(r[IC.bal])}</td>
          <td class="n r">${num(r[IC.elig])}</td>
        </tr>`).join('') : '<tr><td colspan="16" style="padding:30px;text-align:center;color:var(--ink3)">No invoices match those filters.</td></tr>'}
      </tbody>
      <tfoot><tr class="tot">
        <td class="s1">${rows.length}</td><td class="s2">invoice${rows.length===1?'':'s'}</td><td colspan="5"></td>
        <td class="n r">${money(sum(IC.amt),2)}</td>
        <td class="n r">${money(sum(IC.exp),2)}</td>
        <td class="n r">${money(sum(IC.pc),2)}</td>
        <td class="n r">${money(sum(IC.cn),2)}</td>
        <td class="n r">${money(sum(IC.net),2)}</td>
        <td></td>
        <td class="n r">${money(sum(IC.recd),2)}</td>
        <td class="n r">${money(sum(IC.bal),2)}</td>
        <td class="n r">${money(sum(IC.elig),2)}</td>
      </tr></tfoot>
    </table></div>
    <p class="cap"><b>Every figure on this page is exclusive of VAT</b>, matching the workbook. Click any column heading to sort by it. With no sort chosen, anything still to collect sits at the top.</p>
  </section>`;
}

function vLeaderboard(){
  const q = state.period==='FY' ? 'Q4' : state.period, me = state.user;
  const list = Object.keys(DATA.engine).filter(n=>inScope(n,me)).map(n=>{
    const e = aggOf(n,state.period)||{netTot:0};
    return {name:NM(n) + (roleOf(n)==='former'?'  (left)':''), net:e.netTot||0, me:n===me, former:roleOf(n)==='former'};
  }).filter(x=>x.net>0 || x.me).sort((a,b)=>b.net-a.net);
  const myRank = list.findIndex(x=>x.me)+1;
  const rows = list.map(x=>({label:x.name, value:x.net, me:x.me, color: x.me?'var(--c1)':(x.former?'color-mix(in srgb, var(--ink3) 40%, var(--panel))':'color-mix(in srgb, var(--c1) 38%, var(--panel))')}));
  return `
  <div class="strip">
    <div class="stat"><span class="k">Your rank · ${state.period==='FY'?esc(state.year):state.period}</span><span class="v">${myRank||'—'}<span class="cur" style="margin-left:6px">of ${list.length}</span></span><span class="n">${nm(me)}</span></div>
    <div class="stat"><span class="k">Your net sales</span><span class="v"><span class="cur">AED</span>${money((aggOf(me,state.period)||{}).netTot||0)}</span><span class="n">${PLABEL[state.period]}</span></div>
    <div class="stat"><span class="k">${esc(deptData(me).department)} net sales</span><span class="v"><span class="cur">AED</span>${money(deptNet(state.period, me))}</span><span class="n">${list.length} people with sales</span></div>
    <div class="stat"><span class="k">Top of the board</span><span class="v" style="font-size:16px;font-family:'IBM Plex Sans',sans-serif">${esc(list[0]?list[0].name:'\u2014')}</span><span class="n">${money(list[0]?list[0].net:0)}</span></div>
  </div>

  <section class="panel">
    <header><h3>Team leaderboard</h3><span class="hint" style="margin-left:0">${esc(deptData(me).department)} &middot; ranked on net sales, ${QLABEL[q]}</span>${deptSeg(me)}</header>
    <div class="pad">${hbars(rows,{rank:true})}</div>
    <p class="cap">Everyone can see rank and net sales. Commission is visible only to the person it belongs to and to the accounts manager. Individual figures credit a shared invoice to both the consultant who sold it and the project manager, so they add up to more than the department total.</p>
  </section>

`;
}

function ring(frac, big, small){
  const R=62, C=2*Math.PI*R, f=Math.max(0,Math.min(1,frac));
  return `<svg viewBox="0 0 160 160" style="display:block;width:150px;height:150px" role="img" aria-label="${esc(small)} ${esc(big)}">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="var(--c1)"/><stop offset="100%" stop-color="var(--accent)"/></linearGradient></defs>
    <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--sunk)" stroke-width="15"/>
    <circle cx="80" cy="80" r="${R}" fill="none" stroke="url(#rg)" stroke-width="15" stroke-linecap="round"
      stroke-dasharray="${(C*f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 80 80)"/>
    <text x="80" y="78" text-anchor="middle" style="font-family:'IBM Plex Sans',sans-serif;font-size:27px;font-weight:600;fill:var(--ink)">${esc(big)}</text>
    <text x="80" y="98" text-anchor="middle" style="font-family:'IBM Plex Sans',sans-serif;font-size:9px;letter-spacing:.1em;fill:var(--ink3)">${esc(small)}</text>
  </svg>`;
}
function kpi(k,v,n,color){
  return `<div class="stat"><span class="k">${k}</span><span class="v" style="font-size:21px${color?';color:'+color:''}">${v}</span><span class="n">${n}</span></div>`;
}
function vCompany(){
  const DD = deptData(state.user);
  const months = Object.keys(DD.monthly);
  const grain = state.companyGrain;
  const metric = state.companyMetric || 'net';
  const MIDX = {inv:0, net:1};
  const mi = MIDX[metric];
  const T = DD.target || {month:0,quarter:0,year:0};
  const HASTGT = !!DD.target;
  const qsum = {Q1:[0,0,0,0],Q2:[0,0,0,0],Q3:[0,0,0,0],Q4:[0,0,0,0]};
  months.forEach(k=>{ const m=parseInt(k.slice(5),10)-1, q='Q'+(Math.floor(m/3)+1);
    for(let i=0;i<4;i++) qsum[q][i]+=DD.monthly[k][i]; });
  const t = DD.totals;
  const ytdNet = months.reduce((s,k)=>s+DD.monthly[k][1],0);
  const nMonths = months.length;
  const above = months.filter(k=>DD.monthly[k][1] >= T.month).length;
  const showTarget = metric==='net' && HASTGT;

  // Target achievement follows the Q1–Q4 / Year selector in the header
  const per = state.period;
  const qMonths = q => months.filter(k=>('Q'+(Math.floor((parseInt(k.slice(5),10)-1)/3)+1))===q).length;
  let targetVal, actualVal, periodLabel, periodNote;
  if(per === 'FY'){
    targetVal = T.year; actualVal = ytdNet; periodLabel = '2026 year to date';
    periodNote = `${nMonths} of 12 months invoiced — a straight-line target of AED ${money(T.month*nMonths)} by now.`;
  } else {
    targetVal = T.quarter; actualVal = qsum[per][1]; periodLabel = QLABEL[per];
    const el = qMonths(per);
    periodNote = el===0 ? 'No invoices raised in this quarter yet.'
      : (el<3 ? `${el} of 3 months invoiced so far — a straight-line target of AED ${money(T.month*el)} by now.`
              : 'Full quarter, all three months invoiced.');
  }

  let items, aria, thresholds = [];
  if(grain==='month'){
    items = months.map(k=>{
      const m = DD.monthly[k], idx = parseInt(k.slice(5),10)-1, v = m[mi];
      const under = showTarget && m[1] < T.month;
      return {label:MONTHNAME[idx], value:v, color: under ? 'var(--warn)' : 'var(--c1)',
        tip:`<b>${money(v)}</b> ${metric==='net'?'net sales':'invoiced'}<br>${MONTHNAME[idx]} 2026 · ${m[3]} invoices${showTarget?`<br>${under?'below':'above'} target by ${money(Math.abs(m[1]-T.month))}`:''}`};
    });
    if(showTarget) thresholds = [{v:T.month, label:'Target'}];
    aria = 'Net sales by month against the monthly target, 2026';
  } else if(grain==='quarter'){
    items = QS.map(q=>{
      const under = showTarget && qsum[q][3]>0 && qsum[q][1] < T.quarter;
      return {label:q, value:qsum[q][mi], color: under ? 'var(--warn)' : 'var(--c1)',
        tip:`<b>${money(qsum[q][mi])}</b><br>${QLABEL[q]} · ${qsum[q][3]} invoices${showTarget&&qsum[q][3]>0?`<br>${under?'below':'above'} target by ${money(Math.abs(qsum[q][1]-T.quarter))}`:''}`};
    });
    if(showTarget) thresholds = [{v:T.quarter, label:'Target'}];
    aria = 'Net sales by quarter against the quarterly target, 2026';
  } else {
    items = [{label:'2026 to date', value: metric==='inv'?t.inv:ytdNet, color:'var(--c1)',
      tip:`<b>${money(ytdNet)}</b> net sales · ${t.count} invoices`}];
    if(showTarget) thresholds = [{v:T.year, label:'Target 2.4M'}];
    aria = 'Net sales against the annual target';
  }
  const frac = targetVal ? actualVal/targetVal : 0;
  const diff = actualVal - targetVal;

  const smParts = [
    {label:'Paid ('+(DD.statusMix['Paid']||0)+')', value:DD.statusMix['Paid']||0, color:'var(--good)'},
    {label:'Partially paid ('+(DD.statusMix['Partially Paid']||0)+')', value:DD.statusMix['Partially Paid']||0, color:'var(--warn)'},
    {label:'Unpaid ('+(DD.statusMix['Unpaid']||0)+')', value:DD.statusMix['Unpaid']||0, color:'var(--bad)'}
  ];
  const newNet = Object.values(DD.typeMonthly).reduce((s,v)=>s+v[0],0);
  const topNet = DD.topClients[0] ? DD.topClients[0][2] : 0;
  const ytdTarget = T.month*nMonths;
  const runRate = ytdNet/nMonths*12;

  return `
  <div class="strip">
    <div class="stat"><span class="k">Invoiced ${esc(state.year)}${state.year === HDATE().slice(0,4) ? ' YTD' : ''}</span><span class="v"><span class="cur">AED</span>${money(t.inv)}</span><span class="n">${t.count} invoices, excl. VAT</span></div>
    <div class="stat"><span class="k">Net sales</span><span class="v"><span class="cur">AED</span>${money(ytdNet)}</span><span class="n">after cost and partner commission</span></div>
    <div class="stat"><span class="k">Collected</span><span class="v" style="color:var(--good)"><span class="cur">AED</span>${money(t.inv-t.outstanding)}</span><span class="n">${pct(1-t.outstanding/t.inv,1)} of invoiced value</span></div>
    <div class="stat"><span class="k">Outstanding</span><span class="v" style="color:var(--bad)"><span class="cur">AED</span>${money(t.outstanding)}</span><span class="n">${pct(t.outstanding/t.inv,1)} of invoiced value</span></div>
  </div>

  ${HASTGT ? `
  <section class="panel">
    <header><h3>Target achievement</h3><span class="hint" style="margin-left:0">${per==='FY'?'AED '+money(T.year):'AED '+money(T.quarter)} in net sales${per==='FY'?' a year':' a quarter'}</span>${deptSeg(state.user)}</header>
    <div class="pad" style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">
      <div style="flex:0 0 auto">${ring(frac, Math.round(frac*100)+'%', 'OF TARGET')}</div>
      <div style="flex:1 1 340px;min-width:280px">
        <p style="margin:0 0 14px;color:var(--ink2)"><b>${esc(periodLabel)}</b> &mdash; ${diff>=0?'<b style="color:var(--good)">ahead of target</b>':'<b style="color:var(--warn)">short of target</b>'}. ${periodNote} Switch period with the <b>Q1&ndash;Q4 / Year</b> buttons at the top.</p>
        <div class="strip" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          ${kpi('Net sales','<span class="cur">AED</span>'+money(actualVal), esc(periodLabel))}
          ${kpi('Target','<span class="cur">AED</span>'+money(targetVal), per==='FY'?'full year':'per quarter')}
          ${kpi(diff>=0?'Ahead by':'Remaining','<span class="cur">AED</span>'+money(Math.abs(diff)), diff>=0?'above target':'still to earn', diff>=0?'var(--good)':'var(--accent2)')}
        </div>
        <p class="note" style="margin-top:14px"><b>${QS.filter(q=>qsum[q][3]>0 && qsum[q][1]>=T.quarter).length} of ${QS.filter(q=>qsum[q][3]>0).length} quarters</b> have cleared ${money(T.quarter)}, and <b>${above} of ${nMonths} months</b> cleared ${money(T.month)}. At the current run rate the year lands near <b>AED ${money(runRate)}</b> against the ${money(T.year)} target &mdash; ${runRate>=T.year?'ahead':'short'} by ${money(Math.abs(runRate-T.year))}.</p>
      </div>
    </div>
  </section>` : `
  <section class="panel">
    <header><h3>How the quarter is going</h3><span class="hint" style="margin-left:0">${DD.combined?'the target is set for Corporate &amp; Legal only':'no sales target is set for '+esc(DD.department)}</span>${deptSeg(state.user)}</header>
    <div class="pad">
      <p style="margin:0 0 14px;color:var(--ink2)"><b>${esc(periodLabel)}</b> &mdash; AED ${money(actualVal)} in net sales. ${esc(periodNote.replace(/ — a straight-line target of AED [\d,]+ by now\./,'.').replace(/ a straight-line target of AED [\d,]+ by now\./,'.'))} Switch period with the <b>Q1&ndash;Q4 / Year</b> buttons at the top.</p>
      <div class="strip" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${kpi('Net sales','<span class="cur">AED</span>'+money(actualVal), esc(periodLabel))}
        ${kpi('Best month','<span class="cur">AED</span>'+money(Math.max(...months.map(k=>DD.monthly[k][1]))), MONTHNAME[months.reduce((bi,k,i)=>DD.monthly[k][1]>DD.monthly[months[bi]][1]?i:bi,0)]+' 2026')}
        ${kpi('Monthly average','<span class="cur">AED</span>'+money(ytdNet/nMonths), nMonths+' months invoiced')}
        ${kpi('Collected','<span class="cur">AED</span>'+money(t.inv-t.outstanding), pct(1-t.outstanding/t.inv,1)+' of invoiced value','var(--good)')}
      </div>
      <p class="note" style="margin-top:14px">The monthly and quarterly targets in this portal are set for Corporate &amp; Legal${DD.combined?' alone, so they are not shown against a combined figure':''}. ${DD.combined?'Both departments are':esc(DD.department)+' is'} reported on the same basis &mdash; net sales after cost and partner commission.</p>
    </div>
  </section>`}

  <section class="panel">
    <header><h3>${esc(DD.department)} performance</h3>
      <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap">
        <div class="seg" id="metricSeg">
          ${[['net','Net sales'],['inv','Invoiced']].map(([k,l])=>`<button data-m="${k}" aria-pressed="${metric===k}" type="button">${l}</button>`).join('')}
        </div>
        <div class="seg" id="grainSeg">
          ${[['month','Monthly'],['quarter','Quarterly'],['year','Yearly']].map(([k,l])=>`<button data-g="${k}" aria-pressed="${grain===k}" type="button">${l}</button>`).join('')}
        </div>
      </div>
    </header>
    ${chartSlot('co', items, {aria, height:280, thresholds, tickFmt:v=>v>=1000000?(v/1000000)+'M':(v>=1000?(v/1000)+'k':money(v))})}
    ${showTarget?`<div class="pad" style="padding-top:0">${legend([{label:'At or above target',color:'var(--c1)'},{label:'Below target',color:'var(--warn)'}])}</div>`:''}
    <p class="cap">${showTarget?'Dashed line is the AED 200,000 monthly net-sales target (600,000 quarterly, 2.4M annual).':'Invoiced value excludes VAT.'} Hover any bar for invoice count and the gap to target.</p>
  </section>

  <section class="panel">
    <header><h3>Key indicators</h3><span class="hint">2026 to date</span></header>
    <div>
      <div class="strip kpirow" style="border:0;box-shadow:none;border-radius:0;border-bottom:1px solid var(--line2)">
        ${kpi('Net sales margin', pct(ytdNet/t.inv,1), 'of invoiced value survives cost and partner fees')}
        ${kpi('Collection rate', pct(1-t.outstanding/t.inv,1), money(t.inv-t.outstanding)+' collected')}
        ${kpi('Average invoice', '<span class="cur">AED</span>'+money(t.inv/t.count), t.count+' invoices raised')}
        ${kpi('Invoices per month', money(t.count/nMonths,0), 'across '+nMonths+' months')}
      </div>
      <div class="strip kpirow" style="border:0;box-shadow:none;border-radius:0">
        ${kpi('Active clients', money(DD.clientCount), 'billed at least once in 2026')}
        ${kpi('Largest client', pct(topNet/ytdNet,1), 'of net sales — '+esc(DD.topClients[0][0].slice(0,26))+(DD.topClients[0][0].length>26?'…':''), topNet/ytdNet>0.15?'var(--warn)':null)}
        ${kpi('New-client work', pct(newNet/ytdNet,1), 'of net sales — '+money(newNet)+' from new clients', newNet/ytdNet<0.05?'var(--warn)':null)}
        ${HASTGT
          ? kpi('Months on target', above+' of '+nMonths, 'at or above AED '+money(T.month), above/nMonths>=0.75?'var(--good)':'var(--warn)')
          : kpi('Best month','<span class="cur">AED</span>'+money(Math.max(...months.map(k=>DD.monthly[k][1]))), MONTHNAME[months.reduce((bi,k,i)=>DD.monthly[k][1]>DD.monthly[months[bi]][1]?i:bi,0)]+' 2026')}
      </div>
    </div>
    <p class="cap">${DD.combined?'Corporate &amp; Legal and Accounting &amp; Tax combined':esc(DD.department)+' only'} &mdash; staff see their own department alone. Two of these are worth watching. <b>New-client work at ${pct(newNet/ytdNet,1)}</b> means almost everything is repeat business — comfortable, but it is not growth. And a single client at <b>${pct(topNet/ytdNet,1)}</b> of net sales is concentration risk if that relationship ends.</p>
  </section>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Top clients</h3><span class="hint">by net sales, 2026</span></header>
      <div class="pad">${hbars(DD.topClients.map(c=>({label:c[0].length>38?c[0].slice(0,36)+'…':c[0], value:c[2], color:'var(--c2)'})),{})}</div>
      <p class="cap">Net sales, not invoiced value — so a large invoice carrying heavy cost or a 20% partner fee sits lower here than it would on turnover.</p>
    </section>
    <section class="panel">
      <header><h3>Collection status</h3><span class="hint">${t.count} invoices</span></header>
      <div class="pad" style="display:flex;flex-direction:column;gap:14px">
        ${stacked(smParts)}${legend(smParts)}
        <dl class="kv">
          <dt>Outstanding balance</dt><dd>${money(t.outstanding)}</dd>
          <dt>Collected</dt><dd>${money(t.inv - t.outstanding)}</dd>
          <div class="sep"></div>
          <dt><b>Collection rate</b></dt><dd class="big">${pct(1-t.outstanding/t.inv,1)}</dd>
        </dl>
        <p class="note">Every dirham in the unpaid column is commission nobody can be paid yet. This panel is the reason the team chases their own invoices.</p>
      </div>
    </section>
  </div>

`;
}

/* ---------------- tools ---------------- */
const FX = {stripe:3.63, pos:3.65};
const VATR = 0.05;
const CHANNELS = [
  {id:'si', group:'stripe', name:'Stripe', kind:'International', rate:0.0390, fixed:2,
   line:'3.90% charges for international card + 2 AED'},
  {id:'sd', group:'stripe', name:'Stripe', kind:'Domestic', rate:0.0290, fixed:2,
   line:'2.90% charges for domestic card + 2 AED'},
  {id:'pi', group:'pos', name:'POS machine', kind:'International', rate:0.0250, fixed:0,
   line:'2.50% charges for international card'},
  {id:'pd', group:'pos', name:'POS machine', kind:'Domestic', rate:0.0120, fixed:0,
   line:'1.20% charges for domestic card'}
];
/* POA does not gross up. It charges its own service fee on the order value and
   adds 5% VAT on that fee, so the customer pays the order plus the fee. */
const POAFEES = [
  {id:'nomod', name:'Nomod', kind:'Any card', rate:0.02,
   line:'2% of the order value'},
  {id:'posd',  name:'POS machine', kind:'Local card', rate:0.015,
   line:'1.5% of the order value'},
  {id:'posi',  name:'POS machine', kind:'International card', rate:0.025,
   line:'2.5% of the order value'}
];
function poaCalc(order, f){
  const fee = order * f.rate;
  const vat = fee * VATR;
  return {order, fee, vat, total: fee + vat, charge: order + fee + vat};
}

function cardCalc(inv, ch){
  if(ch.group === 'stripe'){
    const base = inv/(1-ch.rate);
    const charges = base*ch.rate + ch.fixed;
    const vat = charges*VATR;
    return {inv, charges, vat, total: inv+charges+vat, amountCol:0, vatCol:0, cost:charges+vat};
  }
  const total = inv/(1 - ch.rate*(1+VATR));
  const charges = total*ch.rate;
  const vat = charges*VATR;
  return {inv, charges, vat, total, amountCol:charges, vatCol:vat, cost:charges+vat};
}
function vToolsPOA(){
  return `
  <section class="panel">
    <header><h3>Card processing fee</h3><span class="hint">what POA adds on top of the order</span></header>
    <div class="pad" style="display:flex;flex-direction:column;gap:16px">
      <div class="field" style="margin:0;max-width:260px">
        <label for="pfOrd">Order value</label>
        <input id="pfOrd" class="num" type="number" value="10000" step="0.01">
      </div>
      <div id="pfOut"></div>
    </div>
    <p class="cap">The fee is worked out on the order value and 5% VAT is added on the fee itself, not on the order. Nomod is a flat 2% whatever the card; the POS machine splits by where the card was issued, so ask before you quote. Nothing here grosses the order up &mdash; the customer pays the order plus the fee.</p>
  </section>`;
}

function calcPOA(){
  const el = document.getElementById('pfOrd');
  if(!el) return;
  const order = parseFloat(el.value) || 0;
  const R = {}; POAFEES.forEach(f=>{ R[f.id] = poaCalc(order, f); });

  // Nomod or the POS machine is a real choice; local or international is the
  // customer's card, not ours - so compare like with like.
  const pairs = [
    {kind:'Local card',         pos:'posd', win: R.posd.total  <= R.nomod.total ? 'posd' : 'nomod'},
    {kind:'International card', pos:'posi', win: R.posi.total  <= R.nomod.total ? 'posi' : 'nomod'}
  ];
  const badge = {};
  pairs.forEach(pr=>{ badge[pr.win] = (badge[pr.win] ? badge[pr.win]+' and ' : '') + pr.kind.toLowerCase().replace(' card',''); });

  const nameOf = id => { const f = POAFEES.find(x=>x.id===id); return f.name + (f.id==='nomod' ? '' : ' \u00b7 ' + f.kind.replace(' card','')); };

  const cmp = pr => {
    const lose = pr.win === 'nomod' ? pr.pos : 'nomod';
    const save = R[lose].total - R[pr.win].total;
    return `<div class="stat"><span class="k">${esc(pr.kind)} &mdash; cheaper route</span>
      <span class="v" style="font-size:17px;font-family:'IBM Plex Sans',sans-serif">${esc(nameOf(pr.win))}</span>
      <span class="n">charge <b>AED ${money(R[pr.win].charge,2)}</b> &middot; fee ${money(R[pr.win].total,2)} (${order?pct(R[pr.win].total/order,2):'\u2014'})</span>
      <span class="n" style="color:var(--good)">saves ${money(save,2)} against ${esc(nameOf(lose))}</span></div>`;
  };

  const block = f => {
    const r = R[f.id], b = badge[f.id];
    return `
    <section class="fee${b?' best':''}">
      <div class="feehead ${f.id==='nomod'?'stripe':'pos'}">
        <span>${esc(f.name)} <span style="opacity:.8">(${esc(f.kind)})</span></span>
        ${b?`<span class="pill" style="background:rgba(255,255,255,.22);color:#fff"><span class="dt"></span>Cheaper for ${/^[aeiou]/i.test(b)?'an':'a'} ${esc(b)} card</span>`:''}
      </div>
      <table>
        <thead><tr><th></th><th class="r">Amount</th><th class="r">VAT</th><th class="r">Total</th></tr></thead>
        <tbody>
          <tr><td>Order value</td><td></td><td></td><td class="n r">${money(r.order,2)}</td></tr>
          <tr><td>${esc(f.line)}</td><td class="n r">${money(r.fee,2)}</td>
              <td class="n r">${money(r.vat,2)}</td><td class="n r">${money(r.total,2)}</td></tr>
          <tr class="tot"><td>Charge the customer</td>
              <td class="n r">${money(r.fee,2)}</td><td class="n r">${money(r.vat,2)}</td>
              <td class="n r">${money(r.charge,2)}</td></tr>
        </tbody>
      </table>
      <div class="feefoot">
        <span>Fee on top of the order</span>
        <b class="num">${money(r.total,2)} &middot; ${r.order?pct(r.total/r.order,2):'\u2014'}</b>
      </div>
    </section>`;
  };

  const nomod = POAFEES.find(f=>f.id==='nomod');
  const pos = POAFEES.filter(f=>f.id!=='nomod');
  document.getElementById('pfOut').innerHTML = `
    <div class="strip" style="grid-template-columns:repeat(2,minmax(0,1fr))">${pairs.map(cmp).join('')}</div>
    <div class="feegrid one">${block(nomod)}</div>
    <div class="feegrid">${pos.map(block).join('')}</div>`;
}

function calcTabs(){
  const T = [['card', 'Card processing fee'], ['mattia', "Mattia's commission"]];
  const cur = T.some(x => x[0] === state.calcTab) ? state.calcTab : 'card';
  return {cur, bar: `<div class="seg segbig" id="calcSeg">${T.map(([v, l]) =>
    `<button data-ct="${v}" aria-pressed="${cur === v}" type="button">${esc(l)}</button>`).join('')}</div>`};
}

/* Mattia's commission, from the sheet Avin sent.
 *
 * One figure goes in: our price for the job, before VAT. Everything else
 * follows from it —
 *
 *   Our price   the invoice, plus 5% VAT
 *   To client   our price marked up, plus 5% VAT on that
 *   Mattia      the difference between the two, and no VAT on it
 *
 * The mark-up on his sheet is 25% of our price, which makes Mattia's share a
 * fifth of what the client pays. It is a box rather than a constant, the same
 * as the two rates, because the next job may not be twenty-five.
 *
 * The USD and EUR blocks are the dirham figures divided by the rate, figure
 * by figure, which is what the sheet does. Dividing each one separately and
 * dividing the total give the same answer to the fil, so the columns still
 * add up after the conversion — worth saying, because that is the usual way
 * a converted table stops tying out.
 */
function vMattia(){
  return `
  <section class="panel">
    <header><h3>Mattia&rsquo;s commission</h3>
      <span class="hint">type our price before VAT &mdash; everything else follows</span></header>
    <div class="pad" style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div class="field mcyellow" style="margin:0;min-width:230px">
          <label for="mcInv">Our price in AED, before VAT</label>
          <input id="mcInv" class="num" type="number" value="10000" step="0.01">
        </div>
        <div class="field" style="margin:0;max-width:150px">
          <label for="mcUp">Mark-up to the client</label>
          <input id="mcUp" class="num" type="number" value="25" step="0.5">
        </div>
        <div class="field" style="margin:0;max-width:130px">
          <label for="mcUsd">USD rate</label>
          <input id="mcUsd" class="num" type="number" value="3.65" step="0.0001">
        </div>
        <div class="field" style="margin:0;max-width:130px">
          <label for="mcEur">EUR rate</label>
          <input id="mcEur" class="num" type="number" value="4.15" step="0.0001">
        </div>
      </div>
      <div id="mcOut"></div>
    </div>
    <p class="cap">VAT is the UAE standard rate of 5% and applies to our price and to the client&rsquo;s,
      not to Mattia&rsquo;s share &mdash; that is the margin between the two invoices, not a supply of its own.
      The rates are the ones on the sheet and can be typed over for a job priced at a different one.</p>
  </section>`;
}

const MCVAT = 0.05;

function calcMattia(){
  const num = (id, fallback) => {
    const el = document.getElementById(id);
    const v = el ? parseFloat(el.value) : NaN;
    return isFinite(v) ? v : fallback;
  };
  const inv = Math.max(0, num('mcInv', 0));
  const up  = Math.max(0, num('mcUp', 25)) / 100;
  const rate = {AED: 1, USD: Math.max(0.0001, num('mcUsd', 3.65)),
                        EUR: Math.max(0.0001, num('mcEur', 4.15))};

  const ours   = inv;
  const client = inv * (1 + up);
  const mattia = client - ours;

  const block = (cur) => {
    const r = rate[cur], at = a => a / r;
    const line = (label, amount, vatable) => {
      const a = at(amount), v = vatable ? a * MCVAT : 0;
      return `<tr${label === 'Mattia' ? ' class="tot"' : ''}>
        <td>${label}</td>
        <td class="n r">${money(a, 2)}</td>
        <td class="n r">${vatable ? money(v, 2) : ''}</td>
        <td class="n r netcol">${money(a + v, 2)}</td></tr>`;
    };
    return `
    <section class="mcblock">
      <div class="mchead">${cur}${cur === 'AED' ? '' :
        ` <span>at ${money(r, 4).replace(/0+$/, '').replace(/\.$/, '')} to the dirham</span>`}</div>
      <table style="table-layout:fixed;width:100%">
        ${colsOf([31, 23, 20, 26])}
        <thead><tr><th>${cur}</th><th class="r">Invoice</th><th class="r">VAT</th><th class="r">Total</th></tr></thead>
        <tbody>
          ${line('Our price', ours, true)}
          ${line('To client', client, true)}
          ${line('Mattia', mattia, false)}
        </tbody>
      </table>
    </section>`;
  };

  const out = document.getElementById('mcOut');
  if(!out) return;
  out.innerHTML = `
    <p class="mcsay">The client is invoiced <b>AED ${money(client, 2)}</b> before VAT &mdash;
      our price plus ${money(up * 100, 2).replace(/\.00$/, '')}% &mdash; and
      <b>Mattia takes AED ${money(mattia, 2)}</b>, which is
      ${client ? money(mattia / client * 100, 1) : '0'}% of what the client pays.</p>
    <div class="mcgrid">${['AED', 'USD', 'EUR'].map(block).join('')}</div>`;
}

function vTools(){
  const CT = calcTabs();
  const k = activeCo().key;
  if(CT.cur === 'mattia') return CT.bar + vMattia();
  if(k === 'poa') return CT.bar + vToolsPOA();
  if(k !== 'corplex') return CT.bar + `
  <section class="panel">
    <div class="pad" style="padding:52px 24px;text-align:center;color:var(--ink3)">
      <p style="margin:0 0 6px;color:var(--ink2);font-size:15px">No card fee arrangement is set up for ${esc(activeCo().name)}.</p>
      <p style="margin:0;font-size:13.5px">Tell accounts what the rates are and it will appear here.</p>
    </div>
  </section>`;
  return CT.bar + `
  <section class="panel">
    <header><h3>Card processing fee</h3><span class="hint">what to charge so the invoice is settled in full</span></header>
    <div class="pad" style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div class="field" style="margin:0;min-width:220px">
          <label for="cfInv">Service fee in AED, including VAT</label>
          <input id="cfInv" class="num" type="number" value="1316.25" step="0.01">
        </div>
        <div class="field" style="margin:0">
          <label for="cfCur">Client pays in</label>
          <select id="cfCur" style="width:auto"><option value="AED">AED</option><option value="USD">USD</option></select>
        </div>
        <div class="field fxf" style="margin:0"><label for="cfFxS">Stripe rate</label>
          <input id="cfFxS" class="num" type="number" value="3.63" step="0.0001"></div>
        <div class="field fxf" style="margin:0"><label for="cfFxP">POS rate</label>
          <input id="cfFxP" class="num" type="number" value="3.65" step="0.0001"></div>
        <p id="cfFx" style="margin:0 0 4px;color:var(--ink3);font-size:12.5px"></p>
      </div>
      <div id="cfOut"></div>
    </div>
    <p class="cap">Same formulas as the finance workbook. Stripe fees carry no recoverable UAE input tax — Stripe invoices from outside the UAE, so the VAT is a reverse-charge entry, not a claim. The POS acquirer issues a UAE tax invoice, so its VAT shows in the Amount and VAT columns.</p>
  </section>

`;
}
function calcCard(){
  const raw = parseFloat(document.getElementById('cfInv').value)||0;
  const cur = document.getElementById('cfCur').value;
  const fxEl = {stripe: document.getElementById('cfFxS'), pos: document.getElementById('cfFxP')};
  const rate = g => { const v = parseFloat(fxEl[g] && fxEl[g].value); return v > 0 ? v : FX[g]; };
  document.querySelectorAll('.fxf').forEach(el => el.classList.toggle('hidden', cur !== 'USD'));

  // the amount typed in is AED; the client's currency divides it
  const invOf = g => cur === 'USD' ? raw / rate(g) : raw;

  document.getElementById('cfFx').innerHTML = cur==='USD'
    ? `AED ${money(raw,2)} is <b>USD ${money(invOf('stripe'),2)}</b> on Stripe at ${rate('stripe')}, and <b>USD ${money(invOf('pos'),2)}</b> on the POS machine at ${rate('pos')}. Every figure below is in USD.`
    : '';

  const rows = CHANNELS.map(ch => ({ch, r: cardCalc(invOf(ch.group),
    cur === 'USD' ? Object.assign({}, ch, {fixed: ch.fixed / rate(ch.group)}) : ch)}));
  const byKind = k => rows.filter(x=>x.ch.kind===k).sort((a,b)=>a.r.cost-b.r.cost);
  const best = {}; ['International','Domestic'].forEach(k=>{ const s=byKind(k); best[k]={win:s[0], lose:s[1]}; });

  const CUR = cur;
  const block = ({ch,r}) => {
    const isPos = ch.group==='pos';
    const isBest = best[ch.kind] && best[ch.kind].win.ch.id===ch.id;
    return `
    <section class="fee${isBest?' best':''}">
      <div class="feehead ${ch.group}">
        <span>${esc(ch.name)} <span style="opacity:.8">(${esc(ch.kind)})</span></span>
        ${isBest?'<span class="pill" style="background:rgba(255,255,255,.22);color:#fff"><span class="dt"></span>Cheaper for this card type</span>':''}
      </div>
      <table style="table-layout:fixed;width:100%">
        ${colsOf([49, 17, 14, 20])}
        <thead><tr><th>${esc(CUR)}</th><th class="r">Amount</th><th class="r">VAT</th><th class="r">Total</th></tr></thead>
        <tbody>
          <tr><td>Service fee</td><td></td><td></td><td class="n r">${money(r.inv,2)}</td></tr>
          <tr><td>${esc(cur === 'USD' && ch.fixed ? ch.line.replace(/\+ 2 AED/, '+ ' + money(2/rate(ch.group), 2) + ' USD') : ch.line)}</td>
              <td class="n r">${isPos?money(r.amountCol,2):''}</td>
              <td class="n r">${isPos?money(r.vatCol,2):''}</td>
              <td class="n r">${money(isPos ? r.charges+r.vat : r.charges,2)}</td></tr>
          ${isPos?'':`<tr><td>VAT on Stripe fees</td><td></td><td></td><td class="n r">${money(r.vat,2)}</td></tr>`}
          <tr class="tot"><td>Total</td>
              <td class="n r">${money(r.amountCol,2)}</td>
              <td class="n r">${money(r.vatCol,2)}</td>
              <td class="n r">${money(r.total,2)}</td></tr>
        </tbody>
      </table>
      <div class="feefoot">
        <span>Cost of taking this card</span>
        <b class="num">${money(r.cost,2)} &middot; ${r.inv?pct(r.cost/r.inv,2):'—'}</b>
      </div>
    </section>`;
  };

  const cmp = k => {
    const w = best[k].win, l = best[k].lose;
    const save = l.r.cost - w.r.cost;
    return `<div class="stat"><span class="k">${k} card &mdash; cheaper route</span>
      <span class="v" style="font-size:17px;font-family:'IBM Plex Sans',sans-serif">${esc(w.ch.name)}</span>
      <span class="n">charge <b>AED ${money(w.r.total,2)}</b> &middot; costs ${money(w.r.cost,2)} (${pct(w.r.cost/w.r.inv,2)})</span>
      <span class="n" style="color:var(--good)">saves ${money(save,2)} against ${esc(l.ch.name)}</span></div>`;
  };
  document.getElementById('cfOut').innerHTML = `
    <div class="strip" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      ${cmp('International')}${cmp('Domestic')}
    </div>
    <div class="feegrid">${rows.map(block).join('')}</div>`;
}
/* ---------------- payment requests ---------------- */
const MODES = [
  {id:'card',     label:'Card (for portals)', next:'Avin approves, you proceed with the payment on the portal, and he releases the OTP in the banking app.'},
  {id:'transfer', label:'Bank transfer',      next:'Avin initiates the transfer, then a manager authorises it in the banking portal.'},
  {id:'link',     label:'Link payment',       next:'Avin approves and sends you the payment link to complete.'},
  {id:'cash',     label:'Cash',               next:'Avin approves and the admin pays in cash — collect it from the admin desk.'}
];
/* Whatever the database gives this person, which for a consultant is their own
 * requests and for accounts is everybody's. Empty is a perfectly good answer
 * and the screen says so; it used to say five things that were not true. */
function reqs(){ return DATA.payments || []; }
const PAYSTATUS = ['Paid','Unpaid','Initiated'];
const ACCOUNTS = [
  {id:'petty',      label:'Petty Cash',    remark:c=>`Nissa, please handover cash to "${c}"`,
   who:['Nissa Muradova — hands over the cash']},
  {id:'mashreq',    label:'Mashreq (AED)', remark:()=>'Payment initiated. To be approved by Miraziz',
   who:['Miraziz Makhamatzhanov — authorises the transfer']},
  {id:'qashio',     label:'Qashio - 9073', remark:()=>'Use my Qashio Card 9073. I will authorize it',
   who:['Avin Mascarenhas — authorises the card']},
  {id:'qashio9444', label:'Qashio - 9444', remark:()=>'Use my Qashio Card 9444. I will authorize it',
   who:['Avin Mascarenhas — authorises the card']},
  {id:'qashio3639', label:'Qashio - 3639', remark:()=>'Use my Qashio Card 3639. I will authorize it',
   who:['Avin Mascarenhas — authorises the card']},
  /* Not offered any more — it is not on the list Avin gave. It stays here so
   * that a payment already made through it still says what it says, rather
   * than showing a blank where an account used to be. */
  {id:'mcard',      label:'Mashreq Card',  retired:true,
   remark:()=>'Use Mashreq Card. OTP will be provided by Miraziz',
   who:['Miraziz Makhamatzhanov — provides the OTP']}
];
const OFFERED = () => ACCOUNTS.filter(a => !a.retired);
/* Who authorises a Mashreq transfer in the banking portal — the owner. Asked
 * of the roster rather than written down twice. */
function payAuthoriser(){
  const u = (USERS || []).find(x => roleOf(x.name) === 'owner');
  return u ? u.name : '';
}
function authoriserWa(){ return waNumber(phoneOf(payAuthoriser())); }

/* Exactly the six lines Avin asked for, in his order and his wording, for
 * copying out of the table and pasting into a chat. Deliberately not the
 * longer approval message below: this one is what a payment IS, and nothing
 * about who raised it or where it stands. */
const DOCICO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
  + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';

function orderMessage(r){
  const amt = Number(r.amount) === Math.round(Number(r.amount))
    ? String(Math.round(Number(r.amount)))
    : Number(r.amount).toFixed(2);
  const ccy = (r.ccy && r.ccy !== 'AED') ? r.ccy + ' ' : '';
  return [
    `Order number:  ${r.order || '—'}`,
    `Amount: ${ccy}${amt}`,
    `Client name: ${r.client || '—'}`,
    `Purpose of payment: ${r.purpose || '—'}`,
    `Mode of payment: ${(MODES.find(m=>m.id===r.mode)||{}).label || r.mode}`,
    `Vendor Name: ${r.payee || '—'}`
  ].join('\n');
}

function waMessage(r){
  const acct = ACCOUNTS.find(x=>x.id===r.account);
  return [
    `*Consultant* ${r.by}`,
    `*Order number:* ${r.order||'—'}`,
    `*Amount:* ${Math.round(r.amount*100)/100}`,
    `*Client name:* ${r.client}`,
    `*Purpose of payment:* ${r.purpose}`,
    `*Mode of payment:* ${(MODES.find(m=>m.id===r.mode)||{}).label||r.mode}`,
    `*Vendor Name:* ${r.payee||'—'}`,
    `*Additional information (if any):* ${r.note||'—'}`,
    `*Approval status:* Approved`,
    `*Payment status:* ${r.payStatus||'—'}`,
    `*Remarks:* ${r.remarks||'—'}`
  ].join('\n');
}
function clientStatus(name){
  const c = DATA.clients[name];
  if(!c) return {known:false};
  return {known:true, inv:c[0], out:c[1], count:c[2], last:c[3], status:c[4], paid:c[1]<=0.5};
}
function clientBadge(name){
  const c = clientStatus(name);
  if(!c.known) return '<span class="pill mute">Client not in the 2026 book</span>';
  return c.paid
    ? `<span class="pill good"><span class="dt"></span>Client has paid in full</span> <span style="color:var(--ink3);font-size:12px">${c.count} invoice${c.count===1?'':'s'} · last ${esc(c.last)}</span>`
    : `<span class="pill bad"><span class="dt"></span>AED ${money(c.out)} still outstanding</span> <span style="color:var(--ink3);font-size:12px">${c.count} invoice${c.count===1?'':'s'} · last ${esc(c.last)}</span>`;
}
function vApprovePanel(){
  const r = reqs().find(x=>x.ref===state.approve.ref);
  if(!r) return '';
  const st = state.approve;
  const acct = ACCOUNTS.find(x=>x.id===st.account);
  const ready = st.payStatus && st.account;
  const preview = ready ? waMessage(Object.assign({}, r, {payStatus:st.payStatus, account:st.account, remarks:st.remarks})) : '';
  return `
  <section class="panel" style="border-color:var(--accent);box-shadow:0 0 0 3px var(--accentSoft), var(--shadow)">
    <header style="background:var(--accentSoft)">
      <h3>Approving ${esc(reqName(r))}</h3>
      <span class="hint">${esc(r.by)} &middot; ${esc(r.client)} &middot; AED ${money(r.amount,2)}</span>
    </header>
    <div class="pad" style="display:flex;flex-direction:column;gap:18px">
      <div class="grid g2">
        <div>
          <label style="margin-bottom:9px">Step 1 &mdash; Payment status</label>
          <div class="seg" style="width:100%">
            ${PAYSTATUS.map(s=>`<button type="button" data-ps="${s}" aria-pressed="${st.payStatus===s}" style="flex:1">${s}</button>`).join('')}
          </div>
        </div>
        <div>
          <label style="margin-bottom:9px">Step 2 &mdash; Paid from</label>
          <div class="seg" style="width:100%;flex-wrap:wrap">
            ${OFFERED().map(x=>`<button type="button" data-ac="${x.id}" aria-pressed="${st.account===x.id}" style="flex:1;white-space:nowrap">${esc(x.label)}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="field" style="margin:0">
        <label for="apRemarks">Step 3 &mdash; Remarks ${st.account?'<span style="color:var(--ink3);text-transform:none;letter-spacing:0">&mdash; filled in for you, edit if needed</span>':''}</label>
        <input id="apRemarks" value="${esc(st.remarks||'')}" placeholder="Choose an account above and the remark writes itself">
      </div>

      ${ready ? `
      <div class="note" style="border-left-color:var(--good);margin:0">
        <b>Who gets told the moment you approve.</b>
        <div style="margin-top:7px;display:flex;flex-direction:column;gap:3px">
          <span>&bull; <b>${esc(r.by)}</b> &mdash; raised the request; sees the status and your remark</span>
          ${(acct.who||[]).map(w=>`<span>&bull; <b>${esc(w.split(' — ')[0])}</b> &mdash; ${esc(w.split(' — ')[1]||'')}</span>`).join('')}
        </div>
      </div>
      <div>
        <label style="margin-bottom:9px">Step 4 &mdash; Message for the payments group</label>
        <pre id="waText" style="margin:0;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:16px;
          font-family:'IBM Plex Sans',sans-serif;font-size:12.5px;line-height:1.75;white-space:pre-wrap;color:var(--ink)">${esc(preview)}</pre>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center">
          <button class="btn" id="apWa" type="button">Open WhatsApp</button>
          <button class="btn ghost" id="apCopy" type="button">Copy message</button>
          <button class="btn ghost" id="apDone" type="button">Approve &amp; close</button>
          <span id="apCopied" style="color:var(--good);font-size:12.5px"></span>
        </div>
        <p style="margin:12px 0 0;color:var(--ink3);font-size:12.5px">Opens WhatsApp with the message ready &mdash; pick the payments group and send. WhatsApp does not let an app post into a group by itself, so the send stays a deliberate tap.</p>
      </div>` : `<div class="note">Pick a payment status and an account and the remark, the WhatsApp message and the approval all fall into place.</div>`}
      <div><button class="btn ghost" id="apCancel" type="button">Cancel</button></div>
    </div>
  </section>`;
}
/* What to call a request when talking to a person about it. */
function reqName(r){
  if(!r) return 'that request';
  if(r.order) return r.order;
  return `${r.payee || 'the payment'} — AED ${money(r.amount, 2)}`;
}

/* Enough to know whose it is. Nobody in the office shares a first name, and
 * a full one took three lines in a column two words wide. */
function firstName(n){ return String(NM(n) || '').trim().split(/\s+/)[0] || n; }

/* Amounts on this screen carry their currency, because not all of them are
 * dirhams and a bare number that might be euros is not a figure at all. */
/* AED is the default and the overwhelming majority, so it goes unsaid and
 * the column gets its width back. A euro or a dollar still says which. */
function payAmt(r){ const c = r.ccy || 'AED';
  return (c === 'AED' ? '' : esc(c) + ' ') + money(r.amount, 2); }
/* …but the hover card, and anything read out of the table, says it in full. */
function payFull(r){ return `${r.ccy || 'AED'} ${money(r.amount, 2)}`; }

/* The year is this year on all but a handful of rows, and eleven characters
 * of date in a column that has room for six is how '04 Sep 2026' became
 * '04 Sep 2...'. An older one keeps its year, because that is the row where
 * the year is the interesting part. */
/* A colgroup from a list of shares. One per cent of slack, so a scrollbar
 * never appears over blank space. */
function colsOf(ws){
  return '<colgroup>' + ws.map(w =>
    `<col style="width:${(w * 0.99).toFixed(2)}%">`).join('') + '</colgroup>';
}

function payDate(d){
  const s = String(d || ''), y = ' ' + new Date().getFullYear();
  return s.endsWith(y) ? s.slice(0, -y.length) : s;
}
function sumBy(list){
  const per = {};
  list.forEach(r => { per[r.ccy || 'AED'] = (per[r.ccy || 'AED'] || 0) + r.amount; });
  return Object.entries(per).map(([c, v]) => `${c} ${money(v, 2)}`).join(' + ');
}

/* One mark, at the end, for correcting. A word in a column read twelve times
 * a screen is eleven readings of a word nobody needed. */
/* Marks a cell as having more in it than fits. The hover card only appears
 * when the text is actually cut, so a short client name behaves like a
 * perfectly ordinary cell. */
function cellHover(){
  if(window.__cellHover) return;
  window.__cellHover = true;
  const card = document.createElement('div');
  card.className = 'cellpop hidden';
  card.innerHTML = '<div class="ct"></div><button class="btn ghost sm" type="button">Copy</button>';
  document.body.appendChild(card);
  const txt = card.querySelector('.ct'), cpy = card.querySelector('button');
  let over = false, timer = null, current = '';
  const hide = () => { clearTimeout(timer); timer = setTimeout(() => {
    if(!over) card.classList.add('hidden'); }, 140); };
  card.addEventListener('mouseenter', () => { over = true; clearTimeout(timer); });
  card.addEventListener('mouseleave', () => { over = false; hide(); });
  cpy.onclick = async () => {
    try{ await navigator.clipboard.writeText(current); cpy.textContent = 'Copied'; }
    catch(e){ cpy.textContent = 'Select and copy'; }
  };
  document.addEventListener('mouseover', e => {
    const td = e.target && e.target.closest && e.target.closest('[data-full]');
    if(!td) return;
    // nothing to say if it all fits
    // a cell marked data-always has something to say even when nothing is cut
    if(!td.hasAttribute('data-always') && td.scrollWidth <= td.clientWidth + 1) return;
    clearTimeout(timer);
    current = td.dataset.full;
    txt.textContent = current;
    cpy.textContent = 'Copy';
    card.classList.remove('hidden');
    const r = td.getBoundingClientRect();
    const w = Math.min(460, Math.max(240, r.width * 2.4));
    card.style.width = w + 'px';
    card.style.left = Math.max(8, Math.min(window.innerWidth - w - 12, r.left - 6)) + 'px';
    card.style.top  = (r.bottom + window.scrollY + 3) + 'px';
  });
  document.addEventListener('mouseout', e => {
    const td = e.target && e.target.closest && e.target.closest('[data-full]');
    if(td) hide();
  });
}

function full(v){ const t = String(v || '').trim(); return t ? ` data-full="${esc(t)}"` : ''; }

function pencil(r){
  if(r.status !== 'Pending' && r.status !== 'Approved') return '';
  return `<button class="btn ghost sm ed" data-payedit="${esc(r.id)}" type="button"
    title="Correct this request" aria-label="Correct this request"><svg viewBox="0 0 24 24" width="13" height="13"
    fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg></button>`;
}

function statusPill2(s){
  return `<span class="pill ${s==='Paid'||s==='Approved'?'good':(s==='Rejected'?'bad':(s==='Withdrawn'?'mute':'warn'))}"><span class="dt"></span>${esc(s)}</span>`;
}
function modeLabel(id){ return (MODES.find(m=>m.id===id)||{}).label || id; }
/* The same four, said in one word. 'Card (for portals)' is a whole column's
 * width of its own, and on a table that has to fit sixteen columns the
 * parenthesis is the first thing that has to go. The long name is still on the
 * form, where there is room to explain. */
const MODESHORT = {card:'Card', transfer:'Transfer', link:'Link', cash:'Cash'};
function modeShort(id){ return MODESHORT[id] || modeLabel(id); }

/* The rows the export panel is offering: decided, not withdrawn, inside the
 * dates if any are set, and matching whatever is in the search box — because
 * the panel opened from a table that was already filtered, and exporting
 * something you cannot see would be a surprise. */
function exportRows(){
  const e = state.exp || {};
  const find = (state.paySearch || '').trim().toLowerCase();
  return (reqs() || [])
    .filter(r => r.status !== 'Pending' && r.status !== 'Withdrawn')
    .filter(r => !e.from || String(r.at || '').slice(0, 10) >= e.from)
    .filter(r => !e.to   || String(r.at || '').slice(0, 10) <= e.to)
    .filter(r => !find || ((r.order||'') + ' ' + (r.client||'')).toLowerCase().includes(find));
}
const exportPicked = () => exportRows().filter(r => !(state.exp && state.exp.off || {})[r.id]);

function vExport(){
  const e = state.exp;
  if(!e || !e.open) return '';
  const rows = exportRows(), picked = exportPicked();
  return `
  <div class="docpop" id="expPop">
    <div class="docbox" role="dialog" aria-modal="true" aria-label="Export to CSV" style="height:auto;max-height:86vh">
      <header>
        <b>Export to CSV</b>
        <button class="btn ghost sm" id="expShut" type="button" aria-label="Close">&times;</button>
      </header>
      <div class="docbody" style="display:block;padding:16px;background:var(--panel);overflow:auto">
        <div class="expdates">
          <label>From <input type="date" id="expFrom" value="${esc(e.from||'')}"></label>
          <label>To <input type="date" id="expTo" value="${esc(e.to||'')}"></label>
          ${(e.from||e.to)?'<button class="btn ghost sm" id="expClear" type="button">Any date</button>':''}
          <span class="hint" style="margin-left:auto">${state.paySearch
            ? 'matching &ldquo;' + esc(state.paySearch) + '&rdquo;' : 'every decided request'}</span>
        </div>
        ${rows.length ? `
        <div class="exphead">
          <label class="pfchk"><input type="checkbox" id="expAll"${picked.length===rows.length?' checked':''}><span>${
            picked.length} of ${rows.length} selected</span></label>
        </div>
        <div class="tw"><table class="paytab"><colgroup><col style="width:7%"><col style="width:15%"><col style="width:15%"><col style="width:18%"><col style="width:45%"></colgroup>
          <thead><tr><th></th><th>Date</th><th class="r">Amount</th><th>Order no.</th><th>Client</th></tr></thead>
          <tbody>${rows.map(r => `<tr>
            <td class="c"><input type="checkbox" class="rtick" data-exprow="${esc(r.id)}"${
              (e.off||{})[r.id] ? '' : ' checked'}></td>
            <td class="n nw">${esc(r.date)}</td>
            <td class="n r nw">${payAmt(r)}</td>
            <td class="n nw">${esc(r.order||'—')}</td>
            <td class="cell"${full(r.client)}>${esc(r.client||'—')}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="cap" style="padding:18px 2px">Nothing falls in that range.</p>'}
      </div>
      <div class="expfoot">
        <button class="btn" id="expGo" type="button"${picked.length?'':' disabled'}>Download ${
          picked.length} row${picked.length===1?'':'s'}</button>
        <button class="btn ghost" id="expCancel" type="button">Never mind</button>
      </div>
    </div>
  </div>`;
}

function exportPayments(){
  const rows = exportPicked();
  if(!rows.length) return;
  const cell = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const acct = id => (ACCOUNTS.find(a => a.id === id) || {}).label || '';
  const lines = [['Order No','Amount','Client','Purpose','Vendor','Paid through'].join(',')]
    .concat(rows.map(r => [r.order || '', (r.ccy || 'AED') + ' ' + r.amount.toFixed(2),
      r.client || '', r.purpose || '', r.payee || '', acct(r.account)].map(cell).join(',')));
  /* A byte-order mark, because Excel opens a plain UTF-8 CSV as Latin-1 and
   * turns every accented client name into mojibake. */
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const e = state.exp || {};
  a.download = 'CorpLex payments ' +
    (e.from || e.to ? (e.from || 'start') + ' to ' + (e.to || HDATE()) : HDATE()) + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function vPayEdit(){
  const r = (reqs() || []).find(x => x.id === state.payEdit);
  if(!r) return '';
  const e = state.payEditForm || {};
  const v = (k, d) => e[k] !== undefined ? e[k] : d;
  return `
  <div class="docpop" id="edPop">
    <div class="docbox" role="dialog" aria-modal="true" aria-label="Correct this request" style="height:auto;max-height:90vh;width:min(620px,100%)">
      <header>
        <b>Correcting ${esc(reqName(r))}</b>
        <button class="btn ghost sm" id="edShut" type="button" aria-label="Close">&times;</button>
      </header>
      <div class="docbody" style="display:block;padding:16px;background:var(--panel);overflow:auto">
        ${r.status === 'Approved' ? `<div class="upmsg warn" style="margin:0 0 14px">
          <b>This one has already been approved.</b> Correcting it now is allowed, and the
          request will say so permanently &mdash; the row will read <i>corrected after approval</i>
          with your name on it.</div>` : ''}
        <div class="edform">
          <label><span>Order number</span><input id="edOrder" value="${esc(v('order', r.order))}"></label>
          <label><span>Amount</span>
            <div class="amtrow">
              <select id="edCcy">${['AED','EUR','USD'].map(c=>
                `<option value="${c}"${v('ccy', r.ccy)===c?' selected':''}>${c}</option>`).join('')}</select>
              <input id="edAmount" class="num" type="number" step="0.01" min="0" value="${esc(String(v('amount', r.amount)))}">
            </div></label>
          <label class="wide"><span>Client</span><input id="edClient" value="${esc(v('client', r.client))}"></label>
          <label class="wide"><span>Purpose</span><input id="edPurpose" value="${esc(v('purpose', r.purpose))}"></label>
          <label class="wide"><span>Vendor</span><input id="edPayee" value="${esc(v('payee', r.payee))}"></label>
          <label><span>Mode</span><select id="edMode">${MODES.map(m=>
            `<option value="${m.id}"${v('mode', r.mode)===m.id?' selected':''}>${esc(m.label)}</option>`).join('')}</select></label>
          <label class="wide"><span>Additional information</span><input id="edExtra" value="${esc(v('extra', r.note))}"></label>
        </div>
        ${state.payEditErr ? `<div class="pqerr" style="margin-top:12px"><b>Not saved.</b><br>${esc(state.payEditErr)}</div>` : ''}
        <div class="drow" style="margin-top:16px">
          <button class="btn" id="edSave" type="button">Save the correction</button>
          <button class="btn ghost" id="edCancel" type="button">Leave it as it is</button>
        </div>
      </div>
    </div>
  </div>`;
}

function vWaPop(){
  if(!state.waMsg) return '';
  return `
  <div class="docpop" id="waPop">
    <div class="docbox" role="dialog" aria-modal="true" aria-label="Message for Miraziz" style="height:auto;max-height:86vh">
      <header>
        <b>${state.waTitle ? esc(state.waTitle)
            : authoriserWa() ? 'For ' + esc(firstName(payAuthoriser()))
            : 'For the payments group'}</b>
        <button class="btn ghost sm" id="waCopy" type="button">Copy</button>
        <a class="btn sm" id="waGo" href="https://wa.me/${authoriserWa()}?text=${encodeURIComponent(state.waMsg)}"
           target="_blank" rel="noopener">${authoriserWa()
             ? 'Open the chat with ' + esc(firstName(payAuthoriser())) : 'Open WhatsApp'}</a>
        <button class="btn ghost sm" id="waShut" type="button" aria-label="Close">&times;</button>
      </header>
      <div class="docbody" style="display:block;padding:16px;background:var(--panel)">
        <pre class="wamsg">${esc(state.waMsg)}</pre>
        <p class="cap" style="padding:12px 2px 0">${authoriserWa()
          ? 'This opens the chat with ' + esc(firstName(payAuthoriser())) + ' on ' + esc(phoneOf(payAuthoriser())) + ' with the message ready. Pressing send stays yours.'
          : 'No work number is on file for the owner, so this opens the share sheet instead. Add one on their profile and it will go straight to the chat.'}</p>
      </div>
    </div>
  </div>`;
}

function vDocPop(){
  const d = state.doc; if(!d) return '';
  const img = /\.(png|jpe?g|webp|heic|gif)$/i.test(d.name || '');
  return `
  <div class="docpop" id="docPop">
    <div class="docbox" role="dialog" aria-modal="true" aria-label="${esc(d.name)}">
      <header>
        <b>${esc(d.name)}</b>
        <a class="btn ghost sm" href="${esc(d.url)}" download="${esc(d.name)}" target="_blank" rel="noopener">Download</a>
        <button class="btn ghost sm" id="docShut" type="button" aria-label="Close">&times;</button>
      </header>
      <div class="docbody">${img
        ? `<img src="${esc(d.url)}" alt="${esc(d.name)}">`
        : `<iframe src="${esc(d.url)}" title="${esc(d.name)}"></iframe>`}</div>
    </div>
  </div>`;
}

/* The two tabs of the payment page. Only accounts sees the second one, so for
 * everybody else there is nothing to draw and the bar does not appear. */
function payBar(){
  if(!canUpload(state.user)) return '';
  const tabs = [['payment','Request for payment'], ['payapprove','Approve payments']];
  const waiting = reqs().filter(r=>r.status==='Pending').length;
  return `<div class="subbar"><div class="subtabs">${tabs.map(([id,label])=>
    `<button data-paytab="${id}" aria-current="${state.tab===id}" type="button">${esc(label)}${
      id==='payapprove' && waiting ? ` <i class="cnt">${waiting}</i>` : ''}</button>`).join('')}</div></div>`;
}

function vPayApprove(){
  const modeLabel = id => (MODES.find(m=>m.id===id)||{}).label || id;
  const queue = reqs().filter(r=>r.status==='Pending');
  const all   = reqs().filter(r=>r.status!=='Pending' && r.status!=='Withdrawn');
  /* Order number and client, which are the two things anybody remembers about
   * a payment. Not vendor or purpose: searching those turns up eleven results
   * and the point of a search box is to turn up one. */
  const find  = (state.paySearch || '').trim().toLowerCase();
  const done  = !find ? all : all.filter(r =>
    String(r.order || '').toLowerCase().includes(find) ||
    String(r.client || '').toLowerCase().includes(find));

  /* Waiting on Miraziz: initiated, and out of the Mashreq account. That pair
   * is exactly what 'he has to authorise it in the banking portal' looks like
   * in this table, which is why it can be gathered without anybody tagging
   * anything. */
  const forMiraziz = all.filter(r =>
    r.status === 'Approved' && r.payStatus === 'Initiated' && r.account === 'mashreq');
  const mirazizMsg = () => ['Hi Miraziz,', 'Kindly approve the following payments:', '']
    .concat(forMiraziz.map((r, i) =>
      `${i + 1}. ${r.ccy || 'AED'} ${money(r.amount, 2)} - ${r.order || '(no order number)'} - ${r.client || '(no client)'} - ${r.purpose}`))
    .join('\n');
  window.__mirazizMsg = forMiraziz.length ? mirazizMsg() : '';

  /* The reconciliation half of a decided row: paid or not, out of which
   * account, and Avin's own three ticks. Approving and paying are days apart —
   * 'payments are approved, but not paid yet' — so these are recorded when
   * they happen rather than guessed at the moment of the decision. */
  const recon = r => {
    if(r.status !== 'Approved')
      return `<td${full(r.status === 'Rejected' && r.why ? 'Turned down: ' + r.why : r.status)}>${
        statusPill2(r.status)}</td><td></td><td></td><td></td><td></td>`;
    const busy = false;   // nothing is disabled while it saves — see recon()
    // A bare box under a named column, the way it is on the sheet Avin keeps.
    const tick = k => `<td class="c"><input type="checkbox" class="rtick"
      data-recon="${esc(r.id)}" data-field="${k}"${r[k]?' checked':''}${busy?' disabled':''}></td>`;
    return `
      <td><select class="acsel st${esc((r.payStatus||'Unpaid').toLowerCase())}"
        data-paystat="${esc(r.id)}"${busy?' disabled':''}>${PAYSTATUS.map(st=>
        `<option value="${esc(st)}"${(r.payStatus||'Unpaid')===st?' selected':''}>${esc(st)}</option>`).join('')}
      </select></td>
      <td><select class="acsel" data-acct="${esc(r.id)}"${busy?' disabled':''}>
        <option value=""${r.account?'':' selected'}>&mdash;</option>
        ${OFFERED().concat(ACCOUNTS.filter(a=>a.retired && a.id===r.account)).map(a=>
          `<option value="${a.id}"${r.account===a.id?' selected':''}>${esc(a.label)}</option>`).join('')}
      </select></td>
      ${tick('books')}${tick('bigin')}${tick('receipt')}`;
  };

  const row = (r, withRecon) => {
    return `<tr${state.approve.ref===r.ref?' style="background:var(--accentSoft)"':''}>
      <td class="n nw"${full(r.date)}>${esc(payDate(r.date))}</td>
      <td${full(r.by)}>${esc(firstName(r.by))}</td>
      <td class="n nw"${full(r.order)}>${r.order
        ? `<button type="button" class="ordbtn" data-ordmsg="${esc(r.id)}"
             title="Copy the payment details">${esc(r.order)}</button>`
        : '<span style="color:var(--ink3)">—</span>'}</td>
      <td class="n r nw"${full(payFull(r))}>${payAmt(r)}</td>
      <td class="cell"${full(r.client)}>${esc(r.client||'—')}</td>
      <td class="cell"${full(r.purpose)}>${esc(r.purpose)}</td>
      <td${full(modeShort(r.mode))}>${esc(modeShort(r.mode))}</td>
      <td class="cell"${full(r.payee)}>${esc(r.payee||'—')}</td>
      <td class="c">${r.files.length ? r.files.map(f=>f.url
            ? `<button type="button" class="docico" data-popdoc="${esc(f.url)}" data-name="${esc(f.name)}" title="${esc(f.name)}" aria-label="Open ${esc(f.name)}">${DOCICO}</button>`
            : `<span class="docico off" title="${esc(f.name)}">${DOCICO}</span>`).join('')
          : '<span style="color:var(--ink3)">—</span>'}</td>
      <td class="cell"${full(r.note)}>${r.note ? esc(r.note) : '<span style="color:var(--ink3)">—</span>'}</td>
      ${withRecon ? recon(r) : ''}
      <td class="act">${r.status==='Pending'
        ? `<div class="actpair">
             <button class="btn sm" data-approve="${esc(r.ref)}" type="button">Approve</button>
             <button class="btn ghost sm x" data-reject="${esc(r.id)}" type="button" title="Turn it down">&times;</button>
             ${pencil(r)}
           </div>`
        : pencil(r)}</td>
    </tr>${state.reject===r.id?`<tr><td colspan="11" style="background:var(--badBg)">
      <div class="rjbox">
        <label for="rjWhy">Why is ${esc(reqName(r))} being turned down? ${esc(r.by)} will read this.</label>
        <input id="rjWhy" placeholder="The client has not settled the invoice this sits against">
        <div class="drow" style="margin-top:10px">
          <button class="btn" id="rjGo" type="button">Turn it down</button>
          <button class="btn ghost" data-reject="${esc(r.id)}" type="button">Never mind</button>
          ${state.rjErr?`<span style="color:var(--bad);font-size:12.5px">${esc(state.rjErr)}</span>`:''}
        </div>
      </div></td></tr>`:''}`;
  };

  const cols = `<th>Date</th><th>By</th><th>Order no.</th><th class="r">Amount</th>
      <th>Client</th><th>Purpose</th><th>Mode</th><th>Vendor</th>
      <th title="Document">Doc</th><th>Additional information</th>`;

  /* Percentages, with table-layout:fixed. A table sized by its content has a
   * minimum width it will not go below, and sixteen columns of it came to
   * 1,610px — which is why this scrolled sideways on a laptop AND on a 1920
   * monitor, where the browser window is never the whole screen. Percentages
   * have no minimum: the columns give up width in proportion and the table is
   * exactly as wide as the space it is in, whatever that is.
   *
   * The share each one gets is roughly what it needs: a date and an amount are
   * a known size, a purpose and a vendor are not. */
  /* Summing to a little under a hundred. At exactly 100 the browser still
   * finds a couple of dozen pixels of slop and shows a scrollbar over blank
   * space, which is the one thing this whole change is meant to remove. */
  /* One set of shares for both payment tables:
   *   date, by, order, amount, client, purpose, mode, vendor, document, note,
   *   then status, paid through, Bk, Bg, Rc and the pencil. */
  /* These sum to a hundred, and the 0.99 below is the only slack. The old
   * set summed to a hundred and eight, which the browser quietly scaled back
   * to fit — so the numbers said one thing and the screen showed another, and
   * the tick columns ended up a pixel narrower than the two letters over
   * them. A share here is now the share the column actually gets. */
  /* These summed to 98.68, not 100 — a percent and a third of the table
   * belonging to nothing, which at 1920 is thirty-seven pixels of white space
   * on a row where the client's name is cut. It goes to the four columns that
   * hold sentences, most of it to the client. */
  const SHARES = [5.10, 5.20, 5.75, 6.68, 13.20, 9.90, 5.66, 8.10, 3.45, 8.43,
                  8.40, 8.35, 2.69, 2.69, 2.69, 3.71];
  const colgroup = ws => `<colgroup>${ws.map(w =>
    `<col style="width:${(w * 0.99).toFixed(2)}%">`).join('')}</colgroup>`;
  /* The two tables sit one above the other, so their columns line up: the
   * first ten are the same shares in both, and the queue's action column is
   * exactly as wide as the six reconciliation columns it sits above. Two
   * tables with different column stops read as two tables; the same stops
   * read as one sheet, which is what Avin is after. */
  const wide   = colgroup(SHARES.slice(0, 10)
    .concat(SHARES.slice(10).reduce((a, b) => a + b, 0)));
  // Books, Bigin and Receipt are one word wide, and one word is wider than a
  // checkbox: at 2.8% the RECEIPT heading hung 23px past the table and put the
  // scrollbar back on its own.
  const widest = colgroup(SHARES);

  const head  = `${wide}<thead><tr>${cols}<th class="act"></th></tr></thead>`;
  const head2 = `${widest}<thead><tr>${cols}
      <th>Status</th><th>Paid through</th>
      <th class="c" title="Books">Bk</th><th class="c" title="Bigin">Bg</th>
      <th class="c" title="Receipt">Rc</th><th class="act"></th></tr></thead>`;

  return `
  ${vDocPop()}${vWaPop()}${vPayEdit()}${vExport()}
  ${payBar()}
  ${state.approve.ref ? vApprovePanel() : ''}
  <section class="panel">
    <header><h3>Requests waiting on you</h3>
      <span class="hint">${queue.length ? `${queue.length} pending &middot; ${sumBy(queue)}` : 'nothing waiting'}</span></header>
    <div class="tw paytab"><table>${head}
      <tbody>${queue.length ? queue.map(r=>row(r,false)).join('')
        : '<tr><td colspan="11" style="padding:26px;text-align:center;color:var(--ink3)">Nothing is waiting on you.</td></tr>'}</tbody>
    </table></div>
    <p class="cap"><b>&times;</b> turns one down &mdash; it asks for a reason, and the person who raised it reads it on their own screen.</p>
  </section>

  <section class="panel">
    <header><h3>Already decided</h3>
      <span class="hint" style="margin-left:0">${find
        ? `${done.length} of ${all.length}`
        : (all.length ? `${all.length} request${all.length===1?'':'s'}` : 'none yet')}</span>
      <div class="dechead">
        ${forMiraziz.length ? `<button class="btn ghost sm" id="payWa" type="button">
          Ask Miraziz to approve ${forMiraziz.length}</button>` : ''}
        <button class="btn ghost sm" id="payCsv" type="button"${all.length?'':' disabled'}>Export CSV</button>
        <input id="paySearch" class="paysearch" type="search" placeholder="Order number or client"
          value="${esc(state.paySearch || '')}" aria-label="Search the decided payments">
      </div></header>
    <div class="tw paytab recon"><table>${head2}
      <tbody>${done.length ? done.map(r=>row(r,true)).join('')
        : `<tr><td colspan="16" style="padding:26px;text-align:center;color:var(--ink3)">${
            find ? 'Nothing matches &ldquo;' + esc(state.paySearch) + '&rdquo;.' : 'Nothing has been decided yet.'}</td></tr>`}</tbody>
    </table></div>
    <p class="cap"><b>Bk</b> Books &middot; <b>Bg</b> Bigin &middot; <b>Rc</b> Receipt.
      Amounts are dirhams unless the row says otherwise, and a date without a year is this year.
      <b>Click an order number</b> to copy that payment's details. The icon under <b>Doc</b> opens the document.
      A cell that is cut off says the rest when you hover it, with a Copy beside it.
      The pencil at the end corrects a request.</p>
  </section>`;
}

function vPayment(){
  const u = state.user, approver = canUpload(u);   // payment approvals are Avin's alone
  const mine = reqs().filter(r=>r.by===u);
  const queue = reqs().filter(r=>r.status==='Pending');
  const clients = Object.keys(DATA.clients).sort();
  // statusPill2 and modeLabel are declared once, beside vPayApprove

  const raised = state.pqDone ? `<div class="pqok">
    <b>${esc(state.pqDone.order || 'Your request')} raised</b> &mdash; it is at the top of the list, with accounts.
    ${state.pqDone.notAttached && state.pqDone.notAttached.length
      ? `<br><span class="bad">${esc(state.pqDone.notAttached.join(', '))} did not go up &mdash; open the request and attach it again.</span>`
      : ''}</div>` : '';

  const form = `
  <section class="panel payform">
    <header><h3>Raise a payment request</h3></header>
    <div class="pad formbody">
      ${raised}
      <div class="field"><label>Name of the employee</label>
        <input value="${esc(u)}" disabled style="opacity:.7"></div>
      <div class="frow amtfrow">
        <div class="field"><label for="pqOrder">Order number <i>*</i></label><input id="pqOrder" placeholder="PR2431" value="${esc(KEPT().order)}"></div>
        <div class="field"><label for="pqAmount">Amount <i>*</i></label>
          <div class="amtrow">
            <input id="pqAmount" class="num" type="number" placeholder="0.00" step="0.01" min="0" value="${esc(KEPT().amount ? String(KEPT().amount) : '')}">
            <select id="pqCcy" aria-label="Currency">${['AED','EUR','USD'].map(c=>
              `<option value="${c}"${(KEPT().ccy||'AED')===c?' selected':''}>${c}</option>`).join('')}</select>
          </div></div>
      </div>
      <div class="field"><label for="pqClient">Client name <i>*</i></label>
        <div class="combo">
          <input id="pqClient" autocomplete="off" spellcheck="false" placeholder="Start typing — two letters is enough" value="${esc(KEPT().client)}">
          <div id="pqList" class="combolist hidden"></div>
        </div>
        <div id="pqBadge" class="badge"></div></div>
      <div class="field"><label for="pqPurpose">Purpose of payment <i>*</i></label><input id="pqPurpose" placeholder="Trade licence renewal, translator fee…" value="${esc(KEPT().purpose)}"></div>
      <div class="field"><label for="pqPayee">Vendor name <i>*</i></label><input id="pqPayee" placeholder="Who is being paid" value="${esc(KEPT().payee)}"></div>
      <div class="field"><label for="pqMode">Mode of payment <i>*</i></label>
        <select id="pqMode">${MODES.map(m=>`<option value="${m.id}"${KEPT().mode===m.id?' selected':''}>${esc(m.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="pqNote">Additional information (if any)</label><input id="pqNote" placeholder="Anything Avin should know" value="${esc(KEPT().extra)}"></div>
      <input type="file" id="pqFile" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" hidden>
      <button class="filebtn" id="pqPick" type="button" ${(state.pqFiles||[]).length>=5?'disabled':''}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        Add file <span>${(state.pqFiles||[]).length ? (state.pqFiles.length + ' of 5 chosen') : '5 files &middot; 10 MB each'}</span>
      </button>
      ${(state.pqFiles||[]).length ? `<div class="pqfiles">${state.pqFiles.map((f,i)=>`
        <div class="pqfile"><span>${esc(f.name)}</span><i>${Math.max(1,Math.round(f.size/1024))} KB</i>
          <button type="button" data-pqdrop="${i}" aria-label="Remove ${esc(f.name)}">&times;</button></div>`).join('')}</div>` : ''}
      ${state.pqErr ? `<div class="pqerr"><b>The request did not go through.</b><br>${esc(state.pqErr)}${
        state.pqCode ? `<br><i>${esc(state.pqCode)}</i>` : ''}</div>` : ''}
      <button class="btn wide" id="pqSubmit" type="button">Submit request</button>
    </div>
  </section>`;

  const queuePanel = '';

  const minePanel = `
  <section class="panel grow">
    <header><h3>My requests</h3><span class="hint">${mine.length ? mine.length + (mine.length===1?' request':' requests') : 'none yet'}</span></header>
    <div class="tw paytab"><table>
      <colgroup>${[5.8, 6.0, 7.0, 14.5, 13.5, 5.8, 9.0, 8.0, 12.4, 9.0, 9.0]
        .map(w => `<col style="width:${(w*0.97).toFixed(2)}%">`).join('')}</colgroup>
      <thead><tr><th>Date</th><th>Order #</th><th class="r">Amount</th><th>Client</th>
        <th>Purpose</th><th>Mode</th><th>Vendor</th><th title="Document">Doc</th>
        <th>Additional information</th><th>Status</th><th>Payment</th></tr></thead>
      <tbody>${mine.length?mine.map(r=>`<tr>
        <td class="n nw"${full(r.date)}>${esc(payDate(r.date))}</td>
        <td class="n nw"${full(r.order)}>${esc(r.order||'—')}</td>
        <td class="n r nw"${full(payFull(r))}>${payAmt(r)}</td>
        <td class="cell"${full(r.client)}>${esc(r.client||'—')}</td>
        <td class="cell"${full(r.purpose)}>${esc(r.purpose)}</td>
        <td${full(modeShort(r.mode))}>${esc(modeShort(r.mode))}</td>
        <td class="cell"${full(r.payee)}>${esc(r.payee||'—')}</td>
        <td>${r.files.map(f=>`<span class="docwrap">${f.url
              ? `<button type="button" class="doc" data-popdoc="${esc(f.url)}" data-name="${esc(f.name)}" title="${esc(f.name)}">${esc(f.name)}</button>`
              : `<span class="doc">${esc(f.name)}</span>`}${r.status==='Pending'
              ? `<button type="button" class="dropdoc" data-pqdoc="${esc(f.id)}" title="Remove ${esc(f.name)}">&times;</button>` : ''}</span>`).join('')
            }${(r.status==='Pending' || r.status==='Approved') && r.files.length < 5
              ? `<button type="button" class="adddoc" data-pqadd="${esc(r.id)}">${r.files.length?'+ another':'+ document'}</button>`
              : (r.files.length ? '' : '<span style="color:var(--ink3)">—</span>')}</td>
        <td class="cell"${full(r.note)}>${r.note ? esc(r.note) : '<span style="color:var(--ink3)">—</span>'}</td>
        <td class="cell"${full(r.status==='Rejected' && r.why ? 'Turned down: ' + r.why
            : r.remarks ? r.remarks
            : r.status==='Pending' ? 'With accounts'
            : r.status==='Withdrawn' ? 'You took this one back' : '')} data-always>${
          statusPill2(r.status)}</td>
        <td>${r.status==='Pending'
          ? `<button class="btn ghost sm" data-pqpull="${esc(r.id)}" type="button">Withdraw</button>`
          : (r.payStatus ? `<span class="pill ${r.payStatus==='Paid'?'good':(r.payStatus==='Initiated'?'warn':'mute')}">${esc(r.payStatus)}</span>`
                         : '<span style="color:var(--ink3)">—</span>')}</td></tr>`).join('')
        :'<tr><td colspan="11" style="padding:26px;text-align:center;color:var(--ink3)">You have not raised a payment request yet.</td></tr>'}</tbody></table></div>
    <p class="cap">Every request stays here with its status, so nothing depends on an email being spotted.
      Amounts are dirhams unless the row says otherwise. A cell that is cut off says the rest when you hover it.</p>
  </section>`;

  return `${vDocPop()}${payBar()}
  <input type="file" id="pqRowFile" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" hidden>
  <div class="payonew"><div class="payone">
    <div>${form}</div>
    <div>${minePanel}</div>
  </div></div>`;
}
/* What actually happened, said plainly. No invented email, because no email
 * leaves the portal yet — that is waiting on a sending address, and claiming
 * otherwise is how somebody stops checking the screen. */
/* Whatever is in the form right now, remembered.
 *
 * This screen redraws for reasons that have nothing to do with the person
 * typing into it: attaching a document redraws, removing one redraws, and a
 * decision taken by somebody else reloads the data and redraws. The form is
 * built from scratch each time, so every one of those was quietly emptying it.
 *
 * That is what was actually wrong with 'no request is going through'. Avin
 * filled the form in, attached a PDF — which redrew — and every field he had
 * typed went blank. Pressing Submit then failed on the first empty field, and
 * the message named a field he had definitely filled in, which reads as the
 * portal being broken rather than as the form having been wiped.
 *
 * So the form is read into state on every keystroke, and drawn back from it.
 * Nothing that redraws can take it away now, whatever caused the redraw. */
function pqGrab(){
  const v = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  if(document.getElementById('pqPurpose') === null) return;   // not on screen
  const f = state.pqForm || (state.pqForm = {});
  const put = (k, id) => { const x = v(id); if(x !== undefined) f[k] = x; };
  put('order','pqOrder'); put('amount','pqAmount'); put('client','pqClient');
  put('purpose','pqPurpose'); put('payee','pqPayee'); put('extra','pqNote');
  put('mode','pqMode'); put('ccy','pqCcy');
}

/* What was typed, so a redraw can put it back. */
function KEPT(){
  const f = state.pqForm || {};
  return {order:f.order||'', amount:f.amount||'', client:f.client||'',
          purpose:f.purpose||'', payee:f.payee||'', extra:f.extra||'',
          mode:f.mode||'', ccy:f.ccy||'AED'};
}

function vPaymentSent(){
  const d = state.pqDone; if(!d) return '';
  const mode = MODES.find(m => m.id === d.mode) || {label: d.mode, next: ''};
  return `
  <section class="panel">
    <header><h3>Request raised</h3><span class="hint">it is in the portal now</span></header>
    <div class="pad">
      <div class="strip" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="stat"><span class="k">${d.order ? 'Order number' : 'Raised'}</span>
          <span class="v" style="font-size:20px;font-family:'IBM Plex Sans',sans-serif">${esc(d.order || 'no order number')}</span>
          <span class="n">AED ${money(d.amount,2)} &middot; ${esc(mode.label)}</span></div>
        <div class="stat"><span class="k">Waiting on</span>
          <span class="v" style="font-size:17px;font-family:'IBM Plex Sans',sans-serif">Accounts</span>
          <span class="n">it shows in the approval queue straight away</span></div>
      </div>
      <div class="note" style="margin-top:16px;border-left-color:var(--good)"><b>Once it is approved.</b> ${esc(mode.next||'')}</div>
      ${d.notAttached && d.notAttached.length ? `<div class="note" style="margin-top:12px;border-left-color:var(--bad)">
        <b>The request was raised, but ${d.notAttached.length} document did not go up:</b>
        ${esc(d.notAttached.join(', '))}. Open the request below and attach it again.</div>` : ''}
      <p class="cap" style="padding-left:0">No email has been sent — the portal has no sending address yet, so
        this screen is where it lives. It stays in <b>My requests</b> below with whatever happens to it.</p>
      <button class="btn ghost" id="pqAnother" type="button" style="margin-top:6px">Raise another</button>
    </div>
  </section>`;
}

function pqBadge(){
  // nothing to say: the client is a label on this screen, not a lookup
  const b0 = document.getElementById('pqBadge'); if(b0) b0.innerHTML = '';
  return;
}
function pqBadgeOld(){
  const el = document.getElementById('pqBadge'), inp = document.getElementById('pqClient');
  if(!el || !inp) return;
  const v = inp.value.trim();
  if(v.length < 2){ el.innerHTML = '<span style="color:var(--ink3)">Type at least two letters to find the client.</span>'; return; }
  const exact = Object.keys(DATA.clients).find(c=>c.toLowerCase()===v.toLowerCase());
  el.innerHTML = exact ? clientBadge(exact)
    : '<span class="pill mute">Not matched yet</span> <span style="color:var(--ink3);font-size:12px">pick one from the list</span>';
}
function pqList(){
  const inp = document.getElementById('pqClient'), box = document.getElementById('pqList');
  if(!inp || !box) return;
  const v = inp.value.trim().toLowerCase();
  if(v.length < 2){ box.classList.add('hidden'); return; }
  const hits = Object.keys(DATA.clients).filter(c=>c.toLowerCase().includes(v)).slice(0,8);
  const typed = inp.value.trim();
  const exact = hits.some(c => c.toLowerCase() === v);
  // Whatever was typed is always offered, unless it is already on the list.
  const addNew = exact ? '' :
    `<button type="button" class="addnew" data-client="${esc(typed)}">
       <span>Use &ldquo;${esc(typed)}&rdquo;</span><i>not on the client list &mdash; add it as typed</i></button>`;
  box.innerHTML = hits.map(c=>`<button type="button" data-client="${esc(c)}"><span>${esc(c)}</span></button>`).join('') + addNew;
  box.classList.remove('hidden');
  box.querySelectorAll('[data-client]').forEach(b=>b.onmousedown=(ev)=>{
    ev.preventDefault(); inp.value = b.dataset.client; box.classList.add('hidden');
    pqGrab(); pqBadge();
  });
}
async function pqSubmit(){
  const btn = document.getElementById('pqSubmit');
  const need = (id, what) => {
    const v = (document.getElementById(id).value || '').trim();
    if(!v) throw new Error(what);
    return v;
  };
  let f;
  try{
    f = {
      order:   (document.getElementById('pqOrder').value || '').trim(),
      client:  (document.getElementById('pqClient').value || '').trim(),
      purpose: need('pqPurpose', 'Say what the payment is for.'),
      payee:   need('pqPayee', 'Say who is being paid.'),
      extra:   (document.getElementById('pqNote').value || '').trim(),
      mode:    document.getElementById('pqMode').value,
      ccy:     (document.getElementById('pqCcy') || {}).value || 'AED',
      amount:  parseFloat(document.getElementById('pqAmount').value) || 0
    };
    if(f.amount <= 0) throw new Error('Put in the amount.');
  }catch(e){
    state.pqErr = e.message; render(); return;
  }
  state.pqErr = '';
  if(btn){ btn.disabled = true; btn.textContent = 'Sending…'; }

  /* Held so a failure does not cost somebody their typing. The reload that
   * follows a failed call redraws this form, and redrawing it empty is how a
   * refusal came to look like nothing happening at all. */
  state.pqForm = f;

  const out = await window.__db.raisePayment(f, state.pqFiles || []);
  if(!out || out.error){
    // The code is the diagnostic bit — PGRST202 means the API has not picked
    // up the function yet, P0001 means the function itself said no — so it is
    // shown rather than left in the console for somebody who knows to look.
    state.pqErr = (out && out.error) || 'The request did not go through, and no reason came back.';
    state.pqCode = (out && out.code) || '';
    render();
    return;
  }

  state.pqForm = null;
  state.pqFiles = [];
  state.pqDone = {ref: out.ref, mode: f.mode, amount: f.amount, order: f.order,
                  client: f.client, notAttached: out.notAttached || []};
  render();
}

/* ---------------- admin ---------------- */
const TEMPLATE = [
  ['Sl No','in'],['Quarter','in'],['Client Type','in'],['Data Verified','in'],['Company Name','in'],['PR Number','in'],
  ['Salesperson','in'],['Project Manager','in'],['Invoice Date','in'],['Invoice Number','in'],['Invoice Amount (excl VAT)','in'],
  ['VAT','in'],['Invoice Total','calc'],['Payment Received','in'],['Payment On Time?','in'],['Balance','calc'],
  ['Payment Status','calc'],['COGS','in'],['POA.ae Expenses','in'],['Expected Expenses','in'],['Total Expenses','calc'],
  ['Credit Note Amount','in'],['Credit Note Date','in'],['Invoice Amount Net of Credit Note','calc'],
  ['Profit Before Partner Commission','calc'],['Partner Commission Applicable?','in'],['Partner Commission Rate','calc'],
  ['Partner Commission','calc'],['Net Sales','calc'],['Individual/Shared','in'],['Eligible Net Sales','calc'],
  ['Salesperson Department','calc'],['PM Department','calc'],['Forfeited Net Sales (Late Payment)','calc']
];
function vTeam(){
  const p = state.period, viewer = state.user;
  const showComm = canSeeTeamCommission(viewer);
  const roster = USERS.concat(FORMER.map(n=>({name:n, role:'former'}))).filter(u=>inScope(u.name, viewer));
  const people = roster.map(u=>{
    const e = aggOf(u.name,p) || {netTot:0,notColl:0,forf:0,newInv:0,exInv:0,pmInv:0,newCost:0,exCost:0,pmCost:0,comm:0,paid:0,bal:0,totElig:0};
    const rows = invRows(u.name,p);
    const mo = mgrOf(u.name,p);
    /* Totals from the view, for somebody whose invoice rows are not ours to
       read. A count of nought from no rows and a count of nought from no
       invoices are different facts, and only the first should fall back. */
    const ag = (((DATA.invAgg || {})[u.name] || {})[state.year] || {});
    const agg = p === 'FY'
      ? Object.values(ag).reduce((s, x) => ({count: s.count + x.count, out: s.out + x.out}), {count: 0, out: 0})
      : (ag[p] || null);
    const useAgg = !rows.length && agg;
    return {name:u.name, role:u.role, e, mo,
      count: useAgg ? agg.count : rows.length,
      inv:e.newInv+e.exInv+e.pmInv,
      cost:e.newCost+e.exCost+e.pmCost,
      out: useAgg ? agg.out : rows.reduce((s,r)=>s+(r[IC.bal]||0),0)};
  }).filter(x=>x.role!=='former' || x.e.netTot>0 || x.count>0).sort((a,b)=>b.e.netTot-a.e.netTot);

  const DD = deptData(viewer);
  const dn = deptNet(p, viewer);
  const tgt = DD.target ? (p==='FY' ? DD.target.year : DD.target.quarter) : 0;
  const totOut = people.reduce((s,x)=>s+x.out,0);
  const totUnq = people.reduce((s,x)=>s+x.e.notColl,0);
  const active = people.filter(x=>x.role!=='former' && x.e.netTot>0).length;

  return `
  <div class="strip">
    <div class="stat"><span class="k">${esc(DD.department)} net sales · ${p==='FY'?esc(state.year):p}</span><span class="v"><span class="cur">AED</span>${money(dn)}</span>
      <span class="n">${tgt?pct(dn/tgt,0)+' of the '+money(tgt)+(p==='FY'?' annual':' quarterly')+' target':'no target set for this scope'}</span></div>
    <div class="stat"><span class="k">People with sales</span><span class="v">${active}<span class="cur" style="margin-left:6px">of ${people.filter(x=>x.role!=='former').length}</span></span>
      <span class="n">${people.some(x=>x.role==='former')?'plus '+people.filter(x=>x.role==='former').length+' who have since left':PLABEL[p]}</span></div>
    <div class="stat"><span class="k">Not counted yet</span><span class="v" style="color:var(--warn)"><span class="cur">AED</span>${money(totUnq)}</span>
      <span class="n">net sales awaiting collection</span></div>
    <div class="stat"><span class="k">Outstanding invoices</span><span class="v" style="color:var(--bad)"><span class="cur">AED</span>${money(totOut)}</span>
      <span class="n">across the team</span></div>
  </div>

  <section class="panel">
    <header><h3>Every consultant, ${esc(PLABEL[p])}</h3>
      <span class="hint" style="margin-left:0">${esc(DD.department)} &middot; ${showComm?'commission visible — accounts manager / owner':'sales only — commission is not shown to department managers'}</span>${deptSeg(viewer)}</header>
    <div class="tw"><table class="teamtab">
      ${showComm
        ? colsOf([11, 9.1, 7.1, 8.1, 8.1, 7.2, 7.2, 7.2, 9.6, 8.9, 8, 8.5])
        : colsOf([15, 15, 9, 10, 10, 10, 10, 10, 11])}
      <thead><tr>
        <th>Consultant</th><th>Role</th><th class="r">Invoices</th><th class="r">Invoiced</th><th class="r">Costs</th>
        <th class="r">Net sales</th><th class="r">Eligible</th><th class="r">Not counted</th><th class="r">Outstanding</th>
        ${showComm?'<th class="r">Commission</th><th class="r">Paid</th><th class="r">Balance</th>':''}
      </tr></thead>
      <tbody>
        ${people.map(x=>`<tr${x.name===viewer?' style="background:var(--panel2);font-weight:500"':(x.role==='former'?' style="color:var(--ink3)"':'')}>
          <td>${nm(x.name)}</td>
          <td>${x.role==='staff'?'<span class="pill mute">Consultant</span>':(x.role==='former'?'<span class="pill mute" style="opacity:.75">Left the firm</span>':`<span class="pill" style="background:var(--accentSoft);color:var(--accent2)">${esc(ROLELABEL[x.role])}</span>`)}</td>
          <td class="n r">${x.count}</td>
          <td class="n r">${money(x.inv)}</td>
          <td class="n r">${money(x.cost)}</td>
          <td class="n r">${money(x.e.netTot)}</td>
          <td class="n r"${x.e.totElig>0?' style="color:var(--good)"':''}>${x.e.totElig>0?money(x.e.totElig):'—'}</td>
          <td class="n r"${x.e.notColl>0?' style="color:var(--warn)"':''}>${x.e.notColl>0?money(x.e.notColl):'—'}</td>
          <td class="n r"${x.out>0?' style="color:var(--bad)"':''}>${x.out>0?money(x.out):'—'}</td>
          ${showComm?`<td class="n r">${money(x.e.comm + (x.mo?x.mo.earned:0),2)}${x.mo?' <span class="pill mute">incl. override</span>':''}</td>
                      <td class="n r">${money(x.e.paid + (x.mo?x.mo.paid:0),2)}</td>
                      <td class="n r">${money(x.e.bal + (x.mo?x.mo.bal:0),2)}</td>`:''}
        </tr>`).join('')}
        <tr class="tot"><td>Team</td><td></td>
          <td class="n r">${people.reduce((s,x)=>s+x.count,0)}</td>
          <td class="n r">${money(people.reduce((s,x)=>s+x.inv,0))}</td>
          <td class="n r">${money(people.reduce((s,x)=>s+x.cost,0))}</td>
          <td class="n r">${money(people.reduce((s,x)=>s+x.e.netTot,0))}</td>
          <td class="n r">${money(people.reduce((s,x)=>s+x.e.totElig,0))}</td>
          <td class="n r">${money(totUnq)}</td>
          <td class="n r">${money(totOut)}</td>
          ${showComm?`<td class="n r">${money(people.reduce((s,x)=>s+x.e.comm+(x.mo?x.mo.earned:0),0),2)}</td>
                      <td class="n r">${money(people.reduce((s,x)=>s+x.e.paid+(x.mo?x.mo.paid:0),0),2)}</td>
                      <td class="n r">${money(people.reduce((s,x)=>s+x.e.bal+(x.mo?x.mo.bal:0),0),2)}</td>`:''}
        </tr>
      </tbody></table></div>
    <p class="cap">Rows greyed as <b>Left the firm</b> are people who have gone; their ${esc(state.year)} sales stay in the department's figures because the department earned them, but they have no login. A shared invoice is credited to both the consultant who sold it and the project manager, so the team row adds up to more than the department's AED ${money(dn)} of net sales. <b>Eligible</b> and <b>Not counted</b> are the two halves of net sales: eligible is settled and paid on time and is what the commission band and every rate are worked out on; not counted is the rest, either still outstanding or collected too late to earn on. ${showComm?'':'<b>Commission is deliberately absent from this page.</b> It is visible only to the person it belongs to, to the accounts manager and to the owner.'}</p>
  </section>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Net sales</h3><span class="hint">${esc(PLABEL[p])}</span></header>
      <div class="pad">${hbars(people.map(x=>({label:NM(x.name), value:x.e.netTot, me:x.name===viewer, color:x.name===viewer?'var(--c1)':'color-mix(in srgb, var(--c1) 38%, var(--panel))'})),{rank:true})}</div>
    </section>
    <section class="panel">
      <header><h3>Money still to collect</h3><span class="hint">who needs chasing</span></header>
      <div class="pad">${hbars(people.filter(x=>x.out>0).sort((a,b)=>b.out-a.out).map(x=>({label:NM(x.name), value:x.out, color:'var(--bad)'})),{})}
      ${people.every(x=>x.out<=0)?'<p style="margin:0;color:var(--ink3)">Nothing outstanding in this period.</p>':''}
      <p class="note" style="margin-top:14px">Chasing these converts net sales that are already earned but not yet counted &mdash; the fastest way to move the department towards target without selling anything new.</p></div>
    </section>
  </div>`;
}

const CH_OVERRIDE = {
  'Umidakhon Gapurova':'bpoa', 'Abdullokh Fozilov':'bpoa',
  'Janine Lagumbay':'bcp', 'Kazimzhanov Mirabbosbek':'edlex'
};
function channelOf(r){
  if(r.dummy) return 'eddummy';
  if(r.name==='Miraziz Makhamatzhanov') return r.company==='POA' ? 'bpoa' : 'bcp';
  if(CH_OVERRIDE[r.name]) return CH_OVERRIDE[r.name];
  if(['CorpLex','CorpLex - POA'].includes(r.visa)) return 'edcp';
  if(r.visa==='POA') return 'edpoa';
  return r.company==='Lex' ? 'blex' : (r.company==='POA' ? 'bpoa' : 'bcp');
}
const vatOf = r => (DATA.payroll.vatOn||[]).includes(r.name) ? Math.round(r.net*0.05*100)/100 : 0;

/* The month after the last one there is. Runs are keyed '2026-09', and this
   is the only place that arithmetic happens. */
function nextRunKey(){
  const keys = (DATA.payroll.runs || []).map(r => r.key).sort();
  const last = keys[keys.length - 1];
  if(!last) return '';
  const [y, m] = last.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
/* A month can be started once the one before it is closed. Anything else is
   two open months at a time, which is how a figure gets typed into the wrong
   one. The reason is returned rather than a bare false, because a button that
   is simply absent teaches nobody anything. */
function nextRunWhy(){
  const runs = (DATA.payroll.runs || []);
  if(!runs.length) return 'There is no payroll in the portal yet.';
  const open = runs.filter(r => r.status !== 'closed')
                   .sort((a, b) => a.key < b.key ? -1 : 1);
  if(open.length) return `${MKEY(open[0].key)} is still ${open[0].status}. Close it and the next month can be started.`;
  return '';
}
/* What a month pays, against what the records now say it should. A revision
   letter issued after the month was generated is the usual cause; a salary
   recorded for somebody who had none is the other. */
const staleOf = key => ((DATA.payroll.runs || []).find(r => r.key === key) || {}).stale || [];
function staleNote(key){
  const run = (DATA.payroll.runs || []).find(r => r.key === key);
  if(!run || run.status === 'closed') return '';
  const st = run.stale || [];
  if(!st.length) return '';
  const one = st.length === 1;
  return `<div class="nudge loud">
    <span class="ndot"></span>
    <div><b>${esc(MKEY(key))} no longer matches the records \u2014 ${st.length} ${one ? 'line' : 'lines'}</b>
      <span>${st.slice(0, 3).map(x => `${esc(NM(x.name))}${x.company ? ' (' + esc(x.company) + ')' : ''}
        ${x.missing ? 'is not on this month, and should be on <b>' + money(x.now, 2) + '</b>'
                     : 'pays ' + money(x.was, 2) + ' and should pay <b>' + money(x.now, 2) + '</b>'}`)
        .join('; ')}${st.length > 3 ? `; and ${st.length - 3} more` : ''}.
        A revision letter has gone out, or somebody's pay has been set, since this month was built.
        <b>Refresh from the records</b> rewrites ${one ? 'it' : 'them'} and this notice goes away by itself.</span></div>
    ${canUpload(state.user) && run.status === 'draft'
      ? '<button class="btn" id="payGenTop" type="button">Refresh from the records</button>' : ''}
  </div>`;
}
function runSeg(){
  const runs = (DATA.payroll.runs || []);
  if(!runs.length) return '';
  const here = state.payRun || (runs[0] && runs[0].key);
  const nk = nextRunKey();
  return `<div class="seg" id="runSeg" style="margin-left:18px">
    ${runs.slice().sort((a,b)=>a.key<b.key?-1:1).map(r=>
      `<button data-run="${esc(r.key)}" aria-pressed="${here===r.key}" type="button">${
        esc(MKEY(r.key))} &middot; ${esc(r.status)}</button>`).join('')}
    ${nk && canUpload(state.user) && !nextRunWhy()
      ? `<button id="payNext" type="button" title="Build the ${esc(MKEY(nk))} lines from what the portal holds today">+ ${esc(MKEY(nk))}</button>`
      : ''}
  </div>`;
}
/* vPayrollNext lived here: a September screen driven by state.sepStage,
   offering to upload a payroll spreadsheet. Payroll moved into the database
   and the screen was never wired to anything — nothing called it, and the one
   button that pointed at it set a key no run has. Removed rather than left
   for somebody to find and believe. */

// The newest run's status, read from the database every time rather than
// from a copy kept on the page. See the note in mkweb.mjs.
const PAYST = () => (DATA.payroll && DATA.payroll.status) || 'draft';

function vPayroll(){
  const runs = DATA.payroll.runs || [];
  if(runs.length){
    if(!state.payRun || !runs.some(r=>r.key===state.payRun))
      state.payRun = (runs.find(r=>r.status==='draft') || runs[0]).key;
    const here = runs.find(r=>r.key===state.payRun);
    if(here && here.status === 'draft' && canAdmin(state.user)) return vPayrollDraft(here);
  }
  const P = DATA.payroll, co = state.payCompany, me = state.user;
  const isPrep = canUpload(me), isApprover = roleOf(me)==='owner';
  const staff = P.rows.filter(r=>!r.dummy);
  const coRows = co==='all' ? staff : staff.filter(r=>r.company===co);
  let rows = coRows.slice();
  const chRows = id => P.rows.filter(r=>channelOf(r)===id);
  const applyPayFilters = () => {
    const f = state.payFilter;
    if(f.ch!=='all') rows = rows.filter(r=>channelOf(r)===f.ch);
    if(f.visa!=='all') rows = rows.filter(r=>r.visa===f.visa);
    if(f.text){ const t=f.text.toLowerCase();
      rows = rows.filter(r=>[r.name,r.id,r.title].some(v=>(v||'').toLowerCase().includes(t))); }
    const s = state.paySort;
    if(s.key){ const k = s.key;
      rows = rows.slice().sort((a,b)=>{ const av=a[k], bv=b[k];
        const c = (typeof av==='number' && typeof bv==='number') ? av-bv : String(av||'').localeCompare(String(bv||''));
        return c*s.dir; }); }
  };
  const INT = state.payInternal && isPrep;
  const VISAS = ['CorpLex','CorpLex - POA','POA','Lex','Other company'];
  const PF = state.payFilter, PS = state.paySort;
  const REGCOLS = () => (INT
    ? [14,5,9,8,4,6.5,5.5,5.5,6,5,7,6,5.5,6,7]
    /* Salary, Gross and Net carry the bold company totals, which are wider
     * than anything in the rows above them; the four optional columns beside
     * them hold four figures at most. */
    : [14,7,4.5,9,6.5,6.5,6.5,6.5,9,7,6.5,7,9.5]);
  const COLGROUP = () => `<colgroup>${REGCOLS().map(w=>`<col style="width:${w}%">`).join('')}</colgroup>`;
  const PSORT = {name:'name', id:'id', company:'company', visa:'visa', paidBy:'paidBy', days:'days',
    salary:'salary', claims:'claims', air:'air', comm:'comm', gross:'gross', adv:'adv', mob:'mob', ded:'ded', net:'net'};
  const S = k => rows.reduce((s,r)=>s+(r[k]||0),0);
  const SC = k => coRows.reduce((s,r)=>s+(r[k]||0),0);
  const L = c => P.label[c] || c;
  // The run whose figures are on this screen. Not the one the selector says:
  // the mapper only works out gross, deductions and net for the newest run, so
  // this panel always describes that one, and the status it shows has to be
  // that run's or the buttons would act on a different month from the totals.
  const HERE = (DATA.payroll.runs || []).find(r => r.key === DATA.payroll.monthKey)
             || (DATA.payroll.runs || [])[0] || null;
  const st = HERE ? HERE.status : PAYST();
  const RUNNOTE = HERE ? (HERE.note || '') : '';
  const stPill = {draft:'<span class="pill mute">Draft</span>',
    submitted:'<span class="pill warn"><span class="dt"></span>Waiting for Miraziz</span>',
    approved:'<span class="pill good"><span class="dt"></span>Approved</span>',
    initiated:'<span class="pill warn"><span class="dt"></span>Payment initiated</span>',
    closed:'<span class="pill good"><span class="dt"></span>Paid &amp; released</span>',
    returned:'<span class="pill bad"><span class="dt"></span>Sent back to Avin</span>'}[st];

  const byCo = P.companies.map(c=>{
    const rs = staff.filter(r=>r.company===c);
    return {c, heads:rs.length, gross:rs.reduce((s,r)=>s+r.gross,0), ded:rs.reduce((s,r)=>s+r.ded,0),
      net:rs.reduce((s,r)=>s+r.net,0),
      bank: staff.filter(r=>{const ch=channelOf(r);
        return (c==='CorpLex' && (ch==='edcp'||ch==='bcp')) || (c==='POA' && (ch==='edpoa'||ch==='bpoa')) || (c==='Lex' && (ch==='edlex'||ch==='blex'));
      }).reduce((s,r)=>s+r.net,0)};
  });
  const recharge = staff.filter(r=>r.paidBy!==r.chargedTo);
  const staffNet = staff.reduce((s,r)=>s+r.net,0);
  const chan = P.channels.map(c=>{
    const rs = chRows(c.id);
    const net = rs.reduce((s,r)=>s+r.net,0), vat = rs.reduce((s,r)=>s+vatOf(r),0);
    return {...c, n:rs.length, net, vat, pay:net+vat, names:rs.map(r=>r.name)};
  });
  const payTotal = chan.reduce((s,c)=>s+c.pay,0);
  const staffPay = chan.filter(c=>c.id!=='eddummy').reduce((s,c)=>s+c.pay,0);

  applyPayFilters();
  const pActive = (PF.ch!=='all'?1:0)+(PF.visa!=='all'?1:0)+(PF.text?1:0);
  const pArrow = k => PS.key===k ? `<span class="sar">${PS.dir>0?'▲':'▼'}</span>` : '';
  const pth = (k,label,cls='') => `<th class="${cls} sortable${PS.key===k?' sorted':''}" data-psort="${k}">${esc(label)}${pArrow(k)}</th>`;
  const psel = (id,val,opts) => `<select id="${id}" class="ff">${opts.map(([v,l])=>`<option value="${esc(v)}"${val===v?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const step = (n,label,done,now) =>
    `<div class="wfstep${done?' done':''}${now?' now':''}"><i>${done?'✓':n}</i><span>${label}</span></div>`;

  return `
  <div class="strip">
    <div class="stat"><span class="k">${esc(P.month)} &middot; ${esc(co==='all'?'all companies':L(co))}</span>
      <span class="v"><span class="cur">AED</span>${money(SC('net'),2)}</span><span class="n">net payable</span></div>
    <div class="stat"><span class="k">Gross</span><span class="v"><span class="cur">AED</span>${money(SC('gross'),2)}</span>
      <span class="n">${coRows.length} people on the run</span></div>
    <div class="stat"><span class="k">Deductions</span><span class="v" style="color:var(--warn)"><span class="cur">AED</span>${money(SC('ded'),2)}</span>
      <span class="n">advances, mobile and other</span></div>
    <div class="stat"><span class="k">Status</span><span class="v" style="font-size:17px;font-family:'IBM Plex Sans',sans-serif">${stPill}</span>
      <span class="n">prepared by ${esc(P.preparedBy)}</span></div>
  </div>

  ${staleNote(P.monthKey)}
  <section class="panel">
    <header><h3>Approval</h3><span class="hint">Avin prepares &middot; Miraziz approves</span>
      ${runSeg()}
      <span class="pill mute" style="margin-left:14px">${esc(HERE ? HERE.label : DATA.payroll.month)}</span>
      <div class="seg" id="coSeg" style="margin-left:auto">
        <button data-co="all" aria-pressed="${co==='all'}" type="button">All</button>
        ${P.companies.map(c=>`<button data-co="${esc(c)}" aria-pressed="${co===c}" type="button">${esc(L(c))}</button>`).join('')}
      </div>
    </header>
    <div class="pad">
      <div class="wfbar">
        ${step(1,'Prepared by Avin', st!=='draft', st==='draft')}
        ${step(2,'Submitted for approval', ['submitted','approved','initiated','closed'].includes(st), st==='submitted')}
        ${step(3,'Approved by Miraziz', ['approved','initiated','closed'].includes(st), st==='approved')}
        ${step(4,'Payment initiated', ['initiated','closed'].includes(st), st==='initiated')}
        ${step(5,'Paid &mdash; payslips released', st==='closed', false)}
      </div>
      ${st==='returned'?`<div class="note" style="border-left-color:var(--bad);margin-top:16px"><b>Sent back.</b> ${esc(RUNNOTE || 'No reason was given.')} &mdash; the month is editable again, and submitting it clears this.</div>`:''}
      ${isApprover && st==='submitted' && state.payAsk ? `<div class="ciwarn" style="border-left-color:var(--bad)">
        <b>What is wrong with it?</b>
        <div class="ciwrow"><input id="payWhy" placeholder="so Avin knows what to fix" value="${esc(state.payWhy||'')}">
          <button class="btn" id="payWhyGo" type="button"${(state.payWhy||'').trim()?'':' disabled'}>Send it back</button>
          <button class="btn ghost" id="payWhyNo" type="button">Cancel</button></div></div>`:''}
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;align-items:center">
        ${isPrep && (st==='draft'||st==='returned') ? '<button class="btn" id="paySubmit" type="button">Submit to Miraziz for approval</button>' : ''}
        ${isApprover && st==='submitted' ? '<button class="btn" id="payApprove" type="button">Approve the run</button><button class="btn ghost" id="payReturn" type="button">Send it back</button>' : ''}
        ${isPrep && st==='approved' ? '<button class="btn" id="payInit" type="button">Mark it paid</button><span style="color:var(--good);font-size:13px">Approved by '+esc(HERE&&HERE.approver||'the owner')+' &mdash; AED '+money(staffNet,2)+'</span>' : ''}
        ${isPrep && st==='initiated' ? '<button class="btn" id="payClose" type="button">Close the month and release payslips</button><span style="color:var(--warn);font-size:13px">Paid. Closing publishes '+staff.length+' payslips to staff.</span>' : ''}
        ${!isPrep && ['approved','initiated'].includes(st) ? '<span style="color:var(--ink3);font-size:12.5px">With Avin &mdash; '+(st==='initiated'?'paid, not yet closed':'not yet paid')+'.</span>' : ''}
        ${st==='closed' ? `${isPrep?`${nextRunKey() && !nextRunWhy()
            ? `<button class="btn" id="payNextBtn" type="button">Start the ${esc(MKEY(nextRunKey()))} run</button>` : ''}<button class="btn ghost" id="paySlips" type="button">Payslips</button>`:''}<span style="color:var(--good);font-size:13px">Paid &mdash; AED ${money(staffNet,2)}, and ${staff.length} payslips released to staff</span>` : ''}
        ${isPrep && st==='closed' && nextRunKey() && !nextRunWhy() ? `<span style="color:var(--ink3);font-size:12.5px">Builds the ${esc(MKEY(nextRunKey()))} lines from the salaries, joining dates and leave the portal holds today &mdash; including any revision letter that has gone out since.</span>` : ''}
        ${isApprover && st==='draft' ? '<span style="color:var(--ink3);font-size:12.5px">Avin has not submitted this month yet.</span>' : ''}
        ${isPrep && st==='submitted' ? '<button class="btn ghost" id="payWithdraw" type="button">Withdraw it</button><span style="color:var(--ink3);font-size:12.5px">With Miraziz. Withdrawing puts it back to a draft you can edit.</span>' : ''}
      </div>
    </div>
  </section>

  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Payroll register</h3>
      <span class="pill mute">${esc(P.month)}</span>
      ${(() => { const b = EXITS().filter(x => x.month === (HERE ? HERE.key : P.monthKey)
                    && x.status !== 'draft' && x.status !== 'paid').length;
          return b ? `<span class="pill warn" style="margin-left:8px"><span class="dt"></span>${b} settlement${b===1?'':'s'} to pay</span>` : ''; })()}
      ${isPrep?`<button class="btn ghost" id="payInt" type="button" style="margin-left:auto;padding:4px 11px;font-size:12.5px">${state.payInternal?'Hide internal columns':'Internal columns'}</button>`:''}
      <span style="${isPrep?'':'margin-left:auto;'}color:var(--ink3);font-size:12.5px">${rows.length} of ${coRows.length} rows</span></header>
    ${exitBox(HERE ? HERE.key : P.monthKey)}
    <div class="filterbar">
      ${psel('pfch', PF.ch, [['all','All payment channels']].concat(P.channels.filter(c=>c.id!=='eddummy').map(c=>[c.id,c.label])))}
      ${psel('pfvisa', PF.visa, [['all','All visas']].concat(VISAS.map(v=>[v,v])))}
      <input id="pftext" class="ff" placeholder="Search name, employee ID, designation" value="${esc(PF.text)}">
      <button class="btn ghost fclear${pActive?'':' off'}" id="pfclear" type="button">Clear${pActive?' ('+pActive+')':''}</button>
    </div>
    ${P.companies.filter(c=>co==='all'||co===c).map(c=>{
      const rs = rows.filter(r=>r.company===c);
      const T = k => rs.reduce((s,r)=>s+(r[k]||0),0);
      return `
      <div class="regblock">
        <div class="regbar"><b>${esc(L(c))}</b>
          <span>${rs.length} ${rs.length===1?'person':'people'}</span>
          <em>net <b class="num">${money(T('net'),2)}</b></em></div>
        ${rs.length ? `<div class="tw"><table class="invtable regtable">
          ${COLGROUP()}
          <thead><tr>
            ${pth('name','Name','s1')}${pth('id','Emp ID','s2')}${INT?pth('visa','Visa')+pth('paidBy','Paid from'):''}
            ${pth('days','Days','r')}${pth('salary','Salary','r')}${pth('claims','Claims','r')}${pth('air','Air Ticket','r')}
            ${pth('comm','Comm.','r')}<th class="r">Other</th>${pth('gross','Gross','r')}
            ${pth('adv','Advance','r')}${pth('mob','Mobile','r')}${pth('ded','Ded.','r')}${pth('net','Net','r')}
          </tr></thead>
          <tbody>
            ${rs.map(r=>`<tr>
              <td class="nw s1">${nm(r.name)}${r.note?` <span class="pill mute" title="${esc(r.note)}">note</span>`:''}</td>
              <td class="n nw s2">${esc(r.id)}</td>
              ${INT?`<td class="nw"><select class="mini" data-edit="visa" data-row="${esc(r.name)}|${esc(r.company)}">${VISAS.map(v=>`<option${v===r.visa?' selected':''}>${esc(v)}</option>`).join('')}</select></td>
              <td class="nw"><select class="mini" data-edit="paidBy" data-row="${esc(r.name)}|${esc(r.company)}">${P.companies.map(v=>`<option value="${esc(v)}"${v===r.paidBy?' selected':''}>${esc(L(v))}</option>`).join('')}</select></td>`:''}
              <td class="n r">${r.days}</td>
              <td class="n r">${money(r.salary,2)}</td>
              <td class="n r">${r.claims?money(r.claims,2):'—'}</td>
              <td class="n r">${r.air?money(r.air,2):'—'}</td>
              <td class="n r">${r.comm?money(r.comm,2):'—'}</td>
              <td class="n r">${(r.inc+r.ref+r.other)?money(r.inc+r.ref+r.other,2):'—'}</td>
              <td class="n r">${money(r.gross,2)}</td>
              <td class="n r">${r.adv?money(r.adv,2):'—'}</td>
              <td class="n r">${r.mob?money(r.mob,2):'—'}</td>
              <td class="n r"${r.ded?' style="color:var(--warn)"':''}>${r.ded?money(r.ded,2):'—'}</td>
              <td class="n r netcol">${money(r.net,2)}</td>
            </tr>`).join('')}
            <tr class="tot"><td class="s1">${esc(L(c))} total</td><td class="s2"></td>${INT?'<td colspan="2"></td>':''}<td></td>
              <td class="n r">${money(T('salary'),2)}</td><td class="n r">${money(T('claims'),2)}</td>
              <td class="n r">${money(T('air'),2)}</td><td class="n r">${money(T('comm'),2)}</td>
              <td class="n r">${money(T('inc')+T('ref')+T('other'),2)}</td><td class="n r">${money(T('gross'),2)}</td>
              <td class="n r">${money(T('adv'),2)}</td><td class="n r">${money(T('mob'),2)}</td>
              <td class="n r">${money(T('ded'),2)}</td><td class="n r netcol">${money(T('net'),2)}</td></tr>
          </tbody></table></div>`
        : '<div style="padding:20px 18px;color:var(--ink3);font-size:13px">Nothing matches the filters for this company.</div>'}
      </div>`;
    }).join('')}
    <div class="regbar grand"><b>Group total</b><span>${rows.length} ${rows.length===1?'person':'people'}</span>
      <em>gross <b class="num">${money(S('gross'),2)}</b> &nbsp;&middot;&nbsp; deductions <b class="num">${money(S('ded'),2)}</b> &nbsp;&middot;&nbsp; net <b class="num">${money(S('net'),2)}</b></em></div>
    <p class="cap">${INT?'<b>Internal columns are showing.</b> Change a visa or a paying company and the payment channels above recalculate. ':''}Salary is pro-rated as contract salary &times; days &divide; 30, the same as your workbook. Commission and advances are typed into the monthly file by hand. Rows carrying a <b>note</b> have something worth reading &mdash; hover it.</p>
  </section>

  <section class="panel">
    <header><h3>By company</h3><span class="hint">who bears the cost, and whose bank pays</span></header>
    <div class="tw"><table>
      <thead><tr><th>Company</th><th class="r">People</th><th class="r">Gross</th><th class="r">Deductions</th><th class="r">Net &mdash; cost</th><th class="r">Cash out of its accounts</th><th class="r">Owed to / (by)</th></tr></thead>
      <tbody>
        ${byCo.map(x=>`<tr${co===x.c?' style="background:var(--panel2);font-weight:500"':''}>
          <td>${esc(L(x.c))}</td><td class="n r">${x.heads}</td><td class="n r">${money(x.gross,2)}</td>
          <td class="n r">${x.ded?money(x.ded,2):'—'}</td><td class="n r">${money(x.net,2)}</td>
          <td class="n r">${money(x.bank,2)}</td>
          <td class="n r"${Math.abs(x.bank-x.net)>0.5?' style="color:var(--accent2)"':''}>${Math.abs(x.bank-x.net)>0.5?(x.bank>x.net?'+':'')+money(x.bank-x.net,2):'—'}</td></tr>`).join('')}
        <tr class="tot"><td>Group</td><td class="n r">${staff.length}</td>
          <td class="n r">${money(staff.reduce((s,r)=>s+r.gross,0),2)}</td>
          <td class="n r">${money(staff.reduce((s,r)=>s+r.ded,0),2)}</td>
          <td class="n r">${money(staffNet,2)}</td>
          <td class="n r">${money(staffNet,2)}</td><td class="r">—</td></tr>
      </tbody></table></div>
    ${recharge.length?(()=>{const lex = staff.filter(r=>channelOf(r)==='blex' && r.chargedTo!=='Lex').reduce((s,r)=>s+r.net,0);
      return `<p class="cap"><b>Cash and cost differ where somebody is paid by one company and works for another.</b>
      The ${recharge.length} staff on a CorpLex&nbsp;-&nbsp;POA visa cost POA but are paid out of CorpLex &mdash; AED ${money(recharge.reduce((s,r)=>s+r.net,0),2)} net this month
      (gross ${money(recharge.reduce((s,r)=>s+r.gross,0),2)}, less ${money(recharge.reduce((s,r)=>s+r.ded,0),2)} advance deducted from Ma&nbsp;Concecion).
      So <b>POA owes CorpLex ${money(recharge.reduce((s,r)=>s+r.net,0),2)}</b>${lex?` and <b>owes Lex Estates ${money(lex,2)}</b>`:', and nothing is owed to or by Lex Estates this month'}. Every figure here is net, so it ties to the transfers below.</p>`;})():''}
  </section>

  <section class="panel">
    <header><h3>How the money goes out</h3><span class="hint">${esc(P.month)} &middot; net amounts</span></header>
    <div class="tw"><table>
      <thead><tr><th>Channel</th><th>Type</th><th class="r">People</th><th class="r">Net salary</th><th class="r">VAT</th><th class="r">To transfer</th><th>Who</th></tr></thead>
      <tbody>
        ${chan.filter(c=>c.id!=='eddummy').map(c=>`<tr>
          <td><b>${esc(c.label)}</b></td>
          <td><span class="pill ${c.kind==='Edenred'?'good':'mute'}">${esc(c.kind)}</span></td>
          <td class="n r">${c.n}</td>
          <td class="n r">${money(c.net,2)}</td>
          <td class="n r">${c.vat?money(c.vat,2):'—'}</td>
          <td class="n r"><b>${money(c.pay,2)}</b></td>
          <td style="color:var(--ink2);font-size:12px;max-width:340px">${c.n<=4?esc(c.names.map(first).join(', ')):
            (c.id==='edcp'?'the '+c.n+' staff on a CorpLex or CorpLex&nbsp;-&nbsp;POA visa':(c.id==='edpoa'?'the '+c.n+' staff on a POA visa':'the '+c.n+' staff'))}</td>
        </tr>`).join('')}
        <tr class="tot"><td>Payroll total</td><td></td>
          <td class="n r">${chan.filter(c=>c.id!=='eddummy').reduce((s,c)=>s+c.n,0)}</td>
          <td class="n r">${money(staffNet,2)}</td>
          <td class="n r">${money(chan.reduce((s,c)=>s+(c.id!=='eddummy'?c.vat:0),0),2)}</td>
          <td class="n r">${money(staffPay,2)}</td><td></td></tr>
        ${chan.filter(c=>c.id==='eddummy' && c.n).map(c=>`<tr style="color:var(--ink3)">
          <td>${esc(c.label)}</td><td><span class="pill mute">${esc(c.kind)}</span></td>
          <td class="n r">${c.n}</td><td class="n r">${money(c.net,2)}</td><td class="r">—</td>
          <td class="n r">${money(c.pay,2)}</td>
          <td style="font-size:12px;max-width:340px">${esc(c.names.map(first).join(', '))} &mdash; not counted as staff cost</td></tr>`).join('')}
        <tr class="tot"><td><b>Total leaving the accounts</b></td><td></td>
          <td class="n r">${chan.reduce((s,c)=>s+c.n,0)}</td>
          <td class="n r">${money(chan.reduce((s,c)=>s+c.net,0),2)}</td>
          <td class="n r">${money(chan.reduce((s,c)=>s+c.vat,0),2)}</td>
          <td class="n r">${money(payTotal,2)}</td><td></td></tr>
      </tbody></table></div>
    <p class="cap"><b>Edenred CP</b> covers the CorpLex and CorpLex&nbsp;-&nbsp;POA visas; <b>Edenred POA</b> covers the POA visas &mdash; except the people listed on their own line. <b>Abdullokh Fozilov</b> is on another company's visa, so his salary is invoiced with 5% VAT. The four non-staff sit below the payroll total &mdash; they leave the account but are not a staff cost.</p>
  </section>

  ${rows.some(r=>r.note)?`
  <section class="panel">
    <header><h3>Notes on this run</h3></header>
    <div class="pad"><dl class="kv">
      ${rows.filter(r=>r.note).map(r=>`<dt>${nm(r.name)}</dt><dd>${esc(r.note)}</dd>`).join('')}
    </dl></div>
  </section>`:''}`;
}

function vTickets(){
  const T = DATA.tickets, f = state.atFilter, so = state.atSort;
  const all = T.employees;
  const uniqC = [...new Set(all.map(r=>r.country))].sort();
  let rows = all.slice();
  if(f.status!=='all') rows = rows.filter(r=>r.status===f.status);
  if(f.country!=='all') rows = rows.filter(r=>r.country===f.country);
  if(f.text){ const t=f.text.toLowerCase();
    rows = rows.filter(r=>[r.name,r.id,r.country].some(v=>(v||'').toLowerCase().includes(t))); }
  rows.sort((a,b)=>{
    const k=so.key, av=a[k], bv=b[k];
    const c=(typeof av==='number'&&typeof bv==='number')?av-bv:String(av||'￿').localeCompare(String(bv||'￿'));
    return c*so.dir;
  });
  const active = all.filter(r=>!r.lwd && r.status!=='Remote — not eligible');
  const due = all.filter(r=>r.status==='Due This Month');
  const dueVal = due.reduce((s,r)=>s+r.rate,0);
  const backlog = all.reduce((s,r)=>s+r.backlog,0);
  const pending = all.reduce((s,r)=>s+r.pending,0);
  const paidAll = Object.values(T.history).reduce((s,h)=>s+h.totalPaid,0);
  const annual = active.reduce((s,r)=>s+r.rate,0);
  const stPill = s => s==='Due This Month' ? '<span class="pill warn"><span class="dt"></span>Due this month</span>'
    : s==='Overdue' ? '<span class="pill bad"><span class="dt"></span>Overdue</span>'
    : s.startsWith('Left') ? '<span class="pill mute">Left</span>'
    : s.startsWith('Remote') ? '<span class="pill mute">Not eligible</span>'
    : '<span class="pill good"><span class="dt"></span>Upcoming</span>';
  const arrow = k => so.key===k ? `<span class="sar">${so.dir>0?'▲':'▼'}</span>` : '';
  const th = (k,label,cls='') => `<th class="${cls} sortable${so.key===k?' sorted':''}" data-atsort="${k}">${esc(label)}${arrow(k)}</th>`;
  const sel = (id,val,opts) => `<select id="${id}" class="ff">${opts.map(([v,l])=>`<option value="${esc(v)}"${val===v?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const act = (f.status!=='all'?1:0)+(f.country!=='all'?1:0)+(f.text?1:0);
  const onRun = due.filter(r=>((DATA.payroll.rows.find(p=>p.name===r.name)||{}).air||0)>0);
  const allDone = due.length>0 && onRun.length===due.length;
  const viewOnly = roleOf(state.user)!=='admin';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const procKey = s => { const [m,y] = String(s||'').split('-'); return s ? (+y)*12 + MON.indexOf(m) : 1e9; };
  const upcoming = all.filter(r=>r.proc && !r.lwd && r.status==='Upcoming')
                      .sort((x,y)=>procKey(x.proc)-procKey(y.proc) || String(x.nextS).localeCompare(String(y.nextS)));
  const nextProc = upcoming.length ? upcoming[0].proc : '';
  const nextBatch = upcoming.filter(r=>r.proc===nextProc);
  const nextVal = nextBatch.reduce((s,r)=>s+r.rate,0);
  const soon = upcoming.slice(0, 8);
  const LR = T.lastRun || null;

  return `
  <div class="strip">
    ${due.length ? `<div class="stat"><span class="k">${allDone?'Processed in the '+esc(T.procMonth)+' run':'Due in the '+esc(T.procMonth)+' run'}</span>
      <span class="v" style="color:var(--${allDone?'good':'accent2'})"><span class="cur">AED</span>${money(dueVal,2)}</span>
      <span class="n">${due.length} ${due.length===1?'ticket':'tickets'} ${allDone?'paid through payroll':'to process'}</span></div>`
    : `<div class="stat"><span class="k">Next tickets due</span>
      <span class="v"><span class="cur">AED</span>${money(nextVal,2)}</span>
      <span class="n">${nextBatch.length} in the ${esc(nextProc)} run &mdash; nothing due in ${esc(T.procMonth)}</span></div>`}
    <div class="stat"><span class="k">Unclaimed backlog</span><span class="v" style="color:var(--bad)"><span class="cur">AED</span>${money(backlog,2)}</span>
      <span class="n">${pending} ticket${pending===1?'':'s'} earned but not taken</span></div>
    <div class="stat"><span class="k">Annual entitlement</span><span class="v"><span class="cur">AED</span>${money(annual,2)}</span>
      <span class="n">${active.length} eligible staff, one ticket a year each</span></div>
    <div class="stat"><span class="k">Paid since 2020</span><span class="v"><span class="cur">AED</span>${money(paidAll,2)}</span>
      <span class="n">${Object.values(T.history).reduce((s,h)=>s+h.rows.length,0)} tickets, staff still with us</span></div>
  </div>

  ${due.length ? `
  <section class="panel">
    <header><h3>${esc(T.procMonth)} processing run</h3>
      ${viewOnly?'<span class="pill mute">View only</span>':''}
      ${allDone?'<span class="pill good"><span class="dt"></span>Processed</span>':''}
      <span class="hint">a ticket due before the 15th is processed in the previous month</span></header>
    <div class="tw"><table>
      <thead><tr><th>Employee</th><th>Country</th><th>Due date</th><th class="r">Amount</th><th class="r">In the payroll</th><th>Status</th></tr></thead>
      <tbody>
        ${due.map(r=>{
          const air = (DATA.payroll.rows.find(p=>p.name===r.name)||{}).air || 0;
          return `<tr><td>${nm(r.name)}</td><td>${esc(r.country)}</td><td class="n">${esc(r.next)}</td>
            <td class="n r">${money(r.rate,2)}</td>
            <td class="n r netcol">${air?money(air,2):'&mdash;'}</td>
            <td>${air?'<span class="pill good"><span class="dt"></span>Paid in the run</span>'
              :'<span class="pill bad"><span class="dt"></span>Not on the payroll run</span>'}</td></tr>`;
        }).join('')}
        <tr class="tot"><td>${due.length} due</td><td></td><td></td><td class="n r">${money(dueVal,2)}</td>
          <td class="n r netcol">${money(onRun.reduce((s,r)=>s+r.rate,0),2)}</td>
          <td>${allDone?'Reconciles':'<span style="color:var(--bad)">'+(due.length-onRun.length)+' missing</span>'}</td></tr>
      </tbody></table></div>
  </section>` : `
  <section class="panel">
    <header><h3>${esc(T.procMonth)} processing run</h3>
      ${viewOnly?'<span class="pill mute">View only</span>':''}
      <span class="pill good"><span class="dt"></span>Nothing due</span>
      <span class="hint">a ticket due before the 15th is processed in the previous month</span></header>
    <div class="pad" style="padding-bottom:6px">
      <p style="font-size:15px;color:var(--ink);margin:0 0 4px">No air ticket falls due in the ${esc(T.procMonth)} run, so there is nothing to add to that payroll.
      The next ${nextBatch.length===1?'one is':nextBatch.length+' are'} in the <b>${esc(nextProc)}</b> run &mdash; AED ${money(nextVal,2)}.</p>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Employee</th><th>Country</th><th>Due date</th><th>Process in</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${soon.map((r,i)=>`<tr${r.proc===nextProc?' style="background:var(--panel2)"':''}>
          <td>${nm(r.name)}${r.proc===nextProc?' <span class="pill warn"><span class="dt"></span>Next</span>':''}</td>
          <td>${esc(r.country)}</td><td class="n">${esc(r.next)}</td><td class="nw">${esc(r.proc)}</td>
          <td class="n r netcol">${money(r.rate,2)}</td></tr>`).join('')}
        <tr class="tot"><td>${esc(nextProc)} run</td><td></td><td></td><td class="n">${nextBatch.length} ticket${nextBatch.length===1?'':'s'}</td>
          <td class="n r netcol">${money(nextVal,2)}</td></tr>
      </tbody></table></div>
    <p class="cap">The next eight tickets in date order. Only the shaded rows go into the ${esc(nextProc)} payroll; the rest are further out.</p>
  </section>`}

  ${LR ? `
  <section class="panel">
    <header><h3>${esc(LR.label)} run</h3><span class="pill good"><span class="dt"></span>Paid</span>
      <span class="hint">reconciled against the payroll</span></header>
    <div class="tw"><table>
      <thead><tr><th>Employee</th><th>Country</th><th>Was due</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${LR.paid.map(p=>`<tr><td>${nm(p.name)}</td><td>${esc(p.country)}</td><td class="n">${esc(p.due)}</td>
          <td class="n r netcol">${money(p.amount,2)}</td></tr>`).join('')}
        <tr class="tot"><td>${LR.paid.length} tickets</td><td></td>
          <td class="n">air ticket allowance in the payroll ${money(LR.payroll,2)}</td>
          <td class="n r netcol">${money(LR.total,2)}</td></tr>
      </tbody></table></div>
    <p class="cap">${LR.total===LR.payroll
      ? 'Paid through the '+esc(LR.label)+' payroll and reconciled exactly &mdash; each of these has rolled forward to its next cycle.'
      : 'The tracker and the payroll differ by AED '+money(Math.abs(LR.total-LR.payroll),2)+' &mdash; worth a look.'}</p>
  </section>` : ''}

  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Entitlement register</h3><span class="pill mute">as at ${esc(T.asOf)}</span>
      <span style="margin-left:auto;color:var(--ink3);font-size:12.5px">${rows.length} of ${all.length} people</span></header>
    <div class="filterbar">
      ${sel('atst', f.status, [['all','All statuses'],['Due This Month','Due this month'],['Upcoming','Upcoming'],['Remote — not eligible','Not eligible'],['Left - no further tickets','Left the firm']])}
      ${sel('atco', f.country, [['all','All countries']].concat(uniqC.map(c=>[c,c])))}
      <input id="attext" class="ff" placeholder="Search name, employee ID, country" value="${esc(f.text)}">
      <button class="btn ghost fclear${act?'':' off'}" id="atclear" type="button">Clear${act?' ('+act+')':''}</button>
    </div>
    ${(() => { window.TICKHEAD = `<thead><tr>
        ${th('id','Emp ID')}${th('name','Employee')}${th('country','Country')}${th('dojS','Joined')}
        ${th('rate','Rate','r')}${th('lastPaid','Last taken')}${th('nextS','Next due')}${th('proc','Process in')}
        ${th('status','Status')}${th('taken','Taken','r')}${th('pending','Pending','r')}${th('backlog','Backlog','r')}
      </tr></thead>`; return ''; })()}
    <div style="display:none"><table>
      </table></div>
    ${byCompany(rows, {
      who: r => r.name, cls: 'invtable',
      cols: colsOf([7, 14, 9, 9, 6.5, 9, 9, 8, 8.5, 5.5, 7, 6.5]),
      head: TICKHEAD,
      row: r => `<tr${(r.lwd||r.status.startsWith('Remote'))?' style="color:var(--ink3)"':''}>
          <td class="n nw">${esc(r.id)}</td>
          <td>${nm(r.name)}</td>
          <td>${esc(r.country)}</td>
          <td class="n nw">${esc(r.doj)}</td>
          <td class="n r">${money(r.rate,0)}</td>
          <td class="n nw">${esc(r.lastPaid)||'<span style="color:var(--ink3)">—</span>'}</td>
          <td class="n nw">${esc(r.next)||'<span style="color:var(--ink3)">—</span>'}</td>
          <td>${esc(r.proc)||'<span style="color:var(--ink3)">—</span>'}</td>
          <td>${stPill(r.status)}</td>
          <td class="n r">${r.taken}</td>
          <td class="n r"${r.pending?' style="color:var(--bad);font-weight:600"':''}>${r.pending||'—'}</td>
          <td class="n r netcol">${r.backlog?money(r.backlog,0):'—'}</td>
        </tr>`,
      foot: rs => `<tr class="tot"><td>${rs.length}</td><td>people</td><td colspan="7"></td>
          <td class="n r">${rs.reduce((s,r)=>s+r.taken,0)}</td>
          <td class="n r">${rs.reduce((s,r)=>s+r.pending,0)}</td>
          <td class="n r netcol">${money(rs.reduce((s,r)=>s+r.backlog,0),0)}</td></tr>`,
      empty: 'Nobody matches those filters.'
    })}
    <p class="cap">One ticket a year, first due 11 months after joining and every 12 months after that. A leaver keeps whatever they had already earned &mdash; that is what stays in Backlog.</p>
  </section>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Unclaimed backlog</h3><span class="hint">earned, not taken</span></header>
      <div class="tw"><table>
        <thead><tr><th>Employee</th><th>Country</th><th class="r">Tickets</th><th class="r">Value</th><th>Note</th></tr></thead>
        <tbody>${all.filter(r=>r.pending>0).sort((a,b)=>b.backlog-a.backlog).map(r=>`<tr>
          <td>${nm(r.name)}</td><td>${esc(r.country)}</td><td class="n r">${r.pending}</td>
          <td class="n r netcol">${money(r.backlog,0)}</td>
          <td style="color:var(--ink2);font-size:12.5px">${r.lwd?'Left '+esc(r.lwd)+' — settle on exit':'Still employed'}</td></tr>`).join('')}
          <tr class="tot"><td>Total</td><td></td><td class="n r">${pending}</td><td class="n r netcol">${money(backlog,0)}</td><td></td></tr>
        </tbody></table></div>
      <p class="cap">Valued at the current fixed rate, since what an untaken ticket would have cost cannot be known.</p>
    </section>

    <section class="panel">
      <header><h3>Country rates</h3><span class="hint">fixed allowance from June 2026</span></header>
      <div class="tw"><table>
        <thead><tr><th>Country</th><th class="r">Rate</th><th class="r">Staff</th><th class="r">Annual cost</th></tr></thead>
        <tbody>${T.rates.map(([c,v])=>{const k=active.filter(r=>r.country===c).length;
          return `<tr${k?'':' style="color:var(--ink3)"'}><td>${esc(c)}</td><td class="n r">${money(v,0)}</td>
            <td class="n r">${k||'—'}</td><td class="n r">${k?money(k*v,0):'—'}</td></tr>`;}).join('')}
          <tr class="tot"><td>Total</td><td></td><td class="n r">${active.length}</td><td class="n r netcol">${money(annual,0)}</td></tr>
        </tbody></table></div>
      <p class="cap">The country rate is the fixed allowance paid regardless of what the ticket actually costs.</p>
    </section>
  </div>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Not in the scheme</h3><span class="hint">on payroll, no entitlement accruing</span></header>
      <div class="tw"><table>
        <thead><tr><th>Name</th><th>Why</th></tr></thead>
        <tbody>${(T.excluded||[]).map(e=>`<tr><td class="nw">${nm(e.name)}</td>
          <td style="color:var(--ink2)">${esc(e.why)}</td></tr>`).join('')}
          ${all.filter(r=>r.note).map(r=>`<tr><td class="nw">${nm(r.name)}</td>
            <td style="color:var(--ink2)">${esc(r.note)}</td></tr>`).join('')}
        </tbody></table></div>
      <p class="cap">These names appear on the payroll but never on the due list, so the annual entitlement above excludes them.</p>
    </section>

    <section class="panel">
      <header><h3>How the scheme works</h3></header>
      <div class="pad"><dl class="kv wide">
        <dt>Entitlement</dt><dd>One ticket a year, first due 11 months after joining, every 12 months after that</dd>
        <dt>Amount</dt><dd>The fixed rate for the employee's home country, whatever the fare</dd>
        <dt>How it is paid</dt><dd>${esc(T.policyNote||'')}</dd>
        <dt>Timing</dt><dd>A ticket falling due before the 15th is processed in the previous month's run</dd>
        <dt>Unclaimed tickets</dt><dd>${T.backlogLapses?'Lapse at the end of the cycle':'Do not lapse — they stay owed and are settled when taken or on exit'}</dd>
      </dl></div>
    </section>
  </div>`;
}

/* ---------- payslips ---------- */
const W1=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const W10=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function w3(n){ let s='';
  if(n>=100){ s+=W1[Math.floor(n/100)]+' Hundred'; n%=100; if(n) s+=' '; }
  if(n>=20){ s+=W10[Math.floor(n/10)]; n%=10; if(n) s+='-'+W1[n]; }
  else if(n) s+=W1[n];
  return s; }
function inWords(n){
  n = Math.round(n*100)/100;
  const whole = Math.floor(n), fils = Math.round((n-whole)*100);
  if(whole===0 && !fils) return 'Zero';
  let out=[], x=whole;
  const mil=Math.floor(x/1000000); x%=1000000;
  const th=Math.floor(x/1000); x%=1000;
  if(mil) out.push(w3(mil)+' Million');
  if(th) out.push(w3(th)+' Thousand');
  if(x) out.push(w3(x));
  let s = out.join(' ').trim() || 'Zero';
  if(fils) s += ' and '+w3(fils)+' Fils';
  return s;
}
function slipOf(r, run){
  const M = DATA.master, P = salPartsRow(r);
  // r.salary is what the month actually paid; P.salary is the contractual monthly figure
  const sfm = Math.round((r.salary||0)*100)/100;
  const share = P.salary ? P.basic / P.salary : M.basicPct;
  const basic = Math.round(sfm * share * 100)/100;
  const allow = Math.round((sfm - basic)*100)/100;
  const earn = [['Basic', basic], ['Other Allowance', allow]];
  [['Claims','claims'],['Air Ticket','air'],['Incentives','inc'],['Commission','comm'],['Referrals','ref'],['Other Addition','other']]
    .forEach(([l,k])=>{ if(r[k]) earn.push([l, r[k]]); });
  const ded = [];
  [['Advance','adv'],['Donation','don'],['Insurance','ins'],['Mobile','mob'],['Other Deduction','oth']]
    .forEach(([l,k])=>{ if(r[k]) ded.push([l, r[k]]); });
  const gross = Math.round(earn.reduce((s,x)=>s+x[1],0)*100)/100;
  const dedT  = Math.round(ded.reduce((s,x)=>s+x[1],0)*100)/100;
  // the payslip carries the entity that sponsors the visa
  const vco = visaCoOf(r.name);
  const ent = (DATA.entities||{})[vco.code] || {legal:vco.name, addr:[], ready:false};
  const mp = (M.people||{})[r.id] || {};
  return {r, earn, ded, gross, dedT, net: Math.round((gross-dedT)*100)/100,
    paidDays: r.days, lop: Math.max(0, 30 - r.days), ent, mol: mp.mol||'', acct4: mp.acct4||'',
    payDate: (run && run.payDate) || ent.payDate || M.payDate,
    period: (run && run.label) || DATA.payroll.month,
    logo: (LOGOS[vco.key] || LOGOS.corplex).slip};
}
function slipHTML(s, printable){
  const r = s.row || s.r;
  const side = (title, lines, totLabel, totVal, empty) => `<div class="slside">
      <div class="slsh"><span>${esc(title)}</span><span class="r">Amount</span></div>
      <div class="slrows">${lines.length
        ? lines.map(([l,v])=>`<div class="slrow"><span>${esc(l)}</span><b>${money(v,2)}</b></div>`).join('')
        : `<div class="slrow none"><span>${esc(empty)}</span><b></b></div>`}</div>
      <div class="slst"><span>${esc(totLabel)}</span><b>AED ${money(totVal,2)}</b></div>
    </div>`;
  const kv = (k,v)=>`<div class="sk">${esc(k)}</div><div class="sc">:</div><div class="sv">${v}</div>`;
  return `<article class="slip">
    <header class="slhead">
      <img src="${s.logo}" alt="${esc(s.ent.legal)}">
      <div class="slco"><h4>${esc(s.ent.legal)}</h4>${s.ent.addr.map(l=>`<span>${esc(l)}</span>`).join('')}
        ${s.ent.ready?'':'<span class="slwarn">Letterhead details still to be confirmed</span>'}</div>
      <div class="slper"><span>Payslip For the Month</span><b>${esc(s.period)}</b></div>
    </header>
    <div class="slbody">
      <div class="slgrid">
        <div class="slsum">
          <div class="sltitle">Employee Summary</div>
          <div class="slkv">
            ${kv('Employee Name', esc(legalOf(r.name)))}
            ${kv('Designation', esc(r.title||'—'))}
            ${kv('Employee ID', esc(r.id))}
            ${kv('MOL ID', s.mol?esc(s.mol):'<i class="slmiss">from employee master</i>')}
            ${kv('Date of Joining', esc(r.doj)||'—')}
            ${kv('Pay Period', esc(s.period))}
            ${kv('Pay Date', esc(s.payDate))}
            ${kv('Account No', s.acct4?('&bull;&bull;&bull;&bull;&nbsp;&bull;&bull;&bull;&bull;&nbsp;'+esc(s.acct4)):'<i class="slmiss">from employee master</i>')}
          </div>
        </div>
        <div class="slnet">
          <div class="slnetbox"><b>AED ${money(s.net,2)}</b><span>Total Net Pay</span></div>
          <div class="sldays">
            <div><span>Paid Days</span><i>:</i><b>${s.paidDays}</b></div>
            <div><span>LOP Days</span><i>:</i><b>${s.lop}</b></div>
          </div>
        </div>
      </div>
      <div class="sltables">
        ${side('Earnings', s.earn, 'Gross Earnings', s.gross, '')}
        ${side('Deductions', s.ded, 'Total Deductions', s.dedT, 'None this month')}
      </div>
      <div class="slpay"><div><b>Total Net Payable</b><span>Gross Earnings - Total Deductions</span></div>
        <div class="slpayv">AED ${money(s.net,2)}</div></div>
      <p class="slwords"><span>Amount In Words :</span> UAE Dirham ${esc(inWords(s.net))}</p>
      <p class="slfoot">-- This is a system-generated document. --</p>
    </div>
  </article>`;
}

/* The final settlement. Same paper, same letterhead, a different document. */
function exitOf(x){
  /* One settlement, at whatever stage it has reached. A draft is worked out
     live; anything past a draft is read back exactly as it was frozen. */
  if(!x) return null;
  const live = exitCalc(x.who, x.lastDay, {lines: x.lines, settled: x.settled});
  return Object.assign({}, x, {c: x.frozen ? Object.assign({}, live, x.frozen) : live});
}
const EXITS = () => (HR().exits || []).filter(x => x.status !== 'withdrawn');
/* Whose desk is it on? The manager while it is initiated, the owner from then
   until it is approved. Accounts never approves its own settlement. */
function exitsWaitingOn(u){
  const owner = roleOf(u) === 'owner';
  return EXITS().filter(x =>
    (x.status === 'initiated' && (x.mgr === u || owner)) ||
    (x.status === 'mgr_ok' && owner));
}
function vExitApprove(){
  const mine = exitsWaitingOn(state.user);
  if(state.exitOpen){
    const x = EXITS().find(y => y.id === state.exitOpen);
    if(x) return vExitOne(exitOf(x));
  }
  if(!mine.length) return `<section class="panel"><div class="pad" style="text-align:center;padding:52px 24px">
    <h3 style="font-size:20px;margin-bottom:8px">Nothing waiting on you</h3>
    <p style="color:var(--ink2);max-width:52ch;margin:0 auto">A final settlement appears here when accounts has
      initiated it and it is your turn to approve.</p></div></section>`;
  return `
  <section class="panel">
    <header><h3>Settlements waiting on you</h3>
      <span class="pill warn"><span class="dt"></span>${mine.length}</span>
      <span class="hint">approve, or send it back with a reason</span></header>
    <div class="tw"><table class="cotab">
      ${colsOf([26, 16, 16, 18, 24])}
      <thead><tr><th>Employee</th><th>Last day</th><th class="r">Settlement</th><th>Stage</th><th class="r"></th></tr></thead>
      <tbody>${mine.map(x => `<tr>
        <td>${nm(x.who)}</td>
        <td class="n nw">${esc(dayLabel(x.lastDay))} ${x.lastDay.slice(0,4)}</td>
        <td class="n r netcol">AED ${money(x.net || 0, 2)}</td>
        <td class="nw">${exitPill(x.status)}</td>
        <td class="r nw"><button class="btn sm" data-exopen="${esc(x.id)}" type="button">Open it</button></td>
      </tr>`).join('')}</tbody></table></div>
    <p class="cap">This is what somebody is owed on the way out &mdash; their last month's pay, the end-of-service
      gratuity, any leave not taken, and anything accounts has added or deducted. Open it to see the working before
      you approve. Sending it back returns it to accounts as a draft with your reason on it.</p>
  </section>`;
}
function exitBox(monthKey){
  const on = EXITS().filter(x => x.month === monthKey && x.status !== 'draft');
  if(!on.length) return '';
  const owed = on.filter(x => x.status !== 'paid');
  const sum = on.reduce((t, x) => t + (x.net || 0), 0);
  return `<div class="exbox${owed.length ? '' : ' done'}">
    <div class="exboxh">Final settlements &mdash; not part of the payroll, but leaving the account this month
      <span>${owed.length
        ? owed.length + ' waiting' + (owed.length === 1 ? '' : ' ') + ' \u00b7 nothing paid yet'
        : 'all paid'} \u00b7 AED ${money(sum, 2)}</span></div>
    <div class="tw"><table class="cotab">
      ${colsOf([26, 15, 13, 20, 26])}
      <thead><tr><th>Employee</th><th>Last day</th><th class="r">Amount</th><th>Stage</th><th class="r"></th></tr></thead>
      <tbody>${on.map(x => `<tr>
        <td>${nm(x.who)} <span class="pill mute">${esc((payrollRowFor(x.who)||{}).id || '')}</span></td>
        <td class="n nw">${esc(dayLabel(x.lastDay))} ${x.lastDay.slice(0,4)}</td>
        <td class="n r netcol">${money(x.net || 0, 2)}</td>
        <td class="nw">${exitPill(x.status)}</td>
        <td class="r nw"><button class="btn ghost sm" data-exgoto="${esc(x.id)}" type="button">Open</button></td>
      </tr>`).join('')}</tbody></table></div>
    <p class="cap">These do not fold into the run's totals \u2014 the payroll above is unchanged by them, and a
      month that is already closed is never restated. ${owed.length
        ? '<b>The month cannot be closed while one of these is unpaid.</b>'
        : 'All settled.'} The people on this list are already off the payroll above.</p>
  </div>`;
}
const exitFor = who => EXITS().find(x => x.who === who && x.status !== 'paid') || null;
const EXSTAGE = {draft:0, initiated:1, mgr_ok:2, owner_ok:3, decided:4, paid:5};
const EXLABEL = {draft:'Draft', initiated:'With the manager', mgr_ok:'With Miraziz',
                 owner_ok:'Waiting on you', decided:'To pay', paid:'Paid'};
const exitPill = s => s === 'paid'
  ? '<span class="pill good"><span class="dt"></span>Paid</span>'
  : s === 'draft' ? '<span class="pill mute">Draft</span>'
  : `<span class="pill warn"><span class="dt"></span>${esc(EXLABEL[s] || s)}</span>`;

function settleOf(c){
  const r = c.row;
  const vco = visaCoOf(r.name);
  const ent = (DATA.entities||{})[vco.code] || {legal:vco.name, addr:[], ready:false};
  const mp = (DATA.master.people||{})[r.id] || {};
  const earn = [['Basic', c.mBasic], ['Other Allowance', c.mAllow]];
  if(c.leaveCash) earn.push(['Leave Encashment', c.leaveCash,
    c.leaveDays + (c.leaveDays === 1 ? ' day' : ' days') + ' of annual leave at daily basic']);
  if(c.grat) earn.push(['Gratuity', c.grat, 'Days of service: ' + c.days]);
  if(c.ticket) earn.push(['Air Ticket', c.ticket, 'unclaimed entitlement']);
  (c.extra || []).filter(x => !x.deduct && +x.amount)
    .forEach(x => earn.push([x.label || 'Other addition', +x.amount]));
  const ded = [];
  if(c.adv) ded.push(['Advance', c.adv, 'still outstanding on the last working day']);
  (c.extra || []).filter(x => x.deduct && +x.amount)
    .forEach(x => ded.push([x.label || 'Other deduction', +x.amount]));
  const r2 = v => Math.round(v*100)/100;
  const gross = r2(earn.reduce((s,x)=>s+x[1],0));
  const dedT  = r2(ded.reduce((s,x)=>s+x[1],0));
  return {c, r, ent, earn, ded, gross, dedT, net: r2(gross - dedT),
    mol: mp.mol||'', acct4: mp.acct4||'',
    logo: (LOGOS[vco.key] || LOGOS.corplex).slip};
}
function settleHTML(s){
  const c = s.c, r = s.r;
  const kv = (k, v) => `<div class="sk">${esc(k)}</div><div class="sc">:</div><div class="sv">${v}</div>`;
  const dd = iso => iso ? dayLabel(iso) + ' ' + iso.slice(0,4) : '\u2014';
  const side = (title, lines, totLabel, totVal, empty) => `<div class="slside">
      <div class="slsh"><span>${esc(title)}</span><span class="r">Amount</span></div>
      <div class="slrows">${lines.length
        ? lines.map(([l,v,sub])=>`<div class="slrow"><span>${esc(l)}${sub?`<i>${esc(sub)}</i>`:''}</span><b>${money(v,2)}</b></div>`).join('')
        : `<div class="slrow none"><span>${esc(empty)}</span><b></b></div>`}</div>
      <div class="slst"><span>${esc(totLabel)}</span><b>AED ${money(totVal,2)}</b></div>
    </div>`;
  return `<article class="slip settle">
    <header class="slhead">
      <img src="${s.logo}" alt="${esc(s.ent.legal)}">
      <div class="slco"><h4>${esc(s.ent.legal)}</h4>${s.ent.addr.map(l=>`<span>${esc(l)}</span>`).join('')}
        ${s.ent.ready?'':'<span class="slwarn">Letterhead details still to be confirmed</span>'}</div>
    </header>
    <div class="stbar">Full and final settlement</div>
    <div class="slbody">
      <div class="sttitle">Pay summary</div>
      <div class="stkv">
        ${kv('Employee Name', esc(legalOf(r.name)))}
        ${kv('Employee ID', esc(r.id))}
        ${kv('Designation', esc(r.title||'\u2014'))}
        ${kv('MOL ID', s.mol?esc(s.mol):'<i class="slmiss">from employee master</i>')}
        ${kv('Date of Joining', esc(r.doj)||'\u2014')}
        ${kv('Account No', s.acct4?('&bull;&bull;&bull;&bull;&nbsp;&bull;&bull;&bull;&bull;&nbsp;'+esc(s.acct4)):'<i class="slmiss">from employee master</i>')}
        ${kv('Pay Period', esc(c.period))}
        ${kv('Paid Days', String(c.paidDays))}
        ${kv('Last Working Date', esc(dd(c.lwd)))}
        ${kv('LOP Days', String(c.lop))}
        ${kv('Final Settlement Date', esc(dd(c.settleDate)))}
        <div class="sk"></div><div class="sc"></div><div class="sv"></div>
      </div>
      <div class="sltables">
        ${side('Earnings', s.earn, 'Gross Earnings', s.gross, '')}
        ${side('Deductions', s.ded, 'Total Deductions', s.dedT, 'None')}
      </div>
      <div class="stnet">
        <div class="stnh"><span>Net pay</span><b>Amount</b></div>
        <div class="stnr"><span>Gross Earnings</span><b>AED ${money(s.gross,2)}</b></div>
        <div class="stnr"><span>Total Deductions</span><b>(-) AED ${money(s.dedT,2)}</b></div>
        <div class="stnt"><span>Total Net Payable</span><b>AED ${money(s.net,2)}</b></div>
      </div>
      <div class="stwords">
        <p>Total Net Payable <b>AED ${money(s.net,2)}</b>
          <span>(UAE Dirham ${esc(inWords(s.net))})</span></p>
        <i>**Total Net Payable = (Gross Earnings &minus; Total Deductions)</i>
      </div>
      <div class="stnote"><span>Note:</span><i></i></div>
      <div class="stsign"><span>Prepared By:</span><span>Checked By:</span><span>Authorised By:</span></div>
      <div class="stdecl">
        <h5>Declaration by the receiver</h5>
        <p>I, the undersigned, hereby state that I have received the above-mentioned amount as my
          full and final settlement following the end of my employment with the Company. I confirm
          that I have accepted this settlement of my own free will and choice and that I have no
          grievances, disputes, demands, or claims against the Company in respect of my legal dues,
          back wages, reinstatement, re-employment, or any other employment-related matter.</p>
        <div class="stemp"><span>Employee&rsquo;s Signature:</span><i></i></div>
      </div>
      <p class="slfoot">-- This is a system-generated document. --</p>
    </div>
  </article>`;
}
const FULLDAY = () => (HR().hours && HR().hours.fullDay) || 9 * 60;

/* The clock shows the day, not the segment. The base is everything already
 * closed today; the ticker adds it to the time since the open check-in. */
function ciClock(open, before){
  return `<b class="ciclock" data-since="${esc(open.in)}" data-base="${Math.max(0, Math.round(before || 0))}"><span class="cidot"></span><span class="citime">0:00:00</span></b>`;
}
function payrollRowFor(user){
  const rows = DATA.payroll.rows.filter(r=>!r.dummy);
  let hit = rows.find(r=>r.name===user) || rows.find(r=>r.portalName===user);
  if(hit) return hit;
  const map = {};
  (DATA.tickets.employees||[]).forEach(e=>{ if(e.portalName) map[e.portalName]=e.name; });
  if(map[user]) { hit = rows.find(r=>r.name===map[user]); if(hit) return hit; }
  const t = user.toLowerCase().split(' ');
  return rows.find(r=>{ const p=r.name.toLowerCase().split(' ');
    return p[0]===t[0] && p[p.length-1]===t[t.length-1]; }) || null;
}
/* A salary revision letter lives with the other letters, but the payslip is where
   someone looks when their pay changes - so it is pointed to from here. */
function exitNote(u){
  const x = (HR().exits || []).find(y => y.who === u && !['draft','withdrawn'].includes(y.status));
  if(!x) return '';
  const e = exitOf(x);
  return `<button class="revlink" data-exslip="${esc(x.id)}" type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v5h5"/><path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z"/><path d="M9 13h6M9 17h4"/></svg>
    <span><b>Your final settlement \u2014 ${esc(dayLabel(x.lastDay))} ${x.lastDay.slice(0,4)}</b>
      <i>${x.status === 'paid' ? 'Paid. Tap to open it, print it or save it as a PDF.'
                               : 'Tap to open it, print it or save it as a PDF.'}</i></span>
    <svg class="rvgo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
  </button>`;
}
function revNote(u){
  const l = (HR().letters||[]).filter(x=>x.who===u && x.type==='revision' && x.status==='Issued')
    .sort((a,b)=>String(b.eff||b.decided||'').localeCompare(String(a.eff||a.decided||'')))[0];
  if(!l) return '';
  const when = l.eff ? effLabel(l.eff) : (l.decided ? dayLabel(l.decided)+' '+l.decided.slice(0,4) : '');
  return `<button class="revlink" data-revltr="${esc(l.id)}" type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg>
    <span><b>Your salary was revised${when?` with effect from ${esc(when)}`:''}</b>
      <i>The letter is on your Letters page &mdash; tap to open it</i></span>
    <svg class="rvgo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
  </button>`;
}
function vMySlip(){
  const P = DATA.payroll;
  const byNewest = (a, b) => a.key < b.key ? 1 : -1;

  /* Every released month with a line for me — one per company, because
     somebody paid by two of them is handed two payslips. */
  const mine = (P.runs || []).slice().sort(byNewest).flatMap(r =>
    r.status !== 'closed' ? [] :
      (r.rows || []).filter(x => x.portalName === state.user && !x.dummy)
        .map(row => ({run: r, row, key: r.key + '|' + (row.company || ''),
                      label: r.label + ((r.rows || []).filter(y =>
                        y.portalName === state.user && !y.dummy).length > 1
                        ? ' \u00b7 ' + (P.label[row.company] || row.company) : '')})));

  /* The newest month overall. If it is not released, that is worth one line —
     it is not worth the whole page, which is what it used to take.

     Whether it is worth even that used to be decided by looking for my line
     on the draft run, which is a question that can only ever answer no. The
     rule on payroll_lines is: your own line, AND only once the run is closed.
     That is the whole meaning of releasing a month, and it means the draft's
     rows are empty for everybody except accounts — so the notice never
     appeared for the one person it was written for, and appeared for accounts
     instead. It went unnoticed because the check happened to pick somebody
     who was not on the draft either way.

     What a person CAN see is that a newer month exists, that it is not out
     yet, and that they were paid in the last one. That is the honest form of
     the same sentence. Accounts, who can see the draft's lines, still get the
     precise version. */
  const newest = (P.runs || []).slice().sort(byNewest)[0];
  const draftRows = newest ? (newest.rows || []).filter(x => !x.dummy) : [];
  const waiting = !!newest && newest.status !== 'closed' && !exitNote(state.user)
    && (draftRows.length
        ? draftRows.some(x => x.portalName === state.user)
        : mine.length > 0);
  const soon = waiting ? `<div class="nudge">
      <span class="ndot"></span>
      <div><b>${esc(newest.label)} is not released yet</b>
        <span>It appears here as soon as the run is approved, the payment is made and accounts
          releases it. You will get a notification.</span></div>
    </div>` : '';

  /* These two come first and are shown whichever branch the page takes. They
     used to sit at the foot of the one branch that got as far as drawing a
     payslip, so the month a person most wanted to read about their revision
     was the month the page said nothing at all. */
  const notes = exitNote(state.user) + revNote(state.user);

  if(!mine.length) return `${notes}${soon}
    <section class="panel"><div class="pad" style="text-align:center;padding:52px 24px">
    <h3 style="font-size:20px;margin-bottom:8px">No payslip yet</h3>
    <p style="color:var(--ink2);max-width:56ch;margin:0 auto">${exitNote(state.user)
      ? 'Your last month is inside your final settlement above rather than on a payslip.'
      : waiting ? 'The month above is the first one due to you. Nothing is released yet.'
      : 'No month has been released to you. If that looks wrong, speak to accounts.'}</p></div></section>`;

  const here = mine.find(x => x.key === state.slipRun) || mine[0];
  const s = slipOf(here.row, here.run);

  /* The list itself is the switcher, so there is no row of month buttons above
     it — a person three years in would have had thirty of them. What a long
     list needs instead is a way to cut it down, and the only cut that means
     anything here is the year. It appears once there are more than a year and
     a bit of payslips to scroll. */
  const years = [...new Set(mine.map(x => x.run.key.slice(0, 4)))];
  const long = mine.length > 14 && years.length > 1;
  const year = !long ? '' :
    (state.slipYear === 'all' || years.includes(state.slipYear)
      ? state.slipYear : here.run.key.slice(0, 4));
  const shown = year && year !== 'all'
    ? mine.filter(x => x.run.key.slice(0, 4) === year) : mine;
  const pick = long ? `<select id="slipYear" class="ff" style="margin-left:auto;width:auto"
      aria-label="Which year to list">${years.map(y =>
      `<option value="${y}"${y === year ? ' selected' : ''}>${y}</option>`).join('')
      }<option value="all"${year === 'all' ? ' selected' : ''}>Every year</option></select>` : '';

  /* On a phone the A4 sheet is unreadable, so the figures are a list and the
     document itself is one tap away. */
  if(MOBILE()) return `${notes}${soon}
  <section class="panel">
    <header><h3>${esc(here.label)}</h3><span class="pill good"><span class="dt"></span>Released</span></header>
    <div class="mnet">
      <span>Total net pay</span>
      <b>AED ${money(s.net,2)}</b>
      <i>${s.paidDays} paid day${s.paidDays===1?'':'s'}${s.lop?` &middot; ${s.lop} LOP`:''} &middot; paid ${esc(s.payDate)}</i>
    </div>
    <div class="mlines">
      <h4>Earnings</h4>
      ${s.earn.map(([l,v])=>`<div class="mline"><span>${esc(l)}</span><b>${money(v,2)}</b></div>`).join('')}
      <div class="mline tot"><span>Gross earnings</span><b>${money(s.gross,2)}</b></div>
      <h4>Deductions</h4>
      ${s.ded.length ? s.ded.map(([l,v])=>`<div class="mline"><span>${esc(l)}</span><b>${money(v,2)}</b></div>`).join('')
        : `<div class="mline"><span style="color:var(--ink3)">None this month</span><b>&mdash;</b></div>`}
      <div class="mline tot"><span>Total deductions</span><b>${money(s.dedT,2)}</b></div>
    </div>
    <div class="pad">
      <button class="btn wide" id="slPrint" type="button">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:7px"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>Download as PDF</button>
    </div>
    <p class="cap">The full A4 payslip on ${esc(s.ent.legal)} letterhead. Amounts in AED.</p>
    <div class="slwrap printonly">${slipHTML(s)}</div>
  </section>
  ${mine.length > 1 ? `<section class="panel">
    <header><h3>All your payslips</h3><span class="hint">${mine.length} in all</span>${pick}</header>
    <div class="pad" style="display:flex;flex-direction:column;gap:8px">${shown.map(x => {
      const ss = slipOf(x.row, x.run);
      return `<button class="btn${x.key === here.key ? '' : ' ghost'} wide" data-mymonth="${esc(x.key)}"
        type="button" style="justify-content:space-between">${esc(x.label)}<b>AED ${money(ss.net,2)}</b></button>`;
    }).join('')}</div>
  </section>` : ''}`;

  return `${notes}${soon}
  <div class="strip tight">
    <div class="stat"><span class="k">${esc(here.label)}</span>
      <span class="v"><span class="cur">AED</span>${money(s.net,2)}</span>
      <span class="n">paid ${esc(s.payDate)}</span></div>
    <div class="stat"><span class="k">Earnings</span>
      <span class="v"><span class="cur">AED</span>${money(s.gross,2)}</span>
      <span class="n">${s.earn.length} line${s.earn.length===1?'':'s'}</span></div>
    <div class="stat"><span class="k">Deductions</span>
      <span class="v" style="color:var(--${s.dedT?'warn':'ink'})"><span class="cur">AED</span>${money(s.dedT,2)}</span>
      <span class="n">${s.ded.length?s.ded.map(d=>esc(d[0])).join(', '):'none this month'}</span></div>
    <div class="stat"><span class="k">Days paid</span><span class="v">${s.paidDays}</span>
      <span class="n">${s.lop?s.lop+' without pay':'a full month'}</span></div>
  </div>

  <section class="panel">
    <header><h3>Your payslips</h3><span class="hint">click a month to open the sheet</span>${pick}</header>
    <div class="tw"><table>
      <thead><tr><th>Month</th><th>Paid on</th><th class="r">Earnings</th>
        <th class="r">Deductions</th><th class="r">Net</th><th></th></tr></thead>
      <tbody>${shown.map(x => { const ss = slipOf(x.row, x.run);
        return '<tr class="sliprow' + (x.key === here.key ? ' on' : '') + '" data-myslip="' + esc(x.key) + '">'
          + '<td class="nw"><b>' + esc(x.label) + '</b></td>'
          + '<td class="n nw">' + esc(ss.payDate) + '</td>'
          + '<td class="n r">' + money(ss.gross,2) + '</td>'
          + '<td class="n r">' + (ss.dedT ? money(ss.dedT,2) : '&mdash;') + '</td>'
          + '<td class="n r netcol">' + money(ss.net,2) + '</td>'
          + '<td class="r"><button class="btn ghost" data-myslip="' + esc(x.key)
          + '" type="button" style="padding:3px 10px;font-size:12.5px">View</button></td></tr>';
      }).join('')}
      </tbody></table></div>
    <p class="cap">Every released month stays here${year && year !== 'all'
        ? ', and the year above chooses which of them the list shows' : ''}. The payslip opens on
      ${esc(s.ent.legal)} letterhead and can be printed or saved as a PDF from the
      window.${mine.length > 1 ? '' : ' From here on, every released month joins this list.'}</p>
  </section>`;
}

function vSlips(){
  const P = DATA.payroll;
  const runs = P.runs || [];
  const here = runs.find(r => r.key === state.payRun) || runs[0] || null;
  const released = here ? here.status === 'closed' : PAYST() === 'closed';
  const staff = (here ? here.rows : P.rows).filter(r=>!r.dummy);
  const co = state.payCompany;
  const rows = co==='all' ? staff : staff.filter(r=>r.company===co);
  const one = state.slipOpen ? staff.find(r=>r.id===state.slipOpen && (co==='all'||r.company===co)) : null;
  const pending = Object.keys(DATA.entities||{}).filter(c=>!(DATA.entities[c]||{}).ready);
  const noMaster = staff.filter(r=>!((DATA.master.people||{})[r.id]||{}).mol).length;
  return `
  <section class="panel">
    <header><h3>Payslips</h3>
      <span class="pill ${released?'good':'mute'}">${released?'<span class="dt"></span>Released to staff':'Held until the run is closed'}</span>
      <div class="seg" id="coSeg" style="margin-left:auto">
        <button data-co="all" aria-pressed="${co==='all'}" type="button">All</button>
        ${DATA.payroll.companies.map(c=>`<button data-co="${esc(c)}" aria-pressed="${co===c}" type="button">${esc(DATA.payroll.label[c]||c)}</button>`).join('')}
      </div>${runSeg()}<div style="display:none">
      </div>
      <span style="color:var(--ink3);font-size:12.5px">${rows.length} ${rows.length===1?'payslip':'payslips'}</span></header>
    <div class="pad" style="padding-bottom:10px">
      <p style="margin:0;color:var(--ink2);font-size:13.5px">Basic and Other Allowance come from each person's own <b>salary revision letter</b> where there is one on file, and fall back to the ${Math.round(DATA.master.basicPct*100)}/${100-Math.round(DATA.master.basicPct*100)} house split where there is not &mdash; ${Object.keys(DATA.master.parts||{}).length} of ${DATA.payroll.rows.filter(r=>!r.dummy).length} have a letter. Both are pro-rated to days worked. Every claim, air ticket, incentive, commission and referral appears as its own earnings line, and each deduction as its own line.</p>
      ${(pending.length||noMaster)?`<div class="note" style="margin-top:14px;border-left-color:var(--warn)">
        ${pending.length?`<b>${pending.map(c=>esc(DATA.payroll.label[c]||c)).join(' and ')} letterhead${pending.length>1?'s':''} not set.</b> Their payslips carry a placeholder until you send the legal name, address and P.O. box. `:''}
        ${noMaster?`<b>MOL ID and account number are missing for ${noMaster} of ${staff.length} people.</b> Upload the employee master once and both fill in on every payslip from then on.`:''}
      </div>`:''}
    </div>
    ${byCompany(rows, {
      code: r => r.company,
      cols: colsOf([31, 12, 15, 15, 15, 12]),
      note: rs => `net ${money(rs.reduce((a,r)=>a+slipOf(r).net,0),2)}`,
      head: `<thead><tr><th>Employee</th><th>Emp ID</th><th class="r">Gross</th><th class="r">Deductions</th><th class="r">Net</th><th></th></tr></thead>`,
      row: r => { const s = slipOf(r); return `<tr${state.slipOpen===r.id?' style="background:var(--panel2)"':''}>
        <td>${nm(r.name)}</td><td class="n">${esc(r.id)}</td>
        <td class="n r">${money(s.gross,2)}</td><td class="n r">${s.dedT?money(s.dedT,2):'&mdash;'}</td>
        <td class="n r netcol">${money(s.net,2)}</td>
        <td class="r"><button class="btn ghost" data-slip="${esc(r.id)}" type="button" style="padding:3px 10px;font-size:12.5px">View</button></td></tr>`; },
      foot: rs => `<tr class="tot"><td>${rs.length} ${rs.length===1?'person':'people'}</td><td></td>
        <td class="n r">${money(rs.reduce((a,r)=>a+slipOf(r).gross,0),2)}</td>
        <td class="n r">${money(rs.reduce((a,r)=>a+slipOf(r).dedT,0),2)}</td>
        <td class="n r netcol">${money(rs.reduce((a,r)=>a+slipOf(r).net,0),2)}</td><td></td></tr>`,
      empty: 'No payslips on this run.'
    })}
  </section>
  ${one?`<section class="panel">
    <header><h3>${esc(one.name)}</h3><span class="pill mute">${esc(one.id)}</span>
      <span class="pill mute" style="margin-left:auto">A4</span><button class="btn" id="slPrint" type="button" style="padding:6px 14px;font-size:13px">Print or save as PDF</button></header>
    <div class="slwrap">${slipHTML(slipOf(one))}</div>
  </section>`:''}`;
}

function vMyTicket(){
  const T = DATA.tickets;
  const me = T.employees.find(r=>r.portalName===state.user);
  if(!me) return `<section class="panel"><div class="pad" style="text-align:center;padding:52px 24px">
    <h3 style="font-size:20px;margin-bottom:8px">No air ticket record</h3>
    <p style="color:var(--ink2);max-width:52ch;margin:0 auto">You are not on the air ticket scheme, so nothing accrues here. If you think that is wrong, speak to accounts.</p>
  </div></section>`;
  const h = T.history[me.id] || T.history[me.name] || {rows:[], totalPaid:0, cycles:0, first:''};
  const air = (DATA.payroll.rows.find(p=>p.name===me.name)||{}).air || 0;
  const isDue = me.status==='Due This Month';
  const left = !!me.lwd;
  const statusLine = left ? 'You have left the firm — the balance below is settled on exit.'
    : me.status==='Remote — not eligible' ? (me.note||'Not currently accruing.')
    : isDue ? (air ? `Your ticket is due now and has been paid in the ${T.procMonth} payroll run.` : `Your ticket is due now and is being processed in the ${T.procMonth} run.`)
    : (me.lastPaid==='31 Aug 2026'
        ? `Your ticket was paid in the August 2026 payroll run. The next one falls due on ${me.next}, and is processed in the ${me.proc} run.`
        : `Your next ticket falls due on ${me.next}, and is processed in the ${me.proc} payroll run.`);
  return `
  <div class="strip">
    <div class="stat"><span class="k">Your allowance</span><span class="v"><span class="cur">AED</span>${money(me.rate,0)}</span>
      <span class="n">fixed rate for ${esc(me.country)}</span></div>
    <div class="stat"><span class="k">Next ticket due</span>
      <span class="v" style="font-size:22px;color:var(--${isDue?'accent2':'ink'})">${esc(me.next)||'—'}</span>
      <span class="n">${me.proc?'processed in the '+esc(me.proc)+' run':esc(me.status)}</span></div>
    <div class="stat"><span class="k">Tickets taken</span><span class="v">${h.rows.length}</span>
      <span class="n">${me.doj?'since you joined on '+esc(me.doj):'since you joined'}</span></div>
    <div class="stat"><span class="k">Not yet taken</span>
      <span class="v" style="color:var(--${me.pending?'bad':'good'})">${me.pending}</span>
      <span class="n">${me.pending?'worth AED '+money(me.backlog,0)+', still owed to you':'you are up to date'}</span></div>
  </div>

  <div class="grid g3 gtop">
    <section class="panel">
      <header><h3>Where you stand</h3>${isDue&&air?'<span class="pill good"><span class="dt"></span>Paid this month</span>':(me.lastPaid==='31 Aug 2026'?'<span class="pill good"><span class="dt"></span>Paid in August</span>':'')}</header>
      <div class="pad">
        <p style="font-size:15px;color:var(--ink);margin:0 0 16px">${esc(statusLine)}</p>
        <dl class="kv">
          <dt>Employee ID</dt><dd>${esc(me.id)}</dd>
          <dt>Home country</dt><dd style="font-family:inherit">${esc(me.country)}</dd>
          <dt>Date joined</dt><dd>${esc(me.doj)}</dd>
          <dt>Last ticket taken</dt><dd>${esc(me.lastPaid)||'—'}</dd>
          <dt>Unclaimed value</dt><dd>${me.backlog?money(me.backlog,2):'—'}</dd>
        </dl>
      </div>
    </section>

    <section class="panel">
      <header><h3>Your tickets so far</h3><span class="hint">what was actually paid</span></header>
      <div class="tw"><table>
        <thead><tr><th>Cycle</th><th>Date paid</th><th class="r">Amount</th></tr></thead>
        <tbody>${h.rows.length?h.rows.map(([y,d,v])=>`<tr><td class="n">${y}</td><td class="n">${esc(d)}</td>
          <td class="n r netcol">${money(v,2)}</td></tr>`).join(''):'<tr><td colspan="3" style="color:var(--ink3)">No tickets taken yet.</td></tr>'}
          ${h.rows.length?`<tr class="tot"><td>Total</td><td>${h.rows.length} ticket${h.rows.length===1?'':'s'}</td>
            <td class="n r netcol">${money(h.totalPaid,2)}</td></tr>`:''}
        </tbody></table></div>
      <p class="cap">Tickets up to May 2026 were reimbursed at the fare actually paid, which is why the older amounts vary.</p>
    </section>

    <section class="panel">
      <header><h3>How the scheme works</h3></header>
      <div class="pad"><dl class="kv wide">
        <dt>Entitlement</dt><dd>One ticket a year, first due 11 months after you join, every 12 months after that</dd>
        <dt>Amount</dt><dd>The fixed rate for your home country — AED ${money(me.rate,0)} for ${esc(me.country)} — whatever the fare</dd>
        <dt>How it reaches you</dt><dd>${esc(T.policyNote||'')}</dd>
        <dt>If you do not take it</dt><dd>${T.backlogLapses?'It lapses at the end of the cycle':'It does not lapse — it stays owed to you and is settled when you take it or when you leave'}</dd>
      </dl></div>
    </section>
  </div>`;
}

/* ---------- the emails the portal sends ---------- */
const DAYNAME = {Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday'};
const DAYIDX  = {Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6};
function MAILCFG(){
  const H = HR();
  if(!H.mail) H.mail = {to:['team@corplex.ae','team@poa.ae'], weeklyDay:'Mon', at:'08:00',
    skipEmpty:true, leaveOnApprove:true, leaveFirstDay:true, wfhFirstDay:true};
  return H.mail;
}
const DIG = MAILCFG;
function addDays(iso, n){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function mondayOf(iso){ const d=new Date(iso+'T00:00:00'); return addDays(iso, -(((d.getDay()+6)%7))); }
const dLong = iso => `${dayLong(iso)} ${dayLabel(iso)}`;

// everything that happens in one Mon–Sun week
function weekFor(mon){
  const H = HR(), G = MAILCFG();
  const days = [0,1,2,3,4,5,6].map(i=>addDays(mon,i));
  const work = days.filter(d=>!isWeekend(d));
  const roll = USERS.map(x=>x.name).filter(tracksAtt);
  const cels = celebsWithin(mon, 6);
  const hols = (H.holidays||[]).filter(h=>days.includes(h.d));
  // who is away, collapsed to one row per person per request
  const away = [];
  H.requests.filter(r=>r.status==='Approved' && roll.includes(r.who) && r.to>=mon && r.from<=days[6])
    .sort((a,b)=>a.from.localeCompare(b.from) || a.who.localeCompare(b.who))
    .forEach(r=>away.push({who:r.who, type:r.type, from:r.from, to:r.to,
      inWeek: work.filter(d=>d>=r.from && d<=r.to)}));
  const leave = away.filter(x=>x.type!=='WFH'), wfh = away.filter(x=>x.type==='WFH');
  const ann = (H.announcements||[]).filter(a=>a.date < mon && a.date >= addDays(mon,-7));
  const empty = !cels.length && !hols.length && !away.length && !ann.length;
  return {mon, days, work, roll, cels, hols, away, leave, wfh, ann, empty,
          skip: G.skipEmpty && empty};
}

/* ---- the email chrome ---- */
function mailShell(to, subject, body){
  return `<div class="mail">
    <div class="mhead">
      <div class="mrow"><span>To</span><b>${to}</b></div>
      <div class="mrow"><span>Subject</span><b>${subject}</b></div>
    </div>
    <div class="mbody">
      <div class="mbrand">CorpLex Group<em>CorpLex &middot; POA &middot; Lex Estates</em></div>
      ${body}
      <p class="mfoot">Sent by the staff portal. Nothing in a team email is confidential &mdash; no salaries, no reasons for leave, no documents.</p>
    </div>
  </div>`;
}
const sec = (t, b) => b ? `<div class="dsec"><h4>${t}</h4>${b}</div>` : '';
const TEAMTO = () => MAILCFG().to.map(esc).join(', ');

/* ---- the weekly email ---- */
function weeklyHTML(mon){
  const g = weekFor(mon), span = `${dayLabel(mon)} to ${dayLabel(addDays(mon,4))}`;
  const dayIn = iso => { const n = Math.round((new Date(iso+'T00:00:00')-new Date(mon+'T00:00:00'))/86400000);
    return n>=0 && n<=6 ? dayLong(iso) : dayLabel(iso); };

  const celBits = g.cels.map(c=>{
    const b = c.bdays.map(x=>`<p class="dcel"><span>${cmark('cake',20)}</span><b>${nm(x.n)}</b>'s birthday &mdash; ${esc(dayIn(c.d))} ${esc(dayLabel(c.d))}</p>`);
    const a = c.annis.map(x=>`<p class="dcel"><span>${cmark('medal',20)}</span><b>${nm(x.n)}</b> reaches <b>${x.years} year${x.years===1?'':'s'}</b> with ${esc(companyOf(x.n).name)} &mdash; ${esc(dayIn(c.d))} ${esc(dayLabel(c.d))}</p>`);
    return b.concat(a).join('');
  }).join('');

  const awayBody = g.away.length ? `<table class="dtab">
      ${g.leave.map(x=>`<tr><td><b>${nm(x.who)}</b></td><td>${esc(reqLabel(x.type))}</td>
        <td class="r">${x.inWeek.length===g.work.length ? 'all week'
          : x.inWeek.length===1 ? esc(dayIn(x.inWeek[0]))
          : esc(dayIn(x.inWeek[0]))+' to '+esc(dayIn(x.inWeek[x.inWeek.length-1]))}</td></tr>`).join('')}
      ${g.wfh.map(x=>`<tr><td><b>${nm(x.who)}</b></td><td>Working from home</td>
        <td class="r">${x.inWeek.map(d=>esc(dayLong(d))).join(', ')||'&mdash;'}</td></tr>`).join('')}
    </table>` : `<p class="dnote">Nobody is booked off. All ${g.roll.length} in as normal.</p>`;

  const holBody = g.hols.length ? `<ul class="dlist">${g.hols.map(h=>
    `<li><b>${esc(h.n)}</b> &mdash; ${esc(dLong(h.d))}${h.fixed?'':', still to be confirmed'}. The office is closed.</li>`).join('')}</ul>` : '';

  const annBody = g.ann.length ? g.ann.map(a=>
    `<p class="dann"><b>${esc(a.title)}</b><br>${esc(a.body)}</p><p class="dnote">Posted by ${esc(a.by)} on ${esc(dayLabel(a.date))}.</p>`).join('') : '';

  const body = g.empty
    ? `<p class="dnote">Nothing in the diary this week &mdash; no leave, no birthdays, no holidays.${MAILCFG().skipEmpty?' On a week like this the email is not sent at all.':''}</p>`
    : sec('Birthdays and anniversaries', celBits) + sec('Who is away', awayBody)
      + sec('Public holidays', holBody) + sec('Since last week', annBody);

  return mailShell(TEAMTO(), `The week ahead &mdash; ${esc(span)}`, body);
}

/* ---- sample people for the previews, taken from the real data ---- */
function sampleBday(){ const c = celebsWithin(HDATE(), 60).find(x=>x.bdays.length); return c ? {n:c.bdays[0].n, d:c.d} : null; }
function sampleAnni(){ const c = celebsWithin(HDATE(), 120).find(x=>x.annis.length); return c ? Object.assign({d:c.d}, c.annis[0]) : null; }
function sampleReq(kind){
  const roll = USERS.map(x=>x.name);
  const rs = HR().requests.filter(r=>roll.includes(r.who) && (kind==='WFH' ? r.type==='WFH' : r.type!=='WFH'));
  return rs.sort((a,b)=>a.from.localeCompare(b.from)).find(r=>r.to>=HDATE()) || rs[0] || null;
}

/* ---- one function per email ---- */
function mailHTML(m, wk){
  const first = n => esc(String(n).split(' ')[0]);
  const B = sampleBday(), A = sampleAnni();
  const L = sampleReq('leave'), W = sampleReq('WFH');
  const days = r => r ? (r.from===r.to ? dLong(r.from) : `${dLong(r.from)} to ${dLong(r.to)}`) : '';
  const P = t => `<p class="dpara">${t}</p>`;

  switch(m.id){
    case 'weekly': return weeklyHTML(wk);

    case 'bday-me': return !B ? empt() : mailShell(esc(B.n)+' &lt;'+esc((PROF(B.n)||{}).pemail || 'their work email')+'&gt;',
      'Happy birthday, '+first(B.n),
      `<div class="dsec"><h4>${esc(dLong(B.d))}</h4>
        <p class="dcel"><span>${cmark('cake',20)}</span>Happy birthday from everyone at CorpLex, POA and Lex Estates.</p></div>
      ${P(`You have <b>half a day</b> of birthday leave and today is the only day you can take it. If you have not booked it yet, open <b>Leave &amp; WFH</b> in the portal and it takes about ten seconds.`)}
      ${P(`Have a good one.`)}`);

    case 'bday-team': return !B ? empt() : mailShell(TEAMTO(), `It is ${esc(B.n)}'s birthday today`,
      `<div class="dsec"><h4>${esc(dLong(B.d))}</h4>
        <p class="dcel"><span>${cmark('cake',20)}</span>It is <b>${esc(B.n)}</b>'s birthday today &mdash; ${esc(companyOf(B.n).name)}${orgDeptOf(B.n)?', '+esc(orgDeptOf(B.n)):''}.</p></div>
      ${P(`Say something if you see ${first(B.n)} today. ${first(B.n)} may be taking the birthday half-day, so it might have to be a message.`)}`);

    case 'anni-me': return !A ? empt() : mailShell(esc(A.n)+' &lt;their work email&gt;',
      `${A.years} year${A.years===1?'':'s'} with ${esc(companyOf(A.n).name)}`,
      `<div class="dsec"><h4>${esc(dLong(A.d))}</h4>
        <p class="dcel"><span>${cmark('medal',20)}</span>Today you have been with <b>${esc(companyOf(A.n).name)}</b> for <b>${A.years} year${A.years===1?'':'s'}</b>.</p></div>
      ${P(`You joined on <b>${esc(A.doj)}</b>. Thank you for the ${A.years} year${A.years===1?'':'s'} &mdash; here is to the next one.`)}`);

    case 'anni-team': return !A ? empt() : mailShell(TEAMTO(), `${esc(A.n)} &mdash; ${A.years} year${A.years===1?'':'s'} today`,
      `<div class="dsec"><h4>${esc(dLong(A.d))}</h4>
        <p class="dcel"><span>${cmark('medal',20)}</span><b>${esc(A.n)}</b> reaches <b>${A.years} year${A.years===1?'':'s'}</b> with ${esc(companyOf(A.n).name)} today.</p></div>
      ${P(`Joined ${esc(A.doj)}.`)}`);

    case 'req-new': return !L ? empt() : mailShell(nm2(mgrName(L.who) || 'The manager')+' &lt;their work email&gt;',
      `${esc(L.who)} has asked for ${esc(reqLabel(L.type).toLowerCase())}`,
      `${P(`<b>${esc(L.who)}</b> has asked for <b>${esc(reqLabel(L.type).toLowerCase())}</b>.`)}
      <table class="dtab">
        <tr><td>Dates</td><td class="r"><b>${esc(days(L))}</b></td></tr>
        <tr><td>Working days</td><td class="r"><b>${L.days}</b></td></tr>
        <tr><td>Reason</td><td class="r">${esc(L.why||'not given')}</td></tr>
      </table>
      ${P(`Approve or decline it on the <b>Leave &amp; WFH</b> page. Nothing is announced to anyone until you decide.`)}`);

    case 'leave-ok': return !L ? empt() : mailShell(esc(L.who)+' &lt;their work email&gt;',
      `Your ${esc(reqLabel(L.type).toLowerCase())} is approved`,
      `${P(`<b>${nm2(mgrName(L.who) || 'Your manager')}</b> has approved your ${esc(reqLabel(L.type).toLowerCase())}.`)}
      <table class="dtab">
        <tr><td>Dates</td><td class="r"><b>${esc(days(L))}</b></td></tr>
        <tr><td>Working days</td><td class="r"><b>${L.days}</b></td></tr>
        ${usesPool(L.type)?`<tr><td>Annual leave left after this</td><td class="r"><b>${money(Math.max(0,leaveBal(L.who).left),2)} days</b></td></tr>`:''}
        ${isUnpaid(L.type)?`<tr><td>On your payslip</td><td class="r">${L.days} LOP day${L.days===1?'':'s'}</td></tr>`:''}
      </table>
      ${P(`Accounts has been told, so your payslip will be right. The team is told separately &mdash; your reason is not.`)}`);

    case 'leave-no': return !L ? empt() : mailShell(esc(L.who)+' &lt;their work email&gt;',
      `Your ${esc(reqLabel(L.type).toLowerCase())} request was declined`,
      `${P(`<b>${nm2(mgrName(L.who) || 'Your manager')}</b> has declined your request for ${esc(reqLabel(L.type).toLowerCase())} on <b>${esc(days(L))}</b>.`)}
      ${P(`Nothing has come off your balance and nobody else has been told. Talk to ${first(mgrName(L.who)||'your manager')} about other dates.`)}`);

    case 'leave-team': return !L ? empt() : mailShell(TEAMTO(),
      `${esc(L.who)} is off ${esc(dayLabel(L.from))}${L.from!==L.to?' to '+esc(dayLabel(L.to)):''}`,
      `${P(`<b>${esc(L.who)}</b> has approved leave.`)}
      <table class="dtab">
        <tr><td>Dates</td><td class="r"><b>${esc(days(L))}</b></td></tr>
        <tr><td>Working days</td><td class="r"><b>${L.days}</b></td></tr>
        <tr><td>Back at their desk</td><td class="r"><b>${esc(dLong(nextWorkday(L.to)))}</b></td></tr>
      </table>
      ${P(`Plan around it. The kind of leave and the reason are not shown here.`)}`);

    case 'leave-day1': return !L ? empt() : mailShell(TEAMTO(), `${esc(L.who)} is out today`,
      `<div class="dsec"><h4>${esc(dLong(L.from))}</h4>
      ${P(`<b>${esc(L.who)}</b> is on leave from today${L.from!==L.to?` until <b>${esc(dayLabel(L.to))}</b>`:''} and is back at their desk on <b>${esc(dLong(nextWorkday(L.to)))}</b>.`)}</div>
      ${P(`Anything urgent goes to <b>${nm2(mgrName(L.who) || 'their manager')}</b> while they are away.`)}`);

    case 'wfh-ok': return !W ? empt() : mailShell(esc(W.who)+' &lt;their work email&gt;',
      'Your work from home is approved',
      `${P(`<b>${nm2(mgrName(W.who) || 'Your manager')}</b> has approved you working from home on <b>${esc(days(W))}</b>.`)}
      ${P(`It counts as a normal working day, so nothing comes off your leave balance and your payslip is unaffected. <b>Still check in</b> from the portal that morning &mdash; pick <b>Home</b> instead of Office.`)}`);

    case 'wfh-day1': return !W ? empt() : mailShell(TEAMTO(), `${esc(W.who)} is working from home today`,
      `<div class="dsec"><h4>${esc(dLong(W.from))}</h4>
      ${P(`<b>${esc(W.who)}</b> is working from home today${W.from!==W.to?` and until <b>${esc(dayLabel(W.to))}</b>`:''}. Reachable as normal &mdash; just not at their desk.`)}</div>`);

    case 'pay-sub': return (() => { const M = MKEY(DATA.payroll.monthKey || nextRunKey() || '2026-01');
      return mailShell('Miraziz Makhamatzhanov &lt;his work email&gt;',
      `${esc(M)} payroll needs your approval`,
      `${P(`Avin has submitted the <b>${esc(M)}</b> payroll.`)}
      <table class="dtab">
        <tr><td>People</td><td class="r"><b>${DATA.payroll.rows.length}</b></td></tr>
        <tr><td>Companies</td><td class="r">CorpLex, POA and Lex Estates</td></tr>
        <tr><td>Total net</td><td class="r"><b>AED ${money(DATA.payroll.rows.reduce((s,r)=>s+r.net,0),2)}</b></td></tr>
      </table>
      ${P(`Open <b>Payroll</b> in the accounts console to approve it or send it back with a note. Payslips stay hidden from staff until you approve and Avin releases the payment.`)}`); })();

    case 'pay-back': return (() => { const M = MKEY(DATA.payroll.monthKey || nextRunKey() || '2026-01');
      return mailShell('Avin Mascarenhas &lt;his work email&gt;',
      `Miraziz sent the ${esc(M)} payroll back`,
      `${P(`Miraziz has sent the <b>${esc(M)}</b> payroll back rather than approving it.`)}
      ${P(`<b>His note:</b> “Check Fakhridin &mdash; he moved to Lex this month, the recharge looks wrong.”`)}
      ${P(`Fix it and submit again. Nothing has been paid and no payslip is visible to anyone.`)}`); })();

    case 'slip': return mailShell('Each person, their own &lt;work email&gt;',
      `Your ${esc(DATA.payroll.month)} payslip is ready`,
      `${P(`Your payslip for <b>${esc(DATA.payroll.month)}</b> is on the portal now, under <b>My payslip</b>. You can read it there or save it as a PDF.`)}
      ${P(`The payment has been released to your account. If anything on it looks wrong, come to Avin before the end of the week.`)}
      ${P(`No figures are put in this email &mdash; you have to sign in to see them.`)}`);

    case 'adv-new': return mailShell('Avin Mascarenhas or Miraziz Makhamatzhanov &lt;work email&gt;',
      'An advance needs your approval',
      `${P(`<b>Maylyn Aguba Asilo</b> has asked for an advance.`)}
      <table class="dtab">
        <tr><td>Amount</td><td class="r"><b>AED 2,500.00</b></td></tr>
        <tr><td>Repayment</td><td class="r"><b>5 months at 500.00</b></td></tr>
        <tr><td>Reason</td><td class="r">Flight for a family emergency</td></tr>
        <tr><td>Goes to</td><td class="r">Avin &mdash; it is under AED ${money(LOANCAP(),0)}</td></tr>
      </table>
      ${P(`Anything at AED ${money(LOANCAP(),0)} or above goes to Miraziz instead. Decide it on the <b>Advances</b> page.`)}`);

    case 'adv-ok': return mailShell('Maylyn Aguba Asilo &lt;her work email&gt;',
      'Your advance is approved',
      `${P(`Your advance of <b>AED 2,500.00</b> is approved and will be paid with this month's salary.`)}
      ${P(`It comes back at <b>AED 500.00 a month for 5 months</b>, taken from your payslip as a deduction, starting next month. You can see the running balance on the <b>Advances</b> page any time.`)}`);

    case 'doc': return mailShell('Accounts, and the person &lt;work email&gt;',
      'Your residence visa expires in 30 days',
      `${P(`Your <b>residence visa</b> expires on <b>25 October 2026</b> &mdash; 30 days from today.`)}
      ${P(`Accounts has the same reminder, so renewal is already in hand. Nothing for you to do unless they ask you for something.`)}
      ${P(`Reminders go out at 90, 60, 30 and 7 days, and then every day once a document has actually expired.`)}`);

    case 'ltr': return mailShell('Nissa Muradova &lt;her work email&gt;',
      'Your salary certificate is ready',
      `${P(`Your <b>salary certificate</b>, addressed to <b>Emirates NBD</b>, has been issued and is on the portal under <b>Letters</b>.`)}
      ${P(`Open it there and print it or save it as a PDF. Ask Avin if the bank wants it stamped.`)}`);

    case 'ticket': return mailShell('Each person, their own &lt;work email&gt;',
      'Your air ticket is in this month\'s payroll',
      `${P(`Your annual air ticket allowance of <b>AED 2,500.00</b> is included in this month's payroll and will show as its own line on your payslip.`)}
      ${P(`The rate is fixed for your home country, whatever the fare you actually pay. Your next one falls due in twelve months.`)}`);

    case 'rev': return (()=>{
      const L = (HR().letters||[]).filter(x=>x.type==='revision')
        .sort((a,b)=>(b.decided||b.asked).localeCompare(a.decided||a.asked))[0];
      if(!L) return empt();
      return mailShell(esc(L.who)+' &lt;their work email&gt;', 'Your salary has been revised',
      `${P(`Your salary has been revised with effect from <b>${esc(effLabel(L.eff))}</b>.`)}
      <table class="dtab">
        <tr><td>Basic</td><td class="r"><b>${money(L.basic||0,2)}</b></td></tr>
        <tr><td>Other Allowance</td><td class="r"><b>${money(L.allow||0,2)}</b></td></tr>
        <tr><td>Total</td><td class="r"><b>AED ${money(L.salary||0,2)}</b></td></tr>
      </table>
      ${P(`The signed letter is on the portal under <b>Letters</b> &mdash; open it there and print or save it as a PDF.`)}
      ${P(`All other terms of your employment are unchanged. Nobody else is told; this one is between you and accounts.`)}`);
    })();

    case 'exit': return mailShell('Avin Mascarenhas and Miraziz Makhamatzhanov &lt;work email&gt;',
      'Final settlement ready for checking',
      `${P(`A last working day has been entered, so the portal has worked out the final settlement &mdash; gratuity, untaken leave, any unclaimed air ticket, less any advance still running.`)}
      ${P(`It is a calculation and a checklist, not a payment. Open <b>Exits</b> in the accounts console to check it before anything is paid.`)}`);
  }
  return empt();
}
function empt(){ return `<p class="dnote">Nothing in the sample data to build this one from yet.</p>`; }
function nextWorkday(iso){ let d = addDays(iso,1); let n=0; while((isWeekend(d)||holOn(d)) && n<10){ d=addDays(d,1); n++; } return d; }

const MAILS = [
  {id:'weekly',     grp:'Every week',      name:'The week ahead',              to:'Both team addresses', when:'Monday 08:00',
   note:'This is the only email on a timer. Everything else below is sent by something happening.'},

  {id:'bday-me',    grp:'Birthdays and anniversaries', name:'Happy birthday',   to:'The person',          when:'On the day, 08:00'},
  {id:'bday-team',  grp:'Birthdays and anniversaries', name:'It is someone’s birthday', to:'Both team addresses', when:'On the day, 08:00',
   note:'Anyone who ticks <b>do not announce my birthday</b> on their profile is left out of this one, out of the home page and out of the weekly email. They still get their own wish and their half-day.'},
  {id:'anni-me',    grp:'Birthdays and anniversaries', name:'Your work anniversary', to:'The person',     when:'On the day, 08:00'},
  {id:'anni-team',  grp:'Birthdays and anniversaries', name:'Anniversary notice', to:'Both team addresses', when:'On the day, 08:00'},

  {id:'req-new',    grp:'Leave and working from home', name:'A request needs deciding', to:'The manager', when:'The moment it is sent',
   note:'Only the manager gets this. Nobody else knows a request exists until it is approved.'},
  {id:'leave-ok',   grp:'Leave and working from home', name:'Your leave is approved', to:'The person',    when:'The moment it is decided'},
  {id:'leave-no',   grp:'Leave and working from home', name:'Your request was declined', to:'The person', when:'The moment it is decided'},
  {id:'leave-team', grp:'Leave and working from home', name:'Leave booked',      to:'Both team addresses', when:'When it is approved'},
  {id:'leave-day1', grp:'Leave and working from home', name:'Out today',         to:'Both team addresses', when:'First morning, 08:00'},
  {id:'wfh-ok',     grp:'Leave and working from home', name:'Working from home approved', to:'The person', when:'When it is approved'},
  {id:'wfh-day1',   grp:'Leave and working from home', name:'Working from home today', to:'Both team addresses', when:'That morning, 08:00'},

  {id:'pay-sub',    grp:'Payroll and money', name:'Payroll needs approving',     to:'Miraziz',            when:'When Avin submits it'},
  {id:'pay-back',   grp:'Payroll and money', name:'Payroll sent back',           to:'Avin',               when:'When Miraziz returns it'},
  {id:'slip',       grp:'Payroll and money', name:'Your payslip is ready',       to:'Each person',        when:'When payslips are released'},
  {id:'ticket',     grp:'Payroll and money', name:'Air ticket in this run',      to:'The person',         when:'When it goes into payroll'},
  {id:'adv-new',    grp:'Payroll and money', name:'An advance needs approving',  to:'Avin or Miraziz',    when:'The moment it is asked for'},
  {id:'adv-ok',     grp:'Payroll and money', name:'Your advance is approved',    to:'The person',         when:'When it is decided'},

  {id:'doc',        grp:'Documents and exits', name:'A document is expiring',    to:'Accounts and the person', when:'90, 60, 30 and 7 days out'},
  {id:'ltr',        grp:'Documents and exits', name:'Your letter is ready',      to:'The person',         when:'When it is issued'},
  {id:'rev',        grp:'Documents and exits', name:'Your salary has been revised', to:'The person',       when:'When accounts issues it',
   note:'Nobody else is told. It does not go in the weekly email and it is not announced to the team.'},
  {id:'exit',       grp:'Documents and exits', name:'Final settlement to check', to:'Accounts',           when:'When a last working day is entered'}
];

function vDigest(){
  const G = MAILCFG(), sel = state.mailPick || 'weekly';
  const m = MAILS.find(x=>x.id===sel) || MAILS[0];
  const groups = [...new Set(MAILS.map(x=>x.grp))];
  const wk = state.mailWeek || mondayOf(HDATE());
  const weeks = [0,1,2,3].map(i=>addDays(mondayOf(HDATE()), i*7));

  return `
  <div class="strip">
    <div class="stat"><span class="k">The weekly email</span><b class="v">${esc(DAYNAME[G.weeklyDay]||'Monday')} ${esc(G.at)}</b><span class="s">the week ahead, to the whole team</span></div>
    <div class="stat"><span class="k">Team addresses</span><b class="v">${G.to.length}</b><span class="s">${G.to.map(esc).join(' &middot; ')}</span></div>
    <div class="stat"><span class="k">Other emails</span><b class="v">${MAILS.length-1}</b><span class="s">sent as things happen, not on a timer</span></div>
    <div class="stat"><span class="k">Cost</span><b class="v">Nothing</b><span class="s">well inside the free tier of 100 a day</span></div>
  </div>

  <div class="grid g2" style="grid-template-columns:minmax(300px,360px) minmax(0,1fr);align-items:start">
    <div class="col">
      <section class="panel">
        <header><h3>Every email the portal sends</h3><span class="hint">pick one to read it</span></header>
        <div class="mlist">
          ${groups.map(g=>`<div class="mgrp">${esc(g)}</div>` + MAILS.filter(x=>x.grp===g).map(x=>`
            <button type="button" data-mail="${x.id}" aria-pressed="${x.id===sel}"${x.off?' class="off"':''}>
              <b>${nm(x.name)}</b>
              <em>${esc(x.to)} &middot; ${esc(x.when)}</em>
            </button>`).join('')).join('')}
        </div>
        <p class="cap">Emails marked to <b>both team addresses</b> go to the two group lists, so nobody is picked out individually and nothing personal is ever in them.</p>
      </section>

      <section class="panel">
        <header><h3>Settings</h3></header>
        <div class="pad">
          ${G.to.map((a,i)=>`<div class="field"><label for="dg${i}">Team address ${i+1}</label>
            <input id="dg${i}" data-dg="${i}" value="${esc(a)}" placeholder="team@company.ae"></div>`).join('')}
          <p class="note" style="margin:2px 0 16px"><b>Send me your two real team addresses</b> and I will put them in. Everything above is a placeholder.</p>
          <div class="field"><label for="dgDay">The weekly email goes out on</label>
            <select id="dgDay">${['Mon','Tue','Wed','Thu','Fri','Sun'].map(d=>`<option value="${d}"${G.weeklyDay===d?' selected':''}>${DAYNAME[d]} at ${esc(G.at)}</option>`).join('')}</select></div>
          <label class="pfchk"><input type="checkbox" id="mkA"${G.leaveOnApprove?' checked':''}><span>Tell the team as soon as leave is approved</span></label>
          <label class="pfchk"><input type="checkbox" id="mkB"${G.leaveFirstDay?' checked':''}><span>Tell the team again on the first morning of the leave</span></label>
          <label class="pfchk"><input type="checkbox" id="mkC"${G.wfhFirstDay?' checked':''}><span>Tell the team on the morning someone works from home</span></label>
          <label class="pfchk"><input type="checkbox" id="mkD"${G.skipEmpty?' checked':''}><span>Skip the weekly email in a week with nothing in it</span></label>
          <p class="cap" style="padding:14px 0 0;margin-top:14px">With the first two both on, a booked week of leave is announced three times &mdash; on approval, on the first morning, and in that week's email. That is deliberate, but the first one is the easiest to drop if it starts to feel like noise.</p>
        </div>
      </section>
    </div>

    <section class="panel">
      <header><h3>${esc(m.name)}</h3><span class="hint">${esc(m.to)} &middot; ${esc(m.when)}</span></header>
      <div class="pad">
        ${sel==='weekly' ? `<div class="dseg" id="digDays">${weeks.map(w=>{
          const g = weekFor(w), lbl = w===mondayOf(HDATE()) ? 'This week' : w===addDays(mondayOf(HDATE()),7) ? 'Next week' : dayLabel(w);
          return `<button type="button" data-dd="${w}" aria-pressed="${w===wk}"${g.skip?' class="off"':''}>
            <b>${esc(lbl)}</b><em>${esc(dayLabel(w).split(' ')[0])}&ndash;${esc(dayLabel(addDays(w,4)))}</em>
            ${g.cels.length?'<i class="cel"></i>':''}</button>`;}).join('')}</div>` : ''}
        ${mailHTML(m, wk)}
        ${m.note?`<p class="cap" style="padding:16px 0 0;margin-top:16px">${m.note}</p>`:''}
      </div>
    </section>
  </div>`;
}

const JF = () => state.jf || (state.jf = {name:'', legal:'', email:'', email2:'',
  doj:'', staffNo:'', company:'corplex', visa:'', paidBy:'', title:'', dept:'',
  manager:'', basis:'salaried', basic:'', allow:'', shift:'S2', country:'', rate:'',
  noTicket:false});

// Why the button is off. A disabled control that will not say what it wants is
// the most irritating thing a form can do.
function jWhy(){
  const f = JF();
  if(!f.name.trim())                       return 'A name, first.';
  if(!f.doj)                               return 'And a joining date.';
  if(f.email.trim() !== f.email2.trim())   return 'The two addresses do not match.';
  if(f.basis !== 'commission' && !(+f.basic > 0))
                                           return 'A salaried joiner needs a basic. Choose commission only if they have none.';
  if(!f.noTicket && !f.country.trim())     return 'Home country, or tick that there is no ticket entitlement.';
  return '';
}
const jReady = () => !jWhy();

// Probation still running, soonest to lapse first.
function PROB(){
  const p = HR().probation || {}, j = HR().joined || {}, t = HR().today;
  return Object.keys(p).filter(n => !p[n].confirmed && p[n].until >= t && !(HR().left||{})[n])
    .map(n => ({who:n, until:p[n].until, doj:j[n] || '',
      days: Math.round((new Date(p[n].until) - new Date(t)) / 86400000)}))
    .filter(x => x.doj)
    .sort((a,b) => a.until.localeCompare(b.until));
}

/* Three states, and the middle one is the point: a workbook that has been read
 * and not yet written. */
function vSalesUpload(){
  const aed = v => 'AED ' + Math.round(v || 0).toLocaleString('en-AE');
  /* How many invoices the portal holds for a year. The blob is Corporate &
   * Legal with Accounting & Tax riding along as atDept, so a year's count is
   * the two added — reading only the first said 354 where the workbook says
   * 499, which makes a replacement warning look like a mistake. */
  const held = y => {
    const f = (DATA.yearFigures || {})[String(y)];
    if(!f || !f.totals) return null;
    return {count: (f.totals.count || 0) + ((f.atDept && f.atDept.totals && f.atDept.totals.count) || 0)};
  };

  const names = list => list && list.length
    ? `<div class="upnames">${list.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : '';

  // What the portal already holds, and where it came from. A figure whose
  // provenance is a shrug is a figure nobody can check.
  const history = () => {
    const years = Object.keys(DATA.yearFigures || {}).sort().reverse();
    const up = DATA.uploads || [];
    return `
      <div class="tw" style="margin-top:18px"><table>
        <thead><tr><th>Year</th><th class="r">Invoices held</th><th>Last uploaded</th><th>By</th><th>From</th></tr></thead>
        <tbody>${years.length ? years.map(y => {
          const t = held(y) || {count: 0};
          const u = up.find(x => String(x.year) === y);
          return `<tr><td class="n">${esc(y)}</td><td class="n r">${t.count || 0}</td>
            <td>${u ? esc(u.at) : '<span style="color:var(--ink3)">before this screen existed</span>'}</td>
            <td>${u && u.by ? esc(u.by) : '<span style="color:var(--ink3)">&mdash;</span>'}</td>
            <td>${u && u.file ? esc(u.file) : '<span style="color:var(--ink3)">&mdash;</span>'}</td></tr>`;
        }).join('') : `<tr><td colspan="5" style="color:var(--ink3)">No sales year is loaded.</td></tr>`}
        </tbody></table></div>
      <p class="cap" style="padding-left:0">Everything on every sales screen is worked out from these rows. Uploading a year replaces that year and nothing else.</p>`;
  };

  // ---- after the write: what the database made of it
  const d = state.supDone;
  if(d) return `
    <div class="upmsg ${d.unmatched && d.unmatched.length ? 'warn' : 'good'}">
      <b>${esc(String(d.year))} replaced.</b> ${d.rows} rows from ${d.invoices || d.rows} invoices &mdash;
      ${aed(d.invoiced)} invoiced, ${aed(d.net)} net, ${aed(d.eligible)} eligible.
      ${esc(d.note || '')}
      ${names(d.unmatched)}
    </div>
    <div class="upact"><button class="btn" id="supAgain" type="button">Upload another year</button></div>
    ${history()}`;

  // ---- read, and waiting to be agreed to
  const s = state.sup;
  if(s){
    const now = held(s.year);
    return `
      <div class="upfile">
        <b>${esc(s.file)}</b>
        <span>${s.invoices} invoices &middot; ${s.rows} rows &middot; ${s.clients} clients &middot; year ${esc(String(s.year))}</span>
      </div>
      <div class="strip" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat"><span class="k">Invoiced</span><span class="v">${aed(s.inv)}</span><span class="n">excluding VAT, after credit notes</span></div>
        <div class="stat"><span class="k">Net sales</span><span class="v">${aed(s.net)}</span><span class="n">after cost and partner commission</span></div>
        <div class="stat"><span class="k">Eligible</span><span class="v">${aed(s.elig)}</span><span class="n">settled and paid on time</span></div>
      </div>
      ${s.byDept.length > 1 ? `<div class="tw" style="margin-top:16px"><table>
        <thead><tr><th>Department</th><th class="r">Invoices</th><th class="r">Invoiced</th><th class="r">Net</th><th class="r">Eligible</th></tr></thead>
        <tbody>${s.byDept.map(x => `<tr><td>${esc(x.department)}</td><td class="n r">${x.totals.count}</td>
          <td class="n r">${aed(x.totals.inv)}</td><td class="n r">${aed(x.totals.net)}</td>
          <td class="n r">${aed(x.totals.elig)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${s.unmatched.length ? `<div class="upmsg warn">
        <b>${s.unmatched.length} name${s.unmatched.length === 1 ? '' : 's'} on this workbook match nobody on the staff list.</b>
        Their invoices still count towards the company totals, but they will not appear on anybody's
        own page or leaderboard. Either the spelling differs from the staff record, or the person
        was never added.${names(s.unmatched)}</div>` : `<div class="upmsg good">
        <b>Every name on this workbook matches somebody on the staff list.</b> Nothing will be filed under nobody.</div>`}
      ${s.voided ? `<div class="upmsg warn"><b>${s.voided} invoice${s.voided === 1 ? ' has' : 's have'} no amount</b> &mdash;
        a date, a client and a salesperson, and nothing invoiced. They are carried across as they
        are, counted as void rather than dropped.</div>` : ''}
      ${(() => {
        // The void invoices have their own line above; repeating them here as
        // forty table rows buries the button under a list of things already said.
        const rest = s.problems.filter(p => !/^Void or cancelled/.test(p.what));
        if(!rest.length) return '';
        return `<div class="tw" style="margin-top:16px"><table>
          <thead><tr><th>Row</th><th>Invoice</th><th>What the reader could not settle</th></tr></thead>
          <tbody>${rest.slice(0, 30).map(p => `<tr><td class="n">${p.row}</td>
            <td class="n">${esc(p.invoice || '—')}</td>
            <td>${esc(p.what)}${p.detail && p.detail !== p.invoice ? ' &mdash; ' + esc(p.detail) : ''}</td></tr>`).join('')}
          </tbody></table></div>
          ${rest.length > 30 ? `<p class="cap" style="padding-left:0">and ${rest.length - 30} more of the same kinds</p>` : ''}`;
      })()}
      <div class="upmsg${now ? ' warn' : ''}">${now
        ? `<b>${esc(String(s.year))} is already loaded &mdash; ${now.count} invoices.</b> Uploading replaces that year
           whole, in one go: anything the portal holds for ${esc(String(s.year))} and this workbook does not
           will be gone. Every other year is untouched.`
        : `<b>${esc(String(s.year))} is not loaded yet.</b> This adds it. Every other year is untouched.`}</div>
      <div class="upact">
        <button class="btn" id="supGo" type="button" ${state.supBusy ? 'disabled' : ''}>${
          state.supBusy ? 'Writing&hellip;' : 'Replace ' + esc(String(s.year))}</button>
        <button class="btn ghost" id="supCancel" type="button" ${state.supBusy ? 'disabled' : ''}>Cancel</button>
        <span class="why">Nothing has been written yet.</span>
      </div>`;
  }

  // ---- nothing chosen
  return `
    <div class="drop">
      <div class="big">Choose the sales workbook</div>
      <div style="margin-bottom:14px">.xlsx &mdash; the portal reads the <b>Sales Data</b>,
        <b>Employee Master</b>, <b>Company Master</b> and <b>Commission Rules</b> sheets and works
        the commission out itself, here in this browser. The file is not sent anywhere; only the
        finished figures are.</div>
      <input type="file" id="supFile" accept=".xlsx,.xlsm,.xls" hidden>
      <button class="btn" id="supPick" type="button" ${state.supBusy ? 'disabled' : ''}>${
        state.supBusy ? 'Reading&hellip;' : 'Choose file'}</button>
    </div>
    ${state.supErr ? `<div class="upmsg"><b>That workbook could not be read.</b> ${esc(state.supErr)}</div>` : ''}
    ${history()}`;
}

function vAdmin(){
  // The sales roster, filtered to one entity when a company is chosen. Somebody
  // who has left keeps the company they left from, which is what makes a
  // year-to-date figure add up.
  const staff = USERS.map(u=>u.name).concat(FORMER)
    .filter(n => !!salesCoOf(n))                       // sells for somebody, or is not on this page
    .filter(n => !state.salesCo || salesCoOf(n) === state.salesCo);
  const upl = canUpload(state.user);
  const W = WHERE(), O = OFFICE();
  return `
  <section class="panel">
    <header><h3>Add somebody to the staff list</h3>
      <span class="hint" style="margin-left:auto">accounts only</span></header>
    <div class="pad">
      ${state.jDone ? `<div class="note" style="border-left-color:var(--good);margin-bottom:18px">
        <b>${esc(state.jDone.name)} is on the staff list as ${esc(state.jDone.staff_no||'')}.</b>
        ${state.jDone.email ? `They cannot sign in yet. Invite <b>${esc(state.jDone.email)}</b> from
        Supabase &rarr; Authentication &rarr; Users &rarr; Invite. The sign-in attaches itself to this
        record by the address, so it has to match exactly &mdash; a typo lets them in to an empty portal
        with no error at all.` : 'They have no work address yet, so they cannot be invited until one is added.'}
        ${state.jDone.probation_until ? ` Probation runs to <b>${esc(dayLabel(state.jDone.probation_until))} ${esc(String(state.jDone.probation_until).slice(0,4))}</b>.` : ''}
        Refresh any open payroll month to put them on it.</div>` : ''}
      <p style="margin:0 0 18px;color:var(--ink2);font-size:14.5px;max-width:74ch">
        This writes the whole of them at once: the staff record, an appointment
        letter carrying the opening salary, a leave opening, the air ticket
        clock and a place on the gratuity sheet. It does not create a sign-in
        &mdash; that is an invitation from Supabase, and it is yours to send.</p>
      <div class="jform">
        <label class="wide"><span>Name the portal uses</span>
          <input id="jName" value="${esc(JF().name)}" placeholder="as everybody says it"></label>
        <label class="wide"><span>Name on the visa &mdash; if it differs</span>
          <input id="jLegal" value="${esc(JF().legal)}" placeholder="what payslips and letters will carry"></label>
        <label><span>Work email &mdash; this is their sign-in</span>
          <input id="jEmail" type="email" value="${esc(JF().email)}" placeholder="name@corplex.ae"></label>
        <label><span>The same address again</span>
          <input id="jEmail2" type="email" value="${esc(JF().email2)}" placeholder="to catch a typo"></label>
        <label><span>Joining date</span><input id="jDoj" type="date" value="${esc(JF().doj)}"></label>

        <label><span>Who employs them</span><select id="jCo">${
          ['corplex','poa','lex'].map(k=>`<option value="${k}"${JF().company===k?' selected':''}>${esc((DATA.companies[k]||{}).name||k)}</option>`).join('')}</select></label>
        <label><span>Whose visa they are on</span><select id="jVisa">${
          ['corplex','poa','lex'].map(k=>`<option value="${k}"${(JF().visa||JF().company)===k?' selected':''}>${esc((DATA.companies[k]||{}).name||k)}</option>`).join('')}</select></label>
        <label><span>Who pays them</span><select id="jPay">${
          ['corplex','poa','lex'].map(k=>`<option value="${k}"${(JF().paidBy||JF().company)===k?' selected':''}>${esc((DATA.companies[k]||{}).name||k)}</option>`).join('')}</select></label>
        <p class="jnote wide">The visa entity decides who carries the gratuity and whose letterhead the payslip
          uses; the paying entity decides which company's payroll they appear on. They are often the same and
          sometimes not &mdash; Shannan and Abdullokh are both cases where they diverge.</p>

        <label><span>Staff number</span><input id="jNo" value="${esc(JF().staffNo)}" placeholder="left blank, the next in the series"></label>
        <label><span>Job title</span><input id="jTitle" value="${esc(JF().title)}"></label>
        <label><span>Department</span><input id="jDept" value="${esc(JF().dept)}"></label>
        <label><span>Reports to</span><select id="jMgr"><option value="">nobody yet</option>${
          USERS.map(u=>u.name).sort().map(n=>`<option value="${esc(n)}"${JF().manager===n?' selected':''}>${esc(n)}</option>`).join('')}</select></label>
        <label><span>Shift</span><select id="jShift">${
          (SHIFTS().length?SHIFTS():[{id:'S2',label:'S2'}]).map(s=>`<option value="${esc(s.id)}"${JF().shift===s.id?' selected':''}>${esc(s.id)}${s.from?' · '+esc(s.from)+'–'+esc(s.to):''}</option>`).join('')}</select></label>

        <label><span>Paid how</span><select id="jBasis">
          <option value="salaried"${JF().basis!=='commission'?' selected':''}>A fixed salary</option>
          <option value="commission"${JF().basis==='commission'?' selected':''}>Commission only, no fixed salary</option>
        </select></label>
        <label><span>Basic (AED)</span><input id="jBasic" inputmode="decimal" value="${esc(JF().basic)}"${JF().basis==='commission'?' disabled':''}></label>
        <label><span>Other allowance</span><input id="jAllow" inputmode="decimal" value="${esc(JF().allow)}"${JF().basis==='commission'?' disabled':''}></label>
        <p class="jnote wide">Gratuity accrues on the <b>basic</b> alone. The house split is 60/40, so on a
          salary of 10,000 that is a 6,000 basic — entering the whole salary as basic over-provides for the
          entire life of their employment before anybody notices.${JF().basis==='commission'?' A commission-only joiner gets no salary letter and no gratuity row, because there is no basic to accrue on.':''}</p>

        <label><span>Home country &mdash; for the air ticket</span>
          <input id="jCountry" value="${esc(JF().country)}"${JF().noTicket?' disabled':''} placeholder="India"></label>
        <label><span>Ticket allowance (AED)</span>
          <input id="jRate" inputmode="decimal" value="${esc(JF().rate)}"${JF().noTicket?' disabled':''}></label>
        <label class="wide tick"><input id="jNoTicket" type="checkbox"${JF().noTicket?' checked':''}>
          <span>No air ticket entitlement</span></label>
        <p class="jnote wide">Leave the country blank without ticking that and no entitlement is ever created
          &mdash; not in eleven months, not ever. The first ticket falls due eleven months after joining.</p>
      </div>
      <div class="drow" style="margin-top:6px">
        <button class="btn" id="jSave" type="button"${jReady()?'':' disabled'}>Add them</button>
        <button class="btn ghost" id="jClear" type="button">Clear the form</button>
        <span class="jwhy">${esc(jWhy())}</span>
      </div>
    </div>
  </section>

  ${PROB().length ? `<section class="panel">
    <header><h3>Probation</h3>
      <span class="pill ${PROB().some(p=>p.days<=30)?'warn':'good'}"><span class="dt"></span>${PROB().length} running</span>
      <span class="hint" style="margin-left:auto">six months from joining &mdash; nothing accrues differently, but somebody has to decide</span></header>
    ${byCompany(PROB(), {
      who: p => p.who,
      cols: colsOf([26, 17, 18, 11, 28]),
      head: `<thead><tr><th>Employee</th><th>Joined</th><th>Probation ends</th><th class="r">Days left</th><th></th></tr></thead>`,
      row: p => `<tr>
        <td>${nm(p.who)}</td>
        <td class="nw" style="color:var(--ink2)">${esc(dayLabel(p.doj))} ${esc(p.doj.slice(0,4))}</td>
        <td class="nw" style="color:var(--ink2)">${esc(dayLabel(p.until))} ${esc(p.until.slice(0,4))}</td>
        <td class="n r"${p.days<=30?' style="color:var(--warn)"':''}>${p.days}</td>
        <td class="r nw">
          <button class="btn sm" data-pbok="${esc(p.who)}" type="button">Confirm</button>
          <input class="pbdate" type="date" data-pbext="${esc(p.who)}" value="" title="extend to">
        </td></tr>`,
      empty: 'Nobody is on probation.'
    })}
    <p class="cap">Confirming records the decision on the day it is taken. Setting a later date in the box
      extends probation instead. Neither changes what has accrued: leave, the gratuity provision and the air
      ticket clock have all run from day one, which is what the law and the sheet both do.</p>
  </section>` : ''}

  <section class="panel">
    <header><h3>Where the office is</h3>
      <span class="pill ${O.set?'good':'warn'}"><span class="dt"></span>${O.set?'set':'not set yet'}</span>
      <span class="hint" style="margin-left:auto">press this while sitting in the office</span></header>
    <div class="pad">
      <p style="margin:0 0 16px;color:var(--ink2);font-size:14.5px;max-width:70ch">
        A check-in is confirmed two ways: the network it came from, which the
        server reads for itself and nobody can fake, and where the device says
        it is, which is corroboration rather than proof. Until this is set,
        both are recorded and neither is enforced &mdash; every check-in is taken
        at its word.</p>
      <div class="offrow">
        <div><span class="k">The server sees you at</span>
          <b class="n">${esc(W.ip || 'no address')}</b>
          <span class="n">${W.ip_ok ? 'already on the list' : 'not on the list'}</span></div>
        <div><span class="k">How far around still counts</span>
          <select id="offRad">${[100,150,250,500].map(r =>
            `<option value="${r}"${(+((O.geo||{}).radius_m||150))===r?' selected':''}>${r} metres</option>`).join('')}</select></div>
        <button class="btn" id="offHere" type="button">This is the office</button>
      </div>
      ${(O.geo||{}).lat ? `<p class="note" style="margin-top:16px"><b>The office is at
        ${(+O.geo.lat).toFixed(5)}, ${(+O.geo.lng).toFixed(5)}</b>, and anyone within
        ${esc(String(O.geo.radius_m||150))} metres of it counts as being there.</p>` : ''}
      ${(O.ips||[]).length ? `<div class="tw" style="margin-top:16px"><table>
        <thead><tr><th>Address that counts as the office</th><th></th></tr></thead>
        <tbody>${O.ips.map(ip => `<tr><td class="n">${esc(ip)}${ip===W.ip?' <span class="wmark">you, now</span>':''}</td>
          <td class="r"><button class="btn ghost sm" data-offdrop="${esc(ip)}" type="button">Remove</button></td></tr>`).join('')}
        </tbody></table></div>
        <p class="cap">A line whose address changes will drop off this list on its own one morning, and everybody in the office will be recorded as off-site until it is added again. If that keeps happening, the office needs a fixed address from the provider.</p>` : ''}
    </div>
  </section>
  ${upl?`
  <section class="panel">
    <header><h3>Weekly upload</h3><span class="hint">accounts only &middot; one whole year at a time</span></header>
    <div class="pad">
      ${vSalesUpload()}
    </div>
  </section>`:`
  <div class="note"><b>Uploading is restricted to the accounts manager.</b> You can see every rule, rate and account below, but the weekly workbook is published by Avin Mascarenhas only &mdash; one person owning the upload is what keeps the numbers reconcilable.</div>`}

  <div class="grid g2">
    <section class="panel">
      <header><h3>Upload template</h3><span class="hint">34 columns, unchanged from your workbook</span></header>
      <div class="pad">
        <div class="chips">${TEMPLATE.map(([n,k])=>`<span class="chip${k==='in'?' in':''}">${esc(n)}</span>`).join('')}</div>
        <p class="note" style="margin-top:14px"><b>Gold = you type it in. Grey = the portal calculates it</b>, using the same formulas as the workbook — so the upload can be your raw entry sheet and the portal derives profit, partner commission, net sales, eligible net sales and forfeitures itself. Column names must match exactly; order does not matter.</p>
      </div>
    </section>

    <section class="panel">
      <header><h3>Commission rules</h3>
        <span class="pill mute">${esc(coNameInView())}</span>
        <span class="hint" style="margin-left:auto">edit once, everyone recalculates</span></header>
      ${!salesHere() ? noSalesHere('commission rules') : `
      <div class="tw"><table>
        <thead><tr><th>Band</th><th class="r">Eligible net sales</th><th class="r">New</th><th class="r">Existing</th><th class="r">PM shared</th></tr></thead>
        <tbody>${DATA.bands.map(b=>`<tr><td>Band ${b[0]}</td><td class="n r">${money(b[1])} – ${b[2]>1e8?'above':money(b[2])}</td><td class="n r">${pct(b[3],0)}</td><td class="n r">${pct(b[4],0)}</td><td class="n r">${pct(b[5],0)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="cap">Special arrangements: <b>Avin Mascarenhas</b> — flat 20%, no target. <b>Accounting &amp; Tax</b> earns no commission, so Janine and Shamsiddin see their own sales and their department in full, and nothing from Corporate &amp; Legal.</p>`}
    </section>
  </div>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Staff accounts</h3>
        <div class="seg" style="margin-left:auto">${
          [['', 'Everyone'], ['corplex','CorpLex'], ['poa','POA'], ['lex','Lex Estates']]
            .map(([k,l])=>`<button data-sco="${k}" aria-pressed="${(state.salesCo||'')===k}" type="button">${esc(l)}</button>`).join('')}</div></header>
      <div class="tw"><table class="cotab">
        ${colsOf([34, 22, 22, 22])}
        <thead><tr><th>Name</th><th>Role</th><th>Commission</th><th class="r">${state.period==="FY"?esc(state.year):state.period} net sales</th></tr></thead>
        <tbody>${staff.map(n=>{const e=aggOf(n,state.period)||{netTot:0,deptOk:'Yes'};
          const mg = DATA.managers && DATA.managers[n];
          const fmr = roleOf(n)==='former';
          return `<tr${fmr?' style="color:var(--ink3)"':''}><td>${esc(n)}${mg?' <span class="pill" style="background:var(--accentSoft);color:var(--accent2)">Override '+pct(mg.rate,0)+'</span>':''}</td><td>${esc(ROLELABEL[roleOf(n)])}</td><td>${fmr?'<span class="pill mute">Deactivated</span>':(isFlat(e)?'<span class="pill mute">Flat 20%</span>':'<span class="pill good"><span class="dt"></span>Banded</span>')}</td><td class="n r">${money(e.netTot||0)}</td></tr>`}).join('')}</tbody>
      </table></div>
      <p class="cap">Somebody appears here when their department is one that earns revenue for their
        company \u2014 use the panel below to move somebody in or out \u2014 ${Object.entries(HR().revDept||{}).map(([k,v])=>
          esc((DATA.companies[k]||{}).name || k) + ': ' + v.map(esc).join(', ')).join(' &middot; ')}
        &mdash; or when they are named as an exception. Support departments do not appear, because a
        marketing specialist showing zero net sales reads as a consultant who sold nothing.</p>
    </section>

    <section class="panel">
      <header><h3>Move somebody between departments</h3>
        <span class="hint" style="margin-left:auto">this is what puts them in or out of sales</span></header>
      ${(() => {
        const roll = USERS.map(x => x.name).slice().sort();
        const who  = state.mvWho;
        /* Every department anybody is actually in, so the list is the
           organisation as it stands rather than one I wrote down once. */
        const all  = [...new Set(roll.map(orgDeptOf).filter(Boolean)
                       .concat(Object.values(HR().revDept || {}).flat()))].sort();
        const now  = who ? orgDeptOf(who) : '';
        const want = state.mvDept === null ? now : state.mvDept;
        const co   = who ? (((HR().orgCo || {})[who]) || companyOf(who).key) : '';
        const earns = d => REVDEPT(co).includes(d);
        const same = String(want).trim() === String(now).trim();
        return `<div class="pad">
          <div class="jform">
            <label><span>Who</span><select id="mvWho">
              <option value="">Choose somebody</option>
              ${roll.map(n => `<option value="${esc(n)}"${who === n ? ' selected' : ''}>${esc(NM(n))}${
                orgDeptOf(n) ? ' \u2014 ' + esc(orgDeptOf(n)) : ' \u2014 no department'}</option>`).join('')}
            </select></label>
            <label><span>Department</span>
              <input id="mvDept" list="mvDepts" value="${esc(want)}" placeholder="${who ? 'type a new one, or pick' : 'choose somebody first'}"${who ? '' : ' disabled'}>
              <datalist id="mvDepts">${all.map(d => `<option value="${esc(d)}">`).join('')}</datalist></label>
            <label><span>&nbsp;</span>
              <button class="btn" id="mvSave" type="button"${(!who || same || state.mvBusy) ? ' disabled' : ''}>${
                state.mvBusy ? 'Saving\u2026' : 'Move them'}</button></label>
          </div>
          ${!who ? `<p class="cap" style="padding:0;margin-top:14px">Pick somebody to see where they sit now and what moving them would do.</p>`
          : `<p class="note" style="margin-top:16px${earns(String(want).trim()) === earns(now) ? '' : ';border-left-color:var(--warn)'}">
              <b>${nm(who)}</b> is in <b>${esc(now || 'no department')}</b> at ${esc((DATA.companies[co] || {}).name || co)},
              which ${earns(now) ? '<b>does</b>' : 'does <b>not</b>'} earn commission there.
              ${same ? 'Change the department to move them.'
                : `Moving them to <b>${esc(String(want).trim() || 'no department')}</b> would ${
                    earns(String(want).trim())
                      ? '<b>put them into</b> the sales tables, the leaderboard and the commission run'
                      : '<b>take them out of</b> the sales tables, the leaderboard and the commission run'}.
                   It also moves them on the organisation chart and on People.`}</p>`}
        </div>`;
      })()}
      ${(() => { const x = state.mvDone; return x ? `<p class="cap"><b>${esc(x)}</b> has been moved.</p>` : ''; })()}
    </section>
  </div>

  <div class="grid g2">
    <section class="panel">
      <header><h3>Referral partners</h3>
        <span class="pill mute">${esc(coNameInView())}</span>
        <span class="hint" style="margin-left:auto">Company Master</span></header>
      ${!salesHere() ? noSalesHere('referral partners') : `
      <div class="tw"><table>
        <thead><tr><th>Client</th><th class="r">Partner rate</th></tr></thead>
        <tbody>${DATA.partners.map(p=>`<tr><td>${esc(p.name)}</td><td class="n r">${pct(p.rate,0)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="cap">Clients not listed here attract no partner commission. These rates are CorpLex&rsquo;s
        and come from its Company Master; POA and Lex Estates have no referral arrangement in the portal.</p>`}
    </section>
  </div>`;
}

/* ---------------- shell ---------------- */
const TABS = [
  {id:'home',        group:'mine',  label:'Home',             title:'Home'},
  {id:'dashboard',   group:'mine',  label:'My dashboard',     title:'Dashboard', gate:inSales},
  {id:'commission',  group:'mine',  label:'My commission',    title:'Commission', gate:inSales},
  {id:'invoices',    group:'mine',  label:'My invoices',      title:'Invoices', gate:inSales},
  // These three are made of other people's rows, so they still ask whether the
  // department's figures arrived at all.
  // Not a title: whether the department's figures arrived, and whether there
  // is anybody in them besides you.
  {id:'team',        group:'wider', label:'Team performance', title:'Team performance',
   gate:u => seesDeptSales(u) && Object.keys(DATA.engine || {}).length > 1},
  {id:'leaderboard', group:'wider', label:'Team leaderboard', title:'Leaderboard',
   gate:u => seesDeptSales(u) && Object.keys(DATA.engine || {}).length > 1},
  {id:'company',     group:'wider', label:'Department',       title:'Department', gate:seesDeptSales},
  {id:'tools',       group:'other', label:'Calculator', title:'Calculator'},
  // payment requests are a CorpLex process; POA and Lex do not use them
  {id:'payment',     group:'other', label:'Payment request',  title:'Payment request', gate:u=>coInView(u)==='corplex'},
  {id:'exitapprove', group:'other', label:'Final settlements', title:'Settlements waiting on you',
   gate:u=>exitsWaitingOn(u).length > 0, hide:true},
  {id:'payapprove',  group:'other', label:'Approve payments', title:'Requests waiting on you',
   gate:u=>coInView(u)==='corplex' && canUpload(u), hide:true},
  {id:'profile',     group:'hr',    label:'My profile',       title:'My profile', hide:true},
  {id:'attend',      group:'hr',    label:'My attendance',    title:'My attendance', gate:tracksAtt},
  {id:'people',      group:'hr',    label:'People',           title:'People'},
  /* The owner does not book leave. He does approve it, so the page comes
     back the moment something is waiting on him rather than stranding his
     team's requests behind a tab he cannot open. */
  {id:'requests',    group:'hr',    label:'Leave & WFH',      title:'Leave and working from home',
   gate:u => roleOf(u) !== 'owner'
     || (HR().requests || []).some(r => r.mgr === u && r.status === 'Pending')},
  {id:'loans',       group:'hr',    label:'Advances & letters', title:'Advances and letters'},

  {id:'myslip',      group:'hr',    label:'My payslip',       title:'My payslip', gate:u=>!isPartner(u)},
  {id:'myticket',    group:'hr',    label:'My air ticket',    title:'My air ticket', gate:u=>!isPartner(u)},
  // ---- Pay: the month, and everything that lands on a payslip
  {id:'payroll',    group:'con', sec:'pay',    label:'Payroll',        title:'Payroll', gate:canAdmin, con:true},
  {id:'payslips',   group:'con', sec:'pay',    label:'Payslips',       title:'Payslips', gate:canAdmin, con:true},
  {id:'revisions',  group:'con', sec:'pay',    label:'Revisions',      title:'Salary revisions', gate:canUpload, con:true},
  {id:'onpay',      group:'con', sec:'pay',    label:'On payroll',     title:'Who is on payroll', gate:canUpload, con:true},
  // Confirming somebody ends the probationary rate and starts the full one,
  // which makes it a pay event rather than a piece of paperwork.
  {id:'probation',  group:'con', sec:'pay',    label:'Probation',      title:'Probation', gate:canAdmin, con:true},
  {id:'tickets',    group:'con', sec:'pay',    label:'Air ticket',     title:'Air ticket tracker', gate:canAdmin, con:true},
  {id:'gratuity',   group:'con', sec:'pay',    label:'Gratuity',       title:'Gratuity provision', gate:canAdmin, con:true},
  {id:'exits',      group:'con', sec:'pay',    label:'Exits',          title:'Exit & final settlement', gate:canUpload, con:true},
  // ---- People: the day, and the rules the day is measured against
  {id:'hradmin',    group:'con', sec:'people', label:'Attendance',     title:'Attendance', gate:canAdmin, con:true},
  {id:'office',     group:'con', sec:'people', label:'Office',         title:'Where the office is', gate:isAccounts, con:true},
  {id:'regular',    group:'con', sec:'people', label:'Regularization', title:'Regularization', gate:canAdmin, con:true},
  {id:'shifts',     group:'con', sec:'people', label:'Shifts',         title:'Shifts and reporting lines', gate:canAdmin, con:true},
  {id:'holidays',   group:'con', sec:'people', label:'Holidays',       title:'Public holidays', gate:canAdmin, con:true},
  {id:'leaverules', group:'con', sec:'people', label:'Leave policy',   title:'Leave policy', gate:canUpload, con:true},
  {id:'leavebal',   group:'con', sec:'people', label:'Annual leave',   title:'Annual leave balances', gate:canAdmin, con:true},
  {id:'leaveother', group:'con', sec:'people', label:'Other balances', title:'Other leave balances', gate:canAdmin, con:true},
  // The first thing that happens to a person, at the end of the section
  // about people, rather than under a heading of its own.
  {id:'addstaff',   group:'con', sec:'people', label:'Add somebody',   title:'Add somebody to the staff list', gate:canUpload, con:true},
  // ---- Sales: was buried at the bottom of Rules & staff
  {id:'salesup',    group:'con', sec:'sales',  label:'Weekly upload',  title:'Weekly sales upload', gate:canUpload, con:true},
  {id:'salestpl',   group:'con', sec:'sales',  label:'Upload template',title:'Upload template', gate:isAccounts, con:true},
  {id:'salesrules', group:'con', sec:'sales',  label:'Commission rules', title:'Commission rules', gate:isAccounts, con:true},
  {id:'salesstaff', group:'con', sec:'sales',  label:'Staff accounts', title:'Staff accounts', gate:isAccounts, con:true},
  {id:'salesptr',   group:'con', sec:'sales',  label:'Referral partners', title:'Referral partners', gate:isAccounts, con:true},
  // ---- Documents: the hero stays put as you move between these four
  {id:'docsadmin',  group:'con', sec:'docs',   label:'Expiry',         title:'Document expiry', gate:isAccounts, con:true},
  {id:'docdates',   group:'con', sec:'docs',   label:'Staff Documents', title:'Staff Documents', gate:isAccounts, con:true},
  {id:'profiles',   group:'con', sec:'docs',   label:'Profiles',       title:'Profile completeness', gate:isAccounts, con:true},
  {id:'staffreg',   group:'con', sec:'docs',   label:'Register',       title:'Staff register', gate:isAccounts, con:true},
  // ---- Notifications: what the portal sends out, which is a setting about
  // the portal and not a fact about anybody.
  {id:'digest',     group:'con', sec:'notif',  label:'Email',          title:'Emails the portal sends', gate:isAccounts, con:true}
];
const PERIODTABS = ['dashboard','commission','invoices','team','leaderboard','company'];
const ALLOWED = () => TABS.filter(t=>!t.con && (!t.gate || t.gate(state.user)));
const STAFFTABS = () => ALLOWED().filter(t=>!t.hide && onPhone(t));
const CONTABS = () => TABS.filter(t=>t.con && (!t.gate || t.gate(state.user)));
function visibleTabs(){ return state.mode==='console' ? CONTABS() : STAFFTABS(); }
function reachable(){ return state.mode==='console' ? CONTABS() : ALLOWED().filter(onPhone); }
const SECTIONS = [['pay','Pay'], ['people','People'], ['sales','Sales'],
                  ['docs','Documents'], ['notif','Notifications']];
const secOf   = id => (TABS.find(t=>t.id===id) || {}).sec || 'pay';
const secTabs = s  => CONTABS().filter(t => t.sec === s);
// A section nobody may open is a section nobody sees: the gates are per screen,
// so a section with nothing left in it disappears rather than opening empty.
const liveSections = () => SECTIONS.filter(([k]) => secTabs(k).length);

function conBar(){
  const here = secOf(state.tab);
  const subs = secTabs(here);
  return `<div class="conbar">
    <h2>Accounts console</h2>
    <span class="cwho">${canUpload(state.user)?'Full access':'View only'} &middot; ${esc(state.user)}</span>
    <div class="ctabs">${liveSections().map(([k,l])=>`<button data-csec="${k}" aria-current="${here===k}" type="button">${esc(l)}</button>`).join('')}</div>
    <button class="cback" id="conBack" type="button">Back to my portal</button>
  </div>
  ${subs.length > 1 ? `<div class="subbar">
    <div class="subtabs">${subs.map(t=>`<button data-ctab="${esc(t.id)}" aria-current="${state.tab===t.id}" type="button">${esc(t.label)}</button>`).join('')}</div>
  </div>` : ''}`;
}
const NAVICON = {
  home:        'M3 11.2 12 4l9 7.2M6 9.8V20h12V9.8',
  dashboard:   'M4 20V10M10 20V4M16 20v-7M22 20H2',
  commission:  'M12 3v18M16.5 7.2A4 4 0 0 0 12.8 5h-1.3a3 3 0 0 0 0 6h1a3 3 0 0 1 0 6h-1.5a4 4 0 0 1-3.5-2.2',
  invoices:    'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
  team:        'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-1.5-5.6M21 20a5 5 0 0 0-3.5-4.8',
  leaderboard: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3',
  company:     'M4 21V6l7-3v18M11 21V9l7 2.5V21M2 21h20M7 9h1M7 13h1M7 17h1M14 14h1M14 18h1',
  tools:       'M4 5h16v14H4zM4 9h16M8 13h2M8 16.5h2M14 13h2M14 16.5h2',
  payment:     'M3 7h18v11H3zM3 11h18M7 15h4',
  payapprove:  'M3 7h18v11H3zM3 11h18M15.5 15.5l1.6 1.6 3.2-3.4',
  profile:     'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  attend:      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2',
  people:      'M8 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 8 11ZM2 20a6 6 0 0 1 12 0M16.5 11.5a2.6 2.6 0 1 0 0-5.2M22 20a4.6 4.6 0 0 0-3.4-4.4',
  requests:    'M7 3v3M17 3v3M3.5 8.5h17M4 6h16v15H4zM8.5 14.5l2.2 2.2 4.5-4.6',
  loans:       'M3 8h18v11H3zM3 12h18M6.5 5.5 17 3.2M7 15.5h3',
  myslip:      'M6 3h12v18l-3-2-3 2-3-2-3 2zM9.5 8h5M9.5 12h5M9.5 16h3',
  myticket:    'M3 10.5a2 2 0 0 0 0 3V18h18v-4.5a2 2 0 0 1 0-3V6H3zM9 6v12'
};
function navIcon(id){
  const d = NAVICON[id];
  if(!d) return '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

function renderNav(){
  const nav = document.getElementById('nav');
  const vis = STAFFTABS();
  const grp = g => vis.filter(t=>t.group===g);
  const sec = (label, ts) => ts.length ? `<div class="navlabel">${label}</div>` + ts.map(btn).join('') : '';
  nav.innerHTML = sec('My performance', grp('mine')) + sec('The wider picture', grp('wider'))
    + sec('Others', grp('other'))
    + sec('HR & Payroll', grp('hr'));
  // the title is what a collapsed rail has instead of the word
  function btn(t){ return `<button class="nav" data-tab="${t.id}" aria-current="${state.tab===t.id}" type="button" title="${esc(t.label)}">${navIcon(t.id)}<span>${esc(t.label)}</span></button>`; }
  nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.dataset.tab!=='payment') state.pqConfirm='';
    state.mode='staff'; state.tab=b.dataset.tab; render(); });
}
/* ---------- the phone: a different shape, not a squeezed desktop ----------
   Sales analysis is a laptop job - wide tables, charts, a filter bar - so those six
   tabs are left out on a phone entirely. What remains is what someone actually needs
   standing in a corridor: their day, leave, people, their payslip, and for a manager
   the approvals waiting on them. Navigation sits in a fixed footer. */
const MOBILE = () => window.matchMedia('(max-width:720px)').matches;
const MOBHIDE = ['dashboard','commission','invoices','team','leaderboard','company',
                 'tools','payment','payapprove'];
const onPhone = t => !(MOBILE() && MOBHIDE.includes(t.id));

const MICO = {
  home:'<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  requests:'<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 10h18M9 15l2 2 4-4"/>',
  people:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.2A5.6 5.6 0 0 1 21.5 20"/>',
  myslip:'<path d="M5 3h14v18l-2.3-1.6L14.4 21 12 19.4 9.6 21 7.3 19.4 5 21Z"/><path d="M9 8h6M9 12h6"/>',
  attend:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  loans:'<path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7l3-4h12l3 4M9 13h6"/>',
  letters:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  myticket:'<path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 3 2 2 0 0 0 0 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-2 2 2 0 0 1 0-3 2 2 0 0 0 0-4Z"/><path d="M14 7v10"/>',
  profile:'<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  tools:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 19h6"/>',
  payment:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/>',
  people2:'', more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  console:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h8M8 16.5h5"/>'
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MICO[k]||MICO.more}</svg>`;
const SHORTLABEL = {requests:'Leave', myslip:'Payslip', myticket:'Air ticket', loans:'Advances',
  letters:'Letters', attend:'Attendance', tools:'Calculator', payment:'Payments', profile:'Profile'};
const tabName = t => SHORTLABEL[t.id] || t.label;

// how many decisions are sitting with this person
function waitingOn(u){
  const H = HR();
  return H.requests.filter(r=>r.mgr===u && r.status==='Pending').length
    + (H.loans||[]).filter(x=>x.status==='Pending' && x.approver===u).length
    + (canUpload(u) ? (H.letters||[]).filter(x=>x.status==='Pending').length : 0);
}

function renderTabbar(){
  const bar = document.getElementById('tabbar'), wrap = document.getElementById('moreWrap');
  if(!bar) return;
  if(!MOBILE()){ bar.classList.add('hidden'); wrap.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const all = state.mode==='console' ? CONTABS() : STAFFTABS();
  const canAsk = all.some(t=>t.id==='requests');
  const want = ['home','people','myslip'];
  const primary = want.map(id=>all.find(t=>t.id===id)).filter(Boolean);
  all.forEach(t=>{ if(primary.length < 3 && !primary.includes(t) && t.id!=='requests') primary.push(t); });
  const rest = all.filter(t=>!primary.includes(t) && !(canAsk && t.id==='requests'));
  const wait = waitingOn(state.user);
  const tab = t => `<button data-mtab="${esc(t.id)}" aria-current="${state.tab===t.id}" type="button">
      ${ico(t.id)}<span>${esc(tabName(t))}</span></button>`;
  // the middle slot asks for something rather than going somewhere
  const plus = canAsk ? `<button class="tbadd" data-ask="1" type="button" aria-label="New request">
      <span class="tbplus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></button>` : '';
  const head = primary.slice(0, canAsk ? 2 : 3), tail = primary.slice(canAsk ? 2 : 3);
  bar.style.gridTemplateColumns = `repeat(${primary.length + (canAsk?1:0) + 1},minmax(0,1fr))`;
  bar.innerHTML = head.map(tab).join('') + plus + tail.map(tab).join('')
    + `<button data-more="1" aria-current="${rest.some(t=>t.id===state.tab)}" type="button">${ico('more')}<span>More</span>
       ${wait ? `<span class="tbdot">${wait}</span>` : ''}</button>`;
  bar.querySelectorAll('[data-mtab]').forEach(b=>b.onclick=()=>{
    state.tab = b.dataset.mtab; state.who = null; state.askOnly = null; closeSheet(); render(); window.scrollTo({top:0}); });
  bar.querySelector('[data-more]').onclick = ()=>openSheet(rest);
  const ab = bar.querySelector('[data-ask]');
  if(ab) ab.onclick = ()=>openAsk();
}

// what the + offers
function openAsk(){
  const wrap = document.getElementById('moreWrap'), sh = document.getElementById('moreSheet');
  if(!wrap) return;
  const u = state.user, blocked = noLeave(u) || leaveOwed(u);
  const wait = waitingOn(u);
  sh.innerHTML = `<div class="grab"></div>
    <div class="shtop"><b>New request</b><button class="shclose" data-close="1" type="button">Cancel</button></div>
    <button class="sh big" data-new="WFH" type="button">${ico('home')}
      <span><b>Work from home</b><i>A day at home, approved by ${esc(NM(mgrName(u))||'your manager')}</i></span></button>
    ${blocked ? `<div class="shnote">${noLeave(u)
        ? 'You are not on the annual leave scheme, so there is no leave to request.'
        : 'You are overdrawn on annual leave, so no further leave can be requested until it clears.'}</div>`
      : `<button class="sh big" data-new="Annual" type="button">${ico('requests')}
      <span><b>Leave request</b><i>Annual, sick, unpaid and six more</i></span></button>`}
    <h4>Or</h4>
    <button class="sh" data-mtab="requests" type="button">${ico('requests')}Leave &amp; WFH${wait?` <span class="shdot">${wait} waiting on you</span>`:''}</button>`;
  wrap.classList.remove('hidden');
  sh.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>{
    const k = b.dataset.new;
    state.reqForm = {type:k, from:'', to:'', reason:'', half:'am'};
    state.reqSent = false; state.askBack = state.tab; state.askOnly = (k==='WFH'?'WFH':'leave');
    state.tab = 'requests'; closeSheet(); render(); window.scrollTo({top:0}); });
  sh.querySelectorAll('[data-mtab]').forEach(b=>b.onclick=()=>{
    state.askOnly = null; state.tab = b.dataset.mtab; closeSheet(); render(); window.scrollTo({top:0}); });
  sh.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheet);
  document.getElementById('moreBg').onclick = closeSheet;
}
function closeSheet(){ const w = document.getElementById('moreWrap'); if(w) w.classList.add('hidden'); }
function openSheet(rest){
  const wrap = document.getElementById('moreWrap'), sh = document.getElementById('moreSheet');
  if(!wrap) return;
  const u = state.user;
  sh.innerHTML = `<div class="grab"></div>
    <div class="shtop"><b>${state.mode==='console' ? 'Accounts console' : 'More'}</b><button class="shclose" data-close="1" type="button">Done</button></div>
    ${rest.map(t=>`<button class="sh" data-mtab="${esc(t.id)}" aria-current="${state.tab===t.id}" type="button">${ico(t.id)}${esc(t.label)}</button>`).join('')}
    <button class="sh" data-mtab="profile" aria-current="${state.tab==='profile'}" type="button">${ico('profile')}My profile</button>
    ${canAdmin(u) ? `<h4>Accounts</h4>
      <button class="sh" data-mconsole="1" type="button">${ico('console')}${state.mode==='console' ? 'Back to my portal' : 'Accounts console'}</button>` : ''}
    ${canAdmin(u) ? `<h4>Company</h4>
    <div class="shrow" style="gap:7px">${Object.values(DATA.companies).map(c=>
      `<button class="cochip" data-mco="${esc(c.key)}" aria-pressed="${activeCo().key===c.key}" type="button">${esc(c.name)}</button>`).join('')}</div>
    <p class="shhint">Payroll, letters and who you see are all read from the company you are in.</p>` : ''}
    <h4>Display</h4>
    <div class="shrow"><div class="seg" id="mThemeSeg">
      <button data-mt="light" aria-pressed="${state.theme!=='dark'}" type="button">Light</button>
      <button data-mt="dark" aria-pressed="${state.theme==='dark'}" type="button">Dark</button></div></div>
    <div class="shrow" style="padding-bottom:12px"><label for="mUserSel" style="font-size:12px;color:var(--ink3);margin:0">Signed in as</label>
      <select id="mUserSel" style="flex:1;min-width:180px">${USERS.map(x=>`<option value="${esc(x.name)}"${x.name===u?' selected':''}>${nm(x.name)}</option>`).join('')}</select></div>`;
  wrap.classList.remove('hidden');
  sh.querySelectorAll('[data-mtab]').forEach(b=>b.onclick=()=>{
    state.tab = b.dataset.mtab; state.who = null; closeSheet(); render(); window.scrollTo({top:0}); });
  sh.querySelectorAll('[data-mco]').forEach(b=>b.onclick=()=>{
    state.company = b.dataset.mco; state.deptView = null; state.who = null;
    if(!reachable().some(t=>t.id===state.tab)) state.tab = state.mode==='console' ? 'payroll' : 'home';
    closeSheet(); render(); });
  const cb = sh.querySelector('[data-mconsole]');
  if(cb) cb.onclick = ()=>{ if(state.mode==='console'){ state.mode='staff'; state.tab='home'; }
    else { state.mode='console'; state.tab=(CONTABS()[0]||{id:'payroll'}).id; } closeSheet(); render(); };
  sh.querySelectorAll('#mThemeSeg button').forEach(b=>b.onclick=()=>{ state.theme=b.dataset.mt; closeSheet(); render(); });
  const ms = document.getElementById('mUserSel');
  if(ms) ms.onchange = ()=>{ state.user = ms.value; state.asAdmin = (roleOf(ms.value)==='admin');
    if(!reachable().some(t=>t.id===state.tab)) state.tab='home'; closeSheet(); render(); };
  sh.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheet);
  document.getElementById('moreBg').onclick = closeSheet;
}

const PAGETITLE = {requests:'Leave & WFH', loans:'Advances & letters', letters:'Advances & letters',
  people:'People', myslip:'My payslip', myticket:'My air ticket', attend:'My attendance', profile:'My profile',
  deskonly:'Accounts console'};
function renderChrome(){
  const sel = document.getElementById('userSel');
  sel.innerHTML = USERS.map(u=>`<option value="${esc(u.name)}"${u.name===state.user?' selected':''}>${nm(u.name)} — ${esc(ROLELABEL[u.role])}</option>`).join('');
  sel.onchange = ()=>{
    state.user = sel.value; state.asAdmin = (roleOf(sel.value)==='admin'); state.pqConfirm='';
    if(!reachable().some(t=>t.id===state.tab)) state.tab = state.mode==='console' ? 'payroll' : 'home';
    render();
  };
  const csel = document.getElementById('coSel');
  const cwrap = document.getElementById('coPick');
  if(canAdmin(state.user)){
    cwrap.classList.remove('hidden');
    csel.innerHTML = Object.values(DATA.companies).map(c=>
      `<option value="${esc(c.key)}"${activeCo().key===c.key?' selected':''}>${esc(c.name)}</option>`).join('');
    csel.onchange = ()=>{ state.company = csel.value; state.deptView = null;
      if(SALESTABS.includes(state.tab) && !DATA.companies[state.company].sales) state.tab='home';
      render(); };
  } else { cwrap.classList.add('hidden'); }
  // the phone puts My profile next to the bell
  const mp = document.getElementById('mePic');
  if(mp){
    if(MOBILE()){
      const ph = (PROF(state.user)||{}).photo;
      mp.classList.remove('hidden');
      mp.setAttribute('aria-current', state.tab==='profile');
      mp.innerHTML = ph ? `<img src="${ph.url}" alt="">`
        : esc(NM(state.user).split(' ').map(x=>x[0]).slice(0,2).join(''));
      mp.onclick = ()=>{ state.askOnly=null; state.tab='profile'; closeSheet(); render(); window.scrollTo({top:0}); };
    } else mp.classList.add('hidden');
  }
  const cbtn = document.getElementById('consoleBtn');
  if(canAdmin(state.user) && !MOBILE()){
    cbtn.classList.remove('hidden');
    cbtn.classList.toggle('on', state.mode==='console');
    cbtn.querySelector('span').textContent = state.mode==='console' ? 'Leave console' : 'Console';
    cbtn.onclick = ()=>{
      if(state.mode==='console'){ state.mode='staff'; state.tab='home'; }
      else { state.mode='console'; state.tab = (CONTABS()[0]||{id:'payroll'}).id; }
      render();
    };
  } else { cbtn.classList.add('hidden'); }
  const ys = document.getElementById('ySeg');
  const periodic = state.mode!=='console' && PERIODTABS.includes(state.tab);
  ys.classList.toggle('hidden', !periodic);
  document.getElementById('qSeg').classList.toggle('hidden', !periodic);
  // The years the portal actually holds, newest first, plus whichever year is
  // being looked at so the selector never loses the button you just pressed.
  const heldYears = [...new Set(Object.keys(DATA.yearFigures || {}).concat(state.year))]
    .filter(Boolean).sort().reverse();
  ys.innerHTML = heldYears.map(y=>`<button data-y="${y}" aria-pressed="${state.year===y}" type="button">${y}</button>`).join('');
  ys.querySelectorAll('button').forEach(b=>b.onclick=()=>{ state.year=b.dataset.y; render(); });
  const qs = document.getElementById('qSeg');
  qs.innerHTML = PERIODS.map(q=>`<button data-q="${q}" aria-pressed="${state.period===q}" type="button">${q==='FY'?'Year':q}</button>`).join('');
  qs.querySelectorAll('button').forEach(b=>b.onclick=()=>{ state.period=b.dataset.q; state.invFilter.q=(b.dataset.q==='FY'?'all':b.dataset.q); render(); });
  const bell = document.getElementById('bell'), pop = document.getElementById('bellPop');
  const items = alertsFor(state.user).filter(x=>!(state.noteDone||[]).includes(x.key));
  if(items.length){
    bell.classList.remove('hidden');
    document.getElementById('bellCount').textContent = items.length;
    bell.title = items.length + ' notification' + (items.length===1?'':'s');
    pop.innerHTML = `<div class="bphead">Notifications<b>${items.length}</b>
        <button type="button" id="bpAll">Mark all done</button></div>`
      + items.map((it,i)=>
      `<div class="bprow"><button type="button" data-go="${i}"><i class="${it.kind||'warn'}"></i><span><b>${esc(it.t)}</b><em>${esc(it.s)}</em></span></button>
        <button type="button" class="bpok" data-done="${esc(it.key)}" title="Mark as done" aria-label="Mark as done">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 7"/></svg></button></div>`).join('')
      + `<div class="bpfoot">Ticking one clears it from here only &mdash; it does not approve or change anything.</div>`;
    bell.onclick = (ev)=>{ ev.stopPropagation(); pop.classList.toggle('hidden'); };
    pop.onclick = ev => ev.stopPropagation();
    pop.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{
      pop.classList.add('hidden'); const it=items[+b.dataset.go];
      if(it.run) state.payRun=it.run;
      state.mode = (TABS.find(t=>t.id===it.tab)||{}).con ? 'console' : 'staff';
      state.tab = it.tab; render(); });
    pop.querySelectorAll('[data-done]').forEach(b=>b.onclick=(ev)=>{
      ev.stopPropagation();
      state.noteDone = (state.noteDone||[]).concat([b.dataset.done]); render();
      const p2=document.getElementById('bellPop'); if(p2) p2.classList.remove('hidden'); });
    const ba = document.getElementById('bpAll');
    if(ba) ba.onclick = (ev)=>{ ev.stopPropagation();
      state.noteDone = (state.noteDone||[]).concat(items.map(x=>x.key)); render(); };
    document.addEventListener('click', ()=>pop.classList.add('hidden'), {once:true});
  } else { bell.classList.add('hidden'); pop.classList.add('hidden'); }
  document.getElementById('whoName').textContent = state.user;
  document.getElementById('whoDept').textContent = ROLELABEL[roleOf(state.user)] + ' · ' +
    (orgDeptOf(state.user) ? orgDeptOf(state.user) + ' \u00b7 ' + companyOf(state.user).name : companyOf(state.user).name);
  let t = TABS.find(x=>x.id===state.tab) || {id:state.tab, title:'Home'};
  if(t.id==='admin' && canUpload(state.user)) t = Object.assign({}, t, {title:'Upload & admin'});
  if(t.id==='company') t = Object.assign({}, t, {title: deptData(state.user).department});
  const ttl = state.tab === 'payapprove' ? 'Payment request'
            : MOBILE() ? (PAGETITLE[t.id] || t.label || t.title) : t.title;
  document.getElementById('pageTitle').innerHTML = `${esc(ttl)}${(periodic && !MOBILE())?`<small>${esc(PLABEL[state.period]+' · '+state.year)}</small>`:''}`;
}
function tabHash(){ return (state.mode === 'console' ? 'c/' : '') + state.tab; }
const LP = () => HR().leavePolicy || {};
const SP = () => HR().sick || {};
const LF = () => state.lpForm || (state.lpForm = {
  annual:   String(LP().annualDays ?? ''),
  accrual:  String(LP().accrualPerMonth ?? ''),
  carry:    String((LP().carry || {}).days ?? ''),
  expires:  String((LP().carry || {}).expiresMonths ?? ''),
  probation:String(LP().probationMonths ?? ''),
  full:     String(SP().fullDays ?? ''),
  half:     String(SP().halfDays ?? ''),
  unpaid:   String(SP().unpaidDays ?? '')});

function vLeaveRules(){
  const f = LF(), upl = canUpload(state.user);
  const yr = (+f.accrual || 0) * 12;
  const off = Math.abs(yr - (+f.annual || 0)) > 1;
  return `
  <section class="panel">
    <header><h3>Annual leave</h3>
      <span class="hint" style="margin-left:auto">every balance in the portal is computed from these</span></header>
    <div class="pad">
      <div class="jform">
        <label><span>Days a year</span><input id="lpAnnual" inputmode="decimal" value="${esc(f.annual)}"${upl?'':' disabled'}></label>
        <label><span>Accrued each month</span><input id="lpAccrual" inputmode="decimal" value="${esc(f.accrual)}"${upl?'':' disabled'}></label>
        <label><span>Probation, in months</span><input id="lpProb" inputmode="decimal" value="${esc(f.probation)}"${upl?'':' disabled'}></label>
        <label><span>Days that may carry forward</span><input id="lpCarry" inputmode="decimal" value="${esc(f.carry)}"${upl?'':' disabled'}></label>
        <label><span>Carried leave expires after, months</span><input id="lpExp" inputmode="decimal" value="${esc(f.expires)}"${upl?'':' disabled'}></label>
        <label><span>Counted in</span><input value="${esc(LP().basis || 'working days')}" disabled></label>
        <p class="jnote wide">Twelve months at <b>${esc(f.accrual || '0')}</b> a day comes to
          <b>${(Math.round(yr*100)/100)} days a year</b>${off?` &mdash; which is not the <b>${esc(f.annual||'0')}</b> above. The database will refuse the pair until they agree.`:', which matches the entitlement above.'}</p>
      </div>
      <div class="drow">
        <button class="btn" id="lpSave" type="button"${upl && !off ?'':' disabled'}>Save the leave policy</button>
        <span class="jwhy">${state.lpSaved==='leave'?'Saved. Every balance has been recomputed.':''}</span>
      </div>
      <div class="note" style="margin-top:16px;border-left-color:var(--warn);font-size:13.5px">
        <b>These are not display figures.</b> Balances are worked out from them, from the
        opening date of ${esc(dayLabel(LP().openingAt || '')) || '\u2014'} ${esc(String(LP().openingAt||'').slice(0,4))}
        onwards. Lowering the accrual reduces what everybody has accumulated since that
        date, including leave already taken against it. The opening date is not editable
        here on purpose &mdash; moving it rewrites the whole calculation, and that belongs
        at a year end, done deliberately.
      </div>
    </div>
  </section>

  <section class="panel">
    <header><h3>Sick leave</h3>
      <span class="hint" style="margin-left:auto">the UAE ladder &mdash; full pay, then half, then unpaid</span></header>
    <div class="pad">
      <div class="jform">
        <label><span>Days at full pay</span><input id="spFull" inputmode="decimal" value="${esc(f.full)}"${upl?'':' disabled'}></label>
        <label><span>Then at half pay</span><input id="spHalf" inputmode="decimal" value="${esc(f.half)}"${upl?'':' disabled'}></label>
        <label><span>Then unpaid</span><input id="spUnpaid" inputmode="decimal" value="${esc(f.unpaid)}"${upl?'':' disabled'}></label>
      </div>
      <div class="drow">
        <button class="btn" id="spSave" type="button"${upl?'':' disabled'}>Save the sick policy</button>
        <span class="jwhy">${state.lpSaved==='sick'?'Saved.':''}</span>
      </div>
      <p class="cap">A year of sickness runs down the ladder in that order once probation is over.
        The portal shows each person what is left of each rung on their own leave page.</p>
    </div>
  </section>

  <section class="panel">
    <header><h3>Every other kind of leave</h3>
      <span class="hint" style="margin-left:auto">what staff can ask for, and what each one costs</span></header>
    <div class="tw"><table class="cotab">
      ${colsOf([18, 16, 9, 14, 43])}
      <thead><tr><th>Leave</th><th>Pay</th><th class="r">Days</th><th>Off the annual balance</th><th>Rule</th></tr></thead>
      <tbody>${LEAVEONLY().filter(t => !['Annual','Sick'].includes(t.id)).map(t => `<tr>
        <td><b>${esc(t.label)}</b></td>
        <td>${esc(t.pay === 'full' ? 'Full pay' : t.pay === 'none' ? 'Unpaid'
              : t.pay === 'scale' ? 'Full, then half, then unpaid' : '—')}</td>
        <td class="n r">${t.max ? t.max : t.half ? '\u00bd' : t.pool ? LF().annual : '—'}</td>
        <td>${t.pool ? '<span class="pill warn"><span class="dt"></span>Yes</span>'
                    : '<span class="pill mute">No</span>'}</td>
        <td style="color:var(--ink2)"${full(t.note || '')}>${esc(t.note || '—')}</td></tr>`).join('')}
      </tbody></table></div>
    <p class="cap">These follow UAE law rather than a setting, which is why there are no boxes to type in:
      the entitlements are statutory minimums and changing one is a policy decision, not a number.
      Staff see the same table on the <b>Leave policy</b> tab of their own Leave &amp; WFH page.
      <b>Study leave</b> is new &mdash; ten working days a year to sit examinations, after two years of service,
      at an institution in the UAE (Federal Decree-Law 33 of 2021, article 32(2)). The law does not say whether
      it is paid; this treats it as paid.</p>
  </section>`;
}

const PAGE = {
  office:     ['admin',   ['Where the office is']],
  addstaff:   ['admin',   ['Add somebody to the staff list']],
  probation:  ['admin',   ['Probation']],
  salesup:    ['admin',   ['Weekly upload']],
  salestpl:   ['admin',   ['Upload template']],
  salesrules: ['admin',   ['Commission rules']],
  salesstaff: ['admin',   ['Staff accounts', 'Move somebody between departments']],
  salesptr:   ['admin',   ['Referral partners']],
  hradmin:    ['hradmin', ['attendance'], true],
  shifts:     ['hradmin', ['Shifts and reporting lines']],
  leavebal:   ['hradmin', ['Annual leave balances'], true],
  leaveother: ['hradmin', ['Other leave balances'], true],
  holidays:   ['hradmin', ['Public holidays']],
  // Avin: 'once opened, keep the hero of expired, expiring etc' — so the four
  // document pages all carry the same strip, and moving between them does not
  // make the count you were reading disappear.
  docsadmin:  ['docs',    ['Document expiry'], true],
  docdates:   ['docs',    ['Staff Documents'], true],
  profiles:   ['docs',    ['Profile completeness'], true],
  staffreg:   ['docs',    ['Staff register'], true]
};
const PAGESRC = {admin: () => vAdmin(), hradmin: () => vHRAdmin(), docs: () => vDocsAdmin()};

function pageOf(id){
  const spec = PAGE[id];
  if(!spec) return '<p style="color:var(--ink3)">Nothing here.</p>';
  const [src, want, hero] = spec;
  const box = document.createElement('div');
  box.innerHTML = PAGESRC[src]();
  const out = [];
  const wanted = el => {
    const h = el.querySelector('h3');
    return !!h && want.some(w => h.textContent.indexOf(w) >= 0);
  };
  for(const c of [...box.children]){
    if(c.classList.contains('strip')){ if(hero) out.push(c.outerHTML); continue; }
    if(c.matches('section.panel')){ if(wanted(c)) out.push(c.outerHTML); continue; }
    for(const p of [...c.querySelectorAll('section.panel')])
      if(wanted(p)) out.push(p.outerHTML);
  }
  return out.join('\n');
}
const PAGEVIEW = {};
Object.keys(PAGE).forEach(id => { PAGEVIEW[id] = () => pageOf(id); });
/* Not a cut-out of a bigger screen: its own view, so it joins the map the
   router reads rather than the list of things carved out of a page. */
PAGEVIEW.onpay = () => vOnPayroll();

function readHash(){
  const h = (location.hash || '').replace(/^#/, '');
  if(!h) return;
  const con = h.startsWith('c/');
  const id  = con ? h.slice(2) : h;
  if(!TABS.some(t => t.id === id)) return;
  state.tab = id;
  state.mode = con ? 'console' : 'staff';
}
function render(){
  // Letters lives inside Advances & letters now - old links land on the right section
  if(state.tab === 'letters'){ state.tab = 'loans'; state.askTab = 'letters'; }
  // Rules & staff was split five ways; an old link lands on the joiner form.
  if(state.tab === 'admin') state.tab = 'addstaff';
  if(state.mode==='console' && !canAdmin(state.user)){ state.mode='staff'; state.tab='home'; }
  // A console link opened on a phone is answered, not redirected. Being moved
  // somewhere else without explanation is how a person concludes the link is
  // broken.
  if(state.mode==='console' && MOBILE()){ state.mode = 'staff'; state.tab = 'deskonly'; }
  if(state.mode!=='console' && (TABS.find(t=>t.id===state.tab)||{}).con) state.tab='home';
  /* A screen this person may not open is not opened, however they arrived at
     it. They land on the first console screen they may have rather than on an
     error, because being told 'no' by a page that then shows you nothing at
     all reads as a broken link. */
  if(state.mode==='console'){
    const t = TABS.find(x => x.id === state.tab);
    if(t && t.con && t.gate && !t.gate(state.user)) state.tab = (CONTABS()[0] || {id:'addstaff'}).id;
  }
  // The company-wide figures for the year being looked at, put where every
  // sales screen already reads them from.
  if(DATA.yearFigures && DATA.yearFigures[state.year])
    Object.assign(DATA, DATA.yearFigures[state.year]);
  const keepY = window.scrollY;
  applyTheme();
  renderNav(); renderChrome(); renderTabbar();
  const mk = document.querySelector('.rail .mark');
  if(mk && !mk.dataset.wired){ mk.dataset.wired='1'; mk.title='Home';
    mk.onclick = ()=>{ state.mode='staff'; state.tab='home'; render(); }; }
  CHARTS = {};
  cellHover();
  if(state.tab !== 'payment') state.pqSeen = false;
  {
    const app = document.getElementById('app'), tg = document.getElementById('railTog');
    let tucked = false;
    try{ tucked = localStorage.getItem('corplexRail') === 'tucked'; }catch(e){}
    app.classList.toggle('tucked', tucked);
    if(tg && !tg.dataset.wired){
      tg.dataset.wired = '1';
      tg.onclick = (e) => {
        e.stopPropagation();
        const now = !document.getElementById('app').classList.contains('tucked');
        document.getElementById('app').classList.toggle('tucked', now);
        try{ localStorage.setItem('corplexRail', now ? 'tucked' : 'out'); }catch(e){}
        tg.title = tg.ariaLabel = now ? 'Show the menu' : 'Hide the menu';
      };
    }
    if(tg) tg.title = tg.ariaLabel = tucked ? 'Show the menu' : 'Hide the menu';
  }
  const v = document.getElementById('view');
  const mainEl = document.querySelector('main');
  // the payment screen scrolls like every other screen: its table is eleven
  // columns wide and a viewport-height pane cut the last three off
  mainEl.classList.toggle('fixed', ['invoices'].includes(state.tab));
  document.body.classList.toggle('printinv', !!state.invPrint);
  /* Every console screen is a table or a form over one, so the console is
     wide by definition rather than by a list somebody has to remember to add
     to. The named staff screens keep their place on the list. */
  mainEl.classList.toggle('wide', state.mode === 'console'
    || ['home','payroll','tickets','payslips','hradmin','people','docsadmin','loans','profile','payment','payapprove'].includes(state.tab));
  const yearHeld = !!(DATA.yearFigures && DATA.yearFigures[state.year]);
  const newestYear = Object.keys(DATA.yearFigures || {}).sort().pop() || state.year;
  if(SALESTABS.includes(state.tab) && activeCo().sales && !yearHeld){
    v.innerHTML = `<section class="panel"><div class="pad" style="text-align:center;padding:56px 24px">
      <h3 style="font-size:22px;margin-bottom:8px">${state.year} has not been uploaded yet</h3>
      <p style="color:var(--ink2);max-width:52ch;margin:0 auto 18px">Upload the ${state.year} workbook under <b>Sales &rarr; Weekly upload</b> and this selector switches the whole portal — dashboard, commission, invoices and leaderboard — to that year.</p>
      <button class="btn" type="button" data-backyear="${esc(newestYear)}">Back to ${esc(newestYear)}</button>
    </div></section>`;
    v.querySelectorAll('[data-backyear]').forEach(bt =>
      bt.onclick = () => { state.year = bt.dataset.backyear; render(); });
    return;
  }
  const CON = state.mode==='console';
  /* My dashboard, My commission and My invoices are built from the person's
     own rows. Whether the company aggregate arrived says nothing about
     whether those exist, so it is not asked on those three. */
  const MINE_ONLY = ['dashboard', 'commission', 'invoices'];
  if(!CON && SALESTABS.includes(state.tab) && !activeCo().sales
     && !(MINE_ONLY.includes(state.tab) && hasOwnSales(state.user))){
    v.innerHTML = vNoSales();
    document.querySelectorAll('#view [data-go]').forEach(b=>b.onclick=()=>{ state.tab=b.dataset.go; render(); });
    return;
  }
  v.innerHTML = (CON?conBar():'') + ({home:vHome, dashboard:vDashboard, commission:vCommission, invoices:vInvoices,
                  leaderboard:vLeaderboard, company:vCompany, tools:vTools, team:vTeam, payment:vPayment, payapprove:vPayApprove, exitapprove:vExitApprove, payroll:vPayroll, tickets:vTickets, myticket:vMyTicket, payslips:vSlips, myslip:vMySlip,
                  attend:vAttend, requests:(()=>(MOBILE()&&state.askOnly)?vAsk(state.askOnly):vRequests()), hradmin:vHRAdmin,
                  profile:vProfile, loans:vAsks, revisions:vRevisions, gratuity:vGratuity, exits:vExits,
                  leaverules:vLeaveRules, deskonly:vDeskOnly, ...PAGEVIEW,
                  people:vPeople, digest:vDigest, admin:vAdmin, regular:vRegular}[state.tab])();
  const here = tabHash();
  if(state._at !== here){
    state._at = here;
    window.scrollTo({top:0, behavior:'instant'});
    if(location.hash.slice(1) !== here) history.replaceState(null, '', '#' + here);
  } else if(window.scrollY !== keepY){
    window.scrollTo({top:keepY, behavior:'instant'});
  }
  drawCharts();
  document.querySelectorAll('#runSeg button').forEach(b=>b.onclick=()=>{
    state.payRun = b.dataset.run; state.slipOpen = null; render(); });
  document.querySelectorAll('[data-ctab]').forEach(b=>b.onclick=()=>{ state.tab=b.dataset.ctab; state.slipOpen=null; render(); });
  { const d = document.getElementById('deskBack');
    if(d) d.onclick = ()=>{ state.mode='staff'; state.tab='home'; render(); window.scrollTo({top:0}); }; }
  document.querySelectorAll('[data-csec]').forEach(b=>b.onclick=()=>{
    const first = secTabs(b.dataset.csec)[0];
    if(first){ state.tab = first.id; state.slipOpen = null; render(); } });
  document.querySelectorAll('[data-dexp-gone]').forEach(el=>el.onchange=()=>{
    const n = el.dataset.dexp, k = el.dataset.k;
    const D = HR().docs || (HR().docs = {});
    const rec = D[n] || (D[n] = {});
    if(el.value) rec[k] = el.value; else delete rec[k];
    if(!Object.keys(rec).length) delete D[n];
    window.__db.saveDocDateFor(n, k, el.value);
    render();
  });
  document.querySelectorAll('[data-deid-gone]').forEach(el=>el.onchange=()=>{
    const v = el.value.trim();
    const E = HR().eid || (HR().eid = {});
    if(v) E[el.dataset.deid] = v; else delete E[el.dataset.deid];
    render();
  });
  {
    const dq = document.getElementById('docQ');
    if(dq){ dq.oninput = ()=>{ state.docQ = dq.value; render();
      const b = document.getElementById('docQ'); if(b){ b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }; }
  }
  document.querySelectorAll('[data-revltr]').forEach(b=>b.onclick=()=>{
    state.tab='loans'; state.askTab='letters'; state.ltOpen=b.dataset.revltr; state.askOnly=null;
    render(); setTimeout(()=>{ const el=document.querySelector('.slwrap'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 90); });
  { const gs=document.getElementById('gratSeg'); if(gs) gs.onchange=()=>{ state.gratMonth=gs.value; render(); }; }
  document.querySelectorAll('[data-askback]').forEach(b=>b.onclick=()=>{
    state.askOnly = null; state.tab = state.askBack || 'home'; state.reqSent = false; render(); window.scrollTo({top:0}); });
  document.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>invExport(b.dataset.exp));
  { const rc = document.getElementById('rawClose');
    if(rc) rc.onclick = ()=>{ state.invRaw = null; render(); };
    const rt = document.getElementById('rawText');
    if(rt) rt.onclick = ()=>rt.select(); }
  document.querySelectorAll('#peopleSeg button').forEach(b=>b.onclick=()=>{ state.peopleTab=b.dataset.pt; state.who=null; render(); });
  document.querySelectorAll('#leaveSeg button').forEach(b=>b.onclick=()=>{ state.leaveTab=b.dataset.lv; render(); });
  document.querySelectorAll('#calcSeg button').forEach(b=>b.onclick=()=>{ state.calcTab=b.dataset.ct; render(); });
  {
    const d = document.getElementById('holNewD'), n = document.getElementById('holNewN'),
          go = document.getElementById('holAdd');
    const keep = () => { state.holNew = {d: d ? d.value : '', n: n ? n.value : ''}; render(); };
    if(d) d.onchange = keep;
    if(n) n.oninput = () => { state.holNew = {d: d ? d.value : '', n: n.value};
      if(go) go.disabled = !(state.holNew.d && state.holNew.n.trim()); };
    if(go) go.onclick = async () => {
      go.disabled = true;
      /* Fixed is the safe default to write: a fixed date that turns out to
       * move is corrected once; a moving one left unconfirmed is a day
       * somebody plans around and then does not get. */
      await window.__db.addHoliday({on_date: state.holNew.d, name: state.holNew.n.trim(), fixed: true});
      state.holNew = null; render();
    };
  }
  document.querySelectorAll('#askSeg button').forEach(b=>b.onclick=()=>{ state.askTab=b.dataset.ask; state.ltOpen=null; render(); });
  document.querySelectorAll('#deptSeg button').forEach(b=>b.onclick=()=>{ state.deptView=b.dataset.dv; render(); });
  document.querySelectorAll('#attMonthSeg button').forEach(b=>b.onclick=()=>{ state.attMonth=b.dataset.am; render(); });
  document.querySelectorAll('#attSeg button').forEach(b=>b.onclick=()=>{
    state.attTab=b.dataset.att; state.rgSent=false; render(); window.scrollTo({top:0}); });
  document.querySelectorAll('[data-ci]').forEach(b=>b.onclick=async ()=>{
    const d=HDATE(); let a=attOf(state.user,d);
    if(!a){ a={who:state.user,d,kind:b.dataset.ci==='Home'?'WFH':'Office',segs:[]}; HR().attendance.push(a); }
    const now=new Date(); const hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const seg={in:hm,out:'',loc:b.dataset.ci,ok:true,note:''};
    a.segs.push(seg);
    b.disabled = true;
    state.ciSaid = null; state.ciNote = '';
    render();
    // The database reads the address, weighs it against where the device says
    // it is, and answers with what it wrote down.
    const said = await window.__db.checkIn({loc: b.dataset.ci});
    if(said){
      seg.loc = said.loc; seg.id = said.id; seg.ok = !said.downgraded;
      a.kind = said.kind;
      if(said.downgraded) state.ciSaid = said;
    }
    render(); });
  const co=document.getElementById('ciOut'); if(co) co.onclick=async ()=>{
    const g=openSeg(state.user); if(!g) return;
    const now=new Date(); g.out=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    co.disabled = true; state.ciSaid = null; render();
    const said = await window.__db.checkOut();
    if(said && said.out) g.out = said.out;
    render(); };
  { const cn=document.getElementById('ciNote'), cg=document.getElementById('ciNoteGo');
    if(cn) cn.oninput = ()=>{ state.ciNote = cn.value; if(cg) cg.disabled = !cn.value.trim(); };
    if(cg){ cg.disabled = !(state.ciNote||'').trim();
      cg.onclick = ()=>{
        const g = openSeg(state.user); const id = (state.ciSaid||{}).id || (g&&g.id);
        if(!id) return;
        if(g) g.note = state.ciNote;
        window.__db.segmentNote(id, state.ciNote);
        state.ciSaid = null; state.ciNote = ''; render(); }; } }

  /* --- fixing a missed day --- */
  { const bind = (id, key, ev) => { const el=document.getElementById(id); if(!el) return;
      const h = ()=>{ (state.rgForm||(state.rgForm={d:'',in:'',out:'',reason:''}))[key]=el.value;
        state.rgSent=false; render();
        const e2=document.getElementById(id);
        if(e2 && el.tagName==='INPUT' && el.type==='text'){ e2.focus(); e2.setSelectionRange(e2.value.length,e2.value.length); } };
      if(ev==='input'){ let t; el.oninput=()=>{clearTimeout(t);t=setTimeout(h,260);}; } else el.onchange=h; };
    bind('rgDay','d'); bind('rgIn','in'); bind('rgOut','out'); bind('rgWhy','reason','input');
    const go=document.getElementById('rgGo');
    if(go) go.onclick=async ()=>{
      const f=state.rgForm||{}; if(!(f.d && f.reason && (f.in||f.out))) return;
      go.disabled=true;
      const made = await window.__db.fileRegularization(
        {date:f.d, in:f.in||null, out:f.out||null, reason:f.reason.trim()});
      if(made){
        const RR = HR().regular || (HR().regular = REG());
        RR.rows.unshift({id:made.ref||made.id, uid:made.id, who:state.user, d:f.d,
          in:f.in||'', out:f.out||'', reason:f.reason.trim(), status:'Pending',
          by:'', note:'', sent:HDATE(), decided:''});
        RR.mine = RR.rows.filter(r=>r.who===state.user);
        state.rgForm={d:'',in:'',out:'',reason:''}; state.rgSent=true;
      }
      render(); };
    document.querySelectorAll('[data-rgdrop]').forEach(b=>b.onclick=()=>{
      b.disabled=true; window.__db.withdrawRegularization(b.dataset.rgdrop); });
    document.querySelectorAll('[data-rgok]').forEach(b=>b.onclick=()=>{
      b.disabled=true; window.__db.decideRegularization(b.dataset.rgok, true); });
    document.querySelectorAll('[data-rgno]').forEach(b=>b.onclick=()=>{
      const why = (prompt('Why is it declined? The person sees this.')||'').trim();
      if(why === '') return;
      b.disabled=true; window.__db.decideRegularization(b.dataset.rgno, false, why); }); }

  /* --- setting the office --- */
  { const so=document.getElementById('offHere');
    if(so) so.onclick=async ()=>{
      so.disabled=true; so.textContent='Reading\u2026';
      const r = await window.__db.setOfficeHere(
        +((document.getElementById('offRad')||{}).value || 150));
      if(r) await window.__db.whereAmI();
      render(); };
    document.querySelectorAll('[data-offdrop]').forEach(b=>b.onclick=()=>{
      b.disabled=true; window.__db.forgetOfficeIp(b.dataset.offdrop); }); }
  [['jName','name'],['jLegal','legal'],['jEmail','email'],['jEmail2','email2'],
   ['jDoj','doj'],['jNo','staffNo'],['jCo','company'],['jVisa','visa'],['jPay','paidBy'],
   ['jTitle','title'],['jDept','dept'],['jMgr','manager'],['jBasis','basis'],
   ['jBasic','basic'],['jAllow','allow'],['jShift','shift'],['jCountry','country'],
   ['jRate','rate']].forEach(([id,key])=>{
    const el = document.getElementById(id); if(!el) return;
    const h = ()=>{ JF()[key] = el.value; state.jDone = null; render();
      const e2 = document.getElementById(id);
      if(e2 && e2.tagName==='INPUT' && e2.type!=='date'){ e2.focus();
        try{ e2.setSelectionRange(e2.value.length, e2.value.length); }catch(_){} } };
    if(el.tagName==='SELECT' || el.type==='date') el.onchange = h;
    else { let tm; el.oninput = ()=>{ clearTimeout(tm); tm = setTimeout(h, 300); }; }
  });
  const jnt = document.getElementById('jNoTicket');
  if(jnt) jnt.onchange = ()=>{ JF().noTicket = jnt.checked; state.jDone = null; render(); };
  const jcl = document.getElementById('jClear');
  if(jcl) jcl.onclick = ()=>{ state.jf = null; state.jDone = null; render(); };
  const jsv = document.getElementById('jSave');
  if(jsv) jsv.onclick = async ()=>{
    const f = JF(); jsv.disabled = true; jsv.textContent = 'Adding\u2026';
    const r = await window.__db.addEmployee({
      name: f.name.trim(), legal: f.legal.trim() || null,
      email: f.email.trim() || null, doj: f.doj,
      company: f.company, visa: f.visa || f.company, paidBy: f.paidBy || f.company,
      title: f.title.trim() || null, dept: f.dept.trim() || null,
      manager: (HR().ids||{})[f.manager] || null,
      basis: f.basis, basic: f.basis==='commission' ? 0 : +f.basic||0,
      allow: f.basis==='commission' ? 0 : +f.allow||0,
      shift: f.shift || 'S2',
      country: f.noTicket ? null : (f.country.trim() || null),
      rate: f.noTicket ? null : (+f.rate || 0),
      staffNo: f.staffNo.trim() || null});
    if(r){ state.jDone = r; state.jf = null; }
    render(); };
  document.querySelectorAll('[data-pbok]').forEach(b=>b.onclick=async ()=>{
    b.disabled = true;
    await window.__db.confirmEmployee((HR().ids||{})[b.dataset.pbok]); render(); });
  document.querySelectorAll('[data-pbext]').forEach(el=>el.onchange=async ()=>{
    if(!el.value) return; el.disabled = true;
    await window.__db.extendProbation((HR().ids||{})[el.dataset.pbext], el.value,
      'extended from the probation list'); render(); });
  [['lpAnnual','annual'],['lpAccrual','accrual'],['lpProb','probation'],
   ['lpCarry','carry'],['lpExp','expires'],
   ['spFull','full'],['spHalf','half'],['spUnpaid','unpaid']].forEach(([id,key])=>{
    const el = document.getElementById(id); if(!el) return;
    let tm; el.oninput = ()=>{ clearTimeout(tm); tm = setTimeout(()=>{
      LF()[key] = el.value; state.lpSaved = ''; render();
      const e2 = document.getElementById(id);
      if(e2){ e2.focus(); try{ e2.setSelectionRange(e2.value.length, e2.value.length); }catch(_){} }
    }, 300); };
  });
  const lps = document.getElementById('lpSave');
  if(lps) lps.onclick = async ()=>{ lps.disabled = true;
    const r = await window.__db.setLeavePolicy(LF());
    state.lpForm = null; if(r) state.lpSaved = 'leave'; render(); };
  const sps = document.getElementById('spSave');
  if(sps) sps.onclick = async ()=>{ sps.disabled = true;
    const r = await window.__db.setSickPolicy(LF());
    state.lpForm = null; if(r) state.lpSaved = 'sick'; render(); };
  document.querySelectorAll('[data-sco]').forEach(b=>b.onclick=()=>{
    state.salesCo = b.dataset.sco; render(); });
  ['rqType','rqFrom','rqTo','rqReason'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const key=id.slice(2).toLowerCase();
    const h=()=>{ state.reqForm[key]=el.value; state.reqSent=false; render();
      const e2=document.getElementById(id); if(e2 && el.tagName==='INPUT' && el.type!=='date'){ e2.focus(); e2.setSelectionRange(e2.value.length,e2.value.length); } };
    if(el.tagName==='SELECT' || el.type==='date') el.onchange=h; else { let tm; el.oninput=()=>{clearTimeout(tm);tm=setTimeout(h,260);}; }
  });
  document.querySelectorAll('[data-rqmode]').forEach(b=>b.onclick=()=>{
    state.reqForm.type = b.dataset.rqmode==='wfh' ? 'WFH' : 'Annual';
    state.reqSent=false; render(); });
  const rs=document.getElementById('rqSubmit'); if(rs) rs.onclick=()=>{
    const f=state.reqForm, t=rType(f.type);
    const from = t.onBday ? bdayDate(state.user) : f.from;
    const to = t.half ? from : f.to;
    if(!(from && to && f.reason)) return;
    const n=HR().requests.length+3011;
    if(!typeAllowed(state.user, t).ok) return;
    const NEWREQ = {id:'RQ-'+n, who:state.user, type:f.type, from:from, to:to,
      reason:f.reason, status:'Pending', mgr:mgrName(state.user),
      days: t.half ? 0.5 : workDaysBetween(from,to), half: t.half ? (f.half||'am') : '',
      calDays: t.half ? 1 : spanDays(from,to).length, sent:HDATE(), decided:''};
    HR().requests.unshift(NEWREQ);
    window.__db.newRequest(NEWREQ);
    state.reqForm={type:'WFH',from:'',to:'',reason:'',half:'am'}; state.reqSent=true; render(); };
  document.querySelectorAll('#rqHalfSeg button').forEach(b=>b.onclick=()=>{
    state.reqForm.half = b.dataset.half; state.reqSent=false; render(); });
  document.querySelectorAll('[data-approve-req]').forEach(b=>b.onclick=()=>{
    const r=HR().requests.find(x=>x.id===b.dataset.approveReq);
    if(r){ r.status='Approved'; r.decided=HDATE(); window.__db.decide(r.uid||r.id,'approved'); } render(); });
  document.querySelectorAll('[data-decline-req]').forEach(b=>b.onclick=()=>{
    const r=HR().requests.find(x=>x.id===b.dataset.declineReq);
    if(r){ r.status='Declined'; r.decided=HDATE(); window.__db.decide(r.uid||r.id,'declined'); } render(); });
  document.querySelectorAll('#docSeg button').forEach(b=>b.onclick=()=>{ state.docFilter=b.dataset.df; render(); });
  const touchProf = () => { const p=PROF(state.user); if(p) p.updated = HDATE(); };
  document.querySelectorAll('[data-pf]').forEach(el=>{
    let tm; el.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{
      const p=PROF(state.user); if(!p) return;
      p[el.dataset.pf]=el.value; touchProf();
      state.pfDirty = Object.assign(state.pfDirty||{}, {[el.dataset.pf]: el.value});
      state.pfSaved = ''; render();
      const e2=document.querySelector(`[data-pf="${el.dataset.pf}"]`);
      if(e2){ e2.focus(); try{e2.setSelectionRange(e2.value.length,e2.value.length);}catch(_){}}
    }, 320); };
  });
  /* The birthday was typed here once. It is accounts' now, and the database
     has always agreed: 'birthday' is not one of the four fields the guard on
     employees lets a person change on their own row, so this handler was
     writing into a trigger that put it straight back. */
  document.querySelectorAll('[data-dd]').forEach(b=>b.onclick=()=>{ state.mailWeek=b.dataset.dd; render(); });
  document.querySelectorAll('[data-mail]').forEach(b=>b.onclick=()=>{ state.mailPick=b.dataset.mail; render(); });
  document.querySelectorAll('[data-who]').forEach(b=>b.onclick=()=>{
    state.who=b.dataset.who; state.mode='staff'; state.tab='people'; render();
    window.scrollTo({top:0}); });
  const pb=document.querySelector('[data-people-back]');
  if(pb) pb.onclick=()=>{ state.who=null; render(); };
  const pq=document.getElementById('peopleQ');
  if(pq){ let tm; pq.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{
    state.peopleQ=pq.value; render();
    const e2=document.getElementById('peopleQ');
    if(e2){ e2.focus(); try{e2.setSelectionRange(e2.value.length,e2.value.length);}catch(_){} } }, 220); }; }
  document.querySelectorAll('[data-dg]').forEach(el=>{ let tm; el.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{
    MAILCFG().to[+el.dataset.dg] = el.value; render();
    const e2=document.querySelector(`[data-dg="${el.dataset.dg}"]`);
    if(e2){ e2.focus(); try{e2.setSelectionRange(e2.value.length,e2.value.length);}catch(_){} }
  }, 320); }; });
  [['mkA','leaveOnApprove'],['mkB','leaveFirstDay'],['mkC','wfhFirstDay'],['mkD','skipEmpty']].forEach(([id,k])=>{
    const el=document.getElementById(id); if(el) el.onchange=()=>{ MAILCFG()[k]=el.checked; render(); }; });
  const dgd = document.getElementById('dgDay');
  if(dgd) dgd.onchange = ()=>{ MAILCFG().weeklyDay = dgd.value; render(); };
  const eb = document.getElementById('eidShow');
  if(eb) eb.onclick = ()=>{
    const on = eb.dataset.on === '1';
    document.querySelectorAll('.refval').forEach(v => {
      v.textContent = on ? maskRef(v.dataset.full) : v.dataset.full; });
    eb.dataset.on = on ? '' : '1'; eb.textContent = on ? 'Show numbers' : 'Hide them'; };
  const ea = document.getElementById('eidAll');
  if(ea) ea.onclick = ()=>{ const on = ea.dataset.on === '1';
    document.querySelectorAll('[data-eid]').forEach(el=>{ el.textContent = on ? maskEID(el.dataset.eid) : el.dataset.eid; });
    ea.dataset.on = on ? '' : '1'; ea.textContent = on ? 'Show all' : 'Hide all'; };
  const qEl = document.getElementById('pf_quiet');
  if(qEl) qEl.onchange = ()=>{ const p=PROF(state.user); if(p){ p.quietBday = qEl.checked; p.updated=HDATE(); }
    state.pfDirty = Object.assign(state.pfDirty||{}, {quietBday: qEl.checked});
    state.pfSaved = ''; render(); };
  document.querySelectorAll('[data-pfs]').forEach(el=>el.onchange=()=>{
    const p=PROF(state.user); if(!p) return; p[el.dataset.pfs]=el.value; p.updated=HDATE();
    state.pfDirty = Object.assign(state.pfDirty||{}, {[el.dataset.pfs]: el.value});
    state.pfSaved = ''; render(); });
  document.querySelectorAll('[data-docexp]').forEach(el=>el.onchange=()=>{
    const d = HR().docs[state.user] || (HR().docs[state.user]={});
    d[el.dataset.docexp] = el.value;
    window.__db.saveDocDate(el.dataset.docexp, el.value); d.sample = false; touchProf(); render(); });
  document.querySelectorAll('[data-doc]').forEach(el=>el.onchange=()=>{
    const f = el.files && el.files[0]; if(!f) return;
    if(f.size > 6*1024*1024){ state.pfErr = `${f.name} is ${kb(f.size)} — too big. Keep it under about 5 MB.`; render(); return; }
    state.pfErr = ''; state.upBusy = el.dataset.doc; render();
    window.__db.uploadDoc(el.dataset.doc, f).then(path => {
      state.upBusy = null;
      if(!path) state.pfErr = `${f.name} did not upload. Try again, or tell accounts.`;
      render();
    }); });
  const poff = document.getElementById('pfPhotoOff');
  if(poff) poff.onclick = ()=>{ state.upBusy='photo'; render();
    window.__db.removePhoto().then(()=>{ state.upBusy=null; render(); }); };
  document.querySelectorAll('[data-photo]').forEach(el=>el.onchange=()=>{
    const f = el.files && el.files[0]; if(!f) return;
    state.upBusy = 'photo'; render();
    window.__db.uploadPhoto(f).then(path => {
      state.upBusy = null;
      if(!path) state.pfErr = `${f.name} did not upload. Try again, or tell accounts.`;
      render();
    }); });
  const bindF = (id, obj, key, after) => { const el=document.getElementById(id); if(!el) return;
    const h=()=>{ state[obj][key]=el.value; if(after) after(); render();
      const e2=document.getElementById(id); if(e2 && el.tagName==='INPUT' && el.type!=='date'){ e2.focus(); try{e2.setSelectionRange(e2.value.length,e2.value.length);}catch(_){} } };
    if(el.tagName==='SELECT'||el.type==='date') el.onchange=h; else { let tm; el.oninput=()=>{clearTimeout(tm);tm=setTimeout(h,260);}; } };
  ['ltType','ltTo','ltWhy'].forEach(id=>bindF(id,'ltForm',id.slice(2,3).toLowerCase()+id.slice(3),()=>{state.ltSent=false;}));
  const lts=document.getElementById('ltSubmit'); if(lts) lts.onclick=()=>{
    const f=state.ltForm, L=HR().letters;
    L.unshift({id:'LT-'+(4002+L.length), who:state.user, type:f.type, to:f.to, why:f.why,
      status:'Pending', asked:HDATE(), decided:''});
    state.ltForm={type:'salary',to:'',why:''}; state.ltSent=true; render(); };
  ['rvWho','rvEff','rvBasic','rvAllow'].forEach(id=>{
    const el = document.getElementById(id); if(!el) return;
    const key = id.slice(2,3).toLowerCase()+id.slice(3);
    const h = ()=>{ state.revForm[key] = el.value; state.revSent=''; render();
      const e2 = document.getElementById(id);
      if(e2 && e2.tagName==='INPUT' && e2.type!=='date'){ e2.focus(); try{e2.setSelectionRange(e2.value.length,e2.value.length);}catch(_){} } };
    if(el.tagName==='SELECT' || el.type==='date') el.onchange = h;
    else { let tm; el.oninput = ()=>{ clearTimeout(tm); tm = setTimeout(h, 300); }; }
  });
  const rvb = document.getElementById('rvIssue');
  if(rvb) rvb.onclick = async ()=>{
    const g = state.revForm, who = g.who;
    rvb.disabled = true;
    const r = await window.__db.issueRevision({
      emp: (HR().ids||{})[who], basic: +g.basic||0, allow: +g.allow||0,
      from: g.eff, reason: g.reason || 'Salary revision',
      /* Without this a revision for somebody paid by two companies matched
         neither of their salary rows and wrote a third against a blank
         company, which the payroll generator would then have paid as well. */
      company: revCo()});
    if(r){ state.revSent = who; state.revForm = {who:'', eff:'', basic:'', allow:'', co:''}; }
    render(); };
  document.querySelectorAll('[data-salclr]').forEach(b => b.onclick = async () => {
    const i = b.dataset.salclr.lastIndexOf('|');
    const who = b.dataset.salclr.slice(0, i), co = b.dataset.salclr.slice(i + 1);
    const p = (salParts(who).co || []).find(c => c.company === co) || {};
    /* The most recent month that actually paid them a salary. If there is one,
       the figure is not a leftover and the basis is the thing to look at. */
    const paid = (DATA.payroll.runs || []).slice()
      .sort((x, y) => y.key < x.key ? -1 : 1)
      .map(run => { const row = (run.rows || []).find(r =>
              (r.portalName || r.name) === who && +r.salary > 0);
            return row ? {label: run.label, salary: +row.salary} : null; })
      .find(Boolean);
    if(!confirm('Clear ' + money(p.salary || 0, 2) + ' from ' + NM(who) + "'s file"
      + (p.label ? ' at ' + p.label : '') + '?\n\n'
      + 'This removes the figure and nothing else. ' + NM(who) + ' stays on the staff list,\n'
      + 'stays ' + (BASIS[BASISOF(who)] || '').toLowerCase() + ', and no past payroll changes.\n'
      + 'Any revision letter that set it stays where it is \u2014 the letter went out.\n\n'
      + (paid
         ? 'CHECK THIS FIRST: the ' + paid.label + ' run paid ' + NM(who) + ' '
           + money(paid.salary, 2) + ' as salary.\nIf that is still how they are paid then they are not '
           + (BASIS[BASISOF(who)] || '').toLowerCase() + ' \u2014 change\nthe basis instead and leave this figure alone.'
         : 'No payroll month has paid ' + NM(who) + ' a salary, so nothing is losing a figure it uses.'))) return;
    b.disabled = true;
    await window.__db.clearSalary(who, co);
    render(); });
  { const F = () => state.opForm || (state.opForm = {who:'', co:'', basic:'', allow:'', from:''});
    [['opWho','who'],['opCo','co'],['opFrom','from']].forEach(([id, k]) => {
      const el = document.getElementById(id);
      if(el) el.onchange = () => { F()[k] = el.value; state.opDone = ''; render(); }; });
    [['opBasic','basic'],['opAllow','allow']].forEach(([id, k]) => {
      const el = document.getElementById(id);
      if(el){ let tm; el.oninput = () => { clearTimeout(tm); tm = setTimeout(() => {
        F()[k] = el.value; state.opDone = ''; render();
        const e2 = document.getElementById(id);
        if(e2){ e2.focus(); try{ e2.setSelectionRange(e2.value.length, e2.value.length); }catch(_){} }
      }, 320); }; } });
    const go = document.getElementById('opGo');
    if(go) go.onclick = async () => { const g = F();
      go.disabled = true;
      const r = await window.__db.recordSalary({
        emp: (HR().ids||{})[g.who], company: g.co || '',
        basic: +g.basic || 0, allow: +g.allow || 0, from: g.from});
      if(r){ state.opDone = NM(g.who) + ' \u2014 ' + money((+g.basic||0)+(+g.allow||0), 2)
               + (g.co ? ' from ' + ((DATA.companies[g.co]||{}).name || g.co) : '')
               + ', on file from ' + effLabel(g.from) + '.';
             state.opForm = {who:'', co:'', basic:'', allow:'', from:''}; }
      render(); }; }
  /* Not data-slip: that already means "open this person's payslip" on the
     console Payslips screen, and its handler is bound after this one and would
     quietly take the button over. */
  document.querySelectorAll('[data-mymonth]').forEach(b => b.onclick = () => {
    state.slipRun = b.dataset.mymonth; render(); window.scrollTo({top: 0}); });
  { const y = document.getElementById('slipYear');
    if(y) y.onchange = () => { state.slipYear = y.value; render(); }; }
  { const c = document.getElementById('rvCo');
    if(c) c.onchange = () => { state.revForm.co = c.value; render(); }; }
  { const q = document.getElementById('revQ');
    if(q) q.oninput = () => { state.revQ = q.value; render();
      const e2 = document.getElementById('revQ');
      if(e2){ e2.focus(); e2.setSelectionRange(e2.value.length, e2.value.length); } }; }
  document.querySelectorAll('[data-rvsee]').forEach(b=>b.onclick=()=>{
    const l = (HR().letters||[]).find(x=>x.id===b.dataset.rvsee);
    if(!l) return oops2('That letter is not there yet — reload the page.');
    showSlip(letterHTML(l), legalOf(l.who), 'Draft \u2014 not sent');
  });
  document.querySelectorAll('[data-rvsend]').forEach(b=>b.onclick=()=>{
    state.revAsk = b.dataset.rvsend; state.revSent=''; render(); });
  const rvn = document.getElementById('rvNo');
  if(rvn) rvn.onclick = ()=>{ state.revAsk = null; render(); };
  document.querySelectorAll('[data-rvyes]').forEach(b=>b.onclick=async ()=>{
    b.disabled = true; state.revAsk = null;
    await window.__db.releaseRevision(b.dataset.rvyes); render(); });
  document.querySelectorAll('[data-rvdrop]').forEach(b=>b.onclick=async ()=>{
    b.disabled = true;
    await window.__db.withdrawRevision(b.dataset.rvdrop, 'withdrawn before sending'); render(); });
  document.querySelectorAll('[data-lt-ok]').forEach(b=>b.onclick=()=>{
    const x=HR().letters.find(y=>y.id===b.dataset.ltOk); if(x){x.status='Issued'; x.decided=HDATE(); window.__db.decideLetter(x.id,'Issued'); state.ltOpen=x.id;} render(); });
  document.querySelectorAll('[data-lt-no]').forEach(b=>b.onclick=()=>{
    const x=HR().letters.find(y=>y.id===b.dataset.ltNo); if(x){x.status='Declined'; x.decided=HDATE(); window.__db.decideLetter(x.id,'Declined');} render(); });
  document.querySelectorAll('[data-lt-view]').forEach(b=>b.onclick=()=>{
    state.ltOpen = state.ltOpen===b.dataset.ltView ? null : b.dataset.ltView; render(); });
  ['lnAmt','lnMon','lnWhy','lnPlan'].forEach(id=>{
    const key = {lnAmt:'amount', lnMon:'months', lnWhy:'why', lnPlan:'plan'}[id];
    bindF(id,'lnForm',key,()=>{state.lnSent=false;}); });
  const lns=document.getElementById('lnSubmit'); if(lns) lns.onclick=()=>{
    const f=state.lnForm, L=HR().loans, amt=+f.amount, mth=+f.months;
    L.unshift({id:'LN-'+(5004+L.length), who:myLoanName(state.user), amount:amt, months:mth,
      monthly:Math.round(amt/mth*100)/100, why:f.why, plan:f.plan, status:'Pending',
      approver:loanApprover(amt), asked:HDATE(), decided:'', start:HDATE().slice(0,7), paid:0});
    window.__db.newLoan(L[0]);
    state.lnForm={amount:'',months:'',why:'',plan:''}; state.lnSent=true; render(); };
  document.querySelectorAll('[data-lnpull]').forEach(b=>b.onclick=async()=>{
    b.disabled = true;
    await window.__db.cancelLoan(b.dataset.lnpull);
    render();
  });
  document.querySelectorAll('[data-ltpull]').forEach(b=>b.onclick=async()=>{
    b.disabled = true;
    await window.__db.cancelLetter(b.dataset.ltpull);
    render();
  });
  document.querySelectorAll('[data-ln-ok]').forEach(b=>b.onclick=()=>{
    const x=HR().loans.find(y=>y.id===b.dataset.lnOk); if(x){x.status='Approved'; x.decided=HDATE(); window.__db.decideLoan(x.id,'Approved');} render(); });
  document.querySelectorAll('[data-ln-no]').forEach(b=>b.onclick=()=>{
    const x=HR().loans.find(y=>y.id===b.dataset.lnNo); if(x){x.status='Declined'; x.decided=HDATE(); window.__db.decideLoan(x.id,'Declined');} render(); });
  document.querySelectorAll('[data-edon]').forEach(b=>b.onclick=()=>{
    state.edit = {table:b.dataset.edon, draft:{}, confirm:false, busy:false};
    state.edSaved = null; render(); });
  document.querySelectorAll('[data-edoff]').forEach(b=>b.onclick=()=>{
    state.edit = null; render(); });
  document.querySelectorAll('[data-edsave]').forEach(b=>b.onclick=()=>{
    if(!EDITING(b.dataset.edsave) || !edList(b.dataset.edsave).length) return;
    state.edit.confirm = true; render(); });
  {
    const back=document.getElementById('edBack');
    if(back) back.onclick=()=>{ state.edit.confirm=false; render(); };
    const go=document.getElementById('edGo');
    if(go) go.onclick=async ()=>{
      const id = state.edit.table, draft = Object.assign({}, state.edit.draft);
      const n = Object.keys(draft).length;
      state.edit.busy = true; render();
      const ok = await EDTABLES[id].save(draft);
      if(ok){ state.edit = null; state.edSaved = {table:id, n}; }
      else if(state.edit){ state.edit.busy = false; state.edit.confirm = false; }
      render();
    };
  }
  /* Typing does not redraw the table: on thirty rows that loses the cursor
     and the scroll. The draft is updated, the cell is marked, and the count
     in the header is corrected in place. */
  const edCount = id => {
    const n = edList(id).length;
    document.querySelectorAll('.edmsg').forEach(s=>{
      s.textContent = edPhrase(n); s.classList.toggle('on', !!n); });
    /* Scoped to the table being edited, not to every Save on the page: only
       one table is ever open, but a bare [data-edsave] here reads as a second
       handler on the same attribute, and the next person to look would have to
       work out which of the two wins. */
    document.querySelectorAll(`[data-edsave="${id}"]`).forEach(b=>{
      b.disabled = !n; b.textContent = 'Save' + (n ? ' ' + n : ''); });
  };
  document.querySelectorAll('[data-edk]').forEach(el=>{
    const id = el.dataset.edt, key = el.dataset.edk;
    const upd = ()=>{
      edSet(id, key, el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value);
      el.classList.toggle('edchanged', key in ((state.edit||{}).draft||{}));
      const row = el.closest('tr'); if(row) row.classList.toggle('edrow', key in ((state.edit||{}).draft||{}));
      edCount(id);
    };
    el.oninput = upd; el.onchange = upd;
    /* Paint what the draft already holds, but do not run the updater: binding
       is not typing, and treating it as typing is what put every untouched
       cell into the change list. */
    const on = key in ((state.edit||{}).draft||{});
    el.classList.toggle('edchanged', on);
    const row0 = el.closest('tr'); if(row0) row0.classList.toggle('edrow', on);
  });
  { const rb = document.getElementById('refShow');
    if(rb) rb.onclick = () => { state.refShow = !state.refShow; render(); }; }
  document.querySelectorAll('[data-docsee]').forEach(b=>b.onclick=()=>{
    const [who, kind] = b.dataset.docsee.split('|');
    const f = fileOf(who, kind); if(!f) return;
    const t = DOCTYPES().find(x => x.k === kind) || {label: kind};
    const exp = ((HR().docs||{})[who]||{})[kind];
    showDoc(f, NM(who) + ' \u2014 ' + t.label,
      exp ? 'expires ' + dayLabel(exp) + ' ' + String(exp).slice(0,4) : 'no expiry on file'); });
  document.querySelectorAll('[data-edrm]').forEach(b=>b.onclick=()=>{
    const id = b.dataset.edt, key = b.dataset.edrm;
    if(!EDITING(id)) return;
    if(key in state.edit.draft) delete state.edit.draft[key];
    else state.edit.draft[key] = 'x';
    render(); });
  const mvw=document.getElementById('mvWho'); if(mvw) mvw.onchange=()=>{
    state.mvWho=mvw.value; state.mvDept=null; state.mvDone=''; render(); };
  const mvd=document.getElementById('mvDept'); if(mvd) mvd.oninput=()=>{
    state.mvDept=mvd.value; const at=mvd.selectionStart; render();
    const e2=document.getElementById('mvDept'); if(e2){ e2.focus(); e2.setSelectionRange(at,at); } };
  const mvs=document.getElementById('mvSave'); if(mvs) mvs.onclick=async ()=>{
    const who=state.mvWho, to=String(state.mvDept===null?orgDeptOf(who):state.mvDept).trim();
    if(!who) return;
    state.mvBusy=true; render();
    const ok=await window.__db.setDepartment(who, to);
    state.mvBusy=false;
    if(ok){ state.mvDept=null; state.mvDone=NM(who); }
    render();
  };
  const exw=document.getElementById('exWho'); if(exw) exw.onchange=()=>{ state.exitWho=exw.value; render(); };
  const exl=document.getElementById('exLwd'); if(exl) exl.onchange=()=>{ state.exitLwd=exl.value; state.exitSettle=''; render(); };
  const exs=document.getElementById('exSettle'); if(exs) exs.onchange=()=>{ state.exitSettle=exs.value; render(); };
  /* The free lines. Typing does not redraw — that would take the cursor with
     it on every keystroke — so the draft is updated in place and the totals
     catch up when the field is left. */
  const exAdd=document.getElementById('exAdd'); if(exAdd) exAdd.onclick=()=>{
    state.exitLines = (state.exitLines||[]).concat([{label:'', amount:'', deduct:false}]); render(); };
  document.querySelectorAll('[data-exlbl]').forEach(el=>{
    el.oninput = ()=>{ state.exitLines[+el.dataset.exlbl].label = el.value; };
    el.onchange = ()=>{ state.exitLines[+el.dataset.exlbl].label = el.value; render(); }; });
  document.querySelectorAll('[data-examt]').forEach(el=>{
    el.oninput = ()=>{ state.exitLines[+el.dataset.examt].amount = el.value; };
    el.onchange = ()=>{ state.exitLines[+el.dataset.examt].amount = el.value; render(); }; });
  document.querySelectorAll('[data-exsign]').forEach(b=>b.onclick=()=>{
    state.exitLines[+b.dataset.exsign].deduct = b.dataset.v === 'less'; render(); });
  document.querySelectorAll('[data-exdrop]').forEach(b=>b.onclick=()=>{
    state.exitLines.splice(+b.dataset.exdrop, 1); render(); });

  const exSave=document.getElementById('exSave'); if(exSave) exSave.onclick=async ()=>{
    const who = state.exitWho, lwd = state.exitLwd;
    if(!who || !lwd) return;
    state.exBusy = true; render();
    const id = await window.__db.saveExit({
      id: state.exitId, who, lastDay: lwd, settled: state.exitSettle || lwd,
      lines: (state.exitLines||[]).filter(x => String(x.label).trim() || +x.amount)
              .map(x => ({label: String(x.label).trim(), amount: +x.amount || 0, deduct: !!x.deduct}))});
    state.exBusy = false;
    if(id){ state.exitId = null; state.exitLines = []; state.exitWho = ''; state.exitLwd = ''; state.exitSettle = ''; }
    render(); };
  const exCancel=document.getElementById('exCancel'); if(exCancel) exCancel.onclick=()=>{
    state.exitId=null; state.exitLines=[]; state.exitWho=''; state.exitLwd=''; state.exitSettle=''; render(); };

  document.querySelectorAll('[data-exedit]').forEach(b=>b.onclick=()=>{
    const x = (HR().exits||[]).find(y=>y.id===b.dataset.exedit); if(!x) return;
    state.exitId = x.id; state.exitWho = x.who; state.exitLwd = x.lastDay;
    state.exitSettle = x.settled || x.lastDay;
    state.exitLines = (x.lines||[]).map(l=>({label:l.label, amount:l.amount, deduct:l.deduct}));
    state.exitOpen = null; render(); });
  document.querySelectorAll('[data-exopen]').forEach(b=>b.onclick=()=>{
    state.exitOpen = b.dataset.exopen; state.exAsk = null; state.exWhy = ''; render(); });
  document.querySelectorAll('[data-exslip]').forEach(b=>b.onclick=()=>{
    const x = (HR().exits||[]).find(y=>y.id===b.dataset.exslip); if(!x) return;
    const c = exitOf(x).c, s = settleOf(c);
    showSlip(settleHTML(s), legalOf(c.row.name), s.ent.legal + ' \u00b7 full and final settlement'); });
  document.querySelectorAll('[data-exgoto]').forEach(b=>b.onclick=()=>{
    state.mode='console'; state.tab='exits';
    state.exitOpen = b.dataset.exgoto; state.exAsk = null; state.exWhy = ''; render(); });
  const exBack=document.getElementById('exBack'); if(exBack) exBack.onclick=()=>{
    state.exitOpen = null; render(); };

  /* Initiating is the one button on this screen that changes somebody's
     employment, so it says what it is about to do before it does it. */
  document.querySelectorAll('[data-exgo]').forEach(b=>b.onclick=async ()=>{
    const x = (HR().exits||[]).find(y=>y.id===b.dataset.exgo); if(!x) return;
    const c = exitOf(x).c;
    const mon = MONTHNAME[+x.lastDay.slice(5,7)-1] + ' ' + x.lastDay.slice(0,4);
    if(!confirm('Initiate ' + NM(x.who) + "'s exit?\n\n"
      + 'AED ' + money(c.net,2) + ' is written down and cannot be changed after this.\n'
      + NM(x.who) + ' comes off the ' + mon + ' payroll and off the staff list.\n'
      + 'It then goes to ' + NM(x.mgr || 'their manager') + ' to approve.\n\n'
      + 'Undo puts all of it back.')) return;
    b.disabled = true;
    await window.__db.initiateExit(x.id, c);
    render(); });

  document.querySelectorAll('[data-exok]').forEach(b=>b.onclick=async ()=>{
    b.disabled = true; await window.__db.approveExit(b.dataset.exok); render(); });
  document.querySelectorAll('[data-exno]').forEach(b=>b.onclick=()=>{
    state.exAsk = b.dataset.exno; state.exWhy = ''; render(); });
  { const w = document.getElementById('exWhy');
    if(w){ w.oninput = ()=>{ state.exWhy = w.value;
      const g = document.getElementById('exWhyGo'); if(g) g.disabled = !w.value.trim(); }; } }
  const exWhyNo=document.getElementById('exWhyNo'); if(exWhyNo) exWhyNo.onclick=()=>{
    state.exAsk=null; state.exWhy=''; render(); };
  const exWhyGo=document.getElementById('exWhyGo'); if(exWhyGo) exWhyGo.onclick=async ()=>{
    exWhyGo.disabled = true;
    const ok = await window.__db.sendExitBack(state.exAsk, state.exWhy.trim());
    if(ok){ state.exAsk=null; state.exWhy=''; state.exitOpen=null; }
    render(); };
  /* Discarding a draft, or withdrawing a settlement because the person is
     staying after all. Both are the same call: the row goes to 'withdrawn',
     which takes it off the Exits list, puts the person back on the staff list
     and back on the month's payroll, and leaves them free to have a new
     settlement drafted later. Nothing is deleted \u2014 a withdrawn settlement
     is still in the table if anybody ever asks what happened. */
  document.querySelectorAll('[data-exkill]').forEach(b=>b.onclick=async ()=>{
    const x = (HR().exits||[]).find(y=>y.id===b.dataset.exkill); if(!x) return;
    const draft = x.status === 'draft';
    if(!confirm(draft
      ? 'Discard the draft settlement for ' + NM(x.who) + '?\n\n'
        + 'Nothing was sent to anybody, so nothing is undone. The draft is cleared\n'
        + 'and you can work another one out any time.'
      : 'Withdraw ' + NM(x.who) + "'s final settlement?\n\n"
        + 'Use this when they are staying after all. ' + NM(x.who) + ' goes back on the\n'
        + 'staff list and back on the payroll, the approvals are cancelled, and the\n'
        + 'settlement comes off the list. It is not the way to correct one \u2014 for that\n'
        + 'use Undo, which puts it back to a draft you can change.')) return;
    b.disabled = true;
    const ok = await window.__db.withdrawExit(x.id);
    if(ok) state.exitOpen = null;
    render(); });
  document.querySelectorAll('[data-exundo]').forEach(b=>b.onclick=async ()=>{
    const x = (HR().exits||[]).find(y=>y.id===b.dataset.exundo); if(!x) return;
    if(!confirm('Undo ' + NM(x.who) + "'s exit?\n\n"
      + 'The figures are unfrozen, ' + NM(x.who) + ' goes back on the payroll and back on the\n'
      + 'staff list, and the settlement returns to a draft you can change.')) return;
    b.disabled = true;
    const ok = await window.__db.sendExitBack(x.id, 'undone by accounts');
    if(ok) state.exitOpen = null;
    render(); });
  document.querySelectorAll('[data-expay]').forEach(b=>b.onclick=async ()=>{
    b.disabled = true; await window.__db.decideExit(b.dataset.expay, b.dataset.mode); render(); });
  document.querySelectorAll('[data-exdone]').forEach(b=>b.onclick=async ()=>{
    b.disabled = true; await window.__db.exitPaid(b.dataset.exdone); render(); });
  document.querySelectorAll('[data-exsee]').forEach(b=>b.onclick=()=>{
    const x = (HR().exits||[]).find(y=>y.id===b.dataset.exsee); if(!x) return;
    const c = exitOf(x).c, s = settleOf(c);
    showSlip(settleHTML(s), legalOf(c.row.name), s.ent.legal + ' · full and final settlement'); });
  const exd=document.getElementById('exDoc'); if(exd) exd.onclick=()=>{
    const c = exitCalc(state.exitWho, state.exitLwd, {lines: state.exitLines}); if(!c) return;
    const s = settleOf(c);
    showSlip(settleHTML(s), legalOf(c.row.name), s.ent.legal + ' \u00b7 full and final settlement');
  };
  const an=document.getElementById('annNew'); if(an) an.onclick=()=>{ state.annNew=true; render(); };
  const ac=document.getElementById('annCancel'); if(ac) ac.onclick=()=>{ state.annNew=false; state.annT=''; state.annB=''; render(); };
  ['annT','annB'].forEach(id=>{ const el=document.getElementById(id); if(!el) return;
    let tm; el.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{ state[id]=el.value; render();
      const e2=document.getElementById(id); if(e2){ e2.focus(); e2.setSelectionRange(e2.value.length,e2.value.length); } },260); }; });
  const ap=document.getElementById('annPost'); if(ap) ap.onclick=()=>{
    if(!(state.annT&&state.annB)) return;
    const ANN = {id:'AN-'+(HR().announcements.length+5), title:state.annT, body:state.annB,
      by:state.user, date:HDATE(), pinned:false};
    HR().announcements.unshift(ANN);
    window.__db.postAnnouncement(ANN);
    state.annNew=false; state.annT=''; state.annB=''; render(); };
  const cb=document.getElementById('conBack'); if(cb) cb.onclick=()=>{ state.mode='staff'; state.tab='home'; render(); };
  document.querySelectorAll('#view [data-go]').forEach(b=>b.onclick=()=>{
    if(b.dataset.mode==='console'){ state.mode='console'; } else if(!(TABS.find(t=>t.id===b.dataset.go)||{}).con){ state.mode='staff'; }
    state.tab=b.dataset.go; render(); });
  document.querySelectorAll('#view [data-con]').forEach(b=>b.onclick=()=>{
    state.mode='console'; state.tab=(CONTABS()[0]||{id:'payroll'}).id; render(); });

  if(state.tab==='invoices'){
    const bind = (id,key)=>{const el=document.getElementById(id); if(el) el.onchange=()=>{state.invFilter[key]=el.value;render();};};
    bind('fq','q'); bind('fs','status'); bind('ftype','type'); bind('frole','role'); bind('fsp','sp'); bind('fpm','pm');
    const ft=document.getElementById('ft');
    let tm; ft.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{state.invFilter.text=ft.value;render();
      const el=document.getElementById('ft'); if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},220);};
    const fc=document.getElementById('fclear');
    if(fc) fc.onclick=()=>{ state.invFilter={q:'all',status:'all',text:'',type:'all',sp:'all',pm:'all',role:'all'};
      state.invSort={key:null,dir:1}; render(); };
    document.querySelectorAll('.invtable th.sortable').forEach(h=>h.onclick=()=>{
      const k=h.dataset.sort;
      if(state.invSort.key===k) state.invSort.dir = -state.invSort.dir;
      else state.invSort = {key:k, dir: ['amt','exp','pc','cn','net','recd','bal','elig','date'].includes(k) ? -1 : 1};
      render();
    });
  }
  if(state.tab==='company'){
    document.querySelectorAll('#grainSeg button').forEach(b=>b.onclick=()=>{state.companyGrain=b.dataset.g;render();});
    document.querySelectorAll('#metricSeg button').forEach(b=>b.onclick=()=>{state.companyMetric=b.dataset.m;render();});
  }
  if(state.tab==='tools'){
    if(document.getElementById('cfInv')){
      ['cfInv','cfCur','cfFxS','cfFxP'].forEach(id=>{const el=document.getElementById(id); if(!el) return;
        el.addEventListener('input',calcCard); el.addEventListener('change',calcCard);});
      calcCard();
    }
    if(document.getElementById('mcInv')){
      ['mcInv','mcUp','mcUsd','mcEur'].forEach(id=>{const el=document.getElementById(id); if(!el) return;
        el.addEventListener('input',calcMattia); el.addEventListener('change',calcMattia);});
      calcMattia();
    }
    if(document.getElementById('pfOrd')){
      const el = document.getElementById('pfOrd');
      el.addEventListener('input',calcPOA); el.addEventListener('change',calcPOA);
      calcPOA();
    }
  }
  if(state.tab==='payment' || state.tab==='payapprove'){
    const cs=document.getElementById('pqClient');
    if(cs){
      cs.addEventListener('input',()=>{ pqList(); pqBadge(); });
      cs.addEventListener('focus',pqList);
      cs.addEventListener('blur',()=>setTimeout(()=>{const b=document.getElementById('pqList'); if(b) b.classList.add('hidden');},120));
      pqBadge();
    }
    // every keystroke, so no redraw can cost somebody their typing
    const body = document.querySelector('.payform .formbody');
    if(body){
      body.addEventListener('input', pqGrab);
      body.addEventListener('change', pqGrab);
    }
    if(state.tab==='payment' && !state.pqSeen){
      state.pqSeen = true;
      const unread = reqs().some(r=>r.by===state.user && !r.seen
        && (r.status==='Approved' || r.status==='Rejected'));
      if(unread && window.__db && window.__db.seenPayments) window.__db.seenPayments();
    }
    const sb=document.getElementById('pqSubmit'); if(sb) sb.onclick=pqSubmit;
    const again=document.getElementById('pqAnother');
    if(again) again.onclick=()=>{
      state.pqDone=null; state.pqForm=null; state.pqErr=''; state.pqCode=''; render(); };

    // documents, chosen before the request exists and uploaded with it
    const fb=document.getElementById('pqFile'), fp=document.getElementById('pqPick');
    if(fb && fp){
      fp.onclick=()=>fb.click();
      fb.onchange=()=>{
        pqGrab();                       // before the redraw, not after it
        const picked=[...(fb.files||[])];
        const room=5-(state.pqFiles||[]).length;
        state.pqFiles=(state.pqFiles||[]).concat(picked.slice(0,Math.max(0,room)));
        state.pqErr = picked.length>room ? 'Five documents is the limit on one request.' : '';
        state.pqCode = '';
        fb.value=''; render();
      };
    }
    document.querySelectorAll('[data-pqdrop]').forEach(b=>b.onclick=()=>{
      pqGrab();
      state.pqFiles=(state.pqFiles||[]).filter((_,i)=>i!==Number(b.dataset.pqdrop));
      state.pqErr=''; state.pqCode=''; render(); });

    document.querySelectorAll('[data-pqpull]').forEach(b=>b.onclick=async()=>{
      b.disabled=true; await window.__db.withdrawPayment(b.dataset.pqpull); });
    document.querySelectorAll('[data-pqdoc]').forEach(b=>b.onclick=async()=>{
      b.disabled=true; await window.__db.detachPayment(b.dataset.pqdoc); });

    /* Attaching to a request that already exists — including one that has been
     * approved, because the receipt, the stamped form and the courier slip all
     * turn up after the payment does. One hidden input for the screen, pointed
     * at whichever request the button belonged to. */
    // data-doc already belongs to the documents screen; this is its own name
    {
      const sb2 = document.getElementById('paySearch');
      if(sb2){
        // typed into, not submitted: the list narrows as you go
        sb2.oninput = () => { state.paySearch = sb2.value; render();
          const again = document.getElementById('paySearch');
          if(again){ again.focus(); again.setSelectionRange(again.value.length, again.value.length); } };
      }
      const csv = document.getElementById('payCsv');
      if(csv) csv.onclick = () => { state.exp = {open:true, from:'', to:'', off:{}}; render(); };
      const expShut = () => { state.exp = null; render(); };
      const xs = document.getElementById('expShut');   if(xs) xs.onclick = expShut;
      const xc = document.getElementById('expCancel'); if(xc) xc.onclick = expShut;
      const xf = document.getElementById('expFrom');
      if(xf) xf.onchange = () => { state.exp.from = xf.value; render(); };
      const xt = document.getElementById('expTo');
      if(xt) xt.onchange = () => { state.exp.to = xt.value; render(); };
      const xcl = document.getElementById('expClear');
      if(xcl) xcl.onclick = () => { state.exp.from = ''; state.exp.to = ''; render(); };
      const xa = document.getElementById('expAll');
      if(xa) xa.onchange = () => {
        state.exp.off = xa.checked ? {} :
          exportRows().reduce((m, r) => (m[r.id] = true, m), {});
        render();
      };
      document.querySelectorAll('[data-exprow]').forEach(cb => cb.onchange = () => {
        const off = state.exp.off || (state.exp.off = {});
        if(cb.checked) delete off[cb.dataset.exprow]; else off[cb.dataset.exprow] = true;
        render();
      });
      const xg = document.getElementById('expGo');
      if(xg) xg.onclick = () => { exportPayments(); state.exp = null; render(); };
      const wa = document.getElementById('payWa');
      if(wa) wa.onclick = () => { state.waMsg = window.__mirazizMsg || ''; state.waTitle = ''; render(); };
      document.querySelectorAll('[data-payedit]').forEach(b => b.onclick = () => {
        state.payEdit = b.dataset.payedit; state.payEditForm = null; state.payEditErr = ''; render(); });
      const edGrab = () => {
        const g = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
        state.payEditForm = {order:g('edOrder'), amount:g('edAmount'), client:g('edClient'),
          purpose:g('edPurpose'), payee:g('edPayee'), mode:g('edMode'), extra:g('edExtra'), ccy:g('edCcy')};
      };
      const edBody = document.querySelector('#edPop .edform');
      if(edBody){ edBody.addEventListener('input', edGrab); edBody.addEventListener('change', edGrab); }
      const edOff = () => { state.payEdit = null; state.payEditForm = null; state.payEditErr = ''; render(); };
      const edC = document.getElementById('edCancel'); if(edC) edC.onclick = edOff;
      const edX = document.getElementById('edShut');  if(edX) edX.onclick = edOff;
      const edP = document.getElementById('edPop');
      if(edP) edP.onclick = e => { if(e.target === edP) edOff(); };
      const edS = document.getElementById('edSave');
      if(edS) edS.onclick = async () => {
        edGrab();
        const f = state.payEditForm || {};
        edS.disabled = true; edS.textContent = 'Saving…';
        const out = await window.__db.editPayment(state.payEdit, f);
        if(out && out.error){
          state.payEditErr = out.error; render(); return;
        }
        edOff();
      };
      const shut = document.getElementById('waShut');
      if(shut) shut.onclick = () => { state.waMsg = null; render(); };
      const wp = document.getElementById('waPop');
      if(wp) wp.onclick = e => { if(e.target === wp){ state.waMsg = null; render(); } };
      const cp = document.getElementById('waCopy');
      if(cp) cp.onclick = async () => {
        try{ await navigator.clipboard.writeText(state.waMsg || ''); cp.textContent = 'Copied'; }
        catch(e){ cp.textContent = 'Select it and copy'; } };
      const go = document.getElementById('waGo');
      if(go) go.onclick = () => { setTimeout(()=>{ state.waMsg = null; render(); }, 300); };
    }
    document.querySelectorAll('[data-paytab]').forEach(b=>b.onclick=()=>{
      state.tab=b.dataset.paytab; state.approve={ref:null,payStatus:'',account:'',remarks:''};
      state.reject=null; render(); });
    document.querySelectorAll('[data-popdoc]').forEach(b=>b.onclick=()=>{
      state.doc={url:b.dataset.popdoc, name:b.dataset.name}; render(); });
    const shut=document.getElementById('docShut');
    if(shut) shut.onclick=()=>{ state.doc=null; render(); };
    const pop=document.getElementById('docPop');
    if(pop) pop.onclick=e=>{ if(e.target===pop){ state.doc=null; render(); } };

    const rowFile=document.getElementById('pqRowFile');
    document.querySelectorAll('[data-pqadd]').forEach(b=>b.onclick=()=>{
      if(!rowFile) return;
      state.pqAddTo=b.dataset.pqadd; rowFile.value=''; rowFile.click(); });
    if(rowFile) rowFile.onchange=async()=>{
      const id=state.pqAddTo, picked=[...(rowFile.files||[])];
      rowFile.value=''; state.pqAddTo=null;
      if(!id || !picked.length) return;
      for(const f of picked) await window.__db.attachPayment(id, f);
      render();
    };

    document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>{
      state.reject = state.reject===b.dataset.reject ? null : b.dataset.reject; render(); });
    const rjGo=document.getElementById('rjGo');
    if(rjGo) rjGo.onclick=async()=>{
      const why=(document.getElementById('rjWhy').value||'').trim();
      if(!why){ state.rjErr='Say why — the person who raised it will read this.'; render(); return; }
      rjGo.disabled=true;
      const out=await window.__db.decidePayment(state.reject, false, why);
      if(out){ state.reject=null; state.rjErr=''; }
      render();
    };

    document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>{
      state.approve = {ref:b.dataset.approve, payStatus:'', account:'', remarks:''};
      state.reject = null; render();
      window.scrollTo({top:0,behavior:'smooth'});
    });
    document.querySelectorAll('[data-ps]').forEach(b=>b.onclick=()=>{ state.approve.payStatus=b.dataset.ps; render(); });

    const recon = async (id, patch, box) => {
      const row = (reqs() || []).find(x => x.id === id);
      const was = row ? {books:row.books, bigin:row.bigin, receipt:row.receipt,
                         payStatus:row.payStatus, account:row.account} : null;
      if(row) Object.assign(row, patch);        // the screen agrees with you at once
      const ok = await window.__db.reconcilePayment(id, patch);
      if(!ok){                                   // it did not take — put it back
        if(row && was) Object.assign(row, was);
        if(box) box.checked = !box.checked;
        render();
      }
    };
    document.querySelectorAll('[data-ordmsg]').forEach(b=>b.onclick=async()=>{
      const r = (reqs()||[]).find(x=>x.id===b.dataset.ordmsg); if(!r) return;
      const msg = orderMessage(r), said = b.textContent;
      try{
        await navigator.clipboard.writeText(msg);
        b.textContent = 'Copied'; b.classList.add('copied');
        setTimeout(()=>{ b.textContent = said; b.classList.remove('copied'); }, 1400);
      }catch(e){
        // no clipboard here — show it instead, where it can be selected
        state.waMsg = msg; state.waTitle = r.order || 'This payment'; render();
      }
    });
    document.querySelectorAll('[data-paystat]').forEach(sel=>sel.onchange=()=>
      recon(sel.dataset.paystat, {payStatus: sel.value.toLowerCase()}));
    document.querySelectorAll('[data-acct]').forEach(sel=>sel.onchange=()=>{
      if(!sel.value) return;              // '— not yet —' is not a change to make
      recon(sel.dataset.acct, {account: sel.value}); });
    document.querySelectorAll('[data-recon]').forEach(cb=>cb.onchange=()=>
      recon(cb.dataset.recon, {[cb.dataset.field]: cb.checked}, cb));
    document.querySelectorAll('[data-ac]').forEach(b=>b.onclick=()=>{
      const r = reqs().find(x=>x.ref===state.approve.ref);   // remark names the requester
      const acct = ACCOUNTS.find(x=>x.id===b.dataset.ac);
      state.approve.account = acct.id;
      state.approve.remarks = acct.remark(r ? r.by : '');
      render();
    });
    const rm=document.getElementById('apRemarks'); if(rm) rm.oninput=()=>{ state.approve.remarks=rm.value; };
    const cancel=document.getElementById('apCancel'); if(cancel) cancel.onclick=()=>{ state.approve={ref:null,payStatus:'',account:'',remarks:''}; render(); };
    const commit = async () => {
      const st = state.approve;
      const r = reqs().find(x=>x.ref===st.ref); if(!r) return null;
      const snap = Object.assign({}, r, {payStatus:st.payStatus, account:st.account, remarks:st.remarks});
      if(r.status==='Pending'){
        const out = await window.__db.decidePayment(r.id, true);
        if(!out) return null;
      }
      if(st.payStatus && st.account){
        const done = await window.__db.settlePayment(
          r.id, st.payStatus.toLowerCase(), st.account, st.remarks);
        if(!done) return null;
      }
      return snap;   // what to put in the message, before the reload redraws
    };
    const wa=document.getElementById('apWa'); if(wa) wa.onclick=async()=>{
      // The window has to be opened by the click itself, or the browser treats
      // it as a pop-up and blocks it. So it opens first and is pointed at the
      // message once the database has taken the approval.
      const tab=window.open('', '_blank', 'noopener');
      wa.disabled=true;
      const r=await commit();
      if(!r){ if(tab) tab.close(); wa.disabled=false; return; }
      if(tab) tab.location='https://wa.me/'+authoriserWa()+'?text='+encodeURIComponent(waMessage(r));
      state.approve={ref:null,payStatus:'',account:'',remarks:''}; render();
    };
    const cp=document.getElementById('apCopy'); if(cp) cp.onclick=async()=>{
      const r = reqs().find(x=>x.ref===state.approve.ref);
      const txt = waMessage(Object.assign({}, r, {payStatus:state.approve.payStatus, account:state.approve.account, remarks:state.approve.remarks}));
      try { await navigator.clipboard.writeText(txt); } catch(e){}
      const el=document.getElementById('apCopied'); if(el) el.textContent='Copied — paste into the payments group';
    };
    const dn=document.getElementById('apDone'); if(dn) dn.onclick=async()=>{
      dn.disabled=true;
      const r=await commit();
      if(!r){ dn.disabled=false; return; }
      state.approve={ref:null,payStatus:'',account:'',remarks:''}; render(); };
  }
  if(state.tab==='payroll'){
    document.querySelectorAll('#coSeg button').forEach(b=>b.onclick=()=>{state.payCompany=b.dataset.co;render();});
    const on=(id,fn)=>{const el=document.getElementById(id); if(el) el.onclick=fn;};
    document.querySelectorAll('#runSeg button').forEach(b=>b.onclick=()=>{state.payRun=b.dataset.run;render();});
    // Each figure saves as you leave the box, and the net comes back from the
    // database — so the total under the column is the stored total, not a
    // second opinion worked out on screen.
    document.querySelectorAll('.payin').forEach(el => {
      el.onfocus = () => el.select();
      el.onkeydown = ev => { if(ev.key === 'Enter') el.blur(); };
    });
    document.querySelectorAll('.attday').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const said = await window.__db.setLine(b.dataset.att, 'days', b.dataset.attv);
      if(said){
        const run = (DATA.payroll.runs||[]).find(r=>r.rows.some(x=>x.lineId===b.dataset.att));
        const row = run && run.rows.find(x=>x.lineId===b.dataset.att);
        if(row){ row.days = +said.days; row.salary = +said.salary;
                 row.gross = +said.gross; row.ded = +said.deductions; row.net = +said.net; }
      }
      const y = window.scrollY; render(); window.scrollTo({top:y, behavior:'instant'});
    });
    { const g = document.getElementById('payGen');
      if(g) g.onclick = async () => {
        g.disabled = true; g.textContent = 'Reading the records\u2026';
        await window.__db.generateRun(state.payRun);
        render(); }; }

    // Every one of these can be refused by the database. None of them assumes
    // it worked: the panel re-reads the run afterwards either way.
    const RUNKEY = () => DATA.payroll.monthKey;
    const act = (id, fn) => { const b = document.getElementById(id); if(!b) return;
      b.onclick = async () => { b.disabled = true; await fn(RUNKEY()); render(); }; };
    act('payInit',     k => window.__db.payRun(k));
    act('payWithdraw', k => window.__db.unsubmitRun(k));
    act('payClose',    k => window.__db.closeRun(k));
    on('paySlips',()=>{state.tab='payslips';render();});
    /* The same act as the button in the panel header, offered where the
       problem is written down. */
    { const g = document.getElementById('payGenTop');
      if(g) g.onclick = async () => { g.disabled = true;
        await window.__db.generateRun(DATA.payroll.monthKey); render(); }; }
    /* This set state.payRun to 'sep'. No run is keyed 'sep' — they are keyed
       '2026-09' — so the payroll screen fell through its own guard and put you
       back on the month you were already looking at. Nothing happened, twice,
       and there was no error to go on. */
    { const go = async (b) => {
        const k = nextRunKey(); if(!k) return;
        b.disabled = true;
        const made = await window.__db.generateRun(k);
        if(made) state.payRun = k;
        render(); };
      ['payNext', 'payNextBtn'].forEach(id => {
        const b = document.getElementById(id); if(b) b.onclick = () => go(b); }); }
    act('paySubmit',   k => window.__db.submitRun(k));
    act('payApprove',  k => window.__db.approveRun(k));
    on('payReturn',()=>{ state.payAsk = true; render(); });
    on('payWhyNo',()=>{ state.payAsk = false; state.payWhy = ''; render(); });
    { const w = document.getElementById('payWhy');
      if(w){ let tm; w.oninput = ()=>{ clearTimeout(tm); tm = setTimeout(()=>{
        state.payWhy = w.value; render();
        const e2 = document.getElementById('payWhy');
        if(e2){ e2.focus(); try{ e2.setSelectionRange(e2.value.length, e2.value.length); }catch(_){} }
      }, 300); }; } }
    { const g = document.getElementById('payWhyGo');
      if(g) g.onclick = async ()=>{ g.disabled = true;
        const r = await window.__db.returnRun(RUNKEY(), state.payWhy);
        if(r){ state.payAsk = false; state.payWhy = ''; }
        render(); }; }

    on('payInt',()=>{state.payInternal=!state.payInternal;render();});
    const pb=(id,key)=>{const el=document.getElementById(id); if(el) el.onchange=()=>{state.payFilter[key]=el.value;render();};};
    pb('pfch','ch'); pb('pfvisa','visa');
    const pt=document.getElementById('pftext');
    if(pt){ let tm; pt.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{state.payFilter.text=pt.value;render();
      const e2=document.getElementById('pftext'); if(e2){e2.focus();e2.setSelectionRange(e2.value.length,e2.value.length);}},220);}; }
    on('pfclear',()=>{state.payFilter={ch:'all',visa:'all',text:''};state.paySort={key:'id',dir:1};render();});
    document.querySelectorAll('[data-psort]').forEach(h=>h.onclick=(ev)=>{
      if(ev.target.tagName==='SELECT') return;
      const k=h.dataset.psort;
      if(state.paySort.key===k) state.paySort.dir=-state.paySort.dir;
      else state.paySort={key:k, dir:['salary','claims','air','comm','gross','adv','mob','ded','net','days'].includes(k)?-1:1};
      render();
    });
    document.querySelectorAll('[data-edit]').forEach(sel=>sel.onchange=()=>{
      const [nm,co]=sel.dataset.row.split('|');
      const row=DATA.payroll.rows.find(r=>r.name===nm && r.company===co);
      if(row){ row[sel.dataset.edit]=sel.value; render(); }
    });
  }
  if(state.tab==='payslips' || state.tab==='myslip'){
    document.querySelectorAll('[data-slip]').forEach(b=>b.onclick=()=>{
      const runs = DATA.payroll.runs || [];
      const here = runs.find(r=>r.key===state.payRun) || runs[0];
      const row = (here ? here.rows : DATA.payroll.rows).find(r=>r.id===b.dataset.slip);
      if(row) return openSlipFor(row, here);
      state.slipOpen = state.slipOpen===b.dataset.slip ? null : b.dataset.slip; render();
      const el=document.querySelector('.slwrap'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
    });
    document.querySelectorAll('#coSeg button').forEach(b=>b.onclick=()=>{state.payCompany=b.dataset.co;render();});
    const pr=document.getElementById('slPrint'); if(pr) pr.onclick=()=>window.print();
    document.querySelectorAll('[data-myslip]').forEach(el => el.onclick = ev => {
      ev.stopPropagation();
      const i = el.dataset.myslip.lastIndexOf('|');
      const key = el.dataset.myslip.slice(0, i), co = el.dataset.myslip.slice(i + 1);
      const run = (DATA.payroll.runs||[]).find(r => r.key === key);
      const row = run && run.rows.find(x => x.portalName === state.user && !x.dummy
        && (x.company || '') === co);
      if(row) openSlipFor(row, run);
    });
  }
  if(state.tab==='tickets'){
    const bind=(id,key)=>{const el=document.getElementById(id); if(el) el.onchange=()=>{state.atFilter[key]=el.value;render();};};
    bind('atst','status'); bind('atco','country');
    const t=document.getElementById('attext');
    if(t){ let tm; t.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{state.atFilter.text=t.value;render();
      const e2=document.getElementById('attext'); if(e2){e2.focus();e2.setSelectionRange(e2.value.length,e2.value.length);}},220);}; }
    const c=document.getElementById('atclear');
    if(c) c.onclick=()=>{state.atFilter={status:'all',country:'all',text:''};state.atSort={key:'nextS',dir:1};render();};
    document.querySelectorAll('[data-atsort]').forEach(h=>h.onclick=()=>{
      const k=h.dataset.atsort;
      if(state.atSort.key===k) state.atSort.dir=-state.atSort.dir;
      else state.atSort={key:k, dir:['rate','taken','pending','backlog'].includes(k)?-1:1};
      render();
    });
  }
  {
    /* No tab guard here. The prototype's was `state.tab==='admin'`, and the
     * console has since been reorganised: the panel now lives on a page called
     * salesup, so that guard stopped matching and every one of these buttons
     * silently did nothing. getElementById is the guard — if the element is on
     * the screen, the handler belongs to it. */
    const pick=document.getElementById('supPick'), file=document.getElementById('supFile');
    if(pick && file){
      pick.onclick=()=>file.click();
      file.onchange=async ()=>{
        const f=file.files && file.files[0]; if(!f) return;
        state.supBusy=true; state.supErr=''; render();
        try{
          const {w, payload} = await window.__db.readSalesFile(f);
          state.sup={
            file:f.name, year:w.year, payload,
            invoices:w.invoices.length, rows:payload.invoices.length,
            clients:w.all.clientCount,
            inv:w.all.totals.inv, net:w.all.totals.net, elig:w.all.totals.elig,
            byDept:w.byDept, voided:w.voided.length, problems:w.problems,
            unmatched:[...new Set(w.invoices.flatMap(i=>[i.seller,i.pm])
              .filter(n=>n && !w.masters.dept[n]))]
          };
        }catch(e){ state.supErr=(e && e.message) || String(e); state.sup=null; }
        state.supBusy=false; file.value=''; render();
      };
    }
    const cancel=document.getElementById('supCancel');
    if(cancel) cancel.onclick=()=>{ state.sup=null; state.supErr=''; render(); };
    const again=document.getElementById('supAgain');
    if(again) again.onclick=()=>{ state.supDone=null; state.sup=null; state.supErr=''; render(); };
    const go=document.getElementById('supGo');
    if(go) go.onclick=async ()=>{
      const s=state.sup; if(!s) return;
      state.supBusy=true; render();
      const out=await window.__db.uploadSales('corplex', s.year, s.file, s.payload);
      state.supBusy=false;
      if(out){ state.supDone={...out, invoices:s.invoices}; state.sup=null; }
      render();
    };
  }
}

{ const bn = document.getElementById('buildNo');
  if(bn) bn.textContent = 'build ' + ((window.CORPLEX_ONE || {}).build || '?'); }

/* Looking at a document without leaving the page.
   Two callers, so two ways in. A staff member on their own Documents page
   passes the kind ('passport') and the viewer finds their own file; accounts,
   on the Staff Documents grid, passes somebody else's file object outright
   along with the heading it should carry. Nothing here reads state.user
   except the first form, which is the only one that should. */
function showDoc(what, title, sub){
  const own = typeof what === 'string';
  const f = own ? ((HR().files || {})[state.user] || {})[what] : what;
  if(!f || !f.url) return;
  const label = own ? (UPLOADS().find(t => t.k === what) || {label: what}).label
                    : (title || 'Document');
  const pdf = /pdf/i.test(f.name || '');
  const box = document.getElementById('lookWrap');
  box.innerHTML = '<div class="lookbg" data-lookclose="1"></div>'
    + '<div class="look" role="dialog" aria-modal="true">'
    +   '<header><b>' + esc(label) + '</b><span>' + esc(f.name) + '</span>'
    +     (sub ? '<span class="mute">' + esc(sub) + '</span>' : '')
    +     '<a class="btn ghost" href="' + f.url + '" download="' + esc(f.name) + '">Download</a>'
    +     '<button class="btn ghost" data-lookclose="1" type="button">Close</button></header>'
    +   '<div class="lookbody">'
    +     (pdf ? '<iframe src="' + f.url + '#toolbar=0" title="' + esc(label) + '"></iframe>'
                : '<img src="' + f.url + '" alt="' + esc(label) + '">')
    +   '</div></div>';
  box.classList.remove('hidden');
  box.querySelectorAll('[data-lookclose]').forEach(b => b.onclick = hideDoc);
  document.body.style.overflow = 'hidden';
}
function hideDoc(){
  const box = document.getElementById('lookWrap');
  if(!box) return;
  box.classList.add('hidden'); box.innerHTML = '';
  document.body.style.overflow = '';
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-look]');
  if(b) showDoc(b.dataset.look);
});
document.addEventListener('keydown', ev => { if(ev.key === 'Escape') hideDoc(); });

/* the running clock */
setInterval(() => {
  document.querySelectorAll('.ciclock[data-since]').forEach(el => {
    const [h, m] = (el.dataset.since || '').split(':').map(Number);
    if(isNaN(h) || isNaN(m)) return;
    const now = new Date();
    const start = new Date(now); start.setHours(h, m, 0, 0);
    let s = Math.floor((now - start) / 1000) + (+el.dataset.base || 0) * 60;
    if(s < 0) s = 0;                                  // checked in after midnight
    const out = el.querySelector('.citime');
    const txt = Math.floor(s/3600) + ':'
      + String(Math.floor(s/60) % 60).padStart(2,'0') + ':'
      + String(s % 60).padStart(2,'0');
    if(out && out.textContent !== txt) out.textContent = txt;
  });
}, 1000);

/* the save button */
document.addEventListener('click', async ev => {
  const b = ev.target.closest && ev.target.closest('#pfSave');
  if(!b || !state.pfDirty) return;
  const changes = state.pfDirty;
  b.disabled = true; b.textContent = 'Saving…';
  const ok = await window.__db.saveProfileAll(changes);
  if(ok){
    state.pfDirty = null;
    state.pfSaved = 'Saved';
    clearTimeout(window.__pfT);
    window.__pfT = setTimeout(() => { state.pfSaved = ''; render(); }, 4000);
  }
  render();
});

// leaving with something unsaved should cost a click, not a shrug
window.addEventListener('beforeunload', ev => {
  if(!state.pfDirty) return;
  ev.preventDefault(); ev.returnValue = '';
});

/* theme + login */
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  document.querySelectorAll('#themeSeg button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.t===t));
}
document.querySelectorAll('#themeSeg button').forEach(b=>b.onclick=()=>setTheme(b.dataset.t));
(function initTheme(){
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(dark?'dark':'light');
})();
document.getElementById('signout').onclick = ()=>window.__db.signOut();
window.render = render;
window.addEventListener('hashchange', () => { readHash(); render(); });
readHash();
render();

let _rt, _wasPhone = MOBILE();
window.addEventListener('resize',()=>{clearTimeout(_rt);_rt=setTimeout(()=>{
  if(MOBILE() !== _wasPhone){ _wasPhone = MOBILE(); closeSheet(); render(); } else drawCharts();
},160);});


/* Where a segment came from, marked only for the people the database lets
 * see it. A colleague gets no evidence at all, so there is nothing to mark. */
function whereMark(g){
  if(!g.where) return '';
  const w = g.where, bits = [];
  if(w.ip)   bits.push('from ' + w.ip);
  if(w.away != null) bits.push(w.away + ' m from the office' + (w.acc ? ' (\u00b1' + w.acc + ' m)' : ''));
  if(!bits.length) return '';
  const t = esc(bits.join(' \u00b7 '));
  return g.where.flagged
    ? `<span class="wmark bad" title="${t}">could not confirm</span>`
    : `<span class="wmark" title="${t}">${w.ipOk ? 'office network' : (w.away != null ? 'at the office' : '')}</span>`;
}

/* --- fixing a day you missed --- */
function regularDays(u){
  // Days this month, and the tail of last month while it is still open, with
  // something missing. A weekend or a holiday has nothing to miss.
  const R = REG(), out = [], today = HDATE();
  const from = R.from || today.slice(0,8) + '01';
  const filed = new Set(R.mine.filter(r => ['Pending','Approved'].includes(r.status)).map(r => r.d));
  for(let d = new Date(from + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)){
    const ds = d.toISOString().slice(0,10);
    if(ds > today) break;
    const st = dayStatus(u, ds);
    if(['Weekend','Holiday','Annual','Sick','Unpaid','Bereavement','Birthday',
        'Maternity','Paternity','Hajj','Umrah'].includes(st.k)) continue;
    if(filed.has(ds)) continue;
    const a = attOf(u, ds);
    if(!a || !a.segs.length){ out.push({d: ds, what: 'nothing recorded'}); continue; }
    const last = a.segs[a.segs.length - 1];
    if(!last.out && ds < today) out.push({d: ds, what: 'no check-out'});
  }
  return out.reverse();
}

/* The two halves of it. They were one panel, with the list of what you had
   asked for tucked inside the box you ask from, which is why a request looked
   like it had gone nowhere: the only place it appeared was the form. */
function regularForm(u){
  const R = REG(), missing = regularDays(u), mine = R.mine;
  if(!missing.length && !mine.length) return '';
  const f = state.rgForm || (state.rgForm = {d:'', in:'', out:'', reason:''});
  const none = R.left <= 0;
  const pickable = missing.slice(0, 40);
  const ok = f.d && missing.some(m => m.d === f.d)
    && f.reason.trim().length > 3 && (f.in || f.out) && !none;
  return `
  <section class="panel">
    <header><h3>Fix a day you missed</h3>
      <span class="pill ${none?'mute':'good'}">${none?'none left this month':R.left + ' of ' + R.max + ' left this month'}</span>
      <span class="hint" style="margin-left:auto">decided by ${esc(NM(adminName()) || 'accounts')}</span></header>
    <div class="pad">
      ${missing.length ? `
      <div class="rgform">
        <label><span>Which day</span>
          <input id="rgDay" type="date" value="${esc(f.d)}"
            min="${esc(pickable[pickable.length-1].d)}" max="${esc(pickable[0].d)}">
          <span class="pfhint">${(() => {
            const hit = missing.find(m => m.d === f.d);
            if(!f.d) return `${missing.length} day${missing.length===1?'':'s'} to fix &mdash; ${
              esc(dayName(missing[0].d))} ${esc(dayLabel(missing[0].d))}${
              missing.length>1 ? ' is the most recent' : ''}`;
            return hit
              ? `${esc(dayName(f.d))} ${esc(dayLabel(f.d))} &mdash; ${esc(hit.what)}`
              : '<b style="color:var(--bad)">Nothing is missing on that day.</b> Pick one of the '
                + missing.length + ' that are.';
          })()}</span></label>
        <label><span>Checked in at</span><input id="rgIn" type="time" value="${esc(f.in)}"></label>
        <label><span>Checked out at</span><input id="rgOut" type="time" value="${esc(f.out)}"></label>
        <label class="wide"><span>What happened</span>
          <input id="rgWhy" type="text" maxlength="160" value="${esc(f.reason)}"
            placeholder="Went straight to the client in Deira and forgot to tap in"></label>
      </div>
      <button class="btn" id="rgGo" type="button"${ok?'':' disabled'}>Send request</button>
      ${none ? '<p class="note" style="margin-top:14px;border-left-color:var(--warn)"><b>Both of this month\u2019s are used.</b> A declined request costs nothing, so this is two that were approved. The allowance comes back on the 1st.</p>' : ''}
      ${state.rgSent ? '<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>Sent.</b> Accounts has it, and you will see the answer here.</div>' : ''}
      ` : '<p style="margin:0;color:var(--ink2)">Nothing is missing. Every working day this month has a check-in and a check-out.</p>'}
    </div>
  </section>`;
}

/* Everything you have ever asked for, and what came of it. Its own box, the
   full width of the screen, because this is the answer to "where did my
   request go" and an answer should not be a column inside a form. */
function regularList(u){
  const mine = REG().mine;
  return `<section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Your requests</h3>
      <span class="hint">${mine.length
        ? mine.filter(r => r.status === 'Pending').length + ' waiting \u00b7 ' + mine.length + ' in all'
        : 'nothing asked for yet'}</span></header>
    ${mine.length ? `<div class="tw"><table class="invtable">
      <thead><tr><th>Ref</th><th>Day</th><th class="n">In</th><th class="n">Out</th><th>Why</th>
        <th>State</th><th>Decided</th><th></th></tr></thead>
      <tbody>${mine.map(r => `<tr>
        <td class="n">${esc(r.id)}</td>
        <td class="nw">${esc(dayName(r.d))} ${esc(dayLabel(r.d))}</td>
        <td class="n">${esc(r.in)||'\u2014'}</td><td class="n">${esc(r.out)||'\u2014'}</td>
        <td style="color:var(--ink2);font-size:12.5px"${full(r.reason + (r.note ? ' \u2014 ' + r.note : ''))}>${
          esc(r.reason)}${r.note?' \u00b7 <i>'+esc(r.note)+'</i>':''}</td>
        <td><span class="dpill" style="--dc:${RGCOL(r.status)}">${esc(r.status)}</span></td>
        <td class="n nw">${r.decided ? esc(dayLabel(r.decided)) : '\u2014'}</td>
        <td>${r.status==='Pending'?`<button class="btn ghost sm" data-rgdrop="${esc(r.uid)}" type="button">Withdraw</button>`:''}</td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="pad" style="padding:34px 24px;color:var(--ink3)">You have not asked to fix a day yet.
          A day with no check-in, or one you forgot to check out of, can be corrected here \u2014 twice a month.</div>`}
    <p class="cap">Two a month, counted by the database rather than by this screen. A declined request costs
      nothing. Once one is approved the times go straight onto that day, so the hours and the working-days
      figure that payroll reads move with it \u2014 there is nothing further for you to do.</p>
  </section>`;
}
// A function, not a const: this block is appended after the app has already
// started drawing, and a const would not be initialised in time.
function RGCOL(s){ return {Pending:'var(--warn)', Approved:'var(--good)',
  Declined:'var(--bad)', Withdrawn:'var(--ink3)'}[s] || 'var(--line)'; }
function adminName(){
  const R = DATA._roles || {};
  return Object.keys(R).find(n => (R[n]||[]).includes('accounts')) || '';
}

/* --- the console: every request, and who is at their limit --- */
function vRegular(){
  /* Both tables on this page carry the same first six columns — ref, who,
     day, in, out, why — and they sit one above the other. Reading down the
     page means reading down a column, so they are laid out from one set of
     widths rather than each finding its own. */
  const REGCOLS = colsOf([8, 18, 12, 8, 8, 25, 11, 10]);
  const R = REG();
  const rows = R.rows, pend = rows.filter(r => r.status === 'Pending');
  const month = HDATE().slice(0,7);
  const approvedThis = rows.filter(r => r.status === 'Approved' && r.d.slice(0,7) === month);
  const atLimit = Object.entries(R.used || {})
    .filter(([k, n]) => k.endsWith('|' + month) && n >= R.max)
    .map(([k]) => k.split('|')[0]);
  const late = USERS.map(x => x.name).filter(tracksAtt)
    .filter(n => { const g = nudgeFor(n); return g && g.escalated; });

  return `
  <div class="strip">
    <div class="stat"><span class="k">Waiting for you</span>
      <span class="v" style="color:var(--${pend.length?'warn':'good'})">${pend.length}</span>
      <span class="n">${pend.length?'to approve or decline':'nothing outstanding'}</span></div>
    <div class="stat"><span class="k">Approved this month</span><span class="v">${approvedThis.length}</span>
      <span class="n">${MONTHNAME[+month.slice(5)-1]} ${month.slice(0,4)}</span></div>
    <div class="stat"><span class="k">At their limit</span>
      <span class="v" style="color:var(--${atLimit.length?'warn':'ink'})">${atLimit.length}</span>
      <span class="n">${atLimit.length?esc(atLimit.map(NM).join(', ')):'nobody has used both'}</span></div>
    <div class="stat"><span class="k">Not checked in today</span>
      <span class="v" style="color:var(--${late.length?'bad':'good'})">${late.length}</span>
      <span class="n">${late.length?'past '+(HR().escalateMin??30)+' minutes':'everybody is in or accounted for'}</span></div>
  </div>

  ${pend.length ? `<section class="panel">
    <header><h3>Waiting for a decision</h3><span class="hint">only you can decide these</span></header>
    <div class="tw"><table>
      ${REGCOLS}
      <thead><tr><th>Ref</th><th>Who</th><th>Day</th><th class="n">In</th><th class="n">Out</th>
        <th>Why</th><th class="n r">Left</th><th></th></tr></thead>
      <tbody>${pend.map(r => {
        const left = Math.max(0, R.max - (R.used[r.who + '|' + r.d.slice(0,7)] || 0));
        return `<tr>
        <td class="n">${esc(r.id)}</td><td class="nw">${esc(NM(r.who))}</td>
        <td class="nw">${esc(dayName(r.d))} ${esc(dayLabel(r.d))}</td>
        <td class="n">${esc(r.in)||'\u2014'}</td><td class="n">${esc(r.out)||'\u2014'}</td>
        <td style="color:var(--ink2);font-size:12.5px">${esc(r.reason)}</td>
        <td class="n r"${left?'':' style="color:var(--bad)"'}>${left} of ${R.max}</td>
        <td class="nw"><button class="btn sm" data-rgok="${esc(r.uid)}" type="button"${left?'':' disabled title="both are used"'}>Approve</button>
          <button class="btn ghost sm" data-rgno="${esc(r.uid)}" type="button">Decline</button></td></tr>`;}).join('')}
      </tbody></table></div>
    <p class="cap">Approving writes the times onto that day\u2019s attendance and marks it as regularized, so the working-days figure that payroll sees moves with it.</p>
  </section>` : ''}

  ${late.length ? `<section class="panel">
    <header><h3>Not checked in today</h3><span class="hint">more than ${HR().escalateMin??30} minutes past their shift</span></header>
    ${byCompany(late, {
      who: n => NM(n),
      cols: colsOf([34, 16, 32, 18]),
      head: `<thead><tr><th>Who</th><th>Shift</th><th>Manager</th><th class="r">Late by</th></tr></thead>`,
      row: n => { const g = nudgeFor(n); return `<tr>
        <td>${esc(NM(n))}</td><td class="n">${esc(shiftOf(n).start)}</td>
        <td>${esc(NM(mgrName(n)) || '\u2014')}</td>
        <td class="n r">${g.by} min</td></tr>`; },
      empty: 'Everybody is in.'
    })}
  </section>` : ''}

  <section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>Every request</h3><span class="hint">${rows.length} in all</span></header>
    ${byCompany(rows, {
      who: r => NM(r.who), cls: 'invtable',
      cols: REGCOLS,
      head: `<thead><tr><th>Ref</th><th>Who</th><th>Day</th><th class="n">In</th><th class="n">Out</th>
        <th>Why</th><th>State</th><th>Decided</th></tr></thead>`,
      row: r => `<tr>
        <td class="n">${esc(r.id)}</td><td>${esc(NM(r.who))}</td>
        <td class="nw">${esc(dayLabel(r.d))}</td>
        <td class="n">${esc(r.in)||'\u2014'}</td><td class="n">${esc(r.out)||'\u2014'}</td>
        <td style="color:var(--ink2);font-size:12.5px"${full(r.reason + (r.note ? ' — ' + r.note : ''))}>${esc(r.reason)}${r.note?' \u00b7 <i>'+esc(r.note)+'</i>':''}</td>
        <td><span class="dpill" style="--dc:${RGCOL(r.status)}">${esc(r.status)}</span></td>
        <td class="n">${esc(r.decided)?esc(dayLabel(r.decided)):'\u2014'}</td></tr>`,
      empty: 'Nobody has asked to fix a day yet.'
    })}
    <p class="cap">Two approved a month each, counted by the database rather than by this screen \u2014 a limit only the screen keeps is not a limit. A declined request costs nobody anything.</p>
  </section>`;
}


const PAYRUNS = () => (DATA.payroll.runs || []);
const runOf = key => PAYRUNS().find(r => r.key === key) || null;
const draftRun = () => PAYRUNS().find(r => r.status === 'draft') || null;
// the month before the one being looked at, for comparison
const priorRun = key => {
  const all = PAYRUNS().filter(r => r.key < key).sort((a,b) => a.key < b.key ? 1 : -1);
  return all[0] || null;
};
const MKEY = k => { const [y,m] = k.split('-'); return MONTHNAME[+m-1] + ' ' + y; };

// the columns you can type into, in the order they appear on the register
// rule: true marks where one kind of column stops and the next begins —
// after the days, after the earnings, after the deductions.
const PAYCOLS = [
  {k:'days',   f:'days',       label:'Days',       rule:true},
  {k:'claims', f:'claims',     label:'Claims'},
  {k:'air',    f:'air_ticket', label:'Air ticket', auto:true},
  {k:'inc',    f:'incentive',  label:'Incentive'},
  {k:'comm',   f:'commission', label:'Commission'},
  {k:'ref',    f:'referral',   label:'Referral'},
  {k:'other',  f:'other_add',  label:'Other',      rule:true},
  {k:'adv',    f:'advance',    label:'Advance'},
  {k:'don',    f:'donation',   label:'Donation'},
  {k:'ins',    f:'insurance',  label:'Insurance'},
  {k:'mob',    f:'mobile',     label:'Mobile'},
  {k:'oth',    f:'other_ded',  label:'Other ded.', rule:true}
];
// Employee, company, then fourteen money columns all the same width.
const PAYGROUP = () => '<colgroup><col style="width:15%"><col style="width:6%">'
  + Array(PAYCOLS.length + 2).fill('<col style="width:5.65%">').join('') + '</colgroup>';

/* --- what moved since last month, and why ---
 * This is what replaces the spreadsheet as the second pair of eyes. A figure
 * that moved for a reason is fine; a figure that moved for no reason is the
 * thing to look at. */
function payVariance(run){
  const prev = priorRun(run.key);
  if(!prev) return null;
  // A person, not a line. Somebody who changes company mid-year — Fakhridin
  // Kochkorov moving from POA to Lex — would otherwise read as one person
  // leaving and a different one arriving, and Miraziz's two lines are one
  // person's pay. The invented rows are not part of the comparison at all.
  const fold = list => {
    const by = {};
    list.filter(r => !r.dummy).forEach(r => {
      const k = r.portalName;
      const a = by[k] || (by[k] = {portalName:k, company:r.company, companies:[],
        days:r.days, salary:0, air:0, comm:0, claims:0, inc:0, ref:0, other:0,
        gross:0, ded:0, net:0});
      ['salary','air','comm','claims','inc','ref','other','gross','ded','net']
        .forEach(f => { a[f] += (+r[f] || 0); });
      if(!a.companies.includes(r.company)) a.companies.push(r.company);
      // sorted, or Miraziz reads as moving from 'CorpLex + POA' to
      // 'POA + CorpLex' every month depending on the order the rows arrived in
      a.company = a.companies.slice().sort().join(' + ');
    });
    return by;
  };
  const was = fold(prev.rows), now = fold(run.rows);
  const seen = {};
  const out = [];
  Object.values(now).forEach(r => {
    const k = r.portalName;
    seen[k] = true;
    const p = was[k];
    if(!p){ out.push({r, kind:'new', by: r.net, why:['a joiner — not on ' + MKEY(prev.key)]}); return; }
    const by = Math.round((r.net - p.net) * 100) / 100;
    if(!by && p.company === r.company) return;
    const why = [];
    if(p.company !== r.company) why.push('moved from ' + p.company + ' to ' + r.company);
    if(r.salary !== p.salary){
      why.push(r.days !== p.days
        ? r.days + ' days rather than ' + p.days
        : 'salary ' + money(p.salary,0) + ' \u2192 ' + money(r.salary,0));
    }
    if(r.air !== p.air)   why.push(r.air ? 'air ticket due' : 'no air ticket this month');
    if(r.comm !== p.comm) why.push('commission ' + money(p.comm,0) + ' \u2192 ' + money(r.comm,0));
    if(r.claims !== p.claims) why.push('claims changed');
    if(r.inc !== p.inc)   why.push('incentive changed');
    if(r.ref !== p.ref)   why.push('referral changed');
    if(r.other !== p.other) why.push('other earnings changed');
    if(r.ded !== p.ded)   why.push('deductions ' + money(p.ded,0) + ' \u2192 ' + money(r.ded,0));
    out.push({r, kind:'moved', by, why});
  });
  Object.values(was).forEach(r => {
    if(!seen[r.portalName])
      out.push({r, kind:'gone', by: -r.net,
                why:['on ' + MKEY(prev.key) + ', not on this one — a leaver, or off payroll']});
  });
  out.sort((a,b) => Math.abs(b.by) - Math.abs(a.by));
  return {prev, rows: out,
          prevNet: Object.values(was).reduce((s,r) => s + r.net, 0),
          unexplained: out.filter(x => x.kind === 'moved' && !x.why.length)};
}

function vPayrollDraft(run){
  const P = DATA.payroll, T = DATA.tickets;
  const prep = canUpload(state.user);
  const byNo = (a,b) => (a.staffNo || 'ZZ').localeCompare(b.staffNo || 'ZZ')
                     || a.company.localeCompare(b.company);
  const rows  = run.rows.filter(r => !r.dummy).sort(byNo);
  // Payments that leave the account without being a staff cost. Avin types
  // their figures like anybody else's; they simply sit under their own heading
  // and outside the staff total, which is the only thing that makes them
  // different.
  const extra = run.rows.filter(r => r.dummy).sort(byNo);
  const COS = ['CorpLex','POA','Lex'];
  const coLabel = c => c === 'Lex' ? 'Lex Estates' : c;
  const tot = f => rows.reduce((s,r) => s + (+r[f] || 0), 0);
  const V = payVariance(run);
  const dueNow = rows.filter(r => r.air > 0);
  const noSalary = rows.filter(r => !r.salary && !r.comm && !r.claims);

  const cell = (r, c) => {
    const v = +r[c.k] || 0;
    if(!prep) return `<td class="n r${c.rule?' rule':''}">${v?money(v,2):'\u2014'}</td>`;
    return `<td class="n r payc${c.rule?' rule':''}">${edCell('payline', r.lineId + '|' + c.f,
      x => `<input class="payin${(+x)?' has':''}" type="number" step="0.01" min="0"
        value="${(+x)||''}" placeholder="\u2014"${edAttr('payline', r.lineId + '|' + c.f)}
        aria-label="${esc(c.label)} for ${esc(r.portalName)}">`,
      x => (+x) ? '<span class="edread">' + money(+x, 2) + '</span>' : '<span class="edread none">\u2014</span>')}${
      // On the days column, what check-in made of the month sits under the
      // box. A missed tap is not an absence — that is what regularization is
      // for — so it is a second opinion to accept or ignore, never the figure
      // being paid.
      c.k === 'days' && r.daysAtt !== null && r.daysAtt !== undefined
        && Math.abs(r.daysAtt - v) > 0.001
        ? `<button class="attday" type="button" data-att="${esc(r.lineId)}" data-attv="${r.daysAtt}"
             title="Check-in recorded ${r.daysAtt} days. Click to use it.">check-in ${money(r.daysAtt,0)}</button>`
        : ''}</td>`;
  };
  const attDiff = rows.filter(r => r.daysAtt !== null && r.daysAtt !== undefined
    && Math.abs(r.daysAtt - r.days) > 0.001);
  const attNone = rows.filter(r => r.daysAtt === null || r.daysAtt === undefined);

  return `
  <div class="strip tight">
    <div class="stat"><span class="k">${esc(run.label)} <i>draft</i></span>
      <span class="v"><span class="cur">AED</span>${money(tot('net'),2)}</span>
      <span class="n">${rows.length} people \u00b7 nothing paid yet</span></div>
    <div class="stat"><span class="k">Earnings</span>
      <span class="v"><span class="cur">AED</span>${money(tot('gross'),0)}</span>
      <span class="n">salary ${money(tot('salary'),0)}${
        tot('gross')-tot('salary') ? ' \u00b7 added ' + money(tot('gross')-tot('salary'),0) : ''}${
        dueNow.length ? ' \u00b7 ' + dueNow.length + ' air ticket' + (dueNow.length===1?'':'s') : ''}</span></div>
    <div class="stat"><span class="k">Deductions</span>
      <span class="v" style="color:var(--${tot('ded')?'warn':'ink'})"><span class="cur">AED</span>${money(tot('ded'),0)}</span>
      <span class="n">${(() => { const n = rows.filter(r=>r.ded).length;
        return n === 0 ? 'nobody has one' : n === 1 ? 'one person' : n + ' people'; })()}</span></div>
    <div class="stat"><span class="k">Check-in disagrees</span>
      <span class="v" style="color:var(--${attDiff.length?'warn':'good'})">${attDiff.length}</span>
      <span class="n">${attDiff.length
        ? esc(attDiff.slice(0,3).map(r=>nm(r.portalName)+' '+money(r.daysAtt,0)+'d').join(', '))
          + (attDiff.length>3 ? ' and ' + (attDiff.length-3) + ' more' : '')
        : 'the days being paid match the records'}</span></div>
  </div>

  ${staleNote(run.key)}
  <section class="panel">
    <header><h3>${esc(run.label)}</h3>
      <span class="pill warn"><span class="dt"></span>Draft</span>
      ${runSeg()}
      ${prep?`<button class="btn ghost" id="payGen" type="button" style="margin-left:auto;padding:5px 13px;font-size:12.5px"${
        EDANY()?' disabled':''}>Refresh from the records</button>`:''}
      ${prep ? edBar('payline') : ''}
    </header>
    ${edSaved('payline')}${edConfirm('payline')}
    <div class="pad">
      <p style="margin:0;color:var(--ink2);font-size:14.5px;max-width:88ch">
        The salary, the days and the air ticket come from the records and refresh
        whenever you press the button above &mdash; after a joiner, a revision letter, or a
        correction. Everything else is yours to type, and refreshing never touches it.
        ${EDITING('payline')
          ? 'You are editing. Nothing you type here reaches the payroll until you press Save and agree to the list of changes.'
          : 'Press <b>Edit</b> to change a figure. Nothing is written until you have seen the list of what will change and agreed to it.'}</p>
      ${noSalary.length?`<p class="note" style="margin-top:14px"><b>${noSalary.length}
        ${noSalary.length===1?'person has':'people have'} nothing on their line yet</b> &mdash;
        ${esc(noSalary.map(r=>nm(r.portalName)).join(', '))}. Commission-only staff are
        expected to look like this until you type their figure.</p>`:''}
    </div>
    <div class="tw"><table class="invtable paytable">
      ${PAYGROUP()}
      <thead><tr><th class="s1">Employee</th><th>Co.</th>${PAYCOLS.map(c=>
        `<th class="r${c.rule?' rule':''}">${esc(c.label)}${c.auto?' <i class="autoc">auto</i>':''}</th>`).join('')}
        <th class="r rule">Gross</th><th class="r">Net</th></tr></thead>
      <tbody>${(() => {
        const line = r => `<tr>
          <td class="s1">${nm(r.portalName)}${r.vat?' <span class="wmark">+VAT to pay</span>':''}</td>
          <td class="nw">${esc(r.company)}</td>
          ${PAYCOLS.map(c=>cell(r,c)).join('')}
          <td class="n r rule">${money(r.gross,2)}</td>
          <td class="n r netcol">${money(r.net,2)}</td></tr>`;
        const sub = (list, label, cls) => {
          const t = f => list.reduce((s,r) => s + (+r[f] || 0), 0);
          return `<tr class="${cls}"><td class="s1">${esc(label)}</td>
            <td>${list.length} ${list.length===1?'person':'people'}</td>
            ${PAYCOLS.map(c=>`<td class="n r${c.rule?' rule':''}">${t(c.k)?money(t(c.k), c.k==='days'?0:2):'\u2014'}</td>`).join('')}
            <td class="n r rule">${money(t('gross'),2)}</td>
            <td class="n r netcol">${money(t('net'),2)}</td></tr>`;
        };
        let out = '';
        COS.forEach(c => {
          const g = rows.filter(r => r.company === c);
          if(!g.length) return;
          out += `<tr class="grp"><td class="s1" colspan="${PAYCOLS.length+4}">${esc(coLabel(c))}</td></tr>`;
          out += g.map(line).join('');
          out += sub(g, '', 'sub');
        });
        out += sub(rows, rows.length + ' on the payroll', 'tot');
        if(extra.length){
          out += `<tr class="grp"><td class="s1" colspan="${PAYCOLS.length+4}">Not staff — leaves the account, not a staff cost</td></tr>`;
          out += extra.map(line).join('');
          out += sub(extra, '', 'sub');
          out += sub(rows.concat(extra), 'Everything leaving the account', 'tot');
        }
        return out;
      })()}
      </tbody></table></div>
    <p class="cap">Days are 30 less unpaid leave, pro-rated for anyone who joined or left inside the month. Where check-in makes it a different number, that figure sits under the box &mdash; click it to take it, or leave it and pay the days above. A missed tap is not an absence, so attendance advises and never decides. A figure you type is yours: refreshing from the records will not overwrite it, and the gross and net are worked out in the database rather than here.${
      attNone.length ? ' <b>' + attNone.length + ' ' + (attNone.length===1?'person has':'people have') + ' no attendance recorded this month</b> &mdash; ' + esc(attNone.map(r=>nm(r.portalName)).join(', ')) + '.' : ''}</p>
    ${exitBox(run.key)}
  </section>

  ${V ? `<section class="panel invpanel" style="height:auto;max-height:none">
    <header><h3>What moved since ${esc(MKEY(V.prev.key))}</h3>
      <span class="hint">${V.rows.length} ${V.rows.length===1?'change':'changes'}${
        V.unexplained.length?' \u00b7 '+V.unexplained.length+' with no reason found':''}</span></header>
    ${V.rows.length?`<div class="tw"><table class="invtable">
      <thead><tr><th class="s1">Employee</th><th>Co.</th><th class="r">${esc(MKEY(V.prev.key))}</th>
        <th class="r">${esc(MKEY(run.key))}</th><th class="r">Change</th><th>Why</th></tr></thead>
      <tbody>${V.rows.map(x=>{
        // For a leaver the row we kept IS last month's, so its net is the
        // "was" and there is no "now" — subtracting the change would count it
        // twice.
        const was = x.kind === 'new'  ? null
                  : x.kind === 'gone' ? x.r.net
                  : Math.round((x.r.net - x.by) * 100) / 100;
        return `<tr>
        <td class="s1">${nm(x.r.portalName)}</td><td class="nw">${esc(x.r.company)}</td>
        <td class="n r">${was===null?'\u2014':money(was,2)}</td>
        <td class="n r">${x.kind==='gone'?'\u2014':money(x.r.net,2)}</td>
        <td class="n r" style="color:var(--${x.by>=0?'warn':'good'})">${x.by>=0?'+':'('}${money(Math.abs(x.by),2)}${x.by>=0?'':')'}</td>
        <td class="gnote">${x.why.length
          ? esc(x.why.join(' \u00b7 '))
          : '<span class="pill warn"><span class="dt"></span>no reason found &mdash; look at this one</span>'}</td></tr>`;}).join('')}
        <tr class="tot"><td class="s1">Net change</td><td></td>
          <td class="n r">${money(V.prevNet,2)}</td>
          <td class="n r">${money(tot('net'),2)}</td>
          <td class="n r netcol">${money(tot('net') - V.prevNet,2)}</td>
          <td></td></tr>
      </tbody></table></div>
      <p class="cap">This is what the spreadsheet used to do for you: not the arithmetic, which the database can be trusted with, but a second opinion on whether a number that moved was <i>meant</i> to move. Anything in this list without a reason beside it is worth a look before you submit.</p>`
      : '<div class="pad"><p style="margin:0;color:var(--ink2)">Nothing has moved since '+esc(MKEY(V.prev.key))+'.</p></div>'}
  </section>` : ''}`;
}

function oops2(msg){
  const t = document.createElement('div');
  t.className = 'toast bad'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}
function showSlip(html, title, sub){
  const box = document.getElementById('lookWrap');
  box.innerHTML = '<div class="lookbg" data-lookclose="1"></div>'
    + '<div class="look slipmodal" role="dialog" aria-modal="true" aria-label="Payslip">'
    +   '<header><b>' + esc(title) + '</b><span>' + esc(sub || '') + '</span>'
    +     '<button class="btn ghost" id="slipPrint" type="button">Print or save as PDF</button>'
    +     '<button class="btn ghost" data-lookclose="1" type="button">Close</button></header>'
    +   '<div class="lookbody slipbody">' + html + '</div></div>';
  box.classList.remove('hidden');
  box.querySelectorAll('[data-lookclose]').forEach(b => b.onclick = hideDoc);
  const pr = document.getElementById('slipPrint');
  if(pr) pr.onclick = () => {
    document.body.classList.add('printslip');
    window.print();
    setTimeout(() => document.body.classList.remove('printslip'), 400);
  };
  document.body.style.overflow = 'hidden';
}
function openSlipFor(row, run){
  if(!row) return;
  const s = slipOf(row, run);
  /* s.month never existed — the subtitle read "CorpLex · undefined". It is
     s.period, and now that a payslip is dated by its own run it is the month
     the sheet is actually for rather than the month the console is on. */
  showSlip(slipHTML(s), nm(row.portalName || row.name),
           (DATA.payroll.label[row.company] || row.company) + ' \u00b7 ' + s.period);
}
