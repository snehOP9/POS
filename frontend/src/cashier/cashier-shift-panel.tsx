import { useEffect, useState } from "react";

import { ApiError, api } from "@/shared/lib/api";
import { formatMoney } from "@/shared/lib/format";

type ShiftView = {
  id: string;
  registerName: string;
  status: "OPEN" | "CLOSED";
  openingCashPaise: number;
  cashSalesPaise: number;
  expectedCashPaise?: number;
  closingCashPaise?: number;
  openedAt: string;
  closedAt?: string;
};

type CashierShiftPanelProps = {
  notify: (message: string, tone?: "success" | "danger" | "info") => void;
};

export const CashierShiftPanel = ({ notify }: CashierShiftPanelProps) => {
  const [shift, setShift] = useState<ShiftView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [registerName, setRegisterName] = useState("Register 01");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");

  const loadShift = () => {
    setLoading(true);
    setError(undefined);
    void api.shifts.current().then((payload) => {
      setShift((payload as { shift?: ShiftView | null }).shift ?? undefined);
    }).catch((requestError: unknown) => {
      setError(requestError instanceof ApiError ? requestError.message : "The current shift is unavailable.");
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadShift(); }, []);

  const openShift = () => {
    const openingCashPaise = Math.round(Number(openingCash) * 100);
    if (!registerName.trim() || !Number.isFinite(openingCashPaise) || openingCashPaise < 0) {
      setError("Enter a register name and a valid opening cash amount.");
      return;
    }
    setLoading(true);
    setError(undefined);
    void api.shifts.open({ registerName: registerName.trim(), openingCashPaise }).then((payload) => {
      setShift(payload as ShiftView);
      notify("Cashier shift opened.", "success");
    }).catch((requestError: unknown) => {
      setError(requestError instanceof ApiError ? requestError.message : "The shift could not be opened.");
    }).finally(() => setLoading(false));
  };

  const closeShift = () => {
    const closingCashPaise = Math.round(Number(closingCash) * 100);
    if (!Number.isFinite(closingCashPaise) || closingCashPaise < 0) {
      setError("Enter a valid counted cash amount.");
      return;
    }
    setLoading(true);
    setError(undefined);
    void api.shifts.close({ closingCashPaise }).then((payload) => {
      setShift(payload as ShiftView);
      notify("Cashier shift closed.", "success");
    }).catch((requestError: unknown) => {
      setError(requestError instanceof ApiError ? requestError.message : "The shift could not be closed.");
    }).finally(() => setLoading(false));
  };

  const expectedCashPaise = shift?.expectedCashPaise ?? (shift ? shift.openingCashPaise + shift.cashSalesPaise : 0);

  return <section className="cashier-report-panel cashier-shift-panel" aria-live="polite">
    <header><div><span className="eyebrow">Register operations</span><h2>Cashier shift</h2></div><button type="button" className="outline-button" onClick={loadShift} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button></header>
    {error && <div className="report-message report-message--error">{error}</div>}
    {loading && !shift && <div className="report-message">Loading shift...</div>}
    {!shift && !loading && <div className="cash-input"><label htmlFor="shift-register">Register name</label><div><input id="shift-register" value={registerName} onChange={(event) => setRegisterName(event.target.value)} maxLength={100} /></div><label htmlFor="shift-opening-cash">Opening cash</label><div><span>INR</span><input id="shift-opening-cash" inputMode="decimal" value={openingCash} onChange={(event) => setOpeningCash(event.target.value.replace(/[^0-9.]/g, ""))} /></div><button type="button" className="button button--saffron" onClick={openShift}>Open shift</button></div>}
    {shift && <><div className="report-metrics"><article><span>Register</span><strong>{shift.registerName}</strong><small>Opened {new Date(shift.openedAt).toLocaleTimeString()}</small></article><article><span>Opening float</span><strong>{formatMoney(shift.openingCashPaise / 100)}</strong><small>Cash sales {formatMoney(shift.cashSalesPaise / 100)}</small></article><article><span>Expected cash</span><strong>{formatMoney(expectedCashPaise / 100)}</strong><small>{shift.status.toLowerCase()}</small></article><article><span>Counted cash</span><strong>{shift.closingCashPaise === undefined ? "Open" : formatMoney(shift.closingCashPaise / 100)}</strong><small>{shift.closedAt ? `Closed ${new Date(shift.closedAt).toLocaleTimeString()}` : "Awaiting count"}</small></article></div>{shift.status === "OPEN" && <div className="cash-input"><label htmlFor="shift-closing-cash">Counted closing cash</label><div><span>INR</span><input id="shift-closing-cash" inputMode="decimal" value={closingCash} onChange={(event) => setClosingCash(event.target.value.replace(/[^0-9.]/g, ""))} placeholder={`${expectedCashPaise / 100}`} /></div><button type="button" className="outline-button" onClick={closeShift} disabled={loading}>Close shift</button></div>}</>}
  </section>;
};