import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  startTransition,
} from 'react';
import { usePageStack } from '@/contexts/useStackHistory';
import { TabsContext, LOCAL_STORAGE_KEY, type TabValue } from './tabsShared';
import { useUser } from '@/contexts/UserContextCore';
import { getLastUserId } from '@/utils/chatStateStorage';

function getTabStorageKey(userId: number | null | undefined): string {
  return userId != null ? `${LOCAL_STORAGE_KEY}-${userId}` : LOCAL_STORAGE_KEY;
}

const TAB_TRANSITION_MS = 300;

export function TabsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const storageKey = getTabStorageKey(user?.id ?? getLastUserId());
  const { push } = usePageStack();
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    const saved = localStorage.getItem(storageKey) as TabValue | null;
    return saved ?? 'chats';
  });
  const prevActiveTabRef = useRef<TabValue>(activeTab);

  useEffect(() => {
    const prev = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTab;

    if (prev === 'profile' && activeTab !== 'profile') {
      const id = setTimeout(() => push(activeTab), TAB_TRANSITION_MS);
      return () => clearTimeout(id);
    }
    push(activeTab);
  }, [activeTab, push]);

  useEffect(() => {
    localStorage.setItem(storageKey, activeTab);
  }, [activeTab, storageKey]);

  useEffect(() => {
    const next = localStorage.getItem(storageKey) as TabValue | null;
    if (
      next &&
      (next === 'chats' || next === 'contacts' || next === 'profile') &&
      next !== activeTab
    ) {
      startTransition(() => {
        setActiveTab(next);
      });
    }
  }, [storageKey, activeTab]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}
