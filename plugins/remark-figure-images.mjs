/**
 * Promotes a stand-alone Markdown image to a `<figure>` that already knows its
 * intrinsic size.
 *
 * Markdown cannot express `width`/`height` on an image, so every screenshot in
 * a long tutorial used to reserve zero height until it arrived — the article
 * shifted under the reader's thumb on a phone. The size is read from the file
 * in `public/` at build time, and the caption comes from the image's `title`
 * (or its alt text when no title was written):
 *
 *     ![fdisk 输出](/media/arch/fdisk-list.webp "分区前后的盘符对照")
 *
 * Runs before `remark-with-base`, which rewrites the `src` in the emitted HTML
 * for project-Pages deployments.
 */
import { getPublicImageSize } from '../src/lib/images';

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, callback);
  }
}

export default function remarkFigureImages() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'paragraph' || !Array.isArray(node.children) || node.children.length !== 1) return;
      const image = node.children[0];
      if (image.type !== 'image' || typeof image.url !== 'string' || !image.url.startsWith('/')) return;
      if (!/\.(?:webp|png|jpe?g|avif)$/i.test(image.url)) return;

      const alt = typeof image.alt === 'string' ? image.alt : '';
      const caption = (typeof image.title === 'string' && image.title.trim()) || alt;
      const size = getPublicImageSize(image.url);
      const dimensions = size ? ` width="${size.width}" height="${size.height}"` : '';

      const parts = [
        '<figure class="post-figure">',
        `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(alt)}"${dimensions} loading="lazy" decoding="async">`,
      ];
      if (caption.trim()) parts.push(`<figcaption>${escapeHtml(caption)}</figcaption>`);
      parts.push('</figure>');

      node.type = 'html';
      node.value = parts.join('');
      delete node.children;
    });
  };
}
