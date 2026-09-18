import { postPath, toolPath } from './routes';

export type ProjectTone = 'teal' | 'coral' | 'citrus';

export interface Project {
  name: string;
  summary: string;
  href: string;
  tone: ProjectTone;
}

export const projects: Project[] = [
  {
    name: 'Yukinal',
    summary: '把远程运维与可审批的 AI Agent 放进同一个桌面工作区。',
    href: postPath('yukinal'),
    tone: 'citrus',
  },
  {
    name: 'VirtualWait',
    summary: '给线下机台场地用的虚拟排队系统。',
    href: postPath('virtualwait-template'),
    tone: 'teal',
  },
  {
    name: 'SOCD Cleaner',
    summary: '把普通键盘变成更可控的方向输入工具。',
    href: postPath('socd-cleaner'),
    tone: 'coral',
  },
  {
    name: 'SwitchYourCFG',
    summary: 'CS2 配置可视化切换与导出工具。',
    href: toolPath('switch-your-cfg'),
    tone: 'citrus',
  },
  {
    name: 'CS2 HLAE Preset',
    summary: '面向 Demo POV 的录制预设与工作流笔记。',
    href: postPath('cs2-hlae-preset'),
    tone: 'coral',
  },
  {
    name: 'Arch Install Notes',
    summary: '记录系统安装和桌面配置的完整过程。',
    href: postPath('archlinuxinstallguide'),
    tone: 'teal',
  },
];
