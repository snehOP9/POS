import { useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import { FoodVisual } from "@/shared/components/food-visual";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { formatMoney } from "@/shared/lib/format";
import { selectionForOption, unitPriceForSelection, type CartSelection } from "@/shared/lib/cart";
import type { MenuItem } from "@/shared/types/domain";

export const requiresConfiguration = (item: MenuItem): boolean => Boolean(item.variants?.length || item.modifierGroups?.length);

interface ItemConfiguratorProps {
  item: MenuItem;
  onAdd: (selection: CartSelection) => void;
  onClose: () => void;
  submitLabel?: string;
}

export const ItemConfigurator = ({ item, onAdd, onClose, submitLabel = "Add to order" }: ItemConfiguratorProps) => {
  const dialogRef = useDialogFocus(true, onClose);
  const [variantId, setVariantId] = useState(() => item.variants?.find((variant) => variant.available)?.id);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const variant = item.variants?.find((entry) => entry.id === variantId && entry.available);
  const modifiers = (item.modifierGroups ?? []).flatMap((group) => group.options.filter((option) => selectedOptionIds.includes(option.id)).map((option) => selectionForOption(group, option)));
  const selectionCount = (groupId: string) => modifiers.filter((modifier) => modifier.groupId === groupId).length;
  const toggleOption = (group: NonNullable<MenuItem["modifierGroups"]>[number], optionId: string) => setSelectedOptionIds((current) => {
    const selected = current.includes(optionId);
    if (!selected && current.filter((id) => group.options.some((option) => option.id === id)).length >= group.maxSelections) return current;
    return selected ? current.filter((id) => id !== optionId) : [...current, optionId];
  });
  const missingRequiredSelection = (item.modifierGroups ?? []).some((group) => selectionCount(group.id) < group.minSelections);
  const total = unitPriceForSelection(item, { variant, modifiers });

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="dish-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="item-configurator-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="icon-button dish-dialog__close" onClick={onClose} aria-label="Close dish options"><X /></button>
      <FoodVisual item={item} size="feature" />
      <div className="dish-dialog__details"><div className="eyebrow">Configure your dish</div><h2 id="item-configurator-title">{item.name}</h2><p>{item.description}</p><strong>{formatMoney(total)}</strong></div>
      {item.variants?.length ? <fieldset className="option-group"><legend>Choose a portion</legend><div className="choice-row">{item.variants.map((option) => <label className={variantId === option.id ? "choice choice--selected" : "choice"} key={option.id}><input type="radio" name={`variant-${item.id}`} checked={variantId === option.id} disabled={!option.available} onChange={() => setVariantId(option.id)} />{option.name}{option.priceDelta ? ` ? ${option.priceDelta > 0 ? "+" : ""}${formatMoney(option.priceDelta)}` : ""}</label>)}</div></fieldset> : null}
      {(item.modifierGroups ?? []).map((group) => <fieldset className="option-group" key={group.id}><legend>{group.name}{group.minSelections ? ` ? choose at least ${group.minSelections}` : " ? optional"}</legend><div className="choice-stack">{group.options.map((option) => { const selected = selectedOptionIds.includes(option.id); const groupFull = selectionCount(group.id) >= group.maxSelections; return <label className="checkbox-choice" key={option.id}><input type="checkbox" checked={selected} disabled={!option.available || (!selected && groupFull)} onChange={() => toggleOption(group, option.id)} /><span>{option.name}{option.priceDelta ? ` ? ${option.priceDelta > 0 ? "+" : ""}${formatMoney(option.priceDelta)}` : ""}</span></label>; })}</div></fieldset>)}
      <label className="dish-note"><span>Kitchen note <small>optional</small></span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="Allergy, no onion, serve together." /></label>
      <button type="button" className="button button--saffron button--full" disabled={missingRequiredSelection} onClick={() => { onAdd({ variant, modifiers, note }); onClose(); }}><ShoppingBag size={18} /> {missingRequiredSelection ? "Choose required options" : `${submitLabel} ? ${formatMoney(total)}`}</button>
    </section>
  </div>;
};
