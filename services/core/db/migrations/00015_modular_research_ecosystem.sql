-- +goose Up
-- Migration 00015: Modular Research Ecosystem & Universal Core Workspace
-- Adds enabled_modules and methodology_steps to research_areas.
-- Configures 3 distinct, strictly air-gapped Research Areas:
-- 1. Empirical Field Ecology (Core tabs only, no GPU clutter)
-- 2. Clinical Neuro-Pathology (Core tabs + Statistical Chart Builder)
-- 3. Deep Learning & Corpus Research (Core tabs + GPU Compute Hub + Tech Collaboration)

-- 1. Extend research_areas table
ALTER TABLE research_areas
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS methodology_steps JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Configure Area 1: Empirical Environmental & Field Ecology (Core Workspace Only)
-- ID: fbf58930-fe36-4b7a-bf7c-a6bd1da65bc2
UPDATE research_areas SET
  name = 'Sub-Saharan Forest Canopy & Biodiversity Ecology',
  description = 'Field ecology, multi-spectral drone photogrammetry, and botanical transect sampling in primary rainforests.',
  discipline = 'ecology',
  enabled_modules = '[]'::jsonb,
  methodology_steps = '[
    {
      "id": "step-eco-1",
      "step_number": 1,
      "title": "Problem Definition & Hypothesis Formulation",
      "description": "Quantify above-ground biomass variations across secondary vs primary canopy strata without destructive logging.",
      "status": "completed",
      "protocol_notes": "Hypothesis: Multi-return LiDAR waveform depth coupled with high-resolution RGB orthomosaics enables above-ground carbon estimation within 6.8% RMSE."
    },
    {
      "id": "step-eco-2",
      "step_number": 2,
      "title": "Literature Synthesis & Allometric Framework",
      "description": "Review pantropical biomass equations (Chave et al. 2014) and canopy height model algorithms.",
      "status": "completed",
      "protocol_notes": "Synthesized 14 peer-reviewed allometric papers in Literature Vault. Selected Chave pantropical equation with wood specific gravity corrections."
    },
    {
      "id": "step-eco-3",
      "step_number": 3,
      "title": "Field Transect & Observation Design",
      "description": "Establish ten 50m x 50m permanent forest sample plots with DBH measurements and species tags.",
      "status": "in_progress",
      "protocol_notes": "Tag trees >=10cm DBH. Measure tree height with laser hypsometer. Ingest coordinates and DBH into Observations Table."
    },
    {
      "id": "step-eco-4",
      "step_number": 4,
      "title": "Multi-Spectral UAV Flight & Data Calibration",
      "description": "Fly DJI Matrice 300 with MicaSense Altum-PT at 120m AGL under diffuse cloud lighting conditions.",
      "status": "pending",
      "protocol_notes": "Ensure radiometric calibration panel captures before and after each flight leg. Overlap: 85% forward, 80% lateral."
    },
    {
      "id": "step-eco-5",
      "step_number": 5,
      "title": "Statistical Validation & Carbon Stock Manuscript",
      "description": "Correlate remote sensing canopy volume indices with ground inventory plot biomass.",
      "status": "pending",
      "protocol_notes": "Compute Pearson r and RMSE against ground harvest truth plots. Export manuscript figures to Paper Writer."
    }
  ]'::jsonb
WHERE id = 'fbf58930-fe36-4b7a-bf7c-a6bd1da65bc2';

-- 3. Configure Area 2: Clinical & Biostatistics Study (+ Statistical Chart Builder)
-- ID: a1111111-2222-3333-4444-555555555551
UPDATE research_areas SET
  name = 'Clinical Neurology & Multi-Sequence Neuro-Pathology',
  description = 'Multi-sequence MRI lesion analysis, perfusion CT volumetrics, and acute neurological cohort studies.',
  discipline = 'radiology_clinical',
  enabled_modules = '["statistical_charts"]'::jsonb,
  methodology_steps = '[
    {
      "id": "step-med-1",
      "step_number": 1,
      "title": "Clinical Cohort Selection & IRB Protocol",
      "description": "Enroll 120 acute ischemic stroke patients with pre-intervention DWI/FLAIR MRI and follow-up CT.",
      "status": "completed",
      "protocol_notes": "Hospital Ethics Protocol #IRB-2026-MED-994 approved. All patient data de-identified via HIPAA Safe Harbor protocol."
    },
    {
      "id": "step-med-2",
      "step_number": 2,
      "title": "DICOM Pre-processing & De-Identification Audit",
      "description": "Standardize multi-vendor MRI scans to 1.0mm isotropic voxel grid with skull-stripping via BET2.",
      "status": "completed",
      "protocol_notes": "DICOM tag scrubbing verified. Zero Protected Health Information (PHI) leaked."
    },
    {
      "id": "step-med-3",
      "step_number": 3,
      "title": "Multi-Parametric Lesion Boundary Segmentation",
      "description": "Quantify penumbra volume, core necrosis, and edema margins across T1, T2, FLAIR, and DWI sequences.",
      "status": "in_progress",
      "protocol_notes": "Inter-observer agreement measured by two senior neuroradiologists. Target Dice coefficient >= 0.88."
    },
    {
      "id": "step-med-4",
      "step_number": 4,
      "title": "Biostatistical Hypothesis Testing & ROC Curves",
      "description": "Evaluate sensitivity, specificity, and AUC for collateral perfusion score predictors.",
      "status": "in_progress",
      "protocol_notes": "Generate Kaplan-Meier survival curves and ROC-AUC plots inside Statistical & Chart Builder."
    },
    {
      "id": "step-med-5",
      "step_number": 5,
      "title": "Clinical Manuscript Synthesis & Publishing",
      "description": "Assemble manuscript for submission to Lancet Neurology / NeuroImage with peer-review sandbox.",
      "status": "pending",
      "protocol_notes": "Synthesize lab notes and statistical figures directly in the AI Paper Writer studio."
    }
  ]'::jsonb
