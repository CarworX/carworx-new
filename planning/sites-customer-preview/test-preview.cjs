const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const dist = path.resolve('dist');

// Run customer routes and form transitions without a browser dependency.
const app = { innerHTML: '', focus() {} };
const menu = { hidden: true };
const button = { setAttribute() {}, focus() {} };
const feedback = { classList: { remove() {} }, textContent: '' };
const listeners = {};
const redirects = [];
const location = { hash: '#search/wash', replace(url) { redirects.push(url); } };
const document = {
  title: '',
  querySelector(s) { return ({ '#app': app, '#mobile-nav': menu, '.menu': button, '#dash-feedback': feedback, '#outcome': { value: 'late' } })[s]; },
  addEventListener(k, f) { listeners[k] = f; }
};
const context = { document, window: { addEventListener(k, f) { listeners[k] = f; }, scrollTo() {} }, location, console, FormData: class { constructor(x) { this.x = x; } get(k) { return this.x[k]; } } };
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/app.js', 'utf8'), context);
for (const route of ['search/wash', 'search/repairs', 'search/glass', 'search/tyres', 'empty', 'listing', 'request', 'sent', 'quote', 'checkout', 'result/success', 'result/pending', 'result/failed', 'result/late', 'dashboard', 'bookings', 'fines']) {
  location.hash = '#' + route;
  listeners.hashchange();
  assert(app.innerHTML.length > 350, route);
  assert(!app.innerHTML.includes('undefined'), route);
  assert(!app.innerHTML.includes('NaN'), route);
}
location.hash = '#apply'; listeners.hashchange();
assert.equal(redirects.pop(), '/onboarding/phase1/index.html');
location.hash = '#applied'; listeners.hashchange();
assert.equal(redirects.pop(), '/onboarding/phase1/index.html#submitted');
location.hash = '#search/wash'; listeners.hashchange();
listeners.submit({ preventDefault() {}, target: { id: 'search-form', location: '<script>' } });
assert(app.innerHTML.includes('&lt;script&gt;'));
listeners.submit({ preventDefault() {}, target: { id: 'request-form' } });
assert.equal(location.hash, 'sent');
listeners.click({ target: { id: 'simulate-payment', closest() { return null; } } });
assert.equal(location.hash, 'result/late');

