/* My payslip, once the portal holds more than one month.
 *
 *   'This page should show my August payslip, Salary revision, however now I
 *    can see only about September 2026'
 *
 * Opening September hid August. The page was built around DATA.payroll, which
 * points at the NEWEST run — so its month, its status and the row it read were
 * September's, and the first thing it did was
 *
 *     if(!released) return "September 2026 is not released yet"
 *
 * and return before drawing anything else. Correct for as long as the portal
 * held one run, which was true until the day September was opened. It is a
 * page about released months and it was reading the draft.
 *
 * So what is worth pinning down is the shape, not the wording:
 *
 *   1. a released month stays reachable however many drafts open after it;
 *   2. an unreleased month is a line, not the page;
 *   3. the revision letter and the settlement note show whichever branch the
 *      page takes — they used to sit inside the branch that returned early,
 *      which is exactly when somebody wants to see them;
 *   4. somebody paid by two companies gets both payslips, told apart.
 *
 *   node scripts/checkmyslip.mjs
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
const CLOSED = one(`select month_key from payroll_runs where status = 'closed' order by month_key desc limit 1`);
const NEXT = (() => { const [y, m] = CLOSED.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; })();

/* Somebody with a line on the closed month, and somebody paid by two
 * companies, who therefore has two payslips in it. */
const P1 = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
    join payroll_lines l on l.employee_id = e.id
    join payroll_runs r on r.id = l.run_id and r.month_key = '${CLOSED}'
   where e.auth_user_id is not null and l.net > 0
   group by e.id, e.auth_user_id, e.full_name having count(*) = 1
   order by e.full_name limit 1) t`)[0];
const P2 = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
    join payroll_lines l on l.employee_id = e.id
    join payroll_runs r on r.id = l.run_id and r.month_key = '${CLOSED}'
   where e.auth_user_id is not null
   group by e.id, e.auth_user_id, e.full_name having count(*) > 1
   order by e.full_name limit 1) t`)[0];

console.log(`\nclosed month ${CLOSED}; ${P1.full_name} has one payslip in it`
  + (P2 ? `, ${P2.full_name} has two` : '') + '\n');

