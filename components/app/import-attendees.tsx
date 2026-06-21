"use client";

/* Importar lista de inscritos (FR-C1) — importação inteligente.
   Aceita CSV/TSV e planilhas (xlsx/xls/ods/...), faz uma varredura de TODAS as
   colunas: mapeia nome/email/empresa/ingresso/data pelo cabeçalho (com sinônimos
   pt/en) e guarda o resto como campos de lead. Deduplica por email — dentro do
   próprio arquivo e contra os que já estão na base — e puxa só os novos. A data
   de inscrição do arquivo vira created_at, então a lista ordena por ordem de
   inscrição real (mesmo quem se inscreveu antes dos que já existem). */
import { useRef, useState } from "react";
import { Icon, Modal, useToast } from "@/components/app/kit";
import { attendeesOf, importAttendees, useDb, type AttendeeDraft } from "@/lib/db";
import { readTabularFile, ACCEPTED_IMPORT_EXTENSIONS } from "@/lib/spreadsheet";
import { attendeeSchema } from "@/lib/validations/attendee";
import type { AttendeeStatus, LeadField, TicketType } from "@/types";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** chave estável de lead a partir do cabeçalho ("Cargo / Função" → cargo_funcao). */
const slug = (s: string) =>
  norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "campo";

/** Preserva o nome real do ingresso do arquivo; só cai em "Geral" se vier vazio. */
export function mapTicket(v: string): TicketType {
  return v.trim() || "Geral";
}

export function mapStatus(v: string): AttendeeStatus {
  const n = norm(v);
  if (n.includes("check")) return "checkin";
  if (n.includes("confirm")) return "confirmado";
  if (n.includes("cancel")) return "cancelado";
  return "pendente";
}

/* Sinônimos de cabeçalho (pt/en) por campo conhecido. O que não casar com nenhum
   vira campo de lead — nada é descartado na varredura. */
const HEADER_KEYS: Record<string, string[]> = {
  name: ["nome", "nome completo", "name", "full name", "fullname", "participante", "nome do participante", "inscrito", "attendee"],
  firstname: ["primeiro nome", "first name", "firstname", "nome (primeiro)"],
  lastname: ["sobrenome", "last name", "lastname", "ultimo nome", "nome (sobrenome)"],
  email: ["email", "e-mail", "e mail", "email address", "endereco de email", "correio eletronico"],
  company: ["empresa", "company", "company name", "nome da empresa", "organizacao", "organizacão", "negocio"],
  ticket: ["ingresso", "tipo de ingresso", "ticket", "ticket type", "categoria", "lote", "tipo"],
  status: ["status", "situacao", "situação", "estado"],
  date: [
    "inscrito em", "data de inscricao", "data da inscricao", "data inscricao",
    "created_at", "create date", "created", "data de criacao", "data",
    "data e hora", "data/hora", "registration date", "signup date", "register date",
    "carimbo de data/hora", "carimbo de data e hora", "timestamp", "horario", "horário",
  ],
};

type Parsed = {
  fileName: string;
  drafts: AttendeeDraft[]; // já só os novos, em ordem de inscrição
  total: number; // linhas com email válido
  newCount: number;
  dupBase: number; // já estavam no evento
  dupFile: number; // repetidos dentro do arquivo
  invalid: number; // sem nome/email válidos
  mapped: { role: string; label: string }[];
  extraCols: string[]; // colunas guardadas como lead
  withDate: number; // novos com data de inscrição detectada
};

const ROLE_LABEL: Record<string, string> = {
  name: "Nome", email: "Email", company: "Empresa",
  ticket: "Ingresso", date: "Data de inscrição",
};

/** Converte datas de vários formatos em ISO; vazio = não reconhecida. */
function parseDate(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw);
    const d = new Date(raw.length === 10 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = br;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const isoLocal = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoLocal) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoLocal;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Índice da 1ª coluna cujo cabeçalho casa com os sinônimos do campo (-1 = não achou). */
const headerCol = (head: string[], key: string) =>
  head.findIndex((h) => HEADER_KEYS[key]?.includes(h));

/** Detecta por conteúdo a coluna que contém emails (fallback p/ cabeçalho exótico). */
function detectEmailCol(body: string[][]): number {
  const sample = body.slice(0, 25);
  const width = sample.reduce((m, r) => Math.max(m, r.length), 0);
  let best = -1;
  let bestHits = 0;
  for (let c = 0; c < width; c++) {
    const hits = sample.filter((r) => /@.+\./.test((r[c] ?? "").trim())).length;
    if (hits > bestHits) { bestHits = hits; best = c; }
  }
  return bestHits > 0 ? best : -1;
}

type RowsAnalysis = {
  drafts: AttendeeDraft[];
  invalid: number;
  mapped: { role: string; label: string }[];
  extraCols: string[];
};

