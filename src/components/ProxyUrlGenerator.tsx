import React, { useState } from 'react';
import { PlaylistBranding } from '../types';
import { Link2, Copy, Check, ExternalLink, Download, FileJson, Layers } from 'lucide-react';

interface ProxyUrlGeneratorProps {
  sourceUrl: string;
  branding: PlaylistBranding;
}

export const ProxyUrlGenerator: React.FC<ProxyUrlGeneratorProps> = ({ sourceUrl, branding }) => {
  const [copiedM3u, setCopiedM3u] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Generate URLs pointing to the backend API
  const getProxyUrl = (format: 'm3u' | 'json') => {
    const origin = window.location.origin;
    const params = new URLSearchParams({
      url: sourceUrl,
      format,
      owner: branding.owner,
      telegram: branding.telegram,
      website: branding.website,
      developer: branding.developer,
      version: branding.version,
      name: branding.name
    });
    return `${origin}/api/proxy-playlist?${params.toString()}`;
  };

  const m3uProxyUrl = getProxyUrl('m3u');
  const jsonProxyUrl = getProxyUrl('json');

  const copyToClipboard = (text: string, type: 'm3u' | 'json') => {
    navigator.clipboard.writeText(text);
    if (type === 'm3u') {
      setCopiedM3u(true);
      setTimeout(() => setCopiedM3u(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <div id="proxy-url-generator-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-emerald-400" />
          লাইভ প্রক্সি এবং API লিংক জেনারেটর
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          সরাসরি IPTV অ্যাপ (যেমন Tivimate, OTT Navigator, Televizo) বা আপনার API এ ব্যবহারের জন্য লিংক
        </p>
      </div>

      {!sourceUrl ? (
        <div className="bg-slate-950 p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
          লিংক জেনারেট করতে দয়া করে একটি প্লেলিস্ট সোর্স সিলেক্ট করুন বা কাস্টম সোর্স যুক্ত করুন।
        </div>
      ) : (
        <div className="space-y-4">
          {/* M3U Proxy Link */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg">
                M3U Playlist (IPTV Player Link)
              </span>
              <span className="text-[10px] text-slate-400">অটোমেটিক আপডেট হবে</span>
            </div>
            
            <p className="text-slate-400 text-xs leading-relaxed">
              এই লিংকটি আপনার যেকোনো IPTV প্লেয়ারে লোড করলে অরিজিনাল সোর্স আপডেট হওয়ার সাথে সাথে আপনার এখানেও অটোলিঙ্ক পরিবর্তন হয়ে যাবে, এবং প্লেলিস্টে আপনার ব্র্যান্ডিং দেখাবে!
            </p>

            <div className="flex gap-2">
              <input
                id="m3u-proxy-url-input"
                type="text"
                readOnly
                value={m3uProxyUrl}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 text-xs font-mono select-all focus:outline-none"
              />
              <button
                id="btn-copy-m3u"
                onClick={() => copyToClipboard(m3uProxyUrl, 'm3u')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5 text-xs font-medium transition flex-shrink-0"
              >
                {copiedM3u ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedM3u ? 'কপিড!' : 'কপি'}
              </button>
            </div>
            <div className="flex gap-2 pt-1.5">
              <a
                href={m3uProxyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-center text-xs font-medium flex items-center justify-center gap-1.5 border border-emerald-500/25 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                ব্রাউজারে দেখুন
              </a>
              <a
                href={m3uProxyUrl}
                download={`${branding.name}.m3u`}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                ডাউনলোড (.m3u)
              </a>
            </div>
          </div>

          {/* JSON Proxy Link */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <FileJson className="w-3.5 h-3.5" />
                JSON Playlist (App API URL)
              </span>
              <span className="text-[10px] text-slate-400">অনলাইন ডাটা রেন্ডারিং</span>
            </div>
            
            <p className="text-slate-400 text-xs leading-relaxed">
              যদি আপনি কোনো কাস্টম এন্ড্রয়েড অ্যাপ বা ওয়েবসাইট তৈরি করে থাকেন, তবে এই API লিংকটি ইন্টিগ্রেট করুন। এটি একদম সুবিন্যস্ত JSON ডাটা রিটার্ন করে।
            </p>

            <div className="flex gap-2">
              <input
                id="json-proxy-url-input"
                type="text"
                readOnly
                value={jsonProxyUrl}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 text-xs font-mono select-all focus:outline-none"
              />
              <button
                id="btn-copy-json"
                onClick={() => copyToClipboard(jsonProxyUrl, 'json')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5 text-xs font-medium transition flex-shrink-0"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedJson ? 'কপিড!' : 'কপি'}
              </button>
            </div>
            <div className="flex gap-2 pt-1.5">
              <a
                href={jsonProxyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-center text-xs font-medium flex items-center justify-center gap-1.5 border border-blue-500/25 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                ব্রাউজারে দেখুন
              </a>
              <a
                href={jsonProxyUrl}
                download={`${branding.name}.json`}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                ডাউনলোড (.json)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
