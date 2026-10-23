import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicModelItem } from '@layerto/types';
import { matchesModel, sectionModels } from './modelSearch.ts';

const m = (slug: string, name: string, description = ''): PublicModelItem => ({ slug, name, description, license: '', is_open: true, price_usd: '0.001000', meta: {} });
const models = [m('turtle-id', 'Turtle ID', 'sea turtle species'), m('bioclip', 'BioCLIP', 'biology'), m('plate', 'Plate reader', 'number plates')];

test('search matches every word across fields', () => {
  assert.equal(matchesModel(models[0], 'sea TURTLE'), true);
  assert.equal(matchesModel(models[0], 'sea plate'), false);
});

test('sections keep favourites first without duplicates', () => {
  const s = sectionModels(models, '', ['plate'], ['bioclip', 'plate']);
  assert.deepEqual(s.favorites.map((x) => x.slug), ['plate']);
  assert.deepEqual(s.recent.map((x) => x.slug), ['bioclip']);
  assert.deepEqual(s.others.map((x) => x.slug), ['turtle-id']);
  const q = sectionModels(models, 'bio', ['plate'], ['bioclip']);
  assert.deepEqual([...q.favorites, ...q.recent, ...q.others].map((x) => x.slug), ['bioclip']);
});
