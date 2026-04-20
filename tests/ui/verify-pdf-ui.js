import { buildPdfHtml } from '../../lib/pdf-template.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mockData = {
  title: 'Test Conversation',
  url: 'https://chat.openai.com/c/test',
  exportedAt: Date.now(),
  messages: [
    { role: 'user', markdown: 'Hello world' },
    { role: 'assistant', markdown: 'A very long message to test page breaking.\n\n' + 'Line of text.\n\n'.repeat(50) },
    { role: 'user', markdown: 'Show me a big table' },
    { role: 'assistant', markdown: '| ID | Data | Description |\n|---|---|---|\n' + '| 1 | Row | Long description that might wrap |\n'.repeat(60) }
  ]
};

const html = buildPdfHtml(mockData);
const outDir = path.join(__dirname, '../temp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const outPath = path.join(outDir, 'preview-test.html');
fs.writeFileSync(outPath, html);

console.log(`Test HTML generated at: ${outPath}`);
console.log(`Verify the following:`);
console.log(`1. #btn-print exists and triggers window.print()`);
console.log(`2. #btn-close exists and attempts window.close()`);
console.log(`3. .toolbar has .no-print class`);
