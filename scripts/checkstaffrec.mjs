/* One place to keep an employment record, and one tick for sales.
 *
 *   'We have staff document tab - which records DOB and Documents data. Then we
 *    have Register which maintains personal data. But where do we have add or
 *    edit option for the following? Name / Employee ID / Company / Visa / Paid
 *    from / Designation / Department / Shift / Reports to / Work email / Work
 *    Phone / Sales. I feel this is all over the place. Why not we have a proper
 *    tab to maintain all this?'
 *
 *   'I want to have a tick option - if they are ticked, then they have access to
 *    their sales data. For example: I am accountant, but still i do sales'
 *
 *   'if in future someones joins i just want one tick to give them access to
 *    their sales data'                                               -- Avin
 *
 * He was right, and it was worse than scattered. Seven of those twelve could
 * only ever be typed on the Add somebody form and never corrected; the work
 * phone had no box anywhere in the portal at all; department had two homes, one
 * of them hidden under Sales; and 'Sales' was not a field but a settings blob
 * keyed by full name that no screen could write.
 *
 * What has to stay true now:
 *
 *   1. Documents is Register, and it holds the five tabs in his order, with
 *      Staff Records first;
 *   2. every one of the twelve has a box on that one screen, filled from the
 *      record, and only accounts can reach it;
 *   3. nothing is written until the confirm list is agreed to, and each line of
 *      that list says what the change DOES, not only what it was;
 *   4. agreeing writes the record first and the tick second, with the arguments
 *      that were actually typed;
 *   5. the database still refuses what it always refused — a self-manager, a
 *      duplicate employee ID, a signed-in address, a tick with no department,
 *      and anybody who is not accounts;
 *   6. the tick, and not the last uploaded workbook, is what opens the sales
 *      pages for somebody outside a revenue department;
 *   7. department stops living in two places;
 *   8. the portal still opens if 0023 has not been run yet.
 *
 *   node scripts/checkstaffrec.mjs
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
const one = (s, u) => { const L = raw(s, u).trim().split('\n'); return L[L.length - 1].trim(); };
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

const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];
const asAvin = s => one(`set role authenticated; select set_config('request.jwt.claim.sub','${AVIN.auth_user_id}',false); ` + s);
const refused = (sql, u) => { try { one(u
    ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` + sql
    : `set role authenticated; select set_config('request.jwt.claim.sub','${AVIN.auth_user_id}',false); ` + sql);
    return ''; } catch(e){ return String((e.stderr || e.message) || '').replace(/\s+/g, ' '); } };

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, tab, drop){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const cols = Object.entries(T).filter(([k]) => k !== drop);
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      cols.map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1700, height: 1200}});
  await p.route('**://fonts.*/**', x => x.abort());
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => { window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); }, [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  await p.evaluate(t => { state.mode = t.con ? 'console' : 'staff'; state.tab = t.id; render(); }, tab);
  await p.waitForTimeout(200);
  return {p, errs};
}

/* ============================================ 1. Documents is Register now */
console.log('\nDocuments is Register, with five tabs in his order');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(() => {
    const seg = [...document.querySelectorAll('.subtabs [data-ctab]')].map(x => x.textContent.trim());
    const nav = [...document.querySelectorAll('.ctabs [data-csec]')].map(x => x.textContent.trim());
    const on = [...document.querySelectorAll('.subtabs [data-ctab]')]
      .filter(x => x.getAttribute('aria-current') === 'true').map(x => x.textContent.trim());
    return {seg, nav, on, sec: (document.querySelector('.ctabs [data-csec][aria-current="true"]') || {}).textContent};
  });
  ok('the console section is called Register', r.nav.includes('Register'), r.nav);
  ok('and Documents is gone from the console bar', !r.nav.includes('Documents'), r.nav);
  ok('five tabs, in the order he wrote them',
     JSON.stringify(r.seg) === JSON.stringify(
       ['Staff Records','Staff Documents','Staff Personal','Profile completion','Expiry']), r.seg);
  ok('Staff Records is the one you land on', r.on.join() === 'Staff Records', r.on);
  ok('and Register is the section it sits under', (r.sec || '').trim() === 'Register', r.sec);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================= 2. every field has a box, filled correctly */
