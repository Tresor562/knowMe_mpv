import { access } from 'node:fs/promises';

const requiredFiles = [
  'apps/api/src/main.ts',
  'apps/api/prisma/schema.prisma',
  'apps/web/app/page.tsx',
  'apps/mobile/App.tsx',
  'docker-compose.yml',
  '.env.example'
];

for (const file of requiredFiles) {
  await access(file);
}

console.log('Structure KnowMe valide.');
