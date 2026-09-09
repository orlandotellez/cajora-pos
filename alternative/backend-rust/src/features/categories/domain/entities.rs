use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct Category {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub store_id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
