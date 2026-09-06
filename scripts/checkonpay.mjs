/* Two salaries for one person, and one person who was on nobody's payroll.
 *
 *   'Miraziz needs to receive salary from POA and Corplex - 25k each.
 *    This is missing.'
 *   'Mukhamad Musulmonkulov should be on payroll - just like Fakriddin'
 *
 * Neither was an arithmetic fault. The database has always held Miraziz's two
 * salaries correctly and the generator has always built him two lines; it was
 * map.js that filed salary under a person's name alone, so the second company
 * overwrote the first and every screen showed one of the two. And Mukhamad is
 * simply recorded with a payroll basis of 'off' and nothing on file, which no
 * screen showed and no screen could change — basis could only ever be set in
 * the moment somebody was added to the staff list.
 *
 * So the three things worth pinning down:
 *
 *   1. two companies read back as two, everywhere, and the newest row per
 *      company wins rather than whichever happened to arrive last;
 *   2. a revision is written against ONE of them, and the other does not move
 *      — the case that would otherwise have written a third salary row
 *      against a blank company and paid him three times;
 *   3. somebody can be put on payroll, and given an opening salary, but a
 *      salary that already exists still cannot be typed over.
 *
 *   node scripts/checkonpay.mjs
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

const who = nm => json(`select coalesce(json_agg(t),'[]') from (select id, auth_user_id, full_name
  from employees where full_name = '${nm}') t`)[0];
const AVIN = who('Avin Mascarenhas');

/* Whoever is paid by more than one company. On this seed that is the owner;
 * the check asks the database rather than naming him, so it keeps working
 * when somebody else is paid the same way. */
const TWO = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.full_name from employees e
   where (select count(distinct coalesce(s.company,'')) from salary_parts s
           where s.employee_id = e.id) > 1
   order by e.full_name limit 1) t`)[0];

/* And somebody who is not on payroll at all. */
const OFF = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.full_name from employees e
   where e.active and e.payroll_basis = 'off'
     and not exists (select 1 from salary_parts s where s.employee_id = e.id)
   order by e.full_name limit 1) t`)[0];

console.log(`\ntwo companies: ${TWO ? TWO.full_name : '(nobody)'}` +
            `; off payroll: ${OFF ? OFF.full_name : '(nobody)'}\n`);

console.log('=== the database ===\n');
ok('somebody is paid by two companies', !!TWO);
ok('and the generator builds them a line for each',
   one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
        where l.employee_id = '${TWO.id}'
          and r.month_key = (select max(month_key) from payroll_runs)`) === '2',
   one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
        where l.employee_id = '${TWO.id}'
          and r.month_key = (select max(month_key) from payroll_runs)`));

console.log('\n=== what the screens read ===\n');

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

