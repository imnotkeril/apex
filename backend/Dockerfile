FROM python:3.12-slim

WORKDIR /app

# DejaVu gives the PDF export Cyrillic/Latin-extended glyphs (CJK: set APEX_PDF_FONT)
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
