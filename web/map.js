/* Database rows in, the shape the app already expects out.
 *
 * The portal was written against a single DATA object. Rather than rewrite
 * every screen to speak SQL, this rebuilds that same object from live rows —
 * so the app is unchanged and this file is the only thing that knows the
 * database exists.
 *
 * Runs in the browser and in node, so the mapping can be tested against a real
 * database without a browser in the loop.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** 2024-08-01 -> "01 Aug 2024", which is how the app writes dates. */
export function longDate(iso){
  if(!iso) return '';
  const [y,m,d] = String(iso).slice(0,10).split('-');
  return `${d} ${MONTHS[+m-1]} ${y}`;
}

const TYPE   = {annual:'Annual', sick:'Sick', unpaid:'Unpaid', birthday:'Birthday',
                wfh:'WFH', offsite:'Off-site'};
const STATUS = {pending:'Pending', approved:'Approved', declined:'Declined',
                cancelled:'Cancelled', draft:'Draft'};

/**
 * @param {object} db  one array per table, exactly as the database returns them
 * @param {string} meId  the signed-in person's employee id
 */
export function buildData(db, meId){
  const emp   = db.employees || [];
  const byId  = new Map(emp.map(e => [e.id, e]));
  const name  = id => (byId.get(id) || {}).full_name || '';
  const set   = (obj, k, v) => { if(v !== null && v !== undefined && v !== '') obj[k] = v; };
  const S     = Object.fromEntries((db.settings || []).map(s => [s.key, s.value]));

  // ------------------------------------------------------------- companies
  const companies = {};
  (db.companies || []).forEach(c => {
    companies[c.key] = {
      key: c.key, code: c.code, name: c.name, legal: c.legal_name,
      addr: c.address || [],
      payDate: '', ready: true,
      // Pay and sales are not in this build at all — not hidden, absent.
      sales: false
    };
  });

  // ------------------------------------------------------------------ people
  const hr = {
    today: new Date().toISOString().slice(0,10),
    sample: false,
    week: S.working_week || 'Monday to Friday',
    hours: {grace: S.grace_minutes ?? 15},
    officeNet: S.office_network || 'not set',
    leavePolicy: S.leave_policy || {},
    titles:{}, managers:{}, orgCo:{}, orgDept:{}, emails:{}, birthdays:{},
    assign:{}, legalName:{}, profile:{}, balances:{}, left:{},
    noLeave:[], remote:[], noAttendance:[], quietBirthday:[],
    requests:[], attendance:[], announcements:[], holidays:[], shifts:[],
    sick: Object.assign({balance:{}}, S.sick_policy || {}),
    // Everything below belongs to modules that are not in this build. The keys
    // stay so the app finds an empty list rather than undefined.
    loans:[], advances:[], letters:[], exits:[], docs:{}, files:{}, eid:{},
    companyDocs:[], docTypes:[], letterTypes:[], uploadTypes:[], mail:{},
    partners:[], noGratuity:[], loanThreshold: 0, phones:{},
    orgTree:{}, revDept:{}, salesExtra:{}, salesSecond:{}
  };

  const active = emp.filter(e => e.active);

  emp.forEach(e => {
    const n = e.full_name;
    set(hr.titles, n, e.title);
    set(hr.orgCo, n, e.company);
    set(hr.orgDept, n, e.department);
    set(hr.emails, n, e.work_email);
    set(hr.assign, n, e.shift_id);
    set(hr.legalName, n, e.legal_name);
    if(e.manager_id) hr.managers[n] = name(e.manager_id);
    else if(e.active) hr.managers[n] = '';
    if(e.birthday) hr.birthdays[n] = {d: e.birthday, sample:false};
    if(e.last_day) hr.left[n] = e.last_day;
    if(e.no_leave)      hr.noLeave.push(n);
    if(e.works_remote)  hr.remote.push(n);
    if(e.no_attendance) hr.noAttendance.push(n);
    if(e.quiet_bday)    hr.quietBirthday.push(n);

    // The directory shows a colleague their country and photo, nothing more.
    // Anything private arrives only for the signed-in person, because the
    // database only sends it to them.
    hr.profile[n] = {
      homeCountry: e.home_country || '',
      photo: e.photo_url || null,
      quietBday: !!e.quiet_bday,
      callMe: e.call_me || ''
    };
  });

  (db.private || []).forEach(p => {
    const n = name(p.employee_id); if(!n) return;
    Object.assign(hr.profile[n] || (hr.profile[n] = {}), {
      mobile: p.mobile || '', pemail: p.personal_email || '',
      uaeAddr: p.uae_address || '', homeAddr: p.home_address || '',
      homeContact: p.home_contact || '', homePhone: p.home_phone || '',
      ecName: p.ec_name || '', ecRel: p.ec_relation || '',
      ecPhone: p.ec_phone || '', ecAlt: p.ec_alt || '',
      gender: p.gender || '', marital: p.marital || '',
      updated: p.updated_at ? String(p.updated_at).slice(0,10) : ''
    });
    if(p.emirates_id) hr.eid[n] = p.emirates_id;
    if(p.eid_expiry)  hr.docs[n] = {eid: String(p.eid_expiry).slice(0,10)};
  });

  // ------------------------------------------------------------------ leave
  (db.opening || []).forEach(o => {
    const n = name(o.employee_id), e = byId.get(o.employee_id); if(!n) return;
    hr.balances[n] = {
      carried: Number(o.carried) || 0,
      carriedSet: !!o.carried_set,
      doj: longDate(e && e.doj)
    };
    if(o.sick_used !== null && o.sick_used !== undefined)
      hr.sick.balance[n] = (hr.sick.fullDays ?? 15) - Number(o.sick_used);
  });
  // Someone with a joining date but no opening row still accrues from day one.
  active.forEach(e => {
    if(!hr.balances[e.full_name] && e.doj)
      hr.balances[e.full_name] = {carried: 0, carriedSet: false, doj: longDate(e.doj)};
  });

  hr.requests = (db.requests || []).map(r => ({
    id: r.ref || r.id,        // what a person sees and quotes
    uid: r.id,                // what the database is keyed on
    who: name(r.employee_id),
    type: TYPE[r.kind] || r.kind,
    status: STATUS[r.status] || r.status,
    from: String(r.from_date).slice(0,10),
    to:   String(r.to_date).slice(0,10),
    half: r.half === 'full' ? '' : r.half,
    days: r.days === null || r.days === undefined ? null : Number(r.days),
    calDays: null,
    reason: r.reason || '',
    cover: '',
    mgr: r.decided_by ? name(r.decided_by) : (hr.managers[name(r.employee_id)] || ''),
    sent: r.created_at ? String(r.created_at).slice(0,10) : '',
    decided: r.decided_at ? String(r.decided_at).slice(0,10) : ''
  })).filter(r => r.who);

  // The whole company can see that someone is away; only the person, their
  // manager and accounts get a row above, with the reason on it. Anything the
  // board knows about and the ledger does not is filled in here, reasonless.
  const seen = new Set(hr.requests.map(r => `${r.who}|${r.from}|${r.type}`));
  (db.away || []).forEach(a => {
    const who = name(a.employee_id); if(!who) return;
    const type = TYPE[a.kind] || 'Annual';
    const from = String(a.from_date).slice(0,10);
    if(seen.has(`${who}|${from}|${type}`)) return;
    if(hr.requests.some(r => r.who === who && r.from === from)) return;
    hr.requests.push({
      id:null, who, type, status: STATUS[a.status] || 'Approved',
      from, to: String(a.to_date).slice(0,10),
      half: a.half === 'full' ? '' : a.half,
      days:null, calDays:null, reason:'', cover:'', mgr:'', sent:'', decided:''
    });
  });

  // ------------------------------------------------------------- attendance
  const days = new Map();
  (db.attendance || []).forEach(a => {
    const who = name(a.employee_id); if(!who) return;
    const d = String(a.on_date).slice(0,10), k = `${who}|${d}`;
    if(!days.has(k)) days.set(k, {who, d, kind: a.kind || 'Office', segs: []});
    days.get(k).segs.push({
      in: (a.in_at || '').slice(0,5),
      out: (a.out_at || '').slice(0,5),
      loc: a.location || a.kind || 'Office',
      ok: true, note: a.note || ''
    });
  });
  // A day someone was on leave has no check-in, but the calendar should still
  // say why they were not there. Rather than store that twice, derive it from
  // the approved leave — then the two can never disagree.
  const holidayOn = new Set((db.holidays || []).map(h => String(h.on_date).slice(0,10)));
  const ABSENT = {Annual:1, Sick:1, Unpaid:1, Birthday:1};
  // A half day still has a working half, so it is not an absence on the board.
  // It shows as a half day either by naming the half or by carrying 0.5 days.
  const halfDay = r => !!r.half || (r.days > 0 && r.days < 1);
  hr.requests.filter(r => r.status === 'Approved' && ABSENT[r.type] && !halfDay(r)).forEach(r => {
    for(let d = new Date(r.from + 'T00:00:00'), end = new Date(r.to + 'T00:00:00');
        d <= end; d.setDate(d.getDate() + 1)){
      const iso = d.toISOString().slice(0,10);
      if(iso > hr.today) break;                            // the calendar is a record, not a forecast
      if(d.getDay() === 0 || d.getDay() === 6) continue;   // weekend
      if(holidayOn.has(iso)) continue;
      const k = `${r.who}|${iso}`;
      if(days.has(k)) continue;
      days.set(k, {who: r.who, d: iso, kind: r.type, segs: []});
    }
  });

  hr.attendance = [...days.values()].sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);

  // ----------------------------------------------------------- the calendar
  hr.holidays = (db.holidays || []).map(h => ({
    d: String(h.on_date).slice(0,10), n: h.name, fixed: !!h.fixed
  }));
  hr.shifts = (db.shifts || []).map(s => ({
    id: s.id, label: s.label, start: (s.starts||'').slice(0,5), end: (s.ends||'').slice(0,5)
  }));
  hr.announcements = (db.announcements || []).map(a => ({
    id: a.id, title: a.title, body: a.body,
    by: a.posted_by ? name(a.posted_by) : '',
    date: String(a.posted_at).slice(0,10),
    pinned: !!a.pinned
  })).sort((a,b) => (b.pinned - a.pinned) || (a.date < b.date ? 1 : -1));

  // ---------------------------------------------------------------- roles
  const roles = {};
  (db.roles || []).forEach(r => {
    const n = name(r.employee_id); if(!n) return;
    (roles[n] || (roles[n] = [])).push(r.role);
  });

  // ------------------------------------------------------------- payroll
  // Identity only. No salary, no allowance, no net — those are not in this
  // build. The app reads this row for the visa and paying entity, which is
  // what decides whose letterhead a document carries.
  const payroll = {
    month:'', monthKey:'', label:'', status:'', rows: emp.map(e => ({
      name: e.full_name, portalName: e.full_name, id: e.staff_no || '',
      company: (companies[e.company]||{}).code || '',
      visa:    (companies[e.visa_company]||{}).code || '',
      paidBy:  (companies[e.paid_by]||{}).code || '',
      chargedTo: (companies[e.company]||{}).code || '',
      dept: e.department || '', title: e.title || '',
      doj: longDate(e.doj), email: e.work_email || '', dummy: false
    })),
    companies: Object.keys(companies), channels: []
  };

  return {
    companies, hr, payroll,
    master: {parts:{}, people:{}, basicPct: null, payDate: ''},
    // sales and everything built on it is absent from this build
    engine:{}, inv:{}, invCols:[], monthly:{}, typeMonthly:{}, topClients:[],
    clients:{}, clientCount:0, bands:[], partners:[], managers:{}, target:0,
    totals:{inv:0,net:0,elig:0,outstanding:0,count:0}, statusMix:{}, years:[],
    quarters:[], department:'', dept:{}, deptOf:{}, tickets:{employees:[]},
    entities:[], atDept:null, gratuity:{policy:{},rows:[]},
    _me: meId ? name(meId) : '', _roles: roles
  };
}
