# Careful Mode

**Tıklamadan önce bir dur.**

Careful Mode, ortaokul ve lise öğrencileri için bir dijital güvenlik eğitim platformudur. Öğrenci önce kısa bir eğitim odasında öğrenir, sonra gerçek uygulamalara benzeyen güvenli bir senaryo odasında (sahte mail kutusu, mesajlaşma, alışveriş) karar verir. Yanlış kararda "hacklendin" ekranını görür, sonunda kararlarının raporunu alır. Öğretmenler sınıf açıp ödev verir, yönetim ekibi odaları, gündemi ve günün ipucunu yönetir.

Murat Bulut'un bitirme projesi.

Site: https://bitirme.muratbulut.net

## Neler var

- 5 mahalleli bir yol haritası; her mahallede eğitim ve senaryo odaları
- Postam (kurgusal mail uygulaması), Mesajlar ve satış sahneleri; puan ve geri bildirim yalnızca sunucuda hesaplanır
- Seviyeler, rozetler ve oda raporu
- Öğretmenlik talebi, sınıflar, ödev, okul bülteni
- Yönetim paneli: özet, canlı nabız, kullanıcılar, odalar, gündem, günün ipucu, silinemez kayıt defteri
- Koyu ve gri tema, 390 px telefonda kendi düzeni, "hareketi azalt" desteği

## Teknoloji

Next.js (App Router) ve TypeScript, Tailwind CSS, PostgreSQL ve Prisma, Better Auth, Zod, Resend, Vitest, Playwright, k6, Docker Compose, GitHub Actions.

## Çalıştırma

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate && npm run db:seed
npm run dev
```

Bütün komutlar, kod düzeni ve kurallar: [CLAUDE.md](CLAUDE.md).

## Belgeler

- [Platform dokümanı](docs/platform-document.md): amaç, roller, ekranlar, oda yapısı, mimari, veri modeli, güvenlik, faz planı
- [Başlarken](docs/guides/getting-started.md) ve [yeni oda kılavuzu](docs/guides/new-lab.md)
- [Oda planı](docs/labs/room-plan.md)
- [Tasarım notları](docs/design/) ve [güvenlik turları](docs/security/)
- [Sözlük](docs/glossary.md): Türkçe terimlerin koddaki İngilizce adları

## Lisans

- Kod: [GNU AGPL-3.0](LICENSE)
- İçerik (odalar, senaryolar, sesler, videolar, belgeler): [CC BY-NC-SA 4.0](LICENSE-CONTENT)
- "Careful Mode" adı, logosu ve maskotu bu lisansların dışındadır.
- Sesler ElevenLabs ile üretildi. Diğer bildirimler: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
