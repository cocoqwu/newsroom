// `npm run db:reset` : delete the local database. The next command recreates it from the migrations.
import fs from "node:fs";
import path from "node:path";
for (const f of ["newsroom.db", "newsroom.db-wal", "newsroom.db-shm"]) {
  const p = path.join(process.cwd(), "data", f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log("removed", p); }
}
