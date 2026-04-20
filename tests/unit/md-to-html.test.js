import test from 'node:test';
import assert from 'node:assert';
import { mdToHtml } from '../../lib/md-to-html.js';

test('mdToHtml conversion', async (t) => {
  await t.test('basic block elements', () => {
    assert.strictEqual(mdToHtml('# H1'), '<h1>H1</h1>');
    assert.strictEqual(mdToHtml('## H2'), '<h2>H2</h2>');
    assert.strictEqual(mdToHtml('> quote'), '<blockquote><p>quote</p></blockquote>');
    assert.strictEqual(mdToHtml('---\n***'), '<hr>\n<hr>');
  });

  await t.test('inline formatting', () => {
    assert.strictEqual(mdToHtml('**bold**'), '<p><strong>bold</strong></p>');
    assert.strictEqual(mdToHtml('_italic_'), '<p><em>italic</em></p>');
    assert.strictEqual(mdToHtml('`code`'), '<p><code>code</code></p>');
    assert.strictEqual(mdToHtml('~~strike~~'), '<p><del>strike</del></p>');
    assert.strictEqual(mdToHtml('[link](https://google.com)'), '<p><a href="https://google.com">link</a></p>');
  });  await t.test('code blocks with info strings (including IDs)', () => {
    const md = '```js id="123"\nconsole.log(1);\n```';
    const html = mdToHtml(md);
    assert.ok(html.includes('<pre data-lang="js"><code class="language-js">console.log(1);</code></pre>'));
  });

  await t.test('C++ syntax highlighting basics', () => {
    const md = '```cpp\nint main() { return 0; }\n```';
    const html = mdToHtml(md);
    assert.ok(html.includes('<span class="token-kw">int</span>'));
    assert.ok(html.includes('<span class="token-kw">return</span>'));
  });
  await t.test('code blocks without language', () => {
    const md = '```\nplain text\n```';
    const html = mdToHtml(md);
    assert.ok(html.includes('<pre><code>plain text</code></pre>'));
  });

  await t.test('nested lists', () => {
    const md = '- item 1\n  - nested 1.1\n- item 2';
    const html = mdToHtml(md);
    // Note: Our minimal parser produces a loose list (with <p>) for the parent item
    // and a tight list for the child.
    assert.ok(html.includes('<li><p>item 1</p>'));
    assert.ok(html.includes('<ul><li>nested 1.1</li></ul>'));
  });

  await t.test('tables', () => {
    const md = '| h1 | h2 |\n|---|---|\n| c1 | c2 |';
    const html = mdToHtml(md);
    assert.ok(html.includes('<table><thead><tr><th>h1</th><th>h2</th></tr></thead><tbody><tr><td>c1</td><td>c2</td></tr></tbody></table>'));
  });

  await t.test('HTML escaping', () => {
    assert.strictEqual(mdToHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  await t.test('paragraph with soft breaks', () => {
    const md = 'line 1\nline 2';
    assert.strictEqual(mdToHtml(md), '<p>line 1<br>\nline 2</p>');
  });
});