const pull = u => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, u.auth_user_id)[0]}, u.id);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(setup){
  const D = pull(AVIN);
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

let p = await open();
const S = await p.evaluate(nm => salParts(nm), TWO.full_name);
ok('the portal knows they are paid by two companies', S.multi === true && S.co.length === 2,
   {multi: S.multi, cos: (S.co || []).map(c => c.company)});
ok('with each company named and its own figure',
   S.co.every(c => c.company && c.label && c.salary > 0), S.co);
ok('and the headline figure is the two added together',
   Math.round(S.salary) === Math.round(S.co.reduce((t, c) => t + c.salary, 0)),
   {total: S.salary, parts: S.co.map(c => c.salary)});

/* The second fault in that loop: with several rows per company, the one in
 * force is the newest that has taken effect — not whichever came last in the
 * array. Prove it with a real second row. */
const CO1 = S.co[0].company;
raw(`insert into salary_parts(employee_id, company, salary, basic, allowance, effective_from, source)
     values ('${TWO.id}', '${CO1}', 33333, 20000, 13333, current_date - 5, 'test row, newest')
     on conflict (employee_id, effective_from, company) do update
       set salary = 33333, basic = 20000, allowance = 13333, source = 'test row, newest'`);
raw(`insert into salary_parts(employee_id, company, salary, basic, allowance, effective_from, source)
     values ('${TWO.id}', '${CO1}', 11111, 6000, 5111, current_date + 40, 'test row, not yet')
     on conflict (employee_id, effective_from, company) do update
       set salary = 11111, basic = 6000, allowance = 5111, source = 'test row, not yet'`);
await p.close();
p = await open();
const S2 = await p.evaluate(nm => salParts(nm), TWO.full_name);
const live = (S2.co || []).find(c => c.company === CO1) || {};
ok('the newest row that has taken effect is the one shown', live.salary === 33333, live);
ok('a row dated ahead is not treated as today’s salary', live.salary !== 11111, live);
ok('but it is kept, so a screen can say it is coming',
   (S2.ahead || []).some(a => a.salary === 11111), S2.ahead);
raw(`delete from salary_parts where employee_id = '${TWO.id}' and source like 'test row%'`);
await p.close();

// ------------------------------------------------------- the revision form
console.log('\nissuing a revision for somebody paid twice:\n');
p = await open(`state.mode='console'; state.tab='revisions';
  state.revForm={who:${JSON.stringify(TWO.full_name)}, eff:'', basic:'', allow:'', co:''}; render();`);
ok('the form asks which company', await p.evaluate(() => !!document.getElementById('rvCo')));
ok('listing both, with what each is on',
   await p.evaluate(() => [...document.querySelectorAll('#rvCo option')].map(o => o.textContent.trim()))
     .then(v => v.length === 2 && v.every(t => /on file/.test(t)), undefined));
ok('and says plainly that the other one is left alone',
   await p.evaluate(() => /Left alone/.test(document.getElementById('view').textContent)));
ok('"on file now" is that company’s figure, not the pair added up',
   await p.evaluate(() => {
     const t = document.getElementById('view').textContent;
     return t.includes(money(salParts(state.revForm.who).co[0].salary, 2))
         && !t.includes(money(salParts(state.revForm.who).salary, 2)); }));

await p.evaluate(() => { const g = state.revForm;
  g.eff = '2027-01-01'; g.basic = '30000'; g.allow = '0'; render(); });
await p.waitForTimeout(250);
await p.evaluate(() => document.getElementById('rvIssue').click());
await p.waitForTimeout(300);
const call = await p.evaluate(() => (window.__saw || []).find(x => x[0] === 'issueRevision'));
ok('the revision carries the company', !!call && !!call[1].company, call && call[1]);
ok('and it is the one that was chosen', !!call && call[1].company === S.co[0].company,
   call && call[1].company);
await p.close();

/* And the reason that matters: with no company, the revision would land on
 * neither of their rows and the generator would pay them a third time. */
console.log('');
const before = one(`select count(*) from salary_parts where employee_id = '${TWO.id}'`);
const r1 = JSON.parse(one(`select issue_revision('${TWO.id}', 30000, 0, '2027-01-01'::date,
  'test', '${S.co[0].company}', 'revision', true)`, AVIN.auth_user_id));
ok('a revision against a named company adds one row, not one at a blank company',
   one(`select count(*) from salary_parts where employee_id = '${TWO.id}'`) === String(+before + 1)
   && one(`select count(*) from salary_parts where employee_id = '${TWO.id}' and company = ''`) === '0');
ok('the other company is untouched',
   one(`select salary::int::text from salary_parts where employee_id = '${TWO.id}'
          and company = '${S.co[1].company}' order by effective_from desc limit 1`)
     === String(Math.round(S.co[1].salary)),
   one(`select salary from salary_parts where employee_id = '${TWO.id}'
          and company = '${S.co[1].company}' order by effective_from desc limit 1`));
raw(`delete from salary_parts where employee_id = '${TWO.id}' and source like '%${r1.ref}%'`);
raw(`delete from salary_revisions where letter_ref = '${r1.ref}'`);
raw(`delete from letters where ref = '${r1.ref}'`);

// ------------------------------------------------------------- on payroll
console.log('\nputting somebody on payroll:\n');
ok('there is somebody off payroll to test with', !!OFF, OFF && OFF.full_name);

p = await open(`state.mode='console'; state.tab='onpay'; render();`);
ok('the screen exists and lists the staff',
   await p.evaluate(() => document.querySelectorAll('#view table tbody tr').length > 10));
ok('and shows who is not on payroll',
   await p.evaluate(nm => document.getElementById('view').textContent.includes(nm), OFF.full_name));
ok('the basis is read until you press Edit',
   await p.evaluate(() => !document.querySelector('[data-edt="basis"]')));
await p.evaluate(() => document.querySelector('[data-edon="basis"]').click());
await p.waitForTimeout(250);
await p.evaluate(nm => {
  const el = document.querySelector(`select[data-edt="basis"][data-edk="${nm}"]`);
  el.value = 'commission'; el.dispatchEvent(new Event('change', {bubbles: true}));
}, OFF.full_name);
await p.waitForTimeout(200);
await p.evaluate(() => document.querySelector('[data-edsave="basis"]').click());
await p.waitForTimeout(250);
ok('a change is read back in words before it is saved',
   await p.evaluate(() => {
     const r = document.querySelector('.edconf tbody tr');
     return !!r && /Not on payroll/.test(r.children[1].textContent)
                && /Commission only/.test(r.children[2].textContent); }),
   await p.evaluate(() => { const r = document.querySelector('.edconf tbody tr');
     return r ? [...r.children].map(c => c.textContent.trim()) : null; }));
await p.evaluate(() => document.getElementById('edGo').click());
await p.waitForTimeout(300);
const bcall = await p.evaluate(() => (window.__saw || []).find(x => x[0] === 'setPayrollBasis'));
ok('and it goes to its own writer', !!bcall, await p.evaluate(() => (window.__saw||[]).map(x=>x[0])));
ok('with the person and the basis', !!bcall && bcall[1][OFF.full_name] === 'commission', bcall && bcall[1]);
await p.close();

console.log('');
// the database's own rules, which the screen cannot talk it out of
raw(`select set_payroll_basis('${OFF.id}', 'commission', null)`, AVIN.auth_user_id);
ok('the basis really moves',
   one(`select payroll_basis from employees where id = '${OFF.id}'`) === 'commission');
ok('but salaried is refused while there is no figure on file',
   (() => { try{ raw(`select set_payroll_basis('${OFF.id}', 'salaried', null)`, AVIN.auth_user_id);
                 return false; }catch(_){ return true; } })());

const FROM = one(`select to_char(date_trunc('month', current_date), 'YYYY-MM-DD')`);
raw(`select record_salary('${OFF.id}', 'corplex', 4000, 2000, '${FROM}'::date)`, AVIN.auth_user_id);
ok('an opening salary can be recorded',
   one(`select salary::int::text from salary_parts where employee_id = '${OFF.id}'`) === '6000');
ok('and it says where it came from',
   /Recorded by accounts/.test(one(`select source from salary_parts where employee_id = '${OFF.id}'`)));
ok('now salaried is allowed',
   (() => { try{ raw(`select set_payroll_basis('${OFF.id}', 'salaried', null)`, AVIN.auth_user_id);
                 return one(`select payroll_basis from employees where id = '${OFF.id}'`) === 'salaried';
           }catch(_){ return false; } })());

/* The rule the whole split exists for. */
ok('a salary that exists cannot be typed over here — that is a revision letter',
   (() => { try{ raw(`select record_salary('${OFF.id}', 'corplex', 9999, 0, '${FROM}'::date)`,
                     AVIN.auth_user_id); return false; }catch(_){ return true; } })());
ok('and the refusal says so rather than just failing',
   (() => { try{ raw(`select record_salary('${OFF.id}', 'corplex', 9999, 0, '${FROM}'::date)`,
                     AVIN.auth_user_id); return false;
           }catch(e){ return /revision letter/.test(String(e.stderr || e.message)); } })());
ok('nobody but accounts may do either',
   (() => { const s = json(`select coalesce(json_agg(t),'[]') from (select auth_user_id from employees e
              where e.active and e.auth_user_id is not null
                and not exists (select 1 from employee_roles r where r.employee_id = e.id
                                 and r.role in ('accounts','owner')) limit 1) t`)[0];
            try{ raw(`select set_payroll_basis('${OFF.id}', 'off', null)`, s.auth_user_id); return false; }
            catch(_){ return true; } })());

// ------------------------------------------------------------------ tidy up
raw(`delete from salary_parts where employee_id = '${OFF.id}'`);
raw(`update employees set payroll_basis = 'off' where id = '${OFF.id}'`);

/* The button that clears a figure. It is the one destructive thing on this
 * screen, so its words matter: "Take it off" read to Avin as taking the
 * person off payroll, and the case it is offered in — a salary sitting on
 * somebody marked commission only — has two possible resolutions, not one. */
{
  const F = json(`select coalesce(json_agg(t),'[]') from (
    select e.full_name from employees e join salary_parts s on s.employee_id = e.id
     where e.active and e.payroll_basis::text = 'commission' limit 1) t`)[0];
  if(F){
    const pg = await open(`state.mode='console'; state.tab='onpay'; render();`);
    ok('a figure nobody is paid offers to be cleared',
       await pg.evaluate(() => !!document.querySelector('[data-salclr]')));
    ok('and the button names what it clears, not who',
       await pg.evaluate(() => (document.querySelector('[data-salclr]') || {}).textContent || '')
         .then(t => /figure/i.test(t) && !/take.*off/i.test(t), undefined),
       await pg.evaluate(() => (document.querySelector('[data-salclr]') || {}).textContent));
    /* And the guard: if a real payroll month paid them that salary, the figure
     * is not a leftover and the confirmation has to say so before it deletes. */
    const seen = [];
    // dialog.message() is a method, not a property — pushing the function makes
    // every assertion below silently meaningless.
    pg.on('dialog', async d => { seen.push(d.message()); await d.dismiss(); });
    await pg.evaluate(() => document.querySelector('[data-salclr]').click());
    await pg.waitForTimeout(300);
    ok('pressing it asks first', seen.length === 1, seen);
    ok('and says plainly that only the figure goes',
       seen.length === 1 && /removes the figure and nothing else/i.test(seen[0]), seen[0]);
    const wasPaid = one(`select count(*) from payroll_lines l
        join payroll_runs r on r.id = l.run_id
        join employees e on e.id = l.employee_id
       where e.full_name = '${F.full_name}' and l.salary > 0`) !== '0';
    ok(wasPaid
       ? 'and warns that a real month paid them that salary'
       : 'and says no month has paid them a salary',
       seen.length === 1 && (wasPaid ? /CHECK THIS FIRST/.test(seen[0])
                                     : /No payroll month has paid/.test(seen[0])), seen[0]);
    ok('and dismissing it writes nothing',
       await pg.evaluate(() => !(window.__saw || []).some(x => x[0] === 'clearSalary')));
    await pg.close();
  }
}

await b.close(); server.close();
console.log(`\n${n - bad.length}/${n} passed`);
if(bad.length){ console.log('\n' + bad.map(x => '  - ' + x).join('\n')); process.exit(1); }
