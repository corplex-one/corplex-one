/* Does it LOOK right? — the check that should have existed weeks ago.
 *
 * Avin has now caught, in this order: headings breaking mid-word (BOO / KS),
 * a Paid pill sitting on top of an Approved one, columns running off the right
 * edge, a column of nothing but hyphens, rows four lines deep, width wasted in
 * one column while another wrapped to six lines, and two tables on the same
 * screen with different column stops. Every one of those is visible in a
 * screenshot and none of them was caught by a test, because every test asked
 * whether the right words were on the screen and none asked whether they fit.
 *
 * He said: 'I am very particular with these things, I expect you to keep in
 * mind about such things.' A promise to look harder is worth nothing. This is
 * the mechanism instead.
 *
 *   node scripts/checklook.mjs
 *
 * It opens all forty-six screens — the four newest at 1440 and 1920, the rest
 * at 1440, which is the harder of the two — and fails on:
 *
 *   * text cut off, with no hover card to read the rest from. A date, an
 *     order number, an amount, a mode or a status has to fit outright: those
 *     are columns you scan, and nobody hovers over a table to find a payment.
 *   * a heading broken mid-word
 *   * two tables stacked in the same column with different column stops
 *   * boxes sitting on top of each other
 *   * a table wider than its panel, on the four screens where fitting was the
 *     requirement
 *
 * and separately reports, without failing, the things that might be the
 * screen and might be the seed: an empty column, a wide table on a screen
 * where scrolling sideways is the design.
 *
 * Every screen it looked at is listed, so one with nothing on it cannot pass
 * by being missed, and every screen is photographed into /tmp/look, because
 * the question after 'something is wrong' is always 'wrong how'.
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
 sales_bands:'sales_bands', sales_uploads:'sales_uploads', sales_team:'sales_team_figures',
 payment_requests:'payment_requests', payment_files:'payment_files'};

const AVIN  = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Avin Mascarenhas') t`)[0];
const AHMED = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Ahmed Talaat Mohamed') t`)[0];

/* Long, real-shaped content, because a table only misbehaves when something in
 * it is longer than the column it is in. A test with 'Test' in every cell
 * passes a layout that falls apart on 'POA AND CONVEYANCING DOCUMENTS CLEARING
 * SERVICES CO LLC', which is a real client. */
const KEEP = sql(`select count(*) from payment_requests`).trim();
sql(`delete from payment_files; delete from payment_requests;`);
const q = v => v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const MADE = [
  ['Emirates Typing Centre and Documents Clearing', 'Typing centre charges for the whole quarter', 11800, 'transfer', 'PR2431', 'POA AND CONVEYANCING DOCUMENTS CLEARING SERVICES CO LLC', 'Invoice and quotation attached, plus the earlier credit note.'],
  ['Dubai Economy (DED)', 'Trade licence renewal', 4750, 'card', 'PR2517', 'ALIFID SA', 'Renewal notice attached.'],
  ['MOFA', 'Attestation fees', 1200, 'cash', 'PR2350', 'Ajiv East Ltd', 'Urgent — counter closes at 2.']
];
for(const [payee, purpose, amount, mode, order, client, extra] of MADE)
  sql(`select raise_payment_request(${q(payee)}, ${q(purpose)}, ${amount}, ${q(mode)}, ${q(order)}, ${q(client)}, ${q(extra)})`,
      AHMED.auth_user_id);
const ids = json(`select coalesce(json_agg(t),'[]') from (select id from payment_requests order by ref) t`);
/* A document on two of the three, with a real file name on it. An empty
 * Document column is not a layout that has been looked at — it is a layout
 * whose widest column has never held anything. */
sql(`select attach_payment_file('${ids[0].id}', 'Emirates Typing Centre invoice 4471.pdf', '${ids[0].id}/invoice.pdf', 'application/pdf', 184320)`, AHMED.auth_user_id);
sql(`select attach_payment_file('${ids[2].id}', 'MOFA receipt.jpg', '${ids[2].id}/receipt.jpg', 'image/jpeg', 96000)`, AHMED.auth_user_id);
sql(`select decide_payment_request('${ids[0].id}', true)`, AVIN.auth_user_id);
sql(`select reconcile_payment('${ids[0].id}', p_status => 'initiated', p_account => 'mashreq', p_books => true)`, AVIN.auth_user_id);
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
const bad = [], notes = [];
let looked = 0;

