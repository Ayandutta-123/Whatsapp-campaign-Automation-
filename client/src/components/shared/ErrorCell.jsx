import { useState } from 'react';

/** Full error text with expand/collapse — never hide delivery failure reasons. */
export default function ErrorCell({ message, maxWidthClass = 'max-w-[280px]' }) {
  const [expanded, setExpanded] = useState(false);
  if (!message) {
    return <span className="text-gray-400">-</span>;
  }

  const long = message.length > 80;

  return (
    <div className={`${maxWidthClass}`}>
      <p
        className={`text-red-600 text-xs whitespace-pre-wrap break-words ${
          expanded || !long ? '' : 'line-clamp-2'
        }`}
        title={message}
      >
        {message}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-accent mt-0.5 hover:underline"
        >
          {expanded ? 'Show less' : 'Show full reason'}
        </button>
      )}
    </div>
  );
}
