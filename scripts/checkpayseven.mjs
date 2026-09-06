/* The seven Payment request items from Avin's sheet, each one driven.
 *
 * checklook.mjs proves the page still fits and lines up. It cannot prove that
 * a tick moves at once, that an order number copies the right six lines, or
 * that the WhatsApp link points at a person rather than a share sheet —
 * because all three only happen when somebody clicks something.
 *
 *   node scripts/checkpayseven.mjs
 *
 * The numbers below are his, from the sheet.
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

const who = n => json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${n}') t`)[0];
const AVIN  = who('Avin Mascarenhas');
/* Payment requests are a CorpLex process, so the person who raises them here
   is a CorpLex consultant — a POA employee has no Payment request tab, and
   the router does not hand one over to somebody who asks by name. */
const RAISER = 'Shohruh Karimov';
const AHMED = who(RAISER);

/* Three requests with real-shaped content, one of them carrying a document,
 * one approved and part-reconciled, one turned down with a reason — because
 * every item below needs a row in a particular state to be visible at all. */
const KEEP = sql(`select count(*) from payment_requests`).trim();
sql(`delete from payment_files; delete from payment_requests;`);
const q = v => v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const MADE = [
  ['IFZA', 'Company set up fees', 15500, 'transfer', 'PR2478', 'Islombek Khasanabev', 'Quotation attached.'],
  ['Dubai Economy (DED)', 'Trade licence renewal', 4750, 'card', 'PR2517', 'ALIFID SA', 'Renewal notice attached.'],
  ['MOFA', 'Attestation fees', 1200.5, 'cash', 'PR2350', 'Ajiv East Ltd', 'Urgent.']
];
for(const [payee, purpose, amount, mode, order, client, extra] of MADE)
  sql(`select raise_payment_request(${q(payee)}, ${q(purpose)}, ${amount}, ${q(mode)}, ${q(order)}, ${q(client)}, ${q(extra)})`,
      AHMED.auth_user_id);
const ids = json(`select coalesce(json_agg(t),'[]') from (select id, ref from payment_requests order by ref) t`);
sql(`select attach_payment_file('${ids[0].id}', 'IFZA quotation 4471.pdf', '${ids[0].id}/q.pdf', 'application/pdf', 184320)`, AHMED.auth_user_id);
sql(`select decide_payment_request('${ids[0].id}', true)`, AVIN.auth_user_id);
sql(`select reconcile_payment('${ids[0].id}', p_status => 'initiated', p_account => 'mashreq')`, AVIN.auth_user_id);
sql(`select decide_payment_request('${ids[1].id}', false, 'The client has not settled the invoice this sits against.')`, AVIN.auth_user_id);

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

function dataFor(p){
  const db = {settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
      `) t`, p.auth_user_id)[0]};
  return buildData(db, p.id);
}

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const bad = [];
let n = 0;
const ok = (what, pass, saw) => {
  n++;
  if(pass) return console.log(`  ok   ${what}`);
  bad.push(`${what}${saw === undefined ? '' : ' — saw ' + JSON.stringify(saw)}`);
  console.log(`  FAIL ${what}${saw === undefined ? '' : '  saw ' + JSON.stringify(saw)}`);
};

/* A page as somebody, with the database stubbed at the __db boundary. The
 * reconcile stub is deliberately slow: the whole point of item 7 is what the
 * screen does while the server is still thinking. */
