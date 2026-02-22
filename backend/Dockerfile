# ============================================================
# LayoutXpert Backend - Docker Image
# Base: Ubuntu 22.04 + CUDA 12.6 | Python 3.11 | uv
# Core: PyTorch, PyTorch Geometric, PyTorch Lightning
# ============================================================

FROM nvidia/cuda:12.6.3-devel-ubuntu22.04

# ---------- Build arguments ----------
# Set PIP_INDEX_URL to your internal proxy for corporate deployment
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_TRUSTED_HOST=""
ARG PYTHON_VERSION=3.12

# ---------- Environment ----------
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

# ---------- System packages + Python ----------
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    curl \
    git \
    build-essential \
    && add-apt-repository ppa:deadsnakes/ppa -y \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    python${PYTHON_VERSION} \
    python${PYTHON_VERSION}-dev \
    python${PYTHON_VERSION}-venv \
    python${PYTHON_VERSION}-distutils \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${PYTHON_VERSION} 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python${PYTHON_VERSION} 1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ---------- Install uv ----------
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# ---------- Working directory ----------
WORKDIR /app

# ---------- Install PyTorch (CUDA 12.6) ----------
# Install PyTorch first for better Docker layer caching
RUN uv pip install --system \
    torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu126

# ---------- Install PyTorch Geometric ----------
RUN uv pip install --system \
    torch-geometric \
    --extra-index-url https://data.pyg.org/whl/torch-2.6.0+cu126.html

# ---------- Install remaining project dependencies ----------
COPY pyproject.toml ./
COPY app/ ./app/
RUN uv pip install --system .

# ---------- Default command ----------
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

