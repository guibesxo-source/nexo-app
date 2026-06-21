"use client";

/* Importa o backlog de inscritos do HubSpot via CSV (exportado do painel, sem
   API). Reaproveita o MESMO mapeamento do webhook (hubspotFormToDraft): cada
   linha vira campos {name,value} e o mapper extrai nome/email/empresa + UTM e
   campos extras como lead_fields. Dedup por email no evento. */
import { useRef, useState } from "react";
import { Icon, Modal, useToast } from "@/components/app/kit";
import { importAttendees, type AttendeeDraft } from "@/lib/db";
import { readTabularFile, ACCEPTED_IMPORT_EXTENSIONS } from "@/lib/spreadsheet";
import { hubspotFormToDraft } from "@/lib/integrations/hubspot-form";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Cabeçalhos comuns do export do HubSpot → nomes internos que o mapper entende.
// O que não estiver aqui passa direto e vira lead_field (UTM, campos custom...).
const HEADER_ALIAS: Record<string, string> = {
  "first name": "firstname", firstname: "firstname", "primeiro nome": "firstname",
  "last name": "lastname", lastname: "lastname", sobrenome: "lastname", "ultimo nome": "lastname",
  "full name": "fullname", fullname: "fullname", "nome completo": "fullname",
  name: "name", nome: "name", participante: "name",
  email: "email", "e-mail": "email", "email address": "email",
  company: "company", "company name": "company", empresa: "company",
  "nome da empresa": "company", organizacao: "company",
};

const DATE_HEADERS = new Set([
  "create date", "created at", "data de criacao", "data de inscricao",
  "data da inscricao", "inscrito em", "created_at",
]);

function parseDate(raw: string): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/);
  if (br) {
    const [, d, m, y, hh = "0", mm = "0"] = br;
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
  }
  const dt = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
}

type Parsed = { fileName: string; drafts: AttendeeDraft[]; invalid: number; extraFields: number };

function buildDrafts(rows: string[][]): Omit<Parsed, "fileName"> {
  if (rows.length < 2) return { drafts: [], invalid: 0, extraFields: 0 };
  const header = rows[0];
  const keys = header.map((h) => HEADER_ALIAS[norm(h)] ?? h.trim());
  const dateIdx = header.findIndex((h) => DATE_HEADERS.has(norm(h)));

  const drafts: AttendeeDraft[] = [];
  const extraKeys = new Set<string>();
  let invalid = 0;
  for (const row of rows.slice(1)) {
    if (row.every((c) => !c || !c.trim())) continue; // linha vazia
    const fields = keys
      .map((name, i) => ({ name, value: (row[i] ?? "").trim() }))
      .filter((_, i) => i !== dateIdx); // a data vira created_at, não lead_field
    const result = hubspotFormToDraft(fields);
    if (!result.ok) {
      invalid++;
      continue;
    }
    const created_at = dateIdx >= 0 ? parseDate(row[dateIdx]) : undefined;
    const draft: AttendeeDraft = { ...result.draft, created_at: created_at ?? result.draft.created_at };
    for (const f of draft.lead_fields ?? []) extraKeys.add(f.key);
    drafts.push(draft);
  }
  return { drafts, invalid, extraFields: extraKeys.size };
}

export function HubspotCsvImportModal({ eventId, eventName, onClose }: {
  eventId: string;
  eventName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState("");

  const readFile = async (file: File) => {
    setError("");
    try {
      const built = buildDrafts(await readTabularFile(file));
      if (built.drafts.length === 0) {
        setParsed(null);
        setError("Nenhuma linha com email válido — confira se exportou as submissões do formulário.");
        return;
      }
      setParsed({ fileName: file.name, ...built });
    } catch {
      setError("Não consegui ler esse arquivo. Aceito CSV e planilhas (xlsx, xls, ods).");
    }
  };

  const submit = () => {
    if (!parsed) return;
    const { added, skipped } = importAttendees(eventId, parsed.drafts);
    toast(
      added > 0
        ? `${added} inscrito${added === 1 ? "" : "s"} do HubSpot importado${added === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} já existia${skipped === 1 ? "" : "m"}` : "")
        : "Todos os inscritos do arquivo já estavam na lista"
    );
    onClose();
  };

  return (
    <Modal
      title="Importar inscritos atuais do HubSpot (CSV)"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Voltar</button>
          <button className="btn btn-primary" onClick={submit} disabled={!parsed}>
            {parsed ? `Importar ${parsed.drafts.length} inscritos` : "Importar"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        Exporte as <b>submissões do formulário</b> no HubSpot (Marketing → Formulários → seu form →
        exportar) e solte o CSV aqui. Os inscritos entram em <b>{eventName}</b> com o mesmo
        mapeamento do webhook — nome, empresa, UTM e campos extras. Emails repetidos são pulados.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMPORT_EXTENSIONS}
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
          <span><b>{parsed.fileName}</b> — clique para trocar</span>
        ) : (
          <span>Arraste o CSV do HubSpot aqui ou <b>clique para escolher</b></span>
        )}
      </button>

      {error && <p className="field-err" style={{ marginTop: 10 }}>{error}</p>}

      {parsed && (
        <div className="import-summary">
          <Icon name="check" size={15} />
          <span>
            <b>{parsed.drafts.length}</b> inscrito{parsed.drafts.length === 1 ? "" : "s"} pronto
            {parsed.drafts.length === 1 ? "" : "s"}
            {parsed.extraFields > 0 && <> · {parsed.extraFields} campo{parsed.extraFields === 1 ? "" : "s"} extra{parsed.extraFields === 1 ? "" : "s"} (UTM/lead)</>}
            {parsed.invalid > 0 && <> · {parsed.invalid} ignorado{parsed.invalid === 1 ? "" : "s"} (sem email)</>}
          </span>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 14, marginBottom: 0 }}>
        Dica: exporte as <b>submissões do formulário</b> (não a lista completa de contatos) pra vir
        só o que interessa. Depois, os novos inscritos entram sozinhos pelo webhook.
      </p>
    </Modal>
  );
}
