"use client";

/* Importar tarefas do ClickUp para o checklist — cascata em 3 passos:
   workspace (team) → space → lista → importa as tarefas da lista escolhida
   como itens do checklist do evento selecionado. A chamada passa pelo proxy
   /api/clickup (token no header, sem CORS). O grupo do checklist vira o nome
   da lista; o prazo vem do due_date do ClickUp.

   A cascata é feita nos handlers de onChange (não em effects) — buscar em
   resposta à escolha do usuário é o padrão recomendado do React. */
import { useEffect, useState } from "react";
import { Field, Icon, Modal, useToast } from "@/components/app/kit";
import { importTasks, useDb, type TaskImportDraft } from "@/lib/db";

type CuNamed = { id: string | number; name?: string };
type CuList = { id: string; name?: string; folder?: string };
type CuTask = { id?: string; name?: string; due_date?: string | number | null };

async function callClickup(body: Record<string, string>): Promise<unknown[]> {
  const res = await fetch("/api/clickup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown[]; error?: string } | null;
  if (!res.ok || !json?.data) throw new Error(json?.error ?? "Falha ao falar com o ClickUp");
  return json.data;
}

/** due_date do ClickUp (ms epoch em string) → YYYY-MM-DD; null se ausente/inválido. */
function dueToDate(due: string | number | null | undefined): string | null {
  if (due == null || due === "") return null;
  const ms = Number(due);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function ClickupImportModal({ eventId, eventName, onClose }: {
  eventId: string;
  eventName: string;
  onClose: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const token = db.settings.clickup_token ?? "";

  const [teams, setTeams] = useState<CuNamed[]>([]);
  const [teamId, setTeamId] = useState("");
  const [spaces, setSpaces] = useState<CuNamed[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [lists, setLists] = useState<CuList[]>([]);
  const [listId, setListId] = useState("");
  const [busy, setBusy] = useState<"teams" | "spaces" | "lists" | "import" | null>("teams");
  const [error, setError] = useState("");

  // Passo 1: carrega os workspaces ao abrir (auto-seleciona/expande se houver só um).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const teamsData = (await callClickup({ resource: "teams", token })) as CuNamed[];
        if (!active) return;
        setTeams(teamsData);
        if (teamsData.length === 0) {
          setError("Conectado, mas nenhum workspace foi encontrado.");
          setBusy(null);
          return;
        }
        if (teamsData.length !== 1) {
          setBusy(null);
          return;
        }
        const tid = String(teamsData[0].id);
        setTeamId(tid);
        setBusy("spaces");
        const spacesData = (await callClickup({ resource: "spaces", token, teamId: tid })) as CuNamed[];
        if (!active) return;
        setSpaces(spacesData);
        setBusy(null);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Falha ao carregar");
          setBusy(null);
        }
      }
    })();
    return () => { active = false; };
  }, [token]);

  // Passo 2: escolher o workspace busca os spaces.
  const onPickTeam = async (tid: string) => {
    setTeamId(tid);
    setSpaces([]); setSpaceId(""); setLists([]); setListId(""); setError("");
    if (!tid) return;
    setBusy("spaces");
    try {
      const data = (await callClickup({ resource: "spaces", token, teamId: tid })) as CuNamed[];
      setSpaces(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar spaces");
    } finally {
      setBusy(null);
    }
  };

  // Passo 3: escolher o space busca as listas.
  const onPickSpace = async (sid: string) => {
    setSpaceId(sid);
    setLists([]); setListId(""); setError("");
    if (!sid) return;
    setBusy("lists");
    try {
      const data = (await callClickup({ resource: "lists", token, spaceId: sid })) as CuList[];
      setLists(data);
      if (data.length === 0) setError("Esse space não tem listas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar listas");
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    if (!listId) return;
    setBusy("import");
    setError("");
    try {
      const tasks = (await callClickup({ resource: "tasks", token, listId })) as CuTask[];
      const listName = lists.find((l) => String(l.id) === listId)?.name ?? "ClickUp";
      const drafts: TaskImportDraft[] = tasks
        .filter((t) => (t.name ?? "").trim())
        .map((t) => ({
          title: (t.name ?? "").trim(),
          group: listName,
          due_date: dueToDate(t.due_date),
        }));
      if (drafts.length === 0) {
        setError("Essa lista não tem tarefas para importar.");
        return;
      }
      const { added, skipped } = importTasks(eventId, drafts);
      toast(
        added > 0
          ? `${added} tarefa${added === 1 ? "" : "s"} importada${added === 1 ? "" : "s"} do ClickUp` +
            (skipped > 0 ? ` · ${skipped} já existia${skipped === 1 ? "" : "m"}` : "")
          : "Todas as tarefas dessa lista já estavam no checklist"
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
      title="Importar tarefas do ClickUp"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={doImport}
            disabled={!listId || busy !== null}
          >
            {busy === "import" ? "Importando..." : "Importar para o checklist"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        As tarefas da lista escolhida entram no checklist de <b>{eventName}</b>, agrupadas pelo
        nome da lista. Tarefas com o mesmo título são puladas — dá para rodar de novo.
      </p>

      <Field label="Workspace">
        <select
          className="input"
          value={teamId}
          onChange={(e) => onPickTeam(e.target.value)}
          disabled={busy === "teams" || teams.length === 0}
        >
          <option value="">{busy === "teams" ? "Carregando..." : "Selecione o workspace"}</option>
          {teams.map((t) => (
            <option key={String(t.id)} value={String(t.id)}>{t.name ?? `Team ${t.id}`}</option>
          ))}
        </select>
      </Field>

      <Field label="Space">
        <select
          className="input"
          value={spaceId}
          onChange={(e) => onPickSpace(e.target.value)}
          disabled={!teamId || busy === "spaces" || spaces.length === 0}
        >
          <option value="">{busy === "spaces" ? "Carregando..." : "Selecione o space"}</option>
          {spaces.map((s) => (
            <option key={String(s.id)} value={String(s.id)}>{s.name ?? `Space ${s.id}`}</option>
          ))}
        </select>
      </Field>

      <Field label="Lista">
        <select
          className="input"
          value={listId}
          onChange={(e) => setListId(e.target.value)}
          disabled={!spaceId || busy === "lists" || lists.length === 0}
        >
          <option value="">{busy === "lists" ? "Carregando..." : "Selecione a lista"}</option>
          {lists.map((l) => (
            <option key={String(l.id)} value={String(l.id)}>
              {l.folder ? `${l.folder} / ${l.name ?? l.id}` : (l.name ?? `Lista ${l.id}`)}
            </option>
          ))}
        </select>
      </Field>

      {error && <p className="field-err" style={{ marginTop: 0 }}>{error}</p>}

      <p style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 6, marginBottom: 0 }}>
        <Icon name="bolt" size={13} /> O prazo (due date) de cada tarefa do ClickUp vira o prazo no
        checklist, e a fase (pré/durante/pós) é deduzida em relação à data do evento.
      </p>
    </Modal>
  );
}
