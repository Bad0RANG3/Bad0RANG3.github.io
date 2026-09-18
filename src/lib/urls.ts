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

/**
 * Checks a route against Astro.url.pathname in both root and project Pages
 * deployments. Navigation entries stay site-relative while the browser path
 * may include BASE_URL.
 */
export function isActivePath(currentPath: string, href: string): boolean {
  const normalize = (value: string) => {
    const pathname = value.split(/[?#]/, 1)[0] || '/';
    const trimmed = pathname.replace(/\/+$/, '');
    return trimmed || '/';
  };

  const current = normalize(currentPath);
  const base = normalize(withBase('/'));
  const target = normalize(withBase(href));

  return target === base
    ? current === base
    : current === target || current.startsWith(`${target}/`);
}
