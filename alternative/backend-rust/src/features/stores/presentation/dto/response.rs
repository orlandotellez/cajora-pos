use serde::Serialize;
use uuid::Uuid;

use crate::features::stores::domain::entities::Store;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreResponse {
    pub id: Uuid,
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterStoreResponse {
    pub message: String,
    pub store: StoreResponse,
    pub access_token: String,
    pub refresh_token: String,
}

impl From<Store> for StoreResponse {
    fn from(store: Store) -> Self {
        StoreResponse {
            id: store.id,
            name: store.name,
            address: store.address,
            phone: store.phone,
        }
    }
}
