/**
 * Turns a run of code blocks that share a `group` into one tabbed panel.
 *
 * Authoring shape (the fence meta is read by `shiki-code-tab-meta.mjs`):
 *
 *     ```bash group="disk" tab="SATA" tabs="设备命名"
 *     …
 *     ```
 *     ```bash group="disk" tab="NVMe"
 *     …
 *     ```
 *
 * Two fences with the same `group` and nothing but whitespace between them
 * become a single set, so the reader sees one code panel with a tab bar instead
 * of a wall of near-identical snippets. A lone labelled fence degrades to a
 * plain code block: there is nothing to switch to.
 *
 * This runs after Shiki (Astro registers user rehype plugins after its own
 * highlighter), so the `<pre>` nodes it groups are already the final,
 * highlighted ones.
 */

const TAB_ATTR = 'data-code-tab';
const GROUP_ATTR = 'data-code-tab-group';
const LABEL_ATTR = 'data-code-tabs-label';

const isWhitespaceText = (node) => node.type === 'text' && node.value.trim() === '';

const isTabbedBlock = (node) => (
  node?.type === 'element'
  && node.tagName === 'pre'
  && typeof node.properties?.[TAB_ATTR] === 'string'
);

const clearTabAttributes = (node) => {
  delete node.properties[TAB_ATTR];
  delete node.properties[GROUP_ATTR];
  delete node.properties[LABEL_ATTR];
};

function buildTabSet(blocks, setIndex) {
  const label = blocks[0].properties[LABEL_ATTR] || '代码示例';

  // The bar is the frame's top strip; only the pill row inside it scrolls, so
  // the copy button added later stays pinned at the right edge on a phone
  // instead of being pushed off-screen by an overflowing tab row.
  const bar = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-tabs-bar'] },
    children: [{
      type: 'element',
      tagName: 'div',
      properties: { className: ['code-tabs-tabs'], role: 'tablist', 'aria-label': label },
      children: [],
    }],
  };
  const tabRow = bar.children[0];
  const panels = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-tabs-panels'] },
    children: [],
  };

  blocks.forEach((block, index) => {
    const tabId = `code-tab-${setIndex}-${index}`;
    const panelId = `${tabId}-panel`;
    const active = index === 0;

    tabRow.children.push({
      type: 'element',
      tagName: 'button',
      properties: {
        type: 'button',
        className: ['code-tab'],
        role: 'tab',
        id: tabId,
        'aria-controls': panelId,
        'aria-selected': active ? 'true' : 'false',
        tabIndex: active ? 0 : -1,
      },
      children: [{ type: 'text', value: block.properties[TAB_ATTR] }],
    });

    clearTabAttributes(block);
    panels.children.push({
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['code-tab-panel'],
        role: 'tabpanel',
        id: panelId,
        'aria-labelledby': tabId,
        'data-code-tab-panel': '1',
        // The panel holds no focusable element of its own, so it takes focus
        // itself once a tab is chosen (ARIA APG tabs pattern).
        tabIndex: 0,
      },
      children: [block],
    });
  });

  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['code-tabs'],
      'data-code-tabs': '1',
      'data-active': '0',
    },
    children: [bar, panels],
  };
}

function groupChildren(parent, state) {
  const children = parent.children;
  if (!Array.isArray(children) || children.length === 0) return;

  const output = [];
  let index = 0;

  while (index < children.length) {
    const child = children[index];

    // Every element is walked first, so nested lists/quotes still get their
    // own groups even though only the top level is rewritten below.
    if (child.type === 'element') groupChildren(child, state);

    if (!isTabbedBlock(child)) {
      output.push(child);
      index += 1;
      continue;
    }

    const group = child.properties[GROUP_ATTR];
    if (!group) {
      clearTabAttributes(child);
      output.push(child);
      index += 1;
      continue;
    }

    const blocks = [child];
    let cursor = index + 1;
    while (cursor < children.length) {
      let next = cursor;
      while (next < children.length && isWhitespaceText(children[next])) next += 1;
      const candidate = children[next];
      if (!isTabbedBlock(candidate) || candidate.properties[GROUP_ATTR] !== group) break;
      blocks.push(candidate);
      cursor = next + 1;
    }

    if (blocks.length === 1) {
      // A single labelled fence has no siblings to switch to; keep it plain.
      clearTabAttributes(child);
      output.push(child);
      index += 1;
      continue;
    }

    output.push(buildTabSet(blocks, state.setIndex));
    state.setIndex += 1;
    index = cursor;
  }

  parent.children = output;
}

export default function rehypeCodeTabs() {
  return (tree) => {
    // Counted per document: two posts rendered in one build must not share ids.
    groupChildren(tree, { setIndex: 0 });
  };
}
