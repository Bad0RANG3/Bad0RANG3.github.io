// The homepage starts from a server-rendered snapshot and only refreshes it
// when the optional Netease API is configured. Cached responses avoid refetching
// on every ClientRouter visit.
export {};

const readCache = <T>(key: string): T | null => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null') as T | null;
  } catch {
    return null;
  }
};
const writeCache = (key: string, value: unknown) => {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
};

interface NcmDetailPayload {
  listenSongs?: number;
  profile?: { nickname?: string; signature?: string; follows?: number; followeds?: number; avatarUrl?: string; vipType?: number };
}

const initNcmCard = () => {
  const root = document.querySelector<HTMLElement>('[data-ncm-profile]');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const apiBase = root.dataset.apiBase?.replace(/\/+$/, '') || '';
  const userId = root.dataset.userId || '';
  const cacheKey = `b0-ncm-profile-v2-${userId}`;
  const number = new Intl.NumberFormat('zh-CN');
  const text = (selector: string, value: unknown) => {
    const node = root.querySelector(selector);
    if (node && value !== undefined && value !== null && String(value).trim()) node.textContent = String(value);
  };
  const count = (selector: string, value: unknown) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) text(selector, number.format(parsed));
  };
  const safeImageUrl = (value: unknown) => {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch {
      return '';
    }
  };
  const render = (payload: NcmDetailPayload | null) => {
    const profile = payload?.profile;
    if (!profile || typeof profile !== 'object') return;
    text('[data-ncm-name]', profile.nickname);
    text('[data-ncm-signature]', profile.signature);
    count('[data-ncm-follows]', profile.follows);
    count('[data-ncm-followeds]', profile.followeds);
    count('[data-ncm-listens]', payload?.listenSongs);
    const avatar = safeImageUrl(profile.avatarUrl);
    const image = root.querySelector('[data-ncm-avatar]');
    if (avatar && image instanceof HTMLImageElement) image.src = avatar;
    const vip = root.querySelector<HTMLElement>('[data-ncm-vip]');
    if (vip) {
      const hasVip = Number(profile.vipType) > 0;
      vip.hidden = !hasVip;
      if (hasVip) vip.textContent = '黑胶VIP';
    }
  };

  const request = <T>(path: string): Promise<T> => fetch(`${apiBase}${path}`, { credentials: 'omit' })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error('ncm-profile'))));

  render(readCache<NcmDetailPayload>(cacheKey));
  if (!apiBase || !userId) return;
  // One request: the compact profile card no longer displays medal data.
  request<NcmDetailPayload>(`/user/detail?uid=${encodeURIComponent(userId)}`)
    .then((detail) => {
      render(detail);
      writeCache(cacheKey, detail);
    })
    .catch(() => {});
};

const initHome = () => initNcmCard();

document.addEventListener('astro:page-load', initHome);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHome, { once: true });
else initHome();
