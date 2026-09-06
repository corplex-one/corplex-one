/* A person fills in their own document numbers — and cannot change one
 * accounts already holds.
 *
 *   'There is no option to add document number. I have it in the console, but
 *    if employee, themselves fill it, then there should be a cell to enter the
 *    number'                                                          -- Avin
 *
 * The interesting part is not the box. It is that the rule this replaces was
 * never enforced: the page said 'accounts' to type' and printed the numbers
 * read-only, while write_own_private has always been FOR ALL with
 * employee_id = me(). Anybody could already have set their own Emirates ID
 * through the API. So what this checks is that the rule now lives in the
 * database, and that the screen agrees with it:
 *
 *   1. a blank number is a box, and typing in it saves;
 *   2. one accounts holds is read-only on screen AND refused by the database;
 *   3. accounts still changes any of them;
 *   4. somebody else's profile never shows a box;
 *   5. the four count towards a complete profile, the labour card excepted,
 *      because the upload list has always said it is not needed of everybody.
 *
 *   node scripts/checkrefnum.mjs
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
const refused = (s, u) => { try { raw(s, u); return ''; }
  catch(e){ return String((e.stderr || e.message) || '').replace(/\s+/g, ' '); } };
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

/* Somebody with an Emirates ID and nothing else — the shape almost everybody
   is in, and the one the boxes are for. */
const HIM = json(`select coalesce(json_agg(t),'[]') from (
  select e.id, e.auth_user_id, e.full_name, p.emirates_id, p.passport_no
    from employees e join employee_private p on p.employee_id = e.id
   where e.active and e.auth_user_id is not null
     and coalesce(p.emirates_id,'') <> '' and coalesce(p.passport_no,'') = ''
   order by e.full_name limit 1) t`)[0];
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];
const restore = () => raw(`update employee_private set passport_no = null, visa_no = null, labour_no = null,
  emirates_id = '${HIM.emirates_id}' where employee_id = '${HIM.id}'`);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, tab, who){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1500, height: 1200}});
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
  await p.evaluate(t => { state.mode = 'staff'; state.tab = t.id; state.who = t.who || ''; render(); }, {id: tab, who});
  await p.waitForTimeout(200);
  return {p, errs};
}

