---
title: 'Minecraft 26.2 与 1.21，从数据包到组件发生了什么'
description: '对比 Minecraft 26.2 与 1.21 的命令系统差异，包括组件系统、execute 进化、item 与 data 变迁、Display Entity、Macro 函数、新武器和附魔解禁。'
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
verifiedDate: 2026-07-27
difficulty: 进阶
audience: Minecraft 数据包与命令作者
---

## 前言

> 文章经由Deepseek V4.1 flash润色，很抱歉我的文笔并不好。

从 1.21 跳到 26.2，很多旧命令会直接失效。NBT 写法、附魔字段、item 和 data 的职责都变了，数据包作者如果照着旧教程迁移，通常会在第一条命令上撞墙。

下面按日常使用频率整理主要变化。命令示例保留原格式，方便直接复制测试。

---

## 1. 物品 NBT → 组件系统

### 1.21 时代的 NBT 标签

在 1.21 及更早版本中，给物品附加属性靠的是 NBT（Named Binary Tag）。

```text
/give @p netherite_sword{display:{Name:'{"text":"断罪之刃","color":"dark_red"}'},Enchantments:[{id:"minecraft:sharpness",lvl:255}]}
```

大括号一层套一层，名称里面还要再包一段 JSON。写一把带名字和附魔的剑，少一个引号就要重新找。

### 26.2 的组件系统

26.x 把物品属性改成组件格式。每一类属性有名字，值单独写在后面。

```text
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
| --- | --- | --- |
| 语法风格 | `{...}` 嵌套 | `[...]` 方括号 + 命名空间 |
| 名称设置 | `display:{Name:'...'}` | `minecraft:custom_name={...}` |
| 描述 Lore | `display:{Lore:[...]}` | `minecraft:lore=[...]` |
| 附魔 | `Enchantments:[{id:"...",lvl:n}]` | `minecraft:enchantments={"...":n}` |
| 不可破坏 | `Unbreakable:1b` | `minecraft:unbreakable={}` |
| 可读性 | 反人类 | 一目了然 |
| 错误提示 | 不存在的，自己找 | 精确到组件级别 |

组件使用命名空间区分来源，结构和 JSON 更接近。名称、描述、附魔各占一项，出错时也更容易定位到具体组件。

---

## 2. Mace 重锤与 Spear 长矛

### Mace · 天罚之锤

1.21 加入了 Mace 重锤，最初主要来自试炼密室。26.2 扩展了它的附魔池，也让获取方式多了一条合成路线。

```text
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
| --- | --- | --- |
| 获取方式 | 试炼密室专属 | 合成 + 试炼密室 |
| 附魔上限 | 标准上限（V） | 255（与鞘翅同款待遇） |
| Smite 兼容 | ❌ | ✅ |
| 下落伤害加成 | 有上限 | 无上限（只要你敢跳） |

### Spear · 贯穿星辰

长矛是 26.x 新增的武器，定位介于剑和三叉戟之间。

```text
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

- Lunge 是 26.x 新增附魔，类似 1.21 三叉戟的激流，但不需要水域。Lunge 等级过高会产生回弹，5 级通常比较流畅。
- 伤害介于剑和斧之间，攻击距离 +1 格
- 不可投掷（投掷是三叉戟的专属）

---

## 3. 附魔系统变化

### 附魔上限解禁

1.21 中，大多数附魔上限是 V。26.2 在 `/give` 命令层面取消了这些限制。

```text
// 26.2：这是合法的
"minecraft:sharpness":255,
"minecraft:protection":255,
"minecraft:efficiency":255
```

生存模式中的铁砧仍然受原版上限约束，255 级只在命令和数据包层面有效。

### 冲突附魔共存

1.21 不允许 Sharpness、Smite 和 Bane of Arthropods 共存。26.2 在命令层面解除了互斥。

```text
/give @p netherite_sword[
  minecraft:enchantments={
    "minecraft:sharpness":255,
    "minecraft:smite":255,
    "minecraft:bane_of_arthropods":255
  }
]
```

一把剑同时克制所有生物类型。创造模式玩家的终极玩具。

### 合理数值建议

命令可以写 255，体验未必更好。掉落、击退和位移类附魔堆高以后，游戏会迅速失去平衡。

| 附魔 | 推荐值 | 255 会发生什么 |
| --- | --- | --- |
| Fortune / Looting | 5 | 掉落物铺满屏幕，捡到背包爆炸 |
| Knockback / Punch | 3 | 一拳把怪物打到未加载区块，尸体都找不到 |
| Lunge | 5 | 回弹比突刺还远，自己飞出去 |
| Riptide | 5 | 从海底直冲天际，落地即死亡 |
| Thorns | 5 | 反弹伤害附带巨量击退，近战体验全无 |
| Quick Charge | 5 | 5 级已经秒射，255 纯属浪费 |

伤害、减伤和效率类可以按需要提高。击退、掉落和位移类最好停在正常范围。神器需要的是词条配合，不必把所有数字都塞满。

---

## 4. 文本组件增强

### 1.21

```text
display:{Name:'{"text":"剑","color":"red","bold":true}'}
```

名称要被单引号包住，里面的 JSON 还要处理转义。

### 26.2

```text
minecraft:custom_name={text:"剑",color:"red",bold:true,obfuscated:true}
```

26.2 直接使用 JSON 对象。新增的 `obfuscated` 属性可以制作动态乱码，中文字符也能正常渲染。字符闪烁很快，长时间观看并不舒服。需要装饰时，Unicode 符号配合柔和颜色更稳定。

---

## 5. execute 命令的进化

execute 负责组合条件、目标和执行位置，几乎所有高级机制都会用到。1.21 的子命令链已经比单独堆选择器清晰，26.2 又加入了相机、粒子和维度控制。

### 1.21 的 execute

```text
## 经典子命令链
execute as @a at @s if block ~ ~-1 ~ grass_block run say 我站在草地上

