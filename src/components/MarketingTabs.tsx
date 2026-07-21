import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Marketing Leads', href: '/admin/marketing' },
  { label: 'Content Generation', href: '/admin/marketing/content' },
];

export default function MarketingTabs() {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
      {tabs.map((t) => (
        <NavLink
          key={t.href}
          to={t.href}
          end
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