/* The four screens where fitting inside the panel is the requirement rather
 * than a preference — the ones Avin said he still has to scroll sideways on.
 * Everywhere else a wide table that scrolls is a note, not a failure. */
const STRICT = ['payapprove', 'payment', 'team', 'payroll'];

async function look(who, name, mode, tab, width){
  const page = await b.newPage({viewport: {width, height: 1100}});
  await page.route('**://fonts.*/**', r => r.abort());
  await page.goto(ORIGIN + '/index.html');
  const DATA = dataFor(who);
  await page.evaluate(([d, n, r]) => {
    window.__DATA = d; window.__ME = n; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => () => {}});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove();
  }, [DATA, name, DATA._roles[name] || ['staff']]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  await page.evaluate(([m, t, strict]) => {
    window.__strict = strict; state.mode = m; state.tab = t; render();
  }, [mode, tab, STRICT.includes(tab)]);
  await page.waitForTimeout(450);

  const found = await page.evaluate(() => {
    /* Two kinds of finding. A defect is something that is wrong on the screen
     * however the data falls: text cut, a word broken, boxes on top of each
     * other, two tables of the same thing that do not line up. A note is
     * something that might be wrong and might just be this month's data: a
     * column that happens to be empty in the seed, or a table that scrolls
     * sideways on a screen where scrolling sideways is the design. Notes are
     * printed and do not fail the run, because a check that cries wolf about
     * an empty Sick-leave column is a check nobody reads. */
    const out = [], notes = [];
    const near = (a, b, t) => Math.abs(a - b) <= t;

    /* ---- 1. anything clipped.
     *
     * A cell that is cut but carries data-full says the rest on hover, and
     * that is the trade Avin agreed to for the columns holding sentences.
     * It is not the trade for the columns you scan: a date, an order number,
     * an amount, a mode, a status. Nobody hovers over a table to find out
     * which payment is which, and an amount cut to '11,800...' is money you
     * cannot read. Those columns have to fit, hover or no hover. */
    const MUSTFIT = ['date', 'order no.', 'order #', 'amount', 'mode',
                     'status', 'payment', 'paid through'];
    const headOf = (tb) => [...tb.querySelectorAll('thead tr:last-child th')]
      .map(th => (th.textContent || '').trim().toLowerCase());
    document.querySelectorAll('#view table').forEach(tb => {
      const heads = headOf(tb);
      tb.querySelectorAll('tr').forEach(tr => {
        [...tr.children].forEach((el, i) => {
          /* No tolerance. The browser clips the moment scrollWidth exceeds
           * clientWidth, and a company's invoiced total came out as
           * '2,439,4…' on a single pixel of overflow — one pixel is the
           * whole difference between a figure and a figure you cannot read. */
          if(el.scrollWidth <= el.clientWidth) return;
          const col = heads[i] || '';
          const must = MUSTFIT.includes(col);
          /* A status cell carries the pill and then, on the same line, the
           * reason it was turned down — which is a sentence, and is meant to
           * be cut and hovered. What must be readable is the pill. */
          const pill = must ? el.querySelector('.pill') : null;
          if(pill){
            const p = pill.getBoundingClientRect(), c = el.getBoundingClientRect();
            const room = c.right - parseFloat(getComputedStyle(el).paddingRight);
            if(p.right <= room + 1 && pill.scrollWidth <= pill.clientWidth + 1) return;
            out.push(`the "${col}" pill is cut: "${(pill.textContent||'').trim()}"`);
            return;
          }
          if(!must && (el.hasAttribute('data-full') || el.querySelector('select,input,button'))) return;
          const what = (el.textContent || '').trim().slice(0, 40);
          out.push(must
            ? `the "${col}" column is cut — "${what}" needs ${el.scrollWidth - el.clientWidth}px more, and this is not a column anybody hovers over`
            : `clipped with no way to read it: "${what}"`);
        });
      });
    });
    // and anything outside a table, where there are no headings to go by
    document.querySelectorAll('#view td, #view th').forEach(el => {
      if(el.closest('table')) return;
      if(el.scrollWidth > el.clientWidth + 1 && !el.hasAttribute('data-full')
         && !el.querySelector('select,input,button'))
        out.push(`clipped with no way to read it: "${(el.textContent||'').trim().slice(0,40)}"`);
    });

    // ---- 2. a heading broken mid-word
    document.querySelectorAll('#view th').forEach(el => {
      const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean);
      if(!words.length) return;
      const probe = document.createElement('span');
      const cs = getComputedStyle(el);
      /* Set the font properties one at a time. The `font` shorthand comes back
       * as an empty string from getComputedStyle in Chrome whenever anything
       * it cannot serialise is in play — and an empty font silently leaves the
       * probe at the body's 16px, which measures a 10px heading as half again
       * too wide and reports every column in the portal as broken. */
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
      for(const p of ['fontFamily','fontSize','fontWeight','fontStyle','fontStretch',
                      'letterSpacing','textTransform','wordSpacing'])
        probe.style[p] = cs[p];
      document.body.appendChild(probe);
      const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      for(const w of words){
        probe.textContent = w;
        if(probe.getBoundingClientRect().width > room + 0.5)
          out.push(`heading breaks mid-word: "${el.textContent.trim()}" (word "${w}" needs ${Math.ceil(probe.getBoundingClientRect().width)}px, column has ${Math.floor(room)}px)`);
      }
      probe.remove();
    });

    // ---- 3. a table wider than the panel holding it
    document.querySelectorAll('#view .tw').forEach(w => {
      if(w.scrollWidth > w.clientWidth + 2)
        (window.__strict ? out : notes).push(
          `table is ${w.scrollWidth - w.clientWidth}px wider than its panel — it scrolls sideways`);
    });

    /* ---- 4. two stacked tables with different column stops.
     *
     * Only tables that are showing the same thing are compared, and only as
     * far as they agree on what they are showing: walk the headings of each
     * pair from the left, and stop at the first one whose wording differs.
     * Two tables of the same rows with the same headings that start their
     * columns in different places is the thing Avin caught; a payroll
     * register above a by-company summary is not, and must not be reported
     * as one, or the check gets ignored. */
    const heads = [...document.querySelectorAll('#view table thead tr:last-child')];
    const label = c => (c.textContent || '').trim().toLowerCase();
    for(let i = 0; i < heads.length; i++)
      for(let j = i + 1; j < heads.length; j++){
        const A = [...heads[i].children], C = [...heads[j].children];
        let k = 0;
        while(k < A.length && k < C.length && label(A[k]) === label(C[k]) && label(A[k])) k++;
        if(k < 3) continue;                       // too little in common to mean anything
        const ra = heads[i].getBoundingClientRect(), rc = heads[j].getBoundingClientRect();
        /* Only tables stacked one above the other in the same column read as
         * one sheet. Two calculators side by side, each with its own AED /
         * Amount / VAT, are two things and are allowed to differ. */
        if(!near(ra.left, rc.left, 2) || !near(ra.width, rc.width, 2)) continue;
        const ax = ra.left, cx = rc.left;
        for(let n = 0; n < k; n++){
          const a = Math.round(A[n].getBoundingClientRect().left - ax);
          const c = Math.round(C[n].getBoundingClientRect().left - cx);
          if(!near(a, c, 2)){
            out.push(`two tables of "${label(A[0])}, ${label(A[1])}, ${label(A[2])}…" do not line up: column ${n + 1} starts at ${a}px in one and ${c}px in the other`);
            break;
          }
        }
      }

    // ---- 5. a column that is empty or a dash all the way down
    document.querySelectorAll('#view table').forEach(tb => {
      const body = tb.querySelector('tbody'); if(!body) return;
      const rows = [...body.querySelectorAll('tr')].filter(r => r.children.length > 3);
      if(rows.length < 2) return;
      const ths = [...tb.querySelectorAll('thead th')];
      for(let c = 0; c < ths.length; c++){
        const cells = rows.map(r => r.children[c]).filter(Boolean);
        if(cells.length < 2) continue;
        const useful = cells.some(x => {
          const t = (x.textContent || '').trim();
          return (t && t !== '—' && t !== '-') || x.querySelector('input,select,button,svg');
        });
        if(!useful) notes.push(`the "${(ths[c].textContent||'').trim() || '(unnamed)'}" column is empty on every row — worth a look, though it may just be this month's figures`);
      }
    });

    // ---- 6. things sitting on top of each other
    const pills = [...document.querySelectorAll('#view .pill')];
    for(let i = 0; i < pills.length; i++)
      for(let j = i + 1; j < pills.length; j++){
        const a = pills[i].getBoundingClientRect(), c = pills[j].getBoundingClientRect();
        if(a.width && c.width && a.left < c.right - 2 && c.left < a.right - 2
           && a.top < c.bottom - 2 && c.top < a.bottom - 2)
          out.push(`two pills overlap: "${pills[i].textContent.trim()}" and "${pills[j].textContent.trim()}"`);
      }
    /* ---- 7. panels side by side that do not end together.
     *
     *   'Time and again same mistakes are repeated. I told you to maintain
     *    parallel heights'                                            -- Avin
     *
     * He had to say it twice, which is once more than a rule should need. The
     * cause each time is the same one property: align-items:start on a grid
     * row, or a panel that is not allowed to stretch, and three cards that
     * start level end at three different places.
     *
     * A row is two or more panels that start at the same y and sit in the
     * same container. A panel wrapped in a bare div of its own counts as
     * itself — the payment screen puts each of its two cards in an unclassed
     * div, and a check that only looked at direct siblings would have walked
     * straight past the widest gap on the portal.
     *
     * What is NOT a row: a panel above another panel; a column of panels that
     * scrolls on its own, where a short card is a short list and not a short
     * card. Those are excluded rather than tolerated, so the tolerance itself
     * can stay at 2px for rounding and nothing more. A card 40px shorter than
     * the one beside it is the fault; a card 4px shorter is the same fault
     * with a smaller number on it. */
    {
      const panels = [...document.querySelectorAll('#view .panel')]
        .filter(el => el.offsetParent !== null && !el.parentElement.closest('.panel'));
      /* A lone panel in a wrapper stands for the wrapper, so cards in
         neighbouring grid cells are compared with each other rather than each
         being a group of one. */
      const block = el => {
        let b = el;
        while(b.parentElement && b.parentElement.id !== 'view'
              && b.parentElement.children.length === 1) b = b.parentElement;
        return b;
      };
      const scrolls = el => {
        for(let p = el.parentElement; p && p.id !== 'view'; p = p.parentElement)
          if(/auto|scroll/.test(getComputedStyle(p).overflowY)) return true;
        return false;
      };
      /* Keyed on the container ELEMENT, not its class name: two unclassed
         divs are two containers, and a string cannot tell them apart. */
      const rows = new Map();
      panels.forEach(el => {
        if(scrolls(el)) return;
        const b = block(el);
        const r = b.getBoundingClientRect();
        if(!r.width || !r.height || !b.parentElement) return;
        const byTop = rows.get(b.parentElement) || rows.set(b.parentElement, new Map()).get(b.parentElement);
        const key = Math.round(r.top);
        (byTop.get(key) || byTop.set(key, []).get(key)).push({el, r});
      });
      const groups = [];
      rows.forEach(byTop => byTop.forEach(list => groups.push(list)));
      groups.forEach(list => {
        if(list.length < 2) return;
        const hs = list.map(x => Math.round(x.r.height));
        const lo = Math.min(...hs), hi = Math.max(...hs);
        if(hi - lo <= 2) return;
        const name = x => ((x.el.querySelector(':scope > header h3') || {}).textContent || '')
          .trim().slice(0, 34) || '(no heading)';
        out.push('panels in one row end at different heights: '
          + list.map((x, i) => `"${name(x)}" ${hs[i]}px`).join(', ')
          + ` — ${hi - lo}px apart`);
      });
    }
    return {bad: [...new Set(out)], notes: [...new Set(notes)]};
  });

  /* ---- 8. the rail stays put.
   *
   * It is meant to be pinned, and for a while it was not: a position:relative
   * added to hang the fold toggle off silently replaced the position:sticky
   * in the base stylesheet, and on any long screen the whole rail travelled
   * up and out of sight. Nothing in any test noticed, because every test
   * looked at a page that had never been scrolled. */
  const rail = await page.evaluate(async () => {
    const el = document.querySelector('.rail');
    if(!el) return null;
    if(document.documentElement.scrollHeight < window.innerHeight + 400) return 'short';
    window.scrollTo(0, 800);
    await new Promise(r => setTimeout(r, 120));
    const top = Math.round(el.getBoundingClientRect().top);
    window.scrollTo(0, 0);
    return top;
  });
  if(typeof rail === 'number' && rail !== 0)
    found.bad.push(`the rail scrolled away with the page — its top is ${rail}px after scrolling 800`);

  looked++;
  const where = `${mode}/${tab} @ ${width}`;
  /* Keep the picture. When this check says something is wrong the next question
   * is always 'wrong how?', and the answer is a screenshot, not a number. */
  fs.mkdirSync('/tmp/look', {recursive: true});
  await page.screenshot({path: `/tmp/look/${mode}-${tab}-${width}.png`, fullPage: true});
  for(const f of found.bad)   bad.push(`${where}: ${f}`);
  for(const f of found.notes) notes.push(`${where}: ${f}`);
  console.log(found.bad.length
    ? `  LOOK ${where.padEnd(28)} ${found.bad.length} thing(s) wrong`
    : `  ok   ${where.padEnd(28)}${found.notes.length ? ' (' + found.notes.length + ' to look at)' : ''}`);
  await page.close();
}

