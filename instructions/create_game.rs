// programs/solrps/src/instructions/create_game.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(game_id: [u8; 8])]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = creator,
        space = Game::LEN,
        seeds = [b"game", game_id.as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        constraint = creator_token_account.owner == creator.key(),
        constraint = creator_token_account.mint == token_mint.key()
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"game_vault", game.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = game_vault
    )]
    pub game_vault: Account<'info, TokenAccount>,
    
    /// CHECK: Token mint address
    pub token_mint: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateGame>,
    game_id: [u8; 8],
    rounds: u8,
    stake_per_round: u64,
    commitment: [u8; 32],
) -> Result<()> {
    // Validate rounds
    require!(
        rounds == 1 || rounds == 3 || rounds == 5,
        GameError::InvalidRounds
    );
    
    // Validate stake
    require!(stake_per_round > 0, GameError::InvalidStake);
    
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    // Calculate total stake for creator
    let total_stake = stake_per_round
        .checked_mul(rounds as u64)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Transfer stake from creator to game vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.creator_token_account.to_account_info(),
            to: ctx.accounts.game_vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        },
    );
    anchor_spl::token::transfer(transfer_ctx, total_stake)?;
    
    // Initialize game state
    game.game_id = game_id;
    game.creator = ctx.accounts.creator.key();
    game.challenger = None;
    game.rounds = rounds;
    game.stake_per_round = stake_per_round;
    game.total_pot = total_stake; // Will double when challenger joins
    game.creator_commitment = commitment;
    game.challenger_commitment = None;
    game.creator_moves = None;
    game.challenger_moves = None;
    game.status = GameStatus::WaitingForChallenger;
    game.created_at = clock.unix_timestamp;
    game.joined_at = None;
    game.reveal_deadline = None;
    game.winner = None;
    game.round_results = Vec::new();
    game.fees_collected = 0;
    game.bump = ctx.bumps.game;
    
    msg!(
        "Game created: ID={:?}, Creator={}, Rounds={}, Stake={}",
        game_id,
        ctx.accounts.creator.key(),
        rounds,
        stake_per_round
    );
    
    Ok(())
}

// programs/solrps/src/instructions/join_game.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        constraint = game.status == GameStatus::WaitingForChallenger @ GameError::InvalidGameStatus
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub challenger: Signer<'info>,
    
    #[account(
        mut,
        constraint = challenger_token_account.owner == challenger.key(),
        constraint = challenger_token_account.mint == game_vault.mint
    )]
    pub challenger_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"game_vault", game.key().as_ref()],
        bump
    )]
    pub game_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<JoinGame>,
    commitment: [u8; 32],
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    // Ensure challenger is not the creator
    require!(
        ctx.accounts.challenger.key() != game.creator,
        GameError::CannotJoinOwnGame
    );
    
    // Calculate challenger stake
    let challenger_stake = game.stake_per_round
        .checked_mul(game.rounds as u64)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Transfer stake from challenger to game vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.challenger_token_account.to_account_info(),
            to: ctx.accounts.game_vault.to_account_info(),
            authority: ctx.accounts.challenger.to_account_info(),
        },
    );
    anchor_spl::token::transfer(transfer_ctx, challenger_stake)?;
    
    // Update game state
    game.challenger = Some(ctx.accounts.challenger.key());
    game.challenger_commitment = Some(commitment);
    game.status = GameStatus::WaitingForReveals;
    game.joined_at = Some(clock.unix_timestamp);
    
    // Set reveal deadline (10 minutes from now)
    game.reveal_deadline = Some(clock.unix_timestamp + 600);
    
    // Double the pot
    game.total_pot = game.total_pot
        .checked_mul(2)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    msg!(
        "Game joined: Challenger={}, Pot={}, Deadline={}",
        ctx.accounts.challenger.key(),
        game.total_pot,
        game.reveal_deadline.unwrap()
    );
    
    Ok(())
}

// programs/solrps/src/instructions/reveal_moves.rs
use anchor_lang::prelude::*;
use solana_program::keccak;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct RevealMoves<'info> {
    #[account(
        mut,
        constraint = game.status == GameStatus::WaitingForReveals ||
                    game.status == GameStatus::CreatorRevealed ||
                    game.status == GameStatus::ChallengerRevealed
                    @ GameError::InvalidGameStatus
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>,
}

