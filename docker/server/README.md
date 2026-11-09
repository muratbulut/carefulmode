# Sunucu ve yayın

Site `https://bitirme.muratbulut.net` adresinde, Murat'ın kendi sunucusunda (DeHost, Türkiye) çalışır. Aynı
sunucuda başka işler de vardır. Bu yüzden yayın düzeni **yalnızca
kendi alanına** dokunur. Siteyi elle sunucuya yüklemeye gerek yoktur: `main`'e giren her
değişiklik, testler geçince GitHub Actions ile yüklenir (`.github/workflows/deploy.yml`).

## Akış

1. CI testleri (lint, tip, birim, uçtan uca, Docker yığını) geçer.
2. İmajlar GitHub'da derlenir ve SSH ile sunucuya yüklenir (`docker save` → `docker load`).
   Sunucuya kaynak kod gitmez; yalnızca `docker-compose.yml` ve bu klasör gider.
3. `deploy.sh` veritabanı varsa önce bir yedek alır (aşağıda, Yedekleme), sonra yeni sürümü
   başlatır ve sağlık kontrolünü bekler. Sağlıksızsa bir önceki sürüme kendiliğinden döner ve
   iş kırmızı biter. Migration düştüyse önce onu "geri alındı" diye işaretler (aşağıda,
   Migration başarısız olursa).
4. `install-backup-timer.sh` gece yedeğinin zamanlayıcısını kurar ya da günceller.
5. `install-nginx.sh` nginx girişini kurar ya da günceller (değişiklik yoksa dokunmaz).
6. Uçtan uca testlerin hepsi canlı adreste çalışır.

## Sunucudaki yerler

