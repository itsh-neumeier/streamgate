export interface ActivationResult {
  deviceId: string;
  deviceToken: string;
  customerId: string;
}

export interface BootstrapConfig {
  customer: { id: string; name: string; package: string };
  device: { id: string; name: string; status: string; mode: string };
  features: { liveTv: boolean; epg: boolean; dvr: boolean; favorites: boolean };
  branding: { appName: string; logoUrl?: string; primaryColor: string; supportText: string };
  streamProfiles: Array<{ id: 'hd' | 'sd-480p'; label: string; description: string }>;
}

export interface Channel {
  id: string;
  number: number;
  name: string;
  logoUrl?: string;
  groupId: string;
  enabled: boolean;
  dvrAllowed: boolean;
  favorite: boolean;
}

export interface StreamOpenResult {
  streamSessionId: string;
  url: string;
  expiresIn: number;
  mimeType: string;
  quality: 'hd' | 'sd-480p';
  qualityLabel: string;
}

export interface DvrTimer {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  tvheadendUsername?: string;
}

export interface Recording {
  id: string;
  channelId: string;
  title: string;
  subtitle?: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
}
