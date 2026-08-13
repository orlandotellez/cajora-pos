import type {
  ISubscriptionEntity,
  CloudTrialInput,
  UpdateSubscriptionInput,
} from "./subscription.entities"

export interface ISubscriptionRepository {
  getByStoreId(storeId: string): Promise<ISubscriptionEntity | null>
  getByPaypalSubscriptionId(paypalSubscriptionId: string): Promise<ISubscriptionEntity | null>
  findPaypalSubscriptions(skip: number, take: number): Promise<ISubscriptionEntity[]>
  upsertCloud(storeId: string, data: CloudTrialInput): Promise<ISubscriptionEntity>
  update(storeId: string, data: UpdateSubscriptionInput): Promise<ISubscriptionEntity | null>
}
