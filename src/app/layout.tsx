import type { Metadata } from "next";
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
        {/* Theme color for Android Chrome toolbar */}
        <meta name="theme-color" content="#050508" />
        {/* Video preload — must match crossOrigin="anonymous" on <video> element */}
        <link
          rel="preload"
          href="/videos/flamenco-graded.mp4"
          as="video"
          type="video/mp4"
          crossOrigin="anonymous"
        />
        {/* Audio preload hint */}
        <link
          rel="preload"
          href="/audio/flamenco.m4a"
          as="audio"
          type="audio/mp4"
          crossOrigin="anonymous"
        />
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen">
        <Preloader />
        <MagneticButtons />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
