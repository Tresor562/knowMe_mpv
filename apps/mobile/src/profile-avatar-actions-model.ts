/** User-facing labels for the native avatar actions sheet. No raw placeholder glyphs. */
export function avatarActionText(locale: 'fr' | 'en') {
  const en = locale === 'en';
  return {
    title: en ? 'Profile picture' : 'Photo de profil',
    subtitle: en ? 'Manage your picture and stories' : 'Gérer ta photo et tes stories',
    openActions: en ? 'Profile picture options' : 'Options de la photo de profil',
    hint: en ? 'Add a story, view or change your picture' : 'Ajouter une story, voir ou changer ta photo',
    addStory: en ? 'Add a story' : 'Ajouter une story',
    addStoryHint: en ? 'Share a moment with your friends' : 'Partager un moment avec tes amis',
    view: en ? 'View picture' : 'Voir la photo',
    viewHint: en ? 'Full-screen preview' : 'Aperçu en plein écran',
    noPicture: en ? 'No picture yet' : 'Aucune photo pour le moment',
    change: en ? 'Change picture' : 'Changer la photo',
    changeHint: en ? 'Choose from KnowMe Gallery' : 'Choisir dans la Galerie KnowMe',
    remove: en ? 'Remove picture' : 'Retirer la photo',
    removeHint: en ? 'Restore the default avatar' : 'Retrouver l’avatar par défaut',
    confirmTitle: en ? 'Remove your picture?' : 'Retirer ta photo ?',
    confirmDescription: en
      ? 'Your default avatar will appear instead. Your existing posts and stories will not be deleted.'
      : 'Ton avatar par défaut sera affiché. Tes publications et tes stories ne seront pas supprimées.',
    cancel: en ? 'Cancel' : 'Annuler',
    close: en ? 'Close' : 'Fermer',
    back: en ? 'Back' : 'Retour',
    removing: en ? 'Removing…' : 'Suppression…',
    removed: en ? 'Your profile picture has been removed.' : 'Ta photo de profil a été retirée.',
    removeFailed: en ? 'Could not remove the picture.' : 'Impossible de retirer la photo.',
    pictureChanged: en ? 'Your profile picture has been saved.' : 'Ta nouvelle photo de profil est enregistrée.',
    uploadFailed: en ? 'Could not change the picture.' : 'Impossible de changer la photo.',
    serverMissing: en ? 'Profile pictures are not available on this server yet.'
      : 'Le serveur ne permet pas encore les photos de profil.',
  } as const;
}

/** Never offer a destructive action for an absent picture or during a mutation. */
export function canRemoveAvatar(avatarUrl: string | null | undefined, busy: boolean) {
  return Boolean(avatarUrl?.trim()) && !busy;
}
