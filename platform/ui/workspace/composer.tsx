"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  submitInstructionAction,
  type WorkFormState,
} from "@/app/(app)/employee/actions";
import { useOptionalCoreRuntime } from "../core/runtime";

export type SuggestedPrompt = {
  label: string;
  instruction: string;
};

export function CommandComposer({
  employeeName,
  paused,
  suggestions,
}: {
  employeeName: string;
  paused: boolean;
  suggestions: readonly SuggestedPrompt[];
}) {
  const [state, action, pending] = useActionState<WorkFormState, FormData>(
    submitInstructionAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const setUnderstanding = useOptionalCoreRuntime()?.setUnderstanding;

  useEffect(() => {
    setUnderstanding?.(pending);
    return () => setUnderstanding?.(false);
  }, [pending, setUnderstanding]);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
      if (areaRef.current) {
        areaRef.current.style.height = "auto";
      }
    }
  }, [pending, state]);

  return (
    <div>
      <form
        ref={formRef}
        action={action}
        aria-busy={pending}
        className={`group border bg-paper-raised px-4 py-3 shadow-[var(--shadow-lift)] transition-[border-color,box-shadow] ${
          pending
            ? "border-accent/40"
            : "border-line focus-within:border-line-strong"
        }`}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      >
        <label className="sr-only" htmlFor="instruction">
          Ask {employeeName} to do something
        </label>
        <textarea
          ref={areaRef}
          id="instruction"
          name="instruction"
          rows={2}
          disabled={paused || pending}
          placeholder={
            paused
              ? `${employeeName} is paused.`
              : `Ask ${employeeName} to do something…`
          }
          className="max-h-40 min-h-[2.75rem] w-full resize-none bg-transparent text-base leading-relaxed text-ink outline-none placeholder:text-ink-soft/65 disabled:opacity-60"
          onInput={(event) => {
            const node = event.currentTarget;
            node.style.height = "auto";
            node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.7rem] tracking-[0.04em] text-ink-soft" aria-live="polite">
            {pending ? (
              <span className="voxa-listen inline-flex items-center gap-2">
                <span className="h-1 w-1 bg-accent" aria-hidden="true" />
                {employeeName} is working…
              </span>
            ) : paused ? (
              `${employeeName} will not take new work until resumed.`
            ) : (
              "Enter to send · Shift Enter for a new line"
            )}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              title="Attachments are not connected yet"
              className="px-2 py-1 text-[0.7rem] tracking-[0.06em] text-ink-soft/40 uppercase"
            >
              Attach
            </button>
            <button
              type="button"
              disabled
              title="Speak to Avery — voice is not connected yet"
              aria-label="Speak to Avery, not connected yet"
              className="px-2 py-1 text-[0.7rem] tracking-[0.06em] text-ink-soft/40 uppercase"
            >
              Speak
            </button>
            <button
              type="submit"
              disabled={paused || pending}
              className="ml-1 bg-accent px-3.5 py-1.5 text-sm text-on-accent transition-colors hover:bg-accent-hover disabled:bg-ink-soft/25 disabled:text-paper"
            >
              Send
            </button>
          </div>
        </div>
        {state?.error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
      {suggestions.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          {suggestions.map((prompt) => (
            <li key={prompt.label}>
              <button
                type="button"
                className="text-left text-sm text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
                onClick={() => {
                  if (areaRef.current) {
                    areaRef.current.value = prompt.instruction;
                    areaRef.current.focus();
                    areaRef.current.style.height = "auto";
                    areaRef.current.style.height = `${Math.min(areaRef.current.scrollHeight, 160)}px`;
                  }
                }}
              >
                {prompt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
