"use client";

/* Arquivos do evento — central dos principais recursos (mídia kit, fotos,
   briefing, metas, documentos). Cada item é um link na nuvem (Drive, Dropbox,
   Figma…) ou um upload pequeno; tudo persiste no workspace (app_settings) e
   acompanha o evento selecionado. */
import { useRef, useState } from "react";
import { Empty, Field, Icon, Modal, PageHead, useToast } from "@/components/app/kit";
import { useUi } from "@/components/app/shell";
import {
  addEventFile,
  eventFilesOf,
  EVENT_FILE_CATEGORIES,
  eventFileCategoryMeta,
  removeEventFile,
  selectedEvent,
  updateEventFile,
  useDb,
  type EventFileDraft,
} from "@/lib/db";
import { compressImage, downloadDataUrl, fileToDataUrl } from "@/lib/files";
import { fmtDateShort } from "@/lib/format";
import type { EventFile, EventFileCategory } from "@/types";

const MAX_UPLOAD = 2 * 1024 * 1024; // ~2 MB — uploads grandes devem ir como link

function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

/* ---------- modal: adicionar / editar arquivo ---------- */

function FileFormModal({ eventId, edit, initialCategory, onClose }: {
  eventId: string;
  edit?: EventFile;
  initialCategory?: EventFileCategory;
  onClose: () => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<{
    category: EventFileCategory;
    title: string;
    url: string;
    file: { name: string; data: string } | null;
    note: string;
  }>({
    category: edit?.category ?? initialCategory ?? "midia-kit",
    title: edit?.title ?? "",
    url: edit?.url ?? "",
    file: edit?.file ?? null,
    note: edit?.note ?? "",
  });

  const pickFile = async (f: File) => {
    try {
      if (f.type.startsWith("image/")) {
        const data = await compressImage(f, 1600, 0.82);
        setForm((s) => ({ ...s, file: { name: f.name, data } }));
        return;
      }
      if (f.size > MAX_UPLOAD) {
        toast("Arquivo grande demais — use um link da nuvem");
        return;
      }
      const data = await fileToDataUrl(f);
      setForm((s) => ({ ...s, file: { name: f.name, data } }));
    } catch {
      toast("Não consegui ler esse arquivo");
    }
  };

  const save = () => {
    if (!form.title.trim()) {
      toast("Dê um nome ao arquivo");
      return;
    }
    if (!form.url.trim() && !form.file) {
      toast("Cole um link ou envie um arquivo");
      return;
    }
    const draft: EventFileDraft = {
      category: form.category,
      title: form.title,
      url: form.url,
      file: form.file,
      note: form.note,
    };
    if (edit) {
      updateEventFile(eventId, edit.id, draft);
      toast("Arquivo atualizado");
    } else {
      addEventFile(eventId, draft);
      toast("Arquivo adicionado");
    }
    onClose();
  };

  return (
    <Modal
      title={edit ? "Editar arquivo" : "Adicionar arquivo"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>
            <Icon name={edit ? "check" : "plus"} size={15} />{edit ? "Salvar" : "Adicionar"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Categoria">
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm((s) => ({ ...s, category: e.target.value as EventFileCategory }))}
          >
            {EVENT_FILE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Nome">
          <input
            className="input"
            placeholder="Ex.: Manual de marca, Fotos dia 1…"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            autoFocus
          />
        </Field>
      </div>

      <Field label="Link na nuvem">
        <input
          className="input"
          placeholder="https://drive.google.com/…  ·  Dropbox, Figma, Notion…"
          value={form.url}
          onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))}
        />
      </Field>

      <Field label="Ou envie um arquivo (pequeno)">
        <input
          ref={fileRef}
          type="file"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await pickFile(f);
          }}
        />
        {form.file ? (
          <div className="nf-file">
            <Icon name="paperclip" size={15} />
            <span className="nm" title={form.file.name}>{form.file.name}</span>
            <button type="button" className="row-action" title="Remover" onClick={() => setForm((s) => ({ ...s, file: null }))}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ) : (
          <button type="button" className="btn" style={{ width: "100%" }} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={15} />Enviar arquivo
          </button>
        )}
      </Field>

      <Field label="Observação (opcional)">
        <input
          className="input"
          placeholder="Uma nota rápida sobre este arquivo"
          value={form.note}
          onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
        />
      </Field>
    </Modal>
  );
}

/* ---------- card de arquivo ---------- */

