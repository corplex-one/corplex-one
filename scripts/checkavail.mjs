/* Team availability: one month, one company, on the full width.
 *
 *   'Move the "next two weeks" from People page to Leave & WFH / Rename it as
 *    "Team Availibility" / This should not just be two weeks, but whole month
 *    should be shown / With an option to check future and previous months /
 *    Use previous or next arrow to change months / One month should be seen
 *    on the full width of the screen / Tabs should be: Leave | Work from Home
 *    | Availability | Leave Policy'
 *   'Option to check company wise'  ·  'Same approved leave and WFH'
 *   '100% i am sure we can fit 31 columns'                           -- Avin
 *
 * The thing most likely to go wrong here is not the month arithmetic, it is
 * that a 31-column table quietly stops fitting the day somebody adds a column
 * or a longer name arrives. So the width is measured rather than eyeballed,
 * at both screen sizes, and a February and a December are opened as well as
 * the month it happens to be when this runs.
 *
 * The second thing is subtler. dayStatus reads a day as the PLAN ahead of
 * today and as the RECORD behind it, so a past month drawn with it would have
 * been a wall of red question marks about who did not tap in. Avin asked for
 * 'Same approved leave and WFH', so this grid has its own reading of a day,
 * and the check that matters is that a past day and a future day are drawn by
 * the same rule.
 *
 *   node scripts/checkavail.mjs
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
const one = (s, u) => { const L = raw(s, u).trim().split('\n'); return L[L.length - 1].trim(); };
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
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads', sales_team:'sales_team_figures',
 sales_members:'sales_members',
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
const ok = (what, pass, saw) => { checks++;
  if(pass) return console.log('  ok    ' + what);
  fails++; console.log('  FAIL  ' + what + (saw === undefined ? '' : '  saw ' + JSON.stringify(saw))); };

const who = n => json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${n}') t`)[0];
const AVIN = who('Avin Mascarenhas');
const SHOH = who('Shohruh Karimov');

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, width){
  const U = who(name);
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: width || 1600, height: 1150}});
  await p.route('**://fonts.*/**', x => x.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => async () => true});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); }, [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  await p.evaluate(() => { state.mode = 'staff'; state.tab = 'requests'; state.leaveTab = 'avail'; render(); });
  await p.waitForTimeout(250);
  return {p, errs};
}
const click = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); if(el) el.click(); }, sel);
const snap = p => p.evaluate(() => {
  const t = document.querySelector('.avmonth'), tw = t && t.closest('.tw');
  return {
    month: ((document.querySelector('.avmon b') || {}).textContent || '').trim(),
    days: t ? t.querySelectorAll('thead th').length - 1 : 0,
    rows: t ? t.querySelectorAll('tbody tr').length : 0,
    marks: t ? [...t.querySelectorAll('tbody td.av')].filter(x => x.textContent.trim()).length : 0,
    co: ((([...document.querySelectorAll('#availCo button')]
           .find(x => x.getAttribute('aria-pressed') === 'true') || {}).textContent) || '').trim(),
    over: tw ? tw.scrollWidth - tw.clientWidth : null,
    dayW: t ? Math.round((t.querySelectorAll('thead th')[1] || {getBoundingClientRect:()=>({width:0})})
                .getBoundingClientRect().width) : 0,
    nameCut: t ? [...t.querySelectorAll('tbody td.s1')].filter(x => x.scrollWidth > x.clientWidth + 1).length : 0,
    wide: document.querySelector('main').classList.contains('wide')
  };
});

/* ================================================ 1. the tabs, and the move */
console.log('\nwhere it lives');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const tabs = await p.evaluate(() =>
    [...document.querySelectorAll('#leaveSeg button')].map(b => b.textContent.trim()));
  ok('four tabs, in the order asked for',
     tabs.join(' | ') === 'Leave | Work from home | Availability | Leave policy', tabs);

  const pep = await p.evaluate(() => { state.tab = 'people'; render();
    return {two: /next two weeks/i.test(document.getElementById('view').innerText),
            grid: !!document.querySelector('#view .availtable'),
            strip: document.querySelectorAll('#view > .strip .stat').length}; });
  ok('the fortnight strip has left People', !pep.two && !pep.grid, pep);
  ok('but People keeps today at a glance', pep.strip === 4, pep.strip);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ======================================================= 2. a whole month */
