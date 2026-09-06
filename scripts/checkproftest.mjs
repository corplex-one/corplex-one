import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const {chromium}=pw;
import {execFileSync} from 'node:child_process';
import {buildData} from '/home/claude/one/web/map.js';
const PSQL='/usr/lib/postgresql/16/bin/psql', base=['-h','/tmp/pg','-p','5433','-U','postgres','-d','seedtest'];
const asUser=(uid,sql)=>{const o=execFileSync(PSQL,[...base,'-tAc',
 `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select coalesce(json_agg(t),'[]') from (${sql}) t`],
 {encoding:'utf8',maxBuffer:64e6}); const i=o.lastIndexOf('\n['); return JSON.parse(i<0?o.trim():o.slice(i+1).trim());};
const T={companies:'companies',employees:'staff_directory',private:'employee_private',roles:'employee_roles',
 opening:'leave_opening',requests:'leave_requests',away:'away_board',attendance:'attendance', attendance_public:'attendance_public',holidays:'holidays',
 shifts:'shifts',announcements:'announcements',salary_parts:'salary_parts',payroll_identity:'payroll_identity',
 payroll_runs:'payroll_runs',payroll_lines:'payroll_lines',salary_revisions:'salary_revisions',
 gratuity_rows:'gratuity_rows',gratuity_basic:'gratuity_basic',loans:'loans',letters:'letters',
 employee_files:'employee_files',document_dates:'document_dates',company_docs:'company_docs',exits:'exits',
 tickets:'ticket_entitlements',sales_invoices:'sales_invoices',sales_commission:'sales_commission',
 sales_company:'sales_company', sales_company_mine:'sales_company_mine',sales_bands:'sales_bands'};
const settings=JSON.parse(execFileSync(PSQL,[...base,'-tAc',`select coalesce(json_agg(t),'[]') from (select key,value from settings) t`],{encoding:'utf8'}));
const who='Ahmed Talaat Mohamed';
const p0=JSON.parse(execFileSync(PSQL,[...base,'-tAc',`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${who}') t`],{encoding:'utf8'}))[0];
const db={settings, ...asUser(p0.auth_user_id,'select '+Object.entries(T).map(([k,t])=>`(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', '))[0]};
const DATA=buildData(db,p0.id);
DATA.hr.profile[who].photo={path:'x/photo.jpg',name:'photo',url:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#5A4E63"/></svg>').toString('base64')};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const page=await b.newPage({viewport:{width:1440,height:1200}});
await page.route('**://fonts.*/**',r=>r.abort());
await page.goto('file:///home/claude/one/web/index.html');
await page.evaluate(([d,n,r])=>{window.__DATA=d;window.__ME=n;window.__ROLES=r;window.__calls=[];
  window.__db=new Proxy({},{get:(t,k)=>(...a)=>{window.__calls.push([k,...a]);return Promise.resolve(true);}});
  document.getElementById('boot').classList.add('hidden');document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');},[DATA,who,DATA._roles[who]]);
await page.addScriptTag({path:'/home/claude/one/web/app.js'});
await page.evaluate(()=>{state.tab='profile';render();});
await page.waitForTimeout(300);
console.log(await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('.frow')].map(r=>({cols:r.className.match(/c\d/)[0],
    fields:[...r.querySelectorAll('label')].map(l=>l.textContent.trim()).join(' | ')}));
  const panels=[...document.querySelectorAll('.pfgrid > .panel')].map(p=>({
    title:p.querySelector('h3').textContent, h:p.offsetHeight}));
  return {rows, panels,
    quietGone: !document.getElementById('pf_quiet'),
    bdayNoYear: !!document.getElementById('pf_bdayD') && !document.querySelector('#pf_bday'),
    removePhoto: !!document.getElementById('pfPhotoOff'),
    mobileLabel: [...document.querySelectorAll('label')].find(l=>/mobile/i.test(l.textContent))?.textContent.trim()};
}));
await page.click('#pfPhotoOff'); await page.waitForTimeout(200);
console.log('remove photo called:', await page.evaluate(()=>window.__calls.map(c=>c[0])));
await page.evaluate(()=>{state.upBusy=null;render();});
await page.waitForTimeout(200);
await page.locator('.pfhead').screenshot({path:'/home/claude/one/profhead.png'});
await page.screenshot({path:'/home/claude/one/profile.png', fullPage:true});
await b.close();
