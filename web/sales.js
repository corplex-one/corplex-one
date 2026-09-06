/* The sales workbook, read once and understood the same way everywhere.
 *
 * This file holds Avin's rules — the ones his workbook expresses as formulas —
 * as plain functions over plain arrays. It knows nothing about Excel, nothing
 * about the database and nothing about the browser, so the same code can run
 * in node when I import a file for him and in the page when he drops one on
 * it himself. One implementation, one set of answers.
 *
 * Every derived figure below was checked cell for cell against both the 2025
 * and 2026 workbooks before it was written down: 32,130 cells, all agreeing.
 * scripts/checksales.py is that check, and it is the reason to trust this.
 *
 * The rules, in the order they matter:
 *
 *   A credit note comes off the invoice BEFORE profit, partner commission and
 *   net sales, so it flows all the way through to what a person earns on.
 *
 *   Eligible net sales counts only an invoice that is fully settled AND paid
 *   on time. Late payment does not defer the commission, it forfeits it — the
 *   money moves to a separate 'forfeited' figure so the loss stays visible
 *   instead of quietly vanishing.
 *
 *   A person's band comes from their eligible net sales for the quarter, and
 *   the band sets three different rates: new client, existing client, and
 *   project-manager share. A flat arrangement bypasses the bands entirely,
 *   from the first dirham.
 *
 *   A department can be marked ineligible for commission — Accounting & Tax
 *   is — and a department not on the list earns commission.
 */

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/* ----------------------------------------------------------------- helpers */

