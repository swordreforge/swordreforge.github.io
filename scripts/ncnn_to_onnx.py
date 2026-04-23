#!/usr/bin/env python3
"""
NCNN to ONNX converter for Real-ESRGANv2-anime x2 model.
Fixed: Load weights as float16, preserve as float32.
"""
import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper


def load_ncnn_weights_float16(bin_file):
    """Load ncnn bin file - correctly interpreting as float16 quantized, stored as float32."""
    with open(bin_file, 'rb') as f:
        raw = f.read()
    
    # Key fix: bin file is float16 quantized stored as uint16
    uints = np.frombuffer(raw, dtype=np.uint16)
    # Preserve as float32 (not quantized)
    weights = uints.view(np.float16).astype(np.float32)
    
    print(f"Total weights (float32): {len(weights)}")
    return weights


def create_esrgan_onnx(bin_file, output_file):
    weights = load_ncnn_weights_float16(bin_file)
    
    init_list = []
    nodes = []
    idx = 0
    
    # === Layer 0: Conv 3->64 ===
    w0 = weights[idx:idx+64*3*3*3].reshape(64, 3, 3, 3)
    idx += 64*3*3*3
    b0 = weights[idx:idx+64]
    idx += 64
    prelu0 = weights[idx:idx+64]
    idx += 64
    
    init_list.append(numpy_helper.from_array(w0, name='conv0_weight'))
    init_list.append(numpy_helper.from_array(b0, name='conv0_bias'))
    init_list.append(numpy_helper.from_array(prelu0, name='prelu0_slope'))
    
    nodes.append(helper.make_node(
        'Conv', ['input', 'conv0_weight', 'conv0_bias'],
        ['conv0_out'], name='conv0',
        kernel_shape=[3, 3], strides=[1, 1], pads=[1, 1, 1, 1]
    ))
    nodes.append(helper.make_node('PRelu', ['conv0_out', 'prelu0_slope'], ['prelu0_out'], name='prelu0'))
    
    prev = 'prelu0_out'
    print(f"Layer 0: idx={idx}")
    
    # === Layers 1-16: Middle convs (64->64) ===
    for i in range(1, 17):
        w = weights[idx:idx+64*64*3*3].reshape(64, 64, 3, 3)
        idx += 64*64*3*3
        b = weights[idx:idx+64]
        idx += 64
        prelu = weights[idx:idx+64]
        idx += 64
        
        init_list.append(numpy_helper.from_array(w, name=f'conv{i}_weight'))
        init_list.append(numpy_helper.from_array(b, name=f'conv{i}_bias'))
        init_list.append(numpy_helper.from_array(prelu, name=f'prelu{i}_slope'))
        
        nodes.append(helper.make_node(
            'Conv', [prev, f'conv{i}_weight', f'conv{i}_bias'],
            [f'conv{i}_out'], name=f'conv{i}',
            kernel_shape=[3, 3], strides=[1, 1], pads=[1, 1, 1, 1]
        ))
        nodes.append(helper.make_node(
            'PRelu', [f'conv{i}_out', f'prelu{i}_slope'],
            [f'prelu{i}_out'], name=f'prelu{i}'
        ))
        
        prev = f'prelu{i}_out'
    
    print(f"Layers 1-16: idx={idx}")
    
    # === Final conv: 64->12 + PixelShuffle ===
    w_final = weights[idx:idx+12*64*3*3].reshape(12, 64, 3, 3)
    idx += 12*64*3*3
    b_final = weights[idx:idx+12]
    idx += 12
    
    init_list.append(numpy_helper.from_array(w_final, name='conv_final_weight'))
    init_list.append(numpy_helper.from_array(b_final, name='conv_final_bias'))
    
    nodes.append(helper.make_node(
        'Conv', [prev, 'conv_final_weight', 'conv_final_bias'],
        ['conv_final_out'], name='conv_final',
        kernel_shape=[3, 3], strides=[1, 1], pads=[1, 1, 1, 1]
    ))
    
    # DepthToSpace (PixelShuffle): 12 channels -> 3 channels with 2x upscaling
    nodes.append(helper.make_node(
        'DepthToSpace', ['conv_final_out'], ['output'],
        name='pixelshuffle', blocksize=2
    ))
    
    print(f"Final: idx={idx}, remaining={len(weights)-idx}")
    
    # Create ONNX model
    input_t = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, -1, -1])
    output_t = helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, -1, -1])
    
    graph = helper.make_graph(
        nodes=nodes,
        name='real_esrgan_x2',
        inputs=[input_t],
        outputs=[output_t],
        initializer=init_list
    )
    
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 11)])
    onnx.save(model, output_file)
    print(f"Model saved: {output_file}")
    
    # Verify
    m = onnx.load(output_file)
    print(f"ONNX nodes: {len(m.graph.node)}, initializers: {len(m.graph.initializer)}")


if __name__ == '__main__':
    bin_file = 'RealSR放大图片_1.12.0/assets/realsr/models-Real-ESRGANv2-anime/x2.bin'
    output_file = 'models/real_esrgan_x2.onnx'
    
    create_esrgan_onnx(bin_file, output_file)