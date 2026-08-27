#!/bin/bash

# Reverse-leg residual regression test.
#
# The canonical repro rests BUY YES (+0.05) and takes BUY NO (-0.05).
# This entrypoint exercises the symmetric path: it rests BUY NO (-0.05)
# and takes BUY YES (+0.05), then verifies the NO maker remains within its
# signed collateral and position cap.
#
# Use a fresh market. The script delegates the common lifecycle and assertions
# to 6_residual_multifill_repro.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RESIDUAL_REST_PRICE="-${RESIDUAL_PRICE:-0.05}"
export RESIDUAL_TAKE_PRICE="${RESIDUAL_PRICE:-0.05}"
export RESIDUAL_MAKER_TOKEN="no"

exec "$SCRIPT_DIR/6_residual_multifill_repro.sh" "$@"