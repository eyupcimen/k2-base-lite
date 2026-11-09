import { useEffect, useState } from 'react';
import { calculate, type CalcInput, type CalcResult } from './api';

export function useCalculation(input: CalcInput, delayMs = 300) {
  const [data, setData] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(input);
  useEffect(() => {
    if (input.runs && input.runs.length === 0) { setData(null); setError('No panels placed.'); setLoading(false); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setData(await calculate(input, ctrl.signal));
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Network error');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, delayMs);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [key, delayMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
