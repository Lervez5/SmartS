
import { Trophy, Star, Target, Zap, Award } from "lucide-react";

const badgeData = [
    { name: 'Early Bird', Icon: Zap, color: 'text-blue-500', bg: 'bg-blue-100', status: 'Unlocked' },
    { name: 'Math Genius', Icon: Target, color: 'text-purple-500', bg: 'bg-purple-100', status: 'Unlocked' },
    { name: 'Science Wiz', Icon: Star, color: 'text-amber-500', bg: 'bg-amber-100', status: 'In Progress' },
    { name: 'Reading Star', Icon: Award, color: 'text-emerald-500', bg: 'bg-emerald-100', status: 'Locked' },
    { name: 'Daily Streak', Icon: Trophy, color: 'text-rose-500', bg: 'bg-rose-100', status: 'Unlocked' },
];

export default function BadgesPage() {
    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                    My Achievements
                </h1>
                <p className="text-muted-foreground mt-1">You're doing great! Keep learning to unlock more rewards.</p>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {badgeData.map((badge, idx) => (
                    <div key={idx} className={`glass rounded-[2rem] p-8 flex flex-col items-center text-center transition-all ${badge.status === 'Locked' ? 'opacity-40 grayscale' : 'hover:scale-105'}`}>
                        <div className={`w-20 h-20 rounded-3xl ${badge.bg} flex items-center justify-center mb-4 shadow-inner`}>
                            <badge.Icon className={`w-10 h-10 ${badge.color}`} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white">{badge.name}</h3>
                        <p className={`text-[10px] font-bold mt-2 px-3 py-1 rounded-full uppercase tracking-widest ${badge.status === 'Unlocked' ? 'bg-green-100 text-green-700' :
                            badge.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
                            }`}>
                            {badge.status}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
