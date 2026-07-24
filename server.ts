import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { parsePlaylist, generateM3U, generateJSON, generateRawChannelsArray } from './src/utils/playlistParser';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route to parse raw content posted directly from client (upload or paste)
  app.post('/api/parse-direct', (req, res) => {
    try {
      const { content, name = 'custom_playlist' } = req.body;
      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'Missing parameter "content"' });
        return;
      }
      const parsed = parsePlaylist(content, name);
      res.json(parsed);
    } catch (err: any) {
      console.error('[Parse Direct Error]', err);
      res.status(500).json({ error: err.message || 'Failed to parse playlist content' });
    }
  });

  // API Route to proxy fetch external playlists to bypass browser CORS
  app.get('/api/fetch', async (req, res) => {
    try {
      const { url, name } = req.query;
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Missing parameter "url"' });
        return;
      }

      console.log(`[Proxy Fetch] Fetching external playlist: ${url}`);
      
      // Add standard User-Agent header to avoid blocking from raw.githubusercontent or other CDNs
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        res.status(response.status).json({ error: `Failed to fetch from remote URL: ${response.statusText}` });
        return;
      }

      const content = await response.text();
      const playlistName = typeof name === 'string' && name ? name : 'playlist';
      const parsed = parsePlaylist(content, playlistName);

      res.json(parsed);
    } catch (err: any) {
      console.error('[Proxy Fetch Error]', err);
      res.status(500).json({ error: err.message || 'Internal server error while fetching playlist' });
    }
  });

  // Dynamic live proxy endpoint that outputs customized branded playlist directly!
  app.get('/api/proxy-playlist', async (req, res) => {
    try {
      const { 
        url, 
        format = 'm3u',
        status = 'success',
        owner = 'MD ANAMUL HOQUE',
        telegram = 'https://t.me/ireentv',
        website = 'https://anamul.pages.dev',
        developer = 'IreenTechnology',
        version = '1.0',
        name = 'custom_playlist'
      } = req.query;

      if (!url || typeof url !== 'string') {
        res.status(400).send('Error: Missing parameter "url"');
        return;
      }

      console.log(`[Live Proxy] Processing live conversion for: ${url}`);

      // Fetch source file
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        res.status(response.status).send(`Error: Failed to fetch from source: ${response.statusText}`);
        return;
      }

      const rawContent = await response.text();
      
      // Parse the remote content
      const playlistName = typeof name === 'string' ? name : 'playlist';
      const parsed = parsePlaylist(rawContent, playlistName);

      // Override branding with user's specific custom query parameters
      parsed.branding = {
        status: typeof status === 'string' ? status : 'success',
        owner: typeof owner === 'string' ? owner : 'MD ANAMUL HOQUE',
        telegram: typeof telegram === 'string' ? telegram : 'https://t.me/ireentv',
        website: typeof website === 'string' ? website : 'https://anamul.pages.dev',
        developer: typeof developer === 'string' ? developer : 'IreenTechnology',
        version: typeof version === 'string' ? version : '1.0',
        name: playlistName,
        channels_amount: parsed.channels.length,
        Last_update: new Date().toISOString().split('T')[0] // current date
      };

      // Output based on format
      if (format === 'm3u') {
        const m3uContent = generateM3U(parsed);
        res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${playlistName}.m3u"`);
        res.send(m3uContent);
      } else if (format === 'json_raw' || format === 'raw' || format === 'array') {
        const jsonContent = generateRawChannelsArray(parsed);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonContent);
      } else {
        const jsonContent = generateJSON(parsed);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(jsonContent);
      }
    } catch (err: any) {
      console.error('[Live Proxy Error]', err);
      res.status(500).send(`Error: ${err.message || 'Failed to process playlist proxy'}`);
    }
  });

  // Serve static files in production / Vite integration in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
