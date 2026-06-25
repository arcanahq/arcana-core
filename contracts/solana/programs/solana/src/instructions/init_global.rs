use crate::{constants::GLOBAL_SEED, state::global::GlobalData};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitGlobal<'info> {
    #[account(mut)]
    pub server_wallet: Signer<'info>,
    #[account(init,seeds=[GLOBAL_SEED],bump,payer=server_wallet,space=8+GlobalData::INIT_SPACE)]
    pub global_data: Account<'info, GlobalData>,
    pub system_program: Program<'info, System>,
}

pub fn init_global(ctx: Context<InitGlobal>, server_wallet: Pubkey) -> Result<()> {
    let global = &mut ctx.accounts.global_data;

    global.server_wallet = server_wallet;
    global.deposits_frozen = false;
    global.withdrawals_frozen = false;
    Ok(())
}
