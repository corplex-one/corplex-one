/* The Department screen follows the quarter, and the target is a real number.
 *
 *   '1. Target % is not working (200k per month, 2.4m per year) — it should
 *       change based on year and Quarter selected
 *    2. Key indicators, top clients, collection status does not change with
 *       Year and quarter selected
 *    3. All figures should change based on the year and quarter selected'
 *                                                                    -- Avin
 *
 * The first was not a display fault. The target stored against the department
 * was {"year":0,"month":0,"quarter":0} — written as zeros by every workbook
 * upload, never set to anything — so the ring divided by nought and said 0%.
 * The second and third were real: one panel read the quarter and the rest of
 * the screen was the whole year whatever button was pressed.
 *
 * What has to stay true:
 *
 *   1. the target is one monthly figure per company and department, the
 *      quarter is three of it and the year twelve, and only accounts can set
 *      it;
 *   2. every figure on the screen moves when the quarter moves — asserted
 *      against the screen, not the data, because that is where it went wrong;
 *   3. the quarters add up to the year for the figures that come from the
 *      monthly series, which is the whole reason they come from there;
 *   4. the four that need the quarter blocks say so when a year has none,
 *      rather than showing the year's figure under a quarter's heading;
 *   5. nothing on the page throws when a quarter is empty.
 *
 *   node scripts/checktarget.mjs
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
const err = (s, u) => { try { raw(s, u); return ''; } catch(e){ return String(e.stderr || e.message); } };

const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits', exit_lines:'exit_lines',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company',
 sales_company_mine:'sales_company_mine', sales_members:'sales_members',
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

const who = n => json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${n}') t`)[0];
const AVIN = who('Avin Mascarenhas');
const SHOH = who('Shohruh Karimov');

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name){
  const U = who(name);
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1700, height: 1400}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r; window.__saw = [];
    window.__db = new Proxy({}, {get: (_, k) => async (...a) => { window.__saw.push([String(k), ...a]); return true; }});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); }, [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path: 'web/app.js'});
  return {p, errs, D};
}
/* Everything the screen puts on the page for one year and one period. */
const read = (p, year, per) => p.evaluate(([y, q]) => {
  state.mode = 'staff'; state.tab = 'company'; state.year = y; state.period = q; render();
  const txt = s => ((document.querySelector(s) || {}).textContent || '').trim();
  const tiles = [...document.querySelectorAll('#view > .strip .stat')].map(s => ({
    k: (s.querySelector('.k')||{}).textContent.trim(), v: (s.querySelector('.v')||{}).textContent.trim() }));
  const kpis = [...document.querySelectorAll('#view .kpirow .stat')].map(s => ({
    k: (s.querySelector('.k')||{}).textContent.trim(), v: (s.querySelector('.v')||{}).textContent.trim() }));
  const bars = [...document.querySelectorAll('#view .panel')]
    .filter(x => /Top clients/.test(((x.querySelector('h3')||{}).textContent)||''))
    .flatMap(x => [...x.querySelectorAll('.hbar, .hb, [data-v]')].map(h => h.textContent.trim()));
  return {ring: txt('#view svg text'), tiles, kpis,
          topText: (document.querySelector('#view .grid.g2 .panel .pad') || {}).textContent || '',
          collText: [...document.querySelectorAll('#view .grid.g2 .panel')].map(x=>x.textContent).join(' '),
          bars};
}, [year, per]);

/* ======================================================== 1. the target */
console.log('\nthe target is a number somebody set');
{
  const v = one(`select value::text from settings where key='sales_target'`);
  ok('it is stored, per company and department', /Corporate & Legal/.test(v) && /200000/.test(v), v);

  ok('a consultant cannot set it',
     /Only accounts/.test(err(`select set_sales_target('{"corplex":{"Corporate & Legal":1}}'::jsonb)`, SHOH.auth_user_id)));
  ok('accounts can',
     one(`select (set_sales_target('{"corplex":{"Corporate & Legal":200000}}'::jsonb))::text`, AVIN.auth_user_id).includes('true'));
  ok('a company that does not exist is refused',
     /not one of the companies/.test(err(`select set_sales_target('{"nowhere":{"Sales":1}}'::jsonb)`, AVIN.auth_user_id)));
  ok('a negative target is refused',
     /cannot be negative/.test(err(`select set_sales_target('{"corplex":{"Corporate & Legal":-5}}'::jsonb)`, AVIN.auth_user_id)));
  ok('and it is still 200,000 after all that',
     one(`select value->'corplex'->>'Corporate & Legal' from settings where key='sales_target'`) === '200000');
}

