import Image from "next/image";

export function WantedPhoto({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-gtf-panel-alt ${className}`}
      >
        <div className="flex flex-col items-center gap-2 px-2 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-8 w-8 text-gtf-text-muted/60"
            aria-hidden="true"
          >
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z" />
          </svg>
          <p className="font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted">
            Photo non disponible
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-gtf-panel-alt ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 50vw, 300px"
        className="object-cover"
      />
    </div>
  );
}
