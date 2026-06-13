"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import styles from "./interactive-home.module.css";

type InteractiveHomeProps = {
  children: ReactNode;
};

const signalCards = [
  {
    className: styles.cardAttendees,
    label: "Inscritos",
    value: "312",
    meta: "78% confirmados",
    bars: [45, 66, 52, 76, 61, 88],
  },
  {
    className: styles.cardBudget,
    label: "Financeiro",
    value: "64%",
    meta: "orçamento usado",
    bars: [72, 58, 81, 67, 92, 74],
  },
  {
    className: styles.cardTasks,
    label: "Checklist",
    value: "24/31",
    meta: "tarefas prontas",
    bars: [36, 44, 59, 71, 83, 95],
  },
  {
    className: styles.cardTeam,
    label: "Equipe",
    value: "5",
    meta: "responsáveis ativos",
    bars: [82, 52, 69, 48, 73, 61],
  },
];

const nodes = [
  { className: styles.nodeNorth, label: "cadastro" },
  { className: styles.nodeEast, label: "pagamento" },
  { className: styles.nodeWest, label: "fornecedor" },
];

export function InteractiveHome({ children }: InteractiveHomeProps) {
  const sceneRef = useRef<HTMLElement>(null);
  const pointerRef = useRef({ clientX: 0, clientY: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const applyPointer = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    const rect = scene.getBoundingClientRect();
    const x = (pointerRef.current.clientX - rect.left) / rect.width;
    const y = (pointerRef.current.clientY - rect.top) / rect.height;
    const clampedX = Math.min(Math.max(x, 0), 1);
    const clampedY = Math.min(Math.max(y, 0), 1);

    scene.style.setProperty("--mx", `${(clampedX * 100).toFixed(2)}%`);
    scene.style.setProperty("--my", `${(clampedY * 100).toFixed(2)}%`);
    scene.style.setProperty("--px", (clampedX * 2 - 1).toFixed(4));
    scene.style.setProperty("--py", (clampedY * 2 - 1).toFixed(4));
    frameRef.current = null;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    pointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(applyPointer);
    }
  };

  const onPointerLeave = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.style.setProperty("--mx", "50%");
    scene.style.setProperty("--my", "45%");
    scene.style.setProperty("--px", "0");
    scene.style.setProperty("--py", "0");
  };

  return (
    <main
      className={styles.scene}
      ref={sceneRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className={styles.wordmark} aria-label="Nexo">
        <span className={styles.logoMark}>N</span>
        <span>Nexo</span>
      </div>

      <div className={styles.stage} aria-hidden="true">
        <div className={styles.grid} />
        <div className={styles.cursorLight} />
        <div className={styles.commandMap}>
          <span className={`${styles.ring} ${styles.ringOuter}`} />
          <span className={`${styles.ring} ${styles.ringMiddle}`} />
          <span className={`${styles.ring} ${styles.ringInner}`} />
          <span className={styles.scan} />

          {nodes.map((node) => (
            <span className={`${styles.mapNode} ${node.className}`} key={node.label}>
              <i />
              <b>{node.label}</b>
            </span>
          ))}
        </div>

        <div className={styles.paths}>
          <span className={`${styles.path} ${styles.pathOne}`} />
          <span className={`${styles.path} ${styles.pathTwo}`} />
          <span className={`${styles.path} ${styles.pathThree}`} />
          <span className={`${styles.path} ${styles.pathFour}`} />
        </div>

        {signalCards.map((card) => (
          <article className={`${styles.signalCard} ${card.className}`} key={card.label}>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.meta}</small>
            </div>
            <div className={styles.microChart}>
              {card.bars.map((bar, index) => (
                <i
                  key={`${card.label}-${bar}-${index}`}
                  style={
                    {
                      "--bar-height": `${bar}%`,
                      "--bar-delay": `${index * 90}ms`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className={styles.content}>{children}</section>
    </main>
  );
}
