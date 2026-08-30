import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { BRAND } from "@/lib/brand";
import "./globals.css";

/**
 * Tipografía.
 *
 * Fraunces en los titulares y Manrope en el resto. La mezcla serif + sans es
 * deliberada: el serif da la autoridad que pide un producto de temario y
 * normativa, y el sans se lee mejor en tablas, formularios y móvil, que es
 * donde se pasa el tiempo de verdad.
 *
 * `display: "swap"` para que el texto se vea desde el primer momento aunque la
 * fuente tarde: en móvil con mala cobertura, esperar a la fuente es esperar a
 * ver el temario.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "Plataforma de gestión, campus e inteligencia artificial para academias de oposiciones.",
  applicationName: BRAND.name,
  icons: {
    icon: [
      { url: "/icono.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

// Preparado para PWA (§46): pantalla completa en móvil y color de barra.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcfa" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1e2b" },
  ],
};

/**
 * El armazón de toda la aplicación.
 *
 * Las variables de las tipografías van en `<html>` y no en `<body>` a
 * propósito: los tokens del sistema de diseño se declaran en `:root`, y si las
 * variables colgaran de `<body>` esas declaraciones no encontrarían la fuente y
 * se invalidarían en silencio.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Las variables de las tipografías van en <html> y no en <body> a
    // propósito. Los tokens del design system (`--font-display`, `--font-sans`)
    // se declaran en `:root`, que ES <html>: si las variables de next/font
    // colgaran de <body>, al resolver `--font-display` en `:root` no existiría
    // `--font-fraunces` y la declaración entera se invalidaría en silencio. El
    // síntoma: los titulares salen con la fuente del sistema y nada falla.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} ${jetbrains.variable}`}
    >
      <body className="antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
