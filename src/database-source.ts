import { SqlDataValue } from "./data-gatherer";

export class DatabaseSource {
  constructor(
    public name: string,
    public columns: SqlDataValue[]
  ) {
    
  }
}