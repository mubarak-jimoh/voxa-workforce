"use client";

import { useEffect, useRef } from "react";
import { type CoreMood, type CoreView } from "@/platform/work/core-state";


type Size = "compact" | "rail" | "focus";

const SIZES: Record<Size, number> = {
  compact: 44,
  rail: 280,
  focus: 440,
};

function readTone(node: HTMLElement) {
  const style = getComputedStyle(node);
  return {
    ink: style.getPropertyValue("--ink").trim() || "#161412",
    soft: style.getPropertyValue("--ink-soft").trim() || "#6a645c",
    accent: style.getPropertyValue("--accent").trim() || "#1f3a2e",
    paused: style.getPropertyValue("--paused").trim() || "#8a5a2b",
    paper: style.getPropertyValue("--paper-inset").trim() || "#efe9dd",
    line: style.getPropertyValue("--line-strong").trim() || "rgba(22,20,18,0.18)",
  };
}

function moodColor(mood: CoreMood, tone: ReturnType<typeof readTone>) {
  if (mood === "waiting" || mood === "blocked") {
    return tone.paused;
  }
  if (mood === "paused") {
    return tone.soft;
  }
  return tone.accent;
}

function activity(mood: CoreMood): number {
  if (mood === "working" || mood === "speaking") {
    return 0.92;
  }
  if (mood === "planning" || mood === "understanding") {
    return 0.62;
  }
  if (mood === "listening") {
    return 0.5;
  }
  if (mood === "waiting") {
    return 0.28;
  }
  if (mood === "completed") {
    return 0.34;
  }
  if (mood === "ready") {
    return 0.12;
  }
  return 0;
}

function diamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
}

function drawCore(
  ctx: CanvasRenderingContext2D,
  view: CoreView,
  size: number,
  time: number,
  reduced: boolean,
) {
  const tone = readTone(ctx.canvas);
  const color = moodColor(view.mood, tone);
  const live = reduced ? 0 : activity(view.mood);
  const breathe = live > 0 ? 1 + Math.sin(time / (live > 0.5 ? 520 : 1400)) * 0.018 * (0.4 + live) : 1;
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 280;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(breathe, breathe);

  ctx.strokeStyle = tone.line;
  ctx.lineWidth = 1 * scale;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(0, 0, 118 * scale, 78 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 78 * scale, 118 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.35;
  diamond(ctx, 0, 0, 96 * scale);
  ctx.stroke();

  const ticks = [
    [0, -108],
    [108, 0],
    [0, 108],
    [-108, 0],
  ] as const;
  ctx.globalAlpha = view.mood === "paused" ? 0.25 : 0.7;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4 * scale;
  for (const [tx, ty] of ticks) {
    ctx.beginPath();
    ctx.moveTo(tx * scale * 0.78, ty * scale * 0.78);
    ctx.lineTo(tx * scale, ty * scale);
    ctx.stroke();
  }

  const nodes = view.signals.slice(0, 8);
  const count = Math.max(nodes.length, 0);
  ctx.lineWidth = 1 * scale;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (index / Math.max(count, 1)) * Math.PI * 2;
    const radius = (74 + (index % 2) * 18) * scale;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.78;
    const nextIndex = (index + 1) % count;
    if (count > 1) {
      const nextAngle = -Math.PI / 2 + (nextIndex / count) * Math.PI * 2;
      const nextRadius = (74 + (nextIndex % 2) * 18) * scale;
      ctx.globalAlpha = 0.22 + live * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(Math.cos(nextAngle) * nextRadius, Math.sin(nextAngle) * nextRadius * 0.78);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.55 + live * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, (2.4 + (view.mood === "working" ? 0.6 : 0)) * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  if (view.result && view.mood !== "paused") {
    const names = view.result.names.slice(0, 4);
    names.forEach((_, index) => {
      const angle = Math.PI / 5 + index * ((Math.PI * 1.3) / Math.max(names.length, 1));
      const x = Math.cos(angle) * 104 * scale;
      const y = Math.sin(angle) * 70 * scale;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 36 * scale, Math.sin(angle) * 36 * scale);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      diamond(ctx, x, y, 4.5 * scale);
      ctx.stroke();
    });
  }

  if (live > 0.45 && count > 0) {
    const progress = (time / 1400) % 1;
    const from = Math.floor(progress * count) % count;
    const local = (progress * count) % 1;
    const a1 = -Math.PI / 2 + (from / count) * Math.PI * 2;
    const a2 = -Math.PI / 2 + (((from + 1) % count) / count) * Math.PI * 2;
    const r1 = (74 + (from % 2) * 18) * scale;
    const r2 = (74 + ((from + 1) % 2) * 18) * scale;
    const x = Math.cos(a1) * r1 * (1 - local) + Math.cos(a2) * r2 * local;
    const y = (Math.sin(a1) * r1 * (1 - local) + Math.sin(a2) * r2 * local) * 0.78;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2.1 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = tone.paper;
  diamond(ctx, 0, 0, 28 * scale);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6 * scale;
  ctx.stroke();
  ctx.globalAlpha = view.mood === "paused" ? 0.35 : 0.9;
  diamond(ctx, 0, 0, 12 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5 * scale, 0);
  ctx.lineTo(0, 5 * scale);
  ctx.lineTo(0, -8 * scale);
  ctx.stroke();

  ctx.restore();
}

export function VoxaCore({
  view,
  size = "rail",
}: {
  view: CoreView;
  size?: Size;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view);
  const px = SIZES[size];

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let running = true;

    const paint = (time: number) => {
      if (!running) {
        return;
      }
      drawCore(ctx, viewRef.current, px, time, reduced || document.hidden);
      const live = activity(viewRef.current.mood) > 0.2 && !reduced && !document.hidden;
      if (live) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    paint(0);
    const onVisible = () => {
      if (!document.hidden && activity(viewRef.current.mood) > 0.2 && !reduced) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(paint);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [px, view.mood, view.signals.length]);

  return (
    <canvas
      ref={canvasRef}
      width={px}
      height={px}
      className="voxa-core-canvas block"
      aria-hidden="true"
    />
  );
}