## 范围检测 + 效果施加
execute as @a at @s if entity @e[type=creeper,distance=..10] run effect give @s glowing 5

## 对齐坐标（常用于粒子/建筑）
execute positioned 0 64 0 align xyz run setblock ~ ~ ~ stone
```

`as`、`at`、`positioned`、`if` 或 `unless` 与 `run` 能处理大部分场景。需要临时坐标或状态时，仍然经常会 summon 一个 marker。

### 26.2 新增的子命令

```text
## 相机控制
execute as @a[tag=cinematic] at @s camera lerp 3s ease-in-out facing entity @e[type=warden,limit=1]

## 粒子直发
execute at @a[tag=charged] particle minecraft:electric_spark ~ ~1 ~ 2 2 2 0.1 100 force

## 维度检测 + 条件组合
execute if dimension minecraft:the_nether unless predicate safe_zone run damage @s 2 magic
```

| 新增子命令 | 作用 | 替代的 1.21 做法 |
| --- | --- | --- |
| `camera` | 控制玩家相机，支持 lerp/cut 过渡 | 需要资源包 + shader 配合 |
| `particle` | 在 execute 链中直发粒子 | summon area_effect_cloud + particle |
| `dimension` | 按所在维度筛选 | `if biome` + 坐标硬编码 |
| `facing` | 精确朝向实体/坐标（原版强化） | `rotated` 手动算角度 |

`particle` 和 `camera` 让 execute 可以直接控制场景。制作地图时，少了一层命令方块和函数之间的转发。

---

## 6. /item 与 /data 的变化

组件解决了 `/give` 属性怎么写的问题，`/item` 和 `/data` 则影响日常修改。26.2 把物品修改收回物品系统，把生命值、无敌状态一类数据交给属性系统。

### /item 命令原生支持组件

1.21 的 `/item` 主要负责替换物品，属性修改需要再调用 `/data`。

```text
## 1.21：先给物品，再用 /data 改 NBT（分两步）
/item replace entity @p weapon.mainhand with netherite_sword
/data merge entity @p SelectedItem{tag:{Enchantments:[{id:"minecraft:sharpness",lvl:10}]}}
```

26.2 的 `/item` 可以直接带组件。

```text
## 26.2：/item 直接支持组件
/item replace entity @p weapon.mainhand with netherite_sword[
  minecraft:enchantments={"minecraft:sharpness":10},
  minecraft:custom_name={text:"利刃","color":"red"}
]

## 原地修改物品组件：只修损坏的剑，不动完好的
/item modify entity @p weapon.mainhand[damage=0]
```

### /data 命令的落幕

1.21 里，`/data` 是查看和修改实体 NBT 的主要入口。

```
/data get entity @p              ## 读 NBT
/data merge entity @p {...}      ## 写 NBT
/data remove entity @p SomeTag   ## 删 NBT
```

26.2 中 `/data get` 仍然可用，调试实体数据时很方便。`/data merge` 和 `/data remove` 已经被组件与属性命令取代。

| 1.21 操作 | 26.2 替代 |
| --- | --- |
| `data merge entity @s {Health:20f}` | `attribute @s minecraft:generic.max_health base set 20` |
| `data merge block ~ ~ ~ {Items:[...]}` | `item replace block ~ ~ ~ container.0 with ...` |
| `data remove entity @s Invulnerable` | `attribute @s minecraft:generic.invulnerable base set 0` |

现在属性归属性系统，物品归物品系统，容器也有对应命令。这个变化会让迁移时的命令拆得更散，也更容易查出错误。

---

## 7. Display Entity 的变化

Display Entity 包括 `item_display`、`block_display` 和 `text_display`。它在 1.19.4 加入，1.21 逐渐稳定，26.2 又补齐了光照、背景和变换。

### 三种 Display Entity 的 26.2 新能力

```text
## text_display
summon minecraft:text_display ~ ~1 ~ {
  text: {text:"第 1 关",color:"gold",bold:true},
  background: 0x88000000,       ## 新增：半透明黑底
  alignment: "center",
  see_through: true
}

