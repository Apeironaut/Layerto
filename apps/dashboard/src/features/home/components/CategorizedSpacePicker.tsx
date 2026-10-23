import { useMemo, useState } from 'react';
import type { Space } from '@layerto/types';
import { Button, Icon, Input, Modal, cn } from '@layerto/ui';
import {
  PREDEFINED_CATEGORIES,
  filterCategories,
  findField,
} from '../lib/spacesCategories';
import { SPACE_ICON } from '../util';

interface CategorizedSpacePickerProps {
  value: Space;
  onChange: (space: Space) => void;
  label?: string;
}

export function CategorizedSpacePicker({ value, onChange, label = 'Category & Field' }: CategorizedSpacePickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const currentSelection = useMemo(() => {
    return findField(PREDEFINED_CATEGORIES, value);
  }, [value]);

  const filteredCategories = useMemo(() => {
    return filterCategories(PREDEFINED_CATEGORIES, search);
  }, [search]);

  const handleSelectField = (fieldId: string) => {
    onChange(fieldId as Space);
    setPickerOpen(false);
    setSearch('');
  };

  const activeIcon = currentSelection?.field.icon || SPACE_ICON[value] || 'message';

  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-ink">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-control border border-line-strong bg-card px-3 py-2 text-left text-sm hover:border-crimson-border cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid size-6 place-items-center rounded bg-crimson-tint text-crimson shrink-0">
            <Icon name={activeIcon} size={14} />
          </span>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
              {currentSelection?.category.name || 'Domain Category'}
            </span>
            <span className="font-medium text-ink block truncate">
              {currentSelection?.field.name || value || 'Select a field'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted shrink-0">
          <span className="text-xs hidden sm:inline">Change</span>
          <Icon name="chevronDown" size={14} />
        </div>
      </button>

      {/* Main Picker Modal */}
      <Modal
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setSearch('');
        }}
        title="Select Area & Field"
        description="Choose the most relevant domain area and topic field for your post."
        size="lg"
      >
        <div className="space-y-4">
          {/* Header search */}
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domain areas or topics (e.g. vision, wildlife, crop, pathology, astronomy)…"
              aria-label="Search categories and fields"
              className="py-1.5"
              autoFocus
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

          {/* Grouped Categories & Fields */}
          <div className="max-h-[26rem] overflow-y-auto space-y-3 pr-1">
            {filteredCategories.length === 0 ? (
              <div className="rounded-control border border-line bg-page p-6 text-center">
                <p className="text-sm text-muted">No domain areas or fields match &ldquo;{search}&rdquo;</p>
                <div className="mt-3 flex justify-center">
                  <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                </div>
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.id} className="rounded-l2 border border-line bg-page p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <Icon name={cat.icon || 'folder'} size={15} className="text-crimson" />
                      <span>{cat.name}</span>
                      <span className="text-[10px] text-muted font-mono font-normal">
                        ({cat.fields.length} {cat.fields.length === 1 ? 'field' : 'fields'})
                      </span>
                    </div>
                  </div>

                  {/* Field buttons grid */}
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {cat.fields.map((f) => {
                      const isSelected = value === f.id;
                      const fieldIcon = f.icon || SPACE_ICON[f.id] || 'message';

                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectField(f.id)}
                          className={cn(
                            'group flex items-start gap-2.5 rounded-control border p-2 text-left cursor-pointer transition-all',
                            isSelected
                              ? 'border-crimson bg-crimson-tint shadow-xs'
                              : 'border-line bg-card hover:border-line-strong hover:bg-card',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-6 shrink-0 place-items-center rounded mt-0.5',
                              isSelected ? 'bg-crimson text-white' : 'bg-page text-muted',
                            )}
                          >
                            <Icon name={fieldIcon} size={13} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block text-xs font-medium truncate',
                                isSelected ? 'text-crimson font-bold' : 'text-ink',
                              )}
                            >
                              {f.name}
                            </span>
                            {f.description && (
                              <span className="block text-[11px] text-muted truncate">{f.description}</span>
                            )}
                          </div>
                          {isSelected && (
                            <Icon name="check" size={14} className="text-crimson shrink-0 mt-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end border-t border-line pt-3">
            <Button
              variant="ghost"
              onClick={() => {
                setPickerOpen(false);
                setSearch('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
