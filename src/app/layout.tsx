import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://shortlist.autos"),
  title: "Shortlist Autos",
  description: "Score cars against must-haves you set in chat.",
  applicationName: "Shortlist Autos",
  openGraph: {
    title: "Shortlist Autos",
    description: "Tell chat what you need. Shortlist ranks sample Tampa-area cars in a photo gallery — switch to Split view for the map, then copy a link to share it.",
    url: "https://shortlist.autos",
    siteName: "Shortlist Autos",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Shortlist Autos",
    description: "Tell chat what you need. Shortlist ranks sample Tampa-area cars in a photo gallery — switch to Split view for the map, then copy a link to share it.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
