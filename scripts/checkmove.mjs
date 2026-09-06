/* Moving somebody into sales, and out again.
 *
 *   'Not really completed. Tomorrow if someone changes to sales, i cant see
 *    their report.'                                                   -- Avin
 *
 * The thing that decides whether somebody appears in the sales tables is their
 * department, checked against the departments that earn revenue for their
 * company. So this asks the question he actually asked: if I move somebody
 * today, does their report appear — and if I move them back, does it go away.
 *
 * It also asks the quieter one. Before anything is written, the screen says
 * which of the two the move will do; a control that promises one thing and does
 * the other is worse than one that promises nothing, so the sentence on screen
 * is compared against what actually happens.
 *
 * The control moved. It used to be a form of its own under Sales, and
 * department therefore lived in two places; it is now one field among the
 * twelve on Register → Staff Records, and this check moved with it. What is
 * being protected is the same behaviour, not the same widget.
 *
 *   node scripts/checkmove.mjs
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
 sales_bands:'sales_bands', sales_uploads:'sales_uploads', sales_members:'sales_members',
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
const page = await b.newPage({viewport: {width: 1500, height: 1100}});
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
  /* A database that applies the change the way the real one does — writes the
   * department, then the page is rebuilt from the data. Without that this would
   * only prove the button was pressed. */
  window.__db = new Proxy({}, {get: (_, k) => async (...a) => {
    window.__saw.push([String(k), ...a]);
    if(k === 'saveStaffRecord'){
      if(window.__refuse) return null;
      const r = a[0];
      const nm2 = Object.keys(HR().ids || {}).find(x => (HR().ids || {})[x] === r.emp);
      if(nm2 && r.department) HR().orgDept[nm2] = r.department;
      return true;
    }
    return undefined;
  }});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Avin Mascarenhas', DATA._roles['Avin Mascarenhas'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});

console.log('moving somebody into sales, and out again:\n');

/* ---------------------------------------- department has one home now */
await page.evaluate(() => { state.mode = 'console'; state.company = 'corplex'; state.tab = 'salesstaff'; render(); });
await page.waitForTimeout(250);
ok('the old form under Sales is gone',
   await page.evaluate(() => !document.getElementById('mvWho') && !document.getElementById('mvDept')));
ok('and what is there points at the one place department now lives',
   await page.evaluate(() => !!document.querySelector('[data-go="staffrec"]')));

const openRec = () => page.evaluate(() => { state.mode = 'console'; state.tab = 'staffrec'; render(); });
await openRec();
await page.waitForTimeout(250);
ok('which offers a box for it', await page.evaluate(() => !!document.getElementById('srWho')));

/* Somebody outside sales today, and the department that would put them in. */
const SET = await page.evaluate(() => {
  const co = 'corplex';
  const earn = (HR().revDept || {})[co] || [];
  /* salesCoOf, not the department alone: a handful of people are named
   * exceptions and count as sales whatever department they are in — Avin
   * himself is one — and picking one of those would prove nothing. */
  const who = USERS.map(u => u.name).find(nn =>
    (((HR().orgCo || {})[nn]) || companyOf(nn).key) === co && !salesCoOf(nn));
  return {who, into: earn[0], was: who ? orgDeptOf(who) : ''};
});
ok('there is somebody outside sales to move', !!SET.who && !!SET.into, SET);

const pick = async who => {
  await page.evaluate(([w]) => {
    const s = document.getElementById('srWho'); s.value = w; s.dispatchEvent(new Event('change'));
  }, [who]);
  await page.waitForTimeout(140);
};
/* Department is a picker now, so a move is choosing an option rather than
   typing; a department that is not on the list goes in through the escape at
   the foot of it, which is what the second branch does. */
