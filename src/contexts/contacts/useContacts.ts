// contexts/contacts/useContacts.ts
import { useCallback, useEffect, useState, startTransition } from 'react';
import { websocketManager } from '@/utils/websocket-manager';
import { useUser } from '@/contexts/UserContextCore';
import type { Contact } from '@/types';

export function useContacts() {
  const { user } = useUser();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(() => {
    try {
      setLoading(true);
      setError(null);

      if (!websocketManager.isConnected()) {
        setLoading(false);
        return;
      }

      const timeoutId = window.setTimeout(() => {
        setLoading(false);
      }, 15000);

      const handleContacts = (data: {
        type?: string;
        contacts?: unknown[];
      }) => {
        if (data.type !== 'contacts') return;
        window.clearTimeout(timeoutId);
        setContacts(
          Array.isArray(data.contacts) ? (data.contacts as Contact[]) : [],
        );
        setLoading(false);
        websocketManager.off('contacts', handleContacts);
        websocketManager.off('message', handleError);
      };

      const handleError = (msg: { type?: string; message?: string }) => {
        if (msg.type === 'error') {
          window.clearTimeout(timeoutId);
          setError(msg.message ?? 'Failed to load contacts');
          setLoading(false);
          websocketManager.off('contacts', handleContacts);
          websocketManager.off('message', handleError);
        }
      };

      websocketManager.on('contacts', handleContacts);
      websocketManager.on('message', handleError);
      websocketManager.sendMessage({ type: 'get_contacts' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      startTransition(() => {
        setContacts([]);
        setLoading(false);
        setError(null);
      });
      return;
    }

    const onConnected = () => {
      fetchContacts();
    };
    websocketManager.on('connection_established', onConnected);
    if (websocketManager.isConnected()) {
      startTransition(() => {
        fetchContacts();
      });
    }
    return () => {
      websocketManager.off('connection_established', onConnected);
    };
  }, [user, fetchContacts]);

  const searchContacts = (query: string) => {
    if (!query) return contacts;
    const lower = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(lower) ||
        (c as { email?: string }).email?.toLowerCase().includes(lower) ||
        (c as { phone?: string }).phone?.toLowerCase().includes(lower),
    );
  };

  return { contacts, loading, error, searchContacts, fetchContacts };
}
