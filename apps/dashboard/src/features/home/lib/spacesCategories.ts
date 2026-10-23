import type { IconName } from '@layerto/ui';

export interface SpaceField {
  id: string;
  name: string;
  description?: string;
  icon?: IconName;
  isCustom?: boolean;
}

export interface SpaceCategory {
  id: string;
  name: string;
  icon?: IconName;
  description?: string;
  fields: SpaceField[];
  isCustom?: boolean;
}

export const STORAGE_KEY = 'layerto_user_sidebar_categories_v2';

/** Master predefined taxonomy of vast scientific, technical, and practical domain areas */
export const PREDEFINED_CATEGORIES: SpaceCategory[] = [
  {
    id: 'computer-science',
    name: 'Computer Science & AI',
    icon: 'cpu',
    description: 'Artificial intelligence, computer vision, language processing, robotics & systems infrastructure',
    fields: [
      {
        id: 'computer-vision',
        name: 'Computer Vision',
        icon: 'eye',
        description: 'Object detection, segmentation, pose estimation, depth maps, and 3D reconstruction',
      },
      {
        id: 'nlp',
        name: 'Natural Language Processing',
        icon: 'book',
        description: 'Large language models, embeddings, tokenizers, machine translation, and speech-to-text',
      },
      {
        id: 'datasets',
        name: 'Datasets & Benchmarks',
        icon: 'database',
        description: 'Image collections, ground-truth annotations, and validation benchmarks',
      },
      {
        id: 'ml-infra',
        name: 'ML Systems & MLOps',
        icon: 'cpu',
        description: 'Model inference pipelines, cluster deployment, quantization, and latency optimization',
      },
      {
        id: 'reinforcement-learning',
        name: 'Reinforcement Learning',
        icon: 'target',
        description: 'Policy gradients, robotic sim-to-real, reward models, and multi-agent systems',
      },
      {
        id: 'robotics',
        name: 'Robotics & Autonomous Systems',
        icon: 'settings',
        description: 'SLAM, path planning, sensor fusion, lidar perception, and manipulator control',
      },
      {
        id: 'speech-audio',
        name: 'Speech & Audio Processing',
        icon: 'play',
        description: 'Acoustic ASR, voice synthesis, speaker diarization, and neural audio codecs',
      },
      {
        id: 'cybersecurity-ai',
        name: 'Cybersecurity & AI Safety',
        icon: 'shield',
        description: 'Adversarial robustness, prompt injection defense, anomaly detection, and red-teaming',
      },
    ],
  },
  {
    id: 'zoology',
    name: 'Zoology & Marine Biology',
    icon: 'camera',
    description: 'Fauna monitoring, bioacoustics, marine ecology, species identification, and behavioral tracking',
    fields: [
      {
        id: 'wildlife',
        name: 'Wildlife Monitoring',
        icon: 'camera',
        description: 'Motion-activated camera traps, individual animal re-identification, and migration corridors',
      },
      {
        id: 'marine-biology',
        name: 'Marine Biology & Re-ID',
        icon: 'compass',
        description: 'Underwater visual census, coral reef health, pelagic species, and benthic surveys',
      },
      {
        id: 'bioacoustics',
        name: 'Bioacoustics & Soundscapes',
        icon: 'play',
        description: 'Passive acoustic monitoring, vocalization classification, soundscapes, and avian calls',
      },
      {
        id: 'entomology',
        name: 'Entomology & Insect Diversity',
        icon: 'layers',
        description: 'Pollinator monitoring, insect trap sensors, macro identification, and pest tracking',
      },
      {
        id: 'animal-behavior',
        name: 'Animal Behavioral Tracking',
        icon: 'eye',
        description: 'Kinematic pose tracking, social dynamics, herd movements, and foraging ethology',
      },
      {
        id: 'ornithology',
        name: 'Ornithology & Migration',
        icon: 'compass',
        description: 'Radar flight tracking, acoustic nocturnal calls, plumage keys, and nesting telemetry',
      },
    ],
  },
  {
    id: 'botany',
    name: 'Botany & Plant Science',
    icon: 'flask',
    description: 'Plant pathology, agricultural vision, flora taxonomy, forestry ecology, and phenotyping',
    fields: [
      {
        id: 'plant-pathology',
        name: 'Plant Pathology',
        icon: 'flask',
        description: 'Crop leaf lesions, bacterial blights, viral infections, and fungal deficiency diagnosis',
      },
      {
        id: 'flora-taxonomy',
        name: 'Flora & Herbarium Taxonomy',
        icon: 'book',
        description: 'Herbarium specimen digitization, taxonomic keys, and botanical classification',
      },
      {
        id: 'crop-vision',
        name: 'Agricultural & Crop Vision',
        icon: 'layers',
        description: 'Precision farming, yield estimation, weed detection, and aerial drone crop NDVI',
      },
      {
        id: 'forestry-canopy',
        name: 'Forestry & Canopy Ecology',
        icon: 'compass',
        description: 'Canopy height modeling, tree species segmentation, biomass estimation, and fire risk',
      },
      {
        id: 'soil-sensing',
        name: 'Soil & Nutrient Sensing',
        icon: 'database',
        description: 'Soil reflectance spectroscopy, organic carbon mapping, and root architecture imaging',
      },
      {
        id: 'horticulture',
        name: 'Horticulture & Greenhouse AI',
        icon: 'settings',
        description: 'Controlled environment agriculture, hydroponics, and automated maturity grading',
      },
    ],
  },
  {
    id: 'medicine',
    name: 'Medicine & Healthcare',
    icon: 'shield',
    description: 'Clinical diagnostics, medical imaging, genomics, digital pathology, and telemedicine',
    fields: [
      {
        id: 'medical-imaging',
        name: 'Medical Imaging & Diagnostics',
        icon: 'eye',
        description: 'MRI, CT, X-ray segmentation, anomaly detection, and radiological diagnostic AI',
      },
      {
        id: 'genomics-ai',
        name: 'Genomics & Bioinformatics',
        icon: 'database',
        description: 'DNA/RNA sequencing, protein structure folding, and variant pathogenicity prediction',
      },
      {
        id: 'histology',
        name: 'Histology & Digital Pathology',
        icon: 'flask',
        description: 'Whole slide biopsy imaging, cell nuclei classification, and oncological grading',
      },
      {
        id: 'biosignals',
        name: 'Bio-Signals & Telemedicine',
        icon: 'play',
        description: 'ECG/EEG waveforms, wearable biometric telemetry, and remote patient monitoring',
      },
      {
        id: 'pharmacology',
        name: 'Pharmacology & Drug Discovery',
        icon: 'sparkles',
        description: 'Molecular docking, binding affinity prediction, chemical screening, and synthesis',
      },
    ],
  },
  {
    id: 'physics-earth',
    name: 'Physics, Earth & Space',
    icon: 'compass',
    description: 'Deep sky surveys, satellite remote sensing, geophysics, and climate modeling',
    fields: [
      {
        id: 'astronomy',
        name: 'Astronomy & Deep Sky Surveys',
        icon: 'sparkles',
        description: 'Telescope surveys, galaxy morphology classification, and exoplanet transit detection',
      },
      {
        id: 'remote-sensing',
        name: 'Remote Sensing & Earth Observation',
        icon: 'compass',
        description: 'Multispectral satellite observation, land cover mapping, and urban heat analysis',
      },
      {
        id: 'climate-ai',
        name: 'Meteorology & Climate Modeling',
        icon: 'layers',
        description: 'Weather forecasting, storm tracking, precipitation modeling, and carbon cycles',
      },
      {
        id: 'geophysics',
        name: 'Geophysics & Seismology',
        icon: 'settings',
        description: 'Seismic wave analysis, fault rupture modeling, and volcanic tremor monitoring',
      },
    ],
  },
  {
    id: 'management',
    name: 'Management & Governance',
    icon: 'target',
    description: 'AI governance, research operations, compliance, strategy, and dataset licensing',
    fields: [
      {
        id: 'ai-governance',
        name: 'AI Governance & Ethics',
        icon: 'shield',
        description: 'Model risk auditing, bias mitigation, regulatory compliance, and transparency cards',
      },
      {
        id: 'lab-ops',
        name: 'Research & Lab Operations',
        icon: 'settings',
        description: 'GPU budget allocation, lab protocols, team collaboration, and reproducibility',
      },
      {
        id: 'project-strategy',
        name: 'Project Strategy & Grants',
        icon: 'target',
        description: 'Research roadmap planning, grant milestone tracking, and consortium deliverables',
      },
      {
        id: 'data-licensing',
        name: 'Data Licensing & IP Management',
        icon: 'book',
        description: 'Dataset copyrights, commercial licensing, open-source attribution, and provenance',
      },
    ],
  },
  {
    id: 'general-community',
    name: 'General & Community',
    icon: 'message',
    description: 'Open discussion, findings, demonstrations, questions, and collaborations',
    fields: [
      {
        id: 'general',
        name: 'General Discussion',
        icon: 'message',
        description: 'Open discussion about AI, scientific imaging, data, and building with Layerto',
      },
      {
        id: 'research',
        name: 'Research & Findings',
        icon: 'flask',
        description: 'Pre-prints, experimental outcomes, novel architectures, and findings',
      },
      {
        id: 'showcase',
        name: 'Showcase & Demos',
        icon: 'sparkles',
        description: 'Community demos, finished applications, and trained model showcases',
      },
      {
        id: 'help',
        name: 'Help & Support',
        icon: 'info',
        description: 'Questions, troubleshooting, technical guidance, and community help',
      },
      {
        id: 'jobs',
        name: 'Jobs & Collaborations',
        icon: 'team',
        description: 'Find research collaborators, dataset photographers, and team members',
      },
    ],
  },
];

