'use client';

export function DrAttribution() {
  return (
    <p className="text-xs text-zinc-300">
      Domain Rating by{' '}
      <a
        href="https://ahrefs.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-white"
        onClick={(event) => event.stopPropagation()}
      >
        Ahrefs
      </a>
    </p>
  );
}
