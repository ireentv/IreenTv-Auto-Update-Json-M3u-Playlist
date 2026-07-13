import json
import os
import re
import urllib.request
from datetime import datetime

# Custom Branding Configurations
BRANDING = {
    "status": "success",
    "owner": "MD ANAMUL HOQUE",
    "telegram": "https://t.me/ireentv",
    "website": "https://anamul.pages.dev",
    "developer": "IreenTechnology",
    "version": "1.0"
}

def fetch_content(url):
    """Fetches text content from the remote URL with User-Agent header"""
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def parse_m3u(content):
    """Parses standard M3U playlists into clean structured Channel dictionaries"""
    channels = []
    lines = content.splitlines()
    current_channel = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith('#EXTINF:'):
            current_channel = {}
            # Extract tvg-logo
            logo_match = re.search(r'tvg-logo="([^"]+)"', line) or re.search(r'logo="([^"]+)"', line)
            current_channel['logo'] = logo_match.group(1) if logo_match else ""
            
            # Extract group-title (category)
            group_match = re.search(r'group-title="([^"]+)"', line) or re.search(r'category="([^"]+)"', line)
            current_channel['group'] = group_match.group(1) if group_match else "General"
            
            # Extract channel name (everything after the last comma)
            comma_idx = line.rfind(',')
            if comma_idx != -1:
                current_channel['name'] = line[comma_idx+1:].strip()
            else:
                tvg_name_match = re.search(r'tvg-name="([^"]+)"', line)
                current_channel['name'] = tvg_name_match.group(1) if tvg_name_match else "Channel"
                
        elif line.startswith('#EXTVLCOPT:'):
            # Parse user-agents / referers if present
            ua_match = re.search(r'http-user-agent="([^"]+)"', line) or re.search(r'http-user-agent=([^\\s]+)', line)
            if ua_match:
                if 'headers' not in current_channel:
                    current_channel['headers'] = {}
                current_channel['headers']['User-Agent'] = ua_match.group(1)
        elif not line.startswith('#'):
            current_channel['url'] = line
            if 'name' not in current_channel:
                current_channel['name'] = f"Channel {len(channels) + 1}"
            if 'logo' not in current_channel:
                current_channel['logo'] = ""
            if 'group' not in current_channel:
                current_channel['group'] = "General"
                
            # Handle inline User-Agent options like url|User-Agent=...
            if '|' in line:
                parts = line.split('|')
                current_channel['url'] = parts[0]
                if 'headers' not in current_channel:
                    current_channel['headers'] = {}
                for part in parts[1:]:
                    if part.lower().startswith('user-agent='):
                        current_channel['headers']['User-Agent'] = part[11:]
            
            channels.append(current_channel)
            current_channel = {}
            
    return channels

