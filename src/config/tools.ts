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
    slug: 'sushi',
    name: '寿司郎计算器',
    icon: '🍣',
    description: '按碟子颜色数碟就出账单，支持五个地区的价目与税率。',
    search: {
      body: '寿司郎 スシロー 壽司郎 计算器 碟色 价格 加一服务费 人均 分账 香港 台湾 日本 韩国 中国大陆',
      tags: ['寿司郎', '计算器', '账单'],
    },
  },
  {
    slug: 'ncm',
    name: 'NCM 解密',
    icon: '♫',
    description: '在浏览器本地把 NCM 转成 MP3 / FLAC。',
    search: {
      body: '网易云音乐 NCM 解密 转换 MP3 FLAC 浏览器 本地处理',
      tags: ['网易云音乐', 'NCM', '音频'],
    },
  },
];