async function pageFor(person, name, tab){
  const page = await b.newPage({viewport: {width: 1500, height: 1100}});
  await page.route('**://fonts.*/**', r => r.abort());
  page.on('pageerror', e => { bad.push(`page error: ${e.message}`); console.log('  FAIL page error: ' + e.message); });
  await page.goto(ORIGIN + '/index.html');
  const DATA = dataFor(person);
  await page.evaluate(([d, nm, roles]) => {
    window.__DATA = d; window.__ME = nm; window.__ROLES = roles;
    window.__reconCalls = [];
    window.__copied = null;
    window.__db = new Proxy({}, {get: (t, k) => async (...a) => {
      if(k === 'reconcilePayment'){
        window.__reconCalls.push(a);
        await new Promise(r => setTimeout(r, 1500));   // a slow server
        return {ok: true};
      }
      return true;
    }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove();
  }, [DATA, name, DATA._roles[name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  // the clipboard is not available over plain http, so it is captured instead
  await page.evaluate(([t]) => {
    Object.defineProperty(navigator, 'clipboard', {configurable: true,
      value: {writeText: async v => { window.__copied = v; }}});
    state.mode = 'staff'; state.tab = t; render();
  }, [tab]);
  await page.waitForTimeout(400);
  return page;
}

console.log('the seven Payment request items:\n');

/* ============================================== 1, 3, 4, 7, 8 on Past payments
   Every one of these reads the decided table, which is a screen of its own
   since Avin asked for the third tab: 'I dont want to view the approved
   payments on the approve payments tab.' */
{
  const page = await pageFor(AVIN, 'Avin Mascarenhas', 'paypast');

  // ---- 1. a document is an icon, not a file name
  const doc = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#view .paytab tbody tr')]
      .map(tr => tr.children[8]).filter(Boolean);
    const withDoc = cells.filter(td => td.querySelector('.docico'));
    return {cells: cells.length, icons: withDoc.length,
      names: cells.some(td => /\.pdf|\.jpg/i.test(td.textContent || '')),
      title: withDoc.length ? withDoc[0].querySelector('.docico').getAttribute('title') : ''};
  });
  ok('1 a document shows as an icon', doc.icons > 0, doc);
  ok('1 and the file name is not printed in the cell', !doc.names, doc);
  ok('1 but the name is still on the icon', /IFZA quotation/.test(doc.title), doc.title);

  // ---- 3. the three controls sit to the right of the count
  const hdr = await page.evaluate(() => {
    const h = [...document.querySelectorAll('#view section.panel > header')]
      .find(x => /Already decided/.test(x.textContent));
    if(!h) return null;
    const box = h.getBoundingClientRect();
    const count = h.querySelector('.hint').getBoundingClientRect();
    const ctl = h.querySelector('.dechead').getBoundingClientRect();
    // against the content edge, not the border edge: the header has padding
    const pad = parseFloat(getComputedStyle(h).paddingRight) || 0;
    return {countLeft: Math.round(count.left - box.left),
      ctlLeft: Math.round(ctl.left - box.left),
      gapRight: Math.round(box.right - pad - ctl.right)};
  });
  ok('3 the controls sit right of the count', hdr && hdr.ctlLeft > hdr.countLeft, hdr);
  ok('3 and hard against the right end', hdr && hdr.gapRight < 8, hdr);

  // ---- 4. WhatsApp goes to a number, not the share sheet
  await page.evaluate(() => { const b = document.getElementById('payWa'); if(b) b.click(); });
  await page.waitForTimeout(250);
  const wa = await page.evaluate(() => {
    const a = document.getElementById('waGo');
    return a ? {href: a.getAttribute('href'), label: a.textContent.trim()} : null;
  });
  ok('4 the WhatsApp link carries a number', wa && /wa\.me\/9715\d{8}\?text=/.test(wa.href), wa && wa.href.slice(0, 40));
  ok('4 and the button says whose chat it is', wa && /Open the chat with/.test(wa.label), wa && wa.label);
  await page.evaluate(() => { const b = document.getElementById('waShut'); if(b) b.click(); });
  await page.waitForTimeout(200);

  /* ---- 8. an order number copies the six lines.
   * Named rather than 'the first one', because the first one on the screen is
   * in the queue above and the example in the sheet is a decided row. */
  const ORD = 'PR2478';
  await page.evaluate(o => [...document.querySelectorAll('[data-ordmsg]')]
    .find(b => b.textContent.trim() === o).click(), ORD);
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => window.__copied);
  const want = ['Order number:  PR2478', 'Amount: 15500', 'Client name: Islombek Khasanabev',
                'Purpose of payment: Company set up fees', 'Mode of payment: Bank transfer',
                'Vendor Name: IFZA'].join('\n');
  ok('8 clicking an order number copies the payment', copied === want, copied);
  const said = await page.evaluate(() =>
    [...document.querySelectorAll('[data-ordmsg]')].map(b => b.textContent.trim()));
  ok('8 and that number says it copied', said.includes('Copied'), said);
  ok('8 and only that one', said.filter(x => x === 'Copied').length === 1, said);
  await page.waitForTimeout(1600);
  const back = await page.evaluate(o =>
    [...document.querySelectorAll('[data-ordmsg]')].map(b => b.textContent.trim()).includes(o), ORD);
  ok('8 and goes back to being the order number', back === true, back);

  // ---- 7. the tick moves at once, not when the server answers
  const tick = await page.evaluate(async () => {
    const cb = document.querySelector('[data-recon]');
    if(!cb) return {none: true};
    const was = cb.checked;
    const t0 = performance.now();
    cb.click();
    await new Promise(r => setTimeout(r, 60));      // far less than the 1500ms stub
    const live = document.querySelector('[data-recon][data-field="' + cb.dataset.field + '"]');
    return {was, after: live ? live.checked : null, ms: Math.round(performance.now() - t0),
      disabled: live ? live.disabled : null, calls: window.__reconCalls.length};
  });
  ok('7 the tick is on within 60ms', tick.after === !tick.was, tick);
  ok('7 and nothing goes grey while it saves', tick.disabled === false, tick);
  ok('7 and the database was asked', tick.calls === 1, tick);
  await page.waitForTimeout(1700);
  const settled = await page.evaluate(() => document.querySelector('[data-recon]').checked);
  ok('7 and it is still on once the server answers', settled === true, settled);

  // ---- 2. the export asks what to export
  await page.evaluate(() => document.getElementById('payCsv').click());
  await page.waitForTimeout(250);
  const exp1 = await page.evaluate(() => ({
    open: !!document.getElementById('expPop'),
    from: !!document.getElementById('expFrom'),
    to: !!document.getElementById('expTo'),
    rows: document.querySelectorAll('[data-exprow]').length,
    ticked: [...document.querySelectorAll('[data-exprow]')].filter(x => x.checked).length,
    button: (document.getElementById('expGo') || {}).textContent
  }));
  ok('2 Export CSV opens a panel', exp1.open, exp1);
  ok('2 with a from and a to date', exp1.from && exp1.to, exp1);
  ok('2 and every decided row ticked to start', exp1.rows === 2 && exp1.ticked === 2, exp1);
  ok('2 and the button says how many', /Download 2 rows/.test(exp1.button || ''), exp1.button);

  await page.evaluate(() => document.querySelector('[data-exprow]').click());
  await page.waitForTimeout(200);
  const exp2 = await page.evaluate(() => ({
    ticked: [...document.querySelectorAll('[data-exprow]')].filter(x => x.checked).length,
    button: (document.getElementById('expGo') || {}).textContent}));
  ok('2 unticking a row takes it out', exp2.ticked === 1 && /Download 1 row\b/.test(exp2.button), exp2);

  await page.evaluate(() => {
    const f = document.getElementById('expFrom');
    f.value = '2099-01-01'; f.dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(250);
  const exp3 = await page.evaluate(() => ({
    rows: document.querySelectorAll('[data-exprow]').length,
    disabled: (document.getElementById('expGo') || {}).disabled,
    said: document.getElementById('expPop').textContent.includes('Nothing falls in that range')}));
  ok('2 a date range with nothing in it says so', exp3.rows === 0 && exp3.said, exp3);
  ok('2 and there is nothing to download', exp3.disabled === true, exp3);
  // a picture of the panel, for the same reason checklook keeps its screenshots
  await page.evaluate(() => {
    const f = document.getElementById('expFrom');
    f.value = ''; f.dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(250);
  fs.mkdirSync('/tmp/look', {recursive: true});
  await page.screenshot({path: '/tmp/look/export-panel.png'});
  await page.close();
}

/* ================================================= 5 on Request for payment */
{
  const page = await pageFor(AHMED, RAISER, 'payment');
  const st = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('#view thead th')].map(x => x.textContent.trim());
    const i = heads.indexOf('Status');
    const cells = [...document.querySelectorAll('#view tbody tr')].map(tr => tr.children[i]).filter(Boolean);
    return cells.map(td => ({
      text: (td.textContent || '').trim(),
      pill: (td.querySelector('.pill') || {}).textContent,
      always: td.hasAttribute('data-always'),
      full: td.getAttribute('data-full') || ''}));
  });
  const rej = st.find(x => x.pill === 'Rejected');
  ok('5 the status cell holds the pill and nothing else',
     st.every(x => x.text === x.pill), st.map(x => x.text));
  ok('5 and the reason is on the hover', rej && /Turned down: The client has not settled/.test(rej.full), rej && rej.full);
  ok('5 which shows even when nothing is cut', st.every(x => x.always), st.map(x => x.always));

  // and the hover card actually appears on one
  await page.evaluate(() => {
    const td = document.querySelector('#view tbody td[data-always]');
    td.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
  });
  await page.waitForTimeout(250);
  const card = await page.evaluate(() => {
    const c = document.querySelector('.cellpop');
    return c && !c.classList.contains('hidden') ? c.textContent.trim() : '';
  });
  ok('5 and hovering it shows the instruction', /With accounts|Turned down|Payment initiated/.test(card), card.slice(0, 60));
  await page.close();
}

await b.close();
server.close();
sql(`delete from payment_files; delete from payment_requests;`);

console.log(`\n${n} checks (the table held ${KEEP === '0' ? 'nothing' : KEEP + ' request(s)'} before this ran; put back empty)`);
if(bad.length){
  console.log(`\n${bad.length} failed:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('the seven items on the payment request page all do what the sheet asked');
