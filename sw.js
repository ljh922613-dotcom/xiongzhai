/* 凶宅试睡员 PWA service worker
   素材文件名带内容哈希，放在长期缓存 xzssy-assets-v1；
   更新游戏时替换 index.html 与 a/ 文件夹即可；页面补齐离线包后会删掉新版不再使用的旧素材。 */
const ASSET_CACHE='xzssy-assets-v1';
const CORE=['./','index.html','manifest.webmanifest','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-192.png','icons/icon-maskable-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(ASSET_CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k!==ASSET_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin) return;
  if(r.headers.has('range')){e.respondWith(rangeResp(r));return;}
  // 页面本身：联网优先（拿到新版本），断网用缓存
  if(r.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(ASSET_CACHE);
      try{const res=await fetch(r);if(res.ok){c.put('index.html',res.clone());}return res;}
      catch(_){return (await c.match('index.html'))||(await c.match('./'))||Response.error();}
    })());
    return;
  }
  // 素材：缓存优先
  e.respondWith((async()=>{
    const c=await caches.open(ASSET_CACHE);
    const hit=await c.match(r,{ignoreSearch:true});
    if(hit) return hit;
    try{const res=await fetch(r);if(res.ok&&res.status===200) c.put(r,res.clone());return res;}
    catch(_){return Response.error();}
  })());
});

async function rangeResp(r){
  const c=await caches.open(ASSET_CACHE);
  let full=await c.match(r.url,{ignoreSearch:true});
  if(!full){
    try{const res=await fetch(r.url);if(!res.ok)return fetch(r);await c.put(r.url,res.clone());full=res;}
    catch(_){return Response.error();}
  }
  const buf=await full.arrayBuffer();
  const m=/bytes=(\d*)-(\d*)/.exec(r.headers.get('range')||'');
  let st=m&&m[1]?+m[1]:0,en=m&&m[2]?+m[2]:buf.byteLength-1;en=Math.min(en,buf.byteLength-1);
  return new Response(buf.slice(st,en+1),{status:206,headers:{'Content-Type':full.headers.get('Content-Type')||'application/octet-stream','Content-Range':`bytes ${st}-${en}/${buf.byteLength}`,'Content-Length':String(en-st+1),'Accept-Ranges':'bytes'}});
}
