/* A director's remuneration, a figure nobody is paid, and a month that has
 * gone out of date.
 *
 *   'Mirazizbek Makhamatzhanov - should be 25k each from both POA and
 *    Corplex, now showing under one company'
 *   'And its not commission, its directors remuneration'
 *   'refreshing the records have not fetched amounts into payroll of Miraziz'
 *   'Fakhridin Kochkorov - should be commission only'
 *   'if there is a revision letter processed, the payroll should indicate
 *    there is a change in salary so that i refresh it and the salary is
 *    changed. Once its changed, the indication should go off - its for that
 *    particular month only'
 *
 * The first three are one fault. The generator's very first branch is: on
 * commission, write a line of nought and move on WITHOUT reading the salary
 * rows. Miraziz was recorded as commission, so his two 25,000s sat in the
 * database being correctly ignored — which is exactly and only why refreshing
 * never fetched them. This walks that from the wrong state to the right one
 * and watches the money appear.
 *
 * The last one is a different thing, and the interesting part of it is that
 * nothing is stored: whether a month is out of date is worked out by asking
 * what the lines pay and what the records say they should. So it cannot fall
 * out of step, and it clears itself when the month is refreshed — which is
 * the property worth testing rather than the banner.
 *
 *   node scripts/checkdirector.mjs
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

const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id, auth_user_id, full_name
  from employees where full_name = 'Avin Mascarenhas') t`)[0];
const DIR = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.full_name, e.payroll_basis::text as basis from employees e
   where (select count(distinct coalesce(s.company,'')) from salary_parts s
           where s.employee_id = e.id) > 1
   order by e.full_name limit 1) t`)[0];
const LAST = one(`select month_key from payroll_runs where status = 'closed' order by month_key desc limit 1`);
const M = (() => { const [y, m] = LAST.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; })();
const WAS = one(`select payroll_basis from employees where id = '${DIR.id}'`);

console.log(`\n${DIR.full_name}, paid by two companies; working month ${M}\n`);
console.log('=== recorded as commission, which is what Avin found ===\n');

raw(`delete from payroll_runs where month_key = '${M}'`);
raw(`update employees set payroll_basis = 'commission' where id = '${DIR.id}'`);
raw(`select generate_run('${M}', null)`, AVIN.auth_user_id);

ok('the month builds them one line, not two',
   one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${M}' and l.employee_id = '${DIR.id}'`) === '1');
ok('and it pays nothing, however many times it is refreshed',
   one(`select l.salary::int::text from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${M}' and l.employee_id = '${DIR.id}'`) === '0');
raw(`select generate_run('${M}', null)`, AVIN.auth_user_id);
ok('refreshing again changes nothing — the salary rows are never read',
   one(`select l.salary::int::text from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${M}' and l.employee_id = '${DIR.id}'`) === '0');
ok('while the two salaries are sitting there all along',
   one(`select count(*) from salary_parts where employee_id = '${DIR.id}'`) === '2');

// ------------------------------------------------------------ the new basis
console.log('\n=== recorded as a director ===\n');
raw(`select set_payroll_basis('${DIR.id}', 'director', null)`, AVIN.auth_user_id);
ok('the basis takes', one(`select payroll_basis from employees where id = '${DIR.id}'`) === 'director');
ok('and it is its own kind, not filed under salaried',
   one(`select payroll_basis from employees where id = '${DIR.id}'`) !== 'salaried');

raw(`select generate_run('${M}', null)`, AVIN.auth_user_id);
const lines = json(`select coalesce(json_agg(t),'[]') from (
  select l.company, l.paid_by, l.salary::int as salary
    from payroll_lines l join payroll_runs r on r.id = l.run_id
   where r.month_key = '${M}' and l.employee_id = '${DIR.id}' order by l.company) t`);
ok('now the month builds a line for each company', lines.length === 2, lines);
ok('each carrying that company’s own figure',
   lines.every(l => l.salary > 0) && lines[0].salary === lines[1].salary, lines);
ok('and each charged to the company that pays it',
   lines.every(l => l.paid_by === l.company), lines.map(l => [l.company, l.paid_by]));

// ------------------------------------------------- a figure nobody is paid
console.log('\n=== a salary left on somebody who is commission only ===\n');
const C = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.full_name, coalesce(s.company,'') as co from employees e
    join salary_parts s on s.employee_id = e.id
   where e.active and e.payroll_basis = 'commission' limit 1) t`)[0];
if(!C){
  /* Nothing in this state right now — make one, because the rule is what is
     being tested and not the seed. */
  const any = json(`select coalesce(json_agg(t),'[]') from (select e.id, e.full_name
    from employees e where e.active and e.payroll_basis = 'commission' limit 1) t`)[0];
  raw(`insert into salary_parts(employee_id, company, salary, basic, allowance, effective_from, source)
       values ('${any.id}', '', 6000, 0, 6000, current_date - 100, 'left over')`);
}
const CC = C || json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.full_name, coalesce(s.company,'') as co from employees e
    join salary_parts s on s.employee_id = e.id
   where e.active and e.payroll_basis = 'commission' limit 1) t`)[0];
ok('somebody is commission only and still has a figure on file', !!CC, CC && CC.full_name);
/* Clearing it is the point of the test, so what is there has to be put back
 * afterwards — a check that eats a row of the seed makes the next run of the
 * suite a slightly different experiment. */
const CCROW = json(`select coalesce(json_agg(t),'[]') from (
  select coalesce(company,'') as company, salary, basic, allowance,
         effective_from::text as eff, coalesce(source,'') as source
    from salary_parts where employee_id = '${CC.id}') t`);
ok('it can be taken off',
   (() => { try{ raw(`select clear_salary('${CC.id}', '${CC.co}')`, AVIN.auth_user_id);
                 return one(`select count(*) from salary_parts where employee_id = '${CC.id}'`) === '0';
           }catch(e){ return String(e.stderr || e.message); } })());
ok('but not from somebody who is actually paid from it',
   (() => { try{ raw(`select clear_salary('${DIR.id}', 'corplex')`, AVIN.auth_user_id); return false; }
            catch(e){ return /paid from what is on file/.test(String(e.stderr || e.message)); } })());
ok('and not by anybody but accounts',
   (() => { const s = json(`select coalesce(json_agg(t),'[]') from (select auth_user_id from employees e
              where e.active and e.auth_user_id is not null
                and not exists (select 1 from employee_roles r where r.employee_id = e.id
                                 and r.role in ('accounts','owner')) limit 1) t`)[0];
            try{ raw(`select clear_salary('${CC.id}', '')`, s.auth_user_id); return false; }
            catch(_){ return true; } })());

// --------------------------------------------- a month that is out of date
console.log('\n=== the month knowing it is out of date ===\n');

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
const pull = () => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, AVIN.auth_user_id)[0]}, AVIN.id);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(setup){
  const D = pull();
  const page = await b.newPage({viewport: {width: 1500, height: 1200}});
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
  }, [D, AVIN.full_name, D._roles[AVIN.full_name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  if(setup){ await page.evaluate(setup); await page.waitForTimeout(400); }
  return page;
}

const staleNow = () => open().then(async pg => {
  const v = await pg.evaluate(k => (((window.DATA || {}).payroll || {}).runs || [])
    .find(r => r.key === k), M);
  await pg.close(); return (v || {}).stale || [];
});

let p = await open(`state.mode='console'; state.tab='payroll'; state.payRun='${M}'; render();`);
ok('a month that agrees with the records says nothing',
   await p.evaluate(k => {
     const run = (DATA.payroll.runs || []).find(r => r.key === k);
     return (run.stale || []).length === 0; }, M),
   await p.evaluate(k => ((DATA.payroll.runs||[]).find(r => r.key === k)||{}).stale, M));
ok('and shows no notice',
   await p.evaluate(() => !/no longer matches the records/.test(document.getElementById('view').textContent)));
await p.close();

/* Now a revision letter that takes effect in that month, exactly as Avin
 * described — issued after the month was built. */
const R = JSON.parse(one(`select issue_revision('${DIR.id}', 30000, 0, '${M}-01'::date,
  'test', 'corplex', 'revision', true)`, AVIN.auth_user_id));

p = await open(`state.mode='console'; state.tab='payroll'; state.payRun='${M}'; render();`);
const st = await p.evaluate(k => ((DATA.payroll.runs||[]).find(r => r.key === k)||{}).stale, M);
ok('once a letter goes out the month knows it is behind', !!st && st.length >= 1, st);
ok('naming the person, the company, and both figures',
   !!st && st.some(x => x.name === DIR.full_name && x.company && x.now === 30000), st);
ok('and the screen says so where the money is',
   await p.evaluate(() => /no longer matches the records/.test(document.getElementById('view').textContent)));
ok('with the way to fix it on the notice itself',
   await p.evaluate(() => !!document.getElementById('payGenTop')));
await p.evaluate(() => document.getElementById('payGenTop').click());
await p.waitForTimeout(300);
ok('pressing it refreshes the month',
   await p.evaluate(() => (window.__saw || []).some(x => x[0] === 'generateRun')));
await p.close();

/* And the property that makes the whole thing trustworthy: nothing is stored,
 * so refreshing clears it without anybody clearing anything. */
raw(`select generate_run('${M}', null)`, AVIN.auth_user_id);
ok('the line now pays what the letter said',
   one(`select l.salary::int::text from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${M}' and l.employee_id = '${DIR.id}' and l.company = 'corplex'`) === '30000');
