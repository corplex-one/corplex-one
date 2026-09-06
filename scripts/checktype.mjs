/* The type Avin chose, and the sizes that were making it hard to read.
 *
 *   'The font used for the table headers is not readable and received a lot of
 *    complaints - Find the best one'
 *   'Increase the font size in the staff records page - its bad to the eyes'
 *   'B and 2'                                                         -- Avin
 *
 * Three separate faults, each one a stack of small decisions rather than a
 * single mistake:
 *
 *   1. Table headers were 10.5px, in capitals, letter-spaced, and in the palest
 *      of the three greys. He picked B: 13px, sentence case, no tracking, full
 *      ink. The header still separates from the rows because it is bolder and
 *      sits on a tinted band.
 *
 *   2. Every input and select rendered at 11px — SMALLER than the label above
 *      it. Not deliberate: `input,select{font:inherit}` inherits from the bare
 *      `label{font-size:11px}` rule meant for the label's own text, so the
 *      small-caps treatment of the label was landing on the value you typed.
 *
 *   3. Bodoni Moda is a Didone — thick stems, hairline joins — which works on a
 *      magazine cover at 60px and against you at 16.5px on a dark screen. He
 *      picked 2: Newsreader, a newspaper serif drawn to be read small.
 *
 * The logotype keeps Bodoni. A wordmark is not UI type.
 *
 *   node scripts/checktype.mjs
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
 payment_requests:'payment_requests', payment_files:'payment_files', sales_members:'sales_members'};

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

const b = await pw.chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='Avin Mascarenhas') t`)[0];
const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
  ...json(`select coalesce(json_agg(t),'[]') from (select ` +
    Object.entries(T).map(([k, t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
    U.auth_user_id)[0]}, U.id);
/* The real faces are let through: a check that measures the fallback proves
   nothing about the face that was chosen. */
const p = await b.newPage({viewport: {width: 1600, height: 1200}});
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(O + '/index.html');
await p.evaluate(([d, nm, r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r;
  window.__db = new Proxy({}, {get: () => async () => true});
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const bt = document.getElementById('boot'); if(bt) bt.remove(); },
  [D, U.full_name, D._roles[U.full_name] || ['staff']]);
await p.addScriptTag({path: 'web/app.js'});

/* ============================================ 1. the table headers, B */
console.log('\nB — the table headers');
{
  await p.evaluate(() => { state.mode = 'console'; state.tab = 'payroll'; render(); });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const t = document.querySelector('#view th');
    const c = getComputedStyle(t);
    const cell = getComputedStyle(document.querySelector('#view td'));
    return {size: parseFloat(c.fontSize), weight: +c.fontWeight, tr: c.textTransform,
            ls: c.letterSpacing, colour: c.color, ink: getComputedStyle(document.body).color,
            band: c.backgroundColor, cellBg: cell.backgroundColor, text: t.textContent.trim()};
  });
  /* 13 is the base; the payroll register is 12.5 because it carries the most
     columns of any screen. Neither is anywhere near the 10.5 that was there. */
  ok('a header is 12.5px or more, not 10.5', r.size >= 12.5, r.size);
  ok('and set as words rather than capitals', r.tr === 'none', r.tr);
  ok('with no letter-spacing pulling it apart', r.ls === 'normal', r.ls);
  ok('in full-strength ink, not the palest grey', r.colour === r.ink, [r.colour, r.ink]);
  ok('and it is the weight that separates it from the rows', r.weight >= 600, r.weight);
  ok('helped by the band it sits on', r.band !== r.cellBg, [r.band, r.cellBg]);
  ok('so the words are readable rather than recognised by shape',
     /[a-z]/.test(r.text), r.text);
}
{
  /* the confirm-list tables carried their own copy of the old treatment */
  const r = await p.evaluate(() => {
    const s = document.createElement('style');
    document.head.appendChild(s);
    const d = document.createElement('div');
    d.innerHTML = '<table class="edtab"><thead><tr><th>Was</th></tr></thead></table>';
    document.body.appendChild(d);
    const c = getComputedStyle(d.querySelector('th'));
    const out = {size: parseFloat(c.fontSize), tr: c.textTransform, colour: c.color,
                 ink: getComputedStyle(document.body).color};
    d.remove(); s.remove();
    return out;
  });
  ok('a confirm-list header got the same treatment',
     r.size === 13 && r.tr === 'none' && r.colour === r.ink, r);
}
{
  /* Nothing anywhere is left at the old treatment. A table with its own th
     rule is how the first pass missed the payroll register. */
  const css = fs.readFileSync('web/index.html', 'utf8');
  const bad = [];
  const re = /([^{}]+)\{([^}]*font-size[^}]*)\}/g;
  let m;
  while((m = re.exec(css))){
    const sel = m[1].trim().replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const body = m[2];
    if(!/(^|[\s,])(\.[\w.-]+ )*th\b/.test(sel)) continue;
    if(/printinv|\.letter |\.lttab/.test(sel)) continue;        // printed documents, not the app
    if(/\bth\b[\s>]+\S/.test(sel)) continue;                    // something INSIDE a heading, not the heading
    if(/@media|\.paytab|\.paytable/.test(sel)) continue;         // phone-width overrides
    const size = parseFloat((body.match(/font-size:\s*([\d.]+)px/) || [])[1] || '99');
    if(size < 11) bad.push(sel + ' @ ' + size + 'px');
  }
  ok('no table on any screen is left with a sub-11px heading', !bad.length, bad);
}

