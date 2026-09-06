/* The payment screen, driven the way the office will drive it.
 *
 * 09_payment_test.sql proves the database refuses what it should. This proves
 * the screen in front of it does what it looks like it does — which is the
 * question that matters here, because for months it looked like it did and
 * did not.
 *
 * It runs two browsers against the same database at once: a consultant raising
 * a request, and accounts deciding on it. Nothing is stubbed except the file
 * upload, because storage is not running here; every RPC is the real one
 * against real rows, and every assertion is read back off the other person's
 * screen.
 *
 *   node scripts/checkpayments.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'seedtest'];
const sql = (s, asUser) => execFileSync(PSQL, [...base, '-tAc',
  (asUser ? `set role authenticated; select set_config('request.jwt.claim.sub','${asUser}',false); ` : '') + s],
  {encoding: 'utf8', maxBuffer: 64e6});
const json = (s, asUser) => {
  const o = sql(s, asUser); const i = o.lastIndexOf('\n[');
  return JSON.parse(i < 0 ? o.trim() : o.slice(i + 1).trim());
};

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

const settings = json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`);
const who = n => json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${n}') t`)[0];

const AVIN  = who('Avin Mascarenhas');
/* The person raising it has to be somebody who actually has the page. Payment
   requests are a CorpLex process — a POA employee has no Payment request tab,
   and the router no longer hands one over to somebody who asks for it by
   name — so the requester here is a CorpLex consultant. */
const RAISER = 'Shohruh Karimov';
const AHMED = who(RAISER);
const RANA  = who('Rana Amine');

function dataFor(p){
  const db = {settings, ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, p.auth_user_id)[0]};
  return buildData(db, p.id);
}

// a clean slate; the test puts it back at the end
sql(`delete from payment_files; delete from payment_requests;`);

/* --------------------------------------------------------- serve the built site */
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json',
               '.webmanifest':'application/manifest+json', '.png':'image/png'};
const server = http.createServer((req, res) => {
  const f = path.join('web', decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('no'); }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  res.end(fs.readFileSync(f));
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});

/* A page signed in as somebody, with __db wired to the real database over psql.
 * Storage is the one thing not running here, so an upload records the row and
 * skips the object — which is what attach_payment_file does anyway. */
