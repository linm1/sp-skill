import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../db';
import { users, patternDefinitions, patternImplementations } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Database Seeding Endpoint
 *
 * Populates the database with 30 realistic clinical programming patterns:
 * - 15 IMP (Imputation) patterns
 * - 15 DER (Derivations) patterns
 *
 * Usage: POST /api/seed
 * Security: Protected by MIGRATION_TOKEN (same as migrate endpoint)
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify migration token for security
  const token = req.headers['x-migration-token'];
  const expectedToken = process.env.MIGRATION_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      error: 'MIGRATION_TOKEN not configured in environment variables'
    });
  }

  if (token !== expectedToken) {
    return res.status(401).json({
      error: 'Unauthorized - Invalid or missing migration token'
    });
  }

  try {
    // 1. Ensure System user exists (author for default implementations)
    let systemUser = await db.select().from(users).where(eq(users.email, 'system@statpatternhub.com')).limit(1);

    if (systemUser.length === 0) {
      const newUser = await db.insert(users).values({
        email: 'system@statpatternhub.com',
        name: 'System',
        role: 'admin'
      }).returning();
      systemUser = newUser;
    }

    const systemUserId = systemUser[0].id;

    // 2. Define 15 IMP (Imputation) patterns
    const impPatterns = [
      {
        id: 'IMP-001',
        category: 'IMP',
        title: 'LOCF (Last Observation Carried Forward)',
        problem: 'Handle missing follow-up values in longitudinal clinical trial data by carrying forward the last observed measurement',
        whenToUse: 'When you have time-series data with intermittent missing values and the assumption that values remain stable between visits is clinically reasonable',
        sasCode: `/* LOCF Imputation using PROC SQL */
data imputed;
  set original;
  by subjid;
  retain last_value;

  if first.subjid then last_value = .;

  if not missing(aval) then last_value = aval;
  else if not missing(last_value) then aval = last_value;
run;`,
        rCode: `# LOCF Imputation using tidyverse
library(dplyr)

imputed <- original %>%
  group_by(subjid) %>%
  arrange(visitnum) %>%
  fill(aval, .direction = "down") %>%
  ungroup()`,
        considerations: [
          'LOCF can introduce bias if measurements naturally change over time',
          'Not appropriate for endpoints expected to improve/worsen',
          'Consider regulatory guidance - some agencies discourage LOCF',
          'Document imputation in analysis datasets (add DTYPE variable)'
        ],
        variations: [
          'BOCF (Baseline Observation Carried Forward)',
          'WOCF (Worst Observation Carried Forward)',
          'Mixed Model for Repeated Measures (MMRM) - preferred alternative'
        ]
      },
      {
        id: 'IMP-002',
        category: 'IMP',
        title: 'Mean Imputation by Treatment Group',
        problem: 'Replace missing values with the mean of observed values within the same treatment arm',
        whenToUse: 'When missing data is minimal (<5%) and MCAR (Missing Completely At Random) assumption holds',
        sasCode: `/* Mean Imputation by Treatment Arm */
proc means data=original nway noprint;
  class trt;
  var aval;
  output out=means mean=mean_aval;
run;

proc sql;
  create table imputed as
  select a.*,
         coalesce(a.aval, b.mean_aval) as aval_imp
  from original a
  left join means b
    on a.trt = b.trt;
quit;`,
        rCode: `# Mean Imputation by Treatment
library(dplyr)

imputed <- original %>%
  group_by(trt) %>%
  mutate(aval_imp = ifelse(is.na(aval), mean(aval, na.rm = TRUE), aval)) %>%
  ungroup()`,
        considerations: [
          'Reduces variance and can bias hypothesis tests',
          'Should only be used when missingness is minimal',
          'Consider sensitivity analysis with complete cases',
          'Document proportion of imputed values'
        ],
        variations: [
          'Median imputation (more robust to outliers)',
          'Hot-deck imputation (use similar donor observations)',
          'Multiple imputation (creates multiple plausible values)'
        ]
      },
      {
        id: 'IMP-003',
        category: 'IMP',
        title: 'Linear Interpolation Between Visits',
        problem: 'Estimate missing intermediate values by linear interpolation between surrounding observations',
        whenToUse: 'When you need to impute values between two known measurements and linear trend is plausible',
        sasCode: `/* Linear Interpolation */
proc expand data=original out=imputed method=join;
  by subjid;
  id visitnum;
  convert aval / method=join;
run;`,
        rCode: `# Linear Interpolation using zoo
library(zoo)
library(dplyr)

imputed <- original %>%
  group_by(subjid) %>%
  arrange(visitnum) %>%
  mutate(aval_interp = na.approx(aval, na.rm = FALSE)) %>%
  ungroup()`,
        considerations: [
          'Only imputes between known values (not before/after)',
          'Assumes linear change - may not fit all biomarkers',
          'Requires at least 2 non-missing values per subject',
          'Cannot handle leading/trailing missing values'
        ],
        variations: [
          'Spline interpolation for smoother curves',
          'Extrapolation with PROC EXPAND method=spline',
          'Piecewise linear with different slopes by phase'
        ]
      },
      {
        id: 'IMP-004',
        category: 'IMP',
        title: 'Multiple Imputation with PROC MI',
        problem: 'Create multiple plausible values for missing data to account for uncertainty',
        whenToUse: 'When missing data is substantial (>5%) and you want valid statistical inference with proper standard errors',
        sasCode: `/* Multiple Imputation */
proc mi data=original out=imputed nimpute=5 seed=12345;
  class trt;
  var aval age bmi;
  by trt;
run;

/* Analyze each imputed dataset */
proc mixed data=imputed;
  class trt subjid _imputation_;
  model aval = trt / solution;
  repeated / subject=subjid;
  by _imputation_;
  ods output solutionF=parms;
run;

/* Pool results across imputations */
proc mianalyze parms=parms;
  modeleffects trt;
run;`,
        rCode: `# Multiple Imputation with mice
library(mice)

# Create 5 imputed datasets
imp <- mice(original, m = 5, method = 'pmm', seed = 12345)

# Analyze each dataset
fit <- with(imp, lm(aval ~ trt + age + bmi))

# Pool results
pooled <- pool(fit)
summary(pooled)`,
        considerations: [
          'Requires sufficient auxiliary variables for imputation model',
          'Assumes MAR (Missing At Random) - not MNAR',
          'More complex analysis and interpretation',
          'Need to pool results across imputations'
        ],
        variations: [
          'PROC MI method=MCMC for arbitrary patterns',
          'FCS (Fully Conditional Specification) with mice',
          'Pattern-mixture models for MNAR data'
        ]
      },
      {
        id: 'IMP-005',
        category: 'IMP',
        title: 'Baseline Observation Carried Forward (BOCF)',
        problem: 'Impute missing post-baseline values using the baseline measurement',
        whenToUse: 'Conservative imputation for safety endpoints or when treatment benefit is uncertain',
        sasCode: `/* BOCF Imputation */
data imputed;
  set original;
  by subjid;
  retain baseline_value;

  if visitnum = 0 then baseline_value = aval;

  if visitnum > 0 and missing(aval) then
    aval = baseline_value;
run;`,
        rCode: `# BOCF Imputation
library(dplyr)

imputed <- original %>%
  group_by(subjid) %>%
  mutate(baseline_value = aval[visitnum == 0],
         aval_bocf = ifelse(visitnum > 0 & is.na(aval),
                            baseline_value, aval)) %>%
  ungroup()`,
        considerations: [
          'Conservative approach - assumes no treatment benefit',
          'Useful for sensitivity analysis',
          'Can be too conservative for efficacy endpoints',
          'All subjects must have baseline value'
        ],
        variations: [
          'WOCF (Worst Observation Carried Forward)',
          'BOCF only for dropouts, not intermittent missing',
          'Hybrid approaches based on reason for discontinuation'
        ]
      },
      {
        id: 'IMP-006',
        category: 'IMP',
        title: 'Hot Deck Imputation',
        problem: 'Impute missing values by randomly selecting from similar observed subjects (donors)',
        whenToUse: 'When you want to preserve the distribution of the original data and have sufficient donor observations',
        sasCode: `/* Hot Deck Imputation - Match on treatment and age group */
data imputed;
  set original;

  /* Define matching cells */
  if age < 40 then age_grp = 1;
  else if age < 60 then age_grp = 2;
  else age_grp = 3;

  /* Random sampling within cell */
  if missing(aval) then do;
    call execute('data _donor; set original(where=(not missing(aval) and trt="'||strip(trt)||'" and age_grp='||age_grp||')); run;');
    /* Sample randomly from donors */
  end;
run;`,
        rCode: `# Hot Deck Imputation
library(dplyr)

imputed <- original %>%
  mutate(age_grp = cut(age, breaks = c(0, 40, 60, Inf))) %>%
  group_by(trt, age_grp) %>%
  mutate(aval_imp = ifelse(is.na(aval),
                           sample(aval[!is.na(aval)], 1),
                           aval)) %>%
  ungroup()`,
        considerations: [
          'Preserves distribution of observed data',
          'Requires careful definition of donor cells',
          'May not work well with small sample sizes',
          'Results vary by random seed'
        ],
        variations: [
          'Cold deck (use external reference dataset)',
          'Distance-based matching (nearest neighbor)',
          'Sequential hot deck with ordered data'
        ]
      },
      {
        id: 'IMP-007',
        category: 'IMP',
        title: 'Regression-Based Imputation',
        problem: 'Predict missing values using regression model based on other variables',
        whenToUse: 'When you have strong predictors of the missing variable and want model-based estimates',
        sasCode: `/* Regression Imputation */
/* Build regression model on complete cases */
proc reg data=original(where=(not missing(aval))) outest=regparms noprint;
  model aval = age bmi baseline_val;
run;

/* Score missing values */
proc score data=original score=regparms out=imputed type=parms;
  var age bmi baseline_val;
run;

data imputed;
  set imputed;
  if missing(aval) then aval = model1;
run;`,
        rCode: `# Regression Imputation
library(dplyr)

# Build model on complete cases
model <- lm(aval ~ age + bmi + baseline_val,
            data = original[complete.cases(original), ])

# Predict missing values
imputed <- original %>%
  mutate(aval_imp = ifelse(is.na(aval),
                           predict(model, newdata = .),
                           aval))`,
        considerations: [
          'Assumes linear relationship with predictors',
          'Reduces variance (deterministic imputation)',
          'Consider adding random error term',
          'May produce out-of-range values'
        ],
        variations: [
          'Stochastic regression (add residual error)',
          'Robust regression for outlier resistance',
          'Generalized linear models for non-normal outcomes'
        ]
      },
      {
        id: 'IMP-008',
        category: 'IMP',
        title: 'Monotone Missing Data Imputation',
        problem: 'Handle monotone missing pattern (once missing, always missing) efficiently',
        whenToUse: 'Dropout scenarios in clinical trials where subjects do not return after discontinuation',
        sasCode: `/* Monotone Imputation with PROC MI */
proc mi data=original out=imputed nimpute=1 seed=54321;
  class trt;
  monotone reg(aval = age bmi trt);
  var aval age bmi;
run;`,
        rCode: `# Monotone Imputation
library(mice)

# Impute with monotone method
imp <- mice(original,
            method = 'norm.predict',
            visitSequence = 'monotone',
            m = 1)

imputed <- complete(imp)`,
        considerations: [
          'Only valid for truly monotone patterns',
          'Verify monotonicity before applying',
          'More efficient than arbitrary pattern methods',
          'Common in longitudinal clinical trials'
        ],
        variations: [
          'Monotone regression imputation',
          'Monotone propensity score imputation',
          'Jump-to-reference imputation for dropouts'
        ]
      },
      {
        id: 'IMP-009',
        category: 'IMP',
        title: 'K-Nearest Neighbors (KNN) Imputation',
        problem: 'Impute missing values using weighted average of K most similar observations',
        whenToUse: 'When you have multivariate data and want data-driven similarity matching',
        sasCode: `/* KNN Imputation - Manual Implementation */
proc distance data=original out=dist method=euclid;
  var interval(age bmi baseline_val);
  id subjid;
run;

/* Find K=5 nearest neighbors and average */
proc sort data=dist; by subjid distance; run;

data imputed;
  merge original dist(where=(not missing(aval)));
  by subjid;
  /* Average top 5 neighbors */
run;`,
        rCode: `# KNN Imputation
library(VIM)

imputed <- kNN(original,
               variable = 'aval',
               k = 5,
               dist_var = c('age', 'bmi', 'baseline_val'))`,
        considerations: [
          'Sensitive to choice of K (number of neighbors)',
          'Requires scaling of variables for distance calculation',
          'Computationally intensive for large datasets',
          'Cannot handle all variables missing for an observation'
        ],
        variations: [
          'Distance-weighted KNN (closer neighbors weighted more)',
          'Adaptive K based on data density',
          'KNN with categorical variables (Gower distance)'
        ]
      },
      {
        id: 'IMP-010',
        category: 'IMP',
        title: 'Expectation-Maximization (EM) Imputation',
        problem: 'Use EM algorithm to find maximum likelihood estimates for missing values',
        whenToUse: 'When data is multivariate normal and you want ML-based estimates',
        sasCode: `/* EM Imputation with PROC MI */
proc mi data=original out=imputed nimpute=1 seed=67890;
  em maxiter=100 converge=0.0001;
  var aval age bmi baseline_val;
run;`,
        rCode: `# EM Imputation
library(norm)

# Prepare data matrix
data_matrix <- as.matrix(original[, c('aval', 'age', 'bmi', 'baseline_val')])

# Run EM algorithm
s <- prelim.norm(data_matrix)
thetahat <- em.norm(s)

# Impute
imputed_matrix <- imp.norm(s, thetahat, data_matrix)`,
        considerations: [
          'Assumes multivariate normal distribution',
          'Single imputation (underestimates variance)',
          'Can be slow to converge',
          'Consider MI with EM as starting point'
        ],
        variations: [
          'EM with data augmentation for MI',
          'Robust EM for non-normal data',
          'EM with covariates (regression framework)'
        ]
      },
      {
        id: 'IMP-011',
        category: 'IMP',
        title: 'Worst Rank Imputation for Composite Endpoints',
        problem: 'Assign worst possible rank to subjects with missing data in composite endpoint analysis',
        whenToUse: 'Composite endpoints combining death/hospitalization where missing is informative',
        sasCode: `/* Worst Rank Imputation */
proc rank data=original out=ranked ties=low descending;
  var composite_score;
  ranks score_rank;
run;

data imputed;
  set ranked;

  /* Subjects who died get worst rank */
  if death_flag = 1 then score_rank = 1;

  /* Missing data gets next worst rank */
  else if missing(composite_score) then
    score_rank = 2;
run;`,
        rCode: `# Worst Rank Imputation
library(dplyr)

imputed <- original %>%
  mutate(
    score_rank = case_when(
      death_flag == 1 ~ 1,  # Death = worst
      is.na(composite_score) ~ 2,  # Missing = next worst
      TRUE ~ rank(-composite_score, ties.method = 'min')
    )
  )`,
        considerations: [
          'Conservative approach for regulatory submissions',
          'Assumes missing is related to poor outcome',
          'May be too conservative if missingness is random',
          'Used in cardiovascular composite endpoints'
        ],
        variations: [
          'Win ratio analysis',
          'Hierarchical composite endpoints',
          'Worst rank only for dropouts, not intermittent missing'
        ]
      },
      {
        id: 'IMP-012',
        category: 'IMP',
        title: 'Copy Reference Imputation (Control-Based)',
        problem: 'Impute missing values using distribution from control/reference arm',
        whenToUse: 'Regulatory sensitivity analysis assuming no treatment benefit after dropout',
        sasCode: `/* Copy Reference (Jump to Reference) */
proc mi data=original out=imputed nimpute=10 seed=11111;
  class trt subjid;
  mnar model(aval / modelobs=(trt='Control'));
  var aval visitnum baseline_val;
  by trt;
run;`,
        rCode: `# Copy Reference with reference-based MI
library(rbmi)

# Define reference-based imputation
draws <- draws(
  data = original,
  vars = vars(
    subjid = 'subjid',
    visit = 'visitnum',
    outcome = 'aval',
    group = 'trt'
  ),
  method = method_approxbayes(n_samples = 100),
  references = c('Treatment' = 'Control')
)`,
        considerations: [
          'Very conservative assumption',
          'Required for FDA submissions in some indications',
          'Part of estimand framework (ICH E9 R1)',
          'Need control arm with similar missingness pattern'
        ],
        variations: [
          'Jump to Reference (immediate switch)',
          'Copy Increment from Reference (delta adjustment)',
          'Last Mean Carried Forward'
        ]
      },
      {
        id: 'IMP-013',
        category: 'IMP',
        title: 'Pattern Mixture Models for MNAR',
        problem: 'Model outcome separately for different missingness patterns',
        whenToUse: 'When you suspect missing not at random (MNAR) and want to incorporate missingness pattern',
        sasCode: `/* Pattern Mixture Model */
/* Classify missingness pattern */
data patterns;
  set original;
  by subjid;

  if last.subjid then do;
    if nmiss(of aval_:) = 0 then pattern = 'Complete';
    else if visitnum_last < 6 then pattern = 'Early Dropout';
    else pattern = 'Late Dropout';
    output;
  end;
run;

/* Model by pattern */
proc mixed data=original;
  class pattern trt visitnum subjid;
  model aval = pattern trt pattern*trt visitnum;
  repeated visitnum / subject=subjid type=un;
  by pattern;
run;`,
        rCode: `# Pattern Mixture Model
library(nlme)

# Classify patterns
original <- original %>%
  group_by(subjid) %>%
  mutate(pattern = case_when(
    sum(is.na(aval)) == 0 ~ 'Complete',
    max(visitnum[!is.na(aval)]) < 6 ~ 'Early Dropout',
    TRUE ~ 'Late Dropout'
  ))

# Model by pattern
lme(aval ~ trt * pattern + visitnum,
    random = ~ 1 | subjid,
    data = original)`,
        considerations: [
          'Requires sufficient sample size per pattern',
          'More complex interpretation',
          'Need to carefully define patterns',
          'Can combine with MI for uncertainty'
        ],
        variations: [
          'Selection models (model missingness mechanism)',
          'Shared parameter models',
          'Sensitivity parameters (delta adjustment)'
        ]
      },
      {
        id: 'IMP-014',
        category: 'IMP',
        title: 'Propensity Score Matching for Imputation',
        problem: 'Match subjects with missing data to similar subjects with observed data using propensity scores',
        whenToUse: 'When you have rich covariate information to predict missingness',
        sasCode: `/* Propensity Score Imputation */
/* Model probability of missingness */
proc logistic data=original desc;
  model missing_flag = age sex bmi trt baseline_val;
  output out=ps predicted=propensity;
run;

/* Match on propensity score */
proc psmatch data=ps region=allobs;
  psmodel missing_flag(treated='1') = age sex bmi trt baseline_val;
  match method=greedy(k=1) caliper=0.05;
  assess ps var=(age sex bmi);
  output out(obs=match)=matched;
run;

/* Impute using matched donor */
data imputed;
  merge original matched;
  by subjid;
  if missing(aval) and not missing(_MatchID_) then
    aval = donor_aval;
run;`,
        rCode: `# Propensity Score Matching
library(MatchIt)

# Calculate propensity scores
original$missing_flag <- as.numeric(is.na(original$aval))

match_out <- matchit(missing_flag ~ age + sex + bmi + trt + baseline_val,
                     data = original,
                     method = 'nearest',
                     caliper = 0.05)

# Get matched data and impute
matched <- match.data(match_out)`,
        considerations: [
          'Assumes observed covariates predict missingness',
          'Requires good balance after matching',
          'May not find matches for all missing observations',
          'More appropriate for MAR than MNAR'
        ],
        variations: [
          'Inverse probability weighting',
          'Doubly robust methods',
          'Propensity score stratification'
        ]
      },
      {
        id: 'IMP-015',
        category: 'IMP',
        title: 'Retrieved Dropout Imputation',
        problem: 'Use observed data from subjects who returned after initial dropout',
        whenToUse: 'When protocol includes retrieved dropout visits and you want to use actual observed data',
        sasCode: `/* Retrieved Dropout Analysis */
data imputed;
  set original;
  by subjid visitnum;

  /* Flag treatment discontinuation */
  if discontinue_date ne . and
     visit_date > discontinue_date then
     retrieved_flag = 1;

  /* Use retrieved data with annotation */
  if retrieved_flag = 1 then do;
    dtype = 'RETRIEVED';
    /* Keep observed value, no imputation needed */
  end;
run;`,
        rCode: `# Retrieved Dropout Analysis
library(dplyr)

imputed <- original %>%
  mutate(
    retrieved_flag = ifelse(
      !is.na(discontinue_date) & visit_date > discontinue_date,
      1, 0
    ),
    dtype = ifelse(retrieved_flag == 1, 'RETRIEVED', NA)
  )`,
        considerations: [
          'Only applicable if protocol includes retrieved dropout visits',
          'Need to carefully document in SDRG',
          'Consider as-treated vs ITT analysis implications',
          'May have different missingness pattern than standard dropouts'
        ],
        variations: [
          'Use retrieved data for all endpoints',
          'Use retrieved data only for safety',
          'Hybrid approach with imputation for non-retrieved'
        ]
      }
    ];

    // 3. Define 15 DER (Derivations) patterns
    const derPatterns = [
      {
        id: 'DER-001',
        category: 'DER',
        title: 'Change from Baseline Calculation',
        problem: 'Calculate the change from baseline value for efficacy endpoints',
        whenToUse: 'Standard derivation for most continuous efficacy endpoints in clinical trials',
        sasCode: `/* Change from Baseline */
data derived;
  merge adsl
        adlb(where=(visitnum=0) rename=(aval=base))
        adlb(where=(visitnum>0));
  by usubjid;

  chg = aval - base;
  pchg = (aval - base) / base * 100;
run;`,
        rCode: `# Change from Baseline
library(dplyr)

derived <- adlb %>%
  group_by(usubjid) %>%
  mutate(
    base = aval[visitnum == 0],
    chg = aval - base,
    pchg = (aval - base) / base * 100
  ) %>%
  ungroup()`,
        considerations: [
          'Ensure baseline is properly defined (last pre-dose)',
          'Handle missing baseline appropriately',
          'Percent change undefined when baseline is zero',
          'Document baseline definition in SDRG'
        ],
        variations: [
          'Percent change from baseline',
          'Log change for skewed data',
          'Change from worst post-baseline value'
        ]
      },
      {
        id: 'DER-002',
        category: 'DER',
        title: 'Analysis Flags (ANLzzFL)',
        problem: 'Flag records to be included in specific analyses',
        whenToUse: 'Every ADaM dataset to identify analysis population records',
        sasCode: `/* Analysis Flags */
data adam;
  set raw;

  /* Baseline flag - last non-missing pre-dose */
  if visitnum = 0 and not missing(aval) then
    ablfl = 'Y';

  /* Analysis flag - one record per visit */
  if visitnum > 0 and not missing(aval) and
     param = 'Hemoglobin (g/dL)' then
     anl01fl = 'Y';
run;

proc sort data=adam;
  by usubjid visitnum descending aval;
run;

data adam;
  set adam;
  by usubjid visitnum;

  /* Keep only most recent if duplicates */
  if first.visitnum then anl01fl = 'Y';
  else anl01fl = 'N';
run;`,
        rCode: `# Analysis Flags
library(dplyr)

adam <- raw %>%
  group_by(usubjid) %>%
  mutate(
    # Baseline flag
    ablfl = ifelse(visitnum == 0 & !is.na(aval), 'Y', 'N'),

    # Analysis flag
    anl01fl = ifelse(
      visitnum > 0 & !is.na(aval) & param == 'Hemoglobin (g/dL)',
      'Y', 'N'
    )
  ) %>%
  arrange(usubjid, visitnum, desc(aval)) %>%
  mutate(
    # Keep first record per visit
    anl01fl = ifelse(row_number() == 1 & visitnum > 0, 'Y', 'N')
  ) %>%
  ungroup()`,
        considerations: [
          'Multiple analysis flags may be needed (ANL01FL, ANL02FL, etc.)',
          'Document flag logic in dataset metadata',
          'Baseline flag (ABLFL) separate from analysis flag',
          'Consider unscheduled visits'
        ],
        variations: [
          'Multiple baseline flags for different parameters',
          'Safety-specific flags (exclude post-discontinuation)',
          'Per-protocol vs ITT flags'
        ]
      },
      {
        id: 'DER-003',
        category: 'DER',
        title: 'Treatment-Emergent Adverse Event (TEAE) Flag',
        problem: 'Identify adverse events that occurred during treatment period',
        whenToUse: 'Standard safety analysis in all clinical trials',
        sasCode: `/* TEAE Derivation */
data adae;
  merge ae(in=a)
        adsl(keep=usubjid trtsdt trtedt);
  by usubjid;
  if a;

  /* Convert dates */
  aestdt_num = input(aestdtc, yymmdd10.);

  /* TEAE logic */
  if aestdt_num >= trtsdt and
     (aestdt_num <= trtedt + 30 or missing(trtedt)) then
     trtemfl = 'Y';
  else trtemfl = 'N';
run;`,
        rCode: `# TEAE Derivation
library(dplyr)
library(lubridate)

adae <- ae %>%
  left_join(adsl %>% select(usubjid, trtsdt, trtedt), by = 'usubjid') %>%
  mutate(
    aestdt_num = ymd(aestdtc),
    trtemfl = ifelse(
      aestdt_num >= trtsdt & (aestdt_num <= trtedt + 30 | is.na(trtedt)),
      'Y', 'N'
    )
  )`,
        considerations: [
          'Define treatment period clearly (include follow-up?)',
          'Handle missing AE start dates conservatively',
          'Consider 30-day post-treatment window',
          'Partial dates require special handling'
        ],
        variations: [
          'Treatment-related AEs',
          'On-treatment AEs (exclude follow-up)',
          'Study treatment-emergent (from first dose)'
        ]
      },
      {
        id: 'DER-004',
        category: 'DER',
        title: 'Worst Post-Baseline Value',
        problem: 'Identify the worst (highest/lowest) post-baseline value for safety parameters',
        whenToUse: 'Safety lab shift tables and worst-case analyses',
        sasCode: `/* Worst Post-Baseline - Higher is Worse */
proc sort data=adlb;
  by usubjid paramcd descending aval;
run;

data worst;
  set adlb;
  by usubjid paramcd;

  if first.paramcd and visitnum > 0 then do;
    wors01fl = 'Y';
    aval_worst = aval;
  end;
run;

/* For parameters where lower is worse */
proc sort data=adlb_low;
  by usubjid paramcd aval;
run;`,
        rCode: `# Worst Post-Baseline
library(dplyr)

worst_high <- adlb %>%
  filter(visitnum > 0) %>%
  group_by(usubjid, paramcd) %>%
  arrange(desc(aval)) %>%
  slice(1) %>%
  mutate(wors01fl = 'Y', aval_worst = aval) %>%
  ungroup()

worst_low <- adlb %>%
  filter(visitnum > 0) %>%
  group_by(usubjid, paramcd) %>%
  arrange(aval) %>%
  slice(1) %>%
  mutate(wors01fl = 'Y', aval_worst = aval) %>%
  ungroup()`,
        considerations: [
          'Define direction of worst (higher vs lower) by parameter',
          'Exclude baseline from worst calculation',
          'Consider clinically significant changes only',
          'May need separate flags for each severity grade'
        ],
        variations: [
          'Worst post-baseline severity grade',
          'Worst within normal range vs abnormal',
          'Worst change from baseline (not absolute value)'
        ]
      },
      {
        id: 'DER-005',
        category: 'DER',
        title: 'Laboratory Reference Range Flags',
        problem: 'Flag lab values as normal, low, or high relative to reference range',
        whenToUse: 'All lab datasets (ADLB) for shift tables and abnormality analysis',
        sasCode: `/* Reference Range Flags */
data adlb;
  set lb;

  /* Normal/Abnormal */
  if not missing(aval) then do;
    if aval < anrlo then do;
      bnrind = 'LOW';
      if aval < anrlo * 0.5 then bnrind = 'VERY LOW';
    end;
    else if aval > anrhi then do;
      bnrind = 'HIGH';
      if aval > anrhi * 1.5 then bnrind = 'VERY HIGH';
    end;
    else bnrind = 'NORMAL';
  end;
run;`,
        rCode: `# Reference Range Flags
library(dplyr)

adlb <- lb %>%
  mutate(
    bnrind = case_when(
      is.na(aval) ~ NA_character_,
      aval < anrlo * 0.5 ~ 'VERY LOW',
      aval < anrlo ~ 'LOW',
      aval > anrhi * 1.5 ~ 'VERY HIGH',
      aval > anrhi ~ 'HIGH',
      TRUE ~ 'NORMAL'
    )
  )`,
        considerations: [
          'Reference ranges may vary by age, sex, unit',
          'Use ANRLO/ANRHI from lab normals dataset',
          'Consider protocol-defined thresholds vs lab normals',
          'Document threshold multipliers (e.g., 1.5x ULN)'
        ],
        variations: [
          'CTCAE grading (Grade 1-5)',
          'High/Low/Normal relative to baseline',
          'Percent of upper/lower limit of normal'
        ]
      },
      {
        id: 'DER-006',
        category: 'DER',
        title: 'Vital Signs Change Categories',
        problem: 'Categorize vital sign changes into clinically meaningful groups',
        whenToUse: 'Vital signs analysis for safety reporting',
        sasCode: `/* Vital Signs Categories */
data advs;
  set vs;

  /* Systolic BP categories */
  if paramcd = 'SYSBP' then do;
    if aval < 90 then aval_cat = 'Hypotensive';
    else if aval >= 90 and aval <= 120 then aval_cat = 'Normal';
    else if aval > 120 and aval <= 140 then aval_cat = 'Elevated';
    else if aval > 140 then aval_cat = 'Hypertensive';

    /* Orthostatic hypotension */
    if chg <= -20 and position = 'STANDING' then
      orthofl = 'Y';
  end;
run;`,
        rCode: `# Vital Signs Categories
library(dplyr)

advs <- vs %>%
  mutate(
    aval_cat = case_when(
      paramcd == 'SYSBP' & aval < 90 ~ 'Hypotensive',
      paramcd == 'SYSBP' & aval >= 90 & aval <= 120 ~ 'Normal',
      paramcd == 'SYSBP' & aval > 120 & aval <= 140 ~ 'Elevated',
      paramcd == 'SYSBP' & aval > 140 ~ 'Hypertensive',
      TRUE ~ NA_character_
    ),
    orthofl = ifelse(chg <= -20 & position == 'STANDING', 'Y', 'N')
  )`,
        considerations: [
          'Use clinically validated thresholds',
          'Consider age-appropriate ranges for pediatrics',
          'Position (sitting, standing, supine) affects interpretation',
          'Orthostatic changes require paired measurements'
        ],
        variations: [
          'Heart rate categories (bradycardia, tachycardia)',
          'BMI categories',
          'Temperature categories (hypothermia, fever)'
        ]
      },
      {
        id: 'DER-007',
        category: 'DER',
        title: 'Exposure Duration Calculation',
        problem: 'Calculate duration of exposure to study treatment',
        whenToUse: 'Safety analysis denominators and exposure-adjusted event rates',
        sasCode: `/* Exposure Duration */
data adex;
  set ex;
  by usubjid;

  /* Convert dates */
  exstdt_num = input(exstdtc, yymmdd10.);
  exendt_num = input(exendtc, yymmdd10.);

  /* Duration in days */
  if not missing(exendt_num) then
    exdur = exendt_num - exstdt_num + 1;

  /* Total exposure per subject */
  if last.usubjid then do;
    trtdur = sum(of exdur);
    output;
  end;
run;`,
        rCode: `# Exposure Duration
library(dplyr)
library(lubridate)

adex <- ex %>%
  mutate(
    exstdt_num = ymd(exstdtc),
    exendt_num = ymd(exendtc),
    exdur = as.numeric(exendt_num - exstdt_num) + 1
  ) %>%
  group_by(usubjid) %>%
  summarise(trtdur = sum(exdur, na.rm = TRUE))`,
        considerations: [
          'Include partial days or not (add 1 vs not)',
          'Handle ongoing treatment (missing end date)',
          'Consider dose interruptions',
          'Convert to patient-years for incidence rates'
        ],
        variations: [
          'Exposure in patient-years',
          'Cumulative dose',
          'Average daily dose'
        ]
      },
      {
        id: 'DER-008',
        category: 'DER',
        title: 'Visit Window Assignment',
        problem: 'Assign unscheduled or off-window assessments to protocol visits',
        whenToUse: 'When analysis requires aligning data to protocol-defined visit schedule',
        sasCode: `/* Visit Window Assignment */
data windowed;
  set raw;

  /* Calculate study day */
  study_day = input(visit_date, yymmdd10.) - input(rfstdtc, yymmdd10.) + 1;

  /* Assign to nearest window */
  if study_day >= -3 and study_day <= 3 then do;
    avisit = 'Baseline';
    avisitn = 0;
  end;
  else if study_day >= 11 and study_day <= 17 then do;
    avisit = 'Week 2';
    avisitn = 2;
  end;
  else if study_day >= 25 and study_day <= 31 then do;
    avisit = 'Week 4';
    avisitn = 4;
  end;
  else do;
    avisit = 'Unscheduled';
    avisitn = .U;
  end;
run;`,
        rCode: `# Visit Window Assignment
library(dplyr)
library(lubridate)

windowed <- raw %>%
  mutate(
    study_day = as.numeric(ymd(visit_date) - ymd(rfstdtc)) + 1,
    avisit = case_when(
      study_day >= -3 & study_day <= 3 ~ 'Baseline',
      study_day >= 11 & study_day <= 17 ~ 'Week 2',
      study_day >= 25 & study_day <= 31 ~ 'Week 4',
      TRUE ~ 'Unscheduled'
    ),
    avisitn = case_when(
      avisit == 'Baseline' ~ 0,
      avisit == 'Week 2' ~ 2,
      avisit == 'Week 4' ~ 4,
      TRUE ~ NA_real_
    )
  )`,
        considerations: [
          'Define windows in SDRG',
          'Handle multiple assessments within window',
          'Decide whether to include unscheduled visits',
          'Use target dates from protocol'
        ],
        variations: [
          'Assign to closest scheduled visit',
          'Symmetric vs asymmetric windows',
          'Include unscheduled visits with separate flag'
        ]
      },
      {
        id: 'DER-009',
        category: 'DER',
        title: 'Adverse Event Severity Grading',
        problem: 'Assign CTCAE or protocol-defined severity grades to adverse events',
        whenToUse: 'Safety analysis requiring severity categorization',
        sasCode: `/* CTCAE Severity Mapping */
proc format;
  value $aesev
    'MILD' = 1
    'MODERATE' = 2
    'SEVERE' = 3
    'LIFE THREATENING' = 4
    'DEATH' = 5;
run;

data adae;
  set ae;

  aesevn = put(aesev, $aesev.);

  /* Maximum severity per subject-term */
  proc sql;
    create table max_sev as
    select usubjid, aedecod, max(aesevn) as maxsevn
    from adae
    group by usubjid, aedecod;
  quit;
run;`,
        rCode: `# CTCAE Severity Mapping
library(dplyr)

severity_map <- c(
  'MILD' = 1,
  'MODERATE' = 2,
  'SEVERE' = 3,
  'LIFE THREATENING' = 4,
  'DEATH' = 5
)

adae <- ae %>%
  mutate(aesevn = severity_map[aesev]) %>%
  group_by(usubjid, aedecod) %>%
  mutate(maxsevn = max(aesevn, na.rm = TRUE)) %>%
  ungroup()`,
        considerations: [
          'Use CTCAE version specified in protocol',
          'Some AEs may have lab-based grading',
          'Maximum severity often used in summary tables',
          'Grade 5 = death'
        ],
        variations: [
          'CTCAE v5.0 grading',
          'Protocol-specific severity',
          'Intensity (mild/moderate/severe) vs Grade (1-5)'
        ]
      },
      {
        id: 'DER-010',
        category: 'DER',
        title: 'ECG Interval QTc Correction',
        problem: 'Calculate corrected QT interval using Bazett or Fridericia formula',
        whenToUse: 'Cardiac safety analysis in thorough QT studies and other trials',
        sasCode: `/* QTc Calculations */
data adeg;
  set eg;

  /* Bazett correction: QTcB = QT / sqrt(RR) */
  /* RR in seconds = 60/HR */
  rr_sec = 60 / hr;
  qtcb = qt / sqrt(rr_sec);

  /* Fridericia correction: QTcF = QT / (RR^0.333) */
  qtcf = qt / (rr_sec ** 0.333);

  /* Categorical QTc */
  if qtcf < 450 then qtc_cat = 'Normal';
  else if qtcf >= 450 and qtcf < 480 then qtc_cat = 'Borderline';
  else if qtcf >= 480 and qtcf < 500 then qtc_cat = 'Prolonged';
  else if qtcf >= 500 then qtc_cat = 'Highly Prolonged';
run;`,
        rCode: `# QTc Calculations
library(dplyr)

adeg <- eg %>%
  mutate(
    rr_sec = 60 / hr,
    qtcb = qt / sqrt(rr_sec),
    qtcf = qt / (rr_sec ^ 0.333),
    qtc_cat = case_when(
      qtcf < 450 ~ 'Normal',
      qtcf >= 450 & qtcf < 480 ~ 'Borderline',
      qtcf >= 480 & qtcf < 500 ~ 'Prolonged',
      qtcf >= 500 ~ 'Highly Prolonged'
    )
  )`,
        considerations: [
          'Fridericia preferred for most drugs',
          'Bazett overcorrects at high heart rates',
          'Sex-specific thresholds (450 males, 470 females)',
          'Regulatory thresholds: 500ms or >60ms increase'
        ],
        variations: [
          'Population-specific correction formula',
          'Individual correction (subject-specific slope)',
          'Delta QTcF (change from baseline)'
        ]
      },
      {
        id: 'DER-011',
        category: 'DER',
        title: 'Treatment Compliance/Adherence Calculation',
        problem: 'Calculate percentage of prescribed doses actually taken',
        whenToUse: 'Evaluating protocol compliance and exposure in per-protocol analysis',
        sasCode: `/* Treatment Adherence */
data compliance;
  merge ex(in=a keep=usubjid exdose exdosfrq)
        adsl(keep=usubjid trtsdt trtedt);
  by usubjid;
  if a;

  /* Expected doses */
  days_on_trt = trtedt - trtsdt + 1;

  if exdosfrq = 'QD' then expected_doses = days_on_trt;
  else if exdosfrq = 'BID' then expected_doses = days_on_trt * 2;

  /* Calculate compliance */
  compliance_pct = (actual_doses / expected_doses) * 100;

  /* Categorize */
  if compliance_pct >= 80 then complfl = 'Y';
  else complfl = 'N';
run;`,
        rCode: `# Treatment Adherence
library(dplyr)
library(lubridate)

compliance <- ex %>%
  left_join(adsl %>% select(usubjid, trtsdt, trtedt), by = 'usubjid') %>%
  mutate(
    days_on_trt = as.numeric(trtedt - trtsdt) + 1,
    expected_doses = case_when(
      exdosfrq == 'QD' ~ days_on_trt,
      exdosfrq == 'BID' ~ days_on_trt * 2,
      TRUE ~ NA_real_
    ),
    compliance_pct = (actual_doses / expected_doses) * 100,
    complfl = ifelse(compliance_pct >= 80, 'Y', 'N')
  )`,
        considerations: [
          'Standard threshold is 80% compliance',
          'Consider dose interruptions and modifications',
          'Distinguish between non-compliance and dose reduction',
          'Compliance calculated from exposure, not diary'
        ],
        variations: [
          'Pill count method',
          'Diary-based adherence',
          'MEMS cap (electronic monitoring)'
        ]
      },
      {
        id: 'DER-012',
        category: 'DER',
        title: 'Baseline and Post-Baseline Record Selection',
        problem: 'Identify last pre-dose measurement as baseline and separate post-baseline records',
        whenToUse: 'Every ADaM BDS dataset requiring baseline comparison',
        sasCode: `/* Baseline Selection */
proc sort data=raw;
  by usubjid paramcd adtm;
run;

data adam;
  set raw;
  by usubjid paramcd;

  /* Last non-missing pre-dose = baseline */
  if ady <= 0 and not missing(aval) then
    baseline_candidate = 1;
  else baseline_candidate = 0;

  /* Keep last baseline candidate */
  if last.paramcd and baseline_candidate = 1 then
    ablfl = 'Y';
run;

/* Post-baseline records */
data post_baseline;
  set adam(where=(ady > 0));
run;`,
        rCode: `# Baseline Selection
library(dplyr)

adam <- raw %>%
  group_by(usubjid, paramcd) %>%
  arrange(adtm) %>%
  mutate(
    baseline_candidate = ifelse(ady <= 0 & !is.na(aval), 1, 0),
    ablfl = ifelse(
      row_number() == max(row_number()[baseline_candidate == 1]) & baseline_candidate == 1,
      'Y', 'N'
    )
  ) %>%
  ungroup()

post_baseline <- adam %>% filter(ady > 0)`,
        considerations: [
          'Define baseline window clearly',
          'Handle subjects with no baseline',
          'Multiple baselines for different parameters possible',
          'Document handling of pre-dose missing values'
        ],
        variations: [
          'First non-missing pre-dose (rare)',
          'Average of multiple baseline assessments',
          'Run-in baseline vs randomization baseline'
        ]
      },
      {
        id: 'DER-013',
        category: 'DER',
        title: 'Age Group Categorization',
        problem: 'Categorize continuous age into standardized groups for stratification',
        whenToUse: 'Demographics table and age-stratified analyses',
        sasCode: `/* Age Categorization */
data adsl;
  set dm;

  /* Standard age groups */
  if age < 18 then agegr1 = '<18';
  else if age >= 18 and age < 65 then agegr1 = '18-64';
  else if age >= 65 and age < 75 then agegr1 = '65-74';
  else if age >= 75 then agegr1 = '>=75';

  /* Numeric version for ordering */
  if agegr1 = '<18' then agegr1n = 1;
  else if agegr1 = '18-64' then agegr1n = 2;
  else if agegr1 = '65-74' then agegr1n = 3;
  else if agegr1 = '>=75' then agegr1n = 4;

  /* Pediatric subgroups */
  if age < 2 then agegr2 = 'Infant';
  else if age >= 2 and age < 12 then agegr2 = 'Child';
  else if age >= 12 and age < 18 then agegr2 = 'Adolescent';
run;`,
        rCode: `# Age Categorization
library(dplyr)

adsl <- dm %>%
  mutate(
    agegr1 = case_when(
      age < 18 ~ '<18',
      age >= 18 & age < 65 ~ '18-64',
      age >= 65 & age < 75 ~ '65-74',
      age >= 75 ~ '>=75'
    ),
    agegr1n = case_when(
      agegr1 == '<18' ~ 1,
      agegr1 == '18-64' ~ 2,
      agegr1 == '65-74' ~ 3,
      agegr1 == '>=75' ~ 4
    ),
    agegr2 = case_when(
      age < 2 ~ 'Infant',
      age >= 2 & age < 12 ~ 'Child',
      age >= 12 & age < 18 ~ 'Adolescent'
    )
  )`,
        considerations: [
          'Use protocol-defined age groups if specified',
          'ICH E7 uses 65+ for geriatric subgroup',
          'Pediatric studies have different groupings',
          'Consider numeric version for ordering in outputs'
        ],
        variations: [
          'Decade-based groupings (20-29, 30-39, etc.)',
          'FDA pediatric age groups',
          'Custom protocol-specified groups'
        ]
      },
      {
        id: 'DER-014',
        category: 'DER',
        title: 'Derived Treatment Variables',
        problem: 'Create analysis treatment variables from randomized and actual treatments',
        whenToUse: 'ADSL creation - foundation for all safety and efficacy analyses',
        sasCode: `/* Treatment Variables */
data adsl;
  merge dm(in=a)
        ex(keep=usubjid exdose rename=(exdose=actdose));
  by usubjid;
  if a;

  /* Planned treatment (from randomization) */
  trt01p = arm;
  if trt01p = 'Placebo' then trt01pn = 0;
  else if trt01p = 'Low Dose' then trt01pn = 1;
  else if trt01p = 'High Dose' then trt01pn = 2;

  /* Actual treatment (as-treated) */
  if actdose = 0 then do;
    trt01a = 'Placebo';
    trt01an = 0;
  end;
  else if actdose > 0 and actdose <= 50 then do;
    trt01a = 'Low Dose';
    trt01an = 1;
  end;
  else if actdose > 50 then do;
    trt01a = 'High Dose';
    trt01an = 2;
  end;
run;`,
        rCode: `# Treatment Variables
library(dplyr)

adsl <- dm %>%
  left_join(ex %>% select(usubjid, exdose) %>% rename(actdose = exdose),
            by = 'usubjid') %>%
  mutate(
    # Planned treatment
    trt01p = arm,
    trt01pn = case_when(
      trt01p == 'Placebo' ~ 0,
      trt01p == 'Low Dose' ~ 1,
      trt01p == 'High Dose' ~ 2
    ),
    # Actual treatment
    trt01a = case_when(
      actdose == 0 ~ 'Placebo',
      actdose > 0 & actdose <= 50 ~ 'Low Dose',
      actdose > 50 ~ 'High Dose'
    ),
    trt01an = case_when(
      trt01a == 'Placebo' ~ 0,
      trt01a == 'Low Dose' ~ 1,
      trt01a == 'High Dose' ~ 2
    )
  )`,
        considerations: [
          'TRT01P for ITT analysis, TRT01A for safety',
          'Handle treatment switches/crossovers',
          'Maintain consistent ordering across datasets',
          'Document any dose grouping decisions'
        ],
        variations: [
          'Combined treatment groups',
          'Dose-level groupings',
          'Modified ITT (mITT) treatment assignment'
        ]
      },
      {
        id: 'DER-015',
        category: 'DER',
        title: 'Analysis Date (ADT) and Day (ADY) Derivation',
        problem: 'Convert character dates to numeric and calculate study day relative to reference',
        whenToUse: 'All ADaM datasets - fundamental temporal variables',
        sasCode: `/* Date and Day Derivation */
data adam;
  set raw;

  /* Convert character date to numeric */
  adt = input(dtc, yymmdd10.);
  format adt yymmdd10.;

  /* Analysis day relative to first dose */
  if not missing(adt) and not missing(trtsdt) then do;
    if adt >= trtsdt then
      ady = adt - trtsdt + 1;
    else
      ady = adt - trtsdt;
  end;

  /* Baseline flag based on day */
  if ady <= 0 then baseline_rec = 1;
  else baseline_rec = 0;
run;`,
        rCode: `# Date and Day Derivation
library(dplyr)
library(lubridate)

adam <- raw %>%
  mutate(
    adt = ymd(dtc),
    ady = case_when(
      is.na(adt) | is.na(trtsdt) ~ NA_real_,
      adt >= trtsdt ~ as.numeric(adt - trtsdt) + 1,
      adt < trtsdt ~ as.numeric(adt - trtsdt)
    ),
    baseline_rec = ifelse(ady <= 0, 1, 0)
  )`,
        considerations: [
          'No study day 0 (goes from -1 to +1)',
          'Handle partial dates (--UN or ---UN)',
          'Reference date typically TRTSDT from ADSL',
          'RFSTDTC may differ from TRTSDT for some subjects'
        ],
        variations: [
          'Study day relative to screening',
          'Study day relative to randomization',
          'Elapsed days (no day 0 adjustment)'
        ]
      }
    ];

    // 4. Insert pattern definitions
    console.log('Inserting pattern definitions...');

    for (const pattern of [...impPatterns, ...derPatterns]) {
      await db.insert(patternDefinitions).values({
        id: pattern.id,
        category: pattern.category,
        title: pattern.title,
        problem: pattern.problem,
        whenToUse: pattern.whenToUse
      });
    }

    // 5. Insert implementations
    console.log('Inserting pattern implementations...');

    for (const pattern of [...impPatterns, ...derPatterns]) {
      await db.insert(patternImplementations).values({
        patternId: pattern.id,
        authorId: systemUserId,
        authorName: 'System',
        sasCode: pattern.sasCode,
        rCode: pattern.rCode,
        considerations: pattern.considerations,
        variations: pattern.variations,
        status: 'active',
        isPremium: false
      });
    }

    // 6. Return success response
    return res.status(200).json({
      success: true,
      message: 'Database seeded successfully',
      summary: {
        patternsCreated: impPatterns.length + derPatterns.length,
        impPatterns: impPatterns.length,
        derPatterns: derPatterns.length,
        implementationsCreated: impPatterns.length + derPatterns.length,
        systemUserId: systemUserId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Seeding error:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Database seeding failed'
    });
  }
}
