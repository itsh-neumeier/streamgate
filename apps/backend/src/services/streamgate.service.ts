import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ActivateDeviceDto, CreateDvrTimerDto, CustomerLoginDto, HeartbeatDto, OpenStreamDto } from '../dto/api.dto';
import {
  CreateActivationCodeDto,
  CreateCustomerDto,
  PreviewStreamDto,
  UpdateChannelDto,
  UpdateCustomerDto,
  UpdateDeviceDto,
  UpdatePackageDto
} from '../dto/admin.dto';
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
  loginUsername?: string;
  loginPasswordHash?: string;
  tvheadendUsername?: string;
  tvheadendPassword?: string;
  tvheadendProfile?: string;
  dvrProfile?: string;
  tvheadendHdProfile?: string;
  tvheadendSdProfile?: string;
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
  quality: 'hd' | 'sd-480p';
  qualityLabel: string;
  status: 'active' | 'closed' | 'expired' | 'error';
  openedAt: string;
  closedAt?: string;
  lastHeartbeatAt?: string;
  clientIp?: string;
  userAgent?: string;
  url: string;
}

interface DvrTimer {
  id: string;
  customerId: string;
  deviceId: string;
  tvheadendTimerId?: string;
  tvheadendUsername: string;
  channelId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'recording' | 'completed' | 'cancelled' | 'error';
}

interface Recording {
  id: string;
  customerId: string;
  deviceId: string;
  tvheadendRecordingId?: string;
  channelId: string;
  title: string;
  subtitle?: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
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
      loginUsername: 'max',
      loginPasswordHash: this.hashCustomerPassword('streamgate'),
      tvheadendUsername: 'sg_cust_123',
      tvheadendPassword: 'streamgate',
      tvheadendProfile: 'pass',
      dvrProfile: 'default',
      tvheadendHdProfile: 'prd-matroska_h264_transcode',
      tvheadendSdProfile: 'prd-matroska_h264_transcode_sd',
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
  private dvrTimers: DvrTimer[] = [];
  private recordingsData: Recording[] = [];
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

