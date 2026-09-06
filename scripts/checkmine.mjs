/* My commission and My invoices, after a page-by-page read.
 *
 *   'Hero and settlement have the same details. Forfeited is missing in the
 *    hero, you can add it there'
 *   'Settlement box goes off'
 *   'Commission, line by line | Your band | Money not counted — put the above
 *    in the same row by fixing column width'
 *   'Just like payment requests, show all invoices in one line'
 *   'Thu Apr 30 2026 23:59:48 GMT+0400 (Gulf Standard Time) - There is this
 *    text on CL INV-2426 - Fix it'
 *   'PR# and Company Name can have hover, as too much space is wasted'
 *   'Shrink the columns'                                            -- Avin
 *
 * The one worth explaining is the date. A PR number on one invoice was a
 * JavaScript Date printed in full — because the workbook reader turned every
 * cell into text with String(cell), and Excel hands back a Date object for any
 * cell it thinks is a date. It was not a fault in that invoice or that column:
 * every text column comes through the same funnel, so a date-formatted cell
 * anywhere would have landed the same way. Fixed at the funnel, and checked
 * there — a check that only asserted CL INV-2426 looks right would pass on a
 * database where somebody had edited that one row by hand.
 *
 *   node scripts/checkmine.mjs
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';
import {txt} from '../web/sales.js';

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

/* Somebody with invoices against their name, or the pages are empty shells. */
const WHO = json(`select coalesce(json_agg(t),'[]') from (
  select e.full_name, e.auth_user_id, count(*) as invs
    from employees e join sales_invoices i on i.filed_under = e.id or i.consultant = e.id
   where e.active and e.auth_user_id is not null
   group by e.full_name, e.auth_user_id order by count(*) desc limit 1) t`)[0];
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Avin Mascarenhas') t`)[0];

const b = await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const open = async (nm, tab, w = 1700, h = 1700) => {
  const p = await b.newPage({viewport:{width:w, height:h}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  const d = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      AVIN.auth_user_id)[0]}, AVIN.id);
  await p.evaluate(([dd, who, r]) => { window.__DATA = dd; window.__ME = who; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => async () => true});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); },
    [d, nm, d._roles[nm] || ['staff']]);
  await p.addScriptTag({path:'web/app.js'});
  await p.evaluate(t => { state.mode='staff'; state.tab=t; render(); }, tab);
  await p.waitForTimeout(450);
  return {p, errs};
};

console.log(`\n${WHO.full_name}, ${WHO.invs} invoices\n`);

/* ================================== 1. a date cell stops arriving as a dump */
console.log('what the workbook reader does with a date-formatted cell');
{
  /* At the funnel, not at the one row it happened to. */
  ok('a Date cell reads as a date',
     txt(new Date(Date.UTC(2026, 4, 1))) === '01 May 2026', txt(new Date(Date.UTC(2026,4,1))));
  ok('with no timezone name on the end',
     !/GMT|Universal Time|Standard Time/.test(txt(new Date(Date.UTC(2026,4,1)))));
  ok('a date the parser could not read is nothing, not "Invalid Date"',
     txt(new Date('not a date')) === '', txt(new Date('not a date')));
  ok('and ordinary cells are untouched',
     txt('  PR2421 ') === 'PR2421' && txt(2426) === '2426' && txt(null) === '',
     [txt('  PR2421 '), txt(2426), txt(null)]);

  /* And the row that was already stored. */
  ok('no PR number on file is machine text',
     one(`select count(*) from sales_invoices where pr_ref ~ '(GMT|UTC|Coordinated Universal Time)'`) === '0');
  const it = one(`select coalesce(pr_ref,'(blank)') from sales_invoices where inv_no = 'CL INV-2426'`);
  ok('CL INV-2426 reads as a date rather than a dump',
     /^\d{2} \w{3} \d{4}$/.test(it) || it === '(blank)', it);

  /* The column will not take another one, whatever writes it. */
  const any = one(`select id from sales_invoices limit 1`);
  const m = nope(`update sales_invoices set pr_ref = 'Fri May 01 2026 00:00:00 GMT+0000 (Coordinated Universal Time)' where id = '${any}'`);
  ok('and the column refuses one pasted straight in',
     /pr_ref_is_a_reference/.test(m), m || 'IT WENT THROUGH');
}

