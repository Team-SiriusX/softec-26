"""
HTML certificate renderer.
Generates a complete, print-friendly HTML document.
"""

import os
from html import escape

from models import CertificateData

def _safe_text(value: str | None) -> str:
    if value is None:
        return "N/A"
    return escape(str(value))


def _format_date(raw: str) -> str:
    from datetime import datetime

    try:
        return datetime.fromisoformat(raw).strftime("%d %b %Y")
    except Exception:
        return raw


def render_certificate_html(data: CertificateData, auto_print: bool = False) -> str:
    app_base_url = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip("/")
    verify_url = f"{app_base_url}/certificate/verify?id={data.certificate_id}"

    worker_name = _safe_text(data.worker_name)
    city_zone = _safe_text(data.city_zone)
    category = _safe_text(data.category or "Gig Work")
    certificate_id = _safe_text(data.certificate_id)
    safe_verify_url = _safe_text(verify_url)
    verification_note = _safe_text(data.verification_note)

    issued_on = _format_date(data.generated_at)
    from_date = _format_date(data.from_date)
    to_date = _format_date(data.to_date)

    verification_status = "Partially Verified" if data.has_unverified else "Fully Verified"
    verification_class = "status-warn" if data.has_unverified else "status-ok"

    platform_rows = ""
    for p in data.platforms:
        if p.verified_count == p.shift_count:
            status_badge = '<span class="status-pill status-ok">All Verified</span>'
        elif p.verified_count > 0:
            status_badge = f'<span class="status-pill status-warn">{p.verified_count}/{p.shift_count} Verified</span>'
        else:
            status_badge = '<span class="status-pill status-warn">Pending</span>'

        platform_name = _safe_text(p.platform_name)

        platform_rows += f"""
        <tr>
            <td>{platform_name}</td>
            <td class="align-center">{p.shift_count}</td>
            <td class="align-right">{p.total_hours:.1f}</td>
            <td class="align-right">{p.gross_earned:,.0f}</td>
            <td class="align-right">{p.total_deductions:,.0f}</td>
            <td class="align-right strong">{p.net_received:,.0f}</td>
            <td class="align-right">{p.avg_commission_rate:.1f}%</td>
            <td class="align-center">{status_badge}</td>
        </tr>
        """

    auto_print_script = ""
    if auto_print:
        auto_print_script = """
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.print();
        }, 250);
      });
    </script>
    """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Income Certificate - {worker_name}</title>
    <style>
        :root {{
            --ink: #111827;
            --muted: #6b7280;
            --line: #d1d5db;
            --panel: #f9fafb;
            --accent: #1f2937;
            --ok: #166534;
            --warn: #9a3412;
        }}
        body {{
            font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
            background-color: #f3f4f6;
            color: var(--ink);
            margin: 0;
            padding: 28px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }}
        * {{ box-sizing: border-box; }}
        @media print {{
            body {{
                background: #ffffff;
                padding: 0;
            }}
            .no-print {{
                display: none !important;
            }}
            @page {{
                size: A4;
                margin: 12mm;
            }}
        }}

        .toolbar {{
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
        }}
        .toolbar button {{
            border: 1px solid #d1d5db;
            background: #ffffff;
            color: #111827;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            cursor: pointer;
        }}

        .sheet {{
            max-width: 860px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 28px;
            box-shadow: 0 10px 30px rgba(17, 24, 39, 0.08);
        }}
        @media print {{
            .sheet {{
                box-shadow: none;
                border: 0;
                padding: 0;
            }}
        }}

        .doc-header {{
            display: flex;
            justify-content: space-between;
            gap: 20px;
            align-items: start;
            border-bottom: 1px solid var(--line);
            padding-bottom: 16px;
            margin-bottom: 18px;
        }}

        .brand-name {{
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            letter-spacing: 0.02em;
        }}

        .brand-note {{
            margin: 4px 0 0;
            font-size: 12px;
            color: var(--muted);
        }}

        .doc-meta {{
            text-align: right;
        }}

        .doc-title {{
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 0.02em;
        }}

        .doc-meta-line {{
            margin: 3px 0 0;
            font-size: 12px;
            color: var(--muted);
            font-family: monospace;
        }}

        .statement {{
            border: 1px solid var(--line);
            background: var(--panel);
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 16px;
            line-height: 1.55;
            font-size: 14px;
        }}

        .details-grid {{
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 16px;
        }}
        .detail-item {{
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 10px 12px;
            background: #ffffff;
        }}
        .detail-label {{
            margin: 0;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--muted);
        }}
        .detail-value {{
            margin: 3px 0 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--ink);
        }}

        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 18px;
        }}
        .summary-card {{
            border: 1px solid var(--line);
            border-radius: 8px;
            background: #ffffff;
            padding: 10px;
        }}
        .summary-value {{
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--accent);
            font-variant-numeric: tabular-nums;
        }}
        .summary-label {{
            margin: 4px 0 0;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--muted);
        }}

        h3.section-title {{
            margin: 0 0 8px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--muted);
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 12px;
        }}
        th {{
            background: #f3f4f6;
            padding: 9px 8px;
            text-align: left;
            font-size: 10px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.07em;
            border-bottom: 1px solid var(--line);
        }}
        td {{
            padding: 9px 8px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
            font-variant-numeric: tabular-nums;
        }}
        td.strong {{
            font-weight: 600;
        }}
        .align-right {{ text-align: right; }}
        .align-center {{ text-align: center; }}

        .total-row td {{
            background: #f9fafb;
            border-top: 1px solid #d1d5db;
            border-bottom: 1px solid #d1d5db;
            font-weight: 700;
        }}

        .status-pill {{
            display: inline-block;
            padding: 2px 7px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 600;
            border: 1px solid transparent;
        }}
        .status-ok {{
            color: var(--ok);
            background: #ecfdf3;
            border-color: #86efac;
        }}
        .status-warn {{
            color: var(--warn);
            background: #fff7ed;
            border-color: #fdba74;
        }}

        .verification-box {{
            border: 1px solid var(--line);
            border-radius: 8px;
            background: #fafafa;
            padding: 12px;
            margin-bottom: 14px;
        }}
        .verification-head {{
            margin: 0;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--muted);
        }}
        .verification-status {{
            margin: 5px 0 0;
            font-size: 14px;
            font-weight: 600;
        }}
        .verification-note {{
            margin: 6px 0 0;
            font-size: 14px;
            line-height: 1.5;
            color: var(--ink);
        }}

        .disclaimer {{
            font-size: 11px;
            color: var(--muted);
            margin-top: 10px;
            line-height: 1.5;
        }}

        .footer {{
            margin-top: 16px;
            border-top: 1px solid var(--line);
            padding-top: 10px;
            font-size: 11px;
            color: var(--muted);
        }}
        .verify-line {{
            margin-top: 4px;
            font-family: monospace;
            word-break: break-all;
            color: #1f2937;
        }}

        @media (max-width: 900px) {{
            .details-grid,
            .summary-grid {{
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }}
            .doc-header {{
                flex-direction: column;
            }}
            .doc-meta {{
                text-align: left;
            }}
        }}
    </style>
