import { createClient } from "@/lib/supabase/server";
import RemindersManager, {
  type ReminderItem,
  type RuleItem,
} from "@/components/RemindersManager";
import { BellIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const supabase = await createClient();

  const [{ data: reminders }, { data: rules }] = await Promise.all([
    supabase
      .from("reminders")
      .select("id,title,remind_at,recurring")
      .eq("is_done", false)
      .order("remind_at", { ascending: true })
      .limit(50),
    supabase
      .from("alert_rules")
      .select("id,type,category,time_window,threshold")
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);

  const ruleRows = ((rules as RuleItem[]) ?? []).map((r) => ({
    ...r,
    threshold: Number(r.threshold),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BellIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">Reminders &amp; alerts</h1>
      </div>
      <RemindersManager
        reminders={(reminders as ReminderItem[]) ?? []}
        rules={ruleRows}
      />
    </div>
  );
}
