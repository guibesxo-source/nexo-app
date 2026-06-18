"use client";

/* Inscritos - CRUD, status, busca/filtro, import e export CSV. */
import { useEffect, useState } from "react";
import {
  Avatar, Badge, Empty, Field, Icon, Menu, Modal, PageHead, useToast,
} from "@/components/app/kit";
import { ImportAttendeesModal } from "@/components/app/import-attendees";
import { useSymplaAutoSync } from "@/components/app/sympla-sync";
import {
  addAttendee,
  ATTENDEE_STATUS_META,
  attendeeSignupAt,
  attendeesOf,
  removeAttendee,
  selectedEvent,
  setAttendeeStatus,
  setLeadPanelFields,
  setToggle,
  useDb,
} from "@/lib/db";
import { attendeeSchema } from "@/lib/validations/attendee";
import { downloadCsv, toCsv } from "@/lib/csv";
import { fmtDateTime, initialsOf } from "@/lib/format";
import type { Attendee, AttendeeStatus, TicketType } from "@/types";

const TABS: [string, string][] = [
  ["todos", "Todos"],
  ["confirmado", "Confirmados"],
  ["pendente", "Pendentes"],
  ["checkin", "Check-in"],
];

type LeadColumn = { key: string; label: string };

function leadFieldsOf(a: Attendee) {
  return (a.lead_fields ?? []).filter((field) => field.label && field.value);
}

function leadColumnsOf(attendees: Attendee[]): LeadColumn[] {
  const byKey = new Map<string, LeadColumn>();
  for (const attendee of attendees) {
    for (const field of leadFieldsOf(attendee)) {
      if (!byKey.has(field.key)) byKey.set(field.key, { key: field.key, label: field.label });
    }
  }
  return [...byKey.values()];
}

function leadValue(a: Attendee, key: string) {
  return leadFieldsOf(a).find((field) => field.key === key)?.value ?? "";
}

function leadSearchText(a: Attendee) {
  return leadFieldsOf(a).map((field) => `${field.label} ${field.value}`).join(" ");
}

function AttendeeFormModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "", email: "", company: "",
    ticket: "Geral" as TicketType,
    status: "pendente" as AttendeeStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    const parsed = attendeeSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    addAttendee(eventId, parsed.data);
    toast("Inscrito adicionado");
    onClose();
  };

  return (
    <Modal
      title="Adicionar inscrito"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Adicionar</button>
        </>
      }
    >
      <Field label="Nome completo" error={errors.name}>
        <input className="input" value={form.name} onChange={set("name")} autoFocus />
      </Field>
      <div className="form-grid">
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Empresa" error={errors.company}>
          <input className="input" value={form.company} onChange={set("company")} />
        </Field>
        <Field label="Ingresso" error={errors.ticket}>
          <select className="input" value={form.ticket} onChange={set("ticket")}>
            <option value="Geral">Geral</option>
            <option value="Pro">Pro</option>
            <option value="VIP">VIP</option>
          </select>
        </Field>
        <Field label="Status" error={errors.status}>
          <select className="input" value={form.status} onChange={set("status")}>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="checkin">Check-in</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/** Rótulos amigáveis para chaves de UTM (origem do lead). */
const UTM_LABELS: Record<string, string> = {
  utm_source: "UTM Source", utm_medium: "UTM Medium", utm_campaign: "UTM Campaign",
  utm_content: "UTM Content", utm_term: "UTM Term", utm_id: "UTM ID",
  source: "Origem (source)", medium: "Mídia (medium)", campaign: "Campanha",
};

/** Rótulo de exibição do campo (UTM bonitinho; senão o rótulo do dado). */
function leadLabel(key: string, fallback: string): string {
  const bare = key.replace(/^[^:]+:/, "").toLowerCase();
  return UTM_LABELS[bare] ?? fallback;
}

