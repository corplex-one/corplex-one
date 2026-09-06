/* A revision letter, and the month it is supposed to show up in.
 *
 *   'I sent letter of salary revision to Nissa - It went from my console.
 *    But never reached payroll as i cannot open September run'
 *
 * Both halves of that were true. The revision worked; the button that was
 * supposed to open the next month set state.payRun to the string 'sep', which
 * is not the key of any run — they are keyed '2026-09' — so the payroll
 * screen fell through its own guard and put him back on the month he was
 * already looking at. Nothing happened and there was no error to go on.
 *
 * So this walks the whole chain, because the interesting part is not the
 * button but the order of events:
 *
 *   1. a released revision moves the salary from its effective date;
 *   2. it does NOT reach into a month that has already been generated —
 *      that is on purpose, and worth pinning down so nobody "fixes" it;
 *   3. generating the next month reads the new salary and pays it;
 *   4. and the button that generates it now calls the database.
 *
 *   node scripts/checknextrun.mjs
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
 sales_bands:'sales_bands', sales_uploads:'sales_uploads',
 payment_requests:'payment_requests', payment_files:'payment_files'};

const bad = []; let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };

const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id, auth_user_id, full_name
  from employees where full_name = 'Avin Mascarenhas') t`)[0];

/* Somebody on a plain monthly salary, so the line is the salary rather than
 * commission arithmetic. */
const P = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.full_name, s.salary, s.basic, s.allowance
    from employees e join salary_parts s on s.employee_id = e.id
   where e.active and e.payroll_basis = 'salaried' and s.salary > 0
     and e.last_day is null and e.doj is not null and e.id <> '${AVIN.id}'
     /* Ignore anything a previous run of this check issued: it clears those
        rows below, and picking the person off one of them would read their
        salary as the figure this check itself invented. */
     and coalesce(s.source,'') not like 'Revision letter%'
     and s.effective_from = (select max(x.effective_from) from salary_parts x
                              where x.employee_id = e.id
                                and coalesce(x.source,'') not like 'Revision letter%')
   order by e.full_name limit 1) t`)[0];

/* Where the payroll is now, and the month after it. */
const LAST = one(`select month_key from payroll_runs order by month_key desc limit 1`);
const NEXT = (() => { const [y, m] = LAST.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; })();

console.log(`\n${P.full_name} on ${P.salary}; last run ${LAST}, next ${NEXT}\n`);
/* The generator leaves out anybody who has left, so the fixture asserts the
 * person it picked is one it will include. Without this the check goes red
 * for a reason that has nothing to do with what it is testing. */
ok('the person tested is one the generator will include',
   one(`select count(*) from employees where id = '${P.id}' and payroll_basis <> 'off'
          and (last_day is null or last_day >= '${NEXT}-01'::date)
          and (doj is null or doj <= ('${NEXT}-01'::date + interval '1 month - 1 day'))`) === '1',
   P.full_name);

// start from a clean slate for this person
raw(`delete from payroll_runs where month_key = '${NEXT}'`);
raw(`delete from salary_parts where employee_id = '${P.id}' and source like 'Revision letter%'`);
raw(`delete from salary_revisions where employee_id = '${P.id}'`);
raw(`delete from letters where employee_id = '${P.id}' and kind = 'revision'`);

const SEQ = one(`select last_value from letter_ref_seq`);
/* What the last closed month pays this person, before anything is issued.
 * It is not necessarily today's salary — they may have been raised since, or
 * joined part-way through — so the assertion later is that this figure does
 * not move, not that it equals anything in particular. */
const WAS = one(`select l.salary from payroll_lines l join payroll_runs r on r.id = l.run_id
   where r.month_key = '${LAST}' and l.employee_id = '${P.id}'`);

// --------------------------------------------------- the draft, then the send
console.log('the revision itself:\n');
const NEWB = Math.round(+P.basic + 1000), NEWA = Math.round(+P.allowance);
const draft = JSON.parse(one(`select issue_revision('${P.id}', ${NEWB}, ${NEWA},
  '${NEXT}-01'::date, 'Annual review', '', 'revision', false)`, AVIN.auth_user_id));
ok('a draft is written and numbered', /^LT-\d+$/.test(draft.ref), draft.ref);
ok('and it is a draft, not an issued letter', draft.status === 'draft', draft.status);
ok('the salary has NOT moved yet',
   one(`select count(*) from salary_parts where employee_id = '${P.id}'
          and source = 'Revision letter ${draft.ref}'`) === '0');
ok('and the letter is Pending rather than Issued',
   one(`select status from letters where ref = '${draft.ref}'`) === 'Pending');

const REVID = one(`select id from salary_revisions where letter_ref = '${draft.ref}'`);
JSON.parse(one(`select release_revision('${REVID}')`, AVIN.auth_user_id));
ok('sending it moves the salary',
   +one(`select salary from salary_parts where employee_id = '${P.id}'
          and source = 'Revision letter ${draft.ref}'`) === NEWB + NEWA,
   one(`select coalesce(salary::text,'-') from salary_parts where employee_id = '${P.id}'
          and source = 'Revision letter ${draft.ref}'`));
ok('from the date it takes effect, not from today',
   one(`select effective_from::text from salary_parts where employee_id = '${P.id}'
          and source = 'Revision letter ${draft.ref}'`) === `${NEXT}-01`);
ok('the letter goes out',
   one(`select status from letters where ref = '${draft.ref}'`) === 'Issued');
ok('and the old figures are kept on the revision, so it can be undone',
   +one(`select old_salary from salary_revisions where id = '${REVID}'`) === +P.salary,
   one(`select old_salary from salary_revisions where id = '${REVID}'`));

/* The half Avin could not see, and the half that matters most: a month that
 * has already been generated does not move under him. */
console.log('');
ok(`the ${LAST} run does not move under a revision dated ${NEXT}`,
   one(`select l.salary from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${LAST}' and l.employee_id = '${P.id}'`) === WAS,
   {was: WAS, now: one(`select l.salary from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${LAST}' and l.employee_id = '${P.id}'`)});