console.log('looking at the screens rather than reading them:\n');

/* The screens with the newest tables, at both widths — 1440 is the laptop and
 * 1920 is the monitor, and a column that fits one does not always fit the
 * other. */
for(const width of [1440, 1920]){
  await look(AVIN,  'Avin Mascarenhas',    'staff', 'payapprove', width);
  await look(AVIN,  'Avin Mascarenhas',    'staff', 'payment',    width);
  await look(AHMED, 'Ahmed Talaat Mohamed','staff', 'payment',    width);
  await look(AVIN,  'Avin Mascarenhas',    'console', 'payroll',  width);
  await look(AVIN,  'Avin Mascarenhas',    'staff', 'team',       width);
  /* The two wide grids, which are the ones whose columns were guessed at and
   * came out as 'DOCUME…' and 'RELATIONSH…'. Both scroll sideways, so what is
   * being looked at is the whole table and not the part of it on screen. */
  await look(AVIN,  'Avin Mascarenhas',    'console', 'docdates', width);
  await look(AVIN,  'Avin Mascarenhas',    'console', 'staffreg', width);
}

/* And every other screen once, at the width that is hardest. A defect of this
 * kind is not confined to the screen it was last found on, and a check that
 * only looks where somebody already complained is a check that waits for the
 * next complaint. */
