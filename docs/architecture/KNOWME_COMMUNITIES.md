# KMD-038 — Groupes, chaînes et communautés KnowMe

## Séparation des usages

KnowMe possède deux structures communautaires distinctes :

- **Groupe** : espace interactif où les membres discutent et participent ;
- **Chaîne** : espace de diffusion où les administrateurs publient pour des abonnés.

Une communauté peut relier plusieurs groupes et chaînes dans une même identité publique, mais chaque espace garde ses propres permissions, membres, publications et règles.

## Groupes KnowMe

### Types

#### Groupe privé

Conçu pour :

- amis ;
- familles ;
- camarades ;
- équipes ;
- petites communautés.

Fonctions :

- invitation ;
- approbation facultative ;
- contenu privé ;
- visibilité restreinte ;
- interdiction d’indexation publique.

#### Groupe public

Conçu pour :

- fans ;
- anime ;
- gaming ;
- technologie ;
- créateurs ;
- communautés publiques.

Fonctions :

- découverte ;
- page publique ;
- lien mémorisable ;
- classement et recommandations ;
- adhésion directe ou sur approbation.

## Liens de groupes

Formats :

- `knowme.app/group/:slug` ;
- `km.me/g/:token`.

Modes :

### Permanent

- reste actif ;
- peut être révoqué et remplacé ;
- aucune limite ou expiration implicite.

### Temporaire

Le propriétaire choisit :

- date d’expiration ;
- nombre maximal d’utilisations ;
- ou les deux.

Un lien temporaire ne dépasse pas 30 jours dans la première version.

### Avec approbation

- le clic crée une demande ;
- les admins autorisés examinent la demande ;
- une limitation anti-spam s’applique ;
- la demande peut inclure une question d’entrée.

## Chaînes KnowMe

Une chaîne sert à publier du contenu vers une audience.

Formats :

- `knowme.app/channel/:slug` ;
- `km.me/c/:token`.

Par défaut :

- seuls les propriétaires, administrateurs et rôles autorisés publient ;
- les abonnés consultent, réagissent, partagent et votent ;
- les commentaires sont facultatifs ;
- chaque publication peut ouvrir un fil de discussion séparé.

Types de contenu :

- texte ;
- image ;
- vidéo ;
- audio ;
- fichier ;
- sondage ;
- jeu ;
- cadeau ;
- lien ;
- publication programmée ;
- direct et événement dans les niveaux avancés.

## Rôles

Rôles de base :

- propriétaire ;
- administrateur ;
- modérateur ;
- membre ;
- abonné.

Le propriétaire peut créer des rôles personnalisés en combinant des permissions, sans dépasser ses propres droits.

Permissions :

- voir ;
- écrire dans le chat ;
- publier ;
- commenter ;
- publier des Stories ;
- créer sondages et quiz ;
- lancer jeux et défis ;
- envoyer des cadeaux ;
- créer et gérer des événements ;
- épingler ;
- supprimer du contenu ;
- gérer et approuver les membres ;
- bannir ;
- gérer les rôles ;
- gérer les bots ;
- gérer l’apparence ;
- gérer les liens ;
- consulter les statistiques ;
- gérer la monétisation ;
- transférer la propriété.

Le transfert de propriété reste réservé au propriétaire et exige une confirmation renforcée.

## Stories de groupes et chaînes

Les groupes et chaînes possèdent leur propre espace Stories.

Contenus :

- photos ;
- vidéos ;
- textes ;
- sondages ;
- quiz ;
- défis ;
- cadeaux ;
- moments du groupe ;
- annonces ;
- coulisses ;
- promotions ;
- événements.

### Durées gratuites

Valeurs disponibles :

- 1 heure ;
- 6 heures ;
- 12 heures ;
- 24 heures ;
- 48 heures ;
- 72 heures.

La durée maximale dépend du niveau :

- niveau 1 : 24 heures ;
- niveau 2 : 48 heures ;
- niveau 3 à 5 : 72 heures.

### Durées Premium

- 7 jours ;
- 14 jours ;
- 30 jours ;
- permanente à partir du niveau 4.

Premium permet aussi :

- programmation ;
- mise en avant ;
- audience restreinte ;
- thèmes et animations avancés.

Premium ne permet pas de contourner l’autorisation de publier une Story.

## Système de niveaux

Chaque groupe et chaîne possède cinq niveaux maximum.

Le niveau représente une progression communautaire prestigieuse. Il n’est ni vendu ni attribué directement par Premium.

Facteurs :

- ancienneté ;
- participants actifs ;
- activité répartie sur plusieurs jours ;
- messages ou publications ;
- réactions ;
- Stories ;
- défis terminés ;
- cadeaux ;
- événements ;
- fidélité ;
- qualité ;
- réputation ;
- signalements et violations.

### XP serveur

Chaque entité possède une XP calculée côté serveur.

Les managers peuvent voir :

- XP actuelle ;
- prochain seuil ;
- critères manquants ;
- pénalités de spam ;
- pénalités de modération.

L’XP brute ne suffit pas : chaque niveau impose aussi des critères d’ancienneté, d’activité et de réputation.

### Anti-spam

- contribution des messages plafonnée ;
- messages répétés fortement pénalisés ;
- membres inactifs faiblement pondérés ;
- croissance suspecte examinée ;
- achat de membres interdit ;
- violations confirmées bloquant les niveaux prestigieux ;
- faux cadeaux et faux événements non comptés ;
- seuls les événements signés par le serveur produisent de l’XP.

