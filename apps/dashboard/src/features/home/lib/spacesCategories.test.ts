import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDEFINED_CATEGORIES,
  getDefaultCategories,
  getPredefinedCategories,
  slugify,
  addCategory,
  removeCategory,
  addField,
  removeField,
  addPredefinedCategoryToSidebar,
  addPredefinedFieldToSidebar,
  togglePredefinedFieldInSidebar,
  isFieldInSidebar,
  isCategoryInSidebar,
  isPredefinedCategoryFullyAdded,
  filterCategories,
  findField,
  getFieldDisplayName,
  loadStoredCollapsedCategories,
  saveStoredCollapsedCategories,
} from './spacesCategories.ts';

test('PREDEFINED_CATEGORIES covers vast scientific, technical and research areas', () => {
  const cats = getPredefinedCategories();
  assert.equal(cats.length, 7, 'Should have 7 vast domain categories');

  const catIds = cats.map((c) => c.id);
  assert.deepEqual(catIds, [
    'computer-science',
    'zoology',
    'botany',
    'medicine',
    'physics-earth',
    'management',
    'general-community',
  ]);

  const totalFields = cats.reduce((acc, c) => acc + c.fields.length, 0);
  assert.equal(totalFields, 38, 'Should have 38 predefined domain fields');

  // Verify key areas requested by user
  const cs = cats.find((c) => c.id === 'computer-science');
  assert.ok(cs?.fields.some((f) => f.id === 'computer-vision'));
  assert.ok(cs?.fields.some((f) => f.id === 'robotics'));

  const zoology = cats.find((c) => c.id === 'zoology');
  assert.ok(zoology?.fields.some((f) => f.id === 'wildlife'));
  assert.ok(zoology?.fields.some((f) => f.id === 'marine-biology'));

  const botany = cats.find((c) => c.id === 'botany');
  assert.ok(botany?.fields.some((f) => f.id === 'plant-pathology'));
  assert.ok(botany?.fields.some((f) => f.id === 'crop-vision'));

  const medicine = cats.find((c) => c.id === 'medicine');
  assert.ok(medicine?.fields.some((f) => f.id === 'medical-imaging'));
  assert.ok(medicine?.fields.some((f) => f.id === 'genomics-ai'));

  const physics = cats.find((c) => c.id === 'physics-earth');
  assert.ok(physics?.fields.some((f) => f.id === 'astronomy'));
  assert.ok(physics?.fields.some((f) => f.id === 'remote-sensing'));

  const mgmt = cats.find((c) => c.id === 'management');
  assert.ok(mgmt?.fields.some((f) => f.id === 'ai-governance'));
  assert.ok(mgmt?.fields.some((f) => f.id === 'data-licensing'));
});

test('sidebar management: removeCategory and addPredefinedCategoryToSidebar', () => {
  const initial = getDefaultCategories();
  assert.equal(isCategoryInSidebar(initial, 'medicine'), true);

  // Remove medicine from sidebar
  const withoutMedicine = removeCategory(initial, 'medicine');
  assert.equal(withoutMedicine.length, initial.length - 1);
  assert.equal(isCategoryInSidebar(withoutMedicine, 'medicine'), false);
  assert.equal(isFieldInSidebar(withoutMedicine, 'medical-imaging'), false);

  // Re-add medicine from predefined library
  const restored = addPredefinedCategoryToSidebar(withoutMedicine, 'medicine');
  assert.equal(restored.length, initial.length);
  assert.equal(isCategoryInSidebar(restored, 'medicine'), true);
  assert.equal(isFieldInSidebar(restored, 'medical-imaging'), true);
  assert.equal(isPredefinedCategoryFullyAdded(restored, 'medicine'), true);
});