console.log('\nall twelve in one place, filled from the record');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const empty = await p.evaluate(() => ({
    picker: (document.getElementById('srWho') || {}).options ? document.getElementById('srWho').options.length : -1,
    boxes: document.querySelectorAll('[data-sr]').length,
    says: (document.getElementById('view').textContent || '').includes('Pick somebody')}));
  ok('everybody is on the picker', empty.picker > 20, empty.picker);
  ok('with nobody chosen there is nothing to type into', empty.boxes === 0, empty.boxes);
  ok('and the screen says so', empty.says);

  const r = await p.evaluate(() => {
    state.sr = {who:'Shohruh Karimov', draft:{}, confirm:false, busy:false, done:''}; render();
    const g = k => { const e = document.querySelector('[data-sr="' + k + '"]'); return e ? e.value : null; };
    return {keys: [...document.querySelectorAll('[data-sr]')].map(e => e.dataset.sr),
            name: g('name'), staffNo: g('staffNo'), company: g('company'), visa: g('visa'),
            paidBy: g('paidBy'), title: g('title'), department: g('department'), shift: g('shift'),
            manager: g('manager'), email: g('email'), phone: g('phone'),
            tick: !!document.getElementById('srSales'),
            ownPanel: !!document.querySelector('.srpanel'),
            tickInside: !!document.querySelector('.srpanel #srSales'),
            ticked: (document.getElementById('srSales') || {}).checked,
            basedIsSelect: (document.querySelector('[data-sr="remote"]') || {}).tagName === 'SELECT',
            deptIsSelect: (document.querySelector('[data-sr="department"]') || {}).tagName === 'SELECT',
            deptIsInput: !!document.querySelector('input[data-sr="department"]'),
            deptOpts: [...((document.querySelector('select[data-sr="department"]') || {}).options || [])].map(o => o.value),
            emailOff: (document.querySelector('[data-sr="email"]') || {}).disabled,
            hint: (document.querySelector('.pfhint') || {}).textContent || ''};
  });
  const want = json(`select coalesce(json_agg(t),'[]') from (select e.full_name, e.staff_no, e.company,
    e.visa_company, e.paid_by, e.title, e.department, e.shift_id, e.work_email, e.work_phone,
    m.full_name as mgr from employees e left join employees m on m.id=e.manager_id
    where e.full_name='Shohruh Karimov') t`)[0];
  /* Twelve since 'Based' joined them — the one fact on a record that had no
     write path anywhere in the portal at all. */
  ok('twelve boxes, one per field', r.keys.length === 12, r.keys);
  ok('and Based is among them, as a picker',
     r.keys.includes('remote') && r.basedIsSelect, r.keys);
  ok('department is a picker, not a box to spell it into',
     r.deptIsSelect && !r.deptIsInput, [r.deptIsSelect, r.deptIsInput]);
  ok('offering the departments that exist, and a way to add one that does not',
     r.deptOpts.length > 3 && r.deptOpts.includes('__new'), r.deptOpts);
  ok('the name is the name on file', r.name === want.full_name, [r.name, want.full_name]);
  ok('the employee ID is the one on file', r.staffNo === want.staff_no, [r.staffNo, want.staff_no]);
  ok('company, visa and paid from are the three on file',
     r.company === want.company && r.visa === want.visa_company && r.paidBy === want.paid_by,
     [r.company, r.visa, r.paidBy]);
  ok('designation and department are on file', r.title === want.title && r.department === want.department,
     [r.title, r.department]);
  ok('shift and reports-to are on file', r.shift === want.shift_id && r.manager === want.mgr,
     [r.shift, r.manager]);
  ok('the work email is on file', r.email === want.work_email, [r.email, want.work_email]);
  /* The one that had no box anywhere in the portal until now. */
  ok('the work phone has a box at last, with the number in it',
     r.phone === want.work_phone && !!want.work_phone, [r.phone, want.work_phone]);
  ok('and the tick is there', r.tick);
  ok('the sales scheme is a panel of its own, in its own colour',
     r.ownPanel && r.tickInside, r);
  ok('somebody who has signed in cannot have their address retyped here', r.emailOff === true);
  ok('the screen says why, as a sentence and not as part of the field name',
     /signed in with this/.test(r.hint), r.hint.slice(0, 70));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand only accounts can reach it');
{
  const {p, errs} = await open('Shohruh Karimov', {id:'staffrec', con:true});
  const r = await p.evaluate(() => ({tab: state.tab, boxes: document.querySelectorAll('[data-sr]').length}));
  ok('a salesman asking for it by name is put on home', r.tab === 'home', r.tab);
  ok('and is given no boxes on the way', r.boxes === 0, r.boxes);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ======================== 3. nothing is written until the list is agreed to */
console.log('\ntyping changes a draft, and the list says what it does');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(async () => {
    state.sr = {who:'Shohruh Karimov', draft:{}, confirm:false, busy:false, done:''}; render();
    const sel = document.querySelector('[data-sr="company"]');
    sel.value = 'poa'; sel.dispatchEvent(new Event('change'));
    await new Promise(k => setTimeout(k, 60));
    const hint = (document.querySelector('.panel:nth-of-type(2) .hint') || {}).textContent || '';
    const marked = !!document.querySelector('label.srchg');
    const wrote = window.__saw.length;
    document.getElementById('srSave').click();
    await new Promise(k => setTimeout(k, 60));
    const list = (document.querySelector('.edconf') || {}).textContent || '';
    const lines = [...document.querySelectorAll('.srlist li')].length;
    const wrote2 = window.__saw.length;
    document.getElementById('srNo').click();
    await new Promise(k => setTimeout(k, 60));
    const gone = !document.querySelector('.edconf');
    const still = (document.querySelector('[data-sr="company"]') || {}).value;
    document.getElementById('srReset').click();
    await new Promise(k => setTimeout(k, 60));
    return {hint, marked, wrote, list, lines, wrote2, gone, still,
            afterUndo: (document.querySelector('[data-sr="company"]') || {}).value,
            saveOff: (document.getElementById('srSave') || {}).disabled};
  });
  ok('the header counts what is waiting', /1 change not saved/.test(r.hint), r.hint);
  ok('and the field itself is marked', r.marked);
  ok('typing alone writes nothing at all', r.wrote === 0, r.wrote);
  ok('Save shows the list rather than saving', r.wrote2 === 0 && r.lines === 1, [r.wrote2, r.lines]);
  ok('the line says what it was and what it becomes', /CorpLex/.test(r.list) && /POA/.test(r.list), r.list.slice(0, 120));
  ok('and what that DOES — which run pays them, from when',
     /comes off the CorpLex run/.test(r.list) && /next month built/.test(r.list), r.list.slice(0, 260));
  ok('it says out loud that nothing is written yet', /Nothing has been written yet/.test(r.list));
  ok('Back returns to the boxes with the change still typed', r.gone && r.still === 'poa', [r.gone, r.still]);
  ok('Undo puts the record back', r.afterUndo === 'corplex' && r.saveOff === true, [r.afterUndo, r.saveOff]);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand each of the twelve says its own consequence');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(() => {
    const who = 'Shohruh Karimov', now = srNow(who);
    const say = (k, v) => srSays(k, now[k], v, who);
    return {name: say('name', 'X'), staffNo: say('staffNo', 'CP999'),
            visa: say('visa', 'poa'), paidBy: say('paidBy', 'poa'),
            manager: say('manager', 'Avin Mascarenhas'), email: say('email', 'x@corplex.ae'),
            shift: say('shift', 'shift2'), salesOn: say('sales', 'yes'), salesOff: say('sales', 'no'),
            revenue: REVDEPT(now.company),
            /* stated both ways round, because the sentence is about crossing
               the revenue line and not about which department is named */
            deptIn:  srSays('department', 'Operations', REVDEPT(now.company)[0], who),
            deptOut: srSays('department', REVDEPT(now.company)[0], 'Operations', who),
            deptSame: srSays('department', 'Operations', 'Admin', who)};
  });
  ok('a rename leaves issued payslips alone', /already issued keep the old name/.test(r.name), r.name);
  ok('an employee ID does not rewrite closed runs', /already closed keep the old ID/.test(r.staffNo), r.staffNo);
  ok('visa says whose letterhead the letters carry', /letterhead/.test(r.visa), r.visa);
  ok('paid from says whose account the money leaves', /transferred out of/.test(r.paidBy), r.paidBy);
  ok('reports-to says where waiting requests go', /including any waiting right now/.test(r.manager), r.manager);
  ok('the work email says it is their sign-in', /sign in with/.test(r.email), r.email);
  ok('the shift says what it is measured against', /late-arrival|attendance/.test(r.shift), r.shift);
  ok('the tick says which three pages open', /leaderboard/.test(r.salesOn) && /open for them|open/.test(r.salesOn), r.salesOn);
  ok('and unticking says they close again', /close for them again/.test(r.salesOff), r.salesOff);
  ok('a department move into revenue says so', /puts them into/.test(r.deptIn), [r.revenue, r.deptIn]);
  ok('and one out of it says so too', /takes them out of/.test(r.deptOut), r.deptOut);
  ok('a move that does not cross that line claims nothing about commission',
     /organisation chart/.test(r.deptSame) && !/sales tables/.test(r.deptSame), r.deptSame);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ===================================== 4. agreeing writes what was typed */
