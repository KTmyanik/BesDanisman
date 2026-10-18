#!/usr/bin/env python3
"""Fetch and score BES (EMK) funds from TEFAS, output top picks per category."""

import json
import sys
from datetime import datetime, timezone
from typing import Any

from tefasmak import fonlar_buyukluk, fonlar_donemsel_getiri, fonlar_yonetim_ucretleri

# Map TEFAS fonTurAciklama (+ name hints) to app categories
CATEGORY_TYPE_MAP: dict[str, list[str]] = {
    "para_piyasasi": [
        "Standart Fon",
        "OKS Standart Fon",
    ],
    "borclanma": [
        "Borçlanma Araçları Fonu",
        "Kamu Borçlanma Araçları Fonu",
        "Özel Sektör Borçlanma Araçları Fonu",
        "Dış Borçlanma Araçları Fonu",
        "Kamu Yabancı Para (Döviz) Cinsinden Borçlanma Araç",
    ],
    "altin": ["Altın Fonu", "Altın Katılım Fonu", "Kıymetli Madenler"],
    "hisse": ["Hisse Senedi Fonu", "Katılım Hisse Senedi Fonu", "Endeks Fon"],
    "karma": [
        "Karma Fon",
        "Değişken Fon",
        "Katılım Değişken Fon",
        "Fon Sepeti Fonu",
    ],
    "dis_piyasa": [],  # matched by name
    "emtia": ["Kıymetli Madenler"],
}

KATILIM_TYPES = {
    "Altın Katılım Fonu",
    "Katılım Değişken Fon",
    "Katılım Fonu",
    "Katılım Hisse Senedi Fonu",
    "Katılım Standart Fon",
    "OKS Katılım Standart Fon",
    "Kira Sertifikasi Katılım Fonu",
}

KATILIM_NAME_HINTS = ("KATILIM", "KATILIM", "SUKUK", "KIRA SERTIF")


def parse_fee(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).replace(",", ".").strip()
    try:
        return float(s)
    except ValueError:
        return None


def is_katilim(row: dict[str, Any]) -> bool:
    tur = row.get("fonTurAciklama") or ""
    unvan = (row.get("fonUnvan") or "").upper()
    if tur in KATILIM_TYPES:
        return True
    return any(h in unvan for h in KATILIM_NAME_HINTS)


def map_category(row: dict[str, Any]) -> str | None:
    tur = row.get("fonTurAciklama") or ""
    unvan = (row.get("fonUnvan") or "").upper()

    if "DIS PIYASA" in unvan or "YABANCI" in unvan or "GLOBAL" in unvan or "ULUSLARARASI" in unvan:
        return "dis_piyasa"
    if "PARA PIYASA" in unvan or "LIKIT" in unvan:
        return "para_piyasasi"

    for cat, types in CATEGORY_TYPE_MAP.items():
        if tur in types:
            if cat == "emtia" and "ALTIN" in unvan:
                return "altin"
            return cat
    return None


