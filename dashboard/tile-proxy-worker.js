// Tile Proxy Cloudflare Worker
// Handles CORS and bbox parameter substitution for ArcGIS MapServer tiles

export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
  
      // Handle preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
  
      // Health check
      if (url.pathname === '/health') {
        return new Response('OK', { headers: corsHeaders });
      }
  
      // Tile endpoint - handles ArcGIS MapServer export
      if (url.pathname === '/tile') {
        const baseUrl = url.searchParams.get('base');
        const bbox = url.searchParams.get('bbox');
        const extraLayers = url.searchParams.get('layers');
  
        if (!baseUrl || !bbox) {
          return new Response('Missing base or bbox parameter', { 
            status: 400, 
            headers: corsHeaders 
          });
        }
  
        // Build the full ArcGIS export URL
        let targetUrl;
        try {
          targetUrl = decodeURIComponent(baseUrl);
        } catch (e) {
          return new Response('Invalid base URL encoding', { 
            status: 400, 
            headers: corsHeaders 
          });
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
  
        try {
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 PropertyIntel/1.0',
              'Accept': 'image/png,image/*,*/*',
            },
          });
  
          // Create new response with CORS headers
          const newHeaders = new Headers(response.headers);
          newHeaders.set('Access-Control-Allow-Origin', '*');
          
          if (response.ok) {
            newHeaders.set('Cache-Control', 'public, max-age=86400');
          }
  
          return new Response(response.body, {
            status: response.status,
            headers: newHeaders,
          });
        } catch (err) {
          return new Response('Proxy error: ' + err.message, { 
            status: 502, 
            headers: corsHeaders 
          });
        }
      }
  
      // Legacy proxy endpoint
      if (url.pathname === '/proxy') {
        const targetUrl = url.searchParams.get('url');
  
        if (!targetUrl) {
          return new Response('Missing url parameter', { 
            status: 400, 
            headers: corsHeaders 
          });
        }
  
        try {
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 PropertyIntel/1.0',
              'Accept': 'image/png,image/*,*/*',
            },
          });
  
          const newHeaders = new Headers(response.headers);
          newHeaders.set('Access-Control-Allow-Origin', '*');
          newHeaders.set('Cache-Control', 'public, max-age=86400');
  
          return new Response(response.body, {
            status: response.status,
            headers: newHeaders,
          });
        } catch (err) {
          return new Response('Proxy error: ' + err.message, { 
            status: 502, 
            headers: corsHeaders 
          });
        }
      }
  
      return new Response('Not found. Use /tile?base=<url>&bbox=<bbox> or /proxy?url=<url>', { 
        status: 404, 
        headers: corsHeaders 
      });
    },
  };