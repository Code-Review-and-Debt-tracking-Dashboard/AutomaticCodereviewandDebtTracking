import { useEffect, useState } from "react";

import { api } from "./apiClient";

/*
 * How many unread notifications the signed-in user has. Both sidebars show the
 * number, so it is read in one place rather than hardcoded in each.
 */
export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get<{ data: { id: string }[] }>("/api/notifications", {
          unreadOnly: true,
        });
        if (!cancelled) setCount((res.data || []).length);
      } catch {
        // a badge is not worth surfacing an error for
        if (!cancelled) setCount(0);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
