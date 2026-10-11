import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Linking, Modal,
  Pressable, StyleSheet, Text, View
} from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import {
  isKnowMeGallerySupported, readKnowMeAlbums, readKnowMeGallery,
  requestKnowMeMediaAccess,
  type LocalDeviceMedia, type KnowMeAlbum
} from './native-gallery';

export type SelectedAndroidMedia = { uri: string; name: string; mime: string };

const PAGE_SIZE = 45;

export function AndroidMediaLibraryPicker({
  visible, allowVideo = true, mediaFilter, multiple = false,
  maxSelection = 10, onClose, onPicked, onPickedMany
}: {
  visible: boolean;
  allowVideo?: boolean;
  mediaFilter?: 'all' | 'photo' | 'video';
  multiple?: boolean;
  maxSelection?: number;
  onClose: () => void;
  onPicked?: (media: SelectedAndroidMedia) => void;
  onPickedMany?: (media: SelectedAndroidMedia[]) => void;
}) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>(
    mediaFilter ?? (allowVideo ? 'all' : 'photo')
  );
  const [album, setAlbum] = useState('');
  const [albumOpen, setAlbumOpen] = useState(false);
  const [albums, setAlbums] = useState<KnowMeAlbum[]>([]);
  const [items, setItems] = useState<LocalDeviceMedia[]>([]);
  const [selection, setSelection] = useState<LocalDeviceMedia[]>([]);
  const [preview, setPreview] = useState<LocalDeviceMedia | null>(null);
  const [permission, setPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paging, setPaging] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setItems([]);
    setSelection([]);
    setAlbums([]);
    setAlbum('');
    setAlbumOpen(false);
    setPreview(null);
    setFilter(mediaFilter ?? (allowVideo ? 'all' : 'photo'));
    setError('');
    setPermission(false);
    setLoading(true);
    void (async () => {
      try {
        if (!isKnowMeGallerySupported()) {
          throw new Error(en ? 'Update KnowMe to use the built-in gallery.' : 'Mets KnowMe à jour pour utiliser sa galerie intégrée.');
        }
        const granted = await requestKnowMeMediaAccess();
        if (!active) return;
        if (!granted) {
          setError(en ? 'Photo and video access was not granted. Check Android app permissions.'
            : 'Accès aux photos et vidéos refusé. Vérifie les autorisations Android.');
          return;
        }
        setPermission(true);
        const found = await readKnowMeAlbums().catch(() => [] as KnowMeAlbum[]);
        if (active) setAlbums(found);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Galerie indisponible.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [visible, allowVideo, mediaFilter, en]);

  useEffect(() => {
    if (!visible || !permission) return;
    let active = true;
    setItems([]);
    setSelection([]);
    setHasMore(true);
    setLoading(true);
    setError('');
    const mode = allowVideo ? filter : 'photo';
    void readKnowMeGallery(mode, album, 0, PAGE_SIZE)
      .then(page => {
        if (!active) return;
        setItems(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Galerie indisponible.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, permission, filter, album, allowVideo, generation]);

  const loadMore = useCallback(async () => {
    if (!visible || !permission || loading || paging || !hasMore) return;
    setPaging(true);
    try {
      const page = await readKnowMeGallery(allowVideo ? filter : 'photo', album, items.length, PAGE_SIZE);
      setItems(current => {
        const known = new Set(current.map(entry => entry.id));
        return [...current, ...page.filter(entry => !known.has(entry.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de continuer le chargement.');
    } finally { setPaging(false); }
  }, [visible, permission, loading, paging, hasMore, allowVideo, filter, album, items.length]);

  function choose(entry: LocalDeviceMedia) {
    if (!multiple) {
      onPicked?.({ uri: entry.uri, name: entry.name, mime: entry.mime });
      onPickedMany?.([{ uri: entry.uri, name: entry.name, mime: entry.mime }]);
      return;
    }
    setSelection(current => {
      if (current.some(item => item.id === entry.id)) {
        return current.filter(item => item.id !== entry.id);
      }
      if (current.length >= Math.min(Math.max(maxSelection, 1), 10)) {
        setError(en ? 'Up to 10 items per selection.' : '10 éléments maximum par sélection.');
        return current;
      }
      setError('');
      return [...current, entry];
    });
  }

  function confirm() {
    if (!selection.length) return;
    const selected = selection.map(item => ({ uri: item.uri, name: item.name, mime: item.mime }));
    onPickedMany?.(selected);
    if (!onPickedMany && onPicked) onPicked(selected[0]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Close gallery' : 'Fermer la galerie'}
            onPress={preview ? () => setPreview(null) : onClose} style={styles.headerButton}>
            <Text style={[styles.back, { color: colors.text }]}>‹</Text>
          </Pressable>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.text }]}>
              {preview ? (en ? 'Preview' : 'Aperçu') : 'Galerie KnowMe'}
            </Text>
            {!preview && <Text style={[styles.subtitle, { color: colors.muted }]}>
              {en ? 'Private device photos and videos' : 'Photos et vidéos du téléphone'}
            </Text>}
          </View>
          {multiple && !preview && <Pressable accessibilityRole="button" onPress={confirm}
            disabled={!selection.length} style={[styles.confirm, { backgroundColor: colors.backgroundAccent }]}>
            <Text style={[styles.confirmText, { color: colors.accent, opacity: selection.length ? 1 : .5 }]}>
              {en ? 'Add' : 'Ajouter'} ({selection.length})
            </Text>
          </Pressable>}
        </View>

        {preview ? (
          <View style={styles.previewScreen}>
            <Image source={{ uri: preview.thumbnail || preview.uri }} resizeMode="contain" style={styles.previewImage}/>
            <Text numberOfLines={1} style={[styles.previewName, {color:colors.text}]}>{preview.name}</Text>
            {preview.type === 'video' && <Text style={[styles.subtitle,{color:colors.muted}]}>
              {en ? 'Video thumbnail · playback follows after selection.' : 'Aperçu de la vidéo · lecture après sélection.'}
            </Text>}
            <Pressable accessibilityRole="button" style={[styles.previewSelect, {backgroundColor:colors.accent}]}
              onPress={() => { choose(preview); setPreview(null); }}>
              <Text style={{fontWeight:'800',color:colors.accentText}}>
                {en ? 'Select this item' : 'Sélectionner cet élément'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.toolbar}>
              <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Select album' : 'Choisir un album'}
                onPress={() => setAlbumOpen(v => !v)} style={[styles.albumButton,{backgroundColor:colors.surfaceGlass}]}>
                <Text numberOfLines={1} style={{color:colors.text,fontWeight:'700'}}>
                  {album ? (albums.find(item => item.id === album)?.name || (en ? 'Album' : 'Album')) : (en ? 'All photos' : 'Toutes les photos')}
                  {'  ⌄'}
                </Text>
              </Pressable>
              <View style={styles.tabs}>
                {(['all','photo','video'] as const).filter(mode => allowVideo || mode !== 'video').map(mode =>
                  <Pressable key={mode} accessibilityRole="button"
                    accessibilityState={{selected:filter === mode}}
                    onPress={() => {setAlbumOpen(false);setFilter(mode);}}
                    style={[styles.tab,filter===mode && {backgroundColor:colors.backgroundAccent}]}>
                    <Text style={{color:filter===mode?colors.accent:colors.muted,fontWeight:'700',fontSize:12}}>
                      {mode==='all'?(en?'All':'Tout'):mode==='photo'?(en?'Photos':'Photos'):(en?'Videos':'Vidéos')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
            {albumOpen ? <FlatList
              style={styles.albumList}
              contentContainerStyle={{paddingBottom:14}}
              data={[{id:'',name:en?'All media':'Tous les médias',count:0,thumbnail:''},...albums]}
              keyExtractor={item=>item.id || 'all'}
              renderItem={({item})=>
                <Pressable accessibilityRole="button" style={[styles.albumRow,{borderBottomColor:colors.border}]}
                  onPress={() => {setAlbum(item.id);setAlbumOpen(false);}}>
                  {item.thumbnail ? <Image source={{uri:item.thumbnail}} style={styles.albumThumb}/> :
                    <View style={[styles.albumThumb,{backgroundColor:colors.surfaceGlass}]}/>}
                  <View style={{flex:1}}>
                    <Text numberOfLines={1} style={{color:colors.text,fontWeight:'700'}}>{item.name}</Text>
                    {!!item.id && <Text style={{color:colors.muted,fontSize:11}}>{item.count} {en?'items':'éléments'}</Text>}
                  </View>
                  {album===item.id && <Text style={{color:colors.accent}}>✓</Text>}
                </Pressable>}
              /> : <>
                {!!error && <View style={styles.errorRow}>
                  <Text accessibilityRole="alert" style={{color:colors.danger,flex:1,fontSize:12}}>{error}</Text>
                  <Pressable onPress={() => { if(!permission)void Linking.openSettings();else setGeneration(n=>n+1); }}
                    accessibilityRole="button" style={styles.retry}>
                    <Text style={{color:colors.accent,fontWeight:'700'}}>{permission?(en?'Retry':'Réessayer'):(en?'Settings':'Paramètres')}</Text>
                  </Pressable>
                </View>}
                {loading ? <ActivityIndicator color={colors.accent} style={{marginTop:42}}/> : null}
                {!loading && permission && !items.length ? <Text style={[styles.empty,{color:colors.muted}]}>
                  {en ? 'No photos or videos found in this album.' : 'Aucun média trouvé dans cet album.'}
                </Text> : null}
                <FlatList
                  data={items}
                  numColumns={3}
                  keyExtractor={item=>item.id}
                  columnWrapperStyle={styles.gridRow}
                  contentContainerStyle={styles.grid}
                  onEndReached={() => { void loadMore(); }}
                  onEndReachedThreshold={.6}
                  ListFooterComponent={paging ? <ActivityIndicator color={colors.accent}/> : null}
                  renderItem={({item}) => {
                    const selectedIndex=selection.findIndex(entry=>entry.id===item.id);
                    return <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      onPress={() => choose(item)}
                      onLongPress={() => setPreview(item)}
                      style={[styles.gridCell,{backgroundColor:colors.surfaceGlass}]}>
                      {item.thumbnail ? <Image source={{uri:item.thumbnail}} style={styles.gridImage}/> :
                        <View style={[styles.gridImage,{backgroundColor:colors.surface}]}/>}
                      {item.type==='video' && <View style={styles.videoMark}>
                        <Text style={styles.videoText}>▶</Text>
                      </View>}
                      {multiple && <View style={[styles.check,
                        {borderColor:'#fff',backgroundColor:selectedIndex>=0?colors.accent:'rgba(0,0,0,.3)'}]}>
                        <Text style={styles.checkText}>{selectedIndex>=0?String(selectedIndex+1):''}</Text>
                      </View>}
                    </Pressable>;
                  }}
                />
              </>}
            </>}
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex:1,paddingTop:16 },
  header: { flexDirection:'row',minHeight:62,paddingHorizontal:12,alignItems:'center',
    borderBottomWidth:StyleSheet.hairlineWidth,gap:9 },
  headerButton: {minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  back: {fontSize:32,fontWeight:'300'},
  heading: {flex:1,minWidth:0},
  title: {fontSize:19,fontWeight:'800'},
  subtitle: {fontSize:11.5,lineHeight:17},
  confirm: {paddingHorizontal:12,minHeight:40,justifyContent:'center',borderRadius:14},
  confirmText: {fontWeight:'800',fontSize:13},
  toolbar: {flexDirection:'row',paddingHorizontal:12,paddingVertical:9,gap:9,alignItems:'center'},
  albumButton: {flex:1,minWidth:0,paddingHorizontal:12,minHeight:40,borderRadius:14,justifyContent:'center'},
  tabs: {flexDirection:'row',gap:3,alignItems:'center'},
  tab: {minHeight:38,paddingHorizontal:9,borderRadius:12,justifyContent:'center'},
  grid: {paddingHorizontal:3,paddingBottom:110},
  gridRow: {gap:3,marginBottom:3},
  gridCell: {flex:1,aspectRatio:1,maxWidth:'33%',position:'relative',overflow:'hidden'},
  gridImage: {width:'100%',height:'100%'},
  videoMark: {position:'absolute',bottom:7,left:7,backgroundColor:'rgba(0,0,0,.55)',
    borderRadius:12,paddingHorizontal:7,paddingVertical:2},
  videoText: {color:'#fff',fontWeight:'700',fontSize:12},
  check: {position:'absolute',top:7,right:7,width:25,height:25,borderRadius:13,
    alignItems:'center',justifyContent:'center',borderWidth:2},
  checkText: {fontSize:12,color:'#fff',fontWeight:'800'},
  albumList: {flex:1,paddingHorizontal:14},
  albumRow: {minHeight:66,borderBottomWidth:StyleSheet.hairlineWidth,flexDirection:'row',
    alignItems:'center',gap:12},
  albumThumb: {width:46,height:46,borderRadius:11},
  empty: {textAlign:'center',padding:30,fontSize:14},
  errorRow: {flexDirection:'row',paddingHorizontal:13,alignItems:'center',gap:8,minHeight:55},
  retry: {paddingHorizontal:10,minHeight:44,justifyContent:'center'},
  previewScreen: {flex:1,alignItems:'center',justifyContent:'center',padding:18,gap:16},
  previewImage: {height:'65%',width:'100%'},
  previewName: {fontSize:15,fontWeight:'700'},
  previewSelect: {minHeight:52,paddingHorizontal:20,alignItems:'center',justifyContent:'center',borderRadius:16}
});