console.log('\nagreeing writes the record first and the tick second');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const saw = await p.evaluate(async () => {
    state.sr = {who:'Shohruh Karimov', confirm:true, busy:false, done:'',
      draft:{company:'poa', phone:'0500000000', staffNo:'CP900', sales:'yes',
             salesCo:'poa', salesDept:'Sales'}};
    render();
    document.getElementById('srGo').click();
    await new Promise(k => setTimeout(k, 300));
    return {calls: window.__saw, done: (document.querySelector('.edok') || {}).textContent || '',
            draft: Object.keys(SRF().draft).length};
  });
  const rec = saw.calls.find(c => c[0] === 'saveStaffRecord');
  const tick = saw.calls.find(c => c[0] === 'setSalesMember');
  ok('two calls, the record before the tick',
     saw.calls.length === 2 && saw.calls[0][0] === 'saveStaffRecord'
     && saw.calls[1][0] === 'setSalesMember', saw.calls.map(c => c[0]));
  ok('the record carries only what was typed',
     rec && rec[1].company === 'poa' && rec[1].phone === '0500000000'
     && rec[1].staffNo === 'CP900' && rec[1].name === undefined, rec && rec[1]);
  ok('and it is keyed by the person, not by their name', rec && /^[0-9a-f-]{36}$/.test(rec[1].emp), rec && rec[1].emp);
  ok('the tick carries on, the company and the leaderboard',
     tick && tick[2] === true && tick[3] === 'poa' && tick[4] === 'Sales', tick);
  ok('the screen says it saved and the draft is empty', /Saved/.test(saw.done) && saw.draft === 0, saw);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand a tick on its own touches only the tick');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const calls = await p.evaluate(async () => {
    state.sr = {who:'Donia Mohamed Mahmoud Ahmed', confirm:true, busy:false, done:'', draft:{sales:'no'}};
    render();
    document.getElementById('srGo').click();
    await new Promise(k => setTimeout(k, 300));
    return window.__saw;
  });
  ok('one call, and it is the tick',
     calls.length === 1 && calls[0][0] === 'setSalesMember' && calls[0][2] === false, calls);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* =============== 4b. the leaderboard is a picker of the ones that exist */
