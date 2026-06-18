"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "toolnest_favorites";

interface FavoritesContextValue {
  favorites: Set<string>;
  isFavorite: (slug: string) => boolean;
  toggle: (slug: string) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set<string>(parsed);
  } catch {
    // corrupted storage — start fresh
  }
  return new Set();
}

function writeStorage(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // storage full or unavailable — ignore silently
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const hydrated = useRef(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setFavorites(readStorage());
  }, []);

  const toggle = useCallback((slug: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      writeStorage(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((slug: string) => favorites.has(slug), [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggle, count: favorites.size }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside <FavoritesProvider>");
  return ctx;
}
