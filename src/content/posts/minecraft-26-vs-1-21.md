---
title: 'Minecraft 26.2 vs 1.21：从数据包到组件，我的世界经历了什么'
description: '深度对比 Minecraft 26.2 与 1.21 的命令系统差异：组件系统、execute 进化、/item 与 /data 变迁、Display Entity、Macro 函数、新武器、附魔解禁。'
date: 2026-07-27
tags:
  - Minecraft
  - 游戏
  - 命令
  - 数据包
  - 组件系统
category: 游戏
featured: false
draft: false
---

## 前言

Minecraft 从 1.21 到 26.2，横跨了二十多个大版本。如果你是从 1.21 直接跳到 26.2 的回归玩家，打开游戏的第一反应大概率是——**这命令怎么写不了了？**

确实，命令系统的底层经历了颠覆性的重构。这篇文章带你梳理 1.21 → 26.2 最核心的变化。

---

## 1. 物品 NBT → 组件系统（最大的变化）

### 1.21 时代：NBT 标签

在 1.21 及更早版本中，给物品附加属性靠的是 NBT（Named Binary Tag）：

```mcfunction
/give @p netherite_sword{display:{Name:'{"text":"断罪之刃","color":"dark_red"}'},Enchantments:[{id:"minecraft:sharpness",lvl:255}]}
```

大括号套大括号，少一个引号直接报错。写一把满附魔神剑，手抖一下就是半小时 debug。

### 26.2：组件系统（Component System）

26.x 彻底废弃了旧 NBT 格式，全面转向**物品组件（Item Components）**：

```mcfunction
/give @p netherite_sword[
  minecraft:custom_name={text:"断罪之刃",color:"dark_red",bold:true},
  minecraft:lore=[{text:"裁决万物之罪",color:"red",italic:false}],
  minecraft:enchantments={
    "minecraft:sharpness":255,
    "minecraft:looting":5,
    "minecraft:unbreaking":255
  },
  minecraft:unbreakable={}
]
```

### 对比一览

| 特性 | 1.21 (NBT) | 26.2 (组件) |
|:--|:--|:--|
| 语法风格 | `{...}` 嵌套 | `[...]` 方括号 + 命名空间 |
| 名称设置 | `display:{Name:'...'}` | `minecraft:custom_name={...}` |
| 描述 Lore | `display:{Lore:[...]}` | `minecraft:lore=[...]` |
| 附魔 | `Enchantments:[{id:"...",lvl:n}]` | `minecraft:enchantments={"...":n}` |
| 不可破坏 | `Unbreakable:1b` | `minecraft:unbreakable={}` |
| 可读性 | 反人类 | 一目了然 |
| 错误提示 | 不存在的，自己找 | 精确到组件级别 |

**核心优势**：组件格式使用命名空间（`minecraft:`），结构化清晰，JSON 原生兼容。再也不用在单引号和双引号之间反复横跳了。

---

## 2. 新武器：Mace（重锤）与 Spear（长矛）

### Mace · 天罚之锤

1.21 引入了 Mace（重锤）作为试炼密室奖励，26.2 进一步扩展了它的附魔池：

```mcfunction
/give @p mace[
  minecraft:custom_name={text:"天罚之锤",color:"dark_purple",bold:true},
  minecraft:lore=[{text:"从天而降的审判",color:"gold",italic:false}],
  minecraft:enchantments={
    "minecraft:smite":255,
    "minecraft:bane_of_arthropods":255,
    "minecraft:unbreaking":255,
    "minecraft:mending":255
  },
  minecraft:unbreakable={}
]
```

| 对比 | 1.21 | 26.2 |
|:--|:--|:--|
| 获取方式 | 试炼密室专属 | 合成 + 试炼密室 |
| 附魔上限 | 标准上限（V） | 255（与鞘翅同款待遇） |
| Smite 兼容 | ❌ | ✅ |
| 下落伤害加成 | 有上限 | 无上限（只要你敢跳） |

### Spear · 贯穿星辰

