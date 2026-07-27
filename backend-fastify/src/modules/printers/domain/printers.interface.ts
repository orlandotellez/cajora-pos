import type { PrinterRole } from "./printers.types"
import type { IPrinterEntity, CreatePrinterData, UpdatePrinterData } from "./printers.entities"

export interface IPrinterRepository {
  findByStore(storeId: string): Promise<IPrinterEntity[]>
  findById(id: string, storeId: string): Promise<IPrinterEntity | null>
  findDefault(storeId: string, role: PrinterRole): Promise<IPrinterEntity | null>
  create(data: CreatePrinterData): Promise<IPrinterEntity>
  update(id: string, storeId: string, data: UpdatePrinterData): Promise<IPrinterEntity>
  clearDefaultForRole(storeId: string, role: PrinterRole, exceptId?: string): Promise<void>
  softDelete(id: string, storeId: string): Promise<IPrinterEntity>
  existsByName(storeId: string, name: string, exceptId?: string): Promise<boolean>
}
