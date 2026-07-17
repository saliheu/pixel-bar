# Piksel Bar 🕹️ — 2D Sanal Bar & Sohbet

Kullanıcıların takma ad, avatar rengi ve şapka seçerek girdiği, **4 salondan** (Neon, Arcade, Lofi, Disko — her biri 25 kişilik, toplam 100 eşzamanlı oyuncu) birini seçip katıldığı gerçek zamanlı bir web uygulaması. Her salon kendi 2D neon bar haritasında yaşar: oyuncular birbirini yürürken görür, masalara oturup rastgele biriyle eşleşerek **Taş-Kağıt-Makas, Retro Pong, Hafıza Kartı, Refleks Düellosu, Penaltı veya Frikik** oynar ya da sadece sohbet eder. Sahnede gitar/bateri çalınır, barmen içki servis eder, dans pistinde 2+ kişi dans edince parti başlar.

## Oyunlar

| Oyun | Mekanik |
|---|---|
| Taş-Kağıt-Makas | Kör seçim; ilk 5 galibiyeti alan maçı kazanır |
| Retro Pong | Gerçek zamanlı raket; ilk 5 gol |
| Hafıza Kartı | Sıralı kart eşleştirme, 8 çift |
| Refleks Düellosu | Yeşil sinyalde önce basan turu alır; erken basan turu kaybeder, ilk 3 tur |
| **Penaltı** | Şutör kale ağzına serbest nişan alır, güç ve isabet çubuklarını durdurur. Sert şut kalecinin erişimini daraltır ama isabet çubuğu hızlanır (ıska riski). Kaleci kör olarak uzanma noktası seçer; top erişim çemberine düşerse kurtarır. 5'er vuruş, eşitlikte altın vuruş |
| **Frikik (Duvarı Aş)** | Penaltı mekaniğinin üstüne **baraj**: her vuruşta yeri değişir. Falso kaydırıcısıyla topu barajın etrafından dolandırman ya da üstünden aşırman gerekir; canlı yörünge önizlemesi yolun açık olup olmadığını gösterir |

## Salon (oda) sistemi

