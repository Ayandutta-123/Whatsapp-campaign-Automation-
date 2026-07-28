import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { notifications as notificationsApi } from '../lib/api';
import { playNotifySound } from '../lib/sounds';

const NotificationContext = createContext(null);

const LOCAL_KEY = 'wa_local_notifications';

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocal(items) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, 80)));
}

export function NotificationProvider({ children }) {
  const [items, setItems] = useState(() => loadLocal());
  const [open, setOpen] = useState(false);
  const seenServerIds = useRef(new Set());
  const soundEnabled = useRef(true);

  const mergeServer = useCallback((serverItems) => {
    if (!Array.isArray(serverItems)) return;
    const fresh = [];
    setItems((prev) => {
      const byKey = new Map(prev.map((n) => [n.key || `local-${n.id}`, n]));
      for (const s of serverItems) {
        const key = `server-${s.id}`;
        const isNew = !seenServerIds.current.has(s.id) && !byKey.has(key);
        seenServerIds.current.add(s.id);
        if (isNew && !s.read) {
          fresh.push(s);
        }
        byKey.set(key, {
          key,
          id: s.id,
          source: 'server',
          type: s.type || 'info',
          category: s.category,
          title: s.title,
          message: s.message || '',
          link: s.link,
          read: !!s.read,
          created_at: s.created_at,
        });
      }
      const next = Array.from(byKey.values()).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      saveLocal(next.filter((n) => n.source === 'local'));
      return next;
    });
    if (fresh.length > 0 && soundEnabled.current) {
      const worst = fresh.some((f) => f.type === 'error')
        ? 'error'
        : fresh.some((f) => f.type === 'warning')
          ? 'warning'
          : 'success';
      playNotifySound(worst);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      mergeServer(res.data.items || []);
    } catch {
      /* offline / unauthenticated */
    }
  }, [mergeServer]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const pushLocal = useCallback(({ type = 'info', title, message = '', link = null, toast: showToast = true, sound = true }) => {
    const entry = {
      key: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      source: 'local',
      type,
      title,
      message,
      link,
      read: false,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => {
      const next = [entry, ...prev].slice(0, 100);
      saveLocal(next.filter((n) => n.source === 'local'));
      return next;
    });
    if (sound && soundEnabled.current) playNotifySound(type);
    if (showToast) {
      const text = message ? `${title}: ${message}` : title;
      if (type === 'success') toast.success(text);
      else if (type === 'error') toast.error(text);
      else if (type === 'warning') toast(text, { icon: '⚠️' });
      else toast(text);
    }
    return entry;
  }, []);

  const markRead = useCallback(async (item) => {
    setItems((prev) => {
      const next = prev.map((n) => (n.key === item.key ? { ...n, read: true } : n));
      saveLocal(next.filter((n) => n.source === 'local'));
      return next;
    });
    if (item.source === 'server' && item.id) {
      try {
        await notificationsApi.markRead(item.id);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveLocal(next.filter((n) => n.source === 'local'));
      return next;
    });
    try {
      await notificationsApi.markAllRead();
    } catch {
      /* ignore */
    }
  }, []);

  const removeItem = useCallback(async (item) => {
    setItems((prev) => {
      const next = prev.filter((n) => n.key !== item.key);
      saveLocal(next.filter((n) => n.source === 'local'));
      return next;
    });
    if (item.source === 'server' && item.id) {
      seenServerIds.current.delete(item.id);
      try {
        await notificationsApi.delete(item.id);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const clearAll = useCallback(async () => {
    setItems([]);
    saveLocal([]);
    seenServerIds.current.clear();
    try {
      await notificationsApi.clearAll();
    } catch {
      /* ignore */
    }
  }, []);

  const clearRead = useCallback(async () => {
    setItems((prev) => {
      const removedServerIds = prev.filter((n) => n.source === 'server' && n.read).map((n) => n.id);
      removedServerIds.forEach((id) => seenServerIds.current.delete(id));
      const next = prev.filter((n) => !n.read);
      saveLocal(next.filter((n) => n.source === 'local'));
      return next;
    });
    try {
      await notificationsApi.clearRead();
    } catch {
      /* ignore */
    }
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const value = useMemo(
    () => ({
      items,
      open,
      setOpen,
      unreadCount,
      pushLocal,
      notify: {
        success: (title, message, opts) =>
          pushLocal({ type: 'success', title, message, ...opts }),
        error: (title, message, opts) =>
          pushLocal({ type: 'error', title, message, ...opts }),
        warning: (title, message, opts) =>
          pushLocal({ type: 'warning', title, message, ...opts }),
        info: (title, message, opts) =>
          pushLocal({ type: 'info', title, message, ...opts }),
      },
      markRead,
      markAllRead,
      removeItem,
      clearAll,
      clearRead,
      refresh,
    }),
    [items, open, unreadCount, pushLocal, markRead, markAllRead, removeItem, clearAll, clearRead, refresh]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}