长矛是 26.x 新增的武器类型，介于剑和三叉戟之间：

```mcfunction
/give @p netherite_spear[
  minecraft:custom_name={text:"✧ 贯穿星辰 ✧",color:"light_purple",bold:true},
  minecraft:lore=[{text:"一击贯穿永恒",color:"dark_purple",italic:false}],
  minecraft:enchantments={
    "minecraft:sharpness":255,
    "minecraft:lunge":5,
    "minecraft:unbreaking":255
  }
]
```

- **Lunge（突刺）**：26.x 新增附魔，类似 1.21 三叉戟的激流，但无需水域环境。**注意别拉满——Lunge 等级过高会产生回弹效果，5 级刚好流畅突刺不反弹。**
- 伤害介于剑和斧之间，攻击距离 +1 格
- 不可投掷（投掷是三叉戟的专属）

---

## 3. 附魔系统变化

### 附魔上限解禁

1.21 中，大多数附魔的上限是 V（5 级）。26.2 在 `/give` 命令层面**移除了所有附魔上限**：

```mcfunction
// 26.2：这是合法的
"minecraft:sharpness":255,
"minecraft:protection":255,
"minecraft:efficiency":255
```

当然，生存模式中铁砧仍然受原版上限约束——255 级只在命令/数据包层面有效。

### 冲突附魔共存

1.21 禁止 Sharpness / Smite / Bane of Arthropods 共存。26.2 在命令层面**解除了互斥限制**：

```mcfunction
/give @p netherite_sword[
  minecraft:enchantments={
    "minecraft:sharpness":255,
    "minecraft:smite":255,
    "minecraft:bane_of_arthropods":255
  }
]
```

一把剑同时克制所有生物类型。创造模式玩家的终极玩具。

### 合理数值建议：不是所有附魔都该拉满

命令层面解除上限 ≠ 实际体验最佳。有些附魔堆到 255 反而破坏游戏：

| 附魔 | 推荐值 | 255 会发生什么 |
|:--|:--|:--|
| Fortune / Looting | 5 | 掉落物铺满屏幕，捡到背包爆炸 |
| Knockback / Punch | 3 | 一拳把怪物打到未加载区块，尸体都找不到 |
| Lunge | 5 | 回弹比突刺还远，自己飞出去 |
| Riptide | 5 | 从海底直冲天际，落地即死亡 |
| Thorns | 5 | 反弹伤害附带巨量击退，近战体验全无 |
| Quick Charge | 5 | 5 级已经秒射，255 纯属浪费 |

**大原则**：伤害/减伤/效率类放心拉满（一刀秒是神器的浪漫），击退/掉落/位移类务必克制。词条多才好玩，数值平衡得好才不会变成自虐模拟器。

---

## 4. 文本组件增强

### 1.21

```mcfunction
display:{Name:'{"text":"剑","color":"red","bold":true}'}
```

单引号包裹 JSON，转义地狱。

### 26.2

```mcfunction
minecraft:custom_name={text:"剑",color:"red",bold:true,obfuscated:true}
```

原生 JSON 对象，直接写。新增 `obfuscated` 属性让文字动态乱码（类似附魔台的符文效果），中文字符的 obfuscated 渲染终于不崩了——不过实际用起来字符闪得太快，盯着看两秒就眼花。想要可爱二次元风格，不如用 Unicode 装饰符号（✦ ❄ ♪ ✧ ★ ☆）搭配柔和配色，比疯狂闪烁耐看多了：`minecraft:custom_name={text:"✦ 神器之名 ✦",color:"light_purple",bold:true}`。

---

## 5. execute 命令的进化

execute 是 Minecraft 命令体系的脊梁骨——几乎所有高级机制都依赖它。1.21 的子命令链已经比老版的 `@e[name=xxx]` 清晰很多，但 26.2 又往前迈了一大步。

### 1.21 的 execute

