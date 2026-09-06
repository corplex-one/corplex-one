/* Leaving a screen, and leaving the portal.
 *
 *   'If someone logs out and log ins, default landing should be on home page
 *    and not the page where he left'
 *
 *   'If any employee opens to check some colleague profile, and then click on
 *    some other tab for some time, and again return to People, they should be
 *    on people page and not land on that same employee profile which is
 *    happening currently'                                             -- Avin
 *
 * Neither was the portal remembering anything on purpose.
 *
 * The first was the URL. The app writes the page you are on into the fragment
 * (#c/payroll) so a link can be sent to somebody; signing out reloaded the
 * page, a reload keeps the fragment, and readHash() read it back on the way in
 * — so the next person to sign in on that browser landed on the last screen the
 * previous one had open.
 *
 * The second was that only some ways of leaving People cleared the colleague
 * you had opened. The phone tab bar did, the People sub-tabs did, the sidebar
 * did not — so the same act behaved differently depending on which one you
 * used, which reads as the portal keeping something it should not.
 *
 * What has to stay true:
 *
 *   1. every way of leaving a screen leaves it behind — the opened colleague,
 *      the unfolded payslip, the drilled-into department;
 *   2. opening a colleague from somewhere else still works, because that is not
 *      leaving a screen;
 *   3. a deep link somebody is GIVEN still opens where it points;
 *   4. signing out drops the fragment, so the next sign-in starts at Home.
 *
 *   node scripts/checkleaving.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
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
 payment_requests:'payment_requests', payment_files:'payment_files', sales_members:'sales_members'};

const TYPES = {'.html':'text/html', '.js':'text/javascript', '.png':'image/png'};
const server = http.createServer((q, r) => {
  const f = path.join('web', decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if(!fs.existsSync(f)){ r.writeHead(404); return r.end('no'); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});
await new Promise(k => server.listen(0, '127.0.0.1', k));
const O = 'http://127.0.0.1:' + server.address().port;

let fails = 0, checks = 0;
const ok = (what, pass, saw) => { checks++;
  if(pass) return console.log('  ok    ' + what);
  fails++; console.log('  FAIL  ' + what + (saw === undefined ? '' : '  saw ' + JSON.stringify(saw))); };

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, hash, width){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: width || 1700, height: 1200}});
  await p.route('**://fonts.*/**', x => x.abort());
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html' + (hash || ''));
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => { window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); }, [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  await p.waitForTimeout(150);
  return {p, errs};
}