const REST = [
  ['console', ['payslips','revisions','tickets','gratuity','exits','hradmin','office',
               'regular','shifts','holidays','leaverules','leavebal','salesup','salesrules',
               'salesstaff','addstaff','probation','digest','docsadmin','docdates',
               'profiles','staffreg']],
  ['staff',   ['home','dashboard','commission','invoices','leaderboard','company','tools',
               'profile','attend','people','requests','loans','myslip','myticket']]
];
for(const [mode, tabs] of REST)
  for(const tab of tabs) await look(AVIN, 'Avin Mascarenhas', mode, tab, 1440);

await b.close();
server.close();
sql(`delete from payment_files; delete from payment_requests;`);

console.log(`\n${looked} screens looked at (they held ${KEEP === '0' ? 'nothing' : KEEP + ' request(s)'} before this ran; put back empty)`);
if(notes.length){
  console.log(`\n${notes.length} thing(s) worth a look, which may just be the seed:`);
  for(const x of notes) console.log('  ' + x);
}
if(bad.length){
  console.log(`\n${bad.length} thing(s) that would be visible in a screenshot:`);
  for(const x of bad) console.log('  ' + x);
  process.exit(1);
}
console.log('\nnothing clipped, nothing broken mid-word, nothing overlapping, columns line up');
