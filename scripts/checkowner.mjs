/* What the owner's console holds, and what it no longer does.
 *
 *   Avin: 'Remove the tabs from Miraziz / Attendance -> Office only /
 *   Sales -> Totally / Staff -> Emails / Documents -> Totally / He doesnt
 *   need to see every tab - its more of backend'
 *
 * Nine screens came off. They are the ones that configure the portal rather
 * than tell the owner anything about the firm, and the two sections he could
 * see nothing in any more went with them.
 *
 * Three things are asserted, and the second is the one that matters:
 *
 *   1. HIS CONSOLE IS WHAT AVIN ASKED FOR. Named screen by screen, in both
 *      directions — what is gone and what is still there. A list that only
 *      checks the absences passes just as well when everything has vanished.
 *
 *   2. AND IT CANNOT BE WALKED AROUND. A gate that only decides whether a tab
 *      is drawn is not a gate: state.tab could be set to any console screen by
 *      a link or a bookmark and render() drew it, because the only thing it
 *      checked was that the person could open the console at all. That was
 *      harmless while every console screen was gated identically. It stopped
 *      being harmless the moment one of them was not.
 *
 *   3. ACCOUNTS IS UNTOUCHED. The point was to shorten one person's console,
 *      not to lose screens.
 *
 * What this does NOT assert, because it is not true: that the owner is denied
 * the data. He is is_admin() at the database and can read every table behind
 * these pages. This is a console that fits the person, and saying otherwise
 * in a check would be worse than not checking.
 *
 *   node scripts/checkowner.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
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

const bad = []; let n = 0;
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`); };

const who = nm => json(`select coalesce(json_agg(t),'[]') from (select id, auth_user_id, full_name
  from employees where full_name = '${nm}') t`)[0];
const AVIN  = who('Avin Mascarenhas');
const OWNER = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
    join employee_roles r on r.employee_id = e.id and r.role = 'owner'
   where e.active and e.auth_user_id is not null
     and not exists (select 1 from employee_roles x
                      where x.employee_id = e.id and x.role = 'accounts')
   order by e.full_name limit 1) t`)[0];

const TYPES = {'.html':'text/html', '.js':'text/javascript', '.png':'image/png',
               '.json':'application/json', '.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  const f = path.join('web', decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('no'); }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  res.end(fs.readFileSync(f));
});
await new Promise(k => server.listen(0, '127.0.0.1', k));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(user){
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
      `) t`, user.auth_user_id)[0]}, user.id);
  const page = await b.newPage({viewport: {width: 1500, height: 1100}});
  await page.route('**://fonts.*/**', r => r.abort());
  page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });
  await page.goto(ORIGIN + '/index.html');
  await page.evaluate(([d, nm, roles]) => {
    window.__DATA = d; window.__ME = nm; window.__ROLES = roles; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => {
      window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove();
  }, [D, user.full_name, D._roles[user.full_name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  await page.evaluate(() => { state.mode = 'console'; state.tab = 'payroll'; render(); });
  await page.waitForTimeout(300);
  return page;
}

const console_of = p => p.evaluate(() => ({
  role: roleOf(state.user),
  sections: liveSections().map(x => x[1]),
  ids: CONTABS().map(t => t.id),
  secOf: Object.fromEntries(CONTABS().map(t => [t.id, t.sec])),
  labelOf: Object.fromEntries(CONTABS().map(t => [t.id, t.label]))
}));

if(!OWNER){
  ok('there is an owner on this database who is not also accounts', false);
} else {

console.log(`\nthe owner's console (${OWNER.full_name}):\n`);
let p = await open(OWNER);
const O = await console_of(p);
ok('he is the owner', O.role === 'owner', O.role);

/* The nine that came off, named. */
const GONE = {
  office:     'where the office is measured from',
  salestpl:   'the sales upload template',
  salesrules: 'the commission rules',
  salesstaff: 'the sales staff accounts',
  salesptr:   'the referral partners',
  digest:     'which emails the portal sends',
  docsadmin:  'document expiry',
  docdates:   'staff documents',
  profiles:   'profile completeness'
};
/* And what is left, which matters just as much: a check that only counts
 * absences passes when the console is empty. */
const KEPT = {
  payroll:    'the payroll',
  payslips:   'the payslips',
  tickets:    'the air tickets',
  gratuity:   'the gratuity provision',
  hradmin:    'attendance',
  regular:    'regularization',
  shifts:     'shifts and reporting lines',
  holidays:   'the public holidays',
  leavebal:   'the annual leave balances',
  leaveother: 'the leave balances',
  probation:  'probation'
};

for(const [id, what] of Object.entries(GONE))
  ok(`${what} is off his console`, !O.ids.includes(id), O.ids);
console.log('');
for(const [id, what] of Object.entries(KEPT))
  ok(`${what} is still there`, O.ids.includes(id), O.ids);

console.log('');
ok('Sales has nothing left in it, so the heading goes too',
   !O.sections.includes('Sales'), O.sections);
ok('and so does Documents',
   !O.sections.includes('Documents'), O.sections);
/* Staff went too, but not because he lost anything: it was dissolved for
 * everybody, its three screens moved to Pay, People and a new Notifications
 * section. Avin: 'Console should look like this. This i feel is the correct
 * way.' */
ok('Pay and People are what he is left with',
   O.sections.join(', ') === 'Pay, People', O.sections);
ok('and Staff is gone from everybody’s console, not only his',
   !O.sections.includes('Staff'), O.sections);

/* The part a list of tabs cannot tell you. */
console.log('\nand asking for one by name:\n');
for(const id of Object.keys(GONE)){
  const landed = await p.evaluate(t => {
    state.mode = 'console'; state.tab = t; render(); return state.tab;
  }, id);
  await p.waitForTimeout(80);
  ok(`#c/${id} does not open it`, landed !== id, landed);
}
ok('it lands on a screen he does have rather than on nothing',
   await p.evaluate(() => CONTABS().some(t => t.id === state.tab)));
ok('and the screen it landed on drew something',
   await p.evaluate(() => (document.getElementById('view').textContent || '').trim().length > 40));
await p.close();
}

// ---------------------------------------------------------------- accounts
console.log('\nand accounts, who should have lost nothing:\n');
let a = await open(AVIN);
const A = await console_of(a);
/* Documents became Register when Staff Records joined it — the section holds a
   person's employment record now, not only their papers. */
ok('every section is still there',
   A.sections.join(', ') === 'Pay, People, Sales, Register, Notifications', A.sections);
/* Where the three orphans went. */
ok('Probation is under Pay',
   (A.ids.includes('probation') && A.secOf.probation) === 'pay', A.secOf && A.secOf.probation);
ok('Add somebody is under People',
   (A.ids.includes('addstaff') && A.secOf.addstaff) === 'people', A.secOf && A.secOf.addstaff);
ok('and Emails is Notifications \u2192 Email',
   (A.ids.includes('digest') && A.secOf.digest) === 'notif' && A.labelOf.digest === 'Email',
   {sec: A.secOf && A.secOf.digest, label: A.labelOf && A.labelOf.digest});
for(const id of ['office','salestpl','salesrules','salesstaff','salesptr','digest',
                 'docsadmin','docdates','profiles','staffreg','revisions','onpay','exits'])
  ok(`${id} is still on Avin’s console`, A.ids.includes(id), A.ids);
await a.close();

await b.close();
server.close();
console.log(`\n${n} checks`);
if(bad.length){ console.log('\n' + bad.map(x => '  FAIL ' + x).join('\n')); process.exit(1); }
console.log("the owner's console is the short one, it cannot be walked around, and accounts kept everything");
