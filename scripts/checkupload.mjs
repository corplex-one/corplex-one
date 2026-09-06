/* The upload screen, driven the way Avin will drive it.
 *
 * Everything up to this point was proven in node: the reader against the
 * workbooks, the payload against the database. What was not proven is the bit
 * in between — a person choosing a file in a browser, the parser running
 * there, and the screen saying something true about what it found.
 *
 * So this opens the built site in Chromium, puts the real 2026 workbook into
 * the real file input, and reads back what the screen then says. The only
 * thing stubbed is the database call itself, which is captured and checked
 * rather than sent, because there is no Supabase here.
 *
 *   node scripts/checkupload.mjs
 *
 * It fails if the screen writes without being told to, if it does not name the
 * year it is about to replace, or if what it would send is not what the node
 * importer sends for the same file.
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readWorkbook, toPayload} from '../web/sales.js';
import {sheetsOf} from './importsales.mjs';
import {buildData} from '../web/map.js';

const {chromium} = pw;
const BOOK = 'sales/2026.xlsx';
if(!fs.existsSync(BOOK)){ console.log(`no ${BOOK} here — nothing to check`); process.exit(0); }

// what the node side makes of the same file, to compare against
const expected = toPayload(readWorkbook(sheetsOf(BOOK)));

/* The rows the database gives Avin, read as Avin. Same route checkscreens
 * takes, so what the screen renders here is what he sees. */
const PSQL = '/usr/lib/postgresql/16/bin/psql';
const base = ['-h', '/tmp/pg', '-p', '5433', '-U', 'postgres', '-d', 'seedtest'];
const T = {companies:'companies', employees:'staff_directory', private:'employee_private', roles:'employee_roles',
 opening:'leave_opening', requests:'leave_requests', away:'away_board', attendance:'attendance', attendance_public:'attendance_public',
 attendance_where:'attendance_where', regularizations:'regularizations', holidays:'holidays',
 shifts:'shifts', announcements:'announcements', salary_parts:'salary_parts', payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs', payroll_lines:'payroll_lines', salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows', gratuity_basic:'gratuity_basic', loans:'loans', letters:'letters',
 employee_files:'employee_files', company_docs:'company_docs', exits:'exits',
 tickets:'ticket_entitlements', ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices', sales_commission:'sales_commission', sales_company:'sales_company', sales_company_mine:'sales_company_mine',
 sales_bands:'sales_bands', sales_uploads:'sales_uploads'};
const one = sql => JSON.parse(execFileSync(PSQL, [...base, '-tAc', sql], {encoding:'utf8', maxBuffer:64e6}).trim());
const WHO = 'Avin Mascarenhas';
const p0 = one(`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${WHO}') t`)[0];
const asAvin = execFileSync(PSQL, [...base, '-tAc',
  `set role authenticated; select set_config('request.jwt.claim.sub','${p0.auth_user_id}',false); ` +
  `select coalesce(json_agg(t),'[]') from (select ` +
  Object.entries(T).map(([k,t]) => `(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', ') +
  `) t`], {encoding:'utf8', maxBuffer:64e6});
const db = {settings: one(`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`),
            ...JSON.parse(asAvin.slice(asAvin.lastIndexOf('\n[') + 1).trim())[0]};
const DATA = buildData(db, p0.id);
console.log(`the portal as Avin sees it: ${Object.keys(DATA.yearFigures||{}).join(', ') || 'no'} sales year(s), ` +
            `${(DATA.uploads||[]).length} recorded upload(s)`);

/* Served over http, not opened from disk: a module imported by a file:// page
 * is refused by the browser, and the page imports web/sales.js exactly as the
 * deployed one does. */
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

const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
const page = await b.newPage({viewport: {width: 1500, height: 1100}});
await page.route('**://fonts.*/**', r => r.abort());
page.on('pageerror', e => { console.error('page error: ' + e.message); process.exitCode = 1; });
await page.goto(ORIGIN + '/index.html');

/* The portal as the database actually hands it to Avin, so the screen is
 * rendered from real figures rather than from a shape I invented for a test. */
await page.evaluate(([d, me, roles]) => {
  window.__DATA = d; window.__ME = me; window.__ROLES = roles;
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  // boot.js is not running here, so its splash never gets taken down and
  // would swallow every click.
  const boot = document.getElementById('boot'); if(boot) boot.remove();
}, [DATA, WHO, DATA._roles[WHO]]);

// The real reader, loaded the way the page loads it, and a database that
// records what it was asked to do instead of doing it.
await page.addScriptTag({path: '/home/claude/one/node_modules/xlsx/dist/xlsx.full.min.js'});
await page.evaluate(async () => {
  const lib = await import('./sales.js');
  window.__sent = null;
  window.__db = {
    readSalesFile: async f => lib.readSalesWorkbook(window.XLSX, await f.arrayBuffer()),
    uploadSales: async (company, year, file, payload) => {
      window.__sent = {company, year, file, payload};
      return {company, year, rows: payload.invoices.length, invoiced: 4382784,
              net: 2265606, eligible: 1885017, voided: 7, unmatched: [],
              note: 'Every name on the workbook matched somebody on the staff list.'};
    }
  };
});

// app.js is a plain script and reads those globals when it starts
await page.addScriptTag({path: '/home/claude/one/web/app.js'});
await page.evaluate(() => { state.mode = 'console'; state.tab = 'salesup'; render(); });

const text = () => page.evaluate(() => document.getElementById('view').innerText.replace(/\s+/g, ' '));
const fails = [];
const must = (what, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}`); if(!cond) fails.push(what); };