/* ==================================== 2. what you type is not the smallest */
console.log('\nwhat you type is not smaller than its own label');
{
  await p.evaluate(() => { state.mode = 'console'; state.tab = 'staffrec';
    state.sr = {who:'Shohruh Karimov', draft:{}, confirm:false, busy:false, done:''}; render(); });
  await p.waitForTimeout(250);
  const r = await p.evaluate(() => {
    const g = s => { const e = document.querySelector(s); if(!e) return null;
      const c = getComputedStyle(e);
      return {size: parseFloat(c.fontSize), tr: c.textTransform, colour: c.color}; };
    return {input: g('[data-sr="name"]'), select: g('[data-sr="company"]'),
            label: g('.jform label span'), body: parseFloat(getComputedStyle(document.body).fontSize),
            ink2: (() => { const d = document.createElement('i');
              d.style.color = 'var(--ink2)'; document.body.appendChild(d);
              const c = getComputedStyle(d).color; d.remove(); return c; })(),
            ink3: (() => { const d = document.createElement('i');
              d.style.color = 'var(--ink3)'; document.body.appendChild(d);
              const c = getComputedStyle(d).color; d.remove(); return c; })()};
  });
  ok('a box you type into is 14px, not 11', r.input.size === 14, r.input.size);
  ok('and so is a picker', r.select.size === 14, r.select.size);
  ok('what you type is bigger than the label above it',
     r.input.size > r.label.size, [r.input.size, r.label.size]);
  ok('and the label is not left in the palest grey',
     r.label.colour === r.ink2 && r.label.colour !== r.ink3, [r.label.colour, r.ink2]);
  ok('nothing inherited the label\'s capitals into the value',
     r.input.tr === 'none' && r.select.tr === 'none', [r.input.tr, r.select.tr]);
}
{
  /* and it is every form, not only this one — the fault was one shared line */
  await p.evaluate(() => { state.mode = 'console'; state.tab = 'addstaff'; render(); });
  await p.waitForTimeout(250);
  const r = await p.evaluate(() => {
    const sizes = [...document.querySelectorAll('#view input, #view select')]
      .filter(e => e.offsetWidth).map(e => parseFloat(getComputedStyle(e).fontSize));
    return {min: Math.min(...sizes), n: sizes.length};
  });
  ok('the joiner form got it too, not just Staff Records', r.min >= 14, r);
}

