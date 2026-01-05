import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../db/index.js';
import { patternImplementations } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '../../lib/auth.js';

/**
 * Pattern Implementation Update Endpoint
 *
 * PUT /api/implementations/:uuid
 * Updates an existing pattern implementation
 *
 * Authorization:
 * - Must be authenticated
 * - Must be the author OR an admin
 *
 * Status Logic:
 * - If editor is admin: Status unchanged
 * - If editor is author and current status is "active": Status → "pending" (requires re-approval)
 * - If current status is "pending" or "rejected": Status remains unchanged
 *
 * Request Body:
 * {
 *   sasCode: string;
 *   rCode: string;
 *   considerations?: string[];
 *   variations?: string[];
 *   isPremium?: boolean;
 * }
 *
 * Response Schema (Success - 200):
 * {
 *   success: true,
 *   message: string,
 *   implementation: {
 *     uuid: string,
 *     patternId: string,
 *     authorId: number,
 *     sasCode: string,
 *     rCode: string,
 *     considerations: string[],
 *     variations: string[],
 *     status: string,
 *     isPremium: boolean,
 *     updatedAt: Date
 *   },
 *   statusChanged: boolean,
 *   previousStatus: string,
 *   newStatus: string
 * }
 *
 * PATCH /api/implementations/:uuid
 * Updates the status of an implementation (admin only)
 *
 * Authorization:
 * - Must be authenticated
 * - Must have 'admin' role
 *
 * Request Body:
 * {
 *   status: 'active' | 'rejected'
 * }
 *
 * Response Schema (Success - 200):
 * {
 *   success: true,
 *   message: string,
 *   implementation: {
 *     uuid: string,
 *     patternId: string,
 *     authorId: number,
 *     status: string,
 *     updatedAt: Date
 *   }
 * }
 *
 * DELETE /api/implementations/:uuid
 * Soft-deletes an implementation (admin only)
 *
 * Authorization:
 * - Must be authenticated
 * - Must have 'admin' role
 *
 * Response Schema (Success - 200):
 * {
 *   success: true,
 *   message: string,
 *   implementation: {
 *     uuid: string,
 *     patternId: string,
 *     isDeleted: boolean,
 *     deletedAt: Date,
 *     deletedBy: string
 *   }
 * }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Route to appropriate handler based on method
  if (req.method === 'PUT') {
    return handlePut(req, res);
  } else if (req.method === 'PATCH') {
    return handlePatch(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * PATCH handler - Admin-only status updates
 */
