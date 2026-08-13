/**
 * Converts a site-relative path into an Astro base-aware URL.
 *
 * Keep route configuration site-relative (for example `/posts/`) and use this
 * helper at the boundary where a URL is rendered or emitted. That keeps the
 * user homepage deployment working while also supporting project Pages such
 * as `https://username.github.io/repository/`.
 */
const baseUrl = import.meta.env.BASE_URL;

export function withBase(path = '/'): string {
  if (!path) return baseUrl;
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || path.startsWith('#')) return path;

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const baseWithoutTrailingSlash = base.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Astro.url.pathname already includes `base` during a project Pages build.
  if (normalizedPath === baseWithoutTrailingSlash || normalizedPath.startsWith(`${baseWithoutTrailingSlash}/`)) {
    return normalizedPath;
  }

  const suffix = normalizedPath.replace(/^\/+/, '');
  return suffix ? `${base}${suffix}` : base;
}

export function siteUrl(path = '/'): string {
  return new URL(withBase(path), import.meta.env.SITE).toString();
}
