/* Who is on a scheme, worked out rather than listed.
 *
 *   'Mukhamad and Fakriddin has no air ticket as well'
 *   'Its commission basis - so no air ticket'
 *   'Janine - remote working / Sayyora - remote working'
 *   'Yes, its same, if commission then no gratuity'
 *   'The date they changed'                                           -- Avin
 *
 * Two settings entries held lists of staff BY NAME — no gratuity, no air
 * ticket. They were not facts but conclusions somebody had written down from
 * facts the portal already held, and a written conclusion drifts away from the
 * fact it came from. Three people were carrying live entitlements due in
 * January, February and March that nobody could have taken away, because no
 * screen and no function could stop an entitlement at all.
 *
 * The lists are gone. Both answers are derived, in the database and on the
 * screen, from the same two facts.
 *
 * What has to stay true:
 *
 *   1. the derivation returns exactly the eight and the six Avin wrote out,
 *      and it is pinned BY NAME, so drift is a failure and not a shrug;
 *   2. the rule lives in the database, not only on the screen — asking the
 *      database directly gives the same answer;
 *   3. Based can be changed, which it never could be, and changing it starts
 *      or stops the air ticket from THAT DAY rather than from their joining
 *      date;
 *   4. stopping keeps what was already earned — backlog does not lapse;
 *   5. a remote or commission joiner never gets an entitlement created;
 *   6. the screen says what the change will do before it is written;
 *   7. nothing reads the two lists any more.
 *
 *   node scripts/checkscheme.mjs
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
const T = {companies:'companies', employees:'staff_directory', private:'employee_private',
 roles:'employee_roles', opening:'leave_opening', requests:'leave_requests', away:'away_board',
 attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts',
 payroll_identity:'payroll_identity', payroll_runs:'payroll_runs', payroll_lines:'payroll_lines',
 salary_revisions:'salary_revisions', gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic',
 loans:'loans', letters:'letters', employee_files:'employee_files', company_docs:'company_docs',
 exits:'exits', exit_lines:'exit_lines', tickets:'ticket_entitlements', ticket_history:'ticket_history',
 ticket_rates:'ticket_rates', sales_invoices:'sales_invoices', sales_commission:'sales_commission',
 sales_company:'sales_company', sales_company_mine:'sales_company_mine', sales_bands:'sales_bands', sales_uploads:'sales_uploads',
 sales_team:'sales_team_figures', payment_requests:'payment_requests', payment_files:'payment_files',
 sales_members:'sales_members'};

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

/* The two lists, exactly as he wrote them out. Pinned by name on purpose: if
   the derivation ever stops returning these people, that is the whole point of
   this check and it should shout rather than adapt. */
const NO_TICKET = ['Abdunosir Kadirov', 'Fakhridin Kochkorov', 'Janine Lagumbay',
  'Ma Concecion Bello Viron', 'Miraziz Makhamatzhanov', 'Mukhamad Musulmonkulov',
  'Sayyora Kadirova', 'Umidakhon Gapurova'];
const NO_GRATUITY = ['Abdunosir Kadirov', 'Fakhridin Kochkorov', 'Janine Lagumbay',
  'Miraziz Makhamatzhanov', 'Mukhamad Musulmonkulov', 'Sayyora Kadirova'];

const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];
const asAvin = s => one(`set role authenticated; select set_config('request.jwt.claim.sub','${AVIN.auth_user_id}',false); ` + s);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, tab){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1700, height: 1300}});
  await p.route('**://fonts.*/**', x => x.abort());
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => { window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); },
    [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  await p.evaluate(t => { state.mode = t.con ? 'console' : 'staff'; state.tab = t.id; render(); }, tab);
  await p.waitForTimeout(250);
  return {p, errs};
}