function analyzeRows(rows: string[][]): RowsAnalysis {
  if (rows.length === 0) return { drafts: [], invalid: 0, mapped: [], extraCols: [] };

  const rawHead = rows[0];
  const head = rawHead.map(norm);
  // Sem cabeçalho (1ª linha já traz um email): assume a ordem do CSV exportado
  // pelo Nexo — Nome;Email;Empresa;Ingresso;Status;Inscrito em.
  const hasHeader = !rawHead.some((c) => c.includes("@"));
  const body = hasHeader ? rows.slice(1) : rows;

  const ix = hasHeader
    ? {
        name: headerCol(head, "name"),
        firstname: headerCol(head, "firstname"),
        lastname: headerCol(head, "lastname"),
        email: headerCol(head, "email"),
        company: headerCol(head, "company"),
        ticket: headerCol(head, "ticket"),
        status: headerCol(head, "status"),
        date: headerCol(head, "date"),
      }
    : { name: 0, firstname: -1, lastname: -1, email: 1, company: 2, ticket: 3, status: 4, date: 5 };

  // Email é obrigatório: se o cabeçalho não revelou, detecta pela cara dos dados.
  if (ix.email < 0) ix.email = detectEmailCol(body);
  // Nome: sem coluna mapeada nem primeiro/sobrenome, usa a 1ª coluna textual
  // que não seja o email nem outro campo conhecido (lista típica: nome na frente).
  if (ix.name < 0 && ix.firstname < 0 && ix.lastname < 0) {
    const taken = new Set([ix.email, ix.company, ix.ticket, ix.status, ix.date].filter((i) => i >= 0));
    const width = body.reduce((m, r) => Math.max(m, r.length), rawHead.length);
    for (let c = 0; c < width; c++) {
      if (taken.has(c)) continue;
      if (body.some((r) => /@.+\./.test((r[c] ?? "").trim()))) continue;
      if (body.some((r) => (r[c] ?? "").trim())) { ix.name = c; break; }
    }
  }

  // Colunas já consumidas por um campo conhecido — não viram lead.
  const consumed = new Set(
    [ix.name, ix.firstname, ix.lastname, ix.email, ix.company, ix.ticket, ix.status, ix.date]
      .filter((i) => i >= 0)
  );
  const extraIdx = hasHeader
    ? rawHead.map((_, i) => i).filter((i) => !consumed.has(i) && rawHead[i]?.trim())
    : [];

  const mapped: { role: string; label: string }[] = [];
  for (const role of ["name", "email", "company", "ticket", "date"] as const) {
    const i = ix[role];
    if (i >= 0) mapped.push({ role, label: hasHeader ? (rawHead[i]?.trim() || ROLE_LABEL[role]) : ROLE_LABEL[role] });
  }

  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
  const drafts: AttendeeDraft[] = [];
  let invalid = 0;

  for (const row of body) {
    if (row.every((c) => !c || !c.trim())) continue;

    const name =
      cell(row, ix.name) ||
      [cell(row, ix.firstname), cell(row, ix.lastname)].filter(Boolean).join(" ").trim();

    const parsed = attendeeSchema.safeParse({
      name,
      email: cell(row, ix.email),
      company: cell(row, ix.company),
      ticket: mapTicket(cell(row, ix.ticket)),
      status: mapStatus(cell(row, ix.status)),
    });
    if (!parsed.success) {
      invalid++;
      continue;
    }

    const lead_fields: LeadField[] = extraIdx
      .map((i) => ({
        key: `csv:${slug(rawHead[i])}`,
        label: rawHead[i].trim(),
        value: cell(row, i),
        source: "csv" as const,
        group: "lead" as const,
      }))
      .filter((f) => f.value);

    const created_at = parseDate(cell(row, ix.date));

    drafts.push({
      ...parsed.data,
      external_source: "csv",
      created_at,
      ...(lead_fields.length ? { lead_fields } : {}),
    });
  }

  return {
    drafts,
    invalid,
    mapped,
    extraCols: extraIdx.map((i) => rawHead[i].trim()),
  };
}

