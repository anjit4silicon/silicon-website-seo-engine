"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readEditorForm } from "@silicon/website-seo-engine/dashboard";
import { auth, cms } from "../../lib/cms";

export async function loginAction(data: FormData) {
  const ok = await auth.login(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
  redirect(ok ? "/dashboard" : "/dashboard/login?error=1");
}

export async function saveAction(data: FormData) {
  const id = String(data.get("pageId") ?? "");
  const page = cms.site.pages.find((entry) => entry.id === id);
  if (!page) throw new Error("Unknown page.");
  await cms.saveDraft(id, Number(data.get("revision")), readEditorForm(page, data));
  revalidatePath(`/dashboard/pages/${id}`);
  redirect(`/dashboard/pages/${id}`);
}

export async function publishAction(data: FormData) {
  const id = String(data.get("pageId") ?? "");
  await cms.publish(id, Number(data.get("revision")));
  revalidatePath(`/dashboard/pages/${id}`);
  redirect(`/dashboard/pages/${id}`);
}

export async function logoutAction() {
  await auth.logout();
  redirect("/dashboard/login");
}
