// app/page.tsx
// Route groups like (auth) and (dashboard) don't create a page at "/"
// itself — without this file, visiting the bare domain 404s even though
// /login and /dashboard both work fine. This just forwards to /dashboard;
// middleware.ts then redirects to /login automatically if not signed in.
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
