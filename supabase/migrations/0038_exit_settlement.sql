-- The exit, from a calculation to money out of the bank.
--
-- Avin: 'With the current process, there is a chance that we might forget to
-- pay final settlement if it does on the last day of the month.'
--
-- He is right, and the reason is that the Exits screen has never been more
-- than a calculator. It works out what somebody is owed and remembers
-- nothing: no record, no frozen figure, nobody told, and the person stays on
-- the payroll and stays signed in. Everything after the arithmetic happens
-- outside the portal and can therefore be forgotten inside it.
--
-- What this adds:
--
--   a settlement that is SAVED, and can be changed until it is initiated
--   free lines for the things the portal cannot know - a bonus, a commission,
--     a laptop that did not come back
--   a FREEZE at initiate, so a figure somebody signs a declaration for cannot
--     be moved afterwards by a salary revision or another month of accrual
--   a place on the month of the last working day, open or closed, sitting
--     beside the payroll run rather than inside it
--   an approval chain - the reporting manager, then the owner, collapsing to
--     one step where they are the same person
--   one road back: undo and sent-back both return it to draft, unfreeze the
--     figures and put the person back on the run
--   the employee marked inactive and taken off that month's run at initiate,
--     with every record they have kept
--
-- Run after 0037_reporting_lines.sql. Safe to run again.

-- ================================================================== the exit

alter table exits add column if not exists settled_on   date;
alter table exits add column if not exists pay_month    text;
alter table exits add column if not exists frozen       jsonb;
alter table exits add column if not exists net          numeric(12,2);
alter table exits add column if not exists manager_id   uuid references employees(id);
alter table exits add column if not exists mgr_ok_at    timestamptz;
alter table exits add column if not exists mgr_ok_by    uuid references employees(id);
alter table exits add column if not exists owner_ok_at  timestamptz;
alter table exits add column if not exists owner_ok_by  uuid references employees(id);
alter table exits add column if not exists back_why     text;
alter table exits add column if not exists back_at      timestamptz;
alter table exits add column if not exists back_by      uuid references employees(id);
alter table exits add column if not exists pay_mode     text;
alter table exits add column if not exists decided_at   timestamptz;
alter table exits add column if not exists paid_on      date;
alter table exits add column if not exists created_by   uuid references employees(id);
alter table exits add column if not exists updated_at   timestamptz not null default now();

