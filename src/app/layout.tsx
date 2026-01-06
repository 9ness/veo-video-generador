import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Veo Generator",
  description: "Create cinematic videos with AI",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0", // Prevent zoom on mobile inputs
  themeColor: "#030303",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#030303] text-white selection:bg-violet-500/30 selection:text-violet-200 antialiased`}>
        {/* Subtle background gradient ambient light */}
        <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-violet-900/20 to-transparent pointer-events-none z-0" />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
