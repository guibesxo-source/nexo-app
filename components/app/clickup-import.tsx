"use client";

/* Importar tarefas do ClickUp para o checklist — cascata:
   workspace (team) → space → pasta → lista/contêiner → projeto interno →
   importa subtarefas/checklist items do projeto escolhido como itens do
   checklist do evento selecionado. A chamada passa pelo proxy /api/clickup
   (token no header, sem CORS). O grupo do checklist vira o nome do projeto;
   o prazo vem do due_date do ClickUp.

   A cascata é feita nos handlers de onChange (não em effects) — buscar em
   resposta à escolha do usuário é o padrão recomendado do React. */
import { useEffect, useState } from "react";
import { Field, Icon, Modal, useToast } from "@/components/app/kit";
import { importTasks, useDb, type TaskImportDraft } from "@/lib/db";

type CuNamed = { id: string | number; name?: string };
type CuFolder = { id: string; name?: string; folderless?: boolean };
type CuList = { id: string; name?: string; folder?: string };
type CuChecklistItem = { id?: string; name?: string; due_date?: string | number | null };
type CuChecklist = { id?: string; name?: string; items?: CuChecklistItem[] };
type CuTask = {
  id?: string;
  name?: string;
  due_date?: string | number | null;
  parent?: string | null;
  subtasks?: CuTask[];
  checklists?: CuChecklist[];
};

const ALL_LIST_TASKS = "__all_list_tasks__";

