import { mdToHtml } from '../lib/md-to-html.js';
const md = '- item 1\n  - nested 1.1\n- item 2';
const html = mdToHtml(md);
console.log('--- MD ---');
console.log(md);
console.log('--- HTML ---');
console.log(html);
