import { Channel, StandardPlaylist, PlaylistBranding } from '../types';

/**
 * Parses an M3U playlist string into a list of channels
 */
export function parseM3U(m3uContent: string): Channel[] {
  const channels: Channel[] = [];
  const lines = m3uContent.split(/\r?\n/);
  
  let currentChannel: Partial<Channel> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('#EXTINF:')) {
      currentChannel = {};
      
      // Parse EXTINF attributes
      const attrs: Record<string, string> = {};
      const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let match;
      while ((match = attrRegex.exec(line)) !== null) {
        attrs[match[1]] = match[2];
      }
      
      // Extract tvg-logo
      currentChannel.logo = attrs['tvg-logo'] || attrs['logo'] || '';
      
      // Extract group-title
      currentChannel.group = attrs['group-title'] || attrs['category'] || 'General';
      
      // Extract name (everything after the last comma)
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentChannel.name = line.substring(commaIndex + 1).trim();
      } else {
        currentChannel.name = attrs['tvg-name'] || 'Channel';
      }
      
      if (attrs['status']) {
        currentChannel.status = attrs['status'];
      }
      
      // Remove standard keys from attrs to prevent duplication in JSON
      const keysToRemove = ['tvg-logo', 'logo', 'group-title', 'category', 'tvg-name', 'name', 'status'];
      for (const key of keysToRemove) {
        delete attrs[key];
      }
      
      if (Object.keys(attrs).length > 0) {
        currentChannel.attrs = attrs;
      }
    } else if (line.startsWith('#EXTVLCOPT:')) {
      const optContent = line.substring('#EXTVLCOPT:'.length).trim();
      
      if (optContent.includes('=')) {
        let [k, v] = optContent.split('=');
        k = k.trim();
        v = v.trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.substring(1, v.length - 1);
        }
        
        const isHttpHeader = ['http-user-agent', 'http-referrer', 'http-origin'].includes(k.toLowerCase());
        
        currentChannel.headers = currentChannel.headers || {};
        if (k.toLowerCase() === 'http-user-agent') {
          currentChannel.headers['User-Agent'] = v;
        } else if (k.toLowerCase() === 'http-referrer') {
          currentChannel.headers['Referer'] = v;
        } else if (k.toLowerCase() === 'http-origin') {
          currentChannel.headers['Origin'] = v;
        } else {
          currentChannel.headers[k] = v;
        }
        
        if (!isHttpHeader) {
          currentChannel.vlc_opts = currentChannel.vlc_opts || [];
          currentChannel.vlc_opts.push(optContent);
        }
      } else {
        currentChannel.vlc_opts = currentChannel.vlc_opts || [];
        currentChannel.vlc_opts.push(optContent);
      }
    } else if (line.startsWith('#KODIPROP:')) {
      const propContent = line.substring('#KODIPROP:'.length).trim();
      currentChannel.kodiprops = currentChannel.kodiprops || [];
      currentChannel.kodiprops.push(propContent);
    } else if (line.startsWith('#EXTHTTP:')) {
      const httpContent = line.substring('#EXTHTTP:'.length).trim();
      currentChannel.exthttps = currentChannel.exthttps || [];
      currentChannel.exthttps.push(httpContent);
      
      // Also extract headers from EXTHTTP if it is valid JSON
      try {
        const parsedHttp = JSON.parse(httpContent);
        if (parsedHttp && typeof parsedHttp === 'object') {
          currentChannel.headers = currentChannel.headers || {};
          for (const [k, v] of Object.entries(parsedHttp)) {
            if (k.toLowerCase() === 'user-agent') {
              currentChannel.headers['User-Agent'] = String(v);
            } else if (k.toLowerCase() === 'referer') {
              currentChannel.headers['Referer'] = String(v);
            } else if (k.toLowerCase() === 'origin') {
              currentChannel.headers['Origin'] = String(v);
            } else {
              currentChannel.headers[k] = String(v);
            }
          }
        }
      } catch (e) {
        // Fallback or ignore parse errors
      }
    } else if (line && !line.startsWith('#')) {
      // This is the stream URL
      currentChannel.url = line;
      currentChannel.url_raw = line;
      
      if (!currentChannel.name) {
        currentChannel.name = `Channel ${channels.length + 1}`;
      }
      if (!currentChannel.logo) {
        currentChannel.logo = '';
      }
      if (!currentChannel.group) {
        currentChannel.group = 'General';
      }
      
      // Handle inline User-Agent or custom header options
      if (line.includes('|')) {
        const parts = line.split('|');
        currentChannel.url = parts[0];
        currentChannel.headers = currentChannel.headers || {};
        for (let p = 1; p < parts.length; p++) {
          const part = parts[p];
          if (part.includes('=')) {
            const [k, v] = part.split('=');
            currentChannel.headers[k.trim()] = v.trim();
          } else if (part.includes(':')) {
            const [k, v] = part.split(':');
            currentChannel.headers[k.trim()] = v.trim();
          }
        }
      }
      
      channels.push(currentChannel as Channel);
      currentChannel = {};
    }
  }
  
  return channels;
}

