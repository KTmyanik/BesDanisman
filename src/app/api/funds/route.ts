import { NextResponse } from "next/server";
import { classifySnapshot, loadFundSnapshot, snapshotProblem } from "@/lib/fund-snapshot";

export async function GET() {
  const snapshot = loadFundSnapshot();
  const problem = snapshotProblem(snapshot);
  if (problem || !snapshot) {
    return NextResponse.json({ success: false, error: problem }, { status: 503 });
  }

  const funds = classifySnapshot(snapshot).map((fund) => ({
    code: fund.code,
    name: fund.name,
    shortName: fund.shortName,
    fundType: fund.fundType,
    companyCode: fund.companyCode,
    company: fund.company,
    category: fund.category,
    katilim: fund.katilim,
  }));

  return NextResponse.json({
    success: true,
    fetchedAt: snapshot.fetchedAt,
    source: snapshot.source,
    funds,
  });
}
