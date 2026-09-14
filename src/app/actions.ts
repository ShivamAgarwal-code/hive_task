"use server";

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/storage";
import { parseUpload } from "@/lib/spectora/importService";
import type { ParseResult } from "@/lib/spectora/importTypes";
import type { Template } from "@/lib/types";
import type { CommentPatch } from "@/lib/storage/types";

// ---------------------------------------------------------------------------
// Server actions: the single mutation surface for the app. Client components
// call these directly. All DB access is server-side through the storage driver.
// ---------------------------------------------------------------------------

export async function parseUploadAction(formData: FormData): Promise<ParseResult> {
  const file = formData.get("file");
  const templateName = String(formData.get("templateName") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim() || null;

  if (!(file instanceof File)) {
    throw new Error("No file was uploaded.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = templateName || file.name.replace(/\.[^.]+$/, "") || "Imported template";
  return parseUpload({ buffer, filename: file.name, templateName: name, source });
}

export async function commitImportAction(template: Template): Promise<{ id: string }> {
  const repo = getRepo();
  const inserted = await repo.insertTemplate(template);
  revalidatePath("/");
  return { id: inserted.id };
}

export async function copyTemplateAction(id: string, newName: string): Promise<{ id: string }> {
  const repo = getRepo();
  const copy = await repo.copyTemplate(id, newName);
  revalidatePath("/");
  return { id: copy.id };
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await getRepo().deleteTemplate(id);
  revalidatePath("/");
}

export async function updateTemplateAction(
  id: string,
  patch: { name?: string; source?: string | null },
): Promise<void> {
  await getRepo().updateTemplate(id, patch);
  revalidatePath(`/templates/${id}`);
  revalidatePath("/");
}

export async function renameSectionAction(templateId: string, id: string, name: string): Promise<void> {
  await getRepo().updateSection(id, { name });
  revalidatePath(`/templates/${templateId}`);
}

export async function renameItemAction(templateId: string, id: string, name: string): Promise<void> {
  await getRepo().updateItem(id, { name });
  revalidatePath(`/templates/${templateId}`);
}

export async function updateCommentAction(
  templateId: string,
  id: string,
  patch: CommentPatch,
): Promise<void> {
  await getRepo().updateComment(id, patch);
  revalidatePath(`/templates/${templateId}`);
}

export async function addSectionAction(templateId: string, name: string) {
  const s = await getRepo().addSection(templateId, name);
  revalidatePath(`/templates/${templateId}`);
  return s;
}

export async function addItemAction(templateId: string, sectionId: string, name: string) {
  const i = await getRepo().addItem(sectionId, name);
  revalidatePath(`/templates/${templateId}`);
  return i;
}

export async function addCommentAction(templateId: string, itemId: string, name: string) {
  const c = await getRepo().addComment(itemId, name);
  revalidatePath(`/templates/${templateId}`);
  return c;
}

export async function deleteSectionAction(templateId: string, id: string): Promise<void> {
  await getRepo().deleteSection(id);
  revalidatePath(`/templates/${templateId}`);
}

export async function deleteItemAction(templateId: string, id: string): Promise<void> {
  await getRepo().deleteItem(id);
  revalidatePath(`/templates/${templateId}`);
}

export async function deleteCommentAction(templateId: string, id: string): Promise<void> {
  await getRepo().deleteComment(id);
  revalidatePath(`/templates/${templateId}`);
}
