import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DashboardEditor } from "@silicon/website-seo-engine/dashboard";
import { auth, cms } from "../../../../lib/cms";
import { saveAction, publishAction, logoutAction } from "../../actions";

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p>Loading editor…</p>}><Editor params={params} /></Suspense>;
}
async function Editor({ params }: { params: Promise<{ id: string }> }) {
  if (!await auth.authorize()) redirect("/dashboard/login");
  const { id } = await params;
  const page = cms.site.pages.find((entry) => entry.id === id);
  if (!page) notFound();
  const record = await cms.draft(id);
  if (!record) notFound();
  return <><DashboardEditor site={cms.site} page={page} record={record}
    saveAction={saveAction} publishAction={publishAction}
    previewHref={`/dashboard/preview/${id}`} />
    <form action={logoutAction} style={{ maxWidth: 1200, margin: "auto", padding: "0 32px" }}><button type="submit">Sign out</button></form>
  </>;
}
