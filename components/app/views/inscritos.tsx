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

function LeadFieldsModal({ attendee, onClose }: { attendee: Attendee; onClose: () => void }) {
  const fields = leadFieldsOf(attendee);
  return (
    <Modal
      title="Dados do lead"
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

      {fields.length === 0 ? (
        <Empty icon="users" title="Sem campos extras" sub="Este inscrito ainda nao tem dados adicionais de lead." />
      ) : (
        <div className="lead-detail-grid">
          {fields.map((field) => (
            <div className="lead-detail-row" key={`${field.key}:${field.label}`}>
              <div className="lead-detail-label">
                <span>{field.label}</span>
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

  const countOf = (id: string) =>
    id === "todos" ? all.length : all.filter((a) => a.status === id).length;

  const rows = all
    .filter((a) => tab === "todos" || a.status === tab)
    .filter((a) => !q || (a.name + a.email + a.company + leadSearchText(a)).toLowerCase().includes(q.toLowerCase()))
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
                  <tr key={a.id}>
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
                    <td>
                      <Badge tone={a.ticket === "VIP" ? "green" : a.ticket === "Pro" ? "blue" : "gray"}>
                        {a.ticket}
                      </Badge>
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
                    <td><Menu items={statusActions(a)} /></td>
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
      {leadOpen && <LeadFieldsModal attendee={leadOpen} onClose={() => setLeadOpen(null)} />}
    </div>
  );
}
