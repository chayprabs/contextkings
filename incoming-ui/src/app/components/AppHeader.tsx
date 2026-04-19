interface AppHeaderProps {
  children?: React.ReactNode;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  hideTitle?: boolean;
}

export function AppHeader({ children, leftContent, rightContent, hideTitle }: AppHeaderProps) {
  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-5 bg-background/80 backdrop-blur-xl relative z-50">
      <div className="flex items-center gap-3 min-w-0">
        {leftContent || <div className="w-px" />}
      </div>

      {!hideTitle && (
        <div className="absolute left-1/2 -translate-x-1/2">
          <span
            className="text-foreground tracking-tight"
            style={{ fontFamily: "'Geist', sans-serif", fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.03em' }}
          >
            ContextKings
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 min-w-0">
        {rightContent || <div className="w-px" />}
      </div>

      {children}
    </div>
  );
}