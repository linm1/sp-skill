// Type declarations for system-patterns.json
declare module '../../data/system-patterns.json' {
  interface PatternDefinition {
    id: string;
    category: string;
    title: string;
    problem: string;
    whenToUse: string;
  }

  interface PatternImplementation {
    patternId: string;
    authorName: string;
    sasCode: string;
    rCode: string;
    considerations: string[];
    variations: string[];
    isPremium: boolean;
  }

  interface SystemPatternsData {
    version: string;
    lastUpdated: string;
    definitions: PatternDefinition[];
    implementations: PatternImplementation[];
  }

  const data: SystemPatternsData;
  export default data;
}
