#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Installing model conversion tools ==="

cd "$PROJECT_DIR"

echo "Installing TensorFlow.js dependencies..."
npm install @tensorflow/tfjs @tensorflow/tfjs-converter @tensorflow/tfjs-backend-webgl --save

echo ""
echo "=== Checking NCNN conversion tools ==="

if command -v ncnn2onnx &> /dev/null; then
    echo "ncnn2onnx found: $(which ncnn2onnx)"
else
    echo "ncnn2onnx not found in PATH"
    if [ -d "$PROJECT_DIR/ncnn-20260113-webassembly" ]; then
        echo "ncnn-20260113-webassembly directory exists"
    else
        echo "No NCNN conversion tools directory found"
        echo "Will need alternative conversion solution (see Task 2)"
    fi
fi

echo ""
echo "=== Installation complete ==="