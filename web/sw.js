/* The service worker that deliberately does almost nothing.
 *
 * It exists so the portal can be installed to a home screen: a browser will
 * only offer that for a page with a manifest and a service worker holding a
 * fetch handler. Installing is the whole point — an icon on the phone, no
 * browser chrome, and, on both Android and iOS 16.4 and later, notifications
 * that arrive with the app closed.
 *
 * What it does NOT do is cache anything, and that is a decision rather than an
 * omission. Two deploys of this portal have already been lost to caching: once
 * to a config file left out of an upload, once to a module imported by a bare
 * name while being cached for a year. The whole build is arranged around one
 * rule — index.html is never cached and carries a build number that every
 * other file is fetched under — and a service worker that kept its own copies
 * would quietly undo that and serve a version of the payroll that no longer
 * exists.
 *
 * So: the fetch handler is present, and returns nothing, which lets every
 * request go to the network exactly as it would without a service worker. An
 * HR portal needs the network anyway; there is nothing useful to show offline
 * that would not be a stale figure pretending to be a current one.
 *
 * If offline ever earns its place, it belongs to specific, safe things — the
 * shell and the icons, never data — and it should be added deliberately, with
 * the build number in the cache name so a deploy cannot be outlived.
 */

const VERSION = 'corplex-one-passthrough-1';

self.addEventListener('install', () => {
  // Take over at once rather than waiting for every tab to close. Safe here
  // precisely because this worker holds nothing that could go stale.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // If an earlier worker ever did cache, clear what it left behind.
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally empty. Returning without calling respondWith lets the
  // browser handle the request itself, headers and all.
});

// Notifications, once there is a sender to push them. A push with no
// payload still shows something rather than nothing.
self.addEventListener('push', event => {
  let body = 'Open CorpLex One to see what changed.';
  let title = 'CorpLex One';
  try{
    const data = event.data ? event.data.json() : null;
    if(data && data.title) title = data.title;
    if(data && data.body)  body  = data.body;
  }catch(_){ /* a push that is not JSON still gets the default */ }
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'corplex-one'
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const open = all.find(c => 'focus' in c);
    if(open) return open.focus();
    if(self.clients.openWindow) return self.clients.openWindow('/');
  })());
});

// Named so the version is visible in DevTools when somebody is wondering
// which worker is running.
self.VERSION = VERSION;
