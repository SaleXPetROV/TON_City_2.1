/**
 * PageHeader component - renders title with space for mobile burger menu
 * The burger button itself is in MobileNav (fixed position)
 * Usage: <PageHeader icon={<Building2 />} title="МОИ БИЗНЕСЫ" rightContent={...} actionButtons={...} />
 * - rightContent: Full action buttons (shown on desktop, stacked on mobile)
 * - actionButtons: Always shown in right corner (refresh, filter icons)
 */
export default function PageHeader({ icon, title, rightContent, actionButtons, subtitle, className = '' }) {
  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Space for burger button on mobile (44px ~ w-10 + left-3 + gap) */}
          <div className="lg:hidden w-11 flex-shrink-0" />
          <h1 className="text-base sm:text-lg lg:text-2xl font-bold text-white flex items-center gap-2 font-unbounded uppercase tracking-tight truncate">
            {icon}
            <span className="truncate">{title}</span>
          </h1>
        </div>
        {/* Action buttons always in right corner */}
        {actionButtons && <div className="flex items-center gap-1.5 flex-shrink-0">{actionButtons}</div>}
        {/* Full rightContent only on desktop */}
        {rightContent && !actionButtons && <div className="hidden sm:flex items-center gap-2 flex-shrink-0">{rightContent}</div>}
      </div>
      {subtitle && <p className="text-text-muted text-xs sm:text-sm mt-1 ml-12 lg:ml-0">{subtitle}</p>}
      {/* Full rightContent below title on mobile */}
      {rightContent && <div className="sm:hidden mt-2 ml-12">{rightContent}</div>}
    </div>
  );
}
