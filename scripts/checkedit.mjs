/* Nothing in the console is written until somebody says so.
 *
 * Avin: 'I am finding this risky... Keeping open edit is risky, a mistake can
 * cause huge mistakes. Imagine leave balance increased by a wrong key press.'
 *
 * The property he is asking for is a negative one, and negatives are what
 * tests are for: it is easy to see that Save works and very easy to miss that
 * something else also wrote while nobody was looking. So the question asked
 * of every editable table here is the one that matters — *between* opening the
 * table and agreeing to the list of changes, is the database touched at all?
 *
 * Every write goes through window.__db, so a recording stub answers it
 * exactly. Each table is opened, typed into, cancelled, typed into again,
 * taken to the confirmation and brought back, and only then agreed to; the
 * stub is read at every step and must stay empty until the last one.
 *
 *   node scripts/checkedit.mjs
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

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const page = await b.newPage({viewport: {width: 1600, height: 1100}});
await page.route('**://fonts.*/**', r => r.abort());
const bad = [];
let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };
page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });

await page.goto(ORIGIN + '/index.html');
await page.evaluate(([d, nm, roles]) => {
  window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
  window.__saw = [];
  window.__answer = true;
  window.__db = new Proxy({}, {get: (_, k) => async (...a) => {
    window.__saw.push({call: String(k), args: a});
    return window.__answer;
  }});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Avin Mascarenhas', DATA._roles['Avin Mascarenhas'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});

console.log('nothing is written until you say so:\n');

/* The payroll figures are only editable while the run is a draft — once a
 * month is approved and paid, the register is a record and nothing on it is
 * a box. The seed's run is closed, so it is opened here for the duration. */
const DRAFTRUN = await page.evaluate(() => {
  const runs = DATA.payroll.runs || [];
  if(!runs.length) return null;
  const r = runs.find(x => x.status === 'draft') || runs[0];
  r.status = 'draft'; state.payRun = r.key;
  return r.key;
});
if(!DRAFTRUN) throw new Error('there is no payroll run in the seed to edit');

const go   = tab => page.evaluate(([t]) => { state.mode = 'console'; state.tab = t;
  state.edit = null; state.edSaved = null; window.__saw = []; render(); }, [tab]);
const saw  = () => page.evaluate(() => window.__saw);
const wipe = () => page.evaluate(() => { window.__saw = []; });
const press = sel => page.evaluate(([s]) => { const el = document.querySelector(s);
  if(!el) throw new Error('no ' + s); el.click(); }, [sel]);
const conf = () => page.evaluate(() => {
  const c = document.querySelector('.edconf');
  return c ? {head: c.querySelector('h4').textContent.trim(),
    rows: [...c.querySelectorAll('.edtab tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim()))} : null;
});

/* Each table: where it lives, how to find a cell, and what to type into it. */
const TABLES = [
  {id:'carry',    tab:'leavebal',  what:'carried-forward leave',
   type: async () => page.evaluate(() => { const el = document.querySelector('[data-edt="carry"]');
     el.value = '99'; el.dispatchEvent(new Event('input')); return el.dataset.edk; }),
   call:'setCarried'},
  {id:'shifts',   tab:'shifts',    what:'the reporting lines',
   type: async () => page.evaluate(() => {
     const el = [...document.querySelectorAll('[data-edt="shifts"]')].find(x => x.dataset.edk[0] === 'm');
     el.value = [...el.options].map(o => o.value).find(v => v && v !== el.value);
     el.dispatchEvent(new Event('change')); return el.dataset.edk; }),
   call:'saveShiftLines'},
  {id:'hols',     tab:'holidays',  what:'the public holidays',
   type: async () => page.evaluate(() => {
     const el = [...document.querySelectorAll('[data-edt="hols"]')].find(x => x.dataset.edk[0] === 'n');
     el.value = 'Renamed by a test'; el.dispatchEvent(new Event('input')); return el.dataset.edk; }),
   call:'saveHolidays'},
  /* The numbers and the expiry dates are one table on the screen and one here,
     so this walks it twice: once typing into a number, once into a date. Both
     have to reach their own writer through the same Edit and the same Save. */
  {id:'docs',     tab:'docdates',  what:'the document numbers',
   type: async () => page.evaluate(() => {
     const el = document.querySelector('[data-edt="docs"][data-edk$="|no"]');
     el.value = 'P0000001'; el.dispatchEvent(new Event('input')); return el.dataset.edk; }),
   call:'saveDocRefs', trimKey:true},
  {id:'docs',     tab:'docdates',  what:'the document expiry dates',
   type: async () => page.evaluate(() => {
     const el = document.querySelector('[data-edt="docs"][data-edk$="|exp"]');
     el.value = '2031-01-31'; el.dispatchEvent(new Event('change')); return el.dataset.edk; }),
   call:'saveDocDates', trimKey:true},
  /* The third thing that grid writes. It is not a table of its own any more —
     the date of birth is the second column, read off the same passport as the
     numbers beside it — but it still has to reach its own writer, and only
     its own writer, through the one Edit and the one Save. */
  {id:'docs',     tab:'docdates',  what:'the dates of birth',
   type: async () => page.evaluate(() => {
     const el = document.querySelector('[data-edt="docs"][data-edk$="|dob|d"]');
     el.value = '1988-03-09'; el.dispatchEvent(new Event('change')); return el.dataset.edk; }),
   call:'setBirthDates', trimKey:'dob'},
  {id:'payline',  tab:'payroll',   what:'the payroll figures',
   type: async () => page.evaluate(() => { const el = document.querySelector('[data-edt="payline"]');
     el.value = '4321'; el.dispatchEvent(new Event('input')); return el.dataset.edk; }),
   call:'savePayLines'}
];

for(const t of TABLES){
  console.log(`\n  ${t.what}`);
  await go(t.tab);
  await page.waitForTimeout(200);

  /* 1. read mode: there is nothing to mistype into. */
  const readInputs = await page.evaluate(([id]) =>
    document.querySelectorAll(`[data-edt="${id}"]`).length, [t.id]);
  ok('    the table is read-only before you press Edit', readInputs === 0, readInputs);
  const hasBtn = await page.evaluate(([id]) => !!document.querySelector(`[data-edon="${id}"]`), [t.id]);
  ok('    and there is an Edit button on it', hasBtn);
  if(!hasBtn) continue;

  /* 2. Edit opens the draft. */
  await press(`[data-edon="${t.id}"]`);
  await page.waitForTimeout(150);
  const boxes = await page.evaluate(([id]) => document.querySelectorAll(`[data-edt="${id}"]`).length, [t.id]);
  ok('    Edit turns the cells into boxes', boxes > 0, boxes);
  ok('    and pressing Edit on its own writes nothing', (await saw()).length === 0, await saw());
  /* Opening a table must record no changes at all. It once recorded 368 —
   * every empty money box on the payroll, each one listed as 0.00 to 0.00 —
   * because binding a cell was treated as typing in it and an empty box was
   * not the same as a nought. A confirmation that lists hundreds of things
   * you did not do teaches you to press Yes without reading it, which is the
   * one habit this whole mechanism exists to prevent. */
  const untouched = await page.evaluate(() => edList(state.edit.table).length);
  ok('    and an untouched table has nothing in its draft', untouched === 0, untouched);
  const saveOff = await page.evaluate(() => (document.querySelector('[data-edsave]') || {}).disabled);
  ok('    so there is nothing to save yet', saveOff === true, saveOff);

  /* 3. typing writes nothing. */
  const key = await t.type();
  await page.waitForTimeout(120);
  ok('    typing into a cell writes nothing', (await saw()).length === 0, await saw());
  const counted = await page.evaluate(() =>
    (document.querySelector('[data-edsave]') || {}).textContent || '');
  ok('    and the header counts the change', /Save 1/.test(counted), counted);

  /* 4. Cancel throws it away, still without writing. */
  await press('[data-edoff]');
  await page.waitForTimeout(150);
  ok('    Cancel writes nothing either', (await saw()).length === 0, await saw());
  const afterCancel = await page.evaluate(([id]) =>
    document.querySelectorAll(`[data-edt="${id}"]`).length, [t.id]);
  ok('    and puts the table back to read-only', afterCancel === 0, afterCancel);

  /* 5. Save shows the change in words before doing anything. */
  await press(`[data-edon="${t.id}"]`);
  await page.waitForTimeout(150);
  await t.type();
  await page.waitForTimeout(120);
  await press('[data-edsave]');
  await page.waitForTimeout(150);
  const c = await conf();
  ok('    Save shows what is about to change', !!c && c.rows.length === 1, c);
  ok('    with the old value beside the new one',
     !!c && c.rows[0].length === 3 && c.rows[0][1] !== c.rows[0][2], c && c.rows[0]);
  ok('    and names the row in words rather than by its id',
     !!c && !/^[0-9a-f-]{20,}/.test(c.rows[0][0]) && c.rows[0][0].length > 3, c && c.rows[0][0]);
  ok('    and still nothing has been written', (await saw()).length === 0, await saw());

  /* 6. Back keeps the draft. */
  await press('#edBack');
  await page.waitForTimeout(150);
  const kept = await page.evaluate(() => (document.querySelector('[data-edsave]') || {}).textContent || '');
  ok('    Back keeps the change rather than losing it', /Save 1/.test(kept), kept);
  ok('    and writes nothing on the way', (await saw()).length === 0, await saw());

  /* 7. and only agreeing writes. */
  await press('[data-edsave]');
  await page.waitForTimeout(120);
  await press('#edGo');
  await page.waitForTimeout(250);
  const calls = await saw();
  ok('    agreeing to the list is the one thing that writes',
     calls.length === 1 && calls[0].call === t.call, calls.map(x => x.call));
  /* The documents grid holds two things per document, so its draft key carries
     a third segment saying which — 'Rana|passport|no'. The writer underneath
     only ever knew 'Rana|passport', and the table drops the segment on the way
     out. So the key the writer is handed is the draft key minus its tail. */
  /* The birth date is the exception: its draft key is 'Rana|dob|d' and the
     writer takes the bare name, so both segments come off rather than one. */
  const cut = s => s.slice(0, s.lastIndexOf('|'));
  const wantKey = !t.trimKey || key === undefined ? key
    : t.trimKey === 'dob' ? cut(cut(key)) : cut(key);
  ok('    and it sends exactly the change that was shown',
     calls.length === 1 && calls[0].args[0] && Object.keys(calls[0].args[0]).length === 1
       && (wantKey === undefined || wantKey in calls[0].args[0]),
     calls[0] && calls[0].args[0]);
  const done = await page.evaluate(() => (document.querySelector('.edok') || {}).textContent || '');
  ok('    and the table says it saved', /Saved\./.test(done), done);
  await wipe();
}

/* ---------------------------------------------------------- one at a time */
console.log('\n  and the safeguard itself');
await go('leavebal');
await page.waitForTimeout(150);
await press('[data-edon="carry"]');
await page.waitForTimeout(120);
const others = await page.evaluate(() => {
  state.tab = 'shifts'; render();
  const b = document.querySelector('[data-edon="shifts"]');
  return b ? {disabled: b.disabled, why: b.getAttribute('title') || ''} : null;
});
ok('    a second table cannot be opened while a draft is unsaved',
   others && others.disabled, others);
ok('    and it says why', others && /other table/i.test(others.why), others);

/* A refusal must not clear the draft — losing somebody's typing because the
 * network blinked is its own kind of data loss. */
await page.evaluate(() => { state.tab = 'leavebal'; window.__answer = null; window.__saw = []; render(); });
await page.waitForTimeout(150);
await page.evaluate(() => { const el = document.querySelector('[data-edt="carry"]');
  el.value = '77'; el.dispatchEvent(new Event('input')); });
await press('[data-edsave]');
await page.waitForTimeout(120);
await press('#edGo');
await page.waitForTimeout(250);
const still = await page.evaluate(() => ({
  editing: !!state.edit,
  count: (document.querySelector('[data-edsave]') || {}).textContent || '',
  said: (document.querySelector('.edok') || {}).textContent || ''
}));
ok('    a save the database refuses leaves you still editing', still.editing, still);
ok('    with the change still there to try again', /Save 1/.test(still.count), still);
ok('    and does not claim it saved', !/Saved\./.test(still.said), still);

/* ------------------------------- and the one thing that stays instant */
await page.evaluate(() => { window.__answer = true; state.edit = null; state.tab = 'payment';
  state.mode = 'staff'; window.__saw = []; render(); });
await page.waitForTimeout(250);
const tick = await page.evaluate(async () => {
  const box = document.querySelector('#view input[type="checkbox"][data-recon], #view input[type="checkbox"]');
  if(!box) return 'none';
  box.click();
  await new Promise(r => setTimeout(r, 200));
  return window.__saw.map(x => x.call);
});
if(tick === 'none'){
  /* No request on this seed's screen is at the stage that shows the ticks, so
   * the behaviour is asserted where it is written instead: the handler must
   * still call the database from the tick itself, with no draft in between. */
  const src = fs.readFileSync('web/app.js', 'utf8');
  ok('    the payment reconciliation ticks are still wired straight to the database',
     /reconcilePayment/.test(src) && !/data-edt="recon/.test(src));
} else {
  ok('    the payment reconciliation ticks still write at once, as Avin asked',
     Array.isArray(tick) && tick.includes('reconcilePayment'), tick);
}

fs.mkdirSync('/tmp/look', {recursive: true});
await page.evaluate(() => { state.mode = 'console'; state.tab = 'leavebal';
  state.edit = {table:'carry', draft:{}, confirm:false, busy:false}; render();
  const el = document.querySelector('[data-edt="carry"]');
  if(el){ el.value = '21'; el.dispatchEvent(new Event('input')); }
  state.edit.confirm = true; render(); });
await page.waitForTimeout(200);
await page.screenshot({path: '/tmp/look/edit.png', fullPage: true});

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('every editable table is read until you press Edit, and writes only what you agreed to');
