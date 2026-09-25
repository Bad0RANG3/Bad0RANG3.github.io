// Frontmatter dates (`date: 2026-06-24`) are parsed as UTC midnight, so they
// are formatted in UTC too. Using the build machine's zone would shift every
// date back a day when building west of Greenwich.
export function formatDate(date: Date, locale = 'zh-CN', options?: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString(locale, {
    timeZone: 'UTC',
    ...(options ?? {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
  });
}

export function formatLongDate(date: Date, locale = 'zh-CN') {
  return formatDate(date, locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
