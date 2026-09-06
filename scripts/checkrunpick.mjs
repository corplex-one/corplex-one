/* The month the selector says, and the settlement you can throw away.
 *
 * Four faults reported in one message:
 *
 *   1. 'Not able view August payroll that is closed. when clicked it shows
 *      september payroll'  — the screen was pinned to the newest run whatever
 *      the selector said. The figures, the status, the buttons AND the key
 *      those buttons act on all have to follow the selection, or the screen
 *      lies in a new way: Approve drawn from August's status, calling
 *      approveRun on September, is worse than what it replaced.
 *   2. Payslips of a closed month were fine — checked here so it stays true.
 *   3. 'Not able to view the settlements in Exit tab - get this back. Work out
 *      a settlement is not required.'
 *   4. 'I had tried the exit process for Abdulkhamid, now i cannot remove it
 *      from draft stage.' — Discard was only ever on the settlement's own
 *      screen, and a draft row has no way of reaching that screen.
 *
 * The two runs this needs do not exist in the seed, so it makes them and
 * clears them away again.
 *
 *   node scripts/checkrunpick.mjs
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
/* psql -tAc echoes the command tag after a RETURNING row, so take the
   first line rather than the lot. */
const one = (s, u) => raw(s, u).trim().split('\n')[0].trim();
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

/* ---- a September draft beside the closed August, and a draft settlement ---- */
const AUG = one(`select month_key from payroll_runs where status='closed' order by month_key desc limit 1`);
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];
const SEP = '2026-09';
/* Left over from a run of this check that did not reach its cleanup. */
raw(`delete from payroll_lines where run_id in (select id from payroll_runs where month_key='${SEP}');
     delete from payroll_runs where month_key='${SEP}';
     delete from exit_lines where exit_id in (select id from exits where reason='test draft');
     delete from exits where reason='test draft'`);
raw(`insert into payroll_runs(month_key, label, status, prepared_by)
     values ('${SEP}', 'September 2026', 'draft', '${AVIN.id}')`);
const madeRun = one(`select id from payroll_runs where month_key='${SEP}'`);
/* Two lines is enough for the totals to be visibly different from August's. */
if(madeRun) raw(`insert into payroll_lines(run_id, employee_id, name, staff_no, company, days, salary, gross, net)
  select '${madeRun}', l.employee_id, l.name, l.staff_no, l.company, l.days,
         l.salary + 1000, l.gross + 1000, l.net + 1000
    from payroll_lines l join payroll_runs r on r.id = l.run_id
   where r.month_key = '${AUG}' and not l.non_staff limit 4`);

const KHAMID = json(`select coalesce(json_agg(t),'[]') from (select id, full_name from employees where full_name like 'Abdulkhamid%') t`)[0];
if(KHAMID) raw(`insert into exits(employee_id, last_day, status, reason)
  values ('${KHAMID.id}', '2026-10-31', 'draft', 'test draft')`);
const madeExit = KHAMID ? one(`select id from exits where reason='test draft'`) : '';

const clean = () => {
  if(madeExit) raw(`delete from exit_lines where exit_id='${madeExit}'; delete from exits where id='${madeExit}'`);
  if(madeRun) raw(`delete from payroll_lines where run_id='${madeRun}'; delete from payroll_runs where id='${madeRun}'`);
};

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});

async function open(name, tab){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
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
  await p.evaluate(t => { state.mode = 'console'; state.tab = t; state.payRun = null; render(); }, tab);
  await p.waitForTimeout(200);
  return {p, errs};
}

