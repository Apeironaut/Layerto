-- +goose Up
-- +goose StatementBegin
ALTER TABLE research_notes
  ADD COLUMN IF NOT EXISTS entry_number INT,
  ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Seed rich authentic lab notes for Clinical Radiology Lab (a1111111-2222-3333-4444-555555555551)
INSERT INTO research_notes (
  id, owner_id, area_id, title, body, pinned, auto, entry_number, evidence, metadata, created_at, updated_at
) VALUES
(
  'c1111111-0001-4444-5555-000000000001',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'a1111111-2222-3333-4444-555555555551',
  'Axial T2-FLAIR Contrast S6 Lesion Segmentation Benchmark',
  E'### Protocol & Experimental Setup\nEvaluated multi-vendor 3D TransUNet model on 128 anonymized axial slices from Patient Cohort A.\n\n1. Preprocessing: DICOM windowed to [0, 255] with skull-stripping via BET2\n2. Spatial Resampling: 1.0mm³ isotropic voxel grid\n3. Optimizer: AdamW (lr=2e-4, weight_decay=1e-2)\n\n> [!NOTE]\n> TransUNet attention gates successfully suppressed false-positive periventricular white matter hyperintensities, increasing Dice score by +4.8% over standard 3D U-Net baseline.\n\n### Clinical Observations\n- Mean Dice coefficient on glioma margins reached **0.914**.\n- Sensitivity on micro-lesions (<5mm) is 88.2%.\n- Zero PHI leakage observed during the DICOM tag scrub audit.',
  true,
  false,
  1,
  '[
    {
      "kind": "image",
      "url": "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=1200&q=80",
      "title": "Axial Brain MRI Scan (T2-FLAIR)",
      "caption": "T2-FLAIR Contrast scan showing hyperintensity in right parietal cortex"
    },
    {
      "kind": "image",
      "url": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80",
      "title": "TransUNet Feature Activation",
      "caption": "Attention-gated feature map highlighting lesion boundary contours"
    },
    {
      "kind": "link",
      "url": "https://pubmed.ncbi.nlm.nih.gov/34912048/",
      "title": "Lancet Digital Health: Ischemic Core MRI Deep Learning"
    }
  ]'::jsonb,
  '{"technique": "3D TransUNet", "modality": "T2-FLAIR", "lead_investigator": "Dr. Aris Thorne"}'::jsonb,
  '2026-10-21 09:30:00+00',
  '2026-10-21 09:30:00+00'
),
(
  'c1111111-0002-4444-5555-000000000002',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'a1111111-2222-3333-4444-555555555551',
  'HIPAA Safe Harbor De-ID Scrubbing & Air-Gap Audit',
  E'### Compliance Verification Checklist\nConducted full security review of all 18 HIPAA Safe Harbor identifiers for incoming CT Angiography volumes.\n\n- Patient Name & MRN: Hash-anonymized via SHA-256 HMAC salt\n- Date of Service: Shifted uniformly by random offset (k=14 days)\n- Device Serial Numbers: Scrubbed from DICOM Header 0x0018\n\n> [!NOTE]\n> Clinical IRB Protocol #IRB-2026-MED-994 remains fully active with zero non-compliance flags.\n\nAll public dataset exports strictly pass through the automated de-identification proxy before weights serialization.',
  false,
  false,
  2,
  '[
    {
      "kind": "link",
      "url": "https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html",
      "title": "HHS 45 CFR § 164.514(b) Safe Harbor Guidance"
    }
  ]'::jsonb,
  '{"audit_status": "PASSED", "compliance_officer": "R. Selvaraj, MD"}'::jsonb,
  '2026-10-22 14:15:00+00',
  '2026-10-22 14:15:00+00'
)
ON CONFLICT (id) DO UPDATE SET
  entry_number = EXCLUDED.entry_number,
  evidence = EXCLUDED.evidence,
  metadata = EXCLUDED.metadata;

