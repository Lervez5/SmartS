import Link from "next/link";

const mockBadges = [
  { id: 1, name: "Math Explorer", description: "Completed 5 math quests" },
  { id: 2, name: "Reading Star", description: "Read 3 stories this week" }
];

const mockProgress = [
  { subject: "Math", percent: 72 },
  { subject: "Reading", percent: 64 },
  { subject: "Science", percent: 48 }
];

export function StudentDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-light to-white dark:from-slate-900 dark:to-slate-950 transition-colors px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-dark dark:text-brand">Hi, Sprout!</h1>
            <p className="text-slate-700 dark:text-slate-300">Here&apos;s your learning garden for today.</p>
          </div>
          <Link
            href="/"
            className="rounded-full bg-white dark:bg-slate-900 text-brand px-4 py-2 text-sm font-semibold shadow"
          >
            Back home
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900/50 dark:border dark:border-slate-800 p-4 shadow">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Today&apos;s Quest</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Finish 2 math puzzles and read one story to earn the &quot;Morning Hero&quot; badge.
            </p>
            <button className="mt-4 w-full rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow hover:bg-brand-dark">
              Start quest
            </button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900/50 dark:border dark:border-slate-800 p-4 shadow md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Progress</h2>
            <div className="mt-3 space-y-3">
              {mockProgress.map((item) => (
                <div key={item.subject}>
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>{item.subject}</span>
                    <span>{item.percent}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white dark:bg-slate-900/50 dark:border dark:border-slate-800 p-4 shadow">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Badges</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {mockBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col rounded-xl border border-brand/30 bg-brand-light/30 dark:bg-brand-dark/30 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-brand-dark dark:text-brand">{badge.name}</span>
                <span className="text-slate-700 dark:text-slate-300">{badge.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 p-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Offline mode will let you keep learning even without internet. This is a placeholder for
          future offline features.
        </section>
      </div>
    </main>
  );
}


