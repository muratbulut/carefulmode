-- Eğitim labında cevaplanan soru kartları (güvenlik turu 2, B1). Eğitim ancak yayındaki sürümün
-- bütün soruları (mini test, video sorusu) cevaplanınca biter; bitişi yalnızca tarayıcının "son
-- kart" demesine bırakmaz. Var olan satırlar boş listeyle başlar: bitmiş eğitimler bitmiş kalır,
-- yarım kalanlar bitirirken cevaplamadıkları soruya geri götürülür.

-- AlterTable
ALTER TABLE "TrainingProgress" ADD COLUMN     "answeredCards" TEXT[] DEFAULT ARRAY[]::TEXT[];
