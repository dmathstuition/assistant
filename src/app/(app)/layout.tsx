import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import AppLock from "@/components/AppLock";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppLock>
      <div className="min-h-screen">
        <header className="border-b border-brand-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="font-bold">
            D-Maths <span className="text-brand-accent">Assistant</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-brand-muted sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </AppLock>
  );
}
