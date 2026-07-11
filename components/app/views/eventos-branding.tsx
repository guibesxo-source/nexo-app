"use client";

/* Capas & branding — a cara de cada evento num lugar só: troca de capa
   (paleta da marca ou imagem própria) e atalho para o material de marca
   do evento (mídia kit e criativos, os mesmos da tela de Arquivos). */
import { useRef, useState } from "react";
import { Badge, Card, Empty, Icon, PageHead, useToast } from "@/components/app/kit";
import {
  EVENT_COVERS,
  EVENT_STATUS_META,
  eventFilesOf,
  updateEvent,
  useDb,
} from "@/lib/db";
import { useGo } from "@/components/app/shell";
import { compressImage } from "@/lib/files";
import { fmtDateShort } from "@/lib/format";

export function EventosBranding() {
  const db = useDb();
  const go = useGo();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);

  const events = db.events.filter((e) => e.status !== "cancelado");
  const customCount = events.filter((e) => e.cover.startsWith("url(")).length;

  const pickUpload = (eventId: string) => {
    uploadFor.current = eventId;
    fileRef.current?.click();
  };

  const onFile = async (file: File) => {
    const eventId = uploadFor.current;
    uploadFor.current = null;
    if (!eventId) return;
    if (!file.type.startsWith("image/")) {
      toast("Escolha uma imagem (JPG/PNG)");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, 1600, 0.82);
      updateEvent(eventId, { cover: `url("${dataUrl}")` });
      toast("Capa atualizada");
    } catch {
      toast("Não consegui ler essa imagem");
    } finally {
      setBusy(false);
    }
  };

  if (events.length === 0) {
    return (
      <div className="view">
        <PageHead title="Capas & branding" sub="Nenhum evento criado ainda" />
        <Empty icon="image" title="Crie um evento primeiro" sub="Cada evento ganha capa e material de marca." />
      </div>
    );
  }

  return (
    <div className="view">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <PageHead
        title="Capas & branding"
        sub={`${events.length} evento${events.length === 1 ? "" : "s"} · ${customCount} com capa própria`}
        actions={
          <button className="btn" onClick={() => go("arquivos")}>
            <Icon name="paperclip" size={15} />Arquivos do evento
          </button>
        }
      />

      <div className="brand-grid">
        {events.map((ev) => {
          const files = eventFilesOf(db, ev.id);
          const brandFiles = files.filter((f) => f.category === "midia-kit" || f.category === "criativos");
          const status = EVENT_STATUS_META[ev.status];
          const isCustom = ev.cover.startsWith("url(");

          return (
            <Card key={ev.id} pad0>
              <div
                className="brand-cover"
                style={
                  isCustom
                    ? { backgroundImage: ev.cover, backgroundSize: "cover", backgroundPosition: "center" }
                    : { backgroundImage: ev.cover }
                }
              >
                <span className="brand-cover-tag">
                  <Badge tone={status.tone} dot>{status.label}</Badge>
                </span>
              </div>
              <div className="brand-body">
                <div className="brand-nm">{ev.name}</div>
                <div className="brand-sub">
                  {fmtDateShort(ev.starts_at)} · {isCustom ? "capa própria" : "capa da paleta"}
                </div>

                <div className="brand-swatches">
                  {EVENT_COVERS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={"brand-swatch" + (ev.cover === c.css ? " active" : "")}
                      style={{ backgroundImage: c.css }}
                      title={c.name}
                      aria-pressed={ev.cover === c.css}
                      onClick={() => {
                        updateEvent(ev.id, { cover: c.css });
                        toast(`Capa “${c.name}” aplicada`);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className={"brand-swatch upload" + (isCustom ? " active" : "")}
                    title="Subir imagem de capa"
                    disabled={busy}
                    onClick={() => pickUpload(ev.id)}
                  >
                    <Icon name="upload" size={14} />
                  </button>
                </div>

                <div className="brand-files">
                  <span className="brand-files-k">
                    <Icon name="image" size={14} />
                    Material de marca
                  </span>
                  {brandFiles.length > 0 ? (
                    <span className="brand-files-v">
                      {brandFiles.length} arquivo{brandFiles.length === 1 ? "" : "s"} (mídia kit / criativos)
                    </span>
                  ) : (
                    <span className="brand-files-v dim">nenhum arquivo ainda</span>
                  )}
                  <button className="btn btn-sm" onClick={() => go("arquivos")}>
                    {brandFiles.length > 0 ? "Abrir" : "Adicionar"}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="field-hint" style={{ marginTop: 14 }}>
        A capa aparece nos cards de Eventos, na busca e no calendário. Logos, manual de marca e
        peças de anúncio ficam em Arquivos → Mídia kit / Criativos.
      </p>
    </div>
  );
}
