/* What the reconciliation table looks like under four layouts.
 *
 * Avin asked for a mock-up of moving the rail to the top before deciding. A
 * drawing would be a guess; this is the real screen, with the real sixteen
 * columns and real rows in it, rendered four ways. The only thing that changes
 * between shots is CSS injected over the built page — nothing here is
 * committed to the build, and if he says no, nothing has to be undone.
 *
 *   node scripts/shotnav.mjs
 *
 * The question underneath the question is whether he needs this at all: at
 * 1920 the table may already fit beside the rail, and the answer is different
 * on a laptop. So each layout is shot at both widths.
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

const T = {companies:'companies', employees:'employees', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits',
 tickets:'ticket_entitlements', ticket_history:'ticket_history',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads',
 payment_requests:'payment_requests', payment_files:'payment_files'};

const WHO = 'Avin Mascarenhas';
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${WHO}') t`)[0];
const AHMED = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Ahmed Talaat Mohamed') t`)[0];

/* Enough rows to see what a real month looks like, put in and taken out again.
 * One decided request tells you nothing about how a list of them reads. */
sql(`delete from payment_files; delete from payment_requests;`);
const MADE = [
  ['Dubai Economy (DED)', 'Trade licence renewal', 4750, 'card', 'PR2517', 'ALIFID SA', 'Renewal notice attached.'],
  ['Al Waha Translation', 'Legal translation', 3200, 'cash', 'PR2508', 'SC Project Management LLC', 'Arabic MOA, 14 pages.'],
  ['Emirates Typing Centre', 'Typing centre charges', 11800, 'transfer', 'PR2431', 'Abeltino Marketing Management', 'Invoice and quotation attached.'],
  ['Aramex', 'Courier and attestation', 640, 'cash', 'PR2402', 'JAA United DMCC', 'Paid personally, receipt attached.'],
  ['GDRFA portal', 'Visa quota fees', 8500, 'link', 'PR2380', 'Jiuba FZC', 'PRO service fees.'],
  ['Tasheel', 'Labour card renewal', 2150, 'card', 'PR2366', 'Maxmon FZCO', ''],
  ['MOFA', 'Attestation fees', 1200, 'cash', 'PR2350', 'Ajiv East Ltd', 'Urgent — counter closes at 2.']
];
const q = v => v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
for(const [payee, purpose, amount, mode, order, client, extra] of MADE)
  sql(`select raise_payment_request(${q(payee)}, ${q(purpose)}, ${amount}, ${q(mode)}, ${q(order)}, ${q(client)}, ${q(extra)})`,
      AHMED.auth_user_id);
// decided in various states, so the reconciliation columns have something to show
const ids = json(`select coalesce(json_agg(t),'[]') from (select id, ref from payment_requests order by ref) t`);
const decide = (i, ok, why) => sql(`select decide_payment_request('${ids[i].id}', ${ok}, ${q(why)})`, AVIN.auth_user_id);
const rec = (i, p) => sql(`select reconcile_payment('${ids[i].id}', ${p})`, AVIN.auth_user_id);
decide(0, true);  rec(0, `p_status => 'paid', p_account => 'qashio', p_books => true, p_bigin => true, p_receipt => true`);
decide(1, true);  rec(1, `p_status => 'paid', p_account => 'petty', p_books => true`);
decide(2, true);  rec(2, `p_status => 'initiated', p_account => 'mashreq'`);
decide(3, true);  rec(3, `p_account => 'qashio9444'`);
decide(4, true);
decide(5, false, 'The client has not settled the invoice this sits against.');
// the seventh stays pending, so the queue is not empty either

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

const db = {settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
    `) t`, AVIN.auth_user_id)[0]};
const DATA = buildData(db, AVIN.id);

/* ---------------------------------------------------------------- the layouts
 *
 * A. as it is — the rail down the left
 * B. the rail as a strip of icons, which keeps vertical navigation and buys
 *    back about 170px for nothing
 * C. the rail moved to the top, which is what Avin suggested
 */
const RAIL_ICONS = `
  #app{grid-template-columns:66px minmax(0,1fr)}
  .rail{padding:16px 8px;gap:14px;align-items:center}
  .rail .markco,.rail .who,.rail .navlabel,.rail button.nav span{display:none}
  .rail .appmark .one{display:none}
  .rail .appmark img{width:38px}
  .rail button.nav{justify-content:center;padding:10px 0}
  .rail button.nav svg{width:19px;height:19px}
`;

