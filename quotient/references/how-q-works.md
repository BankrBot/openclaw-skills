<!-- GENERATED from public/skill/references/how-q-works.md — edit there, then npm run skill:build -->

# How Q works

Q is a forecasting agent. It turns a question into a calibrated probability through the same
steps every time:

1. **Classify the question.** Resolution rule, horizon, and question type.
2. **Map the landscape.** Actors, assets, linked markets, and related questions.
3. **Research the evidence.** The sources behind each claim, drawn from ranked publications
   and from tracked experts on X.
4. **Build scenarios.** Base rates, pathways, dependencies, and disconfirming evidence.
5. **Produce the forecast.** A calibrated probability with uncertainty and cited analysis.

Around 500 markets are forecast every day, and a forecast can be requested on demand for a
covered question.

A forecast carries that work in its fields. `probability` is the calibrated number. `thesis`
and `resolution_pathway` hold the reasoning and the resolution rule. `band25`, `band75`, and
`conviction_tier` come from the dispersion of the forecaster's independent draws.
`delta_from_prior` and `delta_reasoning` describe the move since the previous run.

Every resolved market is scored against Q and against the forecast-time market price. Misses
are traced back to the evidence and weighting behind them, and those findings feed the next
fine-tuning cycle.

Published signals are a separate layer built on top of forecasts. The daily WTI oil
signal is another distinct product layer. See `Keep product layers separate` in the main skill.

## The 72-hour drawdown read

Alongside the probability, the forecaster carries a head trained on what prices did after past
forecasts. Its training label is mechanical. For each side it takes the matured 72-hour minute
path and marks that side as crashed when the price printed twice at or below a quarter of the
entry price within two hours, or when the market resolved against the side. Entry prices outside
5¢–95¢ and windows with fewer than 48 prints are dropped instead of labelled.

At forecast time the head returns a calibrated probability per side, and the API publishes it as
a boolean at 0.15. `drawdown_risk_72h.yes: true` means the model puts at least a 15% chance on a
YES position losing most of its value within about 72 hours of `created_at`. On a signal row,
`drawdown_risk_elevated` is the same read for that signal's side, and
`exclude_drawdown_risk=true` drops the elevated rows. The former names `crash_risk`,
`crash_risk_elevated`, and `exclude_crash_risk` still work for one release.

The read expires with its own horizon. `null` means there is no current read — the forecast
predates the head, or the 72 hours have passed. It never means no risk.

This is a statement about the price path only. It never changes `probability`, and it is
independent of `conviction_tier`, so a row can read high conviction and elevated drawdown risk at
once. Near expiry expect elevated readings on both sides, because resolution itself takes the
losing side down by more than 75%.
