import { useState } from 'react';
import { formatUserFacingError } from '../../lib/formatError';

/** Full error text with expand/collapse — plain language + error code. */
export default function ErrorCell({ message, maxWidthClass = 'max-w-[280px]' }) {
  const [expanded, setExpanded] = useState(false);
  if (!message) {
    return <span className="text-gray-400">-</span>;
  }

  const display = formatUserFacingError(message);
  const long = display.length > 80 || display.includes('\n');

  return (
    <div className={`${maxWidthClass}`}>
      <p
        className={`text-red-600 text-xs whitespace-pre-wrap break-words ${
          expanded || !long ? '' : 'line-clamp-3'
        }`}
        title={display}
      >
        {display}
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
