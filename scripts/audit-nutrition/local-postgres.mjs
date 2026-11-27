import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function localPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

export async function startNutritionAuditPostgres(pgBin, driverPath) {
  const { Client } = (await import(pathToFileURL(resolve(driverPath)).href)).default;
  const root = mkdtempSync('/tmp/tb-nutrition-db-');
  const data = join(root, 'data');
  const password = randomBytes(24).toString('hex');
  const passwordFile = join(root, 'local-password');
  let port;
  const pg = (command, args) => execFileSync(join(resolve(pgBin), command), args, {
    encoding: 'utf8', timeout: 30000,
  });
  const connections = [];
  let started = false;
  async function connect() {
    const connection = new Client({
      host: '127.0.0.1', port, user: 'audit_owner', database: 'postgres', password, ssl: false,
      connectionTimeoutMillis: 5000, statement_timeout: 10000,
    });
    await connection.connect();
    connections.push(connection);
    return connection;
  }

  async function close() {
    try {
      await Promise.allSettled(connections.map(connection => connection.end()));
    } finally {
      if (started) pg('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
      rmSync(root, { recursive: true, force: true });
    }
  }

  try {
    port = await localPort();
    writeFileSync(passwordFile, password + '\n', { mode: 0o600 });
    pg('initdb', ['-D', data, '-U', 'audit_owner', '--auth=scram-sha-256', '--pwfile=' + passwordFile, '--locale=C', '--encoding=UTF8']);
    rmSync(passwordFile);
    // No external listener or inherited connection settings.
    pg('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o',
      `-c listen_addresses=127.0.0.1 -c unix_socket_directories='' -p ${port}`, '-w', 'start']);
    started = true;
    return { port, connect, close };
  } catch (error) {
    try { console.error(readFileSync(join(root, 'postgres.log'), 'utf8')); } catch (_) {}
    await close();
    throw error;
  }
}
