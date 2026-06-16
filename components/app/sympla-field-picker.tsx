"use client";

import { Icon } from "@/components/app/kit";
import type { SymplaFieldOption } from "@/lib/integrations/sympla";
import type { LeadField } from "@/types";

const GROUP_LABEL: Record<NonNullable<LeadField["group"]>, string> = {
  order: "Pedido",
  ticket: "Ingresso",
  lead: "Lead",
  custom: "Personalizados",
};

const GROUPS: NonNullable<LeadField["group"]>[] = ["order", "ticket", "lead", "custom"];

const FIXED_FIELDS = ["Nome", "Email", "Empresa", "Ingresso", "Status", "Data de inscricao"];

export function SymplaFieldPicker({
  fields,
  selected,
  onChange,
}: {
  fields: SymplaFieldOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const selectedSet = new Set(selected);

  const setAll = () => onChange(fields.map((field) => field.key));
  const clearAll = () => onChange([]);

  const toggle = (key: string) => {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(fields.map((field) => field.key).filter((fieldKey) => next.has(fieldKey)));
  };

  return (
    <div className="sympla-fields">
      <div className="sympla-fields-head">
        <div>
          <div className="sympla-fields-title">Campos do lead</div>
          <div className="sympla-fields-sub">Essenciais fixos + extras escolhidos para esta sincronizacao.</div>
        </div>
        {fields.length > 0 && (
          <div className="sympla-fields-actions">
            <button className="btn btn-sm" type="button" onClick={setAll}>Todos</button>
            <button className="btn btn-sm btn-ghost" type="button" onClick={clearAll}>Limpar</button>
          </div>
        )}
      </div>

      <div className="sympla-fixed-fields">
        {FIXED_FIELDS.map((field) => (
          <span key={field} className="sympla-fixed-field">
            <Icon name="check" size={12} />
            {field}
          </span>
        ))}
      </div>

      {fields.length === 0 ? (
        <div className="sympla-fields-empty">
          Nenhum campo extra apareceu nos participantes retornados pelo Sympla.
        </div>
      ) : (
        GROUPS.map((group) => {
          const groupFields = fields.filter((field) => field.group === group);
          if (groupFields.length === 0) return null;
          const selectedCount = groupFields.filter((field) => selectedSet.has(field.key)).length;
          return (
            <div className="sympla-field-group" key={group}>
              <div className="sympla-field-group-title">
                <span>{GROUP_LABEL[group]}</span>
                <span>{selectedCount}/{groupFields.length}</span>
              </div>
              <div className="sympla-field-grid">
                {groupFields.map((field) => {
                  const active = selectedSet.has(field.key);
                  return (
                    <button
                      type="button"
                      key={field.key}
                      className={"sympla-field" + (active ? " active" : "")}
                      onClick={() => toggle(field.key)}
                    >
                      <span className="sympla-field-check">
                        {active && <Icon name="check" size={12} />}
                      </span>
                      <span className="sympla-field-meta">
                        <span className="sympla-field-name">{field.label}</span>
                        {field.sample && <span className="sympla-field-sample">{field.sample}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
