import './globals.css';
import { BottomNavigation } from '../components/bottom-navigation';
import { ServiceWorkerRegistration } from '../components/service-worker-registration';

export const metadata = {
  title: 'KnowMe',
  description: 'Mieux se connaître, vraiment.',
  applicationName: 'KnowMe',
  appleWebApp: {
    capable: true,
    title: 'KnowMe',
    statusBarStyle: 'black-translucent'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <ServiceWorkerRegistration />
        {children}
        <BottomNavigation />
      </body>
    </html>
  );
}