pub fn handler(
    ctx: Context<RevealMoves>,
    moves: Vec<u8>,
    salt: [u8; 32],
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    // Check if reveal deadline has passed
    if let Some(deadline) = game.reveal_deadline {
        require!(
            clock.unix_timestamp <= deadline,
            GameError::GameExpired
        );
    }
    
    // Validate number of moves
    require!(
        moves.len() == game.rounds as usize,
        GameError::InvalidMoveCount
    );
    
    // Validate each move
    for &move_val in &moves {
        require!(
            move_val >= 1 && move_val <= 3,
            GameError::InvalidMove
        );
    }
    
    // Determine if player is creator or challenger
    let is_creator = ctx.accounts.player.key() == game.creator;
    let is_challenger = game.challenger.map_or(false, |c| c == ctx.accounts.player.key());
    
    require!(
        is_creator || is_challenger,
        GameError::Unauthorized
    );
    
    // Verify commitment
    let mut hash_input = Vec::new();
    hash_input.extend_from_slice(&moves);
    hash_input.extend_from_slice(&salt);
    let computed_hash = keccak::hash(&hash_input);
    
    let expected_commitment = if is_creator {
        game.creator_commitment
    } else {
        game.challenger_commitment.ok_or(GameError::Unauthorized)?
    };
    
    require!(
        computed_hash.to_bytes() == expected_commitment,
        GameError::CommitmentVerificationFailed
    );
    
    // Store revealed moves and update status
    if is_creator {
        game.creator_moves = Some(moves);
        game.status = match game.status {
            GameStatus::WaitingForReveals => GameStatus::CreatorRevealed,
            GameStatus::ChallengerRevealed => GameStatus::Complete,
            _ => game.status,
        };
    } else {
        game.challenger_moves = Some(moves);
        game.status = match game.status {
            GameStatus::WaitingForReveals => GameStatus::ChallengerRevealed,
            GameStatus::CreatorRevealed => GameStatus::Complete,
            _ => game.status,
        };
    }
    
    // If both players revealed, calculate results
    if game.status == GameStatus::Complete {
        calculate_game_result(game)?;
    }
    
    msg!(
        "Moves revealed: Player={}, Status={:?}",
        ctx.accounts.player.key(),
        game.status
    );
    
    Ok(())
}

fn calculate_game_result(game: &mut Game) -> Result<()> {
    let creator_moves = game.creator_moves.as_ref().unwrap();
    let challenger_moves = game.challenger_moves.as_ref().unwrap();
    
    let mut creator_wins = 0u8;
    let mut challenger_wins = 0u8;
    
    // Calculate each round result
    for (i, (&creator_move, &challenger_move)) in 
        creator_moves.iter().zip(challenger_moves.iter()).enumerate() {
        
        let round_winner = match (creator_move, challenger_move) {
            (1, 3) | (2, 1) | (3, 2) => {
                creator_wins += 1;
                RoundWinner::Creator
            },
            (3, 1) | (1, 2) | (2, 3) => {
                challenger_wins += 1;
                RoundWinner::Challenger
            },
            _ => RoundWinner::Draw, // Same moves
        };
        
        game.round_results.push(RoundResult {
            creator_move,
            challenger_move,
            winner: round_winner,
        });
    }
    
    // Determine overall winner
    game.winner = if creator_wins > challenger_wins {
        Some(game.creator)
    } else if challenger_wins > creator_wins {
        game.challenger
    } else {
        None // Draw
    };
    
    msg!(
        "Game result: Creator {} - {} Challenger, Winner: {:?}",
        creator_wins,
        challenger_wins,
        game.winner
    );
    
    Ok(())
}

