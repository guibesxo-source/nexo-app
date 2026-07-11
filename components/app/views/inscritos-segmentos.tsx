"use client";

/* Listas & segmentos — filtros nomeados sobre os inscritos: monte o recorte
   (status, origem, campo do lead, busca), veja a contagem ao vivo, salve e
   exporte. Os segmentos salvos ficam sempre atualizados (contagem derivada). */
import { useState } from "react";
import {
  Avatar, Badge, Card, ConfirmDialog, Empty, Field, Icon, Menu, Modal, PageHead, useToast,
} from "@/components/app/kit";
import {
  ATTENDEE_STATUS_META,
  ORIGIN_META,
  leadBreakdown,
  leadSegmentFields,
  originOf,
  removeSegment,
  savedSegmentsOf,
  saveSegment,
  segmentAttendees,
  selectedEvent,
  useDb,
} from "@/lib/db";
import { savedSegmentSchema } from "@/lib/validations/operations";
import { downloadCsv, toCsv } from "@/lib/csv";
import { initialsOf } from "@/lib/format";
import type { SavedSegment, SegmentOrigin } from "@/types";

type Filter = {
  status: "todos" | "pendente" | "confirmado" | "checkin" | "cancelado";
  origin: SegmentOrigin;
  q: string;
  field_key: string;
  field_value: string;
};

const EMPTY_FILTER: Filter = { status: "todos", origin: "todos", q: "", field_key: "", field_value: "" };

const STATUS_OPTIONS: [Filter["status"], string][] = [
  ["todos", "Todos os ativos"],
  ["pendente", "Pendentes"],
  ["confirmado", "Confirmados"],
  ["checkin", "Check-in"],
  ["cancelado", "Cancelados"],
];

const ORIGIN_OPTIONS: [SegmentOrigin, string][] = [
  ["todos", "Todas as origens"],
  ["sympla", "Sympla"],
  ["hubspot", "HubSpot (LP)"],
  ["csv", "Planilha/CSV"],
  ["manual", "Manual"],
];

function filterOf(seg: SavedSegment): Filter {
  return {
    status: seg.status,
    origin: seg.origin,
    q: seg.q ?? "",
    field_key: seg.field_key ?? "",
    field_value: seg.field_value ?? "",
  };
}

function describeFilter(f: Filter, fieldLabel?: string): string {
  const parts: string[] = [];
  parts.push(STATUS_OPTIONS.find(([id]) => id === f.status)?.[1] ?? f.status);
  if (f.origin !== "todos") parts.push(ORIGIN_META[f.origin].label);
  if (f.field_key && f.field_value) parts.push(`${fieldLabel ?? "campo"} = ${f.field_value}`);
  if (f.q.trim()) parts.push(`“${f.q.trim()}”`);
  return parts.join(" · ");
}