function extractUrlsFromItem(item: any): string[] {
  const urls: string[] = [];
  
  const addUrl = (val: any) => {
    if (typeof val === 'string' && val.trim().length > 0) {
      const u = val.trim();
      if (!urls.includes(u)) {
        urls.push(u);
      }
    } else if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        for (const elem of val) {
          addUrl(elem);
        }
      } else {
        const subKeys = ['streams', 'stream', 'urls', 'url', 'video_url', 'pub_url', 'dai_url', 'link', 'src', 'uri', 'm3u8', 'file', 'hls', 'dash'];
        for (const sk of subKeys) {
          if (val[sk]) {
            addUrl(val[sk]);
          }
        }
      }
    }
  };

  const primaryKeys = [
    'video_url', 'videoUrl', 'pub_url', 'pubUrl', 'dai_url', 'daiUrl',
    'url', 'link', 'stream', 'stream_url', 'stream_link', 'source',
    'uri', 'm3u8', 'm3u8_url', 'streamUrl', 'streamLink', 'sources',
    'streams', 'urls', 'links', 'src'
  ];

  for (const k of primaryKeys) {
    if (item[k]) {
      addUrl(item[k]);
    }
  }

  return urls;
}

/**
 * Intelligent JSON playlist parser that traverses any JSON structure
 * to find arrays containing channel or match metadata.
 */
