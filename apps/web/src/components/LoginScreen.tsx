'use client';

import { useState } from 'react';

type LoginScreenProps = {
  onLogin: (email: string, password: string) => { success: boolean; message: string };
  onDemoLogin?: () => void;
  demoModeEnabled: boolean;
};

export function LoginScreen({ onLogin, onDemoLogin, demoModeEnabled }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    const result = onLogin(email, password);
    setMessage(result.message);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#111827_45%,_#030712)] px-4 py-8 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-6 rounded-[36px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
          <div className="flex flex-col justify-between rounded-[28px] border border-cyan-400/20 bg-slate-950/70 p-6">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-500 text-2xl font-semibold text-white">
                N
              </div>
              <h1 className="mt-6 text-3xl font-semibold">כניסה למערכת</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                ברוכים הבאים ל-Nera. התחברו לממשק הפלטפורמה, בחרו ארגון והתחילו את העבודה.
              </p>
            </div>
            <div className="mt-8 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <p className="font-semibold">מצב ההגנה</p>
              <p className="mt-2 leading-7">
                ההתחברות מיועדת לממשק מאובטח עם סשן שרת-סייד וארכיטקטורת הרשאות עתידית.
              </p>
            </div>
          </div>

          <form
            className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6"
            onSubmit={handleSubmit}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">התחברות</h2>
              {demoModeEnabled ? (
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-200">
                  מצב הדגמה
                </span>
              ) : null}
            </div>

            <label className="mt-6 block text-sm font-medium text-slate-200" htmlFor="email">
              דוא&apos;ל
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none ring-0 focus:border-cyan-400"
              placeholder="name@company.com"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />

            <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="password">
              סיסמה
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800 px-4 py-3">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="w-full bg-transparent text-sm text-white outline-none"
                placeholder="הקלידו סיסמה"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="text-sm text-cyan-300"
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? 'הסתר' : 'הצג'}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe(value => !value)}
                />
                <span>זכור אותי</span>
              </label>
              <a href="#" className="text-cyan-300 underline-offset-4 hover:underline">
                שכחתי סיסמה
              </a>
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'מתחבר...' : 'התחברות'}
            </button>

            {demoModeEnabled && onDemoLogin ? (
              <button
                type="button"
                onClick={onDemoLogin}
                className="mt-3 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200"
              >
                כניסה למצב הדגמה
              </button>
            ) : null}

            {message ? <p className="mt-4 text-sm text-amber-200">{message}</p> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
