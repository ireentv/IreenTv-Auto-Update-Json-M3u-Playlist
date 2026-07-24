import React, { useState, useEffect } from 'react';
import { Channel, PlaylistBranding, PredefinedSource } from '../types';
import { Layers, Check, Copy, AlertTriangle, ArrowRight, Loader2, Search, Filter } from 'lucide-react';
import { generateM3U, generateJSON } from '../utils/playlistParser';

interface MultiSourceAggregatorProps {
  predefinedSources: PredefinedSource[];
  branding: PlaylistBranding;
}

export const MultiSourceAggregator: React.FC<MultiSourceAggregatorProps> = ({
  predefinedSources,
  branding
}) => {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    predefinedSources.map(s => s.id) // Select all by default
  );
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergedChannels, setMergedChannels] = useState<Channel[]>([]);
  const [channelSelections, setChannelSelections] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'m3u' | 'json'>('m3u');

  const handleSourceToggle = (id: string) => {
    setSelectedSourceIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleMerge = async () => {
    if (selectedSourceIds.length === 0) {
      setError('দয়া করে অন্তত একটি সোর্স সিলেক্ট করুন!');
      return;
    }

    setIsMerging(true);
    setError(null);
    setMergedChannels([]);

    try {
      const fetchPromises = selectedSourceIds.map(async id => {
        const source = predefinedSources.find(s => s.id === id);
        if (!source) return [];

        try {
          const res = await fetch(`/api/fetch?url=${encodeURIComponent(source.url)}&name=${encodeURIComponent(source.name)}`);
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const data = await res.json();
          // tag channels with their source origin for filtering
          return (data.channels || []).map((ch: Channel) => ({
            ...ch,
            category: source.category
          }));
        } catch (e) {
          console.error(`Error fetching source ${source.name}:`, e);
          // Return empty on failure so we can still merge others
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      const allChannels = results.flat();

      if (allChannels.length === 0) {
        throw new Error('কোনো সোর্স থেকেই চ্যানেল ডাটা রিট্রিভ করা যায়নি। নেটওয়ার্ক চেক করুন।');
      }

      // Deduplicate by Stream URL
      const uniqueChannels: Channel[] = [];
      const seenUrls = new Set<string>();

      for (const ch of allChannels) {
        if (!seenUrls.has(ch.url)) {
          seenUrls.add(ch.url);
          uniqueChannels.push(ch);
        }
      }

      setMergedChannels(uniqueChannels);

      // Initialize all channels as selected
      const initialSelections: Record<string, boolean> = {};
      uniqueChannels.forEach((ch, idx) => {
        initialSelections[`${ch.url}-${idx}`] = true;
      });
      setChannelSelections(initialSelections);

    } catch (err: any) {
      setError(err.message || 'চ্যানেল একত্রিত করতে সমস্যা হয়েছে।');
    } finally {
      setIsMerging(false);
    }
  };

  // Trigger merge on mount
  useEffect(() => {
    handleMerge();
  }, []);

  const handleSelectAllChannels = (select: boolean) => {
    const updated = { ...channelSelections };
    filteredChannels.forEach(ch => {
      const idx = mergedChannels.findIndex(m => m.url === ch.url);
      if (idx !== -1) {
        updated[`${ch.url}-${idx}`] = select;
      }
    });
    setChannelSelections(updated);
  };

  const toggleChannelSelection = (url: string, index: number) => {
    const key = `${url}-${index}`;
    setChannelSelections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Filter channels based on search
  const filteredChannels = mergedChannels.filter(ch =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ch.group && ch.group.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (ch.category && ch.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSelectedChannels = () => {
    return mergedChannels.filter((ch, idx) => channelSelections[`${ch.url}-${idx}`] !== false);
  };

  const selectedChannelsCount = getSelectedChannels().length;

  const handleCopyResult = () => {
    const activeChannels = getSelectedChannels();
    const mockPlaylist = {
      branding: {
        ...branding,
        channels_amount: activeChannels.length,
        Last_update: new Date().toISOString().split('T')[0]
      },
      channels: activeChannels
    };

    const outputText = outputFormat === 'm3u' ? generateM3U(mockPlaylist) : JSON.stringify(generateJSON(mockPlaylist), null, 2);
    navigator.clipboard.writeText(outputText);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="multi-source-aggregator-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          মাল্টি-সোর্স চ্যানেল এগ্রিগেটর (Merge & Filter)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          একাধিক প্লেলিস্ট সোর্সকে একত্রিত করে ডুপ্লিকেট রিমুভ করুন এবং আপনার নিজের কাস্টম ব্র্যান্ডিং-এ সিঙ্গেল প্লেলিস্টে কনভার্ট করুন
        </p>
      </div>

      {/* Checklist of Predefined Sources */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <span className="text-xs font-semibold text-slate-400">কনভার্ট করার সোর্সসমূহ সিলেক্ট করুন:</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {predefinedSources.map(source => {
            const isSelected = selectedSourceIds.includes(source.id);
            return (
              <button
                key={source.id}
                onClick={() => handleSourceToggle(source.id)}
                className={`p-3 rounded-xl border text-left text-xs transition duration-200 flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-emerald-500/5 border-emerald-500/40 text-slate-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4.5 h-4.5 rounded flex items-center justify-center border flex-shrink-0 mt-0.5 ${
                  isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700'
                }`}>
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{source.name}</p>
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded-md font-mono">
                    {source.category} • {source.type.toUpperCase()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-900">
          <button
            onClick={handleMerge}
            disabled={isMerging}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl text-sm font-semibold flex items-center gap-2 transition duration-200 shadow-lg shadow-emerald-500/10"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                মার্জ করা হচ্ছে...
              </>
            ) : (
              <>
                মার্জ করুন ও ফিল্টার করুন
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Merged Channel Manager */}
      {mergedChannels.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Channel selector panel */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                চ্যানেল ফিল্টার ও সিলেকশন ({selectedChannelsCount}/{mergedChannels.length})
              </h3>
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  onClick={() => handleSelectAllChannels(true)}
                  className="px-2 py-1 text-slate-300 hover:text-white"
                >
                  সব সিলেক্ট
                </button>
                <span className="text-slate-800 px-0.5 font-bold">|</span>
                <button
                  onClick={() => handleSelectAllChannels(false)}
                  className="px-2 py-1 text-slate-400 hover:text-white"
                >
                  সব রিমুভ
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                id="merge-channel-search"
                type="text"
                placeholder="চ্যানেলের নাম, ক্যাটাগরি বা সোর্স দিয়ে ফিল্টার করুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-4 py-2 text-slate-200 text-xs focus:outline-none transition"
              />
            </div>

            {/* List with checkboxes */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-[350px] overflow-y-auto divide-y divide-slate-900 pr-1">
              {filteredChannels.map((ch, idx) => {
                const originalIndex = mergedChannels.findIndex(m => m.url === ch.url);
                const isChecked = channelSelections[`${ch.url}-${originalIndex}`] !== false;
                return (
                  <div
                    key={idx}
                    onClick={() => toggleChannelSelection(ch.url, originalIndex)}
                    className="p-3 flex items-center justify-between hover:bg-slate-900/50 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                        isChecked ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-800 bg-slate-900'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                      </div>
                      
                      <div className="w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {ch.logo ? (
                          <img
                            src={ch.logo}
                            alt={ch.name}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://placehold.co/80x80/1e293b/a7f3d0?text=${encodeURIComponent(ch.name.substring(0, 2).toUpperCase())}`;
                            }}
                          />
                        ) : (
                          <span className="text-emerald-400 font-mono text-[10px] font-bold">
                            {ch.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${isChecked ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                          {ch.name}
                        </p>
                        <span className="inline-block text-[9px] text-slate-500">
                          {ch.group || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <span className="inline-block text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                        {ch.category || 'Custom'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export / Generated list panel */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">
              মার্জড প্লে-লিস্ট এক্সপোর্ট (Your Branded Playlist)
            </h3>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">এক্সপোর্ট ফরম্যাট:</label>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setOutputFormat('m3u')}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition ${
                      outputFormat === 'm3u' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    M3U Playlist
                  </button>
                  <button
                    onClick={() => setOutputFormat('json')}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition ${
                      outputFormat === 'json' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Branded JSON
                  </button>
                </div>
              </div>

              {/* Branding Overview in Export */}
              <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-3 text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-500">প্লে-লিস্ট নাম:</span>
                  <span className="text-emerald-400 font-mono font-medium">{branding.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-500">মালিক:</span>
                  <span className="text-slate-300">{branding.owner}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-500">চ্যানেল সংখ্যা:</span>
                  <span className="text-slate-300 font-mono font-bold">{selectedChannelsCount}টি</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">টেলিগ্রাম:</span>
                  <span className="text-slate-300 truncate max-w-[150px] font-mono">{branding.telegram}</span>
                </div>
              </div>

              <button
                id="btn-copy-merged"
                onClick={handleCopyResult}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4" />
                    কপি করা হয়েছে!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    মার্জড প্লেলিস্ট কপি করুন
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
