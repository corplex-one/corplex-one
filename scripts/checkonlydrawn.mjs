/* Send a browser what the screen draws, and nothing else.
 *
 *   1. 'Hide those things'
 *   3. 'No way - This should not be allowed, employees should just know if
 *       their colleague is at work or away. Timings are not needed'   -- Avin
 *
 * Two tables were readable in full by every signed-in person, and neither was a
 * decision anybody made — the app asked for the staff list and the attendance
 * list, and the database handed over every column of both.
 *
 * The staff list had to stay shared: People, the org chart, the birthday list
 * and the away board are all built from it. So the fix is a view, and four
 * columns no screen draws are answered only for accounts, the owner, or the
 * person themselves — the visa company, who pays them, the payroll basis, and
 * the auth id.
 *
 * Attendance is the same shape. The STATUS is what the portal shows about other
 * people: a fortnight strip of in the office / from home / on leave, and a
 * count of who is working from home today. None of that needs a clock, so the
 * status went on a view with no times and the table itself closed.
 *
 * What has to stay true:
 *
 *   1. a consultant's browser holds the roster, and the four columns come back
 *      empty for everybody but themselves;
 *   2. accounts and the owner still get all four, because the console draws them;
 *   3. a consultant cannot read a colleague's check-in time, check-out time,
 *      location or note — by any route, including asking the database directly;
 *   4. but every screen that shows a colleague's STATUS still draws: the
 *      fortnight strip, who is working from home, and the card on People;
 *   5. a person and their manager and accounts still see the times they always did;
 *   6. the portal opens if 0025 has not been run yet.
 *
 *   node scripts/checkonlydrawn.mjs
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

/* The roster is a view now, and attendance arrives twice — in full for the
   people this person may see, and as a status for everybody else. */
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

/* Somebody with no reports and no console role — the person with the least
   reason to see anything, chosen by asking rather than by name. */
const PLAIN = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
   where e.active and e.auth_user_id is not null
     and not exists (select 1 from employee_roles r where r.employee_id=e.id and r.role in ('accounts','owner'))
     and not exists (select 1 from employees x where x.manager_id=e.id)
   order by e.full_name limit 1) t`)[0];
const MGR = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
   where e.active and e.auth_user_id is not null
     and not exists (select 1 from employee_roles r where r.employee_id=e.id and r.role in ('accounts','owner'))
     and exists (select 1 from employees x where x.manager_id=e.id)
   order by e.full_name limit 1) t`)[0];
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];

const bundle = (U, drop) => {
  const cols = Object.entries(T).filter(([k]) => k !== drop);
  return json(`select coalesce(json_agg(t),'[]') from (select ` +
    cols.map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
    U.auth_user_id)[0];
};

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(U, tab, drop){
  const db = bundle(U, drop);
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...db}, U.id);
  const p = await b.newPage({viewport: {width: 1700, height: 1200}});
  await p.route('**://fonts.*/**', x => x.abort());
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => async () => true});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); },
    [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  await p.evaluate(t => { state.mode = t.con ? 'console' : 'staff'; state.tab = t.id; render(); }, tab);
  await p.waitForTimeout(250);
  return {p, errs, db, D};
}

/* =============================== 1. the four columns that used to ride along */
console.log('\nthe staff list carries only what the portal draws');
{
  const db = bundle(PLAIN);
  const others = db.employees.filter(e => e.id !== PLAIN.id);
  ok('a consultant still gets the whole roster', db.employees.length > 20, db.employees.length);
  ok('and their own row is complete',
     !!(db.employees.find(e => e.id === PLAIN.id) || {}).visa_company);

  const leaks = k => others.filter(e => e[k] !== null && e[k] !== undefined).length;
  ok('nobody else\'s visa company comes with it', leaks('visa_company') === 0, leaks('visa_company'));
  ok('nor who pays them', leaks('paid_by') === 0, leaks('paid_by'));
  ok('nor whether they are salaried, on commission or off payroll',
     leaks('payroll_basis') === 0, leaks('payroll_basis'));
  ok('and the sign-in flag is answered for nobody at all',
     db.employees.filter(e => e.signed_in !== null && e.signed_in !== undefined).length === 0);
  ok('the auth id is not on the roster at all',
     !('auth_user_id' in (db.employees[0] || {})), Object.keys(db.employees[0] || {}).join(','));

  /* and the table underneath is shut, so there is no second way to ask */
  ok('asking the staff table directly returns only their own row',
     one(`select count(*) from employees`, PLAIN.auth_user_id) === '1');
}

