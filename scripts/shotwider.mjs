/* The build as it ships, on the screens part one changed.
 *
 *   node scripts/shotpart1.mjs
 *
 * Nothing here is a mock-up: the pages are the real app.js and index.html out
 * of web/, driven against the scratch database, so what is in the picture is
 * what is in the file being pushed.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildData} from '../web/map.js';

const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h','/tmp/pg','-p','5433','-U','postgres','-d','seedtest'];
const raw = (s,u) => execFileSync(PSQL, [...base,'-tAc',
  (u ? `set role authenticated; select set_config('request.jwt.claim.sub','${u}',false); ` : '') + s],
  {encoding:'utf8', maxBuffer:64e6});
const one = (s,u) => raw(s,u).trim().split('\n').pop();
const json = (s,u) => { const o = raw(s,u); const i = o.lastIndexOf('\n['); return JSON.parse(i<0?o.trim():o.slice(i+1).trim()); };

const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits', exit_lines:'exit_lines', spells:'service_spells',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads', sales_team:'sales_team_figures',
 payment_requests:'payment_requests', payment_files:'payment_files', sales_members:'sales_members'};

const TYPES = {'.html':'text/html','.js':'text/javascript','.json':'application/json',
               '.webmanifest':'application/manifest+json','.png':'image/png'};
const server = http.createServer((q,r) => {
  const f = path.join('web', decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'') || 'index.html');
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end('no'); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});
await new Promise(k => server.listen(0,'127.0.0.1',k));
const O = 'http://127.0.0.1:' + server.address().port;
const BUILD = (fs.readFileSync('web/index.html','utf8').match(/2026\d{6}/) || ['?'])[0];

const b = await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
fs.mkdirSync('shots', {recursive:true});

async function open(name, w = 1700, h = 1250){
  const U = json(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id,full_name from employees where full_name='${name}') t`)[0];
  const D = buildData({settings: json(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
    ...json(`select coalesce(json_agg(t),'[]') from (select ` +
      Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') + `) t`,
      U.auth_user_id)[0]}, U.id);
  const p = await b.newPage({viewport:{width:w, height:h}, deviceScaleFactor:2});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(O + '/index.html');
  await p.evaluate(([d,nm,r]) => { window.__DATA = d; window.__ME = nm; window.__ROLES = r;
    window.__db = new Proxy({}, {get: () => async () => true});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt = document.getElementById('boot'); if(bt) bt.remove(); },
    [D, U.full_name, D._roles[U.full_name] || ['staff']]);
  await p.addScriptTag({path:'web/app.js'});
  return {p, errs};
}

const shot = async (p, file, sel) => {
  const el = sel ? await p.$(sel) : null;
  await (el || p).screenshot({path:'shots/' + file, fullPage: !sel && !el});
  console.log('  ' + file);
};

console.log('build ' + BUILD + '\n');





/* Who sees what, in the build being pushed.
 *
 *   node scripts/shotwider.mjs
 */
{
  const {p, errs} = await open('Shohruh Karimov', 1700, 1250);
  await p.evaluate(() => { state.mode='staff'; state.tab='team'; render(); });
  await p.waitForTimeout(400);
  console.log('a consultant — Team performance stays, the other two are gone');
  await shot(p, 'w-consultant-rail.png', '.rail');
  await shot(p, 'w-consultant-team.png');
  if(errs.length) console.log('  !! ' + errs[0]);
  await p.close();
}
{
  const {p, errs} = await open('Avin Mascarenhas', 1700, 1250);
  await p.evaluate(() => { state.mode='staff'; state.tab='company'; render(); });
  await p.waitForTimeout(400);
  console.log('accounts — all three, unchanged');
  await shot(p, 'w-avin-rail.png', '.rail');
  if(errs.length) console.log('  !! ' + errs[0]);
  await p.close();
}
{
  const {p, errs} = await open('Rana Amine', 1700, 1700);
  await p.evaluate(() => { state.mode='staff'; state.tab='company'; render(); });
  await p.waitForTimeout(400);
  console.log('Rana — the Department screen she keeps');
  await shot(p, 'w-rana-rail.png', '.rail');
  await shot(p, 'w-rana-department.png');
  if(errs.length) console.log('  !! ' + errs[0]);
  await p.close();
}
await b.close(); server.close();
