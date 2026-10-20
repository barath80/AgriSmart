#!/usr/bin/env bash
set -euo pipefail
PYVENV_DIR="venv"

if [ ! -d "$PYVENV_DIR" ]; then
  python3 -m venv "$PYVENV_DIR"
fi

source "$PYVENV_DIR/bin/activate"

pip install --upgrade pip
pip install -r requirements.txt

echo "To run: source $PYVENV_DIR/bin/activate && python app.py"
