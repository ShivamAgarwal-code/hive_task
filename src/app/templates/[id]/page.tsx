import { notFound } from "next/navigation";
import { getRepo } from "@/lib/storage";
import { TemplateEditor } from "@/components/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getRepo().getTemplate(id);
  if (!template) notFound();
  return <TemplateEditor initial={template} />;
}
