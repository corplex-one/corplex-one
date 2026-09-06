import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const {chromium}=pw;
import {execFileSync} from 'node:child_process';
import {buildData} from '/home/claude/one/web/map.js';
const PSQL='/usr/lib/postgresql/16/bin/psql', base=['-h','/tmp/pg','-p','5433','-U','postgres','-d','seedtest'];
const asUser=(uid,sql)=>{const o=execFileSync(PSQL,[...base,'-tAc',
 `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select coalesce(json_agg(t),'[]') from (${sql}) t`],
 {encoding:'utf8',maxBuffer:64e6}); const i=o.lastIndexOf('\n['); return JSON.parse(i<0?o.trim():o.slice(i+1).trim());};
const T={companies:'companies',employees:'staff_directory',private:'employee_private',roles:'employee_roles',
 opening:'leave_opening',requests:'leave_requests',away:'away_board',attendance:'attendance', attendance_public:'attendance_public',attendance_where:'attendance_where',regularizations:'regularizations',holidays:'holidays',
 shifts:'shifts',announcements:'announcements',salary_parts:'salary_parts',payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs',payroll_lines:'payroll_lines',salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows',gratuity_basic:'gratuity_basic',loans:'loans',letters:'letters',
 employee_files:'employee_files',company_docs:'company_docs',exits:'exits',tickets:'ticket_entitlements',ticket_history:'ticket_history', ticket_rates:'ticket_rates',
 sales_invoices:'sales_invoices',sales_commission:'sales_commission',sales_company:'sales_company', sales_company_mine:'sales_company_mine',sales_bands:'sales_bands'};
