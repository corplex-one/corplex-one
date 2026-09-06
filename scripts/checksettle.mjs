/* The final settlement document, against the format Avin sent.
 *
 * He sent Julia's settlement as the format he wants: letterhead, a title bar,
 * a pay summary, earnings and deductions side by side, the net pay block, the
 * amount in words, three signatories and a declaration to sign.
 *
 * What this proves is not that it looks like his sample — a screenshot shows
 * that — but that the paper and the screen agree, that the arithmetic on the
 * paper closes, and that the last month's pay is in it exactly once. That
 * last one is the whole point: he said to always include it, which means the
 * leaver has to come off the monthly run, and a settlement that quietly left
 * the month out would be short by a month's salary with nothing on the page
 * to say so.
 *
 *   node scripts/checksettle.mjs
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
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
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
const page = await b.newPage({viewport: {width: 1440, height: 1100}});
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

/* Somebody with more than a year behind them, so there is a gratuity to print
 * and the document is not a special case of itself.
 *
 * The payroll sheet carries names the staff list does not — it is a workbook,
 * and a contractor on it has no record behind them. Gratuity is worked out
 * from the basic on the staff record, so a name off the sheet alone settles at
 * nought and the check goes red for the wrong reason. Ask the database for
 * people who are both, and take the payroll row that matches one of them. */
const ELIGIBLE = json(`select coalesce(json_agg(t),'[]') from (
  select e.full_name from employees e join salary_parts s on s.employee_id = e.id
   where e.doj < date '2025-01-01' and s.basic > 0) t`).map(r => r.full_name);
const WHO = await page.evaluate(([able]) => DATA.payroll.rows.filter(r => !r.dummy)
  .map(r => ({name: r.name, doj: r.doj}))
  .filter(r => r.doj && +String(r.doj).slice(-4) <= 2024 && able.includes(r.name))
  .map(r => r.name)[0], [ELIGIBLE]);
if(!WHO) throw new Error('nobody on the payroll has a year of service and a basic on file — the seed is not what this expects');

const LWD = '2026-09-15';
await page.evaluate(([who, lwd]) => {
  state.mode = 'console'; state.tab = 'exits';
  state.exitWho = who; state.exitLwd = lwd; state.exitSettle = '';
  render();
}, [WHO, LWD]);
await page.waitForTimeout(300);

console.log(`the final settlement, for ${WHO} leaving on ${LWD}:\n`);

/* ---------------------------------------------------------------- the sums */
const C = await page.evaluate(([who, lwd]) => {
  const c = exitCalc(who, lwd);
  return {monthPay:c.monthPay, mBasic:c.mBasic, mAllow:c.mAllow, grat:c.grat,
    leaveCash:c.leaveCash, leaveDays:c.leaveDays, ticket:c.ticket, adv:c.adv,
    net:c.net, paidDays:c.paidDays, lop:c.lop, period:c.period, days:c.days,
    salary:c.salary, basic:c.basic, settleDate:c.settleDate};
}, [WHO, LWD]);

const r2 = v => Math.round(v * 100) / 100;
ok('half the month is paid', C.paidDays === 15, C.paidDays);
/* The other fifteen days are not loss of pay: the person had left. Saying so
 * on a document they sign would be saying they were docked. */
ok('and the days after the last one are not called loss of pay', C.lop === 0, C.lop);
ok('the month is named as the one he leaves in', C.period === 'September 2026', C.period);
ok('half a month of basic is half the basic', C.mBasic === r2(C.basic / 2), [C.mBasic, C.basic]);
ok('and half a month of allowance is the rest of it',
   r2(C.mBasic + C.mAllow) === r2(C.salary / 2), [C.mBasic, C.mAllow, C.salary]);
ok('the settlement date follows the last working day when nothing else is said',
   C.settleDate === LWD, C.settleDate);
ok('and the total is the month plus everything owed, less the advance',
   C.net === r2(C.monthPay + C.grat + C.leaveCash + C.ticket - C.adv),
   [C.net, C.monthPay, C.grat, C.leaveCash, C.ticket, C.adv]);
ok('there is a gratuity to print', C.grat > 0, C.grat);

/* ------------------------------------------------- the screen and the paper */
const scr = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#view table tbody tr')].map(tr =>
    [...tr.children].map(td => td.textContent.trim()));
  const tot = rows.find(r => /Final settlement/.test(r[0]));
  return {rows, tot: tot ? tot[1] : null,
    month: (rows.find(r => /^Salary for /.test(r[0])) || [])[0] || null,
    monthAmt: (rows.find(r => /^Salary for /.test(r[0])) || [])[1] || null,
    hasBtn: !!document.getElementById('exDoc')};
});
ok('the screen shows the last month as its own line',
   /^Salary for September 2026 — 15 paid days$/.test(scr.month || ''), scr.month);