console.log('\nthe leaderboard is one that exists, and follows the company above it');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(async () => {
    const out = {};
    state.sr = {who:'Shohruh Karimov', draft:{sales:'yes', salesCo:'corplex', salesDept:'Corporate & Legal'},
                confirm:false, busy:false, done:''};
    render();
    const box = () => document.querySelector('[data-sr="salesDept"]');
    out.isSelect = box() && box().tagName === 'SELECT';
    out.free = !!document.querySelector('input[data-sr="salesDept"]');
    out.corplex = [...box().options].map(o => o.value);
    /* changing the company must change the list AND move a board that is no
       longer valid, rather than leaving one that resolves to the wrong table */
    const co = document.querySelector('[data-sr="salesCo"]');
    co.value = 'poa'; co.dispatchEvent(new Event('change'));
    await new Promise(k => setTimeout(k, 80));
    out.poa = [...box().options].map(o => o.value);
    out.movedTo = box().value;
    out.draft = SRF().draft.salesDept;
    /* and a company with no revenue department has nothing to offer */
    HR().revDept = {corplex:['Corporate & Legal','Accounting & Tax'], poa:['Sales']};
    const co2 = document.querySelector('[data-sr="salesCo"]');
    co2.value = 'lex'; co2.dispatchEvent(new Event('change'));
    await new Promise(k => setTimeout(k, 80));
    out.lexOff = box().disabled;
    out.lexSays = [...document.querySelectorAll('.srsales .cap')].map(x => x.textContent).pop() || '';
    return out;
  });
  ok('it is a picker, not a box to type a department into', r.isSelect && !r.free, r);
  ok("CorpLex offers its two revenue departments and nothing else",
     JSON.stringify(r.corplex) === JSON.stringify(['Corporate & Legal','Accounting & Tax']), r.corplex);
  ok('POA offers only Sales', JSON.stringify(r.poa) === JSON.stringify(['Sales']), r.poa);
  ok('and changing the company moves a board that no longer exists',
     r.movedTo === 'Sales' && r.draft === 'Sales', r);
  ok('a company with no revenue department offers nothing at all', r.lexOff === true, r.lexOff);
  ok('and says what to do about it rather than sitting empty',
     /no department set as earning revenue/.test(r.lexSays), r.lexSays.slice(0, 90));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  /* Ticking somebody on from cold must not leave the board blank, which is the
     one thing the database refuses outright. */
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(async () => {
    const who = USERS.map(x => x.name).find(n => !SALESEXTRA(n) && companyOf(n).key === 'corplex');
    state.sr = {who, draft:{}, confirm:false, busy:false, done:''}; render();
    const t = document.getElementById('srSales');
    t.checked = true; t.dispatchEvent(new Event('change'));
    await new Promise(k => setTimeout(k, 80));
    return {who, board: (document.querySelector('[data-sr="salesDept"]') || {}).value,
            draft: SRF().draft.salesDept};
  });
  ok('ticking somebody on fills the board in rather than leaving it empty',
     !!r.board && r.draft === r.board, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ========= 4d. an empty tick beside somebody who plainly has sales access */
console.log('\nthe screen says which of the two is carrying them');
{
  /* Avin: 'there is no tick on Zhavokhir (i never put one). I can still see
     his sales from his login.' Correct — he is a consultant in Corporate &
     Legal, which earns revenue for CorpLex, so his DEPARTMENT lets him in and
     the tick is the exception for people whose does not. An empty tick beside
     somebody with sales access reads as a bug unless the screen says so. */
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(() => {
    /* the FIRST cap is the note about why the tick is off; the leaderboard note
       is the last one, and only there once the tick is on */
    const say = () => (document.querySelector('.srsales .cap') || {}).textContent || '';
    const who = USERS.map(x => x.name).find(n =>
      !SALESEXTRA(n) && REVDEPT(companyOf(n).key).includes(orgDeptOf(n)));
    state.sr = {who, draft:{}, confirm:false, busy:false, done:''}; render();
    const out = {who, ticked: (document.getElementById('srSales') || {}).checked, off: say()};
    /* and somebody whose department does NOT earn says nothing of the sort */
    const other = USERS.map(x => x.name).find(n =>
      !SALESEXTRA(n) && !REVDEPT(companyOf(n).key).includes(orgDeptOf(n)));
    state.sr = {who: other, draft:{}, confirm:false, busy:false, done:''}; render();
    out.other = other; out.otherSays = say();
    return out;
  });
  ok('there is somebody on the scheme through their department alone', !!r.who && !r.ticked, r);
  ok('and the screen says the department is what is carrying them',
     /already on the scheme without this tick/.test(r.off), r.off.slice(0, 120));
  ok('and names the department and the company doing it',
     /earns revenue for/.test(r.off), r.off.slice(0, 160));
  ok('and says what the tick is actually for', /an accountant who also sells/.test(r.off), r.off.slice(0, 200));
  ok('somebody whose department does not earn is told none of that',
     !!r.other && !/already on the scheme/.test(r.otherSays), [r.other, r.otherSays.slice(0, 80)]);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================= 4c. a department that is not on the list yet */
console.log('\na department that does not exist yet can still be typed');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true});
  const r = await p.evaluate(async () => {
    state.sr = {who:'Shohruh Karimov', draft:{}, confirm:false, busy:false, done:'', newDept:false};
    render();
    const was = document.querySelector('select[data-sr="department"]').value;
    const d = document.querySelector('[data-sr="department"]');
    d.value = '__new'; d.dispatchEvent(new Event('change'));
    await new Promise(k => setTimeout(k, 80));
    const out = {was,
      box: !!document.querySelector('input[data-sr="department"]'),
      cancel: !!document.getElementById('srDeptBack'),
      /* the escape itself must never become the department */
      draft: SRF().draft.department,
      counted: (document.querySelector('.panel:nth-of-type(2) .hint') || {}).textContent || ''};
    const b = document.querySelector('input[data-sr="department"]');
    b.value = 'Marketing & Growth'; b.dispatchEvent(new Event('input'));
    await new Promise(k => setTimeout(k, 420));
    out.typed = SRF().draft.department;
    document.getElementById('srSave').click();
    await new Promise(k => setTimeout(k, 80));
    out.says = (document.querySelector('.edconf') || {}).textContent || '';
    document.getElementById('srNo').click();
    await new Promise(k => setTimeout(k, 80));
    document.getElementById('srDeptBack').click();
    await new Promise(k => setTimeout(k, 80));
    out.backToList = (document.querySelector('select[data-sr="department"]') || {}).value;
    out.clean = Object.keys(SRF().draft).length;
    return out;
  });
  ok('the list ends in a way out', r.box && r.cancel, r);
  ok('and choosing it does not make "__new" the department',
     r.draft === '' && !/__new/.test(r.counted), r);
  ok('the new name is taken', r.typed === 'Marketing & Growth', r.typed);
  ok('and the confirm list reads it back', /Marketing & Growth/.test(r.says), r.says.slice(0, 140));
  ok('Cancel puts the list back with the department they had',
     r.backToList === r.was && r.clean === 0, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================================ 5. what the database refuses */
console.log('\nthe database still refuses what it always refused');
{
  /* Nineteen since 'Based' joined it. The count matters more than the number:
     adding an argument makes an OVERLOAD unless the old signature is dropped,
     and a call by name would then land on either one. */
  ok('correct_joining takes nineteen arguments, and only one of it exists',
     one(`select count(*)||'/'||max(p.pronargs) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='correct_joining'`) === '1/19',
     json(`select coalesce(json_agg(t),'[]') from (select pg_get_function_identity_arguments(p.oid) a
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='correct_joining') t`));

  const SHO = one(`select id from employees where full_name='Shohruh Karimov'`);
  const RANA = one(`select id from employees where full_name='Rana Amine'`);
  ok('nobody may report to themselves',
     /report to themselves/.test(refused(`select correct_joining('${SHO}'::uuid, p_manager => '${SHO}'::uuid)`)));
  ok('an employee ID already in use is refused',
     /already somebody else's employee ID/.test(
       refused(`select correct_joining('${SHO}'::uuid, p_staff_no => (select staff_no from employees where id='${RANA}'))`)));
  ok('and a signed-in address cannot be moved from here',
     /already signed in/.test(refused(`select correct_joining('${SHO}'::uuid, p_email => 'somethingelse@corplex.ae')`)));
  ok('a work phone and an employee ID actually land',
     (() => { const was = json(`select coalesce(json_agg(t),'[]') from (select work_phone, staff_no from employees where id='${SHO}') t`)[0];
       asAvin(`select correct_joining('${SHO}'::uuid, p_phone => '0509999999', p_staff_no => 'CP901')`);
       const now = json(`select coalesce(json_agg(t),'[]') from (select work_phone, staff_no from employees where id='${SHO}') t`)[0];
       raw(`update employees set work_phone=${was.work_phone === null ? 'null' : `'${was.work_phone}'`},
            staff_no=${was.staff_no === null ? 'null' : `'${was.staff_no}'`} where id='${SHO}'`);
       const back = json(`select coalesce(json_agg(t),'[]') from (select work_phone, staff_no from employees where id='${SHO}') t`)[0];
       return now.work_phone === '0509999999' && now.staff_no === 'CP901'
              && back.work_phone === was.work_phone && back.staff_no === was.staff_no; })());
  ok('only accounts may correct a record at all',
     /Only accounts/.test(refused(`select correct_joining('${SHO}'::uuid, p_title => 'x')`,
       '00000000-0000-0000-0000-000000000000')));

  ok('a tick with no department is refused — it decides the leaderboard',
     /A department is needed/.test(refused(`select set_sales_member('${SHO}'::uuid, true, 'corplex', null)`)));
  ok('a tick pointed at a company that does not exist is refused',
     /not one of the companies/.test(refused(`select set_sales_member('${SHO}'::uuid, true, 'nowhere', 'Sales')`)));
  ok('a leaderboard that is not one of that company\'s is refused',
     /is not a leaderboard for corplex/.test(refused(`select set_sales_member('${SHO}'::uuid, true, 'corplex', 'HR & Finance')`)));
  ok('and the refusal names the ones that would have worked',
     /Corporate & Legal or Accounting & Tax/.test(
       refused(`select set_sales_member('${SHO}'::uuid, true, 'corplex', 'HR & Finance')`)));
  ok("one company's leaderboard is not another's",
     /is not a leaderboard for poa/.test(refused(`select set_sales_member('${SHO}'::uuid, true, 'poa', 'Corporate & Legal')`)));
  ok('and the missing-department message says which ones there are',
     /Corporate & Legal or Accounting & Tax/.test(
       refused(`select set_sales_member('${SHO}'::uuid, true, 'corplex', null)`)));
  ok('and only accounts change who is on sales',
     /Only accounts/.test(refused(`select set_sales_member('${SHO}'::uuid, true, 'corplex', 'Sales')`,
       '00000000-0000-0000-0000-000000000000')));
  ok('ticking and unticking is a round trip',
     (() => { asAvin(`select set_sales_member('${SHO}'::uuid, true, 'poa', 'Sales')`);
       const on = one(`select company||'/'||department from sales_members where employee_id='${SHO}'`);
       asAvin(`select set_sales_member('${SHO}'::uuid, false)`);
       return on === 'poa/Sales' && one(`select count(*) from sales_members where employee_id='${SHO}'`) === '0'; })());

  ok('the three who were in the settings blob are rows now',
     one(`select count(*) from sales_members`) === '3',
     json(`select coalesce(json_agg(t),'[]') from (select e.full_name, m.company, m.department
       from sales_members m join employees e on e.id=m.employee_id) t`));
  ok('and the blob itself is empty, so there is one answer',
     one(`select coalesce((select value::text from settings where key='sales_extra'), '{}')`) === '{}');
  ok('a row is keyed by the person, so a rename cannot orphan it',
     one(`select count(*) from information_schema.key_column_usage k join information_schema.table_constraints c
          on c.constraint_name=k.constraint_name where k.table_name='sales_members'
          and c.constraint_type='PRIMARY KEY' and k.column_name='employee_id'`) === '1');
}

