import { ROUTES } from './routes';

const musicApiBase = (import.meta.env.PUBLIC_NCM_API_BASE ?? '').replace(/\/+$/, '');
const ncmUserId = import.meta.env.PUBLIC_NCM_USER_ID ?? '1864136351';
const formatMusicDuration = (seconds: number) => {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, '0')}`;
};

export const siteConfig = {
  title: "Bad0RANG3's Studio",
  description: 'Bad0RANG3 的个人博客，记录软件推荐、CS2、Minecraft、开发工具、项目实践与日常思考。',
  siteUrl: 'https://bad0rang3.xyz',
  ogImage: '/HP.webp',
  giscus: {
    repo: 'Bad0RANG3/Bad0RANG3.github.io',
    repoId: 'R_kgDORyk8Fg',
    category: 'Announcements',
    categoryId: 'DIC_kwDORyk8Fs4C_VF9',
  },
  author: {
    name: 'Bad0RANG3',
    intro: '喜欢在计算机方面折腾的普通菜鸟。',
    avatar: '/HP-avatar.webp',
    email: 'badorangeovo@outlook.com',
  },
  navigation: [
    { href: ROUTES.HOME, label: '首页' },
    { href: ROUTES.POSTS, label: '文章' },
    { href: ROUTES.THOUGHTS, label: '碎碎念' },
    { href: ROUTES.PROJECTS, label: '项目' },
    { href: ROUTES.TOOLS, label: '工具' },
    { href: ROUTES.ARCHIVE, label: '归档' },
    { href: ROUTES.ABOUT, label: '关于' },
  ],
  secondaryNavigation: [
    { href: ROUTES.TAGS, label: '标签' },
    { href: ROUTES.SERIES, label: '系列' },
    { href: ROUTES.EXPLORE, label: '探索' },
    { href: ROUTES.PRIVACY, label: '隐私' },
  ],
  socials: [
    { name: 'GitHub', url: 'https://github.com/Bad0RANG3' },
    { name: 'X', url: 'https://x.com/Bad0RANG3' },
    { name: 'Instagram', url: 'https://instagram.com/Bad0RANG3ovo' },
    { name: '抖音', url: 'https://www.douyin.com/user/MS4wLjABAAAA3y9usLYBic-19MR78rfDbN-VmS3RhnVMmlZMmnt39m8' },
    { name: 'Email', url: 'mailto:badorangeovo@outlook.com' },
    { name: 'Telegram', url: 'https://t.me/Bad0RANG3' },
    { name: 'YouTube', url: 'https://youtube.com/@Bad0RANG3' },
    { name: 'BiliBili', url: 'https://space.bilibili.com/482966540' },
  ],
  hero: {
    lyric: '当我的故事开篇之时，就是我书写人生之时',
  },
  netease: {
    userId: ncmUserId,
    profileUrl: `https://music.163.com/#/user/home?id=${ncmUserId}`,
    // Public profile snapshots keep the card useful when the optional API is offline.
    // Set PUBLIC_NCM_API_BASE to refresh this data from your own API deployment.
    apiBase: musicApiBase,
    fallback: {
      nickname: 'Bad0RANG3',
      signature: '#错过了落日余晖还可以期待满天繁星#',
      avatarUrl: 'https://p1.music.126.net/aRpgZx-i37_k7v8pvXoAUw==/109951172597148609.jpg',
      follows: 67,
      followeds: 467,
      level: 10,
      listenSongs: 188324,
      medalNum: 101,
      vipLabel: '黑胶VIP',
      fanLabel: 'Synthion 乐迷',
      identityLabel: '网易音乐人',
    },
  },
  music: {
    id: 3315349142,
    title: 'main heroine',
    artist: 'Synthion',
    album: 'Lone Wolf',
    durationSeconds: 266.67,
    durationLabel: formatMusicDuration(266.67),
    audio: '/media/main-heroine.mp3',
    lyrics: '/media/main-heroine.lrc',
    cover: '/media/main-heroine-cover.webp',
    officialUrl: 'https://music.163.com/song?id=3315349142',
    // Set PUBLIC_NCM_API_BASE to your authorised NeteaseCloudMusicApiEnhanced deployment.
    apiBase: musicApiBase,
  },
  github: {
    username: 'Bad0RANG3',
    profileUrl: 'https://github.com/Bad0RANG3',
    apiUrl: 'https://api.github.com/users/Bad0RANG3',
  },
  about: {
    greeting: 'Hi, there!',
    subtitle: '欢迎和我交朋友 ^-^',
    currentStatus: `#include <iostream>
int main() {
    while (true) {
        std::cout << "我喜欢你" << std::endl;
    }
    return 0;
}`,
    techStack: [
      { name: 'TypeScript', url: 'https://www.typescriptlang.org/' },
      { name: 'Python', url: 'https://www.python.org/' },
      { name: 'C++', url: 'https://isocpp.org/' },
      { name: 'Kotlin', url: 'https://kotlinlang.org/' },
      { name: 'React', url: 'https://react.dev/' },
      { name: 'Vue', url: 'https://vuejs.org/' },
      { name: 'Node.js', url: 'https://nodejs.org/' },
    ],
    devTools: [
      { name: 'Git', url: 'https://git-scm.com/' },
      { name: 'Docker', url: 'https://www.docker.com/' },
      { name: 'Linux', url: 'https://www.linux.org/' },
      { name: 'Wireshark', url: 'https://www.wireshark.org/' },
      { name: 'VS Code', url: 'https://code.visualstudio.com/' },
      { name: 'Figma', url: 'https://www.figma.com/' },
      { name: 'After Effects', url: 'https://www.adobe.com/products/aftereffects.html' },
      { name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop.html' },
    ],
  },
} as const;

/** Document-level metadata consumed by layouts and the web manifest. */
export const SITE = {
  LANG: 'zh-CN',
  LOCALE: 'zh-CN',
  THEME: 'paper',
  THEME_DARK: 'paper-dark',
  THEME_COLOR: '#fdf2f6',
  THEME_COLOR_DARK: '#21131c',
  THEME_STORAGE_KEY: 'b0-theme',
} as const;

/**
 * Maps each name in `siteConfig.socials` to its icon in public/.
 * Names must match the entries in `siteConfig.socials` exactly.
 */
export const SOCIAL_ICONS = {
  GitHub: '/github.svg',
  X: '/x.svg',
  Instagram: '/instagram.svg',
  抖音: '/tiktok.svg',
  Email: '/email.svg',
  Telegram: '/telegram.svg',
  YouTube: '/youtube.svg',
  BiliBili: '/bilibili.svg',
} as const;
