-- ============================================================================
-- 20261007000004_credentialing_checklist_guidance.sql
-- Backfills the per-question guidance text.
--
-- Why this exists as its own migration: 20261007000003 was applied to
-- production by hand, through a SQL editor, and the long guidance strings did
-- not survive the journey — a broken string literal turned the words after it
-- into table names, and the only version that pasted reliably was a stripped
-- ASCII one carrying the questions and their authorities but no guidance.
--
-- So production has all 34 questions and the rules they cite, and most of them
-- have no "why, and where to look" text. This closes that gap by code, which
-- is stable across both versions.
--
-- Idempotent and safe to re-run: it sets the text rather than inserting rows,
-- and it only touches the one template.
-- ============================================================================

update credentialing.checklist_item i
set guidance = v.guidance
from (values
    ('nec_conservative', 'Offloading, debridement, moisture management, compression where indicated, infection control. A skin substitute is for a wound that has not responded, so the record has to show the standard care AND show it not working. Look in the visit notes before the first application.'),
    ('nec_duration', 'A reviewer should not have to infer "chronic" from a run of dates.'),
    ('nec_rationale', 'A product applied without a stated rationale reads to a reviewer as a product applied by default. If no contemporaneous rationale exists, the treating physician can add one as a clearly labelled addendum — dated today, never back-dated.'),
    ('nec_comorbid', 'These decide whether any graft can take. Absent from the record, the reviewer cannot find that the wound was in a state to benefit. ABI, toe pressures, Doppler or a vascular consult; a recent HbA1c.'),
    ('nec_offloading', 'The device, the order, or the dispensing record — DME records or nursing notes, if not the visit note.'),
    ('nec_not_healing', 'The most damaging denial category and the only one no appeal answers, because the contradiction sits in the note itself. This needs the whole episode read, not only the visit being billed. If such a note exists, the claim does not go out until the treating physician has explained in writing why a substitute was indicated anyway.'),
    ('meas_recorded', 'At the visit billed, not at the last one.'),
    ('meas_debridement', 'This decides whether the wound met size criteria and whether the application was sized correctly, so an unlabelled measurement is as good as none. Often recoverable from a separate nursing measurement sheet or a timestamped EMR field.'),
    ('meas_consistent', 'Wound area measured, product size opened, sq cm applied, sq cm discarded, units billed. Build the one-page table — where it reconciles, that table is the rebuttal.'),
    ('meas_photos', 'Jurisdiction-specific. Check the current article for your own MAC; they differ and they are revised often.'),
    ('prod_lot', 'The first thing a reviewer asks for. Usually recoverable even when the chart is silent: the peel-off lot sticker is often taped into the paper chart or scanned as an image, and the supplier can reissue shipment records.'),
    ('prod_ifu', 'The IFU governs preparation, hydration and fixation. Keep a copy with the record.'),
    ('prod_graft_not_dressing', 'A reviewer bills what the note describes, not what the claim says. A note describing the product secured with adhesive strips and a contact layer and calling it a dressing does not support 15271–15278. The fixation method is from the IFU; the wording is the problem, so fix the wording.'),
    ('consent_signed', 'A printed name is not a signature, and a reviewer may disregard an unsigned record entirely.'),
    ('consent_product', 'Fatal on its face if it does not: the patient consented to something other than what was applied and billed. If the consent names a different product, that line is not defensible and should not go out.'),
    ('consent_disease_risk', 'Specific to human tissue products and expected to be disclosed. Check the consent TEMPLATE in force, not just this one form.'),
    ('code_qcode', 'All three have to agree: claim, note, consent.'),
    ('code_jw', 'Wastage is payable but must be documented and justified. The purchasing records decide this one: the argument turns on which sizes the clinic could actually buy.'),
    ('code_jz', 'The JW/JZ choice is itself an assertion a reviewer will check against the note.'),
    ('code_matches_note', 'The general case of the graft-versus-dressing problem. Read the note as a stranger would.'),
    ('rec_signed', 'The cheapest win available. An unsigned note may be treated as no note. A note authored at the time but never signed can be signed now AS A LATE SIGNATURE, with the EMR audit trail proving when the content was written — that combination is legitimate; re-printing with a false date is not.'),
    ('rec_addenda', 'A record that looks back-dated destroys the credibility of the whole file, including the parts that were always good — and invites a fraud referral rather than a payment.'),
    ('liab_abn', 'An ABN does not make a bad claim payable. It decides WHO BEARS THE COST when a claim is denied — without one, that is the provider, not the patient. Ninety seconds.')
) as v(code, guidance)
where i.code = v.code
  and i.template_id = (
      select id from credentialing.checklist_template
      where code = 'skin_substitute_presubmission' and version = 1
  )
  and i.guidance is distinct from v.guidance;
