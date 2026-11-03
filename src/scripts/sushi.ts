// 寿司郎计算器（/tools/sushi）的浏览器端逻辑。
//
// 与 `ncm.ts` 一样，绑定必须发生在 `initSushi()` 里而不是模块顶层：ClientRouter
// 每次导航都会换掉整页标记，但模块在一次会话里只求值一次。顶层绑定会让「离开
// 工具页再回来」变成页面看着正常、点什么都不响应。`data-bound` 是重入守卫，
// 因为 `astro:page-load` 在首屏也会触发一次。
//
// 地区数据直接从 `config/sushiro.ts` 导入（Astro 会把同一个模块打进客户端包），
// 价目表在构建期就已渲染好，所以关掉 JS 也看得到价格；这里只负责「数碟 → 账单」
// 的算术与交互。
import { formatMoney as money, regions, type SushiroRegion } from '../config/sushiro';

interface RegionState {
  /** 各价位的碟数，键是价位 id。 */
  plates: Record<string, number>;
  /** 各附加项目的份数。 */
  extras: Record<string, number>;
  /** 手动添加的一次性项目。 */
  custom: { id: number; name: string; amount: number }[];
  /** 当前税率档位（日本：店内 10% / 外带 8%）。 */
  taxMode: string;
  /** 当前店型价格带（仅日本）。 */
  band: string;
  /** 是否把服务费计入账单。 */
  serviceOn: boolean;
}

const createState = (region: SushiroRegion): RegionState => ({
  plates: Object.fromEntries(region.tiers.map((tier) => [tier.id, 0])),
  extras: Object.fromEntries(region.extras.map((item) => [item.id, 0])),
  custom: [],
  taxMode: region.tax.options[0].id,
  band: region.bands?.[0]?.id ?? '',
  serviceOn: Boolean(region.service),
});

