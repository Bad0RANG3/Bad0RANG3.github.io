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
 * Rewrites root-relative URLs authored in Markdown before Astro renders it, so
 * legacy content keeps working under a project Pages base. Two shapes are
 * covered because Astro renders them differently:
 *
 * - raw HTML (`<img src="/x.png">`) arrives as an `html` node
 * - Markdown syntax (`![alt](/x.png)`, `[text](/x/)`) becomes `image`/`link`
 *   nodes, which no amount of HTML rewriting can reach
 */
export default function remarkWithBase({ base = '/' } = {}) {
  const normalizedBase = normalizeBase(base);
  if (normalizedBase === '/') return () => {};
  const prefix = normalizedBase.slice(0, -1);

  const rewrite = (value) => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return value;
    if (value === prefix || value.startsWith(normalizedBase)) return value;
    return `${prefix}${value}`;
  };

  return (tree) => {
    visit(tree, (node) => {
      if (node.type === 'html' && typeof node.value === 'string') {
        node.value = node.value.replace(/(^|\s)(href|src|poster)\s*=\s*(?:(['"])(\/[^'"]*)\3|(\/[^\s>]+))/gi, (_match, lead, name, quote, quotedValue, unquotedValue) => {
          const value = quotedValue ?? unquotedValue;
          const delimiter = quote ?? '';
          return `${lead}${name}=${delimiter}${rewrite(value)}${delimiter}`;
        });
        return;
      }
      if ((node.type === 'image' || node.type === 'link') && typeof node.url === 'string') {
        node.url = rewrite(node.url);
      }
    });
  };
}
