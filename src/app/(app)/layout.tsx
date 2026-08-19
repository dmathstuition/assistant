import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import AppLock from "@/components/AppLock";
import InstallButton from "@/components/InstallButton";
import TaskAlarms from "@/components/TaskAlarms";
import {
  WalletIcon,
  ChecklistIcon,
  ListIcon,
  CalendarIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Home", Icon: ChecklistIcon },
  { href: "/planner", label: "Planner", Icon: CalendarIcon },
  { href: "/analytics", label: "Stats", Icon: TrendingUpIcon },
  { href: "/history", label: "History", Icon: ListIcon },
  { href: "/guide", label: "Guide", Icon: SparklesIcon },
];

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
      <div className="min-h-screen pb-20 sm:pb-0">
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

            <nav className="ml-auto hidden items-center gap-1 md:flex">
              {NAV.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-brand-muted transition hover:bg-white/5 hover:text-white"
                >
                  <Icon className="text-base" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <InstallButton />
              <span className="hidden text-sm text-brand-muted lg:inline">
                {user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

        {/* App-like bottom tab bar on phones. */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-[rgba(8,14,26,0.85)] backdrop-blur-xl md:hidden">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-brand-muted transition hover:text-white"
            >
              <Icon className="text-lg" />
              {label}
            </Link>
          ))}
        </nav>

        <TaskAlarms />
      </div>
    </AppLock>
  );
}
