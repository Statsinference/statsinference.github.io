# Publishing a reviewed mediation result

After checking the submission and its version, score its complete predictions CSV with the private mediation v1.0 grader. Save the grader's aggregate JSON on the maintainer's machine. From the private repository root, use the archived issue and that score to prepare the public result. Substitute the actual issue filename and score path.

```sh
python website/method-submissions/approve_mediation.py method-submissions/received/issue-000123.json /path/to/official-score.json --family other
```

Choose `pfn` for a PFN-family entry or `other` for another estimator. Review the change to `website/data/mediation-reviewed.json`, then follow the [leaderboard publishing guide](../../docs/leaderboard-source.md). Repeating the command for the same issue updates its existing result.
