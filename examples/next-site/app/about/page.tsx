import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cms } from "../../lib/cms";

export async function generateMetadata() { return cms.metadata("about"); }

export default function AboutPage() {
  return <Suspense fallback={<p>Loading page…</p>}><AboutContent /></Suspense>;
}

async function AboutContent() {
  const content = await cms.published("about");
  if (!content) notFound();
  return <main style={{ maxWidth: 760, margin: "80px auto", padding: 24 }}>
    <nav><a href="/dashboard">CMS dashboard</a></nav>
    <h1>{String(content.title)}</h1>
    <p>{String(content.introduction)}</p>
  </main>;
}
