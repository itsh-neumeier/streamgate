import { StreamGateService } from './streamgate.service';
import { TvheadendConnectorClient } from './tvheadend-connector.client';

describe('StreamGateService', () => {
  it('activates a device with the seeded activation code', () => {
    const service = new StreamGateService(new TvheadendConnectorClient());
    const result = service.activateDevice({
      activationCode: 'AB12-CD34',
      deviceName: 'Wohnzimmer TV Stick',
      deviceType: 'android_tv',
      appVersion: '0.1.0'
    });

    expect(result.deviceId).toMatch(/^dev_/);
    expect(result.deviceToken).toContain('.');
    expect(result.customerId).toBe('cust_123');
  });

  it('requires the matching device token before opening a signed stream', async () => {
    const connector = {
      channels: async () => ({
        channels: [{ id: 'channel-uuid', uuid: 'channel-uuid', number: 1, name: 'Test TV', enabled: true, profile: 'pass' }]
      }),
      openStream: async () => ({ channelId: 'channel-uuid', mimeType: 'video/mp2t' })
    } as unknown as TvheadendConnectorClient;
    const service = new StreamGateService(connector);
    const activation = service.activateDevice({
      activationCode: 'AB12-CD34',
      deviceName: 'Wohnzimmer TV Stick',
      deviceType: 'android_tv',
      appVersion: '0.1.0'
    });

    await expect(service.openStream({ channelId: 'channel-uuid', deviceId: activation.deviceId })).rejects.toThrow('Device Token fehlt');

    const opened = await service.openStream(
      { channelId: 'channel-uuid', deviceId: activation.deviceId },
      `Bearer ${activation.deviceToken}`
    );
    const url = new URL(opened.url);
    expect(url.pathname).toBe('/stream/channel/channel-uuid');
    expect(url.searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/);
    expect(opened.mimeType).toBe('video/mp2t');
  });
});
