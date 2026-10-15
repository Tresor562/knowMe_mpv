import { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { useProfileNavigation } from './profile-navigation';

/** Native inline mentions: links do not change the surrounding message gestures. */
export function KnowMeMentionText({
  text,
  style
}: {
  text: string;
  style?: StyleProp<TextStyle>;
}) {
  const openProfile = useProfileNavigation();
  const { colors } = useAppearance();
  const parts = useMemo(() => {
    const pattern = /(^|[^\w.@])@([A-Za-z0-9_]{3,24})(?![\w])/g;
    const result: Array<{ value: string; username?: string }> = [];
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      const username = match[2];
      if (!username) continue;
      const start = (match.index ?? 0) + (match[1] ?? '').length;
      const end = start + username.length + 1;
      if (start < cursor) continue;
      if (start > cursor) result.push({ value: text.slice(cursor, start) });
      result.push({ value: `@${username}`, username });
      cursor = end;
    }
    if (cursor < text.length) result.push({ value: text.slice(cursor) });
    return result;
  }, [text]);
  return (
    <Text style={style}>
      {parts.map((part, i) => part.username
        ? <Text key={i} accessibilityRole="link"
            accessibilityLabel={`Voir le profil de ${part.value}`}
            onPress={() => openProfile?.(part.username!)}
            style={{ color: colors.accent, fontWeight: '700' }}>{part.value}</Text>
        : <Text key={i}>{part.value}</Text>)}
    </Text>
  );
}
