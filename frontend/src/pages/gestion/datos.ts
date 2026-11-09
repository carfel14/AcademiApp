import { useEffect, useState } from "react";
import { api } from "../../services/api";

export const date = (value?: string | null) => value?.slice(0, 10) ?? "—";
export const time = (value: string) => value.match(/\d{2}:\d{2}/)?.[0] ?? "—";
export const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./, ch => ch.toUpperCase());
export const money = (value: number) => `C$ ${Number(value).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const options = (values: string[]) => values.map(value => ({ value, label: label(value) }));
export const message = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

export function useData<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ path: string; version: number; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    let current = true;
    api<T>(path).then(data => {
      if (current) setResult({ path, version, data });
    }).catch(error => {
      if (current) setResult({ path, version, error: message(error) });
    });
    return () => { current = false; };
  }, [path, version]);
  return {
    data: path && result?.path === path ? result.data : undefined,
    error: path && result?.path === path && version === result.version ? result.error : undefined,
    loading: Boolean(path && (result?.path !== path || result.version !== version)),
    reload: () => setVersion(n => n + 1),
  };
}
