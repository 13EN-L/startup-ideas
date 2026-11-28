// Settings -> "Modify categories and plant mappings": rename, add and remove
// task categories (1-20, names up to 20 characters) and pick the plant each
// one grows. Several categories may share a plant, and a category may grow
// none. Changes save straight away (a rename when its box is left) and only
// affect tasks completed later.
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  addCategory,
  canAddCategory,
  canRemoveCategory,
  categoriesForPlant,
  categoryLabelError,
  firstUnusedPlant,
  isPlantId,
  normalizeCategoryLabel,
  removeCategory,
  renameCategory,
  setCategoryPlant,
} from '../../core/categories';
import { getPlantGrowth, type Plants } from '../../core/growth';
import { GROWTH_STAGES, MAX_CATEGORIES, MAX_CATEGORY_LABEL_LENGTH, PLANTS } from '../../shared/constants';
import type { Category, PlantId } from '../../shared/types';
import { plantPreviewImage } from '../assets';

export interface CategoriesPageProps {
  categories: Category[];
  /** Current growth, shown beside each plant (never changed by this page). */
  plants: Plants;
  /** Called with the complete new list after every valid change. */
  onChange: (categories: Category[]) => void;
  onBack: () => void;
  /** Id for a new category; injectable for tests. */
  createId?: () => string;
}

const defaultCreateId = () => crypto.randomUUID();

/** "" in a plant <select> means "No plant". */
const toPlant = (value: string): PlantId | null => (isPlantId(value) ? value : null);

export function CategoriesPage({
  categories,
  plants,
  onChange,
  onBack,
  createId = defaultCreateId,
}: CategoriesPageProps) {
  const titleId = useId();
  const listTitleId = useId();
  const plantsTitleId = useId();
  const [removed, setRemoved] = useState<{ category: Category; index: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const remove = (category: Category) => {
    const index = categories.findIndex((c) => c.id === category.id);
    onChange(removeCategory(categories, category.id));
    setRemoved({ category, index });
    setNotice(null);
  };

  const undoRemove = () => {
    if (!removed) return;
    try {
      onChange(addCategory(categories, removed.category, removed.index));
      setNotice(null);
    } catch (e) {
      setNotice(`Couldn't bring back "${removed.category.label}": ${(e as Error).message}`);
    }
    setRemoved(null);
  };

  return (
    <div className="page page--categories">
      <section className="sky sky--categories">
        <div className="categories-panel" role="region" aria-labelledby={titleId}>
          <header className="categories-panel__header">
            <button type="button" className="btn btn--secondary categories-panel__back" onClick={onBack}>
              <span aria-hidden="true">←</span> Back to settings
            </button>
            <div>
              <h1 id={titleId} className="categories-panel__title">
                Categories &amp; plants
              </h1>
              <p className="categories-panel__intro">
                Name your task categories and choose the plant each one grows. Several categories can share a plant.
              </p>
            </div>
          </header>

          <div className="categories-layout">
            <section className="categories-card" aria-labelledby={listTitleId}>
              <div className="categories-card__heading">
                <h2 id={listTitleId}>Your categories</h2>
                <span className="count-badge" aria-label={`${categories.length} of ${MAX_CATEGORIES} categories`}>
                  {categories.length} / {MAX_CATEGORIES}
                </span>
              </div>

              <ul className="category-list">
                {categories.map((category, index) => (
                  <CategoryRow
                    key={category.id}
                    index={index}
                    category={category}
                    categories={categories}
                    canRemove={canRemoveCategory(categories)}
                    onRename={(label) => onChange(renameCategory(categories, category.id, label))}
                    onChangePlant={(plant) => onChange(setCategoryPlant(categories, category.id, plant))}
                    onRemove={() => remove(category)}
                  />
                ))}
              </ul>

              {(removed || notice) && (
                <div className="categories-notice" role="status">
                  {removed ? (
                    <>
                      <span>Removed "{removed.category.label}".</span>
                      <button type="button" className="link-button" onClick={undoRemove}>
                        Undo
                      </button>
                    </>
                  ) : (
                    <span>{notice}</span>
                  )}
                </div>
              )}

              <AddCategoryForm
                categories={categories}
                onAdd={(label, plant) => {
                  onChange(addCategory(categories, { id: createId(), label, plant }));
                  setRemoved(null);
                  setNotice(null);
                }}
              />
            </section>

            <section className="categories-card" aria-labelledby={plantsTitleId}>
              <div className="categories-card__heading">
                <h2 id={plantsTitleId}>Your plants</h2>
              </div>
              <ul className="plant-board">
                {PLANTS.map((plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant.id}
                    label={plant.label}
                    categories={categoriesForPlant(categories, plant.id)}
                    totalMinutes={plants[plant.id]?.totalMinutes}
                  />
                ))}
              </ul>
            </section>
          </div>

          <p className="categories-panel__note">
            <span className="categories-panel__note-icon" aria-hidden="true">
              i
            </span>
            Changes apply to tasks you finish from now on. Moving a category to another plant doesn't move any growth:
            every plant keeps what it has already grown.
          </p>
        </div>
      </section>
      <div className="categories-grass" aria-hidden="true" />
    </div>
  );
}

interface CategoryRowProps {
  index: number;
  category: Category;
  categories: Category[];
  canRemove: boolean;
  onRename: (label: string) => void;
  onChangePlant: (plant: PlantId | null) => void;
  onRemove: () => void;
}

