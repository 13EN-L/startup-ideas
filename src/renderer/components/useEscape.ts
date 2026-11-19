import { useEffect } from 'react';

/**
 * Calls onEscape when Escape is pressed while the component is mounted.
 * Pass enabled=false while another popup is stacked on top, so Escape only
 * closes the topmost one.
 */
export function useEscape(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEscape, enabled]);
}
