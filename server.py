#!/usr/bin/env python3
"""
本地开发服务器，支持SharedArrayBuffer和WASM并行化

使用方法:
    python3 server.py [port]

默认端口: 8080
"""

import sys
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path


class COOPCOEPHandler(SimpleHTTPRequestHandler):
    """
    自定义HTTP处理器，添加必要的头部以支持SharedArrayBuffer
    """

    def end_headers(self):
        # 添加必需的HTTP头部以启用SharedArrayBuffer
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{self.log_date_time_string()}] {format % args}")


def main():
    # 获取端口号
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

    # 获取当前目录
    server_dir = Path(__file__).parent.absolute()

    # 切换到服务器目录
    os.chdir(server_dir)

    # 创建服务器
    server_address = ('', port)
    httpd = HTTPServer(server_address, COOPCOEPHandler)

    print("=" * 60)
    print("🚀 本地开发服务器已启动")
    print("=" * 60)
    print(f"📁 工作目录: {server_dir}")
    print(f"🌐 访问地址: http://localhost:{port}")
    print(f"🔒 SharedArrayBuffer: 已启用 (支持WASM并行化)")
    print("=" * 60)
    print("按 Ctrl+C 停止服务器")
    print("=" * 60)
    print()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 服务器已停止")
        httpd.server_close()


if __name__ == '__main__':
    main()