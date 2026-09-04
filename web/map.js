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

/* The reverse of boot.js's KIND. Both lists have to hold every kind of leave
 * the portal offers: a gap here labels a stored request as its raw enum value
 * on screen, and a gap there stores it as the wrong kind entirely. */
const TYPE   = {annual:'Annual', sick:'Sick', unpaid:'Unpaid', birthday:'Birthday',
                wfh:'WFH', offsite:'Off-site', bereavement:'Bereavement',
                maternity:'Maternity', paternity:'Paternity', hajj:'Hajj',
                umrah:'Umrah', study:'Study'};
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
    // How long past your own shift before the app says something, and before
    // it says something to your manager.
    nudgeMin:    S.attend_grace_min    ?? 15,
    escalateMin: S.attend_escalate_min ?? 30,
    office: {ips: S.office_ips || [], geo: S.office_geo || {},
             set: !!((S.office_ips || []).length || (S.office_geo || {}).lat)},
    regular: {max: S.regular_max_month ?? 2, graceDays: S.regular_grace_days ?? 5,
              rows: [], mine: [], left: 0, from: ''},
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
    orgTree:{}, loanThreshold: 0,
    // The database's own identifier for each person, kept so the screens that
    // ACT on somebody — confirm them, correct their joining, send their letter
    // — have something to name them by that a rename cannot break. It is never
    // printed: checkscreens fails the build if a UUID reaches a screen.
    ids:{}, joined:{}, probation:{}, revisions:[],
    // the rules that decide who counts as sales. Empty here reads as "nobody
    // qualifies", which is why these must come from settings, not a placeholder.
    revDept:     S.rev_dept     || {},
    salesExtra:  S.sales_extra  || {},
    salesSecond: S.sales_second || {},
    partners:    S.partners     || [],
    noGratuity:  S.no_gratuity  || [],
    phones:{}
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
    set(hr.phones, n, e.work_phone);
    if(e.manager_id) hr.managers[n] = name(e.manager_id);
    else if(e.active) hr.managers[n] = '';
    hr.ids[n] = e.id;
    if(e.doj) hr.joined[n] = String(e.doj).slice(0,10);
    // Probation is six months from joining and changes no accrual — it is a
    // date somebody has to act on before it lapses, and nothing more.
    if(e.probation_until) hr.probation[n] = {
      until: String(e.probation_until).slice(0,10),
      confirmed: e.confirmed_on ? String(e.confirmed_on).slice(0,10) : ''
    };
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
      // a path into the photos bucket; the link is signed when the page loads
      photo: e.photo_url ? {path: e.photo_url, url: '', name: 'photo'} : null,
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
  });

  // when each document runs out — one table, every kind
  (db.document_dates || []).forEach(d => {
    const n = name(d.employee_id); if(!n || !d.expires_on) return;
    (hr.docs[n] || (hr.docs[n] = {}))[d.kind] = String(d.expires_on).slice(0,10);
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
  // Where a check-in came from arrives only for the people allowed to see it —
  // yourself, your reports and accounts. For everybody else the segment simply
  // has no evidence attached, which is the rule doing its job, not a gap.
  const whereOf = {};
  (db.attendance_where || []).forEach(w => { whereOf[w.attendance_id] = w; });
  (db.attendance || []).forEach(a => {
    const who = name(a.employee_id); if(!who) return;
    const d = String(a.on_date).slice(0,10), k = `${who}|${d}`;
    if(!days.has(k)) days.set(k, {who, d, kind: a.kind || 'Office', segs: []});
    const w = whereOf[a.id] || null;
    days.get(k).segs.push({
      id: a.id,
      in: (a.in_at || '').slice(0,5),
      out: (a.out_at || '').slice(0,5),
      loc: a.location || a.kind || 'Office',
      ok: !(w && w.flagged), note: a.note || '',
      fixed: !!a.regularized,
      where: w ? {ip: w.ip || '', ipOk: w.ip_ok, geoOk: w.geo_ok,
                  away: w.distance_m == null ? null : Math.round(+w.distance_m),
                  acc: w.accuracy_m == null ? null : Math.round(+w.accuracy_m),
                  flagged: !!w.flagged} : null
    });
  });
  // ------------------------------------------------------- regularization
  // A person sees their own; a manager sees their reports'; accounts sees all.
  // The list is simply whatever the database sent, so what shows on screen and
  // what a person may actually see cannot drift apart.
  {
    const cap = hr.regular.max, grace = hr.regular.graceDays;
    const today = new Date(hr.today + 'T00:00:00Z');
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    if(today.getUTCDate() <= grace) first.setUTCMonth(first.getUTCMonth() - 1);
    hr.regular.from = first.toISOString().slice(0,10);

    hr.regular.rows = (db.regularizations || []).map(r => ({
      id: r.ref || r.id, uid: r.id,
      who: name(r.employee_id),
      d: String(r.on_date).slice(0,10),
      in:  (r.want_in  || '').slice(0,5),
      out: (r.want_out || '').slice(0,5),
      reason: r.reason || '',
      status: r.status || 'Pending',
      by: r.decided_by ? name(r.decided_by) : '',
      note: r.decision_note || '',
      sent: r.created_at ? String(r.created_at).slice(0,10) : '',
      decided: r.decided_at ? String(r.decided_at).slice(0,10) : ''
    })).filter(r => r.who)
      .sort((a,b) => b.d.localeCompare(a.d) || b.sent.localeCompare(a.sent));

    const meName = meId ? name(meId) : '';
    hr.regular.mine = hr.regular.rows.filter(r => r.who === meName);
    // What is left this month, counted the way the database counts it: only
    // approved ones spend the allowance.
    const thisMonth = hr.today.slice(0,7);
    hr.regular.left = Math.max(0, cap - hr.regular.mine.filter(
      r => r.status === 'Approved' && r.d.slice(0,7) === thisMonth).length);
    // and per person per month, for the console
    hr.regular.used = {};
    hr.regular.rows.filter(r => r.status === 'Approved').forEach(r => {
      const k = r.who + '|' + r.d.slice(0,7);
      hr.regular.used[k] = (hr.regular.used[k] || 0) + 1;
    });
  }

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
    month:'', monthKey:'', label:'', status:'', runs: [], rows: emp.map(e => ({
      name: e.full_name, portalName: e.full_name, id: e.staff_no || '',
      company: (companies[e.company]||{}).code || '',
      visa:    (companies[e.visa_company]||{}).code || '',
      paidBy:  (companies[e.paid_by]||{}).code || '',
      chargedTo: (companies[e.company]||{}).code || '',
      dept: e.department || '', title: e.title || '',
      doj: longDate(e.doj), email: e.work_email || '', dummy: false
    })),
    // the register groups by code — CorpLex, POA, Lex — not by the key
    companies: Object.values(companies).map(c => c.code), channels: []
  };

  // ---------------------------------------------------- pay, if it is there
  // Everything below arrives only for people the database is willing to show
  // it to. A consultant's copy of this object simply has fewer rows in it.
  const co = k => (companies[k] || {}).code || '';
  const master = {parts:{}, people:{}, basicPct: S.basic_pct ?? 0.6, payDate: ''};

  (db.salary_parts || []).forEach(p => {
    const n = name(p.employee_id); if(!n) return;
    master.parts[n] = {salary:+p.salary, basic:+p.basic, allow:+p.allowance,
                       from: p.effective_from ? longDate(p.effective_from) : '',
                       src: p.source || ''};
  });
  (db.payroll_identity || []).forEach(p => {
    const e = byId.get(p.employee_id); if(!e || !e.staff_no) return;
    master.people[e.staff_no] = {mol: p.mol_number || '', acct4: p.account_last4 || ''};
  });

  // Every run, newest first, so September can sit beside August and be
  // compared with it. `payroll.rows` stays pointing at the newest, which is
  // what every screen written before this expects.
  const runs = (db.payroll_runs || []).slice().sort((a,b) =>
    a.month_key < b.month_key ? 1 : -1);
  const lineOf = l => ({
    // `id` is the staff number, because that is what every screen written
    // before this one means by it — a payslip that prints a database
    // identifier where CP008 should be is this field getting above itself.
    // The line's own identifier is lineId, and only the register uses it.
    id: l.staff_no || '', lineId: l.id,
    name: l.name, portalName: name(l.employee_id) || l.name,
    empId: l.employee_id || '', staffNo: l.staff_no || '',
    company: co(l.company), visa: l.visa || '',
    paidBy: co(l.paid_by), chargedTo: co(l.charged_to),
    dept: l.department || '', title: l.title || '', doj: longDate(l.doj),
    days: +l.days,
    // what check-in made of the month; null where there is nothing recorded
    daysAtt: l.days_attended === null || l.days_attended === undefined
             ? null : +l.days_attended,
    salary:+l.salary, claims:+l.claims, air:+l.air_ticket,
    inc:+l.incentive, comm:+l.commission, ref:+l.referral, other:+l.other_add,
    gross:+l.gross, adv:+l.advance, don:+l.donation, ins:+l.insurance,
    mob:+l.mobile, oth:+l.other_ded, ded:+l.deductions, net:+l.net,
    email: (byId.get(l.employee_id) || {}).work_email || '',
    note: l.note || '', dummy: l.non_staff, vat: !!l.vat
  });
  payroll.runs = runs.map(r => ({
    key: r.month_key, label: r.label, status: r.status, runId: r.id,
    payDate: r.pay_date ? longDate(r.pay_date) : '',
    preparedBy: name(r.prepared_by), approver: name(r.approver),
    // Why a month came back belongs to the month. The screen used to hold it
    // in a variable, which meant it survived exactly as long as the tab did.
    note: r.note || '',
    submittedBy: name(r.submitted_by), paidBy2: name(r.paid_by),
    rows: (db.payroll_lines || []).filter(l => l.run_id === r.id).map(lineOf)
  }));

  const run = runs[0];
  if(run){
    master.payDate = run.pay_date ? longDate(run.pay_date) : '';
    Object.assign(payroll, {
      month: run.label, monthKey: run.month_key, status: run.status,
      preparedBy: name(run.prepared_by), approver: name(run.approver),
      label: Object.fromEntries(Object.values(companies).map(c => [c.code, c.name])),
      channels: S.payroll_channels || [],
      vatOn: (db.payroll_lines || []).filter(l => l.vat).map(l => name(l.employee_id) || l.name)
    });
    const lines = (db.payroll_lines || []).filter(l => l.run_id === run.id);
    if(lines.length) payroll.rows = lines.map(l => ({
      lineId: l.id, vat: !!l.vat,
      name: l.name, portalName: name(l.employee_id) || l.name, id: l.staff_no || '',
      company: co(l.company), visa: l.visa || '',
      paidBy: co(l.paid_by), chargedTo: co(l.charged_to),
      dept: l.department || '', title: l.title || '', doj: longDate(l.doj),
      days: l.days, salary:+l.salary, claims:+l.claims, air:+l.air_ticket,
      inc:+l.incentive, comm:+l.commission, ref:+l.referral, other:+l.other_add,
      gross:+l.gross, adv:+l.advance, don:+l.donation, ins:+l.insurance,
      mob:+l.mobile, oth:+l.other_ded, ded:+l.deductions, net:+l.net,
      email: (byId.get(l.employee_id) || {}).work_email || '',
      note: l.note || '', dummy: l.non_staff
    }));
  }

  // -------------------------------------------------------------- gratuity
  const gratuity = {policy: S.gratuity_policy || {}, openingAt: '', rows: []};
  const gById = new Map();
  (db.gratuity_rows || []).forEach(r => {
    const row = {n: r.name, co: co(r.company), doj: String(r.doj).slice(0,10),
                 left: r.left_on ? String(r.left_on).slice(0,10) : '', paid:+r.paid,
                 paidOn: r.paid_on ? String(r.paid_on).slice(0,10) : '',
                 // the entity that carries the liability, which is not always
                 // the one the person works for
                 visa: r.visa_company || '', basic:{}};
    gById.set(r.id, row); gratuity.rows.push(row);
  });
  (db.gratuity_basic || []).forEach(c => {
    const row = gById.get(c.row_id); if(!row) return;
    row.basic[String(c.month_end).slice(0,10)] = +c.basic;
  });

  // ------------------------------------------------- advances and letters
  hr.loans = (db.loans || []).map(l => ({
    id: l.ref, who: name(l.employee_id), amount:+l.amount, months: l.months,
    monthly:+l.monthly, why: l.why || '', plan: l.plan || '', status: l.status,
    approver: name(l.approver), asked: l.asked_on ? String(l.asked_on).slice(0,10) : '',
    decided: l.decided_on ? String(l.decided_on).slice(0,10) : '',
    start: l.start_month || '', paid:+l.paid
  })).filter(l => l.who);

  const revByLetter = {};
  (db.salary_revisions || []).forEach(r => {
    if(r.letter_ref) revByLetter[r.letter_ref] = r;
  });

  // Revisions in their own right, because since a letter can now WAIT there is
  // a screen that lists the ones not yet sent. A draft has written nothing to
  // the salary on file, so this list is the only place it exists.
  hr.revisions = (db.salary_revisions || []).map(r => ({
    revId: r.id, ref: r.letter_ref || '', who: name(r.employee_id),
    company: r.company || '',
    eff: r.effective_from ? String(r.effective_from).slice(0,10) : '',
    status: r.status || 'issued',
    was: r.old_salary == null ? null : +r.old_salary,
    now: +r.new_salary, basic: +r.new_basic, allow: +r.new_allowance,
    why: r.reason || '',
    by: name(r.issued_by), at: r.issued_at ? String(r.issued_at).slice(0,10) : '',
    sentBy: name(r.released_by),
    sentAt: r.released_at ? String(r.released_at).slice(0,10) : ''
  })).filter(r => r.who)
    .sort((a,b) => (b.at || '').localeCompare(a.at || ''));
  hr.letters = (db.letters || []).map(l => Object.assign({
    id: l.ref, who: name(l.employee_id), type: l.kind, to: l.addressee || '',
    why: l.why || '', status: l.status,
    asked: l.asked_on ? String(l.asked_on).slice(0,10) : '',
    decided: l.decided_on ? String(l.decided_on).slice(0,10) : ''
  }, revByLetter[l.ref] ? {
    by: name(revByLetter[l.ref].issued_by),
    eff: String(revByLetter[l.ref].effective_from).slice(0,10),
    salary: +revByLetter[l.ref].new_salary,
    basic:  +revByLetter[l.ref].new_basic,
    allow:  +revByLetter[l.ref].new_allowance
  } : {})).filter(l => l.who);

  (db.employee_files || []).forEach(f => {
    const n = name(f.employee_id); if(!n) return;
    (hr.files[n] || (hr.files[n] = {}))[f.kind] = {
      name: f.file_name, size: Number(f.size_bytes),
      at: String(f.uploaded_at).slice(0,10),
      path: f.storage_path || '',   // the link is signed when the page loads
      url: ''
    };
  });

  hr.companyDocs = (db.company_docs || []).map(d => ({
    co: co(d.company), name: d.name,
    expiry: d.expiry ? String(d.expiry).slice(0,10) : ''
  }));

  hr.exits = (db.exits || []).map(x => ({
    who: name(x.employee_id), lastDay: String(x.last_day).slice(0,10),
    reason: x.reason || '', status: x.status, notes: x.notes || ''
  })).filter(x => x.who);

  hr.letterTypes   = S.letter_types   || [];
  hr.docTypes      = S.doc_types      || [];
  hr.uploadTypes   = S.upload_types   || [];
  hr.mail          = S.mail_settings  || {};
  hr.loanThreshold = S.loan_threshold ?? 0;

  // ----------------------------------------------------------- air tickets
  const tp = S.ticket_policy || {};
  const tickets = {
    asOf: tp.asOf || '', procMonth: tp.procMonth || '', policyNote: tp.note || '',
    rates: tp.rates || {}, ratesArePlaceholder: !!tp.placeholder,
    paid: [], due: [], upcoming: [], backlogLapses: [], lastRun: '',
    excluded: S.ticket_excluded || [],
    // what each person has already had, keyed by staff number the way the
    // screen reads it
    history: (() => {
      // Keyed by staff number, which is how the screens ask for it. A few
      // people have no staff number yet, so they are filed under their name
      // rather than dropped — the screen tries both.
      const byId = {}, out = {};
      emp.forEach(e => { byId[e.id] = e.staff_no || e.full_name; });
      // Everyone on the scheme gets an entry, even at nil — someone who has
      // never taken a ticket still needs the date theirs started counting.
      (db.tickets || []).forEach(t => {
        const sn = byId[t.employee_id]; if(!sn) return;
        out[sn] = {first: t.first_due ? longDate(t.first_due) : '',
                   _first: t.first_due ? String(t.first_due).slice(0,10) : '',
                   rows: [], cycles: 0, totalPaid: 0};
      });
      (db.ticket_history || []).forEach(h => {
        const sn = byId[h.employee_id]; if(!sn) return;
        (out[sn] || (out[sn] = {first:'', _first:'', rows:[], cycles:0, totalPaid:0}))
          .rows.push([h.cycle_year, h.paid_on ? longDate(h.paid_on) : '', +h.amount]);
      });
      const today = new Date();
      Object.values(out).forEach(h => {
        h.rows.sort((a,b) => a[0] - b[0]);
        // Cycles that have fallen due, not cycles taken — the gap between the
        // two is the backlog somebody is still owed.
        if(h._first){
          const d = new Date(h._first + 'T00:00:00Z');
          let n = 0;
          while(d <= today && n < 60){ n++; d.setUTCFullYear(d.getUTCFullYear() + 1); }
          h.cycles = n;
        }
        delete h._first;
        h.totalPaid = Math.round(h.rows.reduce((s,r) => s + r[2], 0) * 100) / 100;
      });
      return out;
    })(),
    employees: (db.tickets || []).map(t => {
      const e = byId.get(t.employee_id) || {};
      return {id: e.staff_no || '', name: e.full_name || '', portalName: e.full_name || '',
        country: t.country || '', doj: longDate(e.doj), dojS: e.doj ? String(e.doj).slice(0,10) : '',
        rate:+t.rate, lastPaid: t.last_paid ? longDate(t.last_paid) : '',
        next: t.next_due ? longDate(t.next_due) : '',
        nextS: t.next_due ? String(t.next_due).slice(0,10) : '',
        proc: t.proc_month || '', status: t.status || '',
        taken: t.taken, pending: t.pending, backlog:+t.backlog,
        lwd: t.last_working_day ? longDate(t.last_working_day) : '', note: t.note || ''};
    }).filter(t => t.name)
  };

  // ---------------------------------------------------------------- sales
  const sales = buildSales(db, byId, name, companies);

  return {
    companies, hr, payroll, master, gratuity, tickets, ...sales,
    entities: [],
    _me: meId ? name(meId) : '', _roles: roles
  };
}

