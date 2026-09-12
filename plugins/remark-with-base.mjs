function normalizeBase(value = '/') {
  if (!value || value === '/') return '/';
  return `/${String(value).replace(/^\/+|\/+$/g, '')}/`;
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, callback);
  }
}

/**
 * Rewrites root-relative URLs in raw HTML authored inside Markdown/MDX before
 * Astro renders it. This keeps legacy content portable to project Pages URLs.
 */
export default function remarkWithBase({ base = '/' } = {}) {
  const normalizedBase = normalizeBase(base);
  if (normalizedBase === '/') return () => {};
  const prefix = normalizedBase.slice(0, -1);

  const rewrite = (value) => {
    if (!value.startsWith('/') || value.startsWith('//')) return value;
    if (value === prefix || value.startsWith(normalizedBase)) return value;
    return `${prefix}${value}`;
  };

  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'html' || typeof node.value !== 'string') return;
      node.value = node.value.replace(/(^|\s)(href|src|poster)\s*=\s*(?:(['"])(\/[^'"]*)\3|(\/[^\s>]+))/gi, (_match, prefix, name, quote, quotedValue, unquotedValue) => {
        const value = quotedValue ?? unquotedValue;
        const delimiter = quote ?? '';
        return `${prefix}${name}=${delimiter}${rewrite(value)}${delimiter}`;
      });
    });
  };
}
