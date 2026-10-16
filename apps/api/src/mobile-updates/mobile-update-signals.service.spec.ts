import { MobileUpdateSignalsService } from './mobile-update-signals.service';

describe('KnowMe-owned update signals', () => {
  const mkRelease = (versionCode: number, version = '1.1.7') => ({
    versionCode,
    version,
    url: `https://github.com/Tresor562/knowMe_mpv/releases/download/v${version}-preview/KnowMe-${version}-preview.apk`,
    sha256: 'a'.repeat(64),
    notes: 'Nouvelle préversion',
    required: false
  });

  it('broadcasts only newer verified release metadata without installation commands', async () => {
    const updates = { getAndroidUpdate: jest.fn()
      .mockResolvedValueOnce({ release: mkRelease(9) })
      .mockResolvedValueOnce({ release: mkRelease(9) })
      .mockResolvedValueOnce({ release: mkRelease(10, '1.1.8') }) };
    const realtime = { emitAndroidUpdateAvailable: jest.fn() };
    const service = new MobileUpdateSignalsService(updates as never, realtime as never);
    await service.checkOnce();
    await service.checkOnce();
    await service.checkOnce();
    expect(realtime.emitAndroidUpdateAvailable).toHaveBeenCalledTimes(2);
    expect(realtime.emitAndroidUpdateAvailable).toHaveBeenNthCalledWith(
      1, { versionCode: 9, version: '1.1.7' }
    );
    expect(realtime.emitAndroidUpdateAvailable).toHaveBeenNthCalledWith(
      2, { versionCode: 10, version: '1.1.8' }
    );
  });

  it('fails safely when release discovery is unavailable or malformed', async () => {
    const updates = { getAndroidUpdate: jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ release: null })
      .mockResolvedValueOnce({ release: mkRelease(11, 'broken') }) };
    const realtime = { emitAndroidUpdateAvailable: jest.fn() };
    const service = new MobileUpdateSignalsService(updates as never, realtime as never);
    await service.checkOnce();
    await service.checkOnce();
    await service.checkOnce();
    expect(realtime.emitAndroidUpdateAvailable).not.toHaveBeenCalled();
  });
});
