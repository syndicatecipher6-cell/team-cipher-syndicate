import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true); setError(undefined);
    try { setData(await loader()); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to load investigation data.'); }
    finally { setLoading(false); }
  // The dependency list is supplied by each typed service call at the call site.
  // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, retry: load };
}
