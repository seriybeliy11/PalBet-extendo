// sp_migration.js - Fixed for CommonJS with top-level await wrapped

const fs = require('fs').promises; // Use promises for async fs
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto'); // For randomUUID

// Your Supabase config
const supabaseUrl = 'xaronjilom@gmail.com'; // Replace with actual
const supabaseAnonKey = 'sbp_0e61ee801b49fb57e1a804b160165a7d1080477f'; // Replace with actual

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateData() {
  try {
    // Load data
    const dataRaw = await fs.readFile('data.json', 'utf8');
    const data = JSON.parse(dataRaw);

    const pendingRaw = await fs.readFile('pending-sells.json', 'utf8');
    const pendingSells = JSON.parse(pendingRaw);

    console.log('Starting migration...');

    // Insert users (generate UUIDs if needed)
    const usersWithIds = data.users.map(u => ({
      ...u,
      id: u.id || crypto.randomUUID(),
      created_at: new Date(u.createdAt).toISOString(),
      updated_at: new Date(u.updatedAt).toISOString()
    }));
    const { error: userError } = await supabase.from('users').insert(usersWithIds);
    if (userError) throw userError;

    // Insert markets
    const marketsWithIds = data.markets.map(m => ({
      ...m,
      id: m.id || crypto.randomUUID(),
      price_history: m.priceHistory || [] // Ensure array
    }));
    const { error: marketError } = await supabase.from('markets').insert(marketsWithIds);
    if (marketError) throw marketError;

    // Insert positions
    const positionsWithIds = data.positions.map(p => ({
      ...p,
      id: p.id || crypto.randomUUID(),
      user_id: p.userId, // Map to snake_case if your schema uses it
      market_id: p.marketId,
      created_at: new Date(p.createdAt).toISOString(),
      updated_at: new Date(p.updatedAt).toISOString()
    }));
    const { error: posError } = await supabase.from('positions').insert(positionsWithIds);
    if (posError) throw posError;

    // Insert transactions
    const transactionsWithIds = data.transactions.map(t => ({
      ...t,
      id: t.id || crypto.randomUUID(),
      user_id: t.userId,
      created_at: new Date(t.createdAt).toISOString(),
      metadata: t.metadata || {}
    }));
    const { error: txError } = await supabase.from('transactions').insert(transactionsWithIds);
    if (txError) throw txError;

    // Insert pending sells
    const pendingWithIds = pendingSells.map(ps => ({
      ...ps,
      id: ps.id || crypto.randomUUID(),
      user_id: ps.userId,
      position_id: ps.positionId,
      market_id: ps.marketId,
      created_at: new Date(ps.createdAt).toISOString()
    }));
    const { error: pendingError } = await supabase.from('pending_sells').insert(pendingWithIds);
    if (pendingError) throw pendingError;

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
  }
}

// Run the async function
migrateData();