def parse_json_playlist(data):
    """Recursively searches for channel or match array within complex JSON structures"""
    channels_list = []
    
    # Check common list keywords case-insensitively
    target_array = None
    priority_keys = ['channels', 'matches', 'streams', 'items', 'live', 'data', 'list']
    
    if isinstance(data, list):
        target_array = data
    elif isinstance(data, dict):
        for key in data.keys():
            if key.lower() in priority_keys and isinstance(data[key], list):
                target_array = data[key]
                break
                
        # Fallback: find any list that contains objects
        if not target_array:
            for key, val in data.items():
                if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                    target_array = val
                    break
                    
    if not target_array:
        return []
        
    for item in target_array:
        if not isinstance(item, dict):
            continue
            
        # Copy the original item entirely to preserve all keys and values
        channel_obj = dict(item)
            
        # 1. Resolve standard Name (Case-insensitive)
        name = ""
        # Priority 1: Exact matches
        name_keys = [
            'name', 'title', 'channel_name', 'match_name', 'label', 'displayname', 
            'matchname', 'videoname', 'categoryname', 'event_name', 'eventname', 
            'broadcast_channel', 'channelname'
        ]
        for k, v in item.items():
            if k.lower() in name_keys:
                name = str(v)
                break
        # Priority 2: Contains substring
        if not name:
            for k, v in item.items():
                k_lower = k.lower()
                if any(sub in k_lower for sub in ['name', 'title', 'label', 'channel', 'match', 'video', 'event']):
                    name = str(v)
                    break
        # Priority 3: Fallback to first string field
        if not name:
            for k, v in item.items():
                if isinstance(v, str) and len(v.strip()) > 0 and not v.strip().startswith('http'):
                    name = v.strip()
                    break
        # Final fallback
        if not name:
            name = f"Channel {len(channels_list) + 1}"

        # 2. Resolve standard URL (Case-insensitive)
        url = ""
        # Priority 1: Exact matches
        url_keys = [
            'url', 'link', 'stream', 'stream_url', 'stream_link', 'source', 'uri', 
            'm3u8', 'streamurl', 'playurl', 'play_url', 'playurl', 'play_link', 'hls', 'hls_url'
        ]
        for k, v in item.items():
            if k.lower() in url_keys:
                url = str(v)
                break
        # Priority 2: Contains substring or is a URL value
        if not url:
            for k, v in item.items():
                k_lower = k.lower()
                if any(sub in k_lower for sub in ['url', 'link', 'stream', 'm3u8', 'uri', 'play']):
                    if isinstance(v, str) and (v.startswith('http') or '.m3u8' in v):
                        url = str(v)
                        break
        if not url:
            for k, v in item.items():
                if isinstance(v, str) and (v.startswith('http://') or v.startswith('https://')) and not any(sub in k.lower() for sub in ['logo', 'image', 'img', 'thumb', 'icon', 'poster', 'src']):
                    url = v
                    break

        # 3. Resolve standard Logo (Case-insensitive)
        logo = ""
        # Priority 1: Exact matches
        logo_keys = [
            'logo', 'image', 'logo_url', 'thumbnail', 'img', 'icon', 'channel_logo', 
            'poster', 'logourl', 'imageurl', 'thumbnailstandard', 'thumbnailtv', 'src'
        ]
        for k, v in item.items():
            if k.lower() in logo_keys:
                logo = str(v)
                break
        # Priority 2: Contains substring
        if not logo:
            for k, v in item.items():
                k_lower = k.lower()
                if any(sub in k_lower for sub in ['logo', 'image', 'img', 'thumb', 'icon', 'poster', 'src']):
                    logo = str(v)
                    break

        # 4. Resolve standard Group / Category (Case-insensitive)
        group = "General"
        # Priority 1: Exact matches
        group_keys = [
            'group', 'category', 'genre', 'group-title', 'type', 'sportname', 
            'sport', 'event_category', 'eventcategory'
        ]
        for k, v in item.items():
            if k.lower() in group_keys:
                group = str(v)
                break
        # Priority 2: Contains substring
        if group == "General":
            for k, v in item.items():
                k_lower = k.lower()
                if any(sub in k_lower for sub in ['group', 'category', 'genre', 'sport', 'type']):
                    group = str(v)
                    break

        # 5. Resolve standard Status (Case-insensitive)
        status = ""
        # Priority 1: Exact matches
        status_keys = ['status', 'live', 'islive']
        for k, v in item.items():
            if k.lower() in status_keys:
                status = str(v)
                break
        # Priority 2: Check value of isLive boolean
        if not status:
            for k, v in item.items():
                if k.lower() in ['islive', 'live'] and isinstance(v, bool):
                    status = "Live" if v else "Upcoming"
                    break

        # 6. Resolve headers (Case-insensitive)
        headers = None
        for k, v in item.items():
            if k.lower() in ['headers', 'header', 'http_headers'] and isinstance(v, dict):
                headers = v
                break

        # Standardize and populate properties in channel_obj (ensure no loss and strict compatibility)
        channel_obj["name"] = name
        channel_obj["logo"] = logo
        channel_obj["url"] = url
        channel_obj["group"] = group
        
        if status:
            channel_obj["status"] = status
        elif "status" not in channel_obj:
            # Check if any event_name or event matches contain 'upcoming' or 'live'
            name_lower = name.lower()
            if 'upcoming' in name_lower:
                channel_obj["status"] = "Upcoming"
            elif 'live' in name_lower:
                channel_obj["status"] = "Live"
            else:
                channel_obj["status"] = "Live" # Default
                
        if headers:
            channel_obj["headers"] = headers

        channels_list.append(channel_obj)
            
    return channels_list