export function ImportAttendeesModal({ eventId, onClose }: {
  eventId: string; onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const readFile = async (file: File) => {
    setError("");
    setParsed(null);
    setScanning(true);
    try {
      const rows = await readTabularFile(file);
      const { drafts, invalid, mapped, extraCols } = analyzeRows(rows);
      if (drafts.length === 0) {
        setError("Nenhuma linha válida encontrada — confira se o arquivo tem colunas de nome e email.");
        return;
      }

      // Dedup: dentro do arquivo + contra os que já estão no evento. Só os novos.
      const existing = new Set(
        attendeesOf(db, eventId).map((a) => a.email.trim().toLowerCase())
      );
      const seen = new Set<string>();
      const fresh: AttendeeDraft[] = [];
      let dupBase = 0;
      let dupFile = 0;
      let withDate = 0;
      for (const d of drafts) {
        const key = d.email.trim().toLowerCase();
        if (existing.has(key)) { dupBase++; continue; }
        if (seen.has(key)) { dupFile++; continue; }
        seen.add(key);
        if (d.created_at) withDate++;
        fresh.push(d);
      }
      // Ordena por data de inscrição crescente; quem não tem data vai pro fim.
      fresh.sort((a, b) => {
        if (a.created_at && b.created_at) return a.created_at.localeCompare(b.created_at);
        if (a.created_at) return -1;
        if (b.created_at) return 1;
        return 0;
      });

      setParsed({
        fileName: file.name,
        drafts: fresh,
        total: drafts.length,
        newCount: fresh.length,
        dupBase,
        dupFile,
        invalid,
        mapped,
        extraCols,
        withDate,
      });
    } catch {
      setError("Não consegui ler esse arquivo. Aceito CSV, TSV e planilhas (xlsx, xls, ods).");
    } finally {
      setScanning(false);
    }
  };

  const submit = () => {
    if (!parsed || parsed.newCount === 0) return;
    const { added, skipped } = importAttendees(eventId, parsed.drafts);
    toast(
      added > 0
        ? `${added} novo${added === 1 ? "" : "s"} inscrito${added === 1 ? "" : "s"} importado${added === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} pulado${skipped === 1 ? "" : "s"}` : "")
        : "Todos os inscritos do arquivo já estavam na lista"
    );
    onClose();
  };

  const nothingNew = parsed != null && parsed.newCount === 0;

  return (
    <Modal
      title="Importar lista de inscritos"
      onClose={onClose}
      width={parsed ? 560 : undefined}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!parsed || nothingNew || scanning}
          >
            {parsed && !nothingNew
              ? `Importar ${parsed.newCount} novo${parsed.newCount === 1 ? "" : "s"}`
              : "Importar"}
          </button>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMPORT_EXTENSIONS}
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
      />
      <button
        type="button"
        className={"dropzone" + (scanning ? " is-scanning" : "")}
        onClick={() => !scanning && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && !scanning) readFile(f);
        }}
      >
        <Icon name={scanning ? "refresh" : "upload"} size={20} />
        {scanning ? (
          <span>Analisando o arquivo…</span>
        ) : parsed ? (
          <span><b>{parsed.fileName}</b> — clique para trocar o arquivo</span>
        ) : (
          <span>Arraste a lista aqui ou <b>clique para escolher</b></span>
        )}
      </button>

      {error && <p className="field-err" style={{ marginTop: 10 }}>{error}</p>}

      {parsed && (
        <>
          <div className="import-stats">
            <div className="import-stat new">
              <span className="n">{parsed.newCount}</span>
              <span className="l">novos a importar</span>
            </div>
            <div className="import-stat">
              <span className="n">{parsed.dupBase}</span>
              <span className="l">já na base</span>
            </div>
            <div className="import-stat">
              <span className="n">{parsed.dupFile}</span>
              <span className="l">repetidos no arquivo</span>
            </div>
            {parsed.invalid > 0 && (
              <div className="import-stat warn">
                <span className="n">{parsed.invalid}</span>
                <span className="l">sem nome/email</span>
              </div>
            )}
          </div>

          <div className="import-scan">
            <div className="import-scan-row">
              <Icon name="check" size={14} />
              <span>
                Colunas identificadas:{" "}
                {parsed.mapped.length > 0
                  ? parsed.mapped.map((m) => (
                      <span className="import-tag" key={m.role}>
                        {ROLE_LABEL[m.role]} <em>{m.label}</em>
                      </span>
                    ))
                  : <span style={{ color: "var(--dim)" }}>posição padrão do Nexo</span>}
              </span>
            </div>
            {parsed.extraCols.length > 0 && (
              <div className="import-scan-row">
                <Icon name="sparkle" size={14} />
                <span>
                  +{parsed.extraCols.length} campo{parsed.extraCols.length === 1 ? "" : "s"} de lead:{" "}
                  {parsed.extraCols.slice(0, 6).map((c) => (
                    <span className="import-tag soft" key={c}>{c}</span>
                  ))}
                  {parsed.extraCols.length > 6 && (
                    <span className="import-tag soft">+{parsed.extraCols.length - 6}</span>
                  )}
                </span>
              </div>
            )}
            <div className="import-scan-row">
              <Icon name="clock" size={14} />
              <span>
                {parsed.withDate > 0
                  ? `${parsed.withDate} com data de inscrição — entram em ordem de inscrição`
                  : "Sem data no arquivo — entram com a data de hoje"}
              </span>
            </div>
          </div>

          {nothingNew && (
            <p className="field-err" style={{ marginTop: 12 }}>
              Nenhum inscrito novo: todos do arquivo já estão na base.
            </p>
          )}
        </>
      )}

      <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 0 }}>
        Aceito <b>CSV, TSV e planilhas</b> (xlsx, xls, ods). Faço a varredura de
        todas as colunas, mapeio nome, email, empresa, ingresso e data, e guardo o
        resto como dados do lead. Emails repetidos — no arquivo ou já na base — ficam de fora.
      </p>
    </Modal>
  );
}
