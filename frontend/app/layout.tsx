// layout.tsx
import type { Metadata } from "next";
import ClientProviders from "@/components/ClientProviders";
import Box from "@mui/material/Box";
import "./globals.css";

export const metadata: Metadata = {
  title: "LayoutXpert.AI",
  description: "A platform for automated GNN training and explanation for layout data.",
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
          <Box
            component="main"
            sx={{
              minHeight: '100vh',
              background: 'transparent',
              position: 'relative',
            }}
          >
            {children}
          </Box>
        </ClientProviders>
      </body>
    </html>
  );
}
