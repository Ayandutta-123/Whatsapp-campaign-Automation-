export default function EmptyState({ icon: Icon, title, message, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon size={32} className="text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-center mb-6 max-w-sm">{message}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="ht-btn ht-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
