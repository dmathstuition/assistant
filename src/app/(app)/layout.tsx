import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import AppLock from "@/components/AppLock";
import InstallButton from "@/components/InstallButton";
import { WalletIcon, ChecklistIcon, ListIcon } from "@/components/icons";

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
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgba(8,14,26,0.6)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="btn-accent flex h-8 w-8 items-center justify-center rounded-xl text-lg text-white">
                <WalletIcon />
              </span>
              <span className="font-bold">
                D-Maths <span className="text-brand-accent">Assistant</span>
              </span>
            </Link>

            <nav className="ml-auto hidden items-center gap-1 sm:flex">
              <NavLink href="/dashboard" label="Dashboard">
                <ChecklistIcon />
              </NavLink>
              <NavLink href="/history" label="History">
                <ListIcon />
              </NavLink>
            </nav>

            <div className="flex items-center gap-2">
              <InstallButton />
              <span className="hidden text-sm text-brand-muted md:inline">
                {user.email}
              </span>
              <SignOutButton />
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="flex items-center gap-1 border-t border-white/5 px-4 py-1.5 sm:hidden">
            <NavLink href="/dashboard" label="Dashboard">
              <ChecklistIcon />
            </NavLink>
            <NavLink href="/history" label="History">
              <ListIcon />
            </NavLink>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </AppLock>
  );
}

function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-brand-muted transition hover:bg-white/5 hover:text-white"
    >
      <span className="text-base">{children}</span>
      {label}
    </Link>
  );
}
