import { API_SHUTDOWN_SIGNALS, configureGracefulShutdown } from './graceful-shutdown';

describe('configureGracefulShutdown', () => {
  it('registers only the deployment and interactive termination signals', () => {
    const enableShutdownHooks = jest.fn();

    configureGracefulShutdown({ enableShutdownHooks });

    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(enableShutdownHooks).toHaveBeenCalledWith(['SIGTERM', 'SIGINT']);
    expect(API_SHUTDOWN_SIGNALS).toEqual(['SIGTERM', 'SIGINT']);
  });

  it('passes a copy so callers cannot mutate the exported shutdown policy', () => {
    let received: NodeJS.Signals[] | undefined;
    configureGracefulShutdown({
      enableShutdownHooks(signals) {
        received = signals;
      },
    });

    expect(received).not.toBe(API_SHUTDOWN_SIGNALS);
    received?.reverse();
    expect(API_SHUTDOWN_SIGNALS).toEqual(['SIGTERM', 'SIGINT']);
  });
});
