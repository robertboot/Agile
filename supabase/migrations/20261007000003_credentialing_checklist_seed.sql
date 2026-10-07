-- ============================================================================
-- 20261007000003_credentialing_checklist_seed.sql
-- The skin substitute pre-submission checklist.
--
-- Every question here answers a denial that was actually issued in the 2026
-- UPIC review recorded in docs/credentialing/07-skin-substitute-documentation.md.
-- Thirteen failure modes, none of them clinical, all of them checkable before
-- the claim went out. §5 of that document is this list in prose; this is the
-- same list the console asks.
--
-- Idempotent, like the payer seed (20260914000006). Re-running inserts nothing
-- and changes nothing. Revising the checklist means a NEW TEMPLATE VERSION,
-- never an update in place — runs snapshot their questions, and a template
-- edited under them would make the history disagree with itself.
--
-- `is_blocking` marks what stops a claim going out. It is set on the questions
-- whose absence produced a denial on its own, not on everything that would be
-- nice to have — a checklist that blocks on all thirty-four items is a
-- checklist that gets overridden every time, and an override that happens
-- every time records nothing.
-- ============================================================================

insert into credentialing.checklist_template (code, version, name, description)
values (
    'skin_substitute_presubmission',
    1,
    'Skin substitute application — pre-submission',
    'Documentation check for CPT 15271–15278 with Q-code skin substitute products. '
    'Built from the denial reasons in a 2026 UPIC post-payment review: ten claims '
    'sampled, every line denied, extrapolated to roughly $135,000, and not one '
    'denial clinical. Run this before the claim goes out.'
)
on conflict (code, version) do nothing;

-- ----------------------------------------------------------------------------
-- The questions.
--
-- Ordered the way a chart is read, not the way the denial letter listed them:
-- necessity, then what was measured, then what was applied, then what the
-- patient agreed to, then what was billed, then whether the record is valid,
-- then who carries the cost if it is denied anyway.
-- ----------------------------------------------------------------------------
insert into credentialing.checklist_item
    (template_id, code, category, position, prompt, authority, guidance, is_blocking)
