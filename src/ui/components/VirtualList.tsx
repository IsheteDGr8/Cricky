import { memo, type ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../use-reduced-motion';

export interface VirtualListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactElement;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

function VirtualListInner<T>({
  data,
  keyExtractor,
  renderItem,
  ListHeaderComponent,
  ListEmptyComponent,
  contentContainerStyle,
  accessibilityLabel,
}: VirtualListProps<T>) {
  const reduceMotion = useReducedMotion();
  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }: ListRenderItemInfo<T>) => renderItem(item, index)}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={contentContainerStyle}
      accessibilityLabel={accessibilityLabel}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews={!reduceMotion}
      keyboardShouldPersistTaps="handled"
    />
  );
}

/** FlatList wrapper so match and tournament lists do not mount every row at once. */
export const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;
