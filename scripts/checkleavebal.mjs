/* The other leave balances, against the table Avin sent.
 *
 * His three rules, and this is what proves each of them:
 *
 *   the numbers are what is LEFT, not what has been taken
 *   unpaid leave has no entitlement, so its balance goes below zero
 *   maternity is for married women and paternity for married men, and
 *   anybody else gets a dash — which is not a zero, because a zero would say
 *   they had used it all
 *
 * The fourth thing worth proving is the one nobody would notice until it was
 * wrong: that a dash always carries a reason, so somebody looking at an empty
 * cell never has to guess whether the policy stops there or the data does.
 *
 *   node scripts/checkleavebal.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'seedtest'];
const sql = (s, u) => execFileSync(PSQL, [...base, '-tAc',
  (u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` : '') + s],
  {encoding: 'utf8', maxBuffer: 64e6});
const json = (s, u) => { const o = sql(s, u); const i = o.lastIndexOf('\n[');
  return JSON.parse(i < 0 ? o.trim() : o.slice(i + 1).trim()); };
const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads',
 payment_requests:'payment_requests', payment_files:'payment_files'};
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Avin Mascarenhas') t`)[0];

const TYPES = {'.html':'text/html', '.js':'text/javascript', '.png':'image/png',
               '.json':'application/json', '.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  const f = path.join('web', decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('no'); }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  res.end(fs.readFileSync(f));
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const DATA = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, AVIN.auth_user_id)[0]}, AVIN.id);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const page = await b.newPage({viewport: {width: 1600, height: 1100}});
await page.route('**://fonts.*/**', r => r.abort());
const bad = [];
let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };
page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });

await page.goto(ORIGIN + '/index.html');
await page.evaluate(([d, nm, roles]) => {
  window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
  window.__db = new Proxy({}, {get: () => () => {}});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Avin Mascarenhas', DATA._roles['Avin Mascarenhas'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});
await page.evaluate(() => { state.mode = 'console'; state.tab = 'leaveother'; render(); });
await page.waitForTimeout(400);

console.log('the other leave balances:\n');

const T2 = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.obtab')];
  if(!blocks.length) return null;
  const heads = [...blocks[0].querySelectorAll('thead tr')].map(tr =>
    [...tr.children].map(th => ({t: th.textContent.trim(), span: th.colSpan})));
  const rows = [];
  blocks.forEach(tb => {
    [...tb.querySelectorAll('tbody tr')].forEach(tr => {
      const c = [...tr.children];
      rows.push({who: c[0].textContent.trim(),
        cells: c.slice(1).map(td => ({txt: td.textContent.trim(),
          why: td.getAttribute('data-full') || '', dash: td.classList.contains('obdash'),
          red: /var\(--bad\)/.test(td.getAttribute('style') || '')}))});
    });
  });
  return {heads, rows, blocks: blocks.length,
    cap: (document.querySelector('.obtab') ? [...document.querySelectorAll('#view .cap')]
      .map(p => p.textContent).find(t => /still available/.test(t)) : '') || ''};
});
ok('the table is there', !!T2 && T2.rows.length > 0, T2 && T2.rows.length);

/* It has its own page, named in the bar. It was under the annual table first,
 * below twenty-seven rows and three company blocks, and Avin reported the
 * build as broken because he could not find it — which is the right thing to
 * conclude when something you were told about is not where you look. */
const nav = await page.evaluate(() => ({
  tab: state.tab,
  labels: (typeof CONTABS === 'function' ? CONTABS() : []).map(t => t.label),
  onAnnual: (() => { const was = state.tab; state.tab = 'leavebal'; render();
    const t = document.getElementById('view').innerText;
    state.tab = was; render();
    return {annual: /Annual leave balances/.test(t), other: /Leave balances/.test(t)}; })()
}));
ok('and it is a page of its own in the console bar',
   nav.labels.includes('Leave balance'), nav.labels);
ok('with the annual balances on a separate page',
   nav.labels.includes('Annual leave'), nav.labels);
ok('so neither table is buried underneath the other',
   nav.onAnnual.annual && !nav.onAnnual.other, nav.onAnnual);

