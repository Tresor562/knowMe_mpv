import type { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native';
import { tokenizeKnowMeMentions } from '@knowme/link-contract';
import { useAppearance } from './AppearanceProvider';
import { useOpenPublicProfile } from './PublicProfileProvider';

export function UsernameMentions({
  text,
  textStyle,
  outgoing = false
}: {
  text: string;
  textStyle?: StyleProp<TextStyle>;
  outgoing?: boolean;
}) {
  const { colors } = useAppearance();
  const openProfile = useOpenPublicProfile();

  return (
    <Text style={textStyle}>
      {tokenizeKnowMeMentions(text).map((part, index) => part.kind === 'mention' ? (
        <Text
          key={index}
          accessibilityRole="link"
          accessibilityLabel={`Voir le profil ${part.text}`}
          onPress={(event) => { event.stopPropagation(); void openProfile(part.username); }}
          style={{
            color: outgoing ? colors.accentText : colors.accent,
            fontWeight: '600',
            textDecorationLine: 'underline'
          }}
        >{part.text}</Text>
      ) : <Text key={index}>{part.text}</Text>)}
    </Text>
  );
}
