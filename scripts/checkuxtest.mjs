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
const who='Avin Mascarenhas';
const p0=JSON.parse(execFileSync(PSQL,[...base,'-tAc',`select coalesce(json_agg(t),'[]') from (select id,auth_user_id from employees where full_name='${who}') t`],{encoding:'utf8'}))[0];
const db={settings, ...asUser(p0.auth_user_id,'select '+Object.entries(T).map(([k,t])=>`(select coalesce(json_agg(x),'[]') from ${t} x) as "${k}"`).join(', '))[0]};
const DATA=buildData(db,p0.id);
// pretend a passport is on file so the viewer has something to show
DATA.hr.files[who]={passport:{name:'passport.jpg',size:210000,at:'2026-09-02',path:'x',
  url:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect width="400" height="260" fill="#eee"/><text x="24" y="140" font-size="26">PASSPORT SCAN</text></svg>').toString('base64')}};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const page=await b.newPage({viewport:{width:1440,height:900}});
await page.route('**://fonts.*/**',r=>r.abort());
const saved=[];
await page.goto('file:///home/claude/one/web/index.html');
await page.evaluate(([d,n,r])=>{window.__DATA=d;window.__ME=n;window.__ROLES=r;
  window.__calls=[];
  window.__db=new Proxy({},{get:(t,k)=>(...a)=>{window.__calls.push([k,...a]);return Promise.resolve(true);}});
  document.getElementById('boot').classList.add('hidden');document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');},[DATA,who,DATA._roles[who]]);
await page.addScriptTag({path:'/home/claude/one/web/app.js'});
await page.waitForTimeout(300);

// 1. the address remembers the page
await page.evaluate(()=>{state.tab='profile';render();});
await page.waitForTimeout(200);
console.log('1 address after opening My profile:', await page.evaluate(()=>location.hash));
await page.evaluate(()=>{state.mode='console';state.tab='payroll';render();});
await page.waitForTimeout(200);
console.log('  address in the console:        ', await page.evaluate(()=>location.hash));

// 2. a redraw keeps your place
await page.evaluate(()=>{state.mode='staff';state.tab='profile';render();});
await page.waitForTimeout(200);
await page.evaluate(()=>window.scrollTo(0,700));
await page.waitForTimeout(100);
const y1=await page.evaluate(()=>window.scrollY);
await page.evaluate(()=>render());
await page.waitForTimeout(200);
const y2=await page.evaluate(()=>window.scrollY);
console.log(`2 scroll kept across a redraw:    ${y1} → ${y2} ${y1===y2?'(kept)':'(JUMPED)'}`);

// 3. an expiry date saves
await page.evaluate(()=>{const el=document.querySelector('[data-docexp]'); el.value='2028-04-01';
  el.dispatchEvent(new Event('change',{bubbles:true}));});
await page.waitForTimeout(200);
console.log('3 expiry date sent to the server: ', JSON.stringify(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='saveDocDate'))));

// 4. the document opens in place
await page.evaluate(()=>{state.tab='profile';render();});
await page.waitForTimeout(200);
const has=await page.evaluate(()=>!!document.querySelector('[data-look]'));
if(has){ await page.click('[data-look]'); await page.waitForTimeout(300);
  console.log('4 viewer opened in the page:      ', await page.evaluate(()=>({
    open:!document.getElementById('lookWrap').classList.contains('hidden'),
    title:document.querySelector('.look header b')?.textContent,
    kind:document.querySelector('.lookbody img')?'image':document.querySelector('.lookbody iframe')?'pdf':'none'})));
  await page.screenshot({path:'/home/claude/one/viewer.png'});
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  console.log('  closes on Escape:              ', await page.evaluate(()=>document.getElementById('lookWrap').classList.contains('hidden')));
} else console.log('4 no View button found');
await b.close();
