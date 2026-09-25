export interface Tool {
  slug: string;
  name: string;
  icon: string;
  description: string;
  search: {
    body: string;
    tags: string[];
  };
}

export const tools: Tool[] = [
  {
    slug: 'switch-your-cfg',
    name: 'SwitchYourCFG',
    icon: '⌨️',
    description: '可视化编辑和导出 CS2 配置文件。',
    search: {
      body: 'CS2 CFG 配置 工具 键位 导出',
      tags: ['CS2', 'CFG', '配置'],
    },
  },
  {
    slug: 'ncm',
    name: 'NCM 解密',
    icon: '♫',
    description: '在浏览器中将 NCM 文件转换为 MP3 或 FLAC。',
    search: {
      body: '网易云音乐 NCM 解密 转换 MP3 FLAC 浏览器 本地处理',
      tags: ['网易云音乐', 'NCM', '音频'],
    },
  },
];
