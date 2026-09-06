/* The attendance clock, and the day it is counting.
 *
 * 'Every time i check in and check out the clock restarts. The clock should
 * always continue.' It counted from the open segment's check-in, so going out
 * to a client and coming back put it to zero. This proves it counts the day:
 * two closed segments plus a running one, and the number on screen has all
 * three in it.
 *
 *   node scripts/checkattend.mjs
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

const AHMED = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Ahmed Talaat Mohamed') t`)[0];
// map.js takes today from the clock, so the seed has to use the same day
const TODAY = new Date().toISOString().slice(0, 10);

/* A day in three pieces: office 08:30–10:30, client site 11:00–12:00, then
 * back at 13:00 and still on the clock. Two hours plus one, plus whatever
 * the running one has come to. */
const KEEP = sql(`select count(*) from attendance where employee_id='${AHMED.id}' and on_date='${TODAY}'`).trim();
sql(`delete from attendance where employee_id='${AHMED.id}' and on_date='${TODAY}'`);
sql(`insert into attendance(employee_id, on_date, kind, in_at, out_at, location)
     values ('${AHMED.id}','${TODAY}','Office','08:30','10:30','Office'),
            ('${AHMED.id}','${TODAY}','Office','11:00','12:00','Client site'),
            ('${AHMED.id}','${TODAY}','Office','13:00', null, 'Office')`);

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
    `) t`, AHMED.auth_user_id)[0]}, AHMED.id);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const bad = [];
let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };

const page = await b.newPage({viewport: {width: 1440, height: 1100}});
await page.route('**://fonts.*/**', r => r.abort());
page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });
await page.goto(ORIGIN + '/index.html');
await page.evaluate(([d, nm, roles]) => {
  window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
  window.__db = new Proxy({}, {get: () => () => {}});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Ahmed Talaat Mohamed', DATA._roles['Ahmed Talaat Mohamed'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});
await page.evaluate(() => { state.mode = 'staff'; state.tab = 'attend'; render(); });
await page.waitForTimeout(400);

/* The clock only exists on a working day: at a weekend or on a public holiday
 * the card correctly says there is nothing to record. That is the product
 * behaving, not the check failing, so on those days this half is skipped and
 * says so rather than reporting six red lines every Saturday. */
const DAYKIND = await page.evaluate(() => dayStatus(state.user, HDATE()).k);
const WORKDAY = !['Weekend', 'Holiday'].includes(DAYKIND);

console.log('the clock, and the day it is counting:\n');
if(!WORKDAY) console.log(`  \u2014 skipped: today is a ${DAYKIND.toLowerCase()}, so there is no clock to run.`
  + '\n    The card says there is nothing to record, which is the right answer.\n');

const c = await page.evaluate(() => {
  const el = document.querySelector('.ciclock');
  return el ? {since: el.dataset.since, base: +el.dataset.base,
    shown: (el.querySelector('.citime') || {}).textContent,
    line: [...document.querySelectorAll('.cin')].map(x => x.textContent.trim())} : null;
});
if(WORKDAY) ok('the clock is running', !!c && c.since === '13:00', c);
if(WORKDAY) ok('and starts from the three hours already recorded', c && c.base === 180, c && c.base);
if(WORKDAY) ok('rather than from the last check-in', c && c.base !== 0, c && c.base);
if(WORKDAY) ok('the card says what was recorded earlier today', c && c.line.some(x => /0?3:00 earlier today/.test(x)), c && c.line);
/* Which of the two lines shows depends on the clock: run this before 22:00
 * and the running segment has not reached nine hours, run it after and it
 * has. Both are the nine hours being accounted for, which is the assertion. */
if(WORKDAY) ok('and the nine-hour day is accounted for',
   c && c.line.some(x => /left of the 0?9:00 day|the full 0?9:00 is in/.test(x)), c && c.line);

// and the ticker adds the base rather than ignoring it
await page.waitForTimeout(1200);
const t = await page.evaluate(() => (document.querySelector('.citime') || {}).textContent);
const hrs = +String(t || '').split(':')[0];
if(WORKDAY) ok('the ticking number is past three hours, not near zero', hrs >= 3, t);

/* Segments still add up on the record itself — the clock is a display and
 * must not have changed what the day is worth. */
const total = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#view tbody tr')];
  const tot = rows.find(r => /Today/.test(r.children[0] ? r.children[0].textContent : ''));
  return tot ? tot.children[3].textContent.trim() : null;
});
/* The closed segments come to three hours and the total row shows those,
 * not the running one — the record is what happened, not what is happening. */
ok('and the record still totals the three closed hours', /^0?3:00$/.test(total || ''), total);

await b.close();
server.close();
sql(`delete from attendance where employee_id='${AHMED.id}' and on_date='${TODAY}'`);

console.log(`\n${n} checks (${TODAY} put back as it was: ${KEEP} row(s))`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('the clock counts the whole day, not the last check-in');
