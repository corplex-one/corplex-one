-- Putting somebody who is already on the staff list onto payroll.
--
--   Avin: 'Mukhamad Musulmonkulov should be on payroll - just like Fakriddin'
--
-- He is on the staff list, active, in Sales, with payroll_basis 'off' and no
-- salary row at all, so the generator skips him and always has. Fakhridin,
-- beside him, is 'commission' with a salary row of 6,000. Nothing was wrong
-- with the portal's arithmetic; the two men were simply recorded differently
-- and there was no screen to say so.
--
-- Payroll basis could only ever be set at the moment somebody was added.
-- After that there was no way to move a person onto payroll, off it, or from
-- commission to a salary, short of the SQL editor. These two functions are
-- that missing screen's other half.
--
-- The split between them is deliberate and it is the important part of this
-- file. A salary is moved by a revision letter and by nothing else — that is
-- the whole point of the letter, and a free-typing salary box on some console
-- screen would quietly undo it. So:
--
--   set_payroll_basis   whether a person is paid at all, and by whom.
--                       Touches no figure.
--   record_salary       writes an OPENING salary, and only where there is
--                       none. It refuses to overwrite one. Changing a salary
--                       that exists is a revision, and the error says so.
--
-- Run after 0039_staff_records.sql. Safe to run again.

-- ============================================================== the basis

create or replace function set_payroll_basis(p_emp uuid, p_basis text,
                                             p_paid_by text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare e employees; v_basis pay_basis; v_rows int;
begin
  if not is_admin() then raise exception 'Only accounts decide who is on payroll.'; end if;
  select * into e from employees where id = p_emp;
  if e.id is null then raise exception 'No such person.'; end if;
  if p_basis not in ('salaried','commission','off') then
    raise exception '"%" is not a payroll basis. It is salaried, commission or off.', p_basis; end if;
  v_basis := p_basis::pay_basis;

  -- Taking somebody off payroll while a month that pays them is still open is
  -- how a run ends up disagreeing with itself. Close it or take them off the
  -- run first.
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

  -- A salaried person with nothing on file would generate a line of nought,
  -- which reads as a mistake and is one.
  if v_basis = 'salaried'
     and not exists (select 1 from salary_parts s where s.employee_id = p_emp) then
    raise exception 'There is no salary on file for %. Record one first, then set them to salaried.',
      e.full_name;
  end if;

  update employees
     set payroll_basis = v_basis,
         paid_by = case when p_paid_by is null then paid_by
                        when btrim(p_paid_by) = '' then null
                        else p_paid_by end
   where id = p_emp;

  return json_build_object('id', p_emp, 'name', e.full_name, 'basis', p_basis);
end $$;

-- ====================================================== the opening salary

create or replace function record_salary(p_emp uuid, p_company text,
                                         p_basic numeric, p_allowance numeric,
                                         p_from date)
returns json
language plpgsql security definer set search_path = public as $$
declare e employees; v_total numeric; v_co text := coalesce(p_company, ''); v_have record;
begin
  if not is_admin() then raise exception 'Only accounts record a salary.'; end if;
  select * into e from employees where id = p_emp;
  if e.id is null then raise exception 'No such person.'; end if;
  if p_basic is null or p_allowance is null then
    raise exception 'A salary needs a basic and an allowance, even if one of them is nought.'; end if;
  if p_basic < 0 or p_allowance < 0 then
    raise exception 'A negative figure is not allowed.'; end if;
  if p_from is null then raise exception 'A salary needs a date it starts from.'; end if;
  if v_co <> '' and not exists (select 1 from companies c where c.key = v_co) then
    raise exception '"%" is not one of the companies.', v_co; end if;

  -- The one rule this function exists to keep. A salary that is already on
  -- file moves by letter, so that there is always a document behind a figure
  -- somebody is paid.
  select s.salary, s.effective_from into v_have
    from salary_parts s
   where s.employee_id = p_emp and coalesce(s.company, '') = v_co
   order by s.effective_from desc limit 1;
  if v_have.salary is not null then
    raise exception '% already has % on file from %. A salary that exists is moved by a revision letter, not typed over.',
      e.full_name, to_char(v_have.salary, 'FM999G999D00'), to_char(v_have.effective_from, 'DD Mon YYYY');
  end if;

  v_total := round(p_basic + p_allowance, 2);
  insert into salary_parts(employee_id, company, salary, basic, allowance,
                           effective_from, source, updated_at)
  values (p_emp, v_co, v_total, p_basic, p_allowance, p_from,
          'Recorded by accounts, ' || to_char(current_date, 'DD Mon YYYY'), now());

  return json_build_object('id', p_emp, 'name', e.full_name, 'company', v_co,
    'salary', v_total, 'from', p_from);
end $$;

revoke all on function set_payroll_basis(uuid, text, text)              from public;
revoke all on function record_salary(uuid, text, numeric, numeric, date) from public;
grant execute on function set_payroll_basis(uuid, text, text),
                          record_salary(uuid, text, numeric, numeric, date)
  to authenticated;

-- ------------------------------------------------------------------- check
select 'on payroll'      as what, count(*) from employees where active and payroll_basis <> 'off';
select 'not on payroll'  as what, count(*) from employees where active and payroll_basis = 'off';
select 'salaried but with nothing on file' as what, e.full_name
  from employees e
 where e.active and e.payroll_basis = 'salaried'
   and not exists (select 1 from salary_parts s where s.employee_id = e.id);
select 'paid by more than one company' as what, e.full_name,
       count(distinct coalesce(s.company,'')) as companies
  from employees e join salary_parts s on s.employee_id = e.id
 group by e.full_name having count(distinct coalesce(s.company,'')) > 1;
