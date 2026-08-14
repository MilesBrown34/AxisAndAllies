// IRON & CROWNS - LIGHTWEIGHT STATIC WEB SERVER
// Serves local files on http://localhost:8080 without dependencies (resolving CORS issues with JS Modules).

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  // Safe path resolution to prevent directory traversal
  let safeUrl = req.url.split('?')[0]; // Remove query strings
  let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Internal Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      });
      res.end(content, 'utf-8');
    }
  });
}).listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`IRON & CROWNS local server is running!`);
  console.log(`To play the game, open: http://localhost:${PORT}/`);
  console.log(`Press Ctrl+C in this terminal window to stop the server.`);
  console.log(`====================================================`);
});
