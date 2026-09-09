use chrono::Utc;

use crate::{
    features::auth::{
        domain::{
            contracts::{session_repository::SessionRepository, user_repository::UserRepository},
            enums::Role,
        },
        infrastructure::sqlx::{
            account_repository::SqlxAccountRepository, session_repository::SqlxSessionRepository,
            user_respository::SqlxUserRepository,
        },
    },
    features::stores::{
        domain::contracts::store_repository::StoreRepository,
        infrastructure::sqlx::store_repository::SqlxStoreRepository,
        presentation::dto::{
            request::RegisterStoreRequest,
            response::{RegisterStoreResponse, StoreResponse},
        },
    },
    shared::{
        errors::app_error::AppError,
        security::{jwt, password::hash_password},
        state::app_state::AppState,
    },
};

pub struct StoreService;

impl StoreService {
    pub async fn register_store(
        state: &AppState,
        payload: RegisterStoreRequest,
    ) -> Result<RegisterStoreResponse, AppError> {
        // 1. Verificar que el store name no exista
        let store_repo = SqlxStoreRepository::new(state.db.clone());
        let existing_store = store_repo.find_by_name(&payload.store_name).await?;
        if existing_store.is_some() {
            return Err(AppError::Conflict("Store name already exists".to_string()));
        }

        // 2. Verificar que el admin email no esté registrado (global)
        let user_repo = SqlxUserRepository::new(state.db.clone());
        let existing_user = user_repo.find_by_email(&payload.admin_email).await?;
        if existing_user.is_some() {
            return Err(AppError::Conflict("Email already registered".to_string()));
        }

        // 3. Hashear password
        let hashed_password = hash_password(&payload.admin_password)?;

        // 4. Transacción: store → user → account → settings
        let mut tx = state.db.begin().await?;

        let store = SqlxStoreRepository::create(
            &mut tx,
            &payload.store_name,
            payload.store_address.as_deref(),
            payload.store_phone.as_deref(),
        )
        .await?;

        let user = SqlxUserRepository::create(
            &mut tx,
            &payload.admin_name,
            &payload.admin_email,
            Role::Admin,
            true, // email_verified = true (admin creado por sistema)
            Some(store.id),
        )
        .await?;

        SqlxAccountRepository::create(&mut tx, &payload.admin_email, &hashed_password, user.id)
            .await?;

        // Settings con valores por defecto
        sqlx::query(
            r#"
            INSERT INTO settings (store_id, name, address, phone, tax_rate, low_stock_threshold, updated_at)
            VALUES ($1, $2, $3, $4, 16, 5, $5)
            "#,
        )
        .bind(store.id)
        .bind(&payload.store_name)
        .bind(&payload.store_address)
        .bind(&payload.store_phone)
        .bind(Utc::now())
        .execute(tx.as_mut())
        .await?;

        tx.commit().await?;

        // 5. Generar tokens JWT
        let token_pair =
            jwt::generate_tokens(&user.id.to_string(), &user.email, "admin", Some(store.id))?;

        // 6. Crear sesión con refresh token
        let session_repo = SqlxSessionRepository::new(state.db.clone());
        session_repo
            .create(
                user.id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None,
                None,
            )
            .await?;

        // 7. Armar response
        Ok(RegisterStoreResponse {
            message: "Store created successfully".to_string(),
            store: StoreResponse::from(store),
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }
}
