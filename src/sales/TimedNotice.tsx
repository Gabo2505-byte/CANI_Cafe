import { useEffect, useState } from 'react';

export const NOTICE_DURATION_MS = 5000;

/** Confirmación en franja verde que desaparece sola a los 5 segundos. */
export function TimedNotice({ message, durationMs = NOTICE_DURATION_MS }: { message: string | null; durationMs?: number }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  if (!message || !visible) return null;
  return (
    <p className="notice-success" role="status">
      {message}
    </p>
  );
}
