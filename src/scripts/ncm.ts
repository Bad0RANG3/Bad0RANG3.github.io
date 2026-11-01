// NCM 解密工具页的浏览器端逻辑。
//
// 逻辑放在这里而不是写在 `ncm.astro` 的 `<script>` 里，理由和 `ARCHITECTURE.md`
// §2 一致：页面只保留一个导入入口，逻辑由 Astro 打包成可缓存模块。
//
// 绑定必须发生在 `initNcm()` 里，而不是模块顶层。ClientRouter 每次导航都会换掉
// 整页标记，但模块本身在一次会话里只求值一次——所以"离开工具页再回来"时顶层
// 代码不会再跑，新的标记上一个监听都没有，拖放区和「开始解密」会全部失效
// （表现为页面看起来正常、点什么都不响应）。`astro:page-load` 才是重新绑定的
// 时机，`data-bound` 保证同一次绑定不会被重复执行两次。
import { dump } from 'ncmdump-js';

const initNcm = () => {
  const fileInput = document.querySelector<HTMLInputElement>('#ncm-file-input');
  const dropzone = document.querySelector<HTMLLabelElement>('#ncm-dropzone');
  const pending = document.querySelector<HTMLElement>('#ncm-pending');
  const pendingList = document.querySelector<HTMLUListElement>('#ncm-pending-list');
  const clearButton = document.querySelector<HTMLButtonElement>('#ncm-clear');
  const convertButton = document.querySelector<HTMLButtonElement>('#ncm-convert');
  const fixMetadata = document.querySelector<HTMLInputElement>('#ncm-fix-metadata');
  const status = document.querySelector<HTMLElement>('#ncm-status');
  const results = document.querySelector<HTMLElement>('#ncm-results');
  const emptyResults = document.querySelector<HTMLElement>('#ncm-empty-results');
  const clearResultsButton = document.querySelector<HTMLButtonElement>('#ncm-clear-results');
  const downloadAllButton = document.querySelector<HTMLButtonElement>('#ncm-download-all');

  // The tool is the only route that renders this markup, but `astro:page-load`
  // fires on every navigation, so leaving the page and moving on has to be a
  // quiet no-op rather than an error.
  if (!fileInput || !dropzone || !pending || !pendingList || !clearButton || !convertButton || !fixMetadata || !status || !results || !emptyResults || !clearResultsButton || !downloadAllButton) return;
  if (fileInput.dataset.bound === '1') return;
  fileInput.dataset.bound = '1';

  const files: File[] = [];
  const resultUrls: string[] = [];

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const isNcm = (file: File) => file.name.toLowerCase().endsWith('.ncm');

  const setStatus = (message: string, tone: 'info' | 'success' | 'warning' | 'loading' = 'info') => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const renderPending = () => {
    pendingList.replaceChildren();
    pending.hidden = files.length === 0;
    convertButton.disabled = files.length === 0;
    if (files.length === 0) {
      setStatus('等待添加文件');
      return;
    }

    files.forEach((file, index) => {
      const item = document.createElement('li');
      item.className = 'ncm-file-item';
      const name = document.createElement('span');
      name.className = 'ncm-file-name';
      name.textContent = file.name;
      const size = document.createElement('span');
      size.className = 'ncm-file-size';
      size.textContent = formatBytes(file.size);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ncm-remove-button';
      remove.textContent = '移除';
      remove.addEventListener('click', () => {
        files.splice(index, 1);
        renderPending();
      });
      item.append(name, size, remove);
      pendingList.append(item);
    });
    setStatus(`已添加 ${files.length} 个文件`);
  };

  const addFiles = (incoming: File[]) => {
    const accepted = incoming.filter(isNcm);
    const duplicates = accepted.filter((file) => files.some((current) => current.name === file.name && current.size === file.size));
    files.push(...accepted.filter((file) => !duplicates.includes(file)));
    if (incoming.length !== accepted.length) setStatus('已忽略非 .ncm 文件', 'warning');
    renderPending();
  };

  let downloadAllTimer = 0;
  const stopDownloadAll = () => {
    if (downloadAllTimer) {
      window.clearTimeout(downloadAllTimer);
      downloadAllTimer = 0;
    }
    downloadAllButton.disabled = false;
    downloadAllButton.textContent = '下载全部';
  };

  const clearResults = () => {
    stopDownloadAll();
    resultUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    results.replaceChildren(emptyResults);
    emptyResults.hidden = false;
    clearResultsButton.hidden = true;
    downloadAllButton.hidden = true;
  };

  const addResult = ({ file, output, url }: { file: File; output: Awaited<ReturnType<typeof dump>>; url: string }) => {
    emptyResults.hidden = true;
    clearResultsButton.hidden = false;
    downloadAllButton.hidden = false;

    const item = document.createElement('article');
    item.className = 'ncm-result-item';
    const meta = document.createElement('div');
    meta.className = 'ncm-result-meta';
    const title = document.createElement('h3');
    title.textContent = output.filename;
    const detail = document.createElement('p');
    detail.textContent = `${file.name} · ${output.format.toUpperCase()} · ${formatBytes(output.blob.size)}`;
    meta.append(title, detail);

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = url;

    const download = document.createElement('a');
    download.className = 'ncm-download-button';
    download.href = url;
    download.download = output.filename;
    download.textContent = '下载';

    item.append(meta, audio, download);
    results.append(item);
  };

  const addError = (file: File, message: string) => {
    const item = document.createElement('article');
    item.className = 'ncm-result-item ncm-result-error';
    const meta = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `${file.name} 解密失败`;
    const detail = document.createElement('p');
    detail.textContent = message;
    meta.append(title, detail);
    item.append(meta);
    emptyResults.hidden = true;
    clearResultsButton.hidden = false;
    results.append(item);
  };

  const convert = async () => {
    if (files.length === 0) return;
    convertButton.disabled = true;
    clearButton.disabled = true;
    clearResults();
    const queue = files.splice(0);
    renderPending();
    setStatus(`正在解密 0/${queue.length} 个文件`, 'loading');

    let completed = 0;
    let failed = 0;
    for (const file of queue) {
      try {
        const output = await dump(file, {
          fixMetadata: fixMetadata.checked,
          fetchMissingCover: false,
        });
        const url = URL.createObjectURL(output.blob);
        resultUrls.push(url);
        addResult({ file, output, url });
        completed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : '未知错误';
        addError(file, message);
      }
      setStatus(`正在解密 ${completed + failed}/${queue.length} 个文件`, 'loading');
    }

    convertButton.disabled = files.length === 0;
    clearButton.disabled = false;
    setStatus(failed ? `完成：${completed} 个成功，${failed} 个失败` : `全部完成：${completed} 个文件`, failed ? 'warning' : 'success');
  };

  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files ?? []));
    fileInput.value = '';
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.dataset.active = 'true';
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.dataset.active = 'false';
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.dataset.active = 'false';
    addFiles(Array.from(event.dataTransfer?.files ?? []));
  });
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  clearButton.addEventListener('click', () => {
    files.splice(0);
    renderPending();
  });
  clearResultsButton.addEventListener('click', clearResults);
  downloadAllButton.addEventListener('click', () => {
    if (downloadAllTimer) return;
    const links = Array.from(results.querySelectorAll<HTMLAnchorElement>('.ncm-result-item .ncm-download-button'));
    if (links.length === 0) return;
    let index = 0;
    downloadAllButton.disabled = true;
    // Browsers throttle or block a burst of downloads, so space them 0.5s apart.
    const tick = () => {
      const link = links[index];
      index += 1;
      if (!link) {
        downloadAllTimer = 0;
        downloadAllButton.disabled = false;
        downloadAllButton.textContent = '下载全部';
        setStatus(`已开始下载 ${links.length} 个文件`, 'success');
        return;
      }
      downloadAllButton.textContent = `下载中 ${index}/${links.length}`;
      link.click();
      downloadAllTimer = window.setTimeout(tick, 500);
    };
    tick();
  });
  convertButton.addEventListener('click', convert);

  // ClientRouter keeps the same document, so converted audio blobs would outlive
  // the page that created them — a batch of FLACs is easily tens of megabytes
  // held until the tab closes. Release them when the visitor navigates away, and
  // stop a running "download all" run from touching detached nodes.
  document.addEventListener('astro:before-swap', () => {
    stopDownloadAll();
    resultUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  }, { once: true });
};

document.addEventListener('astro:page-load', initNcm);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNcm, { once: true });
else initNcm();
