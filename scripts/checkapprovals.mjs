/* One page for everything waiting on you.
 *
 * Avin: 'do we have a page exclusively where me or Miraziz or the manager
 * will be able to see all the approvals?' We did not, so this is the page —
 * and this is what has to stay true about it.
 *
 *   1. It is the same decision, not a copy. Every row emits the exact
 *      data- attribute the specialist screen emits, so the handler that is
 *      already bound picks it up. A renamed attribute anywhere would leave a
 *      button here that looks live and does nothing.
 *   2. Payments are not on it. Avin said so explicitly.
 *   3. Nobody sees a decision that is not theirs. A consultant with no
 *      reports gets no tab, and cannot get the page by asking for it.
 *   4. The two-a-month attendance cap travels with the decision. Approving a
 *      third fix from here would be the one thing this page must not let
 *      through quietly.
 *   5. The count in the rail equals the number of rows on the page.
 *
 *   node scripts/checkapprovals.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'seedtest'];
const raw = (s, u) => execFileSync(PSQL, [...base, '-tAc',
  (u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` : '') + s],
  {encoding: 'utf8', maxBuffer: 64e6});
const json = (s, u) => { const o = raw(s, u); const i = o.lastIndexOf('\n[');
  return JSON.parse(i < 0 ? o.trim() : o.slice(i + 1).trim()); };
const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits', exit_lines:'exit_lines',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads', sales_team:'sales_team_figures',
 payment_requests:'payment_requests', payment_files:'payment_files'};

const TYPES = {'.html':'text/html', '.js':'text/javascript', '.png':'image/png'};
const server = http.createServer((q, r) => {
  const f = path.join('web', decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if(!fs.existsSync(f)){ r.writeHead(404); return r.end('no'); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});
await new Promise(k => server.listen(0, '127.0.0.1', k));
const O = 'http://127.0.0.1:' + server.address().port;

let fails = 0, checks = 0;
const ok = (cond, what) => { checks++; if(!cond){ fails++; console.log('  FAIL  ' + what); }
  else console.log('  ok    ' + what); };

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});

/* The queue is seeded in the browser, not in the database: what is being
   checked is the page's own arithmetic and wiring, and a seeded row is the
   only way to have one of every kind at once. */
const SEED = `(function(){
  const H = HR(), D = HDATE();
  const back = n => { const d = new Date(D+'T00:00:00'); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
  const fwd  = n => { const d = new Date(D+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
  H.requests.push(
    {id:'t1', who:'Nissa Muradova', mgr:'Rana Amine', type:'Annual', from:fwd(12), to:fwd(16), days:5,
     reason:'Wedding', status:'Pending', sent:back(6)},
    {id:'t2', who:'Shohruh Karimov', mgr:'Rana Amine', type:'WFH', from:fwd(2), to:fwd(2), days:1,
     reason:'Delivery', status:'Pending', sent:back(1)},
    {id:'t3', who:'Rana Amine', mgr:'Miraziz Makhamatzhanov', type:'Annual', from:fwd(20), to:fwd(24), days:5,
     reason:'Leave', status:'Pending', sent:back(4)});
  (H.loans || (H.loans=[])).push(
    {id:'t4', who:'Maylyn Aguba Asilo', amount:2500, months:5, monthly:500, why:'Medical',
     status:'Pending', approver:ADMIN, asked:back(2), start:D.slice(0,7), paid:0},
    {id:'t5', who:'Abdunosir Kadirov', amount:6000, months:12, monthly:500, why:'Fees',
     status:'Pending', approver:(USERS.find(x=>x.role==='owner')||{}).name, asked:back(5), start:D.slice(0,7), paid:0});
  (H.letters || (H.letters=[])).push(
    {id:'t6', who:'Shohruh Karimov', type:'salary', to:'Emirates NBD', why:'Loan', status:'Pending', asked:back(9)});
  const R = HR().regular || (HR().regular = REG());
  R.rows = (R.rows||[]).concat([
    {id:'t7', uid:'t7', who:'Zhavokhir Khasanbaev', d:back(8), in:'09:12', out:'18:30',
     reason:'Missed tap', status:'Pending', sent:back(7)},
    {id:'t8', uid:'t8', who:'Janine Lagumbay', d:back(6), in:'09:00', out:'18:00',
     reason:'Missed tap', status:'Pending', sent:back(5)}]);
  R.max = 2;
  R.used = Object.assign(R.used||{}, {['Janine Lagumbay|'+back(6).slice(0,7)]: 2});
  H.regular = R;
})();`;

async function open(name){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1700, height: 1200}});
  await p.route('**://fonts.*/**', x => x.abort());
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => { window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); }, [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  await p.evaluate(SEED);
  return {p, errs};
}

