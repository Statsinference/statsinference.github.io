# [Method name] — Causal Mediation Analysis

Replace the bracketed prompts and publish this card alongside your code or predictions. The [Arena benchmark card](https://statsinference.github.io/mediation/) provides the data and the official evaluation protocol.

| Submission | Your entry |
| --- | --- |
| Method version | [Release, commit or dated version of this card] |
| Code or Hugging Face model | [Public link for a runnable submission] |
| Official predictions | [Public HTTPS link to the CSV, required for a results-only submission] |
| Method paper | [Citation and DOI or preprint link, if available] |

## What does the method estimate?

The target is the population natural indirect effect under treatment, $E[Y^{(1,M^{(1)})}-Y^{(1,M^{(0)})}]$. Each 500-row study yields one estimate and a two-sided 95% interval.

- **Point estimate.** [How do you use the baseline covariates, treatment, mediator(s) and outcome? Describe any assumptions and how you handle multiple mediators or binary variables.]
- **Interval.** [Describe the interval and its settings. For example, give the number of bootstrap draws or name the standard-error estimator.]
- **Fitting and tuning.** [Give the main hyperparameters, how they were selected, and how the supplied outer folds are used, if applicable.]

## What data did the method see?

For a method fitted separately to each study, enter “No prior training” and describe any development-set tuning. For a pretrained method, identify the checkpoint and distinguish its training data from any later adaptation.

| Stage | Data, source or generator | How the data were used |
| --- | --- | --- |
| Training or adaptation | [Dataset or generator, version and number of tables, if known] | [What was fitted, or none] |
| Development and calibration | [Split, source and number of tables, if known] | [What was selected or calibrated, or none] |
| Official evaluation | [Arena mediation v1.0, plus any prior exposure to these studies] | [What was fixed before evaluation and what was fitted within each study] |

If you generated your own tables, describe how you sampled DGP families and parameters, how many independent tables you drew per configuration, and how you separated the splits. Link the generator or configuration file if available.

## How can someone reproduce the result?

- **Runnable submission.** [Give installation and run commands, software versions, hardware requirements and output path. Identify any required checkpoint.]
- **Results-only submission.** [Describe the analysis procedure and software used to produce the linked official CSV.]
- **Runtime, if reported.** [Give mean seconds per study, hardware, and whether the timing includes interval estimation, loading and warm-up.]
- **Public starter results, if available.** [Link predictions or scores and identify the development or public reference test split.]

The official CSV uses `table_id,estimate,ci_lower,ci_upper`. Return one row for every ID in the supplied `predictions_template.csv`. Arena maintainers score the official results. [Method submission guide](https://github.com/Statsinference/Statistical-Intelligence-Arena/blob/main/website/method-submissions/README.md).
