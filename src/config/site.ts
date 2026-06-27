import { ROUTES } from '../constants';

export const siteConfig = {
  title: "Bad0RANG3's Blog",
  description: '分享我在软件开发、技术和生活中的想法与经验。',
  siteUrl: 'https://bad0rang3.github.io',
  ogImage: '/HP.png',
  giscus: {
    repo: 'Bad0RANG3/Bad0RANG3.github.io',
    repoId: 'R_kgDORyk8Fg',
    category: 'Announcements',
    categoryId: 'DIC_kwDORyk8Fs4C_VF9',
  },
  author: {
    name: 'Bad0RANG3',
    intro: '喜欢在计算机方面折腾的一个普普通通的菜鸟，更倾向于视频特效的制作。',
    avatar: '/HP.png',
    email: 'badorangeovo@outlook.com',
  },
  navigation: [
    { href: ROUTES.HOME, label: '首页' },
    { href: ROUTES.POSTS, label: '文章' },
    { href: ROUTES.THOUGHTS, label: '碎碎念' },
    { href: ROUTES.TOOLS, label: '工具' },
    { href: ROUTES.ARCHIVE, label: '归档' },
    { href: ROUTES.ABOUT, label: '关于' },
  ],
  socials: [
    { name: 'GitHub', url: 'https://github.com/Bad0RANG3' },
    { name: 'X', url: 'https://x.com/Bad0RANG3' },
    { name: 'Instagram', url: 'https://instagram.com/Bad0RANG3ovo' },
    { name: '抖音', url: 'https://www.douyin.com/user/MS4wLjABAAAA3y9usLYBic-19MR78rfDbN-VmS3RhnVMmlZMmnt39m8' },
    { name: 'Email', url: 'mailto:badorangeovo@outlook.com' },
    { name: 'Telegram', url: 'https://t.me/Bad0RANG3' },
    { name: 'YouTube', url: 'https://youtube.com/Bad0RANG3' },
    { name: 'BiliBili', url: 'https://space.bilibili.com/482966540' },
  ],
  hero: {
    lyric: '当我的故事开篇之时，就是我书写人生之时',
    lyricSource: '— Synthion「main heroine」',
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
    quotes: [
      '"四大皆空😡😡（指钱包、微信、支付宝和Paypal）"',
      '"愿意和我组一辈子乐队吗？"',
      '"质疑屎山，理解屎山，制造屎山"',
    ],
    techStack: [
      { name: 'HTML5', url: 'https://html.spec.whatwg.org/' },
      { name: 'CSS3', url: 'https://www.w3.org/Style/CSS/' },
      { name: 'JavaScript', url: 'https://tc39.es/ecma262/' },
      { name: 'TypeScript', url: 'https://www.typescriptlang.org/' },
      { name: 'Python', url: 'https://www.python.org/' },
      { name: 'Java', url: 'https://www.java.com/' },
      { name: 'Kotlin', url: 'https://kotlinlang.org/' },
      { name: 'C++', url: 'https://isocpp.org/' },
      { name: 'C#', url: 'https://dotnet.microsoft.com/en-us/languages/csharp' },
      { name: 'C', url: 'https://en.cppreference.com/' },
      { name: 'Rust', url: 'https://www.rust-lang.org/' },
      { name: 'Git', url: 'https://git-scm.com/' },
      { name: 'Docker', url: 'https://www.docker.com/' },
      { name: 'Vue.js', url: 'https://vuejs.org/' },
      { name: 'Tailwind CSS', url: 'https://tailwindcss.com/' },
      { name: 'Flask', url: 'https://flask.palletsprojects.com/' },
      { name: 'Spring Boot', url: 'https://spring.io/projects/spring-boot' },
      { name: 'MySQL', url: 'https://www.mysql.com/' },
      { name: 'PostgreSQL', url: 'https://www.postgresql.org/' },
    ],
    devTools: [
      { name: 'Arch Linux', url: 'https://archlinux.org/' },
      { name: 'Windows 11', url: 'https://www.microsoft.com/windows/windows-11' },
      { name: 'VS Code', url: 'https://code.visualstudio.com/' },
      { name: 'Unity', url: 'https://unity.com/' },
      { name: 'After Effects', url: 'https://www.adobe.com/products/aftereffects.html' },
      { name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop.html' },
      { name: 'Figma', url: 'https://www.figma.com/' },
      { name: 'IDA Pro', url: 'https://hex-rays.com/ida-pro/' },
      { name: 'Wireshark', url: 'https://www.wireshark.org/' },
    ],
    interests: ['Minecraft', 'CS2', '视频特效', '折腾硬件与软件'],
  },
} as const;
