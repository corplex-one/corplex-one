-- Everybody has somebody to send a request to.
--
-- Avin, on the sheet against Shifts and reporting lines: 'All those are
-- marked nobody, report to Miraziz, the CEO.'
--
-- employees.manager_id is null for most of the live staff, so the second
-- column of that screen reads Nobody — and a leave or work-from-home request
-- from somebody with no manager has nowhere to go. This fills the blanks with
-- the owner, which is what Avin said the answer is, and touches nobody who
-- already has a line.
--
-- IT DOES NOT OVERWRITE ANYTHING. Only rows where manager_id is null change.
-- Run the SELECT first, read the list, then run the UPDATE.
--
-- Run after 0036_leave_kinds.sql. Safe to run again — the second time it
-- changes nothing, because there is nothing left to fill.

-- ---------------------------------------------------------------- 1. look
-- Who has no reporting line today, and who they would be given.
select 'would be given a reporting line' as what,
       e.full_name,
       (select full_name from employees o
          join employee_roles r on r.employee_id = o.id and r.role = 'owner'
         limit 1) as would_report_to
  from employees e
 where e.manager_id is null
   and e.id <> (select o.id from employees o
                  join employee_roles r on r.employee_id = o.id and r.role = 'owner'
                 limit 1)
 order by e.full_name;

-- And who already has one, so it is clear what is being left alone.
select 'already has a reporting line' as what,
       e.full_name, m.full_name as reports_to
  from employees e join employees m on m.id = e.manager_id
 order by m.full_name, e.full_name;

-- --------------------------------------------------------------- 2. fill
-- The owner does not report to himself, so he is excluded by name rather than
-- left to be caught by a constraint that does not exist.
do $$
declare v_owner uuid;
begin
  select o.id into v_owner
    from employees o join employee_roles r on r.employee_id = o.id and r.role = 'owner'
   limit 1;

  if v_owner is null then
    raise exception 'No owner is recorded, so there is nobody to point the blanks at.';
  end if;

  update employees
     set manager_id = v_owner
   where manager_id is null
     and id <> v_owner;

  raise notice 'reporting lines filled: %', (
    select count(*) from employees where manager_id = v_owner);
end $$;

-- --------------------------------------------------------------- 3. check
select 'still without a reporting line' as what, count(*) as people
  from employees where manager_id is null;
