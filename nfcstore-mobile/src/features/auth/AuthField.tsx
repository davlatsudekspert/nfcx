import { Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

/**
 * Kirish/Ro'yxatdan o'tish maydoni — spetsifikatsiya "Input" komponenti:
 * height 50, radius 14, fokusda chegara champagne'ga o'tadi.
 */
export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words';
}) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 7 }}>
      <Text style={[sans(600, 12), { color: 'rgba(255,255,255,.55)' }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.off}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[
          sans(500, 14),
          {
            height: 50,
            borderRadius: 14,
            paddingHorizontal: 15,
            color: theme.ink,
            backgroundColor: theme.c2,
            borderWidth: 1,
            borderColor: theme.hairline,
          },
        ]}
      />
    </View>
  );
}
