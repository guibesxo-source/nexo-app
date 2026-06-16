"use client";

/* Conectar ao HubSpot e puxar inscritos — fluxo em dois passos: Private App
   token → lista de formulários do portal → importar as submissões do form
   escolhido como inscritos do evento ativo. A chamada passa pelo proxy
   /api/hubspot (token no header Bearer, sem CORS).

   ⚠️ Use o token do portal PESSOAL do Nexo (51566439) — nunca o da Prolog. */
import { useState } from "react";
import { Badge, Field, Icon, Modal, useToast } from "@/components/app/kit";
import { importAttendees, setHubspotToken, useDb, type AttendeeDraft } from "@/lib/db";
import { attendeeSchema } from "@/lib/validations/attendee";
import { mapTicket } from "@/components/app/import-attendees";
import { fmtDate } from "@/lib/format";

type HubspotForm = {
  id: string;
  name?: string;
  formType?: string;
  archived?: boolean;
  updatedAt?: string;
};

type HubspotSubmission = {
  submittedAt?: number;
  values?: { name?: string; value?: string }[];
};

async function callHubspot(body: Record<string, string>): Promise<unknown[]> {
  const res = await fetch("/api/hubspot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown[]; error?: string } | null;
  if (!res.ok || !json?.data) throw new Error(json?.error ?? "Falha ao falar com o HubSpot");
  return json.data;
}

/** Submissão do form → inscrito: casa os campos pelo nome interno do HubSpot. */
function submittedAtIso(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const d = new Date(value < 10000000000 ? value * 1000 : value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function toDrafts(submissions: HubspotSubmission[]): AttendeeDraft[] {
  const drafts: AttendeeDraft[] = [];
  for (const s of submissions) {
    const v = new Map((s.values ?? []).map((x) => [(x.name ?? "").toLowerCase(), x.value ?? ""]));
    const name =
      [v.get("firstname"), v.get("lastname")].filter(Boolean).join(" ") ||
      v.get("fullname") ||
      v.get("name") ||
      "";
    const parsed = attendeeSchema.safeParse({
      name,
      email: v.get("email") ?? "",
      company: v.get("company") ?? "",
      ticket: mapTicket(v.get("ticket") ?? v.get("ingresso") ?? ""),
      status: "pendente",
    });
    if (parsed.success) drafts.push({ ...parsed.data, created_at: submittedAtIso(s.submittedAt) });
  }
  return drafts;
}

export function HubspotImportModal({ eventId, eventName, onClose }: {
  eventId: string; eventName: string; onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [token, setToken] = useState(db.settings.hubspot_token ?? "");
  const [forms, setForms] = useState<HubspotForm[] | null>(null);
  const [busy, setBusy] = useState<"connect" | string | null>(null);
  const [error, setError] = useState("");

  const connect = async () => {
    const t = token.trim();
    if (t.length < 10) {
      setError("Cole o Private App token do HubSpot (Configurações → Integrações → Private Apps).");
      return;
    }
    setBusy("connect");
    setError("");
    try {
      const data = (await callHubspot({ resource: "forms", token: t })) as HubspotForm[];
      setHubspotToken(t);
      setForms(data);
      if (data.length === 0) setError("Conectado, mas nenhum formulário foi encontrado nesse portal.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar");
    } finally {
      setBusy(null);
    }
  };

  const importFrom = async (form: HubspotForm) => {
    setBusy(form.id);
    setError("");
    try {
      const submissions = (await callHubspot({
        resource: "submissions",
        token: token.trim(),
        formId: form.id,
      })) as HubspotSubmission[];
      const drafts = toDrafts(submissions);
      if (drafts.length === 0) {
        setError("Esse formulário não tem submissões com email válido.");
        return;
      }
      const { added, skipped } = importAttendees(eventId, drafts);
      toast(
        added > 0
          ? `${added} inscrito${added === 1 ? "" : "s"} puxado${added === 1 ? "" : "s"} do HubSpot` +
            (skipped > 0 ? ` · ${skipped} já existia${skipped === 1 ? "" : "m"}` : "")
          : "Todas as submissões do HubSpot já estavam na lista"
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title="Puxar inscritos do HubSpot"
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        As submissões do formulário escolhido entram como inscritos de <b>{eventName}</b>.
        Emails repetidos são pulados — dá para rodar de novo para sincronizar.
      </p>

      <Field label="Private App token do HubSpot">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            type="password"
            placeholder="Cole o token aqui (pat-na…)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus={!token}
          />
          <button
            className="btn btn-dark"
            onClick={connect}
            disabled={busy !== null}
            style={{ flexShrink: 0 }}
          >
            <Icon name="link" size={15} />
            {busy === "connect" ? "Conectando..." : forms ? "Atualizar" : "Conectar"}
          </button>
        </div>
      </Field>

      {error && <p className="field-err" style={{ marginTop: 0 }}>{error}</p>}

      {forms && forms.length > 0 && (
        <div className="import-list">
          {forms.map((form) => (
            <div className="import-row" key={form.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">{form.name ?? `Formulário ${form.id}`}</div>
                <div className="sub">
                  {form.updatedAt ? `atualizado ${fmtDate(form.updatedAt.slice(0, 10))}` : "sem data"}
                  {form.archived && <> · <Badge tone="gray">arquivado</Badge></>}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => importFrom(form)}
                disabled={busy !== null}
              >
                {busy === form.id ? "Importando..." : "Importar inscritos"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!forms && (
        <p style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 0 }}>
          O token fica salvo neste navegador. Para gerar um: HubSpot → Configurações →{" "}
          <b>Integrações → Private Apps</b> → crie um app com o escopo <b>forms</b>.
        </p>
      )}
    </Modal>
  );
}
