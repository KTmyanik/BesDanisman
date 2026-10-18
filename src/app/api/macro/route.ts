import { NextResponse } from "next/server";
import { fetchMarketData } from "@/lib/macro-data";
import { buildMacroAnalysis } from "@/lib/macro-analysis";

export async function GET() {
  try {
    const data = await fetchMarketData();
    const analysis = buildMacroAnalysis(data);
    return NextResponse.json({ success: true, data: analysis, raw: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