ok('and there is a button to open the document', scr.hasBtn);

await page.click('#exDoc');
await page.waitForTimeout(250);

const doc = await page.evaluate(() => {
  const a = document.querySelector('.slip.settle');
  if(!a) return null;
  const kv = {};
  const cells = [...a.querySelectorAll('.stkv > div')];
  for(let i = 0; i < cells.length; i += 3){
    const k = cells[i].textContent.trim();
    if(k) kv[k] = cells[i + 2].textContent.trim();
  }
  const sideOf = i => {
    const s = a.querySelectorAll('.slside')[i];
    return {rows: [...s.querySelectorAll('.slrow')].map(x => ({
              label: (x.querySelector('span').childNodes[0].textContent || '').trim(),
              sub: (x.querySelector('span i') || {textContent: ''}).textContent.trim(),
              amt: x.querySelector('b').textContent.trim()})),
            total: s.querySelector('.slst b').textContent.trim()};
  };
  return {bar: (a.querySelector('.stbar') || {}).textContent.trim(),
    kv, earn: sideOf(0), ded: sideOf(1),
    net: [...a.querySelectorAll('.stnr, .stnt')].map(x =>
      [x.querySelector('span').textContent.trim(), x.querySelector('b').textContent.trim()]),
    words: (a.querySelector('.stwords') || {}).textContent.replace(/\s+/g, ' ').trim(),
    decl: (a.querySelector('.stdecl p') || {}).textContent.replace(/\s+/g, ' ').trim(),
    signs: [...a.querySelectorAll('.stsign span')].map(x => x.textContent.trim()),
    sig: !!a.querySelector('.stemp i'),
    note: !!a.querySelector('.stnote'),
    logo: !!a.querySelector('.slhead img'),
    /* The whole sheet as words, so a claim about what is NOT on it can be
       tested against the page rather than against one selector. */
    text: a.textContent.replace(/\s+/g, ' ').trim(),
    head: (a.querySelector('.slco') || {}).textContent.replace(/\s+/g, ' ').trim(),
    addr: [...a.querySelectorAll('.slco span')].map(x => x.textContent.trim()),
    foot: (a.querySelector('.slfoot') || {}).textContent.trim()};
});
ok('the document opens', !!doc);

const M = v => v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

