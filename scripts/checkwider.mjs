/* The wider picture is for the few, and Team performance is for everyone.
 *
 *   'My Mistake: The department and Team leaderboard was for Me, Miraziz and
 *    Manager (Rana) only. Please revert this'                         -- Avin
 *
 * Both had been opened to every active sales employee by 0043, which handed
 * the whole sales_company row to anybody in the company — and that row is the
 * Department screen. Taking the row back is not an option, because Team
 * performance draws its department name, its net sales and its target from
 * the same place and is staying open.
 *
 * So the row is split: sales_company for the few, sales_company_mine for
 * everybody, with the four things only the Department screen draws removed.
 *
 * What has to stay true:
 *
 *   1. the rule on sales_company is the one it had before 0043 — accounts,
 *      the owner, and the sales-viewers list, which is a LIST and not a rule
 *      about job titles (a rule about job titles is what quietly caught a
 *      fourth person, so it is asserted that no such rule is there);
 *   2. a consultant is sent no sales_company row at all;
 *   3. the narrow view carries none of the four, at either level, and is
 *      scoped to the reader's own company;
 *   4. but it still carries what Team performance and the payment request
 *      form need — department, monthly, target, dept, clients;
 *   5. on screen: Team performance stays, Department and the leaderboard go,
 *      and a typed link to either lands somewhere rather than opening it;
 *   6. Avin, Miraziz and Rana keep all three;
 *   7. Team performance still draws — a department name, a figure and more
 *      than one person in the table;
 *   8. the commission and invoice rules were not touched.
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
 sales_company_mine:'sales_company_mine',
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
const MIRA = who('Miraziz Makhamatzhanov');
const RANA = who('Rana Amine');
const SHOH = who('Shohruh Karimov');       // consultant, Corporate & Legal
const ABDU = who('Abdunosir Kadirov');     // manages Accounting & Tax — a manager, and NOT one of the three

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, tab){
  const U = who(name);
  const cols = Object.entries(T);
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      cols.map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
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
  await p.evaluate(t => { state.mode = 'staff'; state.tab = t; render(); }, tab || 'home');
  await p.waitForTimeout(200);
  return {p, errs, D};
}
const rail = p => p.evaluate(() => [...document.querySelectorAll('#nav button[data-tab]')].map(b => b.dataset.tab));

/* =============================================== 1. the rule, and its shape */
console.log('\nthe rule on the company row');
{
  const r = one(`select pg_get_expr(polqual, polrelid) from pg_policy
                  where polrelid='sales_company'::regclass and polname='read_sales_company'`);
  ok('is exactly what it was before 0043', r === 'sees_company_sales(company)', r);
  ok('and carries no "anybody active in this company" arm', !/employees/.test(r), r);
  /* The rule that looks right and is not. Abdunosir manages Accounting & Tax
     and Donia manages POA Operations; a policy keyed on the manager role
     would hand both of them the Department screen, and neither is on Avin's
     list of three. */
  ok('nor a rule about job titles', !/role|manager/i.test(r), r);

  const list = one(`select string_agg(e.full_name, ', ' order by e.full_name)
                      from sales_viewers v join employees e on e.id=v.employee_id`);
  ok('the sales-viewers list is the three, by name',
     list === 'Avin Mascarenhas, Miraziz Makhamatzhanov, Rana Amine', list);
}

/* ================================================= 2. who is sent what */
console.log('\nwho is sent the whole row');
{
  const rows = u => +one(`select count(*) from sales_company`, u);
  ok('Avin — the whole row',   rows(AVIN.auth_user_id) > 0, rows(AVIN.auth_user_id));
  ok('Miraziz — the whole row', rows(MIRA.auth_user_id) > 0, rows(MIRA.auth_user_id));
  ok('Rana — the whole row',   rows(RANA.auth_user_id) > 0, rows(RANA.auth_user_id));
  ok('a consultant — none at all', rows(SHOH.auth_user_id) === 0, rows(SHOH.auth_user_id));
  ok('a department manager who is not on the list — none either',
     rows(ABDU.auth_user_id) === 0, rows(ABDU.auth_user_id));
}

/* ============================================ 3. what the narrow one drops */
console.log('\nthe narrow row');
{
  const keys = u => json(`select coalesce(json_agg(k),'[]') from (
      select distinct jsonb_object_keys(figures) as k from sales_company_mine) t`, u);
  const atKeys = u => json(`select coalesce(json_agg(k),'[]') from (
      select distinct jsonb_object_keys(figures->'atDept') as k from sales_company_mine
       where jsonb_typeof(figures->'atDept')='object') t`, u);
  const GONE = ['topClients', 'clientCount', 'statusMix', 'typeMonthly'];
  const KEPT = ['department', 'monthly', 'target', 'dept', 'clients', 'totals'];

  const k = keys(SHOH.auth_user_id);
  ok('a consultant is sent it at all', k.length > 0, k.length);
  GONE.forEach(g => ok(`${g} is not in it`, !k.includes(g), k));
  KEPT.forEach(g => ok(`${g} still is — Team performance and the payment form need it`, k.includes(g), k));

  const a = atKeys(SHOH.auth_user_id);
  ok('and the Accounting & Tax half is cut the same way',
     a.length > 0 && !GONE.some(g => a.includes(g)), a);

  ok('it is their own company only',
     one(`select coalesce(string_agg(distinct company, ','), 'none') from sales_company_mine`, SHOH.auth_user_id) === 'corplex',
     one(`select coalesce(string_agg(distinct company, ','), 'none') from sales_company_mine`, SHOH.auth_user_id));
  ok('somebody signed out of everything gets nothing from it',
     one(`select count(*) from sales_company_mine`, '00000000-0000-0000-0000-000000000000') === '0');
}

