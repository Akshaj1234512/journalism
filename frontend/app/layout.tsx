import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
  ),
  title: {
    default: "The Red Room — Pre-publication review by AI editors",
    template: "%s · The Red Room",
  },
  description:
    "An independent team of AI editors that reads your draft before you publish and flags the things real newsrooms catch: legal risk, misleading statistics, source-protection failures, unclear writing, unfair framing, and the deep questions you missed.",
  applicationName: "The Red Room",
  keywords: [
    "AI for journalism",
    "pre-publication review",
    "fact-checking",
    "newsroom AI",
    "editorial review",
    "media-libel review",
  ],
  authors: [{ name: "The Red Room" }],
  openGraph: {
    title: "The Red Room",
    description:
      "An independent team of AI editors, reviewing your draft before you publish.",
    type: "website",
    siteName: "The Red Room",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Red Room",
    description:
      "An independent team of AI editors, reviewing your draft before you publish.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#DC2626",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" suppressHydrationWarning>{children}</body>
    </html>
  );
}
