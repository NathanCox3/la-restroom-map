import type { OpenStatus } from "./types";

const osmDayOrder = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const intlToOsmDay: Record<string, string> = {
  Sun: "Su",
  Mon: "Mo",
  Tue: "Tu",
  Wed: "We",
  Thu: "Th",
  Fri: "Fr",
  Sat: "Sa"
};

export function computeOpenStatus(hours: string | null | undefined, now = new Date()): OpenStatus {
  if (!hours?.trim()) return "unknown";
  const normalized = hours.trim().replace(/[–—]/g, "-");
  if (/^24\s*\/\s*7$/i.test(normalized)) return "open";
  if (/sunrise|sunset|dawn|dusk/i.test(normalized)) return "unknown";

  const nowParts = pacificDayAndMinutes(now);
  let sawApplicableRule = false;
  let sawAnyRule = false;

  for (const rawRule of normalized.split(";")) {
    const rule = rawRule.trim();
    if (!rule) continue;
    const parsed = parseRule(rule);
    if (!parsed) continue;
    sawAnyRule = true;
    if (!parsed.days.includes(nowParts.day)) continue;
    sawApplicableRule = true;
    if (parsed.closed) return "closed";
    if (parsed.ranges.some((range) => isTimeInRange(nowParts.minutes, range.start, range.end))) {
      return "open";
    }
  }

  if (sawApplicableRule || sawAnyRule) return "closed";
  return "unknown";
}

function pacificDayAndMinutes(date: Date): { day: string; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { day: intlToOsmDay[weekday] ?? "Su", minutes: hour * 60 + minute };
}

function parseRule(rule: string): { days: string[]; ranges: Array<{ start: number; end: number }>; closed: boolean } | null {
  const dailyRule = rule.replace(/^daily\s+/i, "Mo-Su ");
  const dayMatch = dailyRule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/i);
  const days = dayMatch ? expandDays(dayMatch[1]) : [...osmDayOrder];
  const timeExpression = (dayMatch ? dayMatch[2] : dailyRule).trim();
  if (/^off|closed$/i.test(timeExpression)) return { days, ranges: [], closed: true };

  const ranges = timeExpression
    .split(",")
    .map((part) => part.trim())
    .map(parseTimeRange)
    .filter((range): range is { start: number; end: number } => Boolean(range));

  if (ranges.length === 0) return null;
  return { days, ranges, closed: false };
}

function expandDays(expression: string): string[] {
  const days = new Set<string>();
  for (const part of expression.split(",")) {
    const [startRaw, endRaw] = part.split("-").map((item) => normalizeDay(item));
    if (!startRaw) continue;
    if (!endRaw) {
      days.add(startRaw);
      continue;
    }
    const startIndex = osmDayOrder.indexOf(startRaw);
    const endIndex = osmDayOrder.indexOf(endRaw);
    if (startIndex === -1 || endIndex === -1) continue;
    let index = startIndex;
    while (true) {
      days.add(osmDayOrder[index]);
      if (index === endIndex) break;
      index = (index + 1) % osmDayOrder.length;
    }
  }
  return days.size > 0 ? [...days] : [...osmDayOrder];
}

function normalizeDay(value: string | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim();
  const match = osmDayOrder.find((day) => day.toLowerCase() === candidate.toLowerCase());
  return match ?? null;
}

function parseTimeRange(value: string): { start: number; end: number } | null {
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2] ?? 0);
  const end = Number(match[3]) * 60 + Number(match[4] ?? 0);
  if (start < 0 || start >= 1440 || end < 0 || end > 1440) return null;
  return { start, end };
}

function isTimeInRange(nowMinutes: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}
