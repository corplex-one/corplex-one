/* The home page, after a page-by-page read.
 *
 *   'Is away soon the right word?'
 *   'Swap away soon and announcements'
 *   'Notoification box for events coming up is not required. Just keep todays
 *    events'
 *   'The language on your profile is incomplete is not good'
 *   'Top static header is not good looking'                          -- Avin
 *
 * Five small things, and four of them are wording or arrangement — which is
 * exactly the kind of change that gets undone by the next person who touches
 * the file, because nothing in the code says it was deliberate. So each one is
 * asserted here against the rendered page rather than trusted to a comment.
 *
 * The one with teeth is the strip. It used to announce a birthday up to a week
 * out, so it was almost always saying something that had not happened. 'Just
 * keep todays events' means the strip is present on the days something IS
 * happening and absent otherwise, and that is checked both ways — a page with
 * a celebration on it and a page without.
 *
 *   node scripts/checkhome.mjs
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

/* Somebody plain, so the page is the one most of the staff see. */
const WHO = json(`select coalesce(json_agg(t),'[]') from (
  select e.full_name, e.auth_user_id from employees e
   where e.active and e.auth_user_id is not null
     and not exists (select 1 from employee_roles r where r.employee_id = e.id
                      and r.role in ('accounts','owner'))
   order by e.full_name limit 1) t`)[0];