try {

/* ============================================== 1. the screen */
console.log(`\n${HIM.full_name} — an Emirates ID on file, nothing else`);
{
  const {p, errs} = await open(HIM.full_name, 'profile');
  const r = await p.evaluate(() => {
    const panel = t => [...document.querySelectorAll('#view section.panel')]
      .find(x => new RegExp(t).test((x.querySelector('h3') || {}).textContent || ''));
    const docs = panel('Your documents'), emp = panel('Employment');
    const heads = [...docs.querySelectorAll('thead th')].map(x => x.textContent.trim());
    const box = k => docs.querySelector(`.refin[data-pf="${k}"]`);
    return {
      /* Avin: the number belongs in Your documents, and Employment above is
         not to become an editable table. */
      column: heads,
      inEmployment: emp.querySelectorAll('input').length,
      eidBox: !!box('eid'),
      eidMasked: !!docs.querySelector('.refval'),
      boxes: ['passport','visa','labour'].filter(k => !!box(k)),
      show: !!emp.querySelector('#eidShow'),
      /* Avin: 'Show numbers is at a wrong place.' It was glued to whichever
         number happened to be listed first, which broke the right edge the
         values line up on. It is a panel control, so it lives in the header. */
      showInHeader: !!emp.querySelector('header #eidShow'),
      showInRow: !!emp.querySelector('dd #eidShow'),
      edges: [...emp.querySelectorAll('.refval')].map(x =>
        Math.round(x.getBoundingClientRect().right)),
      cap: (docs.querySelector('.cap') || {}).textContent || ''};
  });
  ok('the number is a column in Your documents', r.column.includes('Number'), r.column);
  ok('and it sits between the copy and the expiry',
     r.column.indexOf('Number') === r.column.indexOf('Copy') + 1
     && r.column.indexOf('Number') === r.column.indexOf('Expires') - 1, r.column);
  ok('the Employment panel above has no box in it at all', r.inEmployment === 0, r.inEmployment);
  ok('the Emirates ID accounts holds is not a box', !r.eidBox);
  ok('it is shown masked instead', r.eidMasked);
  ok('and one Show numbers button still uncovers it', r.show);
  ok('it sits in the panel header, not against a number', r.showInHeader && !r.showInRow, r);
  ok('so every number keeps the same right edge',
     new Set(r.edges).size <= 1, r.edges);
  ok('the three that are blank are boxes', r.boxes.length === 3, r.boxes);
  ok('and the caption asks for the number', /Type the number off each document/.test(r.cap), r.cap.slice(0, 80));

  // typing in one reaches the save bar and then the database call
  const saved = await p.evaluate(async () => {
    const el = document.querySelector('.refin[data-pf="passport"]');
    el.value = 'P1234567';
    el.dispatchEvent(new Event('input', {bubbles: true}));
    await new Promise(r => setTimeout(r, 420));
    const bar = (document.querySelector('.pfsave span') || {}).textContent || '';
    document.getElementById('pfSave').click();
    await new Promise(r => setTimeout(r, 200));
    return {bar, saw: window.__saw.filter(x => x[0] === 'saveProfileAll').map(x => x[1])};
  });
  ok('typing a number counts as an unsaved change', /1 change/.test(saved.bar), saved.bar);
  ok('and Save sends it as the passport number',
     saved.saw.length === 1 && saved.saw[0].passport === 'P1234567', saved.saw);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ---- the two that have a shape ----
 *
 *   Avin gave them: the residence visa is three digits, four, one and six,
 *   with slashes; the Emirates ID is three, four, seven and one, with dashes.
 *
 * Passport and labour card are deliberately free — a passport number's shape
 * depends on who issued it, and a rule that rejects a real one is worse than
 * no rule, because the person cannot correct it from their side. */
console.log('\nthe shape of a document number');
{
  const {p, errs} = await open(HIM.full_name, 'profile');
  const r = await p.evaluate(() => ({
    eidPh: refPh('eid'), visaPh: refPh('visa'),
    passPh: refPh('passport'),
    eid: ['7', '78419', '784198641376', '784198641376599'].map(x => refFormat('eid', x)),
    visa: ['2', '20120', '201202435', '201202434567891111'].map(x => refFormat('visa', x)),
    paste: refFormat('eid', '784-1986-4137659-9'),
    free: refFormat('passport', 'K1234567'),
    whole: [refWhole('eid', '784-1986-4137659-9'), refWhole('eid', '784-1986'),
            refWhole('visa', '201/2024/3/456789'), refWhole('passport', 'anything')]
  }));
  ok('the Emirates ID shows its own shape as the placeholder', r.eidPh === '784-0000-0000000-0', r.eidPh);
  ok('and the residence visa shows its own', r.visaPh === '000/0000/0/000000', r.visaPh);
  ok('a passport keeps a plain hint, because its shape is the issuer\u2019s',
     !/^0/.test(r.passPh), r.passPh);
  ok('the dashes appear as the digits go in',
     r.eid.join(' ') === '7 784-19 784-1986-41376 784-1986-4137659-9', r.eid);
  ok('and the slashes do', r.visa[2] === '201/2024/3/5', r.visa);
  ok('a number pasted with its separators already in comes out the same', r.paste === '784-1986-4137659-9', r.paste);
  ok('and one digit too many is dropped rather than kept',
     r.visa[3] === '201/2024/3/456789', r.visa[3]);
  ok('a passport is left exactly as typed', r.free === 'K1234567', r.free);
  ok('and a shape is whole only when every digit is in',
     r.whole.join(',') === 'true,false,true,true', r.whole);

  /* The point of all of it: a half-typed one cannot be saved. */
  const half = await p.evaluate(async () => {
    const el = document.querySelector('.refin[data-pf="visa"]');
    el.value = '201/2024/3'; el.dispatchEvent(new Event('input', {bubbles: true}));
    await new Promise(r => setTimeout(r, 420));
    return {cls: document.querySelector('.refin[data-pf="visa"]').className,
            say: (document.querySelector('.pfsave span') || {}).textContent || '',
            off: document.getElementById('pfSave').disabled};
  });
  ok('a half-typed number marks its own box', /\bpart\b/.test(half.cls), half.cls);
  ok('the save bar names it and the shape it wants',
     /Residence visa is not finished/.test(half.say) && /000\/0000/.test(half.say), half.say);
  ok('and Save cannot be pressed', half.off === true);

  const done = await p.evaluate(async () => {
    const el = document.querySelector('.refin[data-pf="visa"]');
    el.value = '201/2024/3/456789'; el.dispatchEvent(new Event('input', {bubbles: true}));
    await new Promise(r => setTimeout(r, 420));
    return {say: (document.querySelector('.pfsave span') || {}).textContent || '',
            off: document.getElementById('pfSave').disabled};
  });
  ok('finishing it lets the save through', done.off === false && /not saved yet/.test(done.say), done);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================================== 2. and 3. the database */
console.log('\nand the database is where the rule actually lives');
{
  ok('a blank number is theirs to fill',
     refused(`update employee_private set passport_no='P1234567' where employee_id='${HIM.id}'`, HIM.auth_user_id) === ''
     && one(`select passport_no from employee_private where employee_id='${HIM.id}'`) === 'P1234567');
  ok('once it is there they cannot change it',
     /Accounts holds your passport number/.test(
       refused(`update employee_private set passport_no='P9' where employee_id='${HIM.id}'`, HIM.auth_user_id)));
  ok('nor blank it out again',
     /Accounts holds your passport number/.test(
       refused(`update employee_private set passport_no=null where employee_id='${HIM.id}'`, HIM.auth_user_id)));
  ok('nor the Emirates ID accounts typed off the card',
     /Accounts holds your Emirates ID/.test(
       refused(`update employee_private set emirates_id='784-2000-0000000-0' where employee_id='${HIM.id}'`, HIM.auth_user_id)));
  ok('the message names every number at once rather than one at a time',
     /passport number, residence visa number/.test((() => {
       raw(`update employee_private set visa_no='V1' where employee_id='${HIM.id}'`);
       return refused(`update employee_private set passport_no='X', visa_no='Y' where employee_id='${HIM.id}'`, HIM.auth_user_id);
     })()));
  ok('the rest of their profile is untouched by any of this',
     refused(`update employee_private set uae_address='Flat 1' where employee_id='${HIM.id}'`, HIM.auth_user_id) === '');
  ok('accounts changes any of them, as before',
     refused(`update employee_private set passport_no='P7777777' where employee_id='${HIM.id}'`, AVIN.auth_user_id) === ''
     && one(`select passport_no from employee_private where employee_id='${HIM.id}'`) === 'P7777777');
  raw(`update employee_private set uae_address=null where employee_id='${HIM.id}'`);
  restore();
  ok('and the person this check borrowed is back as they were',
     one(`select coalesce(passport_no,'-')||'/'||coalesce(visa_no,'-')||'/'||emirates_id
            from employee_private where employee_id='${HIM.id}'`) === '-/-/' + HIM.emirates_id);
}

/* ============================================== 4. somebody else's profile */
console.log('\nnobody else gets a box on their page');
{
  const {p, errs} = await open('Avin Mascarenhas', 'people', HIM.full_name);
  const r = await p.evaluate(() => ({boxes: document.querySelectorAll('.refin').length}));
  ok('accounts looking at a colleague sees no box', r.boxes === 0, r.boxes);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================================== 5. completeness */
console.log('\nand a profile is not complete without them');
{
  const {p, errs} = await open(HIM.full_name, 'profile');
  const r = await p.evaluate(() => {
    const D = profDone(state.user);
    return {missing: D.missing, total: D.total,
            wantsLabour: D.missing.some(m => /Labour/i.test(m)),
            wantsPassport: D.missing.some(m => /Passport/i.test(m))};
  });
  ok('a missing passport number is counted as missing', r.wantsPassport, r.missing);
  ok('a missing labour card is not', !r.wantsLabour, r.missing);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

} finally {
  restore();
  await b.close(); server.close();
}

console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
