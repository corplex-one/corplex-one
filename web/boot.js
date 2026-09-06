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

/* Signing out has to forget which page it was on.
 *
 *   'If someone logs out and log ins, default landing should be on home page
 *    and not the page where he left'                                  -- Avin
 *
 * Nothing was remembering it: the URL was. The fragment (#c/payroll) is written
 * by the app as you move about, and a reload keeps it, so it was still in the
 * address bar when the next person signed in — and readHash() put them there,
 * on somebody else's screen from somebody else's session. Dropping the fragment
 * on the way out leaves deep links alone, which is the point of readHash(): a
 * link somebody is GIVEN still opens where it points. */
const forgetPage = () => {
  if(location.hash) history.replaceState(null, '', location.pathname + location.search);
};

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
  /* The roster everybody reads. A view, not the table: the table now answers
     only accounts and yourself, because four of its columns — the visa company,
     who pays them, the payroll basis and the auth id — were reaching every
     browser and no screen draws them. Optional until 0025 has been run, so a
     deploy that lands first does not close the portal; the fallback below picks
     up the table in that case. */
  employees:    ['staff_directory', null, true],
  /* Whether somebody was at work that day and whether it was the office or
     home — no times, no location, no notes. The attendance table itself is now
     yours, your manager's and accounts'. Optional for the same reason. */
  attendance_public: ['attendance_public', null, true],
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
  exit_lines:       ['exit_lines'],
  tickets:          ['ticket_entitlements'],
  ticket_history:   ['ticket_history'],
  sales_invoices:   ['sales_invoices'],
  sales_commission: ['sales_commission'],
  /* A view, not a table: the eight figures the team screens draw, for the
     people in your own department, with no commission column in it to hide.
     Accounts and the owner read sales_commission itself and never need this. */
  // Optional: the portal opens without it, minus the two team screens. It is
  // created by migration 0044, which is run after this code is deployed.
  sales_team:       ['sales_team_figures', null, true],
  // optional until 0021 has been run: a missing table must not close the portal
  ticket_rates:     ['ticket_rates', 'country', true],
  sales_members:    ['sales_members', null, true],
  sales_company:    ['sales_company'],
  sales_bands:      ['sales_bands'],
  sales_uploads:    ['sales_uploads'],
  payment_requests: ['payment_requests'],
  payment_files:    ['payment_files']
};

// PostgREST caps a request at a thousand rows; the invoices alone are more
// than that, so read every table in pages until it stops giving.
//
// A table marked optional is one the app can do without. That matters at a
// deploy: the code goes up through Cloudflare in seconds and a migration is
// run by hand afterwards, so for the minutes in between the browser is asking
// for something that does not exist yet. Every read used to be required, and
// Promise.all means one rejection loses the lot — so a new table in this list
// would have taken the WHOLE PORTAL down for everybody until the migration was
// run. A screen that is missing is a nuisance; a portal that will not open is
// an outage, and the difference is one flag.
async function readAll(table, order, optional){
  const PAGE = 1000;
  let from = 0, out = [];
  for(;;){
    let sel = sb.from(table).select('*').range(from, from + PAGE - 1);
    if(order) sel = sel.order(order);
    const {data, error} = await sel;
    if(error){
      if(!optional) throw new Error(`${table}: ${error.message}`);
      // Said out loud rather than swallowed: the screens that need it will be
      // quietly absent, and this is the only place that knows why.
      console.warn(`${table} is not available (${error.message}) — the screens that read it will not appear`);
      return [];
    }
    out = out.concat(data || []);
    if(!data || data.length < PAGE) return out;
    from += PAGE;
  }
}

