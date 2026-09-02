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

const TABLES = {
  companies:    'companies?select=*&order=sort',
  employees:    'employees?select=*',
  private:      'employee_private?select=*',
  roles:        'employee_roles?select=*',
  opening:      'leave_opening?select=*',
  requests:     'leave_requests?select=*',
  away:         'away_board?select=*',
  attendance:   'attendance?select=*',
  holidays:     'holidays?select=*&order=on_date',
  shifts:       'shifts?select=*&order=id',
  announcements:'announcements?select=*',
  settings:     'settings?select=key,value'
};

async function loadAll(){
  const out = {};
  await Promise.all(Object.entries(TABLES).map(async ([k, q]) => {
    const [table, params] = q.split('?');
    let sel = sb.from(table).select('*');
    if(/order=on_date/.test(params)) sel = sel.order('on_date');
    if(/order=sort/.test(params))    sel = sel.order('sort');
    if(/order=id/.test(params))      sel = sel.order('id');
    const {data, error} = await sel;
    if(error) throw new Error(`${table}: ${error.message}`);
    out[k] = data || [];
  }));
  return out;
}

let ME = null;          // my employees row
let DB  = null;         // the rows the app was built from

async function start(session){
  const {data: mine, error} = await sb.from('employees')
    .select('*').eq('auth_user_id', session.user.id).maybeSingle();
  if(error) throw error;

  if(!mine){
    // Signed in, but not on the staff list. The database is already giving
    // them nothing; this only explains why.
    await sb.auth.signOut();
    say('That address is not on the staff list. Ask Avin in Accounts to add you.', 'bad');
    busy(false);
    return;
  }
  ME = mine;

  DB = await loadAll();
  const DATA = buildData(DB, ME.id);
  DATA._session = {email: session.user.email, employeeId: ME.id};
  window.__DATA = DATA;
  window.__ME   = ME.full_name;
  window.__ROLES = DATA._roles[ME.full_name] || ['staff'];

  hide($('login'));
  show($('app'));

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
  SELF: new Set(['callMe','photo','quietBday','homeCountry']),
  COL:  {callMe:'call_me', photo:'photo_url', quietBday:'quiet_bday', homeCountry:'home_country',
         mobile:'mobile', pemail:'personal_email', uaeAddr:'uae_address',
         homeAddr:'home_address', homeContact:'home_contact', homePhone:'home_phone',
         ecName:'ec_name', ecRel:'ec_relation', ecPhone:'ec_phone', ecAlt:'ec_alt',
         gender:'gender', marital:'marital'},

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
    const {data} = await sb.auth.getSession();
    if(data.session) await start(data.session);
  };
}

// --------------------------------------------------------------- kick off

(async function(){
  wireLogin();

  if(!CFG.url || !CFG.key){
    show($('login'));
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
    show($('login')); hide($('signinBox')); show($('setBox'));
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
})();
