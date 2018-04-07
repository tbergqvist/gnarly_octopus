import { createPool } from "mysql";

export namespace database {
  export function createDbPool() {
    return createPool({
      host: "localhost",
      user: "game",
      password: "asdf",
      database: "test",
      connectionLimit: 10
    });
  }
}
