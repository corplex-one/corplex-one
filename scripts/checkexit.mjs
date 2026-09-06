/* The exit settlement, on the screen.
 *
 * checkexitsql.mjs holds the database to the stages, the freeze and the road
 * back. This is the other half: that the screen offers the right buttons to
 * the right person at the right stage, that a draft survives being saved, that
 * initiating puts the person in the box on the month and takes them out of the
 * rows above it, and that the settlement document carries the lines Avin typed.
 *
 * It drives the real RPCs against the scratch database rather than a stub, so
 * what passes here is the thing that will run.
 *
 *   node scripts/checkexit.mjs
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
/* Scalars: the answer is the last line, past the SET and the claim. */
const asUser = (who, s) => {
  const out = asUserFull(who, s).split('\n').map(x => x.trim()).filter(Boolean);
  return out[out.length - 1] || '';
};
/* JSON is not line-safe — the rows themselves contain newlines — so the array
 * is found by where it starts rather than by splitting the output up. */
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
const OWNER_U = raw(`select auth_user_id from employees where full_name='Miraziz Makhamatzhanov'`);
const [WHO, WHO_MGR] = raw(`select e.id, e.manager_id from employees e join employees m on m.id=e.manager_id
   where m.full_name <> 'Miraziz Makhamatzhanov' and e.active and e.doj is not null
     and exists (select 1 from payroll_lines l join payroll_runs r on r.id=l.run_id where l.employee_id=e.id)
   limit 1`).split('|');
const MGR_U = raw(`select auth_user_id from employees where id='${WHO_MGR}'`);
const WHO_NAME = raw(`select full_name from employees where id='${WHO}'`);
const MGR_NAME = raw(`select full_name from employees where id='${WHO_MGR}'`);
const RUNMONTH = raw(`select month_key from payroll_runs order by month_key desc limit 1`);
const LWD = RUNMONTH + '-' + raw(`select to_char((date_trunc('month', to_date('${RUNMONTH}','YYYY-MM')) + interval '1 month - 1 day'), 'DD')`);

const clean = () => raw(`delete from exits where employee_id='${WHO}';
  update employees set active=true, last_day=null where id='${WHO}';
  update payroll_lines set excluded=false;`);
clean();

const load = () => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, AVIN_U)[0]}, AVIN);

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
/* A database that really is the database: every call goes through the RPCs as
 * whoever the test is being at the time, then the page is rebuilt from rows. */
await page.evaluate(([d, nm, roles]) => {
  window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
  window.__calls = [];
  window.__db = new Proxy({}, {get: (_, k) => async (...a) => {
    window.__calls.push([String(k), ...a]);
    return window.__answer === undefined ? true : window.__answer;
  }});
  window.confirm = () => true;
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [load(), 'Avin Mascarenhas', ['accounts']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});

/* The bridge: what boot.js would do, done here against the real database. */
const refresh = async (who, roles) => {
  await page.evaluate(([d, nm, rs]) => {
    Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
    window.__ME = nm; window.__ROLES = rs;
    state.user = nm;
    render();
  }, [load(), who, roles]);
};
const sql = (u, s) => asUser(u, s);

console.log(`the exit settlement, on the screen — ${WHO_NAME}, manager ${MGR_NAME}:\n`);

/* --------------------------------------------------------- 1. the draft */
await page.evaluate(([who, lwd]) => {
  state.mode = 'console'; state.tab = 'exits';
  state.exitWho = who; state.exitLwd = lwd; state.exitSettle = '';
  state.exitId = null; state.exitLines = []; state.exitOpen = null;
  render();
}, [WHO_NAME, LWD]);
await page.waitForTimeout(250);

ok('there is a way to add a line', await page.evaluate(() => !!document.getElementById('exAdd')));
ok('and a way to save the draft', await page.evaluate(() => !!document.getElementById('exSave')));

const withLines = await page.evaluate(async () => {
  document.getElementById('exAdd').click();
  await new Promise(r => setTimeout(r, 60));
  let l = document.querySelector('[data-exlbl="0"]'); l.value = 'Q3 commission'; l.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 60));
  let a = document.querySelector('[data-examt="0"]'); a.value = '6400'; a.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 60));
  document.getElementById('exAdd').click();
  await new Promise(r => setTimeout(r, 60));
  l = document.querySelector('[data-exlbl="1"]'); l.value = 'Laptop not returned'; l.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 60));
  a = document.querySelector('[data-examt="1"]'); a.value = '3200'; a.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 60));
  document.querySelector('[data-exsign="1"][data-v="less"]').click();
  await new Promise(r => setTimeout(r, 80));
  const c = exitCalc(state.exitWho, state.exitLwd, {lines: state.exitLines});
  return {addOn: c.addOn, takeOff: c.takeOff, net: c.net,
    plain: exitCalc(state.exitWho, state.exitLwd, {lines: []}).net};
});
ok('an addition and a deduction are both taken', withLines.addOn === 6400 && withLines.takeOff === 3200, withLines);
ok('and the total moves by the difference',
   Math.round((withLines.net - withLines.plain) * 100) / 100 === 3200, withLines);