## block_display
summon minecraft:block_display ~ ~ ~ {
  block_state: "minecraft:beacon",
  brightness: {sky: 15, block: 15},  ## 新增：独立光照控制（不受环境光影响）
  interpolation_duration: 5           ## 平滑过渡
}

## item_display
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

1.21 想在世界上显示浮动文字或者物品，常见办法有下面这些。
- 盔甲架 + 命名牌（粗糙，有物理碰撞）
- 资源包修改 GUI 贴图（学习成本高）
- 大量粒子模拟（性能灾难）

Display Entity 不参与碰撞，也可以在客户端完成渲染。地图作者仍然要学习变换、插值和文本组件，但不用再绕资源包和粒子系统。

---

## 8. Macro 函数模板增强

1.20.2 引入函数宏以后，数据包函数可以接受参数并动态展开。26.2 继续允许对象、数组和内联宏。

### 1.21 的 Macro

```text
## 文件：give_tool.mcfunction
## $item=$(tool)  $enchant=$(ench)
give @p $(tool){Enchantments:[{id:"$(ench)",lvl:5}]}
```
```text
## 调用时传参
function give_tool {tool:"minecraft:netherite_sword", ench:"minecraft:sharpness"}
```

旧宏主要做字符串替换，无法直接传数组，也没有真正的类型检查。

### 26.2 的 Macro 增强

