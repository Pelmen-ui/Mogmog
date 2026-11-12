// Minimal static file server for local play and headless checks: `node tools/serve.mjs [port]`.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.ktx2': 'image/ktx2',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

export function startServer(root, port = 0) {
    const base = resolve(root);
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = normalize(join(base, urlPath));
        if (!filePath.startsWith(base)) {
            res.writeHead(403).end();
            return;
        }
        try {
            let st = statSync(filePath);
            if (st.isDirectory()) {
                filePath = join(filePath, 'index.html');
                st = statSync(filePath);
            }
            res.writeHead(200, {
                'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Content-Length': st.size,
                'Cache-Control': 'no-cache'
            });
            createReadStream(filePath).pipe(res);
        } catch {
            res.writeHead(404).end('not found');
        }
    });
    return new Promise((ok) => {
        server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port }));
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = resolve(fileURLToPath(import.meta.url), '..', '..');
    const { port } = await startServer(root, Number(process.argv[2]) || 8080);
    console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
}
