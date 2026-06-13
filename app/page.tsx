import Link from "next/link";
import { InteractiveHome } from "@/components/home/interactive-home";
import styles from "@/components/home/interactive-home.module.css";

// Home provisória: a LP pública continua no repo do protótipo até a migração.
export default function Home() {
  return (
    <InteractiveHome>
      <span className={styles.eyebrow}>Beta privado em construção</span>

      <h1 className={styles.title}>
        O hub que faz os seus eventos{" "}
        <span className={styles.highlight}>acontecerem</span>
      </h1>

      <p className={styles.subtitle}>
        Financeiro, checklist e inscritos num só painel, em tempo real.
      </p>

      <div className={styles.actions}>
        <Link href="/dashboard" className={styles.primaryAction}>
          Abrir o app (demo)
        </Link>
      </div>

      <ul className={styles.signalStrip} aria-label="Áreas conectadas no Nexo">
        <li>Inscritos</li>
        <li>Checklist</li>
        <li>Financeiro</li>
        <li>Equipe</li>
      </ul>
    </InteractiveHome>
  );
}