/* the document carries them */
const doc = await page.evaluate(() => {
  document.getElementById('exDoc').click();
  const a = document.querySelector('.slip.settle');
  const rows = i => [...a.querySelectorAll('.slside')[i].querySelectorAll('.slrow')]
    .map(x => x.querySelector('span').childNodes[0].textContent.trim());
  const out = {earn: rows(0), ded: rows(1)};
  hideDoc();
  return out;
});
ok('the settlement document lists the addition under Earnings',
   doc.earn.includes('Q3 commission'), doc.earn);
ok('and the deduction under Deductions',
   doc.ded.includes('Laptop not returned'), doc.ded);

/* ------------------------------------------------------ 2. saving it for real */
const saved = await page.evaluate(() => {
  const s = state.exitLines.filter(x => String(x.label).trim() || +x.amount)
    .map(x => ({label: String(x.label).trim(), amount: +x.amount || 0, deduct: !!x.deduct}));
  return {who: state.exitWho, lwd: state.exitLwd, lines: JSON.stringify(s)};
});
const EXID = sql(AVIN_U, `select exit_save(null, '${WHO}', date '${saved.lwd}', date '${saved.lwd}',
  null, null, '${saved.lines.replace(/'/g, "''")}'::jsonb)`);
ok('the draft is written to the database', /^[0-9a-f-]{36}$/.test(EXID), EXID);

await page.evaluate(() => { state.exitWho=''; state.exitLwd=''; state.exitLines=[]; });
await refresh('Avin Mascarenhas', ['accounts']);
await page.waitForTimeout(150);

const listed = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#view table tbody tr')]
    .map(tr => [...tr.children].map(td => td.textContent.trim()));
  return {rows, edit: !!document.querySelector('[data-exedit]'), go: !!document.querySelector('[data-exgo]')};
});
ok('the draft appears in the settlements table', listed.rows.some(r => r.join(' ').includes('Draft')), listed.rows);
ok('with an Edit button', listed.edit);
ok('and an Initiate exit process button', listed.go);

/* Editing loads it back with its lines intact — the reason it is saved at all. */
await page.evaluate(() => document.querySelector('[data-exedit]').click());
await page.waitForTimeout(200);
const reopened = await page.evaluate(() => ({
  who: state.exitWho, lines: state.exitLines.map(l => l.label + '/' + l.amount + '/' + l.deduct)}));
ok('opening the draft brings back both lines exactly as typed',
   reopened.lines.length === 2 && reopened.lines[0] === 'Q3 commission/6400/false'
     && reopened.lines[1] === 'Laptop not returned/3200/true', reopened);

/* ------------------------------------------------------------ 3. initiating */
const beforeRows = await page.evaluate(([m]) => {
  const run = (DATA.payroll.runs || []).find(r => r.key === m);
  return run ? run.rows.length : null;
}, [RUNMONTH]);

const c = await page.evaluate(([id]) => {
  const x = (HR().exits || []).find(y => y.id === id);
  const e = exitOf(x);
  return {net: e.c.net, extra: e.c.extra.length};
}, [EXID]);
sql(AVIN_U, `select exit_initiate('${EXID}', '${JSON.stringify({net: c.net}).replace(/'/g, "''")}'::jsonb, ${c.net})`);
await refresh('Avin Mascarenhas', ['accounts']);
await page.waitForTimeout(150);

const afterRows = await page.evaluate(([m]) => {
  const run = (DATA.payroll.runs || []).find(r => r.key === m);
  return run ? run.rows.length : null;
}, [RUNMONTH]);
ok('initiating takes the person off that month’s payroll rows',
   afterRows === beforeRows - 1, {beforeRows, afterRows});

const box = await page.evaluate(([m]) => {
  state.tab = 'payroll'; state.payRun = m; render();
  const el = document.querySelector('.exbox');
  return el ? {text: el.innerText.replace(/\s+/g, ' ').trim(),
    rows: [...el.querySelectorAll('tbody tr')].map(tr => tr.children[0].textContent.trim()),
    amber: !el.classList.contains('done')} : null;
}, [RUNMONTH]);
ok('and puts them in their own box on that month', !!box && box.rows.length === 1, box);
ok('the box says the settlement is not part of the payroll',
   !!box && /not part of the payroll/i.test(box.text), box && box.text.slice(0, 90));
ok('and it is amber while nothing has been paid', !!box && box.amber, box);
const inRows = await page.evaluate(([who]) => {
  const t = document.getElementById('view').innerText;
  const box = document.querySelector('.exbox');
  const boxText = box ? box.innerText : '';
  return t.split(boxText)[0].includes(who);
}, [WHO_NAME]);
ok('while the register above no longer lists them', !inRows, {WHO_NAME});

