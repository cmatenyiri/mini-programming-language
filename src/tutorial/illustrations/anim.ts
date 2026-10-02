import { useEffect, useState } from 'react';

/**
 * Cycles through `steps` states every `interval` ms, holding the last state for `hold` ms.
 * Drives the looping illustrations.
 */
export function useTicker(steps: number, interval = 700, hold = 2200) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const delay = step >= steps - 1 ? hold : interval;
    const id = window.setTimeout(() => setStep((s) => (s >= steps - 1 ? 0 : s + 1)), delay);
    return () => window.clearTimeout(id);
  }, [step, steps, interval, hold]);
  return step;
}

export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};
