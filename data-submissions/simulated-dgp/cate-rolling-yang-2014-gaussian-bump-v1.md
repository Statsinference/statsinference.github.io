# Localized CATE heterogeneity hidden by a simple marginal response

## Research question

- **Question and intended use.** Can a method recover the conditional average treatment effect (CATE) at a prespecified covariate value when the effect has a sharp local peak but the mean response across treatment arms is linear? This simulation is a candidate for benchmark evaluation.
- **Behavior under test.** The two arms have opposite-signed bumps at the same covariate value. Averaging the arms cancels the bumps. Subtracting the control mean from the treatment mean doubles the bump. A method can therefore fit the pooled trend well and still miss the local treatment effect.

## Study design and data source

- **Motivation and references.** Rolling and Yang (2014) specify equal-probability randomization and Gaussian errors in Section 5. Section 5.2 carries forward the covariate distribution, sample size and noise scale from Section 5.1 and gives the two arm means. The paper evaluates errors across the design distribution. This proposal takes those arm means and evaluates their contrast at one query fixed before simulation. The pointwise interval, scoring protocol and replication count below are benchmark adaptations. [Rolling and Yang, *Model selection for estimating treatment effects*, JRSS B 76, 749–769](https://doi.org/10.1111/rssb.12043)
- **Population and sampling.** Each synthetic table contains 300 independent individuals from the source design. Each individual contributes one pretreatment measurement, one randomized assignment and one continuous response. Arm counts vary with randomization.

## DAG and identification

- **Variables and causal structure.** The baseline covariate `U` modifies the treatment effect. Treatment `A` is randomized. The latent disturbance `E` enters only the outcome `Y`. The interaction between `U` and `A` is encoded in the arm means.
- **DAG edges.** `U -> Y, A -> Y, E -> Y`
- **Assumptions.** Random assignment gives exchangeability, and each arm has positive probability throughout the covariate support. With consistency and no interference, the observed arm mean at $u$ identifies the mean potential outcome under that treatment given $U=u$. The smooth arm functions specify this conditional mean at the exact query even when no sampled individual has that value.

## Variables and data-generating process

- **Variables and observed input.** Each estimator receives the same three-column table in the order `U,A,Y` and the same scalar query `u_star` as separate task metadata. The table has one row per individual.

| ID | Support or units | Role and availability |
| --- | --- | --- |
| `U` | Real, $[0,1]$, unitless | Observed pretreatment covariate |
| `A` | Integer, 0 or 1 | Observed assignment, with 0 for control and 1 for treatment |
| `Y` | Real, in response units | Observed outcome under the assigned treatment |
| `E` | Real, in response units | Latent, mean-zero outcome noise |
| `u_star` | Fixed scalar in $[0,1]$ | Evaluation query shared with each estimator, held fixed across tables |

- **Draw order and scenarios.** In each replicate, draw `U`, assign `A`, draw `E` and compute `Y` for each individual. All row-level draws are independent across individuals. There is one scenario. The query, arm functions, assignment probability and noise scale stay fixed across replicates. Each replicate uses its assigned generator seed from the private review materials, and all methods use the same realized table. The estimator receives only the observed columns and query.

### Structural equations

- **Structural parents.** `U -> Y, A -> Y, E -> Y`

For individual $i$, draw the following three variables independently, with the same distributions in each replicate:

$$
U_i \sim \mathrm{Uniform}(0,1), \qquad
A_i \sim \mathrm{Bernoulli}(1/2), \qquad
E_i \sim \mathcal{N}(0,\sigma^2).
$$

Here $\sigma>0$ is the common outcome-noise standard deviation in both arms. In particular, assignment is independent of the baseline covariate and outcome noise, and the noise distribution is constant across covariate values.

Write the Gaussian bump and the two Section 5.2 arm means using named coefficients:

$$
\begin{aligned}
g(u) &= b\exp\!\left[-k(u-c)^2\right],\\
\mu_0(u) &= \beta u-g(u),\\
\mu_1(u) &= d+\beta u+g(u).
\end{aligned}
$$

The center $c$ lies in $[0,1]$, $b>0$ is the peak height, and $k>0$ determines how quickly the bump decays away from $c$. Both arms have slope $\beta$ in their common linear component, and $d$ is the constant treatment offset. These symbols express the paper's fixed coefficients. The private configuration records their values. Generate the observed outcome in response units as

$$
Y_i=(1-A_i)\mu_0(U_i)+A_i\mu_1(U_i)+E_i.
$$

Consequently $\mu_a(u)=\mathbb{E}[Y\mid U=u,A=a]$ for $a\in\{0,1\}$. Under equal allocation, $\mathbb{E}[Y\mid U=u]=\{\mu_0(u)+\mu_1(u)\}/2=\beta u+d/2$. The bump cancels in this pooled mean.

## Data-generating process and estimand

- **Estimand.** The reference estimand is `tau(u_star) = mu_1(u_star) - mu_0(u_star)`. It equals $\mathbb{E}[Y(1)-Y(0)\mid U=u_\star]$, the treatment-minus-control mean difference in response units at the fixed query.
- **Truth check.** Subtracting the arm means gives $\tau(u)=d+2b\exp[-k(u-c)^2]$. At the center the effect is $d+2b$, and away from the center its excess over $d$ decays. For the private query, compute the two arm means separately, subtract control from treatment, and compare that result with both the closed-form contrast and the stored reference value within the documented numerical tolerance. The reference is analytic and does not depend on a replicate seed or a fitted model.

## Benchmark comparison

- **Output and comparator.** Request one point estimate and, for methods that support it, a nominal 95% pointwise interval at the shared query. Fit a smoothing spline separately in each arm and subtract the predictions at the query. A second comparator is linear regression on `A`, `U` and their interaction, using the same prediction contrast. Fix tuning, preprocessing, interval construction and compute budgets before evaluation.
- **Scoring and replication.** Attempt 1,000 independent tables of 300 rows under the single fixed scenario. For each method, report bias and root mean squared error over valid point estimates. For interval-producing methods, report empirical coverage and mean length over valid intervals. Give each metric's denominator, point and interval availability out of 1,000 attempts, failure and timeout counts, and runtime. Use paired tables for method comparisons and quantify Monte Carlo uncertainty at the table level. Set retry rules before evaluation. The 1,000-replicate comparison is proposed work.

## Materials and access

- **Public materials.** The source article documents the simulation design and its original evaluation. The equations above restate the mechanism in the notation used for this benchmark. The publisher's terms govern reuse of the article. [Publisher article](https://academic.oup.com/jrsssb/article/76/4/749/7076033)
- **Reproduction and protected materials.** The designated private review bundle is `cate-rolling-yang-2014-gaussian-bump-v1.zip`. For maintainer review, supply the generator and independent truth-checking code, the code version or pinned environment, source audit, mechanism card, variable schema, and scenario configuration with the exact query, coefficients, noise scale, seed assignments and reference value. Include one bounded command with its working directory and dependencies. That command should generate one 300-row `U,A,Y` table from the designated seed, check the schema, and compare the arm-mean difference and closed-form contrast against the stored reference. Write reference metadata separately from the observed table. Deliver the bundle and any official evaluation tables through the private channel agreed with a maintainer.
