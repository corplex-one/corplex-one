/* Task 4 — attendance regularization.
 *
 *   'I sent in a request for attendance regularization. It has reached
 *    nowhere but lying in my request list.'
 *
 * The mechanism was never broken: the request was stored, the two-a-month
 * limit was counted by the database, and approving one already wrote the
 * times onto that day. What was missing was every part that tells somebody
 * it happened. So this asks the question Avin actually asked, end to end:
 * he files one, and does it reach anybody.
 *
 *   1. it is on the person's own page, in its own box, the full width;
 *   2. it is in the bell and on the home page of the person who decides it;
 *   3. approving it moves the check-in and check-out times on that day;
 *   4. and the person who asked is told what came of it.
 *
 * Plus the four smaller things he listed: the tab, the form beside Check in
 * and out, the three fields on one line, and a button that says what it does.
 *
 *   node scripts/checkregular.mjs
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

/* Somebody who is not accounts and IS on the attendance list — the page this
 * is about does not exist for anybody else, and it says so instead. */
const HIM = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name from employees e
   where e.active and e.auth_user_id is not null and e.id <> '${AVIN.id}'
     and not coalesce(e.no_attendance, false) and not coalesce(e.works_remote, false)
     and not exists (select 1 from employee_roles r
                      where r.employee_id = e.id and r.role in ('accounts','owner'))
   order by e.full_name limit 1) t`)[0];

console.log('\n=== a request, end to end ===\n');

// start from nothing so the counts are ours
raw(`delete from regularizations where employee_id = '${HIM.id}'`);

/* A working day this month with nothing on it. dayStatus in the page decides
 * this the same way; here the day just has to be free of attendance. */
const DAY = one(`select to_char(d, 'YYYY-MM-DD') from generate_series(
    date_trunc('month', current_date), current_date - 1, interval '1 day') d
   where extract(dow from d) not in (0, 6)
     and not exists (select 1 from attendance a where a.employee_id = '${HIM.id}' and a.on_date = d)
     and not exists (select 1 from holidays h where h.on_date = d)
   order by d desc limit 1`);
ok('there is a day this month with nothing recorded on it', /^\d{4}-\d{2}-\d{2}$/.test(DAY), DAY);

raw(`insert into regularizations (employee_id, on_date, want_in, want_out, reason)
     values ('${HIM.id}', '${DAY}', '08:40', '17:35',
             'Went straight to the client in Deira and forgot to tap in')`,
    HIM.auth_user_id);
const REF = one(`select ref from regularizations where employee_id = '${HIM.id}' and on_date = '${DAY}'`);
ok('he can file one himself', /\S/.test(REF) && REF !== '', REF);
ok('and it starts as Pending',
   one(`select status from regularizations where ref = '${REF}'`) === 'Pending');
ok('accounts can see it', one(`select count(*) from regularizations where ref = '${REF}'`,
   AVIN.auth_user_id) === '1');
ok('a colleague cannot',
   one(`select count(*) from regularizations where ref = '${REF}'`,
       who(json(`select coalesce(json_agg(t),'[]') from (select full_name from employees e
          where e.active and e.auth_user_id is not null and e.id <> '${AVIN.id}' and e.id <> '${HIM.id}'
            and not exists (select 1 from employee_roles r where r.employee_id = e.id
                             and r.role in ('accounts','owner','manager'))
          order by e.full_name limit 1) t`)[0].full_name).auth_user_id) === '0');

console.log('');

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

const pull = u => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, u.auth_user_id)[0]}, u.id);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(u){
  const D = pull(u);
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
  }, [D, u.full_name, D._roles[u.full_name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  return page;
}

// ------------------------------------------------------------- his own page
console.log('his own My attendance:\n');
const his = await open(HIM);
await his.evaluate(() => { state.mode = 'staff'; state.tab = 'attend'; state.attTab = 'me'; render(); });
await his.waitForTimeout(300);

ok('My attendance has two halves',
   await his.evaluate(() => {
     const bar = document.getElementById('attSeg'); if(!bar) return null;
     return [...bar.querySelectorAll('button')].map(x => x.textContent.trim().split(' ').slice(0,2).join(' '));
   }).then(v => !!v && v.length === 2 && /Regularization/.test(v[1]), undefined));
ok('and the Regularization half carries the number waiting',
   await his.evaluate(() => {
     const b2 = document.querySelector('#attSeg button[data-att="reg"]');
     return !!b2 && !!b2.querySelector('.pill') && b2.querySelector('.pill').textContent.trim() === '1';
   }));

ok('the form sits beside Check in and out, not under it',
   await his.evaluate(() => {
     const pair = document.querySelector('.attpair');
     if(!pair) return null;
     const heads = [...pair.children].map(c => (c.querySelector('h3') || {}).textContent || '');
     return heads.length === 2 && /Check in and out/.test(heads[0]) && /Fix a day/.test(heads[1]);
   }));
ok('which day, checked in at and checked out at are on one line',
   await his.evaluate(() => {
     const f = document.querySelector('.rgform'); if(!f) return null;
     const top = [...f.querySelectorAll('label:not(.wide)')];
     if(top.length !== 3) return false;
     const y = top.map(l => Math.round(l.getBoundingClientRect().top));
     return y.every(v => Math.abs(v - y[0]) <= 2);
   }));
ok('with what happened under them, across the width',
   await his.evaluate(() => {
     const w = document.querySelector('.rgform label.wide');
     const f = document.querySelector('.rgform');
     return !!w && /What happened/i.test(w.textContent)
       && w.getBoundingClientRect().width > f.getBoundingClientRect().width * 0.9;
   }));
ok('the button says what it does rather than who it goes to',
   await his.evaluate(() => {
     const g = document.getElementById('rgGo');
     return !!g && g.textContent.trim() === 'Send request';
   }), await his.evaluate(() => (document.getElementById('rgGo')||{}).textContent));

ok('his request is in its own box, the full width of the screen',
   await his.evaluate(ref => {
     const box = [...document.querySelectorAll('section.panel')]
       .find(p => /Your requests/.test((p.querySelector('h3')||{}).textContent || ''));
     if(!box) return null;
     const pair = document.querySelector('.attpair');
     return box.textContent.includes(ref)
       && box.getBoundingClientRect().width > pair.getBoundingClientRect().width * 0.95;
   }, REF));
ok('and not buried inside the form it was sent from',
   await his.evaluate(ref => {
     const fix = [...document.querySelectorAll('section.panel')]
       .find(p => /Fix a day/.test((p.querySelector('h3')||{}).textContent || ''));
     return !!fix && !fix.textContent.includes(ref);
   }, REF));

console.log('');
await his.evaluate(() => document.querySelector('#attSeg button[data-att="reg"]').click());
await his.waitForTimeout(300);
ok('the Regularization half shows the requests',
   await his.evaluate(ref => document.getElementById('view').textContent.includes(ref), REF));
ok('and the day, the times and the reason with them',
   await his.evaluate(() => {
     const t = document.getElementById('view').textContent;
     return /08:40/.test(t) && /17:35/.test(t) && /Deira/.test(t);
   }));
ok('with nothing about checking in and out on it',
   await his.evaluate(() => !/Check in and out/.test(document.getElementById('view').textContent)));
ok('and it is still Pending on his side',
   await his.evaluate(() => /Pending/.test(document.getElementById('view').textContent)));

ok('he is told it is with somebody, rather than having to go and look',
   await his.evaluate(() => alertsFor(state.user).some(x => /is with accounts/.test(x.t))),
   await his.evaluate(() => alertsFor(state.user).map(x => x.t)));

// ------------------------------------------------------------- and accounts
console.log('\nwhat accounts is told:\n');
const acc = await open(AVIN);
await acc.evaluate(() => { state.mode = 'staff'; state.tab = 'home'; render(); });
await acc.waitForTimeout(300);
const seen = await acc.evaluate(() => alertsFor(state.user).map(x => ({t: x.t, s: x.s, tab: x.tab})));
/* Somebody else's pending request may be on her list too — that is the page
 * doing its job. This is looking for HIS. */
const mine = seen.find(x => /fix /i.test(x.t) && x.t.includes(HIM.full_name.split(' ')[0]));
ok('a request that has arrived is on her list', !!mine, seen.map(x => x.t).slice(0, 12));
ok('naming the person and the day', !!mine && mine.t.includes(HIM.full_name.split(' ')[0]), mine);
ok('with the times and the reason under it',
   !!mine && /08:40/.test(mine.s) && /Deira/.test(mine.s), mine && mine.s);
ok('and it opens the page that decides it', !!mine && mine.tab === 'regular', mine && mine.tab);
ok('it is on the home page too, not only in the bell',
   await acc.evaluate(() => /fix /i.test(document.getElementById('view').textContent)
     || [...document.querySelectorAll('[data-go="regular"]')].length > 0));

await acc.evaluate(() => { state.mode = 'console'; state.tab = 'regular'; render(); });
await acc.waitForTimeout(300);
ok('and it is waiting for a decision on that page',
   await acc.evaluate(ref => {
     const t = document.getElementById('view').textContent;
     return t.includes(ref) && /Waiting for a decision/.test(t);
   }, REF));

// ---------------------------------------------------- approving it moves it
console.log('\napproving it:\n');
const before = json(`select coalesce(json_agg(t),'[]') from (select in_at, out_at from attendance
  where employee_id = '${HIM.id}' and on_date = '${DAY}') t`);
ok('there is no attendance on that day to begin with', before.length === 0, before);

const RID = one(`select id from regularizations where ref = '${REF}'`);
raw(`select decide_regularization('${RID}', true, null)`, AVIN.auth_user_id);

const after = json(`select coalesce(json_agg(t),'[]') from (select
  to_char(in_at,'HH24:MI') as i, to_char(out_at,'HH24:MI') as o, regularized, note
  from attendance where employee_id = '${HIM.id}' and on_date = '${DAY}') t`);
ok('approving writes the day onto the attendance record', after.length === 1, after);
ok('with the times he asked for',
   after[0] && after[0].i === '08:40' && after[0].o === '17:35', after[0]);
ok('marked as regularized rather than as an ordinary day', !!(after[0] && after[0].regularized));
ok('and the reason kept on it', !!(after[0] && /Deira/.test(after[0].note || '')), after[0] && after[0].note);
ok('the request itself reads Approved',
   one(`select status from regularizations where ref = '${REF}'`) === 'Approved');
ok('and one of his two for the month is spent',
   one(`select regular_left('${HIM.id}', '${DAY}'::date)`) === '1');

const his2 = await open(HIM);
await his2.evaluate(() => { state.mode = 'staff'; state.tab = 'attend'; state.attTab = 'reg'; render(); });
await his2.waitForTimeout(300);
ok('he is told what came of it',
   await his2.evaluate(() => alertsFor(state.user).some(x => /has been corrected/.test(x.t))),
   await his2.evaluate(() => alertsFor(state.user).map(x => x.t)));
ok('and the day now shows the times on his own month',
   await his2.evaluate(() => { state.attTab = 'me'; render(); return true; })
     .then(() => his2.waitForTimeout(250))
     .then(() => his2.evaluate(() => {
       const t = document.getElementById('view').textContent;
       return /08:40/.test(t) && /17:35/.test(t); })));

// ------------------------------------------------------------- and declined
console.log('\nand one that is turned down:\n');
raw(`delete from regularizations where employee_id = '${HIM.id}'`);
const DAY2 = one(`select to_char(d, 'YYYY-MM-DD') from generate_series(
    date_trunc('month', current_date), current_date - 1, interval '1 day') d
   where extract(dow from d) not in (0, 6)
     and not exists (select 1 from attendance a where a.employee_id = '${HIM.id}' and a.on_date = d)
     and not exists (select 1 from holidays h where h.on_date = d)
   order by d desc limit 1`);
raw(`insert into regularizations (employee_id, on_date, want_in, want_out, reason)
     values ('${HIM.id}', '${DAY2}', '09:00', '18:00', 'Forgot to tap out')`, HIM.auth_user_id);
const RID2 = one(`select id from regularizations where employee_id = '${HIM.id}' and on_date = '${DAY2}'`);
raw(`select decide_regularization('${RID2}', false, 'You were on leave that day')`, AVIN.auth_user_id);

ok('nothing is written onto the day',
   one(`select count(*) from attendance where employee_id = '${HIM.id}' and on_date = '${DAY2}'`) === '0');
ok('and it costs him nothing',
   one(`select regular_left('${HIM.id}', '${DAY2}'::date)`) === '2');

const his3 = await open(HIM);
await his3.evaluate(() => { state.mode = 'staff'; state.tab = 'attend'; render(); });
await his3.waitForTimeout(300);
ok('he is told, and told why',
   await his3.evaluate(() => alertsFor(state.user).some(x => /turned down/.test(x.t)
     && /on leave that day/i.test(x.s))),
   await his3.evaluate(() => alertsFor(state.user).map(x => x.t + ' — ' + x.s)));

raw(`delete from regularizations where employee_id = '${HIM.id}'`);
raw(`delete from attendance where employee_id = '${HIM.id}' and on_date = '${DAY}' and regularized`);

await b.close(); server.close();
console.log(`\n${n - bad.length}/${n} passed`);
if(bad.length){ console.log('\n' + bad.map(x => '  - ' + x).join('\n')); process.exit(1); }
