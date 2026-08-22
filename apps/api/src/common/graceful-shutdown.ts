export type ShutdownHookApplication = {
  enableShutdownHooks(signals?: NodeJS.Signals[]): void;
};

export const API_SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

export function configureGracefulShutdown(app: ShutdownHookApplication): void {
  app.enableShutdownHooks([...API_SHUTDOWN_SIGNALS]);
}