async function loadAll(){
  const out = {};
  await Promise.all(Object.entries(TABLES).map(async ([k, [table, order, optional]]) => {
    out[k] = await readAll(table, order, optional);
  }));
  /* Deployed before 0025 has been run, staff_directory does not exist yet and
     the roster comes back empty — which would be a portal with nobody in it.
     Fall back to the table, which is still open to everybody until the
     migration closes it. The build works either way, and the day the migration
     runs the fallback simply stops being used. */
  if(!out.employees.length) out.employees = await readAll('employees', null, true);
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

/* The documents attached to a payment request, for whoever may see them. */
async function signPayments(DATA){
  const paths = [];
  (DATA.payments || []).forEach(r => (r.files || []).forEach(f => { if(f.path) paths.push(f.path); }));
  if(!paths.length) return;
  const {data, error} = await sb.storage.from('payments').createSignedUrls(paths, 3600);
  if(error || !data) return;
  const byPath = Object.fromEntries(data.map(d => [d.path, d.signedUrl]));
  (DATA.payments || []).forEach(r => (r.files || []).forEach(f => {
    if(f.path && byPath[f.path]) f.url = byPath[f.path]; }));
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
    forgetPage();
    show($('login')); settled();
    say('That address is not on the staff list. Ask Avin in Accounts to add you.', 'bad');
    busy(false);
    return;
  }

  /* Somebody who has left.
   *
   * Until now nothing checked: the sign-in found a person by their login and
   * let them in, so "switching off access" meant deleting the account in
   * Supabase and was therefore something to remember on the right day.
   *
   * Initiating an exit marks the record inactive and writes the last working
   * day, and both are needed here. Inactive alone would lock somebody out the
   * moment accounts started the paperwork — often a fortnight before they
   * actually go — so the door closes the day AFTER their last day and not
   * before. Nothing is deleted; they simply cannot get in.
   */
  const today = new Date().toISOString().slice(0, 10);
  if(mine.active === false && mine.last_day && String(mine.last_day).slice(0, 10) < today){
    await sb.auth.signOut();
    forgetPage();
    show($('login')); settled();
    say('Your last working day has passed, so this account is closed. '
      + 'If you need a payslip or your settlement, email accounts@corplex.ae.', 'bad');
    busy(false);
    return;
  }

  ME = mine;

  DB = await loadAll();
  const DATA = buildData(DB, ME.id);
  DATA._session = {email: session.user.email, employeeId: ME.id};
  await signDocuments(DATA);
  await signPhotos(DATA);
  await signPayments(DATA);
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
  // A rebuild throws away the signed links with the rows they were on, so the
  // documents on a payment request would go from openable to not by the act of
  // approving it. Sign them again before anything is drawn.
  await signPayments(window.__DATA);
  if(typeof window.render === 'function') window.render();
};

/* Every kind of leave the portal offers, and the enum value it is stored as.
 *
 * This used to hold six of the ten and fall through to 'annual' for the rest,
 * so a request for Hajj leave was silently recorded as annual leave — the one
 * kind that comes off the balance, on a screen that had just said it would
 * not. 0036_leave_kinds adds the missing enum values; this maps them, and
 * anything not on the list now fails loudly rather than quietly becoming the
 * kind with money attached. */
