"use client";

import { useState } from "react";
import { CloseNavContext } from "./mobile-nav";

export function WorkspaceChrome({
  brand,
  presence,
  sidebar,
}: {
  brand: React.ReactNode;
  presence?: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <CloseNavContext.Provider value={() => setOpen(false)}>
      <header className="flex items-center justify-between gap-4 border-b border-line bg-sidebar px-5 py-3.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {brand}
          {presence ? (
            <div className="min-w-0 border-l border-line pl-3">{presence}</div>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 text-sm text-ink-soft transition-colors hover:text-ink"
          aria-expanded={open}
          aria-controls="workspace-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
      <aside
        id="workspace-nav"
        className={`${
          open ? "flex" : "hidden"
        } flex-col border-b border-line bg-sidebar px-6 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-7 lg:py-8`}
      >
        {sidebar}
      </aside>
    </CloseNavContext.Provider>
  );
}