| Ne | Nerede |
|---|---|
| Yayın klasörü | `/opt/apps/cyberguard` (`.env` burada; veritabanı şifresi ilk kurulumda üretildi, depoda yok) |
| Docker yığını | proje adı `cyberguard`: `db` (kendi PostgreSQL'i, veri `cyberguard_db-data` biriminde), `migrate`, `app` |
| Uygulama portu | `127.0.0.1:3002` (yalnızca sunucunun içinden) |
| nginx girişi | `/etc/nginx/sites-available/bitirme.muratbulut.net` (+ `sites-enabled` bağlantısı) |
| Yedekler | `/opt/backups/cyberguard` (klasör 700, dosyalar 600, yayın kullanıcısının) |
| Gece yedeği | systemd: `/etc/systemd/system/cyberguard-backup.service` ve `cyberguard-backup.timer` |
| HTTPS | Cloudflare Origin sertifikası: `/etc/nginx/ssl/bitirme.muratbulut.net/`. Özel anahtar sunucuda üretildi ve oradan çıkmaz; sertifika açık bilgidir ve depoda `docker/server/bitirme.muratbulut.net.pem` olarak durur. |

Ayrılık kuralları:

- Veritabanı dışarıya port açmaz; diğer yığınlarla ortak ağ ya da veritabanı yoktur.
- Konteynerlerde bellek ve işlemci sınırı ve dönen kayıt (log) dosyaları vardır; site diğer
  işleri sıkıştıramaz, diski dolduramaz.
- nginx ayarı `nginx -t` ile sınanmadan yeniden yüklenmez. Sınama geçmezse eski hal geri konur.
- Diğer sitelerin dosyalarına, sertifikalarına, yığınlarına, birimlerine ve zamanlayıcılarına
  dokunulmaz. Yedek betikleri veritabanı konteynerini Compose etiketiyle (`cyberguard` yığınının
  `db` servisi) bulur, yalnızca kendi klasörüne yazar ve yalnızca `cyberguard-` ile başlayan
  kendi dosyalarını siler.

## Ziyaretçinin IP'si ve HSTS

- Site Cloudflare'in arkasındadır. Cloudflare'in IP aralıkları `cloudflare-ips.txt`'te, tarihli
  bir yorumla durur; `install-nginx.sh` onları site dosyasına yazar (`nginx-render.sh`; sunucudaki
  başka sitelerin ayar parçalarına bağlı değildir). Liste bozuk ya da eksikse nginx'e dokunulmaz.
- nginx girişimiz yalnızca bu aralıklardan (ve sunucunun kendisinden) gelen bağlantıyı kabul
  eder; Cloudflare'i atlayıp sunucunun IP'sine doğrudan gelen bağlantı yanıtsız kapanır (444).
  Diğer sitelerin girişleri bundan etkilenmez.
- nginx yalnızca Cloudflare'den gelen bağlantıda `CF-Connecting-IP` başlığına güvenir. Uygulama
  adresi nginx'in yazdığı `X-Forwarded-For`'dan okur; ziyaretçinin gönderdiği değer geçmez.
- İkisini de CI'daki `tests/deploy/nginx-site.sh` yerel bir nginx'te dener.
- Haftalık kontrol (`.github/workflows/cloudflare-ips.yml`, pazartesi sabahı) listeyi
  Cloudflare'inkiyle (https://www.cloudflare.com/ips) karşılaştırır. Fark varsa iş kırmızı biter
  ve eksik ya da fazla aralıkları iş özetine yazar; `cloudflare-ips.txt` "Son denetim" tarihiyle
  güncellenir, PR ile yayına girer. Güncellenmezse Cloudflare'in yeni aralığından gelen
  ziyaretçiler siteye giremez.
- HSTS: `max-age=31536000; includeSubDomains`, `preload` yok. `includeSubDomains` yalnızca
  `*.bitirme.muratbulut.net`'i bağlar; `muratbulut.net`'e ve diğer sitelere dokunmaz.
  Cloudflare panelindeki alan geneli HSTS ayarı **açılmaz** (bütün alt alanları bağlar).
- Gerekçe ve canlıda bakılacaklar: `docs/security/round-5-phase-6.md`.

## Depo sırları ve değişkenleri

Sunucudaki `.env`'e yazılan değerler GitHub'dan gelir; `deploy.yml` onları komut satırına
koymadan, stdin'den `deploy.sh`'e verir. `deploy.sh` biçimi denetler, boş değeri yazmaz
(sunucudaki eski değer kalır).

| Ad | Nerede tanımlanır | Ne işe yarar |
|---|---|---|
| `SUNUCU_SSH_ANAHTARI` | Settings → Secrets and variables → Actions → **Secrets** | Sunucuya bağlantı: yalnızca yayın için açılmış parolasız anahtarın özel kısmı (`-----BEGIN OPENSSH PRIVATE KEY-----` satırından sonuna kadar); açık kısmı sunucuda yayın kullanıcısının `~/.ssh/authorized_keys` dosyasında |
| `SUNUCU_SSH_PAROLA` | aynı yer, **Secrets** | Yalnızca anahtar parolalıysa; parolasız anahtarda tanımlanmaz |
| `SERVER_HOST`, `SERVER_USER` | aynı yer, **Secrets** | Sunucunun adresi ve yayın kullanıcısı (depo public: sunucunun asıl IP'si Cloudflare'in arkasında gizli kalır) |
| `SERVER_KNOWN_HOSTS` | aynı yer, **Secrets** | Sunucunun açık anahtarları (`ssh-keyscan` çıktısı, satır başına bir anahtar); başka bir makine araya giremez |
| `RESEND_API_KEY` | aynı yer, **Secrets** | Kod mailleri |
| `ADMIN_EMAILS` | aynı yer, **Variables** (sır değil) | İlk yöneticiler (Faz 3) |
| `DEMO_PASSWORD` | aynı yer, **Secrets** | Örnek verideki altı giriş hesabının şifresi (en az 12 karakter; `.env`'e yazılmaz, yalnızca `demo-data` işleminde kullanılır) |

`ADMIN_EMAILS`: virgülle ayrılmış e-posta adresleri (örnek `murat@ornek.com,ekip@ornek.com`).
Bu adreslerden biriyle kayıt olup e-postasını doğrulayan kullanıcı giriş yaptığında yönetici
olur ve `/yonetim`'i görür. Yöneticilik kendiliğinden geri alınmaz: adres listeden çıkarılsa
da kullanıcı yönetici kalır. Değişken boşsa sunucudaki eski değer kalır; değer bir sonraki
yayında (`main`'e giriş ya da Actions → Yayın → Run workflow → `deploy`) sunucuya gider.

## Elle işler (gerekirse)

Sunucuda `/opt/apps/cyberguard` içinde (kullanıcı docker grubunda değil, `sudo` gerekir):

```bash
sudo docker compose -f docker-compose.yml -f docker/server/compose.yml ps     # durum
sudo docker compose -f docker-compose.yml -f docker/server/compose.yml logs --tail 100 app
grep APP_VERSION .env                              # yayındaki sürüm (commit)
sudo docker image ls cyberguard-app                # geri dönülebilecek son üç sürüm
bash docker/server/deploy.sh <eski-commit> bitirme.muratbulut.net 3002   # elle geri dönüş
```

Sunucuya sadece bakan kontrol (hiçbir şeyi değiştirmez): GitHub → Actions → Yayın → Run
workflow → `inspect`. Aynı yerden `backup` (şimdi yedek al), `restore-test` (geri yükleme
denemesi), `demo-data` ve `demo-data-remove` (örnek veri, aşağıda) da çalıştırılabilir; hepsi
yalnızca elle başlatılınca çalışır.

Site Cloudflare 522 verdiyse (Cloudflare sunucuya TCP bağlantısı kuramadı) `inspect`'e "kesinti
aralığı" da girilir (UTC, örnek `2026-10-20 20:00..2026-10-20 20:20`): açılışlar, bellek ve
OOM, TCP kuyruk taşmaları, güvenlik duvarı, Cloudflare adresi yasaklayan araç (fail2ban,
CrowdSec) ve o dakikalardaki günlük satırı sayısı yazılır. Günlük o dakikalarda kesintisiz,
konteynerler ayakta ve SSH da bağlanamıyorsa makine çalışıyor ama ağı kopuk demektir: sorun
sağlayıcıdadır (21 Ekim'de böyle oldu, DeHost).

## Örnek veri

Ekranları dolu görmek için (Murat'ın isteği, 12 Ekim): GitHub → Actions → Yayın → Run workflow →
**`demo-data`** ekler, **`demo-data-remove`** siler. Betik `docker/server/demo-data.sh`; önce elle
bir yedek alır (`backup.sh manual`), sonra yayındaki sürümün migration imajında `prisma/demo.ts`'i
çalıştırır. Uygulama yeniden başlamaz. CI'daki Docker işi aynı betiği her PR'da dener (ekle, tekrar
ekle, sil; silince örnek olmayan satır sayıları aynı kalır).

Ne eklenir (içerik `prisma/demo-data.ts`):

- İzmir / Bornova'da iki kurgusal okul: "Örnek Ortaokulu" (okul sorumlusu var, onay sorumluda) ve
  "Örnek Anadolu Lisesi" (sorumlusu yok).
- 5 öğretmen (onaylanmış talepleriyle), 5 sınıf, 34 öğrenci, 3 ödev; eğitim labında ilerleme ve
  "Sahte Kargo Maili" labında 20 biten (5'i hacklenen) ve 1 yarım deneme. Raporlar sunucunun
  puanlamasıyla aynıdır (birim testi: `tests/unit/demo-data.test.ts`).
- Öğretmen talepleri: PDF belgeli bekleyen (Örnek Ortaokulu), PNG belgeli "yeni okul" talebi,
  bilgi istenmiş bir talep ve reddedilmiş bir talep.
- Günün ipucu: 6 havuzda, 1 taslak, 1 arşivde; son 6 günün ipucu geçmişi. Gündem: 3 yayında, 1
  planlı, 1 taslak haber (başlıkları "Örnek:" ile başlar).

Giriş yapılabilen altı hesap (hoca sunumu için, 1 Kasım); şifrelerinin hepsi `DEMO_PASSWORD` depo
sırrıdır, depoda yazılı değildir:

| Hesap | Kim | Ne gösterir |
| --- | --- | --- |
| `ogrenci@ornek.invalid` | Örnek Öğrenci (7-A, ortaokul) | eğitim bitmiş, iki deneme (biri hacklendi), açık ödev |
| `ogrenci2@ornek.invalid` | Berat Özkan (10-A Bilişim, lise) | kusursuz bir deneme, son günü geçmiş ödev |
| `ogrenci3@ornek.invalid` | Batuhan Yavuz (sınıfsız, yeni kayıt) | hiç başlamamış; sunumda odayı baştan oynamak için |
| `ogretmen@ornek.invalid` | Örnek Öğretmen | 7-A ve 8-B'nin öğretmeni |
| `sorumlu@ornek.invalid` | Örnek Sorumlu | Örnek Ortaokulu'nun okul sorumlusu (Okulum, talep onayı) |
| `yonetici@ornek.invalid` | Örnek Yönetici | rol ADMIN: yönetim panelinin tamamı |

Diğer örnek hesapların şifresi yoktur. Örnek yönetici canlı sitede gerçek yönetici yetkisi taşır
(gerçek öğrencilerin profiline de bakabilir; bakış kayıt defterine yazılır): şifre sunumda
paylaşılırsa ya da sunum bitince `demo-data-remove` çalıştırılır (kayıt defterinde izi varsa hesap
askıya alınır ve rolü STUDENT olur, yoksa silinir). Okulları, ipuçlarını ve haberleri yine ilk gerçek
yönetici eklemiş görünür (gerçek yönetici yoksa işlem durur).

Kurallar:

- Örnek satırların kimliği `demo-` ile başlar; silme yalnızca bunlara ve örnek hesaplara ait
  satırlara (örnek öğretmenle açılan sınıf, örnek öğrencinin denemesi...) dokunur. Gerçek bir
  öğrenci örnek sınıfa katıldıysa yalnızca o üyelik gider.
- `demo-data` önce var olan örnek veriyi siler, sonra baştan kurar (tarihler tazelenir). Hepsi tek
  işlemdir: yarıda kalırsa hiçbir şey değişmez.
- `ornek.invalid` hiçbir zaman teslim edilemez; site bu adreslere mail göndermez (`lib/mail`).
  Örnek kararlar 7 günden eskidir, saatlik temizlik onlar için mail kuyruğuna bir şey koymaz.
- Kayıt defterine hiçbir şey yazılmaz. Örnek bir hesapla yapılan işlem (ör. sorumlu hesabıyla
  bir talebe karar) kayıt defterine yazılırsa o hesap silinemez: askıya alınır, şifresi, oturumları,
  sınıf ve okul bağları kaldırılır; çıktı bunu "Silinemeyen örnek hesaplar" diye yazar. Bir sonraki
  `demo-data` onu yeniden kurar.
- Başka biri örnek adreslerden biriyle kayıt olmuşsa ekleme durur ve adresi yazar.

## Yedekleme

Veritabanının yedeği `docker/server/backup.sh` ile alınır: `cyberguard` yığınının `db`
servisinden `pg_dump -Fc`. Yedekler **yalnızca bu sunucuda**, `/opt/backups/cyberguard` içinde
durur; sunucu dışına kopya yoktur (Murat'ın kararı, Ekim 2026: gizlilik metni "veriler
Türkiye'deki sunucuda saklanır" der). Öğretmen belgeleri de veritabanında olduğu için yedeğe
dahildir.

| Ne zaman | Tür | Ne kadar kalır |
|---|---|---|
| Her gece 03:30 (Türkiye saati), systemd zamanlayıcısı | `nightly` | bu geceki dahil son 7 gece |
| Her yayında, migration'dan önce (`deploy.sh`) | `predeploy` | en yeni 3 |
| Elle: Actions → Yayın → Run workflow → `backup` | `manual` | en yeni 3 |

Hiçbir yedek 7 günden eski kalmaz: hesabını silen kullanıcının verisi en geç 7 gün sonra
yedeklerden de çıkar. Eski yedekler ancak yeni yedek doğrulandıktan sonra silinir; en az bir
sağlam yedek her zaman kalır. Saklama kuralları `backup-lib.sh`'tedir (`prune_backups`) ve
yalnızca klasörün kendisindeki `cyberguard-*.dump` / `.counts` dosyalarına bakar: bağlantılar
(symlink), alt klasörler ve başka adlı dosyalar sayılmaz, silinmez; adı noktalı ya da satır sonu
içeren dosyalar başka bir yedeğin yerine geçmez. CI her PR'da bunları sınar
(`tests/deploy/backup-retention.sh`).

Her yedek iki dosyadır: `cyberguard-<tür>-<UTC zaman>.dump` ve aynı adla `.counts`. `.counts`,
dump'la **aynı anlık görüntüde** sayılmış tablo satır sayılarını ve dump'ın sha256'sını tutar
(site o sırada yazmaya devam etse de sayılar dump'ın içeriğiyle birebir aynıdır). Yedek
alındıktan sonra dosya geçici, ağsız bir konteynerde baştan sona okunur (`pg_restore`); yarım ya
da bozuk dosya asıl adıyla hiç görünmez. Diskte yedekten sonra en az 1 GB boş yer kalmayacaksa
yedek alınmaz (sunucu paylaşılıyor). Şifre gerekmez: `pg_dump` konteynerin içinde yerel soketle
çalışır, hiçbir komut satırında şifre görünmez.

**Yayın öncesi yedek alınamazsa yayın durur.** Yeni sürüm başlatılmaz, çalışan sürüm ve `.env`
olduğu gibi kalır, iş kırmızı biter. Gerekçe: migration veriyi geri dönülmez biçimde
değiştirebilir; o anki yedek yoksa elde en çok bir gün eski gece yedeği kalır. Yayının
gecikmesi siteyi düşürmez; yedeği bozan sebep (disk dolu, veritabanı sağlıksız) çoğu zaman
yayını da bozar. Çok acil bir durumda sunucuda elle atlanabilir (imajlar iş akışında zaten
yüklenmiştir):

```bash
cd /opt/apps/cyberguard
SKIP_PREDEPLOY_BACKUP=1 bash docker/server/deploy.sh <commit> bitirme.muratbulut.net 3002
```

**Gece zamanlayıcısı** her yayında `install-backup-timer.sh` ile kurulur ya da güncellenir
(değişiklik yoksa dokunmaz). Servis yayın kullanıcısıyla çalışır ve docker'ı yayındaki gibi
şifresiz `sudo` ile çağırır. Şifresiz `sudo systemctl` izni yoksa yayın düşmez, iş uyarı verir;
o zaman zamanlayıcı sunucuda bir kez elle kurulur:

```bash
sudo bash /opt/apps/cyberguard/docker/server/install-backup-timer.sh   # son satır BACKUP_TIMER=ready
systemctl list-timers cyberguard-backup.timer                          # sonraki çalışma
```

Gece yedeğinin durumu: `systemctl status cyberguard-backup` ve `journalctl -u cyberguard-backup`.
Son gece yedeği başarısızsa bir sonraki yayın uyarı verir; `inspect` işlemi yedek klasörünü ve
zamanlayıcıyı da gösterir.

Sunucuda elle:

```bash
cd /opt/apps/cyberguard
bash docker/server/backup.sh manual          # şimdi yedek al
ls -la /opt/backups/cyberguard               # yedekler
```

Sunucunun kendisi giderse (disk arızası, sunucu kapanması) yedekler de gider; bunun karşılığı
sunucu dışı kopyadır (aşağıda, Sonra yapılacak). `.env` (veritabanı şifresi, oturum imzası)
yedekte yoktur; yeni bir sunucuda `deploy.sh` yenisini üretir, yedek yine yüklenir (oturumlar
kapanır, kullanıcılar yeniden giriş yapar).

## Geri yükleme denemesi

`docker/server/restore-test.sh [yedek.dump]` (verilmezse en yeni yedek) yedeği geçici bir
`postgres:16-alpine` konteynerine geri yükler, satır sayılarını `.counts` ile birebir karşılaştırır,
birkaç anlamlı sorgu çalıştırır (migration'lar, yabancı anahtarlar, kullanıcı ve lab sayıları,
belge baytları, en yeni kayıt) ve konteyneri siler. Son satır `GERİ YÜKLEME BAŞARILI: ...` ya da
`GERİ YÜKLEME BAŞARISIZ: ...`. Çıktıda kişisel veri yoktur, yalnızca sayılar ve tarihler.

**Canlı veritabanına ve birimine hiç dokunmaz:** docker compose çağırmaz, yığının hiçbir
konteynerine bağlanmaz. Geçici konteynerin ağı yoktur (`--network none`), birimi yoktur (veri
yalnızca bellekte, tmpfs), kök dosya sistemi salt okunurdur, ayrıcalıksız kullanıcıyla çalışır;
yedek ona stdin'den verilir.

- Sunucuda: Actions → Yayın → Run workflow → `restore-test` (ya da sunucuda
  `bash docker/server/restore-test.sh`).
- CI: her PR'da Docker işi yığını kurar, gece zamanlayıcısını kurup servisi bir kez çalıştırır,
  o yedeği geri yükler ve bozuk iki yedeğin (yarım dosya, tutmayan satır sayısı) geçmediğini
  sınar.

### Acil durumda gerçek geri yükleme

Canlı veritabanını bir yedekle değiştirmek elle yapılır (betik yok, bilerek). Adımlar yerelde
denendi. Sunucuda `/opt/apps/cyberguard` içinde:

```bash
dc() { sudo docker compose -f docker-compose.yml -f docker/server/compose.yml "$@"; }
backup=/opt/backups/cyberguard/cyberguard-nightly-<zaman>.dump      # dönülecek yedek

bash docker/server/backup.sh manual                  # 1. şimdiki halin yedeği (geri dönüş için)
bash docker/server/restore-test.sh "$backup"         # 2. dönülecek yedek sağlam mı
dc stop app                                          # 3. site durur (nginx 502 verir)
dc exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
dc exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error --single-transaction' < "$backup"
dc up -d --no-build                                  # 4. migration işi ve uygulama yeniden başlar
```

Yedek, yayındaki sürümden eski bir şemadaysa 4. adımdaki migration işi eksik migration'ları
uygular. Bu adımlar arasında yazılan veri (1. adımdaki yedekte durur) kaybolur.

## Migration başarısız olursa

Yeni sürümün migration'ı düşerse Prisma `_prisma_migrations` tablosuna "başarısız" bir satır
yazar. O satır durdukça hiçbir `prisma migrate deploy` çalışmaz (P3009): önceki sürüme dönülse de
onun migration işi düşer, uygulama başlamaz, site kapanır; sonraki yayınlar da aynı yerde takılır.
`deploy.sh` bu yüzden geri dönmeden önce şunu yapar:

**Kendiliğinden (olağan durum).** PostgreSQL bir migration dosyasını tek bir örtük işlemde
çalıştırır: dosyanın herhangi bir yerinde hata olursa o dosyanın bütün değişiklikleri geri
alınır. `deploy.sh` yayın öncesi yedekten hemen sonra şemanın parmak izini alır (yalnızca yapı,
`pg_dump --schema-only`). Migration düştüğünde parmak izi yine aynıysa migration'ı
`prisma migrate resolve --rolled-back <ad>` ile "geri alındı" diye işaretler (yalnızca
`_prisma_migrations`'taki satır değişir, veriye dokunulmaz) ve önceki sürüme döner. Site açık
kalır, iş kırmızı biter. Migration düzeltilip aynı adla bir sonraki yayına girer; Prisma geri
alındı diye işaretlenmiş migration'ı yeniden uygular. CI her PR'da bunu bilerek düşen bir
migration'la sınar (`tests/deploy/failing-migration`).

**Elle (şema değişmişse).** Migration kendi içinde `COMMIT` içeriyorsa değişikliklerin bir kısmı
kalıcı olmuş olabilir. Parmak izi tutmazsa (ya da karşılaştırılamazsa) `deploy.sh` hiçbir şeyi
işaretlemez, geri dönmez, veritabanına dokunmaz ve şu satırlarla durur:

```text
Şema yayından önceki haliyle aynı değil: migration yarım kalmış olabilir.
Migration işaretlenmedi, veritabanına dokunulmadı; uygulama başlatılmadı (site kapalı).
Yapılacak: docker/server/README.md, "Migration başarısız olursa". Yayın öncesi yedek: /opt/backups/cyberguard/cyberguard-predeploy-<zaman>.dump
.env'deki sürüm: <önceki sürüm> (başlatılmadı).
```

Site bu durumda kapalıdır (İzleme konusu açılır); `.env` zaten önceki sürümü gösterir. Yayın
öncesi yedeğe dönmek için yukarıdaki "Acil durumda gerçek geri yükleme" adımları, `backup=`
satırına bu yayın öncesi yedek yazılarak uygulanır; son adım (`dc up -d --no-build`) önceki
sürümü başlatır. Kaybolan veri yalnızca yayın öncesi yedek ile eski uygulamanın durması arasındaki
birkaç saniyede yazılanlardır (yayın uygulamayı migration'dan önce durdurur; site o andan beri
kapalıdır). Bu adımlar yerelde yarım kalan bir migration'la denendi. Yedeğe dönmek bilerek
otomatik değildir: canlı veritabanını silen ya da üstüne yazan hiçbir betik yoktur.

**Elle düzeltilmeden yeni yayın yapılırsa** (ör. yarım kalan migration'ı düzelten bir commit
`main`'e girdi) `deploy.sh` yayın öncesi yedekten bile önce `_prisma_migrations`'a bakar.
Önceki bir yayından kalan başarısız satır varsa hiçbir şey yapmadan durur:

```text
Önceki bir yayından kalan başarısız migration var: <ad>
Yayın durduruldu; hiçbir şey değiştirilmedi (yedek alınmadı, migration işaretlenmedi, çalışan sürüm aynı).
```

Gerekçe (güvenlik turu 5): yarım kalmış şemanın parmak izi yeni yayının başında alınırsa yeni
migration düşünce "şema aynı" görünür ve önceki yayının yarım migration'ı da "geri alındı" diye
işaretlenirdi; Prisma onu yarım şemanın üstüne yeniden çalıştırırdı. Bu durumdan çıkış her zaman
yukarıdaki elle geri yüklemedir. CI her PR'da yarım kalan bir migration'la (`COMMIT` içeren,
`tests/deploy/partial-migration`) bu iki yayını ve elle geri yüklemeyi sınar. Migration
dosyalarında işlemi bölen komut (`COMMIT`, `BEGIN`, `CONCURRENTLY`, `VACUUM` ...) olmadığını
`tests/unit/migrations.test.ts` denetler.

## İzleme

**Asıl izleme UptimeRobot** (Murat'ın kararı, 12 Ekim; ücretsiz hesap): 5 dakikada bir
`https://bitirme.muratbulut.net/api/health` adresine bakar, site ya da veritabanı düşerse
Murat'a e-posta gönderir. `/api/health` veritabanına da `SELECT 1` ile bakar (3 sn zaman aşımı);
veritabanına ulaşılamazsa 503 döner, bu da erişilemiyor sayılır. Kurulum (bir kez, UptimeRobot
panelinde): New monitor → HTTP(s) → adres yukarıdaki → aralık 5 dakika → uyarı e-postası.
Cloudflare'in bot koruması UptimeRobot'u engellerse `/api/health` için bir WAF istisnası gerekir.

**Elle kontrol (yedek):** `.github/workflows/uptime.yml` aynı adrese bakar (üç deneme, yarımşar
dakika arayla). Site erişilemezse depoda tek bir **"Site erişilemiyor"** konusu (issue) açar,
açıksa saatte en çok bir yorum ekler, site dönünce kesinti süresini yazıp konuyu kapatır.
Zamanlaması kapalıdır, yalnızca elle çalışır (Actions → Site izleme → Run workflow): depo özel
(private) olduğu için her çalışma Actions dakikasından düşer ve en az 1 dakika sayılır; 10
dakikada bir çalışsa ayda ~4.460 dakika eder ve ücretsiz sınırı (2.000) aşar, sınır dolunca CI
ve yayın da durur. İzinleri yalnızca `issues: write`; sunucuya bağlanmaz, sır kullanmaz.

## Türkçe adlardan geçiş (Ekim 2026)

Kod İngilizce adlara geçince sunucudaki adlar da değişti: `.env`'deki `SURUM`, `ALAN_ADI`,
`UYGULAMA_PORTU` yerine `APP_VERSION`, `DOMAIN`, `APP_PORT`; imaj `cyberguard-uygulama` yerine
`cyberguard-app`; betikler `docker/sunucu/` yerine `docker/server/`. `deploy.sh` geçişi ilk
çalışmasında kendisi yapar. Veritabanı tabloları da yeniden adlandırıldığı için yeni ve boş bir
birimle (`cyberguard_db-data`) başlandı; eskisi (`cyberguard_veritabani`, yalnızca 4 mahalle
vardı) silinmedi. Gerek kalmadığında şu komutla silinebilir:

```bash
sudo docker volume rm cyberguard_veritabani
```

## Sonra yapılacak

- Sunucu dışı yedek kopyası: şimdilik yok (Murat'ın kararı, Ekim 2026). Eklenirse yedekler
  sunucudan şifrelenmiş çıkmalı (örneğin `age` ile) ve Türkiye'de bir depolama alanına
  gitmeli; gizlilik metni buna göre güncellenmeli.
