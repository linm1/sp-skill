import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Webhook } from 'svix';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Clerk Webhook Endpoint
 *
 * POST /api/webhooks/clerk
 * Automatically syncs users from Clerk to database
 *
 * Webhook Events:
 * - user.created: Create user in database
 * - user.updated: Update user in database
 * - user.deleted: Mark user as deleted (optional)
 *
 * Security: Verifies webhook signature with Clerk Webhook Secret
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('CLERK_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get headers for signature verification
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: 'Missing svix headers' });
    }

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(JSON.stringify(req.body), {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle different webhook events
    const { type, data } = evt;

    console.log(`Received Clerk webhook: ${type}`, {
      userId: data.id,
      email: data.email_addresses?.[0]?.email_address
    });

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;

      case 'user.updated':
        await handleUserUpdated(data);
        break;

      case 'user.deleted':
        await handleUserDeleted(data);
        break;

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return res.status(200).json({
      success: true,
      message: `Webhook ${type} processed successfully`
    });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
}

/**
 * Handle user.created webhook
 * Creates a new user in the database
 */
async function handleUserCreated(data: any) {
  const clerkId = data.id;
  const email = data.email_addresses?.[0]?.email_address || '';
  const firstName = data.first_name || '';
  const lastName = data.last_name || '';
  const username = data.username || '';

  // Get name from available fields
  const name = firstName || username || email.split('@')[0];

  // Get role from public metadata (default: contributor)
  const role = data.public_metadata?.role || 'contributor';

  console.log('Creating user in database:', { clerkId, email, name, role });

  try {
    // Check if user already exists (shouldn't happen, but be defensive)
    const existing = await db.select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (existing.length > 0) {
      console.log('User already exists, skipping creation:', clerkId);
      return;
    }

    // Insert new user
    const newUser = await db.insert(users).values({
      clerkId,
      email,
      name,
      role
    }).returning();

    console.log('User created successfully:', newUser[0]);
  } catch (error: any) {
    console.error('Error creating user:', error);

    // If duplicate key error, just log and continue (user exists)
    if (error.code === '23505') {
      console.log('User already exists (race condition), continuing');
      return;
    }

    throw error;
  }
}

/**
 * Handle user.updated webhook
 * Updates existing user in the database
 */
async function handleUserUpdated(data: any) {
  const clerkId = data.id;
  const email = data.email_addresses?.[0]?.email_address || '';
  const firstName = data.first_name || '';
  const lastName = data.last_name || '';
  const username = data.username || '';

  const name = firstName || username || email.split('@')[0];
  const role = data.public_metadata?.role || 'contributor';

  console.log('Updating user in database:', { clerkId, email, name, role });

  try {
    // Check if user exists
    const existing = await db.select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (existing.length === 0) {
      // User doesn't exist yet, create them
      console.log('User not found, creating instead of updating');
      await handleUserCreated(data);
      return;
    }

    // Update existing user
    const updated = await db.update(users)
      .set({
        email,
        name,
        role,
        updatedAt: new Date()
      })
      .where(eq(users.clerkId, clerkId))
      .returning();

    console.log('User updated successfully:', updated[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Handle user.deleted webhook
 * Optionally soft-delete or hard-delete user
 */
async function handleUserDeleted(data: any) {
  const clerkId = data.id;

  console.log('User deleted from Clerk:', clerkId);

  // Option 1: Hard delete (remove from database)
  // Uncomment this if you want to delete users completely:
  /*
  await db.delete(users).where(eq(users.clerkId, clerkId));
  console.log('User hard-deleted from database:', clerkId);
  */

  // Option 2: Soft delete (mark as deleted but keep data)
  // You'd need to add a 'deleted_at' column to your schema first
  /*
  await db.update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.clerkId, clerkId));
  console.log('User soft-deleted from database:', clerkId);
  */

  // Option 3: Do nothing (keep user data even after Clerk deletion)
  console.log('User deletion event logged, no database action taken');
}
