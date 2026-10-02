"use client";

import type { ReactNode } from "react";
import { CoreRail } from "../core/core-rail";
import { useCoreRuntime } from "../core/runtime";

export function WorkspaceFrame({
  chrome,
  children,
}: {
  chrome: ReactNode;
  children: ReactNode;
}) {
  const { focus } = useCoreRuntime();

  return (
    <div
      className={`min-h-full bg-paper lg:grid ${
        focus
          ? "lg:grid-cols-[17.5rem_minmax(0,24rem)_minmax(0,1fr)]"
          : "lg:grid-cols-[17.5rem_minmax(0,1fr)] xl:grid-cols-[17.5rem_minmax(0,1fr)_19.75rem]"
      }`}
    >
      {chrome}
      <div className="min-w-0 bg-paper">
        <div className="mx-auto flex min-h-[calc(100dvh-3.75rem)] w-full max-w-[44rem] flex-col px-5 py-6 lg:min-h-dvh lg:px-12 lg:py-11">
          {children}
        </div>
      </div>
      <CoreRail />
    </div>
  );
}
