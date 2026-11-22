# Childhood trauma, DNA methylation and cortisol reactivity

Public worked example for the [simulated DGP track](README.md).

## Research question

For a one-standard-deviation increase in the childhood trauma score, what is the joint indirect effect through the DNA methylation profile on a continuous cortisol stress-response outcome?

## Study design and data source

Guo, Li, Liu and Zeng use a DNA methylation study to motivate a semi-synthetic experiment. The simulation keeps observed exposure scores and uses fitted exposure-to-probe coefficients and fitted outcome residual variance. The authors retain the signs of the outcome coefficients for 11 selected probes and choose their magnitudes for the simulation. They model residual dependence across the ordered probe columns with an AR(1) structure and correlation parameter 0.5. This example uses the no-confounder setting in Section 4.1. [Original article](https://doi.org/10.1080/01621459.2022.2053136)

## DAG and identification

- **DAG edges.** `X -> M, M -> Y, X -> Y`

```mermaid
flowchart LR
    X["X (exposure)"] --> M["M (mediator)"]
    M --> Y["Y (outcome)"]
    X --> Y
```

The observed exposure is `trauma_z`, the mediator is the vector of methylation probe columns, and the observed outcome is `cortisol_response`. The arrow lists and diagram show the union across scenarios. The zero-effect scenario with $c_1=0$ omits `X -> M`.

## Variables and data-generating process

Each row represents one subject. The standardized exposure $X_i=x_i$ is fixed to one of the 85 observed scores in the pinned snapshot. The continuous mediator vector $M_i$ has $p=1008$ probe values, and $Y_i$ is a continuous outcome. Methods receive only the exposure, probe columns and outcome.

### Structural equations

- **Structural parents.** `X -> M, M -> Y, X -> Y`

For every row $i$, draw $U_i$ and $\varepsilon_i$ independently of one another and the fixed exposure design. Each disturbance enters one equation and is omitted from the arrow lists. The draws are independent across rows and across replicate tables. The fixed coefficient vector $\widehat{\Gamma}_X$ and outcome residual standard deviation $\widehat{\sigma}_Y$ come from the pinned snapshot. The code below constructs the outcome coefficient vector $\alpha_M$ using the 11 selected probes.

$$
\begin{aligned}
U_i &\sim \mathcal N_p(0,\Sigma), & \Sigma_{jk}&=0.5^{|j-k|},\qquad 1\le j,k\le p,\\
\varepsilon_i &\sim \mathcal N(0,\widehat{\sigma}_Y^2),\\
M_i &= c_1\widehat{\Gamma}_X x_i+U_i,\\
Y_i &= \alpha_M^{\mathsf T}M_i+0.5x_i+\varepsilon_i .
\end{aligned}
$$

The scenarios vary $c_1$ while holding the exposure design, outcome coefficients and disturbance distributions fixed.

## Data-generating process and estimand

For a one-unit contrast on the standardized exposure scale, the joint natural indirect effect is

$$
\operatorname{NIE}(x+1,x)
=\mathbb{E}\{Y(x+1,M(x+1))-Y(x+1,M(x))\}
=c_1\alpha_M^{\mathsf T}\widehat{\Gamma}_X .
$$

| Scenario | Exposure-to-mediator scale | Joint NIE on the outcome scale |
| --- | ---: | ---: |
| Zero indirect effect | $c_1=0$ | $0$ |
| Nonzero indirect effect | $c_1=0.5$ | Approximately $-0.7989$ |

## Benchmark comparison

Compare a mediation estimator and a documented baseline on repeated, independently simulated tables. Report each method's point estimate and interval. Compare error and interval coverage at zero and nonzero effects; compute reference values using the stored full-precision coefficients.

## Materials and access

The pinned simulator snapshot in the authors' repository has 85 exposure observations and 1,008 methylation columns. Their screening code keeps 1,000 candidates and appends eight probes from prior studies. Download the snapshot from the source, retain the original column names and run this base R example. Change `c1 <- 0` to reproduce the zero-effect scenario. [Authors' code](https://github.com/zengmudong/High-dimensional-mediation-analysis) · [Pinned simulation snapshot](https://github.com/zengmudong/High-dimensional-mediation-analysis/blob/1ea646ab2c705284a8b393dc06867b5fc9093144/results/simulation_allS.Rdata)

```r
inputs <- new.env()
load("simulation_allS.Rdata", envir = inputs)
x <- inputs$dt$X
gamma <- inputs$coefs$Gamma["trauma", ]
w <- as.numeric(inputs$coefs$alpha0)
w[w != 0] <- c(1, .9, .8, -.9, -.8, -.7, .6, .5, .4, .3, .2)
c1 <- 0.5
n <- nrow(x)
p <- length(gamma)
set.seed(1729)
u <- matrix(0, n, p)
u[, 1] <- rnorm(n)
for (j in 2:p) {
    u[, j] <- 0.5 * u[, j - 1L] + sqrt(0.75) * rnorm(n)
}
m <- x %*% (c1 * gamma) + u
colnames(m) <- colnames(inputs$dt$M)
y <- m %*% w + 0.5 * x + rnorm(n, sd = inputs$coefs$sigma1)
observed <- data.frame(trauma_z = c(x), m, cortisol_response = c(y),
                       check.names = FALSE)
print(c1 * sum(gamma * w))
```

The public example uses materials linked from the authors' repository. Check their redistribution terms before rehosting the snapshot or other source materials.