```mcfunction
## 经典子命令链
execute as @a at @s if block ~ ~-1 ~ grass_block run say 我站在草地上

## 范围检测 + 效果施加
execute as @a at @s if entity @e[type=creeper,distance=..10] run effect give @s glowing 5

## 对齐坐标（常用于粒子/建筑）
execute positioned 0 64 0 align xyz run setblock ~ ~ ~ stone
```

五个核心子命令——`as`、`at`、`positioned`、`if`/`unless`、`run`——足以应对大部分场景，但遇到复杂需求时往往需要 summon 标记实体（marker）做跳板。

### 26.2 新增的子命令

```mcfunction
## 相机控制：电影级过场动画
execute as @a[tag=cinematic] at @s camera lerp 3s ease-in-out facing entity @e[type=warden,limit=1]

## 粒子直发：不再需要 summon area_effect_cloud
execute at @a[tag=charged] particle minecraft:electric_spark ~ ~1 ~ 2 2 2 0.1 100 force

## 维度检测 + 条件组合
execute if dimension minecraft:the_nether unless predicate safe_zone run damage @s 2 magic
```

| 新增子命令 | 作用 | 替代的 1.21 做法 |
|:--|:--|:--|
| `camera` | 控制玩家相机，支持 lerp/cut 过渡 | 需要资源包 + shader 配合 |
| `particle` | 在 execute 链中直发粒子 | summon area_effect_cloud + particle |
| `dimension` | 按所在维度筛选 | `if biome` + 坐标硬编码 |
| `facing` | 精确朝向实体/坐标（原版强化） | `rotated` 手动算角度 |

**最大的提升**：`particle` 和 `camera` 两个子命令让 execute 从一个「条件执行器」变成了一个完整的场景控制器。做地图时终于不用在命令方块和函数之间反复横跳了。

---

## 6. /item 与 /data：告别 NBT 的最后一步

物品组件系统（第 1 节）解决了 `/give` 的问题，但 `/item` 和 `/data` 才是日常操作中碰得最多的命令。26.2 对这两条命令的改造，才是 NBT 真正退出历史舞台的时刻。

### /item 命令：组件原生支持

1.21 的 `/item` 只负责「移动物品」，想修改物品属性？请走 `/data`：

```mcfunction
## 1.21：先给物品，再用 /data 改 NBT（分两步）
/item replace entity @p weapon.mainhand with netherite_sword
/data merge entity @p SelectedItem{tag:{Enchantments:[{id:"minecraft:sharpness",lvl:10}]}}
```

26.2 的 `/item` 一步到位：

```mcfunction
## 26.2：/item 直接支持组件
/item replace entity @p weapon.mainhand with netherite_sword[
  minecraft:enchantments={"minecraft:sharpness":10},
  minecraft:custom_name={text:"利刃","color":"red"}
]

## 原地修改物品组件：只修损坏的剑，不动完好的
/item modify entity @p weapon.mainhand[damage=0]
```

### /data 命令的落幕

1.21 时代 `/data` 是探索和修改实体 NBT 的唯一途径：

```
/data get entity @p              ## 读 NBT
/data merge entity @p {...}      ## 写 NBT
/data remove entity @p SomeTag   ## 删 NBT
```

26.2 中 `/data get` 仍然可用（调试时确实方便），但 `/data merge` 和 `/data remove` 已被组件命令取代：

| 1.21 操作 | 26.2 替代 |
|:--|:--|
| `data merge entity @s {Health:20f}` | `attribute @s minecraft:generic.max_health base set 20` |
| `data merge block ~ ~ ~ {Items:[...]}` | `item replace block ~ ~ ~ container.0 with ...` |
| `data remove entity @s Invulnerable` | `attribute @s minecraft:generic.invulnerable base set 0` |

核心原则：**属性归属性系统管，物品归物品系统管，不再用一个大 JSON 包揽一切。**

---

## 7. Display Entity：地图制作的可视化革命

Display Entity（`item_display`、`block_display`、`text_display`）在 1.19.4 首次引入，1.21 趋于成熟，26.2 成为地图作者的瑞士军刀。

### 三种 Display Entity 的 26.2 新能力

