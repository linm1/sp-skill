/**
 * Mock API Server for Local Development
 *
 * Simulates the backend API with hardcoded seeded data
 * Use this when you don't have access to Vercel Postgres locally
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock seeded data (30 patterns: 15 IMP + 15 DER)
const mockPatterns = [];

// Generate 15 IMP patterns
for (let i = 1; i <= 15; i++) {
  const id = `IMP-${String(i).padStart(3, '0')}`;
  mockPatterns.push({
    id,
    category: 'IMP',
    title: `Imputation Pattern ${i}`,
    problem: `This pattern addresses imputation scenario ${i} in clinical data.`,
    whenToUse: `Use when handling missing data scenario ${i}.`,
    implementationCount: 1,
    authors: ['System'],
    latestUpdate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    implementations: [
      {
        uuid: `${id}-system`,
        authorId: 1,
        authorName: 'System',
        sasCode: `/* SAS implementation for ${id} */\ndata imputed;\n  set source;\n  /* Implementation code here */\nrun;`,
        rCode: `# R implementation for ${id}\nlibrary(dplyr)\n# Implementation code here`,
        considerations: [`Consider data distribution for pattern ${i}`, `Validate assumptions before applying`],
        variations: [`Alternative approach ${i}a`, `Alternative approach ${i}b`],
        status: 'active',
        isPremium: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  });
}

// Generate 15 DER patterns
for (let i = 1; i <= 15; i++) {
  const id = `DER-${String(i).padStart(3, '0')}`;
  mockPatterns.push({
    id,
    category: 'DER',
    title: `Derivation Pattern ${i}`,
    problem: `This pattern derives variable ${i} according to analysis requirements.`,
    whenToUse: `Use when deriving analysis variables of type ${i}.`,
    implementationCount: 1,
    authors: ['System'],
    latestUpdate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    implementations: [
      {
        uuid: `${id}-system`,
        authorId: 1,
        authorName: 'System',
        sasCode: `/* SAS derivation for ${id} */\ndata derived;\n  set source;\n  /* Derivation logic here */\nrun;`,
        rCode: `# R derivation for ${id}\nlibrary(dplyr)\n# Derivation logic here`,
        considerations: [`Check input data quality`, `Verify derivation logic with statistician`],
        variations: [`Method ${i}a`, `Method ${i}b`],
        status: 'active',
        isPremium: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  });
}

// Add sample LOCF pattern (IMP-002) with real content
mockPatterns[1] = {
  id: 'IMP-002',
  category: 'IMP',
  title: 'Last Observation Carried Forward (LOCF)',
  problem: 'Missing values in longitudinal data need to be filled with the last known value.',
  whenToUse: 'When the analysis plan specifies LOCF for missing data handling in safety datasets.',
  implementationCount: 1,
  authors: ['System'],
  latestUpdate: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  implementations: [
    {
      uuid: 'IMP-002-system',
      authorId: 1,
      authorName: 'System',
      sasCode: `data locf;
  set source;
  by usubjid;
  retain last_val;
  if not missing(aval) then last_val = aval;
  else aval = last_val;
run;`,
      rCode: `library(dplyr)
library(tidyr)

df_locf <- df %>%
  group_by(usubjid) %>%
  fill(aval, .direction = "down")`,
      considerations: [
        'Ensure data is sorted by subject and time before applying',
        'Do not use for baseline imputation if baseline is missing'
      ],
      variations: [
        'Baseline Observation Carried Forward (BOCF)',
        'Worst Observation Carried Forward'
      ],
      status: 'active',
      isPremium: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

// API Routes
app.get('/api/patterns', (req, res) => {
  try {
    const { category } = req.query;

    let patterns = mockPatterns;
    if (category && typeof category === 'string') {
      patterns = mockPatterns.filter(p => p.category === category.toUpperCase());
    }

    res.json({
      success: true,
      count: patterns.length,
      category: category ? category.toUpperCase() : 'ALL',
      patterns
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/patterns/:id', (req, res) => {
  try {
    const { id } = req.params;
    const pattern = mockPatterns.find(p => p.id === id.toUpperCase());

    if (!pattern) {
      return res.status(404).json({
        success: false,
        error: `Pattern ${id} not found`
      });
    }

    res.json({
      success: true,
      pattern
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Mock API server running',
    patternCount: mockPatterns.length
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Mock API Server running on http://localhost:${PORT}`);
  console.log(`📊 Serving ${mockPatterns.length} mock patterns`);
  console.log(`📍 Endpoints:`);
  console.log(`   GET  /api/patterns`);
  console.log(`   GET  /api/patterns?category=IMP`);
  console.log(`   GET  /api/patterns?category=DER`);
  console.log(`   GET  /api/patterns/:id`);
  console.log(`   GET  /health\n`);
});
