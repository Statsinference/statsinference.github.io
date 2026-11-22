# StatArena leaderboard deployment

[Open the leaderboard](https://statsinference.github.io/)

This repository publishes the leaderboard on GitHub Pages. Development, proposals and review take place in the [private StatArena repository](https://github.com/Statsinference/Statistical-Intelligence-Arena).

[Contribute data](https://github.com/Statsinference/Statistical-Intelligence-Arena/blob/main/website/data-submissions/README.md) by opening one pull request in the private repository for a simulated DGP or real-data problem.

Each research domain has one Test leaderboard with Bias, Variance, RMSE, Length, Coverage and Time. Select **Rank by** or click a metric header to change the ordering. Method names link to the corresponding paper or Hugging Face release.

## Published site

- `index.html` and `assets/`: website presentation and interactions.
- `data/`: reported summaries and retained source metadata.
- `tests/verify_test_view.py`: result, ranking and browser checks.

Maintainers publish reviewed revisions from the private repository's `website/` directory.