/* ---- 1. Avin: accounts sees the accounts queue, and nothing else ---- */
console.log('\nAvin Mascarenhas — accounts');
{
  const {p, errs} = await open('Avin Mascarenhas');
  await p.evaluate(() => { state.mode = 'staff'; state.tab = 'approvals'; render(); });
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#view table tbody tr')];
    const first = document.querySelector('#view table tbody tr');
    return {
      inRail: !!document.querySelector('#nav [data-tab="approvals"]'),
      railCount: (document.querySelector('#nav [data-tab="approvals"] .navcnt') || {}).textContent || '',
      kinds: rows.map(t => (t.querySelector('.apk') || {}).textContent || '').filter(Boolean),
      n: approvalsFor(state.user).length,
      okAttrs: rows.map(t => [...(t.querySelectorAll('button'))].map(x => x.getAttributeNames().find(a => a.startsWith('data-')) || 'none')),
      capped: [...document.querySelectorAll('#view button[data-rgok]')].map(x => x.disabled),
      caption: (document.querySelector('#view .cap') || {}).textContent || ''
    };
  });
  ok(r.inRail, 'the tab is in his rail');
  ok(r.kinds.includes('Advance') && r.kinds.includes('Letter') && r.kinds.includes('Attendance'),
     'advances under the cap, letters and attendance fixes are his — ' + r.kinds.join(', '));
  ok(!r.kinds.some(k => k === 'Leave' || k === 'Work from home'),
     'nobody reports to him, so no leave lands here');
  ok(!r.kinds.includes('Payment'), 'payments are NOT on this page');
  ok(/Payment requests are not on this page/.test(r.caption), 'and the page says where they are instead');
  ok(String(r.n) === r.railCount, `the rail count is the row count (${r.railCount})`);
  ok(r.okAttrs.flat().every(a => a !== 'none'),
     'every button carries the attribute its own screen binds');
  ok(r.capped.length === 2 && r.capped.filter(Boolean).length === 1,
     'the person who has used both fixes this month cannot be given a third');
  ok(!errs.length, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await p.close();
}

/* ---- 2. Miraziz: the owner's own queue ---- */
console.log('\nMiraziz Makhamatzhanov — owner');
{
  const {p, errs} = await open('Miraziz Makhamatzhanov');
  await p.evaluate(() => { state.mode = 'staff'; state.tab = 'approvals'; render(); });
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#view table tbody tr')];
    return {kinds: rows.map(t => (t.querySelector('.apk') || {}).textContent || '').filter(Boolean),
            amounts: rows.map(t => (t.children[5] || {}).textContent || ''),
            mine: approvalsFor(state.user).map(x => x.k)};
  });
  ok(r.kinds.includes('Advance'), 'an advance at or above the limit is his');
  ok(r.kinds.includes('Leave'), 'and leave from the four who report to him');
  ok(!r.kinds.includes('Letter'), 'letters are accounts’ work, not his');
  ok(!r.kinds.includes('Payment'), 'payments are not here either');
  ok(r.amounts.some(a => a.replace(/[^0-9]/g, '') === '600000'), 'the advance carries its figure');
  ok(!errs.length, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await p.close();
}

/* ---- 3. Rana: a line manager, and only her own five ---- */
console.log('\nRana Amine — department manager');
{
  const {p, errs} = await open('Rana Amine');
  await p.evaluate(() => { state.mode = 'staff'; state.tab = 'approvals'; render(); });
  const r = await p.evaluate(() => {
    /* the first table is the queue; the second is 'Raised by you' */
    const rows = [...document.querySelectorAll('#view table')[0].querySelectorAll('tbody tr')];
    return {inRail: !!document.querySelector('#nav [data-tab="approvals"]'),
            who: rows.map(t => (t.children[1] || {}).textContent || ''),
            kinds: rows.map(t => (t.querySelector('.apk') || {}).textContent || '').filter(Boolean),
            mineRows: [...document.querySelectorAll('#view section.panel')].length};
  });
  ok(r.inRail, 'a line manager gets the tab');
  ok(r.kinds.every(k => k === 'Leave' || k === 'Work from home'),
     'and only leave and WFH — ' + [...new Set(r.kinds)].join(', '));
  ok(r.who.every(n => /Nissa|Shohruh|Maylyn|Abdulkhamid|Zhavokhir/.test(n)),
     'from her own five and nobody else');
  ok(!r.who.some(n => /Rana/.test(n)), 'her own request is not hers to approve');
  ok(r.mineRows >= 2, 'and what she has asked for is shown underneath');
  ok(!errs.length, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await p.close();
}

/* ---- 4. A consultant: no tab, and no page by asking for it ---- */
console.log('\nNissa Muradova — nobody reports to her');
{
  const {p, errs} = await open('Nissa Muradova');
  const r = await p.evaluate(() => {
    state.mode = 'staff'; state.tab = 'approvals'; render();
    return {inRail: !!document.querySelector('#nav [data-tab="approvals"]'),
            landedOn: state.tab,
            queue: approvalsFor(state.user).length};
  });
  ok(!r.inRail, 'no tab in her rail');
  ok(r.landedOn === 'home', 'asking for the page by name lands her home instead');
  ok(r.queue === 0, 'and there is nothing in her queue to have shown');
  ok(!errs.length, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  await p.close();
}

/* ---- 5. The attributes exist on the specialist screens too ---- */
console.log('\nthe same decision, not a copy');
{
  const src = fs.readFileSync('web/app.js', 'utf8');
  for(const [attr, screen] of [['data-approve-req', 'Leave & WFH'], ['data-decline-req', 'Leave & WFH'],
                               ['data-ln-ok', 'Advances'], ['data-ln-no', 'Advances'],
                               ['data-lt-ok', 'Letters'], ['data-lt-no', 'Letters'],
                               ['data-rgok', 'Regularization'], ['data-rgno', 'Regularization']]){
    const bound = src.includes(`querySelectorAll('[${attr}]')`);
    const used = (src.split(attr).length - 1) >= 3;   // the handler, its screen, and this page
    ok(bound && used, `${attr} is bound once and emitted by both ${screen} and Approvals`);
  }
}

await b.close(); server.close();
console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
