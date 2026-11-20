# Statistical Inference Arena

[Open the leaderboard](https://statsinference.github.io/)

Public website source and published benchmark summaries.

[Contribute data](data-submissions/README.md) by opening one pull request for a simulated DGP or real-data problem.

Each research domain has one Test leaderboard with Bias, Variance, RMSE, Length, Coverage and Time. Select **Rank by** or click a metric header to change the ordering. Method names link to the corresponding paper or Hugging Face release.

## Development

- `index.html` and `assets/`: website presentation and interactions.
- `data/`: reported summaries and retained source metadata.
- `tests/verify_test_view.py`: result, ranking and browser checks.

GitHub Pages publishes the website from this repository. The private research repository and its DGP workflow are separate.