if(doc){
  ok('it says what it is', /^Full and final settlement$/i.test(doc.bar), doc.bar);
  ok('on the entity letterhead', doc.logo);
  /* 'Why the letterheads have no address?' — because DATA.entities was an
     empty array and every lookup fell through to a default with none. */
  ok('and the letterhead carries the registered address, not just the name',
     doc.addr.length > 0 && doc.addr.join(' ').length > 20, doc.addr);
  ok('with no placeholder saying the letterhead is unconfirmed',
     !/still to be confirmed/i.test(doc.text), doc.head.slice(0, 60));
  /* Every field on his sample is on this one — less the bank account, which he
     asked to have taken off: 'MOL ID and Account number are not required',
     then 'Sorry, please keep MOL ID - its linked to the labour number in our
     document list'. So MOL stays and the account goes. */
  for(const k of ['Employee Name', 'Employee ID', 'Designation', 'MOL ID', 'Date of Joining',
                  'Pay Period', 'Paid Days', 'Last Working Date', 'LOP Days',
                  'Final Settlement Date'])
    ok(`the summary carries ${k}`, k in doc.kv, Object.keys(doc.kv));

  ok('the paid days on the paper are the paid days on the screen', doc.kv['Paid Days'] === '15', doc.kv['Paid Days']);
  ok('and the LOP days on the paper are the LOP days on the screen',
     doc.kv['LOP Days'] === String(C.lop), [doc.kv['LOP Days'], C.lop]);
  ok('the last working date reads as a date and not as an ISO string',
     /^\d{2} \w{3} 2026$/.test(doc.kv['Last Working Date'] || ''), doc.kv['Last Working Date']);
  ok('the settlement date is on it too',
     /^\d{2} \w{3} 2026$/.test(doc.kv['Final Settlement Date'] || ''), doc.kv['Final Settlement Date']);
  /* And the account number is not on it at all any more, in any form. Asserted
     rather than assumed: it was masked for a long time, and a masked number is
     the kind of thing that quietly comes back. */
  ok('the bank account is not on the document at all',
     !('Account No' in doc.kv), doc.kv['Account No']);
  ok('nor is any part of one printed elsewhere on it',
     !/Account\s*No|IBAN|\bAE\d{6}/i.test(doc.text || ''), (doc.text||'').slice(0,80));

  const lbl = doc.earn.rows.map(r => r.label);
  ok('the month is on the paper as Basic and Other Allowance',
     lbl[0] === 'Basic' && lbl[1] === 'Other Allowance', lbl);
  ok('and only once — no second line for the same month',
     lbl.filter(l => l === 'Basic').length === 1, lbl);
  ok('the basic on the paper is the basic on the screen',
     doc.earn.rows[0].amt === M(C.mBasic), [doc.earn.rows[0].amt, M(C.mBasic)]);
  ok('gratuity is there, with the service it was worked out over',
     lbl.includes('Gratuity') &&
     /^Days of service: \d+$/.test((doc.earn.rows.find(r => r.label === 'Gratuity') || {}).sub || ''),
     (doc.earn.rows.find(r => r.label === 'Gratuity') || {}).sub);
  if(C.leaveCash) ok('leave encashment says how many days it is',
     /day/.test((doc.earn.rows.find(r => r.label === 'Leave Encashment') || {}).sub || ''),
     (doc.earn.rows.find(r => r.label === 'Leave Encashment') || {}).sub);
  ok('gross earnings on the paper add up',
     doc.earn.total === 'AED ' + M(r2(C.monthPay + C.grat + C.leaveCash + C.ticket)),
     [doc.earn.total, 'AED ' + M(r2(C.monthPay + C.grat + C.leaveCash + C.ticket))]);
  ok('deductions are the advance, or say there are none',
     C.adv ? doc.ded.rows[0].label === 'Advance' : doc.ded.rows[0].label === 'None',
     doc.ded.rows.map(r => r.label));

  const net = Object.fromEntries(doc.net);
  ok('the net block subtracts deductions from gross',
     net['Total Net Payable'] === 'AED ' + M(C.net), [net['Total Net Payable'], 'AED ' + M(C.net)]);
  ok('and shows the deduction as a deduction',
     /^\(-\) AED /.test(net['Total Deductions'] || ''), net['Total Deductions']);
  ok('the amount is written out in words',
     doc.words.includes('UAE Dirham') && doc.words.includes('AED ' + M(C.net)), doc.words.slice(0, 140));
  ok('the paper and the screen say the same number',
     scr.tot && scr.tot.replace(/\s+/g, ' ').includes(M(C.net)), [scr.tot, M(C.net)]);

  ok('three people sign it off',
     JSON.stringify(doc.signs) === JSON.stringify(['Prepared By:', 'Checked By:', 'Authorised By:']), doc.signs);
  ok('there is a line for a note', doc.note);
  ok('the receiver declares they have been paid', /full and final settlement/i.test(doc.decl), doc.decl.slice(0, 90));
  ok('and has somewhere to sign', doc.sig);
  ok('and it says it came out of a system', /system-generated/.test(doc.foot), doc.foot);
}

/* ------------------------------------------------------------ nothing clipped */
const clipped = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.slip.settle .sv, .slip.settle .sk, .slip.settle .slrow span, .slip.settle .slrow b, .slip.settle .stnr b, .slip.settle .stnt b')
    .forEach(el => { if(el.scrollWidth > el.clientWidth + 1)
      out.push(el.textContent.trim().slice(0, 40) + ` (${el.scrollWidth} into ${el.clientWidth})`); });
  return out;
});
ok('nothing on the document is cut off', clipped.length === 0, clipped);

const wide = await page.evaluate(() => {
  const a = document.querySelector('.slip.settle');
  return a ? {w: a.scrollWidth, box: a.clientWidth} : null;
});
ok('and the sheet does not overflow its own width', wide && wide.w <= wide.box + 1, wide);

fs.mkdirSync('/tmp/look', {recursive: true});
await page.screenshot({path: '/tmp/look/settle.png', fullPage: true});

/* Somebody under a year: no gratuity, and the document must still be a
 * document rather than a page with a hole in it. */
await page.evaluate(() => { hideDoc(); });
const NEW = await page.evaluate(() => (DATA.payroll.rows.filter(r => !r.dummy)
  .filter(r => r.doj && +String(r.doj).slice(-4) >= 2026).map(r => r.name)[0]) || null);
if(NEW){
  await page.evaluate(([who]) => { state.exitWho = who; state.exitLwd = '2026-09-30'; render(); }, [NEW]);
  await page.waitForTimeout(200);
  await page.click('#exDoc');
  await page.waitForTimeout(200);
  const g = await page.evaluate(() => {
    const a = document.querySelector('.slip.settle');
    return a ? [...a.querySelectorAll('.slside')][0].textContent : null;
  });
  ok('somebody under a year gets a settlement with no gratuity line on it',
     g && !/Gratuity/.test(g), (g || '').slice(0, 80));
} else {
  console.log('  --   nobody joined this year, so the no-gratuity case is not covered by this seed');
}

await b.close();
server.close();

console.log(`\n${n} checks`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('the settlement prints what is owed, once, and the paper agrees with the screen');
