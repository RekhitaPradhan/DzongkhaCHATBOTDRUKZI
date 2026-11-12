const C='drukzi-shell-12',F=['./','index.html','css/style.css','js/app.js','js/worker.js','js/docs.js','manifest.json','docs/facts.json','assets/dragon.jpg','assets/flag.svg','assets/mountains.svg','assets/dzong.svg'];
addEventListener('install',e=>{skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
