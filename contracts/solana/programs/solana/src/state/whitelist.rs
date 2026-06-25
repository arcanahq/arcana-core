use anchor_lang::prelude::*;

#[account]
pub struct WhitelistedToken {
    pub address: Pubkey,
    pub whitelisted: bool,
    pub updated_at: i64,
}
