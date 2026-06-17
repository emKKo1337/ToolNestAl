import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ToolNest AI | 100+ Free AI & Online Tools",
  description:
    "Boost your productivity with powerful AI tools, PDF utilities, image editors, developer tools, calculators and generators — all in one place.",
  keywords: [
    "AI tools",
    "PDF tools",
    "online tools",
    "image editor",
    "developer tools",
    "free tools",
  ],
  authors: [{ name: "ToolNest AI" }],
  openGraph: {
    title: "ToolNest AI | 100+ Free AI & Online Tools",
    description:
      "Boost your productivity with powerful AI tools, PDF utilities, image editors, developer tools, calculators and generators.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ToolNest AI | 100+ Free AI & Online Tools",
    description:
      "Boost your productivity with powerful AI tools, PDF utilities, image editors, developer tools, calculators and generators.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <head>
        {/* Material Symbols cannot be loaded via next/font — external link required */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="antialiased overflow-x-hidden min-h-screen relative flex flex-col">
        {children}
      </body>
    </html>
  );
}
