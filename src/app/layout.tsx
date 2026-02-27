import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Empresarial",
  description: "Sistema de Gestão Empresarial - Almoxarifado, SESMT, CCM, Turmas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
