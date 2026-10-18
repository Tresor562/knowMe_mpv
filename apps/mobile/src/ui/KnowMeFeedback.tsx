import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type AlertButton, type AlertOptions } from 'react-native';
import { useAppearance } from '../AppearanceProvider';
import { GlassSurface, KnowMeIcon, PressScale } from './KnowMeUI';
import { KnowMeNativeAnimatedIcon } from './KnowMeNativeAnimatedIcon';
import { KnowMeNativeIconButton } from './KnowMeNativeIconButton';

type Dialog = { kind: 'dialog'; title: string; message?: string; buttons?: AlertButton[]; options?: AlertOptions };
type Toast = { kind: 'toast'; message: string; tone: 'info' | 'success' | 'error' };
type Request = Dialog | Toast;
let receiver: ((item: Request) => void) | null = null;
let queued: Request[] = [];
function dispatch(item: Request) {
  if (receiver) receiver(item);
  else { queued.push(item); if (queued.length > 24) queued.shift(); }
}

/** KnowMe-branded drop-in alternative to native Alert.alert; keeps action callbacks. */
export const KnowMeAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    dispatch({ kind: 'dialog', title, message, buttons, options });
  }
};
export const KnowMeToast = {
  show(message: string, tone: Toast['tone'] = 'info') { dispatch({ kind: 'toast', message, tone }); }
};

export function KnowMeFeedbackProvider({ children }: { children: ReactNode }) {
  const { colors } = useAppearance();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastEvent, setToastEvent] = useState(0);
  const current = dialogs[0] ?? null;
  useEffect(() => {
    const accept = (item: Request) => {
      if (item.kind === 'dialog') setDialogs(previous => [...previous, item]);
      else { setToast(item); setToastEvent(n => n + 1); }
    };
    receiver = accept;
    const earlier = queued;
    queued = [];
    earlier.forEach(accept);
    return () => { if (receiver === accept) receiver = null; };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const pop = () => setDialogs(previous => previous.slice(1));
  const cancel = () => {
    if (!current || current.options?.cancelable === false) return;
    const dismiss = current.options?.onDismiss;
    pop();
    dismiss?.();
  };
  const press = (button: AlertButton) => { pop(); button.onPress?.(); };
  const actions: AlertButton[] = current?.buttons?.length ? current.buttons : [{ text: 'OK' }];
  return (
    <View style={styles.root}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={styles.toastLayer}>
          <GlassSurface strength="medium" borderRadius={22} style={styles.toast}>
            <KnowMeNativeAnimatedIcon
              name={toast.tone === 'error' ? 'close' : toast.tone === 'success' ? 'check' : 'spark'}
              state={toast.tone === 'error' ? 'error' : toast.tone === 'success' ? 'success' : 'incoming'}
              eventToken={toastEvent} size={20}
              color={toast.tone === 'error' ? colors.danger : colors.accent} />
            <Text accessibilityRole="alert" style={[styles.toastText, { color: colors.text }]}>{toast.message}</Text>
            <KnowMeNativeIconButton name="close" size={18} color={colors.muted}
              label="Fermer le message" onPress={() => setToast(null)} />
          </GlassSurface>
        </View>
      ) : null}
      <Modal visible={Boolean(current)} animationType="fade" transparent
        statusBarTranslucent={Platform.OS === 'android'} onRequestClose={cancel}>
        {current ? (
          <View style={styles.center} accessibilityViewIsModal>
            <Pressable style={styles.scrim} onPress={cancel} accessibilityLabel="Fermer la fenêtre" />
            <GlassSurface strength="strong" borderRadius={28} style={styles.dialog}>
              <View style={styles.heading}>
                <View style={[styles.symbol, { backgroundColor: colors.backgroundAccent }]}>
                  <KnowMeIcon name="spark" color={colors.accent} size={22} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{current.title}</Text>
              </View>
              {current.message ? (
                <Text style={[styles.description, { color: colors.muted }]}>{current.message}</Text>
              ) : null}
              <View style={styles.actions}>
                {actions.map((action, index) => {
                  const primary = index === actions.length - 1 && action.style !== 'cancel';
                  const danger = action.style === 'destructive';
                  return (
                    <PressScale key={index} accessibilityRole="button" onPress={() => press(action)}
                      style={[styles.button, { backgroundColor: primary && !danger ? colors.accent : colors.backgroundAccent,
                        borderColor: colors.border }]}>
                      <Text style={[styles.buttonText,
                        { color: danger ? colors.danger : primary ? colors.accentText : colors.text }]}>
                        {action.text || 'OK'}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </GlassSurface>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,20,0.64)' },
  dialog: { width: '100%', maxWidth: 390, padding: 22, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  symbol: { width: 44, height: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  description: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9, marginTop: 7 },
  button: { minWidth: 82, minHeight: 46, borderRadius: 16, paddingHorizontal: 17, paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  toastLayer: { position: 'absolute', zIndex: 100, top: 45, left: 18, right: 18 },
  toast: { paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toastText: { fontSize: 14, flex: 1, fontWeight: '600' }
});
