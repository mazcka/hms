import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "בית",
  description: "ניהול משק הבית לזוג",
  applicationName: "בית",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "בית",
  },
  icons: { apple: "/icon-180.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563EB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