function CategoryRow({ index, category, categories, canRemove, onRename, onChangePlant, onRemove }: CategoryRowProps) {
  const errorId = useId();
  // What is typed: checked as you type, saved on Enter or leaving the box,
  // and put back to the saved name if it isn't a valid one.
  const [draft, setDraft] = useState(category.label);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  // Follow outside changes to the saved name.
  useEffect(() => {
    setDraft(category.label);
    setError(null);
  }, [category.label]);

  const type = (value: string) => {
    setDraft(value);
    setError(categoryLabelError(value, categories, category.id));
  };

  const commit = () => {
    if (!error && normalizeCategoryLabel(draft) !== category.label) onRename(draft);
    setDraft(error ? category.label : normalizeCategoryLabel(draft));
    setError(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      // Revert first so the blur that follows saves nothing.
      setDraft(category.label);
      setError(null);
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  const onBlur = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    commit();
  };

  return (
    <li className={`category-row${error ? ' category-row--invalid' : ''}`} data-testid={`category-row-${index}`}>
      <PlantThumb plant={category.plant} />
      <div className="category-row__name">
        <input
          className="category-row__input"
          aria-label={`Category ${index + 1} name`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          maxLength={MAX_CATEGORY_LABEL_LENGTH}
          spellCheck={false}
          value={draft}
          onChange={(e) => type(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        <span className="char-count" aria-hidden="true">
          {draft.length}/{MAX_CATEGORY_LABEL_LENGTH}
        </span>
      </div>
      <PlantSelect
        label={`Plant for ${category.label}`}
        value={category.plant}
        onChange={onChangePlant}
        className="category-row__plant"
      />
      <button
        type="button"
        className="icon-button category-row__remove"
        aria-label={`Remove ${category.label}`}
        title={canRemove ? `Remove ${category.label}` : 'You need at least one category'}
        disabled={!canRemove}
        onClick={onRemove}
      >
        <span aria-hidden="true">×</span>
      </button>
      {error && (
        <p id={errorId} className="category-row__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function AddCategoryForm({
  categories,
  onAdd,
}: {
  categories: Category[];
  onAdd: (label: string, plant: PlantId | null) => void;
}) {
  const nameId = useId();
  const errorId = useId();
  const [label, setLabel] = useState('');
  const [plant, setPlant] = useState<PlantId | null>(() => firstUnusedPlant(categories));
  const full = !canAddCategory(categories);
  // Only complain once there is something to complain about.
  const error = normalizeCategoryLabel(label) ? categoryLabelError(label, categories) : null;
  const canSubmit = !full && normalizeCategoryLabel(label) !== '' && error === null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onAdd(label, plant);
    setLabel('');
    // Suggest a plant nobody grows yet for the next one.
    setPlant(firstUnusedPlant([...categories, { id: '', label, plant }]));
  };

  return (
    <form className="category-add" onSubmit={submit}>
      <label htmlFor={nameId} className="category-add__title">
        Add a category
      </label>
      {full ? (
        <p className="category-add__full">
          You have {MAX_CATEGORIES} categories, the most allowed. Remove one to add another.
        </p>
      ) : (
        <>
          <div className="category-add__row">
            <PlantThumb plant={plant} />
            <div className="category-row__name">
              <input
                id={nameId}
                className="category-row__input"
                placeholder="New category name"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                maxLength={MAX_CATEGORY_LABEL_LENGTH}
                spellCheck={false}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <span className="char-count" aria-hidden="true">
                {label.length}/{MAX_CATEGORY_LABEL_LENGTH}
              </span>
            </div>
            <PlantSelect label="Plant for the new category" value={plant} onChange={setPlant} className="category-row__plant" />
            <button type="submit" className="btn category-add__submit" disabled={!canSubmit}>
              Add
            </button>
          </div>
          {error && (
            <p id={errorId} className="category-row__error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </form>
  );
}

function PlantSelect({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: PlantId | null;
  onChange: (plant: PlantId | null) => void;
  className?: string;
}) {
  return (
    <select className={className} aria-label={label} value={value ?? ''} onChange={(e) => onChange(toPlant(e.target.value))}>
      {PLANTS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
      <option value="">No plant</option>
    </select>
  );
}

/** A tiny garden plot with the plant in it, or an empty dashed one for "No plant". */
function PlantThumb({ plant }: { plant: PlantId | null }) {
  return plant ? (
    <span className="plant-thumb">
      <img src={plantPreviewImage(plant)} alt="" />
    </span>
  ) : (
    <span className="plant-thumb plant-thumb--empty" aria-hidden="true" />
  );
}

function PlantCard({
  plant,
  label,
  categories,
  totalMinutes,
}: {
  plant: PlantId;
  label: string;
  categories: Category[];
  totalMinutes: number | undefined;
}) {
  const growth = totalMinutes === undefined ? null : getPlantGrowth(totalMinutes);
  const unused = categories.length === 0;
  return (
    <li className={`plant-card${unused ? ' plant-card--unused' : ''}`} data-testid={`plant-card-${plant}`}>
      <PlantThumb plant={plant} />
      <div className="plant-card__body">
        <div className="plant-card__top">
          <strong className="plant-card__name">{label}</strong>
          <span className="plant-card__growth">
            {growth
              ? `Stage ${growth.stage} of ${GROWTH_STAGES}${growth.prestige > 0 ? ` · Prestige ${growth.prestige}` : ''}`
              : 'Not planted yet'}
          </span>
        </div>
        {unused ? (
          <span className="plant-card__unused">No categories</span>
        ) : (
          <ul className="chip-list" aria-label={`Categories growing ${label}`}>
            {categories.map((c) => (
              <li key={c.id} className="chip">
                {c.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
