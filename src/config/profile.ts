export const profileConfig = {
  availability: '正在制作新工具',
  location: '中国 · 远程协作',
  roles: ['开发者', '工具制作者', '视觉实验者'],
  intro: '我喜欢把系统、配置和想法，做成可以直接使用的作品。',
  bio: '这里记录我的项目、实验、教程和一些正在发生的碎片。比起追逐完美，我更在意把一个想法真正做出来。',
  now: [
    '维护个人工具与博客系统',
    '折腾 Linux、桌面环境和游戏工作流',
    '学习更好的交互与视觉表达',
  ],
  stats: [
    { label: '文章', value: 'posts' },
    { label: '工具', value: 'tools' },
    { label: '技能', value: 'skills' },
    { label: '状态', value: 'ON' },
  ],
  timeline: [
    { year: 'NOW', title: '持续构建', description: '把实验、配置和日常灵感整理成可复用的作品。' },
    { year: '2025', title: '开始整理个人工作流', description: '从游戏配置、系统安装和视频制作工具开始记录。' },
    { year: '2024', title: '建立这个空间', description: '让代码、设计、笔记和兴趣有一个可以慢慢生长的地方。' },
  ],
} as const;
