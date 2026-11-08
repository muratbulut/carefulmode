// @vitest-environment node
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Yük yığını (tests/load/stack.sh) "down" ile kendi projesinin konteynerlerini ve veritabanı
// birimini siler. Proje adı LOAD_PROJECT'ten gelir; "cyberguard" verilirse asıl yığının (sunucuda
// canlı, yerelde docker-compose.yml'ninki) birimi silinirdi (güvenlik turu 5). Docker yerine
// çağrıları kaydeden sahte bir komut kullanılır: eski kodda da hiçbir şey silinmez.

let dir: string;
let calls: string;

function stack(project: string, command: string) {
  return spawnSync("bash", ["tests/load/stack.sh", command], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, LOAD_PROJECT: project, LOAD_STATE_DIR: join(dir, "state") },
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cg-load-stack-"));
  calls = join(dir, "calls.txt");
  writeFileSync(join(dir, "docker"), `#!/bin/sh\necho "$*" >> "${calls}"\n`);
  chmodSync(join(dir, "docker"), 0o755);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("yük yığını: proje adı", () => {
  it("asıl yığının adıyla (cyberguard) hiçbir docker komutu çalışmaz", () => {
    for (const command of ["down", "logs"]) {
      const result = stack("cyberguard", command);
      expect(result.status, command).toBe(1);
      expect(result.stdout).toContain("LOAD_PROJECT asıl yığının adı olamaz");
    }
    expect(existsSync(calls)).toBe(false);
  });

  it("ayrı bir projede down yalnızca o projeyi kaldırır", () => {
    expect(stack("cg-load-deneme", "down").status).toBe(0);
    expect(readFileSync(calls, "utf8")).toMatch(/^compose -p cg-load-deneme .* down -v --remove-orphans$/m);
  });
});
