// Homepage presence cards. Both start from server-rendered snapshots and only
// refresh them in place, so a blocked or offline API leaves the fallback data
// visible. Responses are kept in sessionStorage to avoid refetching on every
// ClientRouter visit to the homepage.
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

interface GitHubProfile {
  bio?: string | null;
  public_repos?: number;
  followers?: number;
  following?: number;
}

const initGitHubCard = () => {
  const root = document.querySelector<HTMLElement>('[data-github-profile]');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  const apiUrl = root.dataset.apiUrl;
  if (!apiUrl) return;
  const cacheKey = 'b0-github-profile-v1';
  const render = (profile: GitHubProfile) => {
    const set = (selector: string, value: unknown) => {
      const node = root.querySelector(selector);
      if (node) node.textContent = String(value ?? '—');
    };
    const bio = root.querySelector('[data-github-bio]');
    if (bio && profile.bio) bio.textContent = profile.bio;
    set('[data-github-repos]', profile.public_repos);
    set('[data-github-followers]', profile.followers);
    set('[data-github-following]', profile.following);
  };
  const cached = readCache<GitHubProfile>(cacheKey);
  if (cached) render(cached);
  fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error('github-profile'))))
    .then((profile: GitHubProfile) => {
      render(profile);
      writeCache(cacheKey, profile);
    })
    .catch(() => {});
};

interface NcmMedal { artistName?: string; specialMedalType?: string }
interface NcmMedalPayload { data?: { medalNum?: number; obtainMedals?: NcmMedal[] } }
interface NcmDetailPayload {
  level?: number;
  listenSongs?: number;
  profile?: { nickname?: string; signature?: string; follows?: number; followeds?: number; avatarUrl?: string; vipType?: number };
}
interface NcmSnapshot { detail: NcmDetailPayload | null; medals: NcmMedalPayload | null }

const findFanMedal = (medals: NcmMedal[]) => medals.find((item) => item?.artistName === 'Synthion')
  || medals.find((item) => item?.specialMedalType === 'fansgroup' && item?.artistName);

const initNcmCard = () => {
  const root = document.querySelector<HTMLElement>('[data-ncm-profile]');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const apiBase = root.dataset.apiBase?.replace(/\/+$/, '') || '';
  const userId = root.dataset.userId || '';
  const cacheKey = `b0-ncm-profile-v1-${userId}`;
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
  const renderDetail = (payload: NcmDetailPayload | null | undefined) => {
    const profile = payload?.profile;
    if (!profile || typeof profile !== 'object') return;
    text('[data-ncm-name]', profile.nickname);
    text('[data-ncm-signature]', profile.signature);
    count('[data-ncm-follows]', profile.follows);
    count('[data-ncm-followeds]', profile.followeds);
    count('[data-ncm-level]', payload?.level);
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
  const renderMedals = (payload: NcmMedalPayload | null | undefined) => {
    const data = payload?.data;
    if (!data || typeof data !== 'object') return;
    count('[data-ncm-medals]', data.medalNum);
    const fanMedal = findFanMedal(Array.isArray(data.obtainMedals) ? data.obtainMedals : []);
    if (fanMedal?.artistName) text('[data-ncm-fan]', `${fanMedal.artistName} 乐迷`);
  };
  const render = (snapshot: NcmSnapshot | null) => {
    renderDetail(snapshot?.detail);
    renderMedals(snapshot?.medals);
  };
  // Only the one medal the card shows is cached, not the whole collection.
  const compactMedals = (payload: NcmMedalPayload): NcmMedalPayload | null => {
    const data = payload?.data;
    if (!data || typeof data !== 'object') return null;
    const fanMedal = findFanMedal(Array.isArray(data.obtainMedals) ? data.obtainMedals : []);
    return { data: { medalNum: data.medalNum, obtainMedals: fanMedal ? [fanMedal] : [] } };
  };
  const request = <T>(path: string): Promise<T> => fetch(`${apiBase}${path}`, { credentials: 'omit' })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error('ncm-profile'))));

  render(readCache<NcmSnapshot>(cacheKey));
  if (!apiBase || !userId) return;
  Promise.allSettled([
    request<NcmDetailPayload>(`/user/detail?uid=${encodeURIComponent(userId)}`),
    request<NcmMedalPayload>(`/user/medal?uid=${encodeURIComponent(userId)}`),
  ]).then(([detail, medals]) => {
    const snapshot: NcmSnapshot = {
      detail: detail.status === 'fulfilled' ? detail.value : null,
      medals: medals.status === 'fulfilled' ? compactMedals(medals.value) : null,
    };
    render(snapshot);
    writeCache(cacheKey, snapshot);
  });
};

const initHome = () => {
  initGitHubCard();
  initNcmCard();
};

document.addEventListener('astro:page-load', initHome);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHome, { once: true });
else initHome();
