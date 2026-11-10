const C='drukzi-shell-1',F=['./','index.html','css/style.css','js/app.js','js/worker.js','manifest.json'];
addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
