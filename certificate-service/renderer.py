"""
HTML certificate renderer.
Generates a complete, print-friendly HTML document.
"""

from models import CertificateData

def render_certificate_html(data: CertificateData) -> str:
    from datetime import datetime

    platform_rows = ""
    for p in data.platforms:
        if p.verified_count == p.shift_count:
            status_badge = '<span style="color: #22c55e; font-weight: 600;">✓ All Verified</span>'
        elif p.verified_count > 0:
            status_badge = f'<span style="color: #f59e0b; font-weight: 600;">{p.verified_count}/{p.shift_count} Verified</span>'
        else:
            status_badge = '<span style="color: #f59e0b; font-weight: 600;">Pending</span>'

        platform_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">{p.platform_name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">{p.shift_count}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">{p.total_hours:.1f} hrs</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">{p.gross_earned:,.0f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">{p.total_deductions:,.0f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">{p.net_received:,.0f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">{p.avg_commission_rate:.1f}%</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">{status_badge}</td>
        </tr>
        """

    verification_icon = "✓" if not data.has_unverified else "⚠"
    verification_color = "#22c55e" if not data.has_unverified else "#f59e0b"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Income Certificate - {data.worker_name}</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            margin: 0;
            padding: 40px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }}
        @media print {{
            body {{
                background-color: #ffffff;
                padding: 0;
            }}
            .print-btn {{
                display: none !important;
            }}
            @page {{
                margin: 15mm;
            }}
        }}
        .container {{
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            padding: 32px;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }}
        @media print {{
            .container {{
                box-shadow: none;
                padding: 0;
            }}
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 32px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 24px;
        }}
        .logo-text {{
            font-size: 24px;
            font-weight: 700;
            color: #3b82f6;
            margin: 0;
        }}
        .tagline {{
            font-size: 14px;
            color: #64748b;
            margin-top: 4px;
        }}
        .title-section {{
            text-align: right;
        }}
        .cert-title {{
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 4px 0;
        }}
        .cert-id {{
            font-size: 12px;
            color: #94a3b8;
            font-family: monospace;
            margin: 0;
        }}
        .cert-date {{
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
        }}
        .worker-card {{
            background: #f1f5f9;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }}
        .worker-grid {{
            display: flex;
            justify-content: space-between;
        }}
        .worker-info p {{
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #64748b;
        }}
        .worker-info strong {{
            color: #0f172a;
            font-size: 16px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 32px;
        }}
        .stat-card {{
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 20px;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 4px;
        }}
        .stat-label {{
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 32px;
        }}
        th {{
            background: #f8fafc;
            padding: 12px;
            text-align: left;
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            border-bottom: 2px solid #e2e8f0;
        }}
        .table-total {{
            font-weight: 700;
            background: #f8fafc;
        }}
        .table-total td {{
            padding: 12px;
            border-bottom: 2px solid #e2e8f0;
        }}
        .verification-card {{
            display: flex;
            align-items: flex-start;
            gap: 16px;
            background: {verification_color}10;
            border: 1px solid {verification_color}30;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 32px;
        }}
        .verification-icon {{
            font-size: 24px;
            color: {verification_color};
            font-weight: bold;
        }}
        .verification-text p {{
            margin: 0;
            font-size: 14px;
            color: #0f172a;
        }}
        .disclaimer {{
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
            margin-bottom: 24px;
            line-height: 1.5;
        }}
        .footer {{
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
        }}
        .print-btn {{
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 9999px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgb(59 130 246 / 0.5);
            font-family: inherit;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1 class="logo-text">FairGig</h1>
                <p class="tagline">Empowering Gig Workers</p>
            </div>
            <div class="title-section">
                <h2 class="cert-title">Income Certificate</h2>
                <p class="cert-id" title="Certificate ID">ID: {data.certificate_id}</p>
                <p class="cert-date">Generated: {datetime.fromisoformat(data.generated_at).strftime('%B %d, %Y')}</p>
            </div>
        </div>

        <div class="worker-card">
            <div class="worker-grid">
                <div class="worker-info">
                    <p>Worker Name: <br><strong>{data.worker_name}</strong></p>
                    <p>City Zone: <br><strong>{data.city_zone or 'N/A'}</strong></p>
                </div>
                <div class="worker-info">
                    <p>Category: <br><strong>{data.category or 'Gig Work'}</strong></p>
                    <p>Date Range: <br><strong>{datetime.fromisoformat(data.from_date).strftime('%B %d, %Y')} - {datetime.fromisoformat(data.to_date).strftime('%B %d, %Y')}</strong></p>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">Rs {data.total_net:,.0f}</div>
                <div class="stat-label">Total Net Earned</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{data.total_hours:.1f}</div>
                <div class="stat-label">Total Hours</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">Rs {data.avg_hourly_rate:,.0f}</div>
                <div class="stat-label">Avg Hourly Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{data.avg_commission_rate:.1f}%</div>
                <div class="stat-label">Avg Commission</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Platform</th>
                    <th style="text-align: center;">Shifts</th>
                    <th style="text-align: center;">Hours</th>
                    <th style="text-align: right;">Gross (PKR)</th>
                    <th style="text-align: right;">Deds (PKR)</th>
                    <th style="text-align: right;">Net (PKR)</th>
                    <th style="text-align: right;">Comm %</th>
                    <th style="text-align: center;">Verified</th>
                </tr>
            </thead>
            <tbody>
                {platform_rows}
                <tr class="table-total">
                    <td>TOTAL</td>
                    <td style="text-align: center;">{data.total_shifts}</td>
                    <td style="text-align: center;">{data.total_hours:.1f} hrs</td>
                    <td style="text-align: right;">{data.total_gross:,.0f}</td>
                    <td style="text-align: right;">{data.total_deductions:,.0f}</td>
                    <td style="text-align: right;">{data.total_net:,.0f}</td>
                    <td style="text-align: right;">{data.avg_commission_rate:.1f}%</td>
                    <td style="text-align: center;">{data.verified_shift_count}/{data.total_shifts}</td>
                </tr>
            </tbody>
        </table>

        <div class="verification-card">
            <div class="verification-icon">{verification_icon}</div>
            <div class="verification-text">
                <p>{data.verification_note}</p>
            </div>
        </div>

        <div class="disclaimer">
            This certificate is generated from self-reported earnings verified by FairGig community verifiers. It is not an official government document.
        </div>

        <div class="footer">
            FairGig | fairgig.pk
        </div>
    </div>

    <button onclick="window.print()" class="print-btn">
        🖨️ Print Certificate
    </button>
</body>
</html>"""
    return html
