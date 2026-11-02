import type { ReactNode } from "react";
import "@silicon/website-seo-engine/dashboard.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body></html>;
}
