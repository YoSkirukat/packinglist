import type { Metadata } from "next";
import { Golos_Text } from "next/font/google";
import { NavigationProgress } from "@/components/NavigationProgress";
import "./globals.css";

const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Packing List — поставки из Китая",
  description: "Учёт поставок, packing list и движений товара с удалённого склада партнёра",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${golos.variable} antialiased`}>
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
