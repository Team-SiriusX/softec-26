# FairGig scaffold — implement logic here
"""Statistical anomaly detection rules for gig-worker earnings.

References:
- Iglewicz, B. & Hoaglin, D.C. (1993). How to Detect and Handle Outliers.
- Sen, P.K. (1968). Estimates of the Regression Coefficient Based on Kendall's Tau.
- Theil, H. (1950). A rank-invariant method of linear and polynomial regression analysis.
- Gujral (2023), UCR MADLab anomaly taxonomy: point/contextual/collective anomalies.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

import numpy as np
from dateutil.parser import isoparse
from scipy.stats import theilslopes

from models import AnomalyDetail, ShiftRecord
from detection.explainer import (
    explain_below_minimum_wage,
    explain_commission_creep,
    explain_deduction_spike,
    explain_income_cliff,
    explain_income_drop_mom,
)

PKR_MINIMUM_HOURLY = 37000 / 208


def _sorted_shifts(shifts: list[ShiftRecord]) -> list[ShiftRecord]:
    return sorted(shifts, key=lambda s: isoparse(s.date).date())


def _deduction_rate(shift: ShiftRecord) -> float:
    if shift.gross_earned <= 0:
        return 0.0
    return shift.platform_deduction / shift.gross_earned


def _effective_hourly(shift: ShiftRecord) -> float:
    if shift.hours_worked <= 0:
        return 0.0
    return shift.net_received / shift.hours_worked


def check_deduction_spike(shifts: list[ShiftRecord]) -> AnomalyDetail | None:
    """Point Anomaly detection via Iglewicz-Hoaglin Modified Z-Score.

    Reference: Iglewicz, B. & Hoaglin, D.C. (1993), ASQC Volume 16.
    Threshold: |mZ| > 3.5 (original recommendation).
    """

    ordered = _sorted_shifts(shifts)
    valid = [s for s in ordered if s.gross_earned > 0]
    if len(valid) < 8:
        return None

    rates = np.array([_deduction_rate(s) for s in valid], dtype=float)
    median_rate = float(np.median(rates))
    mad = float(np.median(np.abs(rates - median_rate)))
    if mad == 0:
        return None

    recent = valid[-7:]
    recent_rates = np.array([_deduction_rate(s) for s in recent], dtype=float)
    recent_mz = np.array([0.6745 * (r - median_rate) / mad for r in recent_rates])
    recent_mean_mz = float(np.mean(recent_mz))
    max_mz = float(np.max(recent_mz))

    if recent_mean_mz <= 3.5:
        return None

    baseline_rates = rates[:-7]
    if baseline_rates.size == 0:
        return None

    baseline_median = float(np.median(baseline_rates))
    recent_median = float(np.median(recent_rates))
    if baseline_median <= 0:
        return None

    spike_pct = ((recent_median - baseline_median) / baseline_median) * 100

    severity = 'medium'
    if spike_pct >= 30:
        severity = 'high'
    if spike_pct >= 50:
        severity = 'critical'

    affected = [s.shift_id for idx, s in enumerate(recent) if recent_mz[idx] > 3.5]
    if not affected:
        affected = [s.shift_id for s in recent]

    explanation = explain_deduction_spike(
        platform=recent[-1].platform,
        baseline_pct=baseline_median * 100,
        recent_pct=recent_median * 100,
        spike_pct=spike_pct,
        modified_z=max_mz,
        start_date=recent[0].date,
        end_date=recent[-1].date,
    )

    return AnomalyDetail(
        type='deduction_spike',
        severity=severity,
        affected_shifts=affected,
        data={
            'baseline_median_rate': round(baseline_median, 6),
            'recent_median_rate': round(recent_median, 6),
            'spike_pct': round(spike_pct, 2),
            'recent_mean_modified_z': round(recent_mean_mz, 4),
            'max_modified_z': round(max_mz, 4),
            'mad': round(mad, 6),
        },
        explanation=explanation,
    )


def check_income_cliff(shifts: list[ShiftRecord]) -> AnomalyDetail | None:
    """Contextual Anomaly via rolling weekly median with MAD normalization.

    Uses median-based robust statistics to avoid distortion from surge/outlier
    shifts. Taxonomy class per Gujral (2023): contextual anomaly.
    """

    ordered = _sorted_shifts(shifts)
    if len(ordered) < 8:
        return None

    weekly_values: dict[tuple[int, int], list[float]] = defaultdict(list)
    weekly_shift_ids: dict[tuple[int, int], list[str]] = defaultdict(list)

    for shift in ordered:
        rate = _effective_hourly(shift)
        if rate <= 0:
            continue
        d = isoparse(shift.date).date()
        key = d.isocalendar()[:2]  # (year, week)
        weekly_values[key].append(rate)
        weekly_shift_ids[key].append(shift.shift_id)

    weeks = sorted(weekly_values.keys())
    if len(weeks) < 4:
        return None

    current_key = weeks[-1]
    prior_keys = weeks[-4:-1]

    current_median = float(np.median(weekly_values[current_key]))
    prior_medians = np.array(
        [float(np.median(weekly_values[w])) for w in prior_keys], dtype=float
    )

    rolling_median = float(np.median(prior_medians))
    mad = float(np.median(np.abs(prior_medians - rolling_median)))
    if mad == 0:
        return None

    threshold = rolling_median - (1.5 * mad)
    if current_median >= threshold:
        return None

    if rolling_median <= 0:
        return None

    drop_pct = ((rolling_median - current_median) / rolling_median) * 100

    severity = 'medium'
    if drop_pct >= 25:
        severity = 'high'
    if drop_pct >= 40:
        severity = 'critical'

    explanation = explain_income_cliff(
        current_rate=current_median,
        rolling_rate=rolling_median,
        drop_pct=drop_pct,
        threshold=threshold,
    )

    return AnomalyDetail(
        type='income_cliff',
        severity=severity,
        affected_shifts=weekly_shift_ids[current_key],
        data={
            'current_week_median_effective_hourly': round(current_median, 2),
            'rolling_median_effective_hourly': round(rolling_median, 2),
            'rolling_mad': round(mad, 2),
            'contextual_threshold': round(threshold, 2),
            'drop_pct': round(drop_pct, 2),
        },
        explanation=explanation,
    )


def check_income_drop_mom(shifts: list[ShiftRecord]) -> AnomalyDetail | None:
    """Detect month-on-month net income drops over 20%."""

    ordered = _sorted_shifts(shifts)
    if len(ordered) < 6:
        return None

    monthly_net: dict[str, float] = defaultdict(float)
    monthly_shift_ids: dict[str, list[str]] = defaultdict(list)

    for shift in ordered:
        month_key = shift.date[:7]
        monthly_net[month_key] += float(shift.net_received)
        monthly_shift_ids[month_key].append(shift.shift_id)

    months = sorted(monthly_net.keys())
    if len(months) < 2:
        return None

    current_month = months[-1]
    previous_month = months[-2]

    current_total = monthly_net[current_month]
    previous_total = monthly_net[previous_month]

    if previous_total <= 0:
        return None

    drop_pct = ((previous_total - current_total) / previous_total) * 100
    if drop_pct <= 20:
        return None

    severity = 'medium'
    if drop_pct >= 35:
        severity = 'high'
    if drop_pct >= 50:
        severity = 'critical'

    explanation = explain_income_drop_mom(
        current_month_label=current_month,
        previous_month_label=previous_month,
        current_month_net=current_total,
        previous_month_net=previous_total,
        drop_pct=drop_pct,
    )

    return AnomalyDetail(
        type='income_drop_mom',
        severity=severity,
        affected_shifts=monthly_shift_ids[current_month],
        data={
            'current_month': current_month,
            'previous_month': previous_month,
            'current_month_net': round(current_total, 2),
            'previous_month_net': round(previous_total, 2),
            'drop_pct': round(drop_pct, 2),
            'threshold_pct': 20,
        },
        explanation=explanation,
    )


def check_below_minimum_wage(shifts: list[ShiftRecord]) -> AnomalyDetail | None:
    """Collective Anomaly for sustained below-threshold legal earnings.

    Minimum wage basis: Pakistan Labour Policy 2024, PKR 37,000/month
    approximated to hourly rate as 37000 / (26 days * 8 hours).
    """

    ordered = _sorted_shifts(shifts)
    if not ordered:
        return None

    latest_date = isoparse(ordered[-1].date).date()
    window_start = latest_date - timedelta(days=30)

    last_30 = [
        s for s in ordered if isoparse(s.date).date() >= window_start and s.hours_worked > 0
    ]
    if not last_30:
        return None

    total_hours = float(sum(s.hours_worked for s in last_30))
    total_net = float(sum(s.net_received for s in last_30))
    if total_hours <= 0:
        return None

    effective_hourly = total_net / total_hours
    if effective_hourly >= PKR_MINIMUM_HOURLY:
        return None

    gap_pct = ((PKR_MINIMUM_HOURLY - effective_hourly) / PKR_MINIMUM_HOURLY) * 100

    explanation = explain_below_minimum_wage(
        effective_hourly=effective_hourly,
        legal_minimum_hourly=PKR_MINIMUM_HOURLY,
        total_net=total_net,
        total_hours=total_hours,
    )

    return AnomalyDetail(
        type='below_minimum_wage',
        severity='critical',
        affected_shifts=[s.shift_id for s in last_30],
        data={
            'effective_hourly': round(effective_hourly, 2),
            'legal_minimum_hourly': round(PKR_MINIMUM_HOURLY, 2),
            'gap_pct': round(gap_pct, 2),
            'window_days': 30,
            'total_hours': round(total_hours, 2),
            'total_net': round(total_net, 2),
        },
        explanation=explanation,
    )


def check_commission_creep(shifts: list[ShiftRecord]) -> AnomalyDetail | None:
    """Collective Anomaly for rising commission trend using Theil-Sen slope.

    Theil-Sen estimator is robust against outliers common in gig-economy
    data (surge pricing, bonuses). Flags slope > 0.002/day.
    """

    ordered = _sorted_shifts(shifts)
    valid = [s for s in ordered if s.gross_earned > 0]
    if len(valid) < 8:
        return None

    first_date = isoparse(valid[0].date).date()
    last_date = isoparse(valid[-1].date).date()
    day_span = (last_date - first_date).days
    if day_span < 28:
        return None

    x = np.array([(isoparse(s.date).date() - first_date).days for s in valid], dtype=float)
    y = np.array([_deduction_rate(s) for s in valid], dtype=float)

    slope, intercept, _, _ = theilslopes(y, x)
    slope = float(slope)
    intercept = float(intercept)

    if slope <= 0.002:
        return None

    start_rate = float(y[0])
    end_rate = float(y[-1])

    severity = 'medium'
    if slope >= 0.003:
        severity = 'high'
    if slope >= 0.004:
        severity = 'critical'

    explanation = explain_commission_creep(
        platform=valid[-1].platform,
        slope_per_day=slope,
        start_pct=start_rate * 100,
        end_pct=end_rate * 100,
        days=day_span,
    )

    return AnomalyDetail(
        type='commission_creep',
        severity=severity,
        affected_shifts=[s.shift_id for s in valid],
        data={
            'theil_sen_slope_per_day': round(slope, 6),
            'intercept': round(intercept, 6),
            'threshold': 0.002,
            'start_rate': round(start_rate, 6),
            'end_rate': round(end_rate, 6),
            'day_span': day_span,
        },
        explanation=explanation,
    )
