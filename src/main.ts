import * as express from "express";
import { Request, Response, NextFunction } from "express";

import { json } from "body-parser";
import { database } from "./database";

const app = express();

app.use(json());

interface DataJoiner {
  addSql(dataValue: DataValue): void;
  run(filters: any): Promise<any>;
}

interface Table {
  name: string;
  joinColumns: DataValue[];
}

interface DataValue {
  name: string;
  table: Table;

  addData(joiner: DataJoiner): void;
}

function createDbData(data: {name: string, table: Table}): DataValue {
  let bla = Object.assign(
    {
      addData(joiner: DataJoiner) {
        joiner.addSql(bla);
      }
    }, 
    data);
  return bla;
}

let Tables: {[key: string]: Table} = {
  Users: {name: "users", joinColumns: []},
  UserWebpages: {name: "user_webpages", joinColumns: []}
};

let Data = {
  UserId: createDbData({name: "user_id", table: Tables.Users}),
  Username: createDbData({name: "username", table: Tables.Users }),
  UserWebpage: createDbData({name: "webpage", table: Tables.UserWebpages })
};

Tables.Users.joinColumns = [];
Tables.UserWebpages.joinColumns = [Data.UserId];

enum ParseTypes {
  Number,
  String,
  Link
}

let Filters = {
  UserId: { name: "userId", columns: [Data.UserId]},
  FreeSearch: { name: "freeSearch", columns: [Data.Username, Data.UserWebpage]}
};

function enableCors(_: Request, res: Response, next: NextFunction) {
  res.header("Access-Control-Allow-Origin", "http://localhost:8080");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
  next();
}

app.use(enableCors);

let dbPool = database.createDbPool();

let userReport = {
  filters: [Filters.UserId, Filters.FreeSearch],
  getUrl: "localhost:3000/reports/1?{?userId,freeSearch}",
  columns: [
    { column: Data.UserId, type: ParseTypes.Number },
    { column: Data.Username, type: ParseTypes.String },
    { column: Data.UserWebpage, type: ParseTypes.Link },
]};

app.get("/reports", (_: Request, response: Response)=> {
  return response.status(200).send(userReport);
});

app.get("/reports/1", (request: Request, response: Response)=> {
  let joiner = createJoiner();
  userReport.columns.forEach(c => joiner.addSql(c.column));
  joiner.run(request.query).then((data)=> {
    return response.status(200).send(data);
  })
});

app.listen(3000, "localhost", () => console.log('Example app listening on port 3000!'));

function createJoiner(): DataJoiner {
  let sqlTargets: DataValue[] = [];
  return {
    addSql(dataValue: DataValue) {
      sqlTargets.push(dataValue);
    },

    run(filterParameters: any) {
      let firstJoin = Tables.Users;
      let tables = Array.from(new Set(sqlTargets.filter(c => c.table !== firstJoin).map(t => t.table)));

      let query = `
      select
        ${sqlTargets.map(c => c.table.name + '.' + c.name).join(", ")}
      from
        ${firstJoin.name}
        ${tables.map(t => `inner join ${t.name} on ${t.joinColumns.map(c => `${t.name}.${c.name} = ${c.table.name}.${c.name}`).join(" and ")}`).join('')}
      where
        ${userReport.filters.map(f => `(${f.columns.map(c => `(${filterParameters[f.name]} is null or ${c.table.name}.${c.name} = ${filterParameters[f.name]})`).join(" or ")})`).join(" and \n")}
      ;`;
      console.log(query);
      
      return new Promise((resolve)=> {
        dbPool.query(query, (err, results)=> {
          console.log(err, results);
          resolve(results);
        });
      });
      
    },
  }
}