const initSushi = () => {
  const root = document.querySelector<HTMLElement>('#sushi-root');
  if (!root) return;
  // 这份标记只有本路由会渲染，但 `astro:page-load` 每次导航都会触发，
  // 所以在别的页面走到这里必须安静地什么都不做。
  if (root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const regionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-region]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-panel]'));
  const regionName = root.querySelector<HTMLElement>('#sushi-region-name');
  const status = root.querySelector<HTMLElement>('#sushi-status');
  const copyButton = root.querySelector<HTMLButtonElement>('#sushi-copy');
  const resetButton = root.querySelector<HTMLButtonElement>('#sushi-reset');

  if (!regionButtons.length || !panels.length || !regionName || !status || !copyButton || !resetButton) return;

  const byId = new Map(panels.map((panel) => [panel.dataset.panel ?? '', panel]));
  const states = new Map(regions.map((region) => [region.id, createState(region)]));
  let activeId = regions[0].id;
  let people = 1;
  let customSeq = 0;
  let statusTimer = 0;

  const activeRegion = () => regions.find((region) => region.id === activeId) ?? regions[0];
  const stateOf = (region: SushiroRegion) => states.get(region.id) ?? createState(region);
  /** 没有明写服务费的地区（台湾 / 日本 / 韩国 / 大陆）按 10% 估算，由用户自己开关。 */
  const serviceRateOf = (region: SushiroRegion) => region.service?.rate ?? 0.1;
  const serviceLabelOf = (region: SushiroRegion) =>
    region.service?.label ?? `服務費 ${Math.round(serviceRateOf(region) * 100)}%`;

  const setStatus = (message: string, tone: 'ok' | 'error' = 'ok') => {
    status.textContent = message;
    status.dataset.tone = tone;
    window.clearTimeout(statusTimer);
    if (message) statusTimer = window.setTimeout(() => { status.textContent = ''; }, 2600);
  };

  /**
   * 账单算术：单盘价 →（店型偏移、税率换算）→ 小计 → 服务费 → 税。
   *
   * `included` 地区（全部五个）的菜单价已经含税，切换税率档位时要先把净价还原
   * 出来再乘新税率：日本外带 8% 与店内 10% 的差额就是这么算出来的
   * （120 円 税込 10% → 109 円 净价 → 118 円 税込 8%）。
   */
  const compute = (region: SushiroRegion, state: RegionState) => {
    const band = region.bands?.find((item) => item.id === state.band) ?? region.bands?.[0];
    const offset = band?.offset ?? 0;
    const option = region.tax.options.find((item) => item.id === state.taxMode) ?? region.tax.options[0];
    const factor = region.tax.mode === 'included' ? (1 + option.rate) / (1 + region.baseRate) : 1;

    const plateLines = region.tiers.map((tier) => {
      const count = state.plates[tier.id] ?? 0;
      const unit = (tier.price + offset) * factor;
      return { id: tier.id, label: tier.name, unit, count, amount: unit * count };
    });
    const extraLines = region.extras.map((item) => {
      const count = state.extras[item.id] ?? 0;
      const unit = (item.unit === 'person' ? item.price * people : item.price) * factor;
      return { id: item.id, label: item.name, unit, count, amount: unit * count };
    });
    const customLines = state.custom.map((item) => ({
      id: `custom-${item.id}`,
      label: item.name,
      unit: item.amount * factor,
      count: 1,
      amount: item.amount * factor,
    }));

    const sum = (lines: { amount: number }[]) => lines.reduce((total, line) => total + line.amount, 0);
    const plateTotal = sum(plateLines);
    const extraTotal = sum(extraLines);
    const customTotal = sum(customLines);
    const subtotal = plateTotal + extraTotal + customTotal;

    const serviceRate = state.serviceOn ? serviceRateOf(region) : 0;
    const service = subtotal * serviceRate;
    const taxable = subtotal + service;
    const tax = region.tax.mode === 'excluded' ? taxable * option.rate : taxable - taxable / (1 + option.rate);
    const total = region.tax.mode === 'excluded' ? taxable + tax : taxable;

    return {
      plateLines,
      extraLines,
      customLines,
      plateTotal,
      extraTotal,
      customTotal,
      subtotal,
      service,
      serviceRate,
      tax,
      total,
      option,
      offset,
      plates: plateLines.reduce((total, line) => total + line.count, 0),
    };
  };

  /** 把 state 回写成面板里的输入控件（切地区、重置、改档位时调用）。 */
  const syncPanel = (region: SushiroRegion, panel: HTMLElement) => {
    const state = stateOf(region);
    panel.querySelectorAll<HTMLInputElement>('input[data-tier]').forEach((input) => {
      input.value = String(state.plates[input.dataset.tier ?? ''] ?? 0);
    });
    panel.querySelectorAll<HTMLInputElement>('input[data-extra]').forEach((input) => {
      input.value = String(state.extras[input.dataset.extra ?? ''] ?? 0);
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-tax-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.taxMode === state.taxMode));
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-band]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.band === state.band));
    });
    const serviceToggle = panel.querySelector<HTMLInputElement>('[data-service-toggle]');
    if (serviceToggle) serviceToggle.checked = state.serviceOn;
  };

  const renderCustomList = (region: SushiroRegion, panel: HTMLElement) => {
    const state = stateOf(region);
    const list = panel.querySelector<HTMLElement>('[data-custom-list]');
    const empty = panel.querySelector<HTMLElement>('[data-custom-empty]');
    if (!list || !empty) return;
    list.replaceChildren();
    empty.hidden = state.custom.length > 0;
    state.custom.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'sushi-custom-row';
      const name = document.createElement('span');
      name.textContent = item.name;
      const amount = document.createElement('span');
      amount.className = 'sushi-extra-subtotal';
      amount.textContent = money(region, item.amount);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'sushi-icon-button';
      remove.setAttribute('aria-label', `删除 ${item.name}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        state.custom = state.custom.filter((entry) => entry.id !== item.id);
        renderCustomList(region, panel);
        renderRegion(region);
      });
      row.append(name, amount, remove);
      list.append(row);
    });
  };

  /** 重画一个地区：单价、行小计、步进器可用性、账单与徽章。 */
  const renderRegion = (region: SushiroRegion) => {
    const panel = byId.get(region.id);
    if (!panel) return;
    const state = stateOf(region);
    const result = compute(region, state);

    const lineOf = <T extends { id: string }>(lines: T[], id: string | undefined) =>
      lines.find((line) => line.id === id);

    panel.querySelectorAll<HTMLElement>('[data-tier-price]').forEach((cell) => {
      const line = result.plateLines.find((item) => item.id === cell.dataset.tierPrice);
      cell.textContent = `${money(region, line?.unit ?? 0)} / 碟`;
    });
    panel.querySelectorAll<HTMLElement>('[data-tier-subtotal]').forEach((cell) => {
      cell.textContent = money(region, lineOf(result.plateLines, cell.dataset.tierSubtotal)?.amount ?? 0);
    });
    panel.querySelectorAll<HTMLElement>('[data-extra-unit]').forEach((cell) => {
      const line = lineOf(result.extraLines, cell.dataset.extraUnit);
      const item = region.extras.find((entry) => entry.id === cell.dataset.extraUnit);
      cell.textContent = line && item
        ? `${money(region, line.unit)} / ${item.unit === 'person' ? '人' : '份'}`
        : money(region, 0);
    });
    panel.querySelectorAll<HTMLElement>('[data-extra-subtotal]').forEach((cell) => {
      cell.textContent = money(region, lineOf(result.extraLines, cell.dataset.extraSubtotal)?.amount ?? 0);
    });

    const markRows = (attribute: string, lines: { id: string; count: number }[]) => {
      panel.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((row) => {
        const line = lines.find((item) => item.id === row.getAttribute(attribute));
        row.dataset.active = line && line.count > 0 ? 'true' : 'false';
        row.querySelectorAll<HTMLButtonElement>('.sushi-stepper button').forEach((button) => {
          button.disabled = Number(button.dataset.step ?? 0) < 0 && (line?.count ?? 0) <= 0;
        });
      });
    };
    markRows('data-tier-row', result.plateLines);
    markRows('data-extra-row', result.extraLines);

    const write = (selector: string, value: string) => {
      const node = panel.querySelector<HTMLElement>(selector);
      if (node) node.textContent = value;
    };
    write('[data-bill-plates]', money(region, result.plateTotal));
    write('[data-bill-extras]', money(region, result.extraTotal));
    write('[data-bill-custom]', money(region, result.customTotal));
    write('[data-bill-subtotal]', money(region, result.subtotal));
    write('[data-bill-service]', money(region, result.service));
    write('[data-bill-service-rate]', result.serviceRate > 0 ? serviceLabelOf(region) : '');
    write('[data-bill-tax]', money(region, result.tax));
    write('[data-bill-tax-label]', region.tax.mode === 'excluded' ? result.option.label : `其中含${result.option.label}（估算）`);
    write('[data-bill-total]', money(region, result.total));
    write('[data-bill-people]', `${people} 人`);
    write('[data-bill-each]', money(region, result.total / people));
    write('[data-bill-plate-count]', `${result.plates} 碟`);
    write('[data-band-note]', region.bands?.find((item) => item.id === state.band)?.note ?? '');

    const toggle = (selector: string, visible: boolean) => {
      const node = panel.querySelector<HTMLElement>(selector);
      if (node) node.hidden = !visible;
    };
    toggle('[data-bill-extras-row]', result.extraTotal > 0);
    toggle('[data-bill-custom-row]', result.customTotal > 0);
    toggle('[data-bill-service-row]', result.service > 0);
    toggle('[data-bill-tax-row]', result.tax > 0);

    const badges = panel.querySelector<HTMLElement>('[data-bill-badges]');
    if (badges) {
      badges.replaceChildren();
      [...result.plateLines, ...result.extraLines]
        .filter((line) => line.count > 0)
        .forEach((line) => {
          const chip = document.createElement('span');
          chip.textContent = `${line.label} ×${line.count}`;
          badges.append(chip);
        });
      if (!badges.childElementCount) {
        const chip = document.createElement('span');
        chip.textContent = '还没有点任何东西';
        badges.append(chip);
      }
    }

    const peopleInput = root.querySelector<HTMLInputElement>('#sushi-people');
    if (peopleInput) peopleInput.value = String(people);
    regionName.textContent = `${region.flag} ${region.nativeName} · ${region.currency.code}`;
  };

  const renderActive = () => renderRegion(activeRegion());

  const selectRegion = (id: string) => {
    activeId = id;
    regionButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.region === id)));
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== id; });
    const region = activeRegion();
    const panel = byId.get(region.id);
    if (panel) {
      syncPanel(region, panel);
      renderCustomList(region, panel);
    }
    renderActive();
  };

  regionButtons.forEach((button) => {
    button.addEventListener('click', () => selectRegion(button.dataset.region ?? activeId));
  });

  panels.forEach((panel) => {
    const region = regions.find((item) => item.id === panel.dataset.panel);
    if (!region) return;
    const state = stateOf(region);

    const store = (input: HTMLInputElement, value: number) => {
      if (input.dataset.tier) state.plates[input.dataset.tier] = value;
      else if (input.dataset.extra) state.extras[input.dataset.extra] = value;
    };

    panel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;

      const stepButton = target?.closest<HTMLButtonElement>('[data-step]');
      if (stepButton) {
        const input = stepButton.closest<HTMLElement>('[data-row]')?.querySelector<HTMLInputElement>('input');
        if (!input) return;
        const next = Math.min(999, Math.max(0, Number(input.value || 0) + Number(stepButton.dataset.step ?? 0)));
        input.value = String(next);
        store(input, next);
        renderRegion(region);
        return;
      }

      const taxButton = target?.closest<HTMLButtonElement>('[data-tax-mode]');
      if (taxButton) {
        state.taxMode = taxButton.dataset.taxMode ?? state.taxMode;
        syncPanel(region, panel);
        renderRegion(region);
        return;
      }

      const bandButton = target?.closest<HTMLButtonElement>('[data-band]');
      if (bandButton) {
        state.band = bandButton.dataset.band ?? state.band;
        syncPanel(region, panel);
        renderRegion(region);
      }
    });

    // 输入过程中不回写（否则光标会被打断），只在 change 时把夹取后的值落回控件。
    panel.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input) return;
      if (input.id === 'sushi-people') {
        people = Math.min(99, Math.max(1, Math.round(Number(input.value || 1)) || 1));
        renderActive();
        return;
      }
      if (input.dataset.tier || input.dataset.extra) {
        store(input, Math.min(999, Math.max(0, Math.round(Number(input.value || 0)) || 0)));
        renderRegion(region);
        return;
      }
      if (input.hasAttribute('data-service-toggle')) {
        state.serviceOn = input.checked;
        renderRegion(region);
      }
    });

    panel.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input) return;
      if (input.dataset.tier || input.dataset.extra) {
        const value = Math.min(999, Math.max(0, Math.round(Number(input.value || 0)) || 0));
        store(input, value);
        input.value = String(value);
        renderRegion(region);
      } else if (input.id === 'sushi-people') {
        input.value = String(people);
      }
    });

    const form = panel.querySelector<HTMLFormElement>('[data-custom-form]');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]');
      const amountInput = form.querySelector<HTMLInputElement>('input[name="amount"]');
      const name = (nameInput?.value ?? '').trim() || '其他';
      const amount = Number(amountInput?.value ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus('请填写大于 0 的金额', 'error');
        return;
      }
      customSeq += 1;
      state.custom.push({ id: customSeq, name: name.slice(0, 24), amount });
      if (nameInput) nameInput.value = '';
      if (amountInput) amountInput.value = '';
      renderCustomList(region, panel);
      renderRegion(region);
      setStatus(`已添加「${name}」`);
    });
  });

  root.querySelector<HTMLElement>('#sushi-people-row')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-step-people]');
    if (!button) return;
    people = Math.min(99, Math.max(1, people + Number(button.dataset.stepPeople ?? 0)));
    renderActive();
  });

  copyButton.addEventListener('click', async () => {
    const region = activeRegion();
    const state = stateOf(region);
    const result = compute(region, state);
    const band = region.bands?.find((item) => item.id === state.band);
    const text = [
      `寿司郎计算器 · ${region.name}（${region.nativeName}）`,
      '———————————————',
      ...result.plateLines.filter((line) => line.count > 0).map((line) => `${line.label} ${money(region, line.unit)} × ${line.count} = ${money(region, line.amount)}`),
      ...result.extraLines.filter((line) => line.count > 0).map((line) => `${line.label} ${money(region, line.unit)} × ${line.count} = ${money(region, line.amount)}`),
      ...result.customLines.map((line) => `${line.label} = ${money(region, line.amount)}`),
      '———————————————',
      `小计 ${money(region, result.subtotal)}`,
      result.service > 0 ? `${serviceLabelOf(region)} ${money(region, result.service)}` : '',
      result.tax > 0 ? `${region.tax.mode === 'excluded' ? result.option.label : `其中含${result.option.label}`} ${money(region, result.tax)}` : '',
      `总计 ${money(region, result.total)}`,
      `共 ${result.plates} 碟 · ${people} 人 · 人均 ${money(region, result.total / people)}`,
      band && band.offset !== 0 ? `（按${band.name}价格带估算）` : '',
      '',
      `价格数据更新于 ${region.updated}，仅供参考。`,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setStatus('账单已复制到剪贴板');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      setStatus('账单已复制到剪贴板');
    }
  });

  resetButton.addEventListener('click', () => {
    const region = activeRegion();
    states.set(region.id, createState(region));
    people = 1;
    const panel = byId.get(region.id);
    if (panel) {
      syncPanel(region, panel);
      renderCustomList(region, panel);
    }
    renderRegion(region);
    setStatus('已清空当前地区');
  });

  selectRegion(activeId);
};

document.addEventListener('astro:page-load', initSushi);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSushi, { once: true });
else initSushi();
