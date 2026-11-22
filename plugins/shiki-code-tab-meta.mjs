/**
 * Carries the tab label of a fenced code block from its fence meta onto the
 * rendered `<pre>`.
 *
 * Shiki rebuilds the `<pre>` from scratch, so nothing that `remark-rehype`
 * attached to the original node — including `hProperties` — survives into the
 * document. The fence's raw meta string *does* survive, because Astro hands it
 * to Shiki as `meta.__raw`; a transformer is therefore the only place where
 * ` ```bash group="disk" tab="SATA" ` can still be read.
 *
 * The attributes written here are consumed by `rehype-code-tabs.mjs`, which
 * groups adjacent blocks into one tabbed panel.
 */

const attributePattern = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export default function shikiCodeTabMeta() {
  return {
    name: 'b0:code-tab-meta',
    pre(node) {
      const raw = this.options?.meta?.__raw;
      if (typeof raw !== 'string' || !raw.includes('tab=')) return;

      const attributes = {};
      for (const match of raw.matchAll(attributePattern)) {
        attributes[match[1].toLowerCase()] = (match[2] ?? match[3] ?? '').trim();
      }

      const label = attributes.tab;
      if (!label) return;

      node.properties['data-code-tab'] = label;
      if (attributes.group) node.properties['data-code-tab-group'] = attributes.group;
      // `tabs="…"` names the whole set; it becomes the tablist's accessible name.
      if (attributes.tabs) node.properties['data-code-tabs-label'] = attributes.tabs;
    },
  };
}
