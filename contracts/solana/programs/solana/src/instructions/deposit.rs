use crate::constants::{EVENT_AUTHORITY_SEED, USER_DATA_SEED, USER_VAULT_SEED};
use crate::state::event::DepositEvent;
use crate::state::user::{UserData, UserDepositData};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init_if_needed,seeds=[USER_DATA_SEED,user.key().as_ref()],bump,payer=user,space=8+UserData::INIT_SPACE)]
    pub user_data: Account<'info, UserData>,
    #[account()]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut,token::mint=mint,token::authority=user)]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(seeds=[EVENT_AUTHORITY_SEED],bump)]
    ///CHECK: seeds checked
    pub event_authority: UncheckedAccount<'info>,
    #[account(seeds=[USER_VAULT_SEED,user.key().as_ref()],bump)]
    ///CHECK:
    pub user_vault: UncheckedAccount<'info>,
    #[account(init_if_needed,associated_token::mint=mint,
        associated_token::authority=user_vault,associated_token::token_program=token_program,payer=user)]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let user_data = &mut ctx.accounts.user_data;

    if user_data.wallet.eq(&Pubkey::default()) {
        user_data.wallet = ctx.accounts.user.key();
        user_data.total_deposits = 0;
        user_data.total_withdrawals = 0;
        user_data.created_at = Clock::get()?.unix_timestamp;
    }

    user_data.total_deposits = user_data.total_deposits.checked_add(1).unwrap();

    if ctx
        .accounts
        .mint
        .key()
        .eq(&anchor_spl::token::spl_token::native_mint::ID)
    {
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.user_vault.to_account_info(),
                },
            ),
            amount,
        )?;
    } else {
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    authority: ctx.accounts.user.to_account_info(),
                    from: ctx.accounts.user_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault_ata.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
    }

    let mut deposit_id: Vec<u8> = vec![];

    UserDepositData {
        amount,
        deposited_at: Clock::get()?.unix_timestamp,
        token: ctx.accounts.mint.key(),
        wallet: ctx.accounts.user.key(),
    }
    .serialize(&mut deposit_id)?;

    emit_cpi!(DepositEvent {
        amount,
        deposit_id,
        token: ctx.accounts.mint.key(),
        user: ctx.accounts.user.key()
    });

    Ok(())
}
