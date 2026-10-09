import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KnowMe',
    short_name: 'KnowMe',
    description: 'Mieux se connaître grâce aux défis, aux jeux et aux interactions.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090e1c',
    theme_color: '#92a9ff',
    orientation: 'portrait',
    icons: [
      { src: '/brand/knowme-logo.svg', sizes: 'any', type: 'image/svg+xml' }
    ]
  };
}
