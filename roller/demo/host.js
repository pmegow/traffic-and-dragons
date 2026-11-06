// The native bridge is injected before the page loads. A browser never needs its npm package.
const HOSTS = Object.freeze({
  web: Object.freeze({ assets: 'web', serviceWorker: true }),
  native: Object.freeze({ assets: 'bundled', serviceWorker: false }),
});

export function hostFor(runtime) {
  return HOSTS[runtime.Capacitor?.isNativePlatform() ? 'native' : 'web'];
}
