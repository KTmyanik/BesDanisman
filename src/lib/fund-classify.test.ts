import { describe, expect, it } from "vitest";
import { classifyFund, companyNameFromTitle, isKatilimFund } from "./fund-classify";

describe("fund classification", () => {
  it("keeps standard and OKS standard funds out of money market", () => {
    expect(classifyFund("Standart Fon", "ÖRNEK EMEKLİLİK A.Ş. STANDART EMEKLİLİK YATIRIM FONU")).toBe(
      "standart"
    );
    expect(
      classifyFund("OKS Standart Fon", "ÖRNEK EMEKLİLİK A.Ş. OKS STANDART EMEKLİLİK YATIRIM FONU")
    ).toBe("oks_standart");
    expect(
      classifyFund("Standart Fon", "ÖRNEK EMEKLİLİK A.Ş. PARA PİYASASI STANDART FONU")
    ).not.toBe("para_piyasasi");
  });

  it("recognizes a money market fund by its name when the type is not a protected class", () => {
    expect(
      classifyFund("Değişken Fon", "ÖRNEK EMEKLİLİK A.Ş. PARA PİYASASI EMEKLİLİK YATIRIM FONU")
    ).toBe("para_piyasasi");
  });

  it("classifies participation gold separately from precious metals", () => {
    expect(classifyFund("Altın Katılım Fonu", "ÖRNEK KATILIM EMEKLİLİK A.Ş. ALTIN KATILIM FONU")).toBe(
      "altin"
    );
    expect(isKatilimFund("Altın Katılım Fonu", "ALTIN KATILIM")).toBe(true);
    expect(classifyFund("Kıymetli Madenler", "ÖRNEK EMEKLİLİK A.Ş. KIYMETLİ MADENLER FONU")).toBe(
      "kiymetli_maden"
    );
  });

  it("keeps FX public debt out of foreign equity", () => {
    expect(
      classifyFund(
        "Kamu Yabancı Para (Döviz) Cinsinden Borçlanma Araç",
        "ÖRNEK EMEKLİLİK A.Ş. KAMU YABANCI PARA BORÇLANMA ARAÇLARI FONU"
      )
    ).toBe("doviz_borclanma");
    expect(
      classifyFund(
        "Dış Borçlanma Araçları Fonu",
        "ÖRNEK EMEKLİLİK A.Ş. YABANCI BORÇLANMA ARAÇLARI FONU"
      )
    ).toBe("dis_borclanma");
  });

  it("treats foreign equity or mixed funds as dış piyasa", () => {
    expect(
      classifyFund(
        "Hisse Senedi Fonu",
        "ÖRNEK EMEKLİLİK A.Ş. DIŞ PİYASA HİSSE SENEDİ EMEKLİLİK YATIRIM FONU"
      )
    ).toBe("dis_piyasa");
    expect(
      classifyFund(
        "Değişken Fon",
        "ÖRNEK EMEKLİLİK A.Ş. TEKNOLOJİ SEKTÖRÜ YABANCI DEĞİŞKEN EMEKLİLİK YATIRIM FONU"
      )
    ).toBe("dis_piyasa");
  });

  it("keeps the company title through A.Ş when the next word has no period", () => {
    expect(
      companyNameFromTitle(
        "ANADOLU HAYAT EMEKLİLİK A.Ş TEMETTÜ ÖDEYEN ŞİRKETLER HİSSE SENEDİ EMEKLİLİK YATIRIM FONU"
      )
    ).toBe("ANADOLU HAYAT EMEKLİLİK A.Ş");
    expect(
      companyNameFromTitle("AGESA HAYAT VE EMEKLİLİK A.Ş. BORÇLANMA ARAÇLARI EMEKLİLİK YATIRIM FONU")
    ).toBe("AGESA HAYAT VE EMEKLİLİK A.Ş.");
  });

  it("leaves an unmatched type unknown", () => {
    expect(classifyFund("Yaşam Döngüsü/Hedef Fon", "ÖRNEK EMEKLİLİK A.Ş. YAŞAM DÖNGÜSÜ FONU")).toBe(
      null
    );
  });
});