const AVIN = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='Avin Mascarenhas') t`)[0];

const b = await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const open = async (nm, w = 1500, h = 1400) => {
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
  await p.evaluate(() => { state.mode='staff'; state.tab='home'; render(); });
  await p.waitForTimeout(350);
  return {p, errs};
};

console.log(`\nhome, as ${WHO.full_name}\n`);
const {p, errs} = await open(WHO.full_name);

/* ============================================= 1. what the leave box is called */
console.log('the leave box');
{
  const r = await p.evaluate(() => {
    const h = [...document.querySelectorAll('.grid.hrow h3')].map(x => x.textContent.trim());
    const box = [...document.querySelectorAll('.grid.hrow > .panel')]
      .find(s => /on leave/i.test((s.querySelector('h3')||{}).textContent || ''));
    return {heads: h,
            hint: box ? (box.querySelector('.hint')||{}).textContent : '',
            rows: box ? [...box.querySelectorAll('.feed li em')].map(x => x.textContent.trim()) : []};
  });
  ok('is no longer called "Away soon"', !r.heads.some(h => /away soon/i.test(h)), r.heads);
  ok('and says it is about leave', r.heads.some(h => /on leave/i.test(h)), r.heads);
  /* The reason the old name was wrong: rows saying 'away now' under a heading
     promising 'soon'. The new hint has to admit both. */
  ok('with a subtitle that admits people are already away',
     /away now/i.test(r.hint || ''), r.hint);
  if(r.rows.some(x => /away now/i.test(x)))
    ok('and there really is somebody away now, so that is not a guess', true);
}

/* ================================== 2. where it sits, and where announcements do */
console.log('\nand where the boxes sit');
{
  const r = await p.evaluate(() =>
    [...document.querySelectorAll('.grid.hrow > .panel h3')].map(x => x.textContent.trim()));
  ok('six boxes, in two rows of three', r.length === 6, r);
  ok('Announcements is in the top row where the leave box used to be',
     r.indexOf('Announcements') === 1, r);
  ok('and the leave box has taken its place in the second',
     /on leave/i.test(r[3] || ''), r);
  /* Everything else stayed put — a swap of two should move exactly two. */
  ok('the other four have not moved',
     r[0] === 'Your day' && r[2] === 'Working from home'
       && r[4] === 'Birthdays' && r[5] === 'Work anniversaries', r);
}

/* ========================================= 3. the strip is today or nothing */
console.log('\nthe strip above the welcome panel');
{
  const r = await p.evaluate(() => {
    const s = document.querySelector('.celeb');
    return {there: !!s, k: s ? (s.querySelector('.ck')||{}).textContent.trim() : '',
            text: s ? s.textContent.replace(/\s+/g,' ') : '',
            next: s ? !!s.querySelector('.cnext') : false};
  });
  const anyToday = await p.evaluate(() => !!celebsOn(HDATE()).any);
  ok('it is there only when something is happening today', r.there === anyToday, {shown: r.there, today: anyToday});
  if(r.there){
    ok('and it says Today, never Coming up', r.k === 'Today', r.k);
    ok('with no line about what follows it', !r.next);
  }
  ok('the word "Coming up" is nowhere on the page', !/Coming up/.test(
     await p.evaluate(() => document.getElementById('view').textContent)));

  /* The other half of 'just today': on a day when something IS on, it shows.
     Tested by moving a birthday onto today rather than by waiting for one. */
  const emp = one(`select id from employees where full_name = '${WHO.full_name}'`);
  const was = one(`select coalesce(birthday::text,'') from employees where id = '${emp}'`);
  /* Birthdays are held as the portal writes them — '24 Jun' — not as a date,
     so a check that sets one has to write that shape or it silently sets
     nothing and then reports the strip missing. */
  const today = one(`select to_char(current_date, 'DD Mon')`);
  raw(`update employees set birthday = '${today}' where id = '${emp}'`);
  const {p: p2, errs: e2} = await open(WHO.full_name);
  const r2 = await p2.evaluate(() => { const s = document.querySelector('.celeb');
    return {there: !!s, k: s ? (s.querySelector('.ck')||{}).textContent.trim() : '',
            text: s ? s.textContent.replace(/\s+/g,' ') : ''}; });
  ok('and it does appear on a day that has something on it', r2.there, r2);
  ok('saying Today', r2.k === 'Today', r2.k);
  ok('and naming what it is', /birthday/i.test(r2.text), r2.text.slice(0, 70));
  ok('no page errors on that page either', !e2.length, e2[0]);
  await p2.close();
  raw(`update employees set birthday = ${was ? `'${was}'` : 'null'} where id = '${emp}'`);
}

/* ============================================ 4. how the profile nudge reads */
console.log('\nthe nudge about a half-finished profile');
{
  const r = await p.evaluate(() => { const nd = document.querySelector('.nudge');
    return nd ? {text: nd.textContent.replace(/\s+/g,' ').trim(),
                 loud: nd.classList.contains('loud'),
                 head: (nd.querySelector('b')||{}).textContent} : null; });
  if(r){
    ok('it does not call it "your file"', !/your file/i.test(r.text), r.head);
    ok('nor grade it with a percentage', !/%/.test(r.text), r.head);
    ok('and does not reach for a hospital to hurry somebody along',
       !/hospital/i.test(r.text), r.text.slice(0, 80));
    ok('it says how many details are missing', /details? (is|are) missing/i.test(r.head), r.head);
    ok('names the first of them', /Personal|Address|Passport|Emergency/i.test(r.text), r.text.slice(0, 90));
    ok('gives the reason once, where it is real',
       /visa renewal|insurance/i.test(r.text) && !/two in the morning/i.test(r.text));
    ok('and does not shout at somebody who has barely started', !r.loud);
  } else ok('(nobody on this database has a half-finished profile to test with)', true);
}

/* ================================================== 5. the bar along the top */
console.log('\nthe bar along the top');
{
  const r = await p.evaluate(() => {
    const t = document.querySelector('.topbar');
    const ttl = document.getElementById('pageTitle');
    const end = t.querySelector('.tbend');
    return {title: (ttl.childNodes[0]||{}).textContent,
            sub: (ttl.querySelector('small')||{}).textContent || '',
            grouped: !!end,
            inGroup: end ? [...end.children].map(x => x.id || x.className.split(' ')[0]) : [],
            loose: [...t.children].filter(x => !x.classList.contains('hidden')
              && !x.classList.contains('ttl') && !x.classList.contains('tbend')).length};
  });
  ok('the page still names itself', /Home/.test(r.title || ''), r.title);
  ok('and now says what day it is and which company',
     /\w+day/.test(r.sub) && /CorpLex|POA|Lex/.test(r.sub), r.sub);
  ok('the controls at the right are one group', r.grouped);
  ok('holding the bell and the theme switch',
     r.inGroup.includes('bell') && r.inGroup.includes('themeSeg'), r.inGroup);
  ok('with nothing left adrift beside them', r.loose === 0, r.loose);

  /* The welcome panel said the same day and company two lines below. */
  const hero = await p.evaluate(() => (document.querySelector('.hhero p')||{}).textContent || '');
  ok('and the welcome panel no longer repeats it',
     !/\d{4}/.test(hero) && !/CorpLex|POA|Lex Estates/.test(hero), hero);
  ok('while still saying who somebody is', hero.trim().length > 3, hero);

  /* A box is as tall as what is in it: the fixed height was set when the
     longest list was in the top row, and it moved. */
  const hh = await p.evaluate(() => [...document.querySelectorAll('.grid.hrow > .panel')]
    .map(x => Math.round(x.getBoundingClientRect().height)));
  ok('the top row is no longer as tall as the list that left it',
     Math.max(hh[0], hh[1], hh[2]) < Math.max(hh[3], hh[4], hh[5]), hh);
  ok('and the three boxes in a row still line up with each other',
     hh[0] === hh[1] && hh[1] === hh[2] && hh[3] === hh[4] && hh[4] === hh[5], hh);
}

ok('no page errors', !errs.length, errs[0]);
await p.close();
await b.close(); server.close();

console.log(bad.length ? `\n${n - bad.length} of ${n} checks passed\n  - ` + bad.join('\n  - ')
                       : `\n${n} checks, all passed`);
process.exit(bad.length ? 1 : 0);
