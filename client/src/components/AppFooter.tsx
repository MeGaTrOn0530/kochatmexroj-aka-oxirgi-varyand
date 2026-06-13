import { Leaf } from "lucide-react";

export default function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t border-border/50 bg-background/80 px-4 py-2 ${className}`}>
      <div className="mx-auto flex max-w-screen-2xl flex-nowrap items-center justify-between gap-x-3 text-[11px] text-muted-foreground">
        {/* Chap */}
        <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-x-2">
          <span className="flex shrink-0 items-center gap-1.5 font-semibold text-foreground/70">
            <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-accent/15 text-accent">
              <Leaf className="h-2 w-2" />
            </span>
            "SAMARQAND QULUPNAY IMPEKS" MChJ
          </span>
          <span className="shrink-0 text-border/60">·</span>
          <span className="shrink-0">v1.0.0</span>
          <span className="shrink-0 text-border/60">·</span>
          <span className="shrink-0">© 2026</span>
          <span className="shrink-0 text-border/60">·</span>
          <span className="shrink-0 rounded border border-border/50 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] tracking-wider">
            LIC-KOCHAT-2026
          </span>
        </div>

        {/* O'ng */}
        <div className="flex shrink-0 flex-nowrap items-center gap-x-2">
          <span className="whitespace-nowrap font-medium text-foreground/60">ZBES tech dev group</span>
          <span className="text-border/60">·</span>
          <a href="tel:+998930030530" className="whitespace-nowrap transition-colors hover:text-accent">
            +998 93 003 05 30
          </a>
          <span className="text-border/60">·</span>
          <a href="mailto:azizbekavalov132@gmail.com" className="whitespace-nowrap transition-colors hover:text-accent">
            azizbekavalov132@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
