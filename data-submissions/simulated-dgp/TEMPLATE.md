# [TODO: Case title]

## Research question

- **Question and intended use.** [TODO: State the statistical question and whether this is a teaching example or a candidate for evaluation.]
- **Behavior under test.** [TODO: Explain the scientific or statistical behavior methods should recover, and why it matters.]

## Study design and data source

- **Motivation and references.** [TODO: Cite the study, data or methodological work that motivates the setting. Describe which design choices come from the reference and which you introduce.]
- **Population and sampling.** [TODO: Define the units, sampling design, dependence and sample sizes or ranges that can be shared.]

## DAG and identification

- **Variables and causal structure.** [TODO: Map observed and latent variables to their roles and available columns. Add a DAG or describe the directed relationships in text.]
- **Assumptions.** [TODO: State the assumptions that identify the target or explain which assumption the stress test deliberately violates.]

## Variables and data-generating process

- **Variables and observed input.** [TODO: Define each generated or fixed variable, its support or units, whether it is observed or latent, and its role. Specify the table grain and columns given to each estimator.]
- **Draw order and scenarios.** [TODO: State the sampling order, the level of each draw (such as unit, cluster or time period), and what varies or stays fixed across scenarios.]

### Structural equations

[TODO: Write the complete mathematical equations or conditional sampling distributions for all generated variables in draw order. Include deterministic transformations, link functions, error distributions and dependencies. Define every symbol and give time or cluster indices where relevant. Use named parameters for protected values and supply their exact settings in private review.]

## Data-generating process and estimand

- **Estimand.** [TODO: Define the contrast, scale, population and time horizon where relevant.]
- **Truth check.** [TODO: Describe the analytical, numerical or Monte Carlo calculation reviewers can use to verify the reference value. Keep protected case-specific values and settings in private review.]

## Benchmark comparison

- **Output and comparator.** [TODO: State the expected outputs and a baseline or comparison method with the same observable inputs.]
- **Scoring and replication.** [TODO: State the metrics, how replicate tables and scenarios are aggregated, and how failed or missing runs are counted.]

## Materials and access

- **Public materials.** [TODO: Link approved sources, code, documentation or teaching materials and state their sharing terms.]
- **Reproduction and protected materials.** [TODO: State how a reviewer can rerun one check. Name any full generator, configs, seeds, generated tables or truth calculations reserved for private review.]
