/* Sign in, load, hand over.
 *
 * Everything this file knows how to do, the database independently allows or
 * refuses. Nothing here is a security control — the rules in 0002_security.sql
 * are. This is the part that makes the app pleasant; that part makes it safe.
 */
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CFG = window.CORPLEX_ONE || {};

// map.js was imported by a plain name while _headers tells the browser to keep
// it for a year — so once a browser had a copy it could never be given a new
// one, however many times the file was deployed. app.js carried a build number
// in its address and map.js did not, which is the worst of both: a new app
// asking an old mapper for fields it has never heard of. The address carries
// the build now, like everything else.
const BUILD = window.__BUILD || CFG.build || '1';
const {buildData} = await import('./map.js?v=' + BUILD);
const sb = createClient(CFG.url, CFG.key, {
  auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
});

const $  = id => document.getElementById(id);
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');
// the opening screen stays up until there is either a portal or a way in
const settled = () => hide($('boot'));

function say(msg, kind){
  const box = $('lgMsg'); if(!box) return;
  box.textContent = msg || '';
  box.className = 'lgmsg' + (msg ? ' ' + (kind || 'bad') : ' hidden');
}
function busy(on, label){
  const b = $('lgGo'); if(!b) return;
  b.disabled = on; b.textContent = on ? 'One moment…' : (label || 'Sign in');
}

// ------------------------------------------------------------------- load

// Every table the app draws from. What comes back is whatever the rules allow
// this person — for most of them, several of these arrive empty, which is the
// point. Keep this list in step with map.js: a table missing here is not a
// permission failure, it is a screen with nothing on it.
const TABLES = {
  companies:    ['companies', 'sort'],
  employees:    ['employees'],
  private:      ['employee_private'],
  roles:        ['employee_roles'],
  opening:      ['leave_opening'],
  requests:     ['leave_requests'],
  away:         ['away_board'],
  attendance:   ['attendance'],
  attendance_where: ['attendance_where'],
  regularizations:  ['regularizations'],
  holidays:     ['holidays', 'on_date'],
  shifts:       ['shifts', 'id'],
  announcements:['announcements'],
  settings:     ['settings'],
  salary_parts:     ['salary_parts'],
  payroll_identity: ['payroll_identity'],
  payroll_runs:     ['payroll_runs'],
  payroll_lines:    ['payroll_lines'],
  salary_revisions: ['salary_revisions'],
  gratuity_rows:    ['gratuity_rows'],
  gratuity_basic:   ['gratuity_basic'],
  loans:            ['loans'],
  letters:          ['letters'],
  employee_files:   ['employee_files'],
  document_dates:   ['document_dates'],
  company_docs:     ['company_docs'],
  exits:            ['exits'],
  tickets:          ['ticket_entitlements'],
  ticket_history:   ['ticket_history'],
  sales_invoices:   ['sales_invoices'],
  sales_commission: ['sales_commission'],
  sales_company:    ['sales_company'],
  sales_bands:      ['sales_bands'],
  sales_uploads:    ['sales_uploads']
};

// PostgREST caps a request at a thousand rows; the invoices alone are more
// than that, so read every table in pages until it stops giving.
async function readAll(table, order){
  const PAGE = 1000;
  let from = 0, out = [];
  for(;;){
    let sel = sb.from(table).select('*').range(from, from + PAGE - 1);
    if(order) sel = sel.order(order);
    const {data, error} = await sel;
    if(error) throw new Error(`${table}: ${error.message}`);
    out = out.concat(data || []);
    if(!data || data.length < PAGE) return out;
    from += PAGE;
  }
}

async function loadAll(){
  const out = {};
  await Promise.all(Object.entries(TABLES).map(async ([k, [table, order]]) => {
    out[k] = await readAll(table, order);
  }));
  return out;
}

let ME = null;          // my employees row
let DB  = null;         // the rows the app was built from

/* A document in a private bucket needs a signed link to be opened. One batch
   call covers everything the person is allowed to see, and the links last an
   hour, which is about as long as anyone stays on the page. */
async function signDocuments(DATA){
  const paths = [];
  Object.values(DATA.hr.files || {}).forEach(kinds =>
    Object.values(kinds || {}).forEach(f => { if(f.path) paths.push(f.path); }));
  if(!paths.length) return;
  const {data, error} = await sb.storage.from('documents').createSignedUrls(paths, 3600);
  if(!error && data){
    const byPath = Object.fromEntries(data.map(d => [d.path, d.signedUrl]));
    Object.values(DATA.hr.files || {}).forEach(kinds =>
      Object.values(kinds || {}).forEach(f => { if(f.path && byPath[f.path]) f.url = byPath[f.path]; }));
  }
}

