-- Rapor puanı 10 üzerinden değil 100 üzerinden (Murat onayladı, 15 Ekim).
-- Yayındaki her senaryo labının ham toplamı 10 olduğu için eski puan × 10 aynı sonucu verir.
-- Satır puanları (resultReport.rows) ham kalır; ekranda rapor ölçeğine çevrilir (lib/lab/report.ts).
ALTER TABLE "LabAttempt" DROP CONSTRAINT "LabAttempt_reportScore_range";

UPDATE "LabAttempt" SET "reportScore" = "reportScore" * 10 WHERE "reportScore" IS NOT NULL;

UPDATE "LabAttempt"
SET "resultReport" = jsonb_set("resultReport", '{score}', to_jsonb((("resultReport"->>'score')::numeric * 10)::int))
WHERE jsonb_typeof("resultReport"->'score') = 'number';

ALTER TABLE "LabAttempt" ADD CONSTRAINT "LabAttempt_reportScore_range" CHECK ("reportScore" BETWEEN 0 AND 100);