```text
## 文件：give_enchant_set.mcfunction
## $(weapon) 直接接受组件格式参数
## $(enchants) 接受 JSON 对象
$give @p minecraft:$(weapon)[minecraft:enchantments=$(enchants)]
```
```text
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
| --- | --- | --- |
| 参数替换 | 字符串（`$(var)`） | 字符串 + JSON 对象（`$(var)`） |
| 数组参数 | ❌ | ✅ JSON 数组 |
| 内联 macro | ❌ 必须创建文件 | ✅ `!macro` 直接展开 |
| 类型校验 | 无 | 编译期错误提示 |
| 组件感知 | ❌ 需要手动拼 NBT | ✅ 原生组件对象传参 |

大型数据包里，宏可以减少重复函数。逻辑改动集中在一处，不再依靠全项目替换。

---

## 9. 新附魔一览（26.x）

| 附魔 | 效果 | 适用物品 |
| --- | --- | --- |
| `lunge` | 蓄力突刺，高速位移+伤害（建议 ≤5，过高会回弹） | 长矛 |
| `soul_speed` | 灵魂沙上加速（1.21 已有，上限提升至 3） | 靴子 |
| `depth_strider` | 水下加速（上限 255） | 靴子 |
| `aqua_affinity` | 水下挖掘加速（上限 255） | 头盔 |

---

## 10. 从 1.21 迁移到 26.2

下面的对照表覆盖最常见的迁移项。

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

下面是一套 26.2 命令生成的神器装备，可以直接复制到命令方块。

<details>
<summary>🪖 幽夜冠冕（头盔）</summary>

```text
/give @p netherite_helmet[minecraft:custom_name={text:"✦ 幽夜冠冕 ✦",color:"light_purple",bold:true}, minecraft:lore=[{text:"承载星尘的意志",color:"gold",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:respiration":255,"minecraft:aqua_affinity":255,"minecraft:thorns":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🛡️ 霜寒甲胄（胸甲）</summary>

```text
/give @p netherite_chestplate[minecraft:custom_name={text:"❄ 霜寒甲胄 ❄",color:"dark_aqua",bold:true}, minecraft:lore=[{text:"千年寒铁所铸",color:"aqua",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:thorns":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>👖 影舞胫甲（护腿）</summary>

```text
/give @p netherite_leggings[minecraft:custom_name={text:"◇ 影舞胫甲 ◇",color:"light_purple",bold:true}, minecraft:lore=[{text:"踏碎虚空的残影",color:"dark_purple",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:thorns":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>👢 流光飞靴（靴子）</summary>

```text
/give @p netherite_boots[minecraft:custom_name={text:"♪ 流光飞靴 ♪",color:"yellow",bold:true}, minecraft:lore=[{text:"步履所至皆为通途",color:"gold",italic:false}], minecraft:enchantments={"minecraft:protection":255,"minecraft:blast_protection":255,"minecraft:fire_protection":255,"minecraft:projectile_protection":255,"minecraft:thorns":5,"minecraft:depth_strider":255,"minecraft:soul_speed":3,"minecraft:feather_falling":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>⚔️ 断罪之刃（剑）</summary>

```text
/give @p netherite_sword[minecraft:custom_name={text:"「断罪之刃」",color:"dark_red",bold:true}, minecraft:lore=[{text:"裁决万物之罪",color:"red",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:sweeping_edge":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🪓 开天巨斧（斧）</summary>

```text
/give @p netherite_axe[minecraft:custom_name={text:"★ 开天巨斧 ★",color:"gold",bold:true}, minecraft:lore=[{text:"劈开混沌的第一道光",color:"orange",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🗡️ 贯穿星辰（长矛）</summary>

```text
/give @p netherite_spear[minecraft:custom_name={text:"✧ 贯穿星辰 ✧",color:"light_purple",bold:true}, minecraft:lore=[{text:"一击贯穿永恒",color:"dark_purple",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:lunge":5,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🔱 海神戟（三叉戟）</summary>

```text
/give @p trident[minecraft:custom_name={text:"〜 海神戟 〜",color:"dark_aqua",bold:true}, minecraft:lore=[{text:"号令四海之潮",color:"aqua",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:impaling":255,"minecraft:loyalty":5,"minecraft:riptide":5,"minecraft:channeling":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>⛏️ 地核穿梭者（镐）</summary>

```text
/give @p netherite_pickaxe[minecraft:custom_name={text:"◆ 地核穿梭者 ◆",color:"dark_gray",bold:true}, minecraft:lore=[{text:"深入大地的脉搏",color:"green",italic:false}], minecraft:enchantments={"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:sharpness":255,"minecraft:knockback":3,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🔧 移山者（铲）</summary>

```text
/give @p netherite_shovel[minecraft:custom_name={text:"☆ 移山者 ☆",color:"green",bold:true}, minecraft:lore=[{text:"一铲改变地貌",color:"dark_green",italic:false}], minecraft:enchantments={"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:sharpness":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🌱 生命之锄（锄头）</summary>

```text
/give @p netherite_hoe[minecraft:custom_name={text:"✿ 生命之锄 ✿",color:"dark_green",bold:true}, minecraft:lore=[{text:"唤醒沉睡的种子",color:"gold",italic:false}], minecraft:enchantments={"minecraft:efficiency":255,"minecraft:fortune":5,"minecraft:sharpness":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🏹 落日长弓（弓）</summary>

```text
/give @p bow[minecraft:custom_name={text:"☀ 落日长弓 ☀",color:"gold",bold:true}, minecraft:lore=[{text:"一箭落日，余晖尽散",color:"red",italic:false}], minecraft:enchantments={"minecraft:power":255,"minecraft:punch":3,"minecraft:flame":5,"minecraft:infinity":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🏹 千机连弩（弩）</summary>

```text
/give @p crossbow[minecraft:custom_name={text:"◈ 千机连弩 ◈",color:"aqua",bold:true}, minecraft:lore=[{text:"万箭齐发，无人可挡",color:"dark_aqua",italic:false}], minecraft:enchantments={"minecraft:quick_charge":5,"minecraft:multishot":255,"minecraft:piercing":255,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🛡️ 不灭之壁（盾牌）</summary>

```text
/give @p shield[minecraft:custom_name={text:"「不灭之壁」",color:"gray",bold:true}, minecraft:lore=[{text:"绝对防御的化身",color:"gold",italic:false}], minecraft:enchantments={"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

<details>
<summary>🔨 天罚之锤（Mace）</summary>

```text
/give @p mace[minecraft:custom_name={text:"⚡ 天罚之锤 ⚡",color:"light_purple",bold:true}, minecraft:lore=[{text:"从天而降的审判",color:"gold",italic:false}], minecraft:enchantments={"minecraft:sharpness":255,"minecraft:smite":255,"minecraft:bane_of_arthropods":255,"minecraft:knockback":3,"minecraft:fire_aspect":5,"minecraft:looting":5,"minecraft:unbreaking":255,"minecraft:mending":255}, minecraft:unbreakable={}]
```
</details>

---

## 总结

从 1.21 到 26.2，命令系统变化最大的地方在于数据和物品不再共用一套大 NBT。组件负责物品，属性负责实体数值，Display Entity 和 Macro 则补上了地图展示与模板复用。

迁移旧数据包时，先处理名称、描述和附魔，再检查 `/data merge` 与所有旧 NBT 选择器。命令能解析以后，再调整数值。满附魔装备只适合创造模式测试，不要把这种数值直接带进生存存档。

如果有人还在说 1.21 的数据包可以原样运行，让他先检查一次 `pack_format` 和 `/give`。
