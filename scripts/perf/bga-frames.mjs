// 量一次「粒子背景到底画了多少帧」。
//
// `pnpm perf:audit` 读源码，只能证明循环里没有定时器配速、没有 FPS 上限；
// 它证明不了运行时真的每个原生帧都画了。这个脚本补上另一半证据：开一个
// headless Chrome，在 `clearRect` 上打桩，只统计 `#atmosphere-canvas` 的
// 清屏次数，用墙钟时间换算出实际帧率，并要求它与浏览器自己的节奏一致。
//
// 用法：
//   pnpm perf:frames                        # 默认量 http://127.0.0.1:4321/
//   pnpm perf:frames --url http://127.0.0.1:4321/posts/<slug>/
//   pnpm perf:frames --ms 3000              # 采样窗口
//   CHROME=/path/to/chrome pnpm perf:frames # 指定浏览器
//
// 依赖 Node 22+ 的全局 `WebSocket` 与 `fetch`，不装任何 npm 包。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    args.set(key, value ?? process.argv[i + 1]);
    if (!value) i += 1;
  }
}

const url = args.get('url') ?? process.env.PROBE_URL ?? 'http://127.0.0.1:4321/';
const sampleMs = Number(args.get('ms') ?? 2000);
const port = Number(args.get('port') ?? 9333);

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executable = candidates.find((candidate) => existsSync(candidate));
if (!executable) {
  console.error('找不到 Chrome/Chromium/Edge，用 CHROME=/path/to/browser 指定。');
  process.exit(1);
}

const profile = await mkdtemp(join(tmpdir(), 'bga-frames-'));
const browser = spawn(executable, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--hide-scrollbars',
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

const cleanup = async () => {
  browser.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
};
process.on('exit', () => browser.kill());

const connect = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // 浏览器还没起监听
    }
    await sleep(250);
  }
  throw new Error(`headless 浏览器没有在 ${port} 上暴露调试端口`);
};

const socket = new WebSocket(await connect());
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = () => reject(new Error('CDP WebSocket 连接失败'));
});

let nextId = 0;
const pending = new Map();
const pageErrors = [];
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    pageErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    pageErrors.push(`${message.params.entry.text} ${message.params.entry.url ?? ''}`.trim());
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = (nextId += 1);
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
// 只统计这一块画布的清屏：粒子层每帧先 clearRect 再画椭圆，清屏次数就是
// 绘制次数，别的画布（以后可能加的）不会混进来。
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__bga = { frames: 0, first: 0, last: 0 };
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...rest) {
      if (this.canvas && this.canvas.id === 'atmosphere-canvas') {
        const now = performance.now();
        if (!window.__bga.first) window.__bga.first = now;
        window.__bga.last = now;
        window.__bga.frames += 1;
      }
      return clearRect.apply(this, rest);
    };
  `,
});

await send('Page.navigate', { url });
await sleep(2500);

const read = async () => {
  const { result } = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      frames: window.__bga.frames,
      first: window.__bga.first,
      last: window.__bga.last,
      canvas: (() => {
        const element = document.querySelector('#atmosphere-canvas');
        return element ? { width: element.width, height: element.height } : null;
      })(),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      visibility: document.visibilityState,
      title: document.title,
    })`,
    returnByValue: true,
  });
  return JSON.parse(result.value);
};

const before = await read();
await sleep(sampleMs);
const after = await read();
const frames = after.frames - before.frames;
const span = after.last - before.last;
const fps = span > 0 ? (frames / span) * 1000 : 0;

socket.close();
await cleanup();

const failures = [];
if (!after.canvas) failures.push('页面上没有 #atmosphere-canvas（这个路由没画粒子层？）');
if (after.canvas && (after.canvas.width === 0 || after.canvas.height === 0)) failures.push('画布后备分辨率是 0');
if (frames === 0) failures.push('采样窗口内一帧都没画');
if (fps > 0 && fps < 50) failures.push(`帧率 ${fps.toFixed(1)} fps 低于 50，可能被限帧或被浏览器节流`);
if (after.reducedMotion) failures.push('headless 浏览器报告 prefers-reduced-motion: reduce，静止帧是预期行为');
if (after.visibility !== 'visible') failures.push(`页面可见性为 ${after.visibility}`);
if (pageErrors.length) failures.push(`页面报错 ${pageErrors.length} 条：\n  ${pageErrors.join('\n  ')}`);

console.log(`页面      ${after.title || '(无标题)'}  ${url}`);
console.log(`画布      后备 ${after.canvas?.width ?? '?'}×${after.canvas?.height ?? '?'}`);
console.log(`采样      ${sampleMs} ms / ${frames} 帧 / ${Math.round(span)} ms 墙钟`);
console.log(`帧率      ${fps.toFixed(1)} fps`);
if (failures.length) {
  console.error(`\n失败 ${failures.length} 项：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\n通过：粒子层按浏览器的原生节奏绘制，没有额外的帧数上限。');