/* ====================================================== 4. and on the screen */
console.log('\nthe rail');
{
  const {p, errs, D} = await open('Shohruh Karimov', 'team');
  const tabs = await rail(p);
  ok('a consultant keeps Team performance', tabs.includes('team'), tabs);
  ok('and loses Team leaderboard', !tabs.includes('leaderboard'), tabs);
  ok('and loses Department', !tabs.includes('company'), tabs);
  ok('their own three are untouched',
     ['dashboard', 'commission', 'invoices'].every(t => tabs.includes(t)), tabs);
  ok('the gate reads the database rather than a job title', D.fullFigures === false, D.fullFigures);

  /* A tab that is gone from the rail and still opens on a typed link is not
     gone. Both are tried the way somebody would arrive at them. */
  for(const t of ['company', 'leaderboard']){
    const landed = await p.evaluate(id => { state.tab = id; render(); return state.tab; }, t);
    ok(`#${t} typed in refuses and lands on home`, landed === 'home', landed);
  }
  await p.close();
}

console.log('\nTeam performance still works for them');
{
  const {p, errs} = await open('Shohruh Karimov', 'team');
  const r = await p.evaluate(() => ({
    dept: (document.querySelector('#view .strip .stat .k') || {}).textContent || '',
    net: (document.querySelector('#view .strip .stat .v') || {}).textContent || '',
    rows: document.querySelectorAll('#view .teamtab tbody tr').length,
    heads: [...document.querySelectorAll('#view .teamtab thead th')].map(t => t.textContent.trim())
  }));
  ok('the hero still names the department', /Corporate|Accounting/.test(r.dept), r.dept);
  ok('and still carries a figure', /[1-9]/.test(r.net), r.net);
  ok('and there is a team in the table', r.rows > 1, r.rows);
  ok('with no commission column in it',
     !r.heads.some(h => /Commission|Paid|Balance/.test(h)), r.heads);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nthe payment request form still knows the clients');
{
  const {p, errs} = await open('Shohruh Karimov', 'payment');
  /* A typeahead, not a picker: two letters of a client already on the book
     have to come back with the client. This is the one screen outside the
     sales section that reads the client list, which is why the narrow row
     keeps it. */
  const r = await p.evaluate(() => {
    const names = Object.keys(DATA.clients || {});
    const inp = document.getElementById('pqClient');
    if(!inp || !names.length) return {names: names.length, hits: 0};
    inp.value = names[0].slice(0, 3);
    pqList();
    return {names: names.length,
            hits: document.querySelectorAll('#pqList button[data-client]').length};
  });
  ok('the client book reached them', r.names > 0, r.names);
  ok('and three letters bring back a client', r.hits > 0, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nthe three still have all of it');
for(const name of ['Avin Mascarenhas', 'Miraziz Makhamatzhanov', 'Rana Amine']){
  const {p, errs, D} = await open(name, 'company');
  const tabs = await rail(p);
  ok(`${name.split(' ')[0]} keeps Department`, tabs.includes('company'), tabs);
  ok(`${name.split(' ')[0]} keeps Team leaderboard`, tabs.includes('leaderboard'), tabs);
  ok(`${name.split(' ')[0]} is sent the whole row`, D.fullFigures === true, D.fullFigures);
  ok(`${name.split(' ')[0]} — the Department screen draws`,
     await p.evaluate(() => document.querySelectorAll('#view .panel').length) > 1);
  ok(`${name.split(' ')[0]} — no page errors`, !errs.length, errs[0]);
  await p.close();
}

/* ===================================================== 5. nothing else moved */
console.log('\nwhat was not touched');
{
  const c = one(`select pg_get_expr(polqual, polrelid) from pg_policy
                  where polrelid='sales_commission'::regclass and polname='read_commission'`);
  const i = one(`select pg_get_expr(polqual, polrelid) from pg_policy
                  where polrelid='sales_invoices'::regclass and polname='read_invoices'`);
  ok('the commission rule is unchanged', /employee_id = me\(\)/.test(c) && /manages/.test(c), c);
  ok('the invoice rule is unchanged', /consultant = me\(\)/.test(i), i);
  /* Coming off the viewers list narrows these two as well, which is the point
     rather than a side effect: three people were being sent every colleague's
     commission row and no screen ever showed it to them. */
  ok('a consultant still cannot read a colleague’s commission',
     +one(`select count(*) from sales_commission`, SHOH.auth_user_id) > 0
     && +one(`select count(distinct employee_id) from sales_commission`, SHOH.auth_user_id) === 1,
     one(`select count(distinct employee_id) from sales_commission`, SHOH.auth_user_id));
  ok('and the team view still gives them their colleagues, without it',
     +one(`select count(distinct employee_id) from sales_team_figures`, SHOH.auth_user_id) > 1,
     one(`select count(distinct employee_id) from sales_team_figures`, SHOH.auth_user_id));
}

await b.close(); server.close();
console.log(`\n${checks - fails}/${checks} checks pass`);
process.exit(fails ? 1 : 0);