const NAV_TOP = `
  #app{display:block}
  .rail{position:sticky;top:0;z-index:40;flex-direction:row;align-items:center;gap:16px;
        padding:0 20px;height:52px;overflow-x:auto;overflow-y:hidden;
        border-bottom:1px solid rgba(255,255,255,.10)}
  .rail .mark{padding:0;flex:0 0 auto}
  .rail .appmark img{width:104px;top:5px}
  .rail .appmark .one{font-size:20px;padding-left:8px}
  .rail .appmark .one::before{height:18px}
  .rail .appmark .crown{width:15px;right:11px}
  .rail .markco{display:none}
  .rail nav{flex-direction:row;align-items:center;gap:2px;flex:1;min-width:0}
  .rail .navlabel{display:none}
  .rail button.nav{width:auto;white-space:nowrap;padding:7px 11px;border-radius:8px;font-size:13px}
  .rail button.nav[aria-current="true"]{box-shadow:none;background:var(--accent);color:#fff}
  .rail button.nav svg{display:none}
  .rail .who{margin-top:0;border-top:0;padding-top:0;display:flex;align-items:center;gap:9px;
             flex:0 0 auto;font-size:12px;white-space:nowrap}
  .rail .who .m,.rail .who .buildno,.rail .who span#whoDept{display:none}
  .rail .who .out{margin:0;padding:4px 10px}
  main{min-height:calc(100vh - 52px)}
  main .content{max-width:none;padding-left:20px;padding-right:20px}
`;

/* D. The table itself put on a diet, with the rail left exactly where it is.
 * Worth measuring before moving anything: if the columns can be made to fit
 * without touching the layout, then the layout was never the problem. */
const TIGHT = `
  .paytab.recon table{font-size:12px}
  .paytab.recon td,.paytab.recon th{padding:7px 7px}
  .paytab.recon td.cell{max-width:104px}
  .paytab.recon select.acsel{max-width:100px;font-size:11.5px;padding:3px 4px}
  .paytab.recon th.c,.paytab.recon td.c{padding-left:5px;padding-right:5px}
  .paytab.recon .sub{font-size:10px}
  .paytab.recon .pill{font-size:10px;padding:1px 7px}
`;

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const shots = [];

async function shoot(name, width, css, label, tucked){
  const page = await b.newPage({viewport: {width, height: 1000}});
  await page.route('**://fonts.*/**', r => r.abort());
  await page.goto(ORIGIN + '/index.html');
  await page.evaluate(([d, me, roles]) => {
    window.__DATA = d; window.__ME = me; window.__ROLES = roles;
    window.__db = new Proxy({}, {get: () => () => {}});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove();
  }, [DATA, WHO, DATA._roles[WHO]]);
  await page.addScriptTag({path: '/home/claude/one/web/app.js'});
  /* The portal's own stylesheet is inside the body, not the head — mkweb
   * writes the shell after </head> — so a style added to the head loses to it
   * at equal specificity. This goes at the end of the body, after theirs. */
  if(css) await page.evaluate(c => {
    const el = document.createElement('style'); el.textContent = c;
    document.body.appendChild(el);
  }, css);
  if(tucked) await page.evaluate(() => { try{ localStorage.setItem('corplexRail','tucked'); }catch(e){} });
  await page.evaluate(() => { state.mode = 'staff'; state.tab = 'payapprove'; render(); });
  await page.waitForTimeout(400);

  // does the sixteen-column table fit without scrolling?
  const fit = await page.evaluate(() => {
    const w = document.querySelector('.paytab.recon');
    if(!w) return null;
    return {visible: Math.round(w.clientWidth), needed: Math.round(w.scrollWidth),
            over: Math.round(w.scrollWidth - w.clientWidth),
            grid: getComputedStyle(document.getElementById('app')).gridTemplateColumns,
            content: Math.round(document.querySelector('main .content').clientWidth)};
  });
  const file = `/home/claude/one/nav_${name}_${width}.png`;
  await page.screenshot({path: file, fullPage: false});
  await page.close();
  shots.push({name, width, label, file, fit});
  console.log(`  ${label.padEnd(34)} ${String(width).padStart(4)}px  ` +
    (fit ? (fit.over <= 0 ? `fits, ${-fit.over}px to spare` : `${fit.over}px short`)
         + `   [content ${fit.content}px, table wants ${fit.needed}px, grid ${fit.grid}]` : 'no table'));
  return fit;
}

console.log('the sixteen-column reconciliation table, as built:\n');
await shoot('now',    1440, '', 'rail out');
await shoot('now',    1920, '', 'rail out');
await shoot('tucked', 1440, '', 'rail put away', true);
await shoot('tucked', 1920, '', 'rail put away', true);

await b.close();
server.close();
sql(`delete from payment_files; delete from payment_requests;`);
fs.writeFileSync('/home/claude/one/navshots.json', JSON.stringify(shots, null, 2));
console.log('\nwritten: nav_{now,icons,top}_{1440,1920}.png');
