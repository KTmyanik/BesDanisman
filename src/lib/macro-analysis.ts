import type { MacroAnalysis, MacroIndicator, MarketSnapshot } from "./types";

function sentimentFromChange(
  change: number | null,
  invert = false
): "positive" | "negative" | "neutral" {
  if (change === null) return "neutral";
  const effective = invert ? -change : change;
  if (effective > 0.3) return "positive";
  if (effective < -0.3) return "negative";
  return "neutral";
}

function indicator(params: {
  name: string;
  value: number | null;
  changePercent: number | null;
  asOf: string | null;
  unit: string;
  invert?: boolean;
  description: string;
}): MacroIndicator {
  return {
    name: params.name,
    value: params.value,
    changePercent: params.value === null ? null : params.changePercent,
    asOf: params.value === null ? null : params.asOf,
    unit: params.unit,
    sentiment:
      params.value === null
        ? "neutral"
        : sentimentFromChange(params.changePercent, params.invert),
    description: params.description,
  };
}

function levelDescription(
  value: number | null,
  change: number | null,
  whenUp: string,
  whenDown: string,
  missingValue: string,
  missingChange: string
): string {
  if (value === null) return missingValue;
  if (change === null) return missingChange;
  return change > 0 ? whenUp : whenDown;
}

export function buildMacroAnalysis(data: MarketSnapshot): MacroAnalysis {
  const missing: string[] = [];
  if (data.usdTry === null) missing.push("USD/TRY");
  else if (data.usdTryChange === null) missing.push("USD/TRY değişimi");
  if (data.eurTry === null) missing.push("EUR/TRY");
  else if (data.eurTryChange === null) missing.push("EUR/TRY değişimi");
  if (data.bist100 === null) missing.push("BIST 100");
  else if (data.bist100Change === null) missing.push("BIST 100 değişimi");
  if (data.sp500 === null) missing.push("S&P 500");
  else if (data.sp500Change === null) missing.push("S&P 500 değişimi");
  if (data.goldUsd === null) missing.push("Altın (USD/ons)");
  else if (data.goldChange === null) missing.push("Altın (USD/ons) değişimi");
  if (data.vix === null) missing.push("VIX (Korku Endeksi)");
  else if (data.vixChange === null) missing.push("VIX (Korku Endeksi) değişimi");

  const turkey: MacroIndicator[] = [
    indicator({
      name: "USD/TRY",
      value: data.usdTry,
      changePercent: data.usdTryChange,
      asOf: data.usdTryAsOf,
      unit: "₺",
      invert: true,
      description: levelDescription(
        data.usdTry,
        data.usdTryChange,
        "TL baskı altında; döviz korumalı fonlar ve altın cazip olabilir",
        "TL stabil veya güçleniyor",
        "Kur alınamadı. Bu göstergeye bağlı kural uygulanmadı.",
        "Önceki iş günü kuru yok. Değişim kuralı uygulanmadı."
      ),
    }),
    indicator({
      name: "EUR/TRY",
      value: data.eurTry,
      changePercent: data.eurTryChange,
      asOf: data.eurTryAsOf,
      unit: "₺",
      invert: true,
      description: levelDescription(
        data.eurTry,
        data.eurTryChange,
        "EUR/TRY yükseliyor",
        "EUR/TRY gerilemedi",
        "Kur alınamadı. Bu göstergeye bağlı kural uygulanmadı.",
        "Önceki iş günü kuru yok. Değişim kuralı uygulanmadı."
      ),
    }),
    indicator({
      name: "BIST 100",
      value: data.bist100,
      changePercent: data.bist100Change,
      asOf: data.bist100AsOf,
      unit: "puan",
      description: levelDescription(
        data.bist100,
        data.bist100Change,
        "Yerel hisse piyasası olumlu seyrediyor",
        "Yerel hisse piyasasında baskı var",
        "Endeks alınamadı. Bu göstergeye bağlı kural uygulanmadı.",
        "Değişim yok. Hisse kuralı uygulanmadı."
      ),
    }),
  ];

  const global: MacroIndicator[] = [
    indicator({
      name: "S&P 500",
      value: data.sp500,
      changePercent: data.sp500Change,
      asOf: data.sp500AsOf,
      unit: "puan",
      description:
        data.sp500 === null
          ? "Endeks alınamadı. Bu göstergeye bağlı kural uygulanmadı."
          : "ABD hisse piyasası global risk iştahını yansıtır",
    }),
    indicator({
      name: "Altın (USD/ons)",
      value: data.goldUsd,
      changePercent: data.goldChange,
      asOf: data.goldAsOf,
      unit: "$",
      description: levelDescription(
        data.goldUsd,
        data.goldChange,
        "Altın talebi artıyor; güvenli liman arayışı",
        "Altın sakin seyrediyor veya geriliyor",
        "Fiyat alınamadı. Bu göstergeye bağlı kural uygulanmadı.",
        "Değişim yok. Altın kuralı uygulanmadı."
      ),
    }),
    indicator({
      name: "VIX (Korku Endeksi)",
      value: data.vix,
      changePercent: data.vixChange,
      asOf: data.vixAsOf,
      unit: "puan",
      invert: true,
      description:
        data.vix === null
          ? "Endeks alınamadı. Volatilite kuralı uygulanmadı."
          : data.vix > 25
            ? "Piyasada yüksek belirsizlik; defansif fonlara yönelim düşünülebilir"
            : "Piyasa volatilitesi düşük-orta seviyede",
    }),
  ];

  const outlook: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];

  if (typeof data.usdTryChange === "number" && data.usdTryChange > 0.5) {
    risks.push("TL değer kaybı devam ediyor; enflasyon baskısı sürebilir");
    opportunities.push("Döviz ve altın fonları portföyde koruma sağlayabilir");
  }

  if (typeof data.vix === "number" && data.vix > 25) {
    risks.push("Global piyasalarda yüksek belirsizlik (VIX > 25)");
    outlook.push("Kısa vadede defansif pozisyon tercih edilebilir");
  } else if (typeof data.vix === "number" && data.vix < 18) {
    opportunities.push("Düşük volatilite ortamı riskli varlıklar için uygun");
  }

  if (typeof data.bist100Change === "number" && data.bist100Change > 1) {
    opportunities.push("BIST 100 güçlü; yerel hisse fonları değerlendirilebilir");
  } else if (typeof data.bist100Change === "number" && data.bist100Change < -1) {
    risks.push("BIST 100 zayıf; agresif hisse ağırlığı dikkatli ayarlanmalı");
  }

  if (typeof data.sp500Change === "number" && data.sp500Change > 0.5) {
    outlook.push("Global risk iştahı yüksek; dış piyasa fonları desteklenebilir");
  }

  if (typeof data.goldChange === "number" && data.goldChange > 0.5) {
    outlook.push("Altın rallisi devam ediyor; portföye altın fonu eklenebilir");
  }

  if (outlook.length === 0) {
    outlook.push(
      missing.length > 0
        ? "Eksik gösterge olduğu için ek sapma üretilmedi."
        : "Makro ortam karışık. Senaryo, risk bandındaki dağılımda kalır."
    );
  }
  if (risks.length === 0) {
    risks.push(
      missing.length > 0
        ? "Eksik veri nedeniyle bu başlıkta risk cümlesi üretilmedi."
        : "Jeopolitik ve enflasyon riskleri her zaman gündemde"
    );
  }
  if (opportunities.length === 0) {
    opportunities.push(
      missing.length > 0
        ? "Eksik veri nedeniyle fırsat cümlesi üretilmedi."
        : "Uzun vadeli BES birikimi disiplinli dağılımla avantaj sağlar"
    );
  }

  const tlSentence =
    data.usdTry === null || data.usdTryChange === null
      ? "USD/TRY değişimi yok."
      : data.usdTryChange > 0
        ? "TL baskı altında."
        : "TL kuru önceki iş gününe göre gerilemedi.";
  const bistSentence =
    data.bist100 === null || data.bist100Change === null
      ? "BIST 100 verisi yok."
      : data.bist100Change >= 0
        ? "BIST 100 pozitif seyrediyor."
        : "BIST 100 negatif seyrediyor.";
  const vixSentence =
    typeof data.vix === "number"
      ? `Global piyasalar VIX ${data.vix.toFixed(1)} ile ${data.vix > 25 ? "gergin" : "sakin"}.`
      : "VIX verisi yok.";
  const missingSentence =
    missing.length > 0
      ? ` Eksik: ${missing.join(", ")}. Bağlı kurallar uygulanmadı.`
      : "";

  return {
    turkey,
    global,
    summary: `${tlSentence} ${bistSentence} ${vixSentence}${missingSentence}`,
    outlook,
    risks,
    opportunities,
    missing,
    fetchedAt: new Date().toISOString(),
  };
}

