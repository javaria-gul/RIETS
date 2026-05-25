const url = 'http://localhost:5000/health';
const intervalMs = 500;
const timeoutMs = 30000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForBackend() {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        console.log('✅ Backend is ready on port 5000');
        return;
      }
    } catch {
      // keep waiting
    }

    process.stdout.write('.');
    await sleep(intervalMs);
  }

  console.error(`\n❌ Backend did not become ready within ${timeoutMs / 1000} seconds.`);
  process.exit(1);
}

waitForBackend();
