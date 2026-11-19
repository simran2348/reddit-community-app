import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

const getSnapshot = () => document.visibilityState === 'hidden';

/** True while this web view's document is hidden (tab/app backgrounded). */
export const useDocumentHidden = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false);