export const MACRO_TILT_PER_CATEGORY = 3;
export const MACRO_TILT_TOTAL = 8;

const TILT_KEYS = [
  "para_piyasasi",
  "borclanma",
  "altin",
  "hisse",
  "karma",
  "dis_piyasa",
  "emtia",
] as const;

export function capMacroTilt(raw: Record<string, number>): Record<string, number> {
  const tilt: Record<string, number> = {};
  for (const key of TILT_KEYS) {
    const value = Number.isFinite(raw[key]) ? Math.round(raw[key]) : 0;
    tilt[key] = Math.max(-MACRO_TILT_PER_CATEGORY, Math.min(MACRO_TILT_PER_CATEGORY, value));
  }

  const absSum = () => TILT_KEYS.reduce((sum, key) => sum + Math.abs(tilt[key]), 0);
  while (absSum() > MACRO_TILT_TOTAL) {
    const key = [...TILT_KEYS].sort(
      (a, b) => Math.abs(tilt[b]) - Math.abs(tilt[a]) || a.localeCompare(b, "tr")
    )[0];
    if (!key || tilt[key] === 0) break;
    tilt[key] += tilt[key] > 0 ? -1 : 1;
  }

  let net = TILT_KEYS.reduce((sum, key) => sum + tilt[key], 0);
  while (net !== 0) {
    const pool = TILT_KEYS.filter((key) => (net > 0 ? tilt[key] > 0 : tilt[key] < 0));
    const key = [...pool].sort(
      (a, b) => Math.abs(tilt[b]) - Math.abs(tilt[a]) || a.localeCompare(b, "tr")
    )[0];
    if (!key) break;
    tilt[key] += net > 0 ? -1 : 1;
    net += net > 0 ? -1 : 1;
  }

  return tilt;
}

