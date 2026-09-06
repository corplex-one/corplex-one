/* Mattia's commission, against the sheet Avin sent.
 *
 * Every figure below is read off his screenshot rather than derived from my
 * own formula, so this fails if my arithmetic drifts from his — which is the
 * only thing worth checking about a calculator that reproduces somebody
 * else's working.
 *
 *   node scripts/checkmattia.mjs
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

/* Exactly what is on the sheet, transcribed once. Rows are
 * [label, invoice, vat, total]; Mattia carries no VAT. */
const SHEET = {
  AED: [['Our price', '10,000.00', '500.00', '10,500.00'],
        ['To client', '12,500.00', '625.00', '13,125.00'],
        ['Mattia',     '2,500.00', '',       '2,500.00']],
  USD: [['Our price',  '2,739.73', '136.99',  '2,876.71'],
        ['To client',  '3,424.66', '171.23',  '3,595.89'],
        ['Mattia',       '684.93', '',          '684.93']],
  EUR: [['Our price',  '2,409.64', '120.48',  '2,530.12'],
        ['To client',  '3,012.05', '150.60',  '3,162.65'],
        ['Mattia',       '602.41', '',          '602.41']]
};

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const page = await b.newPage({viewport: {width: 1440, height: 1100}});
await page.route('**://fonts.*/**', r => r.abort());
const bad = [];
let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };
page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });

await page.goto(ORIGIN + '/index.html');
/* The screen reads nothing but its own four boxes, but the shell around it
 * wants a real portal to draw, so the real data goes in. */
const DATA = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, AVIN.auth_user_id)[0]}, AVIN.id);
await page.evaluate(([d, nm, roles]) => {
  window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
  window.__db = new Proxy({}, {get: () => () => {}});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Avin Mascarenhas', DATA._roles['Avin Mascarenhas'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});
await page.evaluate(() => { state.mode = 'staff'; state.tab = 'tools'; state.calcTab = 'mattia'; render(); });
await page.waitForTimeout(400);

console.log("Mattia's commission, against the sheet:\n");

const grab = () => page.evaluate(() => {
  const out = {};
  document.querySelectorAll('#mcOut .mcblock').forEach(bl => {
    const cur = bl.querySelector('.mchead').textContent.trim().slice(0, 3);
    out[cur] = [...bl.querySelectorAll('tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim()));
  });
  out.__say = (document.querySelector('.mcsay') || {}).textContent || '';
  return out;
});

let got = await grab();
for(const cur of ['AED', 'USD', 'EUR']){
  ok(`${cur} is on the screen`, !!got[cur], Object.keys(got));
  if(!got[cur]) continue;
  SHEET[cur].forEach((want, i) => {
    const saw = got[cur][i];
    ok(`${cur} ${want[0]}: ${want[1]} / ${want[2] || '—'} / ${want[3]}`,
       JSON.stringify(saw) === JSON.stringify(want), saw);
  });
}
ok('and Mattia never carries VAT',
   ['AED','USD','EUR'].every(c => got[c] && got[c][2][2] === ''),
   ['AED','USD','EUR'].map(c => got[c] && got[c][2][2]));
ok("the line above says what he takes and what share it is",
   /Mattia takes AED 2,500\.00/.test(got.__say) && /20\.0% of what the client pays/.test(got.__say),
   got.__say.slice(0, 120));

/* And that it is a calculator rather than a picture of one: change the price
 * and every figure has to move with it. */
await page.evaluate(() => {
  const el = document.getElementById('mcInv');
  el.value = '20000'; el.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(200);
got = await grab();
ok('doubling our price doubles the client invoice', got.AED[1][1] === '25,000.00', got.AED[1][1]);
ok('and doubles what Mattia takes', got.AED[2][1] === '5,000.00', got.AED[2][1]);
ok('and the USD block follows', got.USD[0][1] === '5,479.45', got.USD[0][1]);

// the mark-up is a box, not a constant
await page.evaluate(() => {
  document.getElementById('mcInv').value = '10000';
  document.getElementById('mcInv').dispatchEvent(new Event('input'));
  const u = document.getElementById('mcUp');
  u.value = '30'; u.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(200);
got = await grab();
ok('a 30% mark-up bills the client 13,000', got.AED[1][1] === '13,000.00', got.AED[1][1]);
ok('and leaves Mattia 3,000', got.AED[2][1] === '3,000.00', got.AED[2][1]);

// and so is the rate
await page.evaluate(() => {
  const u = document.getElementById('mcUp'); u.value = '25'; u.dispatchEvent(new Event('input'));
  const r = document.getElementById('mcUsd'); r.value = '3.70'; r.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(200);
got = await grab();
ok('a different USD rate moves the USD block', got.USD[0][1] === '2,702.70', got.USD[0][1]);
ok('and leaves the dirhams alone', got.AED[0][1] === '10,000.00', got.AED[0][1]);

fs.mkdirSync('/tmp/look', {recursive: true});
await page.evaluate(() => {
  document.getElementById('mcUsd').value = '3.65';
  document.getElementById('mcUsd').dispatchEvent(new Event('input'));
});
await page.waitForTimeout(200);
await page.screenshot({path: '/tmp/look/mattia.png', fullPage: true});

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log("every figure agrees with Avin's sheet, and moves when the price does");
