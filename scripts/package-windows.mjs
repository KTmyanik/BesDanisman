/**
 * Windows masaüstü paketi oluşturur:
 *   release/BesDanisman/BesDanisman.exe
 *   release/BesDanisman/app/          (Next.js standalone)
 *   release/BesDanisman/node/         (portable Node.js)
 *   release/BesDanisman/scripts/        (fon skorlama)
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createReadStream } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const releaseDir = path.join(projectRoot, "release", "BesDanisman");
const appDir = path.join(releaseDir, "app");
const nodeDir = path.join(releaseDir, "node");

const NODE_VERSION = "v20.18.0";
const NODE_ZIP = `node-${NODE_VERSION}-win-x64.zip`;
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/${NODE_ZIP}`;

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: process.platform === "win32",
    ...opts,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

async function downloadFile(url, dest) {
  await new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          file.close();
          fs.unlinkSync(dest);
          downloadFile(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`İndirme hatası: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", reject);
  });
}

async function extractNodeZip(zipPath) {
  const extractDir = path.join(releaseDir, "_node_extract");
  rmDir(extractDir);
  fs.mkdirSync(extractDir, { recursive: true });

  // PowerShell Expand-Archive
  run("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
  ]);

  const extracted = path.join(extractDir, `node-${NODE_VERSION}-win-x64`);
  fs.mkdirSync(nodeDir, { recursive: true });
  fs.copyFileSync(path.join(extracted, "node.exe"), path.join(nodeDir, "node.exe"));

  rmDir(extractDir);
  fs.unlinkSync(zipPath);
}

async function main() {
  console.log("=== BES Danışman Windows Paketi ===\n");

  // 1. Production build
  run("npm", ["run", "build"]);

  const standaloneSrc = path.join(projectRoot, ".next", "standalone");
  if (!fs.existsSync(standaloneSrc)) {
    console.error("Standalone build bulunamadı. next.config.js output:standalone olmalı.");
    process.exit(1);
  }

  // 2. Release klasörü
  rmDir(releaseDir);
  fs.mkdirSync(releaseDir, { recursive: true });

  console.log("\n> Uygulama dosyaları kopyalanıyor...");
  copyDir(standaloneSrc, appDir);

  // static + public (standalone için zorunlu)
  const staticSrc = path.join(projectRoot, ".next", "static");
  const staticDest = path.join(appDir, ".next", "static");
  if (fs.existsSync(staticSrc)) copyDir(staticSrc, staticDest);

  const publicSrc = path.join(projectRoot, "public");
  const publicDest = path.join(appDir, "public");
  if (fs.existsSync(publicSrc)) copyDir(publicSrc, publicDest);

  // Fon skorlama scriptleri
  const scriptsDest = path.join(releaseDir, "scripts");
  fs.mkdirSync(scriptsDest, { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, "scripts", "rank-bes-funds.py"),
    path.join(scriptsDest, "rank-bes-funds.py")
  );
  fs.copyFileSync(
    path.join(projectRoot, "requirements.txt"),
    path.join(releaseDir, "requirements.txt")
  );

  // fund-ranking.ts app içinde scripts arar — app/scripts'e de kopyala
  const appScripts = path.join(appDir, "scripts");
  fs.mkdirSync(appScripts, { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, "scripts", "rank-bes-funds.py"),
    path.join(appScripts, "rank-bes-funds.py")
  );

  // 3. Portable Node.js
  if (!fs.existsSync(path.join(nodeDir, "node.exe"))) {
    console.log("\n> Node.js indiriliyor (portable)...");
    const zipPath = path.join(releaseDir, NODE_ZIP);
    try {
      await downloadFile(NODE_URL, zipPath);
      await extractNodeZip(zipPath);
      console.log("Node.js hazır.");
    } catch (e) {
      console.warn("Node indirilemedi:", e.message);
      console.warn("BesDanisman.exe sistem Node.js kullanacak.");
    }
  }

  // 4. pkg ile exe oluştur
  console.log("\n> BesDanisman.exe oluşturuluyor...");
  const pkgBin = path.join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "pkg.cmd" : "pkg"
  );

  if (!fs.existsSync(pkgBin)) {
    console.log("pkg kuruluyor...");
    run("npm", ["install", "pkg@5.8.1", "--save-dev"]);
  }

  run("npx", [
    "pkg",
    path.join(projectRoot, "scripts", "launcher.cjs"),
    "--targets",
    "node18-win-x64",
    "--output",
    path.join(releaseDir, "BesDanisman.exe"),
    "--compress",
    "GZip",
  ]);

  // 5. Kullanım notu
  fs.writeFileSync(
    path.join(releaseDir, "NASIL-KULLANILIR.txt"),
    `BES Danışman — Masaüstü Sürümü
================================

1. BesDanisman.exe dosyasına çift tıklayın
2. Tarayıcı otomatik açılır (http://localhost:3002)
3. Kapatmak için siyah konsol penceresini kapatın

Fon skorlaması için (ilk kurulum, bir kez):
  py -m pip install -r requirements.txt

Not: Bu klasörü taşımadan silmeden kullanın.
Tüm dosyalar (app, node, scripts) exe ile aynı klasörde kalmalıdır.
`,
    "utf8"
  );

  console.log(`
=== Paket hazır! ===

Klasör: ${releaseDir}

BesDanisman.exe dosyasına çift tıklayarak uygulamayı başlatabilirsiniz.
Masaüstüne kısayol oluşturmak için exe'ye sağ tık → Masaüstüne kısayol oluştur
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
