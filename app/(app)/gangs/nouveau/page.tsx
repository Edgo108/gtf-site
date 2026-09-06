import { GangForm } from "@/components/gangs/GangForm";

export default function NouveauGangPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Nouvelle fiche gang
      </h1>
      <div className="mt-6">
        <GangForm />
      </div>
    </div>
  );
}
