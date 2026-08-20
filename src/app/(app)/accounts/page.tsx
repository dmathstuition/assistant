import { createClient } from "@/lib/supabase/server";
import BankConnect from "@/components/BankConnect";
import { WalletIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("linked_accounts")
    .select("id,institution,account_name,mask,last_synced_at")
    .order("created_at", { ascending: false });

  const accounts = data ?? [];
  const configured = Boolean(process.env.MONO_SECRET_KEY);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <WalletIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Linked accounts</h1>
      </div>

      <div className="card p-5">
        <p className="mb-4 text-sm text-brand-muted">
          Connect your bank (via Mono) to import your spending automatically. Your
          bank login is handled by Mono&apos;s secure widget — this app never sees
          your bank password. Imported transactions appear as expenses, tagged as
          bank and auto-categorised.
        </p>

        {!configured && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            Bank linking isn&apos;t switched on yet. Add your Mono keys
            (MONO_SECRET_KEY, NEXT_PUBLIC_MONO_PUBLIC_KEY, MONO_WEBHOOK_SECRET) in
            Vercel to enable it. See docs/BANK-LINKING.md.
          </p>
        )}

        <BankConnect accounts={accounts} />
      </div>
    </div>
  );
}
