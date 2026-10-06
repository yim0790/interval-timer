// 인터벌 타이머 PWA 서비스워커
// ⚠️ 파일 구조가 바뀌면 아래 CACHE 버전 숫자를 반드시 올릴 것 (vN → vN+1).
//    HTML은 network-first라 index만 수정한 경우엔 버전을 올리지 않아도 새로고침으로 반영됨.
//    아이콘/매니페스트 등 정적 자원을 바꿨을 때만 버전을 올리면 됨.
const CACHE = 'interval-timer-v1';

// 오프라인에서도 앱이 열리도록 캐싱할 셸. 페이지가 여러 개면 모두 나열.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
// 음성(voice/Vxx.mp3)은 SHELL에 넣지 않음: 파일이 하나라도 없으면 설치가 실패하기 때문.
// 처음 재생할 때 자동 캐시(cache-first) → 이후 오프라인 재생 가능.
// ⚠️ 같은 이름의 음성 파일을 새로 녹음해 교체했다면 위 CACHE 버전 숫자를 올릴 것.

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // HTML(페이지 이동)은 network-first — 온라인이면 항상 최신본, 오프라인이면 캐시.
  // 이 규칙이 "index 올려도 화면이 안 바뀌는" 캐시 함정을 막아줌.
  const isHTML = req.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (sameOrigin && isHTML) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  if (sameOrigin) {
    // 정적 자원(아이콘·매니페스트): cache-first
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
  } else {
    // 외부(지도 타일·CDN 폰트 등): network-first, 실패 시 캐시
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
