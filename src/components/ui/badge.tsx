import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const VARIANT_CLASSES: Record<string, string> = {
  default:     'bg-indigo-600/20 text-indigo-300 border-indigo-600/40',
  secondary:   'bg-slate-600/30 text-slate-300 border-slate-600/50',
  destructive: 'bg-red-700/20 text-red-400 border-red-700/40',
  outline:     'bg-transparent text-slate-400 border-slate-600',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES['default'],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
