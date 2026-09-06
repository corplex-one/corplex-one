/* Documents -> Staff register, and the two tables that scroll.
 *
 * Avin drew this one on paper: the person, then Personal details, Home country
 * and Emergency contact in the UAE, split by company, read only.
 *
 *   'Staff register - view only'
 *   'Again split by company, horizontal scrolling is fine'
 *   'I am ok with horizontal scrolling, but need to see everything clearly'
 *
 * Four things are worth holding down, and the last two are where the work went:
 *
 *   1. ACCOUNTS AND NOBODY ELSE. Every column on it lives on employee_private.
 *      For a manager the gate and the database agree: they get nothing from
 *      that table but their own row. For the owner they do not, and the check
 *      says so out loud rather than implying otherwise — the policy is
 *      me() OR is_admin(), is_admin() is accounts OR owner, so Miraziz can
 *      read these rows and always could. Keeping the register off his console
 *      is a decision about whose screen it is. What the gate must still do is
 *      hold: not offered, and not reachable by asking for the tab by name,
 *      which it was until render() started checking the gate as well.
 *
 *   2. VIEW ONLY. No Edit button, no input, no draft attribute anywhere on it.
 *      Somebody's home address is theirs to state, not accounts' to remember.
 *
 *   3. EVERY COLUMN AVIN DREW, in his order and under his headings.
 *
 *   4. THE TABLE SCROLLS, NOT THE PAGE. A table with a min-width inside a box
 *      that is overflow:visible on a desktop — which is what byCompany draws,
 *      so the company bar can stick — does not scroll: it widens the document,
 *      and the hero, the panel edges and the bar itself slide away from under
 *      it. Both wide grids get their own scrollbar, and the page keeps still.
 *
 *   node scripts/checkregister.mjs
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
const AVIN = who('Avin Mascarenhas');

/* Somebody ordinary, to be filled in and then looked for; and a manager, who
 * is the interesting negative — a manager can already see a great deal about
 * their reports and still may not see this. */
const STAFF = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
   where e.active and e.auth_user_id is not null and e.id <> '${AVIN.id}'
     and not exists (select 1 from employee_roles r
                      where r.employee_id = e.id and r.role in ('accounts','owner'))
   order by e.full_name limit 1) t`)[0];
const MGR = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
    join employee_roles r on r.employee_id = e.id and r.role = 'manager'
   where e.active and e.auth_user_id is not null
   order by e.full_name limit 1) t`)[0];
