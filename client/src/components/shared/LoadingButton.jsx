import { Loader2 } from 'lucide-react';

export default function LoadingButton({
  children,
  loading,
  disabled,
  onClick,
  type = 'button',
  className = '',
  variant = 'primary',
}) {
  const base =
    'ht-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none';
  const variants = {
    primary: 'ht-btn-primary',
    secondary: 'ht-btn bg-slate-100 text-slate-700 hover:bg-slate-200',
    outline: 'ht-btn ht-btn-outline',
    danger: 'ht-btn ht-btn-danger',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
