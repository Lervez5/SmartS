import logging
import os
import time
from typing import Dict

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .routers import predict_skill, recommend_next, score_response, simulate_learning_path, gamification

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("smartsprout-ai")

app = FastAPI(
    title="SmartSprout AI Engine",
    version="0.1.0",
    description="AI services for skill estimation, recommendation, and response scoring.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGIN", "http://localhost:4000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimpleRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.store: Dict[str, Dict[str, float]] = {}

    def check(self, key: str) -> None:
        from time import time as now

        record = self.store.get(key)
        current = now()
        if not record or current - record["window_start"] > self.window_seconds:
            self.store[key] = {"window_start": current, "count": 1}
            return
        if record["count"] >= self.max_requests:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        record["count"] += 1


limiter = SimpleRateLimiter(max_requests=60, window_seconds=60)


async def rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    limiter.check(client_ip)


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration:.2f}"
    return response


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics_stub() -> str:
    return "# Prometheus metrics would be exposed here\n"


app.include_router(predict_skill.router, prefix="/predict-skill", dependencies=[Depends(rate_limit)])
app.include_router(recommend_next.router, prefix="/recommend-next", dependencies=[Depends(rate_limit)])
app.include_router(score_response.router, prefix="/score-response", dependencies=[Depends(rate_limit)])
app.include_router(
    simulate_learning_path.router,
    prefix="/simulate-learning-path",
    dependencies=[Depends(rate_limit)],
)
app.include_router(gamification.router, prefix="/gamification", dependencies=[Depends(rate_limit)])
