import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Booth Forge · The Agency Oman',
  description: 'Exhibition booth SketchUp Ruby script generator. Brief → 3D model in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
