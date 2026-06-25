import { CalendarClock, LogOut, Play, RefreshCw, Square, Tv } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import mpegts from 'mpegts.js';
import { apiDelete, apiGet, apiPost } from '../api/client';
import type { ActivationResult, BootstrapConfig, Channel, DvrTimer, Recording, StreamOpenResult } from '../api/types';

type Tab = 'live' | 'dvr';

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null);
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem('streamgateCustomerDeviceId') ?? '');
  const [deviceToken, setDeviceToken] = useState(() => localStorage.getItem('streamgateCustomerDeviceToken') ?? '');
  const [activationCode, setActivationCode] = useState('');
  const [deviceName, setDeviceName] = useState(() => localStorage.getItem('streamgateCustomerDeviceName') ?? 'Webplayer');
  const [bootstrap, setBootstrap] = useState<BootstrapConfig | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [timers, setTimers] = useState<DvrTimer[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [quality, setQuality] = useState<'hd' | 'sd-480p'>(() => (localStorage.getItem('streamgateCustomerQuality') === 'sd-480p' ? 'sd-480p' : 'hd'));
  const [activeStream, setActiveStream] = useState<StreamOpenResult | null>(null);
  const [muted, setMuted] = useState(true);
  const [tab, setTab] = useState<Tab>('live');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedChannel = useMemo(() => channels.find((channel) => channel.id === selectedChannelId), [channels, selectedChannelId]);

  useEffect(() => () => destroyPlayer(playerRef.current), []);

  useEffect(() => {
    if (deviceToken) {
      void refresh();
    }
  }, [deviceToken]);

  useEffect(() => {
    if (!selectedChannelId && channels[0]) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const activate = async () => {
    setLoading(true);
    try {
      const result = await apiPost<ActivationResult>('/device/activate', {
        activationCode,
        deviceName,
        deviceType: 'android_tv',
        appVersion: 'web-0.1.0'
      });
      localStorage.setItem('streamgateCustomerDeviceId', result.deviceId);
      localStorage.setItem('streamgateCustomerDeviceToken', result.deviceToken);
      localStorage.setItem('streamgateCustomerDeviceName', deviceName);
      setDeviceId(result.deviceId);
      setDeviceToken(result.deviceToken);
      setActivationCode('');
      setMessage('Webplayer aktiviert.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Aktivierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!deviceToken) return;
    setLoading(true);
    try {
      const [bootstrapData, channelsData, timersData, recordingsData] = await Promise.all([
        apiGet<BootstrapConfig>('/app/bootstrap', deviceToken),
        apiGet<{ channels: Channel[] }>('/channels', deviceToken),
        apiGet<{ timers: DvrTimer[] }>('/dvr/timers', deviceToken),
        apiGet<{ recordings: Recording[] }>('/dvr/recordings', deviceToken)
      ]);
      setBootstrap(bootstrapData);
      setChannels(channelsData.channels);
      setTimers(timersData.timers);
      setRecordings(recordingsData.recordings);
      setMessage(null);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const startStream = async (channelId = selectedChannelId) => {
    if (!deviceToken || !deviceId || !channelId) return;
    try {
      setMessage('Stream wird vorbereitet...');
      localStorage.setItem('streamgateCustomerQuality', quality);
      const stream = await apiPost<StreamOpenResult>('/stream/open', { channelId, deviceId, quality }, deviceToken);
      setActiveStream(stream);
      setSelectedChannelId(channelId);
      attachStream(streamUrlForBrowser(stream.url), stream.mimeType);
      setMessage(`Stream laeuft: ${stream.qualityLabel}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Stream konnte nicht gestartet werden.');
    }
  };

  const stopStream = async () => {
    if (activeStream) {
      await apiPost('/stream/close', { streamSessionId: activeStream.streamSessionId }, deviceToken).catch(() => undefined);
    }
    destroyPlayer(playerRef.current);
    playerRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setActiveStream(null);
    setMessage('Stream beendet.');
  };

  const createTimer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiPost('/dvr/timers', {
        channelId: data.get('channelId'),
        title: data.get('title'),
        startTime: data.get('startTime'),
        endTime: data.get('endTime'),
        description: data.get('description')
      }, deviceToken);
      event.currentTarget.reset();
      await refresh();
      setMessage('Aufnahme geplant.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Aufnahme konnte nicht geplant werden.');
    }
  };

  const deleteTimer = async (id: string) => {
    await apiDelete(`/dvr/timers/${id}`, deviceToken);
    await refresh();
  };

  const logout = async () => {
    await stopStream();
    localStorage.removeItem('streamgateCustomerDeviceId');
    localStorage.removeItem('streamgateCustomerDeviceToken');
    setDeviceId('');
    setDeviceToken('');
    setBootstrap(null);
    setChannels([]);
  };

  const attachStream = (url: string, mimeType: string) => {
    const video = videoRef.current;
    if (!video) return;
    destroyPlayer(playerRef.current);
    playerRef.current = null;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    setMuted(true);

    if (isMpegTs(mimeType) && mpegts.isSupported()) {
      const player = mpegts.createPlayer({ type: 'mpegts', isLive: true, url }, { enableWorker: true, liveBufferLatencyChasing: true });
      playerRef.current = player;
      player.on(mpegts.Events.ERROR, (_type, detail) => setMessage(`Player-Fehler: ${String(detail)}`));
      player.attachMediaElement(video);
      player.load();
      void video.play().catch(() => setMessage('Bitte Play im Videoplayer druecken.'));
      return;
    }

    video.src = url;
    void video.play().catch(() => setMessage(`Browser kann diesen Streamtyp eventuell nicht direkt abspielen: ${mimeType}`));
  };

  if (!deviceToken) {
    return (
      <main className="activation-page">
        <section className="activation-panel">
          <h1>StreamGate Web</h1>
          <p>Aktivieren Sie diesen Browser mit Ihrem Freischaltcode.</p>
          <label>Aktivierungscode<input value={activationCode} onChange={(event) => setActivationCode(event.target.value.toUpperCase())} placeholder="AB12-CD34" /></label>
          <label>Geraetename<input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} /></label>
          <button className="primary" disabled={loading || !activationCode} onClick={() => void activate()}>Aktivieren</button>
          {message ? <div className="notice">{message}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <div className="web-shell">
      <header className="header">
        <div>
          <strong>{bootstrap?.branding.appName ?? 'StreamGate Web'}</strong>
          <span>{bootstrap?.customer.name ?? 'Kunde'} · {bootstrap?.customer.package ?? 'Paket'}</span>
        </div>
        <nav>
          <button className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}><Tv size={16} /> Live-TV</button>
          <button className={tab === 'dvr' ? 'active' : ''} onClick={() => setTab('dvr')}><CalendarClock size={16} /> DVR</button>
          <button onClick={() => void refresh()}><RefreshCw size={16} /> Aktualisieren</button>
          <button onClick={() => void logout()}><LogOut size={16} /> Abmelden</button>
        </nav>
      </header>

      {message ? <div className="notice">{message}</div> : null}

      {tab === 'live' ? (
        <main className="live-layout">
          <section className="player-card">
            <video ref={videoRef} className="player" controls muted={muted} playsInline />
            <div className="player-toolbar">
              <div>
                <strong>{selectedChannel ? `${selectedChannel.number} - ${selectedChannel.name}` : 'Kein Sender'}</strong>
                <span>{activeStream ? activeStream.qualityLabel : 'Bereit'}</span>
              </div>
              <div className="actions">
                <button className="primary" onClick={() => void startStream()}><Play size={16} /> Abspielen</button>
                <button onClick={() => { if (videoRef.current) videoRef.current.muted = false; setMuted(false); }}>Ton</button>
                <button onClick={() => void stopStream()}><Square size={16} /> Stop</button>
              </div>
            </div>
          </section>
          <aside className="side-panel">
            <div className="quality">
              <button className={quality === 'hd' ? 'active' : ''} onClick={() => setQuality('hd')}>HD</button>
              <button className={quality === 'sd-480p' ? 'active' : ''} onClick={() => setQuality('sd-480p')}>SD</button>
            </div>
            <div className="channel-list">
              {channels.map((channel) => (
                <button className={channel.id === selectedChannelId ? 'selected' : ''} key={channel.id} onClick={() => void startStream(channel.id)}>
                  <span>{channel.number}</span>
                  <strong>{channel.name}</strong>
                </button>
              ))}
            </div>
          </aside>
        </main>
      ) : (
        <main className="dvr-layout">
          <section className="panel">
            <h2>Aufnahme planen</h2>
            {!bootstrap?.features.dvr ? <p>DVR ist fuer diesen Kunden nicht aktiviert.</p> : null}
            <form className="timer-form" onSubmit={(event) => void createTimer(event)}>
              <label>Sender<select name="channelId" defaultValue={selectedChannelId}>{channels.filter((channel) => channel.dvrAllowed).map((channel) => <option key={channel.id} value={channel.id}>{channel.number} - {channel.name}</option>)}</select></label>
              <label>Titel<input name="title" required placeholder="Sendungstitel" /></label>
              <label>Start<input name="startTime" type="datetime-local" required /></label>
              <label>Ende<input name="endTime" type="datetime-local" required /></label>
              <label>Beschreibung<input name="description" /></label>
              <button className="primary" disabled={!bootstrap?.features.dvr}>Planen</button>
            </form>
          </section>
          <section className="panel">
            <h2>Geplante Aufnahmen</h2>
            <List items={timers} channels={channels} onDelete={deleteTimer} />
          </section>
          <section className="panel">
            <h2>Aufnahmen</h2>
            <RecordingList items={recordings} channels={channels} />
          </section>
        </main>
      )}
    </div>
  );
}

function List({ items, channels, onDelete }: { items: DvrTimer[]; channels: Channel[]; onDelete: (id: string) => Promise<void> }) {
  if (items.length === 0) return <p>Keine Timer geplant.</p>;
  return (
    <div className="item-list">
      {items.map((item) => (
        <article key={item.id}>
          <strong>{item.title}</strong>
          <span>{channelName(channels, item.channelId)} · {formatDate(item.startTime)} bis {formatDate(item.endTime)}</span>
          <button onClick={() => void onDelete(item.id)}>Loeschen</button>
        </article>
      ))}
    </div>
  );
}

function RecordingList({ items, channels }: { items: Recording[]; channels: Channel[] }) {
  if (items.length === 0) return <p>Noch keine Aufnahmen vorhanden.</p>;
  return (
    <div className="item-list">
      {items.map((item) => (
        <article key={item.id}>
          <strong>{item.title}</strong>
          <span>{channelName(channels, item.channelId)} · {formatDate(item.startTime)}</span>
        </article>
      ))}
    </div>
  );
}

function destroyPlayer(player: { unload: () => void; detachMediaElement: () => void; destroy: () => void } | null) {
  if (!player) return;
  player.unload();
  player.detachMediaElement();
  player.destroy();
}

function streamUrlForBrowser(url: string) {
  const parsed = new URL(url, window.location.origin);
  return parsed.pathname.startsWith('/stream/') ? `${window.location.origin}${parsed.pathname}${parsed.search}` : url;
}

function isMpegTs(mimeType: string) {
  return ['video/mp2t', 'video/mpeg', 'application/octet-stream'].includes(mimeType.toLowerCase());
}

function channelName(channels: Channel[], channelId: string) {
  return channels.find((channel) => channel.id === channelId)?.name ?? channelId;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
