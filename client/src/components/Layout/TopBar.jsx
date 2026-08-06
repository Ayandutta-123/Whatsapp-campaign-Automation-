export default function TopBar({ title, children }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 xl:mb-8 pr-12 lg:pr-14">
      <h1 className="font-display text-xl sm:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-gray-900 tracking-tight min-w-0 break-words">
        {title}
      </h1>
      {children && (
        <div className="flex flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {children}
        </div>
      )}
    </div>
  );
}
