#!/bin/bash
# 使用 Python HTTP 服务器作为备用方案
# 这将提供 COOP/COEP 头以支持 Web Workers

cd /home/swordreforge/projects/wasm-test

echo "启动本地 HTTP 服务器（支持 COOP/COEP）..."
echo "服务地址: http://localhost:8080"
echo "按 Ctrl+C 停止服务器"

# 使用 Python 3 的 http.server
python3 - << 'PYTHON_SCRIPT'
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import mimetypes

# 注册 .wasm MIME 类型
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/octet-stream', '.wasm')

class COOPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加 COOP/COEP 头以支持 SharedArrayBuffer 和 Web Workers
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        super().end_headers()

def run(server_class=HTTPServer, handler_class=COOPRequestHandler, port=8080):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Server running on http://localhost:{port}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped')
        httpd.server_close()

if __name__ == '__main__':
    run()
PYTHON_SCRIPT
