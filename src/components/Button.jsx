import { cn } from '../lib/utils.js';

export function Button({ children, variant = "primary", size = "md", className = "", onClick }) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-white/20",
    gold: "bg-gradient-to-r from-gold-400 to-gold-300 text-zinc-900 hover:shadow-gold/40",
    outline: "border border-zinc-300 text-zinc-300 hover:bg-zinc-900",
    danger: "bg-destructive text-destructive-foreground",
  };

  const sizes = {
    sm: "py-1.5 px-3 text-sm",
    md: "py-2 px-4 text-base",
    lg: "py-3 px-6 text-lg",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}