// open the next month as a draft, which is the state that broke it
raw(`delete from payroll_runs where month_key = '${NEXT}'`);
raw(`select generate_run('${NEXT}', null)`, AVIN.auth_user_id);
ok('there is a closed month and an open draft after it',
   one(`select status from payroll_runs where month_key = '${CLOSED}'`) === 'closed'
   && one(`select status from payroll_runs where month_key = '${NEXT}'`) === 'draft');

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
async function open(u, wide){
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
      `) t`, u.auth_user_id)[0]}, u.id);
  const page = await b.newPage({viewport: {width: wide === false ? 430 : 1500, height: 1100}});
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
  }, [D, u.full_name, D._roles[u.full_name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  await page.evaluate(() => { state.mode = 'staff'; state.tab = 'myslip'; state.slipRun = null; render(); });
  await page.waitForTimeout(400);
  return page;
}

console.log('with a draft month open after a closed one:\n');
let p = await open(P1);
const txt = () => p.evaluate(() => document.getElementById('view').textContent.replace(/\s+/g, ' '));
let t = await txt();
ok('the closed month is still on the page', t.includes(one(
   `select label from payroll_runs where month_key = '${CLOSED}'`)), t.slice(0, 140));
ok('with its figures, not just its name',
   await p.evaluate(() => document.querySelectorAll('#view .strip .stat').length >= 4));
ok('and the payslip list has a row to open',
   await p.evaluate(() => document.querySelectorAll('[data-myslip]').length > 0));
/* The notice, and the thing that made it a lie for two weeks.
 *
 * It used to be shown only if the draft run held a line for me. A person
 * cannot see that: the rule on payroll_lines is your own line AND only once
 * the run is closed, which is what releasing a month means. So the draft's
 * rows are empty for everybody but accounts, the notice never appeared for
 * the person it was written for, and the check did not catch it because the
 * person it happened to pick was not on the draft either way.
 *
 * Both halves are asserted now: that a staff member really is refused the
 * draft's lines, and that the notice appears regardless — it is built from
 * what they can see, which is that a newer month exists and that they were
 * paid in the last one. */
ok('a staff member cannot see the draft month\u2019s lines at all \u2014 that is what releasing means',
   one(`select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
          where r.month_key = '${NEXT}'`, P1.auth_user_id) === '0');
ok('but the draft month is still one line on their page',
   /is not released yet/.test(t), t.slice(0, 120));
ok('and it names the month',
   t.includes(one(`select label from payroll_runs where month_key = '${NEXT}'`)), t.slice(0, 120));
ok('and it is not what the page is about',
   await p.evaluate(k => {
     const h = [...document.querySelectorAll('#view section.panel h3')].map(x => x.textContent);
     return !h.some(x => x.includes(k)); }, one(
     `select label from payroll_runs where month_key = '${NEXT}'`)));
await p.close();

/* Point 3: the letter shows whichever branch the page takes. Issue one for
 * somebody with no payslip at all, which is the branch that used to swallow
 * it entirely. */
console.log('\na revision letter, for somebody with no payslip:\n');
/* A partner is not on the scheme, so My payslip is not their page at all and
 * the router now says so — which makes a partner the wrong person to test the
 * empty branch with. Everybody without a closed payslip in this data happens
 * to be a partner, so the subject is the first person who does have the page,
 * and what is asserted is the thing that broke: the letter shows whichever
 * branch the page takes. */
const PARTNERS = `(select jsonb_array_elements_text(value::jsonb) from settings where key = 'partners')`;
const NOSLIP = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name,
         not exists (select 1 from payroll_lines l join payroll_runs r on r.id = l.run_id
                      where l.employee_id = e.id and r.status = 'closed') as blank
    from employees e
   where e.active and e.auth_user_id is not null
     and e.full_name not in ${PARTNERS}
   order by blank desc, e.full_name limit 1) t`)[0];
let R = null;
/* Whatever this person's salary rows are, captured before they are cleared
   away — a check that eats a row of the seed makes the next run of the suite a
   slightly different experiment, and this one ate Abdulkhamid's the day he was
   finally given one. Put back verbatim in the tidy-up at the foot. */
const SPWAS = NOSLIP ? json(`select coalesce(json_agg(t),'[]') from (
  select coalesce(company,'') as company, salary, basic, allowance,
         effective_from::text as eff, coalesce(source,'') as source
    from salary_parts where employee_id = '${NOSLIP.id}') t`) : [];
if(NOSLIP){
  raw(`delete from salary_parts where employee_id = '${NOSLIP.id}'`);
  raw(`insert into salary_parts(employee_id, company, salary, basic, allowance, effective_from, source)
       values ('${NOSLIP.id}', '', 5000, 3000, 2000, '2020-01-01', 'test')`);
  R = JSON.parse(one(`select issue_revision('${NOSLIP.id}', 4000, 2000, '${NEXT}-01'::date,
    'test', '', 'revision', true)`, AVIN.auth_user_id));
  p = await open(NOSLIP);
  t = await txt();
  ok(NOSLIP.blank ? 'the page says there is no payslip yet' : 'the page is their payslip page',
     NOSLIP.blank ? /No payslip yet/i.test(t) : /payslip/i.test(t), t.slice(0, 120));
  ok('and still shows the revision letter, which is the point',
     await p.evaluate(() => !!document.querySelector('[data-revltr]')), t.slice(0, 200));
  await p.close();
} else {
  ok('somebody who has the page exists to test with', false, 'nobody');
  ok('(skipped)', true);
}

/* And the other half of the same fact: a partner has no payslip page, and
 * asking for it by name does not produce one. */
const PARTNER = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
   where e.active and e.auth_user_id is not null and e.full_name in ${PARTNERS}
   order by e.full_name limit 1) t`)[0];
if(PARTNER){
  p = await open(PARTNER);
  ok(`a partner has no My payslip tab (${PARTNER.full_name})`,
     await p.evaluate(() => !document.querySelector('#nav [data-tab="myslip"]')));
  ok('and asking for it by name lands them home instead',
     await p.evaluate(() => state.tab === 'home'),
     await p.evaluate(() => state.tab));
  await p.close();
}

