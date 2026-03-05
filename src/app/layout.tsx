import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { DonateButton } from "@/components/donate-button";
import { MobileWarning } from "@/components/mobile-warning";
import { I18nProvider } from "@/i18n";
import { LanguageSelector } from "@/components/language-selector";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = "https://pdf-editor-online.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "PDF Editor Online Gratis | Dividir, Unir y Anotar PDFs Sin Registro",
    template: "%s | PDF Editor Online",
  },
  description:
    "Edita tus PDFs directamente en el navegador: divide, une y anota sin subir archivos a ningún servidor. 100% gratuito, sin registro y completamente privado. Tus documentos nunca salen de tu dispositivo.",
  keywords: [
    "PDF editor online gratis",
    "dividir PDF",
    "unir PDF",
    "anotar PDF",
    "split PDF online",
    "merge PDF online",
    "PDF sin registro",
    "PDF sin subir archivos",
    "editor PDF privado",
    "PDF en el navegador",
    "herramienta PDF gratuita",
    "PDF local",
  ],
  authors: [{ name: "NomisDev" }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "PDF Editor Online",
    title: "PDF Editor Online Gratis — Sin Registro ni Subidas",
    description:
      "Divide, une y anota PDFs directamente en tu navegador. Sin servidores, sin cuenta, completamente gratis y privado.",
    locale: "es_ES",
    alternateLocale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "PDF Editor Online Gratis — Sin Registro ni Subidas",
    description:
      "Divide, une y anota PDFs en tu navegador. Sin subir archivos, sin cuenta, 100% gratis.",
  },
  alternates: {
    canonical: APP_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* Blocking script: sets .dark before first paint to avoid flash-of-white */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||((window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "PDF Editor Online",
              url: APP_URL,
              description:
                "Herramienta gratuita para dividir, unir y anotar PDFs directamente en el navegador. Sin subir archivos, sin registro, sin servidores.",
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Web",
              inLanguage: ["es", "en"],
              isAccessibleForFree: true,
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
              },
              featureList: [
                "Dividir PDF en múltiples archivos",
                "Unir varios PDFs en uno",
                "Anotar PDFs con texto, dibujos y formas",
                "Procesamiento 100% local en el navegador",
                "Sin subida de archivos a servidores",
                "Sin registro ni cuenta de usuario",
                "Completamente gratuito",
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <I18nProvider>
            <MobileWarning />
            {children}
            <DonateButton />
            <LanguageSelector />
            <ThemeToggle />
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
