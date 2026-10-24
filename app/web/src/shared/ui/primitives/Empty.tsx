import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";

export function Empty({
  title = "Nada por aqui",
  hint,
  to,
  action,
}: {
  title?: string;
  hint: string;
  to?: string;
  action?: string;
}) {
  return (
    <div className="card p-8 text-center grid place-items-center gap-2.5">
      <span className="p-3 rounded-2xl bg-panel2 text-mist border border-line">
        <Inbox size={24} />
      </span>
      <h3 className="font-bold text-base text-foam">{title}</h3>
      <p className="text-xs text-mist max-w-md leading-relaxed">{hint}</p>
      {to && action && (
        <Link to={to} className="btn-ghost mt-2 inline-flex items-center gap-1.5 text-xs">
          {action} →
        </Link>
      )}
    </div>
  );
}
