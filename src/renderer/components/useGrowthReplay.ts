// Garden growth replay: plants open at the growth the garden last showed and
// animate up to their current total (scaling within a stage, swapping stage
// images, wrapping to stage 1 with +1 prestige). Growth that lands while the
// garden is open animates from wherever the plant is drawn.
import { useEffect, useRef, useState } from 'react';
import { animatedMinutes, viewedMinutes, visiblePlots, type Plants } from '../../core/growth';
import { GROWTH_ANIMATION_DELAY_MS, GROWTH_STAGES } from '../../shared/constants';
import type { CategoryId } from '../../shared/types';
import { plantImage } from '../assets';

type Minutes = Partial<Record<CategoryId, number>>;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Each plant's minutes as it should be drawn right now. */
export function useGrowthReplay(plants: Plants): Plants {
  const [shown, setShown] = useState<Minutes>(() =>
    Object.fromEntries(visiblePlots(plants).map((c) => [c, viewedMinutes(plants[c]!)])),
  );
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // Restart only when a total changes, not when plants are marked viewed.
  const targetsKey = visiblePlots(plants)
    .map((c) => `${c}:${plants[c]!.totalMinutes}`)
    .join('|');

  useEffect(() => {
    const categories = visiblePlots(plants);
    const from: Minutes = {};
    const to: Minutes = {};
    for (const c of categories) {
      from[c] = shownRef.current[c] ?? viewedMinutes(plants[c]!);
      to[c] = plants[c]!.totalMinutes;
    }
    const moving = categories.filter((c) => from[c] !== to[c]);
    if (moving.length === 0 || prefersReducedMotion()) {
      setShown(to);
      return;
    }

    // Stage images swap mid-animation; load them up front so none flashes blank.
    for (const c of moving) {
      for (let stage = 1; stage <= GROWTH_STAGES; stage++) new Image().src = plantImage(c, stage);
    }

    let frame = 0;
    let start: number | undefined;
    const tick = (time: number) => {
      start ??= time + GROWTH_ANIMATION_DELAY_MS;
      const elapsed = time - start;
      const next: Minutes = { ...to };
      let done = true;
      for (const c of moving) {
        next[c] = animatedMinutes(from[c]!, to[c]!, elapsed);
        if (next[c] !== to[c]) done = false;
      }
      setShown(next);
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targetsKey covers every total in plants
  }, [targetsKey]);

  return Object.fromEntries(
    visiblePlots(plants).map((c) => [c, { ...plants[c]!, totalMinutes: shown[c] ?? viewedMinutes(plants[c]!) }]),
  );
}
