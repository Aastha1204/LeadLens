import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/shell/Providers";
import { TopBar } from "@/components/shell/TopBar";
import { Footer } from "@/components/shell/Footer";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "LeadLens · Know exactly what your marketing money did",
  description:
    "A one-page monthly lead report on WhatsApp: enquiries, sources, reply speed and conversions, with a live dashboard behind it. Built by Neovia AI.",
  openGraph: {
    title: "LeadLens by Neovia AI",
    description: "Know exactly what your marketing money did last month.",
    type: "website",
    images: ["/og.svg"],
  },
  twitter: { card: "summary_large_image", images: ["/og.svg"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <Suspense fallback={<div className="h-14 border-b border-border" />}>
            <TopBar />
          </Suspense>
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
