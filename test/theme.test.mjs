import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shell } from '../public/views.js';

const theme = readFileSync(new URL('../public/theme.css', import.meta.url), 'utf8');
const values = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2]]));
const light = values(theme.split(':root[data-theme="dark"]')[0]);
const dark = { ...light, ...values(theme.split(':root[data-theme="dark"]')[1].split('@media')[0]) };
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};

test('shared theme resolves every reference and keeps text and controls legible in both appearances', () => {
  const sources = ['theme.css', 'styles.css', 'views.js'].map(file => readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')).join('\n');
  for (const [, key] of sources.matchAll(/var\(--([\w-]+)/g)) assert.ok(key in light, `Undefined token: ${key}`);
  const pairs = [
    ...['canvas', 'panel', 'surface', 'selected'].flatMap(bg => [['text', bg], ['muted', bg]]),
    ['accent-text', 'panel'], ['accent-text', 'selected'], ['on-accent', 'accent'], ['on-accent', 'accent-hover'],
    ['semantic', 'semantic-soft'], ['episodic', 'episodic-soft'], ['procedural', 'procedural-soft'],
    ['on-accent', 'toast-error-bg'], ['warning', 'warning-soft'], ['danger', 'danger-soft'], ['toast-text', 'toast-bg'],
    ['field-border', 'panel', 3], ['semantic', 'panel', 3], ['episodic', 'panel', 3], ['procedural', 'panel', 3],
  ];
  for (const [name, palette] of Object.entries({ light, dark })) for (const [fg, bg, minimum = 4.5] of pairs) {
    const a = luminance(palette[fg]), b = luminance(palette[bg]);
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    assert.ok(ratio >= minimum, `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1; needs ${minimum}:1`);
  }
});

test('settings retain the selected appearance when the workspace renders again', () => {
  const data = { workspace: { name: 'Preview', reminders: false }, memories: [], agents: [], database: 'local.db', storage_bytes: 0 };
  for (const appearance of ['system', 'light', 'dark']) {
    const html = shell({ page: 'settings', appearance, data });
    assert.ok(html.includes(`<option value="${appearance}" selected>`));
    assert.equal((html.match(/id="appearance"/g) || []).length, 1);
  }
});
