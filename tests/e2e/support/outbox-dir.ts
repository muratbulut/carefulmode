import os from "node:os";
import path from "node:path";

/** Uçtan uca testlerde kod maillerinin yazıldığı klasör (playwright.config.ts sunucuya verir). */
export const mailOutboxDir = path.join(os.tmpdir(), "carefulmode-e2e-outbox");
