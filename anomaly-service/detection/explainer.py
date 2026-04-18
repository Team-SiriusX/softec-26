# FairGig scaffold — implement logic here
"""Human-readable anomaly explanations for non-technical workers.

Explanations follow plain-language risk communication best practices and
embed computed values from statistical detectors.
"""


def explain_deduction_spike(
    platform: str,
    baseline_pct: float,
    recent_pct: float,
    spike_pct: float,
    modified_z: float,
    start_date: str,
    end_date: str,
) -> str:
    return (
        f"Your {platform} deduction rate jumped from {baseline_pct:.1f}% to "
        f"{recent_pct:.1f}% between {start_date} and {end_date}, which is a "
        f"{spike_pct:.1f}% increase above your baseline. "
        f"This change is statistically unusual (modified Z-score {modified_z:.2f}) "
        f"and likely reflects an unannounced commission policy change."
    )


def explain_income_cliff(
    current_rate: float,
    rolling_rate: float,
    drop_pct: float,
    threshold: float,
) -> str:
    return (
        f"Your recent effective hourly income fell to PKR {current_rate:.2f}/hr "
        f"from a rolling median of PKR {rolling_rate:.2f}/hr, a drop of {drop_pct:.1f}%. "
        f"This is below your contextual bound (median - 1.5*MAD = PKR {threshold:.2f}/hr), "
        f"which suggests a meaningful decline in payout quality."
    )


def explain_income_drop_mom(
    current_month_label: str,
    previous_month_label: str,
    current_month_net: float,
    previous_month_net: float,
    drop_pct: float,
) -> str:
    return (
        f"Your take-home income dropped from PKR {previous_month_net:.0f} in "
        f"{previous_month_label} to PKR {current_month_net:.0f} in "
        f"{current_month_label}, a {drop_pct:.1f}% month-on-month decline. "
        "This is above the 20% caution threshold and may indicate unusual payout changes."
    )


def explain_below_minimum_wage(
    effective_hourly: float,
    legal_minimum_hourly: float,
    total_net: float,
    total_hours: float,
) -> str:
    return (
        f"Your last-30-day effective rate is PKR {effective_hourly:.2f}/hr based on "
        f"PKR {total_net:.2f} net over {total_hours:.2f} hours. "
        f"This is below the legal benchmark of PKR {legal_minimum_hourly:.2f}/hr, "
        f"which indicates sustained earnings below minimum-wage-equivalent levels."
    )


def explain_commission_creep(
    platform: str,
    slope_per_day: float,
    start_pct: float,
    end_pct: float,
    days: int,
) -> str:
    return (
        f"Your {platform} deduction trend increased from {start_pct:.1f}% to "
        f"{end_pct:.1f}% over {days} days. "
        f"The Theil-Sen trend slope is {slope_per_day:.4f} per day, indicating "
        f"a persistent upward commission pattern rather than normal week-to-week noise."
    )