```mcfunction
## text_display：完整的 JSON 文本组件 + 背景渲染
summon minecraft:text_display ~ ~1 ~ {
  text: {text:"第 1 关",color:"gold",bold:true},
  background: 0x88000000,       ## 新增：半透明黑底
  alignment: "center",
  see_through: true
}

## block_display：任意方块预览 + 自定义光照
summon minecraft:block_display ~ ~ ~ {
  block_state: "minecraft:beacon",
  brightness: {sky: 15, block: 15},  ## 新增：独立光照控制（不受环境光影响）
  interpolation_duration: 5           ## 平滑过渡
}

## item_display：组件覆盖 + 动态动画
summon minecraft:item_display ~ ~ ~ {
  item: {
    id: "minecraft:diamond_sword",
    components: {
      "minecraft:custom_name": {text:"幻影之刃",color:"aqua",italic:false}
    }
  },
  item_display_transform: "thirdperson_left_hand"  ## 新增：精细变换模式
}
```

### 为什么 Display Entity 是革命性的

1.21 时代，想在世界上渲染一个浮动文字或展示物品，你需要：
- 盔甲架 + 命名牌（粗糙，有物理碰撞）
- 资源包修改 GUI 贴图（学习成本高）
- 大量粒子模拟（性能灾难）

26.2 的 Display Entity 把这一切浓缩成一条命令。**无碰撞、无视距限制、不占实体数量、纯客户端渲染**——地图制作的门槛从「你需要学 3 个月」降到「你会写命令就行」。

---

## 8. Macro：函数动态生成的终局

Minecraft 1.20.2 引入了函数宏（Function Macro），让数据包函数不再是「写死的指令列表」，而是可以**接受参数、动态展开**的模板。

### 1.21 的 Macro

```mcfunction
## 文件：give_tool.mcfunction
## $item=$(tool)  $enchant=$(ench)
give @p $(tool){Enchantments:[{id:"$(ench)",lvl:5}]}
```
```mcfunction
## 调用时传参
function give_tool {tool:"minecraft:netherite_sword", ench:"minecraft:sharpness"}
```

参数只能是 NBT 格式的字符串替换。局限性明显：无法传数组、无法做条件判断、类型检查靠祈祷。

### 26.2 的 Macro 增强

```mcfunction
## 文件：give_enchant_set.mcfunction
## $(weapon) 直接接受组件格式参数
## $(enchants) 接受 JSON 对象
$give @p minecraft:$(weapon)[minecraft:enchantments=$(enchants)]
```
```mcfunction
## 调用：传数组、传对象、传组件
function give_enchant_set {
  weapon: "netherite_sword",
  enchants: {"minecraft:sharpness":255,"minecraft:fire_aspect":255,"minecraft:looting":5}
}

## 26.2 新增：macro 内联（直接展开，不创建函数文件）
## 适合只有一两行、不值得单独建文件的小逻辑
!macro give @p $(item)[minecraft:custom_name=$(name)]
```

| 特性 | 1.21 | 26.2 |
|:--|:--|:--|
| 参数替换 | 字符串（`$(var)`） | 字符串 + JSON 对象（`$(var)`） |
| 数组参数 | ❌ | ✅ JSON 数组 |
| 内联 macro | ❌ 必须创建文件 | ✅ `!macro` 直接展开 |
| 类型校验 | 无 | 编译期错误提示 |
| 组件感知 | ❌ 需要手动拼 NBT | ✅ 原生组件对象传参 |

对于维护大型数据包的开发者来说，Macro 的进化意味着：**一个函数模板替代几十个重复的函数文件**。改了逻辑只需要改一处，而不是 `find-and-replace` 到手抽筋。

---

## 9. 新附魔一览（26.x）

| 附魔 | 效果 | 适用物品 |
|:--|:--|:--|
| `lunge` | 蓄力突刺，高速位移+伤害（建议 ≤5，过高会回弹） | 长矛 |
| `soul_speed` | 灵魂沙上加速（1.21 已有，上限提升至 3） | 靴子 |
| `depth_strider` | 水下加速（上限 255） | 靴子 |
| `aqua_affinity` | 水下挖掘加速（上限 255） | 头盔 |

