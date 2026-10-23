-- +goose Up
-- Migration 00013: Universal Field-Agnostic Research Engine
-- Adds custom schema fields, supported data types, adaptive privacy shield config, and compliance vault types.
-- Seeds 3 diverse, completely isolated Research Areas: Clinical Healthcare & Radiology, Low-Resource Linguistics & NLP, and Field Ecology & Biodiversity.

-- 1. Extend research_areas table with dynamic schema and universal privacy config
ALTER TABLE research_areas
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_types JSONB NOT NULL DEFAULT '["Images"]'::jsonb,
  ADD COLUMN IF NOT EXISTS privacy_shield_config JSONB NOT NULL DEFAULT '{"shield_type":"geo_privacy","enabled":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_vault_type TEXT NOT NULL DEFAULT 'permits';

-- 2. Update existing marine area with field-specific metadata
UPDATE research_areas SET
  discipline = 'zoology_ecology',
  custom_fields = '[
    {"key": "taxonomy_species", "label": "Species Taxon", "type": "text", "required": true},
    {"key": "carapace_length_cm", "label": "Carapace Length (cm)", "type": "number", "unit": "cm"},
    {"key": "scute_pattern_hash", "label": "Topological Scute Hash", "type": "text"},
    {"key": "water_turbidity_ntu", "label": "Water Turbidity", "type": "number", "unit": "NTU"}
  ]'::jsonb,
  data_types = '["Images", "Time-Series"]'::jsonb,
  privacy_shield_config = '{"shield_type": "geo_privacy", "enabled": true, "blur_radius_km": 10}'::jsonb,
  compliance_vault_type = 'wildlife_permits'
WHERE id = '98c159ce-deab-4f6f-a142-a32bed45d4f3';

-- 3. Seed Research Area 1: Clinical Healthcare & Radiology Research
INSERT INTO research_areas (
  id, owner_id, creator_id, name, description, color, status, is_public, discipline, hypothesis,
  storage_quota_bytes, storage_bytes_used, gpu_credits_budget, gpu_credits_used,
  custom_metrics, custom_fields, data_types, privacy_shield_config, compliance_vault_type
) VALUES (
  'a1111111-2222-3333-4444-555555555551',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'Clinical Radiology & Neural Pathology Lab',
  'Non-invasive deep learning diagnostic assistance for multi-sequence MRI and CT scans in acute neurological conditions.',
  '#4F46E5',
  'active',
  true,
  'radiology_clinical',
  'Multi-task 3D TransUNet with attention-gated feature pyramids achieves >0.94 ROC-AUC on acute ischemic core and glioma boundary segmentation across multi-vendor MRI scanners.',
  19327352832, -- 18 GB
  15891464192, -- 14.8 GB
  600,
  140,
  '[
    {"key": "roc_auc", "label": "ROC-AUC", "unit": "%"},
    {"key": "dice_score", "label": "Dice Coefficient", "unit": "score"},
    {"key": "sensitivity", "label": "Sensitivity / Recall", "unit": "%"},
    {"key": "specificity", "label": "Specificity", "unit": "%"}
  ]'::jsonb,
  '[
    {"key": "patient_age_group", "label": "Patient Age Group", "type": "category", "options": ["18-35", "36-54", "55-64", "65-74", "75+"]},
    {"key": "modality", "label": "Scan Modality", "type": "category", "options": ["T1-MRI", "T2-FLAIR", "CT-Angio", "PET"]},
    {"key": "tissue_site", "label": "Anatomical Site", "type": "text"},
    {"key": "mrn_status", "label": "De-identification Hash", "type": "text"}
  ]'::jsonb,
  '["DICOM/Medical", "Images", "Tabular/CSV"]'::jsonb,
  '{"shield_type": "hipaa_dicom", "enabled": true, "mask_patient_identifiers": true, "scrub_dicom_headers": true}'::jsonb,
  'hipaa_irb'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  discipline = EXCLUDED.discipline,
  custom_fields = EXCLUDED.custom_fields,
  data_types = EXCLUDED.data_types,
  privacy_shield_config = EXCLUDED.privacy_shield_config,
  compliance_vault_type = EXCLUDED.compliance_vault_type;

