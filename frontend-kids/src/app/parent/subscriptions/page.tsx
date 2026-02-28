export const dynamic = "force-dynamic";

import { CreditCard, Check, Sparkles, AlertCircle } from "lucide-react";

export default function SubscriptionsPage() {
    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-blue-500" />
                    Subscription Management
                </h1>
                <p className="text-muted-foreground mt-1">Manage your children's learning plans and billing.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Active Plan */}
                <div className="glass rounded-[2.5rem] p-8 border-2 border-primary/20 relative overflow-hidden">
                    <div className="absolute top-6 right-6">
                        <span className="px-4 py-1 bg-primary text-white text-xs font-bold rounded-full shadow-lg">ACTIVE</span>
                    </div>

                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Current Plan</h3>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-6">Premium Family</h2>

                    <ul className="space-y-4 mb-8">
                        {['Unlimited Lessons', 'Up to 3 Children', 'Detailed Progress Reports', 'Priority AI Support'].map(f => (
                            <li key={f} className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <div className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                </div>
                                {f}
                            </li>
                        ))}
                    </ul>

                    <div className="flex items-center justify-between pt-6 border-t border-white/20">
                        <div>
                            <p className="text-xs text-muted-foreground font-bold">Renewal Date</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">March 26, 2026</p>
                        </div>
                        <button className="text-sm font-bold text-primary hover:underline">Manage Billing</button>
                    </div>
                </div>

                {/* Upgrade Options */}
                <div className="glass rounded-[2.5rem] p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl">
                    <div className="flex items-center gap-2 text-amber-400 mb-4 animate-bounce">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest text-amber-400">Limited Offer</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Go Annual & Save 40%</h2>
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">Lock in the best price for your children's future. Get access to exclusive workshops and physical workbooks.</p>

                    <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-xl">
                        Switch to Yearly
                    </button>
                </div>
            </div>

            {/* Support Box */}
            <div className="glass rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-amber-200 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10">
                <div className="flex items-center gap-4 text-center md:text-left">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Need help with your subscription?</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Our team is available 24/7 to assist you with any billing questions.</p>
                    </div>
                </div>
                <button className="px-6 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shrink-0">
                    Contact Support
                </button>
            </div>
        </div>
    );
}
