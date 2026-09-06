/* The settlement rail, and the two ways out of a settlement.
 *
 * Avin, on opening an initiated exit as the owner:
 *
 *   'It has some messy text (1 · doneDraftedby Avin Mascarenhas 2 · here
 *    Initiated Sep 2026 3 · here Manager approved with Rana Amine ...)'
 *
 * Two faults in one line. The rail had no stylesheet, so a span, a bold and
 * an em ran together into one string of words; and it said "here" twice,
 * because step 2 and step 3 were both given the flag `at === 1` by hand. So
 * the rail is a list now, each step carrying the status it IS, and this asks
 * the thing that was actually wrong: at every stage of a settlement, exactly
 * one step is where it is, everything before it is done, and nothing after it
 * claims to be either.
 *
 * And the other half of the morning:
 *
 *   'Not able to remove the draft of Exit - in case there is an U turn, we
 *    need to withdraw the draft'
 *
 * The RPC existed and nothing called it. Undo puts a settlement back to a
 * draft; this is the one that clears the draft itself.
 *
 *   node scripts/checkexitrail.mjs
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
const OWNER = json(`select coalesce(json_agg(t),'[]') from (select e.id, e.auth_user_id, e.full_name
  from employees e join employee_roles r on r.employee_id = e.id where r.role = 'owner' limit 1) t`)[0];

/* Somebody leaving whose manager is neither the owner nor themselves, so the
 * six-step shape is the one being tested rather than the collapsed five. */
