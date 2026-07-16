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
    
    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF attributes
      // Format: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="..." , Channel Name
      currentChannel = {};
      
      // Extract tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]+)"/) || line.match(/logo="([^"]+)"/);
      if (logoMatch) {
        currentChannel.logo = logoMatch[1];
      }
      
      // Extract group-title
      const groupMatch = line.match(/group-title="([^"]+)"/) || line.match(/category="([^"]+)"/);
      if (groupMatch) {
        currentChannel.group = groupMatch[1];
      }
      
      // Extract name (everything after the last comma)
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentChannel.name = line.substring(commaIndex + 1).trim();
      } else {
        // Fallback: extract tvg-name
        const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
        if (tvgNameMatch) {
          currentChannel.name = tvgNameMatch[1];
        }
      }
    } else if (line.startsWith('#EXTVLCOPT:')) {
      // Parse VLC options like User-Agent
      // Format: #EXTVLCOPT:http-user-agent=Mozilla/5.0...
      const uaMatch = line.match(/http-user-agent=([^\s]+)/) || line.match(/http-user-agent="([^"]+)"/);
      if (uaMatch) {
        currentChannel.headers = currentChannel.headers || {};
        currentChannel.headers['User-Agent'] = uaMatch[1];
      }
      
      const referrerMatch = line.match(/http-referrer=([^\s]+)/) || line.match(/http-referrer="([^"]+)"/);
      if (referrerMatch) {
        currentChannel.headers = currentChannel.headers || {};
        currentChannel.headers['Referer'] = referrerMatch[1];
      }
    } else if (line && !line.startsWith('#')) {
      // This is the stream URL
      currentChannel.url = line;
      if (!currentChannel.name) {
        currentChannel.name = `Channel ${channels.length + 1}`;
      }
      if (!currentChannel.logo) {
        currentChannel.logo = '';
      }
      
      // Also look for headers in subsequent comment lines or inline parameters (like user-agent)
      // Sometimes URL itself has headers like http://stream...|User-Agent=...
      if (line.includes('|')) {
        const parts = line.split('|');
        currentChannel.url = parts[0];
        currentChannel.headers = currentChannel.headers || {};
        for (let p = 1; p < parts.length; p++) {
          const opt = parts[p];
          if (opt.toLowerCase().startsWith('user-agent=')) {
            currentChannel.headers['User-Agent'] = opt.substring(11);
          } else if (opt.toLowerCase().startsWith('referer=')) {
            currentChannel.headers['Referer'] = opt.substring(8);
          } else if (opt.includes('=')) {
            const [key, val] = opt.split('=');
            currentChannel.headers[key] = val;
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
    const logoAttr = ch.logo ? ` tvg-logo="${ch.logo}"` : '';
    const groupAttr = ch.group ? ` group-title="${ch.group}"` : '';
    
    m3u += `#EXTINF:-1${logoAttr}${groupAttr},${ch.name}\n`;
    
    // Add headers as EXTINF attributes or EXTVLCOPT if present
    if (ch.headers) {
      for (const [key, val] of Object.entries(ch.headers)) {
        if (key.toLowerCase() === 'user-agent') {
          m3u += `#EXTVLCOPT:http-user-agent=${val}\n`;
        } else if (key.toLowerCase() === 'referer') {
          m3u += `#EXTVLCOPT:http-referrer=${val}\n`;
        }
      }
    }
    
    m3u += `${ch.url}\n\n`;
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