WHERE id = 'a1111111-2222-3333-4444-555555555551';

-- 4. Configure Area 3: Deep Learning & Corpus Research (+ GPU Hub & Tech Collaboration)
-- ID: a2222222-3333-4444-5555-666666666662
UPDATE research_areas SET
  name = 'Sinhala-Tamil Low-Resource NLP & Paleography Corpus',
  description = 'Corpus linguistics, OCR tokenization, and cross-lingual embeddings for medieval palm-leaf manuscripts.',
  discipline = 'linguistics_nlp',
  enabled_modules = '["gpu_compute", "tech_collaboration"]'::jsonb,
  methodology_steps = '[
    {
      "id": "step-nlp-1",
      "step_number": 1,
      "title": "Historical Palm-Leaf Epigraphy Archival Digitation",
      "description": "Acquire high-resolution multispectral macro photographs of 12th-16th century Ola manuscripts.",
      "status": "completed",
      "protocol_notes": "Curate folios across Colombo National Museum and Temple libraries under UNESCO cultural digitization permits."
    },
    {
      "id": "step-nlp-2",
      "step_number": 2,
      "title": "Paleographic Glyph Annotation & Segmentation",
      "description": "Construct character and ligature bounding box dataset with domain expert paleographers.",
      "status": "completed",
      "protocol_notes": "Tag archaic character glyphs (retroflex ණ vs dental න, aspirated ථ, ligatures). 42,000 segmented token instances."
    },
    {
      "id": "step-nlp-3",
      "step_number": 3,
      "title": "Transformer OCR & Sub-word Tokenizer Training",
      "description": "Train Byte-Fallback ByT5 and TrOCR transformer models on high-performance GPU nodes.",
      "status": "in_progress",
      "protocol_notes": "Allocated 400 GPU credits on NVIDIA A100 node in GPU Compute Hub. Batch size: 64, AdamW lr: 3e-5."
    },
    {
      "id": "step-nlp-4",
      "step_number": 4,
      "title": "Interdisciplinary Tech Collaboration & Bounty Review",
      "description": "Collaborate with Oxford DeepVision AI team under 30% royalty split for attention model fine-tuning.",
      "status": "in_progress",
      "protocol_notes": "Tech team milestone active: Reduce character error rate (CER) below 3.5% on weathered stone epigraphs."
    },
    {
      "id": "step-nlp-5",
      "step_number": 5,
      "title": "Corpus Publication & Open Access Release",
      "description": "Release curated digitised manuscript benchmark and trained PyTorch checkpoint to Layerto storefront.",
      "status": "pending",
      "protocol_notes": "Publish paper + open-access HuggingFace compatible dataset with automated royalty distribution."
    }
  ]'::jsonb
WHERE id = 'a2222222-3333-4444-5555-666666666662';

