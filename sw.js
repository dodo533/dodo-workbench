/* DJW Workbench Service Worker: offline + fast start + auto update (network-first for HTML) */
const CACHE = 'dajiuwan-v31-20260813';
const ASSETS = ['./', './index.html', './gallery.html', './manifest.webmanifest', './icons.js', './stickers.js', './firebase-app.js', './firebase-auth.js', './firebase-db.js', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); })
  );
});
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isNav(req, url){
  return req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('index.html');
}

function sameResponse(a, b){
  try{
    const la=a.headers.get('last-modified'), lb=b.headers.get('last-modified');
    const ca=a.headers.get('content-length'), cb=b.headers.get('content-length');
    if(la && lb && la !== lb) return false;
    if(la && lb && la === lb) return true;
    if(ca && cb && ca === cb) return true;
    return a.clone().text().then(function(ta){ return b.clone().text().then(function(tb){ return ta === tb; }); });
  }catch(e){ return Promise.resolve(true); }
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
  e.respondWith((async function(){
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(function(res){
      if(res && res.ok){ try{ cache.put(req, res.clone()); }catch(err){} }
      return res;
    }).catch(function(){ return cached; });
    return cached || network;
  })());
});