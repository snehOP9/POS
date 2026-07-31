import { CheckCircle2, Info, XCircle } from "lucide-react";
import { usePos } from "@/shared/store/pos-store";

const iconFor = { success: CheckCircle2, info: Info, danger: XCircle };

export const ToastRail = () => {
  const { toasts } = usePos();
  return (
    <div className="toast-rail" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const Icon = iconFor[toast.tone];
        return <div className={`toast toast--${toast.tone}`} key={toast.id}><Icon size={18} />{toast.message}</div>;
      })}
    </div>
  );
};