const after = await staleNow();
ok('and the notice goes out by itself, with nothing to clear', after.length === 0, after);

p = await open(`state.mode='console'; state.tab='payroll'; state.payRun='${M}'; render();`);
ok('the screen agrees',
   await p.evaluate(() => !/no longer matches the records/.test(document.getElementById('view').textContent)));
await p.close();

/* A closed month is a record and is never restated, however far the records
 * move afterwards. */
ok('a closed month is never reported as out of date',
   await open().then(async pg => { const v = await pg.evaluate(k =>
     ((DATA.payroll.runs||[]).find(r => r.key === k)||{}), LAST); await pg.close();
     return v.status === 'closed' && (v.stale || []).length === 0; }));

// ------------------------------------------------------------------ the screen
console.log('');
p = await open(`state.mode='console'; state.tab='onpay'; render();`);
ok('the On payroll screen offers a director’s remuneration',
   await p.evaluate(() => {
     const el = document.querySelector('[data-edon="basis"]'); if(!el) return null;
     return /director/i.test(document.getElementById('view').innerHTML); }));
ok('and puts each of their lines under the company that pays it',
   await p.evaluate(nm => {
     const blocks = [...document.querySelectorAll('.regblock')].map(bl => ({
       co: (bl.querySelector('.regbar b') || {}).textContent,
       has: [...bl.querySelectorAll('tbody tr')].some(t => t.textContent.includes(nm))}));
     return blocks.filter(x => x.has).length === 2; }, DIR.full_name),
   await p.evaluate(nm => [...document.querySelectorAll('.regblock')]
     .filter(bl => [...bl.querySelectorAll('tbody tr')].some(t => t.textContent.includes(nm)))
     .map(bl => (bl.querySelector('.regbar b')||{}).textContent), DIR.full_name));
