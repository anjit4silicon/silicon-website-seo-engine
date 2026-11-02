import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth, cms } from "../../../../lib/cms";

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p>Loading preview…</p>}><Preview params={params} /></Suspense>;
}
async function Preview({ params }: { params: Promise<{ id: string }> }) {
  if (!await auth.authorize()) redirect("/dashboard/login");
  const { id } = await params;
  const record = await cms.draft(id);
  if (!record) notFound();
  return <main style={{ maxWidth: 760, margin: "80px auto", padding: 24 }}>
    <p>Draft preview · revision {record.revision} · <a href={`/dashboard/pages/${id}`}>Back to editor</a></p>
    <h1>{String(record.draft.title)}</h1>
    <p>{String(record.draft.introduction)}</p>
  </main>;
}
