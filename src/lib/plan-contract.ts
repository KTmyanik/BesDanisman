export interface ContractClause {
  id: string;
  text: string;
}

/** Short clauses shown on every plan. The report must render this list. */
export const PLAN_CONTRACT: readonly ContractClause[] = [
  {
    id: "scenario",
    text: "Bu çıktı getiri vaadi değildir. Girdiğiniz bilgilere ve veri tarihine göre kurulmuş bir senaryodur.",
  },
  {
    id: "citation",
    text: "Her yüzde, her fon kodu ve her katkı hesabı bir kaynak ve bir veri tarihi taşır. Tarihi olmayan sayı raporda yer almaz.",
  },
  {
    id: "parameters",
    text: "Devlet katkısı oranı, yıllık tavan ve hak ediş, yasal parametre kaydındaki yürürlük tarihine göre hesaplanır.",
  },
  {
    id: "menu",
    text: "Fon kodu, seçilen emeklilik şirketinin listesinde değilse hedefe yazılmaz.",
  },
  {
    id: "verify",
    text: "Karar öncesi emeklilik şirketindeki güncel fon listesi ve ücret tablosu doğrulanır.",
  },
];

export interface CitedFigure {
  label: string;
  source: string;
  asOf: string;
}

export function citeFigure(label: string, source: string, asOf: string): CitedFigure {
  if (!label.trim() || !source.trim() || !asOf.trim()) {
    throw new Error("Yüzde, fon kodu ve katkı hesabı kaynak ve veri tarihi taşır");
  }
  if (Number.isNaN(Date.parse(asOf))) {
    throw new Error("Veri tarihi okunamadı");
  }
  return { label: label.trim(), source: source.trim(), asOf };
}

export function formatDataDate(asOf: string): string {
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Veri tarihi okunamadı");
  }
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

export function scenarioStatement(asOf: string): string {
  return `Bu senaryo, girdiğiniz bilgilere ve ${formatDataDate(asOf)} tarihli veriye göre üretildi.`;
}

export function figureLine(figure: CitedFigure): string {
  return `${figure.label}. Kaynak: ${figure.source}. Veri tarihi: ${formatDataDate(figure.asOf)}.`;
}

export function allocationFigure(asOf: string): CitedFigure {
  return citeFigure(
    "Kategori dağılım yüzdeleri",
    "Girdiğiniz risk cevapları ve plan kuralları",
    asOf
  );
}
