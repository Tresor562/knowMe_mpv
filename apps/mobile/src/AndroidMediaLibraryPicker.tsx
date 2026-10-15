import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Linking, Modal,
  Pressable, StatusBar, StyleSheet, Text, View
} from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { mergeGalleryPage, toggleGallerySelection } from './gallery-selection-model';
import {
  isKnowMeGallerySupported, readKnowMeAlbums, readKnowMeGallery,
  requestKnowMeMediaAccess,
  type LocalDeviceMedia, type KnowMeAlbum
} from './native-gallery';

export type SelectedAndroidMedia = { uri: string; name: string; mime: string };
export type GalleryPurpose = 'publication' | 'story' | 'message' | 'profile' | 'cover';

const PAGE_SIZE = 45;

export function AndroidMediaLibraryPicker({
  visible, allowVideo = true, mediaFilter, multiple = false,
  maxSelection = 10, purpose = 'message', onClose, onPicked, onPickedMany
}: {
  visible: boolean;
  allowVideo?: boolean;
  mediaFilter?: 'all' | 'photo' | 'video';
  multiple?: boolean;
  maxSelection?: number;
  purpose?: GalleryPurpose;
  onClose: () => void;
  onPicked?: (media: SelectedAndroidMedia) => void;
  onPickedMany?: (media: SelectedAndroidMedia[]) => void;
}) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const caption = ({
    publication: en ? 'Choose a photo for your post' : 'Choisir une photo pour la publication',
    story: en ? 'Choose media for your story' : 'Choisir un média pour la story',
    message: en ? 'Attach photos and videos to your message' : 'Joindre des photos et vidéos au message',
    profile: en ? 'Choose a profile photo' : 'Choisir une photo de profil',
    cover: en ? 'Choose a cover photo' : 'Choisir une photo de couverture'
  })[purpose];
  const viewRevision = useRef(0);
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
        const granted = await requestKnowMeMediaAccess(allowVideo);
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
    const revision = ++viewRevision.current;
    setItems([]);
    setHasMore(true);
    setLoading(true);
    setError('');
    const mode = allowVideo ? filter : 'photo';
    void readKnowMeGallery(mode, album, 0, PAGE_SIZE)
      .then(page => {
        if (!active || revision !== viewRevision.current) return;
        setItems(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch(cause => {
        if (active && revision === viewRevision.current) setError(cause instanceof Error ? cause.message : 'Galerie indisponible.');
      })
      .finally(() => { if (active && revision === viewRevision.current) setLoading(false); });
    return () => { active = false; };
  }, [visible, permission, filter, album, allowVideo, generation]);

  const loadMore = useCallback(async () => {
    if (!visible || !permission || loading || paging || !hasMore) return;
    const revision = viewRevision.current;
    setPaging(true);
    try {
      const page = await readKnowMeGallery(allowVideo ? filter : 'photo', album, items.length, PAGE_SIZE);
      if (revision !== viewRevision.current) return;
      setItems(current => mergeGalleryPage(current, page));
      setHasMore(page.length === PAGE_SIZE);
    } catch (cause) {
      if (revision === viewRevision.current) setError(cause instanceof Error ? cause.message : 'Impossible de continuer le chargement.');
    } finally { setPaging(false); }
  }, [visible, permission, loading, paging, hasMore, allowVideo, filter, album, items.length]);

  function choose(entry: LocalDeviceMedia) {
    if (!multiple) {
      onPicked?.({ uri: entry.uri, name: entry.name, mime: entry.mime });
      onPickedMany?.([{ uri: entry.uri, name: entry.name, mime: entry.mime }]);
      return;
    }
    setSelection(current => {
      const next = toggleGallerySelection(current, entry, maxSelection);
      if (next.limitReached) {
        const limit = Number.isFinite(maxSelection) ? Math.max(1, Math.min(10, Math.floor(maxSelection))) : 1;
        setError(en ? `Choose up to ${limit} items.` : `Sélection limitée à ${limit} éléments.`);
      } else {
        setError('');
      }
      return next.items;
    });
  }

  function confirm() {
    if (!selection.length) return;
    const selected = selection.map(item => ({ uri: item.uri, name: item.name, mime: item.mime }));
    onPickedMany?.(selected);
    const first = selected[0];
    if (!onPickedMany && onPicked && first) onPicked(first);
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
              {caption}
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
                {(['all','photo','video'] as const).filter(mode => allowVideo || mode === 'photo').map(mode =>
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
            </>
        )}
        {multiple && !preview && !albumOpen && selection.length > 0 && (
          <View style={[styles.selectionTray, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <FlatList
              horizontal
              data={selection}
              keyExtractor={item => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectionItems}
              renderItem={({item, index}) => (
                <Pressable accessibilityRole="button"
                  accessibilityLabel={(en ? 'Remove from selection: ' : 'Retirer de la sélection : ') + item.name}
                  onPress={() => choose(item)}
                  style={styles.selectedItem}>
                  <Image source={{uri:item.thumbnail || item.uri}} style={styles.selectedThumb}/>
                  <View style={[styles.selectedBadge,{backgroundColor:colors.accent}]}>
                    <Text style={{color:colors.accentText,fontSize:10,fontWeight:'800'}}>{index + 1} ×</Text>
                  </View>
                </Pressable>
              )}
            />
            <Pressable accessibilityRole="button" onPress={confirm}
              style={[styles.selectionSend,{backgroundColor:colors.accent}]}>
              <Text style={{color:colors.accentText,fontWeight:'800',fontSize:12}}>
                {en ? 'Add' : 'Ajouter'} ({selection.length})
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex:1,paddingTop:StatusBar.currentHeight ?? 24 },
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
  previewSelect: {minHeight:52,paddingHorizontal:20,alignItems:'center',justifyContent:'center',borderRadius:16},
  selectionTray: {position:'absolute',bottom:0,left:0,right:0,borderTopWidth:StyleSheet.hairlineWidth,
    minHeight:79,paddingHorizontal:10,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:8},
  selectionItems: {alignItems:'center',gap:7,paddingRight:10},
  selectedItem: {height:53,width:53,position:'relative',borderRadius:11,overflow:'visible'},
  selectedThumb: {height:53,width:53,borderRadius:11},
  selectedBadge: {position:'absolute',right:-3,top:-4,minWidth:23,height:20,borderRadius:10,
    alignItems:'center',justifyContent:'center'},
  selectionSend: {minHeight:44,paddingHorizontal:13,borderRadius:16,alignItems:'center',justifyContent:'center'}
});
