-- =====================================================================
-- The salary chart, and the date each figure took effect.
--
--   Avin, 5 September 2026: 'Data for "on payroll". The dates are when the
--   salaries were last revised.'
--
-- NOT IN GIT, and it must stay that way: every line of it is somebody's pay.
-- It lives under supabase/seed/, which .gitignore excludes wholesale after a
-- renamed file once put real figures into a commit. Run it in the Supabase
-- SQL editor and do not commit it.
--
-- WHAT IT CHANGES
--
-- Every salary in the portal has been sitting on 2020-01-01 — a placeholder
-- put there when the figures were read out of the gratuity workbook, which
-- knew the amounts and not the dates. This replaces that placeholder with the
-- real date each salary took effect. The AMOUNTS are written too, from Avin's
-- chart rather than from what is already stored, so that this file is the
-- authority and running it twice changes nothing the second time.
--
-- Four decisions, all Avin's, taken on the questions this raised:
--
--   Janine Lagumbay joined 15 February 2025 — the portal held no joining date
--   for her, and her chart entry said 'Joining date'.
--
--   Abdullokh Fozilov is 1 October 2025. His chart entry read 01-Jan-20,
--   which is the placeholder above to the day and is five years before he
--   joined; Avin confirmed the real date.
--
--   Avin Mascarenhas has two rows, not one: 11,000 from 1 September 2025 and
--   12,500 from 1 September 2026. The second is a revision and the first is
--   what it revised, kept behind it.
--
--   Mirazizbek is the owner and takes no joining date. His two rows — 25,000
--   from CorpLex and 25,000 from POA — are left exactly as they are, at a
--   date that means 'as long as the portal has existed'. This file does not
--   touch them.
--
-- WHAT IT DOES NOT DO
--
-- It deletes only the placeholder rows it is replacing: company '', dated
-- 2020-01-01, belonging to somebody named below. Any other salary row —
-- a revision put through the portal, anything dated differently — is left
-- alone and listed by step 5 so you can see what survived. If a revision
-- letter has already moved somebody's pay, that row is still there
-- afterwards and, being later, still wins.
--
-- HOW IT IS PUT TOGETHER
--
-- The chart was a temporary table to begin with, which the Supabase SQL
-- editor answered with 'relation "sal_load" does not exist': it does not hold
-- one connection across the statements in a script, so a temporary table is
-- gone by the next one. So the chart lives inside a single statement instead
-- — one INSERT with the whole list in a CTE, which either does all of it or
-- none of it, and needs nothing to survive between statements.
--
-- Run the steps in order. Run after 0042_no_gratuity.sql. Safe to run again.
-- =====================================================================


-- =============================================== STEP 1 — before anything
-- Nine people take their date from the day they joined. If the portal does
-- not hold a joining date for one of them there is nothing to write, and the
-- insert below would fail on a null rather than say why.
--
-- THIS MUST COME BACK EMPTY. If it does not, send me the names.
select e.full_name, e.company
  from employees e
 where e.full_name in (
         'Fatima Khaliqdad', 'Maylyn Aguba Asilo', 'Sayyora Kadirova',
         'Aziz Karimov', 'Batul Ibrahim Wadiwala', 'Jasmine Azerby',
         'Ruel Tolentino', 'Sevara Maksudova', 'Kazimzhanov Mirabbosbek')
   and e.doj is null;


-- ================================================ STEP 2 — the chart itself
-- One statement: the list, the joining dates resolved against the staff list,
-- the placeholder rows cleared away, and the real rows written. It returns
-- what it wrote — 28 rows, one per line of the chart, and Avin twice.
--
-- A name that does not match somebody on the staff list is simply not
-- written, and will be missing from what comes back. Count the rows.
with chart(name, salary, basic, allowance, eff) as (values
  -- CorpLex.  date '0001-01-01' means 'their joining date', filled in below.
  ('Abdulkhamid Makhamatjanov',    9000, 5850,  3150, date '2025-05-01'),
  ('Avin Mascarenhas',            11000, 7150,  3850, date '2025-09-01'),
  ('Avin Mascarenhas',            12500, 7500,  5000, date '2026-09-01'),
  ('Fatima Khaliqdad',             8000, 5200,  2800, date '0001-01-01'),
  ('Janine Lagumbay',              5000,    0,  5000, date '2025-02-15'),
  ('Maylyn Aguba Asilo',          10000, 6500,  3500, date '0001-01-01'),
  ('Nissa Muradova',               8000, 4800,  3200, date '2025-03-01'),
  ('Rana Amine',                  15000, 9000,  6000, date '2025-10-01'),
  ('Sayyora Kadirova',            20000,    0, 20000, date '0001-01-01'),
  ('Shamsiddin Kadirov',           9000, 5400,  3600, date '2026-01-01'),
  ('Shohruh Karimov',             12000, 7200,  4800, date '2026-02-01'),
  ('Zhavokhir Khasanbaev',         8000, 4800,  3200, date '2026-05-01'),
  -- POA
  ('Abdullokh Fozilov',            5000, 3250,  1750, date '2025-10-01'),
  ('Ahmed Talaat Mohamed',         6600, 4300,  2300, date '2025-09-01'),
  ('Aziz Karimov',                 5000, 3000,  2000, date '0001-01-01'),
  ('Batul Ibrahim Wadiwala',       5000, 3000,  2000, date '0001-01-01'),
  ('Donia Mohamed Mahmoud Ahmed', 14000, 8400,  5600, date '2026-06-01'),
  ('Jasmine Azerby',               6000, 3600,  2400, date '0001-01-01'),
  ('Jessa Minda Elle Lagumbay',   10000, 6000,  4000, date '2026-05-01'),
  ('Luna Eltantawy',               7000, 4200,  2800, date '2025-10-01'),
  -- Avin's chart calls her Maria Viron; the staff list holds her legal name
  ('Ma Concecion Bello Viron',    12000, 7200,  4800, date '2026-07-01'),
  ('Razan Faisal Ahamed Yassin',   7000, 4200,  2800, date '2025-01-01'),
  ('Ruel Tolentino',               6500, 3900,  2600, date '0001-01-01'),
  ('Sevara Maksudova',             8000, 5000,  3000, date '0001-01-01'),
  ('Shahlaa Mariyam',             12000, 7200,  4800, date '2025-10-01'),
  ('Shannan Veigas',               6500, 3900,  2600, date '2026-07-01'),
  ('Umidakhon Gapurova',           7000, 4200,  2800, date '2026-07-01'),
  -- Lex Estates
  ('Kazimzhanov Mirabbosbek',      3500, 2100,  1400, date '0001-01-01')
),
resolved as (
  select e.id,
         c.name,
         c.salary::numeric   as salary,
         c.basic::numeric    as basic,
         c.allowance::numeric as allowance,
         case when c.eff = date '0001-01-01' then e.doj else c.eff end as eff
    from chart c
    join employees e on e.full_name = c.name
),
cleared as (
  -- Only the placeholder. Anything dated otherwise was put there on purpose.
  delete from salary_parts s
   using resolved r
   where s.employee_id = r.id
     and s.company = ''
     and s.effective_from = date '2020-01-01'
  returning s.employee_id
)
insert into salary_parts(employee_id, company, salary, basic, allowance, effective_from, source)
select r.id, '', r.salary, r.basic, r.allowance, r.eff, 'Salary chart, September 2026'
  from resolved r
    on conflict (employee_id, effective_from, company) do update
   set salary     = excluded.salary,
       basic      = excluded.basic,
       allowance  = excluded.allowance,
       source     = excluded.source,
       updated_at = now()
