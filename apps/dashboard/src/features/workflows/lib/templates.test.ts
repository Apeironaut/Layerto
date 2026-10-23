import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicModelItem } from '@layerto/types';
import { TEMPLATES } from './templates.ts';
import { localIssues } from './graph.ts';

const models = [{ slug: 'turtle-id' }, { slug: 'bioclip' }] as PublicModelItem[];

test('every template is a valid workflow', () => {
  for (const t of TEMPLATES) {
    const issues = localIssues(t.build(models));
    assert.deepEqual(issues, { byNode: {}, general: [] }, t.id);
  }
});