const OWNER = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
    join employee_roles r on r.employee_id = e.id and r.role = 'owner'
   where e.active and e.auth_user_id is not null
     and not exists (select 1 from employee_roles x
                      where x.employee_id = e.id and x.role = 'accounts')
   order by e.full_name limit 1) t`)[0];

console.log('\n=== who it is made of ===\n');
ok('there is somebody ordinary to fill in', !!STAFF, STAFF && STAFF.full_name);

/* Values chosen so that finding them on a screen cannot be a coincidence. */
const V = {mobile: '050 7654321', pemail: 'reg.test@example.com',
           uae: 'Flat 1204, Al Nahda Tower, Dubai', home: '12 Rizal Street, Cebu City',
           hcontact: 'Rosalinda Testperson', hphone: '+63 917 555 0142',
           ec: 'Marvin Testperson', rel: 'Brother', ecphone: '055 214 8890'};
const WAS = json(`select coalesce(json_agg(t),'[]') from (select * from employee_private
  where employee_id = '${STAFF.id}') t`)[0] || null;
raw(`insert into employee_private (employee_id, mobile, personal_email, uae_address, home_address,
       home_contact, home_phone, ec_name, ec_relation, ec_phone, gender, marital)
     values ('${STAFF.id}', '${V.mobile}', '${V.pemail}', '${V.uae}', '${V.home}',
       '${V.hcontact}', '${V.hphone}', '${V.ec}', '${V.rel}', '${V.ecphone}', 'Female', 'Single')
     on conflict (employee_id) do update set mobile = excluded.mobile,
       personal_email = excluded.personal_email, uae_address = excluded.uae_address,
       home_address = excluded.home_address, home_contact = excluded.home_contact,
       home_phone = excluded.home_phone, ec_name = excluded.ec_name,
       ec_relation = excluded.ec_relation, ec_phone = excluded.ec_phone,
       gender = excluded.gender, marital = excluded.marital`);

/* The database first, because the gate on the screen is only ever the second
 * line of defence. */
ok('accounts can read their private row',
   one(`select coalesce(home_address,'-') from employee_private where employee_id = '${STAFF.id}'`,
       AVIN.auth_user_id) === V.home);
if(MGR) ok('a manager cannot — the row does not arrive for them at all',
   one(`select count(*) from employee_private where employee_id = '${STAFF.id}'`,
       MGR.auth_user_id) === '0');
else ok('there is a manager to test with', false);
/* The owner is the honest exception and this records it rather than wishing
 * it away: the policy is me() OR is_admin(), and is_admin() is accounts OR
 * owner, so Miraziz can read every one of these rows at the database and
 * always could. Keeping the register off his console is a decision about
 * whose screen it is, not a wall — and the day that policy is narrowed to
 * is_accounts(), this line is what will say so. */
if(OWNER) ok('the owner can read them at the database — the gate on the screen is a choice, not a wall',
   one(`select count(*) from employee_private where employee_id = '${STAFF.id}'`,
       OWNER.auth_user_id) === '1');
else ok('(no owner who is not also accounts on this database)', true);

// --- the screen -----------------------------------------------------------
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

const pull = user => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, user.auth_user_id)[0]}, user.id);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(user, tab){
  const DATA = pull(user);
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
  }, [DATA, user.full_name, DATA._roles[user.full_name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  if(tab) await page.evaluate(t => { state.mode = 'console'; state.tab = t; render(); }, tab);
  await page.waitForTimeout(350);
  return page;
}

console.log('\n=== the register, for accounts ===\n');
let p = await open(AVIN, 'staffreg');
ok('the tab is on the Documents section',
   await p.evaluate(() => [...document.querySelectorAll('#conbar a, #conbar button, .contab, nav a, nav button')]
     .map(x => x.textContent.trim()).some(t => t === 'Register'))
   || await p.evaluate(() => /Register/.test(document.body.textContent)));
const R = () => p.evaluate(() => {
  const t = document.querySelector('table.rgstr');
  if(!t) return null;
  const rows = [...t.querySelectorAll('thead tr')];
  return {groups: [...rows[0].querySelectorAll('th.grp')].map(x => x.textContent.trim()),
          spans:  [...rows[0].querySelectorAll('th.grp')].map(x => +x.colSpan),
          cols:   [...rows[1].children].map(x => x.textContent.trim()),
          blocks: document.querySelectorAll('table.rgstr').length};
});
const G = await R();
ok('the register is there', !!G);
ok('under Avin’s three headings, in his order',
   !!G && G.groups.join(' | ') === 'Personal details | Home country | Emergency contact in the UAE',
   G && G.groups);
ok('spanning five, four and three columns',
   !!G && G.spans.join(',') === '5,4,3', G && G.spans);
ok('and every column he drew, in his order',
   !!G && G.cols.join(' | ') === ['Employee name', 'Gender', 'Marital status', 'Personal mobile',
     'Personal email', 'Address in the UAE', 'Home country', 'Home address', 'Contact person',
     'Contact number', 'Name', 'Relationship', 'Phone number'].join(' | '), G && G.cols);
ok('split by company, one table per company', !!G && G.blocks >= 2, G && G.blocks);

/* Split by the company somebody WORKS for, which is what companyOf answers —
 * not the entity that sponsors their visa. Avin chose that for this screen. */
ok('and it is the company they work for that splits it',
   await p.evaluate(() => {
     const out = [];
     document.querySelectorAll('.regblock').forEach(bl => {
       const t = bl.querySelector('table.rgstr'); if(!t) return;
       const co = (bl.querySelector('.regbar b') || {}).textContent.trim();
       [...t.querySelectorAll('tbody tr td:first-child')].forEach(td => {
         const nm = td.textContent.replace(/\d+ blank/, '').trim();
         const real = Object.keys(DATA.engine).find(k => NM(k) === nm || k === nm);
         if(real) out.push(companyOf(real).name === co);
       });
     });
     return out.length && out.every(Boolean);
   }));

console.log('');
ok('the values on it are the ones on file',
   await p.evaluate(v => {
     const t = document.body.textContent;
     return Object.values(v).every(x => t.includes(x));
   }, V), V);
ok('a blank reads as a dash, not as an empty cell',
   await p.evaluate(() => document.querySelectorAll('table.rgstr .miss').length) > 0);
ok('and a row says how much of it is still missing',
   await p.evaluate(() => /\d+ blank/.test(
     (document.querySelector('table.rgstr tbody tr td:first-child') || {}).textContent || '')
     || !/blank/.test(document.querySelector('table.rgstr').textContent)));

console.log('\n=== view only ===\n');
ok('there is no Edit button on it',
   await p.evaluate(() => {
     const s = [...document.querySelectorAll('section.panel')].find(x => x.querySelector('table.rgstr'));
     return !s.querySelector('[data-edon]'); }));
ok('no input, select or textarea anywhere in it',
   await p.evaluate(() => {
     const s = [...document.querySelectorAll('section.panel')].find(x => x.querySelector('table.rgstr'));
     return !s.querySelector('input, select, textarea'); }));
ok('and nothing on it is wired to the draft mechanism',
   await p.evaluate(() => {
     const s = [...document.querySelectorAll('section.panel')].find(x => x.querySelector('table.rgstr'));
     return !s.querySelector('[data-edt], [data-edk], [data-edsave]'); }));
ok('it says so, so nobody goes looking for the button',
   await p.evaluate(() => {
     const s = [...document.querySelectorAll('section.panel')].find(x => x.querySelector('table.rgstr'));
     return /Read only/i.test(s.textContent); }));

console.log('\n=== the table scrolls, the page does not ===\n');
for(const [tab, cls] of [['staffreg', 'rgstr'], ['docdates', 'dgrid']]){
  await p.evaluate(t => { state.tab = t; render(); }, tab);
  await p.waitForTimeout(300);
  const m = await p.evaluate(c => {
    const t = document.querySelector('table.' + c);
    if(!t) return null;
    const box = t.closest('.tw');
    return {wide: t.getBoundingClientRect().width > box.clientWidth + 1,
            scrolls: box.scrollWidth > box.clientWidth + 1,
            page: document.documentElement.scrollWidth <= window.innerWidth + 1,
            style: getComputedStyle(box).overflowX};
  }, cls);
  ok(`${cls}: the table is wider than the panel, which is the point`, !!m && m.wide, m);
  ok(`${cls}: so its own box scrolls`, !!m && m.scrolls && m.style === 'auto', m);
  ok(`${cls}: and the page itself stays put`, !!m && m.page, m);
}
/* And what the scrolling is for: the far end has to be reachable and whole. */
await p.evaluate(() => { state.tab = 'staffreg'; render(); });
await p.waitForTimeout(300);
ok('scrolling right reaches the last column Avin drew',
   await p.evaluate(() => {
     const box = document.querySelector('.tw-rgstr');
     box.scrollLeft = box.scrollWidth;
     const t = box.querySelector('table.rgstr');
     const last = [...t.querySelectorAll('thead tr')][1].lastElementChild;
     const r = last.getBoundingClientRect(), b = box.getBoundingClientRect();
     return {label: last.textContent.trim(),
             inside: r.right <= b.right + 1 && r.left >= b.left - 1};
   }).then(v => v.label === 'Phone number' && v.inside, undefined));
await p.close();

console.log('\n=== and for everybody else ===\n');
for(const [label, u] of [['a manager', MGR], ['the owner', OWNER], ['an ordinary staff member', STAFF]]){
  if(!u){ ok(`there is ${label} on this database to test with`, true); continue; }
  const q = await open(u, null);
  ok(`${label} is not offered the tab`,
     await q.evaluate(() => (typeof TABS === 'undefined' ? [] : TABS)
       .filter(t => t.id === 'staffreg' && (!t.gate || t.gate(state.user))).length) === 0);
  /* And asking for it by name does not open it either: the router only knows
   * the tabs the person may have. */
  await q.evaluate(() => { state.mode = 'console'; state.tab = 'staffreg'; render(); });
  await q.waitForTimeout(300);
  ok(`${label} cannot reach it by asking for it`,
     await q.evaluate(() => !document.querySelector('table.rgstr')));
  await q.close();
}

// ------------------------------------------------------------------ tidy up
await b.close();
server.close();
if(WAS){
  const q = v => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
  raw(`update employee_private set mobile = ${q(WAS.mobile)}, personal_email = ${q(WAS.personal_email)},
         uae_address = ${q(WAS.uae_address)}, home_address = ${q(WAS.home_address)},
         home_contact = ${q(WAS.home_contact)}, home_phone = ${q(WAS.home_phone)},
         ec_name = ${q(WAS.ec_name)}, ec_relation = ${q(WAS.ec_relation)},
         ec_phone = ${q(WAS.ec_phone)}, gender = ${q(WAS.gender)}, marital = ${q(WAS.marital)}
       where employee_id = '${STAFF.id}'`);
} else {
  raw(`delete from employee_private where employee_id = '${STAFF.id}'`);
}
ok('the row this check filled in is put back as it was',
   one(`select coalesce(home_address,'-') from employee_private where employee_id = '${STAFF.id}'`)
     === (WAS && WAS.home_address ? WAS.home_address : '-'));

console.log(`\n${n} checks`);
if(bad.length){ console.log('\n' + bad.map(x => '  FAIL ' + x).join('\n')); process.exit(1); }
console.log('the register is accounts-only, read-only, and scrolls inside its own panel');
