use anchor_lang::prelude::*;

#[event]
pub struct DepositEvent {
    pub deposit_id: Vec<u8>,
    pub user: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
}
