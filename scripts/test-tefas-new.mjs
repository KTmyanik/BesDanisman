async function warmSession() {
  const jar = new Map();
  const getCookie = (res) => {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (k && v) jar.set(k.trim(), v.trim());
    }
  };
  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  };

  let r = await fetch("https://www.tefas.gov.tr/tr/", { headers });
  getCookie(r);
  await r.text();

  r = await fetch("https://www.tefas.gov.tr/tr/FonAnaliz/FonKarsilastirma.aspx", {
    headers: { ...headers, Referer: "https://www.tefas.gov.tr/tr/", Cookie: cookieHeader() },
  });
  getCookie(r);
  await r.text();

  return cookieHeader;
}

const body = {
  dil: "TR",
  fonTipi: "EMK",
  kurucuKodu: null,
  sfonTurKod: null,
  fonTurAciklama: null,
  islem: 1,
  fonTurKod: null,
  fonGrubu: null,
  donemGetiri1a: "1",
  donemGetiri3a: "1",
  donemGetiri6a: "1",
  donemGetiri1y: "1",
  donemGetiriyb: "1",
  donemGetiri3y: "1",
  donemGetiri5y: "1",
  basTarih: null,
  bitTarih: null,
  calismaTipi: 2,
  getiriOrani: "1",
};

const cookies = await warmSession();
const r = await fetch("https://www.tefas.gov.tr/api/funds/fonGetiriBazliBilgiGetir", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: "https://www.tefas.gov.tr",
    Referer: "https://www.tefas.gov.tr/tr/",
    Cookie: cookies,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  body: JSON.stringify(body),
});

const text = await r.text();
console.log("status", r.status, "len", text.length);
console.log(text.slice(0, 800));
try {
  const j = JSON.parse(text);
  const list = j.resultList ?? [];
  console.log("funds", list.length);
  if (list[0]) console.log("sample keys", Object.keys(list[0]));
  if (list[0]) console.log("sample", JSON.stringify(list[0], null, 2));
} catch {}
