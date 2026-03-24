# ══════════════════════════════════════════════
# GraphX.AI Backend — CUDA 12.4 GPU Container
# ══════════════════════════════════════════════
# Build:  docker build -t graphx-backend .
# Run:    docker run --gpus all -p 8000:8000 graphx-backend
# ══════════════════════════════════════════════

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 python3.11-venv python3.11-dev python3-pip \
        build-essential curl git && \
    ln -sf /usr/bin/python3.11 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# ── Dependencies ──
COPY pyproject.toml uv.lock requirements.txt ./

# Install PyTorch with CUDA 12.4 wheels, then the rest
RUN uv venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124 && \
    uv pip install -r requirements.txt

ENV PATH="/app/.venv/bin:${PATH}" \
    VIRTUAL_ENV="/app/.venv"

# ── Application ──
COPY app/ ./app/
COPY mock_data/ ./mock_data/

# Storage directory for models & uploaded data
RUN mkdir -p /app/storage/models

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/docs || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
