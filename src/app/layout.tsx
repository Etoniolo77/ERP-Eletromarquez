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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" />
      </head>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