// Every file-based onboarding URL and stylesheet asset must resolve.
let checkedLinks = 0, htmlCount = 0;
const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else files.push(p); } }
walk(path.join(dist, 'onboarding'));
function checkUrl(url, from) {
  if (/^(?:https?:|data:|mailto:|tel:|#)/.test(url) || url.includes('${')) return;
  const relative = url.split(/[?#]/)[0];
  if (!relative) return;
  let target = relative.startsWith('/') ? path.join(dist, relative) : path.resolve(path.dirname(from), relative);
  assert(target.startsWith(dist + path.sep), `URL escapes Site: ${url}`);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  assert(fs.existsSync(target), `${path.relative(dist, from)} -> ${url}`);
  checkedLinks++;
}
for (const file of files) {
  const text = fs.readFileSync(file, /\.woff2$/.test(file) ? undefined : 'utf8');
  if (/\.(html|css)$/.test(file)) for (const m of text.matchAll(/(?:href|src)="([^"]+)"|url\(["']?([^\s)'\"]+)/g)) checkUrl(m[1] || m[2], file);
  if (file.endsWith('.js')) new vm.Script(text, { filename: file });
  if (file.endsWith('.html')) {
    htmlCount++;
    for (const m of text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1], { filename: file });
    if (!file.endsWith(path.join('onboarding', 'index.html'))) assert(text.includes('Nothing is sent, booked or charged.'), file);
  }
}

// Render the actual shared menu for every role, not just static source checks.
function element() { return { hidden: true, addEventListener() {}, querySelector() { return { focus() {} }; }, setAttribute() {}, focus() {} }; }
const shellWindow = {};
vm.runInNewContext(fs.readFileSync('dist/onboarding/_shared/shell.js', 'utf8'), {
  window: shellWindow,
  URLSearchParams, URL, location: { search: "" },
  document: { currentScript: { src: 'https://preview.test/onboarding/_shared/shell.js' }, addEventListener() {} }
});
for (const role of ['driver', 'staff', 'manager', 'owner', 'admin']) {
  const mount = { innerHTML: '', querySelector: element, querySelectorAll() { return []; } };
  shellWindow.SHELL.mount(mount, { role, current: 'today' });
  const html = mount.innerHTML;
  assert(html.includes('Profile and settings') && html.includes('Sign out'), role);
  assert.equal(html.includes('>Earnings</a>'), role === 'owner' || role === 'manager', role + ' Earnings');
  for (const m of html.matchAll(/href="([^"]+)"/g)) { const url = new URL(m[1], 'https://preview.test'); checkUrl(url.pathname, path.join(dist, 'app.html')); }
  if (role === 'staff') assert(html.includes('staff/index.html?demo=1#home'));
  if (role === 'owner' || role === 'manager') assert(html.includes('setup/index.html#hub'));
}

// Exercise the sign-in page's actual handlers, including forbidden fallback URLs.
const signHtml = fs.readFileSync('dist/onboarding/account/sign-in.html', 'utf8');
const signScript = [...signHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
function signIn(search) {
  const nodes = {}, appended = [];
  for (const key of ['[data-h]', '[data-sub]', '[data-err]', '[data-email]', '[data-back]', '[data-recovery]', '[data-verify]', '.cx-eyebrow', '.alt']) nodes[key] = { textContent: '', hidden: false, focus() {}, remove() { this.removed = true; } };
  Object.defineProperty(nodes['[data-email]'], 'outerHTML', { set() { this.removed = true; } });
  const input = { value: '', hidden: false, focus() {}, removeAttribute() {} };
  const card = { dataset: {}, querySelector(s) { if (s === "#code") return input; const n = nodes[s]; return n?.removed ? null : n; }, querySelectorAll() { return [input, nodes['[data-verify]'], nodes['.alt']]; }, append(n) { appended.push(n); } };
  vm.runInNewContext(signScript, { URLSearchParams, location: { search }, document: { querySelector(s) { return s === '.card' ? card : input; }, createElement() { return {}; } } });
  return { nodes, input, appended };
}
for (const query of ['?admin=1&state=email', '?admin=&state=email', '?admin=&admin=1&state=email', '?admin=1&admin=&state=email', '?as=admin&state=email', '?as=staff&as=admin&state=email', '?provider=google&state=email', '?provider=&provider=google&state=email', '?provider=google&provider=&state=email']) {
  const s = signIn(query);
  assert(s.nodes['[data-email]'].removed, query);
  assert.notEqual(s.nodes['[data-h]'].textContent, 'Check your email', query);
  // Even a retained handler cannot switch an ineligible account into email mode.
  s.nodes['[data-email]'].onclick();
  assert.notEqual(s.nodes['[data-h]'].textContent, 'Check your email', query + ' handler');
}
const email = signIn('?state=email');
assert.equal(email.nodes['[data-h]'].textContent, 'Check your email');
assert(email.nodes['[data-sub]'].textContent.includes('no email is sent'));
for (const [query, target] of [['?admin=1', '../admin/index.html#today'], ['?as=staff', '../staff/index.html?demo=1#home'], ['', '../setup/index.html#hub']]) {
  const s = signIn(query); s.input.value = '123456'; s.nodes['[data-verify]'].onclick();
  assert.equal(s.appended.at(-1).href, target);
}
const recovery = signIn('?admin=1');
recovery.nodes['[data-recovery]'].onclick(); recovery.nodes['[data-verify]'].onclick();
assert(recovery.nodes['[data-sub]'].textContent.includes('no aal2 session was granted'));
assert.equal(recovery.appended.at(-1).href, 'index.html?as=admin&tab=security');


// Render the actual account/later/history scripts for hostile and restricted queries.
function previewScreen(file, search) {
  const nodes = {};
  function node() {
    return { innerHTML: '', textContent: '', hidden: false, dataset: {}, style: {},
      addEventListener() {}, setAttribute() {}, focus() {},
      querySelector() { return node(); }, querySelectorAll() { return []; },
      classList: { add() {}, remove() {}, toggle() {} } };
  }
  const doc = {
    title: '', currentScript: { src: 'https://preview.test/onboarding/_shared/shell.js' },
    addEventListener() {}, querySelectorAll() { return []; },
    querySelector(selector) {
      if (selector === '[data-mfaseg]') return null;
      return nodes[selector] ||= node();
    }
  };
  const win = {};
  vm.runInNewContext(fs.readFileSync('dist/onboarding/_shared/shell.js', 'utf8'), {
    window: win, document: doc, URL, URLSearchParams, location: { search }
  });
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const ctx = vm.createContext({
    document: doc, window: win, SHELL: win.SHELL,
    OB: { ic: () => '<svg aria-hidden="true"></svg>', esc: escape },
    URL, URLSearchParams, location: { search, href: new URL(file.replace(/^dist\//, ''), 'https://preview.test/').href + search }, requestAnimationFrame(fn) { fn(); }
  });
  const html = fs.readFileSync(file, 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  vm.runInContext(script, ctx);
  return { nodes, ctx, html };
}
for (const query of ['?as=owner&provider=google&tab=security&mfa=on', '?as=owner&provider=&provider=google&tab=security&mfa=on', '?as=admin&tab=security&mfa=on']) {
  const screen = previewScreen('dist/onboarding/account/index.html', query);
  const html = screen.nodes['[data-panel]'].innerHTML;
  assert(html.includes('Email backup') && html.includes('Not available for'), query);
  assert(!html.includes('Get a sign-in code by email if your app gives trouble'), query);
  const href = html.match(/href="(sign-in\.html[^"]+)"/)[1];
  const url = new URL(href, 'https://preview.test/onboarding/account/');
  if (query.includes('provider')) {
    assert.equal(url.searchParams.get('provider'), 'google', query);
    assert(screen.nodes['[data-shell]'].innerHTML.includes('provider=google'), query + ' menu');
  } else assert(url.searchParams.has('admin'), query);
}
const googleBackup = previewScreen('dist/onboarding/account/index.html', '?as=owner&provider=google&tab=security&mfa=on&mfastep=3');
const backup = vm.runInContext('mfaFlow()', googleBackup.ctx);
assert(backup.includes("Google-only accounts") && backup.includes("can't use an email code"), 'Google-only recovery eligibility');
assert(!backup.includes('Email backup<small>'), 'Google-only setup cannot offer email backup');

const attack = '"><img src=x onerror=alert(1)>';
for (const file of ['dist/onboarding/later/index.html', 'dist/onboarding/history/index.html', 'dist/onboarding/account/index.html']) {
  for (const role of [attack, '__proto__', 'toString', 'unknown-role']) {
    const result = previewScreen(file, '?as=' + encodeURIComponent(role));
    const rendered = Object.values(result.nodes).map(n => n.innerHTML).join('');
    assert(!rendered.includes('onerror=') && !rendered.includes('<img src=x'), file + ' role injection');
    assert(!rendered.includes('undefined'), file + ' unknown role');
  }
}
const googleRecovery = signIn('?as=manager&provider=google');
for (const query of ['?as=constructor', '?as=owner&as=admin', '?as=admin&as=driver', '?as=']) {
  const screen = previewScreen('dist/onboarding/account/index.html', query);
  assert.equal(screen.nodes['[data-sub]'].textContent, 'Driver', query);
}
googleRecovery.nodes['[data-recovery]'].onclick();
googleRecovery.nodes['[data-verify]'].onclick();
assert.equal(googleRecovery.appended.at(-1).href, 'index.html?as=manager&tab=security&provider=google');

const phase = fs.readFileSync('dist/onboarding/phase1/index.html', 'utf8');
assert(phase.includes('data-rail') && phase.includes('data-segbar'), 'approved desktop rail and gliding bar');
assert(phase.includes('data-screen="card"'), 'live listing preview');
assert(!phase.includes('id="send"') && /id="check"[^>]*data-require="adult,consent"/.test(phase), 'five-step application retains acknowledgements');
const kit = fs.readFileSync('dist/onboarding/_shared/kit.js', 'utf8');
assert(kit.includes('../setup/index.html'), 'live screen links to setup');
assert(fs.readFileSync('dist/onboarding/setup/index.html', 'utf8').includes('../staff/index.html'), 'invite preview links to staff');


const home = fs.readFileSync('dist/index.html', 'utf8');
assert(home.includes('/app.html#search/wash'));
assert(home.includes('/onboarding/phase1/index.html'));
assert(home.includes('PRIVATE INTERACTIVE PREVIEW'));
assert(!home.includes('cdnjs.cloudflare.com') && !home.includes('fonts.googleapis.com'));
assert(home.includes('/progress.html'), 'milestone update is discoverable from home');
const progress = fs.readFileSync('dist/progress.html', 'utf8');
assert(progress.includes('13 November 2026') && progress.includes('simulated actions'));
for (const link of progress.matchAll(/href="([^"]+)"/g)) checkUrl(link[1], path.join(dist, 'progress.html'));
for (const n of ['wash-detailing', 'repairs-maintenance', 'glass-repair', 'tyres-alignment']) assert(fs.existsSync(`dist/assets/studio/objects/carworx-object-${n}.svg`));
console.log(`Passed: 17 customer routes, legacy redirects, escaped search, request/payment transitions, ${htmlCount} onboarding pages, ${checkedLinks} local URLs/assets, all 5 role menus, restricted fallback URLs, sign-in completion and factor-reset preview.`);
