import type { Metadata, Viewport } from "next";
import CloudSyncProvider from "@/components/CloudSyncProvider";
import OnboardingGuide from "@/components/OnboardingGuide";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HYROX Training",
    template: "%s · HYROX Training",
  },
  description: "Tréninkový plán, časovač a deník pro HYROX.",
  applicationName: "HYROX Training",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HYROX Training",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full">
        <CloudSyncProvider>
          <OnboardingGuide />
          {children}
        </CloudSyncProvider>
      </body>
    </html>
  );
}
