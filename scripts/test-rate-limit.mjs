// One-off: verify the per-IP-per-minute rate limit actually blocks the
// 6th fresh request. Uses 7 distinct, never-before-seen idea texts so
// every request is a guaranteed cache miss (otherwise cache hits would
// bypass the limiter entirely, which is correct behavior but would
// make this test meaningless).

const BASE_URL = "http://localhost:3000";

const IDEAS = Array.from(
  { length: 7 },
  (_, i) => `Rate limit test idea number ${i} about a fictional gadget for testing purposes only.`
);

async function scoreOne(idea) {
  const res = await fetch(`${BASE_URL}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  for (let i = 0; i < IDEAS.length; i++) {
    const { status, data } = await scoreOne(IDEAS[i]);
    console.log(`Request ${i + 1}: HTTP ${status} — ${JSON.stringify(data)}`);
  }
}

main();
