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
    summary: '给线下机台场地用的虚拟排队系统。',
    description: '包含队首确认、管理台和 QQ 群提醒，把现场排队的完整流程串起来。',
    href: '/posts/virtualwait-template/',
    primaryActionLabel: '阅读项目文章',
    type: '完整系统',
    status: '已发布',
    tags: ['Web', '自动化', '工作流'],
    tone: 'teal',
    featured: true,
    highlights: [
      '覆盖现场候场、队首确认和管理台操作。',
      '管理台与 QQ 群提醒可以拆出来单独复用。',
      '部署和使用说明写在公开文章里，方便复查。',
    ],
  },
  {
    code: '02',
    slug: 'socd-cleaner',
    name: 'SOCD Cleaner',
    summary: '把普通键盘变成更可控的方向输入工具。',
    description: '提供回中、后发优先、先发优先三种冲突处理策略，普通键盘就能用。',
    href: '/posts/socd-cleaner/',
    primaryActionLabel: '阅读项目文章',
    type: '输入系统',
    status: '已发布',
    tags: ['Python', 'Input', 'Game'],
    tone: 'coral',
    featured: true,
    highlights: [
      '相反方向同时按下时的处理规则做成可选项。',
      '普通键盘即可使用，方便测试和整理输入行为。',
      '工具的边界和使用方式记录在项目文章里。',
    ],
  },
  {
    code: '03',
    slug: 'switch-your-cfg',
    name: 'SwitchYourCFG',
    summary: 'CS2 配置可视化切换与导出工具。',
    description: '把配置文件切换变成可视化操作，改完直接导出。',
    href: '/tools/switch-your-cfg/',
    primaryActionLabel: '打开在线工具',
    type: '在线工具',
    status: '可直接使用',
    tags: ['CS2', 'Tool', 'Config'],
    tone: 'citrus',
    featured: true,
    highlights: [
      '不用手改文件，直接在界面里切配置。',
      '专注生成和导出 CS2 配置内容。',
      '工具在浏览器里运行，不需要账号和远程接口。',
    ],
  },
  {
    code: '04',
    slug: 'cs2-hlae-preset',
    name: 'CS2 HLAE Preset',
    summary: '面向 Demo POV 的录制预设与工作流笔记。',
    description: '整理画质、编码器、音视频合并和常用脚本，照着做就能复现。',
    href: '/posts/cs2-hlae-preset/',
    primaryActionLabel: '阅读工作流笔记',
    type: '视频工作流',
    status: '持续更新',
    tags: ['HLAE', 'FFmpeg', 'Video'],
    tone: 'coral',
    highlights: [
      '整理 Demo POV 录制的画质、编码器和音视频处理。',
      '常用脚本和预设放在同一条工作流里。',
      '实际录制中的调整会持续写回笔记。',
    ],
  },
  {
    code: '05',
    slug: 'arch-install-notes',
    name: 'Arch Install Notes',
    summary: '记录系统安装和桌面配置的完整过程。',
    description: '记录 CachyOS、Niri 以及常用桌面工具的实际安装和调整过程。',
    href: '/posts/archlinuxinstallguide/',
    primaryActionLabel: '阅读安装笔记',
    type: '系统实验',
    status: '记录中',
    tags: ['Arch', 'Linux', 'Niri'],
    tone: 'teal',
    highlights: [
      '记录 CachyOS、Niri 和常用桌面工具的实际安装顺序。',
      '把容易漏掉的配置调整整理成可重复执行的步骤。',
      '当作持续维护的笔记，不是一次性的安装清单。',
    ],
  },
];

export const featuredProjects = projects.filter((project) => project.featured);
