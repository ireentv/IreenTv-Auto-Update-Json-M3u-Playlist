import React, { useState } from 'react';
import { Channel, StandardPlaylist } from '../types';
import { Search, Info, List, Code, Copy, Check, Tv, ExternalLink } from 'lucide-react';

interface PlaylistViewerProps {
  playlist: StandardPlaylist | null;
  isLoading: boolean;
}

export const PlaylistViewer: React.FC<PlaylistViewerProps> = ({ playlist, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'grid' | 'json' | 'm3u'>('grid');
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[350px]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-sm animate-pulse font-medium">প্লে-লিস্ট ডাটা লোড ও পার্স করা হচ্ছে...</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[350px] text-center">
        <Tv className="w-12 h-12 text-slate-600 mb-3" />
        <p className="text-slate-300 font-medium">কোন প্লে-লিস্ট লোড করা হয়নি</p>
        <p className="text-slate-500 text-xs mt-1 max-w-md">
          উপরের যেকোনো সোর্স সিলেক্ট করুন অথবা নিজস্ব M3U/JSON লিংক পেস্ট করে লোড বাটনে ক্লিক করুন।
        </p>
      </div>
    );
  }

  // Filter channels based on search
  const filteredChannels = playlist.channels.filter(ch =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ch.group && ch.group.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formattedJSON = JSON.stringify(
    {
      status: playlist.branding.status,
      owner: playlist.branding.owner,
      telegram: playlist.branding.telegram,
      website: playlist.branding.website,
      developer: playlist.branding.developer,
      version: playlist.branding.version,
      name: playlist.branding.name,
      channels_amount: playlist.branding.channels_amount,
      Last_update: playlist.branding.Last_update,
      channels: playlist.channels
    },
    null,
    2
  );

  const formattedM3U = `#EXTM3U
# Playlist Name: ${playlist.branding.name}
# Owner: ${playlist.branding.owner}
# Telegram: ${playlist.branding.telegram}
# Website: ${playlist.branding.website}
# Developer: ${playlist.branding.developer}
# Version: ${playlist.branding.version}
# Channels Amount: ${playlist.branding.channels_amount}
# Last Update: ${playlist.branding.Last_update}

${playlist.channels.map(ch => {
  const logoAttr = ch.logo ? ` tvg-logo="${ch.logo}"` : '';
  const groupAttr = ch.group ? ` group-title="${ch.group}"` : '';
  let headerOpts = '';
  if (ch.headers) {
    for (const [key, val] of Object.entries(ch.headers)) {
      if (key.toLowerCase() === 'user-agent') {
        headerOpts += `#EXTVLCOPT:http-user-agent=${val}\n`;
      } else if (key.toLowerCase() === 'referer') {
        headerOpts += `#EXTVLCOPT:http-referrer=${val}\n`;
      }
    }
  }
  return `#EXTINF:-1${logoAttr}${groupAttr},${ch.name}\n${headerOpts}${ch.url}`;
}).join('\n\n')}`;

  const handleCopy = () => {
    const textToCopy = activeTab === 'json' ? formattedJSON : formattedM3U;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="playlist-viewer-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header and statistics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 id="viewer-header-title" className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Tv className="w-5 h-5 text-emerald-400" />
            চ্যানেল লিস্ট এবং প্রিভিউ
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
            <span>মোট চ্যানেল: <strong className="text-emerald-400 font-mono">{playlist.channels.length}</strong></span>
            <span>প্লেলিস্ট নাম: <strong className="text-slate-300 font-mono">{playlist.branding.name}</strong></span>
            <span>শেষ আপডেট: <strong className="text-slate-300 font-mono">{playlist.branding.Last_update}</strong></span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'grid' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            চ্যানেল গ্রিড
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'json' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Branded JSON
          </button>
          <button
            onClick={() => setActiveTab('m3u')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'm3u' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Branded M3U
          </button>
        </div>
      </div>

      {activeTab === 'grid' ? (
        <>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
            <input
              id="channel-search-input"
              type="text"
              placeholder="চ্যানেলের নাম অথবা ক্যাটাগরি দিয়ে সার্চ করুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-slate-200 text-sm focus:outline-none transition"
            />
          </div>

          {/* Grid display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
            {filteredChannels.length > 0 ? (
              filteredChannels.map((ch, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-4 rounded-xl flex items-center gap-3.5 transition group relative"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt={ch.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback on image error
                          (e.target as HTMLImageElement).src = `https://placehold.co/100x100/1e293b/a7f3d0?text=${encodeURIComponent(ch.name.substring(0, 2).toUpperCase())}`;
                        }}
                      />
                    ) : (
                      <span className="text-emerald-400 font-mono text-sm font-bold">
                        {ch.name.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-emerald-400 transition" title={ch.name}>
                      {ch.name}
                    </p>
                    {ch.group && (
                      <span className="inline-block mt-1 text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        {ch.group}
                      </span>
                    )}
                  </div>
                  
                  {/* Hover Stream URL detail */}
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition flex gap-1.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(ch.url);
                        alert('Stream URL copied to clipboard!');
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md transition"
                      title="Copy stream link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={ch.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 rounded-md transition"
                      title="Open stream link in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">
                কোনো চ্যানেল পাওয়া যায়নি
              </div>
            )}
          </div>
        </>
      ) : (
        /* JSON or M3U view */
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              আপনার ব্র্যান্ডিং সহ রিয়েল-টাইম কনভার্ট হওয়া প্লেলিস্ট কোড
            </span>
            <button
              id="btn-copy-code"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  কপি করা হয়েছে!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  কোড কপি করুন
                </>
              )}
            </button>
          </div>
          <pre className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-slate-800 max-h-[400px] overflow-auto select-all whitespace-pre-wrap">
            {activeTab === 'json' ? formattedJSON : formattedM3U}
          </pre>
        </div>
      )}
    </div>
  );
};