/* ============================================== 2. My commission, rearranged */
console.log('\nMy commission');
{
  const {p, errs} = await open(WHO.full_name, 'commission');
  const r = await p.evaluate(() => ({
    tiles: [...document.querySelectorAll('.strip .stat .k')].map(x => x.textContent.trim()),
    five: !!document.querySelector('.strip.five'),
    panels: [...document.querySelectorAll('#view > .grid > .panel > header h3, #view .grid.commrow > .panel header h3')]
      .map(x => x.textContent.trim()),
    row: !!document.querySelector('.grid.commrow'),
    inRow: document.querySelectorAll('.grid.commrow > .panel').length,
    text: document.getElementById('view').textContent.replace(/\s+/g,' ')}));

  ok('Forfeited is a figure of its own', r.tiles.some(t => /^Forfeited$/i.test(t)), r.tiles);
  ok('after what was paid, which is the order the money moves in',
     r.tiles.findIndex(t => /^Forfeited$/i.test(t)) === r.tiles.findIndex(t => /Paid to date/i.test(t)) + 1,
     r.tiles);
  ok('and the strip is told it holds five, so none of them wraps alone', r.five);

  ok('the Settlement panel is gone', !/^Settlement$/m.test(r.panels.join('\n')), r.panels);
  ok('nothing it said is lost — earned, paid, forfeited and the balance are all still on the page',
     /Commission earned/i.test(r.text) && /Paid to date/i.test(r.text)
       && /Forfeited/i.test(r.text) && /Balance owed/i.test(r.text));

  ok('the three that are left are one row', r.row && r.inRow === 3, r.inRow);
  const heads = await p.evaluate(() =>
    [...document.querySelectorAll('.grid.commrow > .panel header h3')].map(x => x.textContent.trim()));
  ok('line by line, the band, and what is not counted yet',
     /line by line|bucket by bucket/i.test(heads[0]) && /band|arrangement/i.test(heads[1])
       && /not counted/i.test(heads[2]), heads);

  /* 'by fixing column width' — the three panels are not a plain third each;
     the band table has five columns and would be squeezed by prose. */
  const w = await p.evaluate(() => [...document.querySelectorAll('.grid.commrow > .panel')]
    .map(x => Math.round(x.getBoundingClientRect().width)));
  ok('sitting side by side, none of them squeezed to nothing',
     w.length === 3 && Math.min(...w) > 320, w);
  ok('and the band table is wider than the column of prose beside it', w[1] > w[2], w);

  /* Nothing may be cut off — the reason the widths are set rather than equal. */
  const clip = await p.evaluate(() => [...document.querySelectorAll('.grid.commrow td, .grid.commrow th')]
    .filter(c => c.scrollWidth > c.clientWidth + 1).map(c => c.textContent.trim()).slice(0, 4));
  ok('with nothing clipped in either table', !clip.length, clip);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================================ 3. My invoices, one a line */
console.log('\nMy invoices');
{
  const {p, errs} = await open(WHO.full_name, 'invoices');
  const r = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.invtable tbody tr')];
    const h = rows.map(x => Math.round(x.getBoundingClientRect().height));
    const cn = rows.map(x => x.querySelector('td.cname')).filter(Boolean);
    const pr = rows.map(x => x.querySelector('td.prno')).filter(Boolean);
    return {rows: rows.length, heights: h,
      tallest: Math.max(...h), shortest: Math.min(...h),
      /* data-full, which is the portal's own hover — not a browser tooltip.
         checklook treats that attribute as what makes a clipped cell
         readable, so using anything else would look right and check wrong. */
      cnameTitled: cn.length && cn.every(c => (c.getAttribute('data-full') || '').length > 0),
      prTitled: pr.length && pr.every(c => c.hasAttribute('data-full') || !c.textContent.trim() || c.textContent.trim() === '—'),
      truncated: cn.filter(c => c.scrollWidth > c.clientWidth + 1).length,
      titleMatches: cn.filter(c => c.scrollWidth > c.clientWidth + 1)
        .every(c => c.getAttribute('data-full').startsWith(c.textContent.trim().replace(/….*$/, '').slice(0, 12)))};
  });
  ok('there are invoices to look at', r.rows > 5, r.rows);
  /* One line each: every row the same height as the shortest, rather than
     four times it because a client has a long name. */
  ok('every invoice is one line', r.tallest - r.shortest <= 2, {tallest: r.tallest, shortest: r.shortest});
  ok('the company name carries the whole of itself on hover', r.cnameTitled);
  ok('and so does the PR number', r.prTitled);
  ok('some names really are being cut, so that is not a hollow test', r.truncated > 0, r.truncated);
  ok('and what is on hover is what was cut', r.titleMatches);

  /* 'Shrink the columns' — the table should now fit more of itself on screen. */
  const fit = await p.evaluate(() => { const t = document.querySelector('.invtable');
    const w = document.querySelector('.invscroll') || t.parentElement;
    return {table: Math.round(t.scrollWidth), box: Math.round(w.clientWidth)}; });
  ok('and the table is narrower than it was — under 1.35 screens wide',
     fit.table < fit.box * 1.35, fit);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

await b.close(); server.close();
console.log(bad.length ? `\n${n - bad.length} of ${n} checks passed\n  - ` + bad.join('\n  - ')
                       : `\n${n} checks, all passed`);
process.exit(bad.length ? 1 : 0);
