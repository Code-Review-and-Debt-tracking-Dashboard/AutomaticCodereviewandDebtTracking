import { useEffect, useState } from "react";

const CHANGE_EVENT = "preference-change";

// saved in the browser, components using the same key stay in sync
export function usePreference<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => (localStorage.getItem(key) as T | null) ?? fallback);

  useEffect(() => {
    const sync = () => setValue((localStorage.getItem(key) as T | null) ?? fallback);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, [key, fallback]);

  const update = (next: T) => {
    localStorage.setItem(key, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return [value, update] as const;
}