if(T2){
  ok('split by company, the way every other roster on the portal is', T2.blocks >= 2, T2.blocks);

  const grp = T2.heads[0].filter(h => h.t);
  ok('the paid kinds are grouped apart from the unpaid ones',
     grp.length === 2 && grp[0].t === 'Paid' && grp[1].t === 'Not paid', grp.map(g => g.t));
  const cols = T2.heads[1].map(h => h.t).slice(1);
  for(const want of ['Bereavement', 'Birthday', 'Maternity', 'Paternity', 'Sick', 'Study', 'Hajj', 'Unpaid'])
    ok(`${want} is a column`, cols.includes(want), cols);
  ok('and annual leave is not, because it has its own table above',
     !cols.includes('Annual'), cols);
  ok('the group spans cover every column',
     T2.heads[0].reduce((s, h) => s + h.span, 0) === T2.heads[1].length,
     [T2.heads[0].map(h => h.span), T2.heads[1].length]);

  /* The two heading rows have to agree about which column is which. They did
   * not: the spans said seven paid and two unpaid while the columns ran in
   * the order the kinds are declared, so unpaid leave was printed under
   * "Paid" and Umrah under "Not paid" — a table that says the opposite of
   * the truth about whether somebody is paid while they are away. */
  const paidSpan = T2.heads[0].find(h => h.t === 'Paid');
  const under = cols.slice(0, paidSpan ? paidSpan.span : 0);
  ok('unpaid leave is not printed under Paid', !under.includes('Unpaid'), under);
  ok('nor is Hajj, which is unpaid too', !under.includes('Hajj'), under);
  /* Umrah spends the annual balance, so a column for it could only ever hold
   * a dash — twenty-five of them, in the width of a real figure. */
  ok('Umrah has no column at all, because it could never hold a number',
     !cols.includes('Umrah'), cols);
  ok('and the caption says where it went',
     /Umrah has no column/i.test(T2.cap), T2.cap.slice(0, 200));

  const at = (who, col) => {
    const r = T2.rows.find(x => x.who === who); if(!r) return null;
    const i = cols.indexOf(col); return i < 0 ? null : r.cells[i];
  };

  /* His rule: what is LEFT. Birthday is half a day a year, so an untaken one
   * reads 0.5 and never 0. */
  const bdays = T2.rows.map(r => r.cells[cols.indexOf('Birthday')]).filter(c => c && !c.dash);
  ok('birthday leave reads as the half day that is left, not as nothing taken',
     bdays.length > 0 && bdays.every(c => c.txt === '0.5' || c.txt === '0'),
     [...new Set(bdays.map(c => c.txt))]);

  /* Unpaid leave: no entitlement, so a balance below zero and coloured. */
  const unp = T2.rows.map(r => ({who: r.who, c: r.cells[cols.indexOf('Unpaid')]})).filter(x => x.c && !x.c.dash);
  ok('unpaid leave starts at nothing rather than at an entitlement',
     unp.every(x => +x.c.txt <= 0), unp.filter(x => +x.c.txt > 0).map(x => [x.who, x.c.txt]));
  const owed = unp.filter(x => +x.c.txt < 0);
  if(owed.length) ok('and anybody who has taken it shows below zero, in red',
     owed.every(x => x.c.red), owed.map(x => [x.who, x.c.txt, x.c.red]));
  else {
    /* Nobody in this seed has taken any, and the negative is the whole point
     * of the column — Avin's own sheet shows one person at −36. So one is put
     * in, in the browser only, and the cell is read again. */
    const neg = await page.evaluate(() => {
      const who = USERS.map(u => u.name)
        .find(n => !noLeave(n) && !isPartner(n) && !!(HR().balances || {})[n]);
      if(!who) return null;
      HR().requests.push({id:'tmp-unpaid', who, type:'Unpaid', status:'Approved',
        from:'2026-08-03', to:'2026-09-08', days:36, why:'checkleavebal'});
      render();
      const rows = [...document.querySelectorAll('.obtab tbody tr')];
      const heads = [...document.querySelectorAll('.obtab thead tr')][1];
      const i = [...heads.children].map(th => th.textContent.trim()).indexOf('Unpaid');
      const tr = rows.find(r => r.children[0].textContent.trim() === NM(who));
      const td = tr ? tr.children[i] : null;
      const out = td ? {txt: td.textContent.trim(), why: td.getAttribute('data-full') || '',
        red: /var\(--bad\)/.test(td.getAttribute('style') || '')} : null;
      HR().requests = HR().requests.filter(r => r.id !== 'tmp-unpaid');
      render();
      return out;
    });
    ok('thirty-six days of unpaid leave show as minus thirty-six',
       neg && neg.txt === '-36', neg);
    ok('and in red, because it is money the person owes back rather than a balance',
       neg && neg.red, neg);
    ok('with the reason on the hover',
       neg && /no entitlement/i.test(neg.why), neg && neg.why);
  }

  /* The dash. It is not a zero, and it always says why. */
  const dashes = [];
  T2.rows.forEach(r => r.cells.forEach((c, i) => { if(c.dash) dashes.push({who: r.who, col: cols[i], why: c.why, txt: c.txt}); }));
  ok('there are dashes to check', dashes.length > 0, dashes.length);
  ok('every dash is a dash and not a nought',
     dashes.every(d => d.txt === '—'), dashes.filter(d => d.txt !== '—').slice(0, 4));
  ok('and every one of them says why on the hover',
     dashes.every(d => d.why.length > 8), dashes.filter(d => d.why.length <= 8).slice(0, 4));

  /* Maternity and paternity follow gender and marital status, which is what
   * he asked about — the profile has both fields and this is what reads them. */
  const P = await page.evaluate(() => {
    const out = {};
    USERS.forEach(u => { const p = PROF(u.name) || {};
      out[u.name] = {g: p.gender || '', m: p.marital || '', off: noLeave(u.name) || isPartner(u.name)}; });
    return out;
  });
  const wrong = [];
  T2.rows.forEach(r => {
    const key = Object.keys(P).find(k => k === r.who || (P[k] && NMof(k) === r.who));
    const p = P[key] || P[r.who];
    if(!p || p.off) return;
    const mat = r.cells[cols.indexOf('Maternity')], pat = r.cells[cols.indexOf('Paternity')];
    const canMat = p.g === 'Female' && p.m === 'Married';
    const canPat = p.g === 'Male' && p.m === 'Married';
    if(p.g && p.m){
      if(mat && mat.dash === canMat) wrong.push([r.who, 'maternity', p.g, p.m, mat.txt]);
      if(pat && pat.dash === canPat) wrong.push([r.who, 'paternity', p.g, p.m, pat.txt]);
    } else {
      if(mat && !mat.dash) wrong.push([r.who, 'maternity with no gender on file', mat.txt]);
      if(pat && !pat.dash) wrong.push([r.who, 'paternity with no gender on file', pat.txt]);
    }
  });
  function NMof(){ return null; }
  ok('maternity is offered to married women and paternity to married men, and to nobody else',
     wrong.length === 0, wrong.slice(0, 6));

  /* No column may be all dashes: it would be a column's width of nothing,
   * which is the complaint that started the table rework in the first place. */
  const dead = cols.filter((c, i) => T2.rows.length > 1 && T2.rows.every(r => r.cells[i].dash));
  ok('no column is nothing but dashes all the way down', dead.length === 0, dead);

  ok('the caption says what a dash means, so nobody reads one as a zero',
     /dash is not a zero/i.test(T2.cap), T2.cap.slice(0, 120));
}

