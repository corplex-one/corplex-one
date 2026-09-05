-- Staff documents, and the birthday year.
--
-- Task 3. Two decisions that were made deliberately are being reversed here,
-- on Avin's instruction, and both are worth writing down rather than leaving
-- somebody to find them in a diff.
--
-- ONE. The portal has stored the Emirates ID reference and nothing else. The
-- Documents page told staff so in as many words: "The portal holds the expiry
-- date only. Passport, Emirates ID and visa numbers are deliberately not
-- stored anywhere in it." Avin wants the passport, the residency visa and the
-- labour card held too, so that a gap in somebody's file is visible on one
-- screen instead of being chased through a folder.
--
--   'We can easily track the data missing and ask them to add or we add it
--    here.'
--
-- They join the Emirates ID in employee_private, under exactly the same rule:
-- the person themselves, and accounts. Not a manager, not the owner, not a
-- colleague. They are masked wherever they are drawn, and the sentence quoted
-- above comes off the staff page in the same build, because it will no longer
-- be true and a promise that has quietly stopped holding is worse than one
-- that was never made.
--
-- TWO. The birthday has been held as day and month — '16 Feb' — and the
-- profile promised the person "Only the day and month are kept, never the
-- year." Avin: 'lets keep the year as well, its important for the company,
-- but not shown on profiles if some one views.' So the column starts carrying
-- a year, only accounts may write it, and every screen a colleague sees still
-- shows the day and the month alone.
--
-- Nothing is migrated: the existing entries have no year and none is invented
-- for them. They are filled in by hand, from the passports, which is also why
-- the field becomes accounts' rather than the person's.
--
-- Run after 0038_exit_settlement.sql. Safe to run again.

-- ========================================================== the references

alter table employee_private add column if not exists passport_no text;
alter table employee_private add column if not exists visa_no     text;
alter table employee_private add column if not exists labour_no   text;

comment on column employee_private.emirates_id is
  'Held for payroll, insurance and MOHRE filings. Masked on every screen. Never in an email or a team list.';
comment on column employee_private.passport_no is
  'Held so a gap in somebody''s file is visible. Same rule as the Emirates ID: the person, and accounts.';
comment on column employee_private.visa_no is
  'As passport_no.';
comment on column employee_private.labour_no is
  'As passport_no.';

-- The existing policies on employee_private already say "yourself, and
-- accounts", and these columns are on that table precisely so they inherit it
-- rather than needing a rule of their own. Stated here so a reader does not
-- have to go and check.
--   read_own_private   using (employee_id = me() or is_admin())
--   write_own_private  for all, same test

-- =========================================================== the birthday
--
-- 0015_own_birthday.sql handed the birthday to the employee: it added
-- 'birthday' to the short list of fields the self-edit guard lets a person
-- change on their own row, alongside their preferred name, their photograph,
-- their home country and the quiet-birthday flag. That was right while the
-- field was a day and a month somebody typed about themselves. It is wrong now
-- that it is a date of birth read off a passport and used for gratuity and for
-- MOHRE, so 0015 is reversed here and the list goes back to four.
--
-- This is not belt-and-braces on top of the screen change. Without it the
-- screen would merely have stopped OFFERING the edit while the API still
-- accepted one, and a stale tab or a curious person could overwrite the year
-- accounts had just typed in — silently, because the write would succeed.
--
-- What the employee keeps is the part that is genuinely theirs: whether the
-- birthday is announced at all. quiet_bday stays on the list.

create or replace function guard_employee_self_edit() returns trigger
language plpgsql set search_path = public as $$
begin
  -- seeding, the admin API and the SQL editor do not come in as `authenticated`;
  -- this guard is only for a person editing their own row through the app.
  if current_user <> 'authenticated' then return new; end if;
  if is_admin() then return new; end if;
  if new.id is distinct from old.id then raise exception 'not permitted'; end if;
  new := old
    #= hstore(array['call_me','photo_url','quiet_bday','home_country'],
              array[new.call_me, new.photo_url, new.quiet_bday::text, new.home_country]);
  return new;
end $$;

-- The column comment on the table still says "no year, on purpose", which
-- stopped being true above. Replaced rather than left to contradict itself.
comment on column employees.birthday is
  'Day and month, and from Sep 2026 the year as well - "16 Feb 1991". Set by accounts only. '
  'Colleagues are shown the day and month alone, everywhere.';

-- ------------------------------------------------------------------- check
select 'people with a birthday on file'  as what, count(*) from employees where birthday is not null;
select 'of those, with a year'           as what, count(*) from employees
  where birthday ~ '[0-9]{4}$';
select 'references held'                 as what,
       count(*) filter (where emirates_id is not null) as emirates_id,
       count(*) filter (where passport_no is not null) as passport,
       count(*) filter (where visa_no     is not null) as visa,
       count(*) filter (where labour_no   is not null) as labour
  from employee_private;
