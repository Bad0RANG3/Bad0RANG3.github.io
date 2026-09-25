// Site search. Loaded on demand by bootstrap.ts the first time a visitor opens
// search, so the controller stays out of every page's HTML and is cached like
// any other bundle. The dialog markup lives in SearchModal.astro and is
// replaced on each ClientRouter navigation; the fetched index lives here at
// module scope, so it is downloaded at most once per visit.
import { LAYOUT } from '../config/ui';
import type { SearchDocument } from '../lib/search';

interface IndexedDocument extends SearchDocument {
  searchText: string;
  titleText: string;
  tagText: string;
  descriptionText: string;
}

interface SearchUi {
  modal: HTMLDialogElement;
  input: HTMLInputElement;
  results: HTMLElement;
  footer: HTMLElement;
  filters: HTMLElement | null;
}

const TYPE_LABELS: Record<string, string> = { all: '全部', post: '文章', thought: '碎碎念', project: '项目', tool: '工具' };
const MESSAGE_CLASS = 'px-4 py-8 text-center text-sm text-base-content/50';

let documents: IndexedDocument[] = [];
let loadPromise: Promise<void> | null = null;
let activeType = 'all';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokens = (query: string) => query.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 8);
const message = (html: string) => `<div class="${MESSAGE_CLASS}">${html}</div>`;

// Highlight in ONE pass over the raw text. Replacing token-by-token on
// already-rendered HTML lets a later token match the <mark> markup (a query
// like "class" or "primary" corrupts the result), so only the gaps and the
// matches are escaped and the markup is never re-scanned.
const highlight = (value: unknown, queryTokens: string[]) => {
  const text = String(value ?? '');
  const patterns = queryTokens.map(escapeRegExp).sort((a, b) => b.length - a.length);
  if (!patterns.length) return escapeHtml(text);
  const matcher = new RegExp(patterns.join('|'), 'gi');
  let html = '';
  let cursor = 0;
  for (const match of text.matchAll(matcher)) {
    const index = match.index ?? 0;
    html += `${escapeHtml(text.slice(cursor, index))}<mark class="rounded bg-primary/20 px-0.5 text-inherit">${escapeHtml(match[0])}</mark>`;
    cursor = index + match[0].length;
  }
  return html + escapeHtml(text.slice(cursor));
};

// Lower-cased haystacks are built once when the index loads, not per
// keystroke × token × document.
const prepare = (item: SearchDocument): IndexedDocument => ({
  ...item,
  searchText: [item.title, item.description, item.body, ...(item.tags || []), item.category, item.series].filter(Boolean).join(' ').toLowerCase(),
  titleText: String(item.title || '').toLowerCase(),
  tagText: (item.tags || []).join(' ').toLowerCase(),
  descriptionText: String(item.description || '').toLowerCase(),
});

const score = (item: IndexedDocument, queryTokens: string[]) => queryTokens.reduce((total, token) => total
  + (item.titleText.includes(token) ? 20 : 0)
  + (item.tagText.includes(token) ? 12 : 0)
  + (item.descriptionText.includes(token) ? 8 : 0)
  + (item.searchText.includes(token) ? 2 : 0), item.featured ? 3 : 0);

const excerpt = (item: IndexedDocument, queryTokens: string[]) => {
  const body = item.body || item.description || '';
  const token = queryTokens[0];
  if (!token) return item.description;
  const index = body.toLowerCase().indexOf(token);
  if (index < 0) return item.description;
  const start = Math.max(0, index - 55);
  return `${start > 0 ? '…' : ''}${body.slice(start, index + 130)}${index + 130 < body.length ? '…' : ''}`;
};

const getUi = (): SearchUi | null => {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const footer = document.getElementById('search-footer');
  if (!(modal instanceof HTMLDialogElement) || !(input instanceof HTMLInputElement) || !results || !footer) return null;
  return { modal, input, results, footer, filters: document.getElementById('search-filters') };
};

