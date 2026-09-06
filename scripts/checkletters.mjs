/* Letters he can add himself, and paper with an address on it.
 *
 *   'Why the letterheads have no address?'
 *   'There are currently 4 letters, need an option to add if any other'
 *   'Yes, i dont want to type them'
 *   'MOL ID and Account number are not required'
 *   'Sorry, please keep MOL ID - its linked to the labour number in our
 *    document list'
 *   'MOL ID Format: Exactly 14 digits long (numeric string).'         -- Avin
 *
 * The letterhead one is worth a word, because of how it hid. DATA.entities was
 * an empty ARRAY, and every document looks the entity up by code — so every
 * lookup missed and fell through to a default that carried the legal name and
 * an empty address. The name was right on every document, which is exactly why
 * it went unnoticed: nothing looked broken, a line was simply absent. This
 * checks all three kinds of paper, because they share that one lookup and a
 * regression would take all three at once.
 *
 *   node scripts/checkletters.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h','/tmp/pg','-p','5433','-U','postgres','-d','seedtest'];
const raw = (s, u) => execFileSync(PSQL, [...base,'-tAc',
  (u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` : '') + s],
  {encoding:'utf8', maxBuffer:64e6});
const one = (s, u) => raw(s, u).trim().split('\n').pop();
const json = (s, u) => { const o = raw(s, u); const i = o.lastIndexOf('\n[');
  return JSON.parse(i < 0 ? o.trim() : o.slice(i + 1).trim()); };
const nope = (s, u) => { try { raw(s, u); return ''; }
  catch(e){ return String(e.stderr || e.message).replace(/^ERROR:\s*/m, '').split('\n')[0].trim(); } };

const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits', exit_lines:'exit_lines',
 spells:'service_spells',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads', sales_team:'sales_team_figures',
 payment_requests:'payment_requests', payment_files:'payment_files', sales_members:'sales_members'};

const TYPES = {'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const server = http.createServer((q, r) => {
  const f = path.join('web', decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'') || 'index.html');
  if(!fs.existsSync(f)){ r.writeHead(404); return r.end('no'); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});
await new Promise(k => server.listen(0, '127.0.0.1', k));
const O = 'http://127.0.0.1:' + server.address().port;

let n = 0, bad = [];
const ok = (what, pass, saw) => { n++;
  if(pass) return console.log('  ok    ' + what);
  bad.push(what + (saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)));
  console.log('  FAIL  ' + what + (saw === undefined ? '' : '  saw ' + JSON.stringify(saw))); };

const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];
const WAS = one(`select value::text from settings where key='letter_types'`);
const D = () => buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
    AVIN.auth_user_id)[0]}, AVIN.id);

const b = await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const open = async (nm, w = 1500, h = 1400) => {
  const p = await b.newPage({viewport:{width:w, height:h}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  const d = D();
  await p.evaluate(([dd, who, r]) => { window.__DATA = dd; window.__ME = who; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => async () => true});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); },
    [d, nm, d._roles[nm] || ['staff']]);
  await p.addScriptTag({path:'web/app.js'});
  return {p, errs};
};

console.log('');