## Niveaux des groupes

### Niveau 1 — Groupe débutant

Conditions minimales :

- groupe créé ;
- au moins cinq participants actifs ;
- premières interactions.

Débloque :

- chat ;
- lien ;
- photo ;
- Stories 24 h.

Limite initiale : 100 membres.

### Niveau 2 — Groupe actif

Référence :

- 30 jours ;
- 50 participants actifs ;
- activité répartie ;
- réputation suffisante ;
- 5 000 XP.

Débloque :

- Stories 48 h ;
- réactions avancées ;
- sondages ;
- mini-jeux.

### Niveau 3 — Communauté reconnue

Référence :

- 90 jours ;
- 200 participants actifs ;
- activité régulière ;
- bonne réputation ;
- 20 000 XP.

Débloque :

- Stories 72 h ;
- thème ;
- avatar animé ;
- événements ;
- badges membres ;
- quiz.

### Niveau 4 — Grande communauté

Référence :

- 180 jours minimum ;
- 1 000 participants actifs ;
- réputation élevée ;
- activité stable ;
- 80 000 XP.

Débloque :

- statistiques avancées ;
- personnalisation complète ;
- salle événementielle ;
- cadeaux exclusifs ;
- classement des membres ;
- éligibilité à la vérification.

### Niveau 5 — Groupe légendaire

Référence :

- 365 jours minimum ;
- 5 000 participants actifs ;
- excellente réputation ;
- activité presque quotidienne ;
- 250 000 XP.

Débloque :

- badge légendaire ;
- profil spécial ;
- animations uniques ;
- boutique ;
- statistiques professionnelles ;
- éligibilité partenariat.

Le niveau 5 ne produit pas automatiquement une vérification. Une revue séparée d’identité, de sécurité et d’authenticité reste nécessaire.

## Niveaux des chaînes

Les critères sont plus difficiles en nombre d’abonnés actifs.

### Niveau 1 — Nouvelle chaîne

Débloque :

- publications ;
- lien public ;
- logo ;
- description ;
- Stories 24 h.

### Niveau 2 — Chaîne active

Référence :

- 30 jours ;
- 100 abonnés actifs ;
- publications régulières ;
- 5 000 XP.

Débloque :

- sondages ;
- statistiques simples ;
- Stories 48 h ;
- programmation.

### Niveau 3 — Chaîne populaire

Référence :

- 90 jours ;
- 1 000 abonnés actifs ;
- fidélité et engagement ;
- 20 000 XP.

Débloque :

- commentaires ;
- thèmes ;
- badges abonnés ;
- réactions spéciales ;
- Stories 72 h.

### Niveau 4 — Chaîne influente

Référence :

- 180 jours ;
- 10 000 abonnés actifs ;
- forte réputation ;
- 80 000 XP.

Débloque :

- badge officiel temporaire soumis à revue ;
- analytics avancés ;
- directs et événements ;
- étude de monétisation.

### Niveau 5 — Chaîne légendaire

Référence :

- 365 jours ;
- 50 000 abonnés actifs ;
- excellente réputation ;
- 250 000 XP.

Débloque :

- éligibilité à la vérification légendaire ;
- personnalisation totale ;
- outils créateurs ;
- revenus KnowCoins après approbation ;
- cadeaux exclusifs ;
- éligibilité à une mise en avant éditoriale.

## Personnalisation

Le propriétaire peut gérer :

- photo ou logo ;
- bannière ;
- couleurs ;
- fond ;
- thème animé ;
- avatar communautaire ;
- présentation ;
- badges ;
- mise en page publique.

Un avatar communautaire peut être un robot, un personnage manga original, une mascotte sportive ou toute autre création originale ou sous licence.

## Récompenses

Les membres peuvent gagner :

- badges ;
- titres ;
- objets d’avatar ;
- cadeaux ;
- KnowCoins lorsque la politique Rewards l’autorise.

Exemples :

- premier membre ;
- membre actif ;
- donateur ;
- ancien membre ;
- organisateur ;
- modérateur exemplaire.

Les KnowCoins ne sont jamais calculés directement depuis un compteur de messages. Ils passent par des politiques de récompense plafonnées et anti-abus.

## Activités et XP

Les valeurs comme +1 message, +5 Story, +10 quiz ou +50 événement sont des intentions de design. Le serveur applique :

- plafonds ;
- déduplication ;
- contrôle de participants uniques ;
- validation de qualité ;
- pondération de rétention ;
- pénalités.

Un message spam peut donc rapporter zéro ou produire une pénalité.

## Bots

Les bots communautaires utilisent :

- identité vérifiée ;
- permissions explicites ;
- installation par un administrateur ;
- quotas ;
- journal d’actions ;
- commandes déclarées ;
- interdiction de lire les conversations privées non autorisées ;
- révocation immédiate.

## Monétisation des chaînes

Possibilités après approbation :

- abonnements Premium de chaîne ;
- contenu exclusif ;
- cadeaux ;
- publications sponsorisées signalées ;
- boutique de collections ;
- événements payants en KnowCoins.

La monétisation exige :

- identité ou organisation vérifiée ;
- conformité ;
- modération ;
- audit du ledger ;
- transparence des contenus sponsorisés.

## API fondation livrée

- `GET /communities/policy` ;
- `POST /communities/progression/evaluate` ;
- `POST /communities/stories/validate-duration`.

Les prochains blocs ajoutent les modèles Prisma, mutations, pages Web/Mobile, recherche, découverte et modération persistante.
