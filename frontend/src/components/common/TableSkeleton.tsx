import { PAGE_LIMIT } from "@/lib/constants";
import s from "./Skeleton.module.css";

export interface SkeletonCol {
  width: string;
  align?: "left" | "right" | "center";
}

interface Props {
  cols: SkeletonCol[];
  rows?: number;
}

export default function TableSkeleton({ cols, rows = PAGE_LIMIT }: Props) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {cols.map((col, j) => (
            <td key={j} style={{ textAlign: col.align ?? "left", padding: "10px 16px" }}>
              <div
                className={s.bar}
                style={{
                  width: col.width,
                  marginLeft: col.align === "right" ? "auto" : undefined,
                  marginRight: col.align === "left" ? "auto" : undefined,
                  margin: col.align === "center" ? "0 auto" : undefined,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
