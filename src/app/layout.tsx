import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LakhirAd CMS — Smart Digital Advertising Network",
  description:
    "LakhirAd CMS — Enterprise platform for managing IoT-connected Digital Out-of-Home (DOOH) advertising networks. Auto-rickshaw screens, taxis, buses, shops, malls and outdoor digital signage.",
  keywords: [
    "LakhirAd",
    "DOOH",
    "Digital Signage",
    "Advertising Network",
    "IoT",
    "CMS",
  ],
  authors: [{ name: "LakhirAd" }],
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