/* Point 4: two companies, two payslips. */
console.log('\nsomebody paid by two companies:\n');
if(P2){
  p = await open(P2);
  t = await txt();
  ok('both payslips are listed',
     await p.evaluate(() => document.querySelectorAll('tr[data-myslip]').length) === 2,
     await p.evaluate(() => [...document.querySelectorAll('tr[data-myslip]')].map(r => r.dataset.myslip)));
  ok('told apart by the company that paid each',
     await p.evaluate(() => [...document.querySelectorAll('tr[data-myslip] td:first-child')]
       .map(td => td.textContent.trim()))
       .then(v => v.length === 2 && v[0] !== v[1] && v.every(x => x.includes('·')), undefined));
  /* The list is the switcher. There is no row of month buttons above it any
   * more — 'why do we need tabs for months, just keep a picker for months when
   * list goes long' — so what has to hold is that the list says which month is
   * open and that clicking another row moves it. */
  /* The list is the switcher. There is no row of month buttons above it any
   * more — 'why do we need tabs for months, just keep a picker for months when
   * list goes long' — so what has to hold is that a row opens its own sheet
   * and that the rows are not bound to the console's attribute. */
  ok('there is no separate row of month tabs',
     await p.evaluate(() => !document.getElementById('slipSeg')));
  ok('the row the figures at the top are about is marked',
     await p.evaluate(() => document.querySelectorAll('tr.sliprow.on').length) === 1);
  ok('and its rows are not bound to the same attribute as the console payslip list',
     await p.evaluate(() => [...document.querySelectorAll('tr[data-myslip]')]
       .every(x => x.dataset.myslip && !x.dataset.slip)));
  await p.evaluate(() => document.querySelectorAll('tr[data-myslip]')[1].click());
  await p.waitForTimeout(300);
  ok('clicking a row opens that payslip',
     await p.evaluate(() => !!document.querySelector('#lookWrap .look')));
  /* The subtitle used to read "CorpLex · undefined" — slipOf has no .month —
   * and once it did read a month it read the console's month rather than the
   * sheet's. Both are one assertion: it says the month of the row clicked. */
  ok('and the sheet is headed with its own month',
     await p.evaluate(() => {
       const h = (document.querySelector('#lookWrap .look header') || {}).textContent || '';
       const m = ((document.querySelectorAll('tr[data-myslip] td:first-child')[1] || {}).textContent || '')
         .split('·')[0].trim();
       return {h, m, in: !!m && h.includes(m) && !/undefined/.test(h)};
     }).then(v => v.in, undefined));
  await p.evaluate(() => { const x = document.querySelector('#lookWrap [data-lookclose]');
    if(x) x.click(); });
  await p.waitForTimeout(200);
  ok('and each row carries its own company, so opening one is unambiguous',
     await p.evaluate(() => [...document.querySelectorAll('tr[data-myslip]')]
       .every(r => /\|/.test(r.dataset.myslip))));
  await p.close();
} else {
  ok('nobody is paid by two companies in the closed month', false);
}

/* Point 5: a payslip is dated by its own month.
 *
 * slipOf read the pay date off DATA.master and the period off DATA.payroll,
 * both of which describe the CURRENT run. One month on the page, no harm.
 * Six months on the page and every one of them claimed to have been paid on
 * the newest run's pay date.
 *
 * Point 6: no tabs, a picker. The list is the switcher; a year picker appears
 * only once the list is long enough to need cutting down.
 */
