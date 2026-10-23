-- Seed realistic production-grade data for isolated Research Areas 1 and 2
-- Owner: naviya@gmail.com (555992cb-4d55-4882-bd67-8a446dcf207b)

DO $$
DECLARE
  v_uid UUID := '555992cb-4d55-4882-bd67-8a446dcf207b';
  v_area1 UUID := '98c159ce-deab-4f6f-a142-a32bed45d4f3';
  v_area2 UUID := 'fbf58930-fe36-4b7a-bf7c-a6bd1da65bc2';
  v_spec1 UUID;
  v_spec2 UUID;
  v_spec3 UUID;
  v_spec4 UUID;
BEGIN
  -- 1. Ensure Research Area 1 (Marine Zoology)
  INSERT INTO research_areas (id, owner_id, name, description, color, status, is_public, discipline, hypothesis, reproducibility_lock, storage_bytes_used, gpu_seconds_used, custom_metrics, isolation_level)
  VALUES (
    v_area1,
    v_uid,
    'Marine Zoology & Fauna Photo-ID Research',
    'Non-invasive computer vision photo-ID of endangered sea turtles and marine megafauna in Indo-Pacific coastal waters.',
    '#0D9488',
    'active',
    true,
    'zoology',
    'Unique scute topological graphs remain mathematically invariant across juvenile-to-adult ontogenetic stages, enabling lifelong non-invasive re-identification.',
    true,
    15246788220,
    43200,
    '[{"key": "carapace_length_cm", "label": "Carapace Length", "unit": "cm"}, {"key": "scute_count", "label": "Lateral Scutes", "unit": "count"}, {"key": "reid_confidence", "label": "Re-ID Confidence", "unit": "%"}]'::jsonb,
    'air_gapped'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    status = EXCLUDED.status,
    discipline = EXCLUDED.discipline,
    hypothesis = EXCLUDED.hypothesis,
    reproducibility_lock = EXCLUDED.reproducibility_lock,
    storage_bytes_used = EXCLUDED.storage_bytes_used,
    gpu_seconds_used = EXCLUDED.gpu_seconds_used,
    custom_metrics = EXCLUDED.custom_metrics,
    isolation_level = EXCLUDED.isolation_level;

  -- 2. Ensure Research Area 2 (Forest Canopy)
  INSERT INTO research_areas (id, owner_id, name, description, color, status, is_public, discipline, hypothesis, reproducibility_lock, storage_bytes_used, gpu_seconds_used, custom_metrics, isolation_level)
  VALUES (
    v_area2,
    v_uid,
    'Autonomous Aerial Forest Canopy Analysis',
    'LiDAR and multi-spectral UAV photogrammetry for biomass estimation and emergent tree species classification in Sinharaja Rainforest.',
    '#16A34A',
    'active',
    false,
    'ecology',
    'Multi-return LiDAR waveform depth coupled with high-resolution RGB orthomosaics enables aboveground carbon biomass estimation within 6.8% RMSE of destructive ground sampling.',
    false,
    8320491800,
    28800,
    '[{"key": "crown_diameter_m", "label": "Crown Diameter", "unit": "m"}, {"key": "biomass_tonnes", "label": "Estimated Biomass", "unit": "t/ha"}, {"key": "canopy_height_m", "label": "Canopy Height", "unit": "m"}]'::jsonb,
    'air_gapped'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    status = EXCLUDED.status,
    discipline = EXCLUDED.discipline,
    hypothesis = EXCLUDED.hypothesis,
    reproducibility_lock = EXCLUDED.reproducibility_lock,
    storage_bytes_used = EXCLUDED.storage_bytes_used,
    gpu_seconds_used = EXCLUDED.gpu_seconds_used,
    custom_metrics = EXCLUDED.custom_metrics,
    isolation_level = EXCLUDED.isolation_level;

  -- Clear previous demo data for clean isolation
  DELETE FROM research_specimens WHERE area_id IN (v_area1, v_area2);
  DELETE FROM research_dataset_splits WHERE area_id IN (v_area1, v_area2);
  DELETE FROM research_ablation_runs WHERE area_id IN (v_area1, v_area2);
  DELETE FROM research_arena_items WHERE area_id IN (v_area1, v_area2);
  DELETE FROM research_collaboration_contracts WHERE area_id IN (v_area1, v_area2);
  DELETE FROM research_domain_insights WHERE area_id IN (v_area1, v_area2);
  DELETE FROM research_publications WHERE area_id IN (v_area1, v_area2);

  -- 3. Area 1 Specimens
  INSERT INTO research_specimens (id, area_id, owner_id, title, taxonomy_species, common_name, media_url, media_type, gps_lat, gps_lng, habitat, morphometrics, observation_date, notes)
  VALUES
  (
    gen_random_uuid(), v_area1, v_uid,
    'Green Turtle Adult Female (ID: SL-CM-042)',
    'Chelonia mydas',
    'Green Sea Turtle',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    'photo',
    6.0329, 80.2168,
    'Inshore fringing coral reef, Galle Sanctuary, depth 4.5m',
    '{"carapace_length_cm": 98.4, "weight_kg": 134.2, "lateral_scutes": 4, "tag_id": "RFID-8821", "reid_confidence": 98.6}'::jsonb,
    '2026-10-14',
    'Healthy mature female foraging on Halodule uninervis seagrass beds. Right post-orbital head scales cleanly visible with pristine scute margins.'
  ) RETURNING id INTO v_spec1;

  INSERT INTO research_specimens (id, area_id, owner_id, title, taxonomy_species, common_name, media_url, media_type, gps_lat, gps_lng, habitat, morphometrics, observation_date, notes)
  VALUES
  (
    gen_random_uuid(), v_area1, v_uid,
    'Hawksbill Subadult (ID: SL-EI-018)',
    'Eretmochelys imbricata',
    'Hawksbill Sea Turtle',
    'https://images.unsplash.com/photo-1518467166778-b88f373ffec7?auto=format&fit=crop&w=1200&q=80',
    'photo',
    5.9482, 80.4716,
    'Rocky reef drop-off, Mirissa Bay, depth 9.2m',
    '{"carapace_length_cm": 64.1, "weight_kg": 42.8, "lateral_scutes": 4, "beak_index": 1.28, "reid_confidence": 96.2}'::jsonb,
    '2026-10-18',
    'Distinct serrated posterior marginal scutes with tortoiseshell amber marbling pattern. Feed on Spheciospongia vagabunda sponges.'
  ) RETURNING id INTO v_spec2;

  INSERT INTO research_specimens (id, area_id, owner_id, title, taxonomy_species, common_name, media_url, media_type, gps_lat, gps_lng, habitat, morphometrics, observation_date, notes)
  VALUES
  (
    gen_random_uuid(), v_area1, v_uid,
    'Loggerhead Foraging Male (ID: SL-CC-007)',
    'Caretta caretta',
    'Loggerhead Sea Turtle',
    'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=1200&q=80',
    'photo',
    6.1215, 80.1102,
    'Barrier reef sandy channel, Hikkaduwa National Park, depth 7.0m',
    '{"carapace_length_cm": 105.2, "weight_kg": 148.6, "lateral_scutes": 5, "head_width_cm": 24.1, "reid_confidence": 94.8}'::jsonb,
    '2026-10-19',
    'Massive cephalic structure, 5 costal scute pairs confirmed with zero tag scarring. Mollusc shell crushing observed.'
  ) RETURNING id INTO v_spec3;

  INSERT INTO research_specimens (id, area_id, owner_id, title, taxonomy_species, common_name, media_url, media_type, gps_lat, gps_lng, habitat, morphometrics, observation_date, notes)
  VALUES
  (
    gen_random_uuid(), v_area1, v_uid,
    'Olive Ridley Juvenile (ID: SL-LO-031)',
    'Lepidochelys olivacea',
    'Olive Ridley Sea Turtle',
    'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?auto=format&fit=crop&w=1200&q=80',
    'photo',
    5.9721, 80.5218,
    'Shallow coastal lagoon, Polhena Reef, depth 2.1m',
    '{"carapace_length_cm": 52.3, "weight_kg": 28.5, "lateral_scutes": 6, "scute_asymmetry": true, "reid_confidence": 92.4}'::jsonb,
    '2026-10-21',
    'Characteristic circular carapace profile with 6 asymmetric lateral scutes. Juvenile pelagic recruitment stage.'
  ) RETURNING id INTO v_spec4;

  -- 4. Area 2 Specimens (Forest Canopy - Completely air-gapped!)
  INSERT INTO research_specimens (id, area_id, owner_id, title, taxonomy_species, common_name, media_url, media_type, gps_lat, gps_lng, habitat, morphometrics, observation_date, notes)
  VALUES
  (
    gen_random_uuid(), v_area2, v_uid,
    'Dipterocarpus zeylanicus Super-Canopy Emergent (SIN-DZ-104)',
    'Dipterocarpus zeylanicus',
    'Hora Tree',
    'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80',
    'photo',
    6.4251, 80.4632,
    'Sinharaja Core Biosphere Reserve, ridge crest at 540m AMSL',
    '{"canopy_height_m": 46.2, "crown_diameter_m": 18.5, "biomass_tonnes": 14.8, "leaf_area_index": 5.4}'::jsonb,
    '2026-10-15',
    'Dominant emergent rainforest tree crown. Aerial drone photogrammetry at 120m AGL reveals 96% crown foliage health.'
  ),
  (
    gen_random_uuid(), v_area2, v_uid,
    'Mesua ferrea Ironwood Subcanopy Cluster (SIN-MF-058)',
    'Mesua ferrea',
    'Ceylon Ironwood / Na',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
    'photo',
    6.4189, 80.4578,
    'Valley stream riparian corridor, Sinharaja, 410m AMSL',
    '{"canopy_height_m": 31.8, "crown_diameter_m": 12.1, "biomass_tonnes": 8.2, "leaf_area_index": 6.1}'::jsonb,
    '2026-10-17',
    'Young reddish-pink foliage flush distinctly highlighted in near-infrared orthomosaic band 4.'
  );

  -- 5. Area 1 Dataset Splits & Split Leakage Guard
  INSERT INTO research_dataset_splits (area_id, owner_id, version_tag, description, total_samples, train_count, val_count, test_count, class_distribution, leakage_detected, leakage_details)
  VALUES
  (
    v_area1, v_uid,
    'v1.0-raw',
    'Initial field camera traps and diver photographic survey archive (Unfiltered).',
    12400, 8680, 1860, 1860,
    '{"Chelonia mydas": 5600, "Eretmochelys imbricata": 3100, "Caretta caretta": 2100, "Lepidochelys olivacea": 1600}'::jsonb,
    true,
    '[{"sample_a": "IMG_4821_galle.jpg", "sample_b": "IMG_4822_galle.jpg", "split_a": "train", "split_b": "val", "similarity_score": 0.994, "issue": "High perceptual hash near-duplicate in Train and Validation splits"}]'::jsonb
  ),
  (
    v_area1, v_uid,
    'v1.1-cleaned',
    'Deduplicated and hash-verified splits with Zero Split Leakage guaranteed.',
    10850, 7595, 1627, 1628,
    '{"Chelonia mydas": 4820, "Eretmochelys imbricata": 2650, "Caretta caretta": 1840, "Lepidochelys olivacea": 1540}'::jsonb,
    false,
    '[]'::jsonb
  );

  -- 6. Area 2 Dataset Splits
  INSERT INTO research_dataset_splits (area_id, owner_id, version_tag, description, total_samples, train_count, val_count, test_count, class_distribution, leakage_detected, leakage_details)
  VALUES
  (
    v_area2, v_uid,
    'v1.0-aerial',
    'Multi-sensor UAV survey orthomosaic tiles (LiDAR point clouds + RGB).',
    5200, 3640, 780, 780,
    '{"Dipterocarpus zeylanicus": 2100, "Mesua ferrea": 1600, "Shorea": 1500}'::jsonb,
    false,
    '[]'::jsonb
  );

  -- 7. Area 1 Ablation Matrix Runs
  INSERT INTO research_ablation_runs (area_id, owner_id, run_name, architecture, is_baseline, hyperparameters, metrics, status, notes)
  VALUES
  (
    v_area1, v_uid,
    'YOLOv11m-Baseline',
    'YOLOv11m',
    true,
    '{"lr": 0.001, "batch_size": 32, "optimizer": "AdamW", "img_size": 640, "epochs": 100, "augment": "standard"}'::jsonb,
    '{"map50_95": 52.4, "precision": 84.1, "recall": 79.5, "f1": 81.7, "inference_ms": 6.2, "gflops": 68.0}'::jsonb,
    'completed',
    'Baseline control model pinned for automatic green/red delta comparisons.'
  ),
  (
    v_area1, v_uid,
    'YOLOv11m + BioCLIP ReID',
    'YOLOv11m + BioCLIP-ViT/L',
    false,
    '{"lr": 0.0005, "batch_size": 32, "optimizer": "AdamW", "img_size": 640, "epochs": 100, "augment": "scute_contrastive"}'::jsonb,
    '{"map50_95": 56.5, "precision": 88.6, "recall": 84.2, "f1": 86.3, "inference_ms": 8.0, "gflops": 94.2}'::jsonb,
    'completed',
    '+4.1% mAP improvement with superior cross-year individual matching on adult turtles.'
  ),
  (
    v_area1, v_uid,
    'YOLOv11x + Contrastive Scute Loss',
    'YOLOv11x + GraphConv',
    false,
    '{"lr": 0.0003, "batch_size": 16, "optimizer": "AdamW", "img_size": 1024, "epochs": 150, "augment": "scute_contrastive+affine"}'::jsonb,
    '{"map50_95": 58.2, "precision": 91.2, "recall": 86.8, "f1": 88.9, "inference_ms": 10.7, "gflops": 194.5}'::jsonb,
    'completed',
    'Highest overall mAP on juvenile specimens with high algae or partial occlusion.'
  ),
  (
    v_area1, v_uid,
    'DINOv2-Small Edge Probe',
    'DINOv2-S + LinearProbe',
    false,
    '{"lr": 0.002, "batch_size": 64, "optimizer": "SGD", "img_size": 518, "epochs": 80, "augment": "standard"}'::jsonb,
    '{"map50_95": 50.3, "precision": 81.0, "recall": 76.4, "f1": 78.6, "inference_ms": 4.1, "gflops": 42.1}'::jsonb,
    'completed',
    'Fastest inference speed (4.1ms) designed for solar-powered autonomous marine buoys.'
  );

  -- 8. Area 2 Ablation Runs
  INSERT INTO research_ablation_runs (area_id, owner_id, run_name, architecture, is_baseline, hyperparameters, metrics, status, notes)
  VALUES
  (
    v_area2, v_uid,
    'CanopyNet-Base (RGB)',
    'UNet-ResNet50',
    true,
    '{"lr": 0.001, "batch_size": 16, "img_size": 512}'::jsonb,
    '{"map50_95": 61.2, "precision": 78.5, "recall": 72.0, "f1": 75.1, "inference_ms": 14.2, "rmse_biomass": 12.4}'::jsonb,
    'completed',
    'RGB-only baseline model for tree crown segmentation.'
  ),
  (
    v_area2, v_uid,
    'CanopyNet-LiDAR-Fusion',
    'DualBranch-FusionViT',
    false,
    '{"lr": 0.0004, "batch_size": 8, "img_size": 512}'::jsonb,
    '{"map50_95": 74.8, "precision": 91.4, "recall": 86.2, "f1": 88.7, "inference_ms": 22.5, "rmse_biomass": 6.8}'::jsonb,
    'completed',
    'Dual-sensor fusion achieves 6.8% RMSE on aboveground carbon biomass estimation.'
  );

  -- 9. Area 1 Visual Error Arena
  INSERT INTO research_arena_items (area_id, specimen_id, image_url, sample_name, ground_truth, model_a_prediction, model_b_prediction, failure_category, difficulty)
  VALUES
  (
    v_area1, v_spec1,
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
    'Coral Texture Ambiguity #041',
    '{"label": "Background (Brain Coral)", "bbox": [120, 140, 280, 260]}'::jsonb,
    '{"model": "YOLOv11m-Base", "label": "Chelonia mydas (Carapace)", "confidence": 0.89, "bbox": [115, 138, 285, 265]}'::jsonb,
    '{"model": "YOLOv11+BioCLIP", "label": "Background (Brain Coral)", "confidence": 0.94, "bbox": [120, 140, 280, 260]}'::jsonb,
    'false_positive',
    'hard'
  ),
  (
    v_area1, v_spec2,
    'https://images.unsplash.com/photo-1518467166778-b88f373ffec7?auto=format&fit=crop&w=800&q=80',
    'Algae-Covered Scute Margin #119',
    '{"label": "Chelonia mydas", "confidence": 1.0}'::jsonb,
    '{"model": "YOLOv11m-Base", "label": "Eretmochelys imbricata", "confidence": 0.72}'::jsonb,
    '{"model": "YOLOv11+BioCLIP", "label": "Chelonia mydas", "confidence": 0.91}'::jsonb,
    'disagreement',
    'hard'
  ),
  (
    v_area1, v_spec3,
    'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=800&q=80',
    'Under-Ledge Occlusion #088',
    '{"label": "Caretta caretta", "visible_pct": 42}'::jsonb,
    '{"model": "YOLOv11m-Base", "label": "Caretta caretta", "confidence": 0.48}'::jsonb,
    '{"model": "YOLOv11+BioCLIP", "label": "Caretta caretta", "confidence": 0.84}'::jsonb,
    'boundary_uncertainty',
    'medium'
  );

  -- 10. Area 1 Interdisciplinary Collaboration Contracts (Pillar 2)
  INSERT INTO research_collaboration_contracts (area_id, creator_id, collaborator_email, collaborator_name, team_name, collaboration_model, credit_roles, royalty_percentage, bounty_amount_cents, bounty_status, data_sandbox_permission, status)
  VALUES
  (
    v_area1, v_uid,
    'vision-lab@oxford.ac.uk',
    'Oxford DeepVision AI Team',
    'DeepVision Research Lab',
    'royalty_split',
    '["Methodology", "Software", "Formal Analysis", "Validation"]'::jsonb,
    30.0,
    0,
    'pending',
    'compute_only',
    'active'
  ),
  (
    v_area1, v_uid,
    'alex.chen@fieldtech.org',
    'Alex Chen, Acoustic & GPS Lead',
    'FieldTech Alliance',
    'voluntary_credit',
    '["Data Curation", "Investigation", "Resources"]'::jsonb,
    0.0,
    0,
    'pending',
    'compute_only',
    'active'
  ),
  (
    v_area1, v_uid,
    'annotation-team@biome.org',
    'Biome Annotation Guild',
    'Biome Data Services',
    'paid_bounty',
    '["Data Curation"]'::jsonb,
    0.0,
    150000,
    'escrow_funded',
    'compute_only',
    'active'
  );

  -- Area 2 Collaboration Contract
  INSERT INTO research_collaboration_contracts (area_id, creator_id, collaborator_email, collaborator_name, team_name, collaboration_model, credit_roles, royalty_percentage, bounty_amount_cents, bounty_status, data_sandbox_permission, status)
  VALUES
  (
    v_area2, v_uid,
    'uav-lab@zurich.edu',
    'Autonomous Drone Lab Zurich',
    'ETH Zurich Aerial Robotics',
    'voluntary_credit',
    '["Methodology", "Software", "Hardware Design"]'::jsonb,
    0.0,
    0,
    'pending',
    'compute_only',
    'active'
  );

  -- 11. Area 1 Domain Insights (Bridge)
  INSERT INTO research_domain_insights (area_id, creator_id, title, insight_type, content, chart_data, pinned)
  VALUES
  (
    v_area1, v_uid,
    'YOLOv11+BioCLIP Achieves 94.2% Automated Re-ID Accuracy on Indented Scutes',
    'model_accuracy',
    'The fine-tuned BioCLIP topological re-identification model has achieved 94.2% top-1 match accuracy on the Sri Lankan turtle catalog, correctly linking 41 turtles across multi-year encounters without tag loss.',
    '{"baseline": 78.4, "new_model": 94.2, "delta": "+15.8%"}'::jsonb,
    true
  ),
  (
    v_area1, v_uid,
    'Foraging Site Fidelity Confirmed Across Galle & Mirissa Reefs',
    'population_trend',
    'Spatial clustering of 142 encounters indicates 88% micro-habitat fidelity among sub-adult green turtles within a 2.4km radius over 24 months.',
    '{"site_fidelity_rate": 88.0, "total_tracked": 42}'::jsonb,
    true
  );

  -- 12. Area 1 Publications & Monetization Studio (Pillar 3)
  INSERT INTO research_publications (area_id, owner_id, title, doi, abstract, pdf_url, pricing_model, paper_price_cents, dataset_price_cents, model_price_cents, royalty_split_rules, downloads_count, gross_revenue_cents, is_published, badges)
  VALUES
  (
    v_area1, v_uid,
    'Zero-Shot Re-Identification of Endangered Indo-Pacific Sea Turtles via Neural Scute Graphs',
    '10.1038/s41598-026-08921-x',
    'Non-invasive computer vision methods for individual animal re-identification present massive advantages over physical tagging. Here we demonstrate invariant topological graph extraction from lateral turtle scutes, achieving state-of-the-art accuracy across 10,850 photographic encounters.',
    'https://layerto.com/papers/turtle-reid-2026.pdf',
    'tiered',
    1200,
    14900,
    4900,
    '[{"party": "Dr. Naviya C. (Lead Researcher)", "share_pct": 65}, {"party": "Oxford DeepVision Team (AI Tech)", "share_pct": 30}, {"party": "Layerto Research Platform", "share_pct": 5}]'::jsonb,
    342,
    482000,
    true,
    '["Verified Field Data", "Reproducible Pipeline", "Interdisciplinary Collaboration"]'::jsonb
  );

  -- Area 2 Publication
  INSERT INTO research_publications (area_id, owner_id, title, doi, abstract, pdf_url, pricing_model, paper_price_cents, dataset_price_cents, model_price_cents, royalty_split_rules, downloads_count, gross_revenue_cents, is_published, badges)
  VALUES
  (
    v_area2, v_uid,
    'High-Resolution Rainforest Canopy Density Estimation via Multi-Sensor UAV Swarms',
    '10.1109/TGRS.2026.3129841',
    'Deep learning fusion of waveform LiDAR and RGB photogrammetry for tropical rainforest carbon accounting.',
    'https://layerto.com/papers/canopy-density-2026.pdf',
    'open_access',
    0,
    29900,
    0,
    '[{"party": "Forest Ecology Lab (Lead)", "share_pct": 70}, {"party": "Drone Robotics Lab", "share_pct": 25}, {"party": "Platform Fee", "share_pct": 5}]'::jsonb,
    128,
    149500,
    true,
    '["Verified Field Data", "Open Science"]'::jsonb
  );

END $$;
