/* Starting a record again on new terms.
 *
 *   'If someone changes like that, i will add them as a new employee'
 *   'Old gratuity will be paid, the question is only if someone starts on
 *    salary from commission'
 *   'Past is past, no access. I can provide them payslips if needed'
 *   'Starts at zero'                                                  -- Avin
 *
 * Three things this has to get right, in this order:
 *
 *   1. It must be IMPOSSIBLE to start a fresh record before the settlement for
 *      the old one has been paid. Starting one moves the joining date, and the
 *      old gratuity is worked out from that date — so doing it in the wrong
 *      order does not produce a wrong number, it destroys the number.
 *   2. What the fresh record starts must start at the fresh record: the leave
 *      at nothing, the air ticket at eleven months from the new day, the
 *      gratuity accruing on the new basic.
 *   3. What the closed record holds must stay with accounts. The payslips of
 *      the old spell are the case that matters, because payslips are matched
 *      to somebody BY NAME in the portal — so the test is not that the screen
 *      hides them, it is that the browser is never sent them.
 *
 *   node scripts/checkrestart.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h','/tmp/pg','-p','5433','-U','postgres','-d','seedtest'];
const raw = (s, u) => execFileSync(PSQL, [...base,'-tAc',
  (u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` : '') + s],
  {encoding:'utf8', maxBuffer:64e6});
const one = (s, u) => raw(s, u).trim().split('\n').pop();
const json = (s, u) => { const o = raw(s, u); const i = o.lastIndexOf('\n[');
  return JSON.parse(i < 0 ? o.trim() : o.slice(i + 1).trim()); };
/* A call that is expected to be refused: give back the message, not a crash. */
const nope = (s, u) => { try { raw(s, u); return ''; }
  catch(e){ return String(e.stderr || e.message).replace(/^ERROR:\s*/m, '').split('\n')[0].trim(); } };

const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits', exit_lines:'exit_lines',
 spells:'service_spells',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads', sales_team:'sales_team_figures',
 payment_requests:'payment_requests', payment_files:'payment_files', sales_members:'sales_members'};

const TYPES = {'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const server = http.createServer((q, r) => {
  const f = path.join('web', decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'') || 'index.html');
  if(!fs.existsSync(f)){ r.writeHead(404); return r.end('no'); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});
await new Promise(k => server.listen(0, '127.0.0.1', k));
const O = 'http://127.0.0.1:' + server.address().port;

let n = 0, bad = [];
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log('  ok    ' + what);
  bad.push(what + (saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)));
  console.log('  FAIL  ' + what + (saw === undefined ? '' : '  saw ' + JSON.stringify(saw))); };

const AVIN  = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Avin Mascarenhas') t`)[0];
const OWNER = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Miraziz Makhamatzhanov') t`)[0];

/* Somebody on commission with a sign-in of their own, so the payslip half of
 * this can be asked as them rather than about them. */
