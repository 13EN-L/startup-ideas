import { useEffect } from 'react';

/** Calls onEscape when Escape is pressed while the component is mounted. */
export function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEscape]);
}
