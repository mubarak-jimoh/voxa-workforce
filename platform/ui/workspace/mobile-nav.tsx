"use client";

import { createContext, useContext } from "react";

export const CloseNavContext = createContext<() => void>(() => {});

export function useCloseNav() {
  return useContext(CloseNavContext);
}