-- Seed rich authentic lab notes for Sinhala-Tamil Linguistics Research Area (a2222222-3333-4444-5555-666666666662)
INSERT INTO research_notes (
  id, owner_id, area_id, title, body, pinned, auto, entry_number, evidence, metadata, created_at, updated_at
) VALUES
(
  'c2222222-0001-4444-5555-000000000001',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'a2222222-3333-4444-5555-666666666662',
  'Ola Leaf Manuscript Recto/Verso Ligature Transcription Log',
  E'### Paleographic Analysis & Stroke Extraction\nHigh-resolution multispectral flatbed imaging of 14th century palm-leaf manuscripts from Anuradhapura archives.\n\n1. Identified 42 archaic conjunct ligatures absent in modern Unicode Sinhala (U+0D80..U+0DFF)\n2. Created synthetic morphological stroke augmentation pipeline\n3. OCR character error rate dropped from 12.4% down to **3.1%**\n\n> [!NOTE]\n> Informant audio recordings for phonemic reconstruction have speaker metadata and village GPS redacted per UNESCO documentation standards.',
  true,
  false,
  1,
  '[
    {
      "kind": "image",
      "url": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80",
      "title": "Ancient Palm-Leaf Manuscript Digitization",
      "caption": "Folio 12 Recto: Medieval Sinhala-Grantha transitional script with stylus incisions"
    },
    {
      "kind": "link",
      "url": "https://unesco.org/en/endangered-languages",
      "title": "UNESCO Endangered Alphabets & Language Documentation"
    }
  ]'::jsonb,
  '{"script": "Medieval Sinhala", "century": "14th", "lead_linguist": "Dr. K. Jayasuriya"}'::jsonb,
  '2026-10-21 11:20:00+00',
  '2026-10-21 11:20:00+00'
),
(
  'c2222222-0002-4444-5555-000000000002',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'a2222222-3333-4444-5555-666666666662',
  'Byte-Fallback vs Morpho-Phonemic Tokenizer Compression Ratios',
  E'### Tokenizer Architecture Experiment\nCompared subword tokenization strategies across 1.4M parallel sentences.\n\n- Standard SentencePiece (Vocab 32k): 2.45 tokens per Sinhala word\n- Morpho-Phonemic Graph Tokenizer: **1.32 tokens per Sinhala word**\n- ChrF++ translation quality improved by +3.2 points on Low-Resource Tamil-Sinhala pair.',
  false,
  false,
  2,
  '[
    {
      "kind": "link",
      "url": "https://aclanthology.org/",
      "title": "ACL Anthology: Low-Resource Morphological Tokenization"
    }
  ]'::jsonb,
  '{"tokenizer": "Morpho-Phonemic Graph", "vocab_size": 32000}'::jsonb,
  '2026-10-22 16:45:00+00',
  '2026-10-22 16:45:00+00'
)
ON CONFLICT (id) DO UPDATE SET
  entry_number = EXCLUDED.entry_number,
  evidence = EXCLUDED.evidence,
  metadata = EXCLUDED.metadata;

-- Seed rich authentic lab notes for Marine Zoology Area (98c159ce-deab-4f6f-a142-a32bed45d4f3)
INSERT INTO research_notes (
  id, owner_id, area_id, title, body, pinned, auto, entry_number, evidence, metadata, created_at, updated_at
) VALUES
(
  'c3333333-0001-4444-5555-000000000001',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  '98c159ce-deab-4f6f-a142-a32bed45d4f3',
  'Pigeon Island Post-Monsoon Hawksbill Scute Pattern Recapture',
  E'### Field Observation & Topological Graph Matching\nEncountered Adult Female Hawksbill (Tag #SL-EI-009) near outer reef slope at 8.4m depth.\n\n1. Matched lateral post-orbital facial scute pattern against 2024 database snapshot\n2. Graph IoU score of **0.962** confirms positive lifelong re-identification\n3. EXIF GPS coordinates successfully fuzzed by ±10km Geo-Shield proxy\n\n> [!NOTE]\n> Scute pigmentation boundaries remained invariant despite light algal fouling on posterior marginal scutes.',
  true,
  false,
  1,
  '[
    {
      "kind": "image",
      "url": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "title": "Eretmochelys imbricata in situ",
      "caption": "Lateral scute graph verification at 8.4m depth, Pigeon Island National Park"
    },
    {
      "kind": "link",
      "url": "https://cites.org/eng/app/appendices.php",
      "title": "CITES Appendix I Marine Megafauna Register"
    }
  ]'::jsonb,
  '{"species": "Eretmochelys imbricata", "dive_depth_m": 8.4, "tag_id": "SL-EI-009"}'::jsonb,
  '2026-10-21 08:00:00+00',
  '2026-10-21 08:00:00+00'
)
ON CONFLICT (id) DO UPDATE SET
  entry_number = EXCLUDED.entry_number,
  evidence = EXCLUDED.evidence,
  metadata = EXCLUDED.metadata;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE research_notes
  DROP COLUMN IF EXISTS entry_number,
  DROP COLUMN IF EXISTS evidence,
  DROP COLUMN IF EXISTS metadata;
-- +goose StatementEnd
