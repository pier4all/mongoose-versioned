import { Mongoose } from "mongoose";

interface Options {
  collection?: any,
  logError?: boolean,
  ensureIndex?: boolean,
  mongoose?: Mongoose,
  connection?: Mongoose
}

export { Options }
