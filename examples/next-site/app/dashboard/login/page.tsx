import { Suspense } from "react";
import { loginAction } from "../actions";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <Suspense fallback={<p>Loading sign in…</p>}><LoginForm searchParams={searchParams} /></Suspense>;
}
async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="silicon-cms" style={{ maxWidth: 440 }}>
    <h1>Sign in</h1>
    {error && <p role="alert">Email or password was not accepted.</p>}
    <form action={loginAction} className="silicon-cms__panel">
      <label className="silicon-cms__field">Email<input type="email" name="email" required /></label>
      <label className="silicon-cms__field">Password<input type="password" name="password" required /></label>
      <button type="submit">Sign in</button>
    </form>
  </main>;
}
