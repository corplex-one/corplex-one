/* Three rungs: the Department for sales staff, the team screens for the manager.
 *
 *   'I wanted everyone to see the Department.
 *      All employees   - Department
 *      manager         - Team performance (without commission),
 *                        team leaderboard, department
 *      Me and miraziz  - everything'                                  -- Avin
 *
 * The message before it said 'the department and Team leaderboard was for Me,
 * Miraziz and Manager (Rana) only', which I read as shutting the Department
 * screen. It is the other way round. This check exists so the mistake cannot
 * be made a third time by anybody, including me: it states the ladder as
 * assertions and fails if a rung moves.
 *
 *   Department          every SALES employee of a company that sells —
 *                       'All employees' meant all sales employees, asked and
 *                       answered. Marketing, HR and Operations get no sales
 *                       screen at all.
 *
 *   Team performance    accounts, the owner, a department manager, or a named
 *   Team leaderboard    sales lead. Both name colleagues and put figures
 *                       beside them, so the DATA is closed to everybody else
 *                       and not merely the tab.
 *
 *   Commission          accounts and the owner, in the payload as well as on
 *                       the screen.
 *
 *   node scripts/checkwider.mjs
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
const AVIN = who('Avin Mascarenhas');            // accounts
const MIRA = who('Miraziz Makhamatzhanov');      // owner
const RANA = who('Rana Amine');                  // manager, Corporate & Legal
const SHOH = who('Shohruh Karimov');             // consultant, Corporate & Legal
const FATI = who('Fatima Khaliqdad');            // Marketing — outside sales entirely

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, tab){
  const U = who(name);
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1700, height: 1200}});
  await p.route('**://fonts.*/**', x => x.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => { window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); }, [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  await p.evaluate(t => { state.mode = 'staff'; state.tab = t; render(); }, tab || 'home');
  await p.waitForTimeout(200);
  return {p, errs, D};
}
const rail = p => p.evaluate(() => [...document.querySelectorAll('#nav button[data-tab]')].map(b => b.dataset.tab));
const land = (p, id) => p.evaluate(t => { state.tab = t; render(); return state.tab; }, id);

/* ======================= 1. the Department screen, for the sales staff */
console.log('\nthe Department screen is for the sales staff');
{
  const r = one(`select pg_get_expr(polqual, polrelid) from pg_policy
                  where polrelid='sales_company'::regclass and polname='read_sales_company'`);
  ok('the rule lets any active person read their own company’s row', /e.active/.test(r), r);
  ok('and the narrowed copy 0032 introduced is gone',
     one(`select count(*) from pg_views where viewname='sales_company_mine'`) === '0');

  const rows = u => +one(`select count(*) from sales_company`, u);
  ok('a consultant is sent it', rows(SHOH.auth_user_id) > 0, rows(SHOH.auth_user_id));
  ok('and so is the manager', rows(RANA.auth_user_id) > 0);

  {
    const {p, errs} = await open('Shohruh Karimov', 'company');
    const tabs = await rail(p);
    ok('a consultant has the Department tab', tabs.includes('company'), tabs);
    ok('the screen draws for them',
       await p.evaluate(() => document.querySelectorAll('#view .panel').length) > 1);
    ok('no page errors', !errs.length, errs[0]);
    await p.close();
  }
  /* 'All employees' turned out to mean all SALES employees — asked, and
     answered 'I meant sales staff'. So somebody in Marketing gets no sales
     screen at all, and this is the line that keeps it that way. */
  {
    const {p, errs} = await open('Fatima Khaliqdad', 'home');
    const tabs = await rail(p);
    ok('somebody outside sales has no Department tab', !tabs.includes('company'), tabs);
    ok('nor any of the sales screens',
       !['dashboard','commission','invoices','team','leaderboard'].some(t => tabs.includes(t)), tabs);
    ok('and a typed link to it lands on home',
       (await land(p, 'company')) === 'home');
    ok('no page errors', !errs.length, errs[0]);
    await p.close();
  }
}

