import { useState, useEffect } from 'react';
import { Channel, PlaylistBranding, PredefinedSource, StandardPlaylist } from './types';
import { BrandingForm } from './components/BrandingForm';
import { PlaylistViewer } from './components/PlaylistViewer';
import { ProxyUrlGenerator } from './components/ProxyUrlGenerator';
import { GitHubActionGuide } from './components/GitHubActionGuide';
import { MultiSourceAggregator } from './components/MultiSourceAggregator';
import { 
  Tv, 
  Settings, 
  Github, 
  Layers, 
  Plus, 
  Loader2, 
  AlertCircle, 
  Check, 
  Sparkles, 
  Flame, 
  TrendingUp, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';

const PREDEFINED_SOURCES: PredefinedSource[] = [
  {
    id: 'tapmad-m3u',
    name: 'Tapmad BD M3U Playlist',
    url: 'https://raw.githubusercontent.com/srhady/tapmad-bd/main/tapmad_bd.m3u',
    type: 'm3u',
    category: 'Tapmad'
  },
  {
    id: 'tapmad-json',
    name: 'Tapmad BD Matches JSON',
    url: 'https://raw.githubusercontent.com/srhady/tapmad-bd/main/tapmad_bd.json',
    type: 'json',
    category: 'Tapmad'
  },
  {
    id: 'sonyliv-m3u',
    name: 'Sonyliv Live Matches M3U',
    url: 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.m3u',
    type: 'm3u',
    category: 'Sonyliv'
  },
  {
    id: 'sonyliv-json',
    name: 'Sonyliv Live Matches JSON',
    url: 'https://raw.githubusercontent.com/sportlive18/Sonyliv-Playlist-Autoupdate/main/sonyliv.json',
    type: 'json',
    category: 'Sonyliv'
  },
  {
    id: 'toffee-json',
    name: 'Toffee App All Channels JSON',
    url: 'https://raw.githubusercontent.com/BINOD-XD/Toffee-Auto-Update-Playlist/main/toffee_channel_data.json',
    type: 'json',
    category: 'Toffee'
  }
];

const DEFAULT_BRANDING: PlaylistBranding = {
  status: 'success',
  owner: 'MD ANAMUL HOQUE',
  telegram: 'https://t.me/ireentv',
  website: 'https://anamul.pages.dev',
  developer: 'IreenTechnology',
  version: '1.0',
  name: 'toffee_channel_data',
  channels_amount: 0,
  Last_update: new Date().toISOString().split('T')[0]
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'merge' | 'github'>('single');
  const [branding, setBranding] = useState<PlaylistBranding>(DEFAULT_BRANDING);
  const [selectedSource, setSelectedSource] = useState<PredefinedSource>(PREDEFINED_SOURCES[4]); // default to Toffee json
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('custom_playlist');
  const [isLoading, setIsLoading] = useState(false);
  const [playlistData, setPlaylistData] = useState<StandardPlaylist | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load playlist data when selected source changes or component mounts
  const fetchPlaylistData = async (url: string, name: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/fetch?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`);
      if (!response.ok) {
        throw new Error(`সার্ভার থেকে প্লেলিস্ট লোড করতে ব্যর্থ হয়েছে: status ${response.status}`);
      }
      const data: StandardPlaylist = await response.json();
      
      // Merge with custom branding details entered by user
      const updatedPlaylist: StandardPlaylist = {
        ...data,
        branding: {
          ...branding,
          channels_amount: data.channels.length,
          Last_update: new Date().toISOString().split('T')[0]
        }
      };
      
      setPlaylistData(updatedPlaylist);
      setBranding(prev => ({
        ...prev,
        channels_amount: data.channels.length,
        Last_update: new Date().toISOString().split('T')[0]
      }));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'নেটওয়ার্ক এরর। দয়া করে সঠিক লিংক প্রদান করুন এবং পুনরায় চেষ্টা করুন।');
      setPlaylistData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSource) {
      fetchPlaylistData(selectedSource.url, branding.name || selectedSource.id);
    }
  }, [selectedSource]);

  // Update live-view branding when form states change
  const handleBrandingChange = (updates: Partial<PlaylistBranding>) => {
    setBranding(prev => {
      const next = { ...prev, ...updates };
      if (playlistData) {
        setPlaylistData({
          ...playlistData,
          branding: {
            ...next,
            channels_amount: playlistData.channels.length
          }
        });
      }
      return next;
    });
  };

  const handleCustomUrlLoad = () => {
    if (!customUrl) {
      setErrorMessage('দয়া করে একটি প্লে-লিস্ট URL প্রদান করুন!');
      return;
    }
    const fakeId = 'custom-' + Date.now();
    const newSource: PredefinedSource = {
      id: fakeId,
      name: customName || 'Custom Playlist Source',
      url: customUrl,
      type: customUrl.endsWith('.m3u') || customUrl.includes('m3u') ? 'm3u' : 'json',
      category: 'Custom'
    };
    
    // Update active configurations
    handleBrandingChange({ name: customName || 'custom_playlist' });
    setSelectedSource(newSource);
    setSuccessMessage('কাস্টম প্লেলিস্ট সফলভাবে নির্বাচন করা হয়েছে!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetBranding = () => {
    setBranding({
      ...DEFAULT_BRANDING,
      channels_amount: playlistData ? playlistData.channels.length : 0
    });
    setSuccessMessage('ব্র্যান্ডিং কনফিগারেশন ডিফল্ট ভ্যালুতে রিসেট করা হয়েছে!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Top Banner Accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500"></div>

      {/* Main Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <Tv className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 id="app-title" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                IPTV Playlist Customizer & Sync
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-mono font-medium">v1.0</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                M3U / JSON প্লে-লিস্ট ব্র্যান্ড পরিবর্তন এবং গিটহাব অটো-আপডেটার বিল্ডার
              </p>
            </div>
          </div>

          {/* Header Quick Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-400">Owner: <strong className="text-slate-200">{branding.owner}</strong></span>
            </div>
            <a 
              href="https://t.me/ireentv" 
              target="_blank" 
              rel="noreferrer"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
            >
              <Sparkles className="w-3.5 h-3.5" />
              টেলিগ্রাম জয়েন করুন
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome Section */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute right-0 top-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none"></div>
          
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              100% অটোমেটিক সমাধান
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
              প্লেলিস্টের ক্রেডিট পরিবর্তন করুন মাত্র এক ক্লিকে!
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              আপনি কি বিভিন্ন সোর্স (যেমন Tapmad, Sonyliv, বা Toffee) থেকে চ্যানেল নিয়ে নিজের ব্র্যান্ড নামে প্লেলিস্ট শেয়ার করতে চান? 
              এই অ্যাপটির মাধ্যমে আপনি সেই প্লেলিস্টের মূল ওনার বা ক্রেডিট পরিবর্তন করে <strong>আপনার নিজের নাম, ওয়েবসাইট ও টেলিগ্রাম লিঙ্ক</strong> বসাতে পারবেন। 
              তাছাড়া সরাসরি IPTV অ্যাপে ব্যবহারের জন্য পাবেন একটি লাইভ প্রক্সি URL এবং আপনার গিটহাবে অটো-আপডেট ফিচার চালু করার জন্য কমপ্লিট স্ক্রিপ্ট!
            </p>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-sm flex items-center gap-2.5 shadow-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-sm flex items-center gap-2.5 shadow-lg">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Section 1: Source Selector (Sidebar/Cards) */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            ১. ইনপুট সোর্স সিলেক্ট করুন (Choose Input Source)
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Predefined Sources Quick Lists */}
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <span className="text-xs font-semibold text-slate-400">পূর্বে সংরক্ষিত ৫টি সোর্স (Predefined Playlists):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {PREDEFINED_SOURCES.map((src) => {
                  const isSelected = selectedSource?.url === src.url;
                  return (
                    <button
                      key={src.id}
                      onClick={() => {
                        setSelectedSource(src);
                        handleBrandingChange({ name: src.id.replace(/-/g, '_') });
                      }}
                      className={`p-3.5 rounded-xl border text-left transition duration-200 relative group ${
                        isSelected 
                          ? 'bg-emerald-500/5 border-emerald-500/40 text-slate-100' 
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                        <p className="text-xs font-semibold truncate flex-1">{src.name}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 text-[9px] text-slate-500">
                        <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold uppercase">{src.type}</span>
                        <span className="font-semibold text-emerald-500/80 group-hover:text-emerald-400 transition">{src.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input Source Card */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  নতুন কাস্টম সোর্স যোগ করুন:
                </span>
                <div className="space-y-2">
                  <input
                    id="custom-source-name-input"
                    type="text"
                    placeholder="প্লেলিস্ট নাম (যেমন: custom_bd)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.8 text-slate-200 text-xs focus:outline-none transition"
                  />
                  <input
                    id="custom-source-url-input"
                    type="text"
                    placeholder="M3U / JSON সোর্স লিংক দিন..."
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.8 text-slate-200 text-xs focus:outline-none transition font-mono"
                  />
                </div>
              </div>
              <button
                id="btn-load-custom"
                onClick={handleCustomUrlLoad}
                className="w-full mt-3 py-2 bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                লোড কাস্টম সোর্স
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </section>

        {/* Tab Navigation Menu */}
        <section className="space-y-6">
          <div className="flex border-b border-slate-900 text-sm overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('single')}
              className={`pb-4 px-6 font-semibold transition border-b-2 flex items-center gap-2 flex-shrink-0 ${
                activeTab === 'single'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-4 h-4" />
              সিঙ্গেল প্লে-লিস্ট ব্র্যান্ডার ও লাইভ লিংক
            </button>
            
            <button
              onClick={() => setActiveTab('merge')}
              className={`pb-4 px-6 font-semibold transition border-b-2 flex items-center gap-2 flex-shrink-0 ${
                activeTab === 'merge'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              মাল্টি-সোর্স এগ্রিগেটর (Merge & Filter)
            </button>

            <button
              onClick={() => setActiveTab('github')}
              className={`pb-4 px-6 font-semibold transition border-b-2 flex items-center gap-2 flex-shrink-0 ${
                activeTab === 'github'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Github className="w-4 h-4" />
              গিটহাব অ্যাকশন অটো-আপডেটার সেটআপ
            </button>
          </div>

          {/* Active Tab rendering */}
          {activeTab === 'single' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              {/* Left configurations column */}
              <div className="lg:col-span-2 space-y-6">
                <BrandingForm
                  branding={branding}
                  onChange={handleBrandingChange}
                  isLoading={isLoading}
                  onRefresh={handleResetBranding}
                />
                
                <ProxyUrlGenerator
                  sourceUrl={selectedSource?.url || ''}
                  branding={branding}
                />
              </div>

              {/* Right preview/channels column */}
              <div className="lg:col-span-3">
                <PlaylistViewer
                  playlist={playlistData}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}

          {activeTab === 'merge' && (
            <MultiSourceAggregator
              predefinedSources={PREDEFINED_SOURCES}
              branding={branding}
            />
          )}

          {activeTab === 'github' && (
            <GitHubActionGuide
              sourceUrl={selectedSource?.url || ''}
              branding={branding}
            />
          )}
        </section>

      </main>

      {/* Page Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-10 mt-20 text-slate-500 text-xs text-center space-y-2">
        <p>
          © 2026 <strong>{branding.developer}</strong>. All rights reserved. 
          Developed for <strong>{branding.owner}</strong>.
        </p>
        <p className="flex justify-center items-center gap-3">
          <a href={branding.website} target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition">ওয়েবসাইট</a>
          <span>•</span>
          <a href={branding.telegram} target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition">টেলিগ্রাম চ্যানেল</a>
          <span>•</span>
          <span className="font-mono text-[10px]">Version: {branding.version}</span>
        </p>
      </footer>
    </div>
  );
}
