/* Nobody falls out of the organisation chart, and study leave is paid.
 *
 * #10. Empty departments were hidden from the tree, and Avin asked the right
 * question about it: 'did we miss someone?' Hiding a group is safe only if
 * every group that holds a person is still drawn — otherwise the fix quietly
 * removes people, and a chart is exactly the place nobody would notice,
 * because you do not miss a face you were not shown.
 *
 * So this counts. Every name on the roster has to appear in exactly one tree,
 * once, and the three trees together have to add up to the roster.
 *
 * #26 rides along: Avin confirmed study leave is paid, so the policy page and
 * the balances table both have to say so.
 *
 *   node scripts/checkorgtree.mjs
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
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company',
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

console.log('the organisation chart, and who is on it:\n');

await page.evaluate(() => { state.mode = 'staff'; state.tab = 'people'; state.peopleTab = 'org'; render(); });
await page.waitForTimeout(400);

const T2 = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('#view section.panel')];
  const trees = panels.filter(p => p.querySelector('.ot')).map(p => ({
    co: (p.querySelector('h3') || {}).textContent.trim(),
    said: (p.querySelector('.hint') || {}).textContent.trim(),
    // one card per person, whatever the tree does around them
    names: [...p.querySelectorAll('.ot [data-who]')].map(x => x.dataset.who),
    depts: [...p.querySelectorAll('.ot .otdept, .ot .otd')].map(x => x.textContent.trim())
  }));
  return {trees, roster: USERS.map(u => u.name),
    coOf: Object.fromEntries(USERS.map(u => [u.name, ((HR().orgCo||{})[u.name]) || companyOf(u.name).key])),
    deptOfAll: Object.fromEntries(USERS.map(u => [u.name, orgDeptOf(u.name) || ''])),
    text: document.getElementById('view').innerText};
});

ok('there is a tree for each company', T2.trees.length === 3, T2.trees.map(t => t.co));

/* The question he asked, answered by counting rather than by looking. */
const seen = [].concat(...T2.trees.map(t => t.names));
const missing = T2.roster.filter(r => !seen.includes(r));
ok('every single person on the roster is on a tree', missing.length === 0,
   missing.map(m => [m, T2.coOf[m], T2.deptOfAll[m] || 'no department']));

/* The owner heads all three companies and sits above each tree rather than
 * inside a department, so he is the one person who appears three times. That
 * is the design; everybody else appearing twice would be a bug. */
const OWNER = await page.evaluate(() => (USERS.find(u => u.role === 'owner') || {}).name || '');
const seenNot = seen.filter(x => x !== OWNER);
const dupes = seenNot.filter((x, i) => seenNot.indexOf(x) !== i);
ok('and nobody but the owner is on one twice', dupes.length === 0, [...new Set(dupes)]);
ok('while the owner heads all three, as the page says he does',
   T2.trees.every(t => t.names.includes(OWNER)),
   T2.trees.map(t => [t.co, t.names.includes(OWNER)]));

/* Each company's tree holds that company's people and no others. */
for(const t of T2.trees){
  const wrong = t.names.filter(x => x !== OWNER && DATA_CO(t.co) && T2.coOf[x] !== DATA_CO(t.co));
  ok(`${t.co}'s tree holds only ${t.co}'s people`, wrong.length === 0, wrong.slice(0, 4));
}
function DATA_CO(label){
  const m = {'CorpLex':'corplex', 'POA':'poa', 'Lex Estates':'lex'};
  return m[label] || null;
}

/* The count in the header has to be the count on the page, or the header is
 * the thing people will trust and the page is the thing that is true. The
 * owner is counted where he belongs and nowhere else. */
for(const t of T2.trees){
  const said = +(t.said.match(/^(\d+)/) || [])[1];
  const own = t.names.filter(x => T2.coOf[x] === DATA_CO(t.co)).length;
  ok(`${t.co} says ${said} and has ${own} of its own`, said === own, [said, own, t.names.length]);
}
ok('and the page explains why the owner is on every tree',
   /heads all three companies/.test(T2.text), T2.text.slice(-260));

/* This used to assert that a group called 'No department set' appeared on
   exactly the trees that needed one. Avin: 'remove no department set (i have
   asked this a 1000 times)'. It was never a department — it was a heading the
   chart invented over people whose record is simply incomplete, which labels
   the person rather than the gap. So the assertion is inverted: no tree has
   one, on any company, whoever is missing a department. */
ok('no tree invents a department to file people under',
   T2.trees.every(t => !/No department/i.test(t.depts.join(' | '))),
   T2.trees.map(t => [t.co, t.depts]));