/* ============================================ 2. the screen and the period */
console.log('\nevery figure moves with the quarter');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const FY = await read(p, '2026', 'FY');
  const Q1 = await read(p, '2026', 'Q1');
  const Q3 = await read(p, '2026', 'Q3');

  ok('the ring is a real percentage, not nought', FY.ring !== '0%' && /%$/.test(FY.ring), FY.ring);
  ok('and it is a different one per quarter', Q1.ring !== FY.ring && Q3.ring !== Q1.ring,
     [FY.ring, Q1.ring, Q3.ring]);

  const tv = x => x.tiles.map(t => t.v);
  ok('all four hero tiles change', tv(Q1).every((v, i) => v !== tv(FY)[i]), [tv(FY), tv(Q1)]);
  ok('the first tile names the period', /Q1/.test(Q1.tiles[0].k), Q1.tiles[0].k);

  const kv = x => x.kpis.map(t => t.v);
  ok('the key indicators change', kv(Q1).filter((v, i) => v !== kv(FY)[i]).length >= 6, [kv(FY), kv(Q1)]);
  ok('collection rate is one of them',
     (Q1.kpis.find(k => /COLLECTION/i.test(k.k)) || {}).v !== (FY.kpis.find(k => /COLLECTION/i.test(k.k)) || {}).v);
  ok('active clients is another',
     (Q1.kpis.find(k => /ACTIVE/i.test(k.k)) || {}).v !== (FY.kpis.find(k => /ACTIVE/i.test(k.k)) || {}).v);

  ok('top clients change', Q1.topText !== FY.topText);
  ok('collection status changes', Q1.collText !== FY.collText);
  ok('no page errors on any of it', !errs.length, errs[0]);
  await p.close();
}

/* =========================== 3. the quarters add up to the year */
console.log('\nthe quarters add up to the year');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const num = s => +String(s).replace(/[^0-9.]/g, '') || 0;
  for(const year of ['2026', '2025']){
    const FY = await read(p, year, 'FY');
    let inv = 0, net = 0;
    for(const q of ['Q1','Q2','Q3','Q4']){
      const r = await read(p, year, q);
      inv += num(r.tiles[0].v); net += num(r.tiles[1].v);
    }
    /* Invoiced and net sales come from the monthly series, so this is exact
       rather than close: they are the year's own numbers regrouped. Rounding
       to the nearest dirham across four additions is the only slack. */
    ok(`${year} — the four quarters' invoiced adds to the year`,
       Math.abs(inv - num(FY.tiles[0].v)) <= 4, [inv, num(FY.tiles[0].v)]);
    ok(`${year} — and so does net sales`,
       Math.abs(net - num(FY.tiles[1].v)) <= 4, [net, num(FY.tiles[1].v)]);
  }
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================ 4. a year with no quarter blocks says so */
console.log('\na quarter with nothing on file says so');
{
  const keep = one(`select figures->'byQuarter' is not null from sales_company where company='corplex' and year=2026`);
  ok('2026 has quarter blocks to begin with', keep === 't', keep);
  raw(`update sales_company set figures = figures - 'byQuarter' where company='corplex' and year=2026`);

  const {p, errs} = await open('Avin Mascarenhas');
  const Q1 = await read(p, '2026', 'Q1');
  ok('outstanding is a dash rather than the year’s figure',
     (Q1.tiles.find(t => /OUTSTANDING/i.test(t.k)) || {}).v.includes('—'), Q1.tiles.map(t=>t.v));
  ok('and the panels say what is missing and how to fix it',
     /not on file/.test(Q1.collText) && /re-uploading/i.test(Q1.collText));
  ok('invoiced still works, because it comes from the monthly series',
     !(Q1.tiles[0].v.includes('—')) && /[1-9]/.test(Q1.tiles[0].v), Q1.tiles[0].v);
  ok('nothing throws', !errs.length, errs[0]);
  await p.close();

  raw(`select 1`);
  execFileSync(PSQL, [...base, '-q', '-f', 'supabase/seed/0033_the_quarter_and_the_target.sql'], {stdio: 'pipe'});
  ok('and the blocks come back when 0033 is run again',
     one(`select figures->'byQuarter' is not null from sales_company where company='corplex' and year=2026`) === 't');
}