export const DEFAULT_CATEGORIES: SpaceCategory[] = PREDEFINED_CATEGORIES;

/** Convert any title or name into a clean, URL-safe slug */
export function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'space';
}

/** Get a fresh deep copy of master predefined categories */
export function getPredefinedCategories(): SpaceCategory[] {
  return JSON.parse(JSON.stringify(PREDEFINED_CATEGORIES)) as SpaceCategory[];
}

/** Get a fresh deep copy of default categories */
export function getDefaultCategories(): SpaceCategory[] {
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)) as SpaceCategory[];
}

/** Load stored user categories from localStorage or return default categories */
export function loadStoredCategories(): SpaceCategory[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultCategories();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SpaceCategory[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  return getDefaultCategories();
}

/** Save categories to localStorage */
export function saveStoredCategories(categories: SpaceCategory[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // Ignore storage quota errors
  }
}

export const COLLAPSED_STORAGE_KEY = 'layerto_sidebar_collapsed_categories_v1';

/** Load stored collapsed category map from localStorage */
export function loadStoredCollapsedCategories(): Record<string, boolean> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, boolean>;
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  return {};
}

/** Save collapsed category map to localStorage */
export function saveStoredCollapsedCategories(collapsed: Record<string, boolean>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsed));
  } catch {
    // Ignore storage quota errors
  }
}