-- 4. Seed Research Area 2: Low-Resource Linguistics & Document Corpus Research
INSERT INTO research_areas (
  id, owner_id, creator_id, name, description, color, status, is_public, discipline, hypothesis,
  storage_quota_bytes, storage_bytes_used, gpu_credits_budget, gpu_credits_used,
  custom_metrics, custom_fields, data_types, privacy_shield_config, compliance_vault_type
) VALUES (
  'a2222222-3333-4444-5555-666666666662',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'Sinhala-Tamil Low-Resource NLP & Paleography Corpus',
  'Corpus linguistics, OCR tokenization, and cross-lingual embeddings for endangered and low-resource South Asian manuscripts.',
  '#D97706',
  'active',
  true,
  'linguistics_nlp',
  'Pre-trained byte-fallback transformer encoders fine-tuned with morpho-phonemic graph constraints improve medieval palm-leaf character recognition character error rates below 3.5%.',
  12884901888, -- 12 GB
  6657199308,  -- 6.2 GB
  400,
  85,
  '[
    {"key": "bleu_4", "label": "BLEU-4", "unit": "score"},
    {"key": "chrf", "label": "ChrF++", "unit": "score"},
    {"key": "wer", "label": "Word Error Rate", "unit": "%"},
    {"key": "perplexity", "label": "Perplexity", "unit": "ppl"}
  ]'::jsonb,
  '[
    {"key": "dialect_region", "label": "Dialect Region", "type": "text"},
    {"key": "script_type", "label": "Script / Orthography", "type": "category", "options": ["Medieval Sinhala", "Old Tamil", "Grantha", "Brahmi", "Romanized"]},
    {"key": "sentence_length_tokens", "label": "Token Count", "type": "number"},
    {"key": "informant_id", "label": "Speaker Pseudonym", "type": "text"}
  ]'::jsonb,
  '["Text/Corpus", "Audio", "Images"]'::jsonb,
  '{"shield_type": "nlp_pii", "enabled": true, "pseudonymize_speakers": true, "strip_pii_entities": true}'::jsonb,
  'consent_corpus'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  discipline = EXCLUDED.discipline,
  custom_fields = EXCLUDED.custom_fields,
  data_types = EXCLUDED.data_types,
  privacy_shield_config = EXCLUDED.privacy_shield_config,
  compliance_vault_type = EXCLUDED.compliance_vault_type;