try {

/* ============================================ 1. the month the selector says */
console.log('\nMiraziz on Payroll — two runs, one closed and one draft');
{
  const {p, errs} = await open('Miraziz Makhamatzhanov', 'payroll');
  const start = await p.evaluate(() => ({run: state.payRun,
    head: (document.querySelector('#view .strip .stat .k') || {}).textContent || ''}));
  ok('the owner lands on the closed month, not on accounts’ draft',
     start.run === '2026-08' && /August/.test(start.head), start);

  const seg = await p.evaluate(() => [...document.querySelectorAll('#runSeg button')].map(b => b.dataset.run || b.id));
  ok('both months are on the selector', seg.includes('2026-08') && seg.includes('2026-09'), seg);

  // and now the fault itself: click September, then back to August
  const sep = await p.evaluate(async () => {
    document.querySelector('#runSeg button[data-run="2026-09"]').click();
    return {run: state.payRun,
      head: (document.querySelector('#view .strip .stat .k') || {}).textContent || '',
      net: (document.querySelectorAll('#view .strip .stat .v')[0] || {}).textContent || ''};
  });
  ok('clicking September shows September', /September/.test(sep.head), sep.head);

  const aug = await p.evaluate(async () => {
    document.querySelector('#runSeg button[data-run="2026-08"]').click();
    return {run: state.payRun,
      head: (document.querySelector('#view .strip .stat .k') || {}).textContent || '',
      net: (document.querySelectorAll('#view .strip .stat .v')[0] || {}).textContent || '',
      pills: [...document.querySelectorAll('#view .pill')].map(x => x.textContent.trim())};
  });
  ok('and clicking back to August shows August — the reported fault',
     /August/.test(aug.head), aug.head);
  ok('with August’s own figures, not September’s',
     aug.net !== sep.net, {august: aug.net, september: sep.net});
  ok('and August’s own status', aug.pills.some(x => /Paid|released/i.test(x)), aug.pills.slice(0, 4));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand the buttons act on the month they were drawn for');
{
  const {p, errs} = await open('Avin Mascarenhas', 'payroll');
  const r = await p.evaluate(() => {
    // accounts starts on the draft; move to August and read what RUNKEY sees
    state.payRun = '2026-08'; render();
    const g = document.getElementById('payGenTop') || document.getElementById('payGen');
    return {run: state.payRun,
            head: (document.querySelector('#view .strip .stat .k') || {}).textContent || ''};
  });
  ok('accounts can read the closed month too', /August/.test(r.head), r.head);
  const src = fs.readFileSync('web/app.js', 'utf8');
  ok('a payroll action takes the selected month, not the newest',
     src.includes('const RUNKEY = () => state.payRun || DATA.payroll.monthKey;'));
  ok('and so does Refresh from the records',
     !/generateRun\(DATA\.payroll\.monthKey\)/.test(src));
  ok('accounts still lands on the draft it is working on',
     await p.evaluate(() => { state.payRun = null; render(); return state.payRun; }) === '2026-09');
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================================ 2. payslips of a closed month */
console.log('\npayslips of the closed month still open');
{
  const {p, errs} = await open('Miraziz Makhamatzhanov', 'payslips');
  const r = await p.evaluate(() => ({
    rows: document.querySelectorAll('#view table tbody tr').length,
    on: ([...document.querySelectorAll('#runSeg button')]
          .find(b => b.getAttribute('aria-pressed') === 'true') || {}).dataset,
    text: (document.getElementById('view') || {}).textContent || ''}));
  ok('the payslip list is there', r.rows > 0, r.rows);
  ok('and it opens on the closed month, not on accounts’ draft',
     r.on && r.on.run === '2026-08', r.on);
  ok('which is the one the payroll screen would have started him on',
     /Aug 2026 . closed/.test(r.text.replace(/\s+/g, ' ')), r.text.slice(0, 200));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================================= 3 & 4. the settlements list */
console.log('\nMiraziz on Exits — the list back, without the calculator');
{
  const {p, errs} = await open('Miraziz Makhamatzhanov', 'exits');
  const r = await p.evaluate(() => {
    const t = (document.getElementById('view') || {}).textContent || '';
    return {inRail: [...document.querySelectorAll('[data-ctab]')].map(b => b.dataset.ctab).includes('exits'),
            calc: /Work out a settlement/.test(t),
            list: /Settlements/.test(t),
            drafts: [...document.querySelectorAll('#view tbody tr')]
                      .filter(tr => /Draft/i.test(tr.textContent)).length,
            kill: document.querySelectorAll('#view [data-exkill]').length,
            open: document.querySelectorAll('#view [data-exopen]').length,
            text: t};
  });
  ok('the Exits tab is back in his console', r.inRail);
  ok('the settlements list is on it', r.list);
  ok('the settlement calculator is not — he asked for it not to be', !r.calc);
  ok('a draft is not shown to him — it has been sent to nobody', r.drafts === 0, r.drafts);
  ok('and he is told one is being worked out rather than left to wonder',
     /still\s+being worked out/.test(r.text.replace(/\s+/g, ' ')));
  ok('nothing on the page lets him discard accounts’ draft', r.kill === 0);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nAvin on Exits — a draft can be thrown away');
{
  const {p, errs} = await open('Avin Mascarenhas', 'exits');
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('#view tbody tr')];
    const draft = rows.find(tr => /Draft/i.test(tr.textContent));
    return {calc: /Work out a settlement/.test((document.getElementById('view') || {}).textContent || ''),
            draftRow: !!draft,
            who: draft ? draft.children[0].textContent.trim() : '',
            btns: draft ? [...draft.querySelectorAll('button')].map(b => b.textContent.trim()) : [],
            kill: draft ? !!draft.querySelector('[data-exkill]') : false};
  });
  ok('accounts still has the calculator', r.calc);
  ok('the draft settlement is on the list', r.draftRow && /Abdulkhamid/.test(r.who), r.who);
  ok('with Edit, Initiate and Discard — the reported gap',
     r.btns.join('|') === 'Edit|Initiate exit process|Discard', r.btns);
  ok('and Discard is the button the withdraw handler is already bound to', r.kill);

  // it really reaches the database, and asks first
  const said = await p.evaluate(async () => {
    window.confirm = () => true;
    document.querySelector('#view [data-exkill]').click();
    await new Promise(r => setTimeout(r, 120));
    return window.__saw.filter(x => x[0] === 'withdrawExit');
  });
  ok('pressing it calls exit_withdraw for that settlement', said.length === 1, said);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

} finally {
  await b.close(); server.close(); clean();
  console.log('\n(the September run and the draft settlement this check invented are cleared away)');
}

console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
