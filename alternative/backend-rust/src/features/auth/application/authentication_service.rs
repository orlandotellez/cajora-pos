use chrono::Utc;

use crate::{
    features::auth::{
        domain::contracts::{
            account_repository::AccountRepository, session_repository::SessionRepository,
            user_repository::UserRepository, verification_repository::VerificationRepository,
        },
        infrastructure::sqlx::{
            account_repository::SqlxAccountRepository, session_repository::SqlxSessionRepository,
            user_respository::SqlxUserRepository,
            verification_repository::SqlxVerificationRepository,
        },
        presentation::dto::{
            MessageResponse, RegisterResponse, SessionListResponse, SessionResponse, UserResponse,
        },
    },
    shared::{
        errors::app_error::AppError,
        helpers::generate::generate_code,
        security::{
            jwt,
            password::{hash_password, verify_password},
        },
        state::app_state::AppState,
    },
};

pub struct AuthenticationService;

impl AuthenticationService {
    pub async fn login(
        state: &AppState,
        email: &str,
        password: &str,
    ) -> Result<RegisterResponse, AppError> {
        // 1. Buscar usuario + credenciales
        let account_repo = SqlxAccountRepository::new(state.db.clone());
        let account = account_repo
            .find_credentials_by_email(email)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

        // 2. Verificar que tenga password
        let hashed_password = account
            .password
            .ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

        // 3. Verificar password
        let valid = verify_password(password, &hashed_password)?;
        if !valid {
            return Err(AppError::Unauthorized("Invalid credentials".to_string()));
        }

        // 4. Generar tokens JWT
        let token_pair = jwt::generate_tokens(
            &account.user_id.to_string(),
            &account.email,
            account
                .role
                .as_ref()
                .map(|r| r.as_str())
                .unwrap_or("cajero"),
            account.store_id,
        )?;

        // 5. Crear sesión con refresh token
        let session_repo = SqlxSessionRepository::new(state.db.clone());
        session_repo
            .create(
                account.user_id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None,
                None,
            )
            .await?;

        // 6. Armar response
        let user_response = UserResponse {
            id: account.user_id,
            name: account.name,
            email: account.email,
            email_verified: account.email_verified,
            role: account.role.map(|r| r.to_string()),
            image: account.image,
            created_at: account.created_at,
            updated_at: account.updated_at,
        };

        Ok(RegisterResponse {
            message: "Login successful".to_string(),
            user: user_response,
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }

    pub async fn refresh(
        state: &AppState,
        refresh_token: &str,
    ) -> Result<RegisterResponse, AppError> {
        // 1. Verificar JWT del refresh token
        let claims = jwt::verify_refresh_token(refresh_token)?;
        let user_id = uuid::Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::BadRequest("Invalid token payload".to_string()))?;

        let user_repo = SqlxUserRepository::new(state.db.clone());
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // 2. Buscar sesión por token
        let session = session_repo
            .find_by_token(refresh_token)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid refresh token".to_string()))?;

        // 3. Verificar que la sesión no haya expirado
        if session.expires_at < Utc::now() {
            tracing::warn!("[refresh] Sesión expirada, eliminando");
            session_repo.delete_by_token(refresh_token).await?;
            return Err(AppError::Unauthorized("Session expired".to_string()));
        }

        // 4. Buscar usuario (con deleted_at IS NULL)
        let user = user_repo
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| AppError::Unauthorized("User not found".to_string()))?;

        // 5. Eliminar sesión anterior (rotation)
        session_repo.delete_by_token(refresh_token).await?;

        // 6. Generar nuevos tokens
        let token_pair = jwt::generate_tokens(
            &user.id.to_string(),
            &user.email,
            user.role.as_ref().map(|r| r.as_str()).unwrap_or("cajero"),
            user.store_id,
        )?;

        // 7. Crear nueva sesión
        session_repo
            .create(
                user.id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None,
                None,
            )
            .await?;

        // 8. Armar response
        Ok(RegisterResponse {
            message: "Token refreshed successfully".to_string(),
            user: UserResponse::from(user),
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }

    // ─── Logout ───

    pub async fn logout(
        state: &AppState,
        refresh_token: &str,
    ) -> Result<MessageResponse, AppError> {
        let session_repo = SqlxSessionRepository::new(state.db.clone());
        // Eliminar la sesión — no importa si existe o no
        session_repo.delete_by_token(refresh_token).await?;

        Ok(MessageResponse {
            message: "Logged out successfully".to_string(),
        })
    }

    // ─── Verify Email ───

    pub async fn verify_email(
        state: &AppState,
        identifier: &str,
        code: &str,
    ) -> Result<RegisterResponse, AppError> {
        let verification_repo = SqlxVerificationRepository::new(state.db.clone());
        let user_repo = SqlxUserRepository::new(state.db.clone());
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // 1. Buscar verification code
        let verification = verification_repo
            .find_by_identifier_and_value(identifier, code)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid verification code".to_string()))?;

        // 2. Verificar expiración
        if verification.expires_at < Utc::now() {
            verification_repo.delete_by_identifier(identifier).await?;
            return Err(AppError::Unauthorized(
                "Verification code expired".to_string(),
            ));
        }

        // 3. Buscar usuario
        let user = user_repo
            .find_by_email(identifier)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // 4. Actualizar email_verified (directo con sqlx por simplicidad)
        sqlx::query!(
            "UPDATE users SET email_verified = true, updated_at = $1 WHERE id = $2",
            Utc::now(),
            user.id,
        )
        .execute(&state.db)
        .await?;

        // 5. Eliminar verification code
        verification_repo.delete_by_identifier(identifier).await?;

        // 6. Generar nuevos tokens
        let token_pair = jwt::generate_tokens(
            &user.id.to_string(),
            &user.email,
            user.role.as_ref().map(|r| r.as_str()).unwrap_or("cajero"),
            user.store_id,
        )?;

        // 7. Crear nueva sesión
        session_repo
            .create(
                user.id,
                &token_pair.refresh_token,
                Utc::now() + chrono::Duration::days(7),
                None,
                None,
            )
            .await?;

        // 8. Armar response
        Ok(RegisterResponse {
            message: "Email verified successfully".to_string(),
            user: UserResponse::from(user),
            access_token: token_pair.access_token,
            refresh_token: token_pair.refresh_token,
        })
    }

    // ─── Forgot Password ───

    pub async fn forgot_password(
        state: &AppState,
        email: &str,
    ) -> Result<MessageResponse, AppError> {
        let verification_repo = SqlxVerificationRepository::new(state.db.clone());
        let user_repo = SqlxUserRepository::new(state.db.clone());

        // Verificar si el usuario existe (pero mismo mensaje para anti-enumeration)
        let _user_exists = user_repo.find_by_email(email).await?.is_some();

        // El mensaje es el mismo exista o no
        if _user_exists {
            // Generar reset code
            let reset_code = generate_code();
            let expires_at = Utc::now() + chrono::Duration::minutes(15);

            // Eliminar códigos previos y crear nuevo
            verification_repo
                .delete_by_identifier(&format!("reset:{email}"))
                .await?;
            verification_repo
                .create(&format!("reset:{email}"), &reset_code, expires_at)
                .await?;

            tracing::info!("Reset code for {}: {}", email, reset_code);
        }

        Ok(MessageResponse {
            message: "If the email exists, a reset code has been sent".to_string(),
        })
    }

    // ─── Reset Password ───

    pub async fn reset_password(
        state: &AppState,
        email: &str,
        code: &str,
        new_password: &str,
    ) -> Result<MessageResponse, AppError> {
        let verification_repo = SqlxVerificationRepository::new(state.db.clone());
        let user_repo = SqlxUserRepository::new(state.db.clone());
        let account_repo = SqlxAccountRepository::new(state.db.clone());
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // 1. Buscar verification code con prefix reset:
        let identifier = format!("reset:{email}");
        let verification = verification_repo
            .find_by_identifier_and_value(&identifier, code)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid reset code".to_string()))?;

        // 2. Verificar expiración
        if verification.expires_at < Utc::now() {
            verification_repo.delete_by_identifier(&identifier).await?;
            return Err(AppError::Unauthorized("Reset code expired".to_string()));
        }

        // 3. Buscar usuario
        let user = user_repo
            .find_by_email(email)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // 4. Hashear nueva password
        let hashed = hash_password(new_password)?;

        // 5. Actualizar password en account
        account_repo
            .update_password_by_email(email, &hashed)
            .await?;

        // 6. Eliminar TODAS las sesiones del usuario (fuerza re-login)
        session_repo.delete_by_user_id(user.id).await?;

        // 7. Eliminar verification code
        verification_repo.delete_by_identifier(&identifier).await?;

        Ok(MessageResponse {
            message: "Password reset successfully. Please login with your new password."
                .to_string(),
        })
    }

    // ─── List Sessions ───

    pub async fn get_user_sessions(
        state: &AppState,
        user_id: uuid::Uuid,
    ) -> Result<SessionListResponse, AppError> {
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        let sessions = session_repo
            .find_by_user_id(user_id)
            .await?
            .into_iter()
            .map(SessionResponse::from_session)
            .collect();

        Ok(SessionListResponse { sessions })
    }

    // ─── Revoke Session ───

    pub async fn revoke_session(
        state: &AppState,
        user_id: uuid::Uuid,
        session_id: uuid::Uuid,
    ) -> Result<MessageResponse, AppError> {
        let session_repo = SqlxSessionRepository::new(state.db.clone());

        // Buscar todas las sesiones del usuario y verificar que la session_id le pertenece
        let sessions = session_repo.find_by_user_id(user_id).await?;
        let found = sessions.iter().any(|s| s.id == session_id);

        if !found {
            return Err(AppError::NotFound("Session not found".to_string()));
        }

        session_repo.delete_by_id(session_id).await?;

        Ok(MessageResponse {
            message: "Session revoked successfully".to_string(),
        })
    }
}
