import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BES Danışman — Plan senaryosu",
  description:
    "Girdiğiniz bilgilere ve tarihli piyasa verisine göre BES plan senaryosu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