/** Remove an entire category from user's active sidebar by ID */
export function removeCategory(categories: SpaceCategory[], categoryId: string): SpaceCategory[] {
  return categories.filter((c) => c.id !== categoryId);
}

/** Remove a field from a category in user's active sidebar */
export function removeField(categories: SpaceCategory[], categoryId: string, fieldId: string): SpaceCategory[] {
  return categories.map((cat) => {
    if (cat.id !== categoryId) return cat;
    return {
      ...cat,
      fields: cat.fields.filter((f) => f.id !== fieldId),
    };
  });
}

/** Check if a field ID is currently in the active sidebar */
export function isFieldInSidebar(categories: SpaceCategory[], fieldId: string): boolean {
  return categories.some((c) => c.fields.some((f) => f.id === fieldId));
}

/** Check if a category ID is currently in the active sidebar */
export function isCategoryInSidebar(categories: SpaceCategory[], categoryId: string): boolean {
  return categories.some((c) => c.id === categoryId);
}

/** Check if all fields of a predefined category are present in the active sidebar */
export function isPredefinedCategoryFullyAdded(categories: SpaceCategory[], categoryId: string): boolean {
  const predefined = PREDEFINED_CATEGORIES.find((c) => c.id === categoryId);
  if (!predefined) return false;
  const current = categories.find((c) => c.id === categoryId);
  if (!current) return false;
  return predefined.fields.every((pf) => current.fields.some((cf) => cf.id === pf.id));
}

/** Add or restore an entire predefined category with all its fields to the sidebar */
export function addPredefinedCategoryToSidebar(categories: SpaceCategory[], categoryId: string): SpaceCategory[] {
  const predefined = PREDEFINED_CATEGORIES.find((c) => c.id === categoryId);
  if (!predefined) return categories;

  const existing = categories.find((c) => c.id === categoryId);
  if (!existing) {
    return [...categories, JSON.parse(JSON.stringify(predefined))];
  }

  // If category exists but was missing some fields, restore all predefined fields
  return categories.map((cat) => {
    if (cat.id !== categoryId) return cat;
    return {
      ...cat,
      fields: JSON.parse(JSON.stringify(predefined.fields)),
    };
  });
}

