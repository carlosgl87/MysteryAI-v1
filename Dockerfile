FROM python:3.12-slim
WORKDIR /app
COPY front/ /app/front/
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "exec python -m http.server \"$PORT\" --bind 0.0.0.0 --directory /app/front"]
