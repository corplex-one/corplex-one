/* Sign in, load, hand over.
 *
 * Everything this file knows how to do, the database independently allows or
 * refuses. Nothing here is a security control — the rules in 0002_security.sql
 * are. This is the part that makes the app pleasant; that part makes it safe.
 */
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {buildData}    from './map.js';

const CFG = window.CORPLEX_ONE || {};
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
  sales_bands:      ['sales_bands']
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

  hide($('login'));
  show($('app'));
  settled();

  // app.js is loaded only once there is something for it to render
  if(!window.__appLoaded){
    window.__appLoaded = true;
    await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'app.js?v=' + (CFG.build || '1');
      s.onload = ok; s.onerror = () => fail(new Error('could not load the app'));
      document.body.appendChild(s);
    });
  } else if(typeof window.render === 'function'){
    window.render();
  }
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

  async checkIn(row){
    try{
      const {error} = await sb.from('attendance').insert({
        employee_id: ME.id, on_date: row.date, kind: row.kind,
        in_at: row.in, location: row.loc, note: row.note || null
      });
      if(error) throw error;
    }catch(e){ oops(e, 'Your check-in'); await reload(); }
  },

  async checkOut(row){
    try{
      const {error} = await sb.from('attendance')
        .update({out_at: row.out})
        .eq('employee_id', ME.id).eq('on_date', row.date).is('out_at', null);
      if(error) throw error;
    }catch(e){ oops(e, 'Your check-out'); await reload(); }
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

  async setRunStatus(monthKey, status, note){
    try{
      const patch = {status, note: note || null};
      if(status === 'approved') patch.approved_at = new Date().toISOString();
      if(status === 'closed')   patch.closed_at   = new Date().toISOString();
      const {error} = await sb.from('payroll_runs').update(patch).eq('month_key', monthKey);
      if(error) throw error;
    }catch(e){ oops(e, 'The payroll status'); await reload(); }
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
