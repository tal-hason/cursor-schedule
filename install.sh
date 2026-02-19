#!/usr/bin/env bash
# install.sh -- One-command installer for cursor-schedule
set -euo pipefail

VERSION="${1:-latest}"
IMAGE="ghcr.io/thason/cursor-schedule:${VERSION}"
EXT_UUID="cursor-schedule@thason.github.io"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXT_UUID}"

info()  { echo -e "\033[1;34m==>\033[0m $*"; }
ok()    { echo -e "\033[1;32m  ✓\033[0m $*"; }
fail()  { echo -e "\033[1;31m  ✗\033[0m $*"; exit 1; }

# -- Pre-flight ---------------------------------------------------------------
info "Pre-flight checks"

python3 -c "import sys; assert sys.version_info >= (3,10)" 2>/dev/null \
    || fail "Python 3.10+ required"
ok "Python $(python3 --version | cut -d' ' -f2)"

command -v cursor-agent >/dev/null || fail "cursor-agent not found on PATH"
ok "cursor-agent found"

if command -v podman >/dev/null; then
    CRT="podman"
elif command -v docker >/dev/null; then
    CRT="docker"
else
    fail "docker or podman required"
fi
ok "Container runtime: ${CRT}"

systemctl --user status >/dev/null 2>&1 || fail "systemd user session not active"
ok "systemd user session active"

# -- Pull + Extract ------------------------------------------------------------
info "Pulling ${IMAGE}"
${CRT} pull "${IMAGE}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "${TMPDIR}"' EXIT

CID=$(${CRT} create "${IMAGE}")
${CRT} cp "${CID}:/dist/" "${TMPDIR}/"
${CRT} rm "${CID}" >/dev/null
ok "Extracted artifacts to ${TMPDIR}/dist/"

# -- Install wheel -------------------------------------------------------------
info "Installing cursor-schedule"
pip install --user "${TMPDIR}"/dist/*.whl
ok "pip install complete"

# -- Install GNOME extension ---------------------------------------------------
info "Installing GNOME Shell extension"
mkdir -p "${EXT_DIR}"
cp -r "${TMPDIR}/dist/extension/"* "${EXT_DIR}/"
gnome-extensions enable "${EXT_UUID}" 2>/dev/null || true
ok "Extension installed to ${EXT_DIR}"

# -- Install slash command -----------------------------------------------------
info "Installing Cursor slash command"
mkdir -p "${HOME}/.cursor/commands"
cp "${TMPDIR}/dist/schedule-task.md" "${HOME}/.cursor/commands/"
ok "schedule-task.md -> ~/.cursor/commands/"

# -- Verify --------------------------------------------------------------------
info "Verifying installation"
cursor-schedule --version
ok "cursor-schedule ready"

echo ""
info "Installation complete!"
echo "  CLI:       cursor-schedule --help"
echo "  Extension: Requires logout/login on Wayland to activate"
echo "  Uninstall: cursor-schedule uninstall"