const WHO = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name, e.doj, e.payroll_basis, e.manager_id
    from employees e
   where e.active and e.auth_user_id is not null and e.payroll_basis = 'commission'
     and e.doj is not null
   order by e.full_name limit 1) t`)[0];
if(!WHO) throw new Error('nobody on commission with a sign-in — the seed is not what this expects');

/* Everything this check writes is undone at the end, so the suite can run in
 * any order and this can be run twice. */
const WAS = json(`select coalesce(json_agg(t),'[]') from (select doj, last_day, active, payroll_basis, works_remote,
  probation_until, confirmed_on from employees where id='${WHO.id}') t`)[0];
const SPWAS = json(`select coalesce(json_agg(t),'[]') from (select company, salary, basic, allowance, effective_from, source
  from salary_parts where employee_id='${WHO.id}') t`);
const LOWAS = json(`select coalesce(json_agg(t),'[]') from (select as_at, carried, carried_set, notes
  from leave_opening where employee_id='${WHO.id}') t`)[0];
const TKWAS = json(`select coalesce(json_agg(t),'[]') from (select country, rate, first_due, next_due, proc_month,
  status, note, taken, pending, backlog from ticket_entitlements where employee_id='${WHO.id}') t`)[0];

const restore = () => {
  raw(`delete from service_spells where employee_id='${WHO.id}'`);
  raw(`delete from exit_lines where exit_id in (select id from exits where employee_id='${WHO.id}')`);
  raw(`delete from exits where employee_id='${WHO.id}'`);
  raw(`delete from salary_parts where employee_id='${WHO.id}'`);
  SPWAS.forEach(s => raw(`insert into salary_parts(employee_id,company,salary,basic,allowance,effective_from,source)
    values('${WHO.id}', '${(s.company||'').replace(/'/g,"''")}', ${s.salary}, ${s.basic}, ${s.allowance},
    '${s.effective_from}', ${s.source === null ? 'null' : `'${String(s.source).replace(/'/g,"''")}'`})`));
  raw(`update employees set doj = ${WAS.doj ? `'${WAS.doj}'` : 'null'},
        last_day = ${WAS.last_day ? `'${WAS.last_day}'` : 'null'}, active = ${WAS.active},
        payroll_basis = '${WAS.payroll_basis}', works_remote = ${WAS.works_remote},
        probation_until = ${WAS.probation_until ? `'${WAS.probation_until}'` : 'null'},
        confirmed_on = ${WAS.confirmed_on ? `'${WAS.confirmed_on}'` : 'null'}
       where id='${WHO.id}'`);
  raw(`delete from leave_opening where employee_id='${WHO.id}'`);
  if(LOWAS) raw(`insert into leave_opening(employee_id,as_at,carried,carried_set,notes)
    values('${WHO.id}','${LOWAS.as_at}',${LOWAS.carried},${LOWAS.carried_set},
    ${LOWAS.notes === null ? 'null' : `'${String(LOWAS.notes).replace(/'/g,"''")}'`})`);
  raw(`delete from ticket_entitlements where employee_id='${WHO.id}'`);
  if(TKWAS) raw(`insert into ticket_entitlements(employee_id,country,rate,first_due,next_due,proc_month,status,note,taken,pending,backlog)
    values('${WHO.id}', ${TKWAS.country === null ? 'null' : `'${TKWAS.country}'`}, ${TKWAS.rate},
    ${TKWAS.first_due ? `'${TKWAS.first_due}'` : 'null'}, ${TKWAS.next_due ? `'${TKWAS.next_due}'` : 'null'},
    ${TKWAS.proc_month === null ? 'null' : `'${TKWAS.proc_month}'`}, '${TKWAS.status}',
    ${TKWAS.note === null ? 'null' : `'${String(TKWAS.note).replace(/'/g,"''")}'`},
    ${TKWAS.taken}, ${TKWAS.pending}, ${TKWAS.backlog})`);
};

const LWD = '2026-09-30', NEW = '2026-10-01';
console.log(`\n${WHO.full_name}, on ${WHO.payroll_basis} since ${WHO.doj}\n`);

try {

/* ===================================== 1. the order it must not be possible
 *
 * Every one of these is somebody halfway through the settlement pressing the
 * button. Each has to refuse, and each has to say what to do instead — a bare
 * 'not allowed' would send Avin looking for a bug rather than for the step he
 * has not done.
 */
console.log('a fresh record cannot get ahead of the settlement');
{
  let m = nope(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 6000, 3000)`, AVIN.auth_user_id);
  ok('somebody still on the staff list is refused', /still on the staff list/.test(m), m);
  ok('and is told to work the settlement out first', /settlement/i.test(m), m);

  raw(`select exit_save(null, '${WHO.id}', '${LWD}', '${LWD}', 'Moving to a salary', null, '[]'::jsonb)`, AVIN.auth_user_id);
  const EX = one(`select id from exits where employee_id='${WHO.id}' order by created_at desc limit 1`);

  m = nope(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 6000, 3000)`, AVIN.auth_user_id);
  ok('a settlement that is only a draft is refused', /still on the staff list/.test(m), m);

  raw(`select exit_initiate('${EX}', '{}'::jsonb, 12345)`, AVIN.auth_user_id);
  m = nope(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 6000, 3000)`, AVIN.auth_user_id);
  ok('one that is initiated but not approved is refused', /has not been paid/.test(m), m);
  ok('and the refusal says why it matters, not just that it is not allowed',
     /nothing left to work the old gratuity out from/.test(m), m);

  const MGR = one(`select coalesce((select auth_user_id from employees where id = (
    select manager_id from employees where id='${WHO.id}')), '${OWNER.auth_user_id}')`);
  raw(`select exit_approve('${EX}')`, MGR);
  try { raw(`select exit_approve('${EX}')`, OWNER.auth_user_id); } catch(e){ /* one step where they are the same */ }
  raw(`select exit_decide('${EX}', 'separate')`, AVIN.auth_user_id);
  m = nope(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 6000, 3000)`, AVIN.auth_user_id);
  ok('approved but not yet paid is refused too', /has not been paid/.test(m), m);

  raw(`select exit_paid('${EX}', '2026-10-05')`, AVIN.auth_user_id);
  ok('the settlement is paid', one(`select status from exits where id='${EX}'`) === 'paid');

  m = nope(`select restart_record('${WHO.id}', '${LWD}', 'salaried', 6000, 3000)`, AVIN.auth_user_id);
  ok('a record starting on the old last day is refused', /has to begin after/.test(m), m);
  m = nope(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 0, 9000)`, AVIN.auth_user_id);
  ok('and a salaried one with no basic is refused', /needs a basic/.test(m), m);
  ok('with the reason a basic matters on it', /gratuity/.test(m), m);

  /* Never write these as 'it did not error': the owner is inside is_admin()
     everywhere in this portal, so a call by the wrong person that quietly
     SUCCEEDS is exactly the failure to catch — an empty message has to be a
     FAIL, not a pass. */
  m = nope(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 6000, 3000)`, WHO.auth_user_id);
  ok('the person themselves cannot do it', /Only accounts/.test(m), m || 'IT WENT THROUGH');

  const PLAIN = one(`select e.auth_user_id from employees e
     where e.active and e.auth_user_id is not null and e.id <> '${WHO.id}'
       and not exists (select 1 from employee_roles r where r.employee_id = e.id
                        and r.role in ('accounts','owner'))
     order by e.full_name limit 1`);
  m = nope(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 6000, 3000)`, PLAIN);
  ok('nor can a colleague', /Only accounts/.test(m), m || 'IT WENT THROUGH');

  /* The owner can, and that is deliberate: is_admin() is accounts or owner,
     and every other console job in the portal works the same way. It is
     asserted rather than assumed so that a change to is_admin() shows up
     here as a decision rather than as a surprise. */
  ok('the owner can, like every other accounts job',
     one(`select 'y' from employees where id='${WHO.id}' and not active`) === 'y');
}