---

## 10. 迁移指南：1.21 → 26.2

如果你有大量 1.21 的命令方块/数据包需要迁移，以下对照表能救你一命：

### 物品命名

```
旧: {display:{Name:'{"text":"xxx","color":"red"}'}}
新: [minecraft:custom_name={text:"xxx",color:"red"}]
```

### Lore

```
旧: {display:{Lore:['{"text":"xxx"}']}}
新: [minecraft:lore=[{text:"xxx"}]]
```

### 附魔

```
旧: {Enchantments:[{id:"minecraft:sharpness",lvl:10}]}
新: [minecraft:enchantments={"minecraft:sharpness":10}]
```

### 不可破坏

```
旧: {Unbreakable:1b}
新: [minecraft:unbreakable={}]
```

### /data merge → 组件命令

```
旧: /data merge entity @s {Health:20f,Invulnerable:1b}
新: /attribute @s minecraft:generic.max_health base set 20
```

### execute 粒子

```
旧: execute at @a positioned ~ ~1 ~ run summon area_effect_cloud ~ ~ ~ {Particle:"end_rod",Duration:1}
新: execute at @a particle minecraft:end_rod ~ ~1 ~ 0 0 0 0 1 force
```

### Macro 传参

```
旧: function equip {tool:"minecraft:netherite_sword"}
新: function equip {weapon:"netherite_sword", enchants:{"minecraft:sharpness":255}}
```

---

## 11. 26.2 神器套装（完整命令）

以下是我在 26.2 中使用的全套神器装备，直接复制到命令方块即可：

<details>
<summary>🪖 幽夜冠冕（头盔）</summary>

