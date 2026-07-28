import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import styles from "./NotFound.module.css";

export const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>404</h1>
        <p className={styles.subtitle}>Oops! Página no encontrada</p>
        <Link to="/pos" className={styles.link}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
};
