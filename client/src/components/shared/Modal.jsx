import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative bg-white shadow-xl overflow-y-auto overscroll-contain
          w-full max-h-[92dvh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl
          ${wide ? 'sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl' : 'sm:max-w-lg xl:max-w-xl'}`}
      >
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b">
          <h2 className="text-base sm:text-lg xl:text-xl font-semibold text-gray-900 pr-2 min-w-0 truncate">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 sm:p-6 xl:p-8">{children}</div>
      </div>
    </div>
  );
}
