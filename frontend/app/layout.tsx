import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Synthetic Red Room",
  description: "AI agents critique your draft before publication.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" suppressHydrationWarning>{children}</body>
    </html>
  );
}
