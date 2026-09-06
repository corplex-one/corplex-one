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
    payBasis:{}, paidBy:{},
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
    ids:{}, joined:{}, probation:{}, revisions:[], ref:{},
    staffNo:{}, visaCo:{}, signedIn:{},
    // the rules that decide who counts as sales. Empty here reads as "nobody
    // qualifies", which is why these must come from settings, not a placeholder.
    revDept:     S.rev_dept     || {},
    /* Who is treated as sales staff whatever their department says. It was a
       settings blob keyed by full name, which would orphan itself the first
       time Staff Records corrected somebody's spelling; it is a row keyed by
       the person now. The shape here is unchanged, so every reader is. */
    salesExtra:  Object.fromEntries((db.sales_members || [])
                   .map(m => [name(m.employee_id), {co: m.company, dept: m.department}])
                   .filter(([n]) => n)),
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
    /* Whether the payroll generator builds a line for them, and how. It only
       arrives for people allowed to see pay at all, which is why the screen
       that reads it falls back to 'salaried' rather than to nothing. */
    hr.payBasis[n] = e.payroll_basis || 'salaried';
    if(e.paid_by) hr.paidBy[n] = e.paid_by;
    /* Staff Records edits these three, so they have to arrive as themselves
       rather than as a code borrowed off a payroll line — a person with no
       line this month has none. */
    set(hr.staffNo, n, e.staff_no);
    set(hr.visaCo,  n, e.visa_company);
    /* Whether they have ever signed in. correct_joining refuses to move the
       work address of somebody who has, and the screen has to say so before
       they type rather than after they press Save.
       The roster is a view now and answers this as a flag rather than handing
       over the auth id; the second half is the fallback for a portal deployed
       before 0025 has been run. */
    if(e.signed_in || e.auth_user_id) hr.signedIn[n] = true;
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
      /* The four numbers live in the profile as well as in hr.ref, because
         the profile is what completeness is measured against and what the
         person fills in. hr.ref stays: the console reads it. */
      eid: p.emirates_id || '', passport: p.passport_no || '',
      visa: p.visa_no || '', labour: p.labour_no || '',
      updated: p.updated_at ? String(p.updated_at).slice(0,10) : ''
    });
    /* The four references, together, because the screen shows them together.
       They arrive only for the person themselves and for accounts — the rules
       on employee_private decide that, not this file. */
    hr.ref[n] = {eid: p.emirates_id || '', passport: p.passport_no || '',
                 visa: p.visa_no || '', labour: p.labour_no || ''};
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
      /* The date the figure above is a balance AS AT. It is the policy's own
         opening date for everybody, and the day a fresh record started for
         anybody who has one — their leave begins at nothing on that day, so
         the year before it must not be counted against them. */
      openAt: o.as_at ? String(o.as_at).slice(0,10) : '',
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
  /* Everybody else's day, without a clock on it.
   *
   *   'employees should just know if their colleague is at work or away.
   *    Timings are not needed'                                        -- Avin
   *
   * The rows above are the ones this person may see in full — their own, their
   * reports', or all of them for accounts. For everybody else the portal still
   * has to draw the fortnight strip on People and count who is working from
   * home today, so the day arrives as a status and a count of segments and
   * nothing more. `shown` is what dayStatus() reads in place of segs.length;
   * segs stays empty, so no total, no open segment, and no time can be derived
   * from it by any screen that forgets to ask.
   */
  (db.attendance_public || []).forEach(a => {
    const who = name(a.employee_id); if(!who) return;
    const d = String(a.on_date).slice(0,10), k = `${who}|${d}`;
    if(days.has(k)) return;                      // already here in full
    days.set(k, {who, d, kind: a.kind || 'Office', segs: [], shown: +a.segments || 0});
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

  /* Salary, per person and per company.
   *
   * This was one line — master.parts[name] = {...} — and it had two faults
   * that only showed up once the data got interesting.
   *
   * ONE. A person can be paid by more than one company. Miraziz draws 25,000
   * from CorpLex and 25,000 from POA, and the database has always held that
   * correctly: salary_parts is keyed (employee, effective_from, company), and
   * the payroll generator builds him a line for each. But this loop keyed by
   * name alone, so the second company overwrote the first and every screen
   * that says "salary" showed one of the two. Avin: 'Miraziz needs to receive
   * salary from POA and Corplex - 25k each. This is missing.'
   *
   * TWO. A revision adds a row rather than replacing one, so a person has as
   * many rows per company as they have had raises. With no ordering, whichever
   * arrived last in the array won — not the one in force. A salary screen
   * could show last year's figure or this year's depending on row order.
   *
   * So: latest effective row per company, ignoring anything not yet in force,
   * and the top-level figure is the sum across companies. Rows dated ahead are
   * kept separately, because "on file now" and "already agreed from March" are
   * two different questions and a screen should be able to ask either. */
  {
    const today = hr.today;
    const byPerson = {};
    (db.salary_parts || []).forEach(p => {
      const n = name(p.employee_id); if(!n) return;
      (byPerson[n] || (byPerson[n] = [])).push(p);
    });
    Object.entries(byPerson).forEach(([n, rows]) => {
      const cos = [...new Set(rows.map(r => r.company || ''))].sort();
      const pick = [], ahead = [];
      cos.forEach(c => {
        const mine = rows.filter(r => (r.company || '') === c)
          .sort((a, b) => String(a.effective_from).localeCompare(String(b.effective_from)));
        const live = mine.filter(r => !r.effective_from || String(r.effective_from) <= today);
        const later = mine.filter(r => r.effective_from && String(r.effective_from) > today);
        const r = live[live.length - 1];
        /* The row before the one in force, so a screen can say what the last
           revision moved and not merely what the figure is now. A person on
           their first salary has none, and null is the honest answer. The ISO
           date rides along beside the written one because "how long has this
           stood" is arithmetic, and longDate output is not. */
        const pv = live[live.length - 2];
        if(r) pick.push({company: c, label: (companies[c] || {}).name || c || 'the group',
          salary: +r.salary, basic: +r.basic, allow: +r.allowance,
          from: r.effective_from ? longDate(r.effective_from) : '',
          on: r.effective_from ? String(r.effective_from).slice(0,10) : '',
          src: r.source || '',
          prev: pv ? {salary: +pv.salary, basic: +pv.basic, allow: +pv.allowance,
            from: pv.effective_from ? longDate(pv.effective_from) : '',
            on: pv.effective_from ? String(pv.effective_from).slice(0,10) : ''} : null});
        later.forEach(x => ahead.push({company: c,
          label: (companies[c] || {}).name || c || 'the group',
          salary: +x.salary, basic: +x.basic, allow: +x.allowance,
          from: x.effective_from ? longDate(x.effective_from) : '',
          on: x.effective_from || '', src: x.source || ''}));
      });
      if(!pick.length && !ahead.length) return;
      const sum = k => Math.round(pick.reduce((t, x) => t + (+x[k] || 0), 0) * 100) / 100;
      const first = pick[0] || {};
      master.parts[n] = {
        salary: sum('salary'), basic: sum('basic'), allow: sum('allow'),
        from: first.from || '', src: first.src || '',
        co: pick, ahead, multi: pick.length > 1
      };
    });
  }
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
  /* A month that no longer agrees with the records.
   *
   *   'if there is a revision letter processed, the payroll should indicate
   *    there is a change in salary so that i refresh it and the salary is
   *    changed. Once its changed, the indication should go off - its for that
   *    particular month only'
   *
   * A payroll line's salary is written when the month is generated, and a
   * revision letter deliberately does not reach back into it — that is what
   * stops a letter moving a month somebody has already approved. The cost of
   * that is a month which is quietly out of date and looks fine.
   *
   * So rather than a flag somebody has to remember to set and clear, this is
   * worked out every time the page loads: what does the line pay, and what do
   * the records say it should. If they differ, the month is stale. Refreshing
   * rewrites the line from the same records, the two agree, and the mark goes
   * out by itself — which is the only kind of indicator that can be trusted,
   * because there is no second state to fall out of step.
   *
   * The comparison is against the PRORATED figure the generator writes, so a
   * joiner half way through a month is not reported as a discrepancy. */
  const partsBy = {};
  (db.salary_parts || []).forEach(p => {
    (partsBy[p.employee_id] || (partsBy[p.employee_id] = [])).push(p);
  });
  const salaryAt = (empId, company, monthKey) => {
    const mine = (partsBy[empId] || [])
      .filter(x => (x.company || '') === (company || ''))
      .filter(x => !x.effective_from || String(x.effective_from).slice(0, 7) <= monthKey)
      .sort((a, b) => String(a.effective_from).localeCompare(String(b.effective_from)));
    return mine.length ? +mine[mine.length - 1].salary : null;
  };
  const staleOf = (r) => {
    // A closed month is a record, not a draft: it is never restated.
    if(r.status === 'closed') return [];
    const out = [];
    (db.payroll_lines || []).filter(l => l.run_id === r.id && !l.excluded).forEach(l => {
      const e = byId.get(l.employee_id); if(!e) return;
      if(!['salaried', 'director'].includes(e.payroll_basis || 'salaried')) return;
      /* The generator labels a line with the salary row's company, or — where
         the row names no company — with the person's own. So look for the
         line's company first, and fall back to the unnamed row. */
      const want = salaryAt(l.employee_id, l.company, r.month_key)
                ?? salaryAt(l.employee_id, '', r.month_key);
      if(want === null) return;
      const days = +l.days || 30;
      const should = Math.round(want * days / 30 * 100) / 100;
      const has = Math.round(+l.salary * 100) / 100;
      if(Math.abs(should - has) >= 0.01)
        out.push({name: name(l.employee_id) || l.name, company: co(l.company),
                  companyKey: l.company || '', was: has, now: should,
                  lineId: l.id, up: should > has});
    });
    /* And the other half of "out of date": a line the month has not got at
     * all. Somebody moved onto payroll, or given a salary from a second
     * company, gains a line the next time the month is built — and until then
     * the month is quietly short one person rather than wrong about one
     * figure. Both are the same thing to whoever has to press Refresh. */
    const have = new Set((db.payroll_lines || [])
      .filter(l => l.run_id === r.id).map(l => l.employee_id + '|' + (l.company || '')));
    (db.employees || []).forEach(e => {
      if(!['salaried', 'director'].includes(e.payroll_basis || 'salaried')) return;
      if(e.last_day && String(e.last_day).slice(0, 7) < r.month_key) return;
      if(e.doj && String(e.doj).slice(0, 7) > r.month_key) return;
      const cos = [...new Set((partsBy[e.id] || [])
        .filter(x => !x.effective_from || String(x.effective_from).slice(0, 7) <= r.month_key)
        .map(x => x.company || ''))];
      cos.forEach(c => {
        const key = e.id + '|' + (c || e.company || '');
        if(have.has(key) || have.has(e.id + '|' + c)) return;
        const want = salaryAt(e.id, c, r.month_key);
        if(want === null) return;
        out.push({name: name(e.id) || e.full_name, company: co(c || e.company),
                  companyKey: c, was: null, now: want, lineId: '', up: true, missing: true});
      });
    });
    return out;
  };

  payroll.runs = runs.map(r => ({
    key: r.month_key, label: r.label, status: r.status, runId: r.id,
    stale: staleOf(r),
    payDate: r.pay_date ? longDate(r.pay_date) : '',
    preparedBy: name(r.prepared_by), approver: name(r.approver),
    // Why a month came back belongs to the month. The screen used to hold it
    // in a variable, which meant it survived exactly as long as the tab did.
    note: r.note || '',
    submittedBy: name(r.submitted_by), paidBy2: name(r.paid_by),
    /* A line marked excluded belongs to somebody whose exit has been
       initiated: they are off this month's run and their settlement is a box
       beside it instead. The line is kept rather than deleted so that sending
       the settlement back can put them straight back on. */
    rows: (db.payroll_lines || []).filter(l => l.run_id === r.id && !l.excluded).map(lineOf)
  }));

  const run = runs[0];
  if(run){
    master.payDate = run.pay_date ? longDate(run.pay_date) : '';
    Object.assign(payroll, {
      month: run.label, monthKey: run.month_key, status: run.status,
      preparedBy: name(run.prepared_by), approver: name(run.approver),
      label: Object.fromEntries(Object.values(companies).map(c => [c.code, c.name])),
      channels: S.payroll_channels || [],
      vatOn: (db.payroll_lines || []).filter(l => l.vat && !l.excluded).map(l => name(l.employee_id) || l.name)
    });
    const lines = (db.payroll_lines || []).filter(l => l.run_id === run.id && !l.excluded);
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
    row._emp = r.employee_id;
    gById.set(r.id, row); gratuity.rows.push(row);
  });
  (db.gratuity_basic || []).forEach(c => {
    const row = gById.get(c.row_id); if(!row) return;
    row.basic[String(c.month_end).slice(0,10)] = +c.basic;
  });

  /* ------------------------------------- the months the workbook does not own
   *
   * 'You need to remove the data from Sep 2026 and conclude with me till
   *  August 2026. From Sep 2026, you calculate on your basis and I continue
   *  with my work book.'
   *
   * Up to workbookTo the figures are Avin's, stored as his sheet has them and
   * never touched. After it there is nothing stored at all, and the basic for
   * each month is read from the salary chart in force that month — the same
   * chart the settlement reads, so the provision and the settlement cannot
   * come apart again, and a revision letter maintains the provision by writing
   * the only figure there is.
   *
   * It runs to the end of the current year rather than to today, because the
   * sheet it is being compared against carries future months: a revision
   * effective in October is known in September and belongs on both sides.
   *
   * Nothing here is written back. These months are worked out on every load,
   * so correcting a salary corrects the provision with it.
   */
  const wbTo = String(gratuity.policy.workbookTo || '').slice(0, 7);
  if(wbTo){
    gratuity.workbookTo = wbTo;
    const monthEnd = ym => { const y = +ym.slice(0,4), m = +ym.slice(5,7);
      return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0))
        .toISOString().slice(0,10); };
    const next = ym => { const y = +ym.slice(0,4), m = +ym.slice(5,7);
      return m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2,'0'); };

    /* One pass over the salary chart, oldest first, so the basic in force at a
       month is the last row dated on or before its end. A person paid by two
       companies has a row for each; the provision follows the whole basic, as
       the settlement does. */
    const chart = {};
    (db.salary_parts || []).slice()
      .sort((a, b) => String(a.effective_from).localeCompare(String(b.effective_from)))
      .forEach(s => { const n = name(s.employee_id); if(!n) return;
        (chart[n] || (chart[n] = [])).push(
          {from: String(s.effective_from).slice(0,10), co: s.company || '', basic: +s.basic || 0}); });
    const basicAt = (n, on) => {
      const rows = chart[n]; if(!rows) return 0;
      const byCo = {};
      rows.forEach(r => { if(r.from <= on) byCo[r.co] = r.basic; });
      return Object.values(byCo).reduce((t, v) => t + v, 0);
    };

    /* One provision row per person gets the computed months. Nobody has two
       today, but the liability can sit with a second entity, and writing the
       whole basic into both rows would provision the same person twice. The
       row that gets it is the one for the company they are on; failing that,
       the first, so a person is never silently left without one. */
    const mine = {};
    gratuity.rows.forEach(r => {
      if(!r._emp) return;
      const theirs = co((byId.get(r._emp) || {}).company);
      if(!mine[r._emp] || r.co === theirs) mine[r._emp] = r;
    });

    const lastYm = (new Date().getUTCFullYear()) + '-12';
    for(const row of gratuity.rows){
      if(row._emp && mine[row._emp] !== row) continue;
      for(let ym = next(wbTo); ym <= lastYm; ym = next(ym)){
        const on = monthEnd(ym);
        /* Somebody who has left stops being provisioned for, and a month
           before they joined was never theirs. */
        if(row.left && row.left < on) continue;
        if(row.doj && row.doj > on) continue;
        const b = basicAt(row.n, on);
        if(b > 0) row.basic[on] = b;
      }
    }
  }

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
    decided: l.decided_on ? String(l.decided_on).slice(0,10) : '',
    /* What it said when it went out. A letter issued before the templates
       became editable has this filled in from the template as it stood then,
       which is what it said. A draft has none and follows the template until
       it is sent. */
    said: l.body_at_issue || '',
    saidLabel: l.label_at_issue || ''
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

  /* A settlement, at whatever stage it has reached.
   *
   * `frozen` is the whole calculation as it stood when the exit was initiated,
   * written down so that a salary revision or another month of leave accrual
   * cannot move a figure somebody has signed a declaration for. While it is
   * still a draft there is nothing frozen and the screen works it out live. */
  const exLines = {};
  (db.exit_lines || []).forEach(l => (exLines[l.exit_id] = exLines[l.exit_id] || []).push({
    id: l.id, label: l.label || '', amount: Number(l.amount) || 0,
    deduct: !!l.deduct, sort: l.sort || 0
  }));
  Object.values(exLines).forEach(a => a.sort((p, q) => p.sort - q.sort));

  hr.exits = (db.exits || []).map(x => ({
    id: x.id,
    who: name(x.employee_id), lastDay: String(x.last_day).slice(0,10),
    settled: x.settled_on ? String(x.settled_on).slice(0,10) : '',
    reason: x.reason || '', status: x.status || 'draft', notes: x.notes || '',
    month: x.pay_month || '',
    frozen: x.frozen || null,
    net: x.net === null || x.net === undefined ? null : Number(x.net),
    mgr: x.manager_id ? name(x.manager_id) : '',
    mgrOkBy: x.mgr_ok_by ? name(x.mgr_ok_by) : '',
    mgrOkAt: x.mgr_ok_at ? String(x.mgr_ok_at).slice(0,10) : '',
    ownerOkBy: x.owner_ok_by ? name(x.owner_ok_by) : '',
    ownerOkAt: x.owner_ok_at ? String(x.owner_ok_at).slice(0,10) : '',
    backWhy: x.back_why || '', backBy: x.back_by ? name(x.back_by) : '',
    payMode: x.pay_mode || '', paidOn: x.paid_on ? String(x.paid_on).slice(0,10) : '',
    by: x.created_by ? name(x.created_by) : '',
    lines: exLines[x.id] || []
  })).filter(x => x.who);

  /* A spell of employment that was closed and settled. The live one is on the
     record itself; these are the ones before it, newest first, so a screen can
     say what a joining date of last month is sitting on top of. */
  hr.spells = (db.spells || []).map(s => ({
    id: s.id, who: name(s.employee_id),
    doj: String(s.doj).slice(0,10), lastDay: String(s.last_day).slice(0,10),
    basis: s.basis || '', exit: s.exit_id || '', note: s.note || ''
  })).filter(s => s.who).sort((a, b) => b.doj.localeCompare(a.doj));

  hr.letterTypes   = S.letter_types   || [];
  hr.docTypes      = S.doc_types      || [];
  hr.uploadTypes   = S.upload_types   || [];
  hr.mail          = S.mail_settings  || {};
  hr.loanThreshold = S.loan_threshold ?? 0;

  // ----------------------------------------------------------- air tickets
  const tp = S.ticket_policy || {};
  const tickets = {
    asOf: tp.asOf || '', procMonth: tp.procMonth || '', policyNote: tp.note || '',
    /* One list, one source. It used to be a copy in settings that nothing
       could write to and no code path consulted when a rate was actually
       paid; it is a table now, every country in it, a rate where one has
       been agreed and null where it has not. */
    rates: (db.ticket_rates || []).map(r => ({
      country: r.country, rate: r.rate === null || r.rate === undefined ? null : +r.rate,
      standard: !!r.standard})).sort((a, b) => a.country.localeCompare(b.country)),
    ratesArePlaceholder: !!tp.placeholder,
    paid: [], due: [], upcoming: [], backlogLapses: [], lastRun: '',
    /* Was a list in settings, kept by hand and keyed by name. Everybody off
       the scheme now carries the reason on their own entitlement, which is
       what the screen reads — see migration 0026. */
    excluded: [],
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

    /* The letterhead, keyed the way the documents ask for it.
     *
     * 'Why the letterheads have no address?'   -- Avin
     *
     * Because this was an empty ARRAY. Every payslip, settlement and letter
     * looks the entity up as DATA.entities[code] — 'CorpLex', 'POA', 'Lex' —
     * and an array has no such key, so every lookup missed and fell through to
     * a default carrying the legal name and an empty address. The name was
     * right, which is why nothing looked broken; the address was the only
     * thing that could go missing without the page saying so.
     *
     * The addresses were on the companies table the whole time, correct for
     * all three. This is that table, in the shape the paper asks for.
     *
     * 'ready' is what puts 'Letterhead details still to be confirmed' on a
     * document, so it is worked out rather than assumed: a company added
     * without a registered name or an address says so on its own paper. */
    entities: Object.fromEntries(Object.values(companies).map(c => [c.code, {
      key: c.key, code: c.code, name: c.name,
      legal: c.legal || c.name,
      addr: c.addr || [],
      ready: !!(c.legal && (c.addr || []).length)
    }])),
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

  /* The people beside you.
   *
   * sales_commission holds net sales and commission in the same row, and its
   * rule is your own rows or the sales-viewers list — so a consultant gets
   * exactly one person's figures and the team screens had nobody to rank.
   * sales_team_figures is a view over the same rows carrying the eight
   * figures those screens draw and no commission at all, scoped in the
   * database to your own company and your own department.
   *
   * It only ever FILLS GAPS. Accounts and the owner read the table itself and
   * get more than this; a name already in the engine keeps what it has.
   */
  out.invAgg = {};
  (db.sales_team || []).forEach(r => {
    const n = r.full_name; if(!n) return;
    const y = String(r.year), q = r.quarter;
    const per = out.engine[n] || (out.engine[n] = {});
    const yr  = per[y] || (per[y] = {});
    if(!yr[q]) yr[q] = {
      netTot: +r.net_tot || 0, totElig: +r.tot_elig || 0,
      notColl: +r.not_coll || 0, forf: +r.forf || 0,
      // The three invoiced and cost buckets are only ever added together on
      // these screens, so the view returns the sum and it goes in the first.
      newInv: +r.invoiced || 0, exInv: 0, pmInv: 0,
      newCost: +r.costs || 0, exCost: 0, pmCost: 0,
      peer: true
    };
    if(!out.years.includes(y)) out.years.push(y);
    /* The invoice count and what is still outstanding, as totals. The rows
       themselves stay unreadable — no client, no invoice number. */
    const ia = out.invAgg[n] || (out.invAgg[n] = {});
    (ia[y] || (ia[y] = {}))[q] = {count: +r.invoices || 0, out: +r.outstanding || 0};
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

  /* The company aggregate, whole or narrowed.
   *
   * sales_company is the Department screen: the monthly series and the target,
   * but also the top clients, the client count, the status mix and the new/
   * existing split. Since 0032 it is read by accounts, the owner, the
   * sales-viewers list and a manager of a department that earns revenue —
   * which is who the Department screen is for.
   *
   * Everybody else is sent sales_company_mine, the same row with those four
   * things removed. It is what Team performance's headline is made of, so a
   * consultant still gets their department's name, its net sales and its
   * target — and no client book beyond the one the payment request form has
   * always shown them.
   *
   * Whole first: somebody who reads both must not be given the narrow one. */
  const coRows = (db.sales_company && db.sales_company.length)
    ? db.sales_company
    : (db.sales_company_mine || []);

  /* Which of the two arrived. The Department screen and the leaderboard ask
   * this rather than asking what somebody's job title is: the database
   * decided, and a gate that reads the answer cannot drift away from it. A
   * rule the screen works out for itself is how the Department screen quietly
   * opened for a fourth person the first time round. */
  out.fullFigures = !!(db.sales_company && db.sales_company.length);

  out.yearFigures = {};
  coRows.forEach(a => { out.yearFigures[String(a.year)] = a.figures || {}; });
  const agg = coRows.slice().sort((a,b) => b.year - a.year)[0];
  if(agg) Object.assign(out, agg.figures || {});
  out.figureKeys = agg ? Object.keys(agg.figures || {}) : [];

  Object.values(companies).forEach(c => { c.sales = false; });
  coRows.forEach(a => {
    if(companies[a.company]) companies[a.company].sales = true;
  });

  out.years.sort();
  if(!out.quarters.length) out.quarters = ['Q1','Q2','Q3','Q4'];
  return out;
}