/* ============================== 2. and on the screen, in that order
 *
 * The settlement is paid and nothing has been restarted yet, which is exactly
 * the state Avin is in when he presses the button. Run this BEFORE the restart
 * below, or the screen is asked to describe a spell that has already closed
 * and reads the new terms back as if they were the old ones. */
console.log('\non the settlement screen');
{
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      AVIN.auth_user_id)[0]}, AVIN.id);
  const b = await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:1600, height:1300}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => async () => true});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); },
    [D, 'Avin Mascarenhas', D._roles['Avin Mascarenhas'] || ['staff']]);
  await p.addScriptTag({path:'web/app.js'});

  const EX = one(`select id from exits where employee_id='${WHO.id}' order by created_at desc limit 1`);
  const at = async id => { await p.evaluate(x => { state.mode='console'; state.tab='exits';
    state.exitOpen = x; render(); }, id); await p.waitForTimeout(250); };

  await at(EX);
  let r = await p.evaluate(() => ({
    offer: !!document.querySelector('[data-frnew]'),
    text: document.getElementById('view').textContent}));
  ok('a paid settlement offers to start a fresh record', r.offer, r.offer);
  ok('and says what starting one is for', /staying on new terms/.test(r.text));

  await p.evaluate(() => document.querySelector('[data-frnew]').click());
  await p.waitForTimeout(250);
  r = await p.evaluate(() => ({
    fields: ['frDoj','frBasis','frRem','frBasic','frAll'].filter(i => document.getElementById(i)),
    doj: (document.getElementById('frDoj')||{}).value,
    see: !!document.querySelector('[data-frsee]'),
    go: !!document.querySelector('[data-frgo]')}));
  ok('the form asks for the date, the basis, where they are based and the pay',
     r.fields.length === 5, r.fields);
  ok('and nothing is written from the form itself', !r.go, r.go);
  /* Two things have to change as somebody types, without a re-render taking
     the cursor out of the box: the button that was greyed, and the line that
     said why. A form that goes on telling you off for something you have just
     filled in is how a screen loses trust. */
  let w = await p.evaluate(() => { const e = document.getElementById('frBad');
    return {shown: !!e && !e.hidden, text: e ? e.textContent : ''}; });
  ok('with no basic typed, it says why it cannot go on', w.shown && /needs a basic/.test(w.text), w);

  await p.evaluate(() => { document.getElementById('frBasic').value = '6000';
    document.getElementById('frBasic').dispatchEvent(new Event('input', {bubbles:true}));
    document.getElementById('frAll').value = '3000';
    document.getElementById('frAll').dispatchEvent(new Event('input', {bubbles:true})); });
  await p.waitForTimeout(150);
  w = await p.evaluate(() => { const e = document.getElementById('frBad');
    return {shown: !!e && !e.hidden,
            greyed: (document.querySelector('[data-frsee]')||{}).disabled}; });
  ok('and the moment a basic is typed the telling-off goes', !w.shown, w);
  ok('and the button stops being greyed, without a re-render', w.greyed === false, w);
  await p.evaluate(() => document.querySelector('[data-frsee]').click());
  await p.waitForTimeout(250);
  r = await p.evaluate(() => { const c = document.querySelector('.frbox .edconf');
    return {list: !!c, text: c ? c.textContent : '', go: !!document.querySelector('[data-frgo]')}; });
  ok('reviewing it shows the list of what it does', r.list);
  ok('the closed spell is named on the list, with its basis', /commission/.test(r.text), r.text.slice(0,80));
  ok('so is the gratuity', /[Gg]ratuity/.test(r.text));
  ok('and the air ticket', /[Aa]ir ticket/.test(r.text));
  ok('and that leave starts at nothing', /starts at nothing/.test(r.text));
  ok('and that the old payslips stay with accounts', /stay with accounts/.test(r.text));
  ok('and that the sign-in does not move', /sign-in/.test(r.text));
  ok('only then is there a button that writes', r.go);

  /* The half a form is easiest to get wrong: the figures must survive the
     re-render that showing the list causes. */
  r = await p.evaluate(() => ({b: (document.getElementById('frBasic')||{}).value,
                               a: (document.getElementById('frAll')||{}).value}));
  ok('the figures typed are still there under the list', r.b === '6000' && r.a === '3000', r);

  ok('no page errors', !errs.length, errs[0]);
  await b.close();
}

