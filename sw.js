/* DJW Workbench Service Worker: offline + fast start + auto update */
/* v33: 双缓存 - 版本化外壳(CACHE) + 稳定资源(ASSET_CACHE: 贴纸/图标/SDK 不随更新重下) */
const CACHE = 'dajiuwan-v36-20260813';
const ASSET_CACHE = 'dajiuwan-assets-v1';
const SHELL = ['./', './index.html', './gallery.html', './manifest.webmanifest'];
const STABLE = ['./icons.js', './stickers.js', './firebase-app.js', './firebase-auth.js', './firebase-db.js', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }),
      caches.open(ASSET_CACHE).then(function(c){ return c.addAll(STABLE); })
    ]).then(function(){ return self.skipWaiting(); })
  );
});
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE && k !== ASSET_CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isNav(req, url){
  return req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('index.html');
}

function stableName(name){
  return name === 'icons.js' || name === 'stickers.js' || name === 'firebase-app.js' || name === 'firebase-auth.js' || name === 'firebase-db.js' || name === 'icon-192.png' || name === 'icon-512.png';
}

self.addEventListener('fetch', function(e){
  const req = e.request;
  if(req.method !== 'GET') return;
  let url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;

  // App shell (HTML): network-first so the installed app always gets the latest version when online
  if(isNav(req, url)){
    e.respondWith((async function(){
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      try{
        const res = await fetch(req);
        if(res && res.ok){
          try{ await cache.put(req, res.clone()); }catch(err){}
          return res;
        }
      }catch(err){}
      return cached;
    })());
    return;
  }

  // Static assets: cache-first with background refresh
  const name = url.pathname.split('/').pop();
  const cacheName = stableName(name) ? ASSET_CACHE : CACHE;
  e.respondWith((async function(){
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(function(res){
      if(res && res.ok){ try{ cache.put(req, res.clone()); }catch(err){} }
      return res;
    }).catch(function(){ return cached; });
    return cached || network;
  })());
});
