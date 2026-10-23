import { useMemo, useState } from 'react';
import type { Space } from '@layerto/types';
import { Button, ConfirmModal, Icon, Input, Modal, cn, useNotify } from '@layerto/ui';
import {
  PREDEFINED_CATEGORIES,
  type SpaceCategory,
  addPredefinedCategoryToSidebar,
  filterCategories,
  getDefaultCategories,
  isCategoryInSidebar,
  isFieldInSidebar,
  isPredefinedCategoryFullyAdded,
  loadStoredCollapsedCategories,
  removeCategory,
  removeField,
  saveStoredCategories,
  saveStoredCollapsedCategories,
  togglePredefinedFieldInSidebar,
} from '../lib/spacesCategories';
import { SPACE_ICON } from '../util';

interface CategorySpacesPanelProps {
  currentSpace: Space | '';
  onSelectSpace: (space: Space | '') => void;
  categories: SpaceCategory[];
  onChangeCategories: (categories: SpaceCategory[]) => void;
  spacesMetaCounts: Record<string, number>;
  totalPosts: number;
}

export function CategorySpacesPanel({
  currentSpace,
  onSelectSpace,
  categories,
  onChangeCategories,
  spacesMetaCounts,
  totalPosts,
}: CategorySpacesPanelProps) {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() =>
    loadStoredCollapsedCategories(),
  );

  // Catalog / Manage Sidebar modal
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Confirmation modal for removing an entire category
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'category' | 'field';
    catId: string;
    fieldId?: string;
    title: string;
  } | null>(null);

  const toggleCollapse = (catId: string) => {
    setCollapsedCategories((prev) => {
      const next = {
        ...prev,
        [catId]: !prev[catId],
      };
      saveStoredCollapsedCategories(next);
      return next;
    });
  };

  const filteredCategories = useMemo(() => {
    return filterCategories(categories, search);
  }, [categories, search]);

  const filteredCatalog = useMemo(() => {
    return filterCategories(PREDEFINED_CATEGORIES, catalogSearch);
  }, [catalogSearch]);

  const handleToggleFieldInSidebar = (catId: string, fieldId: string, fieldName: string) => {
    const isCurrentlyIn = isFieldInSidebar(categories, fieldId);
    const updated = togglePredefinedFieldInSidebar(categories, catId, fieldId);
    onChangeCategories(updated);
    saveStoredCategories(updated);

    if (isCurrentlyIn) {
      if (currentSpace === fieldId) {
        onSelectSpace('');
      }
      notify(`Removed "${fieldName}" from sidebar`, 'info');
    } else {
      notify(`Added "${fieldName}" to sidebar`, 'success');
    }
  };

  const handleAddAllCategoryFields = (catId: string, catName: string) => {
    const updated = addPredefinedCategoryToSidebar(categories, catId);
    onChangeCategories(updated);
    saveStoredCategories(updated);
    notify(`Added all fields in "${catName}" to sidebar`, 'success');
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'category') {
      const updated = removeCategory(categories, confirmDelete.catId);
      onChangeCategories(updated);
      saveStoredCategories(updated);
      notify('Category removed from sidebar', 'info');
    } else if (confirmDelete.type === 'field' && confirmDelete.fieldId) {
      const updated = removeField(categories, confirmDelete.catId, confirmDelete.fieldId);
      onChangeCategories(updated);
      saveStoredCategories(updated);
      if (currentSpace === confirmDelete.fieldId) {
        onSelectSpace('');
      }
      notify('Field removed from sidebar', 'info');
    }
    setConfirmDelete(null);
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultCategories();
    onChangeCategories(defaults);
    saveStoredCategories(defaults);
    setCollapsedCategories({});
    saveStoredCollapsedCategories({});
    notify('Reset sidebar to all predefined domain areas', 'info');
  };

  return (
    <div className="sticky top-3 sm:top-4 space-y-3">
      {/* Top Controls Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Categories & Fields</p>
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-crimson hover:bg-crimson-tint border border-crimson-border cursor-pointer transition-colors shadow-2xs"
            title="Browse predefined areas and add to sidebar"
          >
            <Icon name="plus" size={12} />
            <span>Add Areas</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your areas & fields…"
            aria-label="Search categories and fields"
            className="text-xs py-1.5"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
              aria-label="Clear search"
            >
              <Icon name="close" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* All spaces master button */}
      <button
        type="button"
        onClick={() => onSelectSpace('')}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-control px-3 py-2 text-sm text-left cursor-pointer transition-colors border',
          currentSpace === ''
            ? 'border-crimson-border bg-crimson-tint text-ink font-semibold shadow-sm'
            : 'border-transparent text-ink-secondary hover:bg-card hover:border-line',
        )}
      >
        <span
          className={cn(
            'grid size-6 place-items-center rounded-control',
            currentSpace === '' ? 'bg-crimson text-white' : 'bg-page text-muted',
          )}
        >
          <Icon name="compass" size={14} />
        </span>
        <span className="flex-1 font-medium">All spaces</span>
        <span className="text-[11px] text-muted font-mono font-medium">{totalPosts}</span>
      </button>

      {/* Categories & Fields List */}
      <div className="space-y-2.5 max-h-[calc(100vh-15rem)] overflow-y-auto pr-0.5">
        {filteredCategories.length === 0 ? (
          <div className="rounded-control border border-line bg-card p-4 text-center">
            <p className="text-xs text-muted">
              {search
                ? `No active areas match "${search}"`
                : 'No areas in your sidebar yet.'}
            </p>
            <div className="mt-2.5 flex justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => setCatalogOpen(true)}
              >
                Add from catalog
              </Button>
              {search && (
                <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
                  Clear filter
                </Button>
              )}
            </div>
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const isCollapsed = !search && !!collapsedCategories[cat.id];
            const catPostCount = cat.fields.reduce((acc, f) => acc + (spacesMetaCounts[f.id] || 0), 0);

            return (
              <div key={cat.id} className="rounded-control border border-line/60 bg-card/60 p-1.5 transition-all">
                {/* Category Header */}
                <div className="group flex items-center justify-between gap-1.5 px-2 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(cat.id)}
                    className="flex items-center gap-1.5 font-semibold text-ink hover:text-crimson cursor-pointer min-w-0 flex-1 text-left"
                  >
                    <Icon
                      name={isCollapsed ? 'chevronRight' : 'chevronDown'}
                      size={13}
                      className="text-muted transition-transform shrink-0"
                    />
                    <Icon name={cat.icon || 'folder'} size={14} className="text-crimson shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {catPostCount > 0 && (
                      <span
                        className="text-[10px] text-muted font-mono px-1 rounded bg-page"
                        title={`${catPostCount} total posts`}
                      >
                        {catPostCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogSearch(cat.name);
                        setCatalogOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-crimson hover:bg-page rounded cursor-pointer transition-opacity"
                      title={`Manage fields in ${cat.name}`}
                      aria-label={`Manage fields in ${cat.name}`}
                    >
                      <Icon name="plus" size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDelete({
                          type: 'category',
                          catId: cat.id,
                          title: `Remove category "${cat.name}" and its ${cat.fields.length} fields from your sidebar?`,
                        })
                      }
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-crimson hover:bg-page rounded cursor-pointer transition-opacity"
                      title={`Remove ${cat.name} from sidebar`}
                      aria-label={`Remove ${cat.name} from sidebar`}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </div>

                {/* Field Items */}
                {!isCollapsed && (
                  <div className="mt-1 space-y-0.5 pl-2.5 border-l border-line/50 ml-2">
                    {cat.fields.length === 0 ? (
                      <div className="px-2 py-1 text-[11px] text-muted italic">
                        No active fields.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setCatalogSearch(cat.name);
                            setCatalogOpen(true);
                          }}
                          className="text-crimson hover:underline cursor-pointer font-medium"
                        >
                          + Add from catalog
                        </button>
                      </div>
                    ) : (
                      cat.fields.map((f) => {
                        const isSelected = currentSpace === f.id;
                        const postCount = spacesMetaCounts[f.id] ?? 0;
                        const iconName = f.icon || SPACE_ICON[f.id] || 'message';

                        return (
                          <div
                            key={f.id}
                            className={cn(
                              'group/field flex items-center justify-between rounded-control px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-crimson-tint text-ink font-semibold'
                                : 'text-ink-secondary hover:bg-card hover:text-ink',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectSpace(f.id as Space)}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <Icon
                                name={iconName}
                                size={14}
                                className={isSelected ? 'text-crimson' : 'text-muted shrink-0'}
                              />
                              <span className="truncate">{f.name}</span>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                              {postCount > 0 && (
                                <span className="text-[10px] text-muted font-mono">{postCount}</span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDelete({
                                    type: 'field',
                                    catId: cat.id,
                                    fieldId: f.id,
                                    title: `Remove field "${f.name}" from your sidebar?`,
                                  });
                                }}
                                className="opacity-0 group-hover/field:opacity-100 p-0.5 text-muted hover:text-crimson rounded cursor-pointer transition-opacity"
                                title={`Remove "${f.name}" from sidebar`}
                                aria-label={`Remove field ${f.name}`}
                              >
                                <Icon name="trash" size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer controls: Add areas and Reset */}
      <div className="pt-1 flex flex-col items-center gap-1.5 text-center">
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="text-xs text-crimson hover:underline cursor-pointer font-medium inline-flex items-center gap-1"
        >
          <Icon name="plus" size={12} />
          <span>Browse predefined catalog</span>
        </button>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="text-[11px] text-muted hover:text-ink hover:underline cursor-pointer"
        >
          Reset sidebar to defaults
        </button>
      </div>

      {/* Catalog Modal: Browse & Add Predefined Areas */}
      <Modal
        isOpen={catalogOpen}
        onClose={() => {
          setCatalogOpen(false);
          setCatalogSearch('');
        }}
        title="Add Categories & Fields to Sidebar"
        description="Browse all predefined scientific, technical, and practical areas to pin or customize your sidebar."
        size="lg"
      >
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search all domain areas, topics, or models (e.g. computer vision, wildlife, pathology)…"
              aria-label="Search predefined catalog"
              className="py-1.5"
              autoFocus
            />
            {catalogSearch && (
              <button
                type="button"
                onClick={() => setCatalogSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                aria-label="Clear catalog search"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>

          {/* Predefined Categories and Fields List */}
          <div className="max-h-[26rem] overflow-y-auto space-y-3.5 pr-1">
            {filteredCatalog.length === 0 ? (
              <div className="rounded-control border border-line bg-page p-6 text-center">
                <p className="text-sm text-muted">No predefined areas match &ldquo;{catalogSearch}&rdquo;</p>
                <Button size="sm" variant="ghost" onClick={() => setCatalogSearch('')} className="mt-2">
                  Clear search
                </Button>
              </div>
            ) : (
              filteredCatalog.map((cat) => {
                const isFullyAdded = isPredefinedCategoryFullyAdded(categories, cat.id);
                const isCatPresent = isCategoryInSidebar(categories, cat.id);

                return (
                  <div key={cat.id} className="rounded-l2 border border-line bg-card p-3 space-y-2.5 shadow-2xs">
                    {/* Category Title & Quick Action */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/50 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid size-6 place-items-center rounded bg-crimson-tint text-crimson shrink-0">
                          <Icon name={cat.icon || 'folder'} size={14} />
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-ink truncate">{cat.name}</h4>
                          {cat.description && (
                            <p className="text-[11px] text-muted truncate">{cat.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isFullyAdded ? (
                          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-500/10 border border-emerald-500/20">
                            <Icon name="check" size={11} />
                            <span>All in sidebar</span>
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            icon="plus"
                            onClick={() => handleAddAllCategoryFields(cat.id, cat.name)}
                          >
                            {isCatPresent ? 'Add remaining fields' : 'Add category'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Fields Grid */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {cat.fields.map((f) => {
                        const inSidebar = isFieldInSidebar(categories, f.id);
                        const fieldIcon = f.icon || SPACE_ICON[f.id] || 'message';

                        return (
                          <div
                            key={f.id}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-control border p-2 transition-all',
                              inSidebar
                                ? 'border-crimson-border/60 bg-crimson-tint/30'
                                : 'border-line bg-page hover:border-line-strong',
                            )}
                          >
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <span
                                className={cn(
                                  'grid size-5.5 place-items-center rounded shrink-0 mt-0.5',
                                  inSidebar ? 'bg-crimson text-white' : 'bg-card text-muted border border-line',
                                )}
                              >
                                <Icon name={fieldIcon} size={12} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block text-xs font-medium text-ink truncate">{f.name}</span>
                                {f.description && (
                                  <span className="block text-[11px] text-muted truncate">{f.description}</span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleFieldInSidebar(cat.id, f.id, f.name)}
                              className={cn(
                                'shrink-0 rounded px-2 py-1 text-[11px] font-medium cursor-pointer transition-colors border',
                                inSidebar
                                  ? 'bg-card text-muted hover:text-crimson hover:border-crimson-border border-line'
                                  : 'bg-crimson text-white hover:bg-crimson-hover border-transparent',
                              )}
                            >
                              {inSidebar ? 'Remove' : '+ Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-muted hover:text-ink hover:underline cursor-pointer"
            >
              Reset to all default areas
            </button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setCatalogOpen(false);
                setCatalogSearch('');
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete !== null}
        title={confirmDelete?.type === 'category' ? 'Remove Category?' : 'Remove Field?'}
        description={confirmDelete?.title || 'This item will be removed from your sidebar view.'}
        confirmLabel="Remove"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
