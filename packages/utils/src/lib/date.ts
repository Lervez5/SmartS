const DATE_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return DATE_FORMATTER.format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return DATETIME_FORMATTER.format(d);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (Math.abs(diffSec) < 60) return `${diffSec}s ago`;
  if (Math.abs(diffMin) < 60) return `${diffMin}m ago`;
  if (Math.abs(diffHour) < 24) return `${diffHour}h ago`;
  if (Math.abs(diffDay) < 7) return `${diffDay}d ago`;
  return formatDate(d);
}
