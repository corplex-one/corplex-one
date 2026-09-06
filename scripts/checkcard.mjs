/* The person card: three rows of three, and who is shown the third.
 *
 *   'A new looking profile view for Miraziz and me: 1. Boxes should be
 *    parallel, the header and bottom line of the boxes should be equivalent
 *    2. Some issue with the personal mobile (see the code next to it)
 *    3. Salary details 4. Leave details 5. Visa Details ... So the boxes now
 *    will be 3+3+3'
 *   'And it should be viewed only by Miraziz and me'
 *
 * Five things, and the third is the one that would be a disaster to get wrong:
 *
 *   1. THE BOXES ARE PARALLEL. Both rows carried `gtop` — align-items:start —
 *      so every box shrank to its own content and no two bottom lines agreed.
 *      Asserted as arithmetic on the rendered page rather than by eye: same
 *      top, same height, same bottom, across each row.
 *
 *   2. NO MARKUP IS PRINTED AS TEXT. The helper decided whether a value was
 *      already HTML by testing whether it STARTED with '<'. The personal email
 *      began '<a href=' and passed; the personal mobile began with the number
 *      and merely contained the pill, so the whole string was escaped and the
 *      tag came out on screen. The assertion is the general one — no tag text
 *      anywhere on the card — because the next value with markup in the middle
 *      would have failed the same way.
 *
 *   3. THE THIRD ROW IS ACCOUNTS AND THE OWNER, AND NOBODY ELSE. Pay, leave
 *      and visa expiry. A manager sees six boxes; so does everybody else. This
 *      checks the words as well as the boxes: a salary that leaked as text
 *      somewhere else on the card would pass a test that only counted panels.
 *
 *   4. THE FIGURES ARE THE PORTAL'S OWN. The salary is what salParts says, the
 *      balance is what leaveBal says, the expiry is what the documents hold. A
 *      box that invents a number is worse than no box.
 *
 *   5. THE FOOT OF THE CARD TELLS THE TRUTH. It used to promise that pay is
 *      never on this page. For a colleague it still is; for accounts it is not,
 *      and the sentence changes rather than standing there false.
 *
 *   node scripts/checkcard.mjs
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
const one  = (s, u) => { const L = raw(s, u).trim().split('\n'); return L[L.length - 1]; };
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
     and not exists (select 1 from employee_roles x where x.employee_id = e.id and x.role = 'accounts')
   order by e.full_name limit 1) t`)[0];
const MGR = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
    join employee_roles r on r.employee_id = e.id and r.role = 'manager'
   where e.active and e.auth_user_id is not null
     and not exists (select 1 from employee_roles x
                      where x.employee_id = e.id and x.role in ('accounts','owner'))
   order by e.full_name limit 1) t`)[0];
/* The subject: somebody with a salary, so the pay box has something in it.
 * A full profile is not required — the middle row stands down when there is
 * nothing in it and the third row is drawn either way. */
const SUBJ = json(`select coalesce(json_agg(t),'[]') from (
  select e.full_name from employees e
    join salary_parts s on s.employee_id = e.id and s.company = ''
   where e.active and e.payroll_basis::text = 'salaried'
     and e.full_name <> '${AVIN.full_name}'
   order by e.full_name limit 1) t`)[0];
/* Not the subject: somebody looking at their own card sees more of it by
 * right, so a viewer who happened to be the subject would test nothing. */
