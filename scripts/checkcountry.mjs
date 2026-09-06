/* One country list, and it means something.
 *
 *   'The country cell is to be filled and there is no picker to select country'
 *   'If the country of new employee is different from the list currently we
 *    have, how is air ticket price fixed?'
 *   'Add all the countries in the world. For now rates are fixed for few
 *    countries, if someone joins from a different country, i will edit and add
 *    the rate manually.'
 *   'Make India as just one country ... Fix AED2500 as ticket price'   -- Avin
 *
 * The answer to his second question was that nothing fixed it: the joiner form
 * had two free text boxes and nothing checked one against the other, and the
 * Country rates panel was a display copy in settings that no code path read
 * when a rate was actually paid.
 *
 * What has to stay true now:
 *
 *   1. every country is on one list, and that list is the picker in all three
 *      places a country is chosen;
 *   2. a rate changed in the table moves the people on that country, because a
 *      rate that moves in one place and not the other is the same disagreement
 *      in a new spot;
 *   3. a country nobody has joined from before can still be picked, and the
 *      form asks for its rate rather than quietly writing nought;
 *   4. the joiner takes the country's rate, never a number typed beside it;
 *   5. India is one country at 2,500, everywhere it is written down;
 *   6. the portal still opens if the migration has not been run yet.
 *
 *   node scripts/checkcountry.mjs
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

const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];
const asAvin = s => one(`set role authenticated; select set_config('request.jwt.claim.sub','${AVIN.auth_user_id}',false); ` + s);

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
async function open(name, tab, drop){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const cols = Object.entries(T).filter(([k]) => k !== drop);
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      cols.map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport: {width: 1700, height: 1200}});
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
  await p.evaluate(t => { state.mode = t.con ? 'console' : 'staff'; state.tab = t.id; render(); }, tab);
  await p.waitForTimeout(200);
  return {p, errs};
}

/* ================================================== 1. India, everywhere */
console.log('\nIndia is one country at 2,500');
{
  ok('one India on the rate list, at 2,500',
     one(`select count(*)||'/'||coalesce(max(rate)::text,'-') from ticket_rates where country like 'India%'`) === '1/2500.00',
     one(`select string_agg(country||'='||coalesce(rate::text,'-'), ', ') from ticket_rates where country like 'India%'`));
  ok('nobody is on a band any more',
     one(`select count(*) from ticket_entitlements where country like 'India (%'`) === '0');
  ok('and no profile says one either — it was never a country',
     one(`select count(*) from employees where home_country like 'India (%'`) === '0');
  ok('all four India entitlements are at 2,500',
     one(`select count(*) from ticket_entitlements where country='India' and rate=2500`) === '4',
     json(`select coalesce(json_agg(t),'[]') from (select e.full_name, t.rate from ticket_entitlements t join employees e on e.id=t.employee_id where t.country='India') t`));
  ok('what was already paid keeps the figure it was paid at',
     one(`select count(*) from ticket_history where amount not in (2500)`) !== '0');
}