test('sidebar management: removeField, addPredefinedFieldToSidebar, and toggle', () => {
  const initial = getDefaultCategories();
  assert.equal(isFieldInSidebar(initial, 'robotics'), true);

  // Remove single field
  const removedRobotics = removeField(initial, 'computer-science', 'robotics');
  assert.equal(isFieldInSidebar(removedRobotics, 'robotics'), false);
  assert.equal(isPredefinedCategoryFullyAdded(removedRobotics, 'computer-science'), false);

  // Add field back
  const addedBack = addPredefinedFieldToSidebar(removedRobotics, 'computer-science', 'robotics');
  assert.equal(isFieldInSidebar(addedBack, 'robotics'), true);
  assert.equal(isPredefinedCategoryFullyAdded(addedBack, 'computer-science'), true);

  // Toggle field off and on
  const toggledOff = togglePredefinedFieldInSidebar(addedBack, 'computer-science', 'robotics');
  assert.equal(isFieldInSidebar(toggledOff, 'robotics'), false);

  const toggledOn = togglePredefinedFieldInSidebar(toggledOff, 'computer-science', 'robotics');
  assert.equal(isFieldInSidebar(toggledOn, 'robotics'), true);
});

test('addPredefinedFieldToSidebar adds category if it was previously removed from sidebar', () => {
  const initial = getDefaultCategories();
  const withoutZoology = removeCategory(initial, 'zoology');
  assert.equal(isCategoryInSidebar(withoutZoology, 'zoology'), false);

  // Add just one field from zoology
  const withMarineOnly = addPredefinedFieldToSidebar(withoutZoology, 'zoology', 'marine-biology');
  assert.equal(isCategoryInSidebar(withMarineOnly, 'zoology'), true);
  const zoo = withMarineOnly.find((c) => c.id === 'zoology');
  assert.equal(zoo?.fields.length, 1);
  assert.equal(zoo?.fields[0].id, 'marine-biology');
});

test('slugify cleans names into URL-safe slugs', () => {
  assert.equal(slugify('Computer Vision & AI!'), 'computer-vision-ai');
  assert.equal(slugify('  Marine   Biology  '), 'marine-biology');
  assert.equal(slugify(''), 'space');
  assert.equal(slugify('Plant-Pathology_v2'), 'plant-pathology_v2');
});

test('filterCategories filters across categories and fields', () => {
  const cats = getDefaultCategories();

  // Empty query returns all
  assert.equal(filterCategories(cats, '').length, cats.length);

  // Search by category name returns all fields of that category
  const csSearch = filterCategories(cats, 'computer science');
  assert.equal(csSearch.length, 1);
  assert.equal(csSearch[0].id, 'computer-science');
  assert.equal(csSearch[0].fields.length, 8);

  // Search by field name returns matching category with only that field
  const wildlifeSearch = filterCategories(cats, 'wildlife');
  assert.equal(wildlifeSearch.length, 1);
  assert.equal(wildlifeSearch[0].id, 'zoology');
  assert.equal(wildlifeSearch[0].fields.length, 1);
  assert.equal(wildlifeSearch[0].fields[0].id, 'wildlife');

  // Search with no matches returns empty array
  assert.equal(filterCategories(cats, 'nonexistentdomainxyz').length, 0);
});

test('findField and getFieldDisplayName identify fields correctly, even if hidden from sidebar', () => {
  const initial = getDefaultCategories();
  const hiddenAstronomy = removeCategory(initial, 'physics-earth');

  // findField falls back to PREDEFINED_CATEGORIES if not in active sidebar
  const found = findField(hiddenAstronomy, 'astronomy');
  assert.ok(found);
  assert.equal(found.category.id, 'physics-earth');
  assert.equal(found.field.name, 'Astronomy & Deep Sky Surveys');

  assert.equal(getFieldDisplayName(hiddenAstronomy, ''), 'All spaces');
  assert.equal(getFieldDisplayName(hiddenAstronomy, 'computer-vision'), 'Computer Vision');
  assert.equal(getFieldDisplayName(hiddenAstronomy, 'astronomy'), 'Astronomy & Deep Sky Surveys');
  assert.equal(getFieldDisplayName(hiddenAstronomy, 'custom-unknown-field'), 'Unknown Field');
});

test('collapsed categories localStorage persistence', () => {
  // Test storage mock or safe execution in node
  const collapsed = { 'computer-science': true, zoology: false };
  saveStoredCollapsedCategories(collapsed);
  const loaded = loadStoredCollapsedCategories();
  assert.deepEqual(loaded, {}); // in node environment without window, returns empty object safely
});