console.log('\nbut accounts still gets all four, because the console draws them');
{
  const db = bundle(AVIN);
  const has = k => db.employees.filter(e => e[k] !== null && e[k] !== undefined).length;
  ok('every visa company', has('visa_company') === db.employees.length, [has('visa_company'), db.employees.length]);
  ok('every paid-from', has('paid_by') > 20, has('paid_by'));
  ok('every payroll basis', has('payroll_basis') === db.employees.length, has('payroll_basis'));
  ok('and who has signed in', has('signed_in') === db.employees.length, has('signed_in'));
}

console.log('\nand Staff Records still works off it');
{
  const {p, errs, D} = await open(AVIN, {id:'staffrec', con:true});
  const r = await p.evaluate(() => {
    const who = USERS.map(x => x.name).find(n => (HR().signedIn || {})[n] && n !== state.user);
    state.sr = {who, draft:{}, confirm:false, busy:false, done:''}; render();
    return {who, visa: (document.querySelector('[data-sr="visa"]') || {}).value,
            paid: (document.querySelector('[data-sr="paidBy"]') || {}).value,
            emailOff: (document.querySelector('[data-sr="email"]') || {}).disabled};
  });
  ok('the visa and paid-from pickers are filled', !!r.visa && !!r.paid, r);
  ok('and it still knows who has signed in, without holding their auth id',
     r.emailOff === true, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================= 3. a colleague's status, without the clock */
console.log('\na colleague is at work or away, and that is all');
{
  ok('a consultant cannot read a colleague\'s attendance row at all',
     one(`select count(*) from attendance where employee_id <> '${PLAIN.id}'`, PLAIN.auth_user_id) === '0');
  ok('nor the location it came from',
     one(`select count(*) from attendance_where w join attendance a on a.id=w.attendance_id
          where a.employee_id <> '${PLAIN.id}'`, PLAIN.auth_user_id) === '0');
  ok('the public board carries no time column at all',
     one(`select count(*) from information_schema.columns
          where table_name='attendance_public'
            and column_name in ('in_at','out_at','location','note')`) === '0');
  ok('what it does carry is who, when and which kind',
     one(`select string_agg(column_name, ',' order by ordinal_position)
          from information_schema.columns where table_name='attendance_public'`)
     === 'employee_id,on_date,kind,segments');

  const db = bundle(PLAIN);
  const mine = db.attendance.filter(a => a.employee_id === PLAIN.id).length;
  ok('their own days still arrive with the times on them',
     db.attendance.length === mine, [db.attendance.length, mine]);
}

console.log('\nand nothing on screen lost the status');
{
  /* Built with a day on file for somebody else, so the strip has something to
     draw. Put back exactly as it was afterwards. */
  const OTHER = json(`select coalesce(json_agg(t),'[]') from (
    select id, full_name from employees where active and id <> '${PLAIN.id}'
      and no_attendance is not true order by full_name limit 1) t`)[0];
  /* A weekday, because dayStatus answers 'Weekend' before it ever looks at an
     attendance row and this check is about the row. */
  const today = one(`select max(d)::date::text from generate_series(current_date - 10, current_date, '1 day') d
                      where extract(isodow from d) < 6`);
  raw(`insert into attendance(employee_id, on_date, kind, in_at, out_at, location)
       values ('${OTHER.id}', '${today}', 'Office', '08:34', '17:31', 'Office')`);
  try{
    const {p, errs, D} = await open(PLAIN, {id:'people'});
    const r = await p.evaluate(([them, d]) => {
      const day = HR().attendance.find(a => a.who === them && a.d === d);
      const st = dayStatus(them, d);
      state.who = them; render();
      const card = document.getElementById('view').textContent || '';
      return {day, k: st.k, label: st.label,
              /* the exact times that were written — if either reaches the card,
                 the clock is still being shared */
              saysIn: card.includes('08:34'), saysOut: card.includes('17:31'),
              drewCard: /All people/.test(card),
              /* and the fortnight strip still colours that day for them */
              strip: [...document.querySelectorAll('.availtable td.av')]
                .some(td => /In the office/.test(td.getAttribute('title') || ''))};
    }, [OTHER.full_name, today]);
    ok('the day is there, with a count instead of segments',
       r.day && r.day.segs.length === 0 && r.day.shown === 1, r.day);
    ok('and it still reads as a day in the office', r.k === 'Office', [r.k, r.label]);
    ok('their card draws', r.drewCard);
    ok('but it no longer prints when they arrived or left',
       !r.saysIn && !r.saysOut, [r.saysIn, r.saysOut]);
    ok('no page errors', !errs.length, errs[0]);
    await p.close();

    /* their manager, and accounts, keep the times */
    const boss = json(`select coalesce(json_agg(t),'[]') from (
      select m.id, m.auth_user_id, m.full_name from employees e join employees m on m.id=e.manager_id
       where e.id='${OTHER.id}' and m.auth_user_id is not null) t`)[0];
    if(boss){
      const {p: p2, errs: e2} = await open(boss, {id:'people'});
      const r2 = await p2.evaluate(([them, d]) => {
        const day = HR().attendance.find(a => a.who === them && a.d === d);
        return {segs: day ? day.segs.length : 0, first: day && day.segs[0] ? day.segs[0].in : ''};
      }, [OTHER.full_name, today]);
      ok('their manager still sees the times', r2.segs === 1 && r2.first === '08:34', r2);
      ok('no page errors', !e2.length, e2[0]);
      await p2.close();
    }
    const {p: p3, errs: e3} = await open(AVIN, {id:'hradmin', con:true});
    const r3 = await p3.evaluate(([them, d]) => {
      const day = HR().attendance.find(a => a.who === them && a.d === d);
      return {segs: day ? day.segs.length : 0, first: day && day.segs[0] ? day.segs[0].in : ''};
    }, [OTHER.full_name, today]);
    ok('and so does accounts', r3.segs === 1 && r3.first === '08:34', r3);
    ok('no page errors', !e3.length, e3[0]);
    await p3.close();
  } finally {
    raw(`delete from attendance where employee_id='${OTHER.id}' and on_date='${today}' and location='Office' and in_at='08:34'`);
    ok('the day borrowed for that test has been put back',
       one(`select count(*) from attendance where employee_id='${OTHER.id}' and on_date='${today}'`) === '0');
  }
}

/* ============= 5b. the three private boxes are not drawn for a colleague */
console.log('\nand the boxes a colleague cannot read are not drawn at all');
{
  /* Avin: 'Does employee get to see the where they leave, back home, in an
     emergency of a colleague?' They never could — those three are built from
     employee_private, which answers only the person and accounts. But they
     were DRAWN, empty, saying 'Nothing on file yet', with a line underneath
     announcing how much of the profile was still to go. For somebody who had
     filled it in, both statements were false, and stated about them to the
     whole company. 'Of course 3': the boxes go. */
  const SOMEBODY = json(`select coalesce(json_agg(t),'[]') from (
    select id, full_name from employees where active and id <> '${PLAIN.id}'
      and auth_user_id is not null order by full_name limit 1) t`)[0];
  const was = json(`select coalesce(json_agg(t),'[]') from (
    select uae_address, personal_email, home_address, ec_name, ec_relation
      from employee_private where employee_id = '${SOMEBODY.id}') t`)[0] || null;
  raw(`update employee_private set uae_address='Flat 1203, Al Nahda 2, Dubai',
        personal_email='someone@example.com', home_address='Tashkent, Uzbekistan',
        ec_name='Next Of Kin', ec_relation='Wife' where employee_id='${SOMEBODY.id}'`);
  try{
    const look = async U => {
      const {p, errs} = await open(U, {id:'people'});
      const r = await p.evaluate(([them]) => { state.who = them; render();
        const t = document.getElementById('view').textContent || '';
        return {heads: [...document.querySelectorAll('#view h3')].map(h => h.textContent.trim()),
                addr: t.includes('Al Nahda'), kin: t.includes('Next Of Kin'),
                empty: /Nothing on file yet/.test(t),
                counts: /has not filled in a profile yet/.test(t)};
      }, [SOMEBODY.full_name]);
      await p.close(); return Object.assign(r, {errs});
    };
    const them = await look(PLAIN);
    ok('a colleague is not shown the three headings',
       !them.heads.includes('Where they live') && !them.heads.includes('Back home')
       && !them.heads.includes('In an emergency'), them.heads);
    ok('nor an empty box in their place', !them.empty, them.empty);
    ok('nor a count of what that person has still to fill in', !them.counts, them.counts);
    ok('and of course none of the contents', !them.addr && !them.kin, them);
    ok('the three work boxes are still there',
       them.heads.includes('How to reach them') && them.heads.includes('Where they sit')
       && them.heads.includes('Good to know'), them.heads);
    ok('no page errors', !them.errs.length, them.errs[0]);

    const acct = await look(AVIN);
    ok('accounts still gets all six boxes',
       acct.heads.includes('Where they live') && acct.heads.includes('In an emergency'), acct.heads);
    ok('with the address and the next of kin on them', acct.addr && acct.kin, acct);
    ok('no page errors', !acct.errs.length, acct.errs[0]);
  } finally {
    raw(`update employee_private set
           uae_address    = ${was && was.uae_address    ? `'${was.uae_address}'`    : 'null'},
           personal_email = ${was && was.personal_email ? `'${was.personal_email}'` : 'null'},
           home_address   = ${was && was.home_address   ? `'${was.home_address}'`   : 'null'},
           ec_name        = ${was && was.ec_name        ? `'${was.ec_name}'`        : 'null'},
           ec_relation    = ${was && was.ec_relation    ? `'${was.ec_relation}'`    : 'null'}
         where employee_id='${SOMEBODY.id}'`);
    ok('the record borrowed for that test is exactly as it was',
       one(`select count(*) from employee_private where employee_id='${SOMEBODY.id}'
            and coalesce(uae_address,'')=${was && was.uae_address ? `'${was.uae_address}'` : `''`}
            and coalesce(ec_name,'')=${was && was.ec_name ? `'${was.ec_name}'` : `''`}`) === '1');
  }
}

/* ============================================ 6. the migration not yet run */
console.log('\nand a portal deployed before 0025 is run still opens');
{
  const {p, errs} = await open(PLAIN, {id:'people'}, 'attendance_public');
  const r = await p.evaluate(() => ({
    open: !document.getElementById('app').classList.contains('hidden'),
    drew: (document.getElementById('view').textContent || '').length}));
  ok('with no public attendance board at all', r.open && r.drew > 200, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  const boot = fs.readFileSync('web/boot.js', 'utf8');
  ok('the roster is read from the view', /employees:\s*\['staff_directory'/.test(boot));
  ok('and both new reads are optional, so a deploy before the migration is safe',
     /employees:\s*\['staff_directory',\s*null,\s*true\]/.test(boot)
     && /attendance_public:\s*\['attendance_public',\s*null,\s*true\]/.test(boot));
  ok('with a fallback to the table for exactly that window',
     /if\(!out\.employees\.length\) out\.employees = await readAll\('employees'/.test(boot));
}

await b.close(); server.close();
console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
