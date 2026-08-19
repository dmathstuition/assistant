import {
  SparklesIcon,
  WalletIcon,
  IncomeIcon,
  ChecklistIcon,
  BellIcon,
  PieIcon,
  TargetIcon,
  RepeatIcon,
} from "@/components/icons";

export const dynamic = "force-static";

type Section = {
  Icon: (p: { className?: string }) => React.ReactNode;
  title: string;
  blurb: string;
  examples: string[];
};

const SECTIONS: Section[] = [
  {
    Icon: WalletIcon,
    title: "Log an expense",
    blurb: "State what you spent and on what. It never invents an amount.",
    examples: ["I spent 8,500 on transport", "₦4,500 lunch", "Paid 20k for data"],
  },
  {
    Icon: IncomeIcon,
    title: "Log income",
    blurb: "Say what you earned and where it came from.",
    examples: ["I earned 250,000 from teaching", "Got ₦15,000 gift"],
  },
  {
    Icon: ChecklistIcon,
    title: "Add a task (with a time)",
    blurb: "Include a day and time and you'll get an alarm and a 10-minute warning.",
    examples: [
      "Task: mark Year 5 assignments tomorrow 4pm",
      "Remind me to call the printer on Friday 9am",
    ],
  },
  {
    Icon: BellIcon,
    title: "Set a reminder",
    blurb: "Reminders are emailed and pushed to your phone on the day.",
    examples: ["Remind me to review my budget on Monday", "Reminder: pay rent on the 1st"],
  },
  {
    Icon: PieIcon,
    title: "Ask about your money",
    blurb:
      "Ask for real figures over any period: today, this/last week, this/last month.",
    examples: [
      "How much did I spend on food this month?",
      "How much did I earn last month?",
      "What did I spend this week?",
    ],
  },
  {
    Icon: TargetIcon,
    title: "Check a budget",
    blurb: "See how you're tracking against a category budget.",
    examples: ["How am I doing on my food budget?", "Am I over on transport?"],
  },
  {
    Icon: RepeatIcon,
    title: "Create budgets & goals by voice",
    blurb: "Set a monthly limit or a savings target in one line.",
    examples: ["Set a 50,000 budget for food", "Save 200,000 for a laptop"],
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <SparklesIcon className="text-xl text-brand-accent" />
        <h1 className="text-xl font-semibold">How to use your assistant</h1>
      </div>

      <div className="card p-5">
        <p className="text-sm text-brand-muted">
          Type into <b className="text-white">Ask your assistant</b> on the
          dashboard, or tap the 🎤 mic and speak. Write the way you&apos;d text a
          friend — the assistant reads your sentence and proposes an action.
          Anything that <b className="text-white">saves</b> money, a task, a budget
          or a goal shows a preview first, so nothing is stored until you tap{" "}
          <b className="text-white">Save</b>. It will never make up a number.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ Icon, title, blurb, examples }) => (
          <div key={title} className="card p-5">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <span className="text-brand-accent">
                <Icon className="text-lg" />
              </span>
              {title}
            </div>
            <p className="mb-3 text-sm text-brand-muted">{blurb}</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <span
                  key={ex}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-brand-muted"
                >
                  &ldquo;{ex}&rdquo;
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="mb-2 font-semibold">Tips</div>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-brand-muted">
          <li>
            Amounts: <b className="text-white">8,500</b>, <b className="text-white">₦8,500</b>,
            and <b className="text-white">8.5k</b> all work.
          </li>
          <li>Say a category (food, transport, rent) and it files it correctly.</li>
          <li>
            For alarms, give a task a <b className="text-white">time</b> — you&apos;ll
            get a beep and pop-up at the time, plus 10 minutes before.
          </li>
          <li>
            Turn on <b className="text-white">Push notifications</b> (dashboard) so
            reminders reach your phone even when the app is closed.
          </li>
          <li>
            Browse and edit anything later on <b className="text-white">History</b>;
            plan ahead on <b className="text-white">Planner</b>.
          </li>
        </ul>
      </div>
    </div>
  );
}
