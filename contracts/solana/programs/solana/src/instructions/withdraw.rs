use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    constants::{EVENT_AUTHORITY_SEED, GLOBAL_SEED, USER_DATA_SEED, USER_VAULT_SEED},
    error::UserVaultError,
    state::{event::WithdrawEvent, global::GlobalData, user::UserData},
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub server_wallet: Signer<'info>,
    #[account(seeds=[GLOBAL_SEED],bump,has_one=server_wallet @UserVaultError::InvalidServerWallet)]
    pub global: Account<'info, GlobalData>,
    #[account(mut,seeds=[USER_DATA_SEED,user.key().as_ref()],bump)]
    pub user_data: Account<'info, UserData>,
    #[account(seeds=[EVENT_AUTHORITY_SEED],bump)]
    ///CHECK: seeds checked
    pub event_authority: UncheckedAccount<'info>,
    #[account(mut,seeds=[USER_VAULT_SEED,user.key().as_ref()],bump)]
    ///CHECK:
    pub user_vault: UncheckedAccount<'info>,
    ///CHECK:
    pub user: UncheckedAccount<'info>,
    #[account(mut,token::mint=mint,token::authority=user)]
    pub user_vault_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(init_if_needed,associated_token::mint=mint,associated_token::authority=user,payer=server_wallet)]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,
    #[account()]
    pub mint: InterfaceAccount<'info, Mint>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let user_data = &mut ctx.accounts.user_data;

    user_data.total_withdrawals = user_data.total_withdrawals.checked_add(1).unwrap();

    if ctx
        .accounts
        .mint
        .key()
        .eq(&anchor_spl::token::spl_token::native_mint::ID)
    {
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.user_vault.to_account_info(),
                    to: ctx.accounts.user.to_account_info(),
                },
                &[&[
                    USER_VAULT_SEED,
                    ctx.accounts.user.key.as_ref(),
                    &[ctx.bumps.user_vault],
                ]],
            ),
            amount,
        )?;
    } else {
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    authority: ctx.accounts.user_vault.to_account_info(),
                    from: ctx.accounts.user_vault_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_ata.to_account_info(),
                },
                &[&[
                    USER_VAULT_SEED,
                    ctx.accounts.user.key.as_ref(),
                    &[ctx.bumps.user_vault],
                ]],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
    }

    emit_cpi!(WithdrawEvent {
        amount,
        token: ctx.accounts.mint.key(),
        user: ctx.accounts.user.key()
    });

    Ok(())
}
