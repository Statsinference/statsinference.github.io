# Contribute data to StatArena

Propose one simulated design or one real-data problem per pull request. Describe the research question and how reviewers can assess it.

| Track | What to propose | Start here |
| --- | --- | --- |
| Simulated DGP | A data-generating process with a statistical target and a reproducible reference value | [Guide](simulated-dgp/README.md) · [Template](simulated-dgp/TEMPLATE.md) · [JASA example](simulated-dgp/EXAMPLE.md) |
| Real-data problem | A dataset with a documented source or access route and an answerable statistical question | [Guide](real-data/README.md) · [Template](real-data/TEMPLATE.md) · [JASA example](real-data/EXAMPLE.md) |

## Open a pull request

1. Create a branch from `main` in the [private StatArena repository](https://github.com/Statsinference/Statistical-Intelligence-Arena).
2. Copy the template for your track into its `submissions/` directory under `website/data-submissions/`. Create that directory if it is empty. Choose a lowercase, hyphenated filename such as `job-training-earnings.md`. Keep the template headings and replace the prompts with your case.
3. Commit the single case file. [Open a pull request](https://github.com/Statsinference/Statistical-Intelligence-Arena/compare) with `main` as the base and your branch as the compare branch. Copy the [data contribution PR checklist](../.github/PULL_REQUEST_TEMPLATE/data-contribution.md) into the description.
4. Check the **Website data contribution precheck** result and address any requested revisions in the same PR. A maintainer will assign a reviewer.

## Materials and access

The PR can include a case description, links to shareable sources and a DAG. For restricted data, link to the official access procedure when one is available. A maintainer will arrange access to protected candidate-evaluation generators, exact parameters and seeds, case-specific truths, and restricted data. Send sensitive files through that agreed channel.

## Review

The automated check verifies the submission path, one-file scope and required sections. A human reviewer examines the scientific design, reference values and reproducibility before a maintainer decides whether to merge. A merged proposal records the contribution for the community. Evaluation inclusion is a separate curator decision. [Reviewer checklist](REVIEWING.md)