export const num = v => {
  if(v === null || v === undefined || v === '') return 0;
  if(typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
};

/* A cell as words.
 *
 *   'Thu Apr 30 2026 23:59:48 GMT+0400 (Gulf Standard Time) - There is this
 *    text on CL INV-2426 - Fix it'                                   -- Avin
 *
 * It was String(v), and Excel hands back a Date object for any cell it thinks
 * is a date — which a PR number can become by one careless format in the
 * workbook. String(aDate) is that whole machine-readable line, and it went
 * into the database and onto the screen exactly as it came.
 *
 * The cell is not corrupt: somebody formatted it as a date and it holds one.
 * So it reads as a date — the same way every other date in the portal does —
 * rather than as an American timestamp with a timezone name on the end. Then
 * a mis-formatted cell is legible instead of alarming, and it is obvious from
 * the screen that a date is sitting where a reference belongs.
 *
 * This is the one funnel every text column comes through: PR#, client,
 * salesperson, invoice number. Fixing it here fixes all of them. */
const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const txt = v => {
  if(v === null || v === undefined) return '';
  /* A Date the parser could not make sense of is not 'Invalid Date' on a
     screen — it is a cell with nothing usable in it. */
  if(v instanceof Date)
    return isNaN(v.getTime()) ? ''
      : String(v.getUTCDate()).padStart(2, '0') + ' ' + MON3[v.getUTCMonth()] + ' ' + v.getUTCFullYear();
  return String(v).trim();
};

const blank = v => v === null || v === undefined || String(v).trim() === '';

// Excel and JavaScript disagree in the last bit; a fils is the unit that matters.
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/** A serial date, a Date, or a string — as YYYY-MM-DD, or '' if it is none of them. */
export function isoDate(v){
  if(blank(v)) return '';
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if(typeof v === 'number'){
    // Excel's day zero is 30 Dec 1899, and it believes in 29 Feb 1900.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if(m) return m[0];
  const d = new Date(s);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/** 2026-03-03 -> "03 Mar 2026", which is how the portal writes a date. */
export const longDate = iso => {
  if(!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d} ${MONTHS[+m - 1]} ${y}`;
};

const quarterOf = iso => iso ? 'Q' + Math.ceil((+iso.slice(5, 7)) / 3) : '';

/* ------------------------------------------------------------- the masters */

/* Commission Rules is three tables sharing one header row, which is why they
 * are read by position rather than by column name: the bands in A5:F8,
 * department eligibility in H5:I10, the flat arrangements in H12:I16. Reading
 * it by heading merges the lot — it once turned Avin's twenty-percent flat
 * rate into a department called 'Avin Mascarenhas'. These are the ranges the
 * workbook's own formulas name. */
export function readMasters(sheets){
  const cell = (rows, r, c) => (rows[r - 1] || [])[c - 1];

  const dept = {};
  (sheets.employees || []).slice(4).forEach(r => {
    const n = txt(r[0]);
    if(n) dept[n] = txt(r[1]);
  });

  const partner = {};
  (sheets.companies || []).slice(4).forEach(r => {
    const n = txt(r[0]);
    if(n) partner[n] = num(r[1]);
  });

  const rules = sheets.rules || [];
  const bands = [];
  for(let r = 5; r <= 8; r++){
    const b = cell(rules, r, 1);
    if(blank(b)) continue;
    bands.push({
      band: Math.round(num(b)),
      min:  num(cell(rules, r, 2)),
      max:  num(cell(rules, r, 3)),
      new:  num(cell(rules, r, 4)),
      exist:num(cell(rules, r, 5)),
      pm:   num(cell(rules, r, 6))
    });
  }
  bands.sort((a, b) => a.min - b.min);

  const eligible = {};
  for(let r = 5; r <= 10; r++){
    const d = txt(cell(rules, r, 8)), v = txt(cell(rules, r, 9));
    if(d && v) eligible[d] = v;
  }

  const flat = {};
  for(let r = 12; r <= 16; r++){
    const e = txt(cell(rules, r, 8)), v = cell(rules, r, 9);
    if(e && !blank(v)) flat[e] = num(v);
  }

  /* Commission already handed over, per person per quarter. This is the one
   * figure on the Commission Engine sheet that is not calculated — Avin types
   * it in as he pays people, and the sheet's own instructions say so. Every
   * other column there we derive; this one we have to read, and the first
   * version of this reader did not, which made every balance on every screen
   * read as the whole commission owing when most of it had been paid. */
  const paid = {};
  (sheets.engine || []).slice(4).forEach(r => {
    if(!r) return;
    const who = txt(r[0]), q = txt(r[2]);
    if(who && q) paid[who + '|' + q] = num(r[22]);
  });

  return {dept, partner, bands, eligible, flat, paid};
}

/** The last band whose minimum the figure reaches. Excel's VLOOKUP(...,TRUE). */
export function bandFor(bands, total){
  let hit = null;
  for(const b of bands) if(total >= b.min) hit = b;
  return hit;
}

const ratesFor = (masters, who, total) => {
  const f = masters.flat[who];
  if(f !== undefined) return {band: 'Flat — no target', new: f, exist: f, pm: f, flat: true};
  const b = bandFor(masters.bands, total) || {band: '', new: 0, exist: 0, pm: 0};
  return {band: b.band, new: b.new, exist: b.exist, pm: b.pm, flat: false};
};

/* -------------------------------------------------------------- an invoice */

/* The thirteen calculated columns of Sales Data, derived from the typed ones.
 * Column letters are kept in the comments because that is how Avin refers to
 * them and how the workbook's own instructions are written. */
export function deriveRow(r, masters){
  const company   = txt(r[4]);                    // E
  const pr        = txt(r[5]);                    // F
  const seller    = txt(r[6]);                    // G
  const pm        = txt(r[7]);                    // H
  const date      = isoDate(r[8]);                // I
  const invNo     = txt(r[9]);                    // J
  const amount    = num(r[10]);                   // K  excl VAT
  const vat       = num(r[11]);                   // L
  const received  = num(r[13]);                   // N
  const onTime    = txt(r[14]) || 'Yes';          // O
  const cogs      = num(r[17]);                   // R
  const poa       = num(r[18]);                   // S
  const expected  = num(r[19]);                   // T
  const creditAmt = num(r[21]);                   // V
  const creditOn  = isoDate(r[22]);               // W
  const pcApplies = txt(r[25]) || 'Yes';          // Z
  const clientType= txt(r[2]);                    // C
  const verified  = txt(r[3]);                    // D
  const hasAmount = !blank(r[10]);

  /* Nothing here is rounded, and that is not carelessness.
   *
   * Rounding the invoice total to the fils turned a 2025 invoice of 4,043.025
   * into 4,043.03, which left a balance of one fils outstanding, which made a
   * settled invoice read as Partially Paid, which made 3,850.50 of eligible
   * net sales disappear and with it the commission on it. One rounding, four
   * consequences, none of them visible on the screen it broke.
   *
   * Excel carries full precision through every one of these and rounds only
   * where it displays. So does this. The rounding happens once, at the edge,
   * when a figure is written to a column that has two decimal places. */
  const total   = amount + vat;                                           // M
  const balance = total - received;                                       // P
  const status  = total === 0 ? ''
                : received <= 0 ? 'Unpaid'
                : received >= total ? 'Paid' : 'Partially Paid';          // Q
  const expense = cogs + poa + expected;                                  // U
  const netOfCn = hasAmount ? amount - creditAmt : 0;                     // X
  const profit  = hasAmount ? netOfCn - expense : 0;                      // Y
  const pcRate  = pcApplies === 'No' ? 0 : (masters.partner[company] || 0); // AA
  const pcAmt   = hasAmount ? netOfCn * pcRate : 0;                       // AB
  const net     = profit - pcAmt;                                         // AC
  const shared  = seller === '' ? '' : (seller === pm ? 'Individual' : 'Shared'); // AD

  // AE — only a fully settled invoice, paid on time, earns anything
  const eligible = total === 0 ? 0
                 : (balance <= 0 ? (onTime === 'No' ? 0 : net) : 0);
  // AH — and when it was late, the money is named rather than lost quietly
  const forfeit  = total === 0 ? 0
                 : ((balance <= 0 && onTime === 'No') ? net : 0);

  return {
    quarter: quarterOf(date) || txt(r[1]),
    clientType, verified: verified === '✓' || num(verified) === 1,
    company, pr, seller, pm, date, invNo,
    amount, vat, total, received, onTime, balance, status,
    cogs, poa, expected, expense,
    creditAmt, creditOn, netOfCn, profit,
    pcApplies, pcRate, pcAmt, net, shared, eligible, forfeit,
    sellerDept: masters.dept[seller] || '',
    pmDept: masters.dept[pm] || ''
  };
}

/** Every row of Sales Data that is actually an invoice. */
export function readInvoices(sheets, masters){
  const out = [];
  (sheets.sales || []).slice(4).forEach((r, i) => {
    // What makes a row an invoice is that somebody sold something, not that a
    // number was typed in column J. Two 2025 rows have no invoice number and
    // are still worth 22,800 to the person who sold them — filtering on the
    // number dropped both, and with them a whole commission band.
    if(!r || (blank(r[4]) && blank(r[9]) && blank(r[10]))) return;
    const d = deriveRow(r, masters);
    d.row = i + 5;
    out.push(d);
  });
  return out;
}

/* ------------------------------------------------------- what a person earns */

/* One result per person per quarter, exactly as the Commission Engine sheet
 * computes it. The three buckets are: invoices they sold to a new client,
 * invoices they sold to an existing client, and invoices where they were the
 * project manager on somebody else's sale. */
export function runEngine(invoices, masters, people){
  const names = people && people.length ? people.slice()
    : [...new Set(invoices.flatMap(i => [i.seller, i.pm]).filter(Boolean))].sort();
  const out = [];

  for(const who of names){
    const dept = masters.dept[who] || '';
    const eligibleDept = (masters.eligible[dept] || 'Yes') !== 'No';

    for(const q of QUARTERS){
      const mine   = invoices.filter(i => i.quarter === q && i.seller === who);
      const asNew  = mine.filter(i => i.clientType === 'New');
      const asOld  = mine.filter(i => i.clientType === 'Existing');
      const asPm   = invoices.filter(i => i.quarter === q && i.pm === who && i.shared === 'Shared');
      // Excel carries full precision through these sums and only the display
      // rounds. Rounding here put the reader a fraction of a fils away from the
      // workbook on a handful of quarters, which is a difference of no
      // consequence and of every consequence: a checker that tolerates it
      // tolerates the next one too.
      const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);

      /* The names are the screens' names, not mine. Every sales screen in the
       * portal already reads totElig, comm, netTot and the rest off one of
       * these objects; inventing tidier ones would have meant editing a dozen
       * views to say the same thing differently. */
      const f = {
        newInv: sum(asNew, 'amount'), newCost: sum(asNew, 'expense'), newElig: sum(asNew, 'eligible'),
        exInv:  sum(asOld, 'amount'), exCost:  sum(asOld, 'expense'), exElig:  sum(asOld, 'eligible'),
        pmInv:  sum(asPm,  'amount'), pmCost:  sum(asPm,  'expense'), pmElig:  sum(asPm,  'eligible'),
        newForf: sum(asNew, 'forfeit'),
        exForf:  sum(asOld, 'forfeit'),
        pmForf:  sum(asPm,  'forfeit'),
        netTot: sum(asNew, 'net') + sum(asOld, 'net') + sum(asPm, 'net'),
        deptOk: eligibleDept,
        paid: (masters.paid || {})[who + '|' + q] || 0
      };

      f.totElig  = f.newElig + f.exElig + f.pmElig;
      f.forf     = f.newForf + f.exForf + f.pmForf;
      f.lateColl = f.forf;
      f.notColl  = f.netTot - f.totElig;

      const r = ratesFor(masters, who, f.totElig);
      f.band = r.band; f.flat = r.flat;
      f.rate = r.flat ? r.new : null;
      f.rates = {new: r.new, exist: r.exist, pm: r.pm};
      f.newComm = eligibleDept ? f.newElig * r.new : 0;
      f.exComm  = eligibleDept ? f.exElig  * r.exist : 0;
      f.pmComm  = eligibleDept ? f.pmElig  * r.pm : 0;
      f.comm    = f.newComm + f.exComm + f.pmComm;
      /* The workbook's own formula, Y = V - W. A negative balance is somebody
       * slightly overpaid, and it is left negative rather than floored at nil,
       * because that is money to set against the next quarter.
       *
       * Rounded, and this is the one place rounding belongs: a balance is not
       * an input to anything, it is the last figure in the chain. Unrounded it
       * printed '-0.00' beside people who had been paid to the fils, which
       * reads as a bug rather than as nothing owing. */
      f.bal     = round2(f.comm - f.paid);

      // What the quarter would have paid had everything been collected on time,
      // and therefore what late payment actually cost.
      f.eligOnTime = f.totElig + f.forf;
      const rr = ratesFor(masters, who, f.eligOnTime);
      f.bandOnTime = rr.band;
      f.commOnTime = eligibleDept ?
        (f.newElig + f.newForf) * rr.new +
        (f.exElig  + f.exForf)  * rr.exist +
        (f.pmElig  + f.pmForf)  * rr.pm : 0;
      f.lost = f.forf === 0 ? 0 : Math.max(0, f.commOnTime - f.comm);
      f.commOnLate = eligibleDept ?
        f.newForf * r.new + f.exForf * r.exist + f.pmForf * r.pm : 0;

      out.push({who, dept, quarter: q, figures: f});
    }
  }
  return out;
}

/* --------------------------------------------------- what the whole firm did */

/* The company-wide aggregates the dashboards read. Split by department,
 * because Corporate & Legal and Accounting & Tax are reported apart and only
 * merged where a screen asks for both. */
export function aggregate(invoices, masters, dept){
  const rows = dept ? invoices.filter(i => (i.sellerDept || '') === dept) : invoices;

  const totals = {inv: 0, net: 0, elig: 0, outstanding: 0, count: 0};
  const monthly = {}, typeMonthly = {}, clients = {}, statusMix = {};

  for(const i of rows){
    totals.inv += i.amount; totals.net += i.net; totals.elig += i.eligible;
    totals.outstanding += i.balance; totals.count += 1;

    const m = i.date.slice(0, 7);
    if(m){
      const a = monthly[m] || (monthly[m] = [0, 0, 0, 0]);
      a[0] += i.amount; a[1] += i.net; a[2] += i.eligible; a[3] += 1;
      const t = typeMonthly[m] || (typeMonthly[m] = [0, 0]);
      t[i.clientType === 'New' ? 0 : 1] += i.net;
    }

    if(i.company){
      const c = clients[i.company] || (clients[i.company] = [0, 0, 0, '', '', '']);
      c[0] += i.amount; c[1] += i.balance; c[2] += 1;
      // The screens print this date as it is stored, so it is stored the way
      // the portal writes dates: 03 Mar 2026, not 2026-03-03.
      if(!c[5] || i.date > c[5]) { c[5] = i.date; c[3] = longDate(i.date); c[4] = i.status; }
    }

    if(i.status) statusMix[i.status] = (statusMix[i.status] || 0) + 1;
  }

  const r2 = o => { for(const k of Object.keys(o)) o[k] = round2(o[k]); return o; };
  r2(totals);
  Object.values(monthly).forEach(a => { for(let k = 0; k < 3; k++) a[k] = round2(a[k]); });
  Object.values(typeMonthly).forEach(a => { a[0] = round2(a[0]); a[1] = round2(a[1]); });
  // the sixth slot was only there to compare dates; the screens never see it
  Object.values(clients).forEach(c => { c[0] = round2(c[0]); c[1] = round2(c[1]); c.length = 5; });

  const topClients = Object.entries(clients)
    .map(([n, c]) => [n, c[0], round2(rows.filter(i => i.company === n)
        .reduce((s, i) => s + i.net, 0)), c[2]])
    .sort((a, b) => b[1] - a[1]).slice(0, 10);

  return {
    totals, monthly, typeMonthly, clients, statusMix, topClients,
    clientCount: Object.keys(clients).length,
    quarters: QUARTERS.slice(),
    department: dept || ''
  };
}

/* ------------------------------------------------------------- the whole file */

/** Everything the portal needs from one workbook, plus anything it could not
 *  make sense of. The problems are the point: a name that is not on the
 *  Employee Master silently earns nobody anything, and that is precisely the
 *  kind of thing that cost the August payroll eleven thousand dirhams. */
export function readWorkbook(sheets, opts){
  const masters = readMasters(sheets);
  const invoices = readInvoices(sheets, masters);
  const engine = runEngine(invoices, masters, Object.keys(masters.dept));

  const problems = [];
  const seen = new Set();
  for(const i of invoices){
    const flag = (what, detail) => {
      const key = what + '|' + detail;
      if(seen.has(key)) return;
      seen.add(key);
      problems.push({row: i.row, invoice: i.invNo, what, detail});
    };
    if(i.seller && !masters.dept[i.seller])
      flag('Salesperson not on the Employee Master', i.seller);
    if(i.pm && !masters.dept[i.pm])
      flag('Project manager not on the Employee Master', i.pm);
    // A row with a client, a date and a salesperson but no amount is a void
    // or cancelled invoice — Avin's word for them. They are counted and named
    // rather than treated as an error, because they are neither an error nor
    // something to silently drop: the number was issued and then withdrawn.
    if(!i.status) flag('Void or cancelled — no amount', i.invNo);
    if(!i.date) flag('No invoice date, so it belongs to no quarter', i.invNo);
    if(!i.clientType) flag('No client type, so it counts as neither new nor existing', i.invNo);
  }

  const year = opts && opts.year ? opts.year
    : (invoices.map(i => i.date.slice(0, 4)).filter(Boolean).sort().pop() || '');

  const voided = invoices.filter(i => !i.status);

  return {
    year: +year || null, masters, invoices, engine, problems, voided,
    all: aggregate(invoices, masters, null),
    byDept: [...new Set(Object.values(masters.dept))].filter(Boolean)
      .map(d => aggregate(invoices, masters, d))
  };
}

/* --------------------------------------------- what the database is given
 *
 * One invoice becomes one row for the person who sold it, and a second row for
 * the project manager when the work was shared. That is not duplication for
 * its own sake: the screens ask 'what is on my list', and a shared invoice is
 * on two lists. The salesperson's row is the one that counts towards a total —
 * the other is the same money seen from the other side.
 *
 * This lives here, beside the reader, rather than in the import script,
 * because the browser sends the same payload the script does. One shape,
 * proven once.
 */
export function toPayload(w){
  const invoices = [];
  for(const i of w.invoices){
    const base = {
      quarter: i.quarter, inv_date: i.date || null, inv_no: i.invNo,
      client: i.company, kind: i.clientType,
      amount: i.amount, expense: i.expense, pass_cost: i.pcAmt,
      net: i.net, eligible: i.eligible, status: i.status,
      balance: i.balance, shared: i.shared, credit_note: i.creditAmt,
      on_time: i.onTime, forfeit: i.forfeit, pr_ref: i.pr,
      received: i.received,
      consultant: i.seller || null, manager: i.pm || null
    };
    if(i.seller) invoices.push({...base, role: 'C', filed_under: i.seller});
    if(i.shared === 'Shared' && i.pm && i.pm !== i.seller)
      invoices.push({...base, role: 'P', filed_under: i.pm});
  }

  const commission = w.engine
    .filter(e => e.figures.elig !== 0 || e.figures.netTotal !== 0 || e.figures.earned !== 0)
    .map(e => ({who: e.who, quarter: e.quarter, figures: e.figures}));

  const bands = w.masters.bands.map(b => ({
    band: b.band, low: b.min, high: b.max,
    new_rate: b.new, ex_rate: b.exist, pm_rate: b.pm
  }));

  // The dashboards read one blob per company per year. Corporate & Legal is
  // the headline; Accounting & Tax rides along as atDept, which is how the
  // screens have always asked for it.
  const cl = w.byDept.find(d => d.department === 'Corporate & Legal') || w.all;
  const at = w.byDept.find(d => d.department === 'Accounting & Tax') || null;
  const figures = {
    ...cl,
    atDept: at,
    dept: w.masters.dept,
    deptOf: {'Accounting & Tax': 'at', 'Corporate & Legal': 'cl'},
    partners: Object.entries(w.masters.partner).map(([name, rate]) => ({name, rate})),
    managers: {},
    target: {year: 0, quarter: 0, month: 0}
  };

  return {invoices, commission, bands, figures};
}

/* The four sheets, out of whatever the SheetJS build in the page gave us.
 * The node scripts and the browser both come through here, so 'which sheets
 * does a workbook need' is answered in exactly one place. */
export function sheetsFromBook(XLSX, wb){
  const grab = n => wb.Sheets[n]
    ? XLSX.utils.sheet_to_json(wb.Sheets[n], {header: 1, raw: true, defval: null})
    : [];
  return {
    sales:     grab('Sales Data'),
    employees: grab('Employee Master'),
    companies: grab('Company Master'),
    rules:     grab('Commission Rules'),
    // Commission Engine is derived from Sales Data in every column but one,
    // and that one is the reason it has to come across: 'Paid' is typed.
    engine:    grab('Commission Engine')
  };
}

/* A workbook, from the bytes of a file to the figures and the payload. This is
 * what the upload screen calls; the loading of SheetJS and of this file is the
 * only part left to the page, because that part is about the network and not
 * about sales. */
export function readSalesWorkbook(XLSX, buf){
  const wb = XLSX.read(buf, {type: 'array', cellDates: true});
  const need = ['Sales Data', 'Employee Master', 'Company Master', 'Commission Rules']
    .filter(n => !wb.Sheets[n]);
  if(need.length) throw new Error(
    'That workbook has no ' + need.join(' sheet, no ') + ' sheet. It needs all four: ' +
    'Sales Data, Employee Master, Company Master and Commission Rules.');
  const w = readWorkbook(sheetsFromBook(XLSX, wb));
  if(!w.invoices.length) throw new Error('There is nothing on the Sales Data sheet.');
  if(!w.year) throw new Error('No invoice on it carries a date, so there is no year to file it under.');
  return {w, payload: toPayload(w)};
}
