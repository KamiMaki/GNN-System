import type { Metadata } from "next";
import ClientProviders from "@/components/ClientProviders";
import "./globals.css";

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
    <html lang="en">
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