-- 5. Seed Literature References for Reference Papers & Literature Vault
INSERT INTO literature (
  id, owner_id, area_id, title, authors, year, venue, url, doi, bibtex, status, rating, notes, created_at, updated_at
) VALUES
(
  'e1111111-0001-4444-5555-000000000001',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'fbf58930-fe36-4b7a-bf7c-a6bd1da65bc2',
  'Improved allometric models to estimate the aboveground biomass of tropical trees',
  'Chave, J., Réjou-Méchain, M., Búrquez, A., et al.',
  2014,
  'Global Change Biology, 20(10), 3177-3190',
  'https://doi.org/10.1111/gcb.12629',
  '10.1111/gcb.12629',
  '@article{chave2014improved, title={Improved allometric models to estimate the aboveground biomass of tropical trees}, author={Chave, Jérôme and others}, journal={Global Change Biology}, volume={20}, number={10}, pages={3177--3190}, year={2014}}',
  'read',
  5,
  'Foundational allometric model using diameter at breast height (D), total tree height (H), and wood density (rho). Reduces regional biomass estimation error from 40% to 10%.',
  '2026-10-20 10:00:00+00',
  '2026-10-20 10:00:00+00'
),
(
  'e1111111-0002-4444-5555-000000000002',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'fbf58930-fe36-4b7a-bf7c-a6bd1da65bc2',
  'UAV-LiDAR and hyperspectral data fusion for forest structure characterization',
  'Almeida, D. R. A., Broadbent, E. N., Zambrano, A. M. A., et al.',
  2021,
  'Remote Sensing of Environment, 261, 112470',
  'https://doi.org/10.1016/j.rse.2021.112470',
  '10.1016/j.rse.2021.112470',
  '@article{almeida2021uav, title={UAV-LiDAR and hyperspectral data fusion for forest structure characterization}, author={Almeida, Danilo RA and others}, journal={Remote Sensing of Environment}, volume={261}, pages={112470}, year={2021}}',
  'reading',
  4,
  'Demonstrates point cloud voxelization protocols and canopy surface roughness metrics that match our drone flight configuration.',
  '2026-10-21 14:15:00+00',
  '2026-10-21 14:15:00+00'
),
(
  'e1111111-0003-4444-5555-000000000003',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'a1111111-2222-3333-4444-555555555551',
  'TransUNet: Transformers Make Strong Encoders for Medical Image Segmentation',
  'Chen, J., Lu, Y., Yu, Q., Luo, X., Adeli, E., Wang, Y., et al.',
  2021,
  'Medical Image Computing and Computer Assisted Intervention (MICCAI)',
  'https://arxiv.org/abs/2102.04306',
  '10.48550/arXiv.2102.04306',
  '@article{chen2021transunet, title={TransUNet: Transformers make strong encoders for medical image segmentation}, author={Chen, Jieneng and others}, journal={arXiv preprint arXiv:2102.04306}, year={2021}}',
  'read',
  5,
  'Combines CNN low-level resolution features with self-attention global contextual representations for 3D multi-organ and neurological boundary delineation.',
  '2026-10-18 09:00:00+00',
  '2026-10-18 09:00:00+00'
),
(
  'e1111111-0004-4444-5555-000000000004',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'a1111111-2222-3333-4444-555555555551',
  'Deep Learning in Neuroimaging: Promises, Progress, and Clinical Translation',
  'Rathore, S., Habes, M., Iftikhar, M. A., et al.',
  2023,
  'Lancet Digital Health, 5(8), e512-e526',
  'https://doi.org/10.1016/S2589-7500(23)00112-X',
  '10.1016/S2589-7500(23)00112-X',
  '@article{rathore2023neuroimaging, title={Deep learning in neuroimaging: promises, progress, and clinical translation}, author={Rathore, Saima and others}, journal={The Lancet Digital Health}, volume={5}, number={8}, pages={e512--e526}, year={2023}}',
  'reading',
  5,
  'Critical meta-review addressing multi-scanner calibration, contrast variation, and HIPAA compliance requirements in diagnostic workflows.',
  '2026-10-22 11:30:00+00',
  '2026-10-22 11:30:00+00'
),
(
  'e1111111-0005-4444-5555-000000000005',
  '555992cb-4d55-4882-bd67-8a446dcf207b',
  'a2222222-3333-4444-5555-666666666662',
  'TrOCR: Transformer-based Optical Character Recognition with Pre-trained Models',
  'Li, M., Lv, T., Chen, J., Cui, L., Lu, Y., Dinev, D., et al.',
  2023,
  'AAAI Conference on Human Computation and Crowdsourcing',
  'https://doi.org/10.1609/aaai.v37i11.26538',
  '10.1609/aaai.v37i11.26538',
  '@article{li2023trocr, title={TrOCR: Transformer-based optical character recognition with pre-trained models}, author={Li, Minghao and others}, journal={AAAI}, volume={37}, number={11}, pages={13094--13102}, year={2023}}',
  'read',
  5,
  'End-to-end OCR transformer replacing traditional CNN+RNN architectures. Demonstrates strong transfer learning on historical text degradation.',
  '2026-10-19 16:45:00+00',
  '2026-10-19 16:45:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- +goose Down
ALTER TABLE research_areas
  DROP COLUMN IF EXISTS enabled_modules,
  DROP COLUMN IF EXISTS methodology_steps;