export function getMacroAdjustments(macro: MacroAnalysis): Record<string, number> {
  const adj: Record<string, number> = {
    para_piyasasi: 0,
    borclanma: 0,
    altin: 0,
    hisse: 0,
    karma: 0,
    dis_piyasa: 0,
    emtia: 0,
  };

  const usdTry = macro.turkey.find((i) => i.name === "USD/TRY");
  const vix = macro.global.find((i) => i.name === "VIX (Korku Endeksi)");
  const bist = macro.turkey.find((i) => i.name === "BIST 100");
  const gold = macro.global.find((i) => i.name === "Altın (USD/ons)");

  if (typeof usdTry?.changePercent === "number" && usdTry.changePercent > 0.3) {
    adj.altin += 2;
    adj.hisse -= 2;
  }

  if (typeof vix?.value === "number" && vix.value > 25) {
    adj.para_piyasasi += 2;
    adj.borclanma += 1;
    adj.hisse -= 2;
    adj.dis_piyasa -= 1;
  } else if (typeof vix?.value === "number" && vix.value < 18) {
    adj.hisse += 2;
    adj.dis_piyasa += 1;
    adj.para_piyasasi -= 2;
    adj.borclanma -= 1;
  }

  if (typeof bist?.changePercent === "number" && bist.changePercent > 1) {
    adj.hisse += 2;
    adj.para_piyasasi -= 2;
  } else if (typeof bist?.changePercent === "number" && bist.changePercent < -1) {
    adj.hisse -= 2;
    adj.borclanma += 2;
  }

  if (typeof gold?.changePercent === "number" && gold.changePercent > 0.5) {
    adj.altin += 2;
    adj.para_piyasasi -= 2;
  }

  return capMacroTilt(adj);
}
