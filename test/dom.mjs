// A tiny DOM for node tests: enough for the result ticket (built with createElement) and for reading index.html.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.attributes = new Map();
    this.listeners = {};
    this.className = '';
    this.hidden = false;
    this.style = { setProperty(k, v) { this[k] = v; } };
  }

  get children() { return this.childNodes.filter((n) => n instanceof FakeElement); }

  append(...nodes) {
    for (const n of nodes) {
      if (n instanceof FakeElement) n.parentNode = this;
      this.childNodes.push(n instanceof FakeElement ? n : { text: String(n) });
    }
  }

  get textContent() {
    return this.childNodes.map((n) => (n instanceof FakeElement ? n.textContent : n.text)).join('');
  }

  set textContent(value) { this.childNodes = [{ text: String(value) }]; }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }

  getAttribute(name) {
    if (this.attributes.has(name)) return this.attributes.get(name);
    const prop = { class: 'className' }[name] ?? name;
    return typeof this[prop] === 'string' && this[prop] !== '' ? this[prop] : null;
  }

  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }

  async click() { for (const fn of this.listeners.click ?? []) await fn({ preventDefault() {} }); }

  get classes() { return (this.getAttribute('class') ?? '').split(/\s+/).filter(Boolean); }
}

export function installDocument() {
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag),
  };
}

// Every element under root (root included) that passes the test.
export function findAll(root, test = () => true) {
  const out = [];
  const walk = (node) => {
    if (test(node)) out.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return out;
}

export const byTag = (root, tag) => findAll(root, (n) => n.tagName === tag.toUpperCase());
export const byClass = (root, cls) => findAll(root, (n) => n.classes.includes(cls));
export const byId = (root, id) => findAll(root, (n) => n.getAttribute('id') === id)[0] ?? null;

// Text a sighted user sees: skips hidden, aria-hidden, visually-hidden, <noscript> and <svg>.
export function visibleText(node) {
  if (!(node instanceof FakeElement)) return node.text;
  const hidden = node.hidden || node.attributes.has('hidden') || node.getAttribute('aria-hidden') === 'true'
    || node.classes.includes('visually-hidden') || ['NOSCRIPT', 'SVG', 'SCRIPT', 'TEMPLATE'].includes(node.tagName);
  if (hidden) return '';
  if (node.tagName === 'BR') return ' ';
  const text = node.childNodes.map(visibleText).join('');
  return INLINE.has(node.tagName) ? text : ` ${text} `;
}

const INLINE = new Set(['A', 'B', 'STRONG', 'EM', 'I', 'MARK', 'SMALL', 'BUTTON']);

export const squash = (text) => text.replace(/\s+/g, ' ').trim();

// Parses a page into FakeElements; good enough for our own hand-written HTML.
export function parseHtml(html) {
  const root = new FakeElement('#document');
  const stack = [root];
  const decode = (text) => text.replace(/&(#?\w+);/g, (m, e) => (e[0] === '#' ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e] ?? m));
  const token = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/gi;
  for (const [all, closing, tag, rest = '', text] of html.matchAll(token)) {
    const top = stack.at(-1);
    if (text !== undefined) { top.append(decode(text)); continue; }
    if (!tag) continue;
    const name = tag.toLowerCase();
    if (closing) {
      const at = stack.findLastIndex((n) => n.tagName === name.toUpperCase());
      if (at > 0) stack.length = at;
      continue;
    }
    const node = new FakeElement(name);
    for (const [, attr, , , dq, sq] of rest.matchAll(/([^\s=/]+)(=("([^"]*)"|'([^']*)'))?/g)) {
      node.setAttribute(attr.toLowerCase(), decode(dq ?? sq ?? ''));
    }
    top.append(node);
    if (!VOID.has(name) && !all.endsWith('/>')) stack.push(node);
  }
  return root;
}