export function parseJSONPlaylist(jsonObj: any): Channel[] {
  let channelArray: any[] = [];
  
  // Helper to find the first array in the JSON that contains objects
  function findChannelArray(obj: any): any[] | null {
    if (!obj || typeof obj !== 'object') return null;
    
    // Check direct keys first for standard naming (channels, matches, streams, items, list)
    const priorityKeys = ['channels', 'matches', 'streams', 'items', 'live', 'data', 'list', 'channelList', 'matchList'];
    for (const key of priorityKeys) {
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        return obj[key];
      }
    }
    
    // Check all keys
    for (const key in obj) {
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        // Verify if elements look like objects
        const firstElem = obj[key][0];
        if (firstElem && typeof firstElem === 'object') {
          return obj[key];
        }
      }
    }
    
    // Recursive search
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        const found = findChannelArray(obj[key]);
        if (found) return found;
      }
    }
    
    return null;
  }
  
  if (Array.isArray(jsonObj)) {
    channelArray = jsonObj;
  } else {
    channelArray = findChannelArray(jsonObj) || [];
  }
  
  const channels: Channel[] = [];
  
  for (const item of channelArray) {
    if (!item || typeof item !== 'object') continue;
    
    // Find name/title
    const nameKeys = ['match_name', 'matchName', 'event_name', 'eventName', 'broadcast_channel', 'broadcastChannel', 'name', 'title', 'channel_name', 'Label', 'displayName'];
    let name = '';
    for (const k of nameKeys) {
      if (item[k]) {
        name = String(item[k]);
        break;
      }
    }
    
    // Extract stream URLs (handles arrays like sources.streams or direct strings)
    const urls = extractUrlsFromItem(item);
    if (urls.length === 0) {
      urls.push('https://upcoming-match-no-stream.m3u8');
    }
    
    // Find logo
    const logoKeys = ['logo', 'image', 'logo_url', 'thumbnail', 'img', 'icon', 'channel_logo', 'poster', 'logoUrl', 'imageUrl', 'src'];
    let logo = '';
    for (const k of logoKeys) {
      if (item[k]) {
        logo = String(item[k]);
        break;
      }
    }
    
    // Find group/category
    const groupKeys = ['group', 'category', 'genre', 'group-title', 'type', 'stream_category', 'sportName', 'event_category', 'eventCategory', 'country'];
    let group = '';
    for (const k of groupKeys) {
      if (item[k]) {
        group = String(item[k]);
        break;
      }
    }
    
    // Find custom HTTP headers (frequently present in modern auto-updating lists)
    let headers: Record<string, string> = {};
    const headerKeys = ['headers', 'header', 'http_headers', 'header_info'];
    for (const k of headerKeys) {
      if (item[k] && typeof item[k] === 'object') {
        headers = { ...item[k] };
        break;
      }
    }

    // Extract root-level header/cookie properties if available
    if (item.cookie && !headers.cookie) headers.cookie = String(item.cookie);
    if (item.drm_token && !headers.drm_token) headers.drm_token = String(item.drm_token);
    if (item.user_agent && !headers['User-Agent']) headers['User-Agent'] = String(item.user_agent);
    if (item['User-Agent'] && !headers['User-Agent']) headers['User-Agent'] = String(item['User-Agent']);
    if (item.origin && !headers['Origin']) headers['Origin'] = String(item.origin);
    if (item['Origin'] && !headers['Origin']) headers['Origin'] = String(item['Origin']);
    if (item.referer && !headers['Referer']) headers['Referer'] = String(item.referer);
    if (item['Referer'] && !headers['Referer']) headers['Referer'] = String(item['Referer']);
    if (item.host && !headers['Host']) headers['Host'] = String(item.host);
    if (item['Host'] && !headers['Host']) headers['Host'] = String(item['Host']);
    if (item['x-forwarded-for'] && !headers['x-forwarded-for']) headers['x-forwarded-for'] = String(item['x-forwarded-for']);

    // Extract attrs
    let attrs: Record<string, string> = {};
    if (item.attrs && typeof item.attrs === 'object') {
      attrs = { ...item.attrs };
    } else if (typeof item.attrs === 'string') {
      try {
        attrs = JSON.parse(item.attrs);
      } catch (e) {}
    }
    const tvgId = item['tvg-id'] || item.tvg_id || item.tvgId || item.id || attrs['tvg-id'];
    if (tvgId) {
      attrs['tvg-id'] = String(tvgId);
    }

    // Extract kodiprops
    let kodiprops: string[] | undefined = undefined;
    if (Array.isArray(item.kodiprops)) {
      kodiprops = item.kodiprops.map(String);
    } else if (Array.isArray(item.kodi_props)) {
      kodiprops = item.kodi_props.map(String);
    } else if (typeof item.kodiprops === 'string') {
      try {
        const parsed = JSON.parse(item.kodiprops);
        if (Array.isArray(parsed)) kodiprops = parsed.map(String);
      } catch (e) {}
    }
    
    // Find extra properties
    let exthttps: string[] | undefined = undefined;
    for (const k of ['exthttps', 'exthttp', 'ext_https', 'ext_http']) {
      if (item[k]) {
        if (Array.isArray(item[k])) {
          exthttps = item[k].map(String);
        } else if (typeof item[k] === 'string') {
          exthttps = [item[k]];
        }
        break;
      }
    }
    
    for (let i = 0; i < urls.length; i++) {
      const streamUrl = urls[i];
      const channelName = (urls.length > 1 && i > 0) ? `${name} (${i + 1})` : name;

      channels.push({
        name: channelName || item.name || `Channel ${channels.length + 1}`,
        logo: logo || '',
        url: streamUrl,
        group: group || 'Sports',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        status: item.status ? String(item.status) : undefined,
        attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
        vlc_opts: Array.isArray(item.vlc_opts) ? item.vlc_opts.map(String) : undefined,
        kodiprops,
        url_raw: item.url_raw || streamUrl,
        exthttps
      });
    }
  }
  
  return channels;
}

/**
 * Standardizes raw content (either M3U or JSON) into our StandardPlaylist structure
 */
export function parsePlaylist(content: string, customName: string = 'playlist'): StandardPlaylist {
  let channels: Channel[] = [];
  const trimmed = content.trim();
  const isM3U = trimmed.startsWith('#EXTM3U');
  
  if (isM3U) {
    channels = parseM3U(content);
  } else {
    try {
      const parsedJson = JSON.parse(content);
      channels = parseJSONPlaylist(parsedJson);
    } catch (e) {
      // Fallback: parse as M3U if it looks like M3U even without #EXTM3U, else empty
      if (content.includes('#EXTINF') || content.includes('http')) {
        channels = parseM3U(content);
      }
    }
  }
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const branding: PlaylistBranding = {
    status: 'success',
    owner: 'MD ANAMUL HOQUE',
    telegram: 'https://t.me/ireentv',
    website: 'https://anamul.pages.dev',
    developer: 'IreenTechnology',
    version: '1.0',
    name: customName,
    channels_amount: channels.length,
    Last_update: today
  };
  
  return {
    branding,
    channels
  };
}

