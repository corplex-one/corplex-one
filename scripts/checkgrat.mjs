/* Where the workbook stops and the portal starts.
 *
 *   'I have already shared the gratuity file with you, the numbers should stay
 *    according to that'
 *   'You need to remove the data from Sep 2026 and conclude with me till
 *    August 2026. From Sep 2026, you calculate on your basis and I continue
 *    with my work book. Lets see if any difference arise'
 *   'Yes, correct. Its on basic only'                                -- Avin
 *
 * Two halves, and the check is really about the seam between them.
 *
 *   Above the handover nothing may move. Those figures are Avin's sheet, and
 *   the whole arrangement rests on them being left exactly alone — if a single
 *   month above the line shifts, the parallel run is comparing the portal
 *   against itself.
 *
 *   Below it nothing may be stored. The provision is worked out from the basic
 *   on the salary chart, which is the figure the final settlement uses, so the
 *   two cannot come apart the way they did. A stored row underneath a computed
 *   one would be the old disease with a new date on it.
 *
 * The load-bearing case is the last one: send a revision letter, and the
 * provision has to move on its own. That is the whole reason the workbook does
 * not have to be uploaded again.
 *
 *   node scripts/checkgrat.mjs
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

const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Avin Mascarenhas') t`)[0];
const WBTO = one(`select value->>'workbookTo' from settings where key='gratuity_policy'`);
const load = () => { const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
    AVIN.auth_user_id)[0]}, AVIN.id);
  return D.hr.gratuity || D.gratuity; };

const mEnd = ym => { const [y,m] = ym.split('-').map(Number);
  return `${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`; };
const nextYm = ym => { const [y,m] = ym.split('-').map(Number);
  return m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`; };

console.log(`\nthe workbook is the authority up to ${WBTO}\n`);

/* ================================================== 1. the seam, in the database */
console.log('what is stored, and what is not');
{
  ok('the handover month is on the policy, not in the code', /^\d{4}-\d{2}$/.test(WBTO || ''), WBTO);
  ok('nothing is stored at or after it',
     one(`select count(*) from gratuity_basic where month_end >= ('${nextYm(WBTO)}-01')::date`) === '0');
  ok('and the last month it does hold is the handover month',
     String(one(`select max(month_end) from gratuity_basic`)).slice(0,7) === WBTO);
  ok('the months above it are still there in full',
     +one(`select count(*) from gratuity_basic`) > 0);
}

/* ============================ 2. the workbook's own months are not recomputed */
console.log('\nabove the line, the sheet is left alone');
{
  const G = load();
  const stored = json(`select coalesce(json_agg(t),'[]') from (
    select e.full_name as n, b.month_end::text as m, b.basic::float as b
      from gratuity_basic b join gratuity_rows g on g.id = b.row_id
      join employees e on e.id = g.employee_id) t`);
  let off = [];
  stored.forEach(s => { const row = G.rows.find(r => r.n === s.n);
    if(!row || Math.abs((row.basic[s.m] || 0) - s.b) > 0.005) off.push(s.n + ' ' + s.m); });
  ok('every stored month reaches the screen as the sheet has it', !off.length, off.slice(0,3));

  /* The one that would be missed by comparing sums: months the workbook owns
     where the salary chart says something else. The sheet wins there, for
     every one of them — not just at the handover, where today they agree. */
  const dis = json(`select coalesce(json_agg(t),'[]') from (
    select e.full_name as n, b.month_end::text as m, b.basic::float as wb,
      coalesce((select s.basic from salary_parts s where s.employee_id = e.id
                 and s.effective_from <= b.month_end
                 order by s.effective_from desc limit 1), 0)::float as chart
      from gratuity_basic b join gratuity_rows g on g.id = b.row_id
      join employees e on e.id = g.employee_id) t`).filter(x => Math.abs(x.wb - x.chart) > 0.005);
  const wrong = dis.filter(x => {
    const row = G.rows.find(r => r.n === x.n);
    return !row || Math.abs((row.basic[x.m] || 0) - x.wb) > 0.005; });
  ok('including every month where the salary chart says something different — the sheet wins',
     !wrong.length, wrong.slice(0,3).map(x => x.n + ' ' + x.m));
  ok('and there are such months, so that is really being tested',
     dis.length > 0, {months: dis.length,
       example: dis[0] && dis[0].n + ' ' + dis[0].m + ': sheet ' + dis[0].wb + ', chart ' + dis[0].chart});
}