ok('with the name on both, not blank on the second',
   await p.evaluate(nm => [...document.querySelectorAll('#view tbody tr')]
     .filter(t => t.textContent.includes(nm))
     .every(t => t.children[0].textContent.trim().length > 3), DIR.full_name));
await p.close();

// ------------------------------------------------------------------- tidy up
raw(`delete from salary_parts where employee_id = '${DIR.id}' and source like '%${R.ref}%'`);
raw(`delete from salary_revisions where letter_ref = '${R.ref}'`);
raw(`delete from letters where ref = '${R.ref}'`);
raw(`delete from payroll_runs where month_key = '${M}'`);
raw(`update employees set payroll_basis = '${WAS}' where id = '${DIR.id}'`);
// put back exactly what was cleared
CCROW.forEach(r => raw(`insert into salary_parts(employee_id, company, salary, basic, allowance,
  effective_from, source) values ('${CC.id}', '${r.company}', ${r.salary}, ${r.basic},
  ${r.allowance}, '${r.eff}', '${String(r.source).replace(/'/g, "''")}')
  on conflict (employee_id, effective_from, company) do nothing`));
if(CC && !C) raw(`delete from salary_parts where employee_id = '${CC.id}' and source = 'left over'`);

await b.close(); server.close();
console.log(`\n${n - bad.length}/${n} passed`);
if(bad.length){ console.log('\n' + bad.map(x => '  - ' + x).join('\n')); process.exit(1); }
