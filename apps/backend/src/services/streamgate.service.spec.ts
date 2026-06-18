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
});