try {

/* ============================================ 1. the address, on every paper */
console.log('the letterhead, on all three kinds of paper');
{
  const co = json(`select coalesce(json_agg(t),'[]') from (select key, code, legal_name, address from companies) t`);
  ok('every company has a registered address on file',
     co.every(c => (c.address || []).length > 0), co.filter(c => !(c.address||[]).length).map(c => c.key));

  const d = D();
  ok('and the lookup the documents use is keyed by code, not an empty list',
     !Array.isArray(d.entities) && Object.keys(d.entities || {}).length === co.length,
     Array.isArray(d.entities) ? 'still an array' : Object.keys(d.entities || {}));
  co.forEach(c => {
    const e = (d.entities || {})[c.code];
    ok('  ' + c.code + ' resolves, with its address',
       !!e && e.legal === c.legal_name && (e.addr || []).join('|') === (c.address || []).join('|'), e);
  });
  ok('and none of them is left saying the letterhead is unconfirmed',
     Object.values(d.entities || {}).every(e => e.ready),
     Object.values(d.entities || {}).filter(e => !e.ready).map(e => e.code));

  /* A company added without an address must still say so — the flag is worked
     out, not switched on for everybody. */
  raw(`update companies set address = '{}' where key = 'lex'`);
  ok('a company with no address on file still warns on its own paper',
     ((D().entities || {}).Lex || {}).ready === false, ((D().entities||{}).Lex||{}).ready);
  raw(`update companies set address = ` +
      `'{"${(co.find(c=>c.key==='lex').address||[]).join('","')}"}' where key = 'lex'`);
  ok('(and it is put back)', ((D().entities || {}).Lex || {}).ready === true);
}

/* ================================================ 2. what the paper carries */
console.log('\nMOL ID stays, the bank account goes');
{
  const {p, errs} = await open('Avin Mascarenhas');
  await p.evaluate(() => { state.mode='console'; state.tab='payslips'; render(); });
  await p.waitForTimeout(350);
  const got = await p.evaluate(() => { const btn = document.querySelector('[data-slip]');
    if(!btn) return null; btn.click();
    const a = document.querySelector('.slipbody'); if(!a) return null;
    return {text: a.textContent.replace(/\s+/g,' ').trim(),
            addr: [...a.querySelectorAll('.slco span')].map(x => x.textContent.trim())}; });
  ok('a payslip opens', !!got);
  ok('with the address under the company name', got && got.addr.length > 0, got && got.addr);
  ok('MOL ID is on it', got && /MOL ID/.test(got.text));
  ok('the bank account is not', got && !/Account No/i.test(got.text));
  ok('and no part of one is printed anywhere on it',
     got && !/IBAN|\bAE\d{6}/i.test(got.text));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ==================================== 3. a fourteen-digit rule with teeth */
console.log('\nan MOL number is fourteen digits');
{
  const emp = one(`select employee_id from payroll_identity limit 1`);
  ok('the rule is on the column, so anything that writes one is held to it',
     one(`select count(*) from pg_constraint where conname = 'mol_is_14_digits'`) === '1');
  let m = nope(`update payroll_identity set mol_number = '123' where employee_id = '${emp}'`);
  ok('thirteen digits is refused', /mol_is_14_digits/.test(m), m || 'IT WENT THROUGH');
  m = nope(`update payroll_identity set mol_number = '1000112929201X' where employee_id = '${emp}'`);
  ok('and so is a letter in the middle of one', /mol_is_14_digits/.test(m), m || 'IT WENT THROUGH');
  ok('while the ones on file all pass it',
     one(`select count(*) from payroll_identity where mol_number is not null and mol_number !~ '^[0-9]{14}$'`) === '0');
}

/* ================================== 4. a list you click into, and a popup */
console.log('\nthe letter templates');
{
  const {p, errs} = await open('Avin Mascarenhas');
  await p.evaluate(() => { state.mode='staff'; state.tab='letters'; render(); });
  await p.waitForTimeout(350);
  let r = await p.evaluate(() => ({
    rows: document.querySelectorAll('.lttab2 tbody tr').length,
    heads: [...document.querySelectorAll('.lttab2 thead th')].map(x => x.textContent.trim()),
    modal: !!document.querySelector('.ltmodal'),
    add: !!document.getElementById('ltNew')}));
  ok('the letters are a list', r.rows === 4, r.rows);
  ok('with what each one says beside its name',
     JSON.stringify(r.heads) === JSON.stringify(['Letter','What it says','Addressed to','Issued','']), r.heads);
  ok('nothing is open until one is clicked', !r.modal);
  ok('and there is a way to add one', r.add);

  /* The preview in the list is the template's own words, shortened. It read
     'Thi i to certify' once, because a \\s in a regex lost its backslash on the
     way through the build and the expression became /s+/ — every letter s
     replaced by a space. Nothing about the letters was wrong; the list lied
     about them. Asserted against the template rather than by eye. */
  const says = await p.evaluate(() => [...document.querySelectorAll('.lttab2 td.ltsay')]
    .map(x => x.textContent.replace(/\u2026$/, '')));
  const tpl = (HRTYPES() || []).map(t => (t.x || t).body || '');
  ok('the list quotes each letter as it is actually written',
     says.every((t, i) => (tpl[i] || '').startsWith(t.trim().slice(0, 40))),
     {shown: says[0], template: (tpl[0] || '').slice(0, 60)});
  ok('with no letters dropped out of the words',
     says.every(t => !/\bThi\b|\bha been\b|\bince\b/.test(t)), says[0]);

  await p.evaluate(() => document.querySelector('.lttab2 tbody tr').click());
  await p.waitForTimeout(250);
  r = await p.evaluate(() => ({
    modal: !!document.querySelector('.ltmodal'),
    title: (document.querySelector('.ltlook header b')||{}).textContent,
    fields: ['ltLab','ltAdr','ltBody'].filter(i => document.getElementById(i)),
    chips: [...document.querySelectorAll('[data-lt-put]')].map(x => x.dataset.ltPut),
    prev: (document.getElementById('ltPrev')||{}).textContent || '',
    see: (document.getElementById('ltSee')||{}).disabled,
    go: !!document.getElementById('ltGo')}));
  ok('clicking a letter opens it over the page', r.modal);
  ok('titled with the letter you clicked', /Salary certificate/.test(r.title||''), r.title);
  ok('with its name, its addressee and its text', r.fields.length === 3, r.fields);
  ok('the placeholders are offered as buttons rather than typed by hand',
     ['{name}','{legal}','{title}','{doj}','{salary}','{basic}','{allow}'].every(f => r.chips.includes(f)),
     r.chips);
  ok('the preview shows it filled in', !/\{name\}/.test(r.prev) && r.prev.length > 30, r.prev.slice(0,70));
  ok('nothing to review until something changes', r.see === true);
  ok('and no button that writes', !r.go);

  /* Typing must survive: the popup is drawn by the view, and any click can
     redraw it. A modal pushed into the DOM by hand loses what is in it. */
  await p.evaluate(() => { const t = document.getElementById('ltBody');
    t.value = 'This is to certify that {name} works with {legal} as {title}.';
    t.dispatchEvent(new Event('input', {bubbles:true})); });
  await p.waitForTimeout(150);
  r = await p.evaluate(() => ({see: (document.getElementById('ltSee')||{}).disabled,
                               prev: document.getElementById('ltPrev').textContent}));
  ok('typing enables the review without a redraw taking the cursor', r.see === false);
  ok('and the preview follows what is typed', /works with/.test(r.prev), r.prev.slice(0,60));

  await p.evaluate(() => { render(); });
  await p.waitForTimeout(200);
  r = await p.evaluate(() => (document.getElementById('ltBody')||{}).value);
  ok('a redraw keeps what has been typed', /works with/.test(r || ''), (r||'').slice(0,50));

  /* A placeholder goes in at the cursor: {allow} mistyped as {allowance} is a
     letter that goes out with a brace in it. */
  await p.evaluate(() => { const t = document.getElementById('ltBody');
    t.selectionStart = t.selectionEnd = t.value.length;
    document.querySelector('[data-lt-put="{salary}"]').click(); });
  await p.waitForTimeout(150);
  r = await p.evaluate(() => (document.getElementById('ltBody')||{}).value);
  ok('a placeholder button puts it in the text', /\{salary\}$/.test(r || ''), (r||'').slice(-30));

  await p.evaluate(() => document.getElementById('ltSee').click());
  await p.waitForTimeout(250);
  r = await p.evaluate(() => { const c = document.querySelector('.ltmodal .edconf');
    return {list: !!c, text: c ? c.textContent.replace(/\s+/g,' ') : '',
            go: !!document.getElementById('ltGo')}; });
  ok('reviewing shows what the change does', r.list);
  ok('naming the letter being changed', /Salary certificate/.test(r.text), r.text.slice(0,80));
  ok('only then is there a button that writes', r.go);

  await p.evaluate(() => document.querySelector('[data-ltclose]').click());
  await p.waitForTimeout(200);
  ok('closing puts it away', !(await p.evaluate(() => !!document.querySelector('.ltmodal'))));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ============================ 4b. a letter keeps the words it went out with */
console.log('\nand a letter that has gone out keeps what it said');
{
  const emp = one(`select id from employees where full_name = 'Shohruh Karimov'`);
  raw(`delete from letters where ref = 'LT-TEST2'`);
  raw(`insert into letters(employee_id, kind, ref, addressee, status, asked_on, decided_on,
        body_at_issue, label_at_issue)
       values ('${emp}', 'salary', 'LT-TEST2', 'Emirates NBD', 'Issued', current_date, current_date,
        'This is what it said when it went out.', 'Salary certificate')`);
  raw(`insert into letters(employee_id, kind, ref, addressee, status, asked_on)
       values ('${emp}', 'salary', 'LT-TEST3', 'A bank', 'Pending', current_date)`);

  const {p, errs} = await open('Avin Mascarenhas');
  await p.evaluate(() => { state.mode='staff'; state.tab='letters'; state.ltOpen='LT-TEST2'; render(); });
  await p.waitForTimeout(400);
  let r = await p.evaluate(() => {
    const a = document.querySelector('.slwrap');
    return a ? a.textContent.replace(/\s+/g,' ') : ''; });
  ok('an issued letter prints the words stored on it',
     /This is what it said when it went out/.test(r), r.slice(0, 90));
  ok('and not the template it came from', !/has been employed with/.test(r), r.slice(0, 90));

  /* The one that proves the point: reword the template, and the letter already
     issued must not move. */
  raw(`select set_letter_types('[{"id":"salary","label":"Salary certificate","body":"COMPLETELY DIFFERENT WORDING {name}.","needsAddressee":true},
    {"id":"nocTravel","label":"NOC for travel","body":"b"},
    {"id":"nocLicence","label":"NOC for driving licence","body":"b"},
    {"id":"employment","label":"Employment letter","body":"b"}]'::jsonb)`, AVIN.auth_user_id);
  const {p: p2, errs: e2} = await open('Avin Mascarenhas');
  await p2.evaluate(() => { state.mode='staff'; state.tab='letters'; state.ltOpen='LT-TEST2'; render(); });
  await p2.waitForTimeout(400);
  r = await p2.evaluate(() => { const a = document.querySelector('.slwrap');
    return a ? a.textContent.replace(/\s+/g,' ') : ''; });
  ok('rewording the template does not reword a letter already issued',
     /This is what it said when it went out/.test(r) && !/COMPLETELY DIFFERENT/.test(r), r.slice(0, 90));

  /* A draft has no words of its own yet, so it follows the template — which is
     right: it has not been certified to anybody. */
  const dr = await p2.evaluate(() => {
    const l = (DATA.hr.letters || []).find(x => x.id === 'LT-TEST3');
    return l ? letterSays(l) : null; });
  ok('a request not yet issued still follows the template',
     /COMPLETELY DIFFERENT/.test(dr || ''), (dr || '').slice(0, 60));
  ok('no page errors', !errs.length && !e2.length, errs[0] || e2[0]);
  await p.close(); await p2.close();
  raw(`delete from letters where ref in ('LT-TEST2','LT-TEST3')`);
}

/* ============================== 5. and the database holds the line underneath */
console.log('\nand what the database will not allow');
{
  const good = `[{"id":"salary","label":"Salary certificate","body":"b","needsAddressee":true},
    {"id":"nocTravel","label":"NOC for travel","body":"b"},
    {"id":"nocLicence","label":"NOC for driving licence","body":"b"},
    {"id":"employment","label":"Employment letter","body":"b"}]`;
  let m = nope(`select set_letter_types('${good}'::jsonb)`, one(
    `select auth_user_id from employees e where e.active and e.auth_user_id is not null
       and not exists (select 1 from employee_roles r where r.employee_id = e.id
                        and r.role in ('accounts','owner')) order by e.full_name limit 1`));
  ok('a colleague cannot change the templates', /Only accounts/.test(m), m || 'IT WENT THROUGH');

  m = nope(`select set_letter_types('[{"id":"a b","label":"X","body":"y"}]'::jsonb)`, AVIN.auth_user_id);
  ok('an id with a space in it is refused', /has to start with a letter/.test(m), m);
  m = nope(`select set_letter_types('[{"id":"a","label":"","body":"y"}]'::jsonb)`, AVIN.auth_user_id);
  ok('a letter with no name is refused', /has no name/.test(m), m);
  m = nope(`select set_letter_types('[{"id":"a","label":"A","body":"  "}]'::jsonb)`, AVIN.auth_user_id);
  ok('and one with no text', /no text/.test(m), m);
  m = nope(`select set_letter_types('[{"id":"a","label":"A","body":"y"},{"id":"a","label":"B","body":"z"}]'::jsonb)`, AVIN.auth_user_id);
  ok('two letters cannot share an id', /cannot share/.test(m), m);

  /* The one that protects history: a letter already issued holds only the id,
     so removing the type leaves it showing a slug instead of its name. */
  const emp = one(`select id from employees where active limit 1`);
  raw(`insert into letters(employee_id, kind, ref, status) values ('${emp}', 'nocTravel', 'LT-TEST', 'Issued')`);
  m = nope(`select set_letter_types('[{"id":"salary","label":"Salary certificate","body":"b"}]'::jsonb)`, AVIN.auth_user_id);
  ok('a kind with letters on file cannot be removed', /cannot be removed/.test(m), m || 'IT WENT THROUGH');
  ok('and the refusal says how many and why',
     /1 letter/.test(m) && /lose their name/.test(m), m);
  raw(`delete from letters where ref = 'LT-TEST'`);

  const out = JSON.parse(one(`select set_letter_types('${good}'::jsonb)`, AVIN.auth_user_id));
  ok('a good list saves', !!out);
  ok('and the revision letter is carried across untouched, not dropped',
     one(`select count(*) from jsonb_array_elements((select value::jsonb from settings where key='letter_types')) x
          where x->>'id' = 'revision'`) === '1');
}

} finally {
  raw(`update settings set value = '${WAS.replace(/'/g, "''")}'::jsonb where key = 'letter_types'`);
  raw(`delete from letters where ref in ('LT-TEST','LT-TEST2','LT-TEST3')`);
  await b.close(); server.close();
}

function HRTYPES(){ return json(`select coalesce(json_agg(t),'[]') from (
  select x from jsonb_array_elements((select value::jsonb from settings where key='letter_types')) x
   where coalesce(x->>'issueOnly','false') <> 'true') t`); }

console.log(bad.length ? `\n${n - bad.length} of ${n} checks passed\n  - ` + bad.join('\n  - ')
                       : `\n${n} checks, all passed`);
process.exit(bad.length ? 1 : 0);
