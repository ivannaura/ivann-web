import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/providers/SmoothScroll";
import Preloader from "@/components/ui/Preloader";
import MagneticButtons from "@/components/providers/MagneticButtons";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://ivannaura.com";

// Viewport — cover mode for iPhone notch, no zoom for immersive experience
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050508",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
    "Medellín",
    "Colombia",
    "concierto",
    "flamenco",
  ],
  authors: [{ name: "IVANN AURA" }],
  creator: "IVANN AURA",
  openGraph: {
    title: "IVANN AURA — Live Experience",
    description:
      "No es un concierto. Es un viaje. Piano, tecnología y espectáculo fusionados.",
    type: "website",
    locale: "es_CO",
    url: SITE_URL,
    siteName: "IVANN AURA",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "IVANN AURA — Live Experience",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IVANN AURA — Live Experience",
    description:
      "No es un concierto. Es un viaje. Piano, tecnología y espectáculo fusionados.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

// JSON-LD structured data — MusicGroup + Person (no MusicEvent without startDate)
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MusicGroup",
      name: "IVANN AURA",
      url: SITE_URL,
      image: `${SITE_URL}/og-image.jpg`,
      description:
        "Show inmersivo que fusiona piano clásico con tecnología, espectáculo visual, danza y arte aéreo.",
      genre: ["Classical", "Flamenco", "Immersive Experience"],
      member: {
        "@type": "Person",
        name: "IVANN AURA",
        alternateName: "Ivan Darío Arias",
        jobTitle: "Pianista y Compositor",
        birthPlace: {
          "@type": "Place",
          name: "Medellín, Colombia",
        },
      },
      sameAs: [
        "https://www.instagram.com/ivannaura",
        "https://open.spotify.com/artist/ivannaura",
        "https://www.youtube.com/@ivannaura",
        "https://www.tiktok.com/@ivannaura",
      ],
    },
    {
      "@type": "WebSite",
      name: "IVANN AURA",
      url: SITE_URL,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable} antialiased`}>
      <head>
        {/*
          Preload hints removed — <link rel="preload" as="video"> is unreliable
          across browsers and was blocking the <video> element from loading.
          The video's own preload="auto" handles progressive download.
        */}
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh">
        <Preloader />
        <MagneticButtons />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
