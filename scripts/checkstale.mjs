import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const {chromium}=pw;
import {execFileSync} from 'node:child_process';
import {buildData} from '/home/claude/one/web/map.js';
const PSQL='/usr/lib/postgresql/16/bin/psql',b=['-h','/tmp/pg','-p','5433','-U','postgres','-d','seedtest','-tAc'];
const q=s=>JSON.parse(execFileSync(PSQL,[...b,`select coalesce(json_agg(t),'[]') from (${s}) t`],{encoding:'utf8',maxBuffer:64e6}));
const T={companies:'companies',employees:'staff_directory',private:'employee_private',roles:'employee_roles',opening:'leave_opening',requests:'leave_requests',away:'away_board',attendance:'attendance', attendance_public:'attendance_public',attendance_where:'attendance_where',regularizations:'regularizations',holidays:'holidays',shifts:'shifts',announcements:'announcements',settings:'settings',salary_parts:'salary_parts',payroll_identity:'payroll_identity',payroll_runs:'payroll_runs',payroll_lines:'payroll_lines',salary_revisions:'salary_revisions',gratuity_rows:'gratuity_rows',gratuity_basic:'gratuity_basic',loans:'loans',letters:'letters',employee_files:'employee_files',document_dates:'document_dates',company_docs:'company_docs',exits:'exits',tickets:'ticket_entitlements',ticket_history:'ticket_history', ticket_rates:'ticket_rates',sales_invoices:'sales_invoices',sales_commission:'sales_commission',sales_company:'sales_company', sales_company_mine:'sales_company_mine',sales_bands:'sales_bands'};
const db={}; for(const [k,t] of Object.entries(T)) db[k]= k==='settings'?q('select key,value from settings'):q('select * from '+t);
const me=db.employees.find(e=>e.full_name==='Avin Mascarenhas');
const DATA=buildData(db,me.id);
// pretend the browser is holding a mapper from before 0017: no office, no regular
delete DATA.hr.office; delete DATA.hr.regular;
delete DATA.hr.nudgeMin; delete DATA.hr.escalateMin;
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const page=await br.newPage({viewport:{width:1400,height:1000}});
await page.route('**://fonts.*/**',r=>r.abort());
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('file:///home/claude/one/web/index.html');
await page.evaluate(([d,n,r])=>{window.__DATA=d;window.__ME=n;window.__ROLES=r;window.__db=new Proxy({},{get:()=>()=>{}});
  document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');
  const bt=document.getElementById('boot'); if(bt) bt.remove();},[DATA,'Avin Mascarenhas',DATA._roles['Avin Mascarenhas']]);
await page.addScriptTag({path:'/home/claude/one/web/app.js'});
for(const tab of ['admin','regular','payroll','hradmin']){
  errs.length=0;
  await page.evaluate(t=>{state.mode='console';state.tab=t;render();},tab);
  await page.waitForTimeout(200);
  const n=await page.evaluate(()=>document.getElementById('view').innerText.replace(/\s+/g,' ').length);
  console.log(`stale mapper, console/${tab.padEnd(9)} ${String(n).padStart(5)} chars ${errs.length?'THREW: '+errs[0].slice(0,60):'ok'}`);
}
// and staff attendance
errs.length=0;
await page.evaluate(()=>{state.mode='staff';state.tab='attend';render();});
await page.waitForTimeout(200);
const n=await page.evaluate(()=>document.getElementById('view').innerText.replace(/\s+/g,' ').length);
console.log(`stale mapper, staff/attend      ${String(n).padStart(5)} chars ${errs.length?'THREW: '+errs[0].slice(0,60):'ok'}`);
await br.close();
