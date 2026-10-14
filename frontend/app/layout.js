import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { UIProvider } from '@/lib/ui';
import Header from '@/components/Header';
import ErrorBanner from '@/components/ErrorBanner';
import HelpPanel from '@/components/HelpPanel';
import Footer from '@/components/Footer';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap' });

export const metadata = {
  title: 'ATS Scanner',
  description: 'Check how well your resume matches a job description, and get specific fixes before you apply.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#17263a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${publicSans.variable}`}>
      <body>
        <AuthProvider>
          <UIProvider>
            <Header />
            <ErrorBanner />
            {children}
            <Footer />
            <HelpPanel />
          </UIProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
