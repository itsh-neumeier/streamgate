import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ActivateDeviceDto, HeartbeatDto, OpenStreamDto } from '../dto/api.dto';
import { CreateActivationCodeDto, CreateCustomerDto, UpdateChannelDto, UpdateCustomerDto, UpdateDeviceDto } from '../dto/admin.dto';
import { TvheadendConnectorClient } from './tvheadend-connector.client';

type Status = 'active' | 'blocked' | 'reset' | 'suspended' | 'deleted';

interface Customer {
  id: string;
  name: string;
  status: Status;
  packageId: string;
  maxDevices: number;
  maxConcurrentStreams: number;
  dvrEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Device {
  id: string;
  customerId: string;
  name: string;
  deviceTokenHash: string;
  status: Status;
  appVersion?: string;
  lastSeenAt?: string;
  lastChannelId?: string;
  updateChannel: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivationCode {
  id: string;
  code: string;
  customerId: string;
  expiresAt: string;
  usedAt?: string;
  usedByDeviceId?: string;
  status: 'unused' | 'used' | 'expired' | 'revoked';
}

interface Channel {
  id: string;
  number: number;
  name: string;
  logoUrl: string;
  groupId: string;
  tvheadendChannelUuid: string;
  enabled: boolean;
  adult: boolean;
  defaultStreamProfile: string;
  dvrAllowed: boolean;
  sortOrder: number;
  favorite: boolean;
}

interface StreamSession {
  id: string;
  customerId: string;
  deviceId: string;
  channelId: string;
  status: 'active' | 'closed' | 'expired' | 'error';
  openedAt: string;
  closedAt?: string;
  lastHeartbeatAt?: string;
  clientIp?: string;
  userAgent?: string;
  url: string;
}

@Injectable()
export class StreamGateService {
  private customers: Customer[] = [
    {
      id: 'cust_123',
      name: 'Max Mustermann',
      status: 'active',
      packageId: 'pkg_basic_hd',
      maxDevices: 3,
      maxConcurrentStreams: 2,
      dvrEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  private devices: Device[] = [];
  private activationCodes: ActivationCode[] = [
    {
      id: 'act_seed',
      code: 'AB12-CD34',
      customerId: 'cust_123',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      status: 'unused'
    }
  ];

  private groups = [
    { id: 'grp_public', name: 'Oeffentlich-Rechtlich', sortOrder: 1 },
    { id: 'grp_private', name: 'Private HD', sortOrder: 2 }
  ];

  private channelsData: Channel[] = [
    {
      id: 'ard-hd',
      number: 1,
      name: 'ARD HD',
      logoUrl: 'https://example.local/logo/ard.png',
      groupId: 'grp_public',
      tvheadendChannelUuid: 'mock-ard-hd',
      enabled: true,
      adult: false,
      defaultStreamProfile: 'hls-lan',
      dvrAllowed: true,
      sortOrder: 1,
      favorite: true
    },
    {
      id: 'zdf-hd',
      number: 2,
      name: 'ZDF HD',
      logoUrl: 'https://example.local/logo/zdf.png',
      groupId: 'grp_public',
      tvheadendChannelUuid: 'mock-zdf-hd',
      enabled: true,
      adult: false,
      defaultStreamProfile: 'hls-lan',
      dvrAllowed: true,
      sortOrder: 2,
      favorite: true
    },
    {
      id: 'rtl-hd',
      number: 3,
      name: 'RTL HD',
      logoUrl: 'https://example.local/logo/rtl.png',
      groupId: 'grp_private',
      tvheadendChannelUuid: 'mock-rtl-hd',
      enabled: true,
      adult: false,
      defaultStreamProfile: 'hls-lan',
      dvrAllowed: false,
      sortOrder: 3,
      favorite: false
    }
  ];

  private packagesData = [
    { id: 'pkg_basic_hd', name: 'TV Basic HD', description: 'Basis HD Paket', enabled: true, channelIds: ['ard-hd', 'zdf-hd', 'rtl-hd'] }
  ];

  private streamSessions: StreamSession[] = [];
  private audit: Array<Record<string, unknown>> = [];

  constructor(private readonly connector: TvheadendConnectorClient) {}

  activateDevice(dto: ActivateDeviceDto) {
    const code = this.activationCodes.find((item) => item.code.toUpperCase() === dto.activationCode.toUpperCase());
    if (!code || code.status !== 'unused') {
      throw new UnauthorizedException('Aktivierungscode ist ungueltig oder bereits verwendet.');
    }
    if (new Date(code.expiresAt).getTime() < Date.now()) {
      code.status = 'expired';
      throw new UnauthorizedException('Aktivierungscode ist abgelaufen.');
    }

    const customer = this.mustCustomer(code.customerId);
    const deviceCount = this.devices.filter((device) => device.customerId === customer.id && device.status !== 'reset').length;
    if (deviceCount >= customer.maxDevices) {
      throw new BadRequestException('Maximale Geraeteanzahl erreicht.');
    }

    const deviceId = this.id('dev');
    const deviceToken = this.signDeviceToken(deviceId);
    const now = new Date().toISOString();
    const device: Device = {
      id: deviceId,
      customerId: customer.id,
      name: dto.deviceName,
      deviceTokenHash: this.hash(deviceToken),
      status: 'active',
      appVersion: dto.appVersion,
      lastSeenAt: now,
      updateChannel: 'stable',
      createdAt: now,
      updatedAt: now
    };
    this.devices.push(device);
    code.status = 'used';
    code.usedAt = now;
    code.usedByDeviceId = deviceId;

    return { deviceId, deviceToken, customerId: customer.id };
  }

  logout(deviceId: string) {
    this.streamSessions
      .filter((session) => session.deviceId === deviceId && session.status === 'active')
      .forEach((session) => {
        session.status = 'closed';
        session.closedAt = new Date().toISOString();
      });
    return { ok: true };
  }

  getDeviceConfig(authorization?: string) {
    const device = this.resolveDevice(authorization);
    return {
      deviceId: device.id,
      startScreen: 'live_tv',
      startChannelId: device.lastChannelId ?? 'ard-hd',
      streamProfile: 'hls-lan',
      dvrEnabled: this.mustCustomer(device.customerId).dvrEnabled,
      timeshiftEnabled: false,
      favoritesEnabled: true,
      epgDays: 3,
      uiMode: 'streamgate_lightweight',
      animationsEnabled: false
    };
  }

  heartbeat(dto: HeartbeatDto) {
    const device = this.devices.find((item) => item.id === dto.deviceId);
    if (!device) {
      throw new NotFoundException('Geraet nicht gefunden.');
    }
    const now = new Date().toISOString();
    device.lastSeenAt = now;
    device.appVersion = dto.appVersion ?? device.appVersion;
    device.lastChannelId = dto.currentChannel ?? device.lastChannelId;
    device.updatedAt = now;
    this.streamSessions
      .filter((session) => session.deviceId === dto.deviceId && session.status === 'active')
      .forEach((session) => {
        session.lastHeartbeatAt = now;
      });
    return { ok: true, serverTime: now };
  }

  bootstrap(authorization?: string) {
    const device = this.resolveDevice(authorization);
    const customer = this.mustCustomer(device.customerId);
    const pkg = this.packagesData.find((item) => item.id === customer.packageId);
    return {
      customer: { id: customer.id, name: customer.name, package: pkg?.name ?? 'Unbekannt' },
      device: { id: device.id, name: device.name, status: device.status, mode: 'android_tv' },
      ui: {
        theme: 'streamgate_lightweight',
        startScreen: 'live_tv',
        startChannel: device.lastChannelId ?? 'ard-hd',
        showHomeRows: true,
        enableAnimations: false
      },
      features: {
        liveTv: true,
        epg: true,
        dvr: customer.dvrEnabled,
        timeshift: false,
        favorites: true,
        channelNumbers: true
      },
      limits: {
        maxConcurrentStreams: customer.maxConcurrentStreams,
        maxDevices: customer.maxDevices
      },
      branding: {
        appName: 'StreamGate TV',
        logoUrl: 'https://example.local/logo.png',
        primaryColor: '#0066cc',
        supportText: 'Support kontaktieren'
      }
    };
  }

  async channels() {
    await this.refreshChannels();
    return { channels: this.channelsData.filter((channel) => channel.enabled).sort((a, b) => a.sortOrder - b.sortOrder) };
  }

  favoriteChannels() {
    return { channels: this.channelsData.filter((channel) => channel.enabled && channel.favorite) };
  }

  updateFavorites(channelIds: string[]) {
    this.channelsData.forEach((channel) => {
      channel.favorite = channelIds.includes(channel.id);
    });
    return this.favoriteChannels();
  }

  channelGroups() {
    return { groups: this.groups };
  }

  nowNext() {
    return {
      items: this.channelsData.map((channel) => ({
        channelId: channel.id,
        now: { title: `${channel.name} Nachrichten`, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1800000).toISOString() },
        next: { title: `${channel.name} Magazin`, startsAt: new Date(Date.now() + 1800000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() }
      }))
    };
  }

  epgGrid(from?: string, to?: string) {
    return { from, to, channels: this.nowNext().items };
  }

  async openStream(dto: OpenStreamDto, clientIp?: string, userAgent?: string | string[]) {
    await this.refreshChannels();
    const device = this.devices.find((item) => item.id === dto.deviceId);
    if (!device || device.status !== 'active') {
      throw new UnauthorizedException('Geraet ist nicht aktiv.');
    }
    const customer = this.mustCustomer(device.customerId);
    if (customer.status !== 'active') {
      throw new UnauthorizedException('Kunde ist nicht aktiv.');
    }
    const channel = this.channelsData.find((item) => item.id === dto.channelId && item.enabled);
    if (!channel) {
      throw new NotFoundException('Sender nicht gefunden.');
    }
    const activeCount = this.streamSessions.filter((session) => session.customerId === customer.id && session.status === 'active').length;
    if (activeCount >= customer.maxConcurrentStreams) {
      throw new BadRequestException('Maximale parallele Streams erreicht.');
    }

    await this.connector.openStream(channel.tvheadendChannelUuid, channel.defaultStreamProfile);
    const streamSessionId = this.id('str');
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:8088';
    const url = `${publicBaseUrl}/stream/mock/${channel.id}.m3u8?session=${streamSessionId}&token=${this.id('tok')}`;
    const session: StreamSession = {
      id: streamSessionId,
      customerId: customer.id,
      deviceId: device.id,
      channelId: channel.id,
      status: 'active',
      openedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      clientIp,
      userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent,
      url
    };
    this.streamSessions.push(session);
    return { streamSessionId, url, expiresIn: 60, mimeType: 'application/x-mpegURL' };
  }

  closeStream(streamSessionId: string) {
    const session = this.streamSessions.find((item) => item.id === streamSessionId);
    if (!session) {
      throw new NotFoundException('Streamsession nicht gefunden.');
    }
    session.status = 'closed';
    session.closedAt = new Date().toISOString();
    return { ok: true, streamSessionId };
  }

  streamSession(id: string) {
    const session = this.streamSessions.find((item) => item.id === id);
    if (!session) {
      throw new NotFoundException('Streamsession nicht gefunden.');
    }
    return session;
  }

  recordings() {
    return { recordings: [] };
  }

  timers() {
    return { timers: [] };
  }

  createTimer(body: Record<string, unknown>) {
    return { id: this.id('timer'), status: 'scheduled', ...body };
  }

  deleteTimer(id: string) {
    return { ok: true, id };
  }

  deleteRecording(id: string) {
    return { ok: true, id };
  }

  adminCustomers() {
    return { customers: this.customers };
  }

  createCustomer(dto: CreateCustomerDto) {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: this.id('cust'),
      name: dto.name,
      status: 'active',
      packageId: dto.packageId ?? 'pkg_basic_hd',
      maxDevices: 3,
      maxConcurrentStreams: 2,
      dvrEnabled: false,
      createdAt: now,
      updatedAt: now
    };
    this.customers.push(customer);
    return customer;
  }

  adminCustomer(id: string) {
    return this.mustCustomer(id);
  }

  updateCustomer(id: string, dto: UpdateCustomerDto) {
    const customer = this.mustCustomer(id);
    Object.assign(customer, dto, { updatedAt: new Date().toISOString() });
    return customer;
  }

  createActivationCode(customerId: string, dto: CreateActivationCodeDto) {
    this.mustCustomer(customerId);
    const code: ActivationCode = {
      id: this.id('act'),
      code: this.activationCode(),
      customerId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * (dto.expiresInHours ?? 72)).toISOString(),
      status: 'unused'
    };
    this.activationCodes.push(code);
    return code;
  }

  adminDevices() {
    return { devices: this.devices };
  }

  updateDevice(id: string, dto: UpdateDeviceDto) {
    const device = this.mustDevice(id);
    Object.assign(device, {
      name: dto.name ?? device.name,
      updateChannel: dto.updateChannel ?? device.updateChannel,
      lastChannelId: dto.startChannelId ?? device.lastChannelId,
      updatedAt: new Date().toISOString()
    });
    return device;
  }

  setDeviceStatus(id: string, status: 'blocked' | 'reset') {
    const device = this.mustDevice(id);
    device.status = status;
    device.updatedAt = new Date().toISOString();
    return device;
  }

  async adminChannels() {
    await this.refreshChannels();
    return { channels: this.channelsData };
  }

  updateChannel(id: string, dto: UpdateChannelDto) {
    const channel = this.channelsData.find((item) => item.id === id);
    if (!channel) {
      throw new NotFoundException('Sender nicht gefunden.');
    }
    Object.assign(channel, dto);
    return channel;
  }

  packages() {
    return { packages: this.packagesData };
  }

  createPackage(body: Record<string, unknown>) {
    const pkg = { id: this.id('pkg'), name: String(body.name ?? 'Neues Paket'), description: String(body.description ?? ''), enabled: true, channelIds: [] as string[] };
    this.packagesData.push(pkg);
    return pkg;
  }

  updatePackage(id: string, body: Record<string, unknown>) {
    const pkg = this.packagesData.find((item) => item.id === id);
    if (!pkg) {
      throw new NotFoundException('Paket nicht gefunden.');
    }
    Object.assign(pkg, body);
    return pkg;
  }

  activeStreams() {
    return { streams: this.streamSessions.filter((session) => session.status === 'active') };
  }

  auditLog() {
    return { auditLog: this.audit };
  }

  dashboard() {
    const onlineThreshold = Date.now() - 1000 * 60 * 5;
    const onlineDevices = this.devices.filter((device) => device.lastSeenAt && new Date(device.lastSeenAt).getTime() > onlineThreshold).length;
    return {
      activeCustomers: this.customers.filter((customer) => customer.status === 'active').length,
      activeDevices: this.devices.filter((device) => device.status === 'active').length,
      activeStreams: this.streamSessions.filter((session) => session.status === 'active').length,
      onlineDevices,
      offlineDevices: Math.max(this.devices.length - onlineDevices, 0),
      tvheadendStatus: (process.env.MOCK_MODE ?? 'true') === 'true' ? 'mock' : 'configured'
    };
  }

  private async refreshChannels() {
    const result = await this.connector.channels();
    const existingByUuid = new Map(this.channelsData.map((channel) => [channel.tvheadendChannelUuid, channel]));

    this.channelsData = result.channels.map((source, index) => {
      const existing = existingByUuid.get(source.uuid);
      return {
        id: source.id,
        number: source.number,
        name: source.name,
        logoUrl: existing?.logoUrl ?? '',
        groupId: existing?.groupId ?? 'grp_tvheadend',
        tvheadendChannelUuid: source.uuid,
        enabled: source.enabled && (existing?.enabled ?? true),
        adult: existing?.adult ?? false,
        defaultStreamProfile: existing?.defaultStreamProfile ?? source.profile,
        dvrAllowed: existing?.dvrAllowed ?? false,
        sortOrder: source.number || index + 1,
        favorite: existing?.favorite ?? false
      };
    });

    const defaultPackage = this.packagesData.find((pkg) => pkg.id === 'pkg_basic_hd');
    if (defaultPackage) {
      defaultPackage.channelIds = this.channelsData.map((channel) => channel.id);
    }
  }

  private resolveDevice(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (token) {
      const deviceId = Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8');
      const device = this.devices.find((item) => item.id === deviceId && item.deviceTokenHash === this.hash(token));
      if (device) {
        return device;
      }
    }
    if (this.devices[0]) {
      return this.devices[0];
    }
    const tokenForSeed = this.signDeviceToken('dev_seed');
    const now = new Date().toISOString();
    const seed: Device = {
      id: 'dev_seed',
      customerId: 'cust_123',
      name: 'Wohnzimmer',
      deviceTokenHash: this.hash(tokenForSeed),
      status: 'active',
      appVersion: '0.1.0',
      lastChannelId: 'ard-hd',
      updateChannel: 'stable',
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now
    };
    this.devices.push(seed);
    return seed;
  }

  private mustCustomer(id: string) {
    const customer = this.customers.find((item) => item.id === id);
    if (!customer) {
      throw new NotFoundException('Kunde nicht gefunden.');
    }
    return customer;
  }

  private mustDevice(id: string) {
    const device = this.devices.find((item) => item.id === id);
    if (!device) {
      throw new NotFoundException('Geraet nicht gefunden.');
    }
    return device;
  }

  private signDeviceToken(deviceId: string) {
    const secret = process.env.DEVICE_TOKEN_SECRET ?? 'streamgate-dev-secret';
    const nonce = randomBytes(12).toString('base64url');
    const payload = Buffer.from(deviceId).toString('base64url');
    const signature = this.hash(`${payload}.${nonce}.${secret}`).slice(0, 32);
    return `${payload}.${nonce}.${signature}`;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private id(prefix: string) {
    return `${prefix}_${randomBytes(6).toString('hex')}`;
  }

  private activationCode() {
    const raw = randomBytes(4).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  }
}
