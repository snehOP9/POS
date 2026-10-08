import { useState } from "react";
import { LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { usePos } from "@/shared/store/pos-store";

const workspaceLabel = {
  CASHIER: "Cashier",
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
  CUSTOMER: "Guest",
} as const;

type StaffProfileMenuProps = {
  className?: string;
  label?: string;
};

export const StaffProfileMenu = ({ className = "", label }: StaffProfileMenuProps) => {
  const { logout, session } = usePos();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const dialogRef = useDialogFocus(open, close);
  const name = session?.name ?? "Staff member";
  const role = session?.role ?? "CASHIER";
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const signOut = () => {
    logout();
    close();
    navigate("/access", { replace: true });
  };

  return <>
    <button type="button" className={`staff-profile-trigger ${className}`.trim()} aria-label={`${name}, ${workspaceLabel[role]} profile`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <UserRound size={16} aria-hidden="true" />
      <span>{initials}</span>
      {label && <small>{label}</small>}
    </button>
    {open && <div className="staff-profile-dialog-backdrop" role="presentation" onMouseDown={close}>
      <section className="staff-profile-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="staff-profile-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div className="staff-profile-dialog__identity"><span>{initials}</span><div><small>Signed in as</small><strong id="staff-profile-title">{name}</strong><em>{workspaceLabel[role]} workspace</em></div></div>
          <button type="button" className="icon-button" onClick={close} aria-label="Close profile menu"><X size={18} /></button>
        </header>
        <p><ShieldCheck size={17} /> Your session and role permissions stay protected on this device.</p>
        <div className="staff-profile-dialog__actions">
          <Link className="outline-button" to="/access" onClick={close}>Switch profile</Link>
          <button type="button" className="button button--saffron" onClick={signOut}><LogOut size={16} /> Sign out</button>
        </div>
      </section>
    </div>}
  </>;
};
