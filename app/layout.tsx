import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'KSFH Meeting',
    template: '%s · KSFH Meeting',
  },
  description: 'ប្រព័ន្ធស្នើសុំ និងគ្រប់គ្រងបន្ទប់ប្រជុំ',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#087a55',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="km" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
