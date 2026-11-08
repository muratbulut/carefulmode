# Oda dosyaları

Sitedeki odaların asıl yeri (27 Ekim, Murat). Her mahallenin kendi klasörü var, klasör adı mahallenin adresidir; dosya adı odanın adresidir:

```
labs/rooms/hesap-kalesi/gece-gelen-giris-uyarisi.json
```

Biçim, kurallar ve yayına nasıl girdiği: `docs/guides/new-lab.md` 2.9. Kısaca: dosya PR'la girer, her yayında başlangıç verisi (`prisma/seed.ts`, `prisma/rooms.ts`) dosya değişince odayı günceller; `tests/unit/room-files.test.ts` her dosyayı denetler. Odanın düz metin senaryosu `docs/labs/rooms/` altında yazılır, bu dosya onun koda çevrilmiş hâlidir.

`labs/examples/` örnek odalardır (testler ve formdaki "Örnek içerikle başla"); yeni oda oraya girmez.