function LeadFieldsModal({ attendee, columns, onClose }: {
  attendee: Attendee; columns: LeadColumn[]; onClose: () => void;
}) {
  const db = useDb();
  const [editing, setEditing] = useState(false);
  const pref = db.settings.lead_panel_fields;
  const isAll = !pref || pref.length === 0;

  const fields = leadFieldsOf(attendee);
  const shown = isAll ? fields : fields.filter((f) => pref!.includes(f.key));

  const allKeys = columns.map((c) => c.key);
  const currentVisible = isAll ? new Set(allKeys) : new Set(pref);
  const toggle = (key: string) => {
    const next = new Set(currentVisible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const isEverything = next.size === allKeys.length && allKeys.every((k) => next.has(k));
    setLeadPanelFields(isEverything ? [] : [...next]);
  };

  return (
    <Modal
      title={
        <div className="lead-modal-title">
          <span>Dados do lead</span>
          <button
            className={"lead-fields-btn" + (editing ? " active" : "")}
            title={editing ? "Concluir" : "Escolher quais informações aparecem"}
            onClick={() => setEditing((e) => !e)}
          >
            <Icon name={editing ? "check" : "plus"} size={15} />
          </button>
        </div>
      }
      onClose={onClose}
      width={620}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <div className="lead-detail-head">
        <Avatar initials={initialsOf(attendee.name)} />
        <div>
          <div className="nm">{attendee.name}</div>
          <div className="em">{attendee.email}</div>
        </div>
      </div>

      {editing ? (
        columns.length === 0 ? (
          <Empty icon="users" title="Sem campos" sub="Sincronize inscritos do Sympla para escolher os campos do lead." />
        ) : (
          <>
            <div className="lead-pick-head">
              <span>Escolha as informações exibidas neste painel · {currentVisible.size}/{allKeys.length}</span>
              {!isAll && (
                <button className="lead-pick-all" onClick={() => setLeadPanelFields([])}>Mostrar todas</button>
              )}
            </div>
            <div className="lead-pick-grid">
              {columns.map((col) => {
                const on = currentVisible.has(col.key);
                const sample = leadValue(attendee, col.key);
                return (
                  <button
                    key={col.key}
                    className={"lead-pick-row" + (on ? " on" : "")}
                    onClick={() => toggle(col.key)}
                  >
                    <span className="lp-meta">
                      <span className="lp-nm">{leadLabel(col.key, col.label)}</span>
                      {sample && <span className="lp-val">{sample}</span>}
                    </span>
                    <Icon name={on ? "check" : "plus"} size={15} />
                  </button>
                );
              })}
            </div>
          </>
        )
      ) : shown.length === 0 ? (
        <Empty
          icon="users"
          title={fields.length === 0 ? "Sem campos extras" : "Nenhum campo selecionado"}
          sub={fields.length === 0
            ? "Este inscrito ainda nao tem dados adicionais de lead."
            : "Use o + no topo para escolher quais informações ver aqui."}
        />
      ) : (
        <div className="lead-detail-grid">
          {shown.map((field) => (
            <div className="lead-detail-row" key={`${field.key}:${field.label}`}>
              <div className="lead-detail-label">
                <span>{leadLabel(field.key, field.label)}</span>
                {field.source === "sympla" && <Badge tone="gray">Sympla</Badge>}
              </div>
              <div className="lead-detail-value">{field.value}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* Facetas filtráveis = as infos que vêm do Sympla/CSV (status já está nas abas):
   ingresso, empresa, origem + cada campo de lead. O usuário escolhe quais
   aparecem como filtro; a preferência persiste em settings.toggles. */
type FacetDef = { key: string; label: string; toggleKey: string; defaultOn: boolean; value: (a: Attendee) => string };

const SOURCE_LABEL: Record<string, string> = { sympla: "Sympla", hubspot: "HubSpot", csv: "CSV" };
const sourceLabel = (s?: string | null) => (s ? SOURCE_LABEL[s] ?? s : "Manual");

function buildFacets(all: Attendee[]): FacetDef[] {
  const base: Omit<FacetDef, "toggleKey">[] = [
    { key: "ticket", label: "Ingresso", defaultOn: true, value: (a) => a.ticket },
    { key: "company", label: "Empresa", defaultOn: false, value: (a) => a.company || "—" },
    { key: "source", label: "Origem", defaultOn: false, value: (a) => sourceLabel(a.external_source) },
    ...leadColumnsOf(all).map((col) => ({
      key: `lead:${col.key}`,
      label: col.label,
      defaultOn: false,
      value: (a: Attendee) => leadValue(a, col.key),
    })),
  ];
  return base.map((f) => ({ ...f, toggleKey: `insc.facet.${f.key}` }));
}

/** Botão "Filtros": escolhe quais campos aparecem como filtro na lista. */
function FilterPicker({ options, onToggle, activeCount = 0 }: {
  options: { key: string; label: string; on: boolean }[];
  onToggle: (key: string, on: boolean) => void;
  activeCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const shownCount = options.filter((o) => o.on).length;
  return (
    <span className="menu-wrap">
      <button
        className={"btn" + (activeCount > 0 ? " filter-btn-on" : "")}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        title="Escolher quais campos filtrar"
      >
        <Icon name="filter" size={15} />Filtros
        {activeCount > 0 && <span className="filter-btn-count">{activeCount}</span>}
      </button>
      {open && (
        <>
          <span className="menu-scrim" onClick={() => setOpen(false)} />
          <span className="menu left filter-menu" role="menu">
            <span className="filter-menu-head">
              Campos para filtrar
              <span className="filter-menu-sub">{shownCount} de {options.length} visíveis</span>
            </span>
            {options.map((o) => (
              <label key={o.key} className="filter-opt">
                <input
                  type="checkbox"
                  checked={o.on}
                  onChange={(e) => onToggle(o.key, e.target.checked)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

/* Cores distintas por tipo de ingresso (estáveis por evento, sem colisão):
   "Geral" fica cinza; os demais tipos entram num rodízio de cores fortes na
   ordem alfabética — assim Participante e Field Sales nunca ficam iguais. */
const TICKET_TONES = ["blue", "amber", "green", "red"];
function ticketToneMap(all: Attendee[]): Map<string, string> {
  const distinct = [...new Set(all.map((a) => a.ticket).filter(Boolean))]
    .sort((x, y) => x.localeCompare(y, "pt-BR"));
  const map = new Map<string, string>();
  let i = 0;
  for (const t of distinct) {
    const n = t.trim().toLowerCase();
    map.set(t, !n || n === "geral" ? "gray" : TICKET_TONES[i++ % TICKET_TONES.length]);
  }
  return map;
}

export function Inscritos() {
  const db = useDb();
  const toast = useToast();
  const [q, setQ] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [tab, setTab] = useState("todos");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [leadOpen, setLeadOpen] = useState<Attendee | null>(null);
  // Valor selecionado por faceta ("" = todas); transitório (não persiste).
  const [facetVal, setFacetVal] = useState<Record<string, string>>({});

  useEffect(() => {
    const onSearch = (e: Event) => {
      setQ((e as CustomEvent<string>).detail);
      setTab("todos");
    };
    window.addEventListener("nexo:search", onSearch);
    return () => window.removeEventListener("nexo:search", onSearch);
  }, []);

  const ev = selectedEvent(db);
  const symplaSync = useSymplaAutoSync(ev?.id ?? null);
  const all = ev ? attendeesOf(db, ev.id).filter((a) => a.status !== "cancelado") : [];
  const leadColumnCount = leadColumnsOf(all).length;
  const ticketTones = ticketToneMap(all);

  const countOf = (id: string) =>
    id === "todos" ? all.length : all.filter((a) => a.status === id).length;

  const facets = buildFacets(all);
  const visibleFacets = facets.filter((f) => db.settings.toggles[f.toggleKey] ?? f.defaultOn);
  const activeFacetCount = visibleFacets.filter((f) => facetVal[f.key]).length;
  const facetOptions = (f: FacetDef) =>
    [...new Set(all.map(f.value).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt-BR"));
  const toggleFacet = (key: string, on: boolean) => {
    setToggle(`insc.facet.${key}`, on);
    if (!on) setFacetVal((v) => ({ ...v, [key]: "" }));
  };

  const rows = all
    .filter((a) => tab === "todos" || a.status === tab)
    .filter((a) => !q || (a.name + a.email + a.company + leadSearchText(a)).toLowerCase().includes(q.toLowerCase()))
    .filter((a) => visibleFacets.every((f) => !facetVal[f.key] || f.value(a) === facetVal[f.key]))
    .sort((a, b) => attendeeSignupAt(b).localeCompare(attendeeSignupAt(a)));

  const exportCsv = () => {
    const leadCols = leadColumnsOf(rows);
    const csv = toCsv(
      ["Nome", "Email", "Empresa", "Ingresso", "Status", "Inscrito em", ...leadCols.map((field) => field.label)],
      rows.map((a) => [
        a.name, a.email, a.company, a.ticket,
        ATTENDEE_STATUS_META[a.status].label, fmtDateTime(attendeeSignupAt(a)),
        ...leadCols.map((field) => leadValue(a, field.key)),
      ])
    );
    downloadCsv(`nexo-inscritos-${ev?.name.toLowerCase().replace(/\s+/g, "-") ?? "evento"}.csv`, csv);
    toast(`${rows.length} inscritos exportados (CSV)`);
  };

  const statusActions = (a: Attendee) => [
    ...(leadFieldsOf(a).length > 0
      ? [{
          label: "Ver dados do lead",
          onClick: () => setLeadOpen(a),
        }]
      : []),
    ...(["confirmado", "checkin", "pendente"] as AttendeeStatus[])
      .filter((s) => s !== a.status)
      .map((s) => ({
        label: `Marcar como ${ATTENDEE_STATUS_META[s].label.toLowerCase()}`,
        onClick: () => {
          setAttendeeStatus(a.id, s);
          toast(`${a.name} · ${ATTENDEE_STATUS_META[s].label}`);
        },
      })),
    {
      label: "Remover inscrito",
      danger: true,
      onClick: () => {
        if (confirm(`Remover ${a.name} da lista de inscritos?`)) {
          removeAttendee(a.id);
          toast("Inscrito removido");
        }
      },
    },
  ];

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Inscritos" sub="Nenhum evento criado ainda" />
        <Empty icon="users" title="Crie um evento primeiro" sub="Os inscritos pertencem a um evento." />
      </div>
    );
  }

  return (
    <div className="view">
      <PageHead
        title="Inscritos"
        sub={`${ev.name} · ${all.length} participantes · ${countOf("confirmado") + countOf("checkin")} confirmados${leadColumnCount > 0 ? ` · ${leadColumnCount} campos de lead` : ""}${symplaSync.link ? ` · Sympla ${symplaSync.busy ? "sincronizando..." : "vinculado"}` : ""}`}
        actions={
          <>
            {symplaSync.link && (
              <button
                className="btn"
                onClick={async () => {
                  const result = await symplaSync.syncNow();
                  if (result) {
                    toast(`${result.added} novo${result.added === 1 ? "" : "s"} · ${result.updated} atualizado${result.updated === 1 ? "" : "s"} do Sympla`);
                  }
                }}
                disabled={symplaSync.busy}
              >
                <Icon name="refresh" size={15} />{symplaSync.busy ? "Sincronizando" : "Sync Sympla"}
              </button>
            )}
            <button className="btn" onClick={() => setImporting(true)}>
              <Icon name="upload" size={15} />Importar
            </button>
            <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
              <Icon name="download" size={15} />Exportar CSV
            </button>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={15} />Adicionar
            </button>
          </>
        }
      />

      <div className="row" style={{ marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div className="input-search" style={{ maxWidth: 320 }}>
          <Icon name="search" size={16} />
          <input
            placeholder="Buscar por nome, email, empresa ou lead..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <FilterPicker
          options={facets.map((f) => ({
            key: f.key,
            label: f.label,
            on: db.settings.toggles[f.toggleKey] ?? f.defaultOn,
          }))}
          onToggle={toggleFacet}
          activeCount={activeFacetCount}
        />
        <div style={{ flex: 1 }} />
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={"chip" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
          >
            {label}
            <span className="ct">{countOf(id)}</span>
          </button>
        ))}
      </div>

      {visibleFacets.length > 0 && (
        <div className="facet-bar">
          {visibleFacets.map((f) => {
            const val = facetVal[f.key] ?? "";
            const opts = facetOptions(f);
            return (
              <div className={"facet-field" + (val ? " active" : "")} key={f.key}>
                <span className="facet-field-label">{f.label}</span>
                <select
                  className="input facet-field-select"
                  value={val}
                  onChange={(e) => setFacetVal((v) => ({ ...v, [f.key]: e.target.value }))}
                >
                  <option value="">Todos ({opts.length})</option>
                  {opts.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            );
          })}
          {activeFacetCount > 0 && (
            <button className="facet-clear-all" onClick={() => setFacetVal({})}>
              <Icon name="x" size={13} />
              Limpar {activeFacetCount} filtro{activeFacetCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Participante</th>
              <th>Empresa</th>
              <th>Ingresso</th>
              <th>Lead</th>
              <th>Status</th>
              <th>Inscricao</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--dim)" }}>
                  {all.length === 0
                    ? "Nenhum inscrito ainda - adicione o primeiro."
                    : "Nenhum inscrito encontrado com esses filtros."}
                </td>
              </tr>
            ) : (
              rows.map((a) => {
                const meta = ATTENDEE_STATUS_META[a.status];
                const leadFields = leadFieldsOf(a);
                return (
                  <tr
                    key={a.id}
                    className="tbl-row-click"
                    onClick={() => setLeadOpen(a)}
                    title="Ver dados do lead"
                  >
                    <td>
                      <div className="cell-user">
                        <Avatar initials={initialsOf(a.name)} />
                        <div>
                          <div className="nm">{a.name}</div>
                          <div className="em">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{a.company || "—"}</td>
                    <td className="ticket-cell">
                      <Badge tone={ticketTones.get(a.ticket) ?? "gray"}>{a.ticket}</Badge>
                    </td>
                    <td>
                      {leadFields.length === 0 ? (
                        <span style={{ color: "var(--dim)" }}>—</span>
                      ) : (
                        <button className="lead-preview" type="button" onClick={() => setLeadOpen(a)}>
                          {leadFields.slice(0, 2).map((field) => (
                            <span className="lead-chip" key={field.key}>
                              <b>{field.label}</b>
                              <span>{field.value}</span>
                            </span>
                          ))}
                          {leadFields.length > 2 && (
                            <span className="lead-count">+{leadFields.length - 2}</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td><Badge tone={meta.tone} dot>{meta.label}</Badge></td>
                    <td style={{ color: "var(--dim)" }}>{fmtDateTime(attendeeSignupAt(a))}</td>
                    <td onClick={(e) => e.stopPropagation()}><Menu items={statusActions(a)} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="tbl-foot">
          <span>Mostrando {rows.length} de {all.length} inscritos</span>
        </div>
      </div>

      {adding && <AttendeeFormModal eventId={ev.id} onClose={() => setAdding(false)} />}
      {importing && <ImportAttendeesModal eventId={ev.id} onClose={() => setImporting(false)} />}
      {leadOpen && (
        <LeadFieldsModal attendee={leadOpen} columns={leadColumnsOf(all)} onClose={() => setLeadOpen(null)} />
      )}
    </div>
  );
}
