/**
 * One animation frame per scroll burst, shared by every scroll-driven
 * controller on the site.
 *
 * Three modules used to subscribe to `scroll` and `resize` on their own: the
 * back-to-top button decided on every raw event, the reading-progress bar ran
 * its own `requestAnimationFrame`, and the page controllers each carried
 * another. That is three callbacks and up to three style invalidations for one
 * gesture, and the order they ran in decided whether a layout read in one
 * invalidated the write in another. Routing all of them through this module
 * means a scroll gesture costs one animation frame and one pass over the
 * subscribers, and a page with no scroll-driven controller attached (the
 * archive, the tool pages) installs no listener at all.
 *
 * Subscribers run in registration order, so a subscriber that only reads
 * (`window.scrollY`, a cached height) should register before one that writes.
 * Nothing here reads layout on a subscriber's behalf.
 */
type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let frame = 0;

const flush = () => {
  frame = 0;
  for (const subscriber of subscribers) subscriber();
};

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(flush);
};

/**
 * Registers `subscriber` for the next animation frame after a scroll or resize
 * and calls it once immediately, so a page that loads already scrolled (a
 * fragment link, a restored position) is not left showing stale state.
 * Returns the unsubscribe function.
 */
export const onScrollFrame = (subscriber: Subscriber): (() => void) => {
  if (!subscribers.size) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  }
  subscribers.add(subscriber);
  subscriber();
  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
};
