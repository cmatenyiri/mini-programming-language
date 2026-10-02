import { useEffect, useRef, useState } from 'react';
import { type Analysis, analyze } from '../lumen/index';

/**
 * Re-analyzes the source (lexer → parser → type checker) shortly after it changes.
 * Also remembers the last analysis that reached the type checker, which keeps hover
 * and completions useful while the code is temporarily broken.
 */
export function useAnalysis(source: string, delay = 120) {
  const [analysis, setAnalysis] = useState<Analysis>(() => analyze(source));
  const lastChecked = useRef<Analysis | null>(analysis.check ? analysis : null);

  useEffect(() => {
    if (source === analysis.source) return;
    const id = window.setTimeout(() => {
      const next = analyze(source);
      if (next.check) lastChecked.current = next;
      setAnalysis(next);
    }, delay);
    return () => window.clearTimeout(id);
  }, [source, analysis.source, delay]);

  return { analysis, lastChecked };
}
