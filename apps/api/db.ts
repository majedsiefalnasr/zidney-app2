import { db as apiDb, getTenantPool as apiGetTenantPool } from './src/db'

export const db = apiDb
export const pool = apiDb.master
export const getTenantPool = apiGetTenantPool
