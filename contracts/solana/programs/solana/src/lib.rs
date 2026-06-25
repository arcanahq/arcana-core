use anchor_lang::prelude::*;

declare_id!("ECgFz6hEyz8sQfQfXf58f5ShFyeyGnP6s91x34UNfEJH");

pub mod instructions;
pub mod state;
use instructions::*;
pub mod constants;
pub mod error;

#[program]
pub mod solana {
    use super::*;

    pub fn init_global(ctx: Context<InitGlobal>, server_wallet: Pubkey) -> Result<()> {
        instructions::init_global(ctx, server_wallet)
    }

    pub fn edit_global(
        ctx: Context<EditGlobal>,
        server_wallet: Option<Pubkey>,
        deposit_frozen: Option<bool>,
        withdrawal_frozen: Option<bool>,
    ) -> Result<()> {
        instructions::edit_global(ctx, server_wallet, deposit_frozen, withdrawal_frozen)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw(ctx, amount)
    }
}
