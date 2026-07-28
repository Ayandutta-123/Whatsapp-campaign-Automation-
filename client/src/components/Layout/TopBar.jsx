export default function TopBar({ title, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">{children}</div>
      )}
    </div>
  );
}
