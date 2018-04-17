import { Pool } from "mysql";

export interface Source {
  name: string;
  joinColumns: SqlDataValue[];
}

export interface SqlDataValue {
  name: string;
  source: Source;

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

export function createDbData(params: {name: string, source: Source}): SqlDataValue {
  let bla = Object.assign(
    {
      addData(gatherer: DataGatherer) {
        gatherer.addSql(bla);
      }
    }, 
    params);
  return bla;
}

export class DataGatherer {
  sqlTargets: SqlDataValue[] = [];
  
  constructor(
    private _report: Report, 
    private _filterParameters: any, 
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

    let tables = Array.from(new Set(this.sqlTargets.filter(c => c.source !== firstJoin).map(t => t.source)));
    
    let sqlFilters: {name: string, columns: SqlDataValue[]}[] = <any>this._report.filters.filter(f => this.sqlTargets.find(s => !!f.columns.find(f2 => f2.name === s.name)));

    let query = `
    select
      ${this.sqlTargets.map(c => c.source.name + '.' + c.name).join(", ")}
    from
      ${firstJoin.name}
      ${tables.map(t => `inner join ${t.name} on ${t.joinColumns.map(c => `${t.name}.${c.name} = ${c.source.name}.${c.name}`).join(" and ")}`).join('')}
    where
      ${sqlFilters.map(f => `(${f.columns.map(c => `(${this._filterParameters[f.name]} is null or ${c.source.name}.${c.name} = ${this._filterParameters[f.name]})`).join(" or ")})`).join(" and \n")}
    ;`;
    console.log(query);
    
    return new Promise((resolve)=> {
      this._dbPool.query(query, (err, results)=> {
        console.log(err, results);
        resolve(results);
      });
    });
    
    
  }
}