/* ============================== 1. every way of leaving leaves it behind */
console.log('\nleaving People leaves the colleague behind');
{
  const {p, errs} = await open('Shohruh Karimov');
  const r = await p.evaluate(async () => {
    const out = {};
    const openOne = () => { state.mode = 'staff'; state.tab = 'people';
      state.who = USERS.map(x => x.name).find(n => n !== state.user); render(); };

    // the sidebar — the one that did not
    openOne();
    out.opened = state.who;
    const nav = [...document.querySelectorAll('.rail [data-tab]')]
      .find(x => x.dataset.tab !== 'people');
    out.went = nav ? nav.dataset.tab : null;
    nav.click();
    out.afterNav = state.who;
    // and back to People
    [...document.querySelectorAll('.rail [data-tab]')].find(x => x.dataset.tab === 'people').click();
    out.backOn = state.tab; out.backWho = state.who;
    out.drewList = !!document.querySelector('#peopleSeg');

    /* The Back button on the profile itself — the way out that is right there
       on the screen, rather than in the sidebar. */
    openOne();
    const back = document.querySelector('[data-people-back]');
    out.hadBack = !!back;
    if(back) back.click();
    out.afterBack = state.who;

    /* The sub-tabs are only on the list — opening a colleague replaces the
       whole screen — so they are a way of moving about the list, not a way out
       of a profile. What matters is that they leave nobody opened behind. */
    const segs = [...document.querySelectorAll('#peopleSeg button')];
    out.segCount = segs.length;
    const other = segs.find(x => x.getAttribute('aria-pressed') !== 'true') || segs[1] || segs[0];
    if(other) other.click();
    out.afterSeg = state.who;
    out.segMoved = state.peopleTab;
    return out;
  });
  ok('a colleague can be opened at all', !!r.opened, r.opened);
  ok('the sidebar clears them on the way out', r.afterNav === null, [r.went, r.afterNav]);
  ok('and returning to People shows the list, not that colleague',
     r.backOn === 'people' && r.backWho === null && r.drewList, r);
  ok('the Back button on the profile is there and clears them',
     r.hadBack && r.afterBack === null, [r.hadBack, r.afterBack]);
  ok('the People sub-tabs move about the list without stranding anybody',
     r.segCount > 1 && r.afterSeg === null && !!r.segMoved, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand so does the phone');
{
  const {p, errs} = await open('Shohruh Karimov', '', 430);
  const r = await p.evaluate(async () => {
    state.mode = 'staff'; state.tab = 'people';
    state.who = USERS.map(x => x.name).find(n => n !== state.user); render();
    const before = state.who;
    const bar = [...document.querySelectorAll('[data-mtab]')].find(x => x.dataset.mtab !== 'people');
    if(bar) bar.click();
    return {before, after: state.who, had: !!bar};
  });
  ok('the tab bar is there on a phone', r.had);
  ok('and it clears the colleague as it always did', r.before && r.after === null, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand the console sections leave their screen behind too');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const r = await p.evaluate(() => {
    state.mode = 'console'; state.tab = 'payslips'; render();
    const rows = [...document.querySelectorAll('[data-slip]')];
    state.slipOpen = rows.length ? rows[0].dataset.slip : 'x'; render();
    const before = state.slipOpen;
    const sec = [...document.querySelectorAll('.ctabs [data-csec]')].find(x => x.dataset.csec !== 'pay');
    sec.click();
    return {before, after: state.slipOpen, who: state.who, dept: state.deptView};
  });
  ok('an unfolded payslip is folded away on the way out',
     r.before && r.after === null, r);
  ok('and nothing else is carried across either', r.who === null && r.dept === null, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 2. opening a colleague from elsewhere still works */
console.log('\nbut opening a colleague from somewhere else is not leaving a screen');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const r = await p.evaluate(() => {
    state.mode = 'staff'; state.tab = 'home'; render();
    const link = document.querySelector('[data-who]');
    if(!link) return {none: true};
    const want = link.dataset.who;
    link.click();
    return {want, tab: state.tab, who: state.who};
  });
  if(r.none) ok('somebody is linked to from the home page', false, r);
  else {
    ok('clicking a person takes you to People', r.tab === 'people', r);
    ok('and opens them, rather than clearing them on arrival', r.who === r.want, r);
  }
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================= 3. a deep link somebody is given still works */
console.log('\na link somebody is given still opens where it points');
{
  const {p, errs} = await open('Avin Mascarenhas', '#c/payroll');
  ok('a console link opens the console screen it names',
     await p.evaluate(() => state.mode === 'console' && state.tab === 'payroll'),
     await p.evaluate(() => [state.mode, state.tab]));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  const {p, errs} = await open('Shohruh Karimov', '#myslip');
  ok('and a staff one does too',
     await p.evaluate(() => state.mode === 'staff' && state.tab === 'myslip'),
     await p.evaluate(() => [state.mode, state.tab]));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ==================================== 4. signing out drops the fragment */
console.log('\nsigning out forgets which page it was on');
{
  const boot = fs.readFileSync('web/boot.js', 'utf8');
  ok('sign out no longer reloads, which is what kept the fragment',
     !/async signOut\(\)\s*\{[^}]*location\.reload\(\)/.test(boot));
  ok('it navigates to the page with no fragment at all',
     /async signOut\(\)[\s\S]{0,400}location\.replace\(location\.pathname \+ location\.search\)/.test(boot));
  ok('the two refusals that show the login form drop it too',
     (boot.match(/forgetPage\(\);/g) || []).length >= 3,
     (boot.match(/forgetPage\(\);/g) || []).length);
  ok('and forgetPage only touches the fragment, never the path',
     /const forgetPage = \(\) => \{\s*if\(location\.hash\) history\.replaceState\(null, '', location\.pathname \+ location\.search\);/.test(boot));

  /* and with no fragment, the portal opens on Home — which is the whole point */
  const {p, errs} = await open('Avin Mascarenhas');
  ok('a portal opened with no fragment starts at Home',
     await p.evaluate(() => state.tab === 'home' && state.mode === 'staff'),
     await p.evaluate(() => [state.mode, state.tab]));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

await b.close(); server.close();
console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
