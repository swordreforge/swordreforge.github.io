#!/bin/bash
set -e

SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_PATH/.." && pwd)"
cd "$PROJECT_DIR"

MODEL_DIR="models/real_esrgan_x2_webgl"
ONNX_FILE="models/real_esrgan_x2.onnx"

mkdir -p "$MODEL_DIR"

echo "Extracting weights from ONNX and creating TFJS format..."
python3 << 'PYEOF'
import onnx
from onnx import numpy_helper
import json
import numpy as np
import os
import sys

MODEL_DIR = 'models/real_esrgan_x2_webgl'
ONNX_FILE = 'models/real_esrgan_x2.onnx'

print('Loading ONNX model...')
model = onnx.load(ONNX_FILE)
graph = model.graph

inputs_list = []
for inp in graph.input:
    shape = []
    for dim in inp.type.tensor_type.shape.dim:
        if dim.dim_value > 0:
            shape.append(dim.dim_value)
        else:
            shape.append(None)
    inputs_list.append({'name': inp.name, 'shape': shape})

outputs_list = [{'name': out.name} for out in graph.output]

initializers = graph.initializer
print(f'Found {len(initializers)} weights')

weight_data = b''
weights_info = []
offset = 0

for init in initializers:
    np_arr = numpy_helper.to_array(init)
    np_arr_float = np_arr.astype(np.float32)
    arr_f16 = np_arr_float.astype(np.float16)
    weight_data += arr_f16.tobytes()
    
    weights_info.append({
        'name': init.name,
        'shape': list(np_arr.shape),
        'dtype': 'float16',
        'path': 'weights.bin',
        'offset': offset,
        'length': int(np_arr.size * 2)
    })
    offset += int(np_arr.size * 2)
    print(f'  {init.name}: {np_arr.shape}')

weights_path = os.path.join(MODEL_DIR, 'weights.bin')
with open(weights_path, 'wb') as f:
    f.write(weight_data)
print(f'Written weights.bin: {len(weight_data)} bytes')

nodes_info = []
for node in graph.node:
    inputs = list(node.input)
    outputs = list(node.output)
    nodes_info.append({
        'name': node.name,
        'op': node.op_type,
        'inputs': inputs,
        'outputs': outputs
    })

model_json = {
    'format': 'tfjs_graph_model',
    'generatedBy': 'onnx-1.19',
    'convertedBy': 'custom-extractor',
    'graph': {
        'name': 'real_esrgan_x2',
        'nodes': nodes_info,
        'inputs': [{'name': i['name'], 'shape': i['shape']} for i in inputs_list],
        'outputs': outputs_list
    },
    'weightsManifest': [
        {
            'paths': ['weights.bin'],
            'weights': weights_info
        }
    ]
}

model_json_path = os.path.join(MODEL_DIR, 'model.json')
with open(model_json_path, 'w') as f:
    json.dump(model_json, f, indent=2)

print(f'TFJS model.json created')
print(f'Total weights: {len(weights_info)}')
print('Done!')
PYEOF

ls -la "$MODEL_DIR/"
echo "Model converted to $MODEL_DIR"