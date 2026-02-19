# Dockerfile
# Distribution-only image: packages the wheel + extension + slash command.
# The tool runs natively on the host (needs systemd, GNOME Shell, cursor-agent).

FROM python:3.12-slim AS builder
WORKDIR /build
COPY . .
RUN pip install build && python -m build

FROM busybox:1.36
COPY --from=builder /build/dist/*.whl /dist/
COPY cursor-command/schedule-task.md /dist/
COPY gnome-extension/cursor-schedule@thason.github.io/ /dist/extension/
CMD ["echo", "Use install.sh to extract and install on the host."]