// ---- 1. before a file is chosen
let t = await text();
must('the screen offers a file and promises nothing', /Choose file/.test(t));
must('it says the file stays on this machine', /not sent anywhere/.test(t));
/* Both departments, which is what the workbook counts. Reading only the
 * headline blob says 354 where the workbook says 499. */
const f26 = DATA.yearFigures['2026'];
const HELD = f26.totals.count + (f26.atDept ? f26.atDept.totals.count : 0);
must(`it shows what the portal already holds (${HELD} invoices)`,
     new RegExp('\\b' + HELD + '\\b').test(t));
must('nothing has been written', await page.evaluate(() => window.__sent) === null);
await page.screenshot({path: '/home/claude/one/up_start.png', fullPage: true});

// ---- 2. the real workbook goes in
await page.setInputFiles('#supFile', BOOK);
await page.waitForFunction(() => typeof state !== 'undefined' && (state.sup || state.supErr),
  null, {timeout: 60000});
const readErr = await page.evaluate(() => state.supErr);
if(readErr){ console.error('  FAIL the reader could not read the real workbook: ' + readErr); await b.close(); server.close(); process.exit(1); }
await page.waitForTimeout(200);
t = await text();

const read = await page.evaluate(() => ({
  year: state.sup.year, invoices: state.sup.invoices, rows: state.sup.payload.invoices.length,
  unmatched: state.sup.unmatched, voided: state.sup.voided,
  payload: state.sup.payload
}));

must('it worked the year out of the workbook itself', read.year === 2026);
must(`it read every invoice (${read.invoices})`, read.invoices === readWorkbook(sheetsOf(BOOK)).invoices.length);
must(`it built the same rows the importer builds (${read.rows})`,
     read.rows === expected.invoices.length);
must('what it would send matches the importer, byte for byte',
     JSON.stringify(read.payload) === JSON.stringify(expected));
must(`it counted the void invoices (${read.voided})`, read.voided === 7);
must('it says which names match nobody', /match/.test(t) && /staff list/i.test(t));
must('it warns that the year already loaded will be replaced whole',
     /already loaded/.test(t) && /replaces that year/.test(t));
must('the button names the year it will replace', /Replace 2026/.test(t));
must('it says plainly that nothing is written yet', /Nothing has been written yet/.test(t));
must('and nothing has been', await page.evaluate(() => window.__sent) === null);

await page.screenshot({path: '/home/claude/one/up_review.png', fullPage: true});

// ---- 3. cancelling really cancels
await page.click('#supCancel');
await page.waitForTimeout(150);
must('cancel puts the screen back and sends nothing',
     /Choose file/.test(await text()) && await page.evaluate(() => window.__sent) === null);

// ---- 4. and the button does what it says
await page.setInputFiles('#supFile', BOOK);
await page.waitForFunction(() => typeof state !== 'undefined' && state.sup, null, {timeout: 30000});
await page.click('#supGo');
await page.waitForFunction(() => window.__sent, null, {timeout: 20000});
await page.waitForTimeout(200);
const sent = await page.evaluate(() => ({company: window.__sent.company, year: window.__sent.year,
  file: window.__sent.file, rows: window.__sent.payload.invoices.length}));
must('it sent the right company and year', sent.company === 'corplex' && sent.year === 2026);
must('it named the file it came from', /2026/.test(sent.file));
must(`it sent every row (${sent.rows})`, sent.rows === expected.invoices.length);

t = await text();
must('and then says what the database made of it',
     /2026 replaced/.test(t) && new RegExp('\\b' + sent.rows + '\\b').test(t));
must('with a way back to upload another year', /Upload another year/.test(t));
await page.screenshot({path: '/home/claude/one/up_done.png', fullPage: true});

// ---- 5. a file that is not a sales workbook
const sentSoFar = await page.evaluate(() => JSON.stringify(window.__sent.payload).length);
await page.click('#supAgain');
await page.waitForTimeout(150);
await page.setInputFiles('#supFile', 'package.json');
await page.waitForFunction(() => typeof state !== 'undefined' && state.supErr, null, {timeout: 20000});
t = await text();
must('a file that is not a workbook is refused, in words', /could not be read/.test(t));
must('and it names the sheets it wanted', /Sales Data/.test(t) && /Commission Rules/.test(t));
must('and refusing it sent nothing',
     await page.evaluate(() => JSON.stringify(window.__sent.payload).length) === sentSoFar);

await b.close();
server.close();
console.log(fails.length
  ? `\n${fails.length} thing(s) the upload screen does not do`
  : `\nthe upload screen reads the real workbook and writes only when told to`);
process.exit(fails.length ? 1 : (process.exitCode || 0));
