import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/providers/SmoothScroll";
import Preloader from "@/components/ui/Preloader";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IVANN AURA — Live Experience",
  description:
    "No es un concierto. Es un viaje. IVANN AURA fusiona piano, tecnología y espectáculo en una experiencia inmersiva.",
  keywords: [
    "IVANN AURA",
    "piano",
    "live experience",
    "show inmersivo",
    "música",
    "espectáculo",
  ],
  openGraph: {
    title: "IVANN AURA — Live Experience",
    description:
      "No es un concierto. Es un viaje. Piano, tecnología y espectáculo fusionados.",
    type: "website",
    locale: "es_CO",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen grain">
        <Preloader />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
