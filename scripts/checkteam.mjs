/* The team screens, for the people who are on the team.
 *
 *   Avin: 'I wanted every sales employee to get: Team performance page -
 *   without commission part / Team leaderboard as well'
 *   'they see colleagues names against the figures... What each person
 *   earns - not.'
 *
 * The easy way to build this was to widen read_commission to the whole
 * company and let the screen hide three columns. It would have looked
 * identical and been wrong, because sales_commission keeps net sales and
 * commission in the same row: every consultant's browser would have been
 * sent what every colleague earned, and the only thing standing between them
 * and it would have been a template. Hiding a column is a decision about a
 * page, not about a payload.
 *
 * So the rows never leave the database. 0044 is a view carrying the eight
 * figures these screens draw and no commission at all, scoped in SQL to your
 * own company and department. What this checks, in order of how badly it
 * would matter:
 *
 *   1. NOTHING ABOUT A COLLEAGUE'S EARNINGS REACHES A CONSULTANT. Asserted
 *      twice over — against the view's columns in the database, and against
 *      what is actually in the browser's DATA once the page has loaded. The
 *      second is the one that would have caught the easy version.
 *
 *   2. THE SCOPE IS THE DEPARTMENT. Not the company, not everybody.
 *
 *   3. THE SCREENS WORK. A consultant gets the roster and the nine columns. A
 *      check that only proves nothing leaked would pass on a blank page.
 *
 *      The leaderboard was here too, until Avin said it was his mistake and
 *      that the ranking and the Department screen were for three people only.
 *      Both are now checked as CLOSED for a consultant, at the rail and at
 *      the link. checkwider.mjs proves the rest of that change.
 *
 *   4. ACCOUNTS LOST NOTHING. Commission, Paid and Balance are still there
 *      for the two people who are meant to have them.
 *
 *   5. NO POLICY MOVED. read_commission and read_invoices are the same
 *      expressions they were. The view is a second, narrower window — not a
 *      wider one on the old glass.
 *
 *   node scripts/checkteam.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'seedtest'];
const raw = (s, u) => execFileSync(PSQL, [...base, '-tAc',
  (u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` : '') + s],
  {encoding: 'utf8', maxBuffer: 64e6});
const one  = (s, u) => { const L = raw(s, u).trim().split('\n'); return L[L.length - 1]; };
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

const bad = []; let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };

const who = nm => json(`select coalesce(json_agg(t),'[]') from (select id, auth_user_id, full_name, department
  from employees where full_name = '${nm}') t`)[0];
const AVIN = who('Avin Mascarenhas');
/* A consultant: sales figures of their own, no role above staff. */
const CON = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name, e.department from employees e
   where e.active and e.auth_user_id is not null
     and e.department is not null and e.department <> ''
     and exists (select 1 from sales_commission c where c.employee_id = e.id)
     and not exists (select 1 from employee_roles r where r.employee_id = e.id
                       and r.role in ('accounts','owner','manager'))
   order by e.full_name limit 1) t`)[0];

console.log('\n=== 1. what the database will and will not send ===\n');
ok('there is a consultant to test with', !!CON, CON && CON.full_name);

/* The view's own shape. If a commission column is ever added to it, this is
 * the line that says so — before anybody has to notice it on a screen. */
const cols = raw(`select column_name from information_schema.columns
   where table_name = 'sales_team_figures' order by ordinal_position`).trim().split('\n');
ok('the team view exists', cols.length > 3, cols.length);
ok('and carries no commission, no paid and no balance column',
   !cols.some(c => /^(comm|paid|bal|rate|band)/i.test(c.trim())), cols);
ok('but does carry the figures the screens draw',
   ['net_tot','tot_elig','not_coll','invoiced','costs','invoices','outstanding']
     .every(k => cols.map(c => c.trim()).includes(k)), cols);

const seen = json(`select coalesce(json_agg(t),'[]') from (
  select distinct department, company from sales_team_figures) t`, CON.auth_user_id);
ok('a consultant reads one department through it — their own',
   seen.length === 1 && seen[0].department === CON.department, seen);
ok('and more than one person in it',
   Number(one(`select count(distinct employee_id) from sales_team_figures`, CON.auth_user_id)) > 1);

/* Point 5 — nothing was widened to make this work. */
const pol = json(`select coalesce(json_agg(t),'[]') from (
  select polname, pg_get_expr(polqual, polrelid) as rule from pg_policy
   where polname in ('read_commission','read_invoices') order by polname) t`);
ok('read_commission is untouched',
   (pol.find(x => x.polname === 'read_commission') || {}).rule ===
   '((employee_id = me()) OR manages(employee_id) OR sees_company_sales(company))',
   (pol.find(x => x.polname === 'read_commission') || {}).rule);
ok('read_invoices is untouched',
   (pol.find(x => x.polname === 'read_invoices') || {}).rule ===
   '((consultant = me()) OR (filed_under = me()) OR (manager = me()) OR sees_company_sales(company))',
   (pol.find(x => x.polname === 'read_invoices') || {}).rule);
ok('and the consultant still cannot read a colleague’s commission row',
   one(`select count(*) from sales_commission where employee_id <> '${CON.id}'`,
       CON.auth_user_id) === '0');

// --- the screens ----------------------------------------------------------
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.png':'image/png',
               '.json':'application/json', '.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  const f = path.join('web', decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('no'); }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  res.end(fs.readFileSync(f));
});
await new Promise(k => server.listen(0, '127.0.0.1', k));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(user){
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
      `) t`, user.auth_user_id)[0]}, user.id);
  const page = await b.newPage({viewport: {width: 1600, height: 1100}});
  await page.route('**://fonts.*/**', r => r.abort());
  page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });
  await page.goto(ORIGIN + '/index.html');
  await page.evaluate(([d, nm, roles]) => {
    window.__DATA = d; window.__ME = nm; window.__ROLES = roles; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => {
      window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove();
  }, [D, user.full_name, D._roles[user.full_name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  return page;
}
const screen = (p, tab) => p.evaluate(t => {
  state.mode = 'staff'; state.tab = t; render();
  const v = document.getElementById('view');
  return {cols: [...v.querySelectorAll('thead th')].map(x => x.textContent.trim()),
          rows: v.querySelectorAll('tbody tr').length,
          text: (v.textContent || '').replace(/\s+/g, ' ')};
}, tab);

console.log('\n=== 2. what reaches the browser ===\n');
let p = await open(CON);

/* THE assertion. Not 'the column is hidden' — 'the number is not there.' */
const leak = await p.evaluate(() => {
  const out = [], me = state.user;
  Object.entries(DATA.engine || {}).forEach(([nm, per]) => {
    if(nm === me) return;
    Object.values(per).forEach(y => Object.values(y).forEach(q =>
      ['comm','paid','bal','newComm','exComm','pmComm','rate','band','lost']
        .forEach(k => { if(q[k] !== undefined) out.push(nm + '.' + k + ' = ' + q[k]); })));
  });
  return {peers: Object.keys(DATA.engine || {}).length, leaked: out.slice(0, 8)};
});
ok('the consultant’s own data holds figures for the whole department',
   leak.peers > 1, leak.peers);
ok('and not one earnings figure for anybody but themselves',
   leak.leaked.length === 0, leak.leaked);

console.log('\n=== 3. and the screens work ===\n');
const TEAMCOLS = ['Consultant','Role','Invoices','Invoiced','Costs','Net sales','Eligible','Not counted','Outstanding'];
let S = await screen(p, 'team');
ok('Team performance opens for a consultant', S.rows > 1, S.rows);
ok('with the nine columns and no more',
   S.cols.join('|') === TEAMCOLS.join('|'), S.cols);
ok('and the roster is their own department',
   S.text.includes(CON.department), CON.department);
ok('the invoice count is a real number, not a nought from unreadable rows',
   await p.evaluate(() => [...document.querySelectorAll('tbody tr')]
     .map(r => (r.children[2] || {}).textContent || '')
     .filter(x => x.trim() && x.trim() !== '0').length) > 1);
/* The leaderboard came back out again.
 *
 *   'My Mistake: The department and Team leaderboard was for Me, Miraziz and
 *    Manager (Rana) only. Please revert this'                         -- Avin
 *
 * Team performance above is unchanged and stays open — that was a separate
 * request and it has not been withdrawn. The ranking is not. It is the one
 * thing here that is a page decision rather than a payload one, because it
 * ranks the figures the table above already shows, so it is checked at the
 * rail and at the link rather than pretended to be more. checkwider.mjs is
 * where the whole of that change is proved. */
ok('the leaderboard is not in the rail for a consultant',
   !(await p.evaluate(() => [...document.querySelectorAll('#nav button[data-tab]')]
       .map(x => x.dataset.tab))).includes('leaderboard'));
ok('and a typed link does not open it',
   (await p.evaluate(() => { state.tab = 'leaderboard'; render(); return state.tab; })) === 'home');
ok('nor does one to the Department screen',
   (await p.evaluate(() => { state.tab = 'company'; render(); return state.tab; })) === 'home');
await p.close();

console.log('\n=== 4. accounts lost nothing ===\n');
p = await open(AVIN);
S = await screen(p, 'team');
ok('accounts still gets Commission, Paid and Balance',
   ['Commission','Paid','Balance'].every(c => S.cols.includes(c)), S.cols);
ok('and a figure in the commission column',
   await p.evaluate(() => [...document.querySelectorAll('tbody tr')]
     .some(r => /[1-9]/.test((r.children[9] || {}).textContent || ''))));
await p.close();

await b.close();
server.close();
console.log(`\n${n} checks`);
if(bad.length){ console.log('\n' + bad.map(x => '  FAIL ' + x).join('\n')); process.exit(1); }
console.log('the department can be compared without anybody’s earnings leaving the database');
