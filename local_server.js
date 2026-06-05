#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, 'src');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let url = new URL(req.url, `http://${req.headers.host}`);
  const PREFIX = '/tcpscript';

  if (!url.pathname.startsWith(PREFIX)) {
    res.writeHead(404);
    res.end('Not Found (Missing /tcpscript prefix)');
    return;
  }

  // Strip prefix
  let internalPath = url.pathname.slice(PREFIX.length) || '/';

  // Simulate Cloudflare Worker logic for clean URLs and Root
  if (internalPath === '/' || internalPath === '/index.html') {
    res.writeHead(302, { Location: `${PREFIX}/login` });
    res.end();
    return;
  }

  const cleanRoutes = ['/login', '/project', '/setting', '/app'];
  if (cleanRoutes.includes(internalPath) || internalPath.startsWith('/app/')) {
    if (internalPath.startsWith('/app/')) {
      internalPath = '/app.html';
    } else {
      internalPath += '.html';
    }
  }

  // Handle mock APIs
  if (internalPath.startsWith('/api/')) {
    // Read body
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      // Just mock a 200 OK for API calls in local testing
      if (internalPath === '/api/users/profiles') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([{ username: 'Admin', hasPin: false }]));
          return;
      }
      
      if (internalPath === '/api/login') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, token: 'mock_token', username: 'Admin' }));
          return;
      }

      if (internalPath === '/api/projects') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (req.method === 'GET') {
              res.end(JSON.stringify([{
                  id: 'mock_123',
                  name: 'Mock Project (Local Test)',
                  status: 'Not Started Yet',
                  speaker: 'Test Speaker',
                  source: 'Test Source',
                  link: 'http://example.com',
                  spreadsheetId: 'mockSheetId',
                  createdAt: new Date().toISOString()
              }]));
          } else if (req.method === 'POST') {
              let parsed = {};
              try { parsed = JSON.parse(body); } catch(e) {}
              const newProject = {
                  id: 'mock_' + Date.now(),
                  name: parsed.name || 'New Mock Project',
                  status: parsed.status || 'Not Started Yet',
                  speaker: parsed.speaker || '',
                  source: parsed.source || '',
                  link: parsed.link || '',
                  spreadsheetId: 'mockNewSheetId',
                  createdAt: new Date().toISOString()
              };
              res.end(JSON.stringify(newProject));
          } else if (req.method === 'DELETE' || req.method === 'PUT') {
              res.end(JSON.stringify({ success: true }));
          } else {
              res.end(JSON.stringify([]));
          }
          return;
      }
      
      // Default fallback for other APIs
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'mock_ok', url: req.url, body }));
    });
    return;
  }

  // Serve static files
  let filePath = path.join(SRC_DIR, internalPath);
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('File not found: ' + internalPath);
      return;
    }
    
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': mimeType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Local debug server running at http://127.0.0.1:3000');
  console.log('Test the app at: http://127.0.0.1:3000/tcpscript/');
});
