type NavItem = {
  label: string;
  active?: boolean;
};

const items: NavItem[] = [
  { label: 'לוח בקרה', active: true },
  { label: 'לקוחות' },
  { label: 'מכירות' },
  { label: 'רכש' },
  { label: 'מלאי' },
  { label: 'כספים' },
  { label: 'משאבי אנוש' },
  { label: 'פרויקטים' },
  { label: 'אירועים' },
  { label: 'מסמכים' },
  { label: 'דוחות' },
  { label: 'הגדרות מערכת' },
];

const quickActions = ['הוספת לקוח', 'יצירת משימה', 'יצירת אירוע', 'העלאת מסמך'];

export function SidebarNav() {
  return (
    <aside className="w-full rounded-3xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm lg:w-72">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">ארגונים</p>
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">ארגון ראשי</div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">מוסד ירושלים</div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">סניף בני ברק</div>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {items.map(item => (
          <button
            key={item.label}
            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-right text-sm transition ${item.active ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200'}`}
          >
            <span>{item.label}</span>
            {item.active ? <span className="text-xs">●</span> : null}
          </button>
        ))}
      </nav>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">פעולות מהירות</p>
        <div className="mt-3 space-y-2">
          {quickActions.map(action => (
            <div key={action} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {action}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