const STAFF = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
   where e.active and e.auth_user_id is not null
     and e.full_name <> '${SUBJ.full_name}'
     and not exists (select 1 from employee_roles r where r.employee_id = e.id
                       and r.role in ('accounts','owner','manager'))
   order by e.full_name limit 1) t`)[0];
const COMM = one(`select full_name from employees where payroll_basis::text = 'commission'
                   and active order by full_name limit 1`);
const OFF  = one(`select full_name from employees where payroll_basis::text = 'off'
                   and active order by full_name limit 1`);

console.log(`\nthe card of ${SUBJ.full_name}, opened by four different people\n`);

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
async function card(viewer, subject){
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
      `) t`, viewer.auth_user_id)[0]}, viewer.id);
  const page = await b.newPage({viewport: {width: 1600, height: 1100}});
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
  }, [D, viewer.full_name, D._roles[viewer.full_name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  await page.evaluate(w => { state.mode = 'staff'; state.tab = 'people'; state.who = w; render(); }, subject);
  await page.waitForTimeout(350);
  return page;
}
const shape = p => p.evaluate(() => ({
  heads: [...document.querySelectorAll('#view section.panel > header h3')].map(h => h.textContent.trim()),
  text:  (document.getElementById('view').textContent || '').replace(/\s+/g, ' '),
  html:  document.getElementById('view').innerHTML,
  rows:  [...document.querySelectorAll('#view .grid.g3')].map(g =>
           [...g.children].filter(c => c.matches('section.panel')).map(c => {
             const r = c.getBoundingClientRect();
             const h = c.querySelector('header');
             const hr = h ? h.getBoundingClientRect() : {bottom: 0};
             return {top: Math.round(r.top), bottom: Math.round(r.bottom),
                     head: Math.round(hr.bottom - r.top)};
           }))
}));

// ---------------------------------------------------------------- accounts
console.log('accounts:\n');
let p = await card(AVIN, SUBJ.full_name);
let S = await shape(p);

/* Three rows of three, always. The middle boxes used to be drawn only where
 * there was something in them, which produced 3+1+3 and sometimes 3+3 —
 * Avin: 'If they have not filled the details, still show the boxes with
 * heading'. An empty one carries a line saying so. */
ok('there are three rows of boxes', S.rows.length === 3, S.rows.map(r => r.length));
ok('and every one of them holds three',
   S.rows.every(r => r.length === 3), S.rows.map(r => r.length));

/* Point 1, as arithmetic. Same top, same bottom, and the header rule at the
 * same height in every box of a row — which is what 'the header and bottom
 * line of the boxes should be equivalent' asks for. */
S.rows.forEach((row, i) => {
  const same = k => row.every(x => Math.abs(x[k] - row[0][k]) <= 1);
  ok(`row ${i + 1}: the boxes start level`, same('top'), row.map(x => x.top));
  ok(`row ${i + 1}: and end level`, same('bottom'), row.map(x => x.bottom));
  ok(`row ${i + 1}: with the header rule at the same height`, same('head'), row.map(x => x.head));
});

console.log('');
for(const h of ['What they are paid', 'Leave and air tickets', 'Visa and documents'])
  ok(`the ${h.toLowerCase()} box is there`, S.heads.includes(h), S.heads);

/* Point 2. Not "the mobile is fixed" but "no tag is printed as text", which is
 * the fault rather than the symptom. */
ok('no markup is printed as text anywhere on the card',
   !/&lt;(span|a|b|div)\b/i.test(S.html) && !/<span class="pill/.test(S.text),
   (S.text.match(/.{0,30}<span.{0,30}/) || [''])[0]);
ok('and the personal mobile’s pill is a real element',
   await p.evaluate(() => {
     const dt = [...document.querySelectorAll('#view dt')].find(x => /Personal mobile/i.test(x.textContent));
     if(!dt) return 'no mobile on this card';          // fine: nothing on file
     const dd = dt.nextElementSibling;
     return !!dd.querySelector('span.pill') && !/<span/.test(dd.textContent);
   }).then(v => v === true || v === 'no mobile on this card', undefined));

/* Point 4 — the figures are the portal's own, not a second opinion. */
console.log('');
const truth = await p.evaluate(w => {
  const S = salParts(w), B = leaveBal(w), D = (HR().docs || {})[w] || {};
  return {salary: S && S.salary, left: B.left, visa: D.visa || '',
          from: S && S.co && S.co[0] ? S.co[0].from : ''};
}, SUBJ.full_name);
ok('the salary shown is what salParts says',
   S.text.includes('AED ' + truth.salary.toLocaleString('en-AE', {minimumFractionDigits:2, maximumFractionDigits:2})),
   {want: truth.salary, saw: (S.text.match(/Current salary AED [\d,.]+/) || [''])[0]});
ok('and it is dated from the row in force',
   !truth.from || S.text.includes(truth.from), truth.from);
ok('the leave balance shown is what leaveBal says',
   S.text.includes(truth.left.toFixed(1) + ' days'),
   {want: truth.left, saw: (S.text.match(/balance [\d.]+ days/) || [''])[0]});
ok('the visa line is what the documents hold',
   truth.visa ? S.text.includes(String(truth.visa).slice(0, 4))
              : /Residency visa\s*.{0,3}\s*not on file/.test(S.text),
   {visa: truth.visa, saw: (S.text.match(/Residency visa[^A-Z]{0,30}/) || [''])[0]});

/* Point 5 — the foot of the card. */
ok('the foot says the three boxes are not a colleague’s to see',
   /three below the line are yours and the owner/i.test(S.text), S.text.slice(-260));
ok('and no longer claims pay is never on this page',
   !/pay and the year of somebody.{0,3}s birth are not on it and never are/i.test(S.text));
await p.close();

// ------------------------------------------------------------------- owner
if(OWNER){
  console.log('\nthe owner:\n');
  p = await card(OWNER, SUBJ.full_name);
  S = await shape(p);
  ok('sees the same three rows of three',
   S.rows.length === 3 && S.rows.every(r => r.length === 3), S.rows.map(r => r.length));
  ok('including what they are paid', S.heads.includes('What they are paid'), S.heads);
  await p.close();
} else ok('there is an owner to test with', false);

// ------------------------------------------------- a manager, and everybody else
for(const [label, u] of [['a manager', MGR], ['an ordinary colleague', STAFF]]){
  if(!u){ ok(`there is ${label} to test with`, false); continue; }

  console.log(`\n${label} (${u.full_name}):\n`);
  p = await card(u, SUBJ.full_name);
  S = await shape(p);
  /* One row now, not two. The second row was Where they live / Back home / In
     an emergency, which are built from the private table and answer only the
     person and accounts — so for anybody else they were three empty boxes
     saying 'Nothing on file yet' about a profile that might be full, with a
     line underneath announcing how much of it was still to go. Avin, asked
     whether to reword them or drop them: 'Of course 3' — drop them. */
  ok('gets one row of three, not a second row of empty boxes',
     S.rows.length === 1 && S.rows[0].length === 3, S.rows.map(r => r.length));
  for(const h of ['Where they live', 'Back home', 'In an emergency'])
    ok(`no “${h}” box`, !S.heads.includes(h), S.heads);
  ok('and nothing claiming the box is empty', !/Nothing on file yet/.test(S.text));
  ok('nor a count of what that person has still to fill in',
     !/has not filled in a profile yet/.test(S.text),
     (S.text.match(/.{0,50}not filled in a profile.{0,30}/) || [''])[0]);
  for(const h of ['What they are paid', 'Leave and air tickets', 'Visa and documents'])
    ok(`no “${h}” box`, !S.heads.includes(h), S.heads);
  /* Not just the boxes: the figures themselves must not be anywhere on the
   * page. A panel can be hidden and its number still printed elsewhere. */
  ok('and no salary figure anywhere on the card',
     !new RegExp(String(truth.salary).replace('.', '\\.')).test(S.text.replace(/,/g, ''))
     && !/Current salary/i.test(S.text),
     (S.text.match(/.{0,40}salary.{0,40}/i) || [''])[0]);
  ok('nor a leave balance, nor a visa expiry',
     !/Annual leave balance/i.test(S.text) && !/Residency visa/i.test(S.text));
  ok('the foot still promises them pay is never on this page',
     /pay and the year of somebody.{0,3}s birth are not on it and never are/i.test(S.text),
     S.text.slice(-200));
  await p.close();
}

// ------------------------------------------- the two who have no salary at all
console.log('\nsomebody who is not on a salary:\n');
if(COMM){
  p = await card(AVIN, COMM);
  S = await shape(p);
  ok(`${COMM} reads as commission only, not as nought`,
     /Commission only/i.test(S.text) && !/Current salary AED 0/.test(S.text),
     (S.text.match(/On payroll as[^A-Z]{0,60}/) || [''])[0]);
  await p.close();
} else ok('there is a commission-only person to test with', false);
if(OFF){
  p = await card(AVIN, OFF);
  S = await shape(p);
  ok(`${OFF} reads as not on payroll`,
     /Not on payroll/i.test(S.text) && !/Current salary AED 0/.test(S.text),
     (S.text.match(/On payroll as[^A-Z]{0,60}/) || [''])[0]);
  await p.close();
} else ok('there is somebody off payroll to test with', false);

await b.close();
server.close();
console.log(`\n${n} checks`);
if(bad.length){ console.log('\n' + bad.map(x => '  FAIL ' + x).join('\n')); process.exit(1); }
console.log('three rows of three, level, with the third row for accounts and the owner alone');