const renderFilters = ({ filters }: SearchUi) => {
  if (!filters) return;
  const types = [...new Set(documents.map((item) => item.type).filter(Boolean))];
  filters.hidden = types.length < 2;
  if (filters.hidden) return;
  filters.innerHTML = ['all', ...types].map((type) => `<button type="button" data-search-type="${escapeHtml(type)}" aria-pressed="${activeType === type}" class="chip-signal">${escapeHtml(TYPE_LABELS[type] ?? type)}</button>`).join('');
};

const render = (ui: SearchUi) => {
  const query = ui.input.value;
  const queryTokens = tokens(query);
  let items = documents.filter((item) => activeType === 'all' || item.type === activeType);
  if (queryTokens.length) {
    items = items
      .filter((item) => queryTokens.every((token) => item.searchText.includes(token)))
      .sort((a, b) => score(b, queryTokens) - score(a, queryTokens) || b.date.localeCompare(a.date));
  } else {
    items = items.slice(0, LAYOUT.SEARCH_DEFAULT_COUNT);
  }
  if (!items.length) {
    ui.results.innerHTML = message('没有找到匹配内容。试试标题、标签或正文里的其他关键词。');
    ui.footer.classList.add('hidden');
    return;
  }
  ui.results.innerHTML = items.map((item) => `<a href="${escapeHtml(item.url)}" class="block border-b border-base-content/5 px-4 py-3 transition-colors last:border-0 hover:bg-base-200 focus:bg-base-200 focus:outline-none">
    <div class="flex items-start justify-between gap-3"><span class="text-sm font-bold text-base-content">${highlight(item.title, queryTokens)}</span>${item.date ? `<time class="shrink-0 text-xs text-base-content/40" datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>` : `<span class="shrink-0 text-xs text-base-content/40">${escapeHtml(TYPE_LABELS[item.type] ?? '')}</span>`}</div>
    <p class="mt-1 line-clamp-2 text-xs leading-5 text-base-content/55">${highlight(excerpt(item, queryTokens), queryTokens)}</p>
    <div class="mt-2 flex flex-wrap gap-1.5">${(item.tags || []).slice(0, 4).map((tag) => `<span class="badge badge-ghost badge-xs">#${escapeHtml(tag)}</span>`).join('')}</div>
  </a>`).join('');
  ui.footer.classList.remove('hidden');
  ui.footer.textContent = `${items.length} 个结果${queryTokens.length ? '' : ' · 输入关键词搜索全文'}`;
};

// One in-flight request shared by every open(); a failed load clears it so
// the next open retries.
const load = (ui: SearchUi) => {
  if (documents.length) return Promise.resolve();
  if (loadPromise) return loadPromise;
  ui.results.innerHTML = message('正在加载搜索索引...');
  loadPromise = (async () => {
    try {
      const response = await fetch(ui.modal.dataset.indexUrl || '', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      documents = Array.isArray(payload) ? payload.map(prepare) : [];
      if (!documents.length) ui.results.innerHTML = message('搜索索引是空的。');
    } catch {
      ui.results.innerHTML = message(`搜索索引加载失败，请直接浏览<a class="ml-1 font-bold text-primary underline" href="${escapeHtml(ui.modal.dataset.postsUrl || '')}">文章列表</a>。`);
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
};

// Each navigation brings a fresh dialog, so listeners are bound per element.
const bind = (ui: SearchUi) => {
  if (ui.modal.dataset.bound === '1') return;
  ui.modal.dataset.bound = '1';
  ui.input.addEventListener('input', () => {
    if (documents.length) render(ui);
  });
  ui.filters?.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-search-type]') : null;
    if (!button) return;
    activeType = button.dataset.searchType || 'all';
    renderFilters(ui);
    render(ui);
  });
};

export const openSearch = () => {
  const ui = getUi();
  if (!ui) return;
  bind(ui);
  if (!ui.modal.open) ui.modal.showModal();
  ui.input.value = '';
  activeType = 'all';
  // Only render once the index is in memory; until then load() owns the
  // results pane, and its failure message must not be replaced by "no match".
  void load(ui).then(() => {
    if (!documents.length) return;
    renderFilters(ui);
    render(ui);
  });
  window.setTimeout(() => ui.input.focus(), LAYOUT.SEARCH_FOCUS_DELAY);
};
