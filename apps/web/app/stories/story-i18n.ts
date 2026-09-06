'use client';

import { getRuntimeLocale } from '../../lib/i18n-runtime';

type StoryUi = {
  stories: string;
  createStory: string;
  yourStory: string;
  retry: string;
  loading: string;
  createTitle: string;
  text: string;
  link: string;
  shareMoment: string;
  audience: string;
  friends: string;
  everyone: string;
  followers: string;
  bestFriends: string;
  onlyMe: string;
  duration: string;
  premiumRequired: string;
  interactions: string;
  allowReplies: string;
  allowReactions: string;
  allowSharing: string;
  publishing: string;
  shareStory: string;
  close: string;
  reply: string;
  send: string;
  pin: string;
  unpin: string;
  archive: string;
  delete: string;
  views: string;
  reactions: string;
  replies: string;
  unavailable: string;
  backFeed: string;
  openLink: string;
  insights: string;
  uniqueViewers: string;
  totalViews: string;
  completion: string;
  screenshots: string;
  viewers: string;
  noViews: string;
};

const FR: StoryUi = {
  stories: 'Stories', createStory: 'Créer une Story', yourStory: 'Ta Story', retry: 'Réessayer', loading: 'Chargement…',
  createTitle: 'Créer une Story', text: 'Texte', link: 'Lien', shareMoment: 'Partage un moment…', audience: 'Audience',
  friends: 'Amis', everyone: 'Tout le monde', followers: 'Abonnés', bestFriends: 'Amis proches', onlyMe: 'Moi uniquement',
  duration: 'Durée', premiumRequired: 'Nécessite KnowMe Premium.', interactions: 'Interactions', allowReplies: 'Autoriser les réponses',
  allowReactions: 'Autoriser les réactions', allowSharing: 'Autoriser le repartage', publishing: 'Publication…', shareStory: 'Partager la Story',
  close: 'Fermer', reply: 'Répondre à la Story…', send: 'Envoyer', pin: 'Épingler au profil', unpin: 'Désépingler', archive: 'Archiver',
  delete: 'Supprimer', views: 'Vues', reactions: 'réactions', replies: 'réponses', unavailable: 'Story indisponible.', backFeed: 'Retour au fil',
  openLink: 'Ouvrir le lien', insights: 'STATISTIQUES STORY', uniqueViewers: 'Spectateurs uniques', totalViews: 'Vues totales',
  completion: 'Complétion', screenshots: 'Captures', viewers: 'Spectateurs', noViews: 'Aucune vue pour le moment.'
};

const EN: StoryUi = {
  stories: 'Stories', createStory: 'Create Story', yourStory: 'Your Story', retry: 'Retry', loading: 'Loading…',
  createTitle: 'Create Story', text: 'Text', link: 'Link', shareMoment: 'Share a moment…', audience: 'Audience',
  friends: 'Friends', everyone: 'Everyone', followers: 'Followers', bestFriends: 'Best friends', onlyMe: 'Only me',
  duration: 'Duration', premiumRequired: 'Requires KnowMe Premium.', interactions: 'Interactions', allowReplies: 'Allow replies',
  allowReactions: 'Allow reactions', allowSharing: 'Allow repost/share', publishing: 'Publishing…', shareStory: 'Share Story',
  close: 'Close', reply: 'Reply to Story…', send: 'Send', pin: 'Pin to profile', unpin: 'Unpin', archive: 'Archive', delete: 'Delete',
  views: 'Views', reactions: 'reactions', replies: 'replies', unavailable: 'Story unavailable.', backFeed: 'Back to feed', openLink: 'Open link',
  insights: 'STORY INSIGHTS', uniqueViewers: 'Unique viewers', totalViews: 'Total views', completion: 'Completion', screenshots: 'Screenshots',
  viewers: 'Viewers', noViews: 'No views yet.'
};

export function storyUi(): StoryUi {
  return getRuntimeLocale() === 'en' ? EN : FR;
}
