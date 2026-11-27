// Loopback-only synthetic document transport. No hosted service or user data.
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Shape the URL like the application flow without using or simulating real Storage auth.
const routes = new Map([
  ['/audit-document.pdf?token=fixture-only', 'inline'],
  ['/audit-document.pdf?token=fixture-only&download=1', 'attachment'],
]);

export function makePdfFixtureServer({ cert, key, pdf, observe = () => {} }) {
  if (!Buffer.isBuffer(pdf) || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new TypeError('Synthetic PDF fixture required');
  }
  return createServer({ cert, key }, (req, res) => {
    const mode = routes.get(req.url);
    const method = req.method;
    if (!mode || !['GET', 'HEAD'].includes(method)) {
      res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return;
    }
    let start = 0;
    let end = pdf.length - 1;
    let status = 200;
    if (method === 'GET' && req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (match) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), end) : end;
        if (start > end || start >= pdf.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${pdf.length}` }).end();
          return;
        }
        status = 206;
      }
    }
    const body = pdf.subarray(start, end + 1);
    res.writeHead(status, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${mode}; filename="audit-document.pdf"`,
      'Content-Length': body.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${pdf.length}` } : {}),
    }).end(method === 'GET' ? body : undefined);
    // Never log a query string, headers or the body.
    res.once('finish', () => observe({ mode, method, status, bytes: method === 'GET' ? body.length : 0 }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [certFile, keyFile, pdfFile, port = '8443'] = process.argv.slice(2);
  const server = makePdfFixtureServer({
    cert: readFileSync(certFile), key: readFileSync(keyFile), pdf: readFileSync(pdfFile),
    observe: (entry) => console.log(JSON.stringify(entry)),
  });
  server.listen(Number(port), '127.0.0.1', () => console.log('loopback PDF fixture ready'));
}
