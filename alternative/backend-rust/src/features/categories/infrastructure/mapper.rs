use serde::Serialize;

use crate::features::categories::domain::entities::Category;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Category> for CategoryResponse {
    fn from(category: Category) -> Self {
        Self {
            id: category.id.to_string(),
            name: category.name,
            description: category.description,
            created_at: category
                .created_at
                .map(|d| d.to_rfc3339())
                .unwrap_or_default(),
            updated_at: category.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CategoryListResponse {
    pub categories: Vec<CategoryResponse>,
    pub total: usize,
}
