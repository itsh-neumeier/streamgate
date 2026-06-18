import { Activity, Monitor, Package, Radio, Settings, Tv, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../api/client';
import type { Channel, ChannelPackage, Customer, Dashboard, Device, StreamSession } from '../api/types';

type Tab = 'dashboard' | 'customers' | 'devices' | 'channels' | 'packages' | 'streams' | 'config';

const tabs: Array<{ id: Tab; label: string; Icon: typeof Activity }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: Activity },
  { id: 'customers', label: 'Kunden', Icon: Users },
  { id: 'devices', label: 'Geraete', Icon: Monitor },
  { id: 'channels', label: 'Sender', Icon: Tv },
  { id: 'packages', label: 'Pakete', Icon: Package },
  { id: 'streams', label: 'Streams', Icon: Radio },
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
          <tr><th>Kunde</th><th>Geraet</th><th>Sender</th><th>Status</th><th>Start</th></tr>
        </thead>
        <tbody>
          {streams.map((stream) => (
            <tr key={stream.id}>
              <td>{stream.customerId}</td>
              <td>{stream.deviceId}</td>
              <td>{stream.channelId}</td>
              <td>{stream.status}</td>
              <td>{stream.openedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataSection>
  );
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
