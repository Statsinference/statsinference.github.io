# Contribute data to StatArena

Propose one simulated design or one real-data problem per pull request. The public submission describes the research question and how reviewers can assess it.

| Track | What to propose | Start here |
| --- | --- | --- |
| Simulated DGP | A data-generating process with a statistical target and a reproducible reference value | [Guide](simulated-dgp/README.md) · [Template](simulated-dgp/TEMPLATE.md) · [JASA example](simulated-dgp/EXAMPLE.md) |
| Real-data problem | A dataset with a documented source or access route and an answerable statistical question | [Guide](real-data/README.md) · [Template](real-data/TEMPLATE.md) · [JASA example](real-data/EXAMPLE.md) |

## Open a pull request

1. [Fork the website repository](https://github.com/Statsinference/statsinference.github.io/fork) and create a branch from `main`.
2. Copy the template for your track into its `submissions/` directory. Create that directory if it is empty. Choose a lowercase, hyphenated filename such as `job-training-earnings.md`. Keep the template headings and replace the prompts with your case.
3. Commit the single case file. On GitHub, open **Pull requests → New pull request → compare across forks**. Choose the StatArena website repository's `main` as the base and your fork's branch as the compare branch. Use the [data contribution PR checklist](../.github/PULL_REQUEST_TEMPLATE/data-contribution.md) in the description.
4. Check the **Data contribution precheck** result and address any requested revisions in the same PR. A maintainer will assign a reviewer.

## Public and private materials

Every file and discussion in this repository is public. The PR can include a shareable case description, links to public sources and a DAG when it can be shared. For a protected design, describe the variable roles and assumptions at a level you can make public. For restricted data, link to the official access procedure when one is available. A maintainer will arrange private review of complete candidate-evaluation generators, exact parameters and seeds, case-specific truths, and restricted materials. Send sensitive files only through that agreed channel.

## Review

The automated check verifies the submission path, one-file scope and required sections. A human reviewer examines the scientific design, reference values and reproducibility before a maintainer decides whether to merge. A merged proposal records the contribution for the community. Evaluation inclusion is a separate curator decision. [Reviewer checklist](REVIEWING.md)
