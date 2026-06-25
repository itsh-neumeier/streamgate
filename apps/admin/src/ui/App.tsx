import { Activity, Monitor, Package, Play, Radio, Settings, Tv, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import mpegts from 'mpegts.js';
import { apiGet, apiPost, apiPut } from '../api/client';
import type { ActivationResult, Channel, ChannelPackage, Customer, Dashboard, Device, StreamOpenResult, StreamSession } from '../api/types';

type Tab = 'dashboard' | 'customers' | 'devices' | 'channels' | 'packages' | 'streams' | 'player' | 'config';

const tabs: Array<{ id: Tab; label: string; Icon: typeof Activity }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: Activity },
  { id: 'customers', label: 'Kunden', Icon: Users },
  { id: 'devices', label: 'Geraete', Icon: Monitor },
  { id: 'channels', label: 'Sender', Icon: Tv },
  { id: 'packages', label: 'Pakete', Icon: Package },
  { id: 'streams', label: 'Streams', Icon: Radio },
  { id: 'player', label: 'Webplayer', Icon: Play },
  { id: 'config', label: 'App-Konfiguration', Icon: Settings }
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [packages, setPackages] = useState<ChannelPackage[]>([]);
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const [dashboardData, customersData, devicesData, channelsData, packagesData, streamsData] = await Promise.all([
        apiGet<Dashboard>('/admin/dashboard'),
        apiGet<{ customers: Customer[] }>('/admin/customers'),
        apiGet<{ devices: Device[] }>('/admin/devices'),
        apiGet<{ channels: Channel[] }>('/admin/channels'),
        apiGet<{ packages: ChannelPackage[] }>('/admin/packages'),
        apiGet<{ streams: StreamSession[] }>('/admin/streams/active')
      ]);
      setDashboard(dashboardData);
      setCustomers(customersData.customers);
      setDevices(devicesData.devices);
      setChannels(channelsData.channels);
      setPackages(packagesData.packages);
      setStreams(streamsData.streams);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backend nicht erreichbar');
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const content = useMemo(() => {
    if (activeTab === 'dashboard') return <DashboardView dashboard={dashboard} />;
    if (activeTab === 'customers') return <CustomersView customers={customers} onRefresh={refresh} />;
    if (activeTab === 'devices') return <DevicesView devices={devices} onRefresh={refresh} />;
    if (activeTab === 'channels') return <ChannelsView channels={channels} onRefresh={refresh} />;
    if (activeTab === 'packages') return <PackagesView packages={packages} onRefresh={refresh} />;
    if (activeTab === 'streams') return <StreamsView streams={streams} />;
    if (activeTab === 'player') return <WebPlayerView channels={channels.filter((channel) => channel.enabled)} />;
    return <ConfigView />;
  }, [activeTab, channels, customers, dashboard, devices, packages, streams]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">StreamGate</div>
        <nav>
          {tabs.map(({ id, label, Icon }) => (
            <button className={activeTab === id ? 'nav-button active' : 'nav-button'} key={id} onClick={() => setActiveTab(id)}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
            <p>Middleman-Verwaltung fuer Kunden, Geraete, Sender und Streams.</p>
          </div>
          <button className="primary" onClick={() => void refresh()}>
            Aktualisieren
          </button>
        </header>
        {error ? <div className="notice">{error}</div> : null}
        {content}
      </main>
    </div>
  );
}

function DashboardView({ dashboard }: { dashboard: Dashboard | null }) {
  const items = [
    ['Aktive Kunden', dashboard?.activeCustomers ?? 0],
    ['Aktive Geraete', dashboard?.activeDevices ?? 0],
    ['Aktive Streams', dashboard?.activeStreams ?? 0],
    ['Online', dashboard?.onlineDevices ?? 0],
    ['Offline', dashboard?.offlineDevices ?? 0],
    ['TVHeadend', dashboard?.tvheadendStatus ?? 'unbekannt']
  ];

  return (
    <section className="metric-grid">
      {items.map(([label, value]) => (
        <article className="metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function CustomersView({ customers, onRefresh }: { customers: Customer[]; onRefresh: () => Promise<void> }) {
  const createCustomer = async () => {
    await apiPost('/admin/customers', { name: `Kunde ${customers.length + 1}`, packageId: 'pkg_basic_hd' });
    await onRefresh();
  };

  const createCode = async (customerId: string) => {
    const result = await apiPost<{ code: string }>(`/admin/customers/${customerId}/activation-codes`, { expiresInHours: 72 });
    window.alert(`Aktivierungscode: ${result.code}`);
  };

  return (
    <DataSection action={<button onClick={() => void createCustomer()}>Kunde anlegen</button>}>
      <table>
        <thead>
          <tr><th>Name</th><th>Status</th><th>Paket</th><th>Geraete</th><th>Streams</th><th>DVR</th><th /></tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.name}</td>
              <td>{customer.status}</td>
              <td>{customer.packageId}</td>
              <td>{customer.maxDevices}</td>
              <td>{customer.maxConcurrentStreams}</td>
              <td>{customer.dvrEnabled ? 'aktiv' : 'aus'}</td>
              <td><button onClick={() => void createCode(customer.id)}>Code</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataSection>
  );
}

function DevicesView({ devices, onRefresh }: { devices: Device[]; onRefresh: () => Promise<void> }) {
  const block = async (id: string) => {
    await apiPost(`/admin/devices/${id}/block`, {});
    await onRefresh();
  };
  const reset = async (id: string) => {
    await apiPost(`/admin/devices/${id}/reset`, {});
    await onRefresh();
  };

  return (
    <DataSection>
      <table>
        <thead>
          <tr><th>Name</th><th>Status</th><th>Version</th><th>Letzter Sender</th><th>Letzte Aktivitaet</th><th /></tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.name}</td>
              <td>{device.status}</td>
              <td>{device.appVersion ?? '-'}</td>
              <td>{device.lastChannelId ?? '-'}</td>
              <td>{device.lastSeenAt ?? '-'}</td>
              <td className="row-actions">
                <button onClick={() => void block(device.id)}>Sperren</button>
                <button onClick={() => void reset(device.id)}>Reset</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataSection>
  );
}

function ChannelsView({ channels, onRefresh }: { channels: Channel[]; onRefresh: () => Promise<void> }) {
  const toggle = async (channel: Channel) => {
    await apiPut(`/admin/channels/${channel.id}`, { enabled: !channel.enabled });
    await onRefresh();
  };

  return (
    <DataSection>
      <table>
        <thead>
          <tr><th>Nr.</th><th>Name</th><th>Gruppe</th><th>Status</th><th>DVR</th><th>Favorit</th><th /></tr>
        </thead>
        <tbody>
          {channels.map((channel) => (
            <tr key={channel.id}>
              <td>{channel.number}</td>
              <td>{channel.name}</td>
              <td>{channel.groupId}</td>
              <td>{channel.enabled ? 'aktiv' : 'aus'}</td>
              <td>{channel.dvrAllowed ? 'erlaubt' : 'aus'}</td>
              <td>{channel.favorite ? 'ja' : 'nein'}</td>
              <td><button onClick={() => void toggle(channel)}>{channel.enabled ? 'Deaktivieren' : 'Aktivieren'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataSection>
  );
}

function PackagesView({ packages, onRefresh }: { packages: ChannelPackage[]; onRefresh: () => Promise<void> }) {
  const createPackage = async () => {
    await apiPost('/admin/packages', { name: `Paket ${packages.length + 1}` });
    await onRefresh();
  };

  return (
    <DataSection action={<button onClick={() => void createPackage()}>Paket erstellen</button>}>
      <table>
        <thead>
          <tr><th>Name</th><th>Beschreibung</th><th>Status</th><th>Sender</th></tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              <td>{pkg.name}</td>
              <td>{pkg.description}</td>
              <td>{pkg.enabled ? 'aktiv' : 'aus'}</td>
              <td>{pkg.channelIds.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataSection>
  );
}

function StreamsView({ streams }: { streams: StreamSession[] }) {
  return (
    <DataSection>
      <table>
        <thead>
          <tr><th>Kunde</th><th>Geraet</th><th>Sender</th><th>Qualitaet</th><th>Status</th><th>Start</th></tr>
        </thead>
        <tbody>
          {streams.map((stream) => (
            <tr key={stream.id}>
              <td>{stream.customerId}</td>
              <td>{stream.deviceId}</td>
              <td>{stream.channelId}</td>
              <td>{stream.qualityLabel ?? stream.quality ?? '-'}</td>
              <td>{stream.status}</td>
              <td>{stream.openedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataSection>
  );
}

function WebPlayerView({ channels }: { channels: Channel[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [deviceId, setDeviceId] = useState(() => window.localStorage.getItem('streamgateWebDeviceId') ?? '');
  const [deviceToken, setDeviceToken] = useState(() => window.localStorage.getItem('streamgateWebDeviceToken') ?? '');
  const [selectedChannelId, setSelectedChannelId] = useState(() => channels[0]?.id ?? '');
  const [quality, setQuality] = useState<'hd' | 'sd-480p'>(() => (window.localStorage.getItem('streamgateWebQuality') === 'sd-480p' ? 'sd-480p' : 'hd'));
  const [activeStream, setActiveStream] = useState<StreamOpenResult | null>(null);
  const [muted, setMuted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const rememberedSessionId = () => window.localStorage.getItem('streamgateWebStreamSessionId');

  useEffect(() => {
    if (!selectedChannelId && channels[0]) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  useEffect(() => () => destroyPlayer(playerRef.current), []);

  const activate = async () => {
    const result = await apiPost<ActivationResult>('/device/activate', {
      activationCode,
      deviceName: 'StreamGate Webplayer',
      deviceType: 'android_tv',
      appVersion: '0.1.0'
    });
    window.localStorage.setItem('streamgateWebDeviceId', result.deviceId);
    window.localStorage.setItem('streamgateWebDeviceToken', result.deviceToken);
    setDeviceId(result.deviceId);
    setDeviceToken(result.deviceToken);
    setActivationCode('');
    setMessage('Webplayer aktiviert.');
  };

  const start = async () => {
    if (!deviceId || !deviceToken) {
      setMessage('Bitte zuerst mit Aktivierungscode aktivieren.');
      return;
    }
    if (!selectedChannelId) {
      setMessage('Bitte einen Sender auswaehlen.');
      return;
    }

    try {
      setStarting(true);
      setMessage('Stream wird vorbereitet...');
      await closeRememberedSession(activeStream?.streamSessionId ?? rememberedSessionId());
      window.localStorage.setItem('streamgateWebQuality', quality);
      const stream = await apiPost<StreamOpenResult>(
        '/stream/open',
        { channelId: selectedChannelId, deviceId, quality },
        { Authorization: `Bearer ${deviceToken}` }
      );
      setActiveStream(stream);
      window.localStorage.setItem('streamgateWebStreamSessionId', stream.streamSessionId);
      attachStream(streamUrlForBrowser(stream.url), stream.qualityLabel);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Stream konnte nicht gestartet werden.');
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    await closeRememberedSession(activeStream?.streamSessionId ?? rememberedSessionId());
    destroyPlayer(playerRef.current);
    playerRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setActiveStream(null);
    window.localStorage.removeItem('streamgateWebStreamSessionId');
    setMuted(false);
    setMessage('Stream beendet.');
  };

  const logout = () => {
    window.localStorage.removeItem('streamgateWebDeviceId');
    window.localStorage.removeItem('streamgateWebDeviceToken');
    setDeviceId('');
    setDeviceToken('');
    setActiveStream(null);
    window.localStorage.removeItem('streamgateWebStreamSessionId');
    setMuted(false);
    destroyPlayer(playerRef.current);
    playerRef.current = null;
  };

  const attachStream = (url: string, qualityLabel: string) => {
    const video = videoRef.current;
    if (!video) return;
    destroyPlayer(playerRef.current);
    playerRef.current = null;
    video.pause();
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    setMuted(true);
    setMessage(`Stream laedt: ${qualityLabel}. Start erfolgt zunaechst stumm.`);

    if (mpegts.isSupported()) {
      const player = mpegts.createPlayer(
        { type: 'mpegts', isLive: true, url },
        { enableWorker: true, liveBufferLatencyChasing: true }
      );
      playerRef.current = player;
      player.on(mpegts.Events.ERROR, (_type, detail) => {
        void closeRememberedSession(activeStream?.streamSessionId ?? rememberedSessionId());
        setMessage(`Player-Fehler: ${String(detail)}`);
      });
      player.attachMediaElement(video);
      player.load();
      void video.play()
        .then(() => setMessage(`Stream laeuft: ${qualityLabel}. Ton ist noch stumm.`))
        .catch(() => setMessage('Stream ist geladen. Bitte Play im Videoplayer oder Ton einschalten druecken.'));
      return;
    }

    setMessage('Dieser Browser unterstuetzt MPEG-TS per MediaSource nicht.');
    video.src = url;
  };

  const enableSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    void video.play().catch(() => setMessage('Bitte Play im Videoplayer druecken.'));
  };

  return (
    <section className="player-layout">
      <div className="player-surface">
        <video
          ref={videoRef}
          className="webplayer-video"
          controls
          muted={muted}
          playsInline
          onPlaying={() => setMessage(activeStream ? `Stream laeuft: ${activeStream.qualityLabel}${muted ? '. Ton ist noch stumm.' : ''}` : null)}
          onError={() => {
            void closeRememberedSession(activeStream?.streamSessionId ?? rememberedSessionId());
            setMessage('Video konnte nicht abgespielt werden. Bitte Stream neu starten.');
          }}
        />
      </div>
      <aside className="player-controls">
        <label>
          Aktivierungscode
          <div className="inline-control">
            <input value={activationCode} onChange={(event) => setActivationCode(event.target.value.toUpperCase())} placeholder="AB12-CD34" />
            <button onClick={() => void activate()}>Aktivieren</button>
          </div>
        </label>
        <div className="device-state">
          <span>Geraet</span>
          <strong>{deviceId || 'nicht aktiviert'}</strong>
          {deviceId ? <button onClick={logout}>Zuruecksetzen</button> : null}
        </div>
        <label>
          Sender
          <select value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)}>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.number} - {channel.name}</option>
            ))}
          </select>
        </label>
        <div>
          <span className="control-label">Qualitaet</span>
          <div className="segmented">
            <button className={quality === 'hd' ? 'active' : ''} onClick={() => setQuality('hd')}>HD</button>
            <button className={quality === 'sd-480p' ? 'active' : ''} onClick={() => setQuality('sd-480p')}>SD</button>
          </div>
        </div>
        <div className="player-actions">
          <button className="primary" disabled={starting} onClick={() => void start()}>{starting ? 'Startet...' : 'Abspielen'}</button>
          {activeStream && muted ? <button onClick={enableSound}>Ton einschalten</button> : null}
          <button onClick={() => void stop()}>Stop</button>
        </div>
        {message ? <div className="notice compact">{message}</div> : null}
      </aside>
    </section>
  );
}

async function closeRememberedSession(streamSessionId: string | null | undefined) {
  if (!streamSessionId) return;
  try {
    await apiPost('/stream/close', { streamSessionId });
  } catch {
    // A missing or already closed session should not block the next start.
  } finally {
    window.localStorage.removeItem('streamgateWebStreamSessionId');
  }
}

function destroyPlayer(player: { unload: () => void; detachMediaElement: () => void; destroy: () => void } | null) {
  if (!player) return;
  player.unload();
  player.detachMediaElement();
  player.destroy();
}

function streamUrlForBrowser(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname.startsWith('/stream/')) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    if (url.startsWith('/stream/')) {
      return url;
    }
  }
  return url;
}

function ConfigView() {
  return (
    <section className="settings-grid">
      <label>App-Name<input defaultValue="StreamGate TV" /></label>
      <label>Logo URL<input defaultValue="https://example.local/logo.png" /></label>
      <label>Primaerfarbe<input type="color" defaultValue="#0066cc" /></label>
      <label>Supporttext<input defaultValue="Support kontaktieren" /></label>
      <label>Default-Startsender<input defaultValue="ard-hd" /></label>
      <label>Default-EPG-Tage<input type="number" defaultValue={3} /></label>
    </section>
  );
}

function DataSection({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <section className="data-section">
      {action ? <div className="section-actions">{action}</div> : null}
      {children}
    </section>
  );
}