/* ============== 6. the tick, not the workbook, is what opens sales for them */
console.log('\nthe tick opens the sales pages, whatever the last upload said');
{
  /* Whether somebody sees the sales pages was decided by DATA.dept — which is
     built from the last uploaded workbook. So a person who joins mid-quarter
     saw nothing until the next upload named them, and an accountant who also
     sells was never in it at all. That is the whole reason for the tick.
     Proved on somebody the workbook does not name, ticked and then unticked. */
  const CO = 'corplex';
  const V = json(`select coalesce(json_agg(t),'[]') from (select id, full_name, department
     from employees e where active and company='${CO}' and auth_user_id is not null
     and not exists (select 1 from sales_members m where m.employee_id=e.id)
     order by full_name) t`);
  let subject = null;
  for(const c of V){
    const {p} = await open(c.full_name, {id:'home'});
    const has = await p.evaluate(() => !!DATA.dept[state.user]);
    await p.close();
    if(!has){ subject = c; break; }
  }
  ok('there is somebody the workbook does not name', !!subject, subject);

  if(subject){
    const before = await (async () => {
      const {p} = await open(subject.full_name, {id:'home'});
      const r = await p.evaluate(() => ({sees: seesDeptSales(state.user),
        nav: [...document.querySelectorAll('.rail [data-tab]')].map(x => x.textContent.trim())}));
      await p.close(); return r;
    })();
    ok('and today the sales pages are shut for them', !before.sees
       && !before.nav.some(x => /leaderboard/i.test(x)), before);

    asAvin(`select set_sales_member('${subject.id}'::uuid, true, '${CO}', 'Corporate & Legal')`);
    const after = await (async () => {
      const {p, errs} = await open(subject.full_name, {id:'home'});
      const r = await p.evaluate(() => ({sees: seesDeptSales(state.user),
        extra: !!SALESEXTRA(state.user), dept: !!DATA.dept[state.user],
        nav: [...document.querySelectorAll('.rail [data-tab]')].map(x => x.textContent.trim())}));
      await p.close(); return Object.assign(r, {errs});
    })();
    /* The tick opens the sales section: their own three screens and Team
       performance. It does NOT open the Department screen or the leaderboard,
       which since 0032 are the sales-viewers list and nothing else — a tick is
       'this person sells', not 'this person may see the whole company'. */
    ok('one tick, and the sales pages open', after.sees
       && ['My dashboard', 'My commission', 'My invoices', 'Team performance']
            .every(w => after.nav.some(x => x.includes(w))), after.nav);
    ok('but not the Department screen or the leaderboard',
       !after.nav.some(x => /leaderboard/i.test(x))
       && !after.nav.some(x => /^Department$/.test(x)), after.nav);
    ok('and it is the tick that did it, not the workbook', after.extra && !after.dept, after);
    ok('no page errors', !after.errs.length, after.errs[0]);

    asAvin(`select set_sales_member('${subject.id}'::uuid, false)`);
    const back = await (async () => {
      const {p} = await open(subject.full_name, {id:'home'});
      const r = await p.evaluate(() => ({sees: seesDeptSales(state.user), extra: !!SALESEXTRA(state.user)}));
      await p.close(); return r;
    })();
    ok('unticking shuts them again, and the person is as they were',
       !back.sees && !back.extra
       && one(`select count(*) from sales_members where employee_id='${subject.id}'`) === '0', back);
  }
}
{
  /* The tick is not a licence to invent figures: POA has never had a workbook
     uploaded, so there is nothing for somebody ticked there to look at, and the
     portal says so by keeping the pages shut rather than showing empty ones. */
  const {p, errs} = await open('Donia Mohamed Mahmoud Ahmed', {id:'home'});
  const r = await p.evaluate(() => ({extra: !!SALESEXTRA(state.user), sees: seesDeptSales(state.user)}));
  ok('somebody ticked at a company with no sales data is on the tick', r.extra, r);
  ok('but the pages stay shut, because there is nothing behind them', !r.sees, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  const {p, errs} = await open('Shohruh Karimov', {id:'home'});
  const r = await p.evaluate(() => ({extra: !!SALESEXTRA(state.user), sees: seesDeptSales(state.user)}));
  ok('somebody not on the tick is unaffected by it', !r.extra, r);
  ok('and still sees the pages their own department earns', r.sees, r);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ==================================== 7. department stops living in two places */
console.log('\ndepartment stops living in two places');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'salesstaff', con:true});
  const r = await p.evaluate(() => ({
    txt: document.getElementById('view').textContent || '',
    boxes: document.querySelectorAll('#mvWho, #mvDept, #mvGo').length,
    heads: [...document.querySelectorAll('#view h3')].map(x => x.textContent.trim()),
    go: !!document.querySelector('[data-go="staffrec"]')}));
  ok('the old move-somebody form is gone from Sales', r.boxes === 0, r.boxes);
  /* The page assembler matches panels by the text of their h3, so a renamed
     heading drops the panel silently — the pointer has to still be on the page. */
  ok('the panel is still on the page under its new name',
     r.heads.some(h => /Moving somebody between departments/.test(h)), r.heads);
  ok('and what is left points at Staff Records', r.go && /Staff Records/.test(r.txt));
  ok('the caption above no longer sends anybody to a form that is gone',
     !/panel below to move somebody/.test(r.txt));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ========================================== 8. the migration not yet run */
console.log('\nand a portal deployed before 0023 is run still opens');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'staffrec', con:true}, 'sales_members');
  const r = await p.evaluate(() => ({
    open: !document.getElementById('app').classList.contains('hidden'),
    drew: (document.getElementById('view').textContent || '').length,
    picker: (document.getElementById('srWho') || {}).options ? document.getElementById('srWho').options.length : -1}));
  ok('the portal opens with no sales_members table at all', r.open && r.drew > 200, r);
  ok('and Staff Records still draws its picker', r.picker > 20, r.picker);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  const {p, errs} = await open('Donia Mohamed Mahmoud Ahmed', {id:'home'}, 'sales_members');
  ok('and somebody on the tick simply loses it rather than the portal breaking',
     await p.evaluate(() => !document.getElementById('app').classList.contains('hidden')));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

await b.close(); server.close();
console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
