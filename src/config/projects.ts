export type ProjectTone = 'teal' | 'coral' | 'citrus';

export interface Project {
  code: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  href: string;
  primaryActionLabel: string;
  type: string;
  status: string;
  tags: string[];
  tone: ProjectTone;
  featured?: boolean;
  highlights: string[];
}

export const projects: Project[] = [
  {
    code: '01',
    slug: 'virtualwait',
    name: 'VirtualWait',
    summary: '为线下场地设计的轻量虚拟排队系统。',
    description: '从队首确认、管理台到 QQ 群提醒，把现场排队流程整理成一条清晰的链路。',
    href: '/posts/virtualwait-template/',
    primaryActionLabel: '阅读项目文章',
    type: '完整系统',
    status: '已发布',
    tags: ['Web', '自动化', '工作流'],
    tone: 'teal',
    featured: true,
    highlights: [
      '把现场候场、队首确认和管理动作拆成清晰的使用流程。',
      '围绕管理台与群提醒整理可复用的实现模板。',
      '将部署与使用说明沉淀为公开文章，方便复查和继续迭代。',
    ],
  },
  {
    code: '02',
    slug: 'socd-cleaner',
    name: 'SOCD Cleaner',
    summary: '把普通键盘变成更可控的方向输入工具。',
    description: '提供多种冲突处理策略，用于测试和整理游戏输入行为。',
    href: '/posts/socd-cleaner/',
    primaryActionLabel: '阅读项目文章',
    type: '输入系统',
    status: '已发布',
    tags: ['Python', 'Input', 'Game'],
    tone: 'coral',
    featured: true,
    highlights: [
      '将相反方向同时按下时的处理规则明确为可选策略。',
      '以普通键盘为输入设备，便于测试和整理游戏输入行为。',
      '通过项目文章记录工具的边界、使用方式和后续思路。',
    ],
  },
  {
    code: '03',
    slug: 'switch-your-cfg',
    name: 'SwitchYourCFG',
    summary: 'CS2 配置可视化切换与导出工具。',
    description: '把繁琐的配置文件切换变成一个更直观、更容易复用的操作界面。',
    href: '/tools/switch-your-cfg/',
    primaryActionLabel: '打开在线工具',
    type: '在线工具',
    status: '可直接使用',
    tags: ['CS2', 'Tool', 'Config'],
    tone: 'citrus',
    featured: true,
    highlights: [
      '将配置切换从手动编辑文件转化为可视化操作。',
      '聚焦生成和导出可复用的 CS2 配置内容。',
      '工具逻辑在浏览器内运行，不需要账号或远程接口。',
    ],
  },
  {
    code: '04',
    slug: 'cs2-hlae-preset',
    name: 'CS2 HLAE Preset',
    summary: '面向 Demo POV 的录制预设与工作流笔记。',
    description: '整理画质、编码器、音视频合并和常用脚本，让录制流程更容易复现。',
    href: '/posts/cs2-hlae-preset/',
    primaryActionLabel: '阅读工作流笔记',
    type: '视频工作流',
    status: '持续更新',
    tags: ['HLAE', 'FFmpeg', 'Video'],
    tone: 'coral',
    highlights: [
      '围绕 Demo POV 录制整理画质、编码器与音视频处理环节。',
      '把常用脚本和预设放进同一条可复查的工作流。',
      '持续把实际录制过程中的调整写回项目笔记。',
    ],
  },
  {
    code: '05',
    slug: 'arch-install-notes',
    name: 'Arch Install Notes',
    summary: '把系统安装和桌面配置过程写成可复用的路线。',
    description: '记录 CachyOS、Niri 以及常用桌面工具的实际安装和调整过程。',
    href: '/posts/archlinuxinstallguide/',
    primaryActionLabel: '阅读安装笔记',
    type: '系统实验',
    status: '记录中',
    tags: ['Arch', 'Linux', 'Niri'],
    tone: 'teal',
    highlights: [
      '记录 CachyOS、Niri 和常用桌面工具的实际安装顺序。',
      '把容易遗漏的配置调整整理为可以重复执行的路线。',
      '作为持续维护的系统实验笔记，而不是一次性的安装清单。',
    ],
  },
];

export const featuredProjects = projects.filter((project) => project.featured);
