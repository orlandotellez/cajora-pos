use uuid::Uuid;

use crate::{
    features::categories::{
        domain::contracts::category_repository::CategoryRepository,
        infrastructure::{
            mapper::CategoryListResponse, sqlx::category_repository::SqlxCategoryRepository,
        },
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

pub struct CategoryService;

impl CategoryService {
    pub async fn list_categories(
        state: &AppState,
        store_id: Uuid,
    ) -> Result<CategoryListResponse, AppError> {
        let repo: SqlxCategoryRepository = SqlxCategoryRepository::new(state.db.clone());
        let categories = repo.find_all(store_id).await?;
        let total = categories.len();

        Ok(CategoryListResponse {
            categories: categories.into_iter().map(Into::into).collect(),
            total,
        })
    }
}