// programs/solrps/src/instructions/claim_prize.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(
        mut,
        constraint = game.status == GameStatus::Complete @ GameError::InvalidGameStatus
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub claimer: Signer<'info>,
    
    #[account(
        mut,
        constraint = claimer_token_account.owner == claimer.key(),
        constraint = claimer_token_account.mint == game_vault.mint
    )]
    pub claimer_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"game_vault", game.key().as_ref()],
        bump
    )]
    pub game_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = treasury_account.mint == game_vault.mint
    )]
    pub treasury_account: Account<'info, TokenAccount>,
    
    /// CHECK: Burn address - tokens sent here are effectively burned
    #[account(mut)]
    pub burn_account: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimPrize>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    
    // Determine payout amounts
    let (winner_payout, creator_payout, challenger_payout) = if let Some(winner) = game.winner {
        // There's a winner - apply fees
        let total_fees = game.total_pot
            .checked_mul(10)
            .ok_or(GameError::ArithmeticOverflow)?
            .checked_div(100)
            .ok_or(GameError::ArithmeticOverflow)?;
        
        let winner_amount = game.total_pot
            .checked_sub(total_fees)
            .ok_or(GameError::ArithmeticOverflow)?;
        
        game.fees_collected = total_fees;
        
        if winner == game.creator {
            (winner_amount, winner_amount, 0)
        } else {
            (winner_amount, 0, winner_amount)
        }
    } else {
        // Draw - full refund to both players
        let refund_amount = game.total_pot
            .checked_div(2)
            .ok_or(GameError::ArithmeticOverflow)?;
        
        (0, refund_amount, refund_amount)
    };
    
    // Determine what the claimer should receive
    let claimer_amount = if ctx.accounts.claimer.key() == game.creator {
        creator_payout
    } else if Some(ctx.accounts.claimer.key()) == game.challenger {
        challenger_payout
    } else {
        return Err(GameError::Unauthorized.into());
    };
    
    // Transfer to claimer if they have a payout
    if claimer_amount > 0 {
        let game_key = ctx.accounts.game.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"game_vault",
            game_key.as_ref(),
            &[ctx.bumps.game_vault],
        ]];
        
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.game_vault.to_account_info(),
                to: ctx.accounts.claimer_token_account.to_account_info(),
                authority: ctx.accounts.game_vault.to_account_info(),
            },
            signer_seeds,
        );
        anchor_spl::token::transfer(transfer_ctx, claimer_amount)?;
    }
    
    // Handle fees if there's a winner
    if game.fees_collected > 0 {
        let treasury_fee = game.fees_collected
            .checked_div(2)
            .ok_or(GameError::ArithmeticOverflow)?;
        let burn_fee = game.fees_collected
            .checked_sub(treasury_fee)
            .ok_or(GameError::ArithmeticOverflow)?;
        
        let game_key = ctx.accounts.game.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"game_vault",
            game_key.as_ref(),
            &[ctx.bumps.game_vault],
        ]];
        
        // Transfer to treasury
        if treasury_fee > 0 {
            let treasury_transfer_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.game_vault.to_account_info(),
                    to: ctx.accounts.treasury_account.to_account_info(),
                    authority: ctx.accounts.game_vault.to_account_info(),
                },
                signer_seeds,
            );
            anchor_spl::token::transfer(treasury_transfer_ctx, treasury_fee)?;
        }
        
        // Transfer to burn (effectively removing from circulation)
        if burn_fee > 0 {
            let burn_transfer_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.game_vault.to_account_info(),
                    to: ctx.accounts.burn_account.to_account_info(),
                    authority: ctx.accounts.game_vault.to_account_info(),
                },
                signer_seeds,
            );
            anchor_spl::token::transfer(burn_transfer_ctx, burn_fee)?;
        }
    }
    
    msg!(
        "Prize claimed: Claimer={}, Amount={}, Fees={}",
        ctx.accounts.claimer.key(),
        claimer_amount,
        game.fees_collected
    );
    
    Ok(())
}

// programs/solrps/src/instructions/forfeit_game.rs
use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ForfeitGame<'info> {
    #[account(
        mut,
        constraint = game.status == GameStatus::WaitingForReveals ||
                    game.status == GameStatus::CreatorRevealed ||
                    game.status == GameStatus::ChallengerRevealed
                    @ GameError::InvalidGameStatus
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub forfeit_claimer: Signer<'info>,
}

pub fn handler(ctx: Context<ForfeitGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    // Check if reveal deadline has passed
    if let Some(deadline) = game.reveal_deadline {
        require!(
            clock.unix_timestamp > deadline,
            GameError::RevealDeadlineNotPassed
        );
    }
    
    // Determine winner based on who revealed
    let forfeit_winner = match game.status {
        GameStatus::CreatorRevealed => Some(game.creator),
        GameStatus::ChallengerRevealed => game.challenger,
        GameStatus::WaitingForReveals => {
            // Neither revealed - this shouldn't happen but handle gracefully
            return Err(GameError::InvalidGameStatus.into());
        },
        _ => return Err(GameError::InvalidGameStatus.into()),
    };
    
    // Verify claimer is authorized
    let is_authorized = if let Some(winner) = forfeit_winner {
        ctx.accounts.forfeit_claimer.key() == winner
    } else {
        false
    };
    
    require!(is_authorized, GameError::Unauthorized);
    
    // Update game state
    game.winner = forfeit_winner;
    game.status = GameStatus::Forfeited;
    
    msg!(
        "Game forfeited: Winner={:?}, Claimer={}",
        forfeit_winner,
        ctx.accounts.forfeit_claimer.key()
    );
    
    Ok(())
}