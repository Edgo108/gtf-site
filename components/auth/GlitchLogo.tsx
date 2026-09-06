import Image from "next/image";

// Logo en filigrane, en arrière-plan de la page de connexion.
// L'effet de glitch (découpe en tranches + léger décalage horizontal)
// est entièrement géré en CSS pur — voir app/globals.css.
export function GlitchLogo() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="gtf-glitch-logo relative h-[55vmin] w-[55vmin] max-h-[480px] max-w-[480px]">
        <Image
          src="/logo-gtf.png"
          alt=""
          fill
          priority
          sizes="480px"
          className="gtf-glitch-slice-top object-contain grayscale opacity-[0.08]"
        />
      </div>
    </div>
  );
}
