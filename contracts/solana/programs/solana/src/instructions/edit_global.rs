use crate::constants::GLOBAL_SEED;
use crate::error::UserVaultError;
use crate::state::global::GlobalData;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct EditGlobal<'info> {
    #[account()]
    pub server_wallet: Signer<'info>,
    #[account(mut,seeds=[GLOBAL_SEED],bump,has_one=server_wallet @UserVaultError::InvalidServerWallet)]
    pub global: Account<'info, GlobalData>,
}

pub fn edit_global(
    ctx: Context<EditGlobal>,
    server_wallet: Option<Pubkey>,
    deposit_frozen: Option<bool>,
    withdrawal_frozen: Option<bool>,
) -> Result<()> {
    let global = &mut ctx.accounts.global;

    if let Some(server) = server_wallet {
        global.server_wallet = server;
    }

    if let Some(dep_frozen) = deposit_frozen {
        global.deposits_frozen = dep_frozen;
    }

    if let Some(with_frozen) = withdrawal_frozen {
        global.withdrawals_frozen = with_frozen;
    }

    Ok(())
}