/* ---------------------------------------------------------- and it fits */
const clip = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.obtab th, .obtab tbody td').forEach(el => {
    if(el.scrollWidth > el.clientWidth + 1)
      out.push(el.textContent.trim().slice(0, 24) + ` (${el.scrollWidth} into ${el.clientWidth})`);
  });
  return out;
});
ok('no heading or figure is cut off', clip.length === 0, clip.slice(0, 8));

const over = await page.evaluate(() => {
  const t = document.querySelector('.obtab');
  if(!t) return null;
  const w = t.closest('.tw');
  return {table: Math.round(t.getBoundingClientRect().width), box: Math.round(w.clientWidth)};
});
ok('and the table sits inside its panel rather than scrolling sideways',
   over && over.table <= over.box + 1, over);

fs.mkdirSync('/tmp/look', {recursive: true});
await page.screenshot({path: '/tmp/look/leavebal.png', fullPage: true});

/* Avin: 'while hovering i get option to copy. I dont think its required'.
   The card stays — it is what explains a dash — but the button goes, and
   only here: on a payment remark or a reference number it earns its place. */
{
  await page.evaluate(() => { state.mode = 'console'; state.tab = 'leaveother'; render(); });
  await page.waitForTimeout(150);
  const r = await page.evaluate(async () => {
    const td = document.querySelector('#view .obtab td[data-full]');
    if(!td) return {none: true};
    td.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    await new Promise(r => setTimeout(r, 160));
    const card = document.querySelector('.cellpop');
    return {shown: card && !card.classList.contains('hidden'),
            says: (card.querySelector('.ct') || {}).textContent || '',
            copy: getComputedStyle(card.querySelector('button')).display,
            plain: [...document.querySelectorAll('#view .obtab [data-full]')]
                     .every(x => x.hasAttribute('data-plain'))};
  });
  ok('the hover card still explains the cell', r.shown && r.says.length > 3, r.says);
  ok('but there is no Copy button on it any more', r.copy === 'none', r.copy);
  ok('and every cell on this table asks for it that way', r.plain);
}

/* And it is still there where it was built for: a payment remark. */
{
  const src = fs.readFileSync('web/app.js', 'utf8');
  /* The mark is read from the cell OR anything it sits inside, so a whole
     table can opt out with one attribute — which is how My requests does it.
     Still opt-out: a table that says nothing keeps the button. */
  ok('the Copy button is opt-out, not removed',
     /cpy\.style\.display = td\.closest\('\[data-plain\]'\)/.test(src));
  ok('and the payment screen never opts out',
     !/data-plain/.test((src.match(/function vPayApprove[\s\S]{0,6000}/) || [''])[0]));
}

console.log('every cell is what is left, and every dash says why it is not a number');

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