/* Everyone's photograph, because the directory shows them all. */
async function signPhotos(DATA){
  const want = [];
  Object.values(DATA.hr.profile || {}).forEach(p => {
    if(p && p.photo && p.photo.path) want.push(p.photo.path);
  });
  if(!want.length) return;
  const {data, error} = await sb.storage.from('photos').createSignedUrls(want, 3600);
  if(error || !data) return;
  const byPath = Object.fromEntries(data.map(d => [d.path, d.signedUrl]));
  Object.values(DATA.hr.profile || {}).forEach(p => {
    if(p && p.photo && byPath[p.photo.path]) p.photo.url = byPath[p.photo.path];
  });
}

async function start(session){
  const {data: mine, error} = await sb.from('employees')
    .select('*').eq('auth_user_id', session.user.id).maybeSingle();
  if(error) throw error;

  if(!mine){
    // Signed in, but not on the staff list. The database is already giving
    // them nothing; this only explains why.
    await sb.auth.signOut();
    show($('login')); settled();
    say('That address is not on the staff list. Ask Avin in Accounts to add you.', 'bad');
    busy(false);
    return;
  }
  ME = mine;

  DB = await loadAll();
  const DATA = buildData(DB, ME.id);
  DATA._session = {email: session.user.email, employeeId: ME.id};
  await signDocuments(DATA);
  await signPhotos(DATA);
  window.__DATA = DATA;
  window.__ME   = ME.full_name;
  window.__ROLES = DATA._roles[ME.full_name] || ['staff'];

  // Only the server can say whether this is the office network — the browser
  // cannot see its own public address. Failing quietly is right: an unanswered
  // question must never keep somebody off the check-in screen.
  try{
    const {data} = await sb.rpc('where_am_i');
    window.__WHERE = data || null;
  }catch(e){ window.__WHERE = null; }

  hide($('login'));
  show($('app'));
  settled();

  // app.js is loaded only once there is something for it to render
  if(!window.__appLoaded){
    window.__appLoaded = true;
    await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'app.js?v=' + (window.__BUILD || CFG.build || '1');
      s.onload = ok; s.onerror = () => fail(new Error('could not load the app'));
      document.body.appendChild(s);
    });
  } else if(typeof window.render === 'function'){
    window.render();
  }
}

// ------------------------------------------------------- where the browser is
//
// The browser will tell us, if the person allows it and the device can work it
// out. On a phone that is a satellite fix and worth having; on a desktop it is
// guessed from nearby networks and can be a kilometre out, which is why the
// accuracy comes back with it and why nothing rests on this alone. Refusal is
// a perfectly good answer and costs nobody their check-in.
function hereIAm(){
  return new Promise(done => {
    if(!navigator.geolocation) return done({lat:null, lng:null, acc:null});
    let over = false;
    const stop = setTimeout(() => { over = true; done({lat:null, lng:null, acc:null}); }, 6000);
    navigator.geolocation.getCurrentPosition(
      p => { if(over) return; clearTimeout(stop);
             done({lat: p.coords.latitude, lng: p.coords.longitude,
                   acc: Math.round(p.coords.accuracy)}); },
      () => { if(over) return; clearTimeout(stop); done({lat:null, lng:null, acc:null}); },
      {enableHighAccuracy: true, timeout: 5500, maximumAge: 60000});
  });
}

// ------------------------------------------------------------- write path
// The app changes what is on screen straight away and calls one of these.
// If the database refuses, the screen is put back the way it was.

const oops = (e, what) => {
  console.error(what, e);
  const t = document.createElement('div');
  t.className = 'toast bad';
  t.textContent = `${what} did not save. ${e.message || ''}`.trim();
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 6000);
};

const reload = async () => {
  DB = await loadAll();
  const d = buildData(DB, ME.id);
  Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
  if(typeof window.render === 'function') window.render();
};

const KIND = {Annual:'annual', Sick:'sick', Unpaid:'unpaid', Birthday:'birthday',
              WFH:'wfh', 'Off-site':'offsite'};

