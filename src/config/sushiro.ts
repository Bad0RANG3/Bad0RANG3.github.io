/**
 * 寿司郎计算器的地区数据。
 *
 * 计价规则在各地区并不一致，这里按事实分两种模型：
 *
 * 1. **碟色定价**（香港 / 台湾 / 中国大陆）——同一个颜色的碟子永远是同一个价钱。
 *    这三地的 `tiers` 就是碟色，`color` 是碟子本体的颜色。
 * 2. **单品定价**（日本 / 韩国）——2023 年之后日本改成每款商品单独定价，碟色不再
 *    对应价格；韩国同样是单品定价。这两地按官方菜单上真实出现的价位设档，
 *    不带 `color`（页面会退化成序号徽章，不假装有碟色）。
 *
 * 日本另有一个变量：**同一款商品在不同店型价格不同**（郊外型 / 準都市型 / 都市型，
 * 最低价皿分别为 120 / 130 / 150 円）。这里用「店型偏移」近似——把最低价的差额
 * 平移到每一档上，并在界面上写明是近似值。
 *
 * `sources` 是给维护者看的底账：每个数字都必须能指到出处，宁可不收录，也不要编
 * 一个看起来合理的价格。页面只展示其中第一条，避免价目页堆满外链。
 */

export interface PlateTier {
  id: string;
  /** 碟色名（碟色定价地区）或价位说明（单品定价地区）。 */
  name: string;
  /** 该档单价，单位为本地区货币。 */
  price: number;
  /** 碟子颜色。只在有据可依时给；缺省时页面显示序号徽章。 */
  color?: string;
  /** 该档的代表性商品。 */
  note?: string;
}

export interface ExtraItem {
  id: string;
  name: string;
  price: number;
  /** `person` 按人数翻倍（饮料吧、茶位费），`item` 按份数计。 */
  unit: 'person' | 'item';
}

export interface TaxOption {
  id: string;
  label: string;
  rate: number;
  hint?: string;
}

export interface StoreBand {
  id: string;
  name: string;
  /** 加在每一档上的差额（仅日本使用，近似值）。 */
  offset: number;
  note: string;
}

export interface SushiroRegion {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
  currency: {
    code: string;
    symbol: string;
    position: 'prefix' | 'suffix';
    decimals: number;
  };
  /** 菜单价里**已经含**的税率。切换税率档位时用它把净价还原出来重算。 */
  baseRate: number;
  tax: {
    mode: 'included' | 'excluded';
    label: string;
    note: string;
    options: TaxOption[];
  };
  service: { rate: number; label: string } | null;
  serviceNote: string;
  bands?: StoreBand[];
  tiers: PlateTier[];
  tierNote: string;
  extras: ExtraItem[];
  extraNote: string;
  sources: { label: string; url: string }[];
  updated: string;
}

/** 按币种惯例格式化：日元 / 韩元写在后缀（120円、2,200원），其余写在前缀。 */
export function formatMoney(region: SushiroRegion, value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const digits = safe.toLocaleString('zh-CN', {
    minimumFractionDigits: region.currency.decimals,
    maximumFractionDigits: region.currency.decimals,
  });
  return region.currency.position === 'suffix'
    ? `${digits}${region.currency.symbol}`
    : `${region.currency.symbol}${digits}`;
}

