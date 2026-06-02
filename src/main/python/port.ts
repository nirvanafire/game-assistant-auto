import net from 'net';

export function findAvailablePort(preferred?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    if (preferred) {
      const test = net.createServer();
      test.listen(preferred, '127.0.0.1', () => {
        test.close(() => resolve(preferred));
      });
      test.on('error', () => {
        getDynamicPort().then(resolve).catch(reject);
      });
    } else {
      getDynamicPort().then(resolve).catch(reject);
    }
  });
}

function getDynamicPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not determine port')));
      }
    });
    server.on('error', reject);
  });
}
