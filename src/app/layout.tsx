import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/providers/SmoothScroll";
import Preloader from "@/components/ui/Preloader";
import MagneticButtons from "@/components/providers/MagneticButtons";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  display: "swap",
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const SITE_URL = "https://ivannaura.vercel.app";

// Viewport — cover mode for iPhone notch
// Note: maximumScale/userScalable removed — WCAG 1.4.4 requires pinch-to-zoom
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
        type: "image/jpeg",
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
    <html lang="es" className={`${display.variable} ${body.variable} antialiased`}>
      <head>
        {/*
          Preload hints removed — <link rel="preload" as="video"> is unreliable
          across browsers and was blocking the <video> element from loading.
          The video's own preload="auto" handles progressive download.
        */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="color-scheme" content="dark" />
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh">
        {/* Skip link — WCAG 2.4.1 bypass blocks */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100001] focus:px-4 focus:py-2 focus:text-sm focus:tracking-widest focus:uppercase"
          style={{
            background: "var(--bg-void)",
            color: "var(--aura-gold)",
            border: "1px solid var(--aura-gold-dim)",
          }}
        >
          Saltar al contenido
        </a>
        <Preloader />
        <MagneticButtons />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
