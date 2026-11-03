import { useEffect, useRef, type ReactNode } from "react";

export function MobilePanel({ title, onClose, children, sheet = false }: { title: string; onClose: () => void; children: ReactNode; sheet?: boolean }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, [href], input');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="mobile-panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className={sheet ? "mobile-panel mobile-sheet" : "mobile-panel"} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button onClick={onClose} aria-label="关闭面板">×</button></div>
      {children}
    </section>
  </div>;
}
