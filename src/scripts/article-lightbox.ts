export const initArticleLightbox = (article: HTMLElement, signal: AbortSignal): (() => void) => {
  // Images: one dialog per article, built once and reused, so ←/→ walk every
  // screenshot in document order. An image inside a link keeps its own target.
  const zoomables = [...article.querySelectorAll<HTMLImageElement>('img')].filter((img) => !img.closest('a'));
  let closeLightbox: (() => void) | null = null;

  if (zoomables.length) {
    const dialog = document.createElement('dialog');
    dialog.className = 'image-lightbox';
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<button type="button" class="image-lightbox-close" aria-label="关闭大图">×</button>'
      + '<div class="image-lightbox-frame">'
      + '<img class="image-lightbox-image" alt="" decoding="async">'
      + '<div class="image-lightbox-meta"><p class="image-lightbox-caption"></p><span class="image-lightbox-counter"></span></div>'
      + '</div>';

    // In the body from the start: a closed dialog renders nothing.
    document.body.append(dialog);
    const enlarged = dialog.querySelector('.image-lightbox-image') as HTMLImageElement;
    const caption = dialog.querySelector('.image-lightbox-caption') as HTMLParagraphElement;
    const counter = dialog.querySelector('.image-lightbox-counter') as HTMLSpanElement;
    const meta = dialog.querySelector('.image-lightbox-meta') as HTMLDivElement;

    let index = 0;
    let zoomed = false;
    let trigger: HTMLImageElement | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The dialog carries the sentence, the image stays unnamed: one reading of
    // the caption instead of two.
    const render = () => {
      const source = zoomables[index];
      const text = source.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || source.alt.trim();
      // Hold the box the article already reserved. Without it the dialog is
      // empty until the file decodes, then jumps to size under the pointer.
      const width = Number(source.getAttribute('width')) || source.naturalWidth;
      const height = Number(source.getAttribute('height')) || source.naturalHeight;
      if (width > 0 && height > 0) {
        enlarged.width = width;
        enlarged.height = height;
      }
      enlarged.src = source.currentSrc || source.src;
      caption.textContent = text;
      caption.hidden = !text;
      counter.textContent = `${index + 1} / ${zoomables.length}`;
      counter.hidden = zoomables.length < 2;
      meta.hidden = caption.hidden && counter.hidden;
      dialog.setAttribute('aria-label', `${zoomables.length > 1 ? `图片 ${index + 1} / ${zoomables.length}` : '查看大图'}${text ? `：${text}` : ''}`);
    };

    // Zoomed, the dialog is the scroll container and the image sits at its
    // intrinsic size, so the pan is the browser's own scrolling.
    const setZoom = (value: boolean) => {
      zoomed = value;
      dialog.classList.toggle('is-zoomed', zoomed);
      if (!zoomed) dialog.scrollTo({ top: 0, left: 0 });
    };

    const step = (delta: number) => {
      // Wraps around: at the last screenshot the next press starts over.
      index = (index + delta + zoomables.length) % zoomables.length;
      if (zoomed) setZoom(false);
      render();
      // The next file may still be decoding, so the swap is blended instead of
      // popping from one screenshot to another.
      if (!reducedMotion.matches) {
        enlarged.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      }
    };

    const open = (at: number, origin: HTMLImageElement) => {
      if (dialog.open) return;
      index = at;
      trigger = origin;
      setZoom(false);
      render();
      dialog.showModal();
    };

    // The exit is animated too, so `close()` waits for the fade to finish; a
    // second attempt while it runs is ignored rather than queued.
    const closeDialog = () => {
      if (!dialog.open || dialog.classList.contains('is-closing')) return;
      if (reducedMotion.matches) dialog.close();
      else dialog.classList.add('is-closing');
    };

    // Both events end the fade: a cancelled animation (the reader changes the
    // motion preference mid-close) must not leave the dialog hanging open.
    const finishClose = (event: AnimationEvent) => {
      if (!dialog.classList.contains('is-closing')) return;
      if (event.animationName !== 'lightbox-fade-out' && event.animationName !== 'lightbox-out') return;
      dialog.classList.remove('is-closing');
      dialog.close();
    };
    dialog.addEventListener('animationend', finishClose);
    dialog.addEventListener('animationcancel', finishClose);

    if (zoomables.length > 1) {
      (['prev', 'next'] as const).forEach((direction) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'image-lightbox-nav';
        button.dataset.direction = direction;
        button.setAttribute('aria-label', direction === 'prev' ? '上一张（← 键）' : '下一张（→ 键）');
        button.textContent = direction === 'prev' ? '‹' : '›';
        dialog.append(button);
      });
    }

    dialog.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.image-lightbox-close')) {
        closeDialog();
        return;
      }
      const direction = target?.closest<HTMLElement>('.image-lightbox-nav')?.dataset.direction;
      if (direction) {
        step(direction === 'prev' ? -1 : 1);
        return;
      }
      if (target?.closest('.image-lightbox-image')) {
        setZoom(!zoomed);
        return;
      }
      if (event.target !== dialog) return;
      // The dark field: leave the zoom first, so a stray tap while panned in
      // does not drop the reader back into the article.
      if (zoomed) setZoom(false);
      else closeDialog();
    });
    // Escape keeps its default of closing the dialog, but through the fade.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener('keydown', (event) => {
      if (zoomables.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    });
    dialog.addEventListener('close', () => {
      dialog.classList.remove('is-closing');
      // Focus returns to the screenshot that opened the dialog, not to <body>.
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });

    // A dialog in the top layer survives an Astro swap: it is not inside the
    // article, so it would stay open over the next page with the document
    // inert behind it.
    closeLightbox = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };

    zoomables.forEach((img, position) => {
      img.tabIndex = 0;
      // role="button" drops the implicit image role and with it `alt` as a
      // name source, so the label is spelled out; an empty alt still needs one.
      img.setAttribute('role', 'button');
      if (!img.hasAttribute('aria-label')) {
        const label = img.alt.trim();
        img.setAttribute('aria-label', label ? `查看大图：${label}` : '查看大图');
      }
      img.addEventListener('click', () => open(position, img), { signal });
      img.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open(position, img);
      }, { signal });
    });
  }
  return () => closeLightbox?.();
};