-- 5. Seed Specimen / Data Items for Clinical Research Area
INSERT INTO research_specimens (id, area_id, owner_id, title, taxonomy_species, common_name, media_url, media_type, habitat, morphometrics, notes)
VALUES
  (
    'c1111111-1111-1111-1111-111111111111',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'High-Resolution Axial Brain MRI (T1-Gadolinium)',
    'Glioblastoma / Acute Ischemic Zone',
    'Diagnostic Brain MRI Scan',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
    'photo',
    'Neurology ICU & Acute Neuro-imaging Suite',
    '{"modality": "T1-MRI", "patient_age_group": "55-64", "tissue_site": "Left Frontal Lobe", "mrn_status": "DE-ID-88319-HIPAA", "slice_thickness_mm": 1.0}'::jsonb,
    '3D volume demonstrates prominent ring-enhancing left hemispheric mass with vasogenic edema. Anonymized according to HIPAA Safe Harbor.'
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'Multi-Phase CT Angiography of Circle of Willis',
    'Cerebral Vasculature Diagnostic CT',
    'Cranial CT Angiogram',
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
    'photo',
    'Emergency Diagnostic Radiology',
    '{"modality": "CT-Angio", "patient_age_group": "65-74", "tissue_site": "Middle Cerebral Artery", "mrn_status": "DE-ID-99201-HIPAA", "contrast_agent": "Iohexol 350"}'::jsonb,
    'Vascular reconstruction showing high-flow lumen without focal aneurysm or severe stenosis.'
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'Coronal FLAIR Hyperintensity Screening',
    'White Matter Microvascular Hyperintensity',
    'Brain FLAIR MRI Scan',
    'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80',
    'photo',
    'Outpatient Memory & Neuro-Cognitive Clinic',
    '{"modality": "T2-FLAIR", "patient_age_group": "36-54", "tissue_site": "Periventricular Region", "mrn_status": "DE-ID-44120-HIPAA"}'::jsonb,
    'Multiple discrete bilateral hyperintensities evaluated for small-vessel vs inflammatory etiologies.'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Specimen / Data Items for Linguistics & NLP Research Area
INSERT INTO research_specimens (id, area_id, owner_id, title, taxonomy_species, common_name, media_url, media_type, habitat, morphometrics, notes)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    '14th Century Palm-Leaf Ola Manuscript (Kandyan Lineage)',
    'Medieval Classical Sinhala & Pali Gloss',
    'Palm-Leaf Folio Manuscript',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
    'photo',
    'Kandy Temple Archives & Heritage Repository',
    '{"script_type": "Medieval Sinhala", "dialect_region": "Kandyan Upcountry", "sentence_length_tokens": 68, "informant_id": "ARCHIVE-PALM-04", "preservation_state": "Fair"}'::jsonb,
    'Inscribed using iron stylus (Panhinda) on treated Corypha umbraculifera leaf with carbon dummala oil pigment enhancement.'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'Field Phonetic Audio Interview with Native Dialect Speaker',
    'Sabaragamuwa Oral Dialectal Lexicon',
    'Phonetic Field Audio Interview',
    'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80',
    'audio',
    'Sabaragamuwa Rural Cultural Valley',
    '{"script_type": "Romanized IPA", "dialect_region": "Sabaragamuwa", "sentence_length_tokens": 124, "informant_id": "SPEAKER-ANON-77", "audio_sample_rate_hz": 48000}'::jsonb,
    'Unedited oral narrative of agrarian folk customs. Informant identities fully pseudonymized per community ethics protocol.'
  ),
  (
    'b3333333-3333-3333-3333-333333333333',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'Epigraphical Rock Inscription Squeeze (Mihintale Tablet)',
    'Late Brahmi Epigraphical Script',
    'Stone Inscription Paper Squeeze',
    'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80',
    'photo',
    'Mihintale Sacred Epigraphical Zone',
    '{"script_type": "Brahmi", "dialect_region": "North Central", "sentence_length_tokens": 45, "informant_id": "EPIGRAPHY-TAB-12"}'::jsonb,
    'High-relief paper squeeze rubbing capturing 10th-century monastic administrative ordinances.'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Seed HITL Active Labeling Flashcards for Clinical and Linguistics
INSERT INTO research_active_labeling_queue (
  id, area_id, owner_id, specimen_id, specimen_name, media_url, predicted_label, confidence, alternative_label, status, reviewer_notes
) VALUES
  (
    'd1111111-1111-1111-1111-111111111111',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'c1111111-1111-1111-1111-111111111111',
    'Diagnostic Scan #MRI-2026-NEURO-88',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
    'Glioblastoma Multiforme (Grade IV)',
    0.384,
    'Low-Grade Diffuse Astrocytoma',
    'pending',
    'Deep learning model uncertain on ring-enhancement margin versus non-enhancing edema. 1-click clinical verification needed.'
  ),
  (
    'd2222222-2222-2222-2222-222222222222',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'c3333333-3333-3333-3333-333333333333',
    'Diagnostic Scan #FLAIR-2026-NEURO-44',
    'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80',
    'Microvascular Ischemic Disease',
    0.442,
    'Demyelinating Plaque',
    'pending',
    'Periventricular high-signal intensity equivocal for Fazekas stage 2 vs inflammatory lesion.'
  ),
  (
    'd3333333-3333-3333-3333-333333333333',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'b1111111-1111-1111-1111-111111111111',
    'Manuscript Folio #OLA-KD-14B',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
    'Palatal Nasal ඤ (Nya)',
    0.451,
    'Retroflex ණ (Na)',
    'pending',
    'Faint ink ligature in palm leaf furrow confuses OCR character classifier. 1-click paleographer confirmation needed.'
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'b3333333-3333-3333-3333-333333333333',
    'Epigraph Line #MHT-03',
    'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80',
    'Aspirated Dental ථ (Tha)',
    0.490,
    'Cerebral ඨ (Ttha)',
    'pending',
    'Weathered granite texture introduces boundary uncertainty between dental and retroflex loop contours.'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Seed Compliance & Ethics Vault records for Clinical and Linguistics
INSERT INTO research_ethics_permits (
  id, area_id, owner_id, permit_type, permit_number, issuing_authority, title, status, valid_from, valid_until, metadata
) VALUES
  (
    'e1111111-1111-1111-1111-111111111111',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'irb_approval',
    'IRB-2026-MED-4912',
    'National Health & Medical Research Ethics Board',
    'Multi-Center Clinical Evaluation of AI Diagnostics on Neuro-Radiology Scans',
    'active',
    '2026-01-15',
    '2028-01-14',
    '{"protocol_type": "interventional_diagnostic", "risk_category": "minimal_deidentified", "data_officer": "Dr. Sarah Chen, MD"}'::jsonb
  ),
  (
    'e2222222-2222-2222-2222-222222222222',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'hipaa_compliance',
    'HIPAA-WAIVER-2026-09',
    'Clinical Institutional Privacy Commission',
    'Safe Harbor De-Identification & Secondary Research Data Waiver',
    'active',
    '2026-02-01',
    '2029-01-31',
    '{"scrub_protocol": "Safe Harbor 18 Identifiers", "audit_verified": true, "pii_leakage_risk": "Zero"}'::jsonb
  ),
  (
    'e3333333-3333-3333-3333-333333333333',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'clinical_trial_protocol',
    'NCT-05829104',
    'ClinicalTrials.gov Registry',
    'Phase II Multi-Modal Neuro-Imaging Clinical Diagnostic Accuracy Study',
    'active',
    '2026-03-01',
    '2027-12-31',
    '{"phase": "Phase II", "blinding": "Double-Blind Comparative"}'::jsonb
  ),
  (
    'e4444444-4444-4444-4444-444444444444',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'data_license',
    'UNESCO-ICH-2026-SL-03',
    'National Intangible Cultural Heritage Directorate',
    'Palm-Leaf Digitization, OCR Preservation & Open Linguistic Corpus License',
    'active',
    '2026-01-01',
    '2031-12-31',
    '{"heritage_status": "Protected Intangible Archive", "repository": "National Archives Department"}'::jsonb
  ),
  (
    'e5555555-5555-5555-5555-555555555555',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'participant_consent',
    'IRB-2026-LING-0118',
    'University Faculty Ethics Committee for Humanities',
    'Informed Community Consent for Dialectal Audio Recording & Morphological Archiving',
    'active',
    '2026-02-10',
    '2028-02-09',
    '{"informant_rights": "Full Anonymization & Revocation Rights Guaranteed", "native_speakers_consulted": 14}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 9. Seed Tech Collaborators with Guardrails
INSERT INTO research_collaboration_contracts (
  id, area_id, owner_id, creator_id, collaborator_email, collaborator_name, team_name,
  collaboration_model, credit_roles, bounty_amount_cents, bounty_status,
  data_sandbox_permission, role, gpu_credit_cap, grant_budget_cents, gpu_credits_consumed, status
) VALUES
  (
    'f1111111-1111-1111-1111-111111111111',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'neurovision@oxford.ac.uk',
    'Oxford NeuroVision AI Lab',
    'Neuro-Radiology ML Team',
    'paid_bounty',
    '["Methodology", "Software", "Formal Analysis"]'::jsonb,
    250000,
    'escrow_funded',
    'compute_only',
    'editor',
    500,
    120000,
    140,
    'active'
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'nlp@ceylon-speech.org',
    'Ceylon Speech & NLP Group',
    'Low-Resource Tokenization Lab',
    'royalty_split',
    '["Software", "Data Curation", "Validation"]'::jsonb,
    0,
    'pending',
    'compute_only',
    'editor',
    300,
    80000,
    85,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- 10. Seed Publications
INSERT INTO research_publications (
  id, area_id, owner_id, title, doi, abstract, pricing_model, paper_price_cents, dataset_price_cents, model_price_cents,
  royalty_split_rules, downloads_count, gross_revenue_cents, is_published, badges
) VALUES
  (
    'f3333333-1111-1111-1111-111111111111',
    'a1111111-2222-3333-4444-555555555551',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'Multi-Parametric Brain MRI Lesion Boundary Segmentation using Attention-Gated 3D TransUNet',
    '10.1016/j.neuroimage.2026.119402',
    'We introduce an air-gapped, HIPAA-sanitized pipeline for segmenting acute neurological lesions from multi-sequence MRI scans. Demonstrates 0.941 ROC-AUC and 0.892 Dice score across multi-center cohorts.',
    'tiered',
    0,
    4900,
    14900,
    '[{"party": "Clinical Lead", "share_pct": 55}, {"party": "Oxford NeuroVision Lab", "share_pct": 45}]'::jsonb,
    184,
    412000,
    true,
    '["HIPAA Verified", "Peer Reviewed", "Clinical Trial Validated"]'::jsonb
  ),
  (
    'f4444444-2222-2222-2222-222222222222',
    'a2222222-3333-4444-5555-666666666662',
    '555992cb-4d55-4882-bd67-8a446dcf207b',
    'Cross-Lingual Subword Tokenization and Zero-Shot OCR for Low-Resource Indic and Sinhala Epigraphy',
    '10.1162/tacl.2026.0421',
    'Preserving endangered South Asian manuscripts via byte-fallback transformer encoders. Achieves 96.5% character recognition accuracy on weathered 14th-century palm-leaf manuscripts.',
    'open_access',
    0,
    0,
    0,
    '[{"party": "Heritage Lead", "share_pct": 70}, {"party": "Ceylon Speech Group", "share_pct": 30}]'::jsonb,
    312,
    0,
    true,
    '["UNESCO Archive", "Open Access", "Peer Reviewed"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