/* ================================== 1 & 2. the two lists, in the database */
console.log('\nthe database works both lists out for itself');
{
  const off = json(`select coalesce(json_agg(t),'[]') from (
    select e.full_name as n, ticket_reason(e.id) as why from employees e
     where e.active and ticket_reason(e.id) is not null order by e.full_name) t`);
  ok('exactly the eight he wrote out, and nobody else',
     JSON.stringify(off.map(x => x.n)) === JSON.stringify(NO_TICKET), off.map(x => x.n));
  ok('each with the reason on it rather than a bare exclusion',
     off.every(x => x.why && x.why.length > 3), off);
  ok('and the reasons are the four the rule knows',
     off.every(x => ['Works remotely','Commission only','Director','Not on payroll'].includes(x.why)),
     [...new Set(off.map(x => x.why))]);

  const nog = json(`select coalesce(json_agg(t),'[]') from (
    select e.full_name as n from employees e where e.active
      and coalesce((select max(s.basic) from salary_parts s where s.employee_id=e.id),0) = 0
    order by e.full_name) t`).map(x => x.n);
  ok('and exactly the six with no gratuity',
     JSON.stringify(nog) === JSON.stringify(NO_GRATUITY), nog);

  ok('nobody is carrying an entitlement they should not be',
     one(`select count(*) from ticket_entitlements t join employees e on e.id=t.employee_id
          where e.active and ticket_reason(e.id) is not null and t.next_due is not null`) === '0',
     json(`select coalesce(json_agg(t),'[]') from (select e.full_name from ticket_entitlements t
       join employees e on e.id=t.employee_id where e.active and ticket_reason(e.id) is not null
       and t.next_due is not null) t`));
  ok('nor missing one they should have',
     one(`select count(*) from employees e where e.active and ticket_reason(e.id) is null
          and not exists (select 1 from ticket_entitlements t where t.employee_id=e.id and t.next_due is not null)`) === '0');

  /* the three this closed, by name — the whole reason the job existed */
  for(const n of ['Mukhamad Musulmonkulov', 'Sayyora Kadirova', 'Fakhridin Kochkorov'])
    ok(`${n} is off the scheme with a reason and no due date`,
       one(`select coalesce(t.status,'-')||'|'||coalesce(t.note,'-')||'|'||coalesce(t.next_due::text,'none')
            from ticket_entitlements t join employees e on e.id=t.employee_id where e.full_name='${n}'`)
       .endsWith('|none'),
       one(`select coalesce(t.status,'-')||'|'||coalesce(t.note,'-')||'|'||coalesce(t.next_due::text,'none')
            from ticket_entitlements t join employees e on e.id=t.employee_id where e.full_name='${n}'`));
}

/* ============================ 3 & 4. changing Based, and what it does */
console.log('\nBased can be changed, and the air ticket follows it from that day');
{
  /* Somebody on the scheme, borrowed and put back exactly. */
  const V = json(`select coalesce(json_agg(t),'[]') from (
    select e.id, e.full_name, e.works_remote, t.status, t.next_due, t.first_due, t.proc_month,
           t.backlog, t.pending, t.taken
      from employees e join ticket_entitlements t on t.employee_id=e.id
     where e.active and ticket_reason(e.id) is null order by e.full_name limit 1) t`)[0];
  ok('there is somebody on the scheme to move', !!V, V);
  /* give them something already earned, so the promise about backlog is tested */
  raw(`update ticket_entitlements set backlog = 2500, pending = 1 where employee_id='${V.id}'`);

  const said = JSON.parse(asAvin(`select correct_joining('${V.id}'::uuid, p_works_remote => true)`));
  ok('accounts can move somebody to remote at all', said.remote === true, said.remote);
  ok('and the answer says the ticket was stopped', (said.ticket || {}).did === 'stopped', said.ticket);
  ok('with the reason written on it, not just a flag',
     one(`select status||' / '||coalesce(note,'-') from ticket_entitlements where employee_id='${V.id}'`)
     === 'Not in the scheme / Works remotely');
  ok('the due date is cleared so they cannot reach a payroll run',
     one(`select coalesce(next_due::text,'none')||'|'||coalesce(proc_month,'none') from ticket_entitlements where employee_id='${V.id}'`)
     === 'none|none');
  ok('but what was already earned is untouched — backlog does not lapse',
     one(`select backlog::text||'|'||pending::text||'|'||taken::text from ticket_entitlements where employee_id='${V.id}'`)
     === '2500.00|1|' + V.taken);

  /* and back again — from today, not from their joining date */
  const back = JSON.parse(asAvin(`select correct_joining('${V.id}'::uuid, p_works_remote => false)`));
  ok('bringing them back starts it again', (back.ticket || {}).did === 'started', back.ticket);
  ok('counted from the day it changed, not from when they joined',
     one(`select next_due::text from ticket_entitlements where employee_id='${V.id}'`)
     === one(`select (current_date + interval '11 months')::date::text`),
     [one(`select next_due::text from ticket_entitlements where employee_id='${V.id}'`),
      one(`select doj::text from employees where id='${V.id}'`)]);
  ok('and the backlog survived the round trip',
     one(`select backlog::text from ticket_entitlements where employee_id='${V.id}'`) === '2500.00');

  raw(`update employees set works_remote=${V.works_remote} where id='${V.id}'`);
  raw(`update ticket_entitlements set status='${V.status}', note=null,
        next_due=${V.next_due ? `'${V.next_due}'` : 'null'},
        first_due=${V.first_due ? `'${V.first_due}'` : 'null'},
        proc_month=${V.proc_month ? `'${V.proc_month}'` : 'null'},
        backlog=${V.backlog}, pending=${V.pending} where employee_id='${V.id}'`);
  /* Compared field by field rather than as one string: the database renders a
     numeric as 4000.00 and the row I captured holds 4000, and a check that
     fails on the formatting of a figure it restored correctly is a check
     nobody will trust the next time it goes red. */
  {
    const now = json(`select coalesce(json_agg(t),'[]') from (
      select e.works_remote, t.status, t.next_due, t.first_due, t.proc_month, t.backlog, t.pending, t.taken
        from employees e join ticket_entitlements t on t.employee_id=e.id where e.id='${V.id}') t`)[0];
    const same = now.works_remote === V.works_remote && now.status === V.status
      && String(now.next_due) === String(V.next_due) && String(now.first_due) === String(V.first_due)
      && now.proc_month === V.proc_month && +now.backlog === +V.backlog
      && +now.pending === +V.pending && +now.taken === +V.taken;
    ok('and the person borrowed for that is exactly as they were', same, {now, was: V});
  }
}

