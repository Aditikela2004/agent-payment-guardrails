import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Payment Guardrails Simulator",
  description:
    "Concept project: see how spend limits, consent rules, and fraud checks decide whether an AI agent's purchases are approved, declined, or held for a person.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
