'use client';

import Link from 'next/link';
import { useSession } from '../../lib/use-session';

const organizationAreas = [
  {
    href: '/conversation-folders',
    title: 'Dossiers privés',
    description: 'Classe et déplace tes conversations dans tes dossiers personnels.'
  },
  {
    href: '/conversation-folder-search',
    title: 'Recherche dans les dossiers',
    description: 'Retrouve localement un dossier ou une conversation déjà accessible.'
  },
  {
    href: '/conversation-archives',
    title: 'Archives personnelles',
    description: 'Archive ou restaure une conversation sans quitter le groupe ni modifier les notifications.'
  },
  {
    href: '/conversation-pins',
    title: 'Conversations épinglées',
    description: 'Gère tes raccourcis privés et leur ordre autoritaire.'
  },
  {
    href: '/drafts',
    title: 'Brouillons synchronisés',
    description: 'Reprends tes brouillons personnels synchronisés entre tes appareils.'
  },
  {
    href: '/saved-messages',
    title: 'Messages enregistrés',
    description: 'Retrouve les messages que tu as enregistrés et auxquels tu as toujours accès.'
  }
] as const;

export default function ConversationOrganizationPage() {
  const { loading } = useSession({ required: true });

  if (loading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <small style={{ color: 'var(--mint)' }}>ORGANISATION PRIVÉE</small>
        <h1>Organiser mes conversations</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 720 }}>
          Ces outils n’ajoutent aucun droit d’accès et ne modifient pas les conversations des autres membres.
          Ils regroupent uniquement les surfaces personnelles déjà autorisées par KnowMe.
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
          gap: 14
        }}
      >
        {organizationAreas.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="card"
            style={{ padding: 20, color: 'inherit', textDecoration: 'none', display: 'grid', gap: 8 }}
          >
            <strong style={{ fontSize: 18 }}>{area.title}</strong>
            <span style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{area.description}</span>
            <span style={{ color: 'var(--mint)', fontWeight: 800 }}>Ouvrir →</span>
          </Link>
        ))}
      </section>

      <div style={{ marginTop: 20 }}>
        <Link href="/messages" className="btn">← Retour aux messages</Link>
      </div>
    </main>
  );
}
