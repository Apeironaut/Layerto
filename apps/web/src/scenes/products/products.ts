import type { ChipVariant } from '@layerto/ui';

/** Copy for the Products section. Facts only; no metrics we can't back up. */
export interface Product {
  id: 'vision' | 'charon';
  name: string;
  status: { label: string; variant: ChipVariant };
  tagline: string;
  what: string;
  who: string;
  points: string[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'vision',
    name: 'Layerto Vision',
    status: { label: 'Live', variant: 'active' },
    tagline: 'Specialist image recognition through one API.',
    what:
      'You send an image. Layerto runs it through a model trained for that exact subject and sends back what it found: a label, a confidence score and a box around each object.',
    who:
      'Apps and teams that need to recognise one specific kind of thing, like a species, a product or a part, without collecting thousands of photos and training a model themselves.',
    points: [
      'Call a model by name, or send a short prompt and let Auto choose',
      'Plain JSON back: label, confidence, box',
      'Runs open models and LTVision, detection models we design and train ourselves',
      'Images are processed in memory and never stored',
      'Pay only for calls that succeed',
    ],
  },
  {
    id: 'charon',
    name: 'Charon',
    status: { label: 'Coming soon', variant: 'pending' },
    tagline: 'Rules and records for AI agents.',
    what:
      'Charon sits between an AI agent and the tools it can use. Before every action it checks your rules and decides: allow it, block it, or ask a person first. Then it records what happened.',
    who:
      'Teams letting agents touch real systems, like payments, email or databases, who need control over what the agent may do and proof of what it did.',
    points: [
      'A policy check before every tool call',
      'Human approval for risky actions',
      'A tamper-evident log of every attempt and result',
    ],
  },
];
