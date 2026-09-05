-- A director's remuneration, and taking a salary back off somebody.
--
-- Three things Avin found on the On payroll screen, all of them the same
-- shape: the portal only had words for two kinds of pay.
--
--   'Mirazizbek Makhamatzhanov - should be 25k each from both POA and
--    Corplex ... And its not commission, its directors remuneration'
--   'refreshing the records have not fetched amounts into payroll of Miraziz'
--   'Fakhridin Kochkorov - should be commission only'
--
-- The two are one fault. Miraziz was recorded as 'commission', and the
-- generator's very first branch is: if somebody is on commission, write a
-- line of nought and move on WITHOUT looking at their salary at all. His two
-- 25,000s were sitting in salary_parts being correctly ignored, which is why
-- refreshing the month never fetched them. He is not on commission; he draws
-- a director's remuneration from each of two companies.
--
-- 'director' is added as a third basis rather than filing him under
-- 'salaried', because the two are not the same thing and the difference shows
-- up in places that matter — a director's remuneration is not wages, it is
-- not what a salary certificate describes, and gratuity does not accrue on
-- it. The generator needs no change: its only special case is 'commission',
-- so anything else is paid from the salary rows, which is exactly right.
--
-- And Fakhridin is the mirror image. He is correctly marked commission only,
-- and still has 6,000 on file from before, which the screen shows next to the
-- words "commission only" — a contradiction with no way to resolve it,
-- because record_salary deliberately refuses to overwrite and there was
-- nothing at all to remove one. clear_salary is that missing half.
--
-- Run after 0040_on_payroll.sql. Safe to run again.
--
-- NOTE ON RUNNING IT: the first statement adds a value to an enum, and
-- Postgres will not let a new enum value be USED in the same transaction that
-- adds it. The SQL editor runs the whole file as one transaction, so that
-- matters here.
--
-- The function bodies below are safe: they are stored, not executed, and by
-- the time anybody calls them this has long committed. The checks at the
-- foot of the file are NOT — they are ordinary queries, run now, and the
-- first version of this file compared payroll_basis against 'director' in
-- one of them, which is exactly the case the rule forbids:
--
--   ERROR: unsafe use of new value "director" of enum type pay_basis
--
-- They compare payroll_basis::text instead. Text against text never touches
-- the new value, so the whole file goes through in one go.

alter type pay_basis add value if not exists 'director';

comment on type pay_basis is
  'How somebody is paid: salaried (a fixed wage), director (a director''s remuneration, '
  'paid from the salary rows but not wages and no gratuity), commission (no fixed pay), '
  'off (not on payroll at all).';

-- ================================================ the basis, with a third

create or replace function set_payroll_basis(p_emp uuid, p_basis text,
                                             p_paid_by text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare e employees; v_basis pay_basis; v_rows int;
begin
  if not is_admin() then raise exception 'Only accounts decide who is on payroll.'; end if;
  select * into e from employees where id = p_emp;
  if e.id is null then raise exception 'No such person.'; end if;
  if p_basis not in ('salaried','director','commission','off') then
    raise exception '"%" is not a payroll basis. It is salaried, director, commission or off.', p_basis; end if;
  v_basis := p_basis::pay_basis;

  -- Taking somebody off payroll while a month that pays them is still open is
  -- how a run ends up disagreeing with itself.
  if v_basis = 'off' then
    select count(*) into v_rows
      from payroll_lines l
      join payroll_runs r on r.id = l.run_id
     where l.employee_id = p_emp and r.status <> 'closed'
       and not coalesce(l.excluded, false);
    if v_rows > 0 then
      raise exception '% is on a payroll month that is still open. Take them off that run, or close it, before taking them off payroll.',
        e.full_name;
    end if;
  end if;

  -- Both of the kinds that are paid from the salary rows need one to read.
  -- Without it the generator writes a line of nought, which reads as a
  -- mistake and is one.
  if v_basis in ('salaried','director')
     and not exists (select 1 from salary_parts s where s.employee_id = p_emp) then
    raise exception 'There is no salary on file for %. Record one first, then set them to % .',
      e.full_name, p_basis;
  end if;

  update employees
     set payroll_basis = v_basis,
         paid_by = case when p_paid_by is null then paid_by
                        when btrim(p_paid_by) = '' then null
                        else p_paid_by end
   where id = p_emp;

  return json_build_object('id', p_emp, 'name', e.full_name, 'basis', p_basis);
end $$;

-- ==================================================== taking one back off

create or replace function clear_salary(p_emp uuid, p_company text)
returns json
language plpgsql security definer set search_path = public as $$
declare e employees; v_co text := coalesce(p_company, ''); v_n int; v_open int;
begin
  if not is_admin() then raise exception 'Only accounts change what is on file.'; end if;
  select * into e from employees where id = p_emp;
  if e.id is null then raise exception 'No such person.'; end if;

  -- The guard that makes this safe to offer at all. Somebody paid FROM their
  -- salary rows must keep them; this is only for clearing a figure left on
  -- somebody who is not paid from it.
  if e.payroll_basis in ('salaried','director') then
    raise exception '% is paid from what is on file (%). Clearing it would leave the month with nothing to pay. Move them to commission only or off payroll first.',
      e.full_name, e.payroll_basis;
  end if;

  -- And it must not be pulled out from under a month still being worked on.
  select count(*) into v_open
    from payroll_lines l join payroll_runs r on r.id = l.run_id
   where l.employee_id = p_emp and r.status <> 'closed'
     and not coalesce(l.excluded, false) and coalesce(l.salary, 0) > 0;
  if v_open > 0 then
    raise exception 'A payroll month that is still open pays % a salary. Refresh or close that month first.',
      e.full_name;
  end if;

  delete from salary_parts s
   where s.employee_id = p_emp and coalesce(s.company, '') = v_co;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'There was nothing on file for % to clear.', e.full_name; end if;

  -- A revision letter that moved this salary stays exactly where it is. The
  -- letter went out and the person has a copy; a portal that quietly unwrote
  -- its own correspondence would be worse than one that shows a stale figure.
  return json_build_object('id', p_emp, 'name', e.full_name, 'company', v_co, 'removed', v_n);
end $$;

revoke all on function clear_salary(uuid, text) from public;
grant execute on function clear_salary(uuid, text) to authenticated;

-- ------------------------------------------------------------------- check
-- Every comparison here is against payroll_basis::text, not the enum. See the
-- note at the top: a value added in this same transaction cannot be used as
-- an enum literal yet, and these run before the transaction commits.
select 'by basis' as what, payroll_basis::text as basis, count(*)
  from employees where active group by payroll_basis order by 2;
select 'commission-only people who still have a salary on file' as what, e.full_name
  from employees e join salary_parts s on s.employee_id = e.id
 where e.active and e.payroll_basis::text = 'commission';
select 'paid from salary rows but with nothing on file' as what, e.full_name
  from employees e
 where e.active and e.payroll_basis::text in ('salaried','director')
   and not exists (select 1 from salary_parts s where s.employee_id = e.id);