const type = async d => {
  await page.evaluate(([v]) => {
    const sel = document.querySelector('select[data-sr="department"]');
    if(sel && [...sel.options].some(o => o.value === v)){
      sel.value = v; sel.dispatchEvent(new Event('change')); return;
    }
    if(sel){ sel.value = '__new'; sel.dispatchEvent(new Event('change')); }
  }, [d]);
  await page.waitForTimeout(120);
  await page.evaluate(([v]) => {
    const box = document.querySelector('input[data-sr="department"]');
    if(box){ box.value = v; box.dispatchEvent(new Event('input')); }
  }, [d]);
  await page.waitForTimeout(420);   // the new-department box is debounced by 300ms
};
const saveBtn = () => page.evaluate(() => (document.getElementById('srSave') || {}).disabled);
const askToSave = async () => { await page.click('#srSave'); await page.waitForTimeout(140); };
const promised = () => page.evaluate(() =>
  ((document.querySelector('.edconf') || {}).textContent || '').replace(/\s+/g, ' ').trim());
const inSalesList = async w => {
  await page.evaluate(() => { state.tab = 'salesstaff'; render(); });
  await page.waitForTimeout(200);
  const r = await page.evaluate(([x]) =>
    [...document.querySelectorAll('#view tbody tr')].some(tr => tr.children[0].textContent.includes(x)), [w]);
  await openRec(); await page.waitForTimeout(150);
  return r;
};

await pick(SET.who);
ok('choosing somebody shows where they sit now',
   await page.evaluate(([d]) => (document.querySelector('[data-sr="department"]') || {}).value === d,
     [SET.was || '']), SET.was);
ok('and saving is off until something changes', await saveBtn() === true);
ok('and they are not in the sales list to begin with', !(await inSalesList(SET.who)), SET.who);

await pick(SET.who);
await type(SET.into);
ok('the button turns on once it is typed', await saveBtn() === false);
ok('and nothing has been written on the strength of typing',
   (await page.evaluate(() => window.__saw.length)) === 0);

await askToSave();
const promise = await promised();
ok('the confirm list says it would put them into the sales tables',
   /puts them into the sales tables/i.test(promise), promise);
ok('and names the department it is moving them to', promise.includes(SET.into), promise);
ok('and says out loud that nothing is written yet',
   /Nothing has been written yet/.test(promise), promise);

await page.click('#srGo');
await page.waitForTimeout(320);
const saw = await page.evaluate(() => window.__saw);
ok('agreeing tells the database which person and which department',
   saw.some(c => c[0] === 'saveStaffRecord' && c[1].department === SET.into), saw);
ok('and the report the screen promised is now there', await inSalesList(SET.who), SET.who);
ok('and the screen says it saved',
   await page.evaluate(() => /Saved/.test((document.querySelector('.edok') || {}).textContent || '')));

/* ...and back out again, which is the half that is usually forgotten. */
await pick(SET.who);
await type(SET.was || 'Marketing');
await askToSave();
const back = await promised();
ok('moving them back says it would take them out', /takes them out of/i.test(back), back);
await page.click('#srGo');
await page.waitForTimeout(320);
ok('and it does', !(await inSalesList(SET.who)), SET.who);

/* A refusal must not leave the screen claiming a move that never happened. */
await page.evaluate(() => { window.__refuse = true; window.__saw = []; });
await pick(SET.who);
await type(SET.into);
await askToSave();
await page.click('#srGo');
await page.waitForTimeout(320);
ok('a move the database refuses does not put them in the sales list',
   !(await inSalesList(SET.who)), SET.who);
ok('and does not claim they were saved',
   await page.evaluate(() => !/Saved/.test((document.querySelector('.edok') || {}).textContent || '')));
ok('and it leaves the typing on screen rather than throwing it away',
   await page.evaluate(([d]) => SRF().draft.department === d, [SET.into]),
   await page.evaluate(() => SRF().draft));

/* And the writer exists at the other end. */
const boot = fs.readFileSync('web/boot.js', 'utf8');
ok('boot.js has a writer for the staff record', /async saveStaffRecord\s*\(/.test(boot));
ok('and it goes through correct_joining, which is where the guards live',
   /saveStaffRecord[\s\S]{0,900}correct_joining/.test(boot));

fs.mkdirSync('/tmp/look', {recursive: true});
await page.evaluate(() => { window.__refuse = false; state.sr = null; render(); });
await page.waitForTimeout(150);
await page.screenshot({path: '/tmp/look/move.png', fullPage: true});

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('somebody can be moved into sales and out again, and the screen says which before you press');
