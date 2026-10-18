/** Offline media copy stays local and requires no network translations. */
export function offlineVideoLabels(locale:string){
  const en=locale==='en';
  return en?{
    removeTitle:'Remove this saved video?',
    removeDescription:'The post stays on KnowMe. Only the local copy will be deleted.',
    cancel:'Cancel',delete:'Delete',
    deleteError:'Unable to delete the saved video.',
    readError:'Unable to read saved videos.',
    back:'Back to downloaded videos',close:'Close downloads',
    viewerTitle:'Offline video',listTitle:'Saved videos',
    viewerSubtitle:'Playing from this device',
    available:(count:number)=>count===1?'1 video available offline':count+' videos available offline',
    refresh:'Refresh saved videos',
    fileLabel:'Saved video',removeCurrent:'Delete this downloaded video',
    removeCopy:'Delete copy',offlineSaved:'Saved video',
    privacy:'Your videos are stored in the app’s private space. Once fully downloaded, they can be played without an internet connection.',
    play:(index:number)=>'Play saved video '+index,
    remove:(index:number)=>'Delete offline video '+index,
    video:(index:number)=>'Video '+index,
    device:'On this device',emptyTitle:'No saved videos',
    emptyMessage:'Open a Reel and choose “Offline” to save it.',
    sizeUnit:'MB',storage:'Storage',
    sortNewest:'Newest',sortOldest:'Oldest',sortLargest:'Largest',
    clearAll:'Delete all',clearTitle:'Delete all downloaded videos?',
    clearDescription:'This removes all saved copies from this device. Original posts stay on KnowMe.',
    clearing:'Deleting saved videos…',clearError:'Some downloaded videos could not be deleted.'
  }: {
    removeTitle:'Supprimer cette vidéo enregistrée ?',
    removeDescription:'La publication reste sur KnowMe. Seule la copie locale sera supprimée.',
    cancel:'Annuler',delete:'Supprimer',
    deleteError:'Suppression de la vidéo impossible.',
    readError:'Impossible de lire les vidéos enregistrées.',
    back:'Retour aux vidéos téléchargées',close:'Fermer les téléchargements',
    viewerTitle:'Vidéo hors ligne',listTitle:'Vidéos enregistrées',
    viewerSubtitle:'Lecture depuis cet appareil',
    available:(count:number)=>count===1?'1 vidéo disponible hors connexion':count+' vidéos disponibles hors connexion',
    refresh:'Actualiser les vidéos enregistrées',
    fileLabel:'Vidéo enregistrée',removeCurrent:'Supprimer cette vidéo téléchargée',
    removeCopy:'Supprimer la copie',offlineSaved:'Vidéo enregistrée',
    privacy:'Tes vidéos sont stockées dans l’espace privé de l’application. Une fois complètement téléchargées, elles restent accessibles sans connexion.',
    play:(index:number)=>'Lire la vidéo hors ligne '+index,
    remove:(index:number)=>'Supprimer la vidéo hors ligne '+index,
    video:(index:number)=>'Vidéo '+index,
    device:'Sur cet appareil',emptyTitle:'Aucune vidéo enregistrée',
    emptyMessage:'Ouvre un Reel et touche « Hors ligne » pour l’enregistrer.',
    sizeUnit:'Mo',storage:'Stockage',
    sortNewest:'Récentes',sortOldest:'Anciennes',sortLargest:'Plus volumineuses',
    clearAll:'Tout supprimer',clearTitle:'Supprimer toutes les vidéos enregistrées ?',
    clearDescription:'Toutes les copies locales seront supprimées de cet appareil. Les publications restent sur KnowMe.',
    clearing:'Suppression des vidéos…',clearError:'Certaines vidéos enregistrées n’ont pas pu être supprimées.'
  };
}

/** Local videos can exceed several gigabytes; display safe binary file sizes. */
export function offlineVideoSize(bytes:number,locale:string):string{
  const safe=Number.isFinite(bytes)&&bytes>0?bytes:0;
  const gib=safe/(1024*1024*1024);
  const mib=safe/(1024*1024);
  const en=locale==='en';
  return gib>=1?gib.toFixed(1)+(en?' GB':' Go')
    :mib.toFixed(1)+(en?' MB':' Mo');
}
