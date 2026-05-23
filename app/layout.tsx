import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Themis Lex — AI Readiness for California Court Staff',
  description:
    'A plain-language readiness check for California Superior Court staff. Know where AI helps. Know where it must not.',
  metadataBase: new URL('https://themislex.org'),
  openGraph: {
    title: 'Themis Lex — AI Readiness for California Court Staff',
    description:
      'Know where AI helps. Know where it must not. A plain-language readiness check built for California Superior Court staff.',
    url: 'https://themislex.org',
    siteName: 'Themis Lex',
    images: [
      {
        url: '/themis-lex-hero.png',
        width: 1024,
        height: 1024,
        alt: 'Themis Lex — scales of justice with circuit board motif',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Themis Lex — AI Readiness for California Court Staff',
    description:
      'Know where AI helps. Know where it must not. Built for California Superior Court staff.',
    images: ['/themis-lex-hero.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
