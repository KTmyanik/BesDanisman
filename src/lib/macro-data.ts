import { XMLParser } from "fast-xml-parser";
import type { MarketSnapshot } from "./types";

const TODAY_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
const PREVIOUS_WEEKDAY_LIMIT = 10;

const parser = new XMLParser({ ignoreAttributes: false });

export interface TcmbBulletin {
  asOf: string | null;
  usdTry: number | null;
  eurTry: number | null;
}

type FetchLike = (
  input: string,
  init?: RequestInit & { next?: { revalidate?: number } }
) => Promise<Response>;

export function parseBulletinDate(dateAttr: unknown, tarihAttr: unknown): string | null {
  if (typeof dateAttr === "string") {
    const match = dateAttr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const iso = toIsoDate(Number(match[3]), Number(match[1]), Number(match[2]));
      if (iso) return iso;
    }
  }
  if (typeof tarihAttr === "string") {
    const match = tarihAttr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
    }
  }
  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function previousWeekdays(asOf: string, limit: number): string[] {
  const match = asOf.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || limit <= 0) return [];
  const cursor = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const days: string[] = [];
  while (days.length < limit) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const dow = cursor.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    days.push(toIsoDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate())!);
  }
  return days;
}

export function tcmbArchiveUrl(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `https://www.tcmb.gov.tr/kurlar/${year}${month}/${day}${month}${year}.xml`;
}

export function fxChangePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !(previous > 0)) return null;
  return ((current - previous) / previous) * 100;
}

function readPositive(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function readRate(node: Record<string, unknown>): number | null {
  const unit = readPositive(node.Unit) ?? 1;
  const selling = readPositive(node.ForexSelling) ?? readPositive(node.BanknoteSelling);
  if (selling === null) return null;
  return selling / unit;
}

export function parseTcmbBulletin(xml: string): TcmbBulletin | null {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return null;
  }
  const root = (parsed as { Tarih_Date?: Record<string, unknown> } | null)?.Tarih_Date;
  if (!root) return null;

  const currencies = root.Currency;
  const list = Array.isArray(currencies) ? currencies : currencies ? [currencies] : [];
  let usdTry: number | null = null;
  let eurTry: number | null = null;

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const node = entry as Record<string, unknown>;
    const code = node["@_CurrencyCode"];
    const rate = readRate(node);
    if (code === "USD") usdTry = rate;
    if (code === "EUR") eurTry = rate;
  }

  return {
    asOf: parseBulletinDate(root["@_Date"], root["@_Tarih"]),
    usdTry,
    eurTry,
  };
}

async function readBulletin(url: string, fetchImpl: FetchLike): Promise<TcmbBulletin | null> {
  try {
    const res = await fetchImpl(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return parseTcmbBulletin(await res.text());
  } catch {
    return null;
  }
}

export async function fetchTcmbRates(fetchImpl: FetchLike = fetch): Promise<{
  usdTry: number | null;
  eurTry: number | null;
  usdTryChange: number | null;
  eurTryChange: number | null;
  asOf: string | null;
}> {
  const today = await readBulletin(TODAY_URL, fetchImpl);
  if (!today) {
    return {
      usdTry: null,
      eurTry: null,
      usdTryChange: null,
      eurTryChange: null,
      asOf: null,
    };
  }

  let previous: TcmbBulletin | null = null;
  if (today.asOf) {
    for (const day of previousWeekdays(today.asOf, PREVIOUS_WEEKDAY_LIMIT)) {
      const bulletin = await readBulletin(tcmbArchiveUrl(day), fetchImpl);
      if (bulletin && (bulletin.usdTry !== null || bulletin.eurTry !== null)) {
        previous = bulletin;
        break;
      }
    }
  }

  return {
    usdTry: today.usdTry,
    eurTry: today.eurTry,
    usdTryChange: fxChangePercent(today.usdTry, previous?.usdTry ?? null),
    eurTryChange: fxChangePercent(today.eurTry, previous?.eurTry ?? null),
    asOf: today.asOf,
  };
}

export function parseYahooChart(json: unknown): {
  price: number;
  changePercent: number | null;
  asOf: string | null;
} | null {
  if (!json || typeof json !== "object") return null;
  const meta = (json as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } }).chart
    ?.result?.[0]?.meta;
  if (!meta) return null;
  const price = readPositive(meta.regularMarketPrice);
  if (price === null) return null;
  const previousClose = readPositive(meta.chartPreviousClose) ?? readPositive(meta.previousClose);
  const time = meta.regularMarketTime;
  return {
    price,
    changePercent: fxChangePercent(price, previousClose),
    asOf: typeof time === "number" ? new Date(time * 1000).toISOString() : null,
  };
}

export async function fetchYahooQuote(
  symbol: string,
  fetchImpl: FetchLike = fetch
): Promise<{ price: number; changePercent: number | null; asOf: string | null } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetchImpl(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    return parseYahooChart(await res.json());
  } catch {
    return null;
  }
}

export async function fetchMarketData(fetchImpl: FetchLike = fetch): Promise<MarketSnapshot> {
  const [tcmb, bist, sp500, gold, vix] = await Promise.all([
    fetchTcmbRates(fetchImpl),
    fetchYahooQuote("XU100.IS", fetchImpl),
    fetchYahooQuote("^GSPC", fetchImpl),
    fetchYahooQuote("GC=F", fetchImpl),
    fetchYahooQuote("^VIX", fetchImpl),
  ]);

  return {
    usdTry: tcmb.usdTry,
    usdTryChange: tcmb.usdTryChange,
    usdTryAsOf: tcmb.asOf,
    eurTry: tcmb.eurTry,
    eurTryChange: tcmb.eurTryChange,
    eurTryAsOf: tcmb.asOf,
    bist100: bist?.price ?? null,
    bist100Change: bist?.changePercent ?? null,
    bist100AsOf: bist?.asOf ?? null,
    sp500: sp500?.price ?? null,
    sp500Change: sp500?.changePercent ?? null,
    sp500AsOf: sp500?.asOf ?? null,
    goldUsd: gold?.price ?? null,
    goldChange: gold?.changePercent ?? null,
    goldAsOf: gold?.asOf ?? null,
    vix: vix?.price ?? null,
    vixChange: vix?.changePercent ?? null,
    vixAsOf: vix?.asOf ?? null,
  };
}
