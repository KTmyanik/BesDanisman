const formatDate = (d) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

async function test(name, url, bodyObj) {
  const body = new URLSearchParams(bodyObj);
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://fonturkey.com.tr/TarihselVeriler.aspx",
    },
    body,
  });
  const text = await r.text();
  console.log(name, "status", r.status, "text start", text.slice(0, 200));
  try {
    const j = JSON.parse(text);
    const data = j.data ?? [];
    console.log(name, "len", Array.isArray(data) ? data.length : "not array");
    if (Array.isArray(data) && data[0]) {
      console.log("keys", Object.keys(data[0]));
      console.log("sample", JSON.stringify(data[0]));
    }
  } catch (e) {
    console.log("parse err");
  }
}

const end = new Date(2026, 5, 12);
const start = new Date(2026, 4, 1);

const base = {
  fontip: "EMK",
  bastarih: formatDate(start),
  bittarih: formatDate(end),
};

await test("fonturkey-history", "https://fonturkey.com.tr/api/DB/BindHistoryInfo", base);
await test("tefas-history", "https://www.tefas.gov.tr/api/DB/BindHistoryInfo", base);