-- The six stages of the bar, plus the two ways out. 'Open' was the old default
-- and means the same thing as a draft.
update exits set status = 'draft' where status is null or status = 'Open';
alter table exits alter column status set default 'draft';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'exits_status_ck') then
    alter table exits add constraint exits_status_ck check (status in
      ('draft','initiated','mgr_ok','owner_ok','decided','paid','withdrawn'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exits_paymode_ck') then
    alter table exits add constraint exits_paymode_ck check
      (pay_mode is null or pay_mode in ('with_salaries','separate'));
  end if;
end $$;

-- One open settlement per person. A second one is a mistake rather than a
-- case: somebody leaves once, and if they come back they are a new joiner.
create unique index if not exists exits_one_open
  on exits (employee_id) where status not in ('paid','withdrawn');

create index if not exists exits_by_month on exits (pay_month)
  where status not in ('draft','withdrawn');

-- ------------------------------------------------------- the lines you add
-- A description and an amount, and whether it adds or takes away. Deliberately
-- free text: 'Q3 commission' and 'laptop not returned' are both real and no
-- list I write today would hold both.
create table if not exists exit_lines (
  id       uuid primary key default gen_random_uuid(),
  exit_id  uuid not null references exits(id) on delete cascade,
  label    text not null,
  amount   numeric(12,2) not null default 0,
  deduct   boolean not null default false,
  sort     integer not null default 0
);
create index if not exists exit_lines_by_exit on exit_lines (exit_id);

alter table exits      enable row level security;
alter table exit_lines enable row level security;

-- Accounts writes them. The person they are about may READ their own, but only
-- once it has left draft - a settlement being worked on is not something to
-- show somebody before it is agreed.
drop policy if exists admin_exits on exits;
create policy admin_exits on exits for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists read_own_exit on exits;
create policy read_own_exit on exits for select to authenticated
  using (employee_id = me() and status not in ('draft','withdrawn'));

drop policy if exists admin_exit_lines on exit_lines;
create policy admin_exit_lines on exit_lines for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists read_own_exit_lines on exit_lines;
create policy read_own_exit_lines on exit_lines for select to authenticated
  using (exists (select 1 from exits x where x.id = exit_id
                   and x.employee_id = me() and x.status not in ('draft','withdrawn')));

-- The approvers have to be able to see the one waiting on them, and to move it.
-- Reading is wider than writing on purpose: a manager sees the settlement, and
-- the RPC below decides whether they may act on it.
drop policy if exists approver_reads_exit on exits;
create policy approver_reads_exit on exits for select to authenticated
  using (manager_id = me() or has_role('owner'));
drop policy if exists approver_reads_exit_lines on exit_lines;
create policy approver_reads_exit_lines on exit_lines for select to authenticated
  using (exists (select 1 from exits x where x.id = exit_id
                   and (x.manager_id = me() or has_role('owner'))));

-- ------------------------------------------------- off the run, not deleted
-- Initiating takes somebody off that month's payroll. Deleting the line would
-- lose what was already worked out for them, and sending the settlement back
-- would have nothing to restore. So the line stays and is marked, and every
-- reader skips it - which is also what makes undo possible.
alter table payroll_lines add column if not exists excluded boolean not null default false;

-- ============================================================ the state machine
--
-- Every move is a function rather than an update, so the stages cannot be
-- driven into an order they do not have. Security definer, guarded inside.

create or replace function exit_save(
  p_exit uuid, p_employee uuid, p_last_day date, p_settled date,
  p_reason text, p_notes text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_line jsonb; v_i int := 0;
begin
  if not is_admin() then raise exception 'Only accounts may write a settlement'; end if;

  if p_exit is null then
    -- A raw unique-violation reaches the screen as a wall of SQL naming a
    -- constraint and a UUID. Somebody looking at it wants to be told there is
    -- already one open for that person.
    if exists (select 1 from exits where employee_id = p_employee
                 and status not in ('paid','withdrawn')) then
      raise exception '% already has a settlement in progress. Open that one instead.',
        coalesce((select full_name from employees where id = p_employee), 'That person');
    end if;
    insert into exits(employee_id, last_day, settled_on, reason, notes, status, created_by)
    values (p_employee, p_last_day, coalesce(p_settled, p_last_day), p_reason, p_notes,
            'draft', me())
    returning id into v_id;
  else
    select id into v_id from exits where id = p_exit;
    if v_id is null then raise exception 'That settlement is no longer there'; end if;
    if (select status from exits where id = v_id) <> 'draft' then
      raise exception 'This settlement has been initiated. Undo it first.';
    end if;
    update exits set employee_id = p_employee, last_day = p_last_day,
                     settled_on = coalesce(p_settled, p_last_day),
                     reason = p_reason, notes = p_notes, updated_at = now()
     where id = v_id;
  end if;

  delete from exit_lines where exit_id = v_id;
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_i := v_i + 1;
    insert into exit_lines(exit_id, label, amount, deduct, sort)
    values (v_id, coalesce(v_line->>'label',''),
            coalesce((v_line->>'amount')::numeric, 0),
            coalesce((v_line->>'deduct')::boolean, false), v_i);
  end loop;

  return v_id;
end $$;

-- Freezing. The figures are worked out in the browser from the same data the
-- screen shows, and handed here to be written down as they stood. That is the
-- point of a freeze: not to recompute, but to stop recomputing.
create or replace function exit_initiate(p_exit uuid, p_frozen jsonb, p_net numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v exits; v_owner uuid; v_mgr uuid; v_month text;
begin
  if not is_admin() then raise exception 'Only accounts may initiate an exit'; end if;
  select * into v from exits where id = p_exit;
  if v.id is null then raise exception 'That settlement is no longer there'; end if;
  if v.status <> 'draft' then raise exception 'This settlement has already been initiated'; end if;
  if p_net is null then raise exception 'A settlement needs a figure before it can be initiated'; end if;

  select o.id into v_owner from employees o
    join employee_roles r on r.employee_id = o.id and r.role = 'owner' limit 1;
  select manager_id into v_mgr from employees where id = v.employee_id;
  -- Where somebody has no reporting line, the owner is the only approver, which
  -- is the same collapse as a manager who IS the owner.
  if v_mgr is null then v_mgr := v_owner; end if;

  v_month := to_char(v.last_day, 'YYYY-MM');

  update exits set status = 'initiated', frozen = p_frozen, net = p_net,
                   pay_month = v_month, manager_id = v_mgr,
                   back_why = null, back_at = null, back_by = null,
                   updated_at = now()
   where id = p_exit;

  -- Off the payroll and off the staff list, without losing anything. The last
  -- day goes on the employee record as well, because the sign-in has to know
  -- it: somebody initiated on the 12th for a leaver on the 30th must keep
  -- working normally until the 30th, and be turned away on the 31st.
  update employees set active = false, last_day = v.last_day where id = v.employee_id;
  update payroll_lines l set excluded = true
    from payroll_runs r
   where l.run_id = r.id and l.employee_id = v.employee_id and r.month_key = v_month;
end $$;

-- One road back. Undo by accounts and sent-back by an approver are the same
-- move, so there is one thing to get right and one thing to test.
create or replace function exit_send_back(p_exit uuid, p_why text)
returns void language plpgsql security definer set search_path = public as $$
declare v exits;
begin
  select * into v from exits where id = p_exit;
  if v.id is null then raise exception 'That settlement is no longer there'; end if;
  if v.status in ('draft','withdrawn','paid') then
    raise exception 'There is nothing to send back'; end if;
  if not (is_admin() or v.manager_id = me() or has_role('owner')) then
    raise exception 'This is not yours to send back'; end if;

  update exits set status = 'draft', frozen = null, net = null, pay_month = null,
                   mgr_ok_at = null, mgr_ok_by = null,
                   owner_ok_at = null, owner_ok_by = null,
                   pay_mode = null, decided_at = null,
                   back_why = p_why, back_at = now(), back_by = me(),
                   updated_at = now()
   where id = p_exit;

  -- back on the staff list, back on the run, and no longer leaving
  update employees set active = true, last_day = null where id = v.employee_id;
  update payroll_lines l set excluded = false
    from payroll_runs r
   where l.run_id = r.id and l.employee_id = v.employee_id and r.month_key = v.pay_month;
end $$;

create or replace function exit_withdraw(p_exit uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v exits;
begin
  if not is_admin() then raise exception 'Only accounts may withdraw a settlement'; end if;
  select * into v from exits where id = p_exit;
  if v.id is null then raise exception 'That settlement is no longer there'; end if;
  if v.status = 'paid' then raise exception 'A settlement that has been paid cannot be withdrawn'; end if;

  update exits set status = 'withdrawn', updated_at = now() where id = p_exit;
  -- somebody who is not leaving after all is still an employee
  update employees set active = true, last_day = null where id = v.employee_id;
  update payroll_lines l set excluded = false
    from payroll_runs r
   where l.run_id = r.id and l.employee_id = v.employee_id
     and r.month_key = coalesce(v.pay_month, '');
end $$;

-- Approving. Who you are decides which stamp you leave, and the two stages
-- collapse into one where the manager is the owner.
create or replace function exit_approve(p_exit uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v exits; v_owner boolean; v_mgr boolean; v_next text;
begin
  select * into v from exits where id = p_exit;
  if v.id is null then raise exception 'That settlement is no longer there'; end if;
  v_owner := has_role('owner');
  v_mgr   := v.manager_id = me();
  if not (v_owner or v_mgr) then raise exception 'This is not yours to approve'; end if;

  if v.status = 'initiated' and v_mgr then
    -- the manager who is also the owner clears both stages at once
    if v_owner then
      update exits set status = 'owner_ok', mgr_ok_at = now(), mgr_ok_by = me(),
                       owner_ok_at = now(), owner_ok_by = me(), updated_at = now()
       where id = p_exit;
      v_next := 'owner_ok';
    else
      update exits set status = 'mgr_ok', mgr_ok_at = now(), mgr_ok_by = me(), updated_at = now()
       where id = p_exit;
      v_next := 'mgr_ok';
    end if;
  elsif v.status in ('initiated','mgr_ok') and v_owner then
    update exits set status = 'owner_ok',
                     mgr_ok_at = coalesce(mgr_ok_at, now()),
                     mgr_ok_by = coalesce(mgr_ok_by, me()),
                     owner_ok_at = now(), owner_ok_by = me(), updated_at = now()
     where id = p_exit;
    v_next := 'owner_ok';
  else
    raise exception 'This settlement is not waiting on you';
  end if;
  return v_next;
end $$;

create or replace function exit_decide(p_exit uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only accounts decides how it is paid'; end if;
  if p_mode not in ('with_salaries','separate') then raise exception 'Unknown way to pay'; end if;
  if (select status from exits where id = p_exit) <> 'owner_ok' then
    raise exception 'This settlement has not been approved yet'; end if;
  update exits set status = 'decided', pay_mode = p_mode, decided_at = now(), updated_at = now()
   where id = p_exit;
end $$;

create or replace function exit_paid(p_exit uuid, p_on date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only accounts marks a settlement paid'; end if;
  if (select status from exits where id = p_exit) <> 'decided' then
    raise exception 'Decide how it is paid first'; end if;
  update exits set status = 'paid', paid_on = coalesce(p_on, current_date), updated_at = now()
   where id = p_exit;
end $$;

-- ==================================================== the month cannot close
--
-- Avin: 'Yes' - a month must refuse to close while a settlement on it is
-- unpaid. Everything else in this design is something he would notice; this is
-- the one he cannot get past, which is the whole reason it is here and not in
-- the browser.
create or replace function close_run(p_month text) returns json
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; n int; v_left int; v_who text;
begin
  if not is_accounts() then raise exception 'Only accounts close a payroll month.'; end if;
  select * into r from payroll_runs where month_key = p_month;
  if r.id is null then raise exception 'There is no % run.', p_month; end if;
  if r.status = 'closed' then
    raise exception 'The % run is already closed.', r.label; end if;
  if r.status <> 'initiated' then
    raise exception 'The % run is %. Only a month that has been paid can be closed.', r.label, r.status; end if;

  -- The new half. A settlement posted to this month and not yet paid stops the
  -- month here, because everything else in this design is something Avin would
  -- notice and this is the one he cannot walk past.
  select count(*), string_agg(e.full_name, ', ')
    into v_left, v_who
    from exits x join employees e on e.id = x.employee_id
   where x.pay_month = p_month and x.status not in ('paid','withdrawn');

  if v_left > 0 then
    raise exception '% still has % final settlement% outstanding (%). Pay % first, or send % back to draft.',
      r.label, v_left, case when v_left = 1 then '' else 's' end, v_who,
      case when v_left = 1 then 'it' else 'them' end,
      case when v_left = 1 then 'it' else 'them' end;
  end if;

  update payroll_runs set status = 'closed', closed_at = now() where id = r.id;
  select count(*) into n from payroll_lines where run_id = r.id;

  return json_build_object('run', r.id, 'status', 'closed', 'payslips', n,
    'note', n || ' payslips are now on their own My payslip page.');
end $$;

-- Nothing outside these functions may move a settlement.
revoke all on function exit_save(uuid, uuid, date, date, text, text, jsonb) from public;
revoke all on function exit_initiate(uuid, jsonb, numeric)  from public;
revoke all on function exit_send_back(uuid, text)           from public;
revoke all on function exit_withdraw(uuid)                  from public;
revoke all on function exit_approve(uuid)                   from public;
revoke all on function exit_decide(uuid, text)              from public;
revoke all on function exit_paid(uuid, date)                from public;
grant execute on function exit_save(uuid, uuid, date, date, text, text, jsonb),
                          exit_initiate(uuid, jsonb, numeric),
                          exit_send_back(uuid, text), exit_withdraw(uuid),
                          exit_approve(uuid), exit_decide(uuid, text),
                          exit_paid(uuid, date) to authenticated;

-- ------------------------------------------------------------------- check
select 'exits' as what, status, count(*) from exits group by status order by status;
select 'lines on settlements' as what, count(*) from exit_lines;
select 'payroll lines excluded' as what, count(*) from payroll_lines where excluded;
