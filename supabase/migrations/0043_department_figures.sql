-- The department's own figures, for the people who earn them.
--
--   Avin: 'I opened Zhavokir account, i was not able to see team leaderboard
--   and department report. he is from sales as well'
--
-- He could not, and it was not a gate. sales_company — the row that holds a
-- department's targets, monthly series, top clients and collection status —
-- has been readable only through sees_company_sales(), which is accounts, the
-- owner, and whoever is on the sales_viewers list. Six people.
--
-- Everything the sales screens draw hangs off that row, including the flag
-- that says whether a company sells through the portal at all. So for a
-- consultant it never arrived, the portal concluded CorpLex had uploaded no
-- sales, and every sales page said so — even the one showing nothing but his
-- own eight commission rows.
--
-- That last part is fixed in the app: your own figures no longer wait on
-- somebody else's permission. This is the other half — the DEPARTMENT figures,
-- which are a real read and have to be granted rather than worked around.
--
-- WHAT THIS OPENS, EXACTLY
--
-- Anybody active in a company may now read that company's sales_company row:
-- net sales, invoiced value, collected and outstanding, the monthly series,
-- the target, the top clients, and the same broken out per department. It is
-- the Department screen, and it is commercial rather than personal — no
-- salary, no commission, no invoice belonging to a named colleague.
--
-- WHAT THIS DOES NOT OPEN
--
-- sales_commission is untouched. Its rule stays your own rows, your reports'
-- rows, or the sales-viewers list — so a consultant still cannot read what a
-- colleague earned, and the Team leaderboard still does not appear for them,
-- because ranking people needs each person's figures.
--
-- Opening that is a separate decision with a separate cost, and it is not
-- taken here: widening sales_commission to the whole company would hand a
-- consultant colleagues' COMMISSION as well as their net sales, hidden on
-- screen but present in what the browser was sent. A leaderboard wants net
-- sales and nothing else, which is a view rather than a policy change.
--
-- Run after 0042_no_gratuity.sql. Safe to run again.

drop policy if exists read_sales_company on sales_company;

create policy read_sales_company on sales_company
  for select to authenticated
  using (
    sees_company_sales(company)
    -- or: this is my own company's figures and I am still here
    or exists (
      select 1 from employees e
       where e.id = me() and e.active and e.company = sales_company.company
    )
  );

-- ------------------------------------------------------------------- check
-- Every active person can now see their own company's figures, and nobody
-- gains a colleague's commission row.
select 'sales_company readable by' as what, count(*) as people
  from employees e
 where e.active and e.auth_user_id is not null
   and exists (select 1 from sales_company s where s.company = e.company);

select 'commission rules unchanged' as what,
       pg_get_expr(polqual, polrelid) as rule
  from pg_policy where polrelid = 'sales_commission'::regclass and polname = 'read_commission';
