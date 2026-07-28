import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const typeDot = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

export default function NotificationBell() {
  const {
    items,
    open,
    setOpen,
    unreadCount,
    markRead,
    markAllRead,
    removeItem,
    clearAll,
    clearRead,
  } = useNotifications();
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const [clearMenuOpen, setClearMenuOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
        setClearMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-700 shadow-sm"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(100vw-2rem,380px)] max-h-[70vh] overflow-hidden rounded-xl border bg-white shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <p className="font-semibold text-sm">Notifications</p>
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                title="Mark all read"
              >
                <CheckCheck size={16} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setClearMenuOpen((v) => !v)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                  title="Clear notifications"
                  disabled={items.length === 0}
                >
                  <Trash2 size={16} />
                </button>
                {clearMenuOpen && (
                  <div className="absolute right-0 mt-1 w-40 rounded-lg border bg-white shadow-lg z-10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        clearRead();
                        setClearMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Clear read
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearAll();
                        setClearMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-t"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
            {items.length === 0 ? (
              <p className="p-6 text-sm text-gray-500 text-center">No notifications yet</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    markRead(n);
                    if (n.link) {
                      setOpen(false);
                      navigate(n.link);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      markRead(n);
                      if (n.link) {
                        setOpen(false);
                        navigate(n.link);
                      }
                    }
                  }}
                  className={`group w-full text-left px-4 py-3 border-b hover:bg-gray-50 cursor-pointer ${
                    n.read ? 'opacity-70' : 'bg-amber-50/40'
                  }`}
                >
                  <div className="flex gap-2">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        typeDot[n.type] || typeDot.info
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-3 whitespace-pre-wrap">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(n);
                      }}
                      className="shrink-0 self-start p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
