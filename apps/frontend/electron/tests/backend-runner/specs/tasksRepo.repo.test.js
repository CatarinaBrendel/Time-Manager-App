const Database = require("better-sqlite3");
const { TasksRepo } = require("/work/apps/frontend/electron/backend/repos/tasksRepo.js");

describe("TasksRepo (container, isolated DB)", () => {
  let db, repo;

  beforeAll(() => {
    db = new Database(process.env.DB_PATH);
    db.pragma("foreign_keys = ON");
    repo = TasksRepo(db); // DI: test against this db only
  });

  afterAll(() => db.close());

  beforeEach(() => {
    // wipe tables you use; real migrations already created them
    for (const t of ["task_tags","tags","tasks","projects","companies","priorities","sessions"]) {
      try { db.exec(`DELETE FROM ${t};`); } catch {}
    }
  });

  test("create() + get() roundtrip with tags", () => {
    const t = repo.create({ title: "Write tests", tags: ["backend","qa","backend"] });
    const got = repo.get(t.id);
    expect(new Set(got.tags)).toEqual(new Set(["backend","qa"]));
  });

  test("list() tag filters: any vs all", () => {
    repo.create({ title: "A", tags: ["red","blue"] });
    repo.create({ title: "B", tags: ["red"] });
    repo.create({ title: "C", tags: ["blue"] });

    const any = repo.list({ tags: ["red","blue"], tagMode: "any", limit: 10 });
    expect(new Set(any.items.map(i => i.title))).toEqual(new Set(["A","B","C"]));

    const all = repo.list({ tags: ["red","blue"], tagMode: "all", limit: 10 });
    expect(all.items.map(i => i.title)).toEqual(["A"]);
  });

  test("listTags(): no prefix returns popular tag NAMES (freq desc, tie by name)", () => {
    // api(3), backend(2), build(1), qa(1)
    repo.create({ title: "A", tags: ["api","backend"] });
    repo.create({ title: "B", tags: ["api","qa"] });
    repo.create({ title: "C", tags: ["api","backend","build"] });

    const namesTop2 = repo.listTags("", 2); // delegates to popularTags under the hood
    expect(namesTop2).toEqual(["api","backend"]); // freq: api=3, backend=2
  });

  test("listTags(): case-insensitive prefix (pure JS filter) + limit", () => {
    // Seed a few tags; only 'backend' starts with 'be'
    repo.create({ title: "A", tags: ["api","backend"] });
    repo.create({ title: "B", tags: ["api","qa"] });
    repo.create({ title: "C", tags: ["api","backend","build"] });

    // 'ba' should match 'backend' (not 'build'), case-insensitively
    expect(repo.listTags("ba", 10)).toEqual(["backend"]);
    expect(repo.listTags("BA", 10)).toEqual(["backend"]);

    // Limit is honored
    expect(repo.listTags("ba", 1)).toEqual(["backend"]);
  });

});
