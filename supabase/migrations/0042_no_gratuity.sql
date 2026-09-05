-- Who no end-of-service provision is held for.
--
--   Avin: 'Miraziz and Abdunosir has no gratuity.'
--
-- The provision workbook already holds nothing for either of them, so the
-- accounts have been right all along. What was not right was the list the
-- FINAL SETTLEMENT reads: exitCalc works gratuity out from the basic and the
-- joining date unless the person is on no_gratuity, and neither of them was.
-- Nobody has noticed because neither has left; the first settlement drafted
-- for either would have quietly computed a figure nobody owes.
--
-- Miraziz draws a director's remuneration rather than wages (0041), and
-- gratuity accrues on wages. Abdunosir is on the staff list and in the
-- organisation but is not on payroll at all — there is no basic for anything
-- to accrue on.
--
-- Merged into whatever the list holds rather than replacing it, so a name
-- added through the portal since is not thrown away, and so that running this
-- twice changes nothing the second time.

update settings
   set value = (
     select jsonb_agg(distinct n order by n)
       from jsonb_array_elements_text(
              value || '["Miraziz Makhamatzhanov","Abdunosir Kadirov"]'::jsonb) as t(n)),
       note = 'No end-of-service provision is held for these, and no final settlement '
              'computes gratuity for them. Directors draw a remuneration rather than '
              'wages; others are not on payroll, or are paid on a basis that does not accrue.'
 where key = 'no_gratuity';

insert into settings(key, value, note)
select 'no_gratuity', '["Miraziz Makhamatzhanov","Abdunosir Kadirov"]'::jsonb,
       'No end-of-service provision is held for these.'
 where not exists (select 1 from settings where key = 'no_gratuity');

-- ------------------------------------------------------------------- check
select 'no gratuity is held for' as what, jsonb_array_elements_text(value) as who
  from settings where key = 'no_gratuity' order by 2;

-- Anybody on that list who nevertheless has a provision row in the workbook
-- would be the two records disagreeing, which is worth seeing rather than
-- assuming away.
select 'on the list but still provided for in the workbook' as what, g.name
  from gratuity_rows g
 where g.name in (select jsonb_array_elements_text(value)
                    from settings where key = 'no_gratuity');
