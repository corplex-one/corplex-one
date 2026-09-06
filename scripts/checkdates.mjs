/* Typing a year into a date box.
 *
 *   'While typing dates manually, it does not allow to type year. If i start
 *    with 2, it ends up as 0002 and just remains static. This remains
 *    everywhere specially next to documents'                          -- Avin
 *
 * A date input fires `change` as soon as its three segments make a valid date,
 * and typing a year one digit at a time makes four of them: 0002, 0020, 0202,
 * 2026. Every handler in the portal treated the first as the answer — saved
 * it, re-rendered, and took the focus away with the input it replaced. The
 * remaining three digits fell on the floor.
 *
 * He said 'specially next to documents', but the fault was never about that
 * page: it was every date box in the portal. So this types a real date, one
 * digit at a time, into one of each kind, and asserts the same three things
 * every time:
 *
 *   1. the box ends up holding the date that was typed;
 *   2. nothing was written on the way past;
 *   3. it was written exactly once, at the end, with the right value.
 *
 *   node scripts/checkdates.mjs
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

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, go){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1600, height: 1200}});
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
  await p.evaluate(go);
  await p.waitForTimeout(250);
  return {p, errs};
}

/* Type a date the way a person does: eight digits, one at a time, into
   whatever segment the browser has the caret in. The trail is what the box
   held after each keystroke — the bug is visible in it. */
async function typeDate(p, sel, digits){
  await p.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView(); e.focus(); }, sel);
  await p.waitForTimeout(60);
  const trail = [];
  for(const k of digits){
    await p.keyboard.press('Digit' + k);
    await p.waitForTimeout(90);
    trail.push(await p.evaluate(s => { const e = document.querySelector(s); return (e && e.value) || '-'; }, sel));
  }
  await p.waitForTimeout(350);
  return {trail, value: await p.evaluate(s => { const e = document.querySelector(s); return e ? e.value : null; }, sel)};
}
// a partial year is one the app must never have seen
const noStubs = list => !list.some(v => /^0\d{3}-/.test(String(v)));

