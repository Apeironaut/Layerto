import type { ResearchCustomField, ResearchMetricCol, SupportedDataType, PrivacyShieldConfig } from '@layerto/types';

export interface DisciplineTemplate {
  id: string;
  category: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  defaultDataTypes: SupportedDataType[];
  defaultMetrics: ResearchMetricCol[];
  defaultCustomFields: ResearchCustomField[];
  defaultPrivacyShield: PrivacyShieldConfig;
  complianceVaultType: string;
  complianceVaultTitle: string;
  itemNoun: string; // e.g. "Specimen", "Diagnostic Scan", "Manuscript / Folio", "Sample", "Data Point"
  itemPlural: string;
  labelNoun: string; // e.g. "Species Taxon", "Diagnosis", "Character / Token", "Material Phase"
}

export interface TemplateCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  templates: DisciplineTemplate[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'life_sciences',
    title: 'Life Sciences & Ecology',
    description: 'Fauna telemetry, botany, marine biodiversity, and agricultural fieldwork.',
    icon: 'camera',
    templates: [
      {
        id: 'zoology_ecology',
        category: 'Life Sciences & Ecology',
        label: 'Zoology & Wildlife Conservation',
        desc: 'Fauna photo-ID, GPS telemetry, scute graphs, and endangered species tracking.',
        icon: 'camera',
        color: '#0D9488',
        defaultDataTypes: ['Images', 'Time-Series'],
        defaultMetrics: [
          { key: 'mAP_50', label: 'mAP@50', unit: '%' },
          { key: 'top1_acc', label: 'Top-1 Accuracy', unit: '%' },
          { key: 'graph_iou', label: 'Scute Graph IoU', unit: '%' },
          { key: 'fps', label: 'Inference Latency', unit: 'FPS' },
        ],
        defaultCustomFields: [
          { key: 'taxonomy_species', label: 'Species Taxon', type: 'text', required: true },
          { key: 'carapace_length_cm', label: 'Carapace Length', type: 'number', unit: 'cm' },
          { key: 'scute_pattern_hash', label: 'Topological Scute Hash', type: 'text' },
          { key: 'water_turbidity_ntu', label: 'Water Turbidity', type: 'number', unit: 'NTU' },
        ],
        defaultPrivacyShield: {
          shield_type: 'geo_privacy',
          enabled: true,
          blur_radius_km: 10,
        },
        complianceVaultType: 'wildlife_permits',
        complianceVaultTitle: 'Wildlife & CITES Permit Vault',
        itemNoun: 'Specimen Photo',
        itemPlural: 'Specimens',
        labelNoun: 'Species Taxon',
      },
      {
        id: 'botany_ecology',
        category: 'Life Sciences & Ecology',
        label: 'Botany & Canopy Ecology',
        desc: 'Canopy LiDAR, herbarium digitized specimens, and phenological classification.',
        icon: 'compass',
        color: '#059669',
        defaultDataTypes: ['Images', 'Tabular/CSV'],
        defaultMetrics: [
          { key: 'f1_score', label: 'Macro F1', unit: '%' },
          { key: 'rmse', label: 'Crown Diameter RMSE', unit: 'm' },
          { key: 'biomass_r2', label: 'Biomass R²', unit: 'score' },
        ],
        defaultCustomFields: [
          { key: 'plant_family', label: 'Family / Genus', type: 'text', required: true },
          { key: 'leaf_area_index', label: 'Leaf Area Index', type: 'number' },
          { key: 'elevation_meters', label: 'Elevation', type: 'number', unit: 'm' },
        ],
        defaultPrivacyShield: {
          shield_type: 'geo_privacy',
          enabled: true,
          blur_radius_km: 15,
        },
        complianceVaultType: 'botanical_permits',
        complianceVaultTitle: 'Herbarium & Forestry Permit Vault',
        itemNoun: 'Botanical Sample',
        itemPlural: 'Botanical Samples',
        labelNoun: 'Flora Species',
      },
      {
        id: 'agriculture',
        category: 'Life Sciences & Ecology',
        label: 'Agricultural Science & Crop Yields',
        desc: 'Multispectral drone imagery, soil sensors, pest detection, and yield prediction.',
        icon: 'sparkles',
        color: '#16A34A',
        defaultDataTypes: ['Images', 'Tabular/CSV', 'Time-Series'],
        defaultMetrics: [
          { key: 'yield_mae', label: 'Yield MAE', unit: 'kg/ha' },
          { key: 'pest_mAP', label: 'Pest Detection mAP', unit: '%' },
          { key: 'ndvi_corr', label: 'NDVI Correlation', unit: 'r' },
        ],
        defaultCustomFields: [
          { key: 'crop_cultivar', label: 'Crop Cultivar', type: 'text', required: true },
          { key: 'soil_ph', label: 'Soil pH', type: 'number' },
          { key: 'irrigation_type', label: 'Irrigation Regime', type: 'category', options: ['Drip', 'Rainfed', 'Pivot', 'Furrow'] },
        ],
        defaultPrivacyShield: {
          shield_type: 'geo_privacy',
          enabled: true,
          blur_radius_km: 5,
        },
        complianceVaultType: 'agri_permits',
        complianceVaultTitle: 'Agricultural Data & MTA Vault',
        itemNoun: 'Crop Plot Observation',
        itemPlural: 'Field Observations',
        labelNoun: 'Crop Variety / Disease',
      },
    ],
  },
  {
    id: 'medical_clinical',
    title: 'Medical & Clinical Research',
    description: 'Radiology MRI/CT, pathology histology, genomics, and clinical trial cohorts.',
    icon: 'flask',
    templates: [
      {
        id: 'radiology_clinical',
        category: 'Medical & Clinical Research',
        label: 'Clinical Radiology & Neural Pathology',
        desc: 'DICOM multi-sequence MRI/CT scans with HIPAA Safe Harbor sanitization and lesion segmentation.',
        icon: 'flask',
        color: '#4F46E5',
        defaultDataTypes: ['DICOM/Medical', 'Images', 'Tabular/CSV'],
        defaultMetrics: [
          { key: 'roc_auc', label: 'ROC-AUC', unit: '%' },
          { key: 'dice_score', label: 'Dice Coefficient', unit: 'score' },
          { key: 'sensitivity', label: 'Sensitivity / Recall', unit: '%' },
          { key: 'specificity', label: 'Specificity', unit: '%' },
        ],
        defaultCustomFields: [
          { key: 'patient_age_group', label: 'Patient Age Group', type: 'category', options: ['18-35', '36-54', '55-64', '65-74', '75+'] },
          { key: 'modality', label: 'Scan Modality', type: 'category', options: ['T1-MRI', 'T2-FLAIR', 'CT-Angio', 'PET'] },
          { key: 'tissue_site', label: 'Anatomical Site', type: 'text' },
          { key: 'mrn_status', label: 'De-identification Hash', type: 'text' },
        ],
        defaultPrivacyShield: {
          shield_type: 'hipaa_dicom',
          enabled: true,
          mask_patient_identifiers: true,
          scrub_dicom_headers: true,
        },
        complianceVaultType: 'hipaa_irb',
        complianceVaultTitle: 'HIPAA, IRB & Clinical Protocol Vault',
        itemNoun: 'Diagnostic Scan',
        itemPlural: 'Diagnostic Scans',
        labelNoun: 'Clinical Pathology Diagnosis',
      },
      {
        id: 'pathology_imaging',
        category: 'Medical & Clinical Research',
        label: 'Digital Pathology & Histology',
        desc: 'Whole slide gigapixel histology, cell nuclei classification, and biomarker quantitation.',
        icon: 'cpu',
        color: '#9333EA',
        defaultDataTypes: ['Images', 'Tabular/CSV'],
        defaultMetrics: [
          { key: 'f1_nuclei', label: 'Nuclei F1', unit: '%' },
          { key: 'balanced_acc', label: 'Balanced Acc', unit: '%' },
          { key: 'p_value', label: 'Significance p-value', unit: 'p' },
        ],
        defaultCustomFields: [
          { key: 'stain_type', label: 'Staining Method', type: 'category', options: ['H&E', 'IHC-HER2', 'IHC-Ki67', 'PAS'] },
          { key: 'biopsy_site', label: 'Tissue Origin', type: 'text' },
          { key: 'magnification', label: 'Magnification', type: 'category', options: ['20x', '40x', '60x'] },
        ],
        defaultPrivacyShield: {
          shield_type: 'hipaa_dicom',
          enabled: true,
          mask_patient_identifiers: true,
        },
        complianceVaultType: 'pathology_irb',
        complianceVaultTitle: 'Pathology IRB & Biobank Vault',
        itemNoun: 'Histology Tile',
        itemPlural: 'Histology Tiles',
        labelNoun: 'Tumor Grade / Biomarker',
      },
      {
        id: 'clinical_trials',
        category: 'Medical & Clinical Research',
        label: 'Clinical Trials & Pharmacokinetics',
        desc: 'Phase I-IV cohort responses, longitudinal biomarker tracking, and blind endpoint analysis.',
        icon: 'coins',
        color: '#0284C7',
        defaultDataTypes: ['Tabular/CSV', 'Time-Series'],
        defaultMetrics: [
          { key: 'hazard_ratio', label: 'Hazard Ratio', unit: 'HR' },
          { key: 'p_value', label: 'Log-Rank p-value', unit: 'p' },
          { key: 'auc_pk', label: 'PK AUC0-inf', unit: 'ng·h/mL' },
        ],
        defaultCustomFields: [
          { key: 'cohort_arm', label: 'Trial Arm', type: 'category', options: ['Placebo', 'Low Dose', 'High Dose', 'Standard Care'] },
          { key: 'patient_age_group', label: 'Age Group', type: 'category', options: ['18-35', '36-54', '55-64', '65+'] },
          { key: 'adverse_event_grade', label: 'CTCAE Grade', type: 'category', options: ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'] },
        ],
        defaultPrivacyShield: {
          shield_type: 'hipaa_dicom',
          enabled: true,
          mask_patient_identifiers: true,
        },
        complianceVaultType: 'trial_registry',
        complianceVaultTitle: 'Clinical Trial Registry & Consent Vault',
        itemNoun: 'Patient Case Record',
        itemPlural: 'Cohort Records',
        labelNoun: 'Trial Primary Endpoint',
      },
    ],
  },
  {
    id: 'language_social',
    title: 'Language, Humanities & Social Sciences',
    description: 'Corpus linguistics, low-resource NLP, econometrics, and survey analytics.',
    icon: 'book',
    templates: [
      {
        id: 'linguistics_nlp',
        category: 'Language, Humanities & Social Sciences',
        label: 'Low-Resource Linguistics & Paleography',
        desc: 'Ancient manuscript OCR, endangered language corpora, and cross-lingual embeddings.',
        icon: 'book',
        color: '#D97706',
        defaultDataTypes: ['Text/Corpus', 'Audio', 'Images'],
        defaultMetrics: [
          { key: 'bleu_4', label: 'BLEU-4', unit: 'score' },
          { key: 'chrf', label: 'ChrF++', unit: 'score' },
          { key: 'wer', label: 'Word Error Rate', unit: '%' },
          { key: 'perplexity', label: 'Perplexity', unit: 'ppl' },
        ],
        defaultCustomFields: [
          { key: 'dialect_region', label: 'Dialect Region', type: 'text' },
          { key: 'script_type', label: 'Script / Orthography', type: 'category', options: ['Medieval Sinhala', 'Old Tamil', 'Grantha', 'Brahmi', 'Romanized'] },
          { key: 'sentence_length_tokens', label: 'Token Count', type: 'number' },
          { key: 'informant_id', label: 'Speaker Pseudonym', type: 'text' },
        ],
        defaultPrivacyShield: {
          shield_type: 'nlp_pii',
          enabled: true,
          pseudonymize_speakers: true,
          strip_pii_entities: true,
        },
        complianceVaultType: 'consent_corpus',
        complianceVaultTitle: 'Informed Consent & Corpus License Vault',
        itemNoun: 'Manuscript / Audio Record',
        itemPlural: 'Corpus Documents',
        labelNoun: 'Character / Token Taxon',
      },
      {
        id: 'social_economics',
        category: 'Language, Humanities & Social Sciences',
        label: 'Economics & Survey Analytics',
        desc: 'Household surveys, econometric panel regressions, and participant sentiment analysis.',
        icon: 'coins',
        color: '#2563EB',
        defaultDataTypes: ['Tabular/CSV', 'Text/Corpus'],
        defaultMetrics: [
          { key: 'r_squared', label: 'R-Squared', unit: 'R²' },
          { key: 'f_stat', label: 'F-Statistic', unit: 'F' },
          { key: 'p_value', label: 'p-value', unit: 'p' },
        ],
        defaultCustomFields: [
          { key: 'income_bracket', label: 'Income Decile', type: 'category', options: ['Decile 1-3', 'Decile 4-7', 'Decile 8-10'] },
          { key: 'urban_rural', label: 'Demographic Area', type: 'category', options: ['Urban', 'Peri-Urban', 'Rural'] },
          { key: 'sample_weight', label: 'Survey Weight', type: 'number' },
        ],
        defaultPrivacyShield: {
          shield_type: 'nlp_pii',
          enabled: true,
          strip_pii_entities: true,
        },
        complianceVaultType: 'survey_irb',
        complianceVaultTitle: 'Social Science IRB & Consent Vault',
        itemNoun: 'Survey Microdata Row',
        itemPlural: 'Survey Records',
        labelNoun: 'Outcome Indicator',
      },
    ],
  },
  {
    id: 'physical_engineering',
    title: 'Physical Sciences & Engineering',
    description: 'Materials science, astronomy, remote sensing satellite data, and robotics.',
    icon: 'compass',
    templates: [
      {
        id: 'materials_physics',
        category: 'Physical Sciences & Engineering',
        label: 'Materials Science & Crystallography',
        desc: 'X-ray diffraction (XRD), crystal lattice DFT simulations, and alloy tensile properties.',
        icon: 'cpu',
        color: '#DC2626',
        defaultDataTypes: ['Tabular/CSV', 'Images', 'Time-Series'],
        defaultMetrics: [
          { key: 'formation_energy_mae', label: 'Formation Energy MAE', unit: 'eV/atom' },
          { key: 'bandgap_rmse', label: 'Bandgap RMSE', unit: 'eV' },
          { key: 'lattice_r2', label: 'Lattice Constant R²', unit: 'score' },
        ],
        defaultCustomFields: [
          { key: 'crystal_system', label: 'Crystal System', type: 'category', options: ['Cubic', 'Tetragonal', 'Hexagonal', 'Monoclinic', 'Triclinic'] },
          { key: 'chemical_formula', label: 'Empirical Formula', type: 'text', required: true },
          { key: 'synthesis_temperature_k', label: 'Synthesis Temp (K)', type: 'number', unit: 'K' },
        ],
        defaultPrivacyShield: {
          shield_type: 'nda_watermark',
          enabled: true,
          watermark_signature: 'PROPRIETARY-MATERIALS-LAB-FINGERPRINT',
        },
        complianceVaultType: 'patent_nda',
        complianceVaultTitle: 'NDA & Patent Disclosure Vault',
        itemNoun: 'Material Crystal Specimen',
        itemPlural: 'Crystal Structures',
        labelNoun: 'Phase / Space Group',
      },
      {
        id: 'astronomy_spatial',
        category: 'Physical Sciences & Engineering',
        label: 'Observational Astronomy & Spatial Geodesy',
        desc: 'FITS optical and radio telescope surveys, light curves, and gravitational transit curves.',
        icon: 'overview',
        color: '#7C3AED',
        defaultDataTypes: ['Images', 'Time-Series', 'Tabular/CSV'],
        defaultMetrics: [
          { key: 'redshift_error', label: 'Photometric Redshift σ', unit: 'dz' },
          { key: 'transit_snr', label: 'Transit Signal-to-Noise', unit: 'SNR' },
          { key: 'magnitude_limit', label: 'Limiting Magnitude', unit: 'mag' },
        ],
        defaultCustomFields: [
          { key: 'spectral_band', label: 'Photometric Filter Band', type: 'category', options: ['u', 'g', 'r', 'i', 'z', 'J', 'H', 'K'] },
          { key: 'target_designation', label: 'Catalog ID (Gaia/TIC)', type: 'text', required: true },
          { key: 'exposure_seconds', label: 'Exposure Time (s)', type: 'number', unit: 's' },
        ],
        defaultPrivacyShield: {
          shield_type: 'nda_watermark',
          enabled: false,
        },
        complianceVaultType: 'observatory_permits',
        complianceVaultTitle: 'Telescope Allocation & Data Vault',
        itemNoun: 'Observation Frame / FITS',
        itemPlural: 'Observational Frames',
        labelNoun: 'Astrophysical Classification',
      },
    ],
  },
  {
    id: 'pure_ai_cs',
    title: 'Pure AI & Computer Science',
    description: 'Foundational vision models, LLM alignments, multimodal benchmarks, and RL environments.',
    icon: 'cpu',
    templates: [
      {
        id: 'cv_ai',
        category: 'Pure AI & Computer Science',
        label: 'Computer Vision & Deep Learning',
        desc: 'Object detection, instance segmentation, neural re-ID embeddings, and ablation matrices.',
        icon: 'cpu',
        color: '#EA580C',
        defaultDataTypes: ['Images'],
        defaultMetrics: [
          { key: 'mAP_50', label: 'mAP@50', unit: '%' },
          { key: 'mAP_50_95', label: 'mAP@50:95', unit: '%' },
          { key: 'latency_ms', label: 'Latency', unit: 'ms' },
          { key: 'params_m', label: 'Parameters', unit: 'M' },
        ],
        defaultCustomFields: [
          { key: 'model_architecture', label: 'Backbone Architecture', type: 'text' },
          { key: 'image_resolution', label: 'Input Resolution', type: 'category', options: ['512x512', '640x640', '1024x1024'] },
          { key: 'augmentation_preset', label: 'Augmentation Pipeline', type: 'text' },
        ],
        defaultPrivacyShield: {
          shield_type: 'nda_watermark',
          enabled: true,
        },
        complianceVaultType: 'model_licenses',
        complianceVaultTitle: 'AI Weights & Open Model License Vault',
        itemNoun: 'Benchmark Image',
        itemPlural: 'Benchmark Samples',
        labelNoun: 'Detection Class',
      },
      {
        id: 'pure_ai_llm',
        category: 'Pure AI & Computer Science',
        label: 'LLMs, Reasoning & Alignment',
        desc: 'Instruction tuning, RLHF preference datasets, synthetic data generation, and evaluation suites.',
        icon: 'sparkles',
        color: '#0D9488',
        defaultDataTypes: ['Text/Corpus', 'Tabular/CSV'],
        defaultMetrics: [
          { key: 'gsm8k_acc', label: 'GSM8K Accuracy', unit: '%' },
          { key: 'humaneval_pass1', label: 'HumanEval Pass@1', unit: '%' },
          { key: 'mt_bench', label: 'MT-Bench Score', unit: 'score' },
          { key: 'tokens_per_sec', label: 'Inference Throughput', unit: 'tok/s' },
        ],
        defaultCustomFields: [
          { key: 'prompt_category', label: 'Prompt Domain', type: 'category', options: ['Coding', 'Mathematics', 'Creative Writing', 'Reasoning', 'Translation'] },
          { key: 'context_window_k', label: 'Context Length (k)', type: 'number', unit: 'k' },
          { key: 'safety_tag', label: 'Red-Teaming Flag', type: 'boolean' },
        ],
        defaultPrivacyShield: {
          shield_type: 'nlp_pii',
          enabled: true,
          strip_pii_entities: true,
        },
        complianceVaultType: 'model_licenses',
        complianceVaultTitle: 'LLM Weights & Safety Audit Vault',
        itemNoun: 'Prompt-Response Pair',
        itemPlural: 'Benchmark Prompts',
        labelNoun: 'Evaluation Criterion',
      },
    ],
  },
  {
    id: 'custom_blank',
    title: 'Blank / Fully Custom Research Area',
    description: 'Build a completely custom zero-trust workspace from scratch with 100% user-defined schema.',
    icon: 'settings',
    templates: [
      {
        id: 'custom_blank',
        category: 'Blank / Fully Custom Research Area',
        label: 'Blank / Fully Custom Research Area',
        desc: 'Blank slate with 100% customizable metadata fields, arbitrary data formats, and flexible metric designer.',
        icon: 'settings',
        color: '#64748B',
        defaultDataTypes: ['Images', 'Tabular/CSV', 'Text/Corpus'],
        defaultMetrics: [
          { key: 'primary_metric', label: 'Primary Objective', unit: '%' },
          { key: 'p_value', label: 'Statistical p-value', unit: 'p' },
        ],
        defaultCustomFields: [
          { key: 'sample_id', label: 'Sample Identifier', type: 'text', required: true },
          { key: 'condition_group', label: 'Experimental Group', type: 'category', options: ['Control', 'Treatment A', 'Treatment B'] },
          { key: 'measurement_value', label: 'Measurement Value', type: 'number' },
        ],
        defaultPrivacyShield: {
          shield_type: 'nda_watermark',
          enabled: true,
        },
        complianceVaultType: 'custom_agreements',
        complianceVaultTitle: 'Custom Research Agreements & Compliance Vault',
        itemNoun: 'Custom Research Data Item',
        itemPlural: 'Data Items',
        labelNoun: 'Classification Target',
      },
    ],
  },
];

export const ALL_TEMPLATES: DisciplineTemplate[] = TEMPLATE_CATEGORIES.flatMap((c) => c.templates);

export function getDisciplineMeta(disciplineId?: string): DisciplineTemplate {
  const match = ALL_TEMPLATES.find((t) => t.id === disciplineId);
  if (match) return match;
  
  // Backwards compatibility aliases
  if (disciplineId === 'zoology') {
    return ALL_TEMPLATES.find((t) => t.id === 'zoology_ecology') || ALL_TEMPLATES[0];
  }
  if (disciplineId === 'ecology') {
    return ALL_TEMPLATES.find((t) => t.id === 'botany_ecology') || ALL_TEMPLATES[1];
  }
  if (disciplineId === 'biomedical') {
    return ALL_TEMPLATES.find((t) => t.id === 'radiology_clinical') || ALL_TEMPLATES[3];
  }

  // Fallback default
  return ALL_TEMPLATES[0];
}