const L = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.full_name, e.manager_id from employees e
   where e.active and e.manager_id is not null
     and e.manager_id <> '${OWNER.id}' and e.id <> '${AVIN.id}' and e.id <> '${OWNER.id}'
   order by e.full_name limit 1) t`)[0];
const MGR = json(`select coalesce(json_agg(t),'[]') from (select id, auth_user_id, full_name
  from employees where id = '${L.manager_id}') t`)[0];

console.log(`\nleaver ${L.full_name}, manager ${MGR.full_name}, owner ${OWNER.full_name}\n`);

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
async function open(u, setup){
  const D = pull(u);
  const page = await b.newPage({viewport: {width: 1500, height: 1100}});
  await page.route('**://fonts.*/**', r => r.abort());
  page.on('pageerror', e => { bad.push('page error: ' + e.message); console.log('  FAIL page error: ' + e.message); });
  page.on('dialog', d => d.accept());
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
  if(setup){ await page.evaluate(setup); await page.waitForTimeout(350); }
  return page;
}

/* What the rail says, read the way a person reads it: one segment per step,
 * each with its number, its state word, its label and its line under. */
const railOf = page => page.evaluate(() =>
  [...document.querySelectorAll('.exrail .step')].map(el => ({
    no:    (el.querySelector('i') || {}).textContent,
    state: ((el.querySelector('.sw') || {}).textContent || '').trim(),
    label: ((el.querySelector('b') || {}).textContent || '').trim(),
    sub:   ((el.querySelector('em') || {}).textContent || '').trim(),
    done:  el.classList.contains('done'),
    now:   el.classList.contains('now'),
    /* The fault Avin saw: with no stylesheet these three sat on one line as
       one run of words. Each is its own box in the grid now, so the label
       starts below the state word rather than beside it. */
    stacked: (() => {
      const sw = el.querySelector('.sw'), lb = el.querySelector('b'), sb = el.querySelector('em');
      if(!sw || !lb || !sb) return false;
      const a = sw.getBoundingClientRect(), c = lb.getBoundingClientRect(), d = sb.getBoundingClientRect();
      return c.top >= a.bottom - 1 && d.top >= c.bottom - 1;
    })()
  })));

// --------------------------------------------------------------- the draft
raw(`delete from exits`);
const LWD = one(`select to_char(current_date + 10, 'YYYY-MM-DD')`);
raw(`select exit_save(null, '${L.id}', '${LWD}', '${LWD}', null, null, '[]'::jsonb)`, AVIN.auth_user_id);
const XID = one(`select id from exits where employee_id = '${L.id}'`);

console.log('a draft, on the accounts console:\n');
let p = await open(AVIN, `state.mode='console'; state.tab='exits'; state.exitOpen='${XID}'; render();`);
let rail = await railOf(p);

ok('the rail has all six steps', rail.length === 6, rail.map(r => r.label));
ok('and each one reads as three lines, not one run of words',
   rail.every(r => r.stacked), rail.filter(r => !r.stacked).map(r => r.label));
ok('the numbers run 1 to 6', rail.map(r => r.no).join('') === '123456', rail.map(r => r.no));
ok('exactly one step says where it is',
   rail.filter(r => r.now).length === 1, rail.filter(r => r.now).map(r => r.label));
ok('the drafting is done and the initiating is what is waited on',
   rail[0].done && rail[0].state === 'done' && rail[1].now && rail[1].state === 'here',
   rail.slice(0, 2));
ok('nothing after it claims to be done',
   rail.slice(2).every(r => !r.done && r.state === ''), rail.slice(2));
ok('the owner is named from the staff list, not typed into the page',
   rail[3].label.startsWith(OWNER.full_name.split(' ')[0]), rail[3].label);
ok('and the manager is named even before it is initiated',
   rail[2].sub.includes(MGR.full_name.split(' ')[0]), rail[2].sub);

console.log('');
ok('there is a way to clear the draft',
   await p.evaluate(() => !!document.querySelector('[data-exkill]')));
ok('and it says discard, because nothing has been sent to anybody',
   await p.evaluate(() => document.querySelector('[data-exkill]').textContent.trim()) === 'Discard this draft');
ok('Undo is not offered on something that is already a draft',
   await p.evaluate(() => !document.querySelector('[data-exundo]')));
await p.click('[data-exkill]');
await p.waitForTimeout(250);
ok('pressing it withdraws the settlement',
   await p.evaluate(() => (window.__saw || []).some(x => x[0] === 'withdrawExit')),
   await p.evaluate(() => (window.__saw||[]).map(x => x[0])));
await p.close();

// and the same call, against the real database
raw(`select exit_withdraw('${XID}')`, AVIN.auth_user_id);
ok('the row is withdrawn rather than deleted',
   one(`select status from exits where id = '${XID}'`) === 'withdrawn');
ok('and the person is still on the staff list',
   one(`select active::text from employees where id = '${L.id}'`) === 'true');
ok('with no last day against them',
   one(`select coalesce(last_day::text,'-') from employees where id = '${L.id}'`) === '-');
raw(`select exit_save(null, '${L.id}', '${LWD}', '${LWD}', null, null, '[]'::jsonb)`, AVIN.auth_user_id);
ok('and a new settlement can be drafted for them straight away',
   one(`select count(*) from exits where employee_id = '${L.id}' and status = 'draft'`) === '1');

// ------------------------------------------------------- through the stages
const X2 = one(`select id from exits where employee_id = '${L.id}' and status = 'draft'`);
raw(`select exit_initiate('${X2}', '{}'::jsonb, 12345.67)`, AVIN.auth_user_id);

console.log('\nonce it is initiated:\n');
p = await open(OWNER, `state.mode='staff'; state.tab='exitapprove'; state.exitOpen='${X2}'; render();`);
rail = await railOf(p);
ok('the initiating is now done too', rail[1].done && rail[1].state === 'done', rail[1]);
ok('and the manager is the one step that is here',
   rail[2].now && rail.filter(r => r.now).length === 1, rail.filter(r => r.now).map(r => r.label));
ok('the owner is not told he has approved anything yet',
   !rail[3].done && rail[3].state === '', rail[3]);
ok('but he can approve, since the owner may clear both stages',
   await p.evaluate(() => !!document.querySelector('[data-exok]')));
ok('and the page says so rather than leaving him to wonder',
   await p.evaluate(nm => new RegExp('Still with ' + nm).test(document.getElementById('view').textContent),
     MGR.full_name.split(' ')[0]));
ok('withdrawing is not his to do',
   await p.evaluate(() => !document.querySelector('[data-exkill]') && !document.querySelector('[data-exundo]')));
await p.close();

/* Every remaining stage, from the accounts console: at each one, exactly one
 * step is here, everything before it is done, and nothing after it is. */
const STAGES = [
  ['mgr_ok',   2, () => raw(`select exit_approve('${X2}')`, MGR.auth_user_id)],
  ['owner_ok', 3, () => raw(`select exit_approve('${X2}')`, OWNER.auth_user_id)],
  ['decided',  4, () => raw(`select exit_decide('${X2}', 'separate')`, AVIN.auth_user_id)],
  ['paid',     5, () => raw(`select exit_paid('${X2}', current_date)`, AVIN.auth_user_id)]
];
console.log('');
for(const [status, reached, go] of STAGES){
  go();
  const pg = await open(AVIN, `state.mode='console'; state.tab='exits'; state.exitOpen='${X2}'; render();`);
  const r = await railOf(pg);
  const doneCount = r.filter(x => x.done).length;
  const nowCount  = r.filter(x => x.now).length;
  ok(`at ${status}: ${reached + 1} step${reached ? 's are' : ' is'} done`,
     doneCount === reached + 1, {doneCount, labels: r.filter(x => x.done).map(x => x.label)});
  ok(`at ${status}: ${status === 'paid' ? 'nothing' : 'one step'} is waiting`,
     nowCount === (status === 'paid' ? 0 : 1), r.filter(x => x.now).map(x => x.label));
  ok(`at ${status}: done and waiting never fall on the same step`,
     r.every(x => !(x.done && x.now)), r.filter(x => x.done && x.now).map(x => x.label));
  ok(`at ${status}: the steps still read as three lines`,
     r.every(x => x.stacked));
  if(status !== 'paid')
    ok(`at ${status}: it can still be withdrawn, and it says they are staying`,
       await pg.evaluate(() => {
         const el = document.querySelector('[data-exkill]');
         return !!el && /they are staying/.test(el.textContent); }));
  else
    ok('once paid, neither Undo nor Withdraw is offered',
       await pg.evaluate(() => !document.querySelector('[data-exkill]')
         && !document.querySelector('[data-exundo]')));
  await pg.close();
}

ok('and the database refuses to withdraw a settlement that has been paid',
   (() => { try{ raw(`select exit_withdraw('${X2}')`, AVIN.auth_user_id); return false; }
            catch(_){ return true; } })());

/* Put the scratch database back. A settlement that reached 'paid' left the
 * person off the staff list with a last day against them, which is right for
 * a real leaver and wrong for a fixture: the next script to run would find a
 * seed with somebody quietly missing from it. */
raw(`delete from exits where employee_id = '${L.id}'`);
raw(`update employees set active = true, last_day = null where id = '${L.id}'`);
raw(`update payroll_lines l set excluded = false
      from payroll_runs r where l.run_id = r.id and l.employee_id = '${L.id}'`);
await b.close(); server.close();
console.log(`\n${n - bad.length}/${n} passed`);
if(bad.length){ console.log('\n' + bad.map(x => '  - ' + x).join('\n')); process.exit(1); }