```mcfunction
/give @p netherite_helmet[minecraft:custom_name={text:"✦ 幽夜冠冕 ✦",color:"light_purple",bold:true}, minecraft:lore=[{text:"承载星尘的意志",color:"gold",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:respiration":5,"minecraft:aqua_affinity":5,"minecraft:thorns":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🛡️ 霜寒甲胄（胸甲）</summary>

```mcfunction
/give @p netherite_chestplate[minecraft:custom_name={text:"❄ 霜寒甲胄 ❄",color:"dark_aqua",bold:true}, minecraft:lore=[{text:"千年寒铁所铸",color:"aqua",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:thorns":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>👖 影舞胫甲（护腿）</summary>

```mcfunction
/give @p netherite_leggings[minecraft:custom_name={text:"◇ 影舞胫甲 ◇",color:"light_purple",bold:true}, minecraft:lore=[{text:"踏碎虚空的残影",color:"dark_purple",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:thorns":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>👢 流光飞靴（靴子）</summary>

```mcfunction
/give @p netherite_boots[minecraft:custom_name={text:"♪ 流光飞靴 ♪",color:"yellow",bold:true}, minecraft:lore=[{text:"步履所至皆为通途",color:"gold",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:thorns":5,"minecraft:depth_strider":5,"minecraft:soul_speed":3,"minecraft:feather_falling":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>⚔️ 断罪之刃（剑）</summary>

```mcfunction
/give @p netherite_sword[minecraft:custom_name={text:"「断罪之刃」",color:"dark_red",bold:true}, minecraft:lore=[{text:"裁决万物之罪",color:"red",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:sweeping_edge":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🪓 开天巨斧（斧）</summary>

```mcfunction
/give @p netherite_axe[minecraft:custom_name={text:"★ 开天巨斧 ★",color:"gold",bold:true}, minecraft:lore=[{text:"劈开混沌的第一道光",color:"orange",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🗡️ 贯穿星辰（长矛）</summary>

```mcfunction
/give @p netherite_spear[minecraft:custom_name={text:"✧ 贯穿星辰 ✧",color:"light_purple",bold:true}, minecraft:lore=[{text:"一击贯穿永恒",color:"dark_purple",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:lunge":5,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🔱 海神戟（三叉戟）</summary>

```mcfunction
/give @p trident[minecraft:custom_name={text:"〜 海神戟 〜",color:"dark_aqua",bold:true}, minecraft:lore=[{text:"号令四海之潮",color:"aqua",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:impaling":255,"minecraft:loyalty":5,"minecraft:riptide":5,"minecraft:channeling":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>⛏️ 地核穿梭者（镐）</summary>

```mcfunction
/give @p netherite_pickaxe[minecraft:custom_name={text:"◆ 地核穿梭者 ◆",color:"dark_gray",bold:true}, minecraft:lore=[{text:"深入大地的脉搏",color:"green",italic:false}], minecraft:enchantments={"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:sharpness":255,"minecraft:knockback":3,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🔧 移山者（铲）</summary>

```mcfunction
/give @p netherite_shovel[minecraft:custom_name={text:"☆ 移山者 ☆",color:"green",bold:true}, minecraft:lore=[{text:"一铲改变地貌",color:"dark_green",italic:false}], minecraft:enchantments={"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:sharpness":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🌱 生命之锄（锄头）</summary>

```mcfunction
/give @p netherite_hoe[minecraft:custom_name={text:"✿ 生命之锄 ✿",color:"dark_green",bold:true}, minecraft:lore=[{text:"唤醒沉睡的种子",color:"gold",italic:false}], minecraft:enchantments={"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:sharpness":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🏹 落日长弓（弓）</summary>

```mcfunction
/give @p bow[minecraft:custom_name={text:"☀ 落日长弓 ☀",color:"gold",bold:true}, minecraft:lore=[{text:"一箭落日，余晖尽散",color:"red",italic:false}], minecraft:enchantments={"minecraft:power":255,"minecraft:punch":3,"minecraft:flame":5,"minecraft:infinity":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🏹 千机连弩（弩）</summary>

```mcfunction
/give @p crossbow[minecraft:custom_name={text:"◈ 千机连弩 ◈",color:"aqua",bold:true}, minecraft:lore=[{text:"万箭齐发，无人可挡",color:"dark_aqua",italic:false}], minecraft:enchantments={"minecraft:quick_charge":5,"minecraft:multishot":255,"minecraft:piercing":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🛡️ 不灭之壁（盾牌）</summary>

```mcfunction
/give @p shield[minecraft:custom_name={text:"「不灭之壁」",color:"gray",bold:true}, minecraft:lore=[{text:"绝对防御的化身",color:"gold",italic:false}], minecraft:enchantments={"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🔨 天罚之锤（Mace）</summary>

```mcfunction
/give @p mace[minecraft:custom_name={text:"⚡ 天罚之锤 ⚡",color:"light_purple",bold:true}, minecraft:lore=[{text:"从天而降的审判",color:"gold",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

---

## 总结

从 1.21 到 26.2，Minecraft 的命令系统完成了一次脱胎换骨的重构：

- **语法**：从 NBT 大括号嵌套 → 组件方括号 + 命名空间
- **命令**：`execute` 新增 camera/particle/dimension 子命令，场景控制力飞跃
- **工具链**：`/item` 原生支持组件，`/data merge` 退役，一个命令搞定一切
- **武器**：Mace 强化 + 全新 Spear 长矛 + Lunge 附魔
- **附魔**：命令层面解除等级上限和互斥限制
- **文本**：原生 JSON 组件，`obfuscated` 中文不乱码
- **渲染**：Display Entity 让地图可视化从「需要资源包艺术」变成「会写命令就行」
- **开发**：Macro 函数支持对象传参和内联展开，模板化告别重复劳动

对于地图作者和数据包开发者来说，26.2 的组件系统是一次生产力的飞跃。对于生存玩家来说——这些满附魔神器反正也只能在创造模式玩，图一乐就好 😏

> "1.21 的命令是写给计算机看的，26.2 的命令是写给人看的。"
>
> ——某位迁移了 3000 行数据包的开发者
