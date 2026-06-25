use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalData {
    pub server_wallet: Pubkey,
    pub deposits_frozen: bool,
    pub withdrawals_frozen: bool,
}