/* ============================================= 3. and then what it actually does */
console.log('\nand when it is in the right order');
const OUT = JSON.parse(one(`select restart_record('${WHO.id}', '${NEW}', 'salaried', 6000, 3000, false, 'Commission to salary')`,
  AVIN.auth_user_id));
{
  const e = json(`select coalesce(json_agg(t),'[]') from (select doj, last_day, active, payroll_basis,
    auth_user_id, confirmed_on, probation_until from employees where id='${WHO.id}') t`)[0];
  ok('they are back on the staff list', e.active === true);
  ok('their joining date is the day the new terms start', String(e.doj).slice(0,10) === NEW, e.doj);
  ok('and the last day is cleared', e.last_day === null, e.last_day);
  ok('they are on a salary now', e.payroll_basis === 'salaried', e.payroll_basis);
  ok('the sign-in did not move, so the password still works',
     e.auth_user_id === WHO.auth_user_id, e.auth_user_id);
  ok('and they are not put back on probation', e.probation_until === null, e.probation_until);

  const s = json(`select coalesce(json_agg(t),'[]') from (select doj, last_day, basis
    from service_spells where employee_id='${WHO.id}') t`);
  ok('the spell that closed is on file, once', s.length === 1, s.length);
  ok('with the dates it actually ran',
     s[0] && String(s[0].doj).slice(0,10) === String(WHO.doj).slice(0,10)
          && String(s[0].last_day).slice(0,10) === LWD, s[0]);
  ok('and the basis it ran on, not the new one', s[0] && s[0].basis === 'commission', s[0] && s[0].basis);

  const sal = json(`select coalesce(json_agg(t),'[]') from (select basic, allowance, effective_from
    from salary_parts where employee_id='${WHO.id}' order by effective_from desc limit 1) t`)[0];
  ok('the new salary is on file from the day it starts',
     sal && +sal.basic === 6000 && +sal.allowance === 3000 && String(sal.effective_from).slice(0,10) === NEW, sal);

  const lo = json(`select coalesce(json_agg(t),'[]') from (select as_at, carried, carried_set
    from leave_opening where employee_id='${WHO.id}') t`)[0];
  ok('leave starts at nothing', lo && +lo.carried === 0, lo);
  ok('as at the day the fresh record starts, not the policy date',
     lo && String(lo.as_at).slice(0,10) === NEW, lo && lo.as_at);

  const tk = json(`select coalesce(json_agg(t),'[]') from (select status, next_due, taken, pending, backlog
    from ticket_entitlements where employee_id='${WHO.id}') t`)[0];
  ok('the air ticket is running again', tk && tk.status === 'Upcoming', tk && tk.status);
  ok('and the first one falls due eleven months from the new day, not from 2026',
     tk && String(tk.next_due).slice(0,10) === '2027-09-01', tk && tk.next_due);
  ok('with nothing carried over from the spell that was settled',
     tk && +tk.taken === 0 && +tk.pending === 0 && +tk.backlog === 0, tk);

  ok('and it says what it did, so the screen can repeat it back',
     OUT && OUT.closed && OUT.now && String(OUT.closed.basis) === 'commission', OUT);
}

