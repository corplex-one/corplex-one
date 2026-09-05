-- The five kinds of leave the database could not hold, and the one the law
-- gives that the portal did not offer.
--
-- Found while adding study leave, and much worse than the thing I was adding.
--
-- leave_requests.kind is an enum, req_kind, with six values: annual, sick,
-- unpaid, birthday, wfh, offsite. The portal has always offered ten kinds —
-- bereavement, maternity, paternity, Hajj and Umrah among them — and boot.js
-- mapped the six it knew and fell through to 'annual' for everything else:
--
--     kind: KIND[r.type] || 'annual'
--
-- So a request for Hajj leave was stored as annual leave. Not refused, not
-- flagged: silently recorded as the one kind of leave that comes off the
-- balance, on a screen that had just told the person it would not. Thirty
-- days of unpaid Hajj would have taken thirty days of annual leave off
-- somebody, and the only trace would have been a balance nobody could
-- explain.
--
-- Nothing in the portal caught it because every test raised annual or sick.
--
-- WHAT THIS DOES
--   * adds the six missing values to req_kind
--   * reports any row that may have been mis-stored, so it can be looked at
--     rather than assumed
--
-- The matching change in boot.js drops the '|| annual' fallback: a kind the
-- app does not recognise now fails loudly instead of quietly becoming the
-- one with money attached.
--
-- Run after 0035_currency_and_edits.sql. Safe to run again.
--
-- NOTE: each ALTER TYPE ... ADD VALUE runs on its own, outside a transaction,
-- because Postgres will not let a value be added and used in the same one.
-- Run the whole file; do not wrap it in BEGIN/COMMIT.

alter type req_kind add value if not exists 'bereavement';
alter type req_kind add value if not exists 'maternity';
alter type req_kind add value if not exists 'paternity';
alter type req_kind add value if not exists 'hajj';
alter type req_kind add value if not exists 'umrah';
alter type req_kind add value if not exists 'study';

-- What is on the books now. Every one of these is either a real annual leave
-- request or one of the five that had nowhere else to go; the reason line is
-- the only thing that tells them apart, so they are listed rather than
-- guessed at.
select 'leave on file, by kind' as what, kind, count(*) as rows
  from leave_requests group by 2 order by 3 desc;

select 'annual requests worth a second look' as what,
       e.full_name, r.ref, r.from_date, r.to_date, r.days, r.reason
  from leave_requests r join employees e on e.id = r.employee_id
 where r.kind = 'annual'
   and (r.reason ilike '%hajj%' or r.reason ilike '%umrah%'
     or r.reason ilike '%matern%' or r.reason ilike '%patern%'
     or r.reason ilike '%bereave%' or r.reason ilike '%funeral%'
     or r.reason ilike '%exam%' or r.reason ilike '%stud%')
 order by r.from_date;
