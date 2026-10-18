/**
 * BES Danışman Windows launcher (CommonJS — pkg uyumlu)
 */
const { spawn, exec } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = 3002;
const URL = `http://localhost:${PORT}`;

const isPkg = typeof process.pkg !== "undefined";
const rootDir = isPkg
  ? path.dirname(process.execPath)
  : path.resolve(__dirname, "..");

const nodeExe = path.join(rootDir, "node", "node.exe");
const appDir = path.join(rootDir, "app");
const serverJs = path.join(appDir, "server.js");

function log(msg) {
  console.log(`[BES Danışman] ${msg}`);
}

function openBrowser() {
  if (process.platform === "win32") {
    exec(`start "" "${URL}"`);
  } else if (process.platform === "darwin") {
    exec(`open "${URL}"`);
  } else {
    exec(`xdg-open "${URL}"`);
  }
}

function waitForServer(maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(URL, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (attempts >= maxAttempts) reject(new Error("Sunucu başlatılamadı"));
        else setTimeout(check, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts >= maxAttempts) reject(new Error("Zaman aşımı"));
        else setTimeout(check, 500);
      });
    };
    check();
  });
}

function findSystemNode() {
  const candidates = [
    path.join(process.env.ProgramFiles || "", "nodejs", "node.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "nodejs", "node.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "node", "node.exe"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "node";
}

function waitKeyAndExit(code) {
  if (process.platform === "win32") {
    console.log("\nDevam etmek için bir tuşa basın...");
    try {
      process.stdin.setRawMode(true);
    } catch (_) {}
    process.stdin.resume();
    process.stdin.on("data", () => process.exit(code));
  } else {
    setTimeout(() => process.exit(code), 5000);
  }
}

function main() {
  log("Başlatılıyor...");

  if (!fs.existsSync(serverJs)) {
    console.error(`
HATA: Uygulama dosyaları bulunamadı.
Beklenen: ${serverJs}

Geliştirici modu için: npm run dev
Paket oluşturmak için: npm run package:win
`);
    waitKeyAndExit(1);
    return;
  }

  const runtimeNode = fs.existsSync(nodeExe) ? nodeExe : findSystemNode();
  log(`Node: ${runtimeNode}`);
  log(`Port: ${PORT}`);

  const child = spawn(runtimeNode, [serverJs], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("error", (err) => {
    console.error("Sunucu hatası:", err.message);
    waitKeyAndExit(1);
  });

  waitForServer()
    .then(() => {
      log("Sunucu hazır, tarayıcı açılıyor...");
      openBrowser();
      log(`Adres: ${URL}`);
      log("Kapatmak için bu pencereyi kapatın.");
    })
    .catch((err) => {
      console.error(err.message);
      child.kill();
      waitKeyAndExit(1);
    });

  process.on("SIGINT", () => {
    child.kill();
    process.exit(0);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log(`Sunucu kapandı (kod: ${code})`);
      waitKeyAndExit(code);
    }
  });
}

main();
