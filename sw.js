// sw.js
const fileMap = new Map();

// インストール・アクティベート時に即座にページを制御下に置く
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// index.html から送られてきたファイル群をメモリにキャッシュ
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'REGISTER_FILES') {
        fileMap.clear();
        event.data.files.forEach(item => {
            fileMap.set(item.path, item.file);
        });
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
        }
    }
});

// iframe内からのネットワークリクエストをすべて監視・横取りする
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // リクエストURLに「/virtual-root/」が含まれている場合のみ処理
    if (url.pathname.includes('/virtual-root/')) {
        const idx = url.pathname.indexOf('/virtual-root/');
        const relativePath = url.pathname.substring(idx + '/virtual-root/'.length);
        
        // クエリパラメータやハッシュ（?v=1.0 や #top）を綺麗に除去
        const cleanPath = relativePath.split('?')[0].split('#')[0];
        const decodedPath = decodeURIComponent(cleanPath);
        
        let file = fileMap.get(decodedPath);
        
        // フォルダのルートアクセス（末尾が / ）の時は index.html を自動検索
        if (!file && (decodedPath === '' || decodedPath.endsWith('/'))) {
            file = fileMap.get(decodedPath + 'index.html');
        }
        
        if (file) {
            // 本物のサーバーと同じように、正しいContent-Typeを付与してファイルをブラウザに返却
            const responseOptions = {
                status: 200,
                headers: { 'Content-Type': file.type || 'application/octet-stream' }
            };
            event.respondWith(new Response(file, responseOptions));
            return;
        }
        
        // メモリに見つからない場合は404エラーを返す
        event.respondWith(new Response('File Not Found in Virtual System: ' + decodedPath, { status: 404 }));
    }
});