"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyCoreOverlay,
  IDLE_VOICE_DRIVE,
  type CoreView,
  type CoreVoiceDrive,
} from "@/platform/work/core-state";

type CoreRuntime = {
  view: CoreView;
  focus: boolean;
  setUnderstanding: (value: boolean) => void;
  setVoice: (value: Partial<CoreVoiceDrive>) => void;
  setFocus: (value: boolean) => void;
};

const CoreRuntimeContext = createContext<CoreRuntime | null>(null);

export function CoreRuntimeProvider({
  view,
  children,
}: {
  view: CoreView;
  children: ReactNode;
}) {
  const [understanding, setUnderstanding] = useState(false);
  const [voice, setVoiceState] = useState<CoreVoiceDrive>(IDLE_VOICE_DRIVE);
  const [focus, setFocus] = useState(false);

  const setVoice = useCallback((next: Partial<CoreVoiceDrive>) => {
    setVoiceState((current) => ({
      listening: next.listening ?? current.listening,
      speaking: next.speaking ?? current.speaking,
      amplitude: next.amplitude ?? current.amplitude,
    }));
  }, []);

  const resolved = useMemo(
    () => applyCoreOverlay(view, { understanding, voice }),
    [view, understanding, voice],
  );

  const value = useMemo(
    () => ({
      view: resolved,
      focus,
      setUnderstanding,
      setVoice,
      setFocus,
    }),
    [resolved, focus, setVoice],
  );

  return <CoreRuntimeContext.Provider value={value}>{children}</CoreRuntimeContext.Provider>;
}

export function useCoreRuntime(): CoreRuntime {
  const value = useContext(CoreRuntimeContext);
  if (!value) {
    throw new Error("useCoreRuntime requires CoreRuntimeProvider");
  }
  return value;
}

export function useOptionalCoreRuntime(): CoreRuntime | null {
  return useContext(CoreRuntimeContext);
}
