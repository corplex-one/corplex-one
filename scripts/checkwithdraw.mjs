/* Taking back your own request, on both screens that offer one.
 *
 * The database has allowed this since 0013_own_updates and the screen never
 * did. This proves the button is there when it should be, absent when it
 * should not be, and that pressing it actually reaches the database — which
 * is the part a rendered button proves nothing about.
 *
 *   node scripts/checkwithdraw.mjs
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

const who = n => json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${n}') t`)[0];
const AHMED = who('Ahmed Talaat Mohamed');
const RANA  = who('Rana Amine');

/* Two of Ahmed's own, waiting, and one of Rana's — the third exists so the
 * check can prove the button does NOT appear on somebody else's row. */
const KEEPL = sql(`select count(*) from loans`).trim();
const KEEPT = sql(`select count(*) from letters`).trim();
sql(`delete from loans where why = 'checkwithdraw'; delete from letters where why = 'checkwithdraw';`);
sql(`insert into loans(employee_id, amount, months, monthly, why, plan, status)
     values ('${AHMED.id}', 6000, 6, 1000, 'checkwithdraw', 'a thousand a month', 'Pending')`);
sql(`insert into loans(employee_id, amount, months, monthly, why, plan, status)
     values ('${RANA.id}', 4000, 4, 1000, 'checkwithdraw', 'a thousand a month', 'Pending')`);
sql(`insert into letters(employee_id, kind, addressee, why, status)
     values ('${AHMED.id}', 'salary', 'Emirates NBD', 'checkwithdraw', 'Pending')`);

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

const dataFor = p => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, p.auth_user_id)[0]}, p.id);

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
const DATA = dataFor(AHMED);
/* The real thing over psql, as Ahmed — because the question this answers is
 * whether the row-level policy lets him take back his own and nothing else. */
await page.exposeFunction('__cancel', (table, ref) => {
  try{
    sql(`update ${table} set status = 'Cancelled' where ref = '${String(ref).replace(/'/g, "''")}'`,
        AHMED.auth_user_id);
    return true;
  }catch(e){ return String(e.stderr || e.message).split('\n')[0]; }
});
await page.exposeFunction('__again', () => dataFor(AHMED));
await page.evaluate(([d, nm, roles]) => {
  window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
  const reload = async () => {
    const fresh = await window.__again();
    Object.keys(fresh).forEach(k => { window.__DATA[k] = fresh[k]; });
  };
  window.__db = new Proxy({}, {get: (t, k) => async (...a) => {
    if(k === 'cancelLoan'){   const r = await window.__cancel('loans', a[0]);   await reload(); return r; }
    if(k === 'cancelLetter'){ const r = await window.__cancel('letters', a[0]); await reload(); return r; }
    return true;
  }});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Ahmed Talaat Mohamed', DATA._roles['Ahmed Talaat Mohamed'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});

console.log('taking back your own request:\n');

// ---------------------------------------------------------------- advances
await page.evaluate(() => { state.mode = 'staff'; state.tab = 'loans'; render(); });
await page.waitForTimeout(350);
let s = await page.evaluate(() => ({
  buttons: document.querySelectorAll('[data-lnpull]').length,
  rows: document.querySelectorAll('#view tbody tr').length,
  text: document.getElementById('view').innerText}));
ok('an advance of his own, waiting, offers Withdraw', s.buttons === 1, s);
ok('and somebody else\'s does not', !/Rana/.test(s.text) || s.buttons === 1, s.buttons);

await page.evaluate(() => document.querySelector('[data-lnpull]').click());
await page.waitForTimeout(600);
const gone = sql(`select status from loans where employee_id = '${AHMED.id}' and why = 'checkwithdraw'`).trim();
ok('pressing it reaches the database', gone === 'Cancelled', gone);
const other = sql(`select status from loans where employee_id = '${RANA.id}' and why = 'checkwithdraw'`).trim();
ok('and touches nothing else', other === 'Pending', other);

await page.evaluate(() => render());
await page.waitForTimeout(300);
s = await page.evaluate(() => ({buttons: document.querySelectorAll('[data-lnpull]').length,
  text: document.getElementById('view').innerText}));
ok('the row then says Withdrawn', /Withdrawn/.test(s.text), s.text.slice(0, 60));
ok('and offers nothing further', s.buttons === 0, s.buttons);

// ----------------------------------------------------------------- letters
await page.evaluate(() => { state.tab = 'letters'; render(); });
await page.waitForTimeout(350);
s = await page.evaluate(() => ({
  buttons: document.querySelectorAll('[data-ltpull]').length,
  to: !!document.getElementById('ltTo')}));
ok('a letter request of his own offers Withdraw', s.buttons === 1, s);
ok('and every letter type can be addressed to somebody', s.to === true, s);

await page.evaluate(() => document.querySelector('[data-ltpull]').click());
await page.waitForTimeout(600);
const lt = sql(`select status from letters where employee_id = '${AHMED.id}' and why = 'checkwithdraw'`).trim();
ok('and that reaches the database too', lt === 'Cancelled', lt);

/* The other half of the policy: he may cancel, not decide. */
const refused = (() => {
  try{ sql(`update loans set status = 'Approved' where employee_id = '${RANA.id}' and why = 'checkwithdraw'`,
           AHMED.auth_user_id);
    return sql(`select status from loans where employee_id = '${RANA.id}' and why = 'checkwithdraw'`).trim();
  }catch(e){ return 'refused'; }
})();
ok('he cannot approve anything, his own or anybody\'s', refused === 'Pending' || refused === 'refused', refused);

await b.close();
server.close();
sql(`delete from loans where why = 'checkwithdraw'; delete from letters where why = 'checkwithdraw';`);

console.log(`\n${n} checks (loans and letters put back as they were: ${KEEPL} and ${KEEPT})`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('a pending request of your own can be taken back, and nothing else can');
