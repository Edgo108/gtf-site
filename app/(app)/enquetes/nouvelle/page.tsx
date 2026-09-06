import { InvestigationForm } from "@/components/investigations/InvestigationForm";

export default function NouvelleEnquetePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouvelle enquête
      </h1>
      <div className="mt-6">
        <InvestigationForm />
      </div>
    </div>
  );
}
