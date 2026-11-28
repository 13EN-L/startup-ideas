// Issue #18: decorative conveyor-belt clouds (top 1/3), grass with plant plots
// (bottom 2/3), trophies and global prestige under the logo. Clicking a plot
// lists the tasks that grew that plant; clicking one shows its results.
// Opening the garden replays the growth earned since it was last opened.
import { useEffect, useState } from 'react';
import { categoriesForPlant, plantLabel } from '../../core/categories';
import {
  earnedTrophies,
  getPlantGrowth,
  globalPrestige,
  plantScale,
  plotRows,
  viewedMinutes,
  visiblePlots,
  type Plants,
} from '../../core/growth';
import { tasksForPlant } from '../../core/persistence';
import type { Category, CompletedTask, PlantId, Trophy } from '../../shared/types';
import { plantImage, trophyImage } from '../assets';
import { DecorativeClouds } from '../components/Clouds';
import { HomeButton } from '../components/HomeButton';
import { PlantTasksPopup } from '../components/PlantTasksPopup';
import { TaskResultPopup } from '../components/TaskResultPopup';
import { useGrowthReplay } from '../components/useGrowthReplay';

export interface GardenPageProps {
  plants: Plants;
  /** The current category -> plant mappings, for plot labels. */
  categories: Category[];
  /** Every completed task, in any order. */
  completedTasks: CompletedTask[];
  /** Reads assets/plants/<plant>/about.txt; resolves null when there is none. */
  loadPlantAbout: (plant: PlantId) => Promise<string | null>;
  onNavigateHome: () => void;
  /** Called once the garden has started showing growth the user hadn't seen. */
  onPlantsViewed?: () => void;
}

const TROPHY_LABELS: Record<Trophy, string> = {
  bronze: 'Bronze trophy',
  silver: 'Silver trophy',
  gold: 'Gold trophy',
};

export function GardenPage({
  plants,
  categories,
  completedTasks,
  loadPlantAbout,
  onNavigateHome,
  onPlantsViewed,
}: GardenPageProps) {
  const [openPlant, setOpenPlant] = useState<PlantId>();
  const [resultTaskId, setResultTaskId] = useState<string>();
  const [about, setAbout] = useState<{ plant: PlantId; text: string | null }>();

  useEffect(() => {
    if (!openPlant) return;
    let cancelled = false;
    loadPlantAbout(openPlant)
      // A missing description just leaves the popup without one.
      .catch(() => null)
      .then((text) => {
        if (!cancelled) setAbout({ plant: openPlant, text });
      });
    return () => {
      cancelled = true;
    };
  }, [openPlant, loadPlantAbout]);

  // What the plots and trophies draw; catches up with `plants` as growth replays.
  const shownPlants = useGrowthReplay(plants);

  const hasUnviewedGrowth = Object.values(plants).some((p) => p && viewedMinutes(p) !== p.totalMinutes);
  useEffect(() => {
    if (hasUnviewedGrowth) onPlantsViewed?.();
  }, [hasUnviewedGrowth, onPlantsViewed]);

  const prestige = globalPrestige(shownPlants);
  const rows = plotRows(visiblePlots(shownPlants));
  const plantTasks = openPlant ? tasksForPlant(completedTasks, openPlant) : [];
  const resultTask = plantTasks.find((t) => t.id === resultTaskId);

  return (
    <div className="page page--garden">
      <section className="sky sky--garden">
        <div className="garden-logo">
          <h1 className="logo">FocusGarden</h1>
          <div className="trophies">
            {earnedTrophies(prestige).map((trophy) => (
              <img key={trophy} className={`trophy trophy--${trophy}`} src={trophyImage(trophy)} alt={TROPHY_LABELS[trophy]} />
            ))}
          </div>
          <p className="garden-logo__prestige">Total prestige: {prestige}</p>
        </div>
        <DecorativeClouds />
        <HomeButton activeTasks={[]} onClick={onNavigateHome} />
      </section>

      <section className="grass" aria-label="Garden">
        {rows.length === 0 && <p className="grass__empty">Complete a task to plant your first seed.</p>}
        {rows.map((row, index) => (
          <div key={index} className={`plot-row plot-row--of-${rows.length}`} data-testid={`plot-row-${index}`}>
            {row.map((plant) => (
              <Plot
                key={plant}
                plant={plant}
                categories={categoriesForPlant(categories, plant)}
                totalMinutes={shownPlants[plant]!.totalMinutes}
                onOpen={() => setOpenPlant(plant)}
              />
            ))}
          </div>
        ))}
      </section>

      {openPlant && (
        <PlantTasksPopup
          plant={openPlant}
          categories={categories}
          totalMinutes={plants[openPlant]?.totalMinutes ?? 0}
          about={about?.plant === openPlant ? about.text : undefined}
          tasks={plantTasks}
          onSelectTask={setResultTaskId}
          onClose={() => {
            setOpenPlant(undefined);
            setResultTaskId(undefined);
          }}
          active={!resultTask}
        />
      )}
      {resultTask && <TaskResultPopup task={resultTask} onClose={() => setResultTaskId(undefined)} />}
    </div>
  );
}

function Plot({
  plant,
  categories,
  totalMinutes,
  onOpen,
}: {
  plant: PlantId;
  /** The categories growing this plant now; may be empty. */
  categories: Category[];
  totalMinutes: number;
  onOpen: () => void;
}) {
  const growth = getPlantGrowth(totalMinutes);
  const name = plantLabel(plant);
  const label = categories.length > 0 ? categories.map((c) => c.label).join(', ') : name;
  return (
    <div className="plot" data-testid={`plot-${plant}`}>
      <img
        className="plot__plant"
        src={plantImage(plant, growth.stage)}
        alt={`${name}, stage ${growth.stage}`}
        style={{ transform: `scale(${plantScale(growth)})` }}
      />
      <span className="plot__label" title={label}>
        {label}
      </span>
      {growth.prestige > 0 && <span className="plot__prestige">Prestige {growth.prestige}</span>}
      {/* Covers the whole plot so the plant, label and dirt are all clickable. */}
      <button type="button" className="plot__open" aria-label={`${name} tasks`} onClick={onOpen} />
    </div>
  );
}