  customerLogin(dto: CustomerLoginDto) {
    const username = dto.username.trim().toLowerCase();
    const customer = this.customers.find((item) => item.status === 'active' && item.loginUsername?.toLowerCase() === username);
    if (!customer || !customer.loginPasswordHash || customer.loginPasswordHash !== this.hashCustomerPassword(dto.password)) {
      throw new UnauthorizedException('Kundenzugangsdaten sind ungueltig.');
    }
    const existingDeviceCount = this.devices.filter((device) => device.customerId === customer.id && device.status !== 'reset').length;
    if (existingDeviceCount >= customer.maxDevices) {
      throw new BadRequestException('Maximale Geraeteanzahl erreicht.');
    }
    const deviceId = this.id('dev');
    const deviceToken = this.signDeviceToken(deviceId);
    const now = new Date().toISOString();
    this.devices.push({
      id: deviceId,
      customerId: customer.id,
      name: dto.deviceName?.trim() || 'Webplayer',
      deviceTokenHash: this.hash(deviceToken),
      status: 'active',
      appVersion: dto.appVersion,
      lastSeenAt: now,
      updateChannel: 'stable',
      createdAt: now,
      updatedAt: now
    });
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
      streamProfiles: [
        { id: 'hd', label: 'HD', description: 'H.264 in Originalaufloesung' },
        { id: 'sd-480p', label: 'SD', description: 'H.264 480p fuer schwaches WLAN' }
      ],
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

  async channels(authorization?: string) {
    await this.refreshChannels();
    const allowedChannelIds = this.allowedChannelIdsForAuthorization(authorization);
    return {
      channels: this.channelsData
        .filter((channel) => channel.enabled && (!allowedChannelIds || allowedChannelIds.has(channel.id)))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    };
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

  async openStream(dto: OpenStreamDto, authorization?: string, clientIp?: string, userAgent?: string | string[]) {
    await this.refreshChannels();
    const device = this.authorizedDevice(dto.deviceId, authorization);
    if (device.status !== 'active') {
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
    const customerPackage = this.packagesData.find((item) => item.id === customer.packageId && item.enabled);
    if (!customerPackage || !customerPackage.channelIds.includes(channel.id)) {
      throw new UnauthorizedException('Sender ist nicht im Kundenpaket enthalten.');
    }
    const activeCount = this.streamSessions.filter((session) => session.customerId === customer.id && session.status === 'active').length;
    if (activeCount >= customer.maxConcurrentStreams) {
      throw new BadRequestException('Maximale parallele Streams erreicht.');
    }

    const quality = this.normalizeQuality(dto.quality);
    const stream = await this.connector.openStream(channel.tvheadendChannelUuid, channel.defaultStreamProfile, quality, this.tvheadendAccessForCustomer(customer));
    const streamSessionId = this.id('str');
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:8088';
    const url = `${publicBaseUrl.replace(/\/$/, '')}/stream/ticket/${encodeURIComponent(stream.ticket)}`;
    const session: StreamSession = {
      id: streamSessionId,
      customerId: customer.id,
      deviceId: device.id,
      channelId: channel.id,
      quality,
      qualityLabel: stream.label,
      status: 'active',
      openedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      clientIp,
      userAgent: Array.isArray(userAgent) ? userAgent.join(',') : userAgent,
      url
    };
    this.streamSessions.push(session);
    return { streamSessionId, url, expiresIn: stream.expiresIn, mimeType: stream.mimeType, quality, qualityLabel: stream.label };
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

  recordings(authorization?: string) {
    const device = this.requireAuthorizedDevice(authorization);
    return { recordings: this.recordingsData.filter((recording) => recording.customerId === device.customerId) };
  }

  timers(authorization?: string) {
    const device = this.requireAuthorizedDevice(authorization);
    return { timers: this.dvrTimers.filter((timer) => timer.customerId === device.customerId && timer.status !== 'cancelled') };
  }

  async createTimer(dto: CreateDvrTimerDto, authorization?: string) {
    await this.refreshChannels();
    const device = this.requireAuthorizedDevice(authorization);
    const customer = this.mustCustomer(device.customerId);
    if (!customer.dvrEnabled) {
      throw new UnauthorizedException('DVR ist fuer diesen Kunden nicht aktiviert.');
    }
    const channel = this.channelsData.find((item) => item.id === dto.channelId && item.enabled);
    if (!channel) {
      throw new NotFoundException('Sender nicht gefunden.');
    }
    if (!channel.dvrAllowed) {
      throw new BadRequestException('Aufnahmen sind fuer diesen Sender nicht erlaubt.');
    }
    const customerPackage = this.packagesData.find((item) => item.id === customer.packageId && item.enabled);
    if (!customerPackage || !customerPackage.channelIds.includes(channel.id)) {
      throw new UnauthorizedException('Sender ist nicht im Kundenpaket enthalten.');
    }
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime <= startTime) {
      throw new BadRequestException('Aufnahmezeitraum ist ungueltig.');
    }
    const overlapping = this.dvrTimers.some((timer) => (
      timer.customerId === customer.id
      && ['scheduled', 'recording'].includes(timer.status)
      && this.timeRangesOverlap(startTime, endTime, new Date(timer.startTime), new Date(timer.endTime))
    ));
    if (overlapping) {
      throw new BadRequestException('Es ist bereits eine Aufnahme in diesem Zeitraum geplant.');
    }

    const tvheadendUsername = customer.tvheadendUsername ?? `sg_${customer.id}`;
    const connectorTimer = await this.connector.createTimer({
      customerId: customer.id,
      tvheadendUsername,
      tvheadendPassword: customer.tvheadendPassword,
      tvheadendProfile: customer.tvheadendProfile ?? 'pass',
      dvrProfile: customer.dvrProfile ?? 'default',
      channelId: channel.tvheadendChannelUuid,
      title: dto.title,
      description: dto.description,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    const timer: DvrTimer = {
      id: this.id('timer'),
      customerId: customer.id,
      deviceId: device.id,
      tvheadendTimerId: connectorTimer.id,
      tvheadendUsername,
      channelId: channel.id,
      title: dto.title,
      description: dto.description,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'scheduled'
    };
    this.dvrTimers.push(timer);
    return timer;
  }

  async deleteTimer(id: string, authorization?: string) {
    const device = this.requireAuthorizedDevice(authorization);
    const timer = this.dvrTimers.find((item) => item.id === id && item.customerId === device.customerId);
    if (!timer) {
      throw new NotFoundException('DVR-Timer nicht gefunden.');
    }
    timer.status = 'cancelled';
    if (timer.tvheadendTimerId) {
      await this.connector.deleteTimer(timer.tvheadendTimerId);
    }
    return { ok: true, id };
  }

  deleteRecording(id: string) {
    return { ok: true, id };
  }

  adminCustomers() {
    return { customers: this.customers.map((customer) => this.customerForAdmin(customer)) };
  }

  createCustomer(dto: CreateCustomerDto) {
    if (dto.packageId && !this.packagesData.some((pkg) => pkg.id === dto.packageId)) {
      throw new NotFoundException('Paket nicht gefunden.');
    }
    const loginUsername = dto.loginUsername?.trim();
    if (loginUsername && this.customers.some((customer) => customer.loginUsername?.toLowerCase() === loginUsername.toLowerCase())) {
      throw new BadRequestException('Kundenlogin ist bereits vergeben.');
    }
    const now = new Date().toISOString();
    const customer: Customer = {
      id: this.id('cust'),
      name: dto.name,
      status: 'active',
      packageId: dto.packageId ?? 'pkg_basic_hd',
      maxDevices: 3,
      maxConcurrentStreams: 2,
      dvrEnabled: false,
      loginUsername: loginUsername || undefined,
      loginPasswordHash: dto.loginPassword ? this.hashCustomerPassword(dto.loginPassword) : undefined,
      createdAt: now,
      updatedAt: now
    };
    this.customers.push(customer);
    return this.customerForAdmin(customer);
  }

  adminCustomer(id: string) {
    return this.customerForAdmin(this.mustCustomer(id));
  }

  updateCustomer(id: string, dto: UpdateCustomerDto) {
    const customer = this.mustCustomer(id);
    if (dto.packageId && !this.packagesData.some((pkg) => pkg.id === dto.packageId)) {
      throw new NotFoundException('Paket nicht gefunden.');
    }
    if (dto.loginUsername) {
      const loginUsername = dto.loginUsername.trim();
      const duplicate = this.customers.some((item) => item.id !== customer.id && item.loginUsername?.toLowerCase() === loginUsername.toLowerCase());
      if (duplicate) {
        throw new BadRequestException('Kundenlogin ist bereits vergeben.');
      }
    }
    const normalized: UpdateCustomerDto = { ...dto };
    if ('loginUsername' in dto) {
      normalized.loginUsername = dto.loginUsername?.trim() || undefined;
    }
    if ('loginPassword' in dto) {
      customer.loginPasswordHash = dto.loginPassword ? this.hashCustomerPassword(dto.loginPassword) : undefined;
      delete normalized.loginPassword;
    }
    if ('tvheadendUsername' in dto) {
      normalized.tvheadendUsername = dto.tvheadendUsername?.trim() || undefined;
    }
    if ('tvheadendPassword' in dto) {
      customer.tvheadendPassword = dto.tvheadendPassword?.trim() || undefined;
      delete normalized.tvheadendPassword;
    }
    if ('tvheadendProfile' in dto) {
      normalized.tvheadendProfile = dto.tvheadendProfile?.trim() || undefined;
    }
    if ('dvrProfile' in dto) {
      normalized.dvrProfile = dto.dvrProfile?.trim() || undefined;
    }
    if ('tvheadendHdProfile' in dto) {
      normalized.tvheadendHdProfile = dto.tvheadendHdProfile?.trim() || undefined;
    }
    if ('tvheadendSdProfile' in dto) {
      normalized.tvheadendSdProfile = dto.tvheadendSdProfile?.trim() || undefined;
    }
    Object.assign(customer, normalized, { updatedAt: new Date().toISOString() });
    return this.customerForAdmin(customer);
  }

  deleteCustomer(id: string) {
    const customer = this.mustCustomer(id);
    const now = new Date().toISOString();
    customer.status = 'deleted';
    customer.updatedAt = now;
    this.devices
      .filter((device) => device.customerId === id)
      .forEach((device) => {
        device.status = 'reset';
        device.updatedAt = now;
      });
    this.activationCodes
      .filter((code) => code.customerId === id && code.status === 'unused')
      .forEach((code) => {
        code.status = 'revoked';
      });
    this.streamSessions
      .filter((session) => session.customerId === id && session.status === 'active')
      .forEach((session) => {
        session.status = 'closed';
        session.closedAt = now;
      });
    return this.customerForAdmin(customer);
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

  updatePackage(id: string, body: UpdatePackageDto) {
    const pkg = this.packagesData.find((item) => item.id === id);
    if (!pkg) {
      throw new NotFoundException('Paket nicht gefunden.');
    }
    if (body.name !== undefined) {
      pkg.name = body.name;
    }
    if (body.description !== undefined) {
      pkg.description = body.description;
    }
    if (body.enabled !== undefined) {
      pkg.enabled = body.enabled;
    }
    if (body.channelIds !== undefined) {
      const validChannelIds = new Set(this.channelsData.map((channel) => channel.id));
      pkg.channelIds = body.channelIds.filter((channelId, index, all) => validChannelIds.has(channelId) && all.indexOf(channelId) === index);
    }
    return pkg;
  }

  activeStreams() {
    return { streams: this.streamSessions.filter((session) => session.status === 'active') };
  }

  async previewStream(dto: PreviewStreamDto) {
    await this.refreshChannels();
    const channel = this.channelsData.find((item) => item.id === dto.channelId && item.enabled);
    if (!channel) {
      throw new NotFoundException('Sender nicht gefunden.');
    }

    const quality = this.normalizeQuality(dto.quality);
    const stream = await this.connector.openStream(channel.tvheadendChannelUuid, channel.defaultStreamProfile, quality);
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:8088';
    return {
      streamSessionId: `preview_${randomBytes(6).toString('hex')}`,
      url: `${publicBaseUrl.replace(/\/$/, '')}/stream/ticket/${encodeURIComponent(stream.ticket)}`,
      expiresIn: stream.expiresIn,
      mimeType: stream.mimeType,
      quality,
      qualityLabel: stream.label,
      mode: stream.mode,
      profile: stream.profile
    };
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

    const availableChannelIds = new Set(this.channelsData.map((channel) => channel.id));
    this.packagesData.forEach((pkg) => {
      pkg.channelIds = pkg.channelIds.filter((channelId) => availableChannelIds.has(channelId));
    });

    const defaultPackage = this.packagesData.find((pkg) => pkg.id === 'pkg_basic_hd');
    if (defaultPackage) {
      defaultPackage.channelIds = defaultPackage.channelIds.length > 0 ? defaultPackage.channelIds : this.channelsData.map((channel) => channel.id);
    }
  }

  private allowedChannelIdsForAuthorization(authorization?: string) {
    if (!authorization?.replace(/^Bearer\s+/i, '')) {
      return null;
    }
    const device = this.deviceFromToken(authorization);
    if (!device) {
      return new Set<string>();
    }
    const customer = this.mustCustomer(device.customerId);
    const customerPackage = this.packagesData.find((pkg) => pkg.id === customer.packageId && pkg.enabled);
    return new Set(customerPackage?.channelIds ?? []);
  }

  private tvheadendAccessForCustomer(customer: Customer) {
    return {
      username: customer.tvheadendUsername,
      password: customer.tvheadendPassword,
      defaultProfile: customer.tvheadendProfile,
      hdProfile: customer.tvheadendHdProfile,
      sdProfile: customer.tvheadendSdProfile,
      dvrProfile: customer.dvrProfile
    };
  }

  private customerForAdmin(customer: Customer) {
    return {
      id: customer.id,
      name: customer.name,
      status: customer.status,
      packageId: customer.packageId,
      maxDevices: customer.maxDevices,
      maxConcurrentStreams: customer.maxConcurrentStreams,
      dvrEnabled: customer.dvrEnabled,
      loginUsername: customer.loginUsername,
      tvheadendUsername: customer.tvheadendUsername,
      tvheadendProfile: customer.tvheadendProfile,
      dvrProfile: customer.dvrProfile,
      tvheadendHdProfile: customer.tvheadendHdProfile,
      tvheadendSdProfile: customer.tvheadendSdProfile,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      loginPasswordSet: Boolean(customer.loginPasswordHash),
      tvheadendPasswordSet: Boolean(customer.tvheadendPassword)
    };
  }

  private resolveDevice(authorization?: string) {
    const device = this.deviceFromToken(authorization);
    if (device) {
      return device;
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

  private deviceFromToken(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return null;
    }
    const deviceId = Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8');
    return this.devices.find((item) => item.id === deviceId && item.deviceTokenHash === this.hash(token)) ?? null;
  }

  private authorizedDevice(deviceId: string, authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException('Device Token fehlt.');
    }

    const tokenDeviceId = Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8');
    const device = this.devices.find((item) => item.id === deviceId && item.id === tokenDeviceId && item.deviceTokenHash === this.hash(token));
    if (!device) {
      throw new UnauthorizedException('Device Token ist ungueltig.');
    }
    return device;
  }

  private requireAuthorizedDevice(authorization?: string) {
    const device = this.deviceFromToken(authorization);
    if (!device) {
      throw new UnauthorizedException('Device Token ist ungueltig oder fehlt.');
    }
    if (device.status !== 'active') {
      throw new UnauthorizedException('Geraet ist nicht aktiv.');
    }
    const customer = this.mustCustomer(device.customerId);
    if (customer.status !== 'active') {
      throw new UnauthorizedException('Kunde ist nicht aktiv.');
    }
    return device;
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

  private hashCustomerPassword(value: string) {
    const secret = process.env.CUSTOMER_PASSWORD_SECRET ?? process.env.DEVICE_TOKEN_SECRET ?? 'streamgate-dev-secret';
    return this.hash(`${value}.${secret}`);
  }

  private id(prefix: string) {
    return `${prefix}_${randomBytes(6).toString('hex')}`;
  }

  private normalizeQuality(value?: string): 'hd' | 'sd-480p' {
    return value === 'sd-480p' ? 'sd-480p' : 'hd';
  }

  private timeRangesOverlap(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
    return leftStart < rightEnd && rightStart < leftEnd;
  }

  private activationCode() {
    const raw = randomBytes(4).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  }
}
