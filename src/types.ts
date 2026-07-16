export interface Channel {
  id?: string;
  name: string;
  logo: string;
  url: string;
  group?: string;
  headers?: Record<string, string>;
  category?: string;
  status?: string;
  attrs?: Record<string, string>;
  kodiprops?: string[];
  vlc_opts?: string[];
  url_raw?: string;
}

export interface PlaylistBranding {
  status: string;
  owner: string;
  telegram: string;
  website: string;
  developer: string;
  version: string;
  name: string;
  channels_amount: number;
  Last_update: string;
}

export interface PredefinedSource {
  id: string;
  name: string;
  url: string;
  type: 'm3u' | 'json';
  category: 'Toffee' | 'Sonyliv' | 'Tapmad' | 'Custom';
}

export interface StandardPlaylist {
  branding: PlaylistBranding;
  channels: Channel[];
}