console.log('\nand so does how somebody is paid');
{
  const V = json(`select coalesce(json_agg(t),'[]') from (
    select e.id, e.full_name, coalesce(e.payroll_basis::text,'salaried') basis, t.status, t.next_due, t.first_due, t.proc_month
      from employees e join ticket_entitlements t on t.employee_id=e.id
     where e.active and ticket_reason(e.id) is null order by e.full_name limit 1) t`)[0];
  const said = JSON.parse(asAvin(`select set_payroll_basis('${V.id}'::uuid, 'commission')`));
  ok('putting somebody on commission stops the ticket too',
     (said.ticket || {}).did === 'stopped' && (said.ticket || {}).why === 'Commission only', said.ticket);
  ok('and it is the same one status, with a different reason',
     one(`select status||' / '||coalesce(note,'-') from ticket_entitlements where employee_id='${V.id}'`)
     === 'Not in the scheme / Commission only');
  asAvin(`select set_payroll_basis('${V.id}'::uuid, '${V.basis}')`);
  raw(`update ticket_entitlements set status='${V.status}', note=null,
        next_due=${V.next_due ? `'${V.next_due}'` : 'null'},
        first_due=${V.first_due ? `'${V.first_due}'` : 'null'},
        proc_month=${V.proc_month ? `'${V.proc_month}'` : 'null'} where employee_id='${V.id}'`);
  ok('put back as they were',
     one(`select coalesce(payroll_basis::text,'salaried') from employees where id='${V.id}'`) === V.basis);
}

/* ============================================= 5. a joiner off the scheme */
console.log('\na remote or commission joiner never gets one created');
{
  const made = [];
  for(const [who, extra, why] of [
      ['Zz Remote Test', `p_works_remote => true`, 'Works remotely'],
      ['Zz Commission Test', `p_basis => 'commission'`, 'Commission only'],
      ['Zz Normal Test', `p_works_remote => false`, null]]){
    const r = JSON.parse(asAvin(`select add_employee('${who}', current_date, 'corplex',
      p_country => 'India', p_ticket_rate => 2500, ${extra})`));
    made.push(r.id);
    const has = one(`select count(*) from ticket_entitlements where employee_id='${r.id}'`) === '1';
    if(why) ok(`${who.replace('Zz ','')} gets none at all`, !has && r.ticket === why, {has, said: r.ticket});
    else    ok('but an ordinary joiner still does', has && r.ticket === 'on the scheme', {has, said: r.ticket});
  }
  for(const id of made) raw(`delete from ticket_entitlements where employee_id='${id}';
    delete from leave_opening where employee_id='${id}';
    delete from gratuity_basic where row_id in (select id from gratuity_rows where employee_id='${id}');
    delete from gratuity_rows where employee_id='${id}';
    delete from salary_parts where employee_id='${id}';
    delete from employee_private where employee_id='${id}';
    delete from employees where id='${id}'`);
  ok('and the three test joiners are gone again',
     one(`select count(*) from employees where full_name like 'Zz %'`) === '0');
}