/* The sales screens are drawn from three things: the invoices you are allowed
 * to see, your own commission, and the company-wide totals — each of which the
 * database hands over separately, or not at all. */
function buildSales(db, byId, name, companies){
  const out = {
    engine:{}, inv:{},
    invCols:['q','date','no','client','type','amt','exp','pc','net','elig','status',
             'bal','shared','cn','ontime','forfeit','pr','sp','pm','recd','sort','role'],
    monthly:{}, typeMonthly:{}, topClients:[], clients:{}, clientCount:0,
    statusMix:{}, totals:{inv:0,net:0,elig:0,outstanding:0,count:0},
    target:0, partners:[], managers:{}, bands:[], years:[], quarters:[],
    department:'', dept:{}, deptOf:{}, atDept:null
  };

  (db.sales_bands || []).sort((a,b) => a.band - b.band).forEach(b =>
    out.bands.push([b.band, +b.low, +b.high, +b.new_rate, +b.ex_rate, +b.pm_rate]));

  /* Keyed by year AND quarter. It used to be quarter alone, which was correct
   * for exactly as long as the portal held one year: the moment 2025 arrived,
   * its Q1 silently overwrote 2026's. */
  (db.sales_commission || []).forEach(c => {
    const n = name(c.employee_id); if(!n) return;
    const y = String(c.year);
    const per = out.engine[n] || (out.engine[n] = {});
    (per[y] || (per[y] = {}))[c.quarter] = c.figures;
    if(!out.years.includes(y)) out.years.push(y);
  });

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  (db.sales_invoices || []).forEach(r => {
    const who = name(r.filed_under) || name(r.consultant); if(!who) return;
    const d = r.inv_date ? String(r.inv_date).slice(0,10) : '';
    const nice = d ? `${d.slice(8,10)} ${MONTHS[+d.slice(5,7)-1]} ${d.slice(0,4)}` : '';
    (out.inv[who] || (out.inv[who] = [])).push([
      r.quarter, nice, r.inv_no, r.client, r.kind, +r.amount, +r.expense, +r.pass_cost,
      +r.net, +r.eligible, r.status, +r.balance, r.shared, +r.credit_note, r.on_time,
      +r.forfeit, r.pr_ref, name(r.consultant) || who, name(r.manager), +r.received, d, r.role
    ]);
    if(!out.years.includes(String(r.year))) out.years.push(String(r.year));
  });

  /* One row per company per year, and only for a company you may see.
   *
   * The totals, the monthly series, the client list and the rest are merged
   * straight onto the top level because that is how every sales screen reads
   * them — DATA.totals, DATA.monthly. With more than one year in the database
   * they are also kept per year, and the app swaps them when the year segment
   * changes, so the screens need not learn a new shape. */
  /* Where the figures came from — who uploaded which file, when, and what it
   * came to. A figure whose provenance is a mystery is a figure nobody can
   * check, and 'the sales look wrong' deserves a better answer than opening
   * the workbook and hoping. */
  out.uploads = (db.sales_uploads || []).map(u => ({
    year: u.year, file: u.file_name || '', rows: u.invoices,
    invoiced: +u.invoiced, net: +u.net, eligible: +u.eligible,
    unmatched: u.unmatched || [], voided: u.voided,
    by: name(u.uploaded_by), at: u.uploaded_at ? String(u.uploaded_at).slice(0,16).replace('T',' ') : ''
  })).sort((a,b) => (b.at || '').localeCompare(a.at || ''));

  /* ------------------------------------------------------- payment requests
   *
   * The screen was written against a hardcoded array with the field names
   * below, so the mapper speaks its language rather than the table's. Status
   * is capitalised here for the same reason: the pills read it directly.
   *
   * `self` is the one thing this adds that the mock never had — whether the
   * person who approved a request was the person who raised it. Avin asked for
   * that to be allowed; showing it is the other half of allowing it. */
  const STATUS = {pending:'Pending', approved:'Approved',
                  rejected:'Rejected', withdrawn:'Withdrawn'};
  const PAYSTAT = {paid:'Paid', unpaid:'Unpaid', initiated:'Initiated'};
  const filesOf = {};
  (db.payment_files || []).forEach(f => {
    (filesOf[f.request_id] || (filesOf[f.request_id] = [])).push({
      id: f.id, name: f.file_name, path: f.storage_path,
      mime: f.mime_type || '', bytes: +f.bytes || 0});
  });
  out.payments = (db.payment_requests || []).map(r => ({
    id: r.id, ref: r.ref,
    by: name(r.raised_by), byId: r.raised_by,
    date: r.raised_at ? longDate(String(r.raised_at).slice(0, 10)) : '',
    at: r.raised_at || '',
    order: r.order_no || '', client: r.client || '', payee: r.payee || '',
    purpose: r.purpose || '', amount: +r.amount || 0, mode: r.mode,
    ccy: r.currency || 'AED',
    editedBy: name(r.edited_by), edits: +r.edits || 0,
    note: r.extra || '',
    status: STATUS[r.status] || r.status,
    decidedBy: name(r.decided_by), why: r.decided_why || '',
    self: !!(r.decided_by && r.raised_by && r.decided_by === r.raised_by),
    seen: !!r.seen_at,
    payStatus: PAYSTAT[r.pay_status] || '', account: r.account || '',
    books: !!r.books, bigin: !!r.bigin, receipt: !!r.receipt,
    remarks: r.remark || '',
    files: filesOf[r.id] || [],
    docs: (filesOf[r.id] || []).length
  })).sort((a, b) => String(b.at).localeCompare(String(a.at)));

  out.yearFigures = {};
  (db.sales_company || []).forEach(a => { out.yearFigures[String(a.year)] = a.figures || {}; });
  const agg = (db.sales_company || []).slice().sort((a,b) => b.year - a.year)[0];
  if(agg) Object.assign(out, agg.figures || {});
  out.figureKeys = agg ? Object.keys(agg.figures || {}) : [];

  Object.values(companies).forEach(c => { c.sales = false; });
  (db.sales_company || []).forEach(a => {
    if(companies[a.company]) companies[a.company].sales = true;
  });

  out.years.sort();
  if(!out.quarters.length) out.quarters = ['Q1','Q2','Q3','Q4'];
  return out;
}
