/* The salary revision, from four boxes to a letter somebody keeps.
 *
 * Avin drafted one and could not read what he was about to send. Underneath
 * that was the fault that mattered: the draft letter is written as *waiting*,
 * which put it in the ordinary letters queue with Issue and Decline buttons —
 * and issuing it there marks the letter issued without moving the salary. A
 * signed letter promising a rise, and a payslip that still reads the old
 * figure.
 *
 * So the questions here are: can you read it before you send it, is it out of
 * that queue in both directions, does sending move everything at once, and
 * does a back-dated revision say what it cannot reach.
 *
 *   node scripts/checkrevision.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'seedtest'];
const raw = s => execFileSync(PSQL, [...base, '-tAc', s], {encoding: 'utf8', maxBuffer: 64e6}).trim();
const asUserFull = (who, s) => execFileSync(PSQL, [...base, '-tAc',
  `set role authenticated; select set_config('request.jwt.claim.sub','${who}',false); ${s}`],
  {encoding: 'utf8', maxBuffer: 64e6});
const asUser = (who, s) => { const o = asUserFull(who, s).split('\n').map(x => x.trim()).filter(Boolean);
  return o[o.length - 1] || ''; };
const json = (s, u) => { const o = u ? asUserFull(u, s) : raw(s);
  const i = o.lastIndexOf('\n['); return JSON.parse(i < 0 ? o.trim() : o.slice(i + 1).trim()); };

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

const [AVIN, AVIN_U] = raw(`select id, auth_user_id from employees where full_name='Avin Mascarenhas'`).split('|');
const [WHO, WHO_U] = raw(`select id, auth_user_id from employees where active and auth_user_id is not null
  and full_name <> 'Avin Mascarenhas'
  and exists (select 1 from salary_parts p where p.employee_id = employees.id) limit 1`).split('|');
const WHO_NAME = raw(`select full_name from employees where id='${WHO}'`);
const CLOSED = raw(`select month_key from payroll_runs where status='closed' order by month_key desc limit 1`);

const clean = () => raw(`delete from salary_revisions where reason = 'checkrevision';
  delete from letters where why = 'checkrevision';`);
clean();

const load = (u) => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, u || AVIN_U)[0]}, u === WHO_U ? WHO : AVIN);

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
  window.__db = new Proxy({}, {get: () => async () => true});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [load(), 'Avin Mascarenhas', ['accounts']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});
const refresh = async (u, nm, roles) => page.evaluate(([d, n2, r2]) => {
  Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
  window.__ME = n2; window.__ROLES = r2; state.user = n2; render();
}, [load(u), nm, roles]);

console.log(`the salary revision — ${WHO_NAME}:\n`);

/* ------------------------------------------------------- 1. draft it for real */
const EFF = '2026-12-01';
asUser(AVIN_U, `select issue_revision('${WHO}', 12000, 8000, date '${EFF}', 'checkrevision', '', 'revision', false)`);
await refresh(AVIN_U, 'Avin Mascarenhas', ['accounts']);
await page.evaluate(() => { state.mode = 'console'; state.tab = 'revisions'; render(); });
await page.waitForTimeout(250);

const draft = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.draft')];
  return {count: d.length,
    buttons: d.length ? [...d[0].querySelectorAll('button')].map(b => b.textContent.trim()) : [],
    ref: (document.querySelector('[data-rvsee]') || {}).dataset };
});
ok('the draft is on the Revisions page', draft.count === 1, draft);
ok('with View, Send it and Withdraw — all three',
   ['View','Send it','Withdraw'].every(x => draft.buttons.includes(x)), draft.buttons);

/* ------------------------------------- 2. and NOT in the letters queue */
const queue = await page.evaluate(() => {
  state.mode = 'staff'; state.tab = 'loans'; state.askTab = 'letters'; render();
  /* Only the inbox — an ISSUED revision belongs on Avin's own letters list
   * further down the page, and always did. What must not be here is a draft
   * sitting among staff requests with an Issue button beside it. */
  const panels = [...document.querySelectorAll('#view section.panel')];
  const wait = panels.find(p => /Waiting on you/i.test((p.querySelector('h3')||{}).textContent||''));
  return {inbox: [...document.querySelectorAll('[data-lt-ok]')].length,
    text: wait ? wait.innerText : '(no waiting-on-you panel at all)'};
});
ok('the draft letter is not in the letters queue where it could be issued wrongly',
   queue.inbox === 0, queue.inbox);
ok('and the queue holding staff requests never mentions a revision',
   !/revision/i.test(queue.text), queue.text.slice(0, 160));

/* the person it is about must not learn of it before it is sent */
await refresh(WHO_U, WHO_NAME, ['staff']);
const theirs = await page.evaluate(() => {
  state.mode = 'staff'; state.tab = 'loans'; state.askTab = 'letters'; render();
  return document.getElementById('view').innerText;
});
ok('and the person it is about cannot see it on their own letters page',
   !/Salary revision letter/i.test(theirs), theirs.slice(0, 160));