try {

/* ============================ 1. the one he reported */
console.log('\nMy profile — a document expiry, the box he was typing in');
{
  const {p, errs} = await open('Shohruh Karimov', () => { state.mode = 'staff'; state.tab = 'profile'; render(); });
  const r = await typeDate(p, '.pfdate', '12312026');
  ok('the box ends up holding the date that was typed', r.value === '2026-12-31', r);
  ok('and every keystroke moved it along', r.trail[7] === '2026-12-31', r.trail.join(' '));
  const saw = await p.evaluate(() => window.__saw.filter(x => x[0] === 'saveDocDate').map(x => x[2]));
  ok('it was written once, with the right date', saw.length === 1 && saw[0] === '2026-12-31', saw);
  ok('and no part-typed year was ever written', noStubs(saw), saw);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 2. a form date that re-renders as you go */
console.log('\nAdd somebody — the joining date');
{
  const {p, errs} = await open('Avin Mascarenhas', () => { state.mode = 'console'; state.tab = 'addstaff'; render(); });
  const r = await typeDate(p, '#jDoj', '10012026');
  ok('the joining date takes all four digits of the year', r.value === '2026-10-01', r);
  ok('and the form kept it', await p.evaluate(() => JF().doj) === '2026-10-01',
     await p.evaluate(() => JF().doj));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 3. leave, which has a min= on it */
console.log('\nLeave & WFH — the From date, which also has a minimum');
{
  const {p, errs} = await open('Shohruh Karimov', () => { state.mode = 'staff'; state.tab = 'requests'; render(); });
  const r = await typeDate(p, '#rqFrom', '11202026');
  ok('a date box with a minimum behaves the same', r.value === '2026-11-20', r);
  ok('and the form kept it', await p.evaluate(() => state.reqForm.from) === '2026-11-20',
     await p.evaluate(() => state.reqForm.from));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 4. an editable table cell */
console.log('\nStaff Documents — an expiry inside an editable table');
{
  const {p, errs} = await open('Avin Mascarenhas', () => {
    state.mode = 'console'; state.tab = 'docdates';
    state.edit = {table:'docs', draft:{}, confirm:false, busy:false}; render(); });
  const sel = '#view input.dt[type="date"]';
  const has = await p.$(sel);
  if(has){
    const r = await typeDate(p, sel, '09302027');
    ok('a date typed into an editable table lands whole', r.value === '2027-09-30', r);
    const draft = await p.evaluate(() => Object.values((state.edit || {}).draft || {}));
    ok('and no part-typed year reached the draft', noStubs(draft), draft);
    ok('so the confirm list would show one change, not four',
       draft.filter(v => String(v).startsWith('2027')).length <= 1, draft);
  } else { ok('there is a date cell to type into', false, 'none found'); }
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 5. one that writes the moment it changes */
console.log('\nProbation — a box that reaches the database on change');
{
  const {p, errs} = await open('Avin Mascarenhas', () => { state.mode = 'console'; state.tab = 'probation'; render(); });
  const has = await p.$('.pbdate');
  if(has){
    const r = await typeDate(p, '.pbdate', '06302027');
    const saw = await p.evaluate(() => window.__saw.filter(x => x[0] === 'extendProbation').map(x => x[2]));
    /* This box is fire-and-clear — it goes back to blank once the extension
       is sent — so what it holds afterwards says nothing. What was SENT is
       the whole point of it. */
    ok('extending probation sends the whole year', saw[0] === '2027-06-30', {saw, trail: r.trail});
    ok('and reaches the database once, not four times', saw.length === 1, saw);
    ok('with no 0002 among them', noStubs(saw), saw);
  } else { ok('somebody is on probation to test with', false, 'nobody'); }
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 6. the two edges */
console.log('\nclearing a date, and walking away from a half-typed one');
{
  const {p, errs} = await open('Shohruh Karimov', () => { state.mode = 'staff'; state.tab = 'profile'; render(); });
  // a date already on file, cleared
  const cleared = await p.evaluate(async () => {
    const e = [...document.querySelectorAll('.pfdate')].find(x => x.value);
    if(!e) return {none: true};
    e.focus(); e.value = '';
    e.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise(r => setTimeout(r, 200));
    return {saw: window.__saw.filter(x => x[0] === 'saveDocDate').map(x => x[2])};
  });
  ok('clearing a date still saves — a blank is a real answer',
     cleared.none || (cleared.saw.length === 1 && cleared.saw[0] === ''), cleared);

  const left = await p.evaluate(async () => {
    const e = document.querySelector('.pfdate');
    const was = e.value;
    e.focus();
    e.value = '0002-12-31';
    e.dispatchEvent(new Event('change', {bubbles: true}));
    e.dispatchEvent(new Event('blur', {bubbles: true}));
    await new Promise(r => setTimeout(r, 150));
    return {was, now: document.querySelector('.pfdate').value,
            saw: window.__saw.filter(x => x[0] === 'saveDocDate').map(x => x[2])};
  });
  ok('walking away half-typed puts back what was there', !/^0\d{3}/.test(left.now), left);
  ok('and never saves the stub', noStubs(left.saw), left.saw);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 7. and it is one guard, not seventeen */
console.log('\nand it holds for every date box, including ones added later');
{
  const src = fs.readFileSync('web/app.js', 'utf8');
  ok('the guard is a single document-level listener',
     /document\.addEventListener\('change', hold, true\)/.test(src));
  ok('it also holds the input event, which fires per segment',
     /document\.addEventListener\('input', hold, true\)/.test(src));
  ok('a year is not a year until four digits are in',
     /\+v\.slice\(0, 4\) >= 1000/.test(src));
  ok('and blank still counts as an answer', /v === '' \|\|/.test(src));
}

} finally {
  await b.close(); server.close();
}

console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
