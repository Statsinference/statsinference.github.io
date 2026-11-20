# Review a StatArena data contribution

## Assign and review

1. A maintainer checks the PR scope and the **Data contribution precheck** result, then requests a GitHub review from someone familiar with the domain and design. Add a reproducibility reviewer when the design or access procedure warrants it.
2. The reviewer checks the items below and uses **Request changes** for actionable revisions or **Approve** when satisfied. Ask the author to revise the same PR.
3. A maintainer confirms that the public file can be shared before merging. A merged proposal is a public contribution record. Track inclusion and leaderboard release require a separate evaluation decision.

## Scientific and reproducibility checklist

- **Target.** Is the population or design, estimand, comparison and output clear?
- **Evidence.** Does the citation or source support the claimed setting? Do the time ordering, observed variables and assumptions support the proposed analysis? Does a supplied DAG agree with the generator or study design?
- **Simulation.** Can the reviewer generate at least one table from a known configuration and check the estimand and reference value? Is each empirical calibration or design choice documented?
- **Real data.** Can the reviewer follow the access and preparation process and verify variable roles? If a reference estimate is supplied, does it match the target, sample and analysis scale? Are its uncertainty and limitations reported?
- **Benchmark.** Is the proposed comparison feasible with the documented input and output? Does the proposed metric match what repeated simulated draws or a real study can establish?
- **Sharing.** Are the public summary and links authorized for release? Keep protected materials in the agreed private review channel. Check exact evaluation seeds, parameter files and case-specific truths there.

Treat the automated check as structural feedback. Scientific accuracy, access terms and confidentiality require human verification. Review contributed code in an isolated environment without credentials or protected evaluation files.

[Submission guide](README.md)
