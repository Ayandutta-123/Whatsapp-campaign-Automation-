import { useEffect } from 'react';

export function usePolling(fetchFn, interval, active) {
  useEffect(() => {
    if (!active) return;
    fetchFn();
    const id = setInterval(fetchFn, interval);
    return () => clearInterval(id);
  }, [active, interval, fetchFn]);
}
