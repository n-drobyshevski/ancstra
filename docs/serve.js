const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const DOCS_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function walkDir(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['archive', 'superpowers', 'node_modules'].includes(entry.name)) continue;
      results.push(...walkDir(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      results.push(rel);
    }
  }
  return results;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API: list all markdown files
  if (url.pathname === '/api/files') {
    const files = walkDir(DOCS_DIR);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // API: read a specific file
  if (url.pathname === '/api/read') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      res.writeHead(400);
      res.end('Missing path parameter');
      return;
    }
    const fullPath = path.resolve(DOCS_DIR, filePath);
    if (!fullPath.startsWith(DOCS_DIR)) {
      res.writeHead(403);
      res.end('Access denied');
      return;
    }
    if (!fs.existsSync(fullPath)) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(content);
    return;
  }

  // Serve viewer.html for root
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = fs.readFileSync(path.join(DOCS_DIR, 'viewer.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Static files
  const filePath = path.join(DOCS_DIR, url.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(filePath));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Ancstra Docs Viewer`);
  console.log(`  http://localhost:${PORT}\n`);
});