def generate_m3u_file(brand, channels, name):
    """Outputs branded M3U text format"""
    m3u = f"#EXTM3U\n"
    m3u += f"# Playlist Name: {name}\n"
    m3u += f"# Owner: {brand['owner']}\n"
    m3u += f"# Telegram: {brand['telegram']}\n"
    m3u += f"# Website: {brand['website']}\n"
    m3u += f"# Developer: {brand['developer']}\n"
    m3u += f"# Version: {brand['version']}\n"
    m3u += f"# Channels Amount: {len(channels)}\n"
    m3u += f"# Last Update: {brand['Last_update']}\n\n"
    
    for ch in channels:
        logo_attr = f' tvg-logo="{ch["logo"]}"' if ch.get("logo") else ""
        group_attr = f' group-title="{ch["group"]}"' if ch.get("group") else ""
        m3u += f"#EXTINF:-1{logo_attr}{group_attr},{ch['name']}\n"
        
        # User agents / custom HTTP headers
        if "headers" in ch and isinstance(ch["headers"], dict):
            for k, v in ch["headers"].items():
                if k.lower() == 'user-agent':
                    m3u += f"#EXTVLCOPT:http-user-agent={v}\n"
                elif k.lower() == 'referer':
                    m3u += f"#EXTVLCOPT:http-referrer={v}\n"
                    
        url_to_write = ch['url'] if ch.get('url') else "https://upcoming-match-no-stream.m3u8"
        m3u += f"{url_to_write}\n\n"
        
    return m3u

def main():
    print("Starting automated playlist synchronization...")
    
    # List of supported configuration filenames in priority order
    possible_config_files = ["device.json", "playlists.json", "playlist.json", "config.json"]
    config_file = None
    
    for filename in possible_config_files:
        if os.path.exists(filename):
            config_file = filename
            break
            
    if not config_file:
        print(f"Error: No configuration file found. Please create one of: {', '.join(possible_config_files)}")
        return
        
    print(f"Loading settings from: {config_file}")
    with open(config_file, "r", encoding="utf-8") as f:
        config_data = json.load(f)
        
    BRANDING["Last_update"] = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
    
    for item in config_data.get("playlists", []):
        name = item.get("name")
        url = item.get("url")
        print(f"Processing playlist: {name}...")
        
        raw_content = fetch_content(url)
        if not raw_content:
            print(f"Warning: Could not fetch channels from {url}")
            continue
            
        # Parse based on content type
        channels = []
        trimmed = raw_content.strip()
        
        if trimmed.startswith('#EXTM3U'):
            channels = parse_m3u(raw_content)
        else:
            try:
                json_data = json.loads(raw_content)
                channels = parse_json_playlist(json_data)
            except Exception:
                if '#EXTINF' in raw_content or 'http' in raw_content:
                    channels = parse_m3u(raw_content)
                    
        if not channels:
            print(f"Warning: No channels detected in {name}")
            continue
            
        print(f"Extracted {len(channels)} channels.")
        
        # 1. Output Branded .json file
        json_output = {
            "status": BRANDING["status"],
            "owner": BRANDING["owner"],
            "telegram": BRANDING["telegram"],
            "website": BRANDING["website"],
            "developer": BRANDING["developer"],
            "version": BRANDING["version"],
            "name": name,
            "channels_amount": len(channels),
            "Last_update": BRANDING["Last_update"],
            "channels": channels
        }
        
        with open(f"{name}.json", "w", encoding="utf-8") as out_f:
            json.dump(json_output, out_f, indent=2, ensure_ascii=False)
            
        # 2. Output Branded .m3u file
        m3u_content = generate_m3u_file(BRANDING, channels, name)
        with open(f"{name}.m3u", "w", encoding="utf-8") as out_f:
            out_f.write(m3u_content)
            
        print(f"Created/Updated {name}.json and {name}.m3u successfully.")

if __name__ == "__main__":
    main()
