import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KnowMe',
    short_name: 'KnowMe',
    description: 'Mieux se connaître grâce aux défis, aux jeux et aux interactions.',
    start_url: '/',
    display: 'standalone',
    background_color: '#071410',
    theme_color: '#45e6bd',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };
}
