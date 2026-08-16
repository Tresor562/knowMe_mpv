import { parseKnowMeUniversalPath } from '@knowme/link-contract';
import { notFound, redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    version: string;
    kind: string;
    id: string;
  }>;
};

const destinationFor = (kind: string, id: string): string | null => {
  switch (kind) {
    case 'profile':
      return `/profile/${encodeURIComponent(id)}`;
    case 'challenge':
      return `/challenges/${encodeURIComponent(id)}`;
    default:
      return null;
  }
};

export default async function KnowMeOpenPage({ params }: PageProps) {
  const { version, kind, id } = await params;
  const parsed = parseKnowMeUniversalPath(`/open/${version}/${kind}/${id}`);
  if (!parsed) notFound();

  const destination = destinationFor(parsed.kind, parsed.id);
  if (destination) redirect(destination);

  return (
    <main className="shell stack">
      <section className="card stack">
        <p className="eyebrow">Lien KnowMe</p>
        <h1>Ce contenu sera bientôt ouvrable sur le Web.</h1>
        <p>
          Le lien est valide, mais cette catégorie n’a pas encore de destination Web
          publique. KnowMe ne redirige pas vers une route approximative ou non vérifiée.
        </p>
        <a className="button" href="/discover">
          Continuer vers Découvrir
        </a>
      </section>
    </main>
  );
}
