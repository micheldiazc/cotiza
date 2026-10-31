import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AvisoDemo } from "@/components/aviso-demo";
import { PiePagina } from "@/components/pie-pagina";
import { Toaster } from "@/components/ui/sonner";
import { MODO_DEMO } from "@/lib/modo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cotiza",
  description: "Gestor de presupuestos para pequeños negocios",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {MODO_DEMO && <AvisoDemo />}
        {children}
        <PiePagina />
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
