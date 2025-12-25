import {
  getAllPatternDefinitions,
  getPatternDefinitionById,
  getImplementationsByPatternId,
  insertPatternImplementation,
  updateImplementationStatus,
  getPatternsWithCounts,
  type PatternImplementationRow
} from './db';

/**
 * Pattern Service Layer for StatPatternHub
 * Provides business logic for pattern operations
 */

// Response type for pattern list
export interface PatternListItem {
  id: string;
  category: string;
  title: string;
  problem: string;
  whenToUse: string;
  implementationCount: number;
  approvedCount: number;
  pendingCount: number;
}

// Response type for pattern detail
export interface PatternDetailResponse {
  definition: {
    id: string;
    category: string;
    title: string;
    problem: string;
    whenToUse: string;
  };
  implementations: Array<{
    uuid: string;
    patternId: string;
    authorId: string | null;
    authorName: string;
    sasCode: string;
    rCode: string;
    considerations: string[];
    variations: string[];
    status: string;
    isPremium: boolean;
    createdAt: string;
  }>;
}

// Request type for contribution
export interface ContributionRequest {
  patternId: string;
  sasCode: string;
  rCode: string;
  considerations?: string[];
  variations?: string[];
}

// Response type for contribution
export interface ContributionResponse {
  success: boolean;
  status: 'pending' | 'approved';
  message: string;
  creditsAwarded?: number;
  implementation: any;
}

/**
 * Get list of all patterns with implementation counts
 *
 * @returns Array of pattern list items with counts
 */
export async function getPatternsList(): Promise<PatternListItem[]> {
  const patterns = await getPatternsWithCounts();
  return patterns.map(p => ({
    id: p.id,
    category: p.category,
    title: p.title,
    problem: p.problem,
    whenToUse: p.when_to_use,
    implementationCount: parseInt(p.implementation_count, 10),
    approvedCount: parseInt(p.approved_count, 10),
    pendingCount: parseInt(p.pending_count, 10)
  }));
}

/**
 * Get pattern detail with all approved implementations
 *
 * @param patternId - Pattern ID (e.g., "IMP-001")
 * @returns Pattern definition with implementations, or null if not found
 */
export async function getPatternDetail(patternId: string): Promise<PatternDetailResponse | null> {
  const definition = await getPatternDefinitionById(patternId);
  if (!definition) return null;

  const implementations = await getImplementationsByPatternId(patternId, 'approved');

  return {
    definition: {
      id: definition.id,
      category: definition.category,
      title: definition.title,
      problem: definition.problem,
      whenToUse: definition.when_to_use
    },
    implementations: implementations.map(impl => ({
      uuid: impl.uuid,
      patternId: impl.pattern_id,
      authorId: impl.author_id,
      authorName: impl.author_name,
      sasCode: impl.sas_code,
      rCode: impl.r_code,
      considerations: impl.considerations,
      variations: impl.variations,
      status: impl.status,
      isPremium: impl.is_premium,
      createdAt: impl.created_at.toISOString()
    }))
  };
}

/**
 * Create a new pattern contribution
 *
 * Auto-approves for admin/premier users, pending for contributors
 *
 * @param userId - User ID from Clerk authentication
 * @param userName - User's display name
 * @param role - User's role (contributor, premier, admin)
 * @param data - Contribution data (pattern ID, code, etc.)
 * @returns Contribution response with status and credits
 */
export async function createContribution(
  userId: string,
  userName: string,
  role: string,
  data: ContributionRequest
): Promise<ContributionResponse> {
  // Auto-approve for admin/premier, pending for contributor
  const status = (role === 'admin' || role === 'premier') ? 'approved' : 'pending';

  const impl = await insertPatternImplementation({
    pattern_id: data.patternId,
    author_id: userId,
    author_name: userName,
    sas_code: data.sasCode,
    r_code: data.rCode,
    considerations: data.considerations || [],
    variations: data.variations || [],
    status: status,
    is_premium: false
  });

  // Credits are handled by Backend Dev #2's credit system
  // For now, return 0 credits (will be integrated later)
  const creditsAwarded = (status === 'approved' && role !== 'admin') ? 25 : 0;

  return {
    success: true,
    status: status,
    message: status === 'approved'
      ? 'Contribution approved'
      : 'Contribution submitted for review',
    creditsAwarded: creditsAwarded > 0 ? creditsAwarded : undefined,
    implementation: {
      uuid: impl.uuid,
      patternId: impl.pattern_id,
      authorId: impl.author_id,
      authorName: impl.author_name,
      status: impl.status,
      sasCode: impl.sas_code,
      rCode: impl.r_code,
      considerations: impl.considerations,
      variations: impl.variations,
      isPremium: impl.is_premium,
      createdAt: impl.created_at.toISOString()
    }
  };
}
