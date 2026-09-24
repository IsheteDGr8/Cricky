import type { ReactNode } from 'react';

import { DataError } from '@/data';
import { EmptyState, LoadingState } from '@/ui';
import type { Loadable } from './loadable';

export interface LoadedProps<T> {
  value: Loadable<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}

/** Shows a spinner, an error, or `children` with the data. */
export function Loaded<T>({ value, children, loadingLabel }: LoadedProps<T>) {
  if (value.status === 'loading') return <LoadingState label={loadingLabel} />;
  if (value.status === 'error') {
    const notFound = value.error instanceof DataError && value.error.code === 'not_found';
    return (
      <EmptyState
        icon={notFound ? 'search-outline' : 'cloud-offline-outline'}
        title={notFound ? 'Not found' : 'Something went wrong'}
        message={notFound ? 'It may have been deleted.' : value.error.message}
      />
    );
  }
  return <>{children(value.data)}</>;
}