/* ======================================== 6 & 7. the screen says the same */
console.log('\nthe screen gives the same answers, and says what a change will do');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(([wantT, wantG]) => {
    const roll = USERS.map(x => x.name);
    const offT = roll.filter(n => tkReason(n)).sort();
    const offG = roll.filter(n => noGratuity(n)).sort();
    /* the field exists, and it says what it will do */
    state.sr = {who:'Shohruh Karimov', draft:{}, confirm:false, busy:false, done:''}; render();
    const box = document.querySelector('[data-sr="remote"]');
    const opts = box ? [...box.options].map(o => o.text) : [];
    const goes = srSays('remote', 'no', 'yes', 'Shohruh Karimov');
    const comes = srSays('remote', 'yes', 'no', 'Shohruh Karimov');
    const strip = (document.querySelector('.srelse') || {}).textContent || '';
    return {offT, offG, isSelect: !!box && box.tagName === 'SELECT', opts, goes, comes, strip,
            listsRead: JSON.stringify(HR().noGratuity || []) + JSON.stringify(DATA.tickets.excluded || [])};
  }, [NO_TICKET, NO_GRATUITY]);
  ok('the screen names the same eight', JSON.stringify(r.offT) === JSON.stringify(NO_TICKET), r.offT);
  ok('and the same six', JSON.stringify(r.offG) === JSON.stringify(NO_GRATUITY), r.offG);
  ok('Based is a picker of the two things it can be',
     r.isSelect && r.opts.join('|') === 'In the office|Works remotely', r.opts);
  ok('going remote says the ticket stops, and that what was earned stays',
     /stops their air ticket/.test(r.goes) && /stays owed/.test(r.goes), r.goes);
  ok('coming back says it starts again from today, not from joining',
     /starts an air ticket/.test(r.comes) && /counted from today/.test(r.comes), r.comes);
  ok('and the record shows both answers without either being editable there',
     /on the scheme/.test(r.strip) && /accruing on the basic/.test(r.strip), r.strip.slice(0, 120));
  ok('neither list is read any more', r.listsRead === '[][]', r.listsRead);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'tickets', con:true});
  const r = await p.evaluate(() => {
    const t = document.getElementById('view').textContent || '';
    const rows = [...document.querySelectorAll('#view table')]
      .map(x => x.previousElementSibling)
      .filter(Boolean).length;
    return {saysWhy: /Works remotely/.test(t) && /Commission only/.test(t),
            saysOld: /Remote — not eligible/.test(t),
            hasPanel: /Not in the scheme/.test(t)};
  });
  ok('the Air ticket screen lists them with their reasons', r.hasPanel && r.saysWhy, r);
  ok('and the old single-reason status is gone from it', !r.saysOld);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'addstaff', con:true});
  const r = await p.evaluate(async () => {
    const box = document.getElementById('jBased');
    const opts = box ? [...box.options].map(o => o.text) : [];
    box.value = 'remote'; box.dispatchEvent(new Event('change'));
    await new Promise(k => setTimeout(k, 60));
    return {opts, isSelect: !!box,
            warns: /no entitlement is created whatever is chosen here/.test(document.getElementById('view').textContent || '')};
  });
  ok('the joiner form asks where they are based',
     r.isSelect && r.opts.join('|') === 'In the office|Works remotely', r.opts);
  ok('and warns that a remote joiner gets no entitlement whatever country is picked', r.warns);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================================ the record, put straight */
console.log('\nand the records he corrected');
{
  ok('Abdulkhamid has his salary on file at 65/35',
     one(`select s.basic::text||'/'||s.allowance::text from salary_parts s join employees e on e.id=s.employee_id
          where e.full_name='Abdulkhamid Makhamatjanov'
          order by s.effective_from desc limit 1`) === '5850.00/3150.00');
  ok('on one line, not two — 0019 already wrote it',
     one(`select count(*)::text from salary_parts s join employees e on e.id=s.employee_id
          where e.full_name='Abdulkhamid Makhamatjanov' and s.source = 'Salary chart, September 2026'`) === '1');
  ok('Janine has a joining date', one(`select coalesce(doj::text,'none') from employees where full_name='Janine Lagumbay'`) === '2025-02-15');
  ok('and Mukhamad has one', one(`select coalesce(doj::text,'none') from employees where full_name='Mukhamad Musulmonkulov'`) === '2026-02-01');
  ok('the retired end_employment is no longer granted',
     one(`select count(*) from information_schema.routine_privileges where routine_name='end_employment' and grantee='authenticated'`) === '0');
  ok('and the two settings lists are empty',
     one(`select count(*) from settings where key in ('no_gratuity','ticket_excluded') and value <> '[]'::jsonb`) === '0');
}

await b.close(); server.close();
console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
