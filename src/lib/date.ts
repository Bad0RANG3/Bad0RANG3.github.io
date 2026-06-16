export function formatDate(date: Date, locale = 'zh-CN', options?: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString(locale, options ?? {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatLongDate(date: Date, locale = 'zh-CN') {
  return formatDate(date, locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