/* ----------------------------------------------------------- 3. View */
await refresh(AVIN_U, 'Avin Mascarenhas', ['accounts']);
const view = await page.evaluate(() => {
  state.mode = 'console'; state.tab = 'revisions'; render();
  const b = document.querySelector('[data-rvsee]');
  if(!b) return null;
  b.click();
  const a = document.querySelector('.slip.letter');
  const out = a ? {title: (a.querySelector('.lttitle')||{}).textContent.trim(),
    text: a.innerText.replace(/\s+/g, ' '),
    head: (document.querySelector('.slipmodal header span')||{}).textContent.trim()} : null;
  hideDoc();
  return out;
});
ok('View opens the letter itself', !!view && /Salary revision/i.test(view.title), view && view.title);
ok('with the new figures on it',
   !!view && view.text.includes('12,000.00') && view.text.includes('20,000.00'), view && view.text.slice(0, 200));
ok('and says plainly that it has not been sent',
   !!view && /not sent/i.test(view.head), view && view.head);
ok('and it can be printed from there',
   await page.evaluate(() => { document.querySelector('[data-rvsee]').click();
     const has = !!document.getElementById('slipPrint'); hideDoc(); return has; }));

/* -------------------------------------------- 4. a back-dated revision */
const back = await page.evaluate(([eff]) => {
  state.revForm = {who: '', eff, basic: '', allow: ''};
  render();
  const notes = [...document.querySelectorAll('#view .note')].map(x => x.textContent.replace(/\s+/g,' '));
  return notes.find(t => /closed and paid/.test(t)) || '';
}, [CLOSED + '-01']);
ok('a revision dated into a closed month says so before it is sent',
   /closed and paid/.test(back), back.slice(0, 180));
ok('and says what will not happen, rather than just warning',
   /will not appear on any payroll month/.test(back), back.slice(0, 220));

const fine = await page.evaluate(() => {
  state.revForm = {who: '', eff: '2027-06-01', basic: '', allow: ''};
  render();
  return [...document.querySelectorAll('#view .note')].map(x => x.textContent).some(t => /closed and paid/.test(t));
});
ok('and a revision dated forward says nothing of the kind', !fine);

/* ------------------------------------------------- 5. sending moves everything */
const REVID = raw(`select id from salary_revisions where reason='checkrevision'`);
asUser(AVIN_U, `select release_revision('${REVID}')`);
const after = Object.fromEntries(raw(`select
  (select status from salary_revisions where id='${REVID}'),
  (select status from letters where ref=(select letter_ref from salary_revisions where id='${REVID}')),
  (select count(*) from salary_parts where employee_id='${WHO}' and effective_from=date '${EFF}')`)
  .split('|').map((v, i) => [['rev','letter','parts'][i], v]));
ok('sending issues the letter', after.letter === 'Issued', after);
ok('and moves the salary on file, in the same act', after.parts === '1', after);
ok('and the revision is marked issued', after.rev === 'issued', after);

await refresh(AVIN_U, 'Avin Mascarenhas', ['accounts']);
const sent = await page.evaluate(() => {
  state.mode='console'; state.tab='revisions'; state.revQ=''; render();
  const rows = [...document.querySelectorAll('.revsent tbody tr')].map(tr => tr.children[0].textContent.trim());
  return {rows, drafts: document.querySelectorAll('.draft').length,
    scrolls: !!document.querySelector('.revsent')};
});
ok('it moves from the drafts to the sent record', sent.drafts === 0 && sent.rows.length > 0, sent);
ok('and the record scrolls inside its panel rather than growing the page', sent.scrolls);

/* nothing drops off the end, and a name finds it */
const found = await page.evaluate(([who]) => {
  const q = document.getElementById('revQ');
  q.value = who.split(' ')[0]; q.dispatchEvent(new Event('input'));
  const rows = [...document.querySelectorAll('.revsent tbody tr')].map(tr => tr.children[0].textContent.trim());
  q.value = 'zzzznothing'; q.dispatchEvent(new Event('input'));
  const none = document.querySelectorAll('.revsent tbody tr').length;
  q.value = ''; q.dispatchEvent(new Event('input'));
  return {rows, none, all: document.querySelectorAll('.revsent tbody tr').length};
}, [WHO_NAME]);
ok('searching a name narrows the record to them',
   found.rows.length > 0 && found.rows.every(r => r.includes(WHO_NAME.split(' ')[0])), found.rows);
ok('a name that is not there shows nothing', found.none === 0, found);
ok('and clearing it brings the whole record back', found.all >= found.rows.length, found);

/* and now the person may see it */
await refresh(WHO_U, WHO_NAME, ['staff']);
const nowTheirs = await page.evaluate(() => {
  state.mode='staff'; state.tab='loans'; state.askTab='letters'; render();
  return document.getElementById('view').innerText;
});
ok('once sent, the person sees the letter on their own page',
   /Salary revision letter/i.test(nowTheirs), nowTheirs.slice(0, 160));

fs.mkdirSync('/tmp/look', {recursive: true});
await refresh(AVIN_U, 'Avin Mascarenhas', ['accounts']);
await page.evaluate(() => { state.mode='console'; state.tab='revisions'; render(); });
await page.waitForTimeout(200);
await page.screenshot({path: '/tmp/look/revision.png', fullPage: true});

await b.close();
server.close();
raw(`delete from salary_parts where employee_id='${WHO}' and effective_from=date '${EFF}';`);
clean();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('a revision can be read before it is sent, lives only on its own page, and moves everything at once');
