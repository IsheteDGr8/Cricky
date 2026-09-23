import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import type { ThemeColors, TypographyVariant } from '../tokens';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const theme = useTheme();
  const base = theme.typography[variant] as TextStyle;
  return (
    <RNText
      style={[
        base,
        { color: theme.colors[color], fontFamily: theme.fonts.regular, textAlign: align },
        variant === 'label' && { textTransform: 'uppercase' },
        style,
      ]}
      {...rest}
    />
  );
}
