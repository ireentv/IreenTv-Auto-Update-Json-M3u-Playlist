import React from 'react';
import { PlaylistBranding } from '../types';
import { Shield, User, Globe, MessageSquare, Terminal, RefreshCw } from 'lucide-react';

interface BrandingFormProps {
  branding: PlaylistBranding;
  onChange: (updates: Partial<PlaylistBranding>) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export const BrandingForm: React.FC<BrandingFormProps> = ({
  branding,
  onChange,
  isLoading,
  onRefresh
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ [name]: value });
  };

  return (
    <div id="branding-form-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="branding-title" className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Branding Configurations
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            চ্যানেল লিস্টে আপনার নিজস্ব নাম ও সোশ্যাল লিঙ্ক বসান
          </p>
        </div>
        <button
          id="btn-refresh-branding"
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition duration-200 disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium"
          title="Reset to default branding values"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          রিসেট
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Playlist Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            প্লে-লিস্ট নাম (Playlist Name)
          </label>
          <input
            id="brand-name-input"
            type="text"
            name="name"
            value={branding.name}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none transition"
            placeholder="e.g. toffee_channel_data"
          />
        </div>

        {/* Owner */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            মালিকের নাম (Owner Name)
          </label>
          <input
            id="brand-owner-input"
            type="text"
            name="owner"
            value={branding.owner}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none transition"
            placeholder="e.g. MD ANAMUL HOQUE"
          />
        </div>

        {/* Telegram Link */}
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            টেলিগ্রাম চ্যানেল (Telegram Channel)
          </label>
          <input
            id="brand-telegram-input"
            type="text"
            name="telegram"
            value={branding.telegram}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none transition"
            placeholder="e.g. https://t.me/ireentv"
          />
        </div>

        {/* Website Link */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            ওয়েবসাইট (Website)
          </label>
          <input
            id="brand-website-input"
            type="text"
            name="website"
            value={branding.website}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none transition"
            placeholder="e.g. https://anamul.pages.dev"
          />
        </div>

        {/* Developer Info */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            ডেভেলপার (Developer)
          </label>
          <input
            id="brand-developer-input"
            type="text"
            name="developer"
            value={branding.developer}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none transition"
            placeholder="e.g. IreenTechnology"
          />
        </div>

        {/* Version */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">সংস্করণ (Version)</label>
          <input
            id="brand-version-input"
            type="text"
            name="version"
            value={branding.version}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none transition"
            placeholder="e.g. 1.0"
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400">স্ট্যাটাস (Status)</label>
          <input
            id="brand-status-input"
            type="text"
            name="status"
            value={branding.status}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none transition"
            placeholder="e.g. success"
          />
        </div>
      </div>
    </div>
  );
};
