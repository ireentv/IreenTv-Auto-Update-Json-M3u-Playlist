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
    const nameKeys = ['name', 'title', 'channel_name', 'match_name', 'Label', 'displayName', 'matchName'];
    let name = '';
    for (const k of nameKeys) {
      if (item[k]) {
        name = String(item[k]);
        break;
      }
    }
    
    // Find stream URL
    const urlKeys = ['url', 'link', 'stream', 'stream_url', 'stream_link', 'source', 'uri', 'm3u8', 'm3u8_url', 'streamUrl', 'streamLink'];
    let url = '';
    for (const k of urlKeys) {
      if (item[k]) {
        url = String(item[k]);
        break;
      }
    }
    
    // Find logo
    const logoKeys = ['logo', 'image', 'logo_url', 'thumbnail', 'img', 'icon', 'channel_logo', 'poster', 'logoUrl', 'imageUrl'];
    let logo = '';
    for (const k of logoKeys) {
      if (item[k]) {
        logo = String(item[k]);
        break;
      }
    }
    
    // Find group/category
    const groupKeys = ['group', 'category', 'genre', 'group-title', 'type', 'stream_category', 'sportName'];
    let group = '';
    for (const k of groupKeys) {
      if (item[k]) {
        group = String(item[k]);
        break;
      }
    }
    
    // Find custom HTTP headers (frequently present in modern auto-updating lists)
    let headers: Record<string, string> | undefined = undefined;
    const headerKeys = ['headers', 'header', 'http_headers', 'header_info'];
    for (const k of headerKeys) {
      if (item[k] && typeof item[k] === 'object') {
        headers = { ...item[k] };
        break;
      }
    }
    
    // If we have a URL, add it
    if (url) {
      channels.push({
        name: name || `Channel ${channels.length + 1}`,
        logo: logo || '',
        url,
        group: group || 'General',
        headers
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
 * Formats a list of channels into an M3U playlist file with custom branded header
 */
export function generateM3U(playlist: StandardPlaylist): string {
  const b = playlist.branding;
  let m3u = `#EXTM3U
# Playlist Name: ${b.name}
# Owner: ${b.owner}
# Telegram: ${b.telegram}
# Website: ${b.website}
# Developer: ${b.developer}
# Version: ${b.version}
# Channels Amount: ${b.channels_amount}
# Last Update: ${b.Last_update}

`;

  for (const ch of playlist.channels) {
    const attrsToWrite: Record<string, string> = {};
    if (ch.attrs) {
      Object.assign(attrsToWrite, ch.attrs);
    }
    
    // Ensure name, logo, group are written with correct standard keys
    if (ch.logo) {
      attrsToWrite['tvg-logo'] = ch.logo;
    }
    if (ch.group && ch.group !== 'General') {
      attrsToWrite['group-title'] = ch.group;
    }
    if (ch.name) {
      attrsToWrite['tvg-name'] = ch.name;
    }
    if (ch.status) {
      attrsToWrite['status'] = ch.status;
    }
    
    // Clean up key duplicates/variations
    delete attrsToWrite['logo'];
    delete attrsToWrite['category'];
    delete attrsToWrite['group'];
    delete attrsToWrite['name'];
    
    let attrsStr = '';
    for (const [k, v] of Object.entries(attrsToWrite)) {
      attrsStr += ` ${k}="${v}"`;
    }
    
    m3u += `#EXTINF:-1${attrsStr},${ch.name}\n`;
    
    // Write custom VLC options if present
    if (ch.vlc_opts && Array.isArray(ch.vlc_opts)) {
      for (const opt of ch.vlc_opts) {
        m3u += `#EXTVLCOPT:${opt}\n`;
      }
    }
    
    // Write standard HTTP headers from ch.headers as EXTVLCOPT
    if (ch.headers) {
      for (const [key, val] of Object.entries(ch.headers)) {
        if (key.toLowerCase() === 'user-agent') {
          m3u += `#EXTVLCOPT:http-user-agent=${val}\n`;
        } else if (key.toLowerCase() === 'referer') {
          m3u += `#EXTVLCOPT:http-referrer=${val}\n`;
        } else if (key.toLowerCase() === 'origin') {
          m3u += `#EXTVLCOPT:http-origin=${val}\n`;
        }
      }
    }
    
    // Write custom KODIPROP lines if present
    if (ch.kodiprops && Array.isArray(ch.kodiprops)) {
      for (const prop of ch.kodiprops) {
        m3u += `#KODIPROP:${prop}\n`;
      }
    }
    
    let urlToWrite = ch.url_raw || ch.url || "https://upcoming-match-no-stream.m3u8";
    if (!ch.url_raw && ch.url && ch.headers) {
      const inlineHeaders: string[] = [];
      for (const [hk, hv] of Object.entries(ch.headers)) {
        if (!['user-agent', 'referer', 'origin'].includes(hk.toLowerCase())) {
          inlineHeaders.push(`${hk}:${hv}`);
        }
      }
      if (inlineHeaders.length > 0) {
        urlToWrite = `${ch.url}|${inlineHeaders.join('|')}`;
      }
    }
    
    m3u += `${urlToWrite}\n\n`;
  }
  
  return m3u;
}

/**
 * Formats a playlist into our specific branded JSON structure
 */
export function generateJSON(playlist: StandardPlaylist): any {
  const b = playlist.branding;
  return {
    status: b.status,
    owner: b.owner,
    telegram: b.telegram,
    website: b.website,
    developer: b.developer,
    version: b.version,
    name: b.name,
    channels_amount: playlist.channels.length,
    Last_update: b.Last_update,
    channels: playlist.channels
  };
}
