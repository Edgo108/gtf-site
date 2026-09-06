import { WantedForm } from "@/components/wanted/WantedForm";

export default function NouveauMandatPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouveau mandat de recherche
      </h1>
      <div className="mt-6">
        <WantedForm />
      </div>
    </div>
  );
}