async function callClickup<T = unknown[]>(body: Record<string, string>): Promise<T> {
  const res = await fetch("/api/clickup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { data?: unknown; error?: string } | null;
  if (!res.ok || !json || !("data" in json)) {
    throw new Error(json?.error ?? "Falha ao falar com o ClickUp");
  }
  return json.data as T;
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

function namedTask(t: CuTask): t is CuTask & { name: string } {
  return Boolean((t.name ?? "").trim());
}

function flattenSubtasks(tasks: CuTask[] | undefined): CuTask[] {
  const out: CuTask[] = [];
  const visit = (items: CuTask[] | undefined) => {
    for (const item of items ?? []) {
      out.push(item);
      visit(item.subtasks);
    }
  };
  visit(tasks);
  return out;
}

function taskDraft(task: CuTask, group: string): TaskImportDraft | null {
  const title = (task.name ?? "").trim();
  if (!title) return null;
  return { title, group, due_date: dueToDate(task.due_date) };
}

function projectDrafts(project: CuTask, projectName: string): TaskImportDraft[] {
  const drafts: TaskImportDraft[] = [];

  for (const checklist of project.checklists ?? []) {
    const checklistName = (checklist.name ?? "").trim();
    const group = checklistName ? `${projectName} · ${checklistName}` : projectName;
    for (const item of checklist.items ?? []) {
      const title = (item.name ?? "").trim();
      if (title) drafts.push({ title, group, due_date: dueToDate(item.due_date) });
    }
  }

  for (const subtask of flattenSubtasks(project.subtasks)) {
    const draft = taskDraft(subtask, projectName);
    if (draft) drafts.push(draft);
  }

  const ownTask = taskDraft(project, projectName);
  return drafts.length > 0 ? drafts : ownTask ? [ownTask] : [];
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
  const [folders, setFolders] = useState<CuFolder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [lists, setLists] = useState<CuList[]>([]);
  const [listId, setListId] = useState("");
  const [projects, setProjects] = useState<CuTask[]>([]);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState<"teams" | "spaces" | "folders" | "lists" | "projects" | "import" | null>("teams");
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
    setSpaces([]); setSpaceId(""); setFolders([]); setFolderId("");
    setLists([]); setListId(""); setProjects([]); setProjectId(""); setError("");
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

  // Passo 3: escolher o space busca as pastas.
  const onPickSpace = async (sid: string) => {
    setSpaceId(sid);
    setFolders([]); setFolderId(""); setLists([]); setListId("");
    setProjects([]); setProjectId(""); setError("");
    if (!sid) return;
    setBusy("folders");
    try {
      const data = (await callClickup({ resource: "folders", token, spaceId: sid })) as CuFolder[];
      setFolders(data);
      if (data.length === 0) setError("Esse space não tem pastas ou listas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar pastas");
    } finally {
      setBusy(null);
    }
  };

  // Passo 4: escolher a pasta busca os projetos/listas dentro dela.
  const onPickFolder = async (fid: string) => {
    setFolderId(fid);
    setLists([]); setListId(""); setProjects([]); setProjectId(""); setError("");
    if (!fid) return;
    setBusy("lists");
    try {
      const data = (await callClickup({
        resource: "lists",
        token,
        spaceId,
        folderId: fid,
      })) as CuList[];
      setLists(data);
      if (data.length === 0) setError("Essa pasta não tem listas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar listas");
    } finally {
      setBusy(null);
    }
  };

  // Passo 5: escolher a lista busca os projetos/tarefas dentro dela.
  const onPickList = async (lid: string) => {
    setListId(lid);
    setProjects([]); setProjectId(""); setError("");
    if (!lid) return;
    setBusy("projects");
    try {
      const data = (await callClickup<CuTask[]>({ resource: "tasks", token, listId: lid })).filter(namedTask);
      setProjects(data);
      if (data.length === 0) setError("Essa lista não tem projetos/tarefas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar projetos da lista");
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    if (!listId || !projectId) return;
    setBusy("import");
    setError("");
    try {
      const listName = lists.find((l) => String(l.id) === listId)?.name ?? "ClickUp";
      let drafts: TaskImportDraft[] = [];

      if (projectId === ALL_LIST_TASKS) {
        const tasks = (await callClickup<CuTask[]>({ resource: "tasks", token, listId })).filter(namedTask);
        drafts = tasks
          .map((t) => taskDraft(t, listName))
          .filter((d): d is TaskImportDraft => Boolean(d));
      } else {
        const project = await callClickup<CuTask>({ resource: "task", token, taskId: projectId });
        const projectName =
          projects.find((p) => String(p.id) === projectId)?.name?.trim() ||
          project.name?.trim() ||
          listName;
        drafts = projectDrafts(project, projectName);
      }

      if (drafts.length === 0) {
        setError("Esse projeto não tem tarefas para importar.");
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
            disabled={!listId || !projectId || busy !== null}
          >
            {busy === "import" ? "Importando..." : "Importar para o checklist"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 16 }}>
        Escolha a pasta, a lista onde ficam os projetos (ex.: Tracking) e depois o projeto do
        ClickUp. As tarefas entram no checklist de <b>{eventName}</b>, agrupadas pelo nome do projeto. Tarefas com o mesmo título são
        puladas — dá para rodar de novo.
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

      <Field label="Pasta">
        <select
          className="input"
          value={folderId}
          onChange={(e) => onPickFolder(e.target.value)}
          disabled={!spaceId || busy === "folders" || folders.length === 0}
        >
          <option value="">{busy === "folders" ? "Carregando..." : "Selecione a pasta"}</option>
          {folders.map((f) => (
            <option key={String(f.id)} value={String(f.id)}>{f.name ?? `Pasta ${f.id}`}</option>
          ))}
        </select>
      </Field>

      <Field label="Lista">
        <select
          className="input"
          value={listId}
          onChange={(e) => onPickList(e.target.value)}
          disabled={!folderId || busy === "lists" || lists.length === 0}
        >
          <option value="">{busy === "lists" ? "Carregando..." : "Selecione a lista"}</option>
          {lists.map((l) => (
            <option key={String(l.id)} value={String(l.id)}>
              {l.name ?? `Lista ${l.id}`}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Projeto">
        <select
          className="input"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!listId || busy === "projects" || projects.length === 0}
        >
          <option value="">{busy === "projects" ? "Carregando..." : "Selecione o projeto dentro da lista"}</option>
          {projects.length > 0 && <option value={ALL_LIST_TASKS}>Todas as tarefas da lista</option>}
          {projects.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {p.name ?? `Projeto ${p.id}`}
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