const settings=JSON.parse(execFileSync(PSQL,[...base,'-tAc',`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`],{encoding:'utf8'}));
const who='Avin Mascarenhas';
const p0=JSON.parse(execFileSync(PSQL,[...base,'-tAc',`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${who}') t`],{encoding:'utf8'}))[0];
const db={settings, ...asUser(p0.auth_user_id,'select '+Object.entries(T).map(([k,t])=>`(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', '))[0]};
console.log('rows the database gave Avin: payroll_lines', db.payroll_lines.length,
  '| payroll_runs', db.payroll_runs.length, '| salary_parts', db.salary_parts.length,
  '| gratuity_rows', db.gratuity_rows.length, '| sales_invoices', db.sales_invoices.length);
const DATA=buildData(db,p0.id);
console.log('after mapping: payroll.rows', DATA.payroll.rows.length,
  '| with figures', DATA.payroll.rows.filter(r=>'net' in r).length,
  '| month', DATA.payroll.month, '| status', DATA.payroll.status);
console.log('dept:',Object.keys(DATA.dept||{}).length,'engine:',Object.keys(DATA.engine||{}).length,'deptOf:',JSON.stringify(DATA.deptOf),'department:',DATA.department,'bands:',DATA.bands.length,'inv keys:',Object.keys(DATA.inv).length);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const page=await b.newPage({viewport:{width:1600,height:1100}});
await page.route('**://fonts.*/**',r=>r.abort());
await page.goto('file:///home/claude/one/web/index.html');
await page.evaluate(([d,n,r])=>{window.__DATA=d;window.__ME=n;window.__ROLES=r;window.__db=new Proxy({},{get:()=>()=>{}});
  document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');},[DATA,who,DATA._roles[who]]);
await page.addScriptTag({path:'/home/claude/one/web/app.js'});
// Every console screen, in its section. A leaf that comes up empty looks
// exactly like a permission being enforced, which is why each one names the
// least it should hold. Zero means 'this can legitimately be empty'.
const EXPECT={
  // Pay
  payroll:30, payslips:25, revisions:1, tickets:20, gratuity:30, exits:0,
  // People
  hradmin:20, office:0, regular:0, shifts:20, holidays:5, leaverules:0, leavebal:20,
  // Sales
  salesup:0, salestpl:0, salesrules:4, salesstaff:20, salesptr:0,
  // Staff
  addstaff:0, probation:0, digest:1,
  // Documents
  docsadmin:1, docdates:1, profiles:1};
const STAFF={home:0, dashboard:4, commission:4, invoices:10, team:5, leaderboard:5,
  company:5, tools:0, profile:0, attend:3, people:10, requests:1, loans:2, myslip:0, myticket:1};
const thin=[];
for(const [mode, list] of [['console', EXPECT], ['staff', STAFF]])
for(const tab of Object.keys(list)){
  const EXPECT = list;
  await page.evaluate(([m,t])=>{state.mode=m;state.tab=t;render();},[mode,tab]);
  await page.waitForTimeout(250);
  const m=await page.evaluate(()=>({rows:document.querySelectorAll('#view tbody tr').length,
    chars:document.getElementById('view').innerText.replace(/\s+/g,' ').length,
    head:document.getElementById('view').innerText.replace(/\s+/g,' ').slice(0,150)}));
  const empty = await page.evaluate(() => (document.getElementById('view').innerText.match(/Nothing matches the filters|nothing to show here/gi)||[]).length);
  const ok = (m.rows >= EXPECT[tab] || m.chars >= 700) && !empty;
  if(!ok) thin.push(`${mode}/${tab}: ${m.rows} rows (expected at least ${EXPECT[tab]})${empty?', and says nothing matches':''}`);
  console.log(`  ${ok?'ok  ':'THIN'} ${(mode+'/'+tab).padEnd(20)} ${String(m.rows).padStart(3)} table rows, ${m.chars} chars`);
  if(tab==='payroll'&&mode==='console') await page.screenshot({path:'/home/claude/one/live_payroll.png',fullPage:true});
}
// A database identifier on a screen a person reads is always a bug — the
// payslip printed the payroll line's uuid where CP008 belongs, because the
// mapper called it `id`.
{
  const page2 = await b.newPage({viewport:{width:1500,height:1100}});
  await page2.route('**://fonts.*/**', r => r.abort());
  await page2.goto('file:///home/claude/one/web/index.html');
  await page2.evaluate(([d,n,r])=>{window.__DATA=d;window.__ME=n;window.__ROLES=r;
    window.__db=new Proxy({},{get:()=>()=>{}});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt=document.getElementById('boot'); if(bt) bt.remove();},
    [DATA, who, DATA._roles[who]]);
  await page2.addScriptTag({path:'/home/claude/one/web/app.js'});
  const leaks = [];
  for(const [m,t] of [['console','payslips'],['console','payroll'],['console','hradmin'],
                      ['staff','myslip'],['staff','people']]){
    await page2.evaluate(([mm,tt])=>{state.mode=mm;state.tab=tt;render();},[m,t]);
    await page2.waitForTimeout(150);
    const txt = await page2.evaluate(()=>document.getElementById('view').innerText);
    if(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/.test(txt)) leaks.push(m+'/'+t);
  }
  console.log(leaks.length ? 'DATABASE IDS ON SCREEN: ' + leaks.join(', ')
                           : 'no database identifiers on any screen a person reads');
  await page2.close();
}
/* Every screen so far has been checked as Avin, who is accounts, is on the
 * sales roster and sees everything. That is the least representative person in
 * the building, and checking only him let a blank Home screen ship: a POA
 * consultant has no sales year in their data at all, and a guard written as
 * 'unless the year is held' replaced their home page with a notice about
 * uploading a workbook they have never heard of.
 *
 * So the same sweep runs again as somebody who sees almost nothing. What is
 * being asked is not 'is there a lot on this screen' — there should not be —
 * but 'is this the screen they were meant to get'. */
{
  const plain = 'Ahmed Talaat Mohamed';
  const p2 = JSON.parse(execFileSync(PSQL,[...base,'-tAc',
    `select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${plain}') t`],
    {encoding:'utf8'}))[0];
  const db2 = {settings, ...asUser(p2.auth_user_id,'select '+Object.entries(T)
    .map(([k,t])=>`(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', '))[0]};
  const D2 = buildData(db2, p2.id);
  console.log(`\nand again as ${plain}, who sees no sales at all ` +
              `(${Object.keys(D2.yearFigures||{}).length} sales year(s) in their data)`);

  const page3 = await b.newPage({viewport:{width:1500,height:1100}});
  await page3.route('**://fonts.*/**', r => r.abort());
  await page3.goto('file:///home/claude/one/web/index.html');
  await page3.evaluate(([d,n,r])=>{window.__DATA=d;window.__ME=n;window.__ROLES=r;
    window.__db=new Proxy({},{get:()=>()=>{}});
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const bt=document.getElementById('boot'); if(bt) bt.remove();},
    [D2, plain, D2._roles[plain] || ['staff']]);
  await page3.addScriptTag({path:'/home/claude/one/web/app.js'});

  // The notice about an unuploaded workbook belongs on sales screens and
  // nowhere else. Anywhere else it is a screen that has been taken away.
  const wrong = [];
  for(const tab of ['home','profile','attend','requests','people','myslip','myticket','loans','tools']){
    await page3.evaluate(t=>{state.mode='staff';state.tab=t;render();}, tab);
    await page3.waitForTimeout(150);
    const txt = await page3.evaluate(()=>document.getElementById('view').innerText.replace(/\s+/g,' '));
    if(/has not been uploaded yet/.test(txt)) wrong.push(`${tab}: sent to the sales-upload notice`);
    else if(txt.trim().length < 120) wrong.push(`${tab}: ${txt.trim().length} characters — effectively blank`);
    else console.log(`  ok   staff/${tab.padEnd(10)} ${txt.length} chars`);
  }
  if(wrong.length){
    console.log('SCREENS TAKEN AWAY FROM SOMEBODY WHO SHOULD HAVE THEM:');
    for(const w of wrong) console.log('  ' + w);
    thin.push(...wrong.map(w => 'plain staff / ' + w));
  }
  await page3.close();
}

await b.close();
console.log(thin.length ? '\nSCREENS WITH NOTHING ON THEM:\n'+thin.join('\n') : '\nevery console screen has content');
process.exit(thin.length ? 1 : 0);
