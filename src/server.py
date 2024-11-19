from http.server import SimpleHTTPRequestHandler, HTTPServer

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')  # 모든 도메인 허용
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')  # 허용 메서드
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

if __name__ == "__main__":
    httpd = HTTPServer(('localhost', 8000), CORSRequestHandler)
    print("Serving on port 8000...")
    httpd.serve_forever()