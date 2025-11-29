// Tile Proxy for ArcGIS MapServer export
// Run with: node tile-proxy.js
// Handles CORS and bbox parameter substitution for Mapbox

import http from 'http';
import https from 'https';
import { parse } from 'url';

const PORT = 3001;

// Keep-alive agent to reuse connections
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000
});

// Track active requests for debugging
let activeRequests = 0;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = parse(req.url, true);
  } catch (e) {
    res.writeHead(400);
    res.end('Invalid URL');
    return;
  }
  
  // Health check
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200);
    res.end(`OK - Active requests: ${activeRequests}`);
    return;
  }

  // Tile endpoint - handles ArcGIS MapServer export
  if (parsedUrl.pathname === '/tile') {
    const baseUrl = parsedUrl.query.base;
    const bbox = parsedUrl.query.bbox;
    const extraLayers = parsedUrl.query.layers;
    
    if (!baseUrl || !bbox) {
      res.writeHead(400);
      res.end('Missing base or bbox parameter');
      return;
    }

    // Build the full ArcGIS export URL
    let targetUrl;
    try {
      targetUrl = decodeURIComponent(baseUrl);
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid base URL encoding');
      return;
    }
    
    targetUrl += `?bbox=${bbox}`;
    targetUrl += '&bboxSR=3857';
    targetUrl += '&imageSR=3857';
    targetUrl += '&size=256,256';
    targetUrl += '&format=png32';
    targetUrl += '&transparent=true';
    targetUrl += '&f=image';
    
    if (extraLayers) {
      targetUrl += `&layers=${extraLayers}`;
    }

    let targetParsed;
    try {
      targetParsed = parse(targetUrl);
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid target URL');
      return;
    }

    activeRequests++;
    
    const options = {
      hostname: targetParsed.hostname,
      port: targetParsed.port || 443,
      path: targetParsed.path,
      method: 'GET',
      agent: httpsAgent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 PropertyIntel/1.0',
        'Accept': 'image/png,image/*,*/*',
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      activeRequests--;
      
      // Cache successful responses
      const cacheHeaders = proxyRes.statusCode === 200 ? {
        'Cache-Control': 'public, max-age=86400',
      } : {};
      
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'image/png',
        'Access-Control-Allow-Origin': '*',
        ...cacheHeaders
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
      activeRequests--;
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504);
        res.end('Gateway timeout');
      }
    });

    proxyReq.on('error', (err) => {
      activeRequests--;
      console.error(`Proxy error (${targetParsed.hostname}):`, err.code || err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Proxy error: ' + (err.code || err.message));
      }
    });

    proxyReq.end();
    return;
  }

  // Legacy proxy endpoint (for backwards compatibility)
  if (parsedUrl.pathname === '/proxy') {
    const targetUrl = parsedUrl.query.url;
    
    if (!targetUrl) {
      res.writeHead(400);
      res.end('Missing url parameter');
      return;
    }

    let targetParsed;
    try {
      targetParsed = parse(targetUrl);
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid URL');
      return;
    }
    
    activeRequests++;
    
    const options = {
      hostname: targetParsed.hostname,
      port: targetParsed.port || 443,
      path: targetParsed.path,
      method: 'GET',
      agent: httpsAgent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 PropertyIntel/1.0',
        'Accept': 'image/png,image/*,*/*',
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      activeRequests--;
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
      activeRequests--;
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504);
        res.end('Gateway timeout');
      }
    });

    proxyReq.on('error', (err) => {
      activeRequests--;
      console.error('Proxy error:', err.code || err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Proxy error: ' + (err.code || err.message));
      }
    });

    proxyReq.end();
    return;
  }

  res.writeHead(404);
  res.end('Not found. Use /tile?base=<url>&bbox=<bbox> or /proxy?url=<url>');
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🗺️  Tile Proxy Server');
  console.log('─────────────────────────────────────────');
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log('');
  console.log('   Endpoints:');
  console.log(`   /tile?base=<url>&bbox=<bbox>  - ArcGIS export tiles`);
  console.log(`   /proxy?url=<url>              - Generic CORS proxy`);
  console.log(`   /health                       - Health check`);
  console.log('');
  console.log('   Ready to serve map tiles!');
  console.log('─────────────────────────────────────────');
  console.log('');
});