function FileCard({ file, onOpen, onEdit, onRemove }: {
  file: EventFile; onOpen: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const meta = eventFileCategoryMeta(file.category);
  const source = file.url ? linkHost(file.url) : file.file ? file.file.name : "—";
  return (
    <div className="file-card">
      <button className="file-main" onClick={onOpen} title={file.url ? "Abrir link" : "Baixar arquivo"}>
        <span className="file-ic"><Icon name={meta.icon} size={18} /></span>
        <span className="file-meta">
          <span className="file-nm">{file.title}</span>
          <span className="file-sub">
            <Icon name={file.url ? "link" : "paperclip"} size={12} />
            <span className="ellip">{source}</span>
          </span>
          {file.note && <span className="file-note">{file.note}</span>}
        </span>
        <span className="file-open"><Icon name={file.url ? "chevRight" : "download"} size={15} /></span>
      </button>
      <div className="file-foot">
        <span className="file-cat">{meta.label} · {fmtDateShort(file.created_at)}</span>
        <span className="file-actions">
          <button className="row-action" title="Editar" onClick={onEdit}><Icon name="edit" size={14} /></button>
          <button className="row-action danger" title="Remover" onClick={onRemove}><Icon name="trash" size={14} /></button>
        </span>
      </div>
    </div>
  );
}

/* ---------- view ---------- */

export function EventFiles({ eventId }: { eventId?: string }) {
  const db = useDb();
  const toast = useToast();
  const { openNewEvent } = useUi();
  const [filter, setFilter] = useState<EventFileCategory | "todos">("todos");
  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<EventFileCategory | undefined>(undefined);
  const [editFile, setEditFile] = useState<EventFile | null>(null);

  const ev = eventId ? db.events.find((e) => e.id === eventId) : selectedEvent(db);

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Arquivos" sub="Nenhum evento criado ainda" />
        <Empty
          icon="paperclip"
          title="Crie um evento primeiro"
          sub="Os arquivos (mídia kit, fotos, briefing, metas) pertencem a um evento."
          action={<button className="btn btn-primary" onClick={openNewEvent}><Icon name="plus" size={15} />Novo evento</button>}
        />
      </div>
    );
  }

  const files = eventFilesOf(db, ev.id);
  const counts = new Map<EventFileCategory, number>();
  for (const f of files) counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
  const shown = filter === "todos" ? files : files.filter((f) => f.category === filter);

  const openFile = (f: EventFile) => {
    if (f.url) window.open(f.url, "_blank", "noopener,noreferrer");
    else if (f.file) downloadDataUrl(f.file.name, f.file.data);
  };
  const startAdd = (category?: EventFileCategory) => {
    setAddCategory(category);
    setAdding(true);
  };

  return (
    <div className="view">
      <PageHead
        eyebrow={ev.name}
        title="Arquivos"
        sub={files.length ? `${files.length} arquivo${files.length === 1 ? "" : "s"} · conectados à nuvem do workspace` : "Mídia kit, fotos, briefing e metas do evento"}
        actions={
          <button className="btn btn-primary" onClick={() => startAdd()}>
            <Icon name="plus" size={15} />Adicionar arquivo
          </button>
        }
      />

      <div className="file-cats">
        <button className={"chip" + (filter === "todos" ? " active" : "")} onClick={() => setFilter("todos")}>
          Todos {files.length > 0 && <span className="chip-count">{files.length}</span>}
        </button>
        {EVENT_FILE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={"chip" + (filter === c.id ? " active" : "")}
            onClick={() => setFilter(c.id)}
          >
            {c.label}
            {(counts.get(c.id) ?? 0) > 0 && <span className="chip-count">{counts.get(c.id)}</span>}
          </button>
        ))}
      </div>

      {files.length === 0 ? (
        <Empty
          icon="paperclip"
          title="Nenhum arquivo ainda"
          sub="Centralize o mídia kit, as fotos, o briefing e as metas — por link da nuvem ou upload."
          action={<button className="btn btn-primary" onClick={() => startAdd()}><Icon name="plus" size={15} />Adicionar o primeiro</button>}
        />
      ) : shown.length === 0 ? (
        <Empty
          icon={eventFileCategoryMeta(filter as EventFileCategory).icon}
          title={`Sem arquivos em ${eventFileCategoryMeta(filter as EventFileCategory).label}`}
          sub={eventFileCategoryMeta(filter as EventFileCategory).hint}
          action={
            <button className="btn btn-primary" onClick={() => startAdd(filter as EventFileCategory)}>
              <Icon name="plus" size={15} />Adicionar aqui
            </button>
          }
        />
      ) : (
        <div className="file-grid">
          {shown.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              onOpen={() => openFile(f)}
              onEdit={() => setEditFile(f)}
              onRemove={() => { removeEventFile(ev.id, f.id); toast("Arquivo removido"); }}
            />
          ))}
        </div>
      )}

      {adding && (
        <FileFormModal eventId={ev.id} initialCategory={addCategory} onClose={() => setAdding(false)} />
      )}
      {editFile && (
        <FileFormModal eventId={ev.id} edit={editFile} onClose={() => setEditFile(null)} />
      )}
    </div>
  );
}
