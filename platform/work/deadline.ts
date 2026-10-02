import { DEFAULT_WORK_TIMEZONE } from "./constants";

export type DeadlineParseResult = {
  dueAt: Date;
  label: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Format a Date in an IANA timezone as calendar parts. */
export function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday ?? "",
  };
}

/** Build a UTC Date that represents local wall time in `timeZone`. */
export function zonedLocalDate(
  input: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  },
  timeZone: string,
): Date {
  const hour = input.hour ?? 0;
  const minute = input.minute ?? 0;
  const guess = new Date(
    Date.UTC(input.year, input.month - 1, input.day, hour, minute, 0),
  );
  const asLocal = zonedParts(guess, timeZone);
  const desiredAsUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    hour,
    minute,
    0,
  );
  const actualAsUtc = Date.UTC(
    asLocal.year,
    asLocal.month - 1,
    asLocal.day,
    asLocal.hour,
    asLocal.minute,
    0,
  );
  return new Date(guess.getTime() + (desiredAsUtc - actualAsUtc));
}

function addDays(
  parts: ReturnType<typeof zonedParts>,
  days: number,
  timeZone: string,
  hour: number,
  minute: number,
): Date {
  const base = zonedLocalDate(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 12,
      minute: 0,
    },
    timeZone,
  );
  base.setUTCDate(base.getUTCDate() + days);
  const next = zonedParts(base, timeZone);
  return zonedLocalDate(
    {
      year: next.year,
      month: next.month,
      day: next.day,
      hour,
      minute,
    },
    timeZone,
  );
}

function parseClock(match: RegExpMatchArray): { hour: number; minute: number } | null {
  let hour = Number.parseInt(match[1] ?? "", 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = (match[3] ?? "").toLowerCase();
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  if (!meridiem && hour <= 7) {
    // Bare "by 5" / "before 2" in work context usually means afternoon.
    hour += 12;
  }
  if (hour > 23 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export function resolveWorkTimezone(value?: string | null): string {
  if (value && /^[A-Za-z_]+\/[A-Za-z0-9_/+-]+$/.test(value)) {
    return value;
  }
  return DEFAULT_WORK_TIMEZONE;
}

export function formatDueLabel(dueAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(dueAt);
}

/**
 * Extract a concrete deadline from natural language relative to `now` in `timeZone`.
 * Returns null when no deadline is requested.
 */
export function parseDeadline(
  text: string,
  input?: { now?: Date; timeZone?: string },
): DeadlineParseResult | null {
  const timeZone = resolveWorkTimezone(input?.timeZone);
  const now = input?.now ?? new Date();
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return null;
  }

  const relativeMinutes = trimmed.match(
    /\b(?:in|within)\s+(?:the\s+next\s+)?(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)\b/i,
  );
  if (relativeMinutes) {
    const amount = Number.parseInt(relativeMinutes[1] ?? "", 10);
    const unit = (relativeMinutes[2] ?? "").toLowerCase();
    if (!Number.isNaN(amount) && amount > 0) {
      const ms = /hour|hr/.test(unit) ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
      const dueAt = new Date(now.getTime() + ms);
      return {
        dueAt,
        label: /hour|hr/.test(unit)
          ? `in ${amount} hour${amount === 1 ? "" : "s"}`
          : `in ${amount} minute${amount === 1 ? "" : "s"}`,
      };
    }
  }

  if (/\bwithin the next hour\b/i.test(trimmed) || /\bin an hour\b/i.test(trimmed)) {
    const dueAt = new Date(now.getTime() + 60 * 60 * 1000);
    return { dueAt, label: "in 1 hour" };
  }

  const parts = zonedParts(now, timeZone);

  if (/\btomorrow morning\b/i.test(trimmed)) {
    const dueAt = addDays(parts, 1, timeZone, 9, 0);
    return { dueAt, label: `tomorrow morning (${formatDueLabel(dueAt, timeZone)})` };
  }

  if (/\btomorrow\b/i.test(trimmed) && /\b(by|before|ready)\b/i.test(trimmed)) {
    const clock = trimmed.match(/\b(?:at|by|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    const parsed = clock ? parseClock(clock) : { hour: 17, minute: 0 };
    if (parsed) {
      const dueAt = addDays(parts, 1, timeZone, parsed.hour, parsed.minute);
      return { dueAt, label: `tomorrow (${formatDueLabel(dueAt, timeZone)})` };
    }
  }

  const weekday = trimmed.match(
    /\b(?:by|before|ready)\s+(?:this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
  );
  if (weekday?.[1]) {
    const target = WEEKDAYS[weekday[1].toLowerCase()];
    if (target !== undefined) {
      const map: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const current = map[parts.weekday] ?? parts.day % 7;
      let delta = (target - current + 7) % 7;
      if (delta === 0) {
        delta = 7;
      }
      const dueAt = addDays(parts, delta, timeZone, 17, 0);
      return { dueAt, label: `by ${weekday[1]} (${formatDueLabel(dueAt, timeZone)})` };
    }
  }

  const clockMatch = trimmed.match(
    /\b(?:by|before|ready(?:\s+by)?|have (?:this|it|the results) ready(?:\s+by)?|need this before(?:\s+my meeting)?(?:\s+at)?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (clockMatch) {
    const parsed = parseClock(clockMatch);
    if (parsed) {
      let dueAt = zonedLocalDate(
        {
          year: parts.year,
          month: parts.month,
          day: parts.day,
          hour: parsed.hour,
          minute: parsed.minute,
        },
        timeZone,
      );
      if (dueAt.getTime() <= now.getTime()) {
        dueAt = addDays(parts, 1, timeZone, parsed.hour, parsed.minute);
      }
      return {
        dueAt,
        label: `by ${pad(parsed.hour % 12 || 12)}:${pad(parsed.minute)}${parsed.hour >= 12 ? "pm" : "am"}`,
      };
    }
  }

  if (/\bbeofre my meeting at\b/i.test(trimmed) || /\bbefore my meeting at\b/i.test(trimmed)) {
    const meeting = trimmed.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (meeting) {
      const parsed = parseClock(meeting);
      if (parsed) {
        let dueAt = zonedLocalDate(
          {
            year: parts.year,
            month: parts.month,
            day: parts.day,
            hour: parsed.hour,
            minute: parsed.minute,
          },
          timeZone,
        );
        if (dueAt.getTime() <= now.getTime()) {
          dueAt = addDays(parts, 1, timeZone, parsed.hour, parsed.minute);
        }
        return {
          dueAt,
          label: `before ${formatDueLabel(dueAt, timeZone)}`,
        };
      }
    }
  }

  return null;
}

export function isPastDue(dueAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!dueAt) {
    return false;
  }
  const time = dueAt instanceof Date ? dueAt.getTime() : new Date(dueAt).getTime();
  return !Number.isNaN(time) && time <= now.getTime();
}
