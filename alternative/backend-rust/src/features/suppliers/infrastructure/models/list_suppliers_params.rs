#[derive(Debug, Clone)]
pub struct ListSupplierParams {
    pub search: Option<String>,
    pub is_active: Option<bool>,
    pub page: i64,
    pub limit: i64,
}

impl Default for ListSupplierParams {
    fn default() -> Self {
        Self {
            search: None,
            is_active: None,
            page: 1,
            limit: 20,
        }
    }
}

impl ListSupplierParams {
    pub fn normalize(mut self) -> Self {
        if self.page < 1 {
            self.page = 1;
        }

        if self.limit < 1 {
            self.limit = 20;
        }

        if self.limit > 100 {
            self.limit = 100;
        }

        self
    }

    pub fn offset(&self) -> i64 {
        (self.page - 1) * self.limit
    }
}