export const regions: SushiroRegion[] = [
  {
    id: 'jp',
    name: '日本',
    nativeName: 'スシロー',
    flag: '🇯🇵',
    currency: { code: 'JPY', symbol: '円', position: 'suffix', decimals: 0 },
    baseRate: 0.1,
    tax: {
      mode: 'included',
      label: '消费税 10%',
      note: '菜单价为税込。',
      options: [
        { id: 'dinein', label: '消费税 10% · 店内饮食', rate: 0.1 },
        { id: 'takeout', label: '消费税 8% · 外带轻减税率', rate: 0.08, hint: '净价不变，税込价略低' },
      ],
    },
    service: null,
    serviceNote: '日本不收服务费。',
    bands: [
      { id: 'suburb', name: '郊外型', offset: 0, note: '最低价皿 120 円〜' },
      { id: 'semi-urban', name: '準都市型', offset: 10, note: '最低价皿 130 円〜' },
      { id: 'urban', name: '都市型', offset: 30, note: '最低价皿 150 円〜' },
      { id: 'urban-plus', name: '都市型（高价带）', offset: 50, note: '最低价皿 170 円〜' },
    ],
    tiers: [
      { id: 'jp-120', name: '基础价位', price: 120, note: 'サーモン・えび・玉子・いか・ねぎとろ 等' },
      { id: 'jp-150', name: '常点价位', price: 150, note: 'まぐろ 等' },
      { id: 'jp-180', name: '上位价位', price: 180, note: 'えんがわ 等' },
      { id: 'jp-240', name: '特上价位', price: 240 },
      { id: 'jp-300', name: '豪华价位', price: 300 },
    ],
    tierNote: '单品定价，没有「碟色＝价格」。店型偏移为近似值。',
    extras: [],
    extraNote: '单品定价，配菜与甜点请用「临时项目」按实际金额添加。',
    sources: [
      { label: 'スシロー官方门店菜单（佐久平店，逐品标价）', url: 'https://www.akindo-sushiro.co.jp/menu/' },
      { label: '回転寿司 4 社价格区分对比（120/130/150/170 円 店）', url: 'https://kanko-map.com/kaiten-sushi-chain-compare-ja/' },
      { label: 'スシロー价格带整理（郊外型 120 / 準都市型 130 / 都市型 150）', url: 'https://tomatokonote.com/sushiro/' },
    ],
    updated: '2026-11',
  },
  {
    id: 'hk',
    name: '香港',
    nativeName: '壽司郎',
    flag: '🇭🇰',
    currency: { code: 'HKD', symbol: 'HK$', position: 'prefix', decimals: 1 },
    baseRate: 0,
    tax: {
      mode: 'included',
      label: '消费税',
      note: '香港不设消费税。',
      options: [{ id: 'none', label: '香港不设消费税', rate: 0 }],
    },
    service: { rate: 0.1, label: '加一服務費 10%' },
    serviceNote: '堂食加一 10%。',
    tiers: [
      { id: 'hk-red', name: '紅碟', price: 12, color: '#d8342f', note: '款式最多，含嚴選二貫' },
      { id: 'hk-silver', name: '銀碟', price: 17, color: '#b9bcc4' },
      { id: 'hk-gold', name: '金碟', price: 22, color: '#d9a520' },
      { id: 'hk-black', name: '黑碟', price: 27, color: '#2b2b30', note: '大吞拿魚腩等' },
    ],
    tierNote: '四色碟固定价。白碟为海鲜价，用「临时项目」添加。',
    extras: [
      { id: 'hk-chawanmushi', name: '茶碗蒸', price: 19, unit: 'item' },
      { id: 'hk-misoshiru', name: '蜆肉海苔麵豉湯', price: 20, unit: 'item' },
      { id: 'hk-millecrepe', name: '千層蛋糕', price: 22, unit: 'item' },
      { id: 'hk-catalana', name: '卡達拉娜', price: 22, unit: 'item' },
    ],
    extraNote: '按份数计。',
    sources: [
      { label: 'Sushiro HK 官方菜单（握壽司 / 軍艦・卷物）', url: 'https://sushirohk.com.hk/tc/menu.php?wid=5&cid=7' },
      { label: 'Sushiro HK 官方菜单（副餐類）', url: 'https://sushirohk.com.hk/tc/menu.php?wid=5&cid=13' },
      { label: '碟色与价格对照（$12 紅 / $17 銀 / $22 金 / $27 黑）', url: 'https://hk.ulifestyle.com.hk/topic/detail/20029231/' },
      { label: '加一服務費说明', url: 'https://uptogo.com.tw/美食/香港壽司郎一盤多少？/' },
    ],
    updated: '2026-11',
  },
  {
    id: 'tw',
    name: '台灣',
    nativeName: '台灣壽司郎',
    flag: '🇹🇼',
    currency: { code: 'TWD', symbol: 'NT$', position: 'prefix', decimals: 0 },
    baseRate: 0.05,
    tax: {
      mode: 'included',
      label: '營業稅 5%',
      note: '菜单价已含 5% 營業稅。',
      options: [{ id: 'vat', label: '營業稅 5%（已含）', rate: 0.05 }],
    },
    service: null,
    serviceNote: '官網未列服務費。',
    tiers: [
      { id: 'tw-milk', name: '奶茶盤（米色）', price: 30, color: '#e2d6bd' },
      { id: 'tw-red', name: '紅色盤', price: 40, color: '#d8342f', note: '鮭魚、炙燒起司鮭魚' },
      { id: 'tw-green', name: '綠色盤', price: 50, color: '#3f9d5a', note: '炙烤鯖魚押壽司、甜蝦' },
      { id: 'tw-silver', name: '銀色盤', price: 60, color: '#b9bcc4', note: '生鮭魚、水章魚' },
      { id: 'tw-blue', name: '藍色盤', price: 70, color: '#2f6fd0', note: '黑鮪魚中腹' },
      { id: 'tw-gold', name: '金色盤', price: 80, color: '#d9a520', note: '日本產貝柱、極上鰻魚' },
      { id: 'tw-black', name: '黑色盤', price: 100, color: '#2b2b30', note: '黑鮪魚大腹' },
    ],
    tierNote: '7 色盤價（2025-12 改版）。',
    extras: [
      { id: 'tw-chawanmushi', name: '茶碗蒸', price: 60, unit: 'item' },
      { id: 'tw-misoshiru', name: '海苔味噌湯', price: 50, unit: 'item' },
      { id: 'tw-fries', name: '黃金脆薯', price: 50, unit: 'item' },
      { id: 'tw-karaage', name: '炸雞塊', price: 80, unit: 'item' },
      { id: 'tw-millecrepe', name: '千層蛋糕', price: 60, unit: 'item' },
      { id: 'tw-catalana', name: '卡達拉娜', price: 80, unit: 'item' },
    ],
    extraNote: '副餐与甜点按份数计，不按盤色。',
    sources: [
      { label: '台灣壽司郎官方菜單', url: 'https://www.sushiro.com.tw/Menu' },
      { label: '7 色盤價與品項對照（2026-10）', url: 'https://smartsavebella.com/sushiro-menu/' },
    ],
    updated: '2026-11',
  },
  {
    id: 'kr',
    name: '韓國',
    nativeName: '스시로',
    flag: '🇰🇷',
    currency: { code: 'KRW', symbol: '원', position: 'suffix', decimals: 0 },
    baseRate: 0.1,
    tax: {
      mode: 'included',
      label: '附加價值稅 10%',
      note: '菜单价已含 부가세。',
      options: [{ id: 'vat', label: '附加價值稅 10%（已含）', rate: 0.1 }],
    },
    service: null,
    serviceNote: '不收服务费。',
    tiers: [
      { id: 'kr-2200', name: '基础价位', price: 2200, note: '가다랑어 타다키 等' },
      { id: 'kr-2800', name: '常见价位', price: 2800 },
      { id: 'kr-3200', name: '常点价位', price: 3200, note: 'まぐろ、本まぐろ中とろ 等' },
      { id: 'kr-3900', name: '上位价位', price: 3900, note: 'ひらめ、えんがわ 等' },
      { id: 'kr-5000', name: '豪华价位', price: 5000, note: '本まぐろ大とろ 等' },
    ],
    tierNote: '单品定价，取件数最多的几档。',
    extras: [],
    extraNote: '单品定价，配菜与甜点请用「临时项目」添加。',
    sources: [
      { label: '스시로 코리아 官方菜单（217 道菜逐项标价）', url: 'https://sushiro.co.kr/gm' },
    ],
    updated: '2026-11',
  },
  {
    id: 'cn',
    name: '中國大陸',
    nativeName: '寿司郎',
    flag: '🇨🇳',
    currency: { code: 'CNY', symbol: '¥', position: 'prefix', decimals: 0 },
    baseRate: 0.06,
    tax: {
      mode: 'included',
      label: '增值稅 6%',
      note: '菜单价已含增值稅。',
      options: [{ id: 'vat', label: '增值稅 6%（已含）', rate: 0.06 }],
    },
    service: null,
    serviceNote: '不收服务费，自助结账。',
    tiers: [
      { id: 'cn-white', name: '白碟（每月特價）', price: 8, color: '#f2f0ea', note: '每月更新' },
      { id: 'cn-red', name: '紅碟', price: 10, color: '#d8342f', note: '款式最多' },
      { id: 'cn-15', name: '15 元檔', price: 15 },
      { id: 'cn-20', name: '20 元檔', price: 20 },
      { id: 'cn-black', name: '黑碟', price: 28, color: '#2b2b30', note: '蓝鳍金枪鱼大腩等' },
    ],
    tierNote: '按碟色计价。中间两档碟色未核实，不标颜色。',
    extras: [],
    extraNote: '刺身、副餐为单品定价，请用「临时项目」添加。',
    sources: [
      { label: '价格分档（8 元特价白碟 / 10 / 15 / 20–28 元）', url: 'https://k.sina.cn/article_7879777065_1d5abdb2906801hlj2.html' },
      { label: '碟色计价说明（红碟 10 元起、黑碟约 28 元）', url: 'https://aiqicha.baidu.com/details/ugknowledge?id=da861e0c6eb8227d52261b72636ab1c4' },
      { label: '广州门店实测', url: 'https://post.smzdm.com/p/a4p3rzxw/' },
    ],
    updated: '2026-11',
  },
];

/** 未收录地区：这几家的官网菜单只有图片，取不到可核实的单碟价。 */
export const unlistedRegions = ['新加坡', '泰国', '马来西亚', '印尼'];