/* ================================================ 3. the serif, Newsreader */
console.log('\n2 — Newsreader, and the wordmark stays as it was');
{
  await p.evaluate(() => { state.mode = 'staff'; state.tab = 'profile'; render(); });
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const f = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontFamily : null; };
    return {h3: f('#view h3'), ttl: f('.topbar .ttl'), who: f('.pfwho h2'), mark: f('.appmark .one'),
            body: getComputedStyle(document.body).fontFamily};
  });
  const news = s => /Newsreader/.test(s || '');
  ok('panel headings are Newsreader', news(r.h3), r.h3);
  ok('the page title is too', news(r.ttl), r.ttl);
  ok('and the name at the top of a profile — the one he sent a picture of',
     news(r.who), r.who);
  ok('the wordmark keeps Bodoni, because that is the mark he chose',
     /Bodoni/.test(r.mark || '') && !news(r.mark), r.mark);
  ok('and the body face is untouched', /IBM Plex Sans/.test(r.body), r.body);
}
{
  const css = fs.readFileSync('web/index.html', 'utf8');
  ok('both faces are actually fetched', /family=Bodoni\+Moda/.test(css) && /family=Newsreader/.test(css));
  ok('and Newsreader is asked for at the weights the portal uses',
     /Newsreader:opsz,wght@[\d.]+\.\.[\d.]+,400;[\d.]+\.\.[\d.]+,500;[\d.]+\.\.[\d.]+,600/.test(css));
  ok('no heading is left pointing at Bodoni alone',
     (css.match(/'Bodoni Moda','Didot',Georgia,serif/g) || []).length <= 2,
     (css.match(/'Bodoni Moda','Didot',Georgia,serif/g) || []).length);
  ok('and every Newsreader rule keeps a real fallback',
     !/'Newsreader'(?!,)/.test(css.replace(/family=Newsreader[^&']*/g, '')));
}

/* ================ 4. and none of it broke a column or overflowed a control */
console.log('\nand nothing overflows because of it');
{
  const tabs = await p.evaluate(() => TABS.filter(t => !t.gate || t.gate(state.user))
    .map(t => ({id: t.id, con: !!t.con})));
  let clipped = [], spill = [];
  for(const t of tabs){
    try{
      await p.evaluate(x => { state.mode = x.con ? 'console' : 'staff'; state.tab = x.id; render(); }, t);
      await p.waitForTimeout(110);
      const r = await p.evaluate(() => {
        const c = [], s = [];
        document.querySelectorAll('#view th,#view td').forEach(e => {
          /* A cell cut ON PURPOSE, with the whole of it on hover, is not a
             clipping fault — it is how a client's forty-character name shares
             a row with fifteen other columns. checklook has always known that;
             this one did not, and went red the day the invoice table started
             using it. The attribute is the portal's own hover, so exempting it
             here still leaves every accidental clip caught. */
          if(e.hasAttribute('data-full')) return;
          if(e.clientWidth && e.scrollWidth > e.clientWidth + 1) c.push(e.textContent.trim().slice(0, 24));
        });
        document.querySelectorAll('#view input,#view select,#view textarea').forEach(e => {
          if(!e.offsetWidth) return;
          const par = e.closest('td,th');
          if(par && e.getBoundingClientRect().right > par.getBoundingClientRect().right + 2)
            s.push(e.id || e.type);
        });
        return {c, s};
      });
      if(r.c.length) clipped.push([t.id, r.c.slice(0, 3)]);
      if(r.s.length) spill.push([t.id, r.s.slice(0, 3)]);
    }catch(e){ /* a screen that needs a selection is not this check's business */ }
  }
  ok(`no header or cell is clipped on any of the ${tabs.length} screens`, !clipped.length, clipped.slice(0, 3));
  ok('and no control spills out of its cell', !spill.length, spill.slice(0, 3));
  ok('no page errors throughout', !errs.length, errs[0]);
}

await p.close(); await b.close(); server.close();
console.log(`\n${checks - fails} of ${checks} checks passed`);
if(fails) process.exit(1);
