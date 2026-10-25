import type { ReactNode } from "react";
import { Package } from "lucide-react";
import { navIconFor, type NavIcon } from "@/components/layout/navigation";
import styles from "./PageTitle.module.css";

interface PageTitleProps {
  path?: string;
  icon?: NavIcon;
  className?: string;
  children: ReactNode;
}

export function PageTitle({ path, icon, className, children }: PageTitleProps) {
  const Icon = icon ?? (path ? navIconFor(path) : undefined) ?? Package;
  return (
    <h1 className={className ? `${styles.title} ${className}` : styles.title}>
      <span className={styles.icon}>
        <Icon size={17} />
      </span>
      <span className={styles.text}>{children}</span>
    </h1>
  );
}
