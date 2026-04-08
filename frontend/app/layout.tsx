import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import ClientProviders from "@/components/ClientProviders";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-sans-tc",
});

export const metadata: Metadata = {
  title: "GraphX.AI",
  description: "A platform for automated GNN training and graph intelligence.",
  icons: { icon: '/graphx-icon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className={notoSansTC.variable}>
      <body>
        <ClientProviders>
          <main style={{ minHeight: '100vh' }}>
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}
