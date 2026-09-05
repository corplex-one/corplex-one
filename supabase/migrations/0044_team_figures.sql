-- What a consultant may see about the people they work beside.
--
--   Avin: 'I wanted every sales employee to get: Team performance page -
--   without commission part / Team leaderboard as well'
--   'they see colleagues names against the figures... What each person
--   earns - not.'
--
-- Both screens rank and compare people, so both need every person's figures
-- and not just the department's total. The commission table holds those
-- figures, and its rule is your own rows, your reports' rows, or the
-- sales-viewers list.
--
-- THE THING THIS FILE REFUSES TO DO
--
-- The one-line version of this change is to widen read_commission to the
-- whole company. It would work, and it would be wrong: sales_commission
-- keeps net sales and COMMISSION in the same row, so a consultant would be
-- sent what every colleague earned, paid and still owed. The screen hides
-- those three columns from anybody but accounts and the owner — but hiding a
-- column is a decision about a page, not about a payload, and a payload is
-- what a browser can be asked to show. Closed on screen and open in the wire
-- is the worst of both: it looks careful and it is not.
--
-- So the rows never leave the database in the first place. This view returns
-- the eight figures the two screens draw and nothing else, and there is no
-- commission column in it to hide.
--
-- WHAT IT RETURNS, AND TO WHOM
--
-- Per person, per year, per quarter: net sales, eligible net sales, net sales
-- not yet counted, forfeited, invoiced value, costs, the number of invoices
-- and the balance still outstanding on them. Names come from the staff list,
-- which everybody can already read.
--
-- To: anybody still active, for the people in their OWN company and their OWN
-- department. Not another department, not another company. Accounts and the
-- owner keep reading the table itself, which is how they still see
-- commission.
--
-- WHAT IT LEAVES ALONE
--
-- read_commission, read_invoices and every other policy are untouched. The
-- view is a second, narrower window onto the same rows; nothing that was
-- closed before this file is open after it.
--
-- Run after 0043_department_figures.sql. Safe to run again.

-- A view is not security_invoker by default, so it reads the base tables with
-- the owner's rights and does its own filtering. That is the point: the WHERE
-- clause below IS the rule, and it is the only way in.

create or replace view sales_team_figures as
with me_row as (
  select e.id, e.company, e.department
    from employees e
   where e.id = me() and e.active
),
-- The invoice side, aggregated. Counts and balances only: no client, no
-- invoice number, no line anybody could read a deal off.
inv as (
  select coalesce(i.filed_under, i.consultant) as employee_id,
         i.year, i.quarter,
         count(*)                       as invoices,
         coalesce(sum(i.balance), 0)    as outstanding
    from sales_invoices i
   where coalesce(i.filed_under, i.consultant) is not null
   group by 1, 2, 3
)
select c.employee_id,
       e.full_name,
       e.department,
       c.company,
       c.year,
       c.quarter,
       coalesce((c.figures->>'netTot')::numeric,  0) as net_tot,
       coalesce((c.figures->>'totElig')::numeric, 0) as tot_elig,
       coalesce((c.figures->>'notColl')::numeric, 0) as not_coll,
       coalesce((c.figures->>'forf')::numeric,    0) as forf,
       coalesce((c.figures->>'newInv')::numeric,  0)
     + coalesce((c.figures->>'exInv')::numeric,   0)
     + coalesce((c.figures->>'pmInv')::numeric,   0) as invoiced,
       coalesce((c.figures->>'newCost')::numeric, 0)
     + coalesce((c.figures->>'exCost')::numeric,  0)
     + coalesce((c.figures->>'pmCost')::numeric,  0) as costs,
       coalesce(inv.invoices, 0)    as invoices,
       coalesce(inv.outstanding, 0) as outstanding
  from sales_commission c
  join employees e on e.id = c.employee_id
  left join inv on inv.employee_id = c.employee_id
                and inv.year = c.year and inv.quarter = c.quarter
 where exists (
         select 1 from me_row m
          where m.company = e.company
            and m.department is not null and m.department <> ''
            and m.department = e.department
       );

grant select on sales_team_figures to authenticated;

-- ------------------------------------------------------------------- check
-- 1. The view has no commission in it. This is the whole point, so it is
--    asserted rather than trusted.
do $$
declare leaked text;
begin
  select string_agg(column_name, ', ') into leaked
    from information_schema.columns
   where table_name = 'sales_team_figures'
     and column_name ~* 'comm|paid|bal|rate|band|earn'
     and column_name not in ('outstanding');
  if leaked is not null then
    raise exception 'the team view exposes %, which is exactly what it exists to avoid', leaked;
  end if;
end $$;

-- 2. What it holds, and the columns it holds them in.
select column_name, data_type
  from information_schema.columns
 where table_name = 'sales_team_figures'
 order by ordinal_position;

-- 3. The policies it did not touch.
select polrelid::regclass as "table", polname, pg_get_expr(polqual, polrelid) as rule
  from pg_policy
 where polrelid in ('sales_commission'::regclass, 'sales_invoices'::regclass)
   and polname in ('read_commission', 'read_invoices')
 order by 1;
