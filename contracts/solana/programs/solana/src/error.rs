use anchor_lang::prelude::*;

#[error_code]
pub enum UserVaultError {
    #[msg("Invalid server wallet!")]
    InvalidServerWallet,
}
