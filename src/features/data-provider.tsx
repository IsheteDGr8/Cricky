import { createContext, useContext, useState, type ReactNode } from 'react';

import { createDataLayer, type DataLayer } from '@/data';

const DataLayerContext = createContext<DataLayer | null>(null);

/** Gives every screen below it the data layer. Tests pass a fake `value`. */
export function DataProvider({ children, value }: { children: ReactNode; value?: DataLayer }) {
  const [layer] = useState(() => value ?? createDataLayer());
  return <DataLayerContext.Provider value={layer}>{children}</DataLayerContext.Provider>;
}

export function useDataLayer(): DataLayer {
  const layer = useContext(DataLayerContext);
  if (!layer) throw new Error('useDataLayer must be used inside <DataProvider>');
  return layer;
}
