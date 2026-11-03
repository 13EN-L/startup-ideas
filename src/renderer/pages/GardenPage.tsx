// Issue #18: conveyor-belt clouds (top 1/3), grass with category plots
// (bottom 2/3), trophies and global prestige under the logo.
import {
  earnedTrophies,
  getPlantGrowth,
  globalPrestige,
  plantScale,
  plotRows,
  visiblePlots,
  type Plants,
} from '../../core/growth';
import { CATEGORIES } from '../../shared/constants';
import type { CategoryId, CompletedTask, Trophy } from '../../shared/types';
import { plantImage, trophyImage } from '../assets';
import { Clouds } from '../components/Clouds';
import { HomeButton } from '../components/HomeButton';

export interface GardenPageProps {
  plants: Plants;
  recentTasks: CompletedTask[];
  onNavigateHome: () => void;
}

const TROPHY_LABELS: Record<Trophy, string> = {
  bronze: 'Bronze trophy',
  silver: 'Silver trophy',
  gold: 'Gold trophy',
};

export function GardenPage({ plants, recentTasks, onNavigateHome }: GardenPageProps) {
  const prestige = globalPrestige(plants);
  const rows = plotRows(visiblePlots(plants));

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
        <Clouds tasks={recentTasks} motion="conveyor" />
        <HomeButton activeTasks={[]} onClick={onNavigateHome} />
      </section>

      <section className="grass" aria-label="Garden">
        {rows.length === 0 && <p className="grass__empty">Complete a task to plant your first seed.</p>}
        {rows.map((row, index) => (
          <div key={index} className={`plot-row plot-row--of-${rows.length}`} data-testid={`plot-row-${index}`}>
            {row.map((category) => (
              <Plot key={category} category={category} totalMinutes={plants[category]!.totalMinutes} />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function Plot({ category, totalMinutes }: { category: CategoryId; totalMinutes: number }) {
  const growth = getPlantGrowth(totalMinutes);
  const plant = CATEGORIES.find((c) => c.id === category)!;
  return (
    <div className="plot" data-testid={`plot-${category}`}>
      <img
        className="plot__plant"
        src={plantImage(category, growth.stage)}
        alt={`${plant.plantLabel}, stage ${growth.stage}`}
        style={{ transform: `scale(${plantScale(growth)})` }}
      />
      <span className="plot__label">{plant.label}</span>
      {growth.prestige > 0 && <span className="plot__prestige">Prestige {growth.prestige}</span>}
    </div>
  );
}