/* ------------------------------------------------- 4. who sees which button */
await page.evaluate(([id]) => { state.tab = 'exits'; state.exitOpen = id; render(); }, [EXID]);
await page.waitForTimeout(150);
const asAcc = await page.evaluate(() => ({
  approve: !!document.querySelector('[data-exok]'),
  undo: !!document.querySelector('[data-exundo]'),
  pay: !!document.querySelector('[data-expay]')}));
ok('accounts is not offered the approval', !asAcc.approve, asAcc);
ok('but is offered the undo', asAcc.undo, asAcc);

await refresh(MGR_NAME, ['staff']);
await page.evaluate(([id]) => { state.mode='staff'; state.tab = 'exitapprove'; state.exitOpen = id; render(); }, [EXID]);
await page.waitForTimeout(150);
const asMgr = await page.evaluate(() => ({
  approve: !!document.querySelector('[data-exok]'),
  back: !!document.querySelector('[data-exno]'),
  undo: !!document.querySelector('[data-exundo]')}));
ok('the reporting manager is offered the approval', asMgr.approve, asMgr);
const mgrFinds = await page.evaluate(() => {
  state.exitOpen = null; render();
  return {tab: !!STAFFTABS().concat(ALLOWED()).find(t => t.id === 'exitapprove'),
    rows: document.querySelectorAll('[data-exopen]').length};
});
ok('and can find it without being sent a link', mgrFinds.rows === 1, mgrFinds);
await page.evaluate(([id]) => { state.exitOpen = id; render(); }, [EXID]);
ok('and a way to send it back', asMgr.back, asMgr);
ok('but not the undo, which belongs to accounts', !asMgr.undo, asMgr);

sql(MGR_U, `select exit_approve('${EXID}')`);
await refresh('Miraziz Makhamatzhanov', ['owner']);
await page.evaluate(([id]) => { state.mode='staff'; state.tab='exitapprove'; state.exitOpen = id; render(); }, [EXID]);
await page.waitForTimeout(150);
ok('and then the owner is', await page.evaluate(() => !!document.querySelector('[data-exok]')));

sql(OWNER_U, `select exit_approve('${EXID}')`);
await refresh('Avin Mascarenhas', ['accounts']);
await page.evaluate(([id]) => { state.mode='console'; state.tab='exits'; state.exitOpen = id; render(); }, [EXID]);
await page.waitForTimeout(150);
const paying = await page.evaluate(() => [...document.querySelectorAll('[data-expay]')].map(b => b.dataset.mode));
ok('once approved, accounts chooses how it is paid',
   paying.includes('with_salaries') && paying.includes('separate'), paying);

sql(AVIN_U, `select exit_decide('${EXID}', 'separate')`);
sql(AVIN_U, `select exit_paid('${EXID}', current_date)`);
await refresh('Avin Mascarenhas', ['accounts']);
await page.evaluate(([m]) => { state.tab='payroll'; state.payRun = m; render(); }, [RUNMONTH]);
await page.waitForTimeout(150);
const done = await page.evaluate(() => {
  const el = document.querySelector('.exbox');
  return el ? {green: el.classList.contains('done'), text: el.innerText.replace(/\s+/g,' ')} : null;
});
ok('and once paid the box goes green rather than disappearing',
   !!done && done.green && /all paid/i.test(done.text), done && done.text.slice(0, 80));

/* ---------------------------------------------- 5. what the leaver can see */
const leaverU = raw(`select auth_user_id from employees where id='${WHO}'`);
if(leaverU && leaverU !== ''){
  const theirs = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
      `) t`, leaverU)[0]}, WHO);
  await page.evaluate(([d, nm]) => {
    Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
    window.__ME = nm; window.__ROLES = ['staff']; state.user = nm;
    state.mode = 'staff'; state.tab = 'myslip'; render();
  }, [theirs, WHO_NAME]);
  await page.waitForTimeout(200);
  ok('the leaver sees their settlement on My payslip',
     await page.evaluate(() => !!document.querySelector('[data-exslip]')));
  ok('and can open the document from there',
     await page.evaluate(() => { const b = document.querySelector('[data-exslip]');
       if(!b) return false; b.click();
       const on = !!document.querySelector('.slip.settle'); hideDoc(); return on; }));
} else {
  console.log('  --   that person has no sign-in in the seed, so the leaver view is not exercised');
}

fs.mkdirSync('/tmp/look', {recursive: true});
await refresh('Avin Mascarenhas', ['accounts']);
await page.evaluate(() => { state.mode='console'; state.tab='exits'; state.exitOpen=null; render(); });
await page.waitForTimeout(200);
await page.screenshot({path: '/tmp/look/exit.png', fullPage: true});

await b.close();
server.close();
clean();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('a settlement is drafted, initiated, approved and paid, and the month shows it beside the run');
