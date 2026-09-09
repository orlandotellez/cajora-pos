import type { IInventoryMovementResponse } from "../../domain/inventory.types"
import type { IInventoryMovementEntity } from "../../domain/inventory.entities"

export function mapMovementToResponse(movement: IInventoryMovementEntity, productName?: string): IInventoryMovementResponse {
  return {
    id: movement.id,
    product_id: movement.product_id,
    product_name: productName || movement.product_name,
    movement_type: movement.movement_type,
    quantity: movement.quantity,
    unit_cost: movement.unit_cost ?? null,
    note: movement.note || undefined,
    user_id: movement.user_id,
    created_at: movement.created_at instanceof Date ? movement.created_at.toISOString() : movement.created_at,
  }
}