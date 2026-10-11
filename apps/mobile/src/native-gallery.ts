import {
  NativeModules, PermissionsAndroid, Platform
} from 'react-native';

export type LocalDeviceMedia = {
  id: string;
  uri: string;
  thumbnail: string;
  name: string;
  mime: string;
  type: 'photo' | 'video';
  albumId: string;
  albumName: string;
  timestamp: number;
};

export type SelectedKnowMeFile = { uri: string; name: string; mime: string; size?: number };

type NativeGalleryBridge = {
  listMedia(filter: string, album: string, offset: number, limit: number): Promise<LocalDeviceMedia[]>;
  pickDocuments(multiple: boolean): Promise<SelectedKnowMeFile[]>;
};
const gallery = NativeModules.KnowMeGallery as NativeGalleryBridge | undefined;

export function isKnowMeGallerySupported() {
  return Platform.OS === 'android' && Boolean(gallery);
}

export async function requestKnowMeMediaAccess() {
  if (!isKnowMeGallerySupported()) {
    throw new Error('La galerie KnowMe nécessite une APK native récente.');
  }
  const sdk = Number(Platform.Version);
  if (sdk < 23) return true;
  if (sdk < 33) {
    const status = await PermissionsAndroid.request('android.permission.READ_EXTERNAL_STORAGE');
    return status === PermissionsAndroid.RESULTS.GRANTED;
  }
  const permissions = [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    ...(sdk >= 34 ? ['android.permission.READ_MEDIA_VISUAL_USER_SELECTED'] : [])
  ] as Parameters<typeof PermissionsAndroid.requestMultiple>[0];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(result).some(status => status === PermissionsAndroid.RESULTS.GRANTED);
}

export async function readKnowMeGallery(
  filter: 'all' | 'photo' | 'video', album: string, offset: number, limit = 45
) {
  if (!gallery) throw new Error('La galerie KnowMe n’est pas installée dans cette APK.');
  return gallery.listMedia(filter, album, offset, limit);
}

export async function openKnowMeFiles(multiple = true) {
  if (!gallery) throw new Error('Le sélecteur Fichiers nécessite une APK KnowMe récente.');
  return gallery.pickDocuments(multiple);
}
