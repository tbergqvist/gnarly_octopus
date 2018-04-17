import * as express from "express";
import { Request, Response, NextFunction } from "express";

import { json } from "body-parser";
import { database } from "./database";
import { createDbData, DataGatherer, Source, SqlDataValue } from "./data-gatherer";
import { DatabaseSource } from "./database-source";

const app = express();

app.use(json());

let Sources: {[key: string]: Source} = {
  Users: new DatabaseSource("users", []),
  UserWebpages: new DatabaseSource("user_webpages", [])
};

let Data: {[key: string]: SqlDataValue} = {
  UserId: createDbData({ name: "user_id", source: Sources.Users }),
  Username: createDbData({ name: "username", source: Sources.Users }),
  UserWebpage: createDbData({ name: "webpage", source: Sources.UserWebpages })
};

Sources.Users.joinColumns = [];
Sources.UserWebpages.joinColumns = [Data.UserId];
Sources.UserAddress.joinColumns = [Data.UserId];

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
  origin: Sources.Users,
  columns: [
    { column: Data.UserId, type: ParseTypes.Number },
    { column: Data.Username, type: ParseTypes.String },
    { column: Data.UserWebpage, type: ParseTypes.Link },
]};

app.get("/reports", (_: Request, response: Response)=> {
  return response.status(200).send(userReport);
});

app.get("/reports/1", (request: Request, response: Response)=> {
  let joiner = new DataGatherer(userReport, request.query, dbPool);
  
  joiner.run().then((result)=> {
    return response.status(200).send(result);
  });
});

app.listen(3000, "localhost", () => console.log('Example app listening on port 3000!'));