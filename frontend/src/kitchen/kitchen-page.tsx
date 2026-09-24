import { useMemo, useState } from "react";
import { Bell, Check, ChevronDown, Flame, Maximize2, Minimize2, MonitorCog, MoveRight, Sparkles, Timer, Volume2, VolumeX } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { ConnectionBadge } from "@/shared/components/connection-badge";
import { StatusPill } from "@/shared/components/status-pill";
import { restaurant } from "@/shared/data/demo";
import { useClock } from "@/shared/hooks/useClock";
import { useLiveUpdates } from "@/shared/hooks/useLiveUpdates";
import { formatClock, formatElapsed } from "@/shared/lib/format";
import { usePos } from "@/shared/store/pos-store";
import type { KitchenStation, KitchenTicket } from "@/shared/types/domain";

type TicketColumn = "new" | "preparing" | "ready";

const columnInfo: Record<TicketColumn, { title: string; subtitle: string }> = {
  new: { title: "To fire", subtitle: "New at your station" },
  preparing: { title: "On the fire", subtitle: "Watch the clock" },
  ready: { title: "At the pass", subtitle: "Call the floor" },
};

const KitchenTicketCard = ({ ticket, now }: { ticket: KitchenTicket; now: number }) => {
  const { startTicket, markTicketItemReady, markTicketReady, bumpTicket } = usePos();
  const elapsed = formatElapsed(ticket.startedAt, now);
  const isUrgent = ticket.priority === "rush" || (now - new Date(ticket.startedAt).getTime()) / 60_000 >= 20;
  const completeCount = ticket.items.filter((item) => item.status === "READY").length;
  return <article className={`kitchen-ticket kitchen-ticket--${ticket.status} ${isUrgent ? "kitchen-ticket--urgent" : ""}`}>
    <header className="kitchen-ticket__head"><div><span className="kitchen-ticket__id">{ticket.displayId}</span><span className="kitchen-ticket__table">{ticket.tableLabel}</span></div><div className="ticket-timer"><Timer size={16} /><strong>{elapsed}</strong></div></header>
    <div className="kitchen-ticket__badges"><StatusPill status={ticket.status} subtle />{ticket.priority !== "normal" && <span className={`priority-badge priority-badge--${ticket.priority}`}>{ticket.priority === "rush" ? "Rush" : "Re-fire"}</span>}<span className="station-badge">{ticket.station}</span></div>
    {ticket.note && <p className="ticket-allergy-note"><Bell size={15} /> {ticket.note}</p>}
    <div className="ticket-items">{ticket.items.map((item) => <div className={`ticket-item ticket-item--${item.status.toLowerCase()}`} key={item.id}><span className="ticket-item__quantity">{item.quantity}</span><div><strong>{item.name}</strong>{item.modifiers?.map((modifier) => <small key={modifier}>↳ {modifier}</small>)}{item.note && <small>↳ {item.note}</small>}</div>{item.status === "READY" ? <Check className="ticket-item__ready" size={19} /> : ticket.status !== "new" ? <button type="button" className="ticket-item__action" onClick={() => markTicketItemReady(ticket.id, item.id)}>Ready</button> : null}</div>)}</div>
    <footer className="kitchen-ticket__footer">{ticket.status === "new" && <button type="button" className="kitchen-action kitchen-action--start" onClick={() => startTicket(ticket.id)}><Flame size={18} /> Start cooking <MoveRight size={17} /></button>}{ticket.status === "preparing" && <button type="button" className="kitchen-action kitchen-action--ready" onClick={() => markTicketReady(ticket.id)}><Check size={18} /> Mark all ready <span>{completeCount}/{ticket.items.length}</span></button>}{ticket.status === "ready" && <button type="button" className="kitchen-action kitchen-action--bump" onClick={() => bumpTicket(ticket.id)}><Check size={18} /> Bump ticket <MoveRight size={17} /></button>}</footer>
  </article>;
};

export const KitchenPage = () => {
  const { tickets, refreshOperations } = usePos();
  const [station, setStation] = useState<"All" | KitchenStation>("All");
  const [soundOn, setSoundOn] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const now = useClock(1_000);
  const live = useLiveUpdates(refreshOperations);
  const filteredTickets = useMemo(() => tickets.filter((ticket) => station === "All" || ticket.station === station), [station, tickets]);
  const count = (status: TicketColumn) => filteredTickets.filter((ticket) => ticket.status === status).length;
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().then(() => setFullScreen(true)).catch(() => setFullScreen(false));
    } else {
      void document.exitFullscreen().then(() => setFullScreen(false)).catch(() => setFullScreen(true));
    }
  };

  return <main className="kitchen-page">
    <header className="kitchen-header"><div className="kitchen-header__brand"><Brand inverse compact /><span className="kitchen-divider" /><div><span className="eyebrow">Kitchen display</span><strong>{restaurant.name}</strong></div></div><div className="kitchen-header__center"><div className="kitchen-count"><span>{count("new")}</span><small>New</small></div><div className="kitchen-count kitchen-count--fire"><span>{count("preparing")}</span><small>Cooking</small></div><div className="kitchen-count kitchen-count--ready"><span>{count("ready")}</span><small>Ready</small></div></div><div className="kitchen-header__actions"><ConnectionBadge live={live} dark /><button type="button" className="kitchen-tool" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "Mute kitchen alerts" : "Enable kitchen alerts"}>{soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}{soundOn ? "Sound on" : "Muted"}</button><button type="button" className="kitchen-tool kitchen-tool--icon" onClick={toggleFullscreen} aria-label="Toggle full screen">{fullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button><div className="kitchen-clock"><span>{formatClock(new Date(now))}</span><small>Chef Arjun</small></div></div></header>
    <section className="kitchen-toolbar"><div><span className="eyebrow">Station view</span><h1>Keep the fire moving.</h1></div><div className="station-tabs" role="tablist" aria-label="Kitchen station filter">{(["All", "Hot", "Tandoor", "Cold", "Bar"] as const).map((value) => <button role="tab" aria-selected={station === value} type="button" key={value} className={station === value ? "station-tab station-tab--active" : "station-tab"} onClick={() => setStation(value)}>{value}{value !== "All" && <b>{tickets.filter((ticket) => ticket.station === value && ticket.status !== "ready").length}</b>}</button>)}</div><label className="kitchen-station-select"><MonitorCog size={18} /><select value={station} onChange={(event) => setStation(event.target.value as "All" | KitchenStation)} aria-label="Filter kitchen station">{(["All", "Hot", "Tandoor", "Cold", "Bar"] as const).map((value) => <option value={value} key={value}>{value === "All" ? "All stations" : value}</option>)}</select><ChevronDown size={16} /></label></section>
    <div className="kitchen-board">{(["new", "preparing", "ready"] as TicketColumn[]).map((status) => <section className={`ticket-column ticket-column--${status}`} key={status}><header><div><h2>{columnInfo[status].title}</h2><p>{columnInfo[status].subtitle}</p></div><span>{count(status)}</span></header><div className="ticket-column__list">{filteredTickets.filter((ticket) => ticket.status === status).map((ticket) => <KitchenTicketCard ticket={ticket} now={now} key={ticket.id} />)}{!filteredTickets.some((ticket) => ticket.status === status) && <div className="kitchen-empty">{status === "new" ? <Sparkles size={26} /> : <Check size={27} />}<strong>{status === "new" ? "No new tickets" : status === "preparing" ? "The line is clear" : "Nothing waiting at the pass"}</strong><span>{status === "new" ? "New orders will land here in real time." : "Nice work, team."}</span></div>}</div></section>)}</div>
  </main>;
};
