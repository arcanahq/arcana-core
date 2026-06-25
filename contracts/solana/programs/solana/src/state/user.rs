use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserData {
    pub wallet: Pubkey,
    pub created_at: i64,
    pub total_deposits: u64,
    pub total_withdrawals: u64,
}

#[derive(AnchorSerialize)]
pub struct UserDepositData {
    pub wallet: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
    pub deposited_at: i64,
}