/* ============================================== 2. the list, and the pickers */
console.log('\none list, three pickers');
{
  const n = +one(`select count(*) from ticket_rates`);
  const priced = +one(`select count(*) from ticket_rates where rate is not null`);
  ok(`every country is on the list (${n})`, n > 190, n);
  ok(`only the agreed ones carry a rate (${priced})`, priced > 0 && priced < 30, priced);
  ok('nobody is from a country that is not on the list',
     one(`select count(*) from ticket_entitlements t left join ticket_rates r on r.country=t.country where r.country is null`) === '0');
  ok('and nobody is from one with no rate agreed',
     one(`select count(*) from ticket_entitlements t join ticket_rates r on r.country=t.country where r.rate is null`) === '0');

  const {p, errs} = await open('Avin Mascarenhas', {id:'addstaff', con:true});
  const r = await p.evaluate(() => {
    const sel = document.getElementById('jCountry');
    return {isSelect: !!sel && sel.tagName === 'SELECT',
            n: sel ? sel.options.length - 1 : 0,
            hasAustralia: sel ? [...sel.options].some(o => o.value === 'Australia') : false,
            india: sel ? ([...sel.options].find(o => o.value === 'India') || {}).textContent : '',
            rateBox: (document.getElementById('jRate') || {}).disabled};
  });
  ok('the joiner picks a country rather than spelling it', r.isSelect);
  ok('and every country is offered, priced or not', r.hasAustralia && r.n > 190, r.n);
  ok('each option carries its rate, so the choice is informed', /2,500/.test(r.india), r.india);
  ok('with nothing chosen, the allowance box is not typeable', r.rateBox !== false);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

console.log('\nand a person picks their own home country the same way');
{
  const {p, errs} = await open('Nissa Muradova', {id:'profile'});
  const r = await p.evaluate(() => {
    const s = document.querySelector('[data-pfs="homeCountry"]');
    return {isSelect: !!s, n: s ? s.options.length - 1 : 0,
            free: !!document.querySelector('[data-pf="homeCountry"]')};
  });
  ok('their profile offers the list', r.isSelect && r.n > 190, r);
  ok('and no longer a box to type India (South) into', !r.free);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ================================ 3. a rate change carries the people with it */
console.log('\nchanging a rate moves the people on that country');
{
  const before = one(`select string_agg(distinct rate::text, ',') from ticket_entitlements where country='India'`);
  const said = JSON.parse(asAvin(`select set_ticket_rate('India', 2750)`));
  ok('the function says who moved', said.moved === 4 && said.names.length === 4, said);
  ok('and they really did', one(`select string_agg(distinct rate::text, ',') from ticket_entitlements where country='India'`) === '2750.00');
  asAvin(`select set_ticket_rate('India', 2500)`);
  ok('putting it back puts them back',
     one(`select string_agg(distinct rate::text, ',') from ticket_entitlements where country='India'`) === before);

  ok('a country nobody is from can be priced without touching anybody',
     JSON.parse(asAvin(`select set_ticket_rate('Australia', 3400)`)).moved === 0);
  ok('and clearing it leaves the country on the list',
     JSON.parse(asAvin(`select set_ticket_rate('Australia', null)`)).rate === null
     && one(`select count(*) from ticket_rates where country='Australia'`) === '1');

  /* The three guards on taking a country off the list, each on the case it is
     actually for. A real country is refused first, so the headcount guard is
     tested on a hand-added one with somebody pointed at it. */
  const refused = sql => { try { asAvin(sql); return ''; }
    catch(e){ return String((e.stderr || e.message) || '').replace(/\s+/g, ' '); } };

  ok('a real country stays on the list, whatever else is true of it',
     /stays on the list/.test(refused(`select delete_ticket_rate('Australia')`)));
  ok('and so does one somebody is from',
     /stays on the list|from India/.test(refused(`select delete_ticket_rate('India')`)));

  asAvin(`select set_ticket_rate('Testland', 1234)`);
  ok('a hand-added country with a rate has to be cleared first',
     /Clear the rate/.test(refused(`select delete_ticket_rate('Testland')`)));
  asAvin(`select set_ticket_rate('Testland', null)`);
  /* Borrowed, then put back exactly as it was — an earlier draft of this check
     restored the wrong country and left two people on India, which every other
     check then read as the truth. */
  const V = json(`select coalesce(json_agg(t),'[]') from (
    select employee_id, country, rate from ticket_entitlements order by employee_id limit 1) t`)[0];
  raw(`update ticket_entitlements set country='Testland' where employee_id='${V.employee_id}'`);
  ok('and one somebody is from cannot go at all',
     /from Testland/.test(refused(`select delete_ticket_rate('Testland')`)));
  raw(`update ticket_entitlements set country='${V.country}', rate=${V.rate}
        where employee_id='${V.employee_id}'`);
  const back = one(`select country||'|'||rate from ticket_entitlements where employee_id='${V.employee_id}'`);
  ok('and the person borrowed for that test is exactly as they were',
     back.split('|')[0] === V.country && +back.split('|')[1] === +V.rate, {back, was: V});
  asAvin(`select delete_ticket_rate('Testland')`);
  ok('once nobody is from it, it goes',
     one(`select count(*) from ticket_rates where country='Testland'`) === '0');

  ok('only accounts may change a rate at all',
     /Only accounts/.test((() => { try {
       one(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',false); select set_ticket_rate('India', 1)`);
       return ''; } catch(e){ return String(e.stderr || e.message); } })()));
}

/* ========================== 4 & 5. the Australia case, end to end on the form */
console.log('\nsomebody joins from a country nobody has joined from before');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'addstaff', con:true});
  const r = await p.evaluate(() => {
    const f = JF();
    Object.assign(f, {name:'Test Person', doj:'2026-10-01', company:'corplex', basis:'salaried',
                      basic:'6000', allow:'4000', country:'Australia', rate:''});
    render();
    const why1 = jWhy();
    const box1 = document.getElementById('jRate').disabled;
    const note = (document.querySelector('.jnote[style*="warn"]') || {}).textContent || '';
    JF().rate = '3400'; render();
    return {why1, box1, note, why2: jWhy(),
            takes: jTicketRate(JF()),
            india: jTicketRate(Object.assign({}, JF(), {country:'India', rate:'99'}))};
  });
  ok('the allowance box opens for a country with no rate', r.box1 === false);
  ok('and the form says what typing there does', /becomes the rate for Australia/.test(r.note), r.note.slice(0, 90));
  ok('it will not add them at nought', /ticket allowance for Australia/.test(r.why1), r.why1);
  ok('once a figure is given, the form is ready', r.why2 === '', r.why2);
  ok('the joiner takes that figure', r.takes === 3400, r.takes);
  ok('but for a country that has a rate, the typed number is ignored',
     r.india === 2500, r.india);

  // and saving prices the country first, then adds the person
  const saw = await p.evaluate(async () => {
    document.getElementById('jSave').click();
    await new Promise(r => setTimeout(r, 200));
    return window.__saw.map(x => [x[0], x[1]]);
  });
  ok('saving puts the rate on the country list before adding anybody',
     saw[0] && saw[0][0] === 'setTicketRate' && saw[0][1] === 'Australia', saw);
  ok('and then adds them', saw.some(x => x[0] === 'addEmployee'), saw.map(x => x[0]));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

/* ========================= 6. the table itself, and the migration not yet run */
console.log('\nthe table, and a portal whose migration has not been run yet');
{
  const {p, errs} = await open('Avin Mascarenhas', {id:'tickets', con:true});
  const r = await p.evaluate(() => {
    const rows = () => [...document.querySelectorAll('.ratescroll tbody tr')];
    const before = rows().length;
    state.rateFind = 'aus'; render();
    const found = rows().map(t => t.children[0].textContent.trim().split(' ')[0]);
    state.rateFind = 'Zzzz'; render();
    const none = (document.querySelector('.ratescroll tbody') || {}).textContent || '';
    state.rateFind = ''; render();
    return {before, found, none, search: !!document.getElementById('rateFind'),
            scroller: !!document.querySelector('.ratescroll')};
  });
  ok('there is a search box and a scroller', r.search && r.scroller);
  ok('the resting list is the priced ones, not all 238', r.before > 5 && r.before < 40, r.before);
  ok('searching reaches the unpriced ones', r.found.includes('Australia'), r.found);
  ok('and a search that finds nothing offers to add it', /Add /.test(r.none), r.none.slice(0, 80));
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}
{
  // deploying the build before running 0021 must not close the portal
  const {p, errs} = await open('Nissa Muradova', {id:'profile'}, 'ticket_rates');
  const r = await p.evaluate(() => ({open: !document.getElementById('app').classList.contains('hidden'),
    drew: (document.getElementById('view').textContent || '').length,
    picker: (document.querySelector('[data-pfs="homeCountry"]') || {}).options ?
            document.querySelector('[data-pfs="homeCountry"]').options.length : -1}));
  ok('the portal opens with no country table at all', r.open && r.drew > 200, r);
  ok('and the picker is simply empty rather than throwing', r.picker >= 0, r.picker);
  ok('no page errors', !errs.length, errs[0]);
  await p.close();
}

await b.close(); server.close();
console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