select t.id, v.code, v.category, v.position, v.prompt, v.authority, v.guidance, v.is_blocking
from credentialing.checklist_template t
cross join (values
    -- ---- Medical necessity -------------------------------------------------
    ('nec_conservative', 'Medical necessity', 10,
     'Conservative care is documented — what was tried, for how long, and that it failed',
     'SSA §1862(a)(1)(A)',
     'Offloading, debridement, moisture management, compression where indicated, infection control. A skin substitute is for a wound that has not responded, so the record has to show the standard care AND show it not working. Look in the visit notes before the first application.',
     true),
    ('nec_duration', 'Medical necessity', 20,
     'The wound''s duration and its non-response to that care are stated explicitly',
     'SSA §1862(a)(1)(A)',
     'A reviewer should not have to infer "chronic" from a run of dates.',
     true),
    ('nec_rationale', 'Medical necessity', 30,
     'The note gives a reason this product was chosen over continued standard care',
     'SSA §1862(a)(1)(A)',
     'A product applied without a stated rationale reads to a reviewer as a product applied by default. If no contemporaneous rationale exists, the treating physician can add one as a clearly labelled addendum — dated today, never back-dated.',
     true),
    ('nec_comorbid', 'Medical necessity', 40,
     'Comorbidity status is documented: glycaemic control, vascular assessment, nutrition, smoking',
     'SSA §1862(a)(1)(A)',
     'These decide whether any graft can take. Absent from the record, the reviewer cannot find that the wound was in a state to benefit. ABI, toe pressures, Doppler or a vascular consult; a recent HbA1c.',
     false),
    ('nec_offloading', 'Medical necessity', 50,
     'Offloading or compression was provided where indicated, and it is documented',
     'SSA §1862(a)(1)(A)',
     'The device, the order, or the dispensing record — DME records or nursing notes, if not the visit note.',
     false),
    ('nec_not_healing', 'Medical necessity', 60,
     'NO note in this episode describes the wound as healing, improving or getting smaller',
     'SSA §1862(a)(1)(A)',
     'The most damaging denial category and the only one no appeal answers, because the contradiction is in the provider''s own note. This needs the whole episode read, not just today''s visit. If such a note exists, the claim does not go out until the treating physician has explained in writing why a substitute was indicated anyway.',
     true),

    -- ---- Measurement -------------------------------------------------------
    ('meas_recorded', 'Measurement', 70,
     'Length, width, depth and area are recorded at this visit',
     '42 CFR §424.15(k)(1)',
     'At the visit billed, not at the last one.',
     true),
    ('meas_debridement', 'Measurement', 80,
     'The measurements are explicitly labelled pre- or post-debridement',
     '42 CFR §424.15(k)(1)',
     'This decides whether the wound met size criteria and whether the application was sized correctly, so an unlabelled measurement is as good as none. Often recoverable from a separate nursing measurement sheet or a timestamped EMR field.',
     true),
    ('meas_consistent', 'Measurement', 90,
     'The measurements reconcile with the units billed',
     'SSA §1833(e)',
     'Wound area measured, product size opened, sq cm applied, sq cm discarded, units billed. Build the one-page table — where it reconciles, that table is the rebuttal.',
     true),
    ('meas_photos', 'Measurement', 100,
     'Wound photographs are on file where this MAC expects them',
     'MAC documentation article',
     'Jurisdiction-specific. Check the current article for your own MAC; they differ and they are revised often.',
     false),

    -- ---- Product -----------------------------------------------------------
    ('prod_identity', 'Product', 110,
     'The product name and manufacturer are in the note',
     '21 CFR Part 1271',
     NULL,
     true),
    ('prod_lot', 'Product', 120,
     'The lot or serial number of the unit applied is recorded against this patient and date',
     '21 CFR Part 1271',
     'The first thing a reviewer asks for. Usually recoverable even when the chart is silent: the peel-off lot sticker is often taped into the paper chart or scanned as an image, and the supplier can reissue shipment records.',
     true),
    ('prod_size_expiry', 'Product', 130,
     'The size applied and the expiry date are recorded',
     '21 CFR Part 1271',
     NULL,
     false),
    ('prod_sterile', 'Product', 140,
     'Sterile technique is documented',
     '21 CFR Part 1271',
     NULL,
     false),
    ('prod_ifu', 'Product', 150,
     'Preparation, handling and fixation follow the instructions for use, and the note shows it',
     '21 CFR Part 1271',
     'The IFU governs preparation, hydration and fixation. Keep a copy with the record.',
     false),
    ('prod_graft_not_dressing', 'Product', 160,
     'The note describes a GRAFT APPLICATION — not a dressing or a dressing change',
     'SSA §1833(e); 42 CFR §424.15(k)(1)',
     'A reviewer bills what the note describes, not what the claim says. A note describing the product secured with adhesive strips and a contact layer and calling it a dressing does not support 15271–15278. The fixation method is from the IFU; the wording is the problem, so fix the wording.',
     true),

    -- ---- Consent -----------------------------------------------------------
    ('consent_signed', 'Consent', 170,
     'The consent carries the patient''s SIGNATURE — not a printed or typed name',
     'PIM 100-08 Ch 3 §3.3.2.4',
     'A printed name is not a signature, and a reviewer may disregard an unsigned record entirely.',
     true),
    ('consent_dated', 'Consent', 180,
     'The consent is dated on or before the application',
     'PIM 100-08 Ch 3 §3.3.2.4',
     NULL,
     true),
    ('consent_product', 'Consent', 190,
     'The consent names the product that was actually applied',
     'SSA §1833(e)',
     'Fatal on its face if it does not: the patient consented to something other than what was applied and billed. If the consent names a different product, that line is not defensible and should not go out.',
     true),
    ('consent_disease_risk', 'Consent', 200,
     'The consent discloses the risk of communicable disease transmission',
     '21 CFR Part 1271',
     'Specific to human tissue products and expected to be disclosed. Check the consent TEMPLATE in force, not just this one form.',
     true),
    ('consent_rba', 'Consent', 210,
     'Risks, benefits and alternatives are documented',
     'SSA §1862(a)(1)(A)',
     NULL,
     false),

    -- ---- Coding ------------------------------------------------------------
    ('code_cpt_site', 'Coding', 220,
     'The application CPT matches the anatomic site and the total area treated',
     'SSA §1833(e)',
     NULL,
     true),
    ('code_qcode', 'Coding', 230,
     'The Q-code matches the product in the note and in the consent',
     'SSA §1833(e)',
     'All three have to agree: claim, note, consent.',
     true),
    ('code_units', 'Coding', 240,
     'The units billed reconcile with the wound area and the product size',
     'MBPM 100-02 Ch 15 §50',
     NULL,
     true),
    ('code_jw', 'Coding', 250,
     'Any -JW wastage is justified in the note, including why a closer-fitting size was not used',
     'MBPM 100-02 Ch 15 §50',
     'Wastage is payable but must be documented and justified. The purchasing records decide this one: the argument turns on which sizes the clinic could actually buy.',
     true),
    ('code_jz', 'Coding', 260,
     '-JZ is used where there was no wastage, and it is true',
     'MBPM 100-02 Ch 15 §50',
     'The JW/JZ choice is itself an assertion a reviewer will check against the note.',
     true),
    ('code_matches_note', 'Coding', 270,
     'The service billed is the service the note describes',
     'SSA §1833(e)',
     'The general case of the graft-versus-dressing problem. Read the note as a stranger would.',
     true),

    -- ---- Record validity ---------------------------------------------------
    ('rec_signed', 'Record validity', 280,
     'Every note for this date of service is signed by the rendering provider',
     'PIM 100-08 Ch 3 §3.3.2.4',
     'The cheapest win available. An unsigned note may be treated as no note. A note authored at the time but never signed can be signed now AS A LATE SIGNATURE, with the EMR audit trail proving when the content was written — that combination is legitimate; re-printing with a false date is not.',
     true),
    ('rec_legible', 'Record validity', 290,
     'Signatures are legible, or a signature log is on file',
     'PIM 100-08 Ch 3 §3.3.2.4',
     NULL,
     false),
    ('rec_orders', 'Record validity', 300,
     'Orders are present and signed',
     '42 CFR §424.15(k)(1)',
     NULL,
     false),
    ('rec_addenda', 'Record validity', 310,
     'Any addendum is identified as an addendum, with its true date',
     'PIM 100-08 Ch 3 §3.3.2.1',
     'A record that looks back-dated destroys the credibility of the whole file, including the parts that were always good — and invites a fraud referral rather than a payment.',
     true),

    -- ---- Liability ---------------------------------------------------------
    ('liab_abn', 'Liability', 320,
     'An ABN was issued and signed where coverage is uncertain',
     'SSA §1879',
     'An ABN does not make a bad claim payable. It decides WHO BEARS THE COST when a claim is denied — without one, that is the provider, not the patient. Ninety seconds.',
     true),
    ('liab_abn_detail', 'Liability', 330,
     'The ABN names the specific service and the estimated cost',
     'SSA §1879',
     NULL,
     false),
    ('liab_abn_copy', 'Liability', 340,
     'A copy of the ABN is retained',
     'SSA §1879',
     NULL,
     false)
) as v(code, category, position, prompt, authority, guidance, is_blocking)
where t.code = 'skin_substitute_presubmission' and t.version = 1
on conflict (template_id, code) do nothing;
