import { api } from "./client";

export type PrinterConnType = "net" | "usb" | "bluetooth";
export type PrinterProfile = "escpos" | "star_line";
export type PrinterRole = "receipt" | "kitchen" | "both";
export type PrinterCutType = "full" | "partial";
export type SetDefaultRole = "receipt" | "kitchen";

export interface Printer {
  id: string;
  store_id: string;
  name: string;
  connection_type: PrinterConnType;
  address: string;
  port: number | null;
  paper_width: number;
  profile: PrinterProfile;
  codepage: string;
  auto_cut: boolean;
  cut_type: PrinterCutType | null;
  open_cash_drawer: boolean;
  default_copies: number;
  role: PrinterRole;
  is_default: boolean;
  is_active: boolean;
  last_status: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrintJobResult {
  message?: string;
  success: boolean;
  bytes_sent: number;
  duration_ms: number;
  error?: string;
  target?: { address: string; port: number; protocol: string };
  ticket_bytes?: number;
  hint?: string;
  indices_tested?: number[];
}

export interface DeleteResult {
  message: string;
}

export interface CreatePrinterPayload {
  name: string;
  connection_type: PrinterConnType;
  address: string;
  port: number | null;
  role: PrinterRole;
  paper_width: number;
  profile?: PrinterProfile;
  codepage?: string;
  auto_cut?: boolean;
  cut_type?: PrinterCutType | null;
  open_cash_drawer?: boolean;
  default_copies?: number;
  is_default?: boolean;
  is_active?: boolean;
}

export type UpdatePrinterPayload = Partial<CreatePrinterPayload>;

export interface TestPrintPayload {
  copies?: number;
}

export const printersApi = {
  list: () => api.get<{ printers: Printer[] }>("/printers"),

  getById: (id: string) => api.get<Printer>(`/printers/${id}`),

  create: (data: CreatePrinterPayload) => api.post<Printer>("/printers", data),

  update: (id: string, data: UpdatePrinterPayload) => api.patch<Printer>(`/printers/${id}`, data),

  delete: (id: string) => api.delete<DeleteResult>(`/printers/${id}`),

  setDefault: (id: string, role: SetDefaultRole) =>
    api.post<Printer>(`/printers/${id}/set-default`, { role }),

  testPrint: (id: string, copies: number = 1) =>
    api.post<PrintJobResult>(`/printers/${id}/test`, { copies }),

  probe: (id: string) => api.post<PrintJobResult>(`/printers/${id}/probe`, {}),

  printReceipt: (id: string, saleId: string, copies: number = 1, currency: string = "NIO") =>
    api.post<PrintJobResult>(`/printers/${id}/print-receipt`, { sale_id: saleId, copies, currency }),
};
