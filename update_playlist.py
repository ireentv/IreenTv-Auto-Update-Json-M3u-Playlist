import os
import json
import re
from datetime import datetime, timezone
import requests
from playwright.sync_api import sync_playwright

# ==========================================
# 1. CONFIGURATION (READ FROM SECRETS)
# ==========================================
CHANNELS_URL = os.environ.get("CHANNELS_API_URL")
SPOOF_IP = os.environ.get("SPOOF_IP", "")
STREAM_ORIGIN = os.environ.get("STREAM_ORIGIN", "")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"

# Playlist Header Info
PLAYLIST_NAME = "Ireen TV - Live Sports"
OWNER = "X Y Z"
TELEGRAM = "https://t.me/ireentv"
WEBSITE = "https://anamul.pages.dev"
DEVELOPER = "MD ANAMUL HOQUE"
VERSION = "1.0"

if not CHANNELS_URL:
    raise ValueError("CHANNELS_API_URL secret is not set!")

HEADERS = {
    "Accept": "application/json",
    "Origin": STREAM_ORIGIN,
    "Referer": f"{STREAM_ORIGIN}/" if STREAM_ORIGIN else "",
    "User-Agent": USER_AGENT
}

# ==========================================
# 2. PLAYLIST & JSON GENERATOR
# ==========================================
def build_channel_playlist():
    print("[*] Fetching Channels API...")
    try:
        resp = requests.get(CHANNELS_URL, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            print(f"[-] Failed to fetch API. Status: {resp.status_code}")
            return
        channels = resp.json().get("channels", [])
        print(f"[+] Found {len(channels)} total channels.")
    except Exception as e:
        print(f"[-] Error fetching API: {e}")
        return

    print("[*] Starting Playwright Browser (Blitz Mode)...")
    
    collected_channels = []
    channel_id = 1
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True, 
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
        )
        
        context = browser.new_context(
            user_agent=USER_AGENT,
            extra_http_headers={
                "Referer": f"{STREAM_ORIGIN}/" if STREAM_ORIGIN else "",
                "Origin": STREAM_ORIGIN
            }
        )
        
        page = context.new_page()
        
        # Block unnecessary resources for super-fast loading
        page.route("**/*", lambda route: 
            route.abort() if route.request.resource_type in ["image", "media", "font", "stylesheet"] 
            else route.continue_()
        )
        
        for ch in channels:
            if ch.get("status") != "online":
                continue
                
            ch_name = ch.get("name", "Unknown Channel")
            country_code = ch.get("code", "xx").upper()
            logo = ch.get("image", "")
            player_url = ch.get("url")
            group_title = f"Live TV - {country_code}"
            
            if not player_url:
                continue
                
            print(f"-> Blitzing: [{country_code}] {ch_name}")
            
            try:
                with page.expect_request(re.compile(r"\.m3u8"), timeout=3000) as m3u8_req:
                    page.goto(player_url)
                
                final_url = m3u8_req.value.url
                stream_url_with_header = f"{final_url}|x-forwarded-for:{SPOOF_IP}" if SPOOF_IP else final_url
                
                # Collect valid channel data
                collected_channels.append({
                    "id": channel_id,
                    "name": ch_name,
                    "tvg_id": f'{ch_name.replace(" ", "")}.{country_code}',
                    "logo": logo,
                    "group": group_title,
                    "stream_url": stream_url_with_header,
                    "raw_stream_url": final_url,
                    "referer": player_url,
                    "user_agent": USER_AGENT
                })
                
                channel_id += 1
                print(f"  [+] Snagged it.")
                
            except Exception:
                print(f"  [-] Missed it. Moving on.")
                    
        browser.close()

    total_amount = len(collected_channels)
    last_update_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # ==========================================
    # 3. WRITE TO Live_Sports.m3u
    # ==========================================
    print("[*] Writing Live_Sports.m3u...")
    with open("Live_Sports.m3u", "w", encoding="utf-8") as f_m3u:
        f_m3u.write("#EXTM3U\n")
        f_m3u.write(f"# Playlist Name: {PLAYLIST_NAME}\n")
        f_m3u.write(f"# Owner: {OWNER}\n")
        f_m3u.write(f"# Telegram: {TELEGRAM}\n")
        f_m3u.write(f"# Website: {WEBSITE}\n")
        f_m3u.write(f"# Developer: {DEVELOPER}\n")
        f_m3u.write(f"# Version: {VERSION}\n")
        f_m3u.write(f"# Channels Amount: {total_amount}\n")
        f_m3u.write(f"# Last Update: {last_update_time}\n")
        f_m3u.write("# ==========================================\n\n")
        
        for item in collected_channels:
            f_m3u.write(f'#EXTINF:-1 tvg-chno="{item["id"]}" tvg-id="{item["tvg_id"]}" tvg-name="{item["name"]}" tvg-logo="{item["logo"]}" group-title="{item["group"]}",{item["name"]}\n')
            f_m3u.write(f'#EXTVLCOPT:http-referrer={item["referer"]}\n')
            f_m3u.write(f'#EXTVLCOPT:http-origin={item["referer"]}\n')
            f_m3u.write(f'#EXTVLCOPT:http-user-agent={item["user_agent"]}\n')
            f_m3u.write(f'{item["stream_url"]}\n\n')

    # ==========================================
    # 4. WRITE TO Live_Sports.json
    # ==========================================
    print("[*] Writing Live_Sports.json...")
    final_json_data = {
        "info": {
            "playlist_name": PLAYLIST_NAME,
            "owner": OWNER,
            "telegram": TELEGRAM,
            "website": WEBSITE,
            "developer": DEVELOPER,
            "version": VERSION,
            "channels_amount": total_amount,
            "last_update": last_update_time
        },
        "channels": collected_channels
    }

    with open("Live_Sports.json", "w", encoding="utf-8") as f_json:
        json.dump(final_json_data, f_json, indent=2, ensure_ascii=False)

    print(f"\n[+] Finished! Total Channels: {total_amount} | Updated: {last_update_time}")

if __name__ == "__main__":
    build_channel_playlist()