def score_fund(
    row: dict[str, Any],
    fee_row: dict[str, Any] | None,
    size_row: dict[str, Any] | None,
    risk_level: str,
) -> tuple[float, dict[str, Any]]:
    """Higher is better. Returns (score, breakdown)."""
    g1y = row.get("getiri1y")
    g6a = row.get("getiri6a")
    gyb = row.get("getiriyb")
    g3y = row.get("getiri3y")

    # Primary return metric by horizon
    if risk_level == "yuksek":
        ret = g1y if g1y is not None else g6a if g6a is not None else gyb
        ret_weight = 0.45
    elif risk_level == "dusuk":
        ret = g6a if g6a is not None else gyb if gyb is not None else g1y
        ret_weight = 0.35
    else:
        ret = g1y if g1y is not None else g6a if g6a is not None else gyb
        ret_weight = 0.4

    ret_score = (ret or 0) * ret_weight

    consistency = 0.0
    positives = [x for x in (g6a, gyb, g1y) if x is not None and x > 0]
    if len(positives) >= 2:
        consistency = 8
    elif len(positives) == 1:
        consistency = 4

    fee = None
    if fee_row:
        fee = parse_fee(fee_row.get("uygulananYu1Y")) or parse_fee(
            fee_row.get("fonTopGiderKesoran")
        )
    fee_score = max(0, 15 - (fee or 1.5) * 5)

    size = None
    if size_row:
        size = size_row.get("sonPortfoyDegeri") or size_row.get("ilkPortfoyDegeri")
    size_score = 0.0
    if size:
        # log scale: 100M -> ~5, 10B -> ~15, 100B -> ~20
        import math

        size_score = min(20, math.log10(max(size, 1)) * 2.5)

    tefas_bonus = 5 if row.get("tefasDurum") else 0

    risk_val = row.get("riskDegeri")
    risk_match = 0.0
    if risk_val is not None:
        try:
            rv = int(risk_val)
            if risk_level == "dusuk" and rv <= 3:
                risk_match = 5
            elif risk_level == "orta" and 3 <= rv <= 6:
                risk_match = 5
            elif risk_level == "yuksek" and rv >= 5:
                risk_match = 5
        except (TypeError, ValueError):
            pass

    total = ret_score + consistency + fee_score + size_score + tefas_bonus + risk_match
    breakdown = {
        "getiriPuani": round(ret_score, 2),
        "tutarlilikPuani": consistency,
        "ucretPuani": round(fee_score, 2),
        "buyuklukPuani": round(size_score, 2),
        "tefasPuani": tefas_bonus,
        "riskUyumPuani": risk_match,
        "getiri1y": g1y,
        "getiri6a": g6a,
        "getiriYb": gyb,
        "yillikUcret": fee,
        "portfoyBuyukluk": size,
    }
    return total, breakdown


def company_from_unvan(unvan: str) -> str:
    if not unvan:
        return ""
    # "GARANTI BBVA EMEKLİLİK ..." -> short company
    parts = unvan.split(" EM")
    return parts[0].title() if parts else unvan[:40]


def rank_funds(risk_level: str, katilim: bool, limit: int = 3) -> dict[str, Any]:
    returns = fonlar_donemsel_getiri("EMK")
    fees = {r["fonKodu"]: r for r in fonlar_yonetim_ucretleri("EMK")}
    sizes = {r["fonKodu"]: r for r in fonlar_buyukluk("EMK")}

    by_category: dict[str, list[dict[str, Any]]] = {}

    for row in returns:
        if not row.get("tefasDurum"):
            continue
        if is_katilim(row) != katilim:
            continue
        cat = map_category(row)
        if not cat:
            continue

        code = row["fonKodu"]
        total, breakdown = score_fund(row, fees.get(code), sizes.get(code), risk_level)
        entry = {
            "code": code,
            "name": row.get("fonUnvan", ""),
            "shortName": _short_name(row.get("fonUnvan", "")),
            "company": company_from_unvan(row.get("fonUnvan", "")),
            "category": cat,
            "fundType": row.get("fonTurAciklama"),
            "score": round(total, 2),
            "rank": 0,
            "scoreBreakdown": breakdown,
        }
        by_category.setdefault(cat, []).append(entry)

    result: dict[str, list[dict[str, Any]]] = {}
    for cat, items in by_category.items():
        items.sort(key=lambda x: x["score"], reverse=True)
        top = items[:limit]
        for i, item in enumerate(top, 1):
            item["rank"] = i
        result[cat] = top

    return {
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "TEFAS/BEFAS (tefasmak)",
        "riskLevel": risk_level,
        "katilim": katilim,
        "categories": result,
    }


def _short_name(unvan: str) -> str:
    if not unvan:
        return ""
    # Remove company prefix noise
    u = unvan
    for sep in [" A.Ş.", " A.S.", " EMeklilik", " EMEKLILIK"]:
        if sep in u:
            idx = u.find(sep)
            u = u[idx + len(sep) :].strip()
            break
    return u.title() if u else unvan[:60]


if __name__ == "__main__":
    risk = sys.argv[1] if len(sys.argv) > 1 else "orta"
    katilim = sys.argv[2].lower() == "true" if len(sys.argv) > 2 else False
    data = rank_funds(risk, katilim)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(data, ensure_ascii=False))
