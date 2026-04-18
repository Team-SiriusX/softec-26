from datetime import datetime
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="FairGig Certificate Renderer",
    version="1.0.0",
    description="Dedicated service that renders print-friendly HTML income certificates.",
)


class RenderRequest(BaseModel):
    workerName: str = Field(min_length=1)
    workerId: str = Field(min_length=1)
    fromDate: str = Field(min_length=1)
    toDate: str = Field(min_length=1)
    totalVerified: float
    shiftCount: int
    platforms: List[str]
    generatedAt: str | None = None


class RenderResponse(BaseModel):
    html: str


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "certificate-renderer",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/render", response_model=RenderResponse)
def render_certificate(payload: RenderRequest) -> RenderResponse:
    generated_at = payload.generatedAt or datetime.utcnow().isoformat()
    escaped_platforms = "".join(f"<li>{platform}</li>" for platform in payload.platforms)

    html = f"""<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>FairGig Income Certificate</title>
    <style>
      :root {{ color-scheme: light; }}
      body {{ font-family: \"Segoe UI\", Tahoma, sans-serif; margin: 0; padding: 24px; color: #111; }}
      .sheet {{ max-width: 880px; margin: 0 auto; border: 2px solid #111; padding: 24px; }}
      h1 {{ margin: 0 0 8px; font-size: 28px; letter-spacing: 0.3px; }}
      .muted {{ color: #555; margin-bottom: 24px; }}
      .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin-bottom: 20px; }}
      .label {{ font-size: 12px; text-transform: uppercase; color: #666; letter-spacing: 0.6px; }}
      .value {{ font-size: 18px; font-weight: 600; }}
      .total {{ margin: 18px 0; padding: 14px; border: 1px solid #111; }}
      .platforms {{ margin-top: 12px; }}
      .platforms li {{ margin: 4px 0; }}
      .footer {{ margin-top: 28px; font-size: 12px; color: #555; }}
      @media print {{
        body {{ padding: 0; }}
        .sheet {{ border: 0; padding: 0; max-width: none; }}
      }}
    </style>
  </head>
  <body>
    <section class=\"sheet\">
      <h1>FairGig Income Certificate</h1>
      <p class=\"muted\">Printable summary of verified earnings for reporting to third parties.</p>

      <div class=\"grid\">
        <div>
          <div class=\"label\">Worker</div>
          <div class=\"value\">{payload.workerName}</div>
        </div>
        <div>
          <div class=\"label\">Worker ID</div>
          <div class=\"value\">{payload.workerId}</div>
        </div>
        <div>
          <div class=\"label\">Period Start</div>
          <div class=\"value\">{payload.fromDate}</div>
        </div>
        <div>
          <div class=\"label\">Period End</div>
          <div class=\"value\">{payload.toDate}</div>
        </div>
      </div>

      <div class=\"total\">
        <div class=\"label\">Total Verified Income (PKR)</div>
        <div class=\"value\">{payload.totalVerified:.2f}</div>
        <div class=\"label\" style=\"margin-top: 10px;\">Verified Shifts</div>
        <div class=\"value\">{payload.shiftCount}</div>
      </div>

      <div>
        <div class=\"label\">Platforms Included</div>
        <ul class=\"platforms\">{escaped_platforms}</ul>
      </div>

      <p class=\"footer\">Generated at {generated_at}. This certificate includes only earnings with CONFIRMED verification status.</p>
    </section>
  </body>
</html>"""

    return RenderResponse(html=html)