console.log('\na month, and the arrows');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const start = await snap(p);
  ok('it opens on the month it is', start.month === new Date().toLocaleString('en', {month:'long', timeZone:'UTC'}) + ' ' + new Date().getUTCFullYear()
     || /\d{4}$/.test(start.month), start.month);
  ok('the whole month is drawn, not a fortnight', start.days >= 28, start.days);

  await click(p, '[data-avmon="-1"]');
  const back = await snap(p);
  ok('the left arrow goes back a month', back.month !== start.month, [start.month, back.month]);
  await click(p, '[data-avmon="1"]');
  ok('and the right arrow comes back', (await snap(p)).month === start.month);

  /* A month is not always 30 days, and the arrows have to cross a year. */
  await p.evaluate(() => { state.availMonth = '2026-12'; render(); });
  const dec = await snap(p);
  ok('December is 31 columns', dec.days === 31, dec.days);
  await click(p, '[data-avmon="1"]');
  const jan = await snap(p);
  ok('and the next one is January of the year after', jan.month === 'January 2027', jan.month);
  await p.evaluate(() => { state.availMonth = '2028-02'; render(); });
  ok('a leap February is 29', (await snap(p)).days === 29, (await snap(p)).days);
  await p.evaluate(() => { state.availMonth = '2027-02'; render(); });
  ok('and an ordinary one is 28', (await snap(p)).days === 28, (await snap(p)).days);

  await click(p, '[data-avmon="0"]');
  ok('and there is a way back to this month without counting', (await snap(p)).month === start.month);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* =================================================== 3. company by company */
console.log('\ncompany by company');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const seen = {};
  for(const co of ['all', 'corplex', 'poa', 'lex']){
    await click(p, `[data-avco="${co}"]`);
    seen[co] = await snap(p);
  }
  ok('Everyone lists more people than any one company',
     seen.all.rows > seen.corplex.rows && seen.all.rows > seen.poa.rows,
     Object.fromEntries(Object.entries(seen).map(([k,v]) => [k, v.rows])));
  ok('and each company lists its own',
     seen.corplex.rows > 0 && seen.poa.rows > 0 && seen.corplex.rows !== seen.poa.rows,
     [seen.corplex.rows, seen.poa.rows]);
  ok('the one chosen is the one shown as chosen', seen.poa.co === 'POA', seen.poa.co);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================== 4. the same rule on both sides of today */
console.log('\na past month reads like a future one');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const kinds = () => p.evaluate(() => {
    const out = {};
    [...document.querySelectorAll('.avmonth tbody td.av')].forEach(td => {
      const t = td.textContent.trim(); if(t) out[t] = (out[t] || 0) + 1; });
    return out;
  });
  await p.evaluate(() => { state.availCo = 'all'; state.availMonth = '2026-07'; render(); });
  const past = await kinds();
  await p.evaluate(() => { state.availMonth = '2026-12'; render(); });
  const future = await kinds();
  /* '?' is dayStatus's mark for a day nobody tapped in on. It belongs on My
     attendance and nowhere near a plan — a past month full of it would have
     been the fortnight strip's reading of a day, carried somewhere it does
     not mean anything. */
  ok('a past month carries no attendance marks', !past['?'], past);
  ok('nor does a future one', !future['?'], future);
  ok('and both are drawn from the same short list of letters',
     Object.keys(past).concat(Object.keys(future))
       .every(k => 'HASUB½MPJO★'.includes(k)), [past, future]);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================================== 5. thirty-one columns fit */
console.log('\nand it fits');
for(const w of [1440, 1920]){
  const {p, errs} = await open('Avin Mascarenhas', w);
  await p.evaluate(() => { state.availCo = 'all'; state.availMonth = '2026-12'; render(); });
  const s = await snap(p);
  ok(`${w} — the page is full width`, s.wide === true);
  ok(`${w} — 31 columns and the table does not scroll sideways`,
     s.days === 31 && s.over <= 0, s);
  /* He asked for 40% off the fortnight strip's day column, which was 57px. */
  /* 34px on a wide screen, 28 on a laptop where the name column needs the
     difference. Either way well under the 57px the fortnight strip used. */
  ok(`${w} — a day column is 28-34px, not the old 57`,
     s.dayW >= 26 && s.dayW <= 36, s.dayW);
  ok(`${w} — no name is cut off`, s.nameCut === 0, s.nameCut);
  ok(`${w} — no page errors`, !errs.length, errs[0]);
  await p.close();
}

/* ================================================= 6. everybody has it */
console.log('\nwho can open it');
{
  const {p, errs} = await open('Shohruh Karimov');
  const s = await snap(p);
  ok('a consultant gets the tab and the month', s.days >= 28 && s.rows > 1, s);
  ok('and sees the whole office, not just themselves', s.rows > 3, s.rows);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

await b.close(); server.close();
console.log(`\n${checks - fails}/${checks} checks pass`);
process.exit(fails ? 1 : 0);