// ------------------------------------------------------- generating the month
console.log('\nopening the next month:\n');
const made = JSON.parse(one(`select generate_run('${NEXT}', null)`, AVIN.auth_user_id));
ok('the month can be generated', !!made, made);
ok('it starts as a draft',
   one(`select status from payroll_runs where month_key = '${NEXT}'`) === 'draft');
ok('and the new salary is on the line — which is what "reaching payroll" means',
   +one(`select l.salary from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${NEXT}' and l.employee_id = '${P.id}'`) === NEWB + NEWA,
   one(`select coalesce(l.salary::text,'-') from payroll_lines l join payroll_runs r on r.id = l.run_id
        where r.month_key = '${NEXT}' and l.employee_id = '${P.id}'`));

// ------------------------------------------------------------------ the screen
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
  const page = await b.newPage({viewport: {width: 1500, height: 1100}});
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
  if(setup){ await page.evaluate(setup); await page.waitForTimeout(350); }
  return page;
}

console.log('\nthe payroll screen, with two months in it:\n');
let p = await open(`state.mode='console'; state.tab='payroll'; render();`);
ok('both months are on the switcher',
   await p.evaluate(() => {
     const seg = document.getElementById('runSeg'); if(!seg) return null;
     return [...seg.querySelectorAll('[data-run]')].map(x => x.dataset.run);
   }).then(v => !!v && v.includes(LAST) && v.includes(NEXT), undefined));
ok('the new month can be opened from it',
   await p.evaluate(k => !!document.querySelector(`[data-run="${k}"]`), NEXT));
ok('and there is no chip offering a month while one is still open',
   await p.evaluate(() => !document.getElementById('payNext')));
await p.close();

/* And with the next month cleared away again: the button is offered, and it
 * calls the database instead of setting a key that matches nothing. */
raw(`delete from payroll_runs where month_key = '${NEXT}'`);
p = await open(`state.mode='console'; state.tab='payroll'; render();`);
/* Two ways in, both wired to the same thing: a chip on the month switcher,
   and a button on the closed month itself. */
ok('with every month closed, the next one is offered',
   await p.evaluate(() => !!document.getElementById('payNext')
     && !!document.getElementById('payNextBtn')));
ok('named as the month it will build',
   await p.evaluate(k => {
     const t = (document.getElementById('payNextBtn') || {}).textContent || '';
     return t.includes(MKEY(k)); }, NEXT));
await p.evaluate(() => document.getElementById('payNext').click());
await p.waitForTimeout(300);
const call = await p.evaluate(() => (window.__saw || []).find(x => x[0] === 'generateRun'));
ok('pressing it generates the month', !!call,
   await p.evaluate(() => (window.__saw||[]).map(x => x[0])));
ok('for the right month, not for a made-up key',
   !!call && call[1] === NEXT, call && call[1]);
await p.close();

/* The dead screen it used to land on. */
console.log('');
const APP = fs.readFileSync('web/app.js', 'utf8');
ok('the prototype September screen is not in the bundle', !APP.includes('function vPayrollNext'));
ok('nor the counter that drove it', !/state\.sepStage\s*=/.test(APP));
ok('nor the month that was written into the page', !APP.includes('NEXTRUN'));
ok('and no button sets a run key that matches no run',
   !/state\.payRun\s*=\s*'sep'/.test(APP));

// ------------------------------------------------------------------- cleanup
raw(`delete from payroll_runs where month_key = '${NEXT}'`);
raw(`delete from salary_parts where employee_id = '${P.id}' and source like 'Revision letter%'`);
raw(`delete from salary_revisions where employee_id = '${P.id}'`);
raw(`delete from letters where employee_id = '${P.id}' and kind = 'revision'`);
raw(`select setval('letter_ref_seq', ${SEQ}, true)`);

await b.close(); server.close();
console.log(`\n${n - bad.length}/${n} passed`);
if(bad.length){ console.log('\n' + bad.map(x => '  - ' + x).join('\n')); process.exit(1); }