/* ------------------------------------------------- #26, study leave is paid */
await page.evaluate(() => { state.mode = 'console'; state.tab = 'leaverules'; render(); });
await page.waitForTimeout(300);
const pol = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#view tbody tr')].map(tr =>
    [...tr.children].map(td => td.textContent.trim()));
  return {rows, text: document.getElementById('view').innerText.replace(/\s+/g, ' ')};
});
const study = pol.rows.find(r => /Study/i.test(r[0] || ''));
ok('study leave is on the policy page', !!study, pol.rows.map(r => r[0]));
ok('and it is not described as unpaid',
   !!study && !/unpaid|no pay|without pay/i.test(study.join(' ')), study);
ok('and the portal itself has it as paid',
   await page.evaluate(() => (REQTYPES.find(t => t.id === 'Study') || {}).pay) === 'full',
   await page.evaluate(() => (REQTYPES.find(t => t.id === 'Study') || {}).pay));

/* ================================================ what the chart may not say
 *
 *   'And why the hell have you put "left the firm" below Miraziz name. Are you
 *    alright? You want me kicked out of the company?'
 *   'remove the orange color on sales employees and department - it creates
 *    negative impression on the staff'
 *   'remove no department set (i have asked this a 1000 times)'
 *   'Remove "earns revenue — appears in that company's performance pages ,
 *    support — does not sell, and never shows a sales figure"'        -- Avin
 *
 * The libel is the one that matters. roleOf fell back to 'former' when a name
 * was not in the roles map, ROLELABEL['former'] is 'Left the firm', and the
 * card printed the role label whenever somebody had no designation — so a
 * missing job title on the owner's record announced, to everybody, that he had
 * gone. Asserted from two directions: the words are not on the page, and the
 * function that produced them cannot produce them for anybody on the roster.
 */
console.log('\nwhat the chart says about people');
await page.evaluate(() => { state.mode = 'staff'; state.tab = 'people'; state.peopleTab = 'org'; render(); });
await page.waitForTimeout(250);
{
  const r = await page.evaluate(() => {
    const roster = USERS.map(u => u.name);
    return {
      txt: document.getElementById('view').innerText,
      rev: document.querySelectorAll('#view .rev').length,
      legend: document.querySelectorAll('#view .orglgd').length,
      formerOnRoster: roster.filter(x => roleOf(x) === 'former'),
      strangerIsFormer: roleOf('Somebody Who Never Worked Here') === 'former',
      /* everybody the chart should carry, by the name it shows them under */
      missing: roster.filter(x => x !== (USERS.find(u => u.role === 'owner') || {}).name)
                 .map(x => nm(x).replace(/<[^>]*>/g, ''))
                 .filter(shown => !document.getElementById('view').innerText.includes(shown))
    };
  });
  ok('nobody on the chart is told they left the firm', !/Left the firm/i.test(r.txt));
  ok('and roleOf cannot say it about anybody on the roster',
     r.formerOnRoster.length === 0, r.formerOnRoster);
  ok('while a name that is not on the roster still reads as former',
     r.strangerIsFormer === true);
  ok('no department or person is coloured for earning revenue', r.rev === 0, r.rev);
  ok('and the legend that explained the colour is gone', r.legend === 0, r.legend);
  ok('nothing is filed under a department called No department set',
     !/No department set/i.test(r.txt));
  ok('nor does the caption still describe either', !/earns revenue|does not sell/i.test(r.txt));
  ok('and nobody has dropped off the chart', r.missing.length === 0, r.missing);
}
{
  /* Taking somebody's department away must not take them off the chart — that
     was what the invented department was holding up. */
  const r = await page.evaluate(() => {
    const victim = USERS.map(u => u.name).find(x => orgDeptOf(x)
      && x !== (USERS.find(u => u.role === 'owner') || {}).name);
    const hr = HR();
    if(hr.staff && hr.staff[victim]) hr.staff[victim].dept = '';
    if(hr.orgDept) hr.orgDept[victim] = '';
    render();
    const t = document.getElementById('view').innerText;
    return {victim, shown: t.includes(nm(victim).replace(/<[^>]*>/g, '')),
            heading: /No department/i.test(t)};
  });
  ok('somebody with no department is still on the chart', r.shown === true, r);
  ok('and no heading is invented for them', r.heading === false, r);
}

fs.mkdirSync('/tmp/look', {recursive: true});
await page.evaluate(() => { state.mode = 'staff'; state.tab = 'people'; state.peopleTab = 'org'; render(); });
await page.waitForTimeout(250);
await page.screenshot({path: '/tmp/look/orgtree.png', fullPage: true});

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('every person on the roster is on exactly one tree, and study leave is paid');