/* ================================= 3. below the line, worked out from the basic */
console.log('\nbelow the line, from the basic on the chart');
{
  const G = load();
  const sep = mEnd(nextYm(WBTO));
  const want = json(`select coalesce(json_agg(t),'[]') from (
    select e.full_name as n,
      coalesce((select sum(x.basic) from (
        select distinct on (s.company) s.company, s.basic from salary_parts s
         where s.employee_id = e.id and s.effective_from <= date '${sep}'
         order by s.company, s.effective_from desc) x), 0)::float as basic,
      e.doj::text as doj, e.last_day::text as last_day
      from employees e where exists (select 1 from gratuity_rows g where g.employee_id = e.id)) t`);
  let off = [], gone = [];
  want.forEach(w => {
    const row = G.rows.find(r => r.n === w.n); if(!row) return;
    const got = row.basic[sep] || 0;
    const out = (w.last_day && w.last_day < sep) || (w.doj && w.doj > sep);
    if(out){ if(got) gone.push(w.n + ' still provisioned'); return; }
    if(Math.abs(got - w.basic) > 0.005) off.push(w.n + ': ' + got + ' vs ' + w.basic);
  });
  ok('the first month past the handover is the basic in force that month', !off.length, off.slice(0,3));
  ok('somebody who has left is not provisioned for after their last day', !gone.length, gone.slice(0,3));

  /* It is the BASIC, not the salary. 'Yes, correct. Its on basic only'. */
  const rich = json(`select coalesce(json_agg(t),'[]') from (
    select e.full_name as n, s.basic::float as basic, s.salary::float as salary
      from salary_parts s join employees e on e.id = s.employee_id
     where s.basic > 0 and s.salary > s.basic and e.active
     order by s.salary desc limit 1) t`)[0];
  const rr = rich && G.rows.find(r => r.n === rich.n);
  ok('on the basic and not the whole salary',
     !!rr && Math.abs((rr.basic[sep] || 0) - rich.basic) < 0.005
          && Math.abs((rr.basic[sep] || 0) - rich.salary) > 0.005,
     rich && {who: rich.n, drawn: rr && rr.basic[sep], basic: rich.basic, salary: rich.salary});

  /* A month that is not prorated: somebody part-paid is still provisioned on
     their whole basic. Avin's own sheet does this — Abdulkhamid, August. */
  const part = json(`select coalesce(json_agg(t),'[]') from (
    select l.name as n, l.days::int as days,
      coalesce((select s.basic from salary_parts s join employees e2 on e2.id = s.employee_id
                 where e2.full_name = l.name and s.effective_from <= date '${sep}'
                 order by s.effective_from desc limit 1), 0)::float as basic
      from payroll_lines l join payroll_runs r on r.id = l.run_id
     where r.status = 'closed' and l.days < 30 and l.days > 0 limit 1) t`)[0];
  if(part && part.basic > 0){
    const pr = G.rows.find(r => r.n === part.n);
    ok('a part-paid month still provisions on the whole basic, not the days paid',
       !!pr && Math.abs((pr.basic[sep] || 0) - part.basic) < 0.005,
       {who: part.n, daysPaid: part.days, drawn: pr && pr.basic[sep], basic: part.basic});
  }

  const months = [...new Set(G.rows.flatMap(r => Object.keys(r.basic)))].sort();
  ok('and it runs to the end of the year rather than stopping at today',
     months[months.length-1].slice(0,7) === new Date().getUTCFullYear() + '-12',
     months[months.length-1]);
}

/* ======================= 4. and a revision moves it, which is the whole point */
console.log('\na revision letter maintains it, with nothing uploaded');
{
  const P = json(`select coalesce(json_agg(t),'[]') from (
    select e.id, e.full_name, s.basic::float as basic, s.allowance::float as allowance
      from employees e join salary_parts s on s.employee_id = e.id
     where e.active and e.payroll_basis = 'salaried' and s.basic > 0
       and coalesce(s.source,'') not like 'Revision letter%'
       and s.effective_from = (select max(x.effective_from) from salary_parts x
                                where x.employee_id = e.id
                                  and coalesce(x.source,'') not like 'Revision letter%')
     order by e.full_name limit 1) t`)[0];
  const eff = nextYm(nextYm(WBTO)) + '-01';
  const at = mEnd(nextYm(nextYm(WBTO)));
  const before = (load().rows.find(r => r.n === P.full_name) || {basic:{}}).basic[at] || 0;

  const draft = JSON.parse(one(`select issue_revision('${P.id}', ${P.basic + 500}, ${P.allowance},
    '${eff}'::date, 'Checking the provision follows', '', 'revision', false)`, AVIN.auth_user_id));
  const rev = one(`select id from salary_revisions where letter_ref = '${draft.ref}'`);
  const mid = (load().rows.find(r => r.n === P.full_name) || {basic:{}}).basic[at] || 0;
  ok('a revision still in draft moves nothing', Math.abs(mid - before) < 0.005, {before, mid});

  raw(`select release_revision('${rev}')`, AVIN.auth_user_id);
  const after = (load().rows.find(r => r.n === P.full_name) || {basic:{}}).basic[at] || 0;
  ok('sending it moves the provision, with no upload and nothing else touched',
     Math.abs(after - (before + 500)) < 0.005, {before, after, want: before + 500});
  ok('and the month before it is untouched',
     Math.abs(((load().rows.find(r => r.n === P.full_name) || {basic:{}}).basic[mEnd(nextYm(WBTO))] || 0)
              - before) < 0.005);

  raw(`delete from salary_parts where employee_id='${P.id}' and source like 'Revision letter%'`);
  raw(`delete from salary_revisions where employee_id='${P.id}'`);
  raw(`delete from letters where employee_id='${P.id}' and kind='revision'`);
  const back = (load().rows.find(r => r.n === P.full_name) || {basic:{}}).basic[at] || 0;
  ok('(and it is put back for the next run)', Math.abs(back - before) < 0.005, {back, before});
}

