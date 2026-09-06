/* The shift and the reporting line.
 *
 * Two faults were found here, and this holds both of them down.
 *
 * The one Avin reported: he ran 0037_reporting_lines.sql to fill the blank
 * lines with Miraziz and the screen still said Nobody. The migration was
 * fine. The dropdown was built from the people whose attendance is tracked —
 * right for the shift column, wrong for this one — and Miraziz is not one of
 * them, so his name was not in the list at all and the select fell through to
 * its first option.
 *
 * The one underneath it: neither column ever wrote anything. Both changed the
 * in-memory copy, the page redrew as though it had taken, and the next reload
 * put it back.
 *
 * The writing is now done through the console's shared Edit/Save mechanism,
 * which checkedit.mjs holds to its promise on every table at once. What is
 * left here is what belongs to this screen alone: who can be named as a
 * manager, what the database refuses, and whether the page still says
 * "confirm these" over controls that confirm nothing.
 *
 *   node scripts/checkshifts.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'seedtest'];
const sql = (s, u) => execFileSync(PSQL, [...base, '-tAc',
  (u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` : '') + s],
  {encoding: 'utf8', maxBuffer: 64e6});
const json = (s, u) => { const o = sql(s, u); const i = o.lastIndexOf('\n[');
  return JSON.parse(i < 0 ? o.trim() : o.slice(i + 1).trim()); };
const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads',
 payment_requests:'payment_requests', payment_files:'payment_files'};
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Avin Mascarenhas') t`)[0];

const TYPES = {'.html':'text/html', '.js':'text/javascript', '.png':'image/png',
               '.json':'application/json', '.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  const f = path.join('web', decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('no'); }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  res.end(fs.readFileSync(f));
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const DATA = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, AVIN.auth_user_id)[0]}, AVIN.id);

const bad = [];
let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };

console.log('the shift and the reporting line:\n');

/* ------------------------------------------------ 1. what the writer refuses */
const boot = fs.readFileSync('web/boot.js', 'utf8');
ok('boot.js writes the whole table at once', /async saveShiftLines\s*\(/.test(boot));
ok('and it writes to the employees table',
   /update\(\{shift_id:/.test(boot) && /update\(\{manager_id:/.test(boot));
ok('nobody can be made to report to themselves', /report to themselves/.test(boot));
ok('and a circle is refused before anything is written', /already reports to/.test(boot));
ok('and it stops at the first refusal rather than writing half a table',
   /return null;[\s\S]{0,400}saveAll\('That table'/.test(boot));

/* ------------------------------------------------- 2. the screen and the list */
const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const page = await b.newPage({viewport: {width: 1500, height: 1100}});
await page.route('**://fonts.*/**', r => r.abort());
page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });
await page.goto(ORIGIN + '/index.html');
await page.evaluate(([d, nm, roles]) => {
  window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
  window.__saw = [];
  window.__db = new Proxy({}, {get: (_, k) => async (...a) => {
    window.__saw.push([String(k), ...a]); return true; }});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Avin Mascarenhas', DATA._roles['Avin Mascarenhas'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});
await page.evaluate(() => { state.mode = 'console'; state.tab = 'shifts'; state.edit = null; render(); });
await page.waitForTimeout(300);

/* Read mode first: a table you are not editing has no boxes to knock. */
const read = await page.evaluate(() => ({
  boxes: document.querySelectorAll('[data-edt="shifts"]').length,
  edit: !!document.querySelector('[data-edon="shifts"]'),
  names: [...document.querySelectorAll('#view tbody tr')].map(tr => tr.children[0].textContent.trim()),
  lines: [...document.querySelectorAll('#view tbody tr')].map(tr => tr.children[2].textContent.trim())
}));
ok('the table is read-only until you press Edit', read.boxes === 0 && read.edit, read);
ok('and it shows the reporting lines as names rather than as empty boxes',
   read.lines.some(x => /\w/.test(x)), read.lines.slice(0, 3));

/* The fault Avin reported: the name that must be offerable. */
await page.evaluate(() => { document.querySelector('[data-edon="shifts"]').click(); });
await page.waitForTimeout(200);
const opts = await page.evaluate(() => {
  const s = [...document.querySelectorAll('[data-edt="shifts"]')].find(x => x.dataset.edk[0] === 'm');
  return s ? {who: s.dataset.edk.slice(2), have: [...s.options].map(o => o.value).filter(Boolean)} : null;
});
ok('the reporting line is a dropdown once you are editing', !!opts, opts);
const roster = await page.evaluate(() => USERS.map(u => u.name));
const missing = opts ? roster.filter(r => r !== opts.who && !opts.have.includes(r)) : roster;
ok('everybody on the roster can be named as a manager', missing.length === 0, missing);
ok('including the owner, who is not tracked for attendance and was the one missing',
   !!opts && opts.have.includes('Miraziz Makhamatzhanov'),
   opts && opts.have.length);
ok('and nobody is offered themselves',
   !!opts && !opts.have.includes(opts.who), opts && opts.who);

/* Both columns are editable, and both are in the same draft. */
const cols = await page.evaluate(() => {
  const all = [...document.querySelectorAll('[data-edt="shifts"]')].map(x => x.dataset.edk[0]);
  return {shift: all.filter(x => x === 's').length, mgr: all.filter(x => x === 'm').length};
});
ok('the shift column is editable too', cols.shift > 0, cols);
ok('and both columns belong to one table, saved together', cols.shift === cols.mgr, cols);

/* Changing both and saving sends one call carrying both. */
const sent = await page.evaluate(async () => {
  const m = [...document.querySelectorAll('[data-edt="shifts"]')].find(x => x.dataset.edk[0] === 'm');
  m.value = [...m.options].map(o => o.value).find(v => v && v !== m.value);
  m.dispatchEvent(new Event('change'));
  const s = [...document.querySelectorAll('[data-edt="shifts"]')].find(x => x.dataset.edk[0] === 's');
  s.value = [...s.options].map(o => o.value).find(v => v !== s.value);
  s.dispatchEvent(new Event('change'));
  const before = window.__saw.length;
  document.querySelector('[data-edsave]').click();
  await new Promise(r => setTimeout(r, 120));
  const atConfirm = window.__saw.length;
  document.getElementById('edGo').click();
  await new Promise(r => setTimeout(r, 250));
  return {before, atConfirm, calls: window.__saw.map(c => c[0]),
    keys: Object.keys((window.__saw.find(c => c[0] === 'saveShiftLines') || [])[1] || {})};
});
ok('nothing is written while the confirmation is on screen',
   sent.before === 0 && sent.atConfirm === 0, sent);
ok('and agreeing sends one call for the whole table',
   sent.calls.filter(c => c === 'saveShiftLines').length === 1, sent.calls);
ok('carrying both the shift and the reporting line',
   sent.keys.length === 2 && sent.keys.some(k => k[0] === 's') && sent.keys.some(k => k[0] === 'm'),
   sent.keys);

/* ------------------------------------------- 3. the page says what it does */
const cap = await page.evaluate(() => {
  state.edit = null; render();
  return {cap: [...document.querySelectorAll('#view .cap')].map(p => p.textContent).join(' '),
    hint: [...document.querySelectorAll('#view .hint')].map(p => p.textContent).join(' ')};
});
ok('the page no longer asks you to confirm what it never saved',
   !/confirm these/i.test(cap.hint), cap.hint);
ok('and no longer claims somebody assumed the lines', !/I have assumed/i.test(cap.cap), cap.cap.slice(0, 120));
ok('and warns about anybody whose requests have nowhere to go',
   /nobody to send requests to/.test(cap.cap) || !/nobody yet/.test(cap.cap), cap.cap.slice(-200));

fs.mkdirSync('/tmp/look', {recursive: true});
await page.screenshot({path: '/tmp/look/shifts.png', fullPage: true});

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('anybody can be named as a manager, and the table is written once, on purpose');
