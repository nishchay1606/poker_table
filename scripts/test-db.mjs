import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(path.join(root, "supabase/migrations/0001_init.sql"), "utf8");

const shim = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const db = new PGlite({ extensions: { citext } });
await db.exec(shim);
await db.exec(migration);

let failures = 0;
const pass = (name) => console.log(`PASS  ${name}`);
const fail = (name, detail) => {
  failures++;
  console.log(`FAIL  ${name}${detail ? " -> " + detail : ""}`);
};

async function as(role, fn) {
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

async function expectOk(name, fn) {
  try {
    const r = await fn();
    pass(name);
    return r;
  } catch (e) {
    fail(name, e.message);
  }
}
async function expectErr(name, fn, match) {
  try {
    await fn();
    fail(name, "expected error but succeeded");
  } catch (e) {
    if (match && !new RegExp(match, "i").test(e.message)) fail(name, `wrong error: ${e.message}`);
    else pass(`${name} (${e.message})`);
  }
}
function check(name, cond, detail) {
  if (cond) pass(name);
  else fail(name, detail);
}

const summary = (tpId) => one("select * from table_player_summary where table_player_id = $1", [tpId]);
const idOf = async (name) => (await one("select id from players where name = $1", [name])).id;

const ids = {};
await as("authenticated", async () => {
  for (const n of ["A", "B", "C"]) {
    const r = await expectOk(`create_player ${n}`, () => one("select * from create_player($1)", [n]));
    ids[n] = r?.id;
  }
  await expectErr("create_player 'a' duplicate (case-insensitive)", () => q("select create_player('a')"), 'already exists');
  await expectErr("create_player blank rejected", () => q("select create_player('   ')"));
  await expectErr("rename_player to existing name rejected", () => q("select rename_player($1, 'b')", [ids.A]), 'already exists');

  const T = (await one("select create_table('Game 1', 500) as id")).id;
  const tpA = (await one("select seat_player($1,$2) as id", [T, ids.A])).id;
  const tpB = (await one("select seat_player($1,$2) as id", [T, ids.B])).id;
  check("A total_buyin 500", (await summary(tpA)).total_buyin === 500);
  check("B total_buyin 500", (await summary(tpB)).total_buyin === 500);
  await expectErr("seat A twice rejected", () => q("select seat_player($1,$2)", [T, ids.A]), 'already seated');

  const tpD = (await one("select add_and_seat_player($1,'D') as id", [T])).id;
  check("D exists in players", !!(await one("select 1 as x from players where name = 'D'")));
  check("D total_buyin 500", (await summary(tpD)).total_buyin === 500);

  await q("select change_buyin($1, 1)", [tpA]);
  await q("select change_buyin($1, 1)", [tpA]);
  let s = await summary(tpA);
  check("A +1 +1 -> 1500, count 3", s.total_buyin === 1500 && s.buyin_count === 3, JSON.stringify(s));
  await q("select change_buyin($1, -1)", [tpA]);
  s = await summary(tpA);
  check("A -1 -> 1000", s.total_buyin === 1000 && s.buyin_count === 2, JSON.stringify(s));
  await expectErr("B -1 at 500 rejected", () => q("select change_buyin($1, -1)", [tpB]), 'below 1 buy-in');
  await expectErr("change_buyin direction 2 rejected", () => q("select change_buyin($1, 2)", [tpB]));
  await expectErr("set_cash_out negative rejected", () => q("select set_cash_out($1, -5)", [tpB]));

  await q("select set_cash_out($1, 2000)", [tpA]);
  await q("select set_cash_out($1, 0)", [tpB]);
  await q("select set_cash_out($1, 0)", [tpD]);
  let agg = await one("select sum(total_buyin)::int as b, sum(cash_out)::int as c from table_player_summary where table_id = $1", [T]);
  check("buy-ins 2000 = cash-outs 2000", agg.b === 2000 && agg.c === 2000, JSON.stringify(agg));
  check("A net +1000", (await summary(tpA)).net === 1000);
  await q("select set_cash_out($1, 100)", [tpD]);
  agg = await one("select sum(total_buyin)::int as b, sum(cash_out)::int as c from table_player_summary where table_id = $1", [T]);
  check("D cash-out 100 -> difference 100", agg.c - agg.b === 100, JSON.stringify(agg));
  await q("select set_cash_out($1, 0)", [tpD]);

  await q("select set_cash_out($1, null)", [tpB]);
  check("cleared cash-out -> net null", (await summary(tpB)).net === null);
  await expectErr("close with missing cash-out rejected, names B", () => q("select close_table($1)", [T]), 'Missing cash-out for: B');
  await q("select set_cash_out($1, 0)", [tpB]);

  // second open table with results that must be excluded
  const T2 = (await one("select create_table('Game 2') as id")).id;
  check("default buy-in 500", (await one("select buy_in_amount from game_tables where id=$1", [T2])).buy_in_amount === 500);
  const tpC2 = (await one("select seat_player($1,$2) as id", [T2, ids.C])).id;
  await q("select set_cash_out($1, 5000)", [tpC2]);
  const tpA2 = (await one("select seat_player($1,$2) as id", [T2, ids.A])).id;
  await q("select set_cash_out($1, 9000)", [tpA2]);

  await expectOk("close_table T", () => q("select close_table($1)", [T]));
  check("status closed + closed_at", (await one("select status, closed_at from game_tables where id=$1", [T])).status === "closed");
  await expectErr("change_buyin on closed rejected", () => q("select change_buyin($1, 1)", [tpA]), 'Table is closed');
  await expectErr("set_cash_out on closed rejected", () => q("select set_cash_out($1, 1)", [tpA]), 'Table is closed');
  await expectErr("seat_player on closed rejected", () => q("select seat_player($1,$2)", [T, ids.C]), 'Table is closed');
  await expectErr("add_and_seat on closed rejected", () => q("select add_and_seat_player($1,'Z')", [T]), 'Table is closed');
  await expectErr("remove_table_player on closed rejected", () => q("select remove_table_player($1)", [tpB]), 'Table is closed');

  const lb = await q("select * from overall_leaderboard order by player_name");
  const a = lb.find((r) => r.player_name === "A");
  check("leaderboard A net 1000, 1 table, buyin 1000, cashout 2000, biggest_win 1000",
    a && a.net === 1000 && a.tables_played === 1 && a.total_buyin === 1000 && a.total_cash_out === 2000 && a.biggest_win === 1000, JSON.stringify(a));
  check("leaderboard excludes open table (C absent, A tables_played 1)", !lb.find((r) => r.player_name === "C"));
  const b = lb.find((r) => r.player_name === "B");
  check("biggest_win null when never won", b && b.biggest_win === null, JSON.stringify(b));

  // remove_table_player on open table
  const tpC = (await one("select seat_player($1,$2) as id", [T2, ids.B])).id;
  await expectOk("remove fresh 1-buy-in player", () => q("select remove_table_player($1)", [tpC]));
  check("row deleted", !(await one("select 1 as x from table_players where id=$1", [tpC])));
  const tpB2 = (await one("select seat_player($1,$2) as id", [T2, ids.B])).id;
  await q("select change_buyin($1, 1)", [tpB2]);
  await expectErr("remove rejected after +1 buy-in", () => q("select remove_table_player($1)", [tpB2]), '1 buy-in');
  await q("select change_buyin($1, -1)", [tpB2]);
  await q("select set_cash_out($1, 0)", [tpB2]);
  await expectErr("remove rejected with cash-out set", () => q("select remove_table_player($1)", [tpB2]), 'cash-out');

  // close empty table
  const T3 = (await one("select create_table('Empty') as id")).id;
  await expectErr("close empty table rejected", () => q("select close_table($1)", [T3]), 'no players');
  await expectErr("create_table non-positive buy-in rejected", () => q("select create_table('x', 0)"));

  // archive
  await q("select set_player_archived($1, true)", [ids.C]);
  await expectErr("seat archived rejected", () => q("select seat_player($1,$2)", [T2, ids.C]), 'archived');
  await q("select add_and_seat_player($1, 'c')", [T3]);
  check("add_and_seat unarchives existing name", (await one("select is_archived from players where id=$1", [ids.C])).is_archived === false);

  await expectOk("reopen_table", () => q("select reopen_table($1)", [T]));
  const rt = await one("select status, closed_at from game_tables where id=$1", [T]);
  check("reopened: open, closed_at null", rt.status === "open" && rt.closed_at === null, JSON.stringify(rt));
  check("leaderboard empty of reopened table", !(await one("select 1 as x from overall_leaderboard where player_name='A'")));
});

await as("anon", async () => {
  check("anon sees zero game_tables", (await q("select * from game_tables")).length === 0);
  check("anon sees zero players", (await q("select * from players")).length === 0);
  check("anon sees zero table_players", (await q("select * from table_players")).length === 0);
  check("anon sees zero buyin_transactions", (await q("select * from buyin_transactions")).length === 0);
  await expectErr("anon select table_player_summary denied", () => q("select * from table_player_summary"), 'permission denied');
  await expectErr("anon insert into players blocked", () => q("insert into players(name) values ('X')"));
  check("anon update game_tables affects 0 rows", (await db.query("update game_tables set name='hack'")).affectedRows === 0);
  check("anon delete table_players affects 0 rows", (await db.query("delete from table_players")).affectedRows === 0);
  check("anon delete players affects 0 rows", (await db.query("delete from players")).affectedRows === 0);
  const u = "00000000-0000-0000-0000-000000000000";
  const calls = [
    "create_table('x', 500)", "create_player('x')", `rename_player('${u}','x')`,
    `set_player_archived('${u}', true)`, `seat_player('${u}','${u}')`, "add_and_seat_player('" + u + "','x')",
    `change_buyin('${u}', 1)`, `remove_table_player('${u}')`, `set_cash_out('${u}', 1)`,
    `close_table('${u}')`, `reopen_table('${u}')`,
  ];
  for (const c of calls) await expectErr(`anon rpc ${c.split("(")[0]} denied`, () => q(`select ${c}`), 'permission denied');
  await expectOk("anon select overall_leaderboard succeeds", () => q("select * from overall_leaderboard"));
});

// leaderboard visible to anon with data: close a table first
await as("authenticated", async () => {
  const T = (await one("select create_table('Pub') as id")).id;
  const tp = (await one("select seat_player($1,$2) as id", [T, await idOf("A")])).id;
  await q("select set_cash_out($1, 800)", [tp]);
  await q("select close_table($1)", [T]);
});
await as("anon", async () => {
  const rows = await q("select * from overall_leaderboard");
  check("anon reads closed-table results via overall_leaderboard", rows.length === 1 && rows[0].player_name === "A" && rows[0].net === 300, JSON.stringify(rows));
});

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
await db.close();
process.exit(failures ? 1 : 0);
