export default function PrivacyPage() {
  return (
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <article className="card" style={{padding:28}}>
        <small style={{color:'var(--mint)'}}>DOCUMENT DE TRAVAIL</small>
        <h1>Confidentialité KnowMe</h1>

        <p>
          Cette page constitue un brouillon technique et ne remplace pas
          une politique de confidentialité validée juridiquement.
        </p>

        <h2>Données utilisées</h2>
        <p style={{color:'var(--muted)'}}>
          Compte, profil, centres d’intérêt, défis, messages,
          publications, relations sociales, médias, sessions et
          informations techniques nécessaires à la sécurité.
        </p>

        <h2>Contrôle utilisateur</h2>
        <p style={{color:'var(--muted)'}}>
          L’utilisateur peut modifier son profil, exporter ses données,
          gérer ses sessions et supprimer son compte.
        </p>

        <h2>À compléter avant lancement</h2>
        <p style={{color:'var(--muted)'}}>
          Finalités détaillées, bases légales, durées de conservation,
          sous-traitants, transferts internationaux, droits locaux,
          contact du responsable et procédure de réclamation.
        </p>
      </article>
    </main>
  );
}