console.log('\nmore than one released month:\n');
{
  const KEEP = json(`select coalesce(json_agg(t),'[]') from (select id, month_key, status, pay_date
    from payroll_runs) t`);
  const MONTHS = ['2025-10','2025-11','2025-12','2026-01','2026-02'];
  for(const m of MONTHS){
    raw(`delete from payroll_runs where month_key = '${m}'`);
    raw(`select generate_run('${m}', null)`, AVIN.auth_user_id);
  }
  raw(`update payroll_runs set status = 'closed', pay_date = (month_key || '-26')::date
        where month_key in (${MONTHS.map(m => `'${m}'`).join(',')})`);
  const M2 = json(`select coalesce(json_agg(t),'[]') from (
    select e.id, e.auth_user_id, e.full_name from employees e
      join payroll_lines l on l.employee_id = e.id
      join payroll_runs r on r.id = l.run_id and r.month_key = '2025-10'
     where e.auth_user_id is not null and l.net > 0
     order by e.full_name limit 1) t`)[0];
  if(M2){
    p = await open(M2);
    const rows = await p.evaluate(() => [...document.querySelectorAll('tr[data-myslip]')]
      .map(r => [...r.children].slice(0, 2).map(c => c.textContent.trim())));
    ok('every released month is listed', rows.length >= 6, rows.length);
    ok('newest first', rows.length > 1 && rows[0][0] !== rows[rows.length - 1][0], rows.map(r => r[0]));
    /* The fault: all of them said the newest run's pay date. */
    ok('and each one is paid on its own date, not on the newest run’s',
       new Set(rows.map(r => r[1])).size === rows.length,
       rows.map(r => r.join(' paid ')));
    ok('a list this long does not sprout a picker on its own',
       await p.evaluate(() => !document.getElementById('slipYear')), rows.length);
    await p.close();
  } else ok('a person with a line in the older months exists to test with', false);

  /* Long enough to need the picker. Fifteen months spans two years. */
  const LONG = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09'];
  for(const m of LONG){
    raw(`delete from payroll_runs where month_key = '${m}'`);
    raw(`select generate_run('${m}', null)`, AVIN.auth_user_id);
  }
  raw(`update payroll_runs set status = 'closed', pay_date = (month_key || '-26')::date
        where month_key in (${LONG.map(m => `'${m}'`).join(',')})`);
  if(M2){
    p = await open(M2);
    const all = await p.evaluate(() => document.querySelectorAll('tr[data-myslip]').length);
    ok('once the list is long the picker appears',
       await p.evaluate(() => !!document.getElementById('slipYear')), all);
    ok('and it offers a year at a time, plus every year',
       await p.evaluate(() => [...document.querySelectorAll('#slipYear option')].map(o => o.value))
         .then(v => v.length >= 3 && v[v.length - 1] === 'all', undefined));
    ok('it starts on the year of the month at the top of the page',
       await p.evaluate(() => {
         const y = (document.getElementById('slipYear') || {}).value || '';
         const k = (document.querySelector('#view .strip .stat .k') || {}).textContent || '';
         return {y, k, same: !!y && k.includes(y)};
       }).then(v => v.same, undefined));
    const before = await p.evaluate(() => document.querySelectorAll('tr[data-myslip]').length);
    await p.evaluate(() => { const y = document.getElementById('slipYear');
      y.value = '2025'; y.onchange(); });
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => [...document.querySelectorAll('tr[data-myslip] td:first-child')]
      .map(c => c.textContent.trim()));
    ok('choosing a year lists that year and nothing else',
       after.length && after.every(x => /2025/.test(x)), {before, after: after.slice(0, 3)});
    await p.evaluate(() => { const y = document.getElementById('slipYear');
      y.value = 'all'; y.onchange(); });
    await p.waitForTimeout(300);
    ok('and every year puts them all back',
       await p.evaluate(() => document.querySelectorAll('tr[data-myslip]').length) > after.length);
    /* And still no tabs, at any length. */
    ok('with no row of month tabs at any length',
       await p.evaluate(() => !document.getElementById('slipSeg')));
    await p.close();
  }

  /* Put the months back the way they were found. */
  raw(`delete from payroll_runs where month_key in (${
    [...MONTHS, ...LONG].map(m => `'${m}'`).join(',')})`);
  ok('the months this check invented are cleared away again',
     Number(one(`select count(*) from payroll_runs`)) === KEEP.length, KEEP.length);
}

/* The visual fault this turned up: the link's whole stylesheet lived inside
 * @media(max-width:720px), so on a desktop its icon drew at the SVG default
 * of 300 by 150. */
console.log('\nand the link itself:\n');
if(NOSLIP){
  for(const wide of [true, false]){
    p = await open(NOSLIP, wide);
    const box = await p.evaluate(() => { const el = document.querySelector('[data-revltr] svg');
      if(!el) return null; const r = el.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; });
    ok(`its icon is an icon at ${wide ? '1500px' : '430px'}`,
       !!box && box.w <= 28 && box.h <= 28, box);
    const fits = await p.evaluate(() => { const el = document.querySelector('[data-revltr]');
      if(!el) return null; const r = el.getBoundingClientRect(); return {h: Math.round(r.height)}; });
    ok(`and the line is a line, not a panel, at ${wide ? '1500px' : '430px'}`,
       !!fits && fits.h < 120, fits);
    await p.close();
  }
}

// ------------------------------------------------------------------- tidy up
if(R){
  raw(`delete from salary_parts where employee_id = '${NOSLIP.id}'`);
  raw(`delete from salary_revisions where letter_ref = '${R.ref}'`);
  raw(`delete from letters where ref = '${R.ref}'`);
  SPWAS.forEach(r => raw(`insert into salary_parts(employee_id, company, salary, basic,
    allowance, effective_from, source)
    values ('${NOSLIP.id}', ${r.company ? `'${r.company}'` : `''`}, ${r.salary}, ${r.basic},
            ${r.allowance}, '${r.eff}'::date, ${r.source ? `'${r.source.replace(/'/g, "''")}'` : 'null'})`));
  ok('and the salary this borrowed is back exactly as it was',
     one(`select count(*) from salary_parts where employee_id = '${NOSLIP.id}'`) === String(SPWAS.length),
     {want: SPWAS.length, got: one(`select count(*) from salary_parts where employee_id = '${NOSLIP.id}'`)});
}
raw(`delete from payroll_runs where month_key = '${NEXT}'`);

await b.close(); server.close();
console.log(`\n${n - bad.length}/${n} passed`);
if(bad.length){ console.log('\n' + bad.map(x => '  - ' + x).join('\n')); process.exit(1); }
