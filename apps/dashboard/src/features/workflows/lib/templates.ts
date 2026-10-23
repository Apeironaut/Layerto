import type { PublicModelItem, WorkflowDefinition, WorkflowNode } from '@layerto/types';
import type { IconName } from '@layerto/ui';
import { defaultConditionConfig, defaultForEachConfig, defaultInputConfig, defaultModelConfig, defaultOutputConfig } from './definition.ts';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  /** Builds the definition with the first available models. */
  build: (models: PublicModelItem[]) => WorkflowDefinition;
}

const at = (x: number, y: number) => ({ x: x * 340, y: 120 + y * 170 });
const slug = (models: PublicModelItem[], i: number) => models[i]?.slug ?? models[0]?.slug ?? '';

function io(maxImages: number, extra: WorkflowNode[], edges: WorkflowDefinition['edges'], outX: number, layout: 'by_image' | 'by_step' = 'by_image'): WorkflowDefinition {
  return {
    version: 2,
    nodes: [
      { id: 'input', type: 'input', position: at(0, 0), config: { ...defaultInputConfig(), max_images: maxImages } },
      ...extra,
      { id: 'output', type: 'output', position: at(outX, 0), config: { ...defaultOutputConfig(), layout } },
    ],
    edges,
  };
}

export const TEMPLATES: Template[] = [
  {
    id: 'single',
    name: 'One model',
    description: 'Send images to a single model and get its predictions.',
    icon: 'cpu',
    build: (m) =>
      io(10, [{ id: 'm_1', type: 'model', position: at(1, 0), config: defaultModelConfig(slug(m, 0)) }], [
        { id: 'e_input_m_1', source: 'input', target: 'm_1' },
        { id: 'e_m_1_output', source: 'm_1', target: 'output' },
      ], 2),
  },
  {
    id: 'detect-classify',
    name: 'Detect, then classify each object',
    description: 'Find objects, crop each one, and run a second model on every crop.',
    icon: 'repeat',
    build: (m) => {
      const def = io(10, [
        { id: 'm_1', type: 'model', position: at(1, 0), config: { ...defaultModelConfig(slug(m, 0)), label: 'Detect' } },
        { id: 'f_1', type: 'for_each', position: at(2, 0), config: defaultForEachConfig() },
        { id: 'm_2', type: 'model', position: at(3, 0), config: { ...defaultModelConfig(slug(m, 1)), label: 'Classify' } },
      ], [
        { id: 'e_input_m_1', source: 'input', target: 'm_1' },
        { id: 'e_m_1_f_1', source: 'm_1', target: 'f_1' },
        { id: 'e_f_1_m_2', source: 'f_1', target: 'm_2' },
        { id: 'e_m_2_output', source: 'm_2', target: 'output' },
      ], 4);
      const out = def.nodes.find((n) => n.type === 'output');
      if (out?.type === 'output') out.config.fields = ['label', 'confidence', 'bbox', 'step', 'parent'];
      return def;
    },
  },
  {
    id: 'only-if-found',
    name: 'Only continue when something is found',
    description: 'Run a second model only on images where the first one found a match.',
    icon: 'branch',
    build: (m) =>
      io(10, [
        { id: 'm_1', type: 'model', position: at(1, 0), config: { ...defaultModelConfig(slug(m, 0)), label: 'Check' } },
        { id: 'c_1', type: 'condition', position: at(2, 0), config: defaultConditionConfig() },
        { id: 'm_2', type: 'model', position: at(3, -0.5), config: { ...defaultModelConfig(slug(m, 1)), label: 'Identify' } },
      ], [
        { id: 'e_input_m_1', source: 'input', target: 'm_1' },
        { id: 'e_m_1_c_1', source: 'm_1', target: 'c_1' },
        { id: 'e_c_1_yes_m_2', source: 'c_1', target: 'm_2', source_handle: 'yes' },
        { id: 'e_m_1_output', source: 'm_1', target: 'output' },
        { id: 'e_m_2_output', source: 'm_2', target: 'output' },
      ], 4, 'by_step'),
  },
  {
    id: 'compare',
    name: 'Compare two models',
    description: 'Run two models side by side on the same images.',
    icon: 'layers',
    build: (m) =>
      io(10, [
        { id: 'm_1', type: 'model', position: at(1, -0.5), config: defaultModelConfig(slug(m, 0)) },
        { id: 'm_2', type: 'model', position: at(1, 0.5), config: defaultModelConfig(slug(m, 1)) },
      ], [
        { id: 'e_input_m_1', source: 'input', target: 'm_1' },
        { id: 'e_input_m_2', source: 'input', target: 'm_2' },
        { id: 'e_m_1_output', source: 'm_1', target: 'output' },
        { id: 'e_m_2_output', source: 'm_2', target: 'output' },
      ], 2, 'by_step'),
  },
];

export function findTemplate(id: string | undefined): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
