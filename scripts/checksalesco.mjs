/* One company's commercial arrangements are not another's.
 *
 * Avin: 'I see corplex rules in POA and Lex' (#29) and 'Seen on POA and Lex
 * console' (#31). Both panels drew CorpLex's figures whatever company was
 * picked at the top of the console — the referral one while carrying a pill
 * that said "CorpLex only" and a note saying POA and Lex have no arrangement.
 *
 * What this asks is not that the panels are hidden but that no figure
 * belonging to CorpLex is ever printed under another company's name. So it
 * reads CorpLex's own bands and referral rates off CorpLex's console first,
 * then goes looking for those exact numbers on the other two.
 *
 *   node scripts/checksalesco.mjs
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
  window.__db = new Proxy({}, {get: () => () => {}});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove();
}, [DATA, 'Avin Mascarenhas', DATA._roles['Avin Mascarenhas'] || ['staff']]);
await page.addScriptTag({path: '/home/claude/one/web/app.js'});

console.log("one company's rules are not another's:\n");

const show = (co, tab) => page.evaluate(([c, t]) => {
  state.mode = 'console'; state.company = c; state.tab = t; render();
  const v = document.getElementById('view');
  return {text: v.innerText.replace(/\s+/g, ' ').trim(),
    rows: [...v.querySelectorAll('tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim()).join(' | '))};
}, [co, tab]);

/* What CorpLex's console says, which is the thing that must not leak. */
const rules = await show('corplex', 'salesrules');
const ptrs  = await show('corplex', 'salesptr');
ok("CorpLex's own commission bands are on its own console", rules.rows.length > 0, rules.rows.length);
ok("and CorpLex's own referral partners are on its own console", ptrs.rows.length > 0, ptrs.rows.length);

const BANDROWS = rules.rows.slice();
const PTRROWS  = ptrs.rows.slice();
const PTRNAMES = PTRROWS.map(r => r.split(' | ')[0]).filter(Boolean);

for(const co of ['poa', 'lex']){
  const label = await page.evaluate(([c]) => (DATA.companies[c] || {}).name, [co]);

  const r = await show(co, 'salesrules');
  ok(`${label} is not shown CorpLex's bands`,
     !BANDROWS.some(x => r.rows.includes(x)), r.rows.slice(0, 3));
  ok(`and ${label} is told why the page is empty`,
     new RegExp(label + ' has no commission rules', 'i').test(r.text), r.text.slice(0, 140));
  ok(`and the panel is labelled ${label} rather than CorpLex`,
     r.text.indexOf(label) >= 0, r.text.slice(0, 80));

  const p = await show(co, 'salesptr');
  ok(`${label} is not shown CorpLex's referral clients`,
     !PTRNAMES.some(x => p.text.includes(x)), PTRNAMES.filter(x => p.text.includes(x)));
  ok(`and ${label} is told why that page is empty too`,
     new RegExp(label + ' has no referral partners', 'i').test(p.text), p.text.slice(0, 140));

  /* The old panel carried a pill reading "CorpLex only" while showing
   * CorpLex's table on POA's console — a label arguing with the thing under
   * it. Whatever the page says now, it must not say that. */
  ok(`and ${label} is not handed a panel labelled for another company`,
     !/CorpLex only/i.test(p.text), p.text.slice(0, 120));
}

/* Back on CorpLex, everything is where it was — a scoping change that quietly
 * emptied the page it was meant to protect would be the worse bug. */
const again = await show('corplex', 'salesrules');
ok("CorpLex still has its bands after all that",
   BANDROWS.every(x => again.rows.includes(x)), again.rows.slice(0, 3));
const againP = await show('corplex', 'salesptr');
ok('and its referral partners', PTRNAMES.every(x => againP.text.includes(x)), againP.rows.slice(0, 3));

fs.mkdirSync('/tmp/look', {recursive: true});
await show('poa', 'salesrules');
await page.screenshot({path: '/tmp/look/salesco.png', fullPage: true});

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log("no company is shown another company's commission or referral arrangements");