async function sessionFor(person, name){
  const page = await b.newPage({viewport: {width: 1500, height: 1100}});
  await page.route('**://fonts.*/**', r => r.abort());
  page.on('pageerror', e => { console.error(`page error (${name}): ` + e.message); process.exitCode = 1; });
  await page.goto(ORIGIN + '/index.html');
  await page.exposeFunction('__rpc', (fn, args) => {
    const a = Object.entries(args).map(([k, v]) =>
      v === null || v === undefined ? `${k} => null`
      : typeof v === 'number' ? `${k} => ${v}`
      : typeof v === 'boolean' ? `${k} => ${v}`
      : `${k} => '${String(v).replace(/'/g, "''")}'`).join(', ');
    try{
      /* psql echoes the SET and the set_config result before the answer, so
       * the last non-empty line is the function's return value. */
      const out = sql(`select ${fn}(${a})`, person.auth_user_id)
        .split('\n').map(x => x.trim()).filter(Boolean);
      return {ok: out.length ? out[out.length - 1] : ''};
    }
    catch(e){ return {err: String(e.stderr || e.message).split('\n').find(l => l.includes('ERROR')) || 'refused'}; }
  });
  await page.exposeFunction('__refresh', () => dataFor(person));
  await page.evaluate(([d, n, r]) => {
    window.__DATA = d; window.__ME = n; window.__ROLES = r;
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove();
    const reload = async () => {
      const fresh = await window.__refresh();
      Object.keys(fresh).forEach(k => { window.__DATA[k] = fresh[k]; });
      if(typeof window.render === 'function') window.render();
    };
    const call = async (fn, args) => {
      const out = await window.__rpc(fn, args);
      await reload();
      if(out.err){ window.__lastErr = out.err; return null; }
      return out.ok === '' ? true : (out.ok[0] === '{' ? JSON.parse(out.ok) : out.ok);
    };
    window.__db = {
      raisePayment: async (f, files) => {
        const out = await call('raise_payment_request', {
          p_payee: f.payee, p_purpose: f.purpose, p_amount: Number(f.amount), p_mode: f.mode,
          p_order: f.order || null, p_client: f.client || null, p_extra: f.extra || null,
          p_currency: f.ccy || 'AED'});
        if(!out) return null;
        const bad = [];
        for(const file of (files || []).slice(0, 5)){
          const r = await window.__rpc('attach_payment_file', {
            p_id: out.id, p_name: file.name, p_path: out.id + '/' + file.name,
            p_mime: file.type || null, p_bytes: file.size});
          if(r.err) bad.push(file.name);
        }
        await reload();
        return {...out, notAttached: bad};
      },
      attachPayment:   async (id, file) => {
        const r = await window.__rpc('attach_payment_file', {
          p_id: id, p_name: file.name, p_path: id + '/' + file.name,
          p_mime: file.type || null, p_bytes: file.size});
        await reload();
        if(r.err){ window.__lastErr = r.err; return false; }
        return true;
      },
      editPayment: async (id, f) => {
        const r = await window.__rpc('edit_payment_request', {
          p_id: id,
          p_payee:   f.payee   === undefined ? null : f.payee,
          p_purpose: f.purpose === undefined ? null : f.purpose,
          p_amount:  f.amount  === undefined ? null : Number(f.amount),
          p_mode:    f.mode    === undefined ? null : f.mode,
          p_order:   f.order   === undefined ? null : f.order,
          p_client:  f.client  === undefined ? null : f.client,
          p_extra:   f.extra   === undefined ? null : f.extra,
          p_currency:f.ccy     === undefined ? null : f.ccy});
        await reload();
        return r.err ? {error: r.err} : {ok: true};
      },
      reconcilePayment: (id, p) => call('reconcile_payment', {
        p_id: id,
        p_status:  p.payStatus === undefined ? null : p.payStatus,
        p_account: p.account   === undefined ? null : p.account,
        p_books:   p.books     === undefined ? null : p.books,
        p_bigin:   p.bigin     === undefined ? null : p.bigin,
        p_receipt: p.receipt   === undefined ? null : p.receipt}),
      withdrawPayment: id => call('withdraw_payment_request', {p_id: id}),
      detachPayment:   id => call('detach_payment_file', {p_file: id}),
      decidePayment:   (id, ok, why) => call('decide_payment_request',
        {p_id: id, p_approve: !!ok, p_why: why || null}),
      settlePayment:   (id, st, ac, rm) => call('settle_payment_request',
        {p_id: id, p_status: st, p_account: ac, p_remark: rm || null}),
      seenPayments:    async () => { window.__seenCalls = (window.__seenCalls||0)+1;
                                     return call('mark_payments_seen', {}); }
    };
  }, [dataFor(person), person.name || name, dataFor(person)._roles[name]]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  await page.evaluate(() => { state.mode = 'staff'; state.tab = 'payment'; render(); });
  page.approving = async () => { await page.evaluate(() => { state.tab='payapprove'; render(); });
                                 await page.waitForTimeout(150); };
  /* Avin: 'I dont want to view the approved payments on the approve payments
     tab. Just move the already decided table to past payments tab.' So the
     decided table is a screen of its own now, and everything that reads it
     has to go there. */
  page.past = async () => { await page.evaluate(() => { state.tab='paypast'; render(); });
                            await page.waitForTimeout(150); };
  page.refresh = async () => {
    await page.evaluate(async () => {
      const fresh = await window.__refresh();
      Object.keys(fresh).forEach(k => { window.__DATA[k] = fresh[k]; });
      render();
    });
    await page.waitForTimeout(120);
  };
  page.text = () => page.evaluate(() => document.getElementById('view').innerText.replace(/\s+/g, ' '));
  return page;
}

const fails = [];
const must = (what, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}`); if(!cond) fails.push(what); };

const ahmed = await sessionFor(AHMED, RAISER);
const avin  = await sessionFor(AVIN,  'Avin Mascarenhas');
const rana  = await sessionFor(RANA,  'Rana Amine');

// ---- 1. nothing invented
await avin.approving();
/* What the screen says, including what it only says on hover. Avin asked for
 * the status column to be the pill alone — 'Approved, Rejected, Withdrawn
 * pills only must be seen. Hover over that to see the instruction.' — so a
 * reason is no longer printed in the cell. It still has to be reachable, and
 * that is what these read. */
const withHovers = async p =>
  (await p.text()) + ' ' + (await p.evaluate(() =>
    [...document.querySelectorAll('#view [data-full]')].map(x => x.dataset.full).join(' ')));

let t = await avin.text();
must('the screen opens with no invented requests',
     !/Dubai Economy|Al Waha|Emirates Typing|PR-2026-0141/.test(t));
must('and says the queue is empty rather than drawing one', /Nothing is waiting on you/.test(t));
must('the bell counts nothing',
     await avin.evaluate(() => alertsFor(state.user).filter(n => n.key === 'pay-req').length) === 0);

// ---- 2. the consultant raises one
await ahmed.evaluate(() => {
  document.getElementById('pqOrder').value   = 'PR2517';
  document.getElementById('pqAmount').value  = '4750';
  document.getElementById('pqClient').value  = 'ALIFID SA';
  document.getElementById('pqPurpose').value = 'Trade licence renewal';
  document.getElementById('pqPayee').value   = 'Dubai Economy (DED)';
  document.getElementById('pqNote').value    = 'Renewal notice attached.';
  document.getElementById('pqMode').value    = 'card';
});
await ahmed.click('#pqSubmit');
await ahmed.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
t = await ahmed.text();
const ref = await ahmed.evaluate(() => state.pqDone.ref);
must(`it is numbered behind the scenes (${ref})`, /^PR-\d{4}-0001$/.test(ref));
must('but the screen shows the order number, not that reference',
     /PR2517/.test(t) && !/PR-\d{4}-\d{4}/.test(t));
must('and says so in one line, without a panel to close',
     /raised/.test(t) && /with accounts/.test(t) && !/avin@corplex\.ae/.test(t));
must('and the new row is in the list beside it',
     await ahmed.evaluate(() => document.querySelectorAll('.payform ~ * tbody tr, .payone tbody tr').length > 0));
must('and it is in the database',
     Number(sql(`select count(*) from payment_requests where ref='${ref}'`).trim()) === 1);
await ahmed.screenshot({path: '/home/claude/one/pay_raised.png', fullPage: true});

// ---- 3. a request with nothing in it is refused before it is sent
await ahmed.evaluate(() => { state.pqDone = null; render(); });
await ahmed.waitForTimeout(150);
// everything but the vendor, which the form re-renders empty
await ahmed.evaluate(() => {
  document.getElementById('pqAmount').value  = '900';
  document.getElementById('pqPurpose').value = 'Something';
  document.getElementById('pqPayee').value   = '';
});
await ahmed.click('#pqSubmit');
await ahmed.waitForTimeout(300);
must('a request with no vendor never leaves the screen',
     /Say who is being paid/.test(await ahmed.text()) &&
     Number(sql(`select count(*) from payment_requests`).trim()) === 1);

// ---- 4. Rana cannot see it
await rana.refresh();
must('a colleague sees none of it', !(await rana.text()).includes('ALIFID SA'));

// ---- 5. Avin sees it, and the bell counts it
await avin.approving();
await avin.refresh();
await avin.approving();
t = await avin.text();
must('accounts sees the request on the approvals screen',
     t.includes('PR2517') && t.includes('Dubai Economy (DED)'));
must('and it names the person who raised it', t.includes(RAISER.split(' ')[0]));
must('the bell now counts one',
     await avin.evaluate(() => alertsFor(state.user).filter(n => n.key === 'pay-req').length) === 1);

// ---- 6. turning one down needs a reason
await avin.approving();
await avin.click(`[data-reject]`);
await avin.waitForTimeout(350);
await avin.click('#rjGo');
await avin.waitForTimeout(400);
must('turning one down with no reason is refused, and it stays pending',
     sql(`select status from payment_requests where ref='${ref}'`).trim() === 'pending');
await avin.evaluate(() => { state.reject = null; state.rjErr = ''; render(); });

// ---- 7. approving it, with a payment status and an account
await avin.approving();
await avin.click(`[data-approve="${ref}"]`);
await avin.waitForTimeout(200);
await avin.click(`[data-ps="Paid"]`);
await avin.waitForTimeout(150);
await avin.click(`[data-ac="petty"]`);
await avin.waitForTimeout(150);
t = await avin.text();
must('the remark writes itself and names who raised it',
     t.includes(`Nissa, please handover cash to "${RAISER}"`));
must('and the WhatsApp message is built from the request',
     t.includes('*Order number:* PR2517') && t.includes('*Payment status:* Paid'));
await avin.evaluate(() => { state.approve={ref:null,payStatus:'',account:'',remarks:''}; render(); });
await avin.waitForTimeout(200);
await avin.screenshot({path: '/home/claude/one/pay_queue.png', fullPage: true});
await avin.click(`[data-approve="${ref}"]`);
await avin.waitForTimeout(200);
await avin.click(`[data-ps="Paid"]`); await avin.waitForTimeout(120);
await avin.click(`[data-ac="petty"]`); await avin.waitForTimeout(150);
await avin.screenshot({path: '/home/claude/one/pay_approve.png', fullPage: true});

await avin.click('#apDone');
await avin.waitForFunction(() => typeof state !== 'undefined' && !state.approve.ref, null, {timeout: 20000});
await avin.waitForTimeout(300);
const row = json(`select coalesce(json_agg(t),'[]') from (select status,pay_status,account,remark,decided_by from payment_requests where ref='${ref}') t`)[0];
must('the database says approved', row.status === 'approved');
must('and paid, from petty cash', row.pay_status === 'paid' && row.account === 'petty');
must('with the standing remark stored on the row',
     row.remark === `Nissa, please handover cash to "${RAISER}"`);
must('and stamped with who approved it', row.decided_by === AVIN.id);

// ---- 8. and the person who raised it sees what happened, without asking anybody
await ahmed.refresh();
t = await ahmed.text();
must('the person who raised it sees it approved', /Approved/.test(t));
must('and reads the remark that tells him what to do next',
     (await withHovers(ahmed)).includes('Nissa, please handover cash'));
must('and can no longer withdraw it', !(await ahmed.$(`[data-pqpull]`)));

/* ---- 8b. a document that turns up after the payment ------------------------
 *
 * The receipt from the typing centre, the stamped form back from DED, the
 * courier slip: all of them arrive after the payment does, and the first
 * version of this froze the documents at the moment of approval. Adding is
 * allowed on an approved request; removing is not, because those documents
 * are what the approval was given against. */
await ahmed.evaluate(() => { state.tab = 'payment'; render(); });
await ahmed.waitForTimeout(200);
must('an approved request still offers to take another document',
     !!(await ahmed.$('[data-pqadd]')));
const before = Number(sql(`select count(*) from payment_files`).trim());
await ahmed.evaluate(() => {
  // the picker is opened by a click the test cannot make, so the file is put
  // straight on the input and the handler is let run as it would
  const b = document.querySelector('[data-pqadd]');
  state.pqAddTo = b.dataset.pqadd;
});
await ahmed.setInputFiles('#pqRowFile', {name: 'receipt.pdf', mimeType: 'application/pdf',
                                         buffer: Buffer.from('%PDF-1.4 receipt')});
await ahmed.waitForTimeout(900);
must('and takes it', Number(sql(`select count(*) from payment_files`).trim()) === before + 1);
must('and it shows on the request', /receipt\.pdf/.test(await ahmed.text()));
must('but there is no way to remove it once approved',
     !(await ahmed.$('[data-pqdoc]')));

// ---- 9. a second request, turned down properly
await ahmed.evaluate(() => {
  state.pqDone = null; render();
});
await ahmed.waitForTimeout(150);
await ahmed.evaluate(() => {
  document.getElementById('pqAmount').value  = '3200';
  document.getElementById('pqClient').value  = 'SC Project Management LLC';
  document.getElementById('pqPurpose').value = 'Legal translation';
  document.getElementById('pqPayee').value   = 'Al Waha Translation';
  document.getElementById('pqMode').value    = 'cash';
});
await ahmed.click('#pqSubmit');
await ahmed.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
const ref2 = await ahmed.evaluate(() => state.pqDone.ref);
must(`the second one takes the next number (${ref2})`, /0002$/.test(ref2));

await avin.refresh();
await avin.approving();
const id2 = sql(`select id from payment_requests where ref='${ref2}'`).trim();
await avin.click(`[data-reject="${id2}"]`);
await avin.waitForTimeout(350);
await avin.fill('#rjWhy', 'The client has not settled the invoice this sits against.');
await avin.click('#rjGo');
await avin.waitForTimeout(500);
must('a reason turns it down', sql(`select status from payment_requests where ref='${ref2}'`).trim() === 'rejected');

await ahmed.refresh();
t = await ahmed.text();
must('and the person who raised it reads why, on his own screen',
     /Rejected/.test(t) && /has not settled the invoice/.test(await withHovers(ahmed)));
must('and the portal\'s own reference is nowhere on the screen', !/PR-\d{4}-\d{4}/.test(t));
must('the order number is what identifies it instead', /PR2517/.test(t));
await ahmed.screenshot({path: '/home/claude/one/pay_mine.png', fullPage: true});

// ---- 10. withdrawing one of his own
await ahmed.evaluate(() => { state.pqDone = null; render(); });
await ahmed.waitForTimeout(150);
await ahmed.evaluate(() => {
  document.getElementById('pqAmount').value  = '640';
  document.getElementById('pqPurpose').value = 'Courier and attestation';
  document.getElementById('pqPayee').value   = 'Aramex';
  document.getElementById('pqClient').value  = 'JAA United DMCC';
  document.getElementById('pqMode').value    = 'cash';
});
await ahmed.click('#pqSubmit');
await ahmed.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
await ahmed.evaluate(() => { state.pqDone = null; render(); });
await ahmed.waitForTimeout(200);
await ahmed.click('[data-pqpull]');
await ahmed.waitForTimeout(600);
must('he can take back one that has not been decided',
     Number(sql(`select count(*) from payment_requests where status='withdrawn'`).trim()) === 1);
await avin.refresh();
await avin.approving();
must('and it leaves the approval queue',
     !(await avin.$(`[data-approve]`)));
await avin.past();
/* Withdrawn is not decided: it belongs on neither screen, which is what the
   decided table has always meant by leaving it out. */
must('and does not turn up under Past payments either \u2014 it was withdrawn, not decided',
     !(await avin.text()).includes(ref2));
await avin.approving();

// ---- 11. approving one of his own, which is allowed and said out loud
await avin.evaluate(() => { state.tab='payment'; render(); });
await avin.waitForTimeout(150);
await avin.evaluate(() => {
  document.getElementById('pqAmount').value  = '8500';
  document.getElementById('pqPurpose').value = 'Visa quota fees';
  document.getElementById('pqPayee').value   = 'GDRFA portal';
  document.getElementById('pqMode').value    = 'link';
});
await avin.click('#pqSubmit');
await avin.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
const own = await avin.evaluate(() => state.pqDone.ref);
await avin.evaluate(() => { state.pqDone = null; render(); });
await avin.approving();
await avin.click(`[data-approve="${own}"]`);
await avin.waitForTimeout(200);
await avin.click(`[data-ps="Initiated"]`);
await avin.waitForTimeout(120);
await avin.click(`[data-ac="mashreq"]`);
await avin.waitForTimeout(120);
await avin.click('#apDone');
await avin.waitForTimeout(700);
must('accounts may approve his own — Avin asked for that',
     sql(`select status from payment_requests where ref='${own}'`).trim() === 'approved');
/* The screen used to say 'approved by the person who raised it' on the row.
 * Avin had it removed — four wrapped lines on every row for a sentence he did
 * not want. The database still records it, and that is what is checked here:
 * the control is intact, it is simply not on the screen any more. */
must('and the database records that he decided his own',
     sql(`select decided_by = raised_by from payment_requests where ref='${own}'`).trim() === 't');
must('while the screen stays one line per row',
     !/approved by the person who raised it/.test(await avin.text()));

/* ---- 12. the bell, on both sides -------------------------------------------
 *
 * The half the Google Form never had: the person who raised it being told.
 * What is really being tested here is that it stops — a notification computed
 * from state and never cleared is one people learn to scroll past. */
sql(`delete from payment_files; delete from payment_requests;`);
await ahmed.evaluate(() => { state.pqDone = null; state.pqSeen = false; render(); });
await ahmed.waitForTimeout(150);
await ahmed.evaluate(() => {
  document.getElementById('pqAmount').value  = '1200';
  document.getElementById('pqPurpose').value = 'Attestation fees';
  document.getElementById('pqPayee').value   = 'MOFA';
  document.getElementById('pqMode').value    = 'cash';
});
await ahmed.click('#pqSubmit');
await ahmed.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
const bell = p => p.evaluate(() => alertsFor(state.user).map(n => n.key + '|' + n.t));

await ahmed.evaluate(() => { state.tab = 'home'; state.pqSeen = false; render(); });
let mine = await bell(ahmed);
must('a request of mine still with accounts shows on my bell',
     mine.some(x => x.startsWith('pay-wait-') && /is with accounts/.test(x)));

await avin.refresh();
must('and on the approver\'s bell as a job to do, pointing at the approvals screen',
     (await bell(avin)).some(x => x.startsWith('pay-req|')) &&
     await avin.evaluate(() => (alertsFor(state.user).find(n=>n.key==='pay-req')||{}).tab) === 'payapprove');

await avin.approving();
const pid = sql(`select id from payment_requests where status='pending'`).trim();
sql(`select decide_payment_request('${pid}', true); select settle_payment_request('${pid}','paid','qashio')`, AVIN.auth_user_id);

await ahmed.refresh();
mine = await bell(ahmed);
must('once it is approved my bell says so, with the remark',
     mine.some(x => x.startsWith('pay-ok-')));
must('and the waiting nudge is gone',
     !mine.some(x => x.startsWith('pay-wait-')));
await avin.refresh();
must('while the approver has nothing left waiting',
     !(await bell(avin)).some(x => x.startsWith('pay-req|')));

// opening the screen is what marks it read
/* Counted from here, because marking-as-read has legitimately happened
 * several times already in this test. What is being watched for is the loop:
 * the call reloads, the reload renders, and the render could call again. */
await ahmed.evaluate(() => {
  window.__seenCalls = 0; window.__renders = 0;
  const R = window.render;
  window.render = function(){ window.__renders++; return R.apply(this, arguments); };
  state.tab = 'payment'; render();
});
await ahmed.waitForTimeout(800);
must('opening the screen marks it read, once',
     Number(sql(`select count(*) from payment_requests where seen_at is not null`).trim()) === 1);
const spin = await ahmed.evaluate(() => ({calls: window.__seenCalls, renders: window.__renders}));
must(`and it did not call itself in a loop (${spin.calls} call, ${spin.renders} renders)`,
     spin.calls === 1 && spin.renders <= 3);

await ahmed.evaluate(() => { state.tab = 'home'; render(); });
await ahmed.waitForTimeout(200);
must('and then it stops nudging',
     !(await bell(ahmed)).some(x => x.startsWith('pay-ok-')));

// a second decision still gets through
await ahmed.evaluate(() => { state.tab='payment'; state.pqDone=null; state.pqSeen=false; render(); });
await ahmed.waitForTimeout(200);
await ahmed.evaluate(() => {
  document.getElementById('pqAmount').value  = '300';
  document.getElementById('pqPurpose').value = 'Courier';
  document.getElementById('pqPayee').value   = 'Aramex';
  document.getElementById('pqMode').value    = 'cash';
});
await ahmed.click('#pqSubmit');
await ahmed.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
const pid2 = sql(`select id from payment_requests where status='pending'`).trim();
sql(`select decide_payment_request('${pid2}', false, 'The client still owes on this one.')`, AVIN.auth_user_id);
await ahmed.evaluate(() => { state.tab='home'; render(); });
await ahmed.refresh();
mine = await bell(ahmed);
must('a later decision nudges again, and says why it was turned down',
     mine.some(x => x.startsWith('pay-no-') && /turned down/.test(x)));
must('and the one already read stays quiet',
     mine.filter(x => x.startsWith('pay-ok-') || x.startsWith('pay-no-')).length === 1);

await ahmed.screenshot({path: '/home/claude/one/pay_bell.png', fullPage: true});

/* ---- 12b. the form survives everything that redraws it ---------------------
 *
 * This is the one that mattered and the one nothing checked. Avin filled the
 * form in, attached a PDF, and every field went blank — because attaching a
 * document redraws the screen and the form was built from nothing each time.
 * He pressed Submit, was told to say what the payment was for, and reasonably
 * concluded that no request was going through.
 *
 * A form is not allowed to lose what somebody typed. Not on a redraw it caused
 * itself, and not on one caused by somebody else's action reloading the data. */
await ahmed.evaluate(() => {
  state.pqDone = null; state.pqErr = ''; state.pqForm = null; state.pqFiles = [];
  state.tab = 'payment'; render();
});
await ahmed.waitForTimeout(200);

const typeIn = () => ahmed.evaluate(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    el.value = v;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
  };
  set('pqOrder','PR7788'); set('pqAmount','2450.75'); set('pqClient','ALIFID SA');
  set('pqPurpose','Trade licence renewal'); set('pqPayee','Dubai Economy (DED)');
  set('pqNote','Renewal notice attached.'); set('pqMode','transfer');
});
const readOut = () => ahmed.evaluate(() => ({
  order:  document.getElementById('pqOrder').value,
  amount: document.getElementById('pqAmount').value,
  client: document.getElementById('pqClient').value,
  purpose:document.getElementById('pqPurpose').value,
  payee:  document.getElementById('pqPayee').value,
  note:   document.getElementById('pqNote').value,
  mode:   document.getElementById('pqMode').value
}));
const FILLED = {order:'PR7788', amount:'2450.75', client:'ALIFID SA',
                purpose:'Trade licence renewal', payee:'Dubai Economy (DED)',
                note:'Renewal notice attached.', mode:'transfer'};
const same = a => Object.keys(FILLED).every(k => a[k] === FILLED[k]);

await typeIn();
await ahmed.waitForTimeout(100);

// attaching a document — the exact thing that emptied it
await ahmed.setInputFiles('#pqFile', {name: 'QT-1754.pdf', mimeType: 'application/pdf',
                                      buffer: Buffer.from('%PDF-1.4 test')});
await ahmed.waitForTimeout(400);
must('attaching a document keeps everything that was typed', same(await readOut()));
must('and shows the document', /QT-1754\.pdf/.test(await ahmed.text()));

// removing it again
await ahmed.click('[data-pqdrop]');
await ahmed.waitForTimeout(300);
must('removing it keeps everything too', same(await readOut()));

// and a redraw caused by somebody else entirely
await ahmed.refresh();
await ahmed.waitForTimeout(200);
must('and so does a reload caused by somebody else', same(await readOut()));

/* ---- 12c. the reconciliation list ------------------------------------------
 *
 * The thing this whole screen exists for, in Avin's words: 'payments are
 * approved, but not paid yet. Only a very few are paid by me.' So an approved
 * request sits unpaid for days, and the three columns beside it — paid or not,
 * out of which account, and his own books/Bigin/receipt ticks — are filled in
 * as they happen rather than guessed at the moment of the decision. */
await avin.past();
await avin.waitForTimeout(200);
t = await avin.text();
must('an approved request shows as unpaid until somebody says otherwise',
     /Unpaid/.test(t));
must('and offers the account it was paid out of', !!(await avin.$('[data-acct]')));
const tickCount = await avin.evaluate(() => document.querySelectorAll('[data-recon]').length);
must(`and the three ticks (${tickCount} found)`,
     tickCount === 3 &&
     await avin.evaluate(() => [...document.querySelectorAll('[data-recon]')]
       .map(x => x.dataset.field).join(',')) === 'books,bigin,receipt');

const donePR = json(`select coalesce(json_agg(t),'[]') from (select id,ref from payment_requests where status='approved' order by ref limit 1) t`)[0];
await avin.selectOption(`[data-paystat="${donePR.id}"]`, 'Paid');
await avin.waitForTimeout(900);
must('clicking Paid records it',
     sql(`select pay_status from payment_requests where id='${donePR.id}'`).trim() === 'paid');

await avin.selectOption(`[data-acct="${donePR.id}"]`, 'qashio3639');
await avin.waitForTimeout(900);
must('choosing the account records it, and names the card in the remark',
     sql(`select account from payment_requests where id='${donePR.id}'`).trim() === 'qashio3639' &&
     sql(`select remark from payment_requests where id='${donePR.id}'`).trim()
       === 'Use my Qashio Card 3639. I will authorize it');

await avin.click(`[data-recon="${donePR.id}"][data-field="bigin"]`);
await avin.waitForTimeout(900);
const ticked = sql(`select books||'/'||bigin||'/'||receipt from payment_requests where id='${donePR.id}'`).trim();
must(`ticking Bigin records only Bigin (${ticked})`, ticked === 'false/true/false');
await avin.evaluate(() => {
  const w = document.querySelector('.paytab.recon'); if(w) w.scrollLeft = w.scrollWidth;
});
await avin.waitForTimeout(200);
await avin.screenshot({path: '/home/claude/one/pay_recon.png', fullPage: true});

// ---- 12d. documents open over the page
const withDoc = json(`select coalesce(json_agg(t),'[]') from (select r.id from payment_requests r join payment_files f on f.request_id=r.id limit 1) t`)[0];
if(withDoc){
  await ahmed.evaluate(() => { state.tab='payment'; state.doc=null; render(); });
  await ahmed.waitForTimeout(200);
  const doc = await ahmed.$('[data-popdoc]');
  must('a document is a button, not a link to somewhere else', !!doc);
  if(doc){
    await doc.click();
    await ahmed.waitForTimeout(250);
    must('and it opens over the page, with a download beside it',
         !!(await ahmed.$('#docPop')) && !!(await ahmed.$('#docPop a[download]')));
    await ahmed.click('#docShut');
    await ahmed.waitForTimeout(200);
    must('and closes again', !(await ahmed.$('#docPop')));
  }
}

// ---- 12e. two tabs, one page
must('approving is a tab on the payment page, not its own rail entry',
     await avin.evaluate(() => !STAFFTABS().some(t => t.id === 'payapprove')));
await avin.evaluate(() => { state.tab='payment'; render(); });
await avin.waitForTimeout(200);
must('and the bar is there to switch with', !!(await avin.$('[data-paytab="payapprove"]')));
await avin.click('[data-paytab="payapprove"]');
await avin.waitForTimeout(250);
must('and switching works', await avin.evaluate(() => state.tab) === 'payapprove');
must('a consultant sees no bar at all, having nothing to switch to',
     !(await ahmed.$('[data-paytab]')));

/* ---- 12f. the widest table fits, and the rail can be put away --------------
 *
 * Sixteen columns scrolled sideways on a laptop AND on a 1920 monitor, because
 * a browser window is never the whole screen. A table sized by its content has
 * a minimum width it will not go below; one laid out by percentages does not.
 * This is the check that it stays fitting, at the two widths that matter. */
for(const width of [1440, 1920]){
  await avin.setViewportSize({width, height: 1000});
  await avin.evaluate(() => { state.tab='paypast'; render(); });
  await avin.waitForTimeout(300);
  const m = await avin.evaluate(() => {
    const w = document.querySelector('.paytab.recon');
    w.scrollLeft = 9999; const can = w.scrollLeft; w.scrollLeft = 0;
    return {can, cols: w.querySelectorAll('thead th').length};
  });
  /* A pixel or two is sub-pixel rounding on sixteen percentage columns, not
   * something anybody scrolls. What this is guarding against is a column that
   * genuinely does not fit, which shows up as tens or hundreds. */
  must(`all ${m.cols} columns fit at ${width} with no sideways scroll (${m.can}px)`,
       m.can <= 2 && m.cols === 16);
}

await avin.evaluate(() => { try{ localStorage.setItem('corplexRail','tucked'); }catch(e){} render(); });
await avin.waitForTimeout(250);
must('the rail can be put away, and stays away',
     await avin.evaluate(() => document.getElementById('app').classList.contains('tucked')));
must('and what is left is icons, one per tab',
     await avin.evaluate(() => {
       const b = [...document.querySelectorAll('.rail button.nav')];
       return b.length > 6 && b.every(x => x.querySelector('svg') && x.title);
     }));
await avin.screenshot({path: '/home/claude/one/pay_tucked.png', fullPage: false});
await avin.evaluate(() => { try{ localStorage.removeItem('corplexRail'); }catch(e){}
  document.getElementById('app').classList.remove('tucked'); render(); });
await avin.setViewportSize({width: 1500, height: 1100});
await avin.waitForTimeout(200);

/* ---- 12g. searching, exporting, chasing, correcting ------------------------ */
await avin.past();
await avin.waitForTimeout(250);
t = await avin.text();
must('the decided list stops saying Approved on every row', !/Approved/.test(t));
must('and the status column is just Status', /STATUS/i.test(t) && !/PAYMENT STATUS/i.test(t));
must('and nobody is told what the sales workbook thinks the client owes',
     !/owing/.test(t) && !/client paid/.test(t) && !/sales book/.test(t));

// search
await avin.fill('#paySearch', 'PR2517');
await avin.waitForTimeout(350);
const found = await avin.evaluate(() => document.querySelectorAll('.paytab.recon tbody tr').length);
must(`searching an order number narrows the list (${found} row)`, found === 1);
await avin.fill('#paySearch', 'zzzzz');
await avin.waitForTimeout(350);
must('and says so when nothing matches', /Nothing matches/.test(await avin.text()));
await avin.fill('#paySearch', '');
await avin.waitForTimeout(300);

// the message for Miraziz. One has to be sitting in the state that means
// 'waiting on him': approved, initiated, out of the Mashreq account.
const wait4 = json(`select coalesce(json_agg(t),'[]') from (select id from payment_requests where status='approved' limit 1) t`)[0];
sql(`select reconcile_payment('${wait4.id}', p_status => 'initiated', p_account => 'mashreq')`, AVIN.auth_user_id);
await avin.refresh();
await avin.past();
await avin.waitForTimeout(250);
const wa = await avin.$('#payWa');
must('there is a nudge for the Mashreq ones waiting on Miraziz', !!wa);
if(wa){
  await wa.click();
  await avin.waitForTimeout(250);
  const msg = await avin.evaluate(() => state.waMsg);
  must('and the message opens with his name and the instruction',
       /^Hi Miraziz,\nKindly approve the following payments:/.test(msg));
  must('and lists them numbered, amount first',
       /\n1\. [A-Z]{3} [\d,]+\.\d\d - .+ - .+ - .+/.test(msg));
  must('and only the initiated Mashreq ones',
       msg.split('\n').filter(l => /^\d+\./.test(l)).length ===
       Number(sql(`select count(*) from payment_requests where status='approved' and pay_status='initiated' and account='mashreq'`).trim()));
  await avin.click('#waShut');
  await avin.waitForTimeout(200);
}

// correcting one
const fix = json(`select coalesce(json_agg(t),'[]') from (select id,order_no from payment_requests where status='approved' limit 1) t`)[0];
await avin.click(`[data-payedit="${fix.id}"]`);
await avin.waitForTimeout(300);
must('a correction opens with the request in it', !!(await avin.$('#edPop')));
must('and warns that this one was already approved',
     /already been approved/.test(await avin.text()));
await avin.fill('#edOrder', 'PR9999');
await avin.selectOption('#edCcy', 'USD');
await avin.click('#edSave');
await avin.waitForTimeout(900);
const after2 = json(`select coalesce(json_agg(t),'[]') from (select order_no,currency,edits from payment_requests where id='${fix.id}') t`)[0];
must('the correction is taken', after2.order_no === 'PR9999' && after2.currency === 'USD');
must('and the request counts that it was changed after approval', after2.edits === 1);
await avin.waitForTimeout(200);
must('and the correction is countable, without a note on the row',
     after2.edits === 1 && !/corrected after approval/.test(await avin.text()));

// ---- 12h. the raise tab side by side, the currency, a new client, the rail
await ahmed.evaluate(() => { state.tab='payment'; state.pqDone=null; state.pqForm=null; render(); });
await ahmed.waitForTimeout(250);
await ahmed.setViewportSize({width:1600,height:1000});
await ahmed.evaluate(()=>render()); await ahmed.waitForTimeout(300);
await ahmed.screenshot({path:'/home/claude/one/pay_raise.png', fullPage:true});
await ahmed.setViewportSize({width:1500,height:1100});
await ahmed.waitForTimeout(200);
must('the form and my requests sit beside each other',
     await ahmed.evaluate(() => {
       const cols = document.querySelectorAll('.payone > div');
       return cols.length === 2 && !!cols[0].querySelector('.payform')
              && /My requests/.test(cols[1].textContent);
     }));
must('the amount box has a currency beside it, defaulting to AED',
     await ahmed.evaluate(() => {
       const c = document.getElementById('pqCcy');
       return !!c && c.value === 'AED' &&
         [...c.options].map(o=>o.value).join(',') === 'AED,EUR,USD';
     }));

// a client nobody has ever billed
await ahmed.evaluate(() => {
  const el = document.getElementById('pqClient');
  el.value = 'Brand New Trading LLC';
  el.dispatchEvent(new Event('input', {bubbles:true}));
});
await ahmed.waitForTimeout(300);
must('a client not on the list can still be used',
     await ahmed.evaluate(() => {
       const b = document.querySelector('#pqList .addnew');
       return !!b && /Brand New Trading LLC/.test(b.textContent);
     }));
must('and nothing grades what was typed',
     await ahmed.evaluate(() => (document.getElementById('pqBadge')||{}).innerHTML === ''));

await ahmed.evaluate(() => {
  document.getElementById('pqPurpose').value = 'Design retainer';
  document.getElementById('pqPayee').value   = 'Studio Nine';
  document.getElementById('pqAmount').value  = '1500';
  document.getElementById('pqCcy').value     = 'EUR';
  ['pqPurpose','pqPayee','pqAmount','pqCcy'].forEach(id => {
    const el = document.getElementById(id);
    el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input', {bubbles:true}));
  });
});
await ahmed.click('#pqSubmit');
await ahmed.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
must('a request in euros is stored in euros',
     sql(`select currency from payment_requests where payee='Studio Nine'`).trim() === 'EUR');
must('and the client that is not on any list is stored as typed',
     sql(`select client from payment_requests where payee='Studio Nine'`).trim() === 'Brand New Trading LLC');
must('and the screen shows the currency, not a bare number',
     /EUR 1,500\.00/.test(await ahmed.text()));

// folding the rail must not move you
await ahmed.evaluate(() => { state.tab='people'; render(); });
await ahmed.waitForTimeout(200);
await ahmed.click('#railTog');
await ahmed.waitForTimeout(250);
must('folding the rail hides it and leaves you where you were',
     await ahmed.evaluate(() => state.tab) === 'people' &&
     await ahmed.evaluate(() => document.getElementById('app').classList.contains('tucked')));
await ahmed.click('#railTog');
await ahmed.waitForTimeout(200);
must('and unfolding does not move you either',
     await ahmed.evaluate(() => state.tab) === 'people');
await ahmed.evaluate(() => { try{ localStorage.removeItem('corplexRail'); }catch(e){} state.tab='payment'; render(); });

/* ---- 13. what a refusal looks like -----------------------------------------
 *
 * The first real request Avin raised was refused, and what he saw was his
 * typing vanish and nothing happen: the failing call ended in a reload, the
 * reload redrew the form from nothing, and the only report was a toast that
 * removed itself after six seconds. */
await ahmed.evaluate(() => {
  state.pqDone = null; state.pqErr = ''; state.pqForm = null; state.pqFiles = [];
  const real = window.__db.raisePayment;
  window.__db.raisePayment = async () => ({error: 'Payment requests are approved by accounts.'});
  window.__restore = () => { window.__db.raisePayment = real; };
  state.tab = 'payment'; render();
});
await ahmed.waitForTimeout(200);
await ahmed.evaluate(() => {
  document.getElementById('pqOrder').value   = 'PR9001';
  document.getElementById('pqAmount').value  = '1875.50';
  document.getElementById('pqClient').value  = 'Jiuba FZC';
  document.getElementById('pqPurpose').value = 'Visa quota fees';
  document.getElementById('pqPayee').value   = 'GDRFA portal';
  document.getElementById('pqNote').value    = 'Urgent, counter closes at 2.';
  document.getElementById('pqMode').value    = 'link';
});
await ahmed.click('#pqSubmit');
await ahmed.waitForTimeout(500);

t = await ahmed.text();
must('a refusal says so on the form, in the database\'s own words',
     /did not go through/.test(t) && /approved by accounts/.test(t));
const kept = await ahmed.evaluate(() => ({
  order:   document.getElementById('pqOrder').value,
  amount:  document.getElementById('pqAmount').value,
  client:  document.getElementById('pqClient').value,
  purpose: document.getElementById('pqPurpose').value,
  payee:   document.getElementById('pqPayee').value,
  note:    document.getElementById('pqNote').value,
  mode:    document.getElementById('pqMode').value
}));
must('and every field is still filled in', 
     kept.order === 'PR9001' && kept.amount === '1875.5' && kept.client === 'Jiuba FZC' &&
     kept.purpose === 'Visa quota fees' && kept.payee === 'GDRFA portal' &&
     kept.note === 'Urgent, counter closes at 2.' && kept.mode === 'link');
must('and the submit button is usable again',
     await ahmed.evaluate(() => !document.getElementById('pqSubmit').disabled));
await ahmed.screenshot({path: '/home/claude/one/pay_refused.png', fullPage: true});

// and it goes through once whatever was wrong is put right
await ahmed.evaluate(() => { window.__restore(); });
await ahmed.click('#pqSubmit');
await ahmed.waitForFunction(() => typeof state !== 'undefined' && state.pqDone, null, {timeout: 20000});
const after = json(`select coalesce(json_agg(t),'[]') from (select order_no,amount,payee,mode,extra from payment_requests where order_no='PR9001') t`)[0];
must('and retrying sends exactly what was on the form',
     after && after.order_no === 'PR9001' && Number(after.amount) === 1875.50 &&
     after.payee === 'GDRFA portal' && after.mode === 'link' &&
     after.extra === 'Urgent, counter closes at 2.');
must('and the error is gone once it worked', !/did not go through/.test(await ahmed.text()));

/* ---- the three tabs, and what is on each ----
 *
 *   'As a approver, i need three tabs: Request for payment / Approve payments
 *    / Past payments. I dont want to view the approved payments on the approve
 *    payments tab.'
 *
 * What matters is that a decided request is on exactly one of them. Two copies
 * of the same row on two screens is how a payment gets chased twice. */
{
  const tabs = await avin.evaluate(() => {
    state.tab = 'payapprove'; render();
    return [...document.querySelectorAll('[data-paytab]')].map(b => b.dataset.paytab);
  });
  must('there are three tabs, in the order he asked for',
       tabs.join(',') === 'payment,payapprove,paypast');

  await avin.approving();
  const onApprove = await avin.evaluate(() => ({
    heads: [...document.querySelectorAll('#view section.panel h3')].map(x => x.textContent),
    recon: document.querySelectorAll('[data-recon]').length,
    queue: document.querySelectorAll('[data-approve]').length}));
  must('Approve payments holds the queue and nothing else',
       onApprove.heads.some(h => /waiting on you/i.test(h))
       && !onApprove.heads.some(h => /Already decided/i.test(h)));
  must('and no decided row is on it', onApprove.recon === 0);

  await avin.past();
  const onPast = await avin.evaluate(() => ({
    heads: [...document.querySelectorAll('#view section.panel h3')].map(x => x.textContent),
    recon: document.querySelectorAll('[data-recon]').length,
    queue: document.querySelectorAll('[data-approve]').length,
    csv: !!document.getElementById('payCsv'),
    find: !!document.getElementById('paySearch')}));
  must('Past payments holds the decided table',
       onPast.heads.some(h => /Already decided/i.test(h))
       && !onPast.heads.some(h => /waiting on you/i.test(h)));
  must('with the reconciliation ticks on it', onPast.recon > 0);
  must('and nothing left to approve there', onPast.queue === 0);
  must('the search and the export moved with it', onPast.csv && onPast.find);

  /* The two tables were lined up with each other on purpose. They are on two
     screens now, and they still have to line up when you move between them. */
  const stops = async tab => avin.evaluate(t => {
    state.tab = t; render();
    const c = document.querySelector('.paytab col');
    return c ? [...document.querySelectorAll('.paytab colgroup')[0].children]
      .slice(0, 10).map(x => x.style.width).join(',') : '';
  }, tab);
  const a = await stops('payapprove'), b2 = await stops('paypast');
  must('the columns still line up across the two screens', a === b2 && !!a);
  await avin.evaluate(() => { state.tab = 'payapprove'; render(); });
}

await b.close();
server.close();
sql(`delete from payment_files; delete from payment_requests;`);

console.log(fails.length
  ? `\n${fails.length} thing(s) the payment screen does not do`
  : `\nraising, refusing, approving and paying all reach the database`);
process.exit(fails.length ? 1 : (process.exitCode || 0));
