/**
 * Wraps every Markdown table in `<div class="table-wrapper">` at build time so
 * wide tables scroll inside their own box. Doing this in the browser moved the
 * table after first paint, which made long articles jump.
 */
function wrap(node) {
  if (!node || !Array.isArray(node.children)) return;
  node.children = node.children.map((child) => {
    if (child.type === 'element' && child.tagName === 'table') {
      return {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrapper'] },
        children: [child],
      };
    }
    // Tables never nest inside tables, so there is no need to look inside a wrapped one.
    wrap(child);
    return child;
  });
}

export default function rehypeWrapTables() {
  return (tree) => wrap(tree);
}
