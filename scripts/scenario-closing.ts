import { Pool } from "pg";

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, data: (text ? JSON.parse(text) : null) as any };
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const reg = await api("POST", "/auth/register", undefined, {
    email: `scenario-${Date.now()}@example.com`,
    password: "supersecret123",
    timezone: "UTC",
  });
  if (reg.status !== 201) throw new Error(`Register failed (${reg.status}). Is the server running?`);
  const token: string = reg.data.accessToken;
  const userId: string = reg.data.user.id;

  try {
    // Today's data: one pending one-off, one done one-off, one daily recurring
    await api("POST", "/tasks", token, { title: "Pay rent" });
    const walk = await api("POST", "/tasks", token, { title: "Walk" });
    await api("POST", "/tasks", token, { title: "Drink water", repeat: { type: "daily" } });

    const todayView = await api("GET", "/tasks/occurrences", token); // also generates Drink water
    const today: string = todayView.data.date;
    await api("PATCH", `/tasks/occurrences/${walk.data.occurrence.id}`, token, { status: "done" });

    // Time travel: make everything 3 days older (this user only)
    await pool.query("update task_occurrences set date = date - 3 where user_id = $1", [userId]);
    await pool.query(
      "update tasks set start_date = start_date - 3 where user_id = $1 and start_date is not null",
      [userId],
    );
    await pool.query(
      "update users set created_at = created_at - interval '3 days', last_closed_date = null where id = $1",
      [userId],
    );

    // The first request now triggers closing of the 3 missed days
    const from = addDays(today, -3);
    type Day = { date: string; status: string; done: number; total: number };
    const heat = await api("GET", `/history/tasks?from=${from}`, token);
    const got = (heat.data.days as Day[]).map((d) => `${d.status} ${d.done}/${d.total}`);
    const expected = ["partial 1/3", "missed 0/2", "missed 0/2", "open 0/2"];
    check("heatmap matches the scenario", JSON.stringify(got) === JSON.stringify(expected),
      `got      [${got.join(", ")}]\n      expected [${expected.join(", ")}]`);

    const again = await api("GET", `/history/tasks?from=${from}`, token);
    check("closing is idempotent (same result on a second call)",
      JSON.stringify(again.data.days) === JSON.stringify(heat.data.days));

    const todayAfter = await api("GET", "/tasks/occurrences", token);
    const titles = (todayAfter.data.occurrences as { title: string; carriedFromId: string | null }[])
      .map((o) => (o.carriedFromId ? `${o.title} (carried)` : o.title))
      .sort();
    check("today has Pay rent (carried) and Drink water (not duplicated)",
      JSON.stringify(titles) === JSON.stringify(["Drink water", "Pay rent (carried)"]),
      `got [${titles.join(", ")}]`);

    const past = await api("GET", `/tasks/occurrences?date=${from}`, token);
    const frozen = await api("PATCH", `/tasks/occurrences/${past.data.occurrences[0].id}`, token, {
      status: "done",
    });
    check("a past occurrence is frozen (409)", frozen.status === 409, `status ${frozen.status}`);
  } finally {
    await pool.query("delete from users where id = $1", [userId]); // cascades to tasks, occurrences, tokens
    await pool.end();
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});