/* ================================================= 5. the table on the screen */
console.log('\nthe by-month table');
{
  const G = load();
  const b = await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport:{width:1600, height:1400}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      AVIN.auth_user_id)[0]}, AVIN.id);
  await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => async () => true});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); },
    [D, 'Avin Mascarenhas', D._roles['Avin Mascarenhas'] || ['staff']]);
  await p.addScriptTag({path:'web/app.js'});
  await p.evaluate(() => { state.mode='console'; state.tab='gratuity'; render(); });
  await p.waitForTimeout(400);

  const r = await p.evaluate(() => {
    const t = document.querySelector('.gmon'); if(!t) return null;
    const rows = [...t.querySelectorAll('tbody tr')].map(x => ({
      cls: x.className, cells: [...x.querySelectorAll('td')].map(c => c.textContent.trim())}));
    const grp = t.querySelector('tbody tr.grp td');
    return {rows, divider: grp ? grp.textContent.trim() : '',
            dividerCase: grp ? getComputedStyle(grp).textTransform : '',
            heads: [...t.querySelectorAll('thead th')].map(h => h.textContent.trim())};
  });
  ok('the table is on the screen', !!r);
  ok('with a column per company and the group beside them',
     r && JSON.stringify(r.heads) === JSON.stringify(
       ['Month','CorpLex','POA','Lex Estates','Group','Movement','People']), r && r.heads);
  ok('a month for every month on file',
     r && r.rows.filter(x => !x.cls.includes('grp') && !x.cls.includes('sub')).length
        === [...new Set(G.rows.flatMap(x => Object.keys(x.basic)))].length,
     r && r.rows.length);
  ok('the handover is drawn on it', !!r && /workbook is the authority above/.test(r.divider), r && r.divider);
  ok('as a sentence, not shouted in capitals', r && r.dividerCase === 'none', r && r.dividerCase);

  /* The divider has to sit between the right two months, or it is decoration. */
  const seq = r.rows.map(x => x.cls.includes('grp') ? '<<HANDOVER>>' : x.cells[0]);
  const at = seq.indexOf('<<HANDOVER>>');
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const lastAbove = MON[+WBTO.slice(5)-1] + ' ' + WBTO.slice(0,4);
  ok('immediately after the last month the workbook owns', seq[at-1] === lastAbove,
     {before: seq[at-1], want: lastAbove});

  /* The year line is the closing less the year before's closing — not less its
     own January, which understates every year after the first. */
  const subs = r.rows.filter(x => x.cls.includes('sub'));
  ok('a line per year, with what it charged', subs.length >= 1, subs.length);
  ok('and the first year says it has no opening rather than inventing one',
     /no opening on file/.test(subs[0].cells.join(' ')), subs[0] && subs[0].cells);
  if(subs.length > 1){
    const num = s => +String(s).replace(/[(),]/g, '') * (String(s).includes('(') ? -1 : 1);
    const closeA = num(subs[0].cells[2]), closeB = num(subs[1].cells[2]);
    ok('the second year charges its closing less the first year’s closing',
       Math.abs(num(subs[1].cells[3]) - (closeB - closeA)) < 1.5,
       {closeA, closeB, charged: subs[1].cells[3]});
  }

  const cap = await p.evaluate(() => document.getElementById('view').textContent);
  ok('and the page says which side of the line a figure came from',
     /the salary chart/.test(cap) && /workbook/.test(cap));
  ok('no page errors', !errs.length, errs[0]);
  await b.close();
}

server.close();
console.log(bad.length ? `\n${n - bad.length} of ${n} checks passed\n  - ` + bad.join('\n  - ')
                       : `\n${n} checks, all passed`);
process.exit(bad.length ? 1 : 0);
