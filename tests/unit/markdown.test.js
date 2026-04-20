import test from 'node:test';
import assert from 'node:assert';
import { buildMarkdown, suggestedFilename } from '../../lib/markdown.js';

test('Markdown builder', async (t) => {
  await t.test('buildMarkdown produces correct structure', () => {
    const data = {
      title: 'Test Chat',
      url: 'https://chatgpt.com/c/123',
      exportedAt: 1713534000000,
      messages: [
        { role: 'user', markdown: 'Hello' },
        { role: 'assistant', markdown: 'World' }
      ]
    };
    const md = buildMarkdown(data);
    assert.ok(md.startsWith('# Test Chat'));
    assert.ok(md.includes('## You'));
    assert.ok(md.includes('Hello'));
    assert.ok(md.includes('## ChatGPT'));
    assert.ok(md.includes('World'));
    assert.ok(md.includes('Source: https://chatgpt.com/c/123'));
  });

  await t.test('suggestedFilename logic', () => {
    const title = 'Hello / World? *';
    const filename = suggestedFilename(title, 'md');
    assert.ok(filename.includes('hello-world'));
    assert.ok(filename.endsWith('.md'));
    assert.ok(!filename.includes('/'));
    assert.ok(!filename.includes('*'));
  });
});