</head>
<body>
    <div class="toolbar no-print">
        <button onclick="window.print()">Print / Save PDF</button>
    </div>

    <main class="sheet">
        <div class="doc-header">
            <div>
                <h1 class="brand-name">FairGig</h1>
                <p class="brand-note">Gig Worker Income and Rights Platform</p>
            </div>
            <div class="doc-meta">
                <h2 class="doc-title">Income Certificate</h2>
                <p class="doc-meta-line">Certificate ID: {certificate_id}</p>
                <p class="doc-meta-line">Issued on: {issued_on}</p>
            </div>
        </div>

        <section class="statement">
            This certifies that <strong>{worker_name}</strong> earned income through verified and/or reported gig-platform shifts during the period <strong>{from_date}</strong> to <strong>{to_date}</strong>, as recorded in FairGig systems.
        </section>

        <section class="details-grid">
            <div class="detail-item">
                <p class="detail-label">Worker Name</p>
                <p class="detail-value">{worker_name}</p>
            </div>
            <div class="detail-item">
                <p class="detail-label">Worker ID</p>
                <p class="detail-value">{_safe_text(data.worker_id)}</p>
            </div>
            <div class="detail-item">
                <p class="detail-label">City Zone</p>
                <p class="detail-value">{city_zone}</p>
            </div>
            <div class="detail-item">
                <p class="detail-label">Category</p>
                <p class="detail-value">{category}</p>
            </div>
        </section>

        <section>
            <h3 class="section-title">Summary</h3>
            <div class="summary-grid">
                <div class="summary-card">
                    <p class="summary-value">PKR {data.total_net:,.0f}</p>
                    <p class="summary-label">Total Net Income</p>
                </div>
                <div class="summary-card">
                    <p class="summary-value">{data.total_hours:.1f}</p>
                    <p class="summary-label">Total Hours</p>
                </div>
                <div class="summary-card">
                    <p class="summary-value">PKR {data.avg_hourly_rate:,.0f}</p>
                    <p class="summary-label">Avg Hourly Rate</p>
                </div>
                <div class="summary-card">
                    <p class="summary-value">{data.avg_commission_rate:.1f}%</p>
                    <p class="summary-label">Avg Commission Rate</p>
                </div>
            </div>
        </section>

        <section>
            <h3 class="section-title">Platform Breakdown</h3>
        <table>
            <thead>
                <tr>
                    <th>Platform</th>
                    <th class="align-center">Shifts</th>
                    <th class="align-right">Hours</th>
                    <th class="align-right">Gross (PKR)</th>
                    <th class="align-right">Deductions (PKR)</th>
                    <th class="align-right">Net (PKR)</th>
                    <th class="align-right">Commission</th>
                    <th class="align-center">Verification</th>
                </tr>
            </thead>
            <tbody>
                {platform_rows}
                <tr class="total-row">
                    <td>TOTAL</td>
                    <td class="align-center">{data.total_shifts}</td>
                    <td class="align-right">{data.total_hours:.1f}</td>
                    <td class="align-right">{data.total_gross:,.0f}</td>
                    <td class="align-right">{data.total_deductions:,.0f}</td>
                    <td class="align-right">{data.total_net:,.0f}</td>
                    <td class="align-right">{data.avg_commission_rate:.1f}%</td>
                    <td class="align-center">{data.verified_shift_count}/{data.total_shifts}</td>
                </tr>
            </tbody>
        </table>
        </section>

        <section class="verification-box">
            <p class="verification-head">Verification</p>
            <p class="verification-status {verification_class}">{verification_status}</p>
            <p class="verification-note">{verification_note}</p>
            <p class="disclaimer">
                This certificate is generated from worker-reported and FairGig-verified shift records. It is intended for documentation support and is not a government-issued income document.
            </p>
        </section>

        <footer class="footer">
            Issued by FairGig Certificate Service
            <div class="verify-line">Public verification URL: {safe_verify_url}</div>
        </footer>

    </main>

    {auto_print_script}
</body>
</html>"""
    return html
