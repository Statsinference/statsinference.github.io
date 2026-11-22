# Simulated DGP

Propose one reproducible simulation that mirrors a documented study or isolates a statistical behavior worth testing. A reviewer should be able to generate a table, identify what each method receives and verify the target value independently.

[Copy the Markdown template](#3-copy-the-markdown-template) · [Submission steps](#4-check-and-open-the-pull-request) · [Worked example](#worked-public-example)

## 1. Check that the design fits

- Identify one inferential task and the behavior it tests. Examples include limited overlap, heterogeneous effects, nonlinear mediation and weak instruments. Explain why that behavior matters for the methods being compared.
- Ground the design in a study, empirical pattern or methodological reference where possible. Explain what the source supports and what you introduce. For a controlled stress test, say which feature changes and which parts of the design stay fixed across comparisons.
- State what the method observes. Keep latent variables, oracle nuisance functions, intervention outputs and reference values out of the observed input unless the task explicitly gives the same information to every method.

## 2. Prepare the evidence

| Required section | What a reviewer should be able to verify |
| --- | --- |
| Research question | The statistical target, intended use and behavior under test. Explain why this question is worth adding to the benchmark. |
| Study design and data source | The population or setting, unit of observation, relevant references and which settings are calibrated or introduced. Include the sampling structure and proposed table sizes. |
| DAG and identification | Observed and latent variable roles, directed edges, time ordering and identification assumptions. Document any intentional violations. |
| Variables and data-generating process | Variable definitions and table schema, full structural equations and their parent edges, sampling order, dependencies and scenario settings. |
| Data-generating process and estimand | The treatment or contrast, estimand and its units, and the calculation used to verify the reference value. |
| Benchmark comparison | Expected outputs, a baseline, shared inputs and scoring. Specify the number of attempted replicates, scenario weighting if relevant, and the treatment of failures. |
| Materials and access | Shareable references and reproducibility instructions. For official evaluation candidates, identify the files available for private review. |

### Match the DAG to the equations

Use the same short variable IDs in the graph and equations. A diagram is optional. If you include one, show the arrows for the scenario it describes and label nodes with the ID and a short role such as `A (treatment)`, `Y (outcome)` or `U (unobserved confounder)` for a latent common cause. Put definitions and assumptions in the prose.

List one arrow from every causal parent in an equation to the variable it generates. Include observed and latent parents, including shared latent causes. You may omit a disturbance from the arrow lists if it enters only one equation and you document its independence. Keep its distribution and role in the equations. If scenarios change an edge, list the union in both fields and say which scenarios omit the edge.

Write each field on one line. Use variable IDs that start with an ASCII letter and contain only letters, digits or underscores. Use short aliases for longer column names. Put the comma-separated arrows inside backticks, use `parent -> child` for each arrow, and use `none` when there are no arrows. The two lists should match.

- **DAG edges.** `X -> M, M -> Y, X -> Y`
- **Structural parents.** `X -> M, M -> Y, X -> Y`

### Document generation and truth

- **Generation.** Define all variables and write the full structural equations or conditional sampling distributions. Include noise distributions, dependence, timing and the level of each draw where relevant. Document parameter constraints and scenario changes. Report how seeds are assigned, how many tables are generated and what each table contains. Provide a small run a reviewer can reproduce with a pinned code version or environment.
- **Truth.** Tie the reference value to the exact estimand and scenario. Show an analytical calculation or give a reproducible numerical procedure. For Monte Carlo truth, document draw size and precision and check that approximation error is small enough for the proposed comparison.
- **Comparison.** Use the same observed inputs and replicate tables across methods. Point-estimation tasks can use bias and RMSE. If methods return intervals, state the nominal level and report empirical coverage and interval length across replicates. Explain exclusions and report failures alongside the metrics.

Public teaching examples can link authorized code and settings. For protected evaluation candidates, present complete symbolic equations and use named parameters for protected values. Give the full generator, exact parameters and seeds, official test tables, and scenario-specific truths to maintainers through the agreed private channel.

## 3. Copy the Markdown template

Copy the block into `data-submissions/simulated-dgp/submissions/<slug>.md`. Use a lowercase, hyphenated slug, keep the seven section headings in order and replace all placeholders. The same text is available as [TEMPLATE.md](TEMPLATE.md).

```markdown
# [TODO: Case title]

## Research question

- **Question and intended use.** [TODO: State the statistical question and whether this is a teaching example or a candidate for evaluation.]
- **Behavior under test.** [TODO: Explain the scientific or statistical behavior methods should recover, and why it matters.]

## Study design and data source

- **Motivation and references.** [TODO: Cite the study, data or methodological work that motivates the setting. Describe which design choices come from the reference and which you introduce.]
- **Population and sampling.** [TODO: Define the units, sampling design, dependence and sample sizes or ranges that can be shared.]

## DAG and identification

- **Variables and causal structure.** [TODO: Map observed and latent variables to their roles and available columns. If you include a diagram, use short labels such as `A (treatment)` or `U (unobserved confounder)` where applicable. Draw the arrows for the scenario shown and define the variables in prose.]
- **DAG edges.** `[TODO: List comma-separated arrows, for example X -> M, M -> Y, X -> Y. Use none for an empty graph.]`
- **Assumptions.** [TODO: State the assumptions that identify the target or explain which assumption the stress test deliberately violates.]

## Variables and data-generating process

- **Variables and observed input.** [TODO: Define each generated or fixed variable, its support or units, whether it is observed or latent, and its role. Specify the table grain and columns given to each estimator.]
- **Draw order and scenarios.** [TODO: State the sampling order, the level of each draw (such as unit, cluster or time period), and what varies or stays fixed across scenarios.]

### Structural equations

- **Structural parents.** `[TODO: List parent -> child arrows implied by the equations, using the same IDs and format as DAG edges. State any scenario-specific edge changes in prose.]`

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
```

## 4. Check and open the pull request

1. [Fork the website repository](https://github.com/Statsinference/statsinference.github.io/fork) and create a branch from `main`. Add the single Markdown proposal.
2. Check that the generation recipe reproduces the table schema and that the reference calculation produces the intended target. Verify that the public proposal contains only shareable materials.
3. Run the format check from the repository root. Replace `your-design` with your file's slug.

   ```bash
   python scripts/check_data_contribution.py --track simulated-dgp --local-file data-submissions/simulated-dgp/submissions/your-design.md
   ```

4. Open a pull request to the website repository's `main` and complete the [submission checklist](../../.github/PULL_REQUEST_TEMPLATE/data-contribution.md). Use the same PR for revisions. The automated check verifies the file and headings. A reviewer checks the design, the truth calculation and reproducibility. Evaluation inclusion is a separate curator decision.

## Worked public example

The childhood-trauma example models a methylation profile and derives the joint indirect effect on cortisol reactivity. It includes a shareable causal diagram, the inputs given to methods and an independently checkable reference calculation. [Read the example](EXAMPLE.md)

[All contribution tracks](../README.md) · [Reviewer checklist](../REVIEWING.md)