const KIND = {Annual:'annual', Sick:'sick', Unpaid:'unpaid', Birthday:'birthday',
              WFH:'wfh', 'Off-site':'offsite', Bereavement:'bereavement',
              Maternity:'maternity', Paternity:'paternity', Hajj:'hajj',
              Umrah:'umrah', Study:'study'};

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
      /* No fallback. A kind this does not know is a bug in the pair of lists,
       * and the person finding out should be me here rather than somebody
       * three months from now wondering where their annual leave went. */
      if(!KIND[r.type]) throw new Error(
        r.type + ' is not a kind of leave the portal can store yet. Nothing has been sent.');
      const {data, error} = await sb.from('leave_requests').insert({
        employee_id: ME.id,
        kind: KIND[r.type],
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
         gender:'gender', marital:'marital',
         /* A blank one is the person's to fill. Changing one accounts has
            already recorded is refused by the database, not by this file. */
         eid:'emirates_id', passport:'passport_no', visa:'visa_no', labour:'labour_no'},

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

  /* Who is on payroll, and how. The database refuses 'salaried' for somebody
   * with nothing on file and refuses 'off' while a month that pays them is
   * still open, so there is nothing to check here — only to ask. */
  async setPayrollBasis(map){
    const jobs = [];
    for(const [who, v] of Object.entries(map)){
      const id = this.empId(who);
      if(!id){ oops(new Error(who + ' is not in the staff list'), 'Who is on payroll'); return null; }
      jobs.push(() => sb.rpc('set_payroll_basis', {p_emp: id, p_basis: v, p_paid_by: null})
        .then(r => ({error: r.error})));
    }
    return this.saveAll('Who is on payroll', jobs);
  },

  /* An OPENING salary, for somebody who has none. The database refuses to
   * overwrite one that exists — that is a revision letter's job. */
  async recordSalary(r){
    try{
      const {data, error} = await sb.rpc('record_salary', {
        p_emp: r.emp, p_company: r.company || '',
        p_basic: Number(r.basic) || 0, p_allowance: Number(r.allow) || 0,
        p_from: r.from});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'Recording the salary'); await reload(); return null; }
  },

  /* Taking a figure off somebody who is not paid from it. The database
   * refuses this for anybody who IS paid from their salary rows, so there is
   * nothing to check here. The revision letter that set the figure is left
   * alone on purpose: it went out, and the person has a copy. */
  async clearSalary(who, company){
    const id = this.empId(who);
    if(!id){ oops(new Error(who + ' is not in the staff list'), 'That figure'); return null; }
    try{
      const {error} = await sb.rpc('clear_salary', {p_emp: id, p_company: company || ''});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Taking that figure off'); await reload(); return null; }
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
        // A remote or commission joiner never gets an entitlement created, so
        // there is nothing to take away from them afterwards.
        p_works_remote: p.remote === 'remote' || p.remote === true,
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

  /* Public holidays. Accounts has been allowed to write these since
   * 0002_security — admin_holidays, for all, guarded by is_admin() — and the
   * screen only ever displayed them. The date is the primary key, so moving
   * a holiday is a delete and an insert rather than an update, which is also
   * the honest description of what moving one is. */
  async addHoliday(h){
    try{
      const {error} = await sb.from('holidays')
        .insert({on_date: h.on_date, name: h.name, fixed: !!h.fixed});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'That holiday'); await reload(); return null; }
  },

  async editHoliday(was, h){
    try{
      if(was !== h.on_date){
        const {error: e1} = await sb.from('holidays').delete().eq('on_date', was);
        if(e1) throw e1;
        const {error: e2} = await sb.from('holidays')
          .insert({on_date: h.on_date, name: h.name, fixed: !!h.fixed});
        if(e2) throw e2;
      } else {
        const {error} = await sb.from('holidays')
          .update({name: h.name, fixed: !!h.fixed}).eq('on_date', was);
        if(error) throw error;
      }
      await reload();
      return true;
    }catch(e){ oops(e, 'That holiday'); await reload(); return null; }
  },

  async removeHoliday(on_date){
    try{
      const {error} = await sb.from('holidays').delete().eq('on_date', on_date);
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'That holiday'); await reload(); return null; }
  },

  /* Taking back your own request while it is still waiting. The database has
   * allowed this since 0013_own_updates — cancel_own_loan and
   * cancel_own_letter, which permit exactly this move and no other — and the
   * screen simply never offered it. Status only: a cancellation is not a
   * decision, so nothing is stamped with who decided or who issued it. */
  async cancelLoan(ref){
    try{
      const {error} = await sb.from('loans').update({status: 'Cancelled'}).eq('ref', ref);
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Taking the request back'); await reload(); return null; }
  },

  async cancelLetter(ref){
    try{
      const {error} = await sb.from('letters').update({status: 'Cancelled'}).eq('ref', ref);
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Taking the request back'); await reload(); return null; }
  },

  async postAnnouncement(a){
    try{
      const {error} = await sb.from('announcements').insert({
        title: a.title, body: a.body, posted_by: ME.id, pinned: !!a.pinned
      });
      if(error) throw error;
    }catch(e){ oops(e, 'Your announcement'); await reload(); }
  },

  // ---- payment requests -------------------------------------------------
  //
  // Documents and the row are written together, and in that order: the file
  // goes to the bucket under the request's own id, then the row that says it
  // exists. A row with no file behind it is how the documents screen went
  // wrong the first time, and this does not repeat it — a failed upload leaves
  // no row, and the request simply has one fewer document.

  /* Returns the request, or {error} with the database's own words in it.
   *
   * It used to return null and leave a toast to explain, which is the wrong
   * shape for a form: the toast lasted six seconds, the reload redrew the form
   * empty, and what the person saw was their typing disappear and nothing
   * happen. An error on a form belongs on the form, and stays there. */
  async raisePayment(f, files){
    try{
      /* Every parameter, including the one that has a default. PostgREST finds
       * a function by the exact set of names in the body; passing a subset and
       * relying on a default is legal but is one more thing that has to line
       * up, and this is the only call in the app that was doing it. */
      const {data, error} = await sb.rpc('raise_payment_request', {
        p_payee: f.payee, p_purpose: f.purpose, p_amount: Number(f.amount),
        p_mode: f.mode, p_order: f.order || null, p_client: f.client || null,
        p_extra: f.extra || null, p_company: 'corplex',
        p_currency: f.ccy || 'AED'});
      if(error) throw error;
      if(!data || !data.id) throw new Error('The database accepted it but said nothing back.');
      const bad = [];
      for(const file of (files || []).slice(0, 5)){
        const ok = await this.attachPayment(data.id, file, true);
        if(!ok) bad.push(file.name);
      }
      await reload();
      return {...data, notAttached: bad};
    }catch(e){
      /* Everything the database or PostgREST said, kept together. The code is
       * the most diagnostic single token there is — PGRST202 means the API has
       * not seen the function yet, 42883 means it is genuinely not there, and
       * P0001 is the function itself refusing on purpose — and it was being
       * thrown away in favour of the sentence. */
      console.error('raise_payment_request', e);
      const bits = [e && e.message, e && e.details, e && e.hint].filter(Boolean);
      return {error: bits.join(' — ') || String(e), code: (e && e.code) || ''};
    }
  },

  /* Attaching, on its own or as part of raising. `quiet` is for the second
   * case: the request itself was made, so a failed attachment is reported
   * beside it rather than as its own alarm. */
  async attachPayment(requestId, file, quiet){
    const MAX = 10 * 1024 * 1024;
    try{
      if(file.size > MAX) throw new Error('Keep each document under 10 MB.');
      // The name is kept, but made safe to put in a path, and made unique so
      // two invoices called invoice.pdf do not overwrite one another.
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-60);
      const path = `${requestId}/${Date.now()}-${safe}`;
      const {error: upErr} = await sb.storage.from('payments')
        .upload(path, file, {upsert: false, contentType: file.type || undefined});
      if(upErr) throw upErr;
      const {error} = await sb.rpc('attach_payment_file', {
        p_id: requestId, p_name: file.name, p_path: path,
        p_mime: file.type || null, p_bytes: file.size});
      if(error){
        // no row, so no orphaned object either
        await sb.storage.from('payments').remove([path]);
        throw error;
      }
      if(!quiet) await reload();
      return true;
    }catch(e){ if(!quiet) oops(e, file && file.name); return false; }
  },

  async detachPayment(fileId){
    try{
      const {data, error} = await sb.rpc('detach_payment_file', {p_file: fileId});
      if(error) throw error;
      if(data) await sb.storage.from('payments').remove([data]);
      await reload();
      return true;
    }catch(e){ oops(e, 'That document'); await reload(); return false; }
  },

  /* Marking your own decisions read. Deliberately quiet: it is housekeeping,
   * not an action, and a failure here should never interrupt somebody who has
   * just come to look at their request. It returns how many it cleared so the
   * screen only redraws when something actually changed. */
  async seenPayments(){
    try{
      const {data, error} = await sb.rpc('mark_payments_seen');
      if(error) throw error;
      if(data) await reload();
      return data || 0;
    }catch(e){ return 0; }
  },

  /* Correcting one. Only what changed is sent; null means 'leave that alone',
   * except for the three that can legitimately be emptied — order number,
   * client and the note — where an empty string means 'make it empty'. */
  async editPayment(id, f){
    try{
      const {data, error} = await sb.rpc('edit_payment_request', {
        p_id: id,
        p_payee:    f.payee    === undefined ? null : f.payee,
        p_purpose:  f.purpose  === undefined ? null : f.purpose,
        p_amount:   f.amount   === undefined ? null : Number(f.amount),
        p_mode:     f.mode     === undefined ? null : f.mode,
        p_order:    f.order    === undefined ? null : f.order,
        p_client:   f.client   === undefined ? null : f.client,
        p_extra:    f.extra    === undefined ? null : f.extra,
        p_currency: f.ccy      === undefined ? null : f.ccy});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ return {error: (e && e.message) || String(e)}; }
  },

  async withdrawPayment(id){
    try{
      const {error} = await sb.rpc('withdraw_payment_request', {p_id: id});
      if(error) throw error;
      await reload(); return true;
    }catch(e){ oops(e, 'That request'); await reload(); return false; }
  },

  async decidePayment(id, approve, why){
    try{
      const {data, error} = await sb.rpc('decide_payment_request', {
        p_id: id, p_approve: !!approve, p_why: why || null});
      if(error) throw error;
      await reload(); return data;
    }catch(e){ oops(e, 'That decision'); await reload(); return null; }
  },

  /* One field of the reconciliation list, or several. Everything is optional
   * and undefined means 'leave that one alone' — these get set one at a time,
   * days apart, by somebody working down a column. */
  async reconcilePayment(id, p){
    try{
      const {data, error} = await sb.rpc('reconcile_payment', {
        p_id: id,
        p_status:  p.payStatus === undefined ? null : p.payStatus,
        p_account: p.account   === undefined ? null : p.account,
        p_books:   p.books     === undefined ? null : p.books,
        p_bigin:   p.bigin     === undefined ? null : p.bigin,
        p_receipt: p.receipt   === undefined ? null : p.receipt});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'That payment'); await reload(); return null; }
  },

  async settlePayment(id, payStatus, account, remark){
    try{
      const {data, error} = await sb.rpc('settle_payment_request', {
        p_id: id, p_status: payStatus, p_account: account, p_remark: remark || null});
      if(error) throw error;
      await reload(); return data;
    }catch(e){ oops(e, 'That payment'); await reload(); return null; }
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

  /* The shift, and who a person reports to.
   *
   * Both dropdowns on the Shifts screen have always changed the screen and
   * nothing else: the choice was written into the in-memory copy, the page
   * redrew as though it had taken, and the next reload put it back. Avin ran
   * 0037 to fill the blank reporting lines and said the name still would not
   * show — and it could not have, because nothing here was ever writing one.
   * A control that pretends to save is worse than no control, because you
   * stop checking.
   *
   * Accounts has been allowed to update any employee row since 0002_security
   * — admin_employees, for all, guarded by is_admin() — so this needs no new
   * permission. It needed a writer.
   */
  empId(name){ return (DB.employees.find(e => e.full_name === name) || {}).id || null; },

  async setShift(who, shiftId){
    const id = this.empId(who);
    if(!id){ oops(new Error(who + ' is not in the staff list'), 'That shift'); return null; }
    try{
      const {error} = await sb.from('employees').update({shift_id: shiftId || null}).eq('id', id);
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'That shift'); await reload(); return null; }
  },

  async setManager(who, manager){
    const id = this.empId(who);
    if(!id){ oops(new Error(who + ' is not in the staff list'), 'That reporting line'); return null; }
    const mgr = manager ? this.empId(manager) : null;
    if(manager && !mgr){
      oops(new Error(manager + ' is not in the staff list'), 'That reporting line'); return null;
    }
    if(mgr && mgr === id){
      oops(new Error('Nobody can report to themselves'), 'That reporting line'); return null;
    }
    /* A loop would give the organisation chart no top and no bottom, and the
     * database has no constraint that would stop one being made. Walking up
     * from the proposed manager costs one pass over a list of thirty. */
    let up = mgr, hops = 0;
    while(up && hops++ < 100){
      if(up === id){
        oops(new Error(manager + ' already reports to ' + who + ', directly or through somebody else'),
             'That reporting line');
        return null;
      }
      up = (DB.employees.find(e => e.id === up) || {}).manager_id || null;
    }
    try{
      const {error} = await sb.from('employees').update({manager_id: mgr}).eq('id', id);
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'That reporting line'); await reload(); return null; }
  },

  /* The exit settlement.
   *
   * Every one of these is an RPC rather than a write, because the stages have
   * an order and a table with an update policy cannot enforce one. The
   * database decides who may approve, what a freeze means, and whether a
   * month may close; this only asks. See 0038_exit_settlement.sql.
   */
  async saveExit(x){
    const id = this.empId(x.who);
    if(!id){ oops(new Error(x.who + ' is not in the staff list'), 'That settlement'); return null; }
    try{
      const {data, error} = await sb.rpc('exit_save', {
        p_exit: x.id || null, p_employee: id,
        p_last_day: x.lastDay, p_settled: x.settled || x.lastDay,
        p_reason: x.reason || null, p_notes: x.notes || null,
        p_lines: x.lines || []});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'That settlement'); await reload(); return null; }
  },

  /* The figures are worked out on screen from the same data the screen shows,
     and handed over to be written down as they stand. The database does not
     recompute them — that is what freezing means. */
  async initiateExit(exitId, c){
    try{
      const frozen = {
        period: c.period, paidDays: c.paidDays, lop: c.lop,
        salary: c.salary, basic: c.basic, dayBasic: c.dayBasic,
        mBasic: c.mBasic, mAllow: c.mAllow, monthPay: c.monthPay,
        grat: c.grat, years: c.years, days: c.days, capped: !!c.capped,
        leaveDays: c.leaveDays, leaveCash: c.leaveCash,
        ticket: c.ticket, adv: c.adv,
        extra: (c.extra || []).map(l => ({label: l.label, amount: +l.amount || 0, deduct: !!l.deduct})),
        addOn: c.addOn, takeOff: c.takeOff, net: c.net,
        doj: c.doj, lwd: c.lwd, settleDate: c.settleDate
      };
      const {error} = await sb.rpc('exit_initiate',
        {p_exit: exitId, p_frozen: frozen, p_net: c.net});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Initiating the exit'); await reload(); return null; }
  },

  async approveExit(exitId){
    try{
      const {error} = await sb.rpc('exit_approve', {p_exit: exitId});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'That approval'); await reload(); return null; }
  },

  // undo by accounts and sent-back by an approver are the same move
  async sendExitBack(exitId, why){
    try{
      const {error} = await sb.rpc('exit_send_back', {p_exit: exitId, p_why: why || null});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Sending it back'); await reload(); return null; }
  },

  async withdrawExit(exitId){
    try{
      const {error} = await sb.rpc('exit_withdraw', {p_exit: exitId});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Withdrawing the settlement'); await reload(); return null; }
  },

  async decideExit(exitId, mode){
    try{
      const {error} = await sb.rpc('exit_decide', {p_exit: exitId, p_mode: mode});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'That decision'); await reload(); return null; }
  },

  async exitPaid(exitId, on){
    try{
      const {error} = await sb.rpc('exit_paid', {p_exit: exitId, p_on: on || null});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Marking it paid'); await reload(); return null; }
  },

  /* Saving a whole table at once, having been shown what will change.
   *
   * Avin: 'I am finding this risky... Imagine leave balance increased by a
   * wrong key press.' Every editable table in the console used to write on
   * the spot — focus a box, brush a key, and the number was in the database
   * before you had looked at it, with no moment in between when the change
   * existed only on screen and could be thrown away.
   *
   * These take the whole draft at once, so what is written is exactly the
   * list the person was shown and agreed to. Each returns true only if every
   * row went in; a failure part-way leaves the rest unwritten and reloads, so
   * the screen shows what the database actually holds rather than what was
   * hoped for.
   */
  async saveAll(what, jobs){
    try{
      for(const job of jobs){ const {error} = await job(); if(error) throw error; }
      await reload();
      return true;
    }catch(e){ oops(e, what); await reload(); return null; }
  },

  /* {country: '' | '2500'} — '' clears the rate, which leaves the country on
     the list unpriced. Each one goes through set_ticket_rate, which also
     carries everybody from that country with it; that is the whole point of
     the function existing rather than an upsert here. */
  /* Everything on one person's employment record, in one call. The database
     refuses what it should — a name that would strand a sign-in, somebody
     reporting to themselves — so this does not second-guess it. */
  async saveStaffRecord(r){
    try{
      const {data, error} = await sb.rpc('correct_joining', {
        p_emp: r.emp,
        p_name: r.name ?? null, p_email: r.email ?? null, p_phone: r.phone ?? null,
        p_title: r.title ?? null, p_department: r.department ?? null,
        p_company: r.company ?? null, p_visa_company: r.visa ?? null,
        p_paid_by: r.paidBy ?? null, p_shift: r.shift ?? null,
        p_manager: r.manager ?? null, p_staff_no: r.staffNo ?? null,
        /* Null means leave it alone; only a real change is sent, so saving
           somebody's phone number cannot quietly move them off remote. The
           database starts or stops the air ticket to match. */
        p_works_remote: r.remote ?? null});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'The staff record'); await reload(); return null; }
  },

  async setSalesMember(emp, on, company, department){
    try{
      const {data, error} = await sb.rpc('set_sales_member',
        {p_emp: emp, p_on: !!on, p_company: company || null, p_department: department || null});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'The sales tick'); await reload(); return null; }
  },

  async saveTicketRates(map){
    try{
      for(const [country, v] of Object.entries(map)){
        const rate = String(v).trim() === '' ? null : Number(v) || 0;
        const {error} = await sb.rpc('set_ticket_rate', {p_country: country, p_rate: rate});
        if(error) throw error;
      }
      await reload();
      return true;
    }catch(e){ oops(e, 'The ticket rates'); await reload(); return null; }
  },

  async setTicketRate(country, rate){
    try{
      const {data, error} = await sb.rpc('set_ticket_rate',
        {p_country: country, p_rate: rate === null || rate === '' ? null : Number(rate) || 0});
      if(error) throw error;
      await reload();
      return data;
    }catch(e){ oops(e, 'The ticket rate'); await reload(); return null; }
  },

  async dropTicketRate(country){
    try{
      const {error} = await sb.rpc('delete_ticket_rate', {p_country: country});
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'Taking it off the list'); await reload(); return null; }
  },

  // {name: '' | '12.5'} — '' means nothing carried forward is recorded
  async setCarried(map, asAt){
    const day = asAt || '2026-08-31';
    const jobs = [];
    for(const [who, v] of Object.entries(map)){
      const id = this.empId(who);
      if(!id){ oops(new Error(who + ' is not in the staff list'), 'Carried-forward leave'); return null; }
      const set = String(v).trim() !== '';
      jobs.push(() => sb.from('leave_opening').upsert(
        {employee_id: id, as_at: day, carried: set ? Number(v) || 0 : 0, carried_set: set},
        {onConflict: 'employee_id'}));
    }
    return this.saveAll('Carried-forward leave', jobs);
  },

  /* The shift and the reporting line arrive together, because they are two
   * columns of one table. A key is 's|Name' or 'm|Name'. */
  async saveShiftLines(map){
    const jobs = [];
    for(const [k, v] of Object.entries(map)){
      const who = k.slice(2), id = this.empId(who);
      if(!id){ oops(new Error(who + ' is not in the staff list'), 'That table'); return null; }
      if(k[0] === 's'){
        jobs.push(() => sb.from('employees').update({shift_id: v || null}).eq('id', id));
      } else {
        const mgr = v ? this.empId(v) : null;
        if(v && !mgr){ oops(new Error(v + ' is not in the staff list'), 'That table'); return null; }
        if(mgr === id){ oops(new Error('Nobody can report to themselves'), 'That table'); return null; }
        let up = mgr, hops = 0;
        while(up && hops++ < 100){
          if(up === id){
            oops(new Error(v + ' already reports to ' + who + ', directly or through somebody else'), 'That table');
            return null;
          }
          up = (DB.employees.find(e => e.id === up) || {}).manager_id || null;
        }
        jobs.push(() => sb.from('employees').update({manager_id: mgr}).eq('id', id));
      }
    }
    return this.saveAll('That table', jobs);
  },

  /* Holidays. A key is 'd|<date>', 'n|<date>', 'k|<date>' or 'x|<date>' for a
   * removal. The date is the primary key, so changing one is a delete and an
   * insert — which is also the honest description of moving a holiday. */
  async saveHolidays(map, now){
    const by = {};
    for(const [k, v] of Object.entries(map)){
      const d = k.slice(2);
      (by[d] = by[d] || {})[k[0]] = v;
    }
    const jobs = [];
    for(const [d, ch] of Object.entries(by)){
      const was = (now || []).find(h => h.d === d);
      if(!was){ oops(new Error('That holiday is no longer there'), 'Public holidays'); return null; }
      if('x' in ch){ jobs.push(() => sb.from('holidays').delete().eq('on_date', d)); continue; }
      const to = {on_date: 'd' in ch ? ch.d : d,
                  name:    'n' in ch ? String(ch.n).trim() : was.n,
                  fixed:   'k' in ch ? ch.k === '1' : !!was.fixed};
      if(to.on_date !== d){
        jobs.push(() => sb.from('holidays').delete().eq('on_date', d));
        jobs.push(() => sb.from('holidays').insert(to));
      } else {
        jobs.push(() => sb.from('holidays').update({name: to.name, fixed: to.fixed}).eq('on_date', d));
      }
    }
    return this.saveAll('Public holidays', jobs);
  },

  // {'Name|kind': '2027-01-31' | ''}
  async saveDocDates(map){
    const jobs = [];
    for(const [k, v] of Object.entries(map)){
      const i = k.lastIndexOf('|'), who = k.slice(0, i), kind = k.slice(i + 1);
      const id = this.empId(who);
      if(!id){ oops(new Error(who + ' is not in the staff list'), 'Document dates'); return null; }
      jobs.push(() => v
        ? sb.from('document_dates').upsert(
            {employee_id: id, kind, expires_on: v, updated_at: new Date().toISOString()},
            {onConflict: 'employee_id,kind'})
        : sb.from('document_dates').delete().eq('employee_id', id).eq('kind', kind));
    }
    return this.saveAll('Document dates', jobs);
  },

  /* The date of birth. Held as text on the staff row — '16 Feb 1991' — and
   * sent that way, because that is what every reader of it already parses.
   * The trigger on employees refuses this for anybody but accounts, whatever
   * the screen offers, so there is no check to repeat here. */
  MONS3: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],

  async setBirthDates(map){
    const jobs = [];
    for(const [who, v] of Object.entries(map)){
      const id = this.empId(who);
      if(!id){ oops(new Error(who + ' is not in the staff list'), 'Dates of birth'); return null; }
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '').trim());
      if(v && !m){ oops(new Error('"' + v + '" is not a date'), 'Dates of birth'); return null; }
      const txt = m ? (+m[3]) + ' ' + this.MONS3[+m[2] - 1] + ' ' + m[1] : null;
      jobs.push(() => sb.from('employees').update({birthday: txt}).eq('id', id));
    }
    return this.saveAll('Dates of birth', jobs);
  },

  /* The four government reference numbers. They live on employee_private
   * beside the Emirates ID, under that table's rule — the person themselves,
   * and accounts — so the database refuses this for anybody else however the
   * screen was reached. One upsert per person rather than one per number:
   * changing somebody's passport and their labour card together is a single
   * row either way, and two upserts on one row race each other. */
  REFCOL: {eid: 'emirates_id', passport: 'passport_no', visa: 'visa_no', labour: 'labour_no'},

  async saveDocRefs(map){
    const byPerson = {};
    for(const [k, v] of Object.entries(map)){
      const i = k.lastIndexOf('|'), who = k.slice(0, i), kind = k.slice(i + 1);
      const col = this.REFCOL[kind];
      if(!col){ oops(new Error('There is no field for "' + kind + '"'), 'Document numbers'); return null; }
      const id = this.empId(who);
      if(!id){ oops(new Error(who + ' is not in the staff list'), 'Document numbers'); return null; }
      // A cleared box means "there is no number on file", not an empty string.
      (byPerson[id] || (byPerson[id] = {}))[col] = String(v || '').trim() || null;
    }
    const jobs = Object.entries(byPerson).map(([id, cols]) => () =>
      sb.from('employee_private').upsert(
        Object.assign({employee_id: id, updated_at: new Date().toISOString()}, cols),
        {onConflict: 'employee_id'}));
    return this.saveAll('Document numbers', jobs);
  },

  /* The payroll figures. Each one goes through set_payroll_line, which is
   * what recalculates the gross and the net in the database rather than here,
   * so the arithmetic is the same whether one figure moved or ten. */
  async savePayLines(map){
    try{
      for(const [k, v] of Object.entries(map)){
        const i = k.lastIndexOf('|'), line = k.slice(0, i), field = k.slice(i + 1);
        const {error} = await sb.rpc('set_payroll_line',
          {p_line: line, p_field: field, p_value: Number(v) || 0});
        if(error) throw error;
      }
      await reload();
      return true;
    }catch(e){ oops(e, 'Those figures'); await reload(); return null; }
  },

  /* Which department somebody is in.
   *
   * Avin, on the sales staff list: 'Not really completed. Tomorrow if someone
   * changes to sales, i cant see their report.' He is right that the list was
   * read-only, but the thing that needs to change is not a sales list — it is
   * the person's department. Who appears in the sales tables is worked out
   * from it, and so is the organisation chart and the People page, so moving
   * somebody by hand in one place and not the others would put the portal at
   * odds with itself.
   *
   * One column, therefore, and everything that reads it follows.
   */
  async setDepartment(who, department){
    const id = this.empId(who);
    if(!id){ oops(new Error(who + ' is not in the staff list'), 'That department'); return null; }
    try{
      const {error} = await sb.from('employees')
        .update({department: String(department || '').trim() || null}).eq('id', id);
      if(error) throw error;
      await reload();
      return true;
    }catch(e){ oops(e, 'That department'); await reload(); return null; }
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

  async signOut(){ await sb.auth.signOut();
    // replace, not reload: a reload keeps the fragment, and the fragment is the
    // page they were on. It also keeps sign-out out of the back button.
    location.replace(location.pathname + location.search); }
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
    catch(e){ console.error(e); await sb.auth.signOut(); forgetPage(); }
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
