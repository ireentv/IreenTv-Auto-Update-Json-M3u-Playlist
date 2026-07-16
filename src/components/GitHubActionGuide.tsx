import React, { useState } from 'react';
import { PlaylistBranding } from '../types';
import { 
  Github, 
  Copy, 
  Check, 
  Terminal, 
  Settings, 
  ShieldAlert, 
  BookOpen, 
  Plus, 
  Trash2, 
  FileCode, 
  FileJson, 
  ListOrdered,
  Clock,
  Play,
  Download
} from 'lucide-react';

interface GitHubActionGuideProps {
  sourceUrl: string;
  branding: PlaylistBranding;
}

interface PlaylistItem {
  name: string;
  url: string;
}

export const GitHubActionGuide: React.FC<GitHubActionGuideProps> = ({ sourceUrl, branding }) => {
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([
    {
      name: 'tapmad_bd',
      url: 'https://raw.githubusercontent.com/srhady/tapmad-bd/main/tapmad_bd.m3u'
    },
    {
      name: 'sonyliv',
      url: 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.m3u'
    },
    {
      name: 'toffee_channel_data',
      url: 'https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/main/toffee_channel_data.json'
    }
  ]);

  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'workflow' | 'script' | 'config' | 'requirements'>('workflow');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleAddPlaylist = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    
    // Normalize playlist name to prevent file-system issue characters
    const cleanName = newName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    setPlaylists([...playlists, { name: cleanName, url: newUrl.trim() }]);
    setNewName('');
    setNewUrl('');
  };

  const handleRemovePlaylist = (index: number) => {
    setPlaylists(playlists.filter((_, i) => i !== index));
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // 1. Generate auto_sync.yml (Cron running every 30 minutes as requested!)
  const yamlContent = `# .github/workflows/auto_sync.yml
name: Auto update playlist & json

on:
  schedule:
    # Runs every 30 minutes!
    - cron: '*/30 * * * *'
  workflow_dispatch: # Allows manual trigger from GitHub Actions tab

permissions:
  contents: write # Grants permission to commit updates back to the repo

jobs:
  sync-job:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
          cache: 'pip'

      - name: Install Dependencies
        run: |
          pip install -r requirements.txt

      - name: Run Auto-Sync Script
        run: python sync.py

      - name: Commit and Push Changes
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"
          
          # Detect modified/added files
          git add .
          
          if [ -n "$(git status --porcelain)" ]; then
            git commit -m "Auto update playlist & json: $(date -u +'%Y-%m-%d %H:%M:%S') UTC"
            git push origin main
            echo "changed" > changed.flag
          else
            echo "No changes detected."
          fi
`;

  // 2. Generate Python sync.py matching user screenshot precisely
  const pyScriptContent = `import json
import os
import re
import urllib.request
from datetime import datetime

# Custom Branding Configurations
BRANDING = {
    "status": "${branding.status}",
    "owner": "${branding.owner.replace(/"/g, '\\"')}",
    "telegram": "${branding.telegram.replace(/"/g, '\\"')}",
    "website": "${branding.website.replace(/"/g, '\\"')}",
    "developer": "${branding.developer.replace(/"/g, '\\"')}",
    "version": "${branding.version}"
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
            
            # Extract all attributes in key="value" format
            attrs = {}
            for k, v in re.findall(r'([a-zA-Z0-9_-]+)="([^"]*)"', line):
                attrs[k] = v
            
            # Extract tvg-logo
            current_channel['logo'] = attrs.get('tvg-logo') or attrs.get('logo') or ""
            
            # Extract group-title (category)
            current_channel['group'] = attrs.get('group-title') or attrs.get('category') or "General"
            
            # Extract channel name (everything after the last comma)
            comma_idx = line.rfind(',')
            if comma_idx != -1:
                current_channel['name'] = line[comma_idx+1:].strip()
            else:
                current_channel['name'] = attrs.get('tvg-name') or "Channel"
                
            # Remove keys from attrs that are mapped to root fields to avoid duplication in JSON
            for key in list(attrs.keys()):
                if key.lower() in ['tvg-logo', 'logo', 'group-title', 'category', 'tvg-name', 'name']:
                    del attrs[key]
            
            if attrs:
                current_channel['attrs'] = attrs
                
        elif line.startswith('#EXTVLCOPT:'):
            opt_content = line[len('#EXTVLCOPT:'):].strip()
            
            if '=' in opt_content:
                k, v = opt_content.split('=', 1)
                k = k.strip()
                v = v.strip()
                if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                    v = v[1:-1]
                
                is_http_header = k.lower() in ['http-user-agent', 'http-referrer', 'http-origin']
                
                if 'headers' not in current_channel:
                    current_channel['headers'] = {}
                
                if k.lower() == 'http-user-agent':
                    current_channel['headers']['User-Agent'] = v
                elif k.lower() == 'http-referrer':
                    current_channel['headers']['Referer'] = v
                elif k.lower() == 'http-origin':
                    current_channel['headers']['Origin'] = v
                else:
                    current_channel['headers'][k] = v
                    
                # If it's not a standard HTTP header option, keep in vlc_opts
                if not is_http_header:
                    if 'vlc_opts' not in current_channel:
                        current_channel['vlc_opts'] = []
                    current_channel['vlc_opts'].append(opt_content)
            else:
                if 'vlc_opts' not in current_channel:
                    current_channel['vlc_opts'] = []
                current_channel['vlc_opts'].append(opt_content)
        elif line.startswith('#KODIPROP:'):
            prop_content = line[len('#KODIPROP:'):].strip()
            if 'kodiprops' not in current_channel:
                current_channel['kodiprops'] = []
            current_channel['kodiprops'].append(prop_content)
        elif line.startswith('#EXTHTTP:'):
            http_content = line[len('#EXTHTTP:'):].strip()
            if 'exthttps' not in current_channel:
                current_channel['exthttps'] = []
            current_channel['exthttps'].append(http_content)
            # Also extract headers from EXTHTTP if it is valid JSON
            try:
                import json
                parsed_http = json.loads(http_content)
                if parsed_http and isinstance(parsed_http, dict):
                    if 'headers' not in current_channel:
                        current_channel['headers'] = {}
                    for k, v in parsed_http.items():
                        if k.lower() == 'user-agent':
                            current_channel['headers']['User-Agent'] = str(v)
                        elif k.lower() == 'referer':
                            current_channel['headers']['Referer'] = str(v)
                        elif k.lower() == 'origin':
                            current_channel['headers']['Origin'] = str(v)
                        else:
                            current_channel['headers'][k] = str(v)
            except Exception:
                pass
        elif not line.startswith('#'):
            current_channel['url'] = line
            current_channel['url_raw'] = line
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
    
    # Check common list keywords
    target_array = None
    priority_keys = ['channels', 'matches', 'streams', 'items', 'live', 'data', 'list']
    
    if isinstance(data, list):
        target_array = data
    elif isinstance(data, dict):
        for key in priority_keys:
            if key in data and isinstance(data[key], list):
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
            
        # Parse channel properties dynamically
        name = ""
        for k in ['name', 'title', 'channel_name', 'match_name', 'Label', 'displayName', 'matchName']:
            if k in item:
                name = str(item[k])
                break
                
        url = ""
        for k in ['url', 'link', 'stream', 'stream_url', 'stream_link', 'source', 'uri', 'm3u8', 'streamUrl']:
            if k in item:
                url = str(item[k])
                break
                
        logo = ""
        for k in ['logo', 'image', 'logo_url', 'thumbnail', 'img', 'icon', 'channel_logo', 'poster', 'logoUrl', 'imageUrl']:
            if k in item:
                logo = str(item[k])
                break
                
        group = "General"
        for k in ['group', 'category', 'genre', 'group-title', 'type', 'sportName']:
            if k in item:
                group = str(item[k])
                break
                
        headers = None
        for k in ['headers', 'header', 'http_headers']:
            if k in item and isinstance(item[k], dict):
                headers = item[k]
                break
                
        exthttps = None
        for k in ['exthttps', 'exthttp', 'ext_https', 'ext_http']:
            if k in item:
                if isinstance(item[k], list):
                    exthttps = [str(x) for x in item[k]]
                elif isinstance(item[k], str):
                    exthttps = [item[k]]
                break
                
        kodiprops = None
        for k in ['kodiprops', 'kodiprop', 'kodi_props', 'kodi']:
            if k in item:
                if isinstance(item[k], list):
                    kodiprops = [str(x) for x in item[k]]
                elif isinstance(item[k], dict):
                    kodiprops = [f"{pk}={pv}" for pk, pv in item[k].items()]
                break
                
        if url:
            channel_obj = {
                "name": name if name else f"Channel {len(channels_list) + 1}",
                "logo": logo,
                "url": url,
                "group": group
            }
            if headers:
                channel_obj["headers"] = headers
            if exthttps:
                channel_obj["exthttps"] = exthttps
            if kodiprops:
                channel_obj["kodiprops"] = kodiprops
            if 'status' in item:
                channel_obj["status"] = str(item["status"])
            if 'attrs' in item and isinstance(item["attrs"], dict):
                channel_obj["attrs"] = item["attrs"]
            if 'vlc_opts' in item and isinstance(item["vlc_opts"], list):
                channel_obj["vlc_opts"] = [str(x) for x in item["vlc_opts"]]
            if 'url_raw' in item:
                channel_obj["url_raw"] = str(item["url_raw"])
                
            channels_list.append(channel_obj)
            
    return channels_list

def generate_m3u_file(brand, channels, name):
    """Outputs branded M3U text format"""
    m3u = f"#EXTM3U\\n"
    m3u += f"# Playlist Name: {name}\\n"
    m3u += f"# Owner: {brand['owner']}\\n"
    m3u += f"# Telegram: {brand['telegram']}\\n"
    m3u += f"# Website: {brand['website']}\\n"
    m3u += f"# Developer: {brand['developer']}\\n"
    m3u += f"# Version: {brand['version']}\\n"
    m3u += f"# Channels Amount: {len(channels)}\\n"
    m3u += f"# Last Update: {brand['Last_update']}\\n\\n"
    
    for ch in channels:
        # Reconstruct #EXTINF using parsed attrs dictionary to preserve all original attributes
        attrs_to_write = {}
        if ch.get("attrs") and isinstance(ch["attrs"], dict):
            attrs_to_write.update(ch["attrs"])
            
        # Ensure standard keys are present if we have them in the main fields
        if ch.get("logo"):
            attrs_to_write["tvg-logo"] = ch["logo"]
        if ch.get("group") and ch.get("group") != "General":
            attrs_to_write["group-title"] = ch["group"]
        if ch.get("name"):
            attrs_to_write["tvg-name"] = ch["name"]
        if ch.get("status"):
            attrs_to_write["status"] = ch["status"]
            
        # Clean up duplicate key variations
        for key_to_del in ['logo', 'category', 'group', 'name']:
            if key_to_del in attrs_to_write:
                del attrs_to_write[key_to_del]
                
        if attrs_to_write:
            attrs_str = ""
            for k, v in attrs_to_write.items():
                attrs_str += f' {k}="{v}"'
            m3u += f"#EXTINF:-1{attrs_str},{ch['name']}\\n"
        else:
            m3u += f"#EXTINF:-1,{ch['name']}\\n"
            
        # Write custom VLCOPT lines if they were parsed
        if ch.get("vlc_opts") and isinstance(ch["vlc_opts"], list):
            for opt in ch["vlc_opts"]:
                m3u += f"#EXTVLCOPT:{opt}\\n"
        else:
            # Fallback to reconstructing headers as EXTVLCOPT
            if "headers" in ch and isinstance(ch["headers"], dict):
                for k, v in ch["headers"].items():
                    if k.lower() == 'user-agent':
                        m3u += f"#EXTVLCOPT:http-user-agent={v}\\n"
                    elif k.lower() == 'referer':
                        m3u += f"#EXTVLCOPT:http-referrer={v}\\n"
                    elif k.lower() == 'origin':
                        m3u += f"#EXTVLCOPT:http-origin={v}\\n"
                        
        # Write custom KODIPROP lines if they were parsed
        if ch.get("kodiprops") and isinstance(ch["kodiprops"], list):
            for prop in ch["kodiprops"]:
                m3u += f"#KODIPROP:{prop}\\n"
                
        # Write custom EXTHTTP lines if they were parsed
        if ch.get("exthttps") and isinstance(ch["exthttps"], list):
            for http in ch["exthttps"]:
                m3u += f"#EXTHTTP:{http}\\n"
                
        url_to_write = ch.get('url_raw') or ch.get('url') or "https://upcoming-match-no-stream.m3u8"
        if not ch.get('url_raw') and ch.get('url') and ch.get('headers') and isinstance(ch['headers'], dict):
            # Reconstruct inline headers if url_raw is not present and custom headers exist
            inline_headers = []
            for hk, hv in ch['headers'].items():
                if hk.lower() not in ['user-agent', 'referer', 'origin']:
                    inline_headers.append(f"{hk}:{hv}")
            if inline_headers:
                url_to_write = f"{ch['url']}|" + "|".join(inline_headers)
                
        m3u += f"{url_to_write}\\n\\n"
        
    return m3u

def main():
    print("Starting automated playlist synchronization...")
    
    # Load settings from playlists.json
    if not os.path.exists("playlists.json"):
        print("Error: playlists.json not found.")
        return
        
    with open("playlists.json", "r", encoding="utf-8") as f:
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
`;

  // 3. Generate playlists.json configuration
  const playlistsJsonContent = JSON.stringify({ playlists }, null, 2);

  // 4. Generate requirements.txt
  const requirementsContent = `requests==2.31.0
urllib3==2.0.7
`;

  // Trigger file downloads
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const element = document.createElement('a');
    element.href = URL.createObjectURL(blob);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div id="github-actions-guide-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Github className="w-5 h-5 text-emerald-400" />
            GitHub Actions অটো-আপডেটার সেটআপ গাইড (৩0 মিনিট পর পর আপডেট)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            আপনার গিটহাব রিপোজিটরিতে এটি সেটআপ করুন। আপনি যখনই কোনো নতুন প্লেলিস্ট যোগ করবেন, সেটি স্বয়ংক্রিয়ভাবে <code className="text-emerald-400 font-mono">.m3u</code> ও <code className="text-emerald-400 font-mono">.json</code> ফাইলে ৩০ মিনিট পরপর সিঙ্ক করে নিবে!
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs gap-1">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'workflow' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ১. auto_sync.yml
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'script' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ২. sync.py (স্ক্রিপ্ট)
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'config' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ৩. device.json
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'requirements' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ৪. requirements.txt
          </button>
        </div>
      </div>

      {/* Playlists Management Panel */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <ListOrdered className="w-4.5 h-4.5 text-emerald-400" />
            আপনার অটো-আপডেট প্লেলিস্ট সমূহ ({playlists.length}টি সোর্স)
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            নিচের লিস্টে আপনার পছন্দমতো যেকোনো প্লেলিস্ট যোগ বা রিমুভ করুন। স্ক্রিপ্টটি স্বয়ংক্রিয়ভাবে এগুলোকে কনভার্ট করবে!
          </p>
        </div>

        {/* Playlist Table */}
        <div className="border border-slate-900 rounded-xl overflow-hidden text-xs max-h-[220px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-900">
                <th className="p-3">ফাইল নাম (Output Name)</th>
                <th className="p-3">অরিজিনাল প্লে-লিস্ট লিংক (Source URL)</th>
                <th className="p-3 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {playlists.map((pl, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40">
                  <td className="p-3 font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
                    {pl.name}
                    <span className="text-[9px] font-normal text-slate-500">(.m3u / .json)</span>
                  </td>
                  <td className="p-3 font-mono text-slate-400 truncate max-w-[280px]" title={pl.url}>
                    {pl.url}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleRemovePlaylist(idx)}
                      className="p-1.5 bg-slate-900 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition"
                      title="Remove from sync list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add item fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <input
            type="text"
            placeholder="আউটপুট নাম (যেমন: tapmad_live)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none transition"
          />
          <input
            type="text"
            placeholder="প্লেলিস্ট সোর্স URL (M3U বা JSON)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none transition font-mono sm:col-span-2 flex-grow"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAddPlaylist}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            লিস্টে যুক্ত করুন
          </button>
        </div>
      </div>

      {/* Main setup layout splits */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Step-by-step documentation left */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-950/50 rounded-2xl p-5 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2.5 uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              ইনস্টলেশন গাইড (Setup Steps)
            </h3>
            
            <ul className="space-y-4 text-xs text-slate-300">
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5.5 h-5.5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[11px] font-mono">১</span>
                <div>
                  <p className="font-semibold text-slate-100">প্রয়োজনীয় ৪টি ফাইল ক্রিয়েট করুন</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">আপনার গিটহাবের রুট ডিরেক্টরিতে ডান পাশের ৪টি ট্যাব থেকে কোড কপি করে ফাইলগুলো তৈরি করুন: <code className="text-emerald-400 font-mono">sync.py</code>, <code className="text-emerald-400 font-mono">device.json</code>, ও <code className="text-emerald-400 font-mono">requirements.txt</code></p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5.5 h-5.5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[11px] font-mono">২</span>
                <div>
                  <p className="font-semibold text-slate-100">Workflow ফাইল তৈরি করুন</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">রিপোজিটরির রুট থেকে <code className="text-emerald-400 font-mono">.github/workflows/auto_sync.yml</code> ফোল্ডার ও ফাইলটি তৈরি করে ১ নম্বর ট্যাবের Workflow YAML পেস্ট করুন।</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5.5 h-5.5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[11px] font-mono">৩</span>
                <div>
                  <p className="font-semibold text-slate-100">Workflow Permissions সচল করুন</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">গিটহাব রিপোজিটরির <strong>Settings &gt; Actions &gt; General &gt; Workflow permissions</strong> এ গিয়ে <strong>"Read and write permissions"</strong> সিলেক্ট করে সেভ করুন।</p>
                </div>
              </li>
              <li className="flex gap-2.5 text-emerald-400">
                <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">১০০% অটো-আপডেট রেডি!</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">এখন থেকে প্রতি ৩০ মিনিট পর পর গিটহাব ওয়ার্কার স্বয়ংক্রিয়ভাবে অরিজিনাল সোর্স থেকে ডাটা নিয়ে আপনার ওনার ক্রেডিট সহ ফাইলগুলো সেভ করবে।</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Code Content View Right */}
        <div className="lg:col-span-3 space-y-3">
          {activeTab === 'workflow' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-400">পাথ: .github/workflows/auto_sync.yml</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(yamlContent, 'workflow')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-1.5 transition text-[11px]"
                  >
                    {copiedText === 'workflow' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    কপি
                  </button>
                  <button
                    onClick={() => downloadFile(yamlContent, 'auto_sync.yml')}
                    className="p-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-300 rounded-lg transition"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl border border-slate-800 max-h-[350px] overflow-auto select-all whitespace-pre">
                {yamlContent}
              </pre>
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-400">পাথ: sync.py</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(pyScriptContent, 'script')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-1.5 transition text-[11px]"
                  >
                    {copiedText === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    কপি
                  </button>
                  <button
                    onClick={() => downloadFile(pyScriptContent, 'sync.py')}
                    className="p-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-300 rounded-lg transition"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl border border-slate-800 max-h-[350px] overflow-auto select-all whitespace-pre">
                {pyScriptContent}
              </pre>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-400">পাথ: device.json</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(playlistsJsonContent, 'config')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-1.5 transition text-[11px]"
                  >
                    {copiedText === 'config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    কপি
                  </button>
                  <button
                    onClick={() => downloadFile(playlistsJsonContent, 'device.json')}
                    className="p-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-300 rounded-lg transition"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl border border-slate-800 max-h-[350px] overflow-auto select-all whitespace-pre">
                {playlistsJsonContent}
              </pre>
            </div>
          )}

          {activeTab === 'requirements' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-400">পাথ: requirements.txt</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(requirementsContent, 'requirements')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-1.5 transition text-[11px]"
                  >
                    {copiedText === 'requirements' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    কপি
                  </button>
                  <button
                    onClick={() => downloadFile(requirementsContent, 'requirements.txt')}
                    className="p-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-300 rounded-lg transition"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl border border-slate-800 max-h-[350px] overflow-auto select-all whitespace-pre">
                {requirementsContent}
              </pre>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