- Giriş ekranında 4 salon kartı canlı doluluk bilgisiyle listelenir (`GET /lobbies`, 3 sn'de bir yenilenir); dolu salonlar seçilemez.
- Salon kapasitesi `BAR_CAPACITY` (25), salon listesi `BAR_IDS` ile `backend/src/config.ts`'te tanımlıdır; frontend'deki `BARS` listesiyle aynı tutulmalıdır.
- Sunucu dolu salona bağlanmayı `4008` kapanış koduyla reddeder; istemci bunu görünce salon seçimine döner (yeniden bağlanma döngüsüne girmez).
- Hareket, sohbet, emote ve zone yayınları salonla sınırlıdır; salonlar birbirini hiçbir şekilde görmez/duymaz.
- HUD'daki 🚪 düğmesi salon değiştirmek için giriş ekranına döndürür.
- Doğrulama: `backend/scripts/smoke-multiroom.mjs` (23 kontrol: izolasyon, kapasite reddi, oyun odaları, sayaç temizliği). Çalıştırma: `PORT=8099 node dist/index.js` + `node scripts/smoke-multiroom.mjs 8099`.

## Mimari

- **backend/** — Node.js + TypeScript + `ws`. Tüm oyuncu/oda/oyun state'i sunucu RAM'inde (Map yapıları), veritabanı yok. Render.com free tier için tasarlandı.
- **frontend/** — Vite + TypeScript + PixiJS. Netlify'da statik dosya olarak barındırılır.
- İletişim: tek bir WebSocket bağlantısı üzerinden JSON mesaj protokolü (`protocol.ts`, her iki tarafta birebir aynı tutulur — biri değişirse diğerine kopyalanmalı).

## Yerel Geliştirme

**Backend:**
```bash
cd backend
npm install
npm run dev   # tsx watch, varsayılan port 8080
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev   # varsayılan port 5173; VITE_WS_URL tanımsızsa ws://localhost:8080 varsayılır
```

Tarayıcıda `http://localhost:5173` açın. İkinci bir sekme/pencere açarak çoklu oyuncu davranışını test edebilirsiniz.

### Kontroller

| Tuş | İşlev |
|---|---|
| `WASD` / ok tuşları | Haritada yürüme |
| `E` | Yakındaki masaya/tabureye/kabine/banka oturma ("Otur"/"Oyuna Gir" rozeti göründüğünde); kalkmak için tekrar `E` veya bir yön tuşu |
| `1`–`6` | Emote: karakter animasyonu oynatır (👋 el sallar, 😂 güler, ❤️ kalp, 🎉 kutlar, 😮 şaşırır, 🕺 dans eder) |
| Alt-ortadaki çubuk | Dünya sohbeti: yakındaki oyunculara konuşma baloncuğu olarak görünür |
| `↑` / `↓` | Pong'da raket kontrolü |
| `Boşluk` / büyük buton | Refleks Düellosu'nda basma; Penaltı/Frikik'te güç ve isabet çubuklarını durdurma |
| Fare | Penaltı/Frikik'te kale ağzına nişan alma ve kaleci uzanma noktası seçme |

## Dağıtım (Deployment)

### Backend → Render.com (Free Web Service)

1. Render dashboard'da "New Web Service" oluşturun, bu repoyu bağlayın.
2. `render.yaml` otomatik algılanır (rootDir: `backend`, build: `npm install && npm run build`, start: `npm start`).
3. Render `PORT` env var'ını otomatik enjekte eder; backend buna `0.0.0.0` üzerinden bind olur.
4. İsteğe bağlı `ALLOWED_ORIGIN` env var'ı ile bağlantıları frontend origin'inizle sınırlayın (virgülle ayrılmış liste, örn. `https://pikselbar.netlify.app`). Boşsa tüm origin'ler kabul edilir.
5. Deploy sonrası backend URL'iniz `https://<servis-adi>.onrender.com` şeklinde olur; WebSocket için `wss://<servis-adi>.onrender.com` kullanılır.

**Not:** Render free tier ~15 dakika hareketsizlikte uykuya dalar, ilk istekte 30-60 saniye "cold start" gecikmesi olur. Frontend bunu otomatik reconnect-with-backoff ile karşılar ve "Bara bağlanılıyor..." ekranı gösterir. İsterseniz [UptimeRobot](https://uptimerobot.com) gibi ücretsiz bir servisle `/health` endpoint'ini periyodik ping'leyerek instance'ı daha sık uyanık tutabilirsiniz (opsiyonel, uygulamaya gömülü değildir).

### Frontend → Netlify

1. Netlify'da "Add new site" → bu repoyu bağlayın.
2. `netlify.toml` otomatik algılanır (base: `frontend`, publish: `frontend/dist`).
3. Site ayarlarından **Environment variables** kısmına `VITE_WS_URL` ekleyin, değeri Render backend'inizin `wss://` adresi olsun (örn. `wss://tutacak-backend.onrender.com`). Sayfa `https` üzerinden sunulduğu için `ws://` değil mutlaka `wss://` kullanın.
4. Deploy edin.

## Kapsam Notları

- Girişte takma ad (2–16 karakter) ve 8 renkten avatar seçilir; isim çakışırsa sunucu `#2` gibi bir ek koyar, geçersizse anonim isim üretir. Hesap sistemi yok, isim yalnızca oturum boyunca yaşar.
- 4 ayrı salon (her biri kendi harita kopyası); aynı salondakiler birbirini görür (üst çubukta salon adı + canlı oyuncu sayısı).
- Bir masaya/zona oturma, o zonun boş koltuğuna kimin oturduğuna göre rastgele 2 kişilik özel bir oda açar (RPS, Pong, Hafıza Kartı veya düz sohbet masası — hepsi sabit 2 kişilik).
- Bar haritasında ayrıca odasız, serbest oturulabilen banklar var — bunlara oturmak hiçbir chat/oyun odası açmaz, sadece görsel bir "oturma" durumudur.
- Oda-sohbeti (`chat_send`) sadece o odaya özeldir. Dünya sohbeti ve emote'lar yakınlıktaki (260px) oyunculara görünür, kalıcı geçmişleri yoktur.
- Sunucu tarafı korumalar: sohbet/emote rate-limiti (1/sn), 200 karakter sınırı, 2 KB mesaj boyutu limiti, salon başına 25 / toplam 100 oyuncu sınırı, hareket doğrulama, isteğe bağlı origin kontrolü, SIGTERM'de düzgün kapanış.
- Mobil destek yok; dar/dokunmatik ekranlarda "masaüstünde açın" ekranı gösterilir.
- İlk giriş deneyimi: dünya ışıklarla açılır, spawn'a spot düşer, isimli karşılama banner'ı + barmen selamı görünür. Sol alttaki "🌙 İlk Gece Görevleri" paneli (emote yap, sohbet et, tabureye otur, dans et, masaya otur, oyun bitir) yeni kullanıcıyı özelliklerde gezdirir; hepsi tamamlanınca konfeti + kalıcı "⭐ Müdavim" rozeti (localStorage) verilir.
