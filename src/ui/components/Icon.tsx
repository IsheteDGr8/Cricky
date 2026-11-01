import Ionicons from '@expo/vector-icons/Ionicons';
import { useSyncExternalStore, type ComponentProps } from 'react';
import { Platform, View } from 'react-native';

const noop = () => () => {};
const isClient = () => true;
const isServer = () => Platform.OS !== 'web';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
}

/** Decorative icon; the surrounding control carries the accessible label. */
export function Icon({ name, size = 20, color }: IconProps) {
  // The icon font only exists in the browser, so static HTML gets a same-size placeholder.
  const hydrated = useSyncExternalStore(noop, isClient, isServer);
  if (!hydrated) return <View style={{ width: size, height: size }} />;
  return <Ionicons name={name} size={size} color={color} accessibilityElementsHidden />;
}