/* One act of the payroll month.
 *
 * Every one of these can be refused — accounts approving its own work, a
 * closed month being reopened, a submission with nobody on it — and a refusal
 * is not an error to hide. It is the control doing its job, so it is shown,
 * and then the data is reloaded either way so the screen goes back to
 * describing what is actually true rather than what was attempted. */
async function runStep(fn, args, what){
  try{
    const {data, error} = await sb.rpc(fn, args);
    if(error) throw error;
    await reload();
    return data;
  }catch(e){ oops(e, what); await reload(); return null; }
}

window.__db = {
  ready: () => !!ME,

  async newRequest(r){
    try{
      const {data, error} = await sb.from('leave_requests').insert({
        employee_id: ME.id,
        kind: KIND[r.type] || 'annual',
        from_date: r.from, to_date: r.to,
        half: r.half === 'am' ? 'first' : r.half === 'pm' ? 'second' : (r.half || 'full'),
        days: r.days, reason: r.reason
      }).select('id,ref').single();
      if(error) throw error;
      r.uid = data.id;                      // the key the database uses
      r.id  = data.ref || data.id;          // the reference the person sees
    }catch(e){ oops(e, 'Your request'); await reload(); }
  },

  async decide(id, status){
    try{
      const {error} = await sb.from('leave_requests')
        .update({status, decided_by: ME.id, decided_at: new Date().toISOString()})
        .eq('id', id);
      if(error) throw error;
    }catch(e){ oops(e, 'The decision'); await reload(); }
  },

  // The address is read by the database, not sent by us — a browser that could
  // name its own address could name the office's. Coordinates are asked for
  // here and offered as corroboration; the database decides what they are
  // worth. What comes back is what was actually recorded.
  async checkIn(row){
    try{
      const at = await hereIAm();
      const {data, error} = await sb.rpc('check_in', {
        p_loc: row.loc, p_lat: at.lat, p_lng: at.lng,
        p_accuracy: at.acc, p_note: row.note || null
      });
      if(error) throw error;
      return data;
    }catch(e){ oops(e, 'Your check-in'); await reload(); }
  },

  async checkOut(){
    try{
      const {data, error} = await sb.rpc('check_out');
      if(error) throw error;
      return data;
    }catch(e){ oops(e, 'Your check-out'); await reload(); }
  },

  async whereAmI(){
    try{
      const {data, error} = await sb.rpc('where_am_i');
      if(error) throw error;
      window.__WHERE = data;
      return data;
    }catch(e){ return window.__WHERE || null; }
  },

  async segmentNote(id, note){
    try{
      const {error} = await sb.rpc('set_segment_note', {p_id: id, p_note: note});
      if(error) throw error;
    }catch(e){ oops(e, 'The note'); }
  },

  // ------------------------------------------------------- regularization
  async fileRegularization(r){
    try{
      const {data, error} = await sb.from('regularizations').insert({
        employee_id: ME.id, on_date: r.date,
        want_in: r.in || null, want_out: r.out || null, reason: r.reason
      }).select().single();
      if(error) throw error;
      return data;
    }catch(e){ oops(e, 'Your request'); await reload(); }
  },

  async decideRegularization(id, approve, note){
    try{
      const {error} = await sb.rpc('decide_regularization',
        {p_id: id, p_approve: !!approve, p_note: note || null});
      if(error) throw error;
      await reload();
    }catch(e){ oops(e, 'The decision'); await reload(); }
  },

  async withdrawRegularization(id){
    try{
      const {error} = await sb.rpc('withdraw_regularization', {p_id: id});
      if(error) throw error;
      await reload();
    }catch(e){ oops(e, 'Withdrawing it'); await reload(); }
  },

  // --------------------------------------------------------- the office
  // Whoever presses this is sitting in the office, so what the server sees of
  // them is what the office is. No guessing at coordinates, and no ringing the
  // provider to ask what the address is this week.
  async setOfficeHere(radius){
    try{
      const at = await hereIAm();
      const {data, error} = await sb.rpc('set_office_here',
        {p_lat: at.lat, p_lng: at.lng, p_radius: radius || 150});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Setting the office'); }
  },

  async forgetOfficeIp(ip){
    try{
      const {error} = await sb.rpc('forget_office_ip', {p_ip: ip});
      if(error) throw error;
      await reload();
    }catch(e){ oops(e, 'Removing the address'); }
  },

  // The four fields anyone may change about themselves live on the staff row;
  // everything else personal lives in the private table. The database enforces
  // that split — this only routes to the right one.
  SELF: new Set(['callMe','photo','quietBday','homeCountry','birthday']),   // the staff row; the rest is private
  COL:  {callMe:'call_me', photo:'photo_url', quietBday:'quiet_bday', homeCountry:'home_country',
         birthday:'birthday',
         mobile:'mobile', pemail:'personal_email', uaeAddr:'uae_address',
         homeAddr:'home_address', homeContact:'home_contact', homePhone:'home_phone',
         ecName:'ec_name', ecRel:'ec_relation', ecPhone:'ec_phone', ecAlt:'ec_alt',
         gender:'gender', marital:'marital'},

  // Everything the person changed, in one go, when they press Save. The two
  // tables are split by who may read them, so a save may touch either or both.
  async saveProfileAll(changes){
    const mine = {}, priv = {};
    for(const [f, v] of Object.entries(changes || {})){
      const col = this.COL[f]; if(!col) continue;
      (this.SELF.has(f) ? mine : priv)[col] = v;
    }
    try{
      if(Object.keys(mine).length){
        const {error} = await sb.from('employees').update(mine).eq('id', ME.id);
        if(error) throw error;
      }
      if(Object.keys(priv).length){
        const {error} = await sb.from('employee_private')
          .upsert(Object.assign({employee_id: ME.id}, priv), {onConflict: 'employee_id'});
        if(error) throw error;
      }
      DB = await loadAll();
      const d = buildData(DB, ME.id);
      Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
      return true;
    }catch(e){ oops(e, 'Your profile'); return false; }
  },

  async saveProfile(field, value){
    const col = this.COL[field]; if(!col) return;
    try{
      const {error} = this.SELF.has(field)
        ? await sb.from('employees').update({[col]: value}).eq('id', ME.id)
        : await sb.from('employee_private')
            .upsert({employee_id: ME.id, [col]: value}, {onConflict: 'employee_id'});
      if(error) throw error;
    }catch(e){ oops(e, 'That change'); }
  },

  // ---- the accounts console -------------------------------------------

  // The month moves one act at a time, and each act is a function the database
  // can refuse. There is deliberately no general "set the status to X" any
  // more: that let the screen decide the transition, which is the same as
  // having no rule at all.
  async submitRun(monthKey){   return runStep('submit_run',   {p_month: monthKey}, 'Submitting the month'); },
  async unsubmitRun(monthKey){ return runStep('unsubmit_run', {p_month: monthKey}, 'Withdrawing it'); },
  async approveRun(monthKey){  return runStep('approve_run',  {p_month: monthKey}, 'Approving the month'); },
  async returnRun(monthKey, why){
    return runStep('return_run', {p_month: monthKey, p_why: why}, 'Sending it back'); },
  async payRun(monthKey, on){
    return runStep('pay_run', {p_month: monthKey, p_on: on || null}, 'Marking it paid'); },
  async closeRun(monthKey){    return runStep('close_run',    {p_month: monthKey}, 'Closing the month'); },

  // ------------------------------------------------------------- payroll
  // Preparing a month here rather than in a spreadsheet. The database builds
  // the lines and works out gross, deductions and net; this end only asks.
  async generateRun(monthKey, label){
    try{
      const {data, error} = await sb.rpc('generate_run',
        {p_month: monthKey, p_label: label || null});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Generating the month'); await reload(); }
  },

  // One figure on one line. The net comes back from the database rather than
  // being worked out on screen, so what is shown is what is stored.
  async setLine(id, field, value){
    try{
      const {data, error} = await sb.rpc('set_payroll_line',
        {p_line: id, p_field: field, p_value: Number(value) || 0});
      if(error) throw error;
      return data;
    }catch(e){ oops(e, 'That figure'); await reload(); }
  },

  // Writing a revision no longer moves anybody's salary. It writes a draft
  // letter and stops there; releaseRevision is the act that moves it.
  async issueRevision(r){
    try{
      const {data, error} = await sb.rpc('issue_revision', {
        p_emp: r.emp, p_basic: Number(r.basic) || 0, p_allow: Number(r.allow) || 0,
        p_from: r.from, p_reason: r.reason || null,
        p_company: r.company || '', p_kind: r.kind || 'revision',
        p_release: false});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'The revision letter'); await reload(); }
  },

  async releaseRevision(id){
    try{
      const {data, error} = await sb.rpc('release_revision', {p_rev: id});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Sending the letter'); await reload(); }
  },

  async withdrawRevision(id, why){
    try{
      const {data, error} = await sb.rpc('withdraw_revision',
        {p_rev: id, p_why: why || null});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Withdrawing the draft'); await reload(); }
  },

  // The leave policy is not a display value: every balance in the portal is
  // computed from it, so the database checks the figures rather than the form.
  /* A year of sales, replaced whole.
   *
   * The reading and the arithmetic happen in the page — web/sales.js, the same
   * file the importer runs in node — so what is sent here is already checked
   * figures rather than a spreadsheet to be trusted. The database replaces the
   * year inside one transaction and hands back what it made of it, including
   * every name that matched nobody. */
  /* Reading a workbook needs two things nobody else in the portal needs: the
   * SheetJS parser, which is a few hundred kilobytes, and web/sales.js, which
   * is the whole commission engine. Neither is loaded until somebody actually
   * chooses a file — the phone downloads the app and never touches either.
   *
   * Whatever comes back has been worked out here, in the page, by the same
   * code that reproduced both workbooks cell for cell. The file itself never
   * leaves the browser; only the figures do. */
  async readSalesFile(file){
    if(!window.__salesLib){
      if(!window.XLSX) await new Promise((ok, no) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = ok;
        s.onerror = () => no(new Error('The spreadsheet reader could not be downloaded. Check the connection and try again.'));
        document.head.appendChild(s);
      });
      window.__salesLib = await import('./sales.js?v=' + BUILD);
    }
    return window.__salesLib.readSalesWorkbook(window.XLSX, await file.arrayBuffer());
  },

  async uploadSales(company, year, fileName, payload){
    try{
      const {data, error} = await sb.rpc('replace_sales_year', {
        p_company: company, p_year: Number(year),
        p_file: fileName || null, p_payload: payload});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'The sales upload'); await reload(); return null; }
  },

  async setLeavePolicy(p){
    try{
      const {data, error} = await sb.rpc('set_leave_policy', {
        p_annual: Number(p.annual), p_accrual: Number(p.accrual),
        p_carry: Number(p.carry), p_expires: Number(p.expires),
        p_probation: p.probation === '' || p.probation == null ? null : Number(p.probation)});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'The leave policy'); await reload(); }
  },

  async setSickPolicy(p){
    try{
      const {data, error} = await sb.rpc('set_sick_policy', {
        p_full: Number(p.full), p_half: Number(p.half), p_unpaid: Number(p.unpaid)});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'The sick policy'); await reload(); }
  },

  async confirmEmployee(id, on){
    try{
      const {data, error} = await sb.rpc('confirm_employee',
        {p_emp: id, p_on: on || null});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Confirming them'); await reload(); }
  },

  async extendProbation(id, until, why){
    try{
      const {data, error} = await sb.rpc('extend_probation',
        {p_emp: id, p_until: until, p_why: why || null});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Extending probation'); await reload(); }
  },

  async correctJoining(p){
    try{
      const {data, error} = await sb.rpc('correct_joining', {
        p_emp: p.emp,
        p_doj: p.doj || null,
        p_basic: p.basic === '' || p.basic == null ? null : Number(p.basic),
        p_allowance: p.allow === '' || p.allow == null ? null : Number(p.allow),
        p_name: p.name || null, p_legal_name: p.legal || null,
        p_email: p.email || null, p_title: p.title || null,
        p_department: p.dept || null, p_company: p.company || null,
        p_visa_company: p.visa || null, p_paid_by: p.paidBy || null,
        p_shift: p.shift || null, p_manager: p.manager || null,
        p_country: p.country || null,
        p_ticket_rate: p.rate === '' || p.rate == null ? null : Number(p.rate)});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Correcting the joining'); await reload(); }
  },

  async addEmployee(p){
    try{
      const {data, error} = await sb.rpc('add_employee', {
        p_name: p.name, p_doj: p.doj, p_company: p.company,
        p_basis: p.basis || 'salaried',
        p_basic: Number(p.basic) || 0, p_allowance: Number(p.allow) || 0,
        p_email: p.email || null, p_title: p.title || null,
        p_department: p.dept || null, p_visa_company: p.visa || null,
        p_paid_by: p.paidBy || null, p_legal_name: p.legal || null,
        p_manager: p.manager || null, p_shift: p.shift || 'S2',
        p_country: p.country || null, p_ticket_rate: p.rate || null,
        // Left blank, the database picks the next in the series — which is the
        // only place that knows where the series has got to, leavers included.
        p_staff_no: p.staffNo || null});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Adding them'); await reload(); }
  },

  async newLoan(l){
    try{
      const {data, error} = await sb.from('loans').insert({
        employee_id: ME.id, amount: l.amount, months: l.months, monthly: l.monthly,
        why: l.why, plan: l.plan, start_month: l.start
      }).select('id,ref').single();
      if(error) throw error;
      l.id = data.ref || data.id;
    }catch(e){ oops(e, 'Your advance request'); await reload(); }
  },

  async decideLoan(ref, status){
    try{
      const {error} = await sb.from('loans')
        .update({status, decided_on: new Date().toISOString().slice(0,10)}).eq('ref', ref);
      if(error) throw error;
    }catch(e){ oops(e, 'The decision'); await reload(); }
  },

  async decideLetter(ref, status){
    try{
      const {error} = await sb.from('letters')
        .update({status, decided_on: new Date().toISOString().slice(0,10), issued_by: ME.id})
        .eq('ref', ref);
      if(error) throw error;
    }catch(e){ oops(e, 'The decision'); await reload(); }
  },

  async postAnnouncement(a){
    try{
      const {error} = await sb.from('announcements').insert({
        title: a.title, body: a.body, posted_by: ME.id, pinned: !!a.pinned
      });
      if(error) throw error;
    }catch(e){ oops(e, 'Your announcement'); await reload(); }
  },

  // ---- documents ------------------------------------------------------
  // The file goes to a private bucket under the person's own id; the row is
  // the record of it. Both, or neither — a row with no file behind it is how
  // this went wrong the first time.
  async uploadDoc(kind, file){
    const MAX = 6 * 1024 * 1024;
    if(file.size > MAX){
      oops(new Error('Keep it under about 5 MB.'), `${file.name}`);
      return null;
    }
    const ext  = (file.name.match(/\.[a-z0-9]+$/i) || ['.bin'])[0].toLowerCase();
    const path = `${ME.id}/${kind}${ext}`;
    try{
      const {error: upErr} = await sb.storage.from('documents')
        .upload(path, file, {upsert: true, contentType: file.type || undefined});
      if(upErr) throw upErr;

      // a replacement with a different extension leaves the old file behind
      const {data: had} = await sb.from('employee_files')
        .select('storage_path').eq('employee_id', ME.id).eq('kind', kind).maybeSingle();
      if(had && had.storage_path && had.storage_path !== path)
        await sb.storage.from('documents').remove([had.storage_path]);

      const {error} = await sb.from('employee_files').upsert({
        employee_id: ME.id, kind, file_name: file.name, size_bytes: file.size,
        mime_type: file.type || null, storage_path: path,
        uploaded_at: new Date().toISOString().slice(0,10)
      }, {onConflict: 'employee_id,kind'});
      if(error) throw error;

      DB = await loadAll();
      const d = buildData(DB, ME.id);
      Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
      await signDocuments(window.__DATA);
      return path;
    }catch(e){ oops(e, `${file.name}`); return null; }
  },

  async uploadPhoto(file){
    if(file.size > 3 * 1024 * 1024){
      oops(new Error('Keep it under about 3 MB.'), file.name); return null;
    }
    const ext  = (file.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
    const path = `${ME.id}/photo${ext}`;
    try{
      const {error: upErr} = await sb.storage.from('photos')
        .upload(path, file, {upsert: true, contentType: file.type || undefined});
      if(upErr) throw upErr;
      const {error} = await sb.from('employees').update({photo_url: path}).eq('id', ME.id);
      if(error) throw error;
      DB = await loadAll();
      const d = buildData(DB, ME.id);
      Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
      await signPhotos(window.__DATA);
      return path;
    }catch(e){ oops(e, file.name); return null; }
  },

  async saveDocDate(kind, value){
    try{
      const {error} = value
        ? await sb.from('document_dates').upsert(
            {employee_id: ME.id, kind, expires_on: value, updated_at: new Date().toISOString()},
            {onConflict: 'employee_id,kind'})
        : await sb.from('document_dates').delete().eq('employee_id', ME.id).eq('kind', kind);
      if(error) throw error;
    }catch(e){ oops(e, 'That expiry date'); await reload(); }
  },

  // accounts recording an expiry against somebody else
  async saveDocDateFor(who, kind, value){
    const id  = (DB.employees.find(e => e.full_name === who) || {}).id;
    if(!id) return;
    try{
      const {error} = value
        ? await sb.from('document_dates').upsert(
            {employee_id: id, kind, expires_on: value, updated_at: new Date().toISOString()},
            {onConflict: 'employee_id,kind'})
        : await sb.from('document_dates').delete().eq('employee_id', id).eq('kind', kind);
      if(error) throw error;
    }catch(e){ oops(e, 'That expiry date'); await reload(); }
  },

  async removePhoto(){
    try{
      const path = (window.__DATA.hr.profile[ME.full_name] || {}).photo;
      const {error} = await sb.from('employees').update({photo_url: null}).eq('id', ME.id);
      if(error) throw error;
      if(path && path.path) await sb.storage.from('photos').remove([path.path]);
      DB = await loadAll();
      const d = buildData(DB, ME.id);
      Object.keys(d).forEach(k => { window.__DATA[k] = d[k]; });
      return true;
    }catch(e){ oops(e, 'Removing your photograph'); return false; }
  },

  async signOut(){ await sb.auth.signOut(); location.reload(); }
};

// ------------------------------------------------------------------ signin

function wireLogin(){
  const form = $('loginForm');
  if(form) form.onsubmit = async ev => {
    ev.preventDefault();
    say('');
    const email = ($('lu').value || '').trim().toLowerCase();
    const pass  = $('lp').value || '';
    if(!email || !pass){ say('Both boxes, please.'); return; }
    busy(true);
    const {data, error} = await sb.auth.signInWithPassword({email, password: pass});
    if(error){
      busy(false);
      say(/invalid/i.test(error.message)
        ? 'That email and password do not match.'
        : error.message);
      return;
    }
    try{ await start(data.session); }
    catch(e){ busy(false); say(e.message || 'Something went wrong loading your portal.'); }
  };

  const forgot = $('lgForgot');
  if(forgot) forgot.onclick = async ev => {
    ev.preventDefault();
    const email = ($('lu').value || '').trim().toLowerCase();
    if(!email){ say('Put your work email in first, then press this.'); return; }
    const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin});
    say(error ? error.message
      : 'If that address is on the staff list, a reset link is on its way to it.',
      error ? 'bad' : 'good');
  };

  // Arriving from an invitation or a reset link: set a password, then in.
  const setForm = $('setForm');
  if(setForm) setForm.onsubmit = async ev => {
    ev.preventDefault();
    const a = $('np1').value || '', b = $('np2').value || '';
    if(a.length < 10){ say('Ten characters or more, please.'); return; }
    if(a !== b){ say('The two passwords are not the same.'); return; }
    const {error} = await sb.auth.updateUser({password: a});
    if(error){ say(error.message); return; }
    hide($('setForm')); show($('signinBox'));
    const {data} = await sb.auth.getSession();
    if(data.session) await start(data.session);
  };
}

// --------------------------------------------------------------- kick off

(async function(){
  wireLogin();

  if(!CFG.url || !CFG.key){
    show($('login')); settled();
    say('This copy is not connected to the database yet.', 'bad');
    return;
  }

  // A link from an invitation or a password reset lands here with a session
  // already in the URL; those people need to choose a password first.
  const hash = new URLSearchParams(location.hash.slice(1));
  const flow = hash.get('type');

  const {data: {session}} = await sb.auth.getSession();

  if(session && (flow === 'invite' || flow === 'recovery')){
    history.replaceState(null, '', location.pathname);
    show($('login')); settled(); hide($('signinBox')); show($('setForm'));
    say(flow === 'invite'
      ? 'Welcome. Choose a password and you are in.'
      : 'Choose a new password.', 'good');
    return;
  }

  if(session){
    try{ await start(session); return; }
    catch(e){ console.error(e); await sb.auth.signOut(); }
  }

  show($('login'));
  settled();
})();

/* Registering the service worker is what makes the portal installable — a
 * browser only offers "add to home screen" for a page that has one, together
 * with the manifest in index.html. The worker itself caches nothing on
 * purpose; the note at the top of sw.js says why.
 *
 * It is registered last and its failure is swallowed: a browser that refuses
 * it, or a context without one at all, should get the portal exactly as
 * before rather than a blank page. Nothing here is load-bearing. */
if('serviceWorker' in navigator && location.protocol === 'https:'){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker:', e));
  });
}
