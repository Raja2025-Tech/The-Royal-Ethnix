import { useEffect, useRef } from 'react';
import { reconcileOrders } from '@/lib/tms';

// Karigars change garment stages but cannot edit orders, so whoever may edit orders brings order
// statuses in line with their garments once per page open.
export function useReconcileOrders(enabled, onChanged) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    reconcileOrders()
      .then((n) => {
        if (n > 0) onChanged?.();
      })
      .catch(() => {});
  }, [enabled, onChanged]);
}