/**
 * Formats a list of channels into raw channel objects strictly following requested schema
 */
export function generateRawChannelsArray(playlist: StandardPlaylist): any[] {
  return playlist.channels.map(ch => {
    // Guaranteed standard headers object
    const defaultHeaders: Record<string, string> = {
      "drm_token": "",
      "User-Agent": "",
      "Origin": "",
      "Referer": "",
      "cookie": "",
      "Host": "",
      "x-forwarded-for": ""
    };

    if (ch.headers) {
      for (const [k, v] of Object.entries(ch.headers)) {
        if (v !== undefined && v !== null) {
          const lowerK = k.toLowerCase();
          if (lowerK === 'drm_token' || lowerK === 'drmtoken') defaultHeaders['drm_token'] = String(v);
          else if (lowerK === 'user-agent') defaultHeaders['User-Agent'] = String(v);
          else if (lowerK === 'origin') defaultHeaders['Origin'] = String(v);
          else if (lowerK === 'referer' || lowerK === 'referrer') defaultHeaders['Referer'] = String(v);
          else if (lowerK === 'cookie') defaultHeaders['cookie'] = String(v);
          else if (lowerK === 'host') defaultHeaders['Host'] = String(v);
          else if (lowerK === 'x-forwarded-for') defaultHeaders['x-forwarded-for'] = String(v);
          else defaultHeaders[k] = String(v);
        }
      }
    }

    // Guaranteed standard attrs object with tvg-id
    const attrs: Record<string, string> = {
      "tvg-id": ch.attrs?.['tvg-id'] || ch.attrs?.['tvg_id'] || ch.attrs?.['id'] || "117"
    };
    if (ch.attrs) {
      for (const [k, v] of Object.entries(ch.attrs)) {
        if (k !== 'status' && attrs[k] === undefined) {
          attrs[k] = String(v);
        }
      }
    }

    // Guaranteed standard kodiprops array
    const defaultKodiprops = [
      "inputstream=inputstream.adaptive",
      "inputstream.adaptive.manifest_type=mpd",
      "inputstream.adaptive.license_type=com.widevine.alpha",
      "inputstream.adaptive.license_key=https://|"
    ];
    const kodiprops = (ch.kodiprops && ch.kodiprops.length > 0) ? ch.kodiprops : defaultKodiprops;

    return {
      name: ch.name || '',
      logo: ch.logo || '',
      url: ch.url || '',
      group: ch.group || 'Sports',
      url_raw: ch.url_raw || ch.url || '',
      headers: defaultHeaders,
      attrs,
      kodiprops
    };
  });
}

/**
 * Formats a list of channels into an M3U playlist file with strict requested structure
 */
export function generateM3U(playlist: StandardPlaylist): string {
  let m3u = `#EXTM3U\n`;

  const rawChannels = generateRawChannelsArray(playlist);

  for (const ch of rawChannels) {
    const tvgId = ch.attrs?.['tvg-id'] || '117';
    const logo = ch.logo || '';
    const group = ch.group || 'Sports';
    const tvgName = ch.name || 'Channel';
    const name = ch.name || 'Channel';

    const userAgent = ch.headers?.['User-Agent'] || '';
    const origin = ch.headers?.['Origin'] || '';
    const referrer = ch.headers?.['Referer'] || '';
    const cookie = ch.headers?.['cookie'] || '';

    const extHttp = JSON.stringify({ cookie });

    m3u += `#EXTINF:-1 tvg-id="${tvgId}" tvg-logo="${logo}" group-title="${group}" tvg-name="${tvgName}",${name}\n`;
    m3u += `#EXTVLCOPT:http-user-agent=${userAgent}\n`;
    m3u += `#EXTVLCOPT:http-origin=${origin}\n`;
    m3u += `#EXTVLCOPT:http-referrer=${referrer}\n`;
    m3u += `#EXTHTTP:${extHttp}\n`;

    if (ch.kodiprops && Array.isArray(ch.kodiprops)) {
      for (const prop of ch.kodiprops) {
        m3u += `#KODIPROP:${prop}\n`;
      }
    }

    const streamUrl = ch.url_raw || ch.url || 'https://xxxxxxxx';
    m3u += `${streamUrl}\n\n`;
  }

  return m3u;
}

/**
 * Formats a playlist into our specific branded JSON structure
 */
export function generateJSON(playlist: StandardPlaylist): any {
  return generateRawChannelsArray(playlist);
}