export function InscritosSegmentos() {
  const db = useDb();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [removing, setRemoving] = useState<SavedSegment | null>(null);

  const ev = selectedEvent(db);
  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Listas & segmentos" sub="Nenhum evento criado ainda" />
        <Empty icon="filter" title="Crie um evento primeiro" sub="Os segmentos recortam os inscritos de um evento." />
      </div>
    );
  }

  const fields = leadSegmentFields(db, ev.id);
  const fieldValues = filter.field_key ? leadBreakdown(db, ev.id, filter.field_key, 20) : [];
  const matched = segmentAttendees(db, ev.id, {
    status: filter.status,
    origin: filter.origin,
    q: filter.q || null,
    field_key: filter.field_key || null,
    field_value: filter.field_value || null,
  });
  const saved = savedSegmentsOf(db, ev.id);
  const fieldLabel = fields.find((f) => f.key === filter.field_key)?.label;

  const exportList = (list: ReturnType<typeof segmentAttendees>, label: string) => {
    const csv = toCsv(
      ["Nome", "Email", "Empresa", "Ingresso", "Status", "Origem"],
      list.map((a) => [
        a.name, a.email, a.company, a.ticket,
        ATTENDEE_STATUS_META[a.status].label,
        ORIGIN_META[originOf(a)].label,
      ])
    );
    downloadCsv(`nexo-segmento-${label.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
    toast("Segmento exportado (CSV)");
  };

  const copyEmails = async (list: ReturnType<typeof segmentAttendees>) => {
    const emails = [...new Set(list.map((a) => a.email).filter(Boolean))];
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      toast(`${emails.length} e-mail${emails.length === 1 ? "" : "s"} copiados`);
    } catch {
      toast("Não consegui copiar automaticamente");
    }
  };

  const submitSave = () => {
    const parsed = savedSegmentSchema.safeParse({ name, ...filter });
    if (!parsed.success) {
      setNameErr(parsed.error.issues[0]?.message ?? "Revise o segmento");
      return;
    }
    saveSegment(ev.id, parsed.data);
    setSaving(false);
    setName("");
    setNameErr("");
    toast(`Segmento “${parsed.data.name}” salvo`);
  };

  return (
    <div className="view">
      <PageHead
        title="Listas & segmentos"
        sub={`${ev.name} · recorte os inscritos e reuse o filtro na comunicação`}
        actions={
          <>
            <button className="btn" onClick={() => copyEmails(matched)} disabled={matched.length === 0}>
              <Icon name="mail" size={15} />Copiar e-mails
            </button>
            <button className="btn" onClick={() => exportList(matched, "recorte")} disabled={matched.length === 0}>
              <Icon name="download" size={15} />CSV
            </button>
            <button className="btn btn-primary" onClick={() => setSaving(true)} disabled={matched.length === 0}>
              <Icon name="save" size={15} />Salvar segmento
            </button>
          </>
        }
      />

      <Card title="Montar recorte">
        <div className="seg-builder">
          <Field label="Status">
            <select
              className="input"
              value={filter.status}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as Filter["status"] }))}
            >
              {STATUS_OPTIONS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Origem">
            <select
              className="input"
              value={filter.origin}
              onChange={(e) => setFilter((f) => ({ ...f, origin: e.target.value as SegmentOrigin }))}
            >
              {ORIGIN_OPTIONS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Campo do lead">
            <select
              className="input"
              value={filter.field_key}
              disabled={fields.length === 0}
              onChange={(e) => setFilter((f) => ({ ...f, field_key: e.target.value, field_value: "" }))}
            >
              <option value="">{fields.length ? "Qualquer" : "Sem campos de lead ainda"}</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Valor">
            <select
              className="input"
              value={filter.field_value}
              disabled={!filter.field_key}
              onChange={(e) => setFilter((f) => ({ ...f, field_value: e.target.value }))}
            >
              <option value="">Escolha…</option>
              {fieldValues.map((v) => (
                <option key={v.value} value={v.value}>{v.value} ({v.count})</option>
              ))}
            </select>
          </Field>
          <Field label="Busca livre" style={{ gridColumn: "1 / -1" }}>
            <div className="input-search">
              <Icon name="search" size={15} />
              <input
                placeholder="Nome, e-mail ou empresa…"
                value={filter.q}
                onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
              />
            </div>
          </Field>
        </div>

        <div className="seg-result">
          <span className="seg-count">
            <b>{matched.length}</b> inscrito{matched.length === 1 ? "" : "s"} · {describeFilter(filter, fieldLabel)}
          </span>
          <button className="btn btn-sm" onClick={() => setFilter(EMPTY_FILTER)}>Limpar</button>
        </div>

        {matched.length > 0 && (
          <div className="seg-preview">
            {matched.slice(0, 8).map((a) => (
              <span className="seg-person" key={a.id} title={`${a.name} · ${a.email}`}>
                <Avatar initials={initialsOf(a.name)} size="sm" />
                <span className="seg-person-nm">{a.name.split(" ")[0]}</span>
              </span>
            ))}
            {matched.length > 8 && <span className="seg-more">+{matched.length - 8}</span>}
          </div>
        )}
      </Card>

      <Card title="Segmentos salvos" style={{ marginTop: 16 }}>
        {saved.length === 0 ? (
          <Empty
            icon="filter"
            title="Nenhum segmento salvo"
            sub="Monte um recorte acima e salve — a contagem fica viva e o segmento vira público na Comunicação."
          />
        ) : (
          <div className="segsaved-list">
            {saved.map((seg) => {
              const f = filterOf(seg);
              const list = segmentAttendees(db, ev.id, seg);
              const lbl = fields.find((x) => x.key === seg.field_key)?.label;
              return (
                <div className="segsaved-row" key={seg.id}>
                  <span className="segsaved-ic"><Icon name="filter" size={15} /></span>
                  <span className="segsaved-main">
                    <span className="segsaved-nm">{seg.name}</span>
                    <span className="segsaved-sub">{describeFilter(f, lbl)}</span>
                  </span>
                  <Badge tone={list.length > 0 ? "green" : "gray"}>{list.length}</Badge>
                  <span className="row" style={{ gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => setFilter(f)}>Abrir</button>
                    <Menu
                      items={[
                        { label: "Copiar e-mails", onClick: () => copyEmails(list) },
                        { label: "Exportar CSV", onClick: () => exportList(list, seg.name) },
                        { label: "Excluir segmento", danger: true, onClick: () => setRemoving(seg) },
                      ]}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {saving && (
        <Modal
          title="Salvar segmento"
          onClose={() => setSaving(false)}
          width={420}
          footer={
            <>
              <button className="btn" onClick={() => setSaving(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submitSave}>Salvar</button>
            </>
          }
        >
          <Field label="Nome do segmento" error={nameErr} style={{ marginBottom: 6 }}>
            <input
              className="input"
              placeholder='Ex.: "Confirmados vindos da LP"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitSave()}
            />
          </Field>
          <p className="field-hint" style={{ margin: 0 }}>
            Recorte atual: <b>{matched.length}</b> inscrito{matched.length === 1 ? "" : "s"} ·{" "}
            {describeFilter(filter, fieldLabel)}
          </p>
        </Modal>
      )}
      {removing && (
        <ConfirmDialog
          title={`Excluir “${removing.name}”?`}
          message="Só o filtro salvo é removido — nenhum inscrito é afetado."
          confirmLabel="Excluir"
          tone="danger"
          icon="trash"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeSegment(removing.id);
            setRemoving(null);
            toast("Segmento excluído");
          }}
        />
      )}
    </div>
  );
}
