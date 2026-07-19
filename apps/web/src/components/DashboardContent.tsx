import { DateDisplay } from './DateDisplay';
import { PanelCard } from './PanelCard';
import { StatCard } from './StatCard';

type ActivityItem = {
  title: string;
  meta: string;
};

type DashboardContentProps = {
  dashboardState?: 'loading' | 'ready' | 'empty' | 'error';
  viewMode?: 'gregorian' | 'hebrew' | 'both';
};

const activityItems: ActivityItem[] = [
  { title: 'אושר מסמך חדש', meta: '08:30 · צוות כספים' },
  { title: 'נוצרה משימה חדשה', meta: '10:15 · פרויקטים' },
  { title: 'הועלה דוח שוטף', meta: '11:40 · דוחות' },
];

const tasks = ['בדיקת הזמנות', 'אישור תשלום', 'סקירת תוכן'];
const upcomingEvents = ['פגישה עם ספקים · 14:00', 'הדרכת צוות · 16:30', 'סקר ארגוני · 18:00'];

export function DashboardContent({
  dashboardState = 'ready',
  viewMode = 'both',
}: DashboardContentProps) {
  if (dashboardState === 'loading') {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map(index => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (dashboardState === 'empty') {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 p-10 text-center text-slate-600">
        <p className="text-lg font-semibold text-slate-900">אין נתונים להצגה כרגע</p>
        <p className="mt-2 text-sm">הדשבורד יופיע כאן לאחר הוספת תוכן במצב הפיתוח.</p>
      </div>
    );
  }

  if (dashboardState === 'error') {
    return (
      <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
        <p className="text-lg font-semibold">אירעה שגיאה בטעינת התצוגה</p>
        <p className="mt-2 text-sm">המצב הזה מיועד לבדיקה עיצובית בלבד.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="הכנסות החודש"
          value="₪ 184,320"
          meta="+12.4% מול חודש שעבר"
          accent="cyan"
        />
        <StatCard title="משימות פתוחות" value="24" meta="6 דורשות התערבות" accent="emerald" />
        <StatCard title="מסמכים שממתינים לאישור" value="11" meta="2 בתוך 24 שעות" accent="amber" />
        <StatCard title="אירועים קרובים" value="8" meta="3 עם נוכחות חובה" accent="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PanelCard title="מבט כללי על הפעילות" subtitle="הכנסות מול הוצאות לחודש הנוכחי">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">הכנסות</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">₪ 184,320</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">הוצאות</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">₪ 96,540</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-6 gap-2">
              {[40, 58, 62, 78, 60, 90].map((height, index) => (
                <div key={height} className="flex items-end">
                  <div
                    className={`w-full rounded-t-xl ${index % 2 === 0 ? 'bg-cyan-500' : 'bg-slate-300'}`}
                    style={{ height: `${height}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </PanelCard>

        <PanelCard title="תצוגת תאריך" subtitle="לועזי ועברי למעקב ארגוני">
          <DateDisplay viewMode={viewMode} />
        </PanelCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_0.75fr_0.9fr]">
        <PanelCard title="משימות פתוחות" subtitle="רשימת עבודה עדכנית">
          <ul className="space-y-3">
            {tasks.map(task => (
              <li
                key={task}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
              >
                <span>{task}</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">
                  בתהליך
                </span>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard title="אירועים קרובים" subtitle="זמנים מרכזיים">
          <ul className="space-y-3">
            {upcomingEvents.map(event => (
              <li
                key={event}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
              >
                {event}
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard title="פעילות אחרונה" subtitle="עדכונים במערכת">
          <ul className="space-y-3">
            {activityItems.map(item => (
              <li
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>

      <PanelCard title="סיוע בינה מלאכותית" subtitle="שאל את Nera כל שאלה על הארגון">
        <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-4">
          <p className="text-sm text-slate-600">
            המסייע הדיגיטלי יספק המלצות, סיכומים ותשובות עתידיות על בסיס הרשאות ואירועים.
          </p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              className="flex-1 rounded-2xl border border-cyan-200 bg-white px-4 py-3 outline-none"
              placeholder="שאל את Nera כל שאלה על הארגון"
            />
            <button className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white">
              שלח
            </button>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