/* ================== 2. the two screens that name colleagues stop at manager */
console.log('\nthe team screens stop at the manager');
{
  const peers = u => +one(`select count(distinct employee_id) from sales_team_figures`, u);
  ok('a consultant is sent no roster at all', peers(SHOH.auth_user_id) === 0, peers(SHOH.auth_user_id));
  ok('nor is anybody outside sales', peers(FATI.auth_user_id) === 0, peers(FATI.auth_user_id));
  ok('the manager is', peers(RANA.auth_user_id) > 1, peers(RANA.auth_user_id));
  /* Accounts and the owner do not read this view — they read sales_commission
     itself, which is how they still see the commission columns. The view is
     the narrower window the manager gets instead, so a count of one for Avin
     (nobody else is in HR & Finance) says nothing about his screens. */
  ok('accounts reads the table itself rather than the view',
     +one(`select count(distinct employee_id) from sales_commission`, AVIN.auth_user_id) > 1);

  const {p, errs} = await open('Shohruh Karimov', 'dashboard');
  const tabs = await rail(p);
  ok('a consultant has no Team performance', !tabs.includes('team'), tabs);
  ok('and no Team leaderboard', !tabs.includes('leaderboard'), tabs);
  ok('their own three are untouched',
     ['dashboard', 'commission', 'invoices'].every(t => tabs.includes(t)), tabs);
  for(const t of ['team', 'leaderboard'])
    ok(`#${t} typed in refuses and lands on home`, (await land(p, t)) === 'home');
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nthe manager has all three');
{
  const {p, errs, D} = await open('Rana Amine', 'team');
  const tabs = await rail(p);
  ['company', 'team', 'leaderboard'].forEach(t =>
    ok(`Rana has ${t}`, tabs.includes(t), tabs));
  const heads = await p.evaluate(() =>
    [...document.querySelectorAll('#view .teamtab thead th')].map(t => t.textContent.trim()));
  ok('Team performance draws a roster', heads.length > 0, heads);
  ok('and has no Commission, Paid or Balance column',
     !heads.some(h => /Commission|^Paid$|^Balance$/.test(h)), heads);
  /* On the screen is not enough: the figures must not be in what her browser
     was sent either. Coming off the sales-viewers list is what stops the
     COMPANY's commission reaching her.

     What is left is her own direct reports, and that is a different rule —
     read_commission has always included manages(), which is the reporting
     line rather than anything to do with these three screens. It predates all
     of this and closing it is a separate decision, so it is asserted as it
     stands rather than quietly changed: nobody outside her own reporting line
     appears. */
  const REPORTS = json(`select coalesce(json_agg(t),'[]') from (
      select e.full_name from employees e where e.manager_id = '${RANA.id}') t`).map(x => x.full_name);
  const leaked = await p.evaluate(mine => {
    const out = [];
    Object.entries(DATA.engine || {}).forEach(([nm, per]) => {
      if(nm === state.user || mine.includes(nm)) return;
      Object.values(per).forEach(y => Object.values(y).forEach(q =>
        ['comm','paid','bal','newComm','exComm','pmComm','rate','band','lost']
          .forEach(k => { if(q[k] !== undefined) out.push(nm + '.' + k); })));
    });
    return out.slice(0, 6);
  }, REPORTS);
  ok('and no earnings figure for anybody outside her own reporting line',
     leaked.length === 0, leaked);
  ok('the roster she compares is wider than her reporting line, and carries no earnings',
     await p.evaluate(() => Object.keys(DATA.engine || {}).length) > REPORTS.length + 1);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand the two of them have everything');
for(const name of ['Avin Mascarenhas', 'Miraziz Makhamatzhanov']){
  const {p, errs} = await open(name, 'team');
  const tabs = await rail(p);
  ['company', 'team', 'leaderboard'].forEach(t =>
    ok(`${name.split(' ')[0]} has ${t}`, tabs.includes(t), tabs));
  const heads = await p.evaluate(() =>
    [...document.querySelectorAll('#view .teamtab thead th')].map(t => t.textContent.trim()));
  ok(`${name.split(' ')[0]} still gets Commission, Paid and Balance`,
     ['Commission','Paid','Balance'].every(c => heads.includes(c)), heads);
  ok(`${name.split(' ')[0]} — no page errors`, !errs.length, errs[0]);
  await p.close();
}

/* ============================================= 3. the list, and what is left */
console.log('\nthe sales-viewers list');
{
  const list = one(`select coalesce(string_agg(e.full_name, ', ' order by e.full_name), 'nobody')
                      from sales_viewers v join employees e on e.id=v.employee_id`);
  /* Anybody on it is sent every colleague's commission and invoice rows.
     Accounts and the owner have that through is_admin() anyway; nobody else
     should be on it, or 'without commission' is untrue of the payload. */
  ok('holds only accounts and the owner, if anybody',
     list === 'nobody' || list === 'Avin Mascarenhas, Miraziz Makhamatzhanov', list);
  ok('a consultant still reads only their own commission rows',
     +one(`select count(distinct employee_id) from sales_commission`, SHOH.auth_user_id) === 1);
  ok('and the manager reads her own and her reports’, not the company’s',
     +one(`select count(distinct employee_id) from sales_commission`, RANA.auth_user_id)
     < +one(`select count(distinct employee_id) from sales_commission`, AVIN.auth_user_id));
}

await b.close(); server.close();
console.log(`\n${checks - fails}/${checks} checks pass`);
process.exit(fails ? 1 : 0);
