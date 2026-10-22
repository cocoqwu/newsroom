import type { Metadata } from "next";
import { Tenor_Sans, Source_Serif_4, Libre_Franklin, Montserrat } from "next/font/google";
import "./globals.css";

// Blog fonts (all free Google Fonts). The workspace uses the system font stack from globals.css.
const tenor = Tenor_Sans({ weight: "400", subsets: ["latin"], variable: "--font-tenor-sans", display: "swap" });
const sourceSerif = Source_Serif_4({ weight: ["400", "600"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-source-serif", display: "swap" });
const franklin = Libre_Franklin({ weight: ["500", "600"], subsets: ["latin"], variable: "--font-libre-franklin", display: "swap" });
const montserrat = Montserrat({ weight: ["600"], subsets: ["latin"], variable: "--font-montserrat-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Newsroom",
  description: "Prototype: frontier AI news into publish-ready research posts. Prototype by Coco Wu.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark h-full ${tenor.variable} ${sourceSerif.variable} ${franklin.variable} ${montserrat.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
