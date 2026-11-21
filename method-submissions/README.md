# Method submissions

[View submitted methods](received/README.md)

For **Causal Mediation Analysis**, use the [benchmark card](https://statsinference.github.io/mediation/) to download the development kit and the official observed tables. Complete the [mediation method form](https://github.com/Statsinference/statsinference.github.io/issues/new?template=mediation-method.yml) with your version, run instructions or analysis procedure, interval construction and training exposure. You can submit a public GitHub repository or Hugging Face model for review, or a public method card with linked predictions on the official tables. Development results are optional. Official predictions include one row per table with `table_id,estimate,ci_lower,ci_upper`.

For other domains, open **Contribute to StatArena** on the [website](https://statsinference.github.io/) and choose **Submit a method**. Enter a Hugging Face model link, then confirm the prefilled issue on GitHub. A GitHub account is required. Submissions are public.

The intake workflow archives valid submissions as JSON in `received/` and adds them to the list above. The research repository periodically imports model-link records. Official evaluation and leaderboard results require a separate maintainer review and run.

## Publish a reviewed mediation result

After checking the submission and its version, score its complete predictions CSV with the private mediation v1.0 grader. Save the grader's aggregate JSON on the maintainer's machine. From the website repository root, use the archived issue and that score to prepare the public result. Substitute the actual issue filename and score path.

```sh
python method-submissions/approve_mediation.py method-submissions/received/issue-000123.json /path/to/official-score.json --family other
```

Choose `pfn` for an RFN-family entry or `other` for another estimator. Review the change to `data/mediation-reviewed.json` and publish it to the website's main branch through the usual Git review. Pages then displays the method in the [mediation leaderboard](https://statsinference.github.io/#domain=mediation). Repeating the command for the same issue updates its existing result.
