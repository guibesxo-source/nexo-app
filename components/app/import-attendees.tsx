"use client";

/* Importar lista de inscritos via CSV (FR-C1) — lê o arquivo no client,
   mapeia colunas pelo cabeçalho (mesmo formato do CSV exportado) e valida
   linha a linha com o schema Zod antes do bulk insert. */
import { useRef, useState } from "react";
import { Icon, Modal, useToast } from "@/components/app/kit";
import { importAttendees, type AttendeeDraft } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { attendeeSchema } from "@/lib/validations/attendee";
import type { AttendeeStatus, TicketType } from "@/types";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function mapTicket(v: string): TicketType {
  const n = norm(v);
  if (n.includes("vip")) return "VIP";
  if (n.includes("pro")) return "Pro";
  return "Geral";
}

export function mapStatus(v: string): AttendeeStatus {
  const n = norm(v);
  if (n.includes("check")) return "checkin";
  if (n.includes("confirm")) return "confirmado";
  if (n.includes("cancel")) return "cancelado";
  return "pendente";
}

const HEADER_KEYS: Record<string, string[]> = {
  name: ["nome", "nome completo", "name", "participante"],
  email: ["email", "e-mail"],
  company: ["empresa", "company", "organizacao"],
  ticket: ["ingresso", "tipo de ingresso", "ticket"],
  status: ["status", "situacao"],
};

type Parsed = { fileName: string; drafts: AttendeeDraft[]; invalid: number };

function rowsToDrafts(rows: string[][]): { drafts: AttendeeDraft[]; invalid: number } {
  if (rows.length === 0) return { drafts: [], invalid: 0 };

  // Com cabeçalho: mapeia colunas pelo nome. Sem cabeçalho (1ª linha já tem
  // um email): assume a ordem do CSV exportado — Nome;Email;Empresa;Ingresso;Status.
  const head = rows[0].map(norm);
  const hasHeader = !rows[0].some((c) => c.includes("@"));
  const col = (key: string, fallback: number) => {
    if (!hasHeader) return fallback;
    const idx = head.findIndex((h) => HEADER_KEYS[key].includes(h));
    return idx === -1 ? fallback : idx;
  };
  const ix = {
    name: col("name", 0),
    email: col("email", 1),
    company: col("company", 2),
    ticket: col("ticket", 3),
    status: col("status", 4),
  };

  const drafts: AttendeeDraft[] = [];
  let invalid = 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const parsed = attendeeSchema.safeParse({
      name: row[ix.name] ?? "",
      email: row[ix.email] ?? "",
      company: row[ix.company] ?? "",
      ticket: mapTicket(row[ix.ticket] ?? ""),
      status: mapStatus(row[ix.status] ?? ""),
    });
    if (parsed.success) drafts.push(parsed.data);
    else invalid++;
  }
  return { drafts, invalid };
}

export function ImportAttendeesModal({ eventId, onClose }: {
  eventId: string; onClose: () => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState("");

  const readFile = async (file: File) => {
    setError("");
    try {
      const { drafts, invalid } = rowsToDrafts(parseCsv(await file.text()));
      if (drafts.length === 0) {
        setParsed(null);
        setError("Nenhuma linha válida encontrada — confira se o arquivo tem nome e email.");
        return;
      }
      setParsed({ fileName: file.name, drafts, invalid });
    } catch {
      setError("Não consegui ler esse arquivo. Exporte como CSV e tente de novo.");
    }
  };

  const submit = () => {
    if (!parsed) return;
    const { added, skipped } = importAttendees(eventId, parsed.drafts);
    toast(
      added > 0
        ? `${added} inscrito${added === 1 ? "" : "s"} importado${added === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} já existia${skipped === 1 ? "" : "m"}` : "")
        : "Todos os inscritos do arquivo já estavam na lista"
    );
    onClose();
  };

  return (
    <Modal
      title="Importar inscritos (CSV)"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={!parsed}>
            {parsed ? `Importar ${parsed.drafts.length} inscritos` : "Importar"}
          </button>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
      />
      <button
        type="button"
        className="dropzone"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) readFile(f);
        }}
      >
        <Icon name="upload" size={20} />
        {parsed ? (
          <span><b>{parsed.fileName}</b> — clique para trocar o arquivo</span>
        ) : (
          <span>Arraste um CSV aqui ou <b>clique para escolher</b></span>
        )}
      </button>

      {error && <p className="field-err" style={{ marginTop: 10 }}>{error}</p>}

      {parsed && (
        <div className="import-summary">
          <Icon name="check" size={15} />
          <span>
            <b>{parsed.drafts.length}</b> linha{parsed.drafts.length === 1 ? "" : "s"} pronta
            {parsed.drafts.length === 1 ? "" : "s"} para importar
            {parsed.invalid > 0 && <> · {parsed.invalid} ignorada{parsed.invalid === 1 ? "" : "s"} (sem nome/email válidos)</>}
          </span>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 0 }}>
        Formato esperado: colunas <b>Nome</b>, <b>Email</b>, <b>Empresa</b>, <b>Ingresso</b> e{" "}
        <b>Status</b> — o mesmo do CSV exportado pelo Nexo. Emails repetidos no evento são pulados.
      </p>
    </Modal>
  );
}
