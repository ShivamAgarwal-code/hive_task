import { ImportWizard } from "@/components/ImportWizard";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Import a Spectora template</h1>
        <p className="mt-2 text-stone-600">
          Upload the spreadsheet you exported from Spectora. Before anything is saved, you will see
          exactly what came through and anything that was set aside, so you can trust that your years
          of tuning made it across.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
