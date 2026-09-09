src/
├── main.rs
│
├── database/
│   ├── connection.rs
│   ├── migrations/
│   ├── transaction.rs
│   └── mod.rs
│
├── shared/
│   ├── config/
│   │   ├── env.rs
│   │   ├── constants.rs
│   │   ├── logger.rs
│   │   ├── cors.rs
│   │   └── mod.rs
│   │
│   ├── errors/
│   │   ├── app_error.rs
│   │   ├── error_response.rs
│   │   └── mod.rs
│   │
│   ├── security/
│   │   ├── jwt.rs
│   │   ├── password.rs
│   │   ├── cookies.rs
│   │   └── mod.rs
│   │
│   ├── validation/
│   │   ├── mod.rs
│   │   └── validator.rs
│   │
│   ├── pagination/
│   │   ├── page.rs
│   │   └── mod.rs
│   │
│   ├── state/
│   │   ├── app_state.rs
│   │   └── mod.rs
│   │
│   └── mod.rs
│
├── http/
│   ├── middleware/
│   │   ├── auth.rs
│   │   ├── logging.rs
│   │   ├── cors.rs
│   │   └── mod.rs
│   │
│   ├── router.rs
│   └── mod.rs
│
├── features/
│   │
│   ├── auth/
│   │   ├── application/
│   │   │   └── service.rs
│   │   │
│   │   ├── domain/
│   │   │   ├── entities.rs
│   │   │   ├── types.rs
│   │   │   ├── repository.rs
│   │   │   └── mod.rs
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── sqlx/
│   │   │   │   ├── user_repository.rs
│   │   │   │   ├── session_repository.rs
│   │   │   │   ├── account_repository.rs
│   │   │   │   └── mod.rs
│   │   │   │
│   │   │   ├── mapper.rs
│   │   │   └── mod.rs
│   │   │
│   │   ├── presentation/
│   │   │   ├── handlers/
│   │   │   │   ├── login.rs
│   │   │   │   ├── logout.rs
│   │   │   │   ├── refresh.rs
│   │   │   │   └── mod.rs
│   │   │   │
│   │   │   ├── requests/
│   │   │   │   ├── login_request.rs
│   │   │   │   └── mod.rs
│   │   │   │
│   │   │   ├── responses/
│   │   │   │   ├── login_response.rs
│   │   │   │   └── mod.rs
│   │   │   │
│   │   │   ├── routes.rs
│   │   │   └── mod.rs
│   │   │
│   │   └── mod.rs
│   │
│   ├── users/
│   ├── products/
│   ├── inventory/
│   ├── batch_inventory/
│   ├── suppliers/
│   ├── sales/
│   ├── settings/
│   ├── services/
│   └── mod.rs
│
└── lib.rs (opcional)