returning (select full_name from employees where id = salary_parts.employee_id) as name,
          salary, basic, allowance, effective_from;


-- ============================================ STEP 3 — who is paid how
-- Stated on the chart rather than inferred: a blank line is not the same as
-- commission-only, and the difference decides whether the generator writes a
-- nought line or no line at all.

update employees e set payroll_basis = 'salaried'
 where e.payroll_basis::text <> 'salaried'
   and exists (select 1 from salary_parts s
                where s.employee_id = e.id and s.company = ''
                  and s.source = 'Salary chart, September 2026');

-- 'Fakhridin Kochkorov - should be commission only', and Mukhamad with him.
update employees set payroll_basis = 'commission'
 where full_name in ('Fakhridin Kochkorov', 'Mukhamad Musulmonkulov')
   and payroll_basis::text <> 'commission';

-- 'Abdunosir has no salary - he is just part of organization, but not a
-- member of payroll.'
update employees set payroll_basis = 'off'
 where full_name = 'Abdunosir Kadirov' and payroll_basis::text <> 'off';

-- The owner draws a remuneration from each company, which 0041 made a basis
-- of its own. His two salary rows are not touched by this file.
update employees set payroll_basis = 'director'
 where full_name = 'Miraziz Makhamatzhanov' and payroll_basis::text <> 'director';


-- ======================================= STEP 4 — a commission-only salary
-- A commission-only person has no salary to hold. The figure that was on
-- Fakhridin's record came out of the gratuity workbook, and it is what made
-- the payroll offer to pay him one.
delete from salary_parts s
 using employees e
 where e.id = s.employee_id
   and e.full_name in ('Fakhridin Kochkorov', 'Mukhamad Musulmonkulov')
   and s.company = '';


-- ================================================== STEP 5 — read it back

-- 5a. Everybody on payroll, with the figure and the date it runs from.
select e.company, e.full_name, e.payroll_basis::text as basis,
       s.company as paid_by_entity, s.salary, s.basic, s.allowance,
       to_char(s.effective_from, 'DD Mon YYYY') as "from"
  from employees e
  left join salary_parts s on s.employee_id = e.id
 where e.active
 order by e.company, e.full_name, s.company, s.effective_from;

-- 5b. Anything this file did not write. Mirazizbek's two rows belong here and
--     so does any revision put through the portal — that is the point of not
--     deleting them. A name you expected to see corrected and which appears
--     here instead is a name that did not match the staff list.
select e.full_name, s.company, s.salary,
       to_char(s.effective_from, 'DD Mon YYYY') as "from", s.source
  from salary_parts s join employees e on e.id = s.employee_id
 where coalesce(s.source, '') <> 'Salary chart, September 2026'
 order by e.full_name, s.effective_from;

-- 5c. Anybody active with no salary and no reason for it. Should be empty.
select e.full_name, e.company, e.payroll_basis::text as basis
  from employees e
 where e.active
   and e.payroll_basis::text in ('salaried', 'director')
   and not exists (select 1 from salary_parts s where s.employee_id = e.id);

-- 5d. Nothing to do with this load, but worth a look while you are here.
--     Somebody still on the staff list whose last day has already passed is a
--     contradiction, and the payroll believes the last day: they drop off the
--     next run silently, with no line and no warning. Should be empty. If it
--     is not, either they left and are still marked active, or the last day
--     was put on by mistake and should be cleared.
select e.full_name, e.company, to_char(e.last_day, 'DD Mon YYYY') as "last day"
  from employees e
 where e.active and e.last_day is not null and e.last_day < current_date;
