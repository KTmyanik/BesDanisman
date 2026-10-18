#!/usr/bin/env python3
"""Write a dated BEFAS/EMK fund snapshot. Does not classify or rank."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tefasmak import fonlar_buyukluk, fonlar_donemsel_getiri, fonlar_yonetim_ucretleri


def num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        if value != value:
            return None
        return float(value)
    try:
        return float(str(value).replace(",", ".").strip())
    except ValueError:
        return None


def company_name(unvan: str) -> str:
    for marker in (" A.Ş.", " A.S.", " A.Ş ", " A.S "):
        idx = unvan.find(marker)
        if idx > 0:
            return unvan[: idx + len(marker.rstrip())].strip()
    return unvan[:80].strip()


def build_snapshot() -> dict[str, Any]:
    returns = fonlar_donemsel_getiri("EMK")
    fees = {row["fonKodu"]: row for row in fonlar_yonetim_ucretleri("EMK")}
    sizes = {row["fonKodu"]: row for row in fonlar_buyukluk("EMK")}
    funds: list[dict[str, Any]] = []

    for row in returns:
        code = str(row.get("fonKodu") or "").strip().upper()
        name = str(row.get("fonUnvan") or "").strip()
        if not code or not name:
            continue
        fee = fees.get(code) or fees.get(row.get("fonKodu"))
        size = sizes.get(code) or sizes.get(row.get("fonKodu"))
        company_code = ""
        if fee:
            company_code = str(fee.get("kurucuKod") or "").strip().upper()
        if not company_code and size:
            company_code = str(size.get("kurucuKodu") or "").strip().upper()
        company = company_name(name)
        if not company_code:
            company_code = "".join(ch for ch in company.upper() if ch.isalnum())[:12]
        if not company or not company_code:
            continue
        annual_fee = None
        if fee:
            annual_fee = num(fee.get("uygulananYu1Y"))
            if annual_fee is None:
                annual_fee = num(fee.get("fonTopGiderKesoran"))
        portfolio_size = None
        if size:
            portfolio_size = num(size.get("sonPortfoyDegeri"))
            if portfolio_size is None:
                portfolio_size = num(size.get("ilkPortfoyDegeri"))
        risk = num(row.get("riskDegeri"))
        funds.append(
            {
                "code": code,
                "name": name,
                "fundType": row.get("fonTurAciklama") or "",
                "companyCode": company_code,
                "company": company,
                "tefasDurum": bool(row.get("tefasDurum")),
                "riskDegeri": int(risk) if risk is not None else None,
                "getiri1y": num(row.get("getiri1y")),
                "getiri6a": num(row.get("getiri6a")),
                "getiriYb": num(row.get("getiriyb")),
                "getiri3y": num(row.get("getiri3y")),
                "yillikUcret": annual_fee,
                "portfoyBuyukluk": portfolio_size,
            }
        )

    return {
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "TEFAS/BEFAS (tefasmak)",
        "funds": funds,
    }


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "data" / "funds-snapshot.json"
    snapshot = build_snapshot()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"{len(snapshot['funds'])} fon yazildi: {target}")


if __name__ == "__main__":
    main()