/* ================================================= 5. the console screen */
console.log('\nthe screen that sets it');
{
  const {p, errs} = await open('Avin Mascarenhas');
  const r = await p.evaluate(() => {
    state.mode = 'console'; state.tab = 'salestgt'; render();
    const rows = [...document.querySelectorAll('#view table tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim()));
    return {rows, hasEdit: !!document.querySelector('[data-ed="target"], .edbar button, #view header button')};
  });
  ok('every revenue department is listed', r.rows.length >= 4, r.rows.length);
  const cl = r.rows.find(x => /Corporate & Legal/.test(x[1]));
  ok('CorpLex Corporate & Legal is 200,000 a month', cl && cl[2] === '200,000', cl);
  ok('600,000 a quarter', cl && cl[3] === '600,000', cl);
  ok('2,400,000 a year', cl && cl[4] === '2,400,000', cl);
  ok('a department with no target shows a dash rather than nought',
     r.rows.filter(x => x[2] === '—').length >= 1, r.rows);
  ok('and it is behind an Edit button like every other table', r.hasEdit);

  /* Edit, change, save: what reaches the database is one call carrying the
     figure that was typed, not a row at a time. */
  const saw = await p.evaluate(async () => {
    state.mode = 'console'; state.tab = 'salestgt'; state.edit = null; render();
    const ed = [...document.querySelectorAll('#view button')].find(b => b.textContent.trim() === 'Edit');
    if(!ed) return {no: 'no Edit button'};
    ed.click();
    const box = document.querySelector('#view input[data-edt="target"]');
    if(!box) return {no: 'no box after Edit'};
    box.value = '250000'; box.dispatchEvent(new Event('input', {bubbles: true}));
    await new Promise(r => setTimeout(r, 60));
    const save = [...document.querySelectorAll('#view button')].find(b => /^Save/.test(b.textContent.trim()));
    if(!save) return {no: 'no Save button'};
    save.click();
    await new Promise(r => setTimeout(r, 80));
    /* The house pattern: Save shows what is about to change, and the writing
       happens on the second press. A test that stopped at the first would
       pass on a screen that never wrote anything. */
    const listed = [...document.querySelectorAll('.edconf .edtab tbody tr')]
      .map(tr => [...tr.children].map(td => td.textContent.trim()));
    const go = document.getElementById('edGo');
    if(!go) return {no: 'no confirmation before saving', listed};
    go.click();
    await new Promise(r => setTimeout(r, 150));
    return {calls: window.__saw, listed};
  });
  ok('it says what is about to change before it writes',
     (saw.listed || []).length === 1
     && /Corporate & Legal/.test((saw.listed[0] || [])[0] || '')
     && /200,000 a month/.test((saw.listed[0] || [])[1] || '')
     && /250,000 a month/.test((saw.listed[0] || [])[2] || ''), saw.listed);
  ok('Edit → change → Save reaches the database once',
     saw.calls && saw.calls.filter(c => c[0] === 'setSalesTargets').length === 1, saw);
  const call = (saw.calls || []).find(c => c[0] === 'setSalesTargets');
  ok('and it carries the department and the figure typed',
     !!call && Object.keys(call[1] || {}).some(k => /Corporate & Legal/.test(k))
     && String(Object.values(call[1])[0]) === '250000', call);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

await b.close(); server.close();
console.log(`\n${checks - fails}/${checks} checks pass`);
process.exit(fails ? 1 : 0);
