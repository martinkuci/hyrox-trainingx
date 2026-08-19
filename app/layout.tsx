import type { Metadata, Viewport } from "next";
import CloudSyncProvider from "@/components/CloudSyncProvider";
import OnboardingGuide from "@/components/OnboardingGuide";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Enginn",
    template: "%s · Enginn",
  },
  description: "Tréninkový plán, časovač a deník pro tvůj hybridní trénink.",
  applicationName: "Enginn",
  icons: {
    icon: [
      { url: "/brand/enginn-app-icon.svg", type: "image/svg+xml" },
      { url: "/brand/enginn-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/enginn-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Enginn",
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
