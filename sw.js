/* 呆啾丸 · Service Worker（PWA 离线可用 + 秒开刷新 + 自动更新） */
const CACHE = 'dajiuwan-v15-20260816';
const ASSETS = ['./', './index.html', './gallery.html', './manifest.webmanifest', './icons.js', './stickers.js', './firebase-app.js', './firebase-db.js', './icon-192.png', './icon-512.png'];

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
  e.respondWith((async function(){
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(async function(res){
      if(res && res.ok){
        try{ await cache.put(req, res.clone()); }catch(err){}
        if(url.pathname === '/' || url.pathname.endsWith('index.html')){
          const same = await sameResponse(cached, res);
          if(cached && !same){
            const clients = await self.clients.matchAll();
            clients.forEach(function(cl){ cl.postMessage({ type: 'UPDATE_AVAILABLE' }); });
          }
        }
      }
      return res;
    }).catch(function(){ return cached; });
    return cached || network;
  })());
});