async function handlePatch(req: VercelRequest, res: VercelResponse) {
  // Get UUID from query parameter
  const { uuid } = req.query;

  if (!uuid || typeof uuid !== 'string') {
    return res.status(400).json({ error: 'Implementation UUID is required' });
  }

  // Authenticate user
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized - Please log in' });
  }

  // Check admin role
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin role required' });
  }

  try {
    // Validate status value
    const { status } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (status !== 'active' && status !== 'rejected') {
      return res.status(400).json({
        error: 'Invalid status value. Must be "active" or "rejected"',
        providedStatus: status
      });
    }

    // Check if implementation exists
    const existing = await db
      .select()
      .from(patternImplementations)
      .where(eq(patternImplementations.uuid, uuid))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Implementation not found',
        uuid
      });
    }

    // Update status
    const updated = await db
      .update(patternImplementations)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(patternImplementations.uuid, uuid))
      .returning();

    return res.status(200).json({
      success: true,
      message: `Implementation ${status === 'active' ? 'approved' : 'rejected'} successfully`,
      implementation: {
        uuid: updated[0].uuid,
        patternId: updated[0].patternId,
        authorId: updated[0].authorId,
        status: updated[0].status,
        updatedAt: updated[0].updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating implementation status:', error);
    return res.status(500).json({
      error: 'Failed to update implementation status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * PUT handler - Content updates
 */
async function handlePut(req: VercelRequest, res: VercelResponse) {

  // Get UUID from query parameter
  const { uuid } = req.query;

  if (!uuid || typeof uuid !== 'string') {
    return res.status(400).json({ error: 'Implementation UUID is required' });
  }

  // Authenticate user
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized - Please log in' });
  }

  try {
    // 1. Get existing implementation
    const existing = await db
      .select()
      .from(patternImplementations)
      .where(eq(patternImplementations.uuid, uuid))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Implementation not found',
        uuid
      });
    }

    const implementation = existing[0];

    // 2. Check authorization: Must be author or admin
    const isAuthor = implementation.authorId === user.id;
    const isAdmin = user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden - You can only edit your own implementations',
        authorId: implementation.authorId,
        userId: user.id
      });
    }

    // 3. Extract update fields from request body
    const {
      sasCode,
      rCode,
      considerations,
      variations,
      isPremium
    } = req.body;

    // 4. Validate required fields
    if (!sasCode || !rCode) {
      return res.status(400).json({
        error: 'Both sasCode and rCode are required'
      });
    }

    // 5. Determine new status based on business rules
    let newStatus = implementation.status;

    if (!isAdmin && implementation.status === 'active') {
      // Non-admin editing active implementation → needs re-approval
      newStatus = 'pending';
    }
    // Otherwise: status stays the same
    // - Admins can edit without changing status
    // - Editing pending/rejected implementations keeps same status

    // 6. Update implementation in database
    const updated = await db
      .update(patternImplementations)
      .set({
        sasCode,
        rCode,
        considerations: considerations || [],
        variations: variations || [],
        isPremium: isPremium !== undefined ? isPremium : implementation.isPremium,
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(patternImplementations.uuid, uuid))
      .returning();

    // 7. Return success response
    return res.status(200).json({
      success: true,
      message: newStatus !== implementation.status
        ? 'Implementation updated and submitted for re-approval'
        : 'Implementation updated successfully',
      implementation: {
        uuid: updated[0].uuid,
        patternId: updated[0].patternId,
        authorId: updated[0].authorId,
        sasCode: updated[0].sasCode,
        rCode: updated[0].rCode,
        considerations: updated[0].considerations,
        variations: updated[0].variations,
        status: updated[0].status,
        isPremium: updated[0].isPremium,
        updatedAt: updated[0].updatedAt
      },
      statusChanged: newStatus !== implementation.status,
      previousStatus: implementation.status,
      newStatus: newStatus
    });

  } catch (error) {
    console.error('Error updating implementation:', error);
    return res.status(500).json({
      error: 'Failed to update implementation',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * DELETE handler - Soft-delete implementation (admin only)
 */
async function handleDelete(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Authenticate user and check admin role
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in to delete implementations'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin role required to delete implementations'
      });
    }

    // 2. Extract UUID from query parameters
    const { uuid } = req.query;

    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({
        error: 'Implementation UUID is required'
      });
    }

    // 3. Check if implementation exists
    const existingImplementation = await db
      .select()
      .from(patternImplementations)
      .where(eq(patternImplementations.uuid, uuid))
      .limit(1);

    if (existingImplementation.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: `Implementation with UUID '${uuid}' not found`
      });
    }

    // 4. Check if implementation is already deleted
    if (existingImplementation[0].isDeleted) {
      return res.status(400).json({
        error: 'Implementation already deleted',
        message: `Implementation with UUID '${uuid}' has already been deleted`
      });
    }

    // 5. Soft delete the implementation
    const deletedImplementation = await db
      .update(patternImplementations)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.clerkId
      })
      .where(eq(patternImplementations.uuid, uuid))
      .returning();

    // 6. Return success response
    return res.status(200).json({
      success: true,
      message: 'Implementation soft-deleted successfully',
      implementation: {
        uuid: deletedImplementation[0].uuid,
        patternId: deletedImplementation[0].patternId,
        isDeleted: deletedImplementation[0].isDeleted,
        deletedAt: deletedImplementation[0].deletedAt,
        deletedBy: deletedImplementation[0].deletedBy
      }
    });

  } catch (error) {
    console.error('[API /implementations/[uuid]] DELETE error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to delete implementation'
    });
  }
}