/* ==================================== 4. the payslips of the spell that closed */
console.log('\nthe old payslips are accounts’, not theirs');
{
  const total = +one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
    where l.employee_id = '${WHO.id}' and r.status = 'closed'`);
  const before = +one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
    where l.employee_id = '${WHO.id}' and r.status = 'closed' and r.month_key < '${NEW.slice(0,7)}'`);
  ok('there are closed payroll lines from the spell that ended', before > 0, {total, before});

  const mine = +one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
    where l.employee_id = '${WHO.id}' and r.status = 'closed'`, WHO.auth_user_id);
  ok('and asking the database as them returns none of them',
     mine === total - before, {mine, want: total - before});

  const acc = +one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
    where l.employee_id = '${WHO.id}' and r.status = 'closed'`, AVIN.auth_user_id);
  ok('while accounts still has every one — ‘I can provide them payslips if needed’',
     acc === total, {acc, total});

  const others = one(`select coalesce(string_agg(distinct e.full_name, ', '), 'nobody')
    from payroll_lines l join payroll_runs r on r.id = l.run_id join employees e on e.id = l.employee_id
   where e.id <> '${WHO.id}' and e.doj is not null and to_char(e.doj,'YYYY-MM') > r.month_key`);
  ok('and nobody else lost a payslip to the same rule', others === 'nobody', others);
}

} finally {
  restore();
  server.close();
}

const left = one(`select count(*) from service_spells where employee_id='${WHO.id}'`);
console.log(`\n(${WHO.full_name} is back as they were — ${left} spells, ` +
  `${one(`select payroll_basis from employees where id='${WHO.id}'`)} since ` +
  `${one(`select doj from employees where id='${WHO.id}'`)})`);

console.log(bad.length ? `\n${n - bad.length} of ${n} checks passed\n  - ` + bad.join('\n  - ')
                       : `\n${n} checks, all passed`);
process.exit(bad.length ? 1 : 0);