/** Add a specific predefined field to a category in the user's sidebar */
export function addPredefinedFieldToSidebar(
  categories: SpaceCategory[],
  categoryId: string,
  fieldId: string,
): SpaceCategory[] {
  const predefinedCat = PREDEFINED_CATEGORIES.find((c) => c.id === categoryId);
  if (!predefinedCat) return categories;

  const predefinedField = predefinedCat.fields.find((f) => f.id === fieldId);
  if (!predefinedField) return categories;

  const existingCat = categories.find((c) => c.id === categoryId);
  if (!existingCat) {
    // Add category with this single field
    const newCat: SpaceCategory = {
      ...predefinedCat,
      fields: [JSON.parse(JSON.stringify(predefinedField))],
    };
    return [...categories, newCat];
  }

  if (existingCat.fields.some((f) => f.id === fieldId)) {
    return categories; // Already in sidebar
  }

  return categories.map((cat) => {
    if (cat.id !== categoryId) return cat;
    return {
      ...cat,
      fields: [...cat.fields, JSON.parse(JSON.stringify(predefinedField))],
    };
  });
}

/** Toggle a predefined field's presence in the user's sidebar */
export function togglePredefinedFieldInSidebar(
  categories: SpaceCategory[],
  categoryId: string,
  fieldId: string,
): SpaceCategory[] {
  if (isFieldInSidebar(categories, fieldId)) {
    return removeField(categories, categoryId, fieldId);
  }
  return addPredefinedFieldToSidebar(categories, categoryId, fieldId);
}

/** Backward compatibility helper for programmatic category additions in tests */
export function addCategory(categories: SpaceCategory[], name: string, icon?: IconName): SpaceCategory[] {
  const trimmed = name.trim();
  if (!trimmed) return categories;

  let baseSlug = slugify(trimmed);
  let slug = baseSlug;
  let counter = 1;
  const existingIds = new Set(categories.map((c) => c.id));
  while (existingIds.has(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const newCat: SpaceCategory = {
    id: slug,
    name: trimmed,
    icon: icon || 'folder',
    description: `Category: ${trimmed}`,
    fields: [],
    isCustom: true,
  };

  return [...categories, newCat];
}

/** Backward compatibility helper for programmatic field additions in tests */
export function addField(
  categories: SpaceCategory[],
  categoryId: string,
  name: string,
  customSlug?: string,
  icon?: IconName,
  description?: string,
): SpaceCategory[] {
  const trimmed = name.trim();
  if (!trimmed) return categories;

  const targetCategory = categories.find((c) => c.id === categoryId);
  if (!targetCategory) return categories;

  const allFieldIds = new Set(categories.flatMap((c) => c.fields.map((f) => f.id)));
  const rawSlug = slugify(customSlug?.trim() || trimmed);
  const baseSlug = rawSlug.startsWith('c-') || rawSlug.startsWith('custom-') ? rawSlug : `c-${rawSlug}`;
  let slug = baseSlug;
  let counter = 1;
  while (allFieldIds.has(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const newField: SpaceField = {
    id: slug,
    name: trimmed,
    icon: icon || 'message',
    description: description?.trim() || `Field under ${targetCategory.name}`,
    isCustom: true,
  };

  return categories.map((cat) => {
    if (cat.id !== categoryId) return cat;
    return {
      ...cat,
      fields: [...cat.fields, newField],
    };
  });
}

/** Filter categories and their fields based on a search query */
export function filterCategories(categories: SpaceCategory[], query: string): SpaceCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories;

  return categories
    .map((cat) => {
      const matchingFields = cat.fields.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q)),
      );

      if (matchingFields.length > 0) {
        return {
          ...cat,
          fields: matchingFields,
        };
      }

      const catMatches =
        cat.name.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q));

      if (catMatches) {
        return cat;
      }

      return null;
    })
    .filter((cat): cat is SpaceCategory => cat !== null);
}

/** Find a field and its parent category by field ID. Checks active categories first, then master predefined categories. */
export function findField(
  categories: SpaceCategory[],
  fieldId: string,
): { category: SpaceCategory; field: SpaceField } | undefined {
  for (const cat of categories) {
    const f = cat.fields.find((field) => field.id === fieldId);
    if (f) return { category: cat, field: f };
  }
  for (const cat of PREDEFINED_CATEGORIES) {
    const f = cat.fields.find((field) => field.id === fieldId);
    if (f) return { category: cat, field: f };
  }
  return undefined;
}

/** Get human-readable display name for any space field ID */
export function getFieldDisplayName(categories: SpaceCategory[], fieldId: string): string {
  if (!fieldId) return 'All spaces';
  const found = findField(categories, fieldId);
  if (found) return found.field.name;

  // Fallback prettification for unknown slugs, trimming c- or custom- prefixes
  const cleanSlug = fieldId.replace(/^(c-|custom-)/, '');
  return cleanSlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
