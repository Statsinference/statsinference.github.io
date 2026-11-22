# Localized CATE heterogeneity hidden by a simple marginal response

## Research question

- **Question and intended use.** Can a method recover a prespecified pointwise conditional average treatment effect when the treatment contrast is strongly localized but the marginal outcome regression is simple? This is a simulation proposal for curator consideration as an evaluation candidate.
- **Behavior under test.** Opposite-signed nonlinear features in the two treatment-arm means produce a localized effect that cancels in the marginal response. This separates accuracy for predicting observed outcomes from accuracy for estimating treatment-effect heterogeneity.

## Study design and data source

- **Motivation and references.** The mechanism comes from Section 5.2 of Rolling, C. A. and Yang, Y. (2014), *Model selection for estimating treatment effects*, Journal of the Royal Statistical Society: Series B (Statistical Methodology), 76(4), 749-769, [DOI: 10.1111/rssb.12043](https://doi.org/10.1111/rssb.12043). General simulation rules and the preceding section specify covariate sampling, randomization and noise; Section 5.2 specifies the arm-mean functions. The mechanism is source-grounded; selecting a single fixed query and implementing the numerical interface are declared adaptations.
- **Population and sampling.** Independent individuals have one continuous pretreatment covariate, a randomized binary treatment and a continuous outcome. The source uses 300 total observations per dataset, with random arm counts. This proposal preserves that table size for a prospective comparison. It uses synthetic data and does not claim calibration to real patients or reproduction of the source clinical application.

## DAG and identification

- **Variables and causal structure.** The observed columns are the pretreatment effect modifier `U`, treatment `A` and response `Y`, with directed relations `U -> Y` and `A -> Y`. Treatment assignment has no parents among the baseline variables and is generated independently. Independent outcome noise is used internally and is not supplied to methods.
- **Assumptions.** Consistency, a well-defined binary intervention, no interference, independent individuals, randomized treatment exchangeability and positivity identify the conditional mean contrast. The source's smooth response functions specify the conditional version at the query. No assumption violation is deliberately introduced in this proposal.

## Data-generating process and estimand

- **Observed input.** Each row is one individual with only `U,A,Y`. Each method also receives the same prespecified query as allowed task metadata. Neither truth values nor counterfactual outcomes, oracle response functions or realized noise are method inputs.
- **Generator and scenarios.** Draw the continuous baseline covariate, independently randomize treatment, and generate a homoskedastic Gaussian response around the source's treatment-specific mean. The two means share a linear component and contain opposite-signed localized Gaussian bumps. One source mechanism is proposed; changing random seeds or query values does not create a new mechanism family. Exact numerical settings and the protected query specification are reserved for private review.
- **Estimand.** The scalar target is `tau(u_star) = E[Y(1)-Y(0) | U=u_star]`, treatment relative to control, at a fixed query declared before evaluation. Its units match the response. This is pointwise CATE; it is not a population ATE, a realized individual effect, or simultaneous coverage of the full effect curve.
- **Truth check.** Obtain the reference analytically by subtracting the source arm means. Cross-check it through a separately transcribed arm model and numerical integration of conditional outcomes, a randomized-treatment conditional moment and interpretable special-case checks. Exact query values, reference numbers and case-specific numerical settings remain in private review.

## Benchmark comparison

- **Output and comparator.** Request a point estimate and, when supported, a nominal 95% pointwise interval for the common query. Proposed conventional comparators are treatment-arm smoothing-spline regressions combined as a T-learner and a simple linear model with treatment interactions. Interval construction, tuning, allowed preprocessing and computation budgets must be fixed before evaluation and use the same observed-data permissions.
- **Scoring and replication.** The proposed protocol uses 300 observations in each of 1000 independent datasets under the fixed source mechanism and fixed query. Methods are paired on the same tables. Report pointwise bias and RMSE, empirical interval coverage, interval length, output availability, all failures and runtime; report Monte Carlo uncertainty at the independent-dataset level. Retain failed, missing and timed-out attempts in the availability report and predeclare coverage denominators and retry rules. There is one mechanism, so no cross-scenario weighting is needed. This is a proposed protocol: the 1000-replicate method comparison has not been run, and no performance or coverage results are claimed.

## Materials and access

- **Public materials.** The cited paper and [publisher article](https://academic.oup.com/jrsssb/article/76/4/749/7076033) document the source design. This summary provides the scientific motivation and variable roles. The paper is already public research; this proposal does not claim an unseen mechanism or absence of pretraining exposure. Publisher copyright and any reuse permissions remain distinct from access to the article.
- **Reproduction and protected materials.** The private review bundle is named `cate-rolling-yang-2014-gaussian-bump-v1.zip`. It contains independently written generation and truth-checking code, the source audit, mechanism card, declared scenario, variable schema, dependency statement and execution checks. A bounded reproduction command generates an observed-only table and separate reference metadata. Exact query, parameters, seeds and scenario-specific truths, together with any evaluation tables, are shared through the channel agreed with a maintainer. Paper PDFs, copied author code, credentials and real individual records are not included. Named scientific review, independent-person reproduction and evaluation inclusion remain curator decisions.
