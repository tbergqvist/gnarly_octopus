import { Pool } from "mysql";

export interface Source {
  name: string;
  columns: SqlDataValue[];
}

export interface SqlDataValue {
  name: string;
  sources: Source[];

  addData(joiner: DataGatherer): void;
}

export interface Report {
  filters: { name: string, columns: SqlDataValue[] }[],
  getUrl: string,
  origin: Source,
  columns: { 
    column: SqlDataValue,
    type: any
  }[]
}

export function createDbData(params: {name: string, sources: Source[]}): SqlDataValue {
  let data = Object.assign(
    {
      addData(gatherer: DataGatherer) {
        gatherer.addSql(data);
      }
    }, 
    params);
  return data;
}

interface JoinedTable {
  source: Source;
  columns: SqlDataValue[];
  join?: {source: Source, column: SqlDataValue };
}

interface Sorting {
  column: string;
  order: string;
}

export class DataGatherer {
  sqlTargets: SqlDataValue[] = [];
  
  constructor(
    private _report: Report, 
    private _filterParameters: any, 
    private _sorting: Sorting | null, 
    private _dbPool: Pool
  ) {
    
  }

  addSql(dataValue: SqlDataValue) {
    this.sqlTargets.push(dataValue);
  }

  run() {
    //1. start with origin
    //2. go through everything and find what can be joined
    //3. repeat 2 until everything is gathered
    //4. return result

    this._report.columns.forEach(c => c.column.addData(this));

    let firstJoin = this._report.origin;

    let joinedTables: {[key: string]: JoinedTable} = {
      [firstJoin.name]: {
        source: firstJoin,
        columns: []
      }
    };

    function findBestTable(column: SqlDataValue) {
      //1. loop joinedTables and look for columns that share data with this new column

      for (let key in joinedTables) {
        let joinedTable = joinedTables[key];

        for (let column2 of joinedTable.source.columns) {
          for (let source of column.sources) {
            for (let column3 of source.columns) {
              if (column3 === column2)
                return {
                  from: joinedTable,
                  to: source,
                  column: column3
                };
            }
          }
        }
      }
      throw Error("Nothing found!!!");
    }

    function findExistingJoin(column: SqlDataValue) {
      for (let source of column.sources) {
        let existingTable = joinedTables[source.name];
        if (existingTable) {
          return existingTable;
        }
      }

      return undefined;
    }

    this.sqlTargets.forEach(column => {
      let existingJoin = findExistingJoin(column);
      if (!existingJoin) {
        let table = findBestTable(column);
        joinedTables[table.to.name] = {
          source: table.to,
          columns: [column],
          join: { source: table.from.source, column: table.column }
        };
      } else {
        existingJoin.columns.push(column);
      }
    });

    let tables = Object.keys(joinedTables).map(key => joinedTables[key]);

    function getColumns(sqlTargets: SqlDataValue[], tables: JoinedTable[]) {
      return sqlTargets.map(target => {
        let table = tables.find(t => t.columns.some(c => c === target));
        return `${table!.source.name}.${target.name}`;
      });
    }

    function getTables(tables: JoinedTable[]) {
      return tables.map(t => !t.join ? t.source.name : 
        `inner join ${t.source.name} on ${t.source.name}.${t.join.column.name} = ${t.join.source.name}.${t.join.column.name}`).join("\n");
    }

    function getFilters(filters: { name: string, columns: SqlDataValue[] }[], tables: JoinedTable[], parameters: any) {
      let usedFilters = filters.filter(f => !!parameters[f.name]);

      return usedFilters.map(target => {
        return "(" + target.columns.map(column => {
          let table = tables.find(t => t.columns.some(c => c === column));
          return `${table!.source.name}.${column.name} = ${parameters[target.name]}`;
        }).join(" or ") + ")";
      }).join(" and ");
    }

    function getSorting(sorting: Sorting | null) {
      if (sorting == null) {
        return "";
      }
      console.log(sorting);
      return `order by ${sorting.column} ${sorting.order}`
    }

    let filters = getFilters(this._report.filters, tables, this._filterParameters);

    let query = `
      select ${getColumns(this.sqlTargets, tables)}
      from ${getTables(tables)}
      ${filters ? ` where ${filters}` : ""}
      ${getSorting(this._sorting)}
    ;
    `;

   console.log(query);

   return new Promise((resolve)=> {
      this._dbPool.query(query, (err, results)=> {
        console.log(err, results);
        resolve(results);
      });
    });
    
